# Application draft

Drafts address the brief's topics; exact private form wording has not been verified. Nothing submitted.

## Project description

Kenya Procurement Review Agent prepares a documentary review file for a procurement officer reviewing ICT equipment submissions. It fits the Governance track's tender-preparation workflow. The intended user is an officer in a Kenyan public body's procurement unit; we have not yet interviewed an officer or validated an institutional partnership.

The user selects a synthetic package or an archived public notice with explicitly fictional supplier documents. A model generates a visible plan, chooses tools, reads selected files through an independent Filesystem MCP server, and retrieves Kenyan legislation through public KenyaLaw MCP. A new Procurement MCP server exposes three tools: extract requirements with exact quotations, check documentary completeness, and write a review draft. The host validates source lines, hashes, supplier attribution and the complete findings matrix. It returns tool errors for model recovery and enforces execution limits.

The local browser shows actual inputs, outputs, timestamps, legal passages, findings and the generated report. Findings distinguish supplied, missing, conflicting and inconclusive evidence. They do not establish compliance. Contradictory warranty statements and undefined support thresholds illustrate why a human must inspect both evidence and interpretation.

One MIT TypeScript runtime supports manually selected Groq, OpenAI, Gemini and compatible loopback endpoints. Hosted GPT-OSS 120B is the open-weight competition candidate. Keys remain backend-only; selected text is transmitted with explicit consent. No automatic model switching occurs.

A named human records approval, rejection or revision of an unchanged draft. The model cannot approve, award, rank or disqualify suppliers. The project includes reproducible local checks, actual failed provider/semantic evaluations and known limits: incomplete historical criteria, unverified financing-rule applicability, quotas, no document authenticity checks and no measured institutional time saving. It is a draft-preparation prototype, not an autonomous procurement authority.

## Agentic behavior

An actual planning turn precedes model-selected tools; order is not hardcoded. The model performs multi-step reads, extraction, legal discovery, checks and drafting. Completed reference traces demonstrate recovery from failed calls/quotation errors. The host controls permissions, state and budgets. No scheduling, monitoring, multi-agent or durable workflow claim.

## MCP architecture

Three official clients connect over real stdio. New Procurement MCP has three domain contracts and actual report creation. KenyaLaw is a pinned independent public upstream. Filesystem is borrowed for maintained directory-restricted reads. Only selected discovered tools are exposed; upstream internal handlers are not imported. The official SDK handles modern/legacy negotiation. Actual inputs, outputs, durations and errors are logged locally.

## Evidence and orchestration

Source IDs, normalized line ranges, exact quotes, hashes and timestamps bind findings to evidence. They do not certify interpretation or authenticity. MIT orchestration is task-specific. Whether it satisfies the equivalent clause, and whether hosted open weights meet the intended rule, remains unconfirmed. See EVALS for genuine full-task outcomes; failed attempts are not successful model evaluations.
