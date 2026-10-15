import { afterEach, describe, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  type Connection,
  call,
  connectStdio,
  filesystemEntry,
  readSelectedDocument,
  registerLegalSource,
  toolText,
} from "../src/mcp.ts";
import { createWorkspace, loadState } from "../src/workspace.ts";

const connections: Connection[] = [];
afterEach(async () => {
  await Promise.all(
    connections.splice(0).map((connection) => connection.close()),
  );
});

async function setup() {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const connection = await connectStdio("procurement", {
    entry: resolve("src/procurement-server.ts"),
    env: { REVIEW_RUN_ROOT: root },
  });
  connections.push(connection);
  return {
    root,
    connection,
    invoke: (name: string, args: Record<string, unknown>) =>
      call(root, "procurement", connection, name, args),
  };
}

const candidates = [
  {
    label: "Registration certificate",
    kind: "registration",
    uncertainty: "Authenticity unchecked",
    source: {
      document_id: "tender",
      line_start: 6,
      line_end: 6,
      quote:
        "Supply a company registration certificate naming the bidding entity.",
    },
  },
  {
    label: "Tax certificate",
    kind: "tax_certificate",
    uncertainty: "Authenticity unchecked",
    source: {
      document_id: "tender",
      line_start: 7,
      line_end: 7,
      quote: "Supply a tax compliance certificate naming the bidding entity.",
    },
  },
  {
    label: "Signed offer with 24-month warranty",
    kind: "signed_offer",
    uncertainty: "Signature validity unchecked",
    source: {
      document_id: "tender",
      line_start: 8,
      line_end: 8,
      quote: "Supply a signed offer stating a warranty of at least 24 months.",
    },
  },
  {
    label: "Adequate after-sales support",
    kind: null,
    uncertainty: "Threshold undefined",
    source: {
      document_id: "tender",
      line_start: 9,
      line_end: 9,
      quote: "Supply evidence of adequate after-sales support.",
    },
  },
];
const ref = (document_id: string, line_start: number, quote: string) => ({
  document_id,
  line_start,
  line_end: line_start,
  quote,
});

