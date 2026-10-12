import { existsSync } from "node:fs";
import { appendFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";
import {
  digest,
  type LegalSource,
  loadState,
  normalizeText,
  numbered,
  saveState,
} from "./workspace.ts";

export type ToolResult = Awaited<ReturnType<Client["callTool"]>>;
export type ToolDefinition = Awaited<
  ReturnType<Client["listTools"]>
>["tools"][number];
export type Connection = {
  client: Client;
  tools: ToolDefinition[];
  pid: number | null;
  close: () => Promise<void>;
};

export async function connectStdio(
  name: string,
  options: { entry: string; args?: string[]; env?: Record<string, string> },
) {
  const client = new Client(
    { name: "procurement-review-agent", version: "0.1.0" },
    {
      // Negotiation uses the SDK, including compatibility with the third-party v1 server.
      versionNegotiation: { mode: "auto" },
    },
  );
  const transport = new StdioClientTransport({
    // Always use Node. Under `bun test`, process.execPath is Bun, which auto-loads .env in children.
    command: "node",
    args: [
      "--experimental-strip-types",
      resolve(options.entry),
      ...(options.args ?? []),
    ],
    env: { ...getDefaultEnvironment(), ...options.env },
    stderr: "pipe",
    maxBufferSize: 2 * 1024 * 1024,
  });
  // Children never inherit provider keys. Do not forward upstream stderr containing source bodies.
  transport.stderr?.on("data", () => {});
  try {
    await client.connect(transport, { timeout: 20000 });
    const { tools } = await client.listTools({}, { timeout: 20000 });
    if (!tools.length) throw new Error(`${name} returned no tools`);
    return {
      client,
      tools,
      pid: transport.pid,
      close: () => client.close(),
    } satisfies Connection;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

export function toolText(result: ToolResult) {
  return result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export async function event(root: string, entry: Record<string, unknown>) {
  await appendFile(
    join(root, "trace.jsonl"),
    `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
  );
}

export async function call(
  root: string,
  server: string,
  connection: Connection,
  name: string,
  args: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
) {
  if (!connection.tools.some((tool) => tool.name === name))
    throw new Error("Tool was not discovered on this server");
  const callId = crypto.randomUUID();
  const started = performance.now();
  await event(root, {
    type: "tool_start",
    call_id: callId,
    server,
    tool: name,
    inputs: args,
  });
  try {
    const result = await connection.client.callTool(
      { name, arguments: args },
      { timeout: 60000, signal: options.signal },
    );
    if (JSON.stringify(result).length > 500000)
      throw new Error("MCP result exceeds the review limit");
    await event(root, {
      type: "tool_end",
      call_id: callId,
      server,
      tool: name,
      duration_ms: Math.round(performance.now() - started),
      status: result.isError ? "error" : "ok",
      outputs: result,
    });
    return result;
  } catch {
    await event(root, {
      type: "tool_end",
      call_id: callId,
      server,
      tool: name,
      duration_ms: Math.round(performance.now() - started),
      status: "transport_error",
    });
    // Avoid provider credentials or local diagnostics in errors delivered to the model.
    throw new Error(`MCP call failed: ${server}/${name}`);
  }
}

export function kenyaLawEntry() {
  const entry =
    process.env.KENYALAW_MCP_ENTRY?.trim() ||
    resolve(".external/kenya-law-mcp/dist/src/index.js");
  if (!existsSync(entry))
    throw new Error(
      "Run bun run setup or set KENYALAW_MCP_ENTRY to the public server's built dist/src/index.js",
    );
  return entry;
}

export function filesystemEntry() {
  return join(
    dirname(import.meta.dirname),
    "node_modules",
    "@modelcontextprotocol",
    "server-filesystem",
    "dist",
    "index.js",
  );
}

export function officialLegalUrl(uri: string) {
  if (
    !/^\/akn\/ke\//.test(uri) &&
    !/^https:\/\/(?:new\.)?kenyalaw\.org\/akn\/ke\//.test(uri)
  )
    throw new Error("Expected an official Kenya Law AKN identifier");
  const sourceUrl = new URL(uri, "https://new.kenyalaw.org");
  if (
    sourceUrl.protocol !== "https:" ||
    !["kenyalaw.org", "new.kenyalaw.org"].includes(sourceUrl.hostname) ||
    sourceUrl.port ||
    sourceUrl.username ||
    sourceUrl.password ||
    sourceUrl.search ||
    sourceUrl.hash ||
    !sourceUrl.pathname.startsWith("/akn/ke/")
  )
    throw new Error("Invalid official legal source URL");
  return sourceUrl.href;
}

export function hasRetrievedProvision(
  sources: LegalSource[],
  expected: { actPath: string; provision?: string },
) {
  return sources.some((source) => {
    const path = new URL(officialLegalUrl(source.uri)).pathname;
    // Both the work URI and an expression URI identify the same Act.
    return (
      (path === expected.actPath || path.startsWith(`${expected.actPath}/`)) &&
      (expected.provision === undefined ||
        source.provision === expected.provision)
    );
  });
}

export async function registerLegalSource(
  root: string,
  uri: string,
  text: string,
  options: { provision?: string } = {},
) {
  officialLegalUrl(uri);
  const state = await loadState(root);
  const id = `law-${state.legal_sources.length + 1}`;
  const file = `${id}.txt`;
  const normalized = normalizeText(text);
  if (normalized.length < 150 || normalized.length > 300000)
    throw new Error("Legal source is too short or too large");
  const existing = state.legal_sources.find(
    (source) =>
      source.uri === uri &&
      source.sha256 === digest(normalized) &&
      source.provision === options.provision,
  );
  if (existing) return { ...existing, text: numbered(normalized) };
  await writeFile(join(root, "sources", file), normalized, { flag: "wx" });
  const source = {
    id,
    uri,
    file,
    sha256: digest(normalized),
    retrieved_at: new Date().toISOString(),
    ...(options.provision ? { provision: options.provision } : {}),
  };
  state.legal_sources.push(source);
  await saveState(root, state);
  return { ...source, text: numbered(normalized) };
}

export async function readSelectedDocument(
  root: string,
  connection: Connection,
  documentId: string,
  options: { signal?: AbortSignal } = {},
) {
  const state = await loadState(root);
  const document = state.documents.find((item) => item.id === documentId);
  if (!document) throw new Error("Unknown selected document ID");
  const result = await call(
    root,
    "filesystem",
    connection,
    "read_text_file",
    {
      path: join(root, "inputs", document.file),
    },
    options,
  );
  if (result.isError)
    throw new Error("Filesystem MCP could not read the document");
  const text = toolText(result);
  if (digest(text) !== document.sha256)
    throw new Error("Document changed after registration");
  return {
    document_id: document.id,
    role: document.role,
    supplier_id: document.supplier_id,
    kind: document.kind,
    text: numbered(text),
    limitations: document.limitations,
  };
}
