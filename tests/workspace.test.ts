import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { recordHumanDecision } from "../src/human-review.ts";
import {
  hasRetrievedProvision,
  officialLegalUrl,
  registerLegalSource,
} from "../src/mcp.ts";
import { createModel, type Model } from "../src/models.ts";
import { runAgent } from "../src/runtime.ts";
import {
  containedFile,
  createWorkspace,
  digest,
  loadState,
  saveState,
} from "../src/workspace.ts";

async function scenarioWith(file: string, text: string) {
  const root = join(tmpdir(), `procurement-input-${crypto.randomUUID()}`);
  await mkdir(root);
  await writeFile(join(root, file), text);
  const scenario = JSON.parse(
    await readFile(resolve("fixtures/scenario.json"), "utf8"),
  );
  scenario.documents = [
    scenario.documents[0],
    { ...scenario.documents[1], file },
  ];
  await writeFile(join(root, "tender.md"), "Synthetic tender");
  await writeFile(join(root, "scenario.json"), JSON.stringify(scenario));
  return join(root, "scenario.json");
}

test("rejects unsupported documents, binary content and excessive normalized text", async () => {
  for (const [file, content] of [
    ["bid.docx", "unsupported"],
    ["bid.txt", "secret\0binary"],
    ["bid.md", "x".repeat(60001)],
  ]) {
    const scenario = await scenarioWith(file ?? "", content ?? "");
    await expect(
      createWorkspace(scenario, resolve(".runs/tests")),
    ).rejects.toThrow();
  }
});

test("rejects traversal and outside paths", async () => {
  await expect(
    containedFile(resolve("fixtures"), "../package.json"),
  ).rejects.toThrow("outside");
});

test("human review requires a named reviewer and an existing draft", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  await expect(
    recordHumanDecision(root, {
      action: "approve",
      reviewer: "Demo Reviewer",
      note: "Read draft",
    }),
  ).rejects.toThrow("existing draft");
  const state = await loadState(root);
  state.status = "draft";
  state.report = "draft.md";
  await writeFile(
    join(root, "output/draft.md"),
    "DRAFT - synthetic state transition fixture",
  );
  state.report_sha256 = digest("DRAFT - synthetic state transition fixture");
  await saveState(root, state);
  for (const execution of ["ready", "failed", "cancelled"] as const) {
    state.execution = execution;
    await saveState(root, state);
    await expect(
      recordHumanDecision(root, {
        action: "approve",
        reviewer: "Fictional Test Reviewer",
        note: "Incomplete execution",
      }),
    ).rejects.toThrow("completed review");
  }
  state.execution = "completed";
  await saveState(root, state);
  await expect(
    recordHumanDecision(root, {
      action: "approve",
      reviewer: "",
      note: "Read draft",
    }),
  ).rejects.toThrow();
  const decision = await recordHumanDecision(root, {
    action: "approve",
    reviewer: "Fictional Demo Reviewer",
    note: "Test of state transition, not procurement approval",
  });
  expect(decision.status).toBe("approved");
  expect((await loadState(root)).status).toBe("approved");
  await expect(
    recordHumanDecision(root, {
      action: "reject",
      reviewer: "Demo Reviewer",
      note: "Again",
    }),
  ).rejects.toThrow();
});

test("legal retrieval destinations are official HTTPS AKN identifiers before dispatch", () => {
  expect(officialLegalUrl("/akn/ke/act/2015/33/eng@2022-12-31")).toBe(
    "https://new.kenyalaw.org/akn/ke/act/2015/33/eng@2022-12-31",
  );
  for (const uri of [
    "http://127.0.0.1/akn/ke/",
    "https://new.kenyalaw.org.evil.example/akn/ke/",
    "https://new.kenyalaw.org:444/akn/ke/",
    "/akn/ke/../../admin",
    "https://user:password@new.kenyalaw.org/akn/ke/",
  ])
    expect(() => officialLegalUrl(uri)).toThrow();
});

test("legal completion gate accepts bare and expression work URIs while requiring the retrieved article", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const source = await registerLegalSource(
    root,
    "/akn/ke/act/2010/constitution",
    "Fixture Article 227 for the URI-matching regression; this is not live law. ".repeat(
      3,
    ),
    { provision: "227" },
  );
  const expected = {
    actPath: "/akn/ke/act/2010/constitution",
    provision: "227",
  };
  expect(hasRetrievedProvision([source], expected)).toBe(true);
  expect(
    hasRetrievedProvision(
      [{ ...source, uri: `${source.uri}/eng@2010-09-03` }],
      expected,
    ),
  ).toBe(true);
  expect(
    hasRetrievedProvision([{ ...source, provision: "22" }], expected),
  ).toBe(false);
  expect(
    hasRetrievedProvision(
      [{ ...source, uri: "/akn/ke/act/2010/constitutionality" }],
      expected,
    ),
  ).toBe(false);
});

test("Direct runtime enforces tool budget even when a scripted test model loops", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const testModel: Model = {
    provider: "test-double",
    name: "scripted-budget-test-not-an-LLM",
    async turn(tools) {
      if (!tools.length)
        return {
          calls: [],
          text: "Scripted test plan",
          input_tokens: 0,
          output_tokens: 0,
        };
      return {
        calls: Array.from({ length: 41 }, (_, index) => ({
          id: `${index}`,
          name: "loop",
          args: {},
        })),
        text: "",
        input_tokens: 0,
        output_tokens: 0,
      };
    },
    accept() {},
  };
  let calls = 0;
  await expect(
    runAgent({
      root,
      model: testModel,
      tools: [{ name: "loop", inputSchema: { type: "object" } }],
      signal: new AbortController().signal,
      execute: async () => {
        calls++;
        return {};
      },
    }),
  ).rejects.toThrow("budget");
  expect(calls).toBe(40);
});

test("Direct runtime gives recoverable tool errors back to the same test model", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const received: unknown[] = [];
  let turns = 0;
  const testModel: Model = {
    provider: "test-double",
    name: "scripted-error-test-not-an-LLM",
    async turn() {
      return {
        calls:
          turns++ === 1
            ? [{ id: "1", name: "failed_retrieval", args: {} }]
            : [],
        text: "Cannot verify law",
        input_tokens: 1,
        output_tokens: 1,
      };
    },
    accept(_call, result) {
      received.push(result);
    },
  };
  const result = await runAgent({
    root,
    model: testModel,
    tools: [{ name: "failed_retrieval", inputSchema: { type: "object" } }],
    signal: new AbortController().signal,
    execute: async () => {
      throw new Error("Unreachable legal source");
    },
  });
  expect(received).toEqual([
    {
      error:
        "Tool failed. Check schema, selected source passages and run limits; do not invent a result.",
    },
  ]);
  expect(result.turns).toBe(3);
});

test("OpenAI and Gemini credentials are checked without sending a request", () => {
  const previous = {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    expect(() =>
      createModel(
        { provider: "openai", model: "gpt-5.4-mini" },
        "test",
        "test",
      ),
    ).toThrow("OPENAI_API_KEY");
    expect(() =>
      createModel(
        { provider: "gemini", model: "gemini-2.5-flash" },
        "test",
        "test",
      ),
    ).toThrow("GEMINI_API_KEY");
  } finally {
    if (previous.openai) process.env.OPENAI_API_KEY = previous.openai;
    if (previous.gemini) process.env.GEMINI_API_KEY = previous.gemini;
  }
});
