# Runtime decision

Reviewed 12 October 2026. The agent uses a small MIT-licensed TypeScript loop with official model and MCP SDKs. [runAgent](../src/runtime.ts) runs the loop; [review](../src/review.ts) controls tools and drafting. There is no LangGraph or LangChain dependency. See the [execution diagrams](implementation.md).

The model writes a plan and chooses tools. The backend checks calls, executes them one at a time and logs results. Tool errors go back to the model; provider errors stop the run. The loop ends at a saved draft or a run limit. Revisions need a fresh run.

| Option | Fit for this implementation | Trade-off |
| --- | --- | --- |
| Direct provider APIs | Already implemented; keeps this sequential review easy to trace | We maintain provider differences and limits; competition acceptance is uncertain |
| AI SDK ToolLoopAgent | Provides loop controls, context hooks and tool events | Would replace existing provider calls; not installed or tested here |
| Pi agent core | Provides a tool loop with state, cancellation and events | Would need MCP integration; not installed or tested here |
| LangGraph | Provides graph-based orchestration | This workflow is sequential; not installed or tested here |

The [AI SDK loop controls](https://ai-sdk.dev/docs/agents/loop-control) and [Pi loop](https://github.com/badlogic/pi-mono/blob/main/packages/agent/src/agent-loop.ts) informed the design: retain tool history, return errors, check limits and cancellation, and validate the final report. No source code was copied.

## Eligibility: NOT CONFIRMED

The [Governance brief](https://agentic-africa-challenge.lovable.app/tracks/governance) requires open-source orchestration and lists libraries followed by “or equivalent.” It does not explicitly confirm a team's own MIT runtime. If a third-party loop is mandatory, AI SDK is a candidate to test while keeping the procurement checks and MCP connections.

Question prepared for the public community channel (not sent):

> Does a small MIT-licensed TypeScript orchestrator using official model tool-calling APIs and MCP clients satisfy “open-source orchestration or equivalent,” or must we use an existing third-party orchestration package? Also, is hosted inference on an open-weight model accepted, and what are the exact eligible build window and deadline timezone?

## Current provider choice

The same runtime supports Groq GPT-OSS 120B, OpenAI Responses, Gemini and local OpenAI-compatible endpoints. Users choose a provider and model; there is no automatic fallback. Local endpoints must pass a tool-response check. OpenAI and Gemini completed reference tasks; a full hosted open-weight task has not succeeded, and installed local-model tasks remain untested.

## Open Questions / Things to Verify

Ask the organizers about the custom runtime, hosted open weights and submission dates. Any change to a third-party loop needs implementation and tests before it can be described as supported. [EVALS](../EVALS.md) records completed and failed tasks.
