import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { createLocalServer, defaultServerOptions } from "../src/http.ts";

// Read-only UI check. An optional existing run must contain genuine stored execution.
const { values } = parseArgs({ options: { run: { type: "string" } } });
const app = createLocalServer(defaultServerOptions);
await new Promise<void>((done) => app.server.listen(0, "127.0.0.1", done));
const address = app.server.address();
assert(address && typeof address !== "string");
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.getByLabel("Inspect a previous actual run").waitFor();
  await page
    .getByText("Fictional Amani County ICT equipment document review", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 8);
  await page
    .getByLabel("Review package", { exact: true })
    .selectOption("archived");
  await page
    .getByText("KE-ICTA-395947-GO-RFB", { exact: false })
    .first()
    .waitFor();
  assert.equal(await page.getByRole("checkbox").count(), 5);
  await page
    .getByLabel("Review package", { exact: true })
    .selectOption("synthetic");
  await page
    .getByText("Fictional Amani County ICT equipment document review", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Start genuine review" })
      .isDisabled(),
    true,
  );
  await page.getByLabel("Provider", { exact: true }).selectOption("gemini");
  assert.equal(
    await page.getByLabel("Model", { exact: true }).inputValue(),
    "gemini-3.5-flash-lite",
  );
  if (values.run) {
    await page
      .getByLabel("Inspect a previous actual run")
      .selectOption(values.run);
    await page.getByText("Agent's recorded plan", { exact: true }).waitFor();
    await page.getByText("Download Markdown draft", { exact: true }).waitFor();
    assert.equal(await page.locator(".findings article").count(), 8);
    await page
      .getByRole("button", { name: /^Tender lines/ })
      .first()
      .click();
    await page.getByText("Source: tender", { exact: true }).waitFor();
    await page
      .getByText("Read the complete generated draft", { exact: true })
      .click();
    assert.equal(
      await page
        .getByRole("button", { name: "Approve this draft", exact: true })
        .isDisabled(),
      true,
    );
  }
  await mkdir(resolve(".runs"), { recursive: true });
  await page.screenshot({
    path: resolve(".runs/browser-smoke.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: local browser controls, consent default, model selection and JavaScript errors; no inference requested.",
  );
  if (values.run)
    console.log(
      "PASS: genuine stored plan, eight findings, source viewer, draft and disabled unnamed approval.",
    );
} finally {
  await browser.close();
  app.cancelAll();
  await new Promise<void>((done) => app.server.close(() => done()));
}
