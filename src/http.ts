import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage } from "node:http";
import { dirname, extname, join, resolve } from "node:path";
import { z } from "zod";
import { recordHumanDecision } from "./human-review.ts";
import { kenyaLawEntry } from "./mcp.ts";
import { probeLocalModel } from "./model-probe.ts";
import { modelChoice } from "./models.ts";
import { review } from "./review.ts";
import {
  containedFile,
  createWorkspace,
  loadState,
  scenarioSchema,
} from "./workspace.ts";

const runId = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16000) throw new Error("Request is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createLocalServer(options: {
  runsRoot: string;
  webRoot: string;
  scenarioPath: string;
  archivedScenarioPath?: string;
}) {
  let starting = false;
  const token = randomBytes(32).toString("hex");
  const active = new Map<string, AbortController>();
  const failures = new Map<string, string>();
  const scenarioPathFor = (id: string) => {
    if (id === "synthetic") return options.scenarioPath;
    if (id === "archived" && options.archivedScenarioPath)
      return options.archivedScenarioPath;
    throw new Error("Unknown review package");
  };
  const rootFor = async (id: string) => {
    if (!runId.test(id)) throw new Error("Invalid run ID");
    return dirname(await containedFile(options.runsRoot, `${id}/state.json`));
  };
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    response.setHeader("Cache-Control", "no-store");
    const hostHeader = request.headers.host ?? "";
    const isCloud = Boolean(process.env.PORT || process.env.ALLOWED_HOST);
    const localHost = `127.0.0.1:${request.socket.localPort}`;
    const allowedHost = process.env.ALLOWED_HOST;

    const hostValid = isCloud
      ? allowedHost
        ? hostHeader === allowedHost
        : Boolean(hostHeader)
      : hostHeader === localHost;

    const proto =
      (request.headers["x-forwarded-proto"] as string) ||
      (isCloud ? "https" : "http");
    const expectedOrigin = isCloud
      ? `${proto}://${hostHeader}`
      : `http://${localHost}`;
    const originValid =
      !request.headers.origin || request.headers.origin === expectedOrigin;

    if (!hostValid || !originValid) {
      response.writeHead(403).end("Local origin required");
      return;
    }
    if (
      request.method !== "GET" &&
      (request.headers["x-review-token"] !== token ||
        (request.headers.origin && request.headers.origin !== expectedOrigin) ||
        request.headers["content-type"] !== "application/json")
    ) {
      response.writeHead(403).end("Local session and JSON request required");
      return;
    }
    const send = (value: unknown, status = 200) => {
      response
        .writeHead(status, { "Content-Type": "application/json" })
        .end(JSON.stringify(value));
    };
    try {
      const url = new URL(request.url ?? "/", expectedOrigin);
      if (request.method === "GET" && url.pathname === "/api/config") {
        send({
          token,
          choice: modelChoice(),
          openai_configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
          gemini_configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
          groq_configured: Boolean(process.env.GROQ_API_KEY?.trim()),
          local_base_url: modelChoice({ provider: "local", model: "qwen3:8b" })
            .baseUrl,
        });
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/scenario") {
        const scenario = scenarioSchema.parse(
          JSON.parse(
            await readFile(
              scenarioPathFor(url.searchParams.get("package") ?? "synthetic"),
              "utf8",
            ),
          ),
        );
        send({
          ...scenario,
          documents: await Promise.all(
            scenario.documents.map(async (document) => ({
              ...document,
              text: await readFile(
                await containedFile(
                  dirname(
                    scenarioPathFor(
                      url.searchParams.get("package") ?? "synthetic",
                    ),
                  ),
                  document.file,
                ),
                "utf8",
              ),
            })),
          ),
        });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/model-probe") {
        const input = z
          .object({
            provider: z.literal("local"),
            model: z.string().max(120),
            baseUrl: z.string().max(200),
          })
          .strict()
          .parse(await body(request));
        send(await probeLocalModel(modelChoice(input)));
        return;
      }
      if (request.method === "GET" && url.pathname === "/api/runs") {
        const ids = await readdir(options.runsRoot).catch(() => [] as string[]);
        const runs = await Promise.all(
          ids
            .filter((id) => runId.test(id))
            .map(async (id) => {
              const state = await rootFor(id)
                .then(loadState)
                .catch(() => null);
              if (!state) return null;
              return {
                id,
                title: state.title,
                status: state.status,
                execution: state.execution ?? "legacy",
                model: state.model,
              };
            }),
        );
        send(runs.filter((run) => run !== null).reverse());
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/runs") {
        if (active.size || starting) {
          send({ error: "A review is already running" }, 409);
          return;
        }
        starting = true;
        try {
          const input = z
            .object({
              provider: z.enum(["openai", "gemini", "groq", "local"]),
              model: z.string().min(1).max(120),
              baseUrl: z.string().max(200).optional(),
              package: z.enum(["synthetic", "archived"]).default("synthetic"),
              consent: z.literal(true),
              document_ids: z.array(z.string()).min(2).max(12),
            })
            .strict()
            .parse(await body(request));
          const choice = modelChoice(input);
          if (choice.provider === "local") await probeLocalModel(choice);
          if (
            (choice.provider !== "local" &&
              !(choice.provider === "groq"
                ? process.env.GROQ_API_KEY?.trim()
                : choice.provider === "openai"
                  ? process.env.OPENAI_API_KEY?.trim()
                  : process.env.GEMINI_API_KEY?.trim())) ||
            !kenyaLawEntry()
          ) {
            send(
              {
                error:
                  "Configure the selected provider key locally and run bun run setup for KenyaLaw",
              },
              400,
            );
            return;
          }
          const root = await createWorkspace(
            scenarioPathFor(input.package),
            options.runsRoot,
            { documentIds: input.document_ids },
          );
          const id = (await loadState(root)).id;
          const controller = new AbortController();
          active.set(id, controller);
          // The stored trace drives the browser. Never fabricate activity or replay a canned result.
          void review(root, choice, { signal: controller.signal })
            .catch(() => {
              failures.set(
                id,
                "Review incomplete. Inspect the trace; start a fresh run to retry.",
              );
            })
            .finally(() => {
              active.delete(id);
            });
          send({ id }, 202);
          return;
        } finally {
          starting = false;
        }
      }
      const match =
        /^\/api\/runs\/([^/]+)(?:\/(report|source|cancel|decision))?$/.exec(
          url.pathname,
        );
      if (match?.[1]) {
        const id = match[1];
        const action = match[2];
        const root = await rootFor(id);
        if (request.method === "POST" && action === "cancel") {
          active.get(id)?.abort();
          send({ cancellation_requested: active.has(id) });
          return;
        }
        if (request.method === "POST" && action === "decision") {
          if (active.has(id)) {
            send(
              { error: "Wait for execution to finish before reviewing" },
              409,
            );
            return;
          }
          send(await recordHumanDecision(root, await body(request)));
          return;
        }
        if (request.method === "GET" && action === "report") {
          const state = await loadState(root);
          if (!state.report) {
            send({ error: "No draft exists" }, 404);
            return;
          }
          response
            .writeHead(200, {
              "Content-Type": "text/plain; charset=utf-8",
              ...(url.searchParams.has("download")
                ? {
                    "Content-Disposition":
                      'attachment; filename="procurement-draft.md"',
                  }
                : {}),
            })
            .end(
              await readFile(
                await containedFile(root, "output/draft.md"),
                "utf8",
              ),
            );
          return;
        }
        if (request.method === "GET" && action === "source") {
          const state = await loadState(root);
          const sourceId = url.searchParams.get("id");
          const document = state.documents.find((item) => item.id === sourceId);
          const law = state.legal_sources.find((item) => item.id === sourceId);
          if (!document && !law) {
            send({ error: "Unknown source" }, 404);
            return;
          }
          send({
            source: document ?? law,
            text: await readFile(
              await containedFile(
                root,
                join(
                  document ? "inputs" : "sources",
                  (document ?? law)?.file ?? "",
                ),
              ),
              "utf8",
            ),
          });
          return;
        }
        if (request.method === "GET" && !action) {
          const trace = await readFile(join(root, "trace.jsonl"), "utf8").catch(
            () => "",
          );
          // Ignore only an unfinished trailing append, never manufacture its result.
          const events = trace
            .split("\n")
            .filter((line, index, lines) => line && index < lines.length - 1)
            .map((line) => JSON.parse(line));
          const findings = await readFile(
            join(root, "output/findings.json"),
            "utf8",
          )
            .then(JSON.parse)
            .catch(() => null);
          const decision = await readFile(
            join(root, "review-decision.json"),
            "utf8",
          )
            .then(JSON.parse)
            .catch(() => null);
          send({
            state: await loadState(root),
            events,
            findings,
            decision,
            active: active.has(id),
            error: failures.get(id) ?? null,
          });
          return;
        }
      }
      if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
        send({ error: "Route not found" }, 404);
        return;
      }
      const path =
        url.pathname === "/"
          ? "index.html"
          : decodeURIComponent(url.pathname.slice(1));
      const file = await containedFile(options.webRoot, path);
      const type =
        (
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
          } as Record<string, string>
        )[extname(file)] ?? "application/octet-stream";
      response
        .writeHead(200, { "Content-Type": type })
        .end(await readFile(file));
    } catch {
      // Avoid local paths, file contents or credential-bearing upstream exceptions in responses.
      if (!response.headersSent)
        send(
          {
            error:
              "Request failed. Check selection, schema, run state and configured dependencies.",
          },
          400,
        );
    }
  });
  return {
    server,
    cancelAll: () => {
      for (const controller of active.values()) controller.abort();
    },
  };
}

export const defaultServerOptions = {
  runsRoot: resolve(".runs"),
  webRoot: resolve("web/dist"),
  scenarioPath: resolve("fixtures/scenario.json"),
  archivedScenarioPath: resolve("fixtures/archived-icta/scenario.json"),
};
