# Hakiki Architecture

Hakiki is an autonomous, inspectable AI agent that prepares a documentary review draft for a Kenyan public procurement officer evaluating ICT equipment bids. It audits supplier submissions against tender rules, technical requirements, and Kenyan statutory provisions (Public Procurement and Asset Disposal Act 2015 and Constitution Article 227).

The system runs on a direct, lightweight TypeScript runtime without black-box framework abstractions, using the Model Context Protocol (MCP) across three decoupled stdio services.

---

## System Architecture

```mermaid
flowchart TD
    %% 1. Officer & UI
    subgraph S1 ["1. Officer and Web Interface"]
        Officer["Procurement Officer<br/>(Starts audit, reviews findings)"]
        UI["React Web Application (Port 4317)<br/>(Interactive dashboard & draft review)"]
    end

    %% 2. Agent Core
    subgraph S2 ["2. Agentic Reasoning and Runtime"]
        Runtime["Agent Runtime Engine (src/runtime.ts)<br/>Turn 1: Generates observable plan<br/>Turns 2+: Dynamically executes tools<br/>Enforces strict token and budget limits"]
        LLM["Foundation Model (Fixed Provider)<br/>Gemini 3.5 / GPT-5.6 / Groq OSS<br/>(Reasons over evidence, selects tools)"]
    end

    %% 3. MCP Tools
    subgraph S3 ["3. Model Context Protocol (MCP) Integration"]
        FS_MCP["Filesystem MCP Server<br/>Tool: read_text_file<br/>(Sandboxed file access)"]
        Law_MCP["KenyaLaw MCP Server<br/>Tools: search_legislation, get_akn_document<br/>(Statutory lookup)"]
        Proc_MCP["Procurement MCP Server<br/>Tools: extract_requirements, check_bid, write_report<br/>(Verification engine)"]
    end

    %% 4. Data Sources
    subgraph S4 ["4. Ground-Truth Data Sources"]
        TenderDocs["Tender and Bid Submissions<br/>(Specifications, supplier bids, tax certs)"]
        KenyanLaw["KenyaLaw.org Repository<br/>(PPADA 2015 and Constitution Art. 227)"]
    end

    %% 5. Review Gate & Report
    subgraph S5 ["5. Sourced Draft and Human Review Gate"]
        Report["Frozen Draft Review Report<br/>Verbatim quotes and line numbers<br/>Cryptographic SHA-256 hashes<br/>No automated tender awards"]
        Gate["Human-in-the-Loop Gate (src/human-review.ts)<br/>Officer enters name and decision note:<br/>Approve Draft / Reject / Request Revision"]
    end

    %% Connections
    Officer -->|"Selects scenario, grants consent"| UI
    UI -->|"Starts review via HTTP"| Runtime
    Runtime <-->|"Prompts and tool calls"| LLM

    Runtime -->|"Read submissions"| FS_MCP
    Runtime -->|"Query procurement law"| Law_MCP
    Runtime -->|"Cross-check claims and compile"| Proc_MCP

    FS_MCP <-->|"Reads line-indexed text"| TenderDocs
    Law_MCP <-->|"Fetches Akoma Ntoso XML"| KenyanLaw

    Proc_MCP -->|"Compiles verified findings"| Report
    Report -->|"Displays draft for inspection"| UI
    UI -->|"Officer records final decision"| Gate
    Gate -->|"Saves immutable signed record"| Report
```

---

