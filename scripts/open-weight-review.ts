import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { review } from "../src/review.ts";
import { createWorkspace } from "../src/workspace.ts";

const { values } = parseArgs({
  options: {
    "send-to-provider": { type: "boolean", default: false },
    scenario: { type: "string", default: "fixtures/scenario.json" },
  },
});
if (!values["send-to-provider"])
  throw new Error(
    "Hosted open-weight evaluation requires --send-to-provider; text leaves this computer.",
  );
if (!process.env.GROQ_API_KEY?.trim())
  throw new Error("Configure GROQ_API_KEY locally; never paste it into chat.");
const root = await createWorkspace(
  resolve(values.scenario ?? "fixtures/scenario.json"),
  resolve(".runs"),
);
console.log(
  `Open-weight evaluation: openai/gpt-oss-120b, hosted by Groq. Run workspace: ${root}`,
);
try {
  const result = await review(
    root,
    { provider: "groq", model: "openai/gpt-oss-120b" },
    {
      elapsedMs: 900000,
      onEvent: (entry) => console.log(JSON.stringify(entry)),
    },
  );
  console.log(
    `Actual draft: ${result.id}/output/${result.report}; human review required.`,
  );
} catch {
  console.error(
    "Open-weight evaluation did not complete; inspect the retained actual trace. No automatic retry.",
  );
  process.exitCode = 1;
}
