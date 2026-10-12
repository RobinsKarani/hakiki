import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { modelChoice } from "../src/models.ts";
import { review } from "../src/review.ts";
import { createWorkspace, digest } from "../src/workspace.ts";
import { evaluateRun, evaluationCases } from "./evaluate-run.ts";

const { values } = parseArgs({
  options: { "send-to-provider": { type: "boolean", default: false } },
});
if (!values["send-to-provider"])
  throw new Error(
    "This paid suite sends synthetic text externally. Explicitly pass --send-to-provider.",
  );
const choice = modelChoice();
if (choice.provider === "local")
  throw new Error(
    "Use the CLI for local tasks; this explicitly paid suite covers hosted providers.",
  );
const folder = resolve(`.runs/evaluation-suite-${crypto.randomUUID()}`);
await mkdir(folder);
const files = (await readdir("src"))
  .filter((name) => name.endsWith(".ts"))
  .sort();
const runtimeFingerprint = async () =>
  digest(
    JSON.stringify(
      await Promise.all(
        [...files.map((name) => `src/${name}`), "bun.lock", "package.json"].map(
          async (name) => [name, digest(await readFile(name, "utf8"))],
        ),
      ),
    ),
  );
const fingerprint = await runtimeFingerprint();
const summary = {
  created_at: new Date().toISOString(),
  git_head: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  runtime_sha256: fingerprint,
  provider: choice.provider,
  model: choice.model,
  results: [] as Awaited<ReturnType<typeof evaluateRun>>[],
  stopped_reason: null as string | null,
};
console.log(
  `Explicit hosted evaluation suite: ${choice.provider}/${choice.model}; ${folder}`,
);
for (const item of evaluationCases) {
  if ((await runtimeFingerprint()) !== fingerprint)
    throw new Error(
      "Runtime changed during evaluation; stop and preserve prior results.",
    );
  const root = await createWorkspace(resolve(item.scenario), resolve(".runs"));
  console.log(`START ${item.id}: ${root}`);
  try {
    await review(root, choice, {
      onEvent: (entry) => console.log(JSON.stringify(entry)),
    });
  } catch {
    /* Score the real failure without retry or fallback. */
  }
  const result = await evaluateRun(root.split(/[\\/]/).at(-1) ?? "", item.id);
  if ((await runtimeFingerprint()) !== fingerprint)
    throw new Error(
      "Runtime changed during a task; its trace is retained but not credited to this revision.",
    );
  summary.results.push(result);
  if (result.provider_failure)
    summary.stopped_reason =
      "Provider rejected a request; no further paid tasks or automatic retry.";
  await writeFile(
    join(folder, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  console.log(`RESULT ${item.id}: ${result.pass ? "PASS" : "FAIL"}`);
  if (summary.stopped_reason) break;
}
console.log(`Actual results retained: ${folder}/summary.json`);
if (
  summary.results.length !== evaluationCases.length ||
  summary.results.some((item) => !item.pass)
)
  process.exitCode = 1;
