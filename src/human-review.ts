import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { event } from "./mcp.ts";
import { containedFile, digest, loadState, saveState } from "./workspace.ts";

export const decisionSchema = z
  .object({
    action: z.enum(["approve", "reject", "request_revision"]),
    reviewer: z.string().trim().min(2).max(100),
    note: z.string().trim().min(1).max(1500),
  })
  .strict();

export async function recordHumanDecision(
  root: string,
  input: z.infer<typeof decisionSchema>,
) {
  const decision = decisionSchema.parse(input);
  const state = await loadState(root);
  if (
    state.status !== "draft" ||
    !state.report ||
    state.execution !== "completed"
  )
    throw new Error(
      "Only a completed review with an existing draft can receive a human decision",
    );
  const reportHash = digest(
    await readFile(await containedFile(root, "output/draft.md"), "utf8"),
  );
  if (reportHash !== state.report_sha256)
    throw new Error("Draft changed after generation; approval refused");
  const record = {
    ...decision,
    timestamp: new Date().toISOString(),
    meaning: "Review of this draft only; no procurement decision authorized",
    report_sha256: reportHash,
  };
  await writeFile(
    join(root, "review-decision.json"),
    JSON.stringify(record, null, 2),
    { flag: "wx" },
  );
  state.status =
    decision.action === "approve"
      ? "approved"
      : decision.action === "reject"
        ? "rejected"
        : "revision_requested";
  await saveState(root, state);
  await event(root, {
    type: "human_decision",
    ...record,
    status: state.status,
  });
  return { status: state.status, ...record };
}
