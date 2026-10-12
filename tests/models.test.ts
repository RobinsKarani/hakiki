import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { createChatModel, localEndpoint } from "../src/chat-model.ts";
import { probeLocalModel } from "../src/model-probe.ts";
import { modelChoice } from "../src/models.ts";

test("custom inference is limited to literal HTTP loopback endpoints", () => {
  expect(localEndpoint("http://localhost:11434/v1/")).toBe(
    "http://127.0.0.1:11434/v1",
  );
  expect(
    modelChoice({ provider: "groq", model: "openai/gpt-oss-120b" }),
  ).toEqual({ provider: "groq", model: "openai/gpt-oss-120b" });
  for (const url of [
    "https://remote.example/v1",
    "http://169.254.169.254/v1",
    "http://localhost.evil.example/v1",
    "http://user:password@127.0.0.1/v1",
    "http://127.0.0.1/v1?key=secret",
    "http://127.0.0.1/admin",
  ])
    expect(() => localEndpoint(url)).toThrow();
});

test("official SDK exchanges structured tool calls with a local HTTP fixture and consumes its response", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    const input = JSON.parse(body);
    requests.push(input);
    const toolOutput = input.messages.find(
      (message: { role: string }) => message.role === "tool",
    );
    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "fixture-tool-model",
        choices: [
          {
            index: 0,
            finish_reason: toolOutput ? "stop" : "tool_calls",
            message: toolOutput
              ? {
                  role: "assistant",
                  content: JSON.parse(toolOutput.content).receipt,
                }
              : {
                  role: "assistant",
                  content: null,
                  tool_calls: [
                    {
                      id: "fixture-call",
                      type: "function",
                      function: {
                        name: "confirm_tool_support",
                        arguments: '{"value":"ready"}',
                      },
                    },
                  ],
                },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      }),
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture port");
  try {
    const result = await probeLocalModel(
      modelChoice({
        provider: "local",
        model: "fixture-tool-model",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      }),
    );
    expect(result.tool_calling_verified).toBe(true);
    expect(requests.length).toBe(2);
    expect(requests[1]?.tools).toBeUndefined();
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("local inference rejects redirects instead of forwarding credentials", async () => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response
      .writeHead(302, {
        Location: "https://untrusted.example/v1/chat/completions",
      })
      .end();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture port");
  try {
    await expect(
      probeLocalModel(
        modelChoice({
          provider: "local",
          model: "fixture",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
        }),
      ),
    ).rejects.toThrow("no automatic retry");
    expect(requests).toBe(1);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("compacted chat context retains the actual plan and labelled successful tool evidence", async () => {
  const histories: { role: string; content: string }[][] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk.toString();
    histories.push(JSON.parse(body).messages);
    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        id: "fixture",
        object: "chat.completion",
        created: 1,
        model: "fixture",
        choices: [
          {
            index: 0,
            finish_reason: "stop",
            message: {
              role: "assistant",
              content:
                histories.length === 1 ? "Actual fixture plan" : "Continue",
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    );
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing port");
  try {
    const model = createChatModel(
      {
        provider: "local",
        model: "fixture",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
      },
      "instructions",
      "task",
    );
    await model.turn([], AbortSignal.timeout(2000));
    model.accept(
      {
        id: "fixture-call",
        name: "procurement__extract_tender_requirements",
        args: { document_id: "tender" },
      },
      { requirements: [{ id: "req-1", kind: null }] },
    );
    for (let index = 0; index < 4; index++)
      await model.turn([], AbortSignal.timeout(2000));
    expect(histories.at(-1)).toContainEqual({
      role: "assistant",
      content: "Actual fixture plan",
    });
    const memory = histories
      .at(-1)
      ?.find((item) => item.content.startsWith("Completed tool calls"));
    expect(memory?.content).toContain(
      '"tool":"procurement__extract_tender_requirements"',
    );
    expect(memory?.content).toContain('"id":"req-1"');
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
