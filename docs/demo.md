# Unedited demonstration

Use the seven-file fictional Amani package for the short demo. It contains no real bids or personal data. The archived ICTA package has incomplete criteria and unverified financing rules, so it cannot show a complete legal evaluation.

Before recording, run `bun run setup`, `bun run verify` and the separate live `bun run test:legal`. Configure a provider key and check quota. The recording script uses Edge on Windows and needs ffmpeg (`bunx playwright install ffmpeg`). Starting the app manually does not require video capture.

Suggested sequence:

- Show the selected documents, model and consent.
- Start a run and show its plan, MCP calls and errors.
- Inspect missing tax evidence, conflicting warranties and unclear support criteria.
- Open source passages and the draft; explain what still needs human checking.
- Show the draft-review controls. A typed name is not proof of officer approval.

`bun run demo:live --send-to-provider` runs **Gemini 3.5 Flash Lite**, makes paid requests and records a local WebM. It does not replay, edit, add audio, approve the draft or upload. It checks duration but cannot guarantee a run under three minutes. Groq is evaluated separately; the tested account's quota can make it too slow for this demo.

The latest recording, 12 October, is run `d9967f36-57b5-41b3-b1ad-7c462042ce93`. The WebM duration is **63.56 seconds**; agent execution took **49.506 seconds**. It matched 8/8 classifications, cited both retrieved authorities, made sixteen proposed calls across all three MCP servers and corrected two report errors. It used focused legal lookup and forward-slash selected paths. A decoded source/report frame was inspected. The video has no audio or human decision and remains local, ignored by Git. Earlier recordings last 76.20 and 102.72 seconds. A passing scorer does not independently verify interpretation.

## Your review and submission process

1. From the project root, run `bun run start` after setup/build. Open `http://127.0.0.1:4317`.
2. Choose **Inspect a previous actual run**. Use `440f3128` to inspect the retained citation failure, or `d9967f36` for the latest recorded draft. Opening it makes no model request.
3. Read every finding. Open tender and supplier passages, then the retrieved legal sources. Check the draft's interpretations and uncertainties; a source heading or general principle is not proof of a specific conclusion.
4. Under **Draft and human review**, enter **Named reviewer** and **Review note**, then choose **Approve this draft**, **request revision** or **reject**. For the `440f3128` draft, a revision request should explain its missing Article 227 citations and heading-only PPADA support. This records your decision about the draft only. Revision needs a fresh run; do not edit the frozen draft and then approve it.
5. When Groq quota allows, run `bun run eval:open-weights --scenario fixtures/minimal-scenario.json --send-to-provider`. Check that execution completed, both laws were retrieved, all four findings exist and a draft was written. Score with `bun run eval:recorded --run <uuid> --case minimal`, then inspect the report yourself. Another failure remains a failure; never describe a partial run as completion.
6. For your own demo, choose the Amani package and Gemini 3.5 Flash Lite. Start recording before selecting documents and starting the genuine run. Show the plan, calls, an actual error/recovery, findings, sources and human review. Do not replay saved activity as live. Keep one unedited take under three minutes; quotas and run variation can exceed it. The separate `demo:live` script makes another paid run if you choose it.
7. Watch the whole video. If using the local automated recording, note that it has no narration or human decision; record a new unedited take if you want to demonstrate those. Upload yourself to public YouTube/Vimeo and verify the link without signing in.
8. Review [EVALS](../EVALS.md), [architecture](../ARCHITECTURE.md), [application draft](application.md) and [readiness](readiness.md). The architecture PNG is below 10 MB. Publish only verified public files before the confirmed repository cutoff; credentials, raw runs and video stay outside Git. Repository publication needs separate authorization.
9. Submit the public repository and video links yourself by your 14 October evening target. Use only actual results. The exact organizer cutoff and acceptance of custom orchestration/hosted weights remain unconfirmed; do not label eligibility as guaranteed.

## Open Questions / Things to Verify

Review the whole recording before upload. If a spoken explanation is needed, record a new unedited take. Keep errors visible and label saved runs as saved. The video requirement remains incomplete until a public YouTube/Vimeo URL exists. Upload and submission are manual.
