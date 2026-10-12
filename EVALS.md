# Evaluations

Executed locally on Windows, Node 24+ / Bun 1.4.0, 12 October 2026. Results distinguish actual stdio/HTTP execution, fixture authorities/scripted models and live sources/providers. A report file existing is not a successful semantic evaluation. Raw local runs stay ignored; [sanitized metadata](docs/evaluations) records real IDs, usage, hashes and outcomes without private paths or credentials.

## Reproduce without paid calls

`bun run verify` runs types, lint/format, deterministic tests and both production builds. Last completed suite before final packaging: **29 pass, 0 fail, 103 assertions, six test files**. No external legislation or model request is required. Tests launch real stdio servers where indicated; scripted model tests are not provider evaluations.

| Task | Method | Result |
| --- | --- | --- |
| Discover own three tools and schemas | Actual Procurement stdio | PASS |
| Negotiate MCP and invoke structured probe | Actual SDK/stdio fixture, modern era | PASS |
| Reject schema and unknown-tool errors; close child | Actual protocol fixture, isError/-32602/process exit | PASS |
| Read selected files; deny outside filesystem | Actual third-party Filesystem stdio | PASS |
| Extract exact tender requirements; reject fabricated quotes | Actual Procurement stdio, synthetic tender | PASS |
| Preserve IDs/checks on repeated extraction | Actual Procurement stdio | PASS |
| Distinguish present/missing/conflicting/inconclusive | Actual Procurement stdio, four requirements/two suppliers | PASS |
| Reject cross-supplier evidence / invented conflicts | Actual Procurement stdio | PASS |
| Reject unsupported law and incomplete report matrix | Actual Procurement stdio, explicitly fixture law | PASS |
| Generate draft; freeze and require named unchanged review | Actual local writes / HTTP, fixture authorities | PASS |
| Invalid DOCX/binary/oversized/traversal inputs | Local import/realpath checks | PASS |
| Forbidden approval/shell injection and tool budget | Scripted model, real host loop | PASS |
| Cancellation before calls; recoverable tool error | Scripted model, real host loop | PASS |
| Provider failure without retry | Official OpenAI SDK against fixture HTTP 503 | PASS |
| Local tool-response consumption / redirect denial | Official SDK against actual local HTTP fixture | PASS |
| Compacted context retains plan / labelled evidence | Official compatible SDK against HTTP fixture | PASS |
| Archived provenance / ambiguous amount / missing security | Actual Procurement stdio, archived excerpt/synthetic supplier | PASS |

These are independent deterministic verification tasks, not seventeen live LLM reviews. Fixture law checks provenance mechanics only. They do not certify all interpretations or prove a particular installed local model works.

## Live evaluations and retained failures

| Real run | Provider/model | Outcome | Time / usage |
| --- | --- | --- | --- |
| `c17b47db-8b5f-4319-ac32-2a0879972e2c` | OpenAI gpt-5.6-terra | PASS: full Amani task, all 3 MCPs, 8/8 classifications; recovered 404 and bad quote | 109.159 s; 90,244 in / 6,782 out; estimated $0.262 |
| `86ffbab9-48db-425d-8a16-8966e7800567` | Gemini 3.5 Flash Lite | **FAIL**: completed draft but only 5/8 classifications; two false missing findings and missed warranty conflict | 76.606 s; 87,285 in / 4,739 out; estimated $0.038 |
| `a1ec3d2e-08ae-4dde-90f3-79118dfdc565` | Gemini 3.5 Flash Lite | PASS: full task, all MCPs, 8/8; five recoverable errors | 88.639 s; 158,888 in / 7,423 out; estimated $0.066 |
| `2ee7242b-90ab-4e8e-8747-603f019961dc` | Gemini 3.5 Flash Lite | PASS: final focused/path schemas, full task, all MCPs, 8/8; three recoverable errors | 61.678 s; 77,527 in / 6,546 out; estimated $0.040 |
| `010f98e2-7e9b-4566-96c7-eeb5856618bf` | Groq openai/gpt-oss-120b | FAIL: HTTP 429 after two turns; no draft | 8.994 s; 5,016 in / 592 out |
| `563160ef-cc31-4f9d-93b2-24f5f428ef07` | Groq openai/gpt-oss-120b | FAIL: 20-turn limit, repeated reads/extraction, duplicate IDs, no legal retrieval/draft | 711.689 s; 85,969 in / 3,053 out |
| `0ce2666f-f8da-4600-9940-2a1ddf9260c1` | Gemini 3.5 Flash Lite | FAIL: eight correct intermediate findings but no draft; large Section-prefixed law results consumed token budget, report quote rejected | 67.938 s; 166,708 in / 4,481 out |
| `20f49c15-66c3-4f0e-8570-cde985ba7178` | Groq openai/gpt-oss-120b | FAIL: smaller tax/warranty task reached four intermediate findings; HTTP 429 before legal retrieval/draft | 410.259 s; 47,325 in / 1,582 out |

