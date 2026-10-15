# Hakiki: Kenya Procurement Review Agent

An autonomous, inspectable AI agent that audits public tender bids against Kenyan procurement legislation using the **Model Context Protocol (MCP)**. 

Built for the **[African Agentic AI Design Challenge](https://agentic-africa-challenge.lovable.app/)**: Governance Track (*The Bid Box Challenge*).

[![Demo Video](https://img.shields.io/badge/Demo_Video-YouTube-red?logo=youtube)](https://youtu.be/U6YFVdpXw4Y)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Verification](https://img.shields.io/badge/Tests-31%20Passed-brightgreen)](tests/)

---

## What This Project Does

Evaluating public tender bids against technical specifications, statutory compliance, and tender rules is traditionally weeks of manual committee work. 

**Hakiki** (*Swahili for "to verify, audit, or ascertain"*) automates the mechanical checking, legal research, and evidence cross-referencing:
1. **Reads tender & bidder documents** via a secure, sandboxed Filesystem MCP server.
2. **Retrieves applicable Kenyan legislation** via the official KenyaLaw MCP server (querying the *Public Procurement and Asset Disposal Act 2015* and *Constitution Article 227*).
3. **Cross-references claims & flags discrepancies** via a custom Procurement MCP server (spotting missing tax certificates, conflicting warranty terms, or prompt injection attempts).
4. **Compiles a sourced draft report** with exact text line numbers, verbatim quotations, and SHA-256 hashes.
5. **Enforces a strict Human-in-the-Loop review gate**: The agent cannot award contracts, score tenders, or disqualify bidders. A named procurement officer must inspect the findings and record their decision (*Approve*, *Reject*, or *Request Revision*).

[**Watch the 1-Minute Demo on YouTube →**](https://youtu.be/U6YFVdpXw4Y)

### Target Users
- **Public Procurement Officers** in Kenyan ministries, county governments, and state corporations (e.g., ICT Authority).
- **Tender Evaluation Committees** performing preliminary and technical examination of bids under PPADA 2015.
- **Oversight Bodies & Auditors** (PPRA, Office of the Auditor-General) inspecting public contracting transparency.

---

## Quick Start (One Command)

### Prerequisites
- **Node.js 24+**
- **Bun 1.4+**
- Git & internet connection (for initial dependencies and live KenyaLaw retrieval).

```sh
git clone https://github.com/RobinsKarani/hakiki.git
cd hakiki
bun run launch
```

`bun run launch` automatically:
1. Installs locked dependencies.
2. Builds the TypeScript backend and React web client.
3. Builds the pinned [KenyaLaw MCP server](https://github.com/Verantu-Labs/kenya-law-mcp).
4. Launches the local browser application on **http://127.0.0.1:4317**.

*(For subsequent runs after setup, use `bun run start`).*

---

## Model Configuration

Copy `.env.example` to `.env` in the repository root and add your chosen provider key:

```dotenv
# Choose one provider:
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
GROQ_API_KEY=your-groq-key
```

| Provider | Model | Where It Runs | Description |
| :--- | :--- | :--- | :--- |
| **Gemini** | `gemini-3.5-flash-lite` | Google Cloud | Fast, low-cost reference run (~49s, ~$0.03/run) |
| **OpenAI** | `gpt-5.6-terra` | OpenAI | Frontier reference model |
| **Groq (Open-weights)** | `openai/gpt-oss-120b` | Groq Cloud | Hosted open-weights inference |
| **Local Endpoint** | Ollama / LM Studio | Local loopback (`127.0.0.1`) | Fully local, offline-capable inference |

The provider and model stay fixed during a run. The local web interface also lets you **inspect previous runs completely offline** without any API keys or network calls.
 
### Technology Stack
- **Runtime**: TypeScript, Node.js 24+, Bun 1.4+
- **Frontend**: React 19, Vite, Vanilla CSS
- **Protocol**: Model Context Protocol (MCP standard 2024-11-05 over stdio)
- **MCP Servers**: Custom Procurement MCP, Pinned KenyaLaw MCP (`kenya-law-mcp`), Official Filesystem MCP (`@modelcontextprotocol/server-filesystem`)
- **LLM SDKs**: `@google/genai`, `openai`, with local OpenAI-compatible endpoint support (Ollama/LM Studio)
- **Validation & Testing**: 31 deterministic Bun tests, Biome linter/formatter, Zod schema validation, `unpdf` text extraction

---

## How It Works: The Agent Loop

The agent uses a direct, sequential TypeScript runtime without black-box framework bloat:

```
┌───────────────────────────────────────────────────────────────┐
│                      Human Officer / UI                       │
│           (Inspects Plan, Tools, Findings & Draft)            │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Agent Runtime Loop                        │
│   Turn 1: Observable Plan ➔ Subsequent Turns: Tool Calls     │
└───┬───────────────────────────┬───────────────────────────┬───┘
    │                           │                           │
    ▼                           ▼                           ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  Filesystem  │        │   KenyaLaw   │        │ Procurement  │
│     MCP      │        │     MCP      │        │     MCP      │
│ (Input Docs) │        │(PPADA & 227) │        │ (Evaluation) │
└──────────────┘        └──────────────┘        └──────────────┘
```

1. **Turn 1 (Planning)**: The model emits a human-readable roadmap outlining which documents to inspect and which statutory authorities apply.
2. **Document Discovery**: The model calls `read_text_file` to read the tender and all supplier bids within scoped input folders.
3. **Statutory Lookup**: The model queries KenyaLaw MCP for specific provisions of the *Public Procurement and Asset Disposal Act (PPADA 2015)* and *Article 227 of the Constitution*.
4. **Completeness & Conflict Checks**: The model calls `check_bid_completeness` on each supplier. Conflicting statements (e.g. 12-month vs 24-month warranty) require dual exact quotations.
5. **Drafting & Citation Guard**: The model calls `write_review_report`. Citations must point to substantive statutory text: metadata lines and bare section headings are rejected.
6. **Human Sign-Off**: The completed draft is frozen. A qualified human enters their reviewer name and notes to approve, reject, or request revisions.

---

## Included Datasets

The repository includes two pre-packaged evaluation scenarios:
- **Fictional Amani County Package (7 files)**: Two suppliers competing on ICT equipment. Contains missing tax certificates, conflicting warranty terms, unclear support criteria, and an embedded prompt injection attempt. Used for the standard demonstration.
- **Archived ICT Authority Excerpt (4 files)**: A real excerpt from notice **KE-ICTA-395947-GO-RFB** (closed August 2024, contacts removed) with synthetic bids. Tests handling of real-world ambiguous requirements.

---

## Verification & Testing

Every component is testable deterministically without paid API calls:

```sh
bun run verify           # Runs typecheck, linter, all 31 tests, and builds
bun run test             # Fast deterministic test suite
bun run test:legal       # Live network smoke test against KenyaLaw
bun run eval:recorded --run <run-uuid> --case amani  # Score an existing run
```

---

## Honest Evaluation & Current Limits

In compliance with the challenge's evaluation rubric, full results are documented in **[`EVALS.md`](EVALS.md)**:

* **8 Live Evaluation Tasks**: 4 PASS / 4 FAIL under strict legal citation scoring. All 23 classification decisions matched expected outputs. Failures were retained where earlier drafts quoted section titles instead of substantive clauses.
* **Open-Weights**: Tested on Groq (`openai/gpt-oss-120b`). Free-tier 8,000 TPM quotas caused rate limits on 7-document runs; a minimal 4-document task (`fixtures/minimal-scenario.json`) is provided.
* **Regulatory Bounds**: The agent is strictly advisory. Document authenticity, company registry verification (BRS), and tax clearance verification (KRA) remain external human responsibilities.
 
### Future Improvements & Roadmap
- **Direct BRS & KRA Integration**: Automate company registration and tax compliance cross-checking via official Kenyan government API gateways once programmatic access is available.
- **Multi-Jurisdiction Expansion**: Extend statutory MCP tooling to support COMESA, EAC public procurement rules, and regional partner states' legal gazettes.
- **Interactive Clarification Dialogues**: Enable procurement committees to generate formal, auditable clarification letters to bidders for inconclusive evidence within statutory timelines.
- **Embedded OCR for Scanned Submissions**: Ingest scanned physical tenders directly without requiring pre-extracted text layers.

---

## Architecture & Documentation

- **[`ARCHITECTURE.md`](ARCHITECTURE.md)**: One-page architectural breakdown of runtime, state, and MCP integration.
- **[`EVALS.md`](EVALS.md)**: Reproducible test suite, pass/fail metrics, token costs, and retained failures.
- **[`docs/application.md`](docs/application.md)**: Challenge submission write-up and thematic context.
- **[`docs/mcp-tools.md`](docs/mcp-tools.md)**: Tool contracts and schemas.
- **[`AGENTS.md`](AGENTS.md)**: Project engineering and safety guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE). Built for the **African Agentic AI Design Challenge (2026)**.
