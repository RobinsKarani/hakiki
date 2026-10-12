# Security and MCP audit

Reviewed 12 October 2026 against executable paths, installed SDK 2.3.1, actual transports and the [official MCP specification](https://modelcontextprotocol.io/specification/2026-07-28). PASS means the listed control/observation worked, not general certification.

| Finding | Status | Evidence and limits |
| --- | --- | --- |
| Negotiation / initialization | PASS | Actual KenyaLaw/Procurement connections record modern 2026-07-28 negotiation; Filesystem uses legacy 2025-11-25. Modern MCP uses per-request negotiation, not a legacy initialize handshake. |
| Discovery and transport | PASS | Three Node stdio connections, discovered schemas and actual calls. Inspector CLI discovered Procurement/Filesystem and executed KenyaLaw lookup. No internal handler imports. |
| Structured contracts / errors | PASS | Three strict Zod input/output contracts; invalid inputs return isError; unknown tool produced ProtocolError -32602. Official client validates output schemas. |
| Credentials | PASS | Minimal child environment excludes OpenAI/Gemini/Groq/local keys, confirmed by real stdio probe. Node children avoid Bun automatic .env loading. No frontend keys. |
| Filesystem restrictions | PASS | Manifest-selected complete reads, realpath containment, digest recheck; independent server denies outside paths. No model-accessible file write tool. |
| Report / human gate | PASS | Fixed output paths, exclusive creation, complete findings, exact quotes and unchanged draft hash and completed execution. Named review is separate and unavailable to the model. Interrupted multi-file writes can require a fresh run; not transactional. |
| Prompt injection boundary | PASS | Scripted forbidden approval/shell calls never reached execution. Malicious fixture did not authorize privileged calls in completed reference. This proves host restrictions, not universal semantic immunity. |
| Untrusted rendering | PASS | React text rendering, escaped Markdown/HTML, CSP; no raw HTML insertion. Focused legal retrieval and a 12,000-character acceptance bound limit context flooding. Verified URI hints do not substitute for actual retrieval. Exact selected-path enums reduce reconstructed-path errors. Quote/hash checks do not establish truth. |
| Local HTTP mutations | PASS | Loopback, exact Host/Origin, session token, bounded JSON, explicit transmission consent. Tests reject cross-origin, arbitrary source and unnamed/unsigned approval. Not multi-user authorization. |
| Compatible inference destination | PASS | HTTP literal loopback /v1 only; URL credentials/query/fragments and redirects rejected. Real HTTP fixture verifies tool call and unpredictable response consumption. Local software could proxy elsewhere. |
| Limits / recovery / shutdown | PASS | Budget, cancellation, recoverable tool error and one-attempt fixture 503 checks. Actual modern child closes and exits. No durable resume. |
| Hard monetary/token cap | FAIL | Tokens checked between responses; completed Gemini used 166,311 total against 160,000 threshold. A response can overshoot; no guaranteed dollar cap. |
| External reliability | FAIL | Genuine 429/500/504 failures retained. Groq's observed 8,000 TPM constrains latency; successful-response pacing does not guarantee capacity. |
| Legal validity | NOT VERIFIED | Official HTTPS AKN URL validation now occurs before retrieval. Live retrieval succeeded. Latest amendments, applicability, authenticity and World Bank financing rules are not independently certified. Search results are not provision evidence. |
| Actual local model review | NOT VERIFIED | Ollama/LM Studio/llama.cpp not run. Fixture compatibility does not verify those implementations/models. |
| Institutional reviewer identity | NOT VERIFIED | Gate enforces a name/note, but identity is self-reported and local state editable. No authenticated institutional signature or tamper-proof ledger. |
| Provider retention / residency | NOT VERIFIED | Text leaves the computer with consent. OpenAI store:false and local artifacts do not establish zero retention or Kenya-only processing. |

Concrete fixes: narrowed requirement categories; mandatory actual PPADA/Article 227 retrieval; complete selected reads; repeated extraction preserving IDs/checks; deduplicated legal sources; retained plan and labelled chat evidence; safe loopback inference; invalid-run listing recovery; bounded Windows state-replacement retries. No speculative security service was added.

Separate processes inherit the user's OS powers; directory filtering is **not an OS sandbox**. Only trusted installed public server code should run. Publication excludes .env, .runs, .external, dependencies and builds. No private product code or instruction file is copied.

Inspector is explicit debugging, not automatic CI. For Procurement first create a local workspace and set REVIEW_RUN_ROOT to its absolute directory, without provider keys:

```sh
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node dist/procurement-server.js --method tools/list
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node node_modules/@modelcontextprotocol/server-filesystem/dist/index.js fixtures --method tools/list
npx --yes @modelcontextprotocol/inspector@2.10.1 --cli node .external/kenya-law-mcp/dist/src/index.js --method tools/list
```

The [Inspector CLI documentation](https://github.com/modelcontextprotocol/inspector/tree/main/clients/cli) describes call parameters. Inspector's legacy view can differ from the app's modern connection. No Inspector GUI review or OS sandbox penetration test is claimed. Public secret/dependency/diff checks are reported in readiness and the delivery report.
