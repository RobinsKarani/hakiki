# Kenya Procurement Review Agent

A TypeScript agent checks selected tender and supplier documents, retrieves Kenyan legislation and writes a draft report with source quotations. The model writes a plan and chooses MCP tools across several steps. A human then reviews the draft. The agent cannot award, rank or disqualify bidders.

OpenAI and Gemini have completed the synthetic review. One earlier Gemini report gave incorrect findings. **No open-weight model has completed a full task yet**, and no procurement officer has reviewed the output. See [results](EVALS.md) and [submission gaps](docs/readiness.md).

## Run locally

Requires **Node 24+**, **Bun 1.4+**, Git and internet access for installation and legal retrieval. Tested on Windows; other operating systems have not been tested.

```sh
git clone https://github.com/RobinsKarani/procurement-review-agent.git
cd procurement-review-agent
bun run launch
```

`launch` installs locked dependencies, builds the app and [public KenyaLaw MCP](https://github.com/Verantu-Labs/kenya-law-mcp), then starts **http://127.0.0.1:4317**. Setup makes no model requests. It uses KenyaLaw commit `70ab4d8f28b4a0002b5bd8680c8eb2019006aae2` and refuses to overwrite a modified or different checkout. Use `bun run start` for later starts, `bun run setup` to install/build only, and Ctrl+C to stop.

If `.env` does not exist, copy [`.env.example`](.env.example) to `.env` in the repository root. Add the key for your chosen provider and restart. `.env` is ignored by Git; keys stay in the backend. For example:

```dotenv
GROQ_API_KEY=your-local-key
REVIEW_PROVIDER=groq
REVIEW_MODEL=openai/gpt-oss-120b
```

| Provider | Configuration | Where inference runs |
| --- | --- | --- |
| Groq | `openai/gpt-oss-120b`; `GROQ_API_KEY` | Hosted open-weight inference |
| OpenAI | `gpt-5.6-terra`; `OPENAI_API_KEY` | OpenAI |
| Gemini | `gemini-3.5-flash-lite`; `GEMINI_API_KEY` | Google |
| Local endpoint | Tool-calling model ID, local HTTP `/v1` URL, optional `LOCAL_MODEL_API_KEY` | Your inference server |

Choose the provider and model in the browser. They stay fixed during the run. Every provider uses the same agent and tools. Groq requests wait according to token-reset headers; a quota error stops the run. The tested account's 8,000-tokens-per-minute limit made Groq runs slow. Ordinary reviews have a four-minute deadline; the separate open-weight evaluation allows fifteen minutes.

For local inference, enter an OpenAI-compatible URL such as [Ollama](https://docs.ollama.com/api/openai-compatibility)'s `http://127.0.0.1:11434/v1` or [LM Studio](https://lmstudio.ai/docs/developer/openai-compat)'s `http://127.0.0.1:1234/v1`, plus a model ID. Only loopback HTTP addresses are allowed; credentials in URLs, query parameters and redirects are rejected. **Test tool calling** checks that the model calls a tool and uses its response. This check also runs before each local review. Full tasks on installed Ollama, LM Studio or llama.cpp models remain **untested**; the check does not prove procurement accuracy or prevent serving software from forwarding data.

Leave `KENYALAW_MCP_ENTRY` empty to use setup's pinned `.external/kenya-law-mcp`. To use an existing public KenyaLaw checkout instead, set it to that checkout's built `dist/src/index.js`, with dependencies installed. This is a local executable path. The agent connects through MCP stdio.

Select a package and its documents, choose a model, and consent to sending text and any provider charges. Start the review. The browser shows the run's plan, tool calls, errors, findings, source passages and draft. Approving, rejecting or requesting a revision requires a reviewer name and note. These decisions concern the draft only. Opening a previous run shows saved activity.

## Data and scope

- **Fictional Amani:** seven documents, two suppliers and four requirements. Includes missing tax evidence, conflicting warranties, unclear support criteria and a prompt-injection attempt. Use this for the evaluated short demo.
- **Archived ICT Authority:** an excerpt from notice **KE-ICTA-395947-GO-RFB**, closed **21 August 2024**, with three fictional supplier files. The [original notice](https://cms.icta.go.ke/sites/default/files/2024-07/Advert%20-%20ICTA-Supply%20%26%20Delivery%20of%20Laptops%20and%20Tablets---25%20x%203_0.pdf), retrieval time and PDF hash are recorded; personal contacts are removed. The printed `1,200,00.00` amount is kept as unclear. Full bidding criteria and applicable World Bank financing rules have not been checked. The fictional suppliers did not participate in this tender.

The project reviews supplied documents. It has no access to real bids or an award-history dataset. Use only synthetic or permitted public data: no active tenders, confidential bids or personal details. Findings describe the supplied evidence; they do not certify compliance or document authenticity.

For a custom synthetic package, follow the [scenario manifest](fixtures/scenario.json) and place its documents alongside it. The CLI uses the same agent as the browser:

```sh
bun run review doctor
bun run review sample --scenario fixtures/scenario.json --send-to-provider
bun run review status --run <run-uuid>
bun run review report --run <run-uuid>
bun run review request_revision --run <run-uuid> --reviewer "Your name" --note "Required revision"
```

Supported files are UTF-8 TXT/Markdown and PDFs with extractable text. Limits: 8 MiB per file, 20 PDF pages, 60,000 characters per document, 180,000 per run and twelve files. Blank PDFs are rejected. OCR and DOCX are unsupported. Check PDF layout manually; citations refer to normalized text lines, not PDF pages.

A smaller four-file tax/warranty task is available through the CLI at [fixtures/minimal-scenario.json](fixtures/minimal-scenario.json). Results on it do not establish accuracy on the other packages.

The backend requires all selected files to be read, plus retrieval of a Public Procurement and Asset Disposal Act provision and Constitution Article 227, before drafting. Legal lookup is limited to individual sections/articles; responses over 12,000 characters are kept in the trace but excluded from model context and citations. A starting URI or search result is not citation evidence.

## Verification and costs

```sh
bun run verify           # types, lint/format, deterministic tests, production builds
bun run audit            # network advisory lookup; no paid inference
bun run test:filesystem  # actual third-party stdio and outside-path denial
bun run test:legal       # explicit LIVE KenyaLaw/source network test
bun run eval:paid        # explicit selected-provider review; sends text externally
bun run eval:open-weights --send-to-provider
bun run eval:open-weights --scenario fixtures/archived-icta/scenario.json --send-to-provider
bun run eval:recorded --run <existing-run-uuid> --case amani  # no new inference
bun run eval:suite --send-to-provider  # eight tasks; explicit paid/live evaluation
```

`verify` runs locally without live legal retrieval or paid inference. Some tests use fixture law or scripted models; these test backend behavior, not provider accuracy. Live commands are opt-in. There are no GitHub Actions workflows or automatic paid PR evaluations.

The [eight synthetic evaluation tasks](fixtures/evaluations/README.md) have separate expected results used only by the saved-run scorer. The hosted suite keeps one provider and runtime, records failures, and stops after a provider rejection. It does not judge legal interpretation or certify compliance.

The latest recorded Gemini run took 49.5 seconds and matched eight expected classifications with both authorities cited: 62,152 input tokens, 4,582 output tokens, about **$0.030** at published text rates. Its unedited local recording lasts 63.56 seconds. The eight-task suite returned **4 PASS / 4 FAIL**: classifications matched, but four drafts lacked citation coverage. The OpenAI Terra reference cost about **$0.262**. These are estimates, not invoices. [EVALS.md](EVALS.md) records the failures, including GPT-OSS HTTP 400/429 attempts without drafts.

## Privacy and limits

Runs are stored in ignored `.runs/<uuid>` directories: normalized inputs, retrieved law, state, timestamped tool logs, Markdown/JSON reports and review decisions. Logs contain document text. Keep them private.

Hosted inference sends selected text to the chosen provider. Keys stay in the backend, but provider retention and processing-location policies still apply; OpenAI `store: false` does not guarantee zero retention. Local serving software may also forward requests.

The agent is limited to 20 model turns, 40 proposed tool calls, 60-second individual model/tool requests, 240,000 context characters and 160,000 cumulative tokens checked **between turns**. A response can exceed the remaining token budget; there is no hard cost cap. Failed/cancelled runs cannot be resumed; revisions need a fresh run.

Quote and hash checks show where cited words came from. They do not verify legal interpretation, authenticity, current amendments or complete tender criteria. Reviewer names are self-reported. Separate MCP processes and directory restrictions are not an OS sandbox. Read the [security audit](docs/security-audit.md) before extending permissions.

## Modify and inspect

- [runtime.ts](src/runtime.ts): planning turn and tool loop.
- [models.ts](src/models.ts), [chat-model.ts](src/chat-model.ts): provider calls and history.
- [mcp.ts](src/mcp.ts): tool discovery, transport, logs and legal sources.
- [procurement.ts](src/procurement.ts), [procurement-server.ts](src/procurement-server.ts): three tools and report creation.
- [workspace.ts](src/workspace.ts), [human-review.ts](src/human-review.ts): files, evidence and draft decisions.
- [http.ts](src/http.ts), [web/src/main.tsx](web/src/main.tsx): local backend and browser.

See [architecture](ARCHITECTURE.md), [execution and state diagrams](docs/implementation.md), [MCP tool contracts](docs/mcp-tools.md), [runtime choice](docs/runtime-decision.md) and [AGENTS.md](AGENTS.md) for development guidance. Filesystem MCP is borrowed for its maintained file-reading and directory restrictions. KenyaLaw remains an independent public dependency.

## Open Questions / Things to Verify

The project uses the [MIT license](LICENSE), an [OSI-approved license](https://opensource.org/license/mit), and was developed with AI assistance. Organizer acceptance of the custom runtime, hosted open-weight inference and eligible build dates remains unconfirmed. A full open-weight task, installed local-model review and procurement-officer feedback are still outstanding. See [readiness](docs/readiness.md) for submission steps. Nothing here deploys the app, uploads the video or submits the entry.
