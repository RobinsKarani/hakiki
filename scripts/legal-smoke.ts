import { resolve } from "node:path";
import {
  call,
  connectStdio,
  kenyaLawEntry,
  registerLegalSource,
  toolText,
} from "../src/mcp.ts";
import { createWorkspace } from "../src/workspace.ts";

const root = await createWorkspace(
  resolve("fixtures/scenario.json"),
  resolve(".runs"),
);
const connection = await connectStdio("kenyalaw", { entry: kenyaLawEntry() });
try {
  console.log(
    `Connected: ${connection.client.getServerVersion()?.name}; protocol ${connection.client.getNegotiatedProtocolVersion()}; ${connection.tools.length} tools`,
  );
  const search = await call(
    root,
    "kenyalaw",
    connection,
    "search_legislation",
    { act_name: "Public Procurement and Asset Disposal Act", limit: 5 },
  );
  if (search.isError)
    throw new Error("Procurement Act search failed; inspect the local trace");
  const records = JSON.parse(toolText(search)).results;
  const act = records.find((item: { short_title?: string; akn_url?: string }) =>
    /Public Procurement and Asset Disposal Act/i.test(item.short_title ?? ""),
  );
  if (!act?.akn_url) throw new Error("No procurement Act identifier returned");
  for (const args of [
    { akn_url: act.akn_url, section: "79" },
    { akn_url: act.akn_url, section: "80" },
    { akn_url: "/akn/ke/act/2010/constitution/eng@2010-09-03", article: "227" },
  ]) {
    const result = await call(
      root,
      "kenyalaw",
      connection,
      "get_akn_document",
      args,
    );
    if (result.isError)
      throw new Error(
        `Provision ${args.section ?? args.article} could not be retrieved`,
      );
    const text = toolText(result);
    if (!/procurement|tender|evaluation/i.test(text))
      throw new Error(
        "Returned text does not appear to be the requested provision",
      );
    const source = await registerLegalSource(root, args.akn_url, text);
    console.log(
      `PASS ${source.id}: provision ${args.section ?? args.article}, ${text.length} characters`,
    );
  }
  console.log(`Actual MCP trace and source files: ${root}`);
} finally {
  await connection.close();
}
