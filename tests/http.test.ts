import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createLocalServer } from "../src/http.ts";
import {
  createWorkspace,
  digest,
  loadState,
  saveState,
} from "../src/workspace.ts";

test("local API rejects cross-origin mutation, consent bypass, arbitrary sources and unsigned approval", async () => {
  const runsRoot = resolve(`.runs/http-tests-${crypto.randomUUID()}`);
  await mkdir(runsRoot);
  const root = await createWorkspace(
    resolve("fixtures/scenario.json"),
    runsRoot,
  );
  const state = await loadState(root);
  await mkdir(join(runsRoot, crypto.randomUUID()));
  const app = createLocalServer({
    runsRoot,
    webRoot: resolve("web/dist"),
    scenarioPath: resolve("fixtures/scenario.json"),
  });
  await new Promise<void>((done) => app.server.listen(0, "127.0.0.1", done));
  const address = app.server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing local port");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const config = await fetch(`${origin}/api/config`).then((response) =>
      response.json(),
    );
    expect(Object.keys(config).sort()).toEqual([
      "choice",
      "gemini_configured",
      "groq_configured",
      "local_base_url",
      "openai_configured",
      "token",
    ]);
    expect(
      await fetch(`${origin}/api/runs`).then((response) => response.json()),
    ).toEqual([
      {
        id: state.id,
        title: state.title,
        status: "collecting",
        execution: "ready",
        model: null,
      },
    ]);
    expect(
      (
        await fetch(`${origin}/api/config`, {
          headers: { Origin: "https://untrusted.example" },
        })
      ).status,
    ).toBe(403);
    const post = (
      route: string,
      data: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(`${origin}/api${route}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          "X-Review-Token": config.token,
          ...headers,
        },
        body: JSON.stringify(data),
      });
    expect(
      (await post("/runs", {}, { "X-Review-Token": "wrong" })).status,
    ).toBe(403);
    expect(
      (
        await post("/runs", {
          provider: "openai",
          model: "gpt-5.6-terra",
          consent: false,
          document_ids: ["tender", "alpha-offer"],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(`/runs/${state.id}/decision`, {
          action: "approve",
          reviewer: "Fixture Human",
          note: "No draft exists",
        })
      ).status,
    ).toBe(400);
    expect(
      (await fetch(`${origin}/api/runs/${state.id}/source?id=../../.env`))
        .status,
    ).toBe(404);
    const source = await fetch(
      `${origin}/api/runs/${state.id}/source?id=tender`,
    ).then((response) => response.json());
    expect(source.text).toBe(
      await readFile(join(root, "inputs/tender.txt"), "utf8"),
    );
    // Only the approval boundary is under test; this report is explicitly a fixture.
    const draft = "DRAFT: HTTP review-state fixture, no LLM or live law.";
    await writeFile(join(root, "output/draft.md"), draft);
    state.status = "draft";
    state.execution = "completed";
    state.report = "draft.md";
    state.report_sha256 = digest(draft);
    await saveState(root, state);
    expect(
      (
        await post(`/runs/${state.id}/decision`, {
          action: "approve",
          reviewer: "",
          note: "Test",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post(`/runs/${state.id}/decision`, {
          action: "approve",
          reviewer: "Fictional Test Reviewer",
          note: "Approve fixture draft only",
        })
      ).status,
    ).toBe(200);
    expect((await loadState(root)).status).toBe("approved");
    expect(
      (
        await post(`/runs/${state.id}/decision`, {
          action: "reject",
          reviewer: "Fictional Test Reviewer",
          note: "Second decision",
        })
      ).status,
    ).toBe(400);
  } finally {
    app.cancelAll();
    await new Promise<void>((done) => app.server.close(() => done()));
  }
});
