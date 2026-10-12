# Kenya Procurement Review Agent

A local TypeScript agent prepares an evidence-backed **documentary review draft** for a Kenyan procurement officer. The selected model plans, chooses MCP tools, reads selected files, retrieves actual Kenyan law, checks evidence and writes a draft. A separate named human reviews it. The agent cannot award, rank or disqualify bidders.

Submission candidate with material limits. Genuine Terra and Gemini reviews completed; an earlier Gemini draft failed the expected classification test. See [evaluations](EVALS.md), [readiness](docs/readiness.md), [architecture](ARCHITECTURE.md) and [security audit](docs/security-audit.md). No procurement-officer partnership or measured time saving is claimed.

## Run locally

Requires **Node 24+**, **Bun 1.4+**, Git and GitHub/npm/source network access. Windows is tested; other operating systems are not verified. Clone and enter this repository, then:

```sh
bun run launch
```

This installs locked dependencies, clones/builds [public KenyaLaw MCP](https://github.com/Verantu-Labs/kenya-law-mcp) at `70ab4d8f28b4a0002b5bd8680c8eb2019006aae2`, builds the app and starts **http://127.0.0.1:4317**. No model request runs during setup. Setup refuses to overwrite an upstream checkout differing from the pin. Subsequent starts: `bun run start`. Setup alone: `bun run setup`. Stop with Ctrl+C.

Copy `.env.example` to ignored `.env`, configure the selected backend key and restart. Never publish or paste keys. Primary competition configuration:

```dotenv
GROQ_API_KEY=your-local-key
REVIEW_PROVIDER=groq
REVIEW_MODEL=openai/gpt-oss-120b
```

| Manual provider | Model/setup | Transmission |
| --- | --- | --- |
| Groq | `openai/gpt-oss-120b`; `GROQ_API_KEY` | Hosted open-weight inference |
| OpenAI | e.g. `gpt-5.6-terra`; `OPENAI_API_KEY` | Hosted proprietary inference |
| Gemini | e.g. `gemini-3.5-flash-lite`; `GEMINI_API_KEY` | Hosted proprietary inference |
| Local compatible endpoint | Your tool-capable model ID, HTTP loopback `/v1`, optional `LOCAL_MODEL_API_KEY` | Your local inference server |

Manual browser selection; one fixed model per run, no automatic fallback. All providers use the same runtime, MCP tools, evidence validation and human gate. Groq success responses pace subsequent requests using token-reset headers; quota failures stop without automatic retries. The observed 8,000 TPM account limit makes Groq much slower than the Gemini demo. Ordinary reviews have four minutes; explicit open-weight evaluation allows fifteen minutes.

Local examples: [Ollama](https://docs.ollama.com/api/openai-compatibility) at `http://127.0.0.1:11434/v1`, [LM Studio](https://lmstudio.ai/docs/developer/openai-compat) at `http://127.0.0.1:1234/v1`. Endpoints must be literal HTTP loopback addresses without credentials/query/redirects. **Test tool calling** performs a real structured call and unpredictable response-consumption probe. The backend also probes before every local review. Actual Ollama/LM Studio/llama.cpp procurement reviews are **not verified**. A compatible endpoint does not prove tool competence or that local software does not forward data elsewhere.

`KENYALAW_MCP_ENTRY` optionally points to another **public** checkout's built `dist/src/index.js` with installed dependencies. Leave empty for setup's pinned `.external/kenya-law-mcp`. It is a local executable path, not a key or hosted URL. Integration uses stdio, not internal handler imports.

Select package/documents and consent to transmission and charges. **Start genuine review**, inspect the actual plan, timestamped tool inputs/outputs/errors, findings, source passages and draft. Approval/rejection/revision requires a named reviewer and note. These decisions concern the draft only. Previous runs are clearly stored records.

## Data and scope

- **Fictional Amani:** seven synthetic documents, two suppliers, four requirements, missing tax evidence, contradictory warranty passages, undefined support criteria and a malicious embedded instruction. The evaluated fast Gemini scenario.
- **Archived ICT Authority:** real public notice excerpt **KE-ICTA-395947-GO-RFB**, closed **21 August 2024**, plus three fictional supplier files. [Original notice](https://cms.icta.go.ke/sites/default/files/2024-07/Advert%20-%20ICTA-Supply%20%26%20Delivery%20of%20Laptops%20and%20Tablets---25%20x%203_0.pdf), retrieval time and original PDF hash are recorded. Personal contacts are omitted. The malformed printed `1,200,00.00` amount is preserved as ambiguous. Full bidding criteria and World Bank financing-rule applicability are not verified. Fictional suppliers never participated.

This covers **documentary review**, not an OCDS award-history pipeline or access to real bids. No active tender, confidential bid or personal details should be supplied. No authenticity, receipts, registry checks, scoring or compliance certification.

Custom synthetic scenarios use the [manifest](fixtures/scenario.json) schema and sibling files:

```sh
bun run review doctor
bun run review sample --scenario fixtures/scenario.json --send-to-provider
bun run review status --run <run-uuid>
bun run review report --run <run-uuid>
bun run review request_revision --run <run-uuid> --reviewer "Your name" --note "Required revision"
```

Inputs: UTF-8 TXT/Markdown and text-layer PDF; <=8 MiB/file, <=20 PDF pages, <=60,000 extracted characters/document, <=180,000/run and twelve files. Blank PDFs rejected; no OCR or DOCX. PDF layout requires human inspection. Line references identify normalized text, not original pages.

A separate four-file tax/warranty fixture (`fixtures/minimal-scenario.json`) is available through the CLI for a smaller complete task. It is distinct from the harder Amani and archived tasks; success does not establish reliability on those cases.

The host exposes focused section/article retrieval with bare identifiers only. Verified URI hints are starting points, not legal evidence. Legal responses over 12,000 characters remain in the trace but are excluded from model context/citations; no full-document fallback is exposed.

Limits: twenty model turns, forty tool calls, sixty-second individual requests, 240,000 history characters and 160,000 cumulative input/output tokens checked **between turns**. One response can overshoot the remaining token budget; no hard monetary cap. No durable resume, scheduling, monitoring or generic workflow automation. Revisions require fresh runs.

## Verification and costs

```sh
bun run verify           # types, lint/format, deterministic tests, production builds
bun run audit            # network advisory lookup; no paid inference
bun run test:filesystem  # actual third-party stdio and outside-path denial
bun run test:legal       # explicit LIVE KenyaLaw/source network test
bun run eval:paid        # explicit selected-provider review; sends text externally
bun run eval:open-weights --send-to-provider
bun run eval:open-weights --scenario fixtures/archived-icta/scenario.json --send-to-provider
bun run eval:recorded --run <existing-Amani-run-uuid>  # no new inference
```

Fixture law and scripted models are labelled; they verify host behavior, not external reliability. Live law and paid tests are excluded from `verify`. No GitHub Actions workflow is added. Local verification is the primary loop; paid evaluations must never run automatically on PRs. Deployment success does not establish test correctness.

Ignored `.runs/<uuid>` stores state, actual `trace.jsonl`, normalized inputs, retrieved law, generated Markdown/JSON and any review decision. Failed/cancelled runs remain incomplete. Exact quote/hash checks establish provenance, **not** interpretation, authenticity, latest amendments or complete criteria.

Latest completed Gemini reference: 77,527 input / 6,546 output tokens, 61.7 seconds, 8/8 expected documentary classifications, estimated **$0.040**. Its unedited local recording is 76.2 seconds. Terra reference: approximately **$0.262**. The latest smaller GPT-OSS task reached four intermediate findings, then HTTP 429 stopped it before legal retrieval and drafting; no full open-weight task has succeeded. [Groq GPT-OSS 120B](https://console.groq.com/docs/model/openai/gpt-oss-120b) lists $0.15 input/$0.60 output per million tokens. These are text-rate estimates, not invoices; caching/account billing differ. Provider policies govern transmitted data; OpenAI `store:false` and local artifacts do not guarantee zero retention or on-device inference.

## Modify and inspect

- `src/runtime.ts`: bounded model-driven loop.
- `src/models.ts`, `src/chat-model.ts`: provider histories and compatible chat.
- `src/mcp.ts`: real discovery, transport calls, traces and sources.
- `src/procurement.ts`, `src/procurement-server.ts`: three domain tools and draft writes.
- `src/workspace.ts`, `src/human-review.ts`: bounded files, hashes and review gate.
- `src/http.ts`, `web/src/`: loopback backend and actual execution interface.
- [AGENTS.md](AGENTS.md), [MCP contracts](docs/mcp-tools.md), [runtime decision](docs/runtime-decision.md).

Borrowed Filesystem MCP provides maintained directory restrictions instead of duplicated file plumbing. Three servers run as separate Node stdio processes with minimal environments. This is a trusted local app: filtering is **not** an OS sandbox; reviewer names are self-reported, not institutional authentication.

[MIT](LICENSE), an [OSI-approved license](https://opensource.org/license/mit). AI-assisted development is disclosed. Custom MIT orchestration and hosted-weight eligibility need organizer confirmation. No private product code or credentials are included. Commands do not deploy, upload video or submit the entry.
