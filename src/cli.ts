import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { recordHumanDecision } from "./human-review.ts";
import { kenyaLawEntry } from "./mcp.ts";
import { probeLocalModel } from "./model-probe.ts";
import { modelChoice } from "./models.ts";
import { review } from "./review.ts";
import { containedFile, createWorkspace, loadState } from "./workspace.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scenario: { type: "string", default: "fixtures/scenario.json" },
    run: { type: "string" },
    reviewer: { type: "string" },
    note: { type: "string" },
    "send-to-provider": { type: "boolean", default: false },
  },
});

try {
  const command = positionals[0] ?? "sample";
  if (command === "doctor") {
    console.log(
      JSON.stringify(
        {
          node: process.version,
          provider: modelChoice(),
          openai_key_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
          gemini_key_configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
          groq_key_configured: Boolean(process.env.GROQ_API_KEY?.trim()),
          kenya_law_entry_available: (() => {
            try {
              return Boolean(kenyaLawEntry());
            } catch {
              return false;
            }
          })(),
        },
        null,
        2,
      ),
    );
  } else if (command === "sample") {
    if (!values["send-to-provider"])
      throw new Error(
        "Pass --send-to-provider to permit sending the selected synthetic documents to the selected inference provider",
      );
    const choice = modelChoice();
    if (choice.provider === "local") await probeLocalModel(choice);
    if (
      choice.provider !== "local" &&
      !(choice.provider === "groq"
        ? process.env.GROQ_API_KEY?.trim()
        : choice.provider === "openai"
          ? process.env.OPENAI_API_KEY?.trim()
          : process.env.GEMINI_API_KEY?.trim())
    )
      throw new Error(
        `Configure the selected provider key in the ignored .env file`,
      );
    const root = await createWorkspace(
      resolve(values.scenario),
      resolve(".runs"),
    );
    console.log(`Run workspace: ${root}`);
    console.log(
      `Sending selected synthetic document text to ${choice.provider}/${choice.model}. Raw inputs and trace stay local.`,
    );
    const final = await review(root, choice, {
      onEvent: (entry) => console.log(JSON.stringify(entry)),
    });
    console.log(`DRAFT ready: ${root}/output/${final.report}`);
    console.log(
      `Usage: ${final.usage.input_tokens} input; ${final.usage.output_tokens} output tokens.`,
    );
    if (choice.model === "gpt-5.4-mini")
      console.log(
        `Estimated text cost: $${((final.usage.input_tokens * 0.75 + final.usage.output_tokens * 4.5) / 1000000).toFixed(4)} (undiscounted published rates; not an invoice).`,
      );
  } else if (
    ["status", "report", "approve", "reject", "request_revision"].includes(
      command,
    )
  ) {
    if (!values.run || !/^[a-f0-9-]{36}$/.test(values.run))
      throw new Error("Pass --run with the generated run UUID");
    const root = dirname(
      await containedFile(resolve(".runs"), `${values.run}/state.json`),
    );
    if (command === "status")
      console.log(JSON.stringify(await loadState(root), null, 2));
    else if (command === "report")
      console.log(
        await readFile(await containedFile(root, "output/draft.md"), "utf8"),
      );
    else
      console.log(
        JSON.stringify(
          await recordHumanDecision(root, {
            action: command as "approve" | "reject" | "request_revision",
            reviewer: values.reviewer ?? "",
            note: values.note ?? "",
          }),
          null,
          2,
        ),
      );
  } else
    throw new Error(
      "Use sample, doctor, status, report, approve, reject or request_revision",
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Command failed");
  process.exitCode = 1;
}
