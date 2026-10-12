# Runtime decision

Reviewed 12 October 2026. Use a direct, MIT-licensed TypeScript loop with the official provider and MCP SDKs. Replace the previous LangGraph graph entirely, including its dependency and graph-specific tests. This is a task-specific runtime, not a reusable framework.

The model proposes a visible plan and chooses discovered tools. The host executes only approved tools sequentially, validates arguments and source passages, records outputs and timestamps, returns recoverable tool errors to the same model, and stops at a validated draft or execution limit. Provider failures stop the run. A fresh run is required for revisions; no durable resume or automatic paid retry is claimed.

| Option | Fit for this implementation | Trade-off |
| --- | --- | --- |
| Direct provider APIs | Existing adapters already preserve tool-call histories; simplest way to enforce this small workflow | We maintain provider differences and limits; custom-orchestration eligibility uncertain |
| AI SDK 7 ToolLoopAgent | Mature stop conditions, context hooks and tool events | Replaces existing provider paths; third-party equivalence still not explicitly confirmed |
| Pi agent core | Established stateful tool loop and abort/event practices | Requires MCP integration and another provider layer; more functionality than this task needs |
| LangGraph | Established orchestration | Graph execution adds no value to this sequential workflow; removed |

Reviewed [AI SDK loop controls](https://ai-sdk.dev/docs/agents/loop-control) and [Pi loop implementation](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/agent-loop.ts). Relevant practices: preserve provider-native history, return tool errors as evidence, enforce limits between calls, check cancellation, and distinguish successful model completion from a valid task artifact. No source code copied.

## Eligibility: NOT CONFIRMED

The [Governance brief](https://agentic-africa-challenge.lovable.app/tracks/governance) requires open-source orchestration and lists libraries followed by “or equivalent.” It does not expressly approve or forbid a team's own MIT-licensed orchestration. Publishing our loop does not establish eligibility. If organizers require a third-party loop, AI SDK is the lightest suitable alternative reviewed here; domain validation and MCP transport boundaries should remain unchanged.

Question prepared for the public community channel (not sent):

> Does a small MIT-licensed TypeScript orchestrator using official model tool-calling APIs and MCP clients satisfy “open-source orchestration or equivalent,” or must we use an existing third-party orchestration package? Also, is hosted inference on an open-weight model accepted, and what are the exact eligible build window and deadline timezone?

## Current provider choice

One runtime now supports Groq GPT-OSS 120B via the existing OpenAI-compatible Chat Completions SDK, OpenAI Responses, Gemini and a configurable loopback compatible endpoint. No orchestration dependency added. Hosted open weights are authorized for implementation now; organizer confirmation is deferred by the owner, not assumed. Local endpoints are optional and must pass a genuine structured tool-response probe. Actual Ollama/LM Studio reviews remain unverified.
