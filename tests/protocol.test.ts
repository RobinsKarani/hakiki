import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { call, connectStdio, toolText } from "../src/mcp.ts";
import { createWorkspace } from "../src/workspace.ts";

test("modern MCP negotiation, structured invocation, schema errors and child shutdown", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const connection = await connectStdio("protocol-fixture", {
    entry: resolve("tests/fixtures/protocol-server.ts"),
  });
  try {
    expect({
      era: connection.client.getProtocolEra(),
      protocol: connection.client.getNegotiatedProtocolVersion(),
      tools: connection.tools.map((tool) => tool.name),
    }).toEqual({ era: "modern", protocol: "2026-07-28", tools: ["probe"] });
    const result = await call(root, "protocol-fixture", connection, "probe", {
      value: "actual stdio request",
    });
    expect(result.structuredContent).toEqual({
      value: "actual stdio request",
      openai_key_present: false,
      gemini_key_present: false,
      groq_key_present: false,
      local_key_present: false,
    });
    expect(JSON.parse(toolText(result))).toEqual(result.structuredContent);
    const invalid = await connection.client.callTool({
      name: "probe",
      arguments: { value: 42 },
    });
    expect(invalid.isError).toBe(true);
    const missing = await connection.client
      .callTool(
        { name: "unknown-tool", arguments: {} },
        {
          timeout: 2000,
          toolDefinition: {
            name: "unknown-tool",
            inputSchema: { type: "object" },
          },
        },
      )
      .catch((error: unknown) => error);
    expect(missing).toMatchObject({ name: "ProtocolError", code: -32602 });
  } finally {
    await connection.close();
  }
  expect(connection.pid).not.toBeNull();
  expect(() => process.kill(connection.pid ?? -1, 0)).toThrow();
}, 15000);
