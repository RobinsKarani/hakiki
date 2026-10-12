import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { recordHumanDecision } from "../src/human-review.ts";
import { createModel, type Model } from "../src/models.ts";
import { runAgent } from "../src/runtime.ts";
import {
  createWorkspace,
  digest,
  loadState,
  saveState,
} from "../src/workspace.ts";

test("cancellation prevents model requests and tool execution", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const abort = new AbortController();
  abort.abort();
  let turns = 0;
  const model: Model = {
    provider: "fixture",
    name: "not-an-LLM",
    turn: async () => {
      turns++;
      throw new Error("Must not execute");
    },
    accept() {},
  };
  await expect(
    runAgent({
      root,
      model,
      tools: [],
      signal: abort.signal,
      execute: async () => {
        throw new Error("Must not execute");
      },
    }),
  ).rejects.toThrow();
  expect(turns).toBe(0);
});

test("injected approval and shell requests cannot reach an executor", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  let turn = 0;
  let dispatched = 0;
  const results: unknown[] = [];
  const model: Model = {
    provider: "adversarial-fixture",
    name: "scripted-not-an-LLM",
    turn: async () => ({
      text: "Fixture plan",
      input_tokens: 0,
      output_tokens: 0,
      calls:
        turn++ === 1
          ? [
              {
                id: "bad-approval",
                name: "approve",
                args: { reviewer: "Injected" },
              },
              {
                id: "bad-shell",
                name: "shell",
                args: { command: "read secrets" },
              },
            ]
          : [],
    }),
    accept(_call, result) {
      results.push(result);
    },
  };
  await runAgent({
    root,
    model,
    tools: [],
    signal: new AbortController().signal,
    execute: async () => {
      dispatched++;
      return {};
    },
  });
  expect(dispatched).toBe(0);
  expect(results).toEqual([
    { error: "Tool is not permitted. Use only discovered, exposed tools." },
    { error: "Tool is not permitted. Use only discovered, exposed tools." },
  ]);
  expect((await loadState(root)).status).toBe("collecting");
});

test("official OpenAI adapter stops on a fixture 503 without retrying", async () => {
  const originalFetch = globalThis.fetch;
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  let requests = 0;
  globalThis.fetch = Object.assign(
    async () => {
      requests++;
      return new Response(
        JSON.stringify({
          error: {
            message: "Synthetic unavailable provider",
            type: "server_error",
          },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    },
    { preconnect: originalFetch.preconnect },
  );
  try {
    const model = createModel(
      { provider: "openai", model: "gpt-5.6-terra" },
      "Fixture",
      "Fixture",
    );
    await expect(model.turn([], new AbortController().signal)).rejects.toThrow(
      "no automatic retry",
    );
    expect(requests).toBe(1);
  } finally {
    globalThis.fetch = originalFetch;
    if (key) process.env.OPENAI_API_KEY = key;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("a changed draft cannot receive approval", async () => {
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    resolve(".runs/tests"),
  );
  const state = await loadState(root);
  state.report = "draft.md";
  state.status = "draft";
  state.execution = "completed";
  state.report_sha256 = digest("Fixture original");
  await saveState(root, state);
  await writeFile(resolve(root, "output/draft.md"), "Changed fixture report");
  await expect(
    recordHumanDecision(root, {
      action: "approve",
      reviewer: "Fictional Test Reviewer",
      note: "Changed report",
    }),
  ).rejects.toThrow("changed");
  expect((await loadState(root)).status).toBe("draft");
  await expect(
    readFile(resolve(root, "review-decision.json")),
  ).rejects.toThrow();
});
