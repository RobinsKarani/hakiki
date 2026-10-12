# Procurement MCP contracts

Start `node --experimental-strip-types src/procurement-server.ts` with `REVIEW_RUN_ROOT` set to a workspace created by the CLI. Production: `node dist/procurement-server.js`. All tool contracts are discoverable through `tools/list`, with input/output JSON schemas. The server supports modern and legacy stdio through the official SDK.

| Tool | Input | Verified behavior | Limit |
| --- | --- | --- | --- |
| `extract_tender_requirements` | selected tender ID and proposed requirements with category, uncertainty and exact reference | Every quote/hash matches; returns all stable IDs; repeated identical extraction preserves checks | New requirements invalidate old findings. Category must be explicitly required or null; model interpretation/completeness need review |
| `check_bid_completeness` | registered supplier ID and requirement observations | Same-supplier references and quotes validated; computes every requirement's present/missing/conflicting/inconclusive finding | Categories are from the manifest; neither identity, authenticity nor semantic satisfaction is independently established |
| `write_review_report` | every computed finding once, model interpretation, uncertainty, retrieved law references and scope notes | Revalidates source hashes and exact quotes; writes Markdown/JSON once; freezes draft | Legal references accept only `law-N` IDs; tender/bid evidence is stored separately; cannot choose arbitrary paths or approve a draft |

A reference is `{document_id, line_start, line_end, quote}`. Lines are positive, ordered and span at most 21 lines inclusive. Quotes match an exact substring, preserving whitespace and line breaks. Schemas reject unknown properties and bound strings/arrays. Tool execution errors use `isError:true`; protocol failures remain failures. Actual inputs/outputs/timestamps are logged. See [security audit](security-audit.md).

The server mutates one scoped local run and is not a stateless cloud service. Do not use it as a hosted public multi-tenant endpoint. A stranger can reuse its contracts by creating a documented scenario workspace, discovering tools and providing evidence references. Human decisions are intentionally absent from MCP discovery. Annotations do not provide authorization.