Archived GPT-OSS follow-up `ec39bac3-e823-4648-a9d1-57da54b35cb9` FAILED after 762.283 seconds, 16 model turns, 82,741 input / 9,371 output tokens and eleven recoverable quotation errors. It stopped with HTTP 400 classified as a tool-schema error. No requirements, legal sources or draft were produced. The hosted open-weight full-task requirement is therefore **INCOMPLETE**. Earlier Google Gemma 4 attempts also failed: conversation format, HTTP 429, HTTP 500 and HTTP 504; none produced a full task. An earlier gpt-5.6 attempt rejected bad legal IDs then timed out. These were real development failures, not successful open-weight evaluations.

Live KenyaLaw smoke run `80c71691-ab74-446f-ae16-ff7a38a9b836` discovered actual public tools and retrieved PPADA sections 79/80 and Constitution Article 227. Source failures remain possible; no external PDF is part of deterministic CI. Inspector CLI separately discovered own/Filesystem tools and invoked legal search. Read-only Edge browser checks display a genuine stored run; they do not invoke a model. Latest Gemini WebM duration is 76.20 seconds, unedited/local, not uploaded; its source/report frame was decoded and inspected. The older 102.72-second recording is retained.

## Expected Amani findings

| Supplier | Registration | Tax evidence | Warranty | Undefined support |
| --- | --- | --- | --- | --- |
| Alpha | present | present | present | inconclusive |
| Beta | present | missing | conflicting | inconclusive |

`bun run eval:recorded --run <uuid>` scores an existing Amani run without inference. The completed Gemini reference returned 8/8 PASS; the earlier draft returned 5/8 **exit 1**. It also checks actual integration calls and the draft hash. These eight matrix cases belong to a single task, not eight independent agent runs. Model interpretations, irrelevant legal associations and requirement extraction completeness still need human assessment.

The final run also returned 8/8, with a matching draft SHA-256 and actual Constitution Article 227 / PPADA section 79 quotations. Inspecting its draft found model wording such as "satisfying requirement" alongside the host's explicit documentary-only caveats. This is not verified substantive compliance; a reviewer must assess authenticity, signatures and interpretation. No human approval was manufactured.

Prompts/schema/runtime changed between runs. The 5/8 to 8/8 improvement is development evidence, **not a controlled fixed-revision reliability study**. No statistically meaningful run-to-run variance or success rate is claimed. Public metadata is inspectable; raw signed provider receipts are not available, and rerunning paid tests requires your own key/quota.

## Unresolved failure and next action

**Semantic extraction remains unreliable on unfamiliar notices.** GPT-OSS's archived attempt repeatedly produced non-matching multiline quotations; its proposed categories also need scrutiny. Strict validation blocks invented evidence but cannot independently determine every correct category or meaningful legal conclusion. Actionable errors now identify the source and line range without weakening exact matching; this change is locally tested but not a successful open-weight rerun. Next: evaluate diverse unseen synthetic packages on a fixed revision and have an officer inspect the interpretations. Do not curate only easy cases.

Additional unresolved limits: free-tier quotas can prevent complete tasks; the between-response 160k token threshold overshot on the successful Gemini run; malformed archived bid-security currency cannot be guessed; full bidding criteria/current amendments/financing rules are not verified. The host now narrows focused lookup to bare section/article identifiers because the pinned upstream advertises Section-prefixed inputs which returned oversized documents in a real run. Local Ollama/LM Studio inference and organizer acceptance of hosted open weights/custom orchestration are NOT VERIFIED.

Costs use undiscounted published text rates, not invoices; caching/account billing may differ. Hosted open-weight use means Groq's `openai/gpt-oss-120b` checkpoint/service, not self-hosted weights or Gemini. Paid/live commands are explicitly separated in README and never automatic CI.

Further retained failures: `5d6aa6a9-5069-4556-b602-c364148a8a20` stopped after 77.283 s (103,806 input / 4,423 output), because our completion gate rejected a valid bare Constitution URI. Fixed with a work/expression URI regression test. `c4262412-5b24-4508-9de7-b0bd77aeb3fa` failed after 75.394 s (170,678 input / 4,946 output), after full-document fallback on a wrong Constitution identifier flooded context. The current bounded host requires focused provisions, caps accepted legal text at 12,000 characters and supplies verified starting URI hints. These failures are not removed or relabelled as successes.