## Agent Execution Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Officer as Procurement Officer
    participant UI as React UI (Browser)
    participant Host as Agent Runtime (Node.js)
    participant Model as LLM Provider
    participant MCP as MCP Servers (3 stdio processes)
    participant Store as Local Storage & Gate

    Officer->>UI: Select scenario & model provider
    Officer->>UI: Grant consent to transmit selected text
    UI->>Host: POST /api/run (Start review)

    rect rgb(245, 247, 250)
        note over Host,Model: Phase 1: Planning (Turn 1)
        Host->>Model: Prompt without exposed tools
        Model-->>Host: Emit observable markdown execution plan
        Host->>UI: Stream plan to user
    end

    rect rgb(240, 249, 240)
        note over Host,MCP: Phase 2: Evidence Gathering & Legal Research
        Host->>Model: Present plan + discovered MCP tool declarations
        Model->>Host: call read_text_file (tender & bids)
        Host->>MCP: Dispatch to Filesystem MCP
        MCP-->>Host: Return line-indexed source text
        Host->>Model: Tool observation
        Model->>Host: call search_legislation / get_akn_document
        Host->>MCP: Dispatch to KenyaLaw MCP
        MCP-->>Host: Return PPADA 2015 & Art. 227 statutory text
        Host->>Model: Tool observation
    end

    rect rgb(255, 250, 240)
        note over Host,MCP: Phase 3: Extraction & Cross-Checking
        Model->>Host: call extract_tender_requirements
        Host->>MCP: Dispatch to Procurement MCP
        MCP-->>Host: Validate verbatim quotes and line ranges
        Model->>Host: call check_bid_completeness (per bidder)
        Host->>MCP: Check supplied, missing, or conflicting evidence
        MCP-->>Host: Return structured finding confirmations
    end

    rect rgb(248, 240, 255)
        note over Host,Store: Phase 4: Sourced Drafting & Freeze
        Model->>Host: call write_review_report
        Host->>MCP: Dispatch to Procurement MCP
        MCP->>Host: Verify all requirements checked & substantive law cited
        Host->>Store: Freeze draft report & record SHA-256 hash
        Host->>UI: Stream draft report & findings to officer
    end

    rect rgb(255, 240, 240)
        note over Officer,Store: Phase 5: Human-in-the-Loop Sign-Off
        Officer->>UI: Inspect findings, source lines & legal quotes
        Officer->>UI: Enter reviewer name and decision note
        UI->>Host: POST /api/review (Approve / Reject / Request Revision)
        Host->>Store: Verify unchanged draft hash & save human-review.json
        Host-->>UI: Display completed, signed review record
    end
```

---

## Component Architecture & Responsibilities

### 1. User Interface Layer (`web/`)
- Built with **React 19**, **Vite**, and clean vanilla CSS.
- Connects exclusively to the local loopback backend (`http://127.0.0.1:4317`).
- Renders real-time model execution plans, active tool invocations, classified findings cards (Supplied, Missing, Conflicting, Ambiguous), verbatim legal quotations, and the frozen draft report.
- Provides the human sign-off panel for recording the officer's name, decision, and notes.
- Supports complete offline inspection of past runs without active API keys or network access.

### 2. Runtime & Orchestration Layer (`src/runtime.ts`, `src/review.ts`)
- **Direct Agent Loop**: Executes a sequential turn-by-turn loop with strict parameter bounds:
  - Turn 1: Requests a plain markdown execution roadmap with no tool declarations exposed.
  - Turns 2+: Dynamically exposes tool definitions discovered from connected MCP servers.
- **Budget & Safety Enforcements**: Hard caps on maximum turns (14), maximum tool calls (20), total run duration (120 seconds), and token limits.
- **Error Feedback Loops**: Structured tool validation errors (e.g., mismatched quotation strings, missing findings, or invalid statutory URIs) are fed back to the model context, allowing the agent to self-correct.
- **Fixed Model Invariant**: The provider and model stay fixed during a run. Silent fallbacks are strictly prohibited.

### 3. Model Adapter Layer (`src/models.ts`)
- Wraps official SDKs for each supported provider:
  - **Google Gemini**: `@google/genai` (default reference model: `gemini-3.5-flash-lite`).
  - **OpenAI**: `openai` (reference frontier model: `gpt-5.6-terra`).
  - **Groq Cloud (Open-weights)**: Hosted `openai/gpt-oss-120b` via OpenAI-compatible transport.
  - **Local Loopback**: Any OpenAI-compatible local server (`127.0.0.1` Ollama or LM Studio).
