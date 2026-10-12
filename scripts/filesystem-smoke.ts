import { join, resolve } from "node:path";
import {
  call,
  connectStdio,
  filesystemEntry,
  readSelectedDocument,
} from "../src/mcp.ts";
import { createWorkspace } from "../src/workspace.ts";

const root = await createWorkspace(
  resolve("fixtures/scenario.json"),
  resolve(".runs"),
);
const connection = await connectStdio("filesystem", {
  entry: filesystemEntry(),
  args: [join(root, "inputs")],
});
try {
  const tender = await readSelectedDocument(root, connection, "tender");
  if (!tender.text.includes("R1:"))
    throw new Error("Selected tender read failed");
  console.log(
    `PASS: third-party Filesystem MCP read selected tender (${tender.text.length} characters)`,
  );
  const outside = await call(root, "filesystem", connection, "read_text_file", {
    path: resolve(".env.example"),
  });
  if (!outside.isError)
    throw new Error("Outside-path read was incorrectly allowed");
  console.log(
    "PASS: third-party server denied a file outside the run input directory",
  );
  console.log(`Trace: ${root}`);
} finally {
  await connection.close();
}
