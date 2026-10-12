# Application draft

These drafts address the brief's topics. The application form's exact questions have not been checked. Nothing has been submitted.

## Project description

Kenya Procurement Review Agent prepares a draft document-checking report for an officer reviewing ICT equipment submissions in a Kenyan public procurement unit. It fits the Governance track. We have not yet interviewed a procurement officer or tested it with an institution.

The user selects a synthetic package or an archived notice with fictional supplier documents. The model writes a visible plan, chooses tools, reads files through third-party Filesystem MCP and retrieves legislation through public KenyaLaw MCP. Our Procurement MCP server has three tools: record requirements with quotations, check supplied evidence and write a draft. The backend checks source lines, hashes, supplier ownership and whether every requirement has a finding. Tool errors go back to the model for correction; calls, tokens and time are limited.

The local browser shows the run's inputs, outputs, timestamps, legal passages, findings and report. Findings distinguish present, missing, conflicting and inconclusive evidence. A contradictory warranty or unclear support threshold stays visible for human review. These classifications do not certify compliance.

One MIT TypeScript runtime supports Groq, OpenAI, Gemini and local compatible endpoints. The user chooses one model per run. Keys stay in the backend, and sending selected text requires consent. OpenAI and Gemini have completed tasks; hosted GPT-OSS attempts remain incomplete.

A human records approval, rejection or a revision request against the unchanged draft. Names are self-reported. The model cannot approve, award, rank or disqualify suppliers. Eight distinct live tasks returned four passes and four citation-coverage failures despite correct classifications. Local tests and failed evaluations are documented. Remaining limits include incomplete historical criteria, unverified financing rules, provider quotas and no authenticity checks. No institutional time saving has been measured, and competition eligibility still needs confirmation.

## Agentic behavior

The first model turn writes a plan; later turns select tools for reads, requirements, legal lookup, checks and drafting. Tool order is chosen by the model. Completed run logs show corrected calls after lookup and quotation errors. The backend controls permissions and limits. The plan is stored text, not an executable checklist. There is no scheduling, monitoring or run resume.

## MCP architecture

Official MCP clients connect over stdio to three Node processes. Procurement MCP is built here; KenyaLaw is a pinned public dependency. Filesystem MCP is borrowed for file reading and directory restrictions. The backend exposes selected discovered tools rather than importing server handlers. The SDK handles protocol negotiation. Requests, responses, durations and errors are logged locally. See [tool contracts](mcp-tools.md).

## Evidence and orchestration

Findings cite source IDs, text lines, exact quotes and hashes. These identify the evidence without proving interpretation or authenticity. The MIT loop is built for this review task. Organizer acceptance of it and hosted open weights remains unconfirmed. [EVALS](../EVALS.md) records actual task outcomes.

## Open Questions / Things to Verify

Check the form's wording, confirm eligibility and obtain officer feedback before submitting. Update these answers only after the relevant feature or evaluation works.