- Requires explicit user consent before transmitting any document text externally.
- Strips credentials from child processes and sanitizes chat history using active context compaction (`src/chat-model.ts`).

### 4. Model Context Protocol (MCP) Layer (`src/mcp.ts`)
Hakiki connects to three independent child processes over `stdio` using official `@modelcontextprotocol/client` and `@modelcontextprotocol/server`:

| MCP Server | Origin / Package | Transport | Tools Exposed | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Procurement** | Custom (`src/procurement-server.ts`) | stdio | `extract_tender_requirements`<br>`check_bid_completeness`<br>`write_review_report` | Validates tender requirements, checks bidder evidence against exact quotes, and writes the review draft. |
| **KenyaLaw** | Pinned public dependency (`kenya-law-mcp`) | stdio | `search_legislation`<br>`get_akn_document` | Retrieves official Kenyan legislative texts in Akoma Ntoso format directly from KenyaLaw.org. |
| **Filesystem** | Official third-party (`@modelcontextprotocol/server-filesystem`) | stdio | `read_text_file` | Sandboxed, read-only file ingestion of tender documents and bids within authorized directories. |

### 5. Integrity & Citation Guard (`src/workspace.ts`, `src/procurement.ts`)
- **Document Hashing**: Every input file is normalized and assigned a unique ID and SHA-256 hash upon ingestion.
- **Exact Quotation Matching**: Tools reject any candidate requirement or evidence check whose quote cannot be verified character-for-character against the source file.
- **Substantive Statutory Clause Guard** (`isSubstantiveLegalReference`): Legal references cited in reports are strictly validated:
  - Rejects markdown headers (`#`, `##`), Akoma Ntoso metadata markers (`AKN URI:`), and bare section titles (`79. Responsiveness of tenders`).
  - Rejects incomplete introductory lead-ins ending in dashes or colons (e.g., `affected by:`).
  - Requires actual, enforceable legislative provisions from PPADA 2015 and Article 227 of the Constitution of Kenya.

### 6. Human-in-the-Loop Gate (`src/human-review.ts`)
- The agent is legally and architecturally barred from awarding contracts, ranking suppliers, or disqualifying bidders.
- Once drafted, the review report is frozen and its SHA-256 hash is stored.
- A human procurement officer must review the documentary findings and record an explicit decision:
  - `Approve`: Confirms the documentary draft for official procurement committee records.
  - `Reject`: Disregards the findings.
  - `Request Revision`: Reopens the draft for amendments.
- Human review decisions are signed with a self-reported reviewer name, timestamp, and audit notes, stored immutably in `human-review.json`.

---

## Security & Confinement Architecture

1. **Loopback Isolation**: The HTTP server binds exclusively to `127.0.0.1` and enforces strict checks on `Host` headers, browser `Origin`, and per-session tokens to prevent cross-site request forgery (CSRF).
2. **Untrusted Data Boundary**: All tender documents, bidder proposals, and MCP tool responses are treated as untrusted text. Prompt injection attempts embedded within supplier bids are flagged and ignored.
3. **No Execution Privileges**: The model is never given shell access, code execution capabilities, or arbitrary filesystem write permissions.
4. **Credential Isolation**: Local API keys (`.env`) reside strictly in the backend process memory and are explicitly stripped before spawning MCP child processes.
5. **Data Sovereignty**: For public sector compliance, Hakiki can run entirely offline using local loopback models (Ollama/LM Studio), ensuring sensitive government bids never leave the officer's workstation.

---

## Verification & Limits

- **Deterministic Test Suite**: 31 automated tests across 7 test suites verify protocol compliance, citation enforcement, runtime limits, and human gate integrity without paid API calls (`bun test`).
- **Live Empirical Evaluations**: Documented in [`EVALS.md`](EVALS.md). 8 live tasks across multiple providers demonstrate correct factual classification, with retained failure records documenting citation-coverage challenges.
- **Advisory Scope**: Hakiki identifies documentary evidence only. External human verification remains mandatory for bidder tax compliance verification (KRA), business registration status (BRS), and physical bid authenticity.
