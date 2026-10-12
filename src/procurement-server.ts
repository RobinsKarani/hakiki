import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import {
  checkCompleteness,
  checkSchema,
  extractRequirements,
  extractSchema,
  reportSchema,
  writeReport,
} from "./procurement.ts";
import { documentSchema, referenceSchema } from "./workspace.ts";

export function createServer(root: string) {
  const server = new McpServer({
    name: "procurement-review-mcp",
    version: "0.1.0",
  });
  const result = (value: Record<string, unknown>) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  });
  server.registerTool(
    "extract_tender_requirements",
    {
      description:
        "Extract model-proposed requirements after verifying exact source passages. Return all stable IDs; repeated identical extraction is idempotent. Use kind null unless a document category is explicitly required. Keep quote line breaks exact or use a short exact substring. Call after reading the tender.",
      inputSchema: extractSchema,
      outputSchema: z.object({
        requirements: z.array(
          z.object({
            id: z.string(),
            label: z.string(),
            kind: documentSchema.shape.kind.nullable(),
            uncertainty: z.string(),
            source: referenceSchema,
          }),
        ),
        limit: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => result(await extractRequirements(root, args)),
  );
  server.registerTool(
    "check_bid_completeness",
    {
      description:
        "Compute every extracted requirement for a registered supplier from its selected inventory and verified evidence passages. Present means evidence supplied, not eligibility; conflicts are model-identified and need review.",
      inputSchema: checkSchema,
      outputSchema: z.object({
        findings: z.array(
          z.object({
            id: z.string(),
            requirement_id: z.string(),
            supplier_id: z.string(),
            classification: z.enum([
              "present",
              "missing",
              "conflicting",
              "inconclusive",
            ]),
            evidence: z.array(referenceSchema),
            reason: z.string(),
          }),
        ),
        human_review_required: z.literal(true),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => result(await checkCompleteness(root, args)),
  );
  server.registerTool(
    "write_review_report",
    {
      description:
        "Write one local draft report from all computed findings and verified references. Every substantive finding needs uncertainty. No arbitrary paths, awards, disqualification or approval. Call once, after checking all suppliers.",
      inputSchema: reportSchema,
      outputSchema: z.object({
        report: z.literal("output/draft.md"),
        findings: z.literal("output/findings.json"),
        status: z.literal("draft"),
        human_review_required: z.literal(true),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async (args) => result(await writeReport(root, args)),
  );
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const root = process.env.REVIEW_RUN_ROOT;
  if (!root) throw new Error("REVIEW_RUN_ROOT is required");
  serveStdio(() => createServer(root));
}
