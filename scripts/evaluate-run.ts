import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { digest, loadState } from "../src/workspace.ts";

// Score an existing genuine run; never invoke a model or manufacture missing results.
const { values } = parseArgs({ options: { run: { type: "string" } } });
if (!values.run || !/^[a-f0-9-]{36}$/.test(values.run))
  throw new Error("Use --run <existing run UUID>");
const root = resolve(".runs", values.run);
const state = await loadState(root);
const trace = (await readFile(join(root, "trace.jsonl"), "utf8"))
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const expected = [
  {
    supplier: "alpha",
    classifications: ["present", "present", "present", "inconclusive"],
  },
  {
    supplier: "beta",
    classifications: ["present", "missing", "conflicting", "inconclusive"],
  },
];
const cases = expected.flatMap(({ supplier, classifications }) =>
  classifications.map((classification, index) => {
    const requirements = state.requirements.filter(
      (item) =>
        item.source.document_id === "tender" &&
        item.source.line_start === index + 6,
    );
    const findings = state.findings.filter(
      (item) =>
        item.supplier_id === supplier &&
        requirements.some(
          (requirement) => requirement.id === item.requirement_id,
        ),
    );
    return {
      task: `${supplier}/R${index + 1}`,
      expected: classification,
      actual: findings.map((item) => item.classification),
      pass:
        requirements.length === 1 &&
        findings.length === 1 &&
        findings[0]?.classification === classification,
    };
  }),
);
const end = trace.findLast((item) => item.type === "run_end");
const servers = [
  ...new Set(
    trace
      .filter((item) => item.type === "tool_end" && item.status === "ok")
      .map((item) => item.server),
  ),
].sort();
const reportMatches =
  state.report &&
  digest(await readFile(join(root, "output", state.report), "utf8")) ===
    state.report_sha256;
const scope =
  state.title === "Fictional Amani County ICT equipment document review";
const result = {
  run_id: state.id,
  provider: state.provider,
  model: state.model,
  scenario_supported: scope,
  execution: state.execution,
  elapsed_ms: end?.elapsed_ms ?? null,
  usage: state.usage,
  actual_mcp_servers: servers,
  model_turns: trace.filter((item) => item.type === "model_turn").length,
  tool_calls: trace.filter((item) => item.type === "agent_tool_start").length,
  recoverable_errors: trace.filter(
    (item) =>
      item.type === "agent_tool_end" && item.outputs && "error" in item.outputs,
  ).length,
  report_hash_matches: Boolean(reportMatches),
  matrix_passed: cases.filter((item) => item.pass).length,
  cases,
  pass:
    scope &&
    state.execution === "completed" &&
    Boolean(reportMatches) &&
    servers.join(",") === "filesystem,kenyalaw,procurement" &&
    cases.every((item) => item.pass),
  limit:
    "This scores documentary classifications, not legal interpretation, supplier authenticity or general model reliability.",
};
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
