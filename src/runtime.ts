import { z } from "zod";
import { event, type ToolDefinition } from "./mcp.ts";
import type { Model, ModelCall } from "./models.ts";
import { loadState, saveState } from "./workspace.ts";

/** Task-specific sequential loop. The model chooses actions; the host owns limits and writes. */
export async function runAgent(options: {
  root: string;
  model: Model;
  tools: ToolDefinition[];
  execute: (call: ModelCall) => Promise<unknown>;
  signal: AbortSignal;
  onEvent?: (entry: Record<string, unknown>) => void;
}) {
  const usage = { turns: 0, calls: 0, input_tokens: 0, output_tokens: 0 };
  while (usage.turns < 20) {
    options.signal.throwIfAborted();
    if (usage.input_tokens + usage.output_tokens >= 160000)
      throw new Error("Model token budget reached");
    // A separate first model turn makes the displayed plan observable, not a canned checklist.
    const turn = await options.model.turn(
      usage.turns === 0 ? [] : options.tools,
      options.signal,
    );
    usage.turns++;
    usage.input_tokens += turn.input_tokens;
    usage.output_tokens += turn.output_tokens;
    const entry = {
      type: "model_turn",
      provider: options.model.provider,
      model: options.model.name,
      turn: usage.turns,
      ...turn,
      calls: turn.calls.map((call) => ({ id: call.id, name: call.name })),
    };
    await event(options.root, entry);
    options.onEvent?.(entry);
    const state = await loadState(options.root);
    state.usage = {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    };
    if (usage.turns === 1) {
      if (!turn.text.trim() || turn.calls.length)
        throw new Error(
          "The first turn must provide a visible plan without tools",
        );
      state.plan = turn.text;
    }
    await saveState(options.root, state);
    if (usage.turns === 1) continue;
    if (!turn.calls.length) return usage;
    for (const requested of turn.calls) {
      options.signal.throwIfAborted();
      if (++usage.calls > 40) throw new Error("Tool-call budget reached");
      const validated = z
        .object({
          id: z.string().min(1),
          name: z.string().min(1).max(100),
          args: z.record(z.string(), z.unknown()),
        })
        .strict()
        .parse(requested);
      if (JSON.stringify(validated.args).length > 60000)
        throw new Error("Tool arguments exceed the limit");
      await event(options.root, {
        type: "agent_tool_start",
        call_id: validated.id,
        tool: validated.name,
        inputs: validated.args,
      });
      const result = await (async () => {
        if (!options.tools.some((tool) => tool.name === validated.name))
          return {
            error: "Tool is not permitted. Use only discovered, exposed tools.",
          };
        try {
          return await options.execute(validated);
        } catch {
          options.signal.throwIfAborted();
          return {
            error:
              "Tool failed. Check schema, selected source passages and run limits; do not invent a result.",
          };
        }
      })();
      await event(options.root, {
        type: "agent_tool_end",
        call_id: validated.id,
        tool: validated.name,
        outputs: result,
      });
      options.model.accept(validated, result);
      options.onEvent?.({
        type: "tool",
        tool: validated.name,
        status:
          typeof result === "object" && result !== null && "error" in result
            ? "error"
            : "completed",
      });
      // Never execute another proposed action after the report has frozen the workspace.
      if ((await loadState(options.root)).status === "draft") return usage;
    }
  }
  throw new Error("Model turn budget reached");
}