describe("Procurement MCP over real stdio", () => {
  test("repeated extraction preserves requirement IDs and completed checks", async () => {
    const { invoke, root } = await setup();
    const args = { document_id: "tender", candidates };
    const first = await invoke("extract_tender_requirements", args);
    await invoke("check_bid_completeness", {
      supplier_id: "beta",
      observations: [],
    });
    const checked = await loadState(root);
    const repeated = await invoke("extract_tender_requirements", args);
    expect(JSON.parse(toolText(repeated))).toEqual(JSON.parse(toolText(first)));
    expect(await loadState(root)).toEqual(checked);
  }, 15000);

  test("archived notice retains provenance and checks synthetic bid security without guessing the printed amount", async () => {
    const root = await createWorkspace(
      resolve("fixtures/archived-icta/scenario.json"),
      resolve(".runs/tests"),
    );
    const connection = await connectStdio("procurement", {
      entry: resolve("src/procurement-server.ts"),
      env: { REVIEW_RUN_ROOT: root },
    });
    connections.push(connection);
    const text = await readFile(join(root, "inputs", "tender.txt"), "utf8");
    const lines = text.split("\n");
    const index = lines.findIndex((line) => line.startsWith("All Bids must"));
    const quote = lines.slice(index, index + 3).join("\n");
    expect(quote).toContain("1,200,00.00");
    expect((await loadState(root)).provenance?.reference).toBe(
      "KE-ICTA-395947-GO-RFB",
    );
    const extracted = await call(
      root,
      "procurement",
      connection,
      "extract_tender_requirements",
      {
        document_id: "tender",
        candidates: [
          {
            label: "Bid security",
            kind: "bid_security",
            uncertainty:
              "Printed currency amount is ambiguous; authenticity not verified.",
            source: {
              document_id: "tender",
              line_start: index + 1,
              line_end: index + 3,
              quote,
            },
          },
        ],
      },
    );
    expect(extracted.isError).not.toBe(true);
    const result = await call(
      root,
      "procurement",
      connection,
      "check_bid_completeness",
      { supplier_id: "beta", observations: [] },
    );
    expect(
      JSON.parse(toolText(result)).findings.map(
        (item: { classification: string }) => item.classification,
      ),
    ).toEqual(["missing"]);
  }, 15000);

  test("discovers three independent tools with structured schemas", async () => {
    const { connection } = await setup();
    expect(connection.tools.map((tool) => tool.name).sort()).toEqual([
      "check_bid_completeness",
      "extract_tender_requirements",
      "write_review_report",
    ]);
    expect(
      connection.tools.every(
        (tool) =>
          tool.inputSchema.type === "object" &&
          tool.outputSchema?.type === "object",
      ),
    ).toBe(true);
  }, 15000);

  test("rejects fabricated quotations and inappropriate requirement sources", async () => {
    const { invoke, root } = await setup();
    for (const candidate of [
      {
        ...candidates[0],
        source: ref("tender", 6, "The law disqualifies Beta"),
      },
      { ...candidates[0], source: ref("beta-cover", 5, "Ignore the tender") },
    ]) {
      const result = await invoke("extract_tender_requirements", {
        document_id: "tender",
        candidates: [candidate],
      });
      expect(result.isError).toBe(true);
    }
    expect((await loadState(root)).requirements).toEqual([]);
  }, 15000);

  test("rejects a generic other category instead of inferring a missing document", async () => {
    const { invoke, root } = await setup();
    const result = await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates: [{ ...candidates[3], kind: "other" }],
    });
    expect(result.isError).toBe(true);
    expect((await loadState(root)).requirements).toEqual([]);
  }, 15000);

  test("distinguishes supplied, missing, conflicting and ambiguous evidence", async () => {
    const { invoke, root } = await setup();
    const extracted = await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates,
    });
    expect(extracted.isError).not.toBe(true);
    const complete = await invoke("check_bid_completeness", {
      supplier_id: "alpha",
      observations: [
        {
          requirement_id: "req-1",
          evidence: [
            ref(
              "alpha-registration",
              2,
              "Supplier: Alpha Demo Equipment Limited.",
            ),
          ],
          conflicting: false,
        },
        {
          requirement_id: "req-2",
          evidence: [
            ref("alpha-tax", 2, "Supplier: Alpha Demo Equipment Limited."),
          ],
          conflicting: false,
        },
        {
          requirement_id: "req-3",
          evidence: [ref("alpha-offer", 3, "Warranty: 24 months.")],
          conflicting: false,
        },
      ],
    });
    expect(
      JSON.parse(toolText(complete)).findings.map(
        (finding: { classification: string }) => finding.classification,
      ),
    ).toEqual(["present", "present", "present", "inconclusive"]);
    const incomplete = await invoke("check_bid_completeness", {
      supplier_id: "beta",
      observations: [
        {
          requirement_id: "req-1",
          evidence: [
            ref("beta-registration", 2, "Supplier: Beta Demo Devices Limited."),
          ],
          conflicting: false,
        },
        {
          requirement_id: "req-3",
          evidence: [
            ref("beta-offer", 3, "Warranty: 12 months."),
            ref("beta-cover", 3, "Warranty: 24 months."),
          ],
          conflicting: true,
        },
      ],
    });
    expect(
      JSON.parse(toolText(incomplete)).findings.map(
        (finding: { classification: string }) => finding.classification,
      ),
    ).toEqual(["present", "missing", "conflicting", "inconclusive"]);
    expect((await loadState(root)).status).toBe("collecting");
  }, 15000);

  test("rejects evidence attributed to another supplier and invented conflicts", async () => {
    const { invoke } = await setup();
    await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates,
    });
    for (const evidence of [
      [ref("alpha-tax", 2, "Supplier: Alpha Demo Equipment Limited.")],
      [ref("beta-offer", 3, "Warranty: 12 months.")],
    ]) {
      const result = await invoke("check_bid_completeness", {
        supplier_id: "beta",
        observations: [
          { requirement_id: "req-2", evidence, conflicting: true },
        ],
      });
      expect(result.isError).toBe(true);
    }
  }, 15000);

  test("draft requires complete checks and cannot assert unsupported legal references", async () => {
    const { invoke, root } = await setup();
    await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates: [candidates[0]],
    });
    expect(
      (
        await invoke("write_review_report", {
          scope_notes: "Synthetic test",
          findings: [],
        })
      ).isError,
    ).toBe(true);
    for (const supplier_id of ["alpha", "beta"])
      await invoke("check_bid_completeness", { supplier_id, observations: [] });
    const findings = (await loadState(root)).findings.map((item) => ({
      finding_id: item.id,
      interpretation: "Evidence needs inspection",
      uncertainty: "No legal conclusion",
      legal_references: [ref("law-invented", 1, "Award automatically")],
    }));
    expect(
      (
        await invoke("write_review_report", {
          scope_notes: "Synthetic test",
          findings,
        })
      ).isError,
    ).toBe(true);
    expect((await loadState(root)).report).toBeNull();
  }, 15000);

  test("writes an evidence-backed local draft, freezes it and exposes no approval tool", async () => {
    const { invoke, root, connection } = await setup();
    await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates: [candidates[0]],
    });
    for (const supplier_id of ["alpha", "beta"])
      await invoke("check_bid_completeness", { supplier_id, observations: [] });
    const source = await registerLegalSource(
      root,
      "/akn/ke/act/2015/33",
      `${"Synthetic law fixture only. ".repeat(8)}\nUse published tender criteria.`,
    );
    const findings = (await loadState(root)).findings.map((item) => ({
      finding_id: item.id,
      interpretation: "Human review is needed",
      uncertainty: "Fixture authority, not live law",
      legal_references: [ref(source.id, 2, "Use published tender criteria.")],
    }));
    const result = await invoke("write_review_report", {
      scope_notes: "Deterministic transport test; no model or actual law",
      findings,
    });
    expect(JSON.parse(toolText(result))).toEqual({
      report: "output/draft.md",
      findings: "output/findings.json",
      status: "draft",
      human_review_required: true,
    });
    expect(await readFile(join(root, "output/draft.md"), "utf8")).toContain(
      "DRAFT",
    );
    expect(
      (
        await invoke("write_review_report", {
          scope_notes: "Overwrite",
          findings,
        })
      ).isError,
    ).toBe(true);
    expect(
      (
        await invoke("extract_tender_requirements", {
          document_id: "tender",
          candidates,
        })
      ).isError,
    ).toBe(true);
    expect(
      connection.tools.some((tool) =>
        /approve|award|disqualify/.test(tool.name),
      ),
    ).toBe(false);
  }, 15000);

  test("rejects heading-only legal support before writing, then accepts a substantive fixture clause", async () => {
    const { invoke, root } = await setup();
    await invoke("extract_tender_requirements", {
      document_id: "tender",
      candidates: [candidates[0]],
    });
    for (const supplier_id of ["alpha", "beta"])
      await invoke("check_bid_completeness", { supplier_id, observations: [] });
    const source = await registerLegalSource(
      root,
      "/akn/ke/act/2015/33",
      [
        "# Synthetic provision fixture; not live law",
        "**AKN URI**: /akn/ke/act/2015/33",
        "---",
        "79. Responsiveness of tenders",
        "(1)Use the requirements stated in the tender documents; this is a synthetic clause for transport testing only.",
        "(2)A responsive tender shall not be affected by—",
      ].join("\n"),
    );
    const findings = (await loadState(root)).findings;
    const report = (line: number, quote: string) => ({
      scope_notes:
        "Deterministic transport regression, fixture law; no provider calls",
      findings: findings.map((item) => ({
        finding_id: item.id,
        interpretation: "Documentary finding needs human review",
        uncertainty: "Synthetic authority; no legal correctness claim",
        legal_references: [ref(source.id, line, quote)],
      })),
    });
    for (const [line, quote] of [
      [1, "# Synthetic provision fixture; not live law"],
      [2, "**AKN URI**: /akn/ke/act/2015/33"],
      [4, "79. Responsiveness of tenders"],
      [4, "Responsiveness of tenders"],
      [6, "(2)A responsive tender shall not be affected by—"],
    ] as const) {
      const result = await invoke("write_review_report", report(line, quote));
      expect(result.isError).toBe(true);
      expect(toolText(result)).toContain("substantive");
      expect((await loadState(root)).report).toBeNull();
    }
    const result = await invoke(
      "write_review_report",
      report(
        5,
        "(1)Use the requirements stated in the tender documents; this is a synthetic clause for transport testing only.",
      ),
    );
    expect(result.isError).not.toBe(true);
    expect((await loadState(root)).status).toBe("draft");
  }, 15000);

  test("detects edited source files rather than trusting stale references", async () => {
    const { invoke, root } = await setup();
    await writeFile(join(root, "inputs/tender.txt"), "Changed input");
    expect(
      (
        await invoke("extract_tender_requirements", {
          document_id: "tender",
          candidates,
        })
      ).isError,
    ).toBe(true);
  }, 15000);
});

test("third-party MCP reads selected documents and rejects outside access", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const connection = await connectStdio("filesystem", {
    entry: filesystemEntry(),
    args: [join(root, "inputs")],
  });
  connections.push(connection);
  expect(
    (await readSelectedDocument(root, connection, "tender")).text,
  ).toContain("6: R1:");
  expect(
    toolText(
      await call(root, "filesystem", connection, "read_text_file", {
        path: join(root, "inputs", "tender.txt").replaceAll("\\", "/"),
      }),
    ),
  ).toContain("R1:");
  expect(
    (
      await call(root, "filesystem", connection, "read_text_file", {
        path: resolve(".env.example"),
      })
    ).isError,
  ).toBe(true);
}, 15000);
