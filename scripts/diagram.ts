import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const boxes: {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  lines: string[];
  color?: string;
}[] = [
  {
    x: 40,
    y: 150,
    width: 360,
    height: 220,
    title: "Local browser · React / Vite",
    lines: [
      "Select synthetic documents + provider",
      "Consent to external inference",
      "Plan, actual tool events, findings",
      "Sources, draft download, human review",
    ],
  },
  {
    x: 490,
    y: 150,
    width: 620,
    height: 260,
    title: "Local backend · Node / TypeScript",
    lines: [
      "Agent: model writes a plan and chooses tools",
      "MIT TypeScript loop with execution limits",
      "Official provider SDKs; fixed model per run",
      "Checks source quotes; limits context, tokens and time",
      "Local JSON state and timestamped JSONL logs",
      "Loopback HTTP with origin and session checks",
    ],
  },
  {
    x: 1200,
    y: 150,
    width: 360,
    height: 290,
    title: "Selected model inference",
    lines: [
      "Gemini 3.5 Flash Lite · reference run",
      "OpenAI Terra · completed reference run",
      "Groq GPT-OSS 120B · task incomplete",
      "Hosted inference sends selected text out",
      "Local compatible endpoint: full task untested",
      "Loopback /v1 with a tool-response check",
      "No provider key in browser / MCP",
    ],
    color: "#fff3df",
  },
  {
    x: 490,
    y: 500,
    width: 620,
    height: 115,
    title: "Official MCP client SDK · three connections",
    lines: [
      "Discover schemas → expose only approved tools",
      "Node stdio children; modern / legacy negotiation",
    ],
  },
  {
    x: 40,
    y: 720,
    width: 460,
    height: 240,
    title: "Procurement MCP · built here",
    lines: [
      "extract_tender_requirements",
      "check_bid_completeness",
      "write_review_report",
      "Exact quotes and hashes; fixed report paths",
      "No model-accessible approval or award tool",
    ],
  },
  {
    x: 570,
    y: 720,
    width: 460,
    height: 240,
    title: "KenyaLaw MCP · public upstream",
    lines: [
      "search_legislation",
      "get_akn_document",
      "Pinned public checkout, independent server",
      "Official Kenyan legal discovery + provision text",
      "MCP 2026-07-28 (modern requests)",
    ],
  },
  {
    x: 1100,
    y: 720,
    width: 460,
    height: 240,
    title: "Filesystem MCP · third-party",
    lines: [
      "read_text_file · only exposed file tool",
      "Selected normalized input directory only",
      "Official community implementation",
      "MCP 2025-11-25 (legacy initialization)",
      "Directory filtering is not an OS sandbox",
    ],
  },
  {
    x: 40,
    y: 1060,
    width: 460,
    height: 170,
    title: "Local draft + evidence artifacts",
    lines: [
      "Markdown / JSON findings + legal source inventory",
      "Normalized input + retrieved passages + hashes",
      "Draft frozen to agent; human checks unchanged hash",
    ],
  },
  {
    x: 570,
    y: 1060,
    width: 460,
    height: 170,
    title: "Kenyan legal sources · network",
    lines: [
      "Official KenyaLaw.org",
      "Public Procurement and Asset Disposal Act",
      "Constitution of Kenya · Article 227",
      "Expression + retrieval date; current law needs review",
    ],
    color: "#fff3df",
  },
  {
    x: 1100,
    y: 1060,
    width: 460,
    height: 170,
    title: "Local document sources",
    lines: [
      "Fictional or archived ICTA notice excerpt",
      "Manifest-selected text / Markdown / text-layer PDFs",
      "Synthetic suppliers; no active tender / personal data",
    ],
  },
  {
    x: 40,
    y: 1320,
    width: 460,
    height: 170,
    title: "Human-review gate · backend enforced",
    lines: [
      "Named reviewer + note; unchanged draft hash",
      "Approve draft / reject / request revision",
      "Separate browser / CLI action, unavailable to model",
      "One local decision record; no procurement action",
    ],
    color: "#e6f2e9",
  },
];
const arrow = (path: string) =>
  `<path d="${path}" fill="none" stroke="#60786c" stroke-width="2.5" marker-end="url(#arrow)"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1570" viewBox="0 0 1600 1570"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#60786c"/></marker></defs><rect width="1600" height="1570" fill="#f7f8f3"/><g font-family="Arial, sans-serif" fill="#20362b"><text x="40" y="65" font-size="32" font-weight="bold">Kenya Procurement Review Agent</text><text x="40" y="100" font-size="18">Observed implementation · local draft preparation · 12 October 2026</text>
${arrow("M400 240 L490 240")}${arrow("M490 320 L400 320")}${arrow("M1110 235 L1200 235")}${arrow("M1200 310 L1110 310")}${arrow("M800 410 L800 500")}${arrow("M800 615 L800 720")}${arrow("M630 615 L630 665 L270 665 L270 720")}${arrow("M970 615 L970 665 L1330 665 L1330 720")}${arrow("M270 960 L270 1060")}${arrow("M800 960 L800 1060")}${arrow("M1330 1060 L1330 960")}${arrow("M270 1230 L270 1320")}
${boxes.map((box) => `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="14" fill="${box.color ?? "#ffffff"}" stroke="#c7d6ca" stroke-width="2"/><text x="${box.x + 22}" y="${box.y + 38}" font-size="20" font-weight="bold">${box.title}</text>${box.lines.map((line, index) => `<text x="${box.x + 22}" y="${box.y + 75 + index * 29}" font-size="16">${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text>`).join("")}`).join("")}
<text x="570" y="1370" font-size="18" font-weight="bold">What still needs review</text><text x="570" y="1407" font-size="17">Exact quotes identify source text; meaning and legal applicability need human review.</text><text x="570" y="1444" font-size="17">No scheduling or run resume. The selected model stays fixed throughout a run.</text><text x="570" y="1481" font-size="17">Ask organizers to confirm the MIT runtime and hosted open-weight inference.</text><text x="40" y="1535" font-size="15">Arrows show requests, responses or file access. Selected inference and legal sources use HTTP; all other components run locally.</text></g></svg>`;
await writeFile("docs/architecture.svg", svg);
const browser = await chromium.launch({
  ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1570 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: "docs/architecture.png", fullPage: true });
} finally {
  await browser.close();
}
console.log(
  "Generated docs/architecture.svg and docs/architecture.png; no model or external source called.",
);
