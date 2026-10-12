import { setTimeout } from "node:timers/promises";
import { type Content, GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { toResponseInputItems } from "openai/lib/responses/ResponseInputItems";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import { createChatModel, localEndpoint } from "./chat-model.ts";
import type { ToolDefinition } from "./mcp.ts";

export type ModelCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};
export type ModelTurn = {
  calls: ModelCall[];
  text: string;
  input_tokens: number;
  output_tokens: number;
};
export type Model = {
  provider: string;
  name: string;
  turn: (tools: ToolDefinition[], signal: AbortSignal) => Promise<ModelTurn>;
  accept: (call: ModelCall, output: unknown) => void;
};
export type ModelChoice = {
  provider: "openai" | "gemini" | "groq" | "local";
  model: string;
  baseUrl?: string;
};

export function providerFailure(error: unknown) {
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
      ? error.status
      : null;
  const message = error instanceof Error ? error.message : "";
  // Log only fixed diagnostic categories, never raw provider errors or request URLs.
  const category =
    status === 429
      ? "quota_or_rate_limit"
      : status === 401 || status === 403
        ? "authentication_or_access"
        : /schema|function_declarations|parametersJsonSchema/i.test(message)
          ? "tool_schema"
          : /role|last.*message|contents/i.test(message)
            ? "conversation_format"
            : status === 404
              ? "model_not_available"
              : "provider_request_failed";
  const quota = message.match(/"quotaValue"\s*:\s*"(\d+)"/);
  const retry = message.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return new Error("Provider request failed; no automatic retry", {
    cause: {
      status,
      category,
      quota_limit: quota ? Number(quota[1]) : null,
      retry_after_seconds: retry ? Number(retry[1]) : null,
    },
  });
}

export function modelChoice(selection?: {
  provider: string;
  model: string;
  baseUrl?: string;
}): ModelChoice {
  const provider =
    selection?.provider ?? (process.env.REVIEW_PROVIDER || "groq");
  const model =
    selection?.model ||
    process.env.REVIEW_MODEL ||
    (provider === "openai"
      ? "gpt-5.4-mini"
      : provider === "groq"
        ? "openai/gpt-oss-120b"
        : provider === "local"
          ? "qwen3:8b"
          : "gemini-3.5-flash-lite");
  if (
    provider === "groq" &&
    ["openai/gpt-oss-120b", "openai/gpt-oss-20b"].includes(model)
  )
    return { provider, model };
  if (
    provider === "local" &&
    /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model)
  )
    return {
      provider,
      model,
      baseUrl: localEndpoint(
        selection?.baseUrl ??
          process.env.LOCAL_MODEL_BASE_URL ??
          "http://127.0.0.1:11434/v1",
      ),
    };
  if (
    provider === "openai" &&
    [
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.5",
      "gpt-5.6",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
    ].includes(model)
  )
    return { provider, model };
  if (
    provider === "gemini" &&
    [
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemma-4-26b-a4b-it",
      "gemma-4-31b-it",
    ].includes(model)
  )
    return { provider, model };
  throw new Error("Unsupported manual provider/model selection; see README");
}

export function createModel(
  choice: ModelChoice,
  instructions: string,
  request: string,
): Model {
  if (choice.provider === "groq" || choice.provider === "local") {
    const chat = createChatModel(choice, instructions, request);
    return {
      ...chat,
      async turn(tools, signal) {
        return chat.turn(tools, signal).catch((error: unknown) => {
          throw providerFailure(error);
        });
      },
    };
  }
  if (choice.provider === "openai") {
    if (!process.env.OPENAI_API_KEY?.trim())
      throw new Error("OPENAI_API_KEY is not configured locally");
    const sdk = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0,
      timeout: 60000,
    });
    const history: ResponseInputItem[] = [{ role: "user", content: request }];
    return {
      provider: choice.provider,
      name: choice.model,
      async turn(tools, signal) {
        if (JSON.stringify(history).length > 240000)
          throw new Error("Model context limit reached");
        const response = await sdk.responses
          .create(
            {
              model: choice.model,
              instructions,
              input: history,
              store: false,
              reasoning: { effort: "low" },
              max_output_tokens: 6000,
              parallel_tool_calls: false,
              tools: tools.map((tool) => ({
                type: "function",
                name: tool.name,
                description: tool.description ?? "",
                parameters: tool.inputSchema,
                strict: false,
              })),
            },
            { signal },
          )
          .catch((error: unknown) => {
            throw providerFailure(error);
          });
        if (response.status !== "completed")
          throw new Error(
            "Model response was incomplete; no tool calls executed",
          );
        // Preserve reasoning and every tool-call item, not just visible text.
        history.push(...toResponseInputItems(response.output));
        return {
          calls: response.output
            .filter((item) => item.type === "function_call")
            .map((item) => ({
              id: item.call_id,
              name: item.name,
              args: JSON.parse(item.arguments),
            })),
          text: response.output_text,
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        };
      },
      accept(call, output) {
        history.push({
          type: "function_call_output",
          call_id: call.id,
          output: JSON.stringify(output),
        });
      },
    };
  }
  if (!process.env.GEMINI_API_KEY?.trim())
    throw new Error("GEMINI_API_KEY is not configured locally");
  const sdk = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 60000, retryOptions: { attempts: 1 } },
  });
  const history: Content[] = [{ role: "user", parts: [{ text: request }] }];
  let lastRequest = 0;
  return {
    provider: choice.provider,
    name: choice.model,
    async turn(tools, signal) {
      if (JSON.stringify(history).length > 240000)
        throw new Error("Model context limit reached");
      // Pace Google calls for the small demo; this is not a retry or a guarantee against account quotas.
      const interval = choice.model.startsWith("gemma-") ? 15000 : 5000;
      const delay = Math.max(0, interval - (performance.now() - lastRequest));
      if (delay) await setTimeout(delay, undefined, { signal });
      signal.throwIfAborted();
      lastRequest = performance.now();
      const response = await sdk.models
        .generateContent({
          model: choice.model,
          contents: history,
          config: {
            systemInstruction: instructions,
            maxOutputTokens: 6000,
            abortSignal: signal,
            tools: tools.length
              ? [
                  {
                    functionDeclarations: tools.map((tool) => ({
                      name: tool.name,
                      description: tool.description ?? "",
                      parametersJsonSchema: tool.inputSchema,
                    })),
                  },
                ]
              : undefined,
          },
        })
        .catch((error: unknown) => {
          throw providerFailure(error);
        });
      const content = response.candidates?.[0]?.content;
      if (!content || response.candidates?.[0]?.finishReason !== "STOP")
        throw new Error("Gemini response incomplete; no tool calls executed");
      // Replay full content so model-specific signatures survive tool follow-up calls.
      history.push(content);
      if (!tools.length)
        history.push({
          role: "user",
          parts: [
            {
              text: "Proceed with the recorded plan using the exposed tools. Return a genuine draft or explain the remaining blocker.",
            },
          ],
        });
      return {
        calls: (response.functionCalls ?? []).map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          name: item.name ?? "",
          args: item.args ?? {},
        })),
        text: (content.parts ?? [])
          .filter((part) => typeof part.text === "string" && !part.thought)
          .map((part) => part.text)
          .join("\n"),
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens:
          (response.usageMetadata?.candidatesTokenCount ?? 0) +
          (response.usageMetadata?.thoughtsTokenCount ?? 0),
      };
    },
    accept(call, output) {
      history.push({
        role: "user",
        parts: [
          {
            functionResponse: {
              id: call.id,
              name: call.name,
              response: { result: output },
            },
          },
        ],
      });
    },
  };
}
