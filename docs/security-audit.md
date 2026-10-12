# Security and MCP audit

Reviewed 12 October 2026 using the code, installed SDK 2.3.1, transport tests and [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28). PASS means the listed check worked under the tested conditions. It does not certify the whole system.

| Finding | Status | Evidence and limits |
| --- | --- | --- |
| Negotiation / initialization | PASS | Actual KenyaLaw/Procurement connections record modern 2026-07-28 negotiation; Filesystem uses legacy 2025-11-25. Modern MCP uses per-request negotiation, not a legacy initialize handshake. |
| Discovery and transport | PASS | Three Node stdio connections discover schemas and call tools. Inspector CLI listed Procurement/Filesystem tools and ran a KenyaLaw lookup. No internal handler imports. |
| Schemas / errors | PASS | Strict Zod input/output contracts. Invalid inputs return `isError`; an unknown tool returned `ProtocolError -32602`. The official client validates output schemas. |
| Credentials | PASS | A stdio test confirmed that MCP children started by `review` receive no provider keys. Node children do not auto-load `.env`. Keys are absent from the frontend. |
| Filesystem restrictions | PASS | Selected-file reads, resolved-path containment and hash checks. Filesystem MCP denied outside paths. No arbitrary file-write tool is exposed. |
| Report / human gate | PASS | Fixed output paths, no overwrite, complete findings and exact quotes. Review requires completed execution, an unchanged draft, a name and a note. The model cannot approve. Interrupted writes can leave partial files. |
| Prompt injection boundary | PASS | Scripted approval/shell proposals were blocked. The malicious fixture did not gain privileged access in completed reference runs. Other effects on model reasoning remain possible. |
| Untrusted rendering | PASS | Reports and sources render as React text, with CSP and no raw HTML insertion. Legal text accepted into context is capped at 12,000 characters. Source hints are not citation evidence. |
| Local HTTP writes | PASS | Loopback, exact Host/Origin, session token, bounded JSON and transmission consent. Tests reject cross-origin writes, arbitrary source paths and incomplete/unnamed draft approval. This is a single-user local app. |
| Local inference destination | PASS | HTTP loopback `/v1` only; URL credentials, queries, fragments and redirects are rejected. An HTTP fixture tested tool calling and use of its response. Local serving software could forward data. |
| Limits / recovery / shutdown | PASS | Tests cover budgets, cancellation, recoverable tool errors and a fixture HTTP 503 without retry. A connected MCP child closed and exited. Runs cannot be resumed. |
| Hard cost/token cap | FAIL | Tokens are checked between responses. Gemini run `a1ec3d2e` used 166,311 against the 160,000 threshold. A response can exceed the remaining budget; no guaranteed cost cap. |
| External reliability | FAIL | Live HTTP 429/500/504 failures are recorded. The tested Groq account's 8,000-tokens-per-minute limit caused slow runs; request spacing cannot guarantee quota. |
| Legal validity | NOT VERIFIED | Official HTTPS AKN URLs are checked before retrieval, and live retrieval succeeded. Current amendments, applicability and World Bank financing rules still need review. Search results are not provision evidence. |
| Installed local-model review | NOT VERIFIED | No full task on Ollama, LM Studio or llama.cpp. Fixture tests do not verify those servers or models. |
| Reviewer identity | NOT VERIFIED | The gate requires a name and note, but names are self-reported and local files are editable. There is no authenticated officer identity or signature. |
| Provider retention / processing location | NOT VERIFIED | Text leaves the computer with consent. OpenAI `store: false` does not guarantee zero retention or Kenya-only processing. |

Implemented fixes include narrower categories, required document/legal reads, stable IDs on repeated extraction, duplicate-law prevention, retained chat evidence, loopback endpoint checks, handling invalid run records and bounded retries for Windows state-file replacement. See [review](../src/review.ts), [workspace](../src/workspace.ts), [chat adapter](../src/chat-model.ts) and [HTTP routes](../src/http.ts).

MCP processes have the user's OS permissions; directory filtering is **not an OS sandbox**. Run only trusted server code. Git excludes `.env`, `.runs`, `.external`, dependencies and builds.

Inspector is a manual debugging command. For Procurement, [create a fresh workspace](mcp-tools.md), set `REVIEW_RUN_ROOT` to its directory and keep provider keys out of the server environment:

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node dist/procurement-server.js --method tools/list
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node node_modules/@modelcontextprotocol/server-filesystem/dist/index.js fixtures --method tools/list
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node .external/kenya-law-mcp/dist/src/index.js --method tools/list
```

See [Inspector CLI usage](https://github.com/modelcontextprotocol/inspector/tree/main/clients/cli) for call parameters. Its legacy connection can differ from the app's modern connection. The Inspector GUI and an OS sandbox penetration test have not been run. [Readiness](readiness.md) records public-file and dependency checks.

## Open Questions / Things to Verify

Failed runs can retain partial drafts, and approval does not resume execution; see the [state diagram](implementation.md#run-state-and-human-review). Independent MCP clients must enforce the [backend policies](mcp-tools.md#references-and-enforcement-boundaries) they need. Hard cost caps, authenticated reviewers and all-or-nothing file writes are not implemented. Provider retention, current legal applicability and full local-model tasks remain unverified.
