import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { z } from "zod";
import { hasRetrievedProvision } from "../src/mcp.ts";
import {
  digest,
  type Finding,
  loadState,
  normalizeText,
  type Reference,
  type Requirement,
  scenarioSchema,
  validateReference,
} from "../src/workspace.ts";

const classification = z.enum([
  "present",
  "missing",
  "conflicting",
  "inconclusive",
]);
export const evaluationCases = z
  .array(
    z.object({
      id: z.string(),
      scenario: z.string(),
      requirements: z.array(
        z.object({
          line: z.number().int().positive(),
          kind: z.string().nullable(),
        }),
      ),
      suppliers: z.record(z.string(), z.array(classification)),
    }),
  )
  .parse(
    JSON.parse(
      await readFile(resolve("fixtures/evaluations/cases.json"), "utf8"),
    ),
  );

// Score saved artifacts only. Expected classifications never enter the agent prompt.
export async function evaluateRun(
  runId: string,
  caseId = "amani",
  options: { runsRoot?: string } = {},
) {
  if (!/^[a-f0-9-]{36}$/.test(runId))
    throw new Error("Use an existing run UUID");
  const expected = evaluationCases.find((item) => item.id === caseId);
  if (!expected) throw new Error("Unknown evaluation case");
  const root = resolve(options.runsRoot ?? ".runs", runId);
  const state = await loadState(root);
  const scenario = scenarioSchema.parse(
    JSON.parse(await readFile(resolve(expected.scenario), "utf8")),
  );
  const trace = (await readFile(join(root, "trace.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const fixtureMatches =
    state.id === runId &&
    state.title === scenario.title &&
    state.documents.length === scenario.documents.length &&
    (
      await Promise.all(
        scenario.documents.map(async (document) => {
          const actual = state.documents.find(
            (item) => item.id === document.id,
          );
          return (
            actual?.role === document.role &&
            actual?.kind === document.kind &&
            actual?.supplier_id === document.supplier_id &&
            digest(
              await readFile(join(root, "inputs", actual.file), "utf8"),
            ) === actual.sha256 &&
            actual.sha256 ===
              digest(
                normalizeText(
                  await readFile(
                    resolve(dirname(expected.scenario), document.file),
                    "utf8",
                  ),
                ),
              )
          );
        }),
      )
    ).every(Boolean);
  const tender = scenario.documents.find((item) => item.id === "tender");
  if (!tender) throw new Error("Evaluation fixture needs the tender source");
  const tenderLines = normalizeText(
    await readFile(resolve(dirname(expected.scenario), tender.file), "utf8"),
  ).split("\n");
  const cases = Object.entries(expected.suppliers).flatMap(
    ([supplier, classifications]) =>
      classifications.map((value, index) => {
        const requirement = expected.requirements[index];
        const requirements = state.requirements.filter(
          (item) =>
            requirement &&
            item.source.document_id === "tender" &&
            item.source.line_start <= requirement.line &&
            item.source.line_end >= requirement.line &&
            item.kind === requirement.kind &&
            item.source.quote.includes(
              tenderLines[requirement.line - 1]?.replace(/^R[0-9]+:\s*/, "") ??
                "INVALID ORACLE LINE",
            ),
        );
        const findings = state.findings.filter(
          (item) =>
            item.supplier_id === supplier &&
            requirements.some((r) => r.id === item.requirement_id),
        );
        return {
          task: `${supplier}/R${index + 1}`,
          expected: value,
          actual: findings.map((item) => item.classification),
          pass:
            requirements.length === 1 &&
            findings.length === 1 &&
            findings[0]?.classification === value,
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
  let evidenceValid = true;
  let reportMatches = false;
  let matrixMatches = false;
  let citationsPresent = false;
  try {
    for (const requirement of state.requirements)
      await validateReference(root, state, requirement.source);
    for (const finding of state.findings)
      for (const ref of finding.evidence)
        await validateReference(root, state, ref);
    if (state.report) {
      reportMatches =
        digest(await readFile(join(root, "output", state.report), "utf8")) ===
        state.report_sha256;
      const report = JSON.parse(
        await readFile(join(root, "output/findings.json"), "utf8"),
      ) as {
        run_id: string;
        findings: (Finding & {
          requirement: Requirement;
          legal_references: Reference[];
        })[];
      };
      matrixMatches =
        report.run_id === state.id &&
        report.findings.length === state.findings.length &&
        new Set(report.findings.map((item) => item.id)).size ===
          report.findings.length &&
        report.findings.every((item) =>
          state.findings.some(
            (stored) =>
              (Object.keys(stored) as (keyof Finding)[]).every(
                (key) =>
                  JSON.stringify(stored[key]) === JSON.stringify(item[key]),
              ) &&
              JSON.stringify(item.requirement) ===
                JSON.stringify(
                  state.requirements.find(
                    (r) => r.id === stored.requirement_id,
                  ),
                ),
          ),
        );
      const cited = new Set<string>();
      for (const finding of report.findings)
        for (const ref of finding.legal_references) {
          await validateReference(root, state, ref, { legal: true });
          cited.add(ref.document_id);
        }
      const sources = state.legal_sources.filter((item) => cited.has(item.id));
      citationsPresent =
        hasRetrievedProvision(sources, { actPath: "/akn/ke/act/2015/33" }) &&
        hasRetrievedProvision(sources, {
          actPath: "/akn/ke/act/2010/constitution",
          provision: "227",
        });
    }
  } catch {
    evidenceValid = false;
  }
  const noHumanDecision =
    !trace.some((item) => item.type === "human_decision") &&
    state.status === "draft" &&
    (await access(join(root, "review-decision.json")).then(
      () => false,
      (error) => error.code === "ENOENT",
    ));
  return {
    run_id: state.id,
    case_id: caseId,
    provider: state.provider,
    model: state.model,
    fixture_hashes_match: fixtureMatches,
    execution: state.execution,
    elapsed_ms: end?.elapsed_ms ?? null,
    usage: state.usage,
    actual_mcp_servers: servers,
    model_turns: trace.filter((item) => item.type === "model_turn").length,
    tool_calls: trace.filter((item) => item.type === "agent_tool_start").length,
    recoverable_errors: trace.filter(
      (item) =>
        item.type === "agent_tool_end" &&
        item.outputs &&
        "error" in item.outputs,
    ).length,
    provider_failure: end?.provider_failure ?? null,
    report_sha256: state.report_sha256,
    report_hash_matches: reportMatches,
    report_matrix_matches: matrixMatches,
    source_quotes_valid: evidenceValid,
    both_authorities_cited: citationsPresent,
    human_review_pending: noHumanDecision,
    requirements_complete:
      state.requirements.length === expected.requirements.length,
    matrix_passed: cases.filter((item) => item.pass).length,
    cases,
    pass:
      fixtureMatches &&
      state.execution === "completed" &&
      reportMatches &&
      matrixMatches &&
      evidenceValid &&
      citationsPresent &&
      noHumanDecision &&
      servers.join(",") === "filesystem,kenyalaw,procurement" &&
      state.requirements.length === expected.requirements.length &&
      state.findings.length === cases.length &&
      cases.every((item) => item.pass),
    limit:
      "Scores extraction categories, documentary classifications, source integrity and actual integrations. Legal relevance, authenticity and model interpretations require human review; present does not mean compliant.",
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const { values } = parseArgs({
    options: {
      run: { type: "string" },
      case: { type: "string", default: "amani" },
    },
  });
  if (!values.run)
    throw new Error("Use --run <existing run UUID> [--case <case ID>]");
  const result = await evaluateRun(values.run, values.case);
  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
}
