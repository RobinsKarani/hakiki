import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

serveStdio(() => {
  const server = new McpServer({
    name: "protocol-test-fixture-not-kenyalaw",
    version: "0.0.0",
  });
  server.registerTool(
    "probe",
    {
      inputSchema: z.object({ value: z.string() }).strict(),
      outputSchema: z.object({
        value: z.string(),
        openai_key_present: z.boolean(),
        gemini_key_present: z.boolean(),
        groq_key_present: z.boolean(),
        local_key_present: z.boolean(),
      }),
    },
    async ({ value }) => {
      const result = {
        value,
        openai_key_present: Boolean(process.env.OPENAI_API_KEY),
        gemini_key_present: Boolean(process.env.GEMINI_API_KEY),
        groq_key_present: Boolean(process.env.GROQ_API_KEY),
        local_key_present: Boolean(process.env.LOCAL_MODEL_API_KEY),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );
  return server;
});
