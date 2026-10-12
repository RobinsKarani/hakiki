import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

// A public upstream revision, not an internal module or a floating branch.
const upstream = "70ab4d8f28b4a0002b5bd8680c8eb2019006aae2";
const root = resolve(".external/kenya-law-mcp");
const run = async (command: string, args: string[], cwd: string) => {
  const result = await promisify(execFile)(command, args, {
    cwd,
    timeout: 300000,
    maxBuffer: 2000000,
    windowsHide: true,
    env: getDefaultEnvironment(),
  });
  // Do not forward subprocess diagnostics, paths or inherited local configuration.
  console.log(`${command} ${args[0]} completed`);
  return result.stdout.trim();
};
try {
  await run(
    "bun",
    ["install", "--frozen-lockfile", "--ignore-scripts"],
    resolve("."),
  );
  await mkdir(resolve(".external"), { recursive: true });
  if (!existsSync(root)) {
    await run(
      "git",
      ["clone", "https://github.com/Verantu-Labs/kenya-law-mcp.git", root],
      resolve("."),
    );
    await run("git", ["checkout", "--detach", upstream], root);
  }
  if (
    (await run("git", ["rev-parse", "HEAD"], root)) !== upstream ||
    (await run("git", ["status", "--porcelain"], root))
  )
    throw new Error(
      "Existing public checkout differs from the pinned revision; inspect it manually. Setup will not overwrite it.",
    );
  await run("bun", ["install", "--frozen-lockfile", "--ignore-scripts"], root);
  await run("bun", ["run", "build"], root);
  await run("bun", ["run", "build"], resolve("."));
  console.log(
    "Setup complete. Run bun run start, configure an ignored .env and choose a provider in the browser. No model calls were made.",
  );
} catch {
  console.error(
    "Setup failed. Check Node/Bun/Git, registry access and the existing .external checkout. No paid call or deployment was attempted.",
  );
  process.exitCode = 1;
}
