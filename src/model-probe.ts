import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createModel, type ModelChoice } from "./models.ts";

export async function probeLocalModel(choice: ModelChoice) {
  if (choice.provider !== "local")
    throw new Error("Probe is only for local inference");
  const receipt = randomUUID();
  const model = createModel(
    choice,
    "Call confirm_tool_support once with value ready. After its response, reply only with the receipt returned by the tool. Do not invent a receipt.",
    "Test tool calling and tool-response continuation; no procurement documents are provided.",
  );
  const signal = AbortSignal.timeout(60000);
  const first = await model.turn(
    [
      {
        name: "confirm_tool_support",
        inputSchema: {
          type: "object",
          properties: { value: { type: "string", enum: ["ready"] } },
          required: ["value"],
          additionalProperties: false,
        },
      },
    ],
    signal,
  );
  const call = first.calls[0];
  if (
    first.calls.length !== 1 ||
    call?.name !== "confirm_tool_support" ||
    call.args.value !== "ready" ||
    Object.keys(call.args).length !== 1
  )
    throw new Error(
      "Endpoint did not return the required structured tool call",
    );
  const output = { receipt };
  model.accept(call, output);
  const second = await model.turn([], signal);
  if (second.calls.length || second.text.trim() !== receipt)
    throw new Error("Endpoint did not correctly consume the tool response");
  await mkdir(resolve(".runs"), { recursive: true });
  await writeFile(
    resolve(`.runs/model-probe-${receipt}.json`),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        provider: choice.provider,
        model: choice.model,
        endpoint: choice.baseUrl,
        call,
        output,
        continuation: second,
        tool_calling_verified: true,
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  return {
    tool_calling_verified: true,
    model: choice.model,
    endpoint: choice.baseUrl,
    limitation:
      "A probe verifies this conversation pattern, not reliable procurement reasoning or on-device inference.",
  };
}
