import { expect, test } from "bun:test";
import { appendFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { evaluateRun } from "../scripts/evaluate-run.ts";
import { createWorkspace, loadState, saveState } from "../src/workspace.ts";

test("saved-run scorer rejects wrong requirement passages and changed inputs; no model or MCP calls", async () => {
  const root = await createWorkspace(
    resolve("fixtures/minimal-scenario.json"),
    resolve(".runs/tests"),
  );
  const state = await loadState(root);
  // Deliberately invalid artifact fixture, never a claimed agent execution.
  const wrongSource = {
    document_id: "tender",
    line_start: 4,
    line_end: 5,
    quote: "R1: Provide a tax compliance certificate naming the supplier.",
  };
  state.requirements = [
    {
      id: "req-1",
      label: "Tax",
      kind: "tax_certificate",
      uncertainty: "Fixture",
      source: wrongSource,
    },
    {
      id: "req-2",
      label: "Offer",
      kind: "signed_offer",
      uncertainty: "Fixture",
      source: wrongSource,
    },
  ];
  state.findings = ["alpha", "beta"].flatMap((supplier) =>
    state.requirements.map((requirement) => ({
      id: `${supplier}-${requirement.id}`,
      supplier_id: supplier,
      requirement_id: requirement.id,
      classification:
        supplier === "beta" && requirement.id === "req-1"
          ? ("missing" as const)
          : ("present" as const),
      evidence: [],
      reason: "Scorer artifact fixture, not a tool finding",
    })),
  );
  await saveState(root, state);
  await writeFile(
    join(root, "trace.jsonl"),
    `${JSON.stringify({ type: "artifact_fixture", model_calls: 0, mcp_calls: 0 })}\n`,
    { flag: "wx" },
  );
  const result = await evaluateRun(basename(root), "minimal", {
    runsRoot: resolve(".runs/tests"),
  });
  expect({
    matches: result.fixture_hashes_match,
    cases: result.cases.map((item) => item.pass),
    servers: result.actual_mcp_servers,
    turns: result.model_turns,
    pass: result.pass,
  }).toEqual({
    matches: true,
    cases: [true, false, true, false],
    servers: [],
    turns: 0,
    pass: false,
  });

  await appendFile(
    join(root, "inputs/alpha-tax.txt"),
    "\nSynthetic change after registration.\n",
  );
  const changed = await evaluateRun(basename(root), "minimal", {
    runsRoot: resolve(".runs/tests"),
  });
  expect({ matches: changed.fixture_hashes_match, pass: changed.pass }).toEqual(
    { matches: false, pass: false },
  );
});
