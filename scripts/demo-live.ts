import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { createLocalServer, defaultServerOptions } from "../src/http.ts";

const { values } = parseArgs({
  options: { "send-to-provider": { type: "boolean", default: false } },
});
if (!values["send-to-provider"] || !process.env.GEMINI_API_KEY?.trim())
  throw new Error(
    "This genuine recorded run needs a local GEMINI_API_KEY and explicit --send-to-provider.",
  );
const folder = resolve(`.runs/demo-${crypto.randomUUID()}`);
await mkdir(folder, { recursive: true });
const app = createLocalServer(defaultServerOptions);
await new Promise<void>((done) => app.server.listen(0, "127.0.0.1", done));
const address = app.server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: folder, size: { width: 1440, height: 1000 } },
});
const started = performance.now();
let id = "";
let outcome = "incomplete";
try {
  const page = await context.newPage();
  await page.goto(origin);
  await page.getByLabel("Provider", { exact: true }).selectOption("gemini");
  await page
    .getByLabel("Model", { exact: true })
    .selectOption("gemini-3.5-flash-lite");
  await page.getByRole("checkbox").last().check();
  const accepted = page.waitForResponse(
    (response) =>
      response.url() === `${origin}/api/runs` &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start genuine review" }).click();
  const response = await accepted;
  assert.equal(response.status(), 202);
  id = (await response.json()).id;
  console.log(
    `Live recorded run: ${id}; Gemini 3.5 Flash Lite. No replay, editing or human approval.`,
  );
  await page
    .getByRole("heading", { name: "3. Planning and execution", exact: true })
    .scrollIntoViewIfNeeded();
  while (performance.now() - started < 260000) {
    const current = await fetch(`${origin}/api/runs/${id}`).then((result) =>
      result.json(),
    );
    // Scroll actual events as they arrive. No progress, output or recovery is synthesized.
    await page.locator(".timeline").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    if (!current.active) {
      outcome = current.state.execution;
      break;
    }
    await page.waitForTimeout(2000);
  }
  if (outcome === "completed") {
    await page
      .getByRole("heading", { name: "4. Findings and sources", exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await page
      .getByRole("button", { name: /^Tender lines/ })
      .first()
      .click();
    await page
      .getByText("Source: tender", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    await page
      .getByRole("heading", { name: "Retrieved KenyaLaw sources", exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    await page
      .getByText("Read the complete generated draft", { exact: true })
      .click();
    await page
      .getByRole("heading", { name: "5. Draft and human review", exact: true })
      .scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    assert.equal(
      await page
        .getByRole("button", { name: "Approve this draft", exact: true })
        .isDisabled(),
      true,
    );
  }
  await page.screenshot({ path: join(folder, "final.png"), fullPage: true });
} finally {
  app.cancelAll();
  await context.close();
  await browser.close();
  await new Promise<void>((done) => app.server.close(() => done()));
  const elapsed = Math.round(performance.now() - started);
  await writeFile(
    join(folder, "recording.json"),
    JSON.stringify(
      {
        run_id: id,
        model: "gemini-3.5-flash-lite",
        execution: outcome,
        recorded_elapsed_ms: elapsed,
        under_three_minutes: elapsed < 180000,
        edited: false,
        audio: false,
        human_approved: false,
      },
      null,
      2,
    ),
  );
  console.log(
    `Recording retained locally: ${folder}; ${outcome}; ${elapsed}ms. Nothing uploaded.`,
  );
}
if (outcome !== "completed") process.exitCode = 1;
