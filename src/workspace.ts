import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { setTimeout } from "node:timers/promises";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";

export const documentSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,60}$/),
    role: z.enum(["tender", "bid"]),
    supplier_id: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,60}$/)
      .nullable(),
    kind: z.enum([
      "tender",
      "registration",
      "tax_certificate",
      "signed_offer",
      "bid_security",
      "cover_letter",
      "other",
    ]),
    file: z.string().min(1).max(160),
  })
  .strict();
export const scenarioSchema = z
  .object({
    title: z.string().min(1).max(200),
    synthetic: z.literal(true),
    provenance: z
      .object({
        type: z.literal("archived_notice"),
        reference: z.string().max(100),
        source_url: z
          .url()
          .max(500)
          .refine((value) => {
            const url = new URL(value);
            return url.protocol === "https:" && !url.username && !url.password;
          }, "Historical source must be an HTTPS URL without credentials"),
        closed_on: z.iso
          .date()
          .refine(
            (value) => value < new Date().toISOString().slice(0, 10),
            "Only past closed notices are supported",
          ),
        retrieved_at: z.iso.datetime({ offset: true }),
        original_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        scope: z.string().max(800),
      })
      .strict()
      .optional(),
    documents: z.array(documentSchema).min(2).max(12),
  })
  .strict();
export type DocumentRecord = z.infer<typeof documentSchema> & {
  sha256: string;
  limitations: string[];
};
export const referenceSchema = z
  .object({
    document_id: z.string().max(80),
    line_start: z.number().int().positive(),
    line_end: z.number().int().positive(),
    quote: z.string().min(1).max(4000),
  })
  .strict();
export type Reference = z.infer<typeof referenceSchema>;
export type Requirement = {
  id: string;
  label: string;
  kind: DocumentRecord["kind"] | null;
  uncertainty: string;
  source: Reference;
};
export type Finding = {
  id: string;
  requirement_id: string;
  supplier_id: string;
  classification: "present" | "missing" | "conflicting" | "inconclusive";
  evidence: Reference[];
  reason: string;
};
export type LegalSource = {
  provision?: string;
  id: string;
  uri: string;
  retrieved_at: string;
  sha256: string;
  file: string;
};
export type RunState = {
  provenance?: z.infer<typeof scenarioSchema>["provenance"];
  id: string;
  title: string;
  synthetic: true;
  documents: DocumentRecord[];
  legal_sources: LegalSource[];
  requirements: Requirement[];
  findings: Finding[];
  status:
    | "collecting"
    | "draft"
    | "approved"
    | "rejected"
    | "revision_requested";
  report: string | null;
  report_sha256: string | null;
  execution: "ready" | "running" | "completed" | "failed" | "cancelled";
  plan: string | null;
  provider: string | null;
  model: string | null;
  inference_endpoint?: string;
  usage: { input_tokens: number; output_tokens: number };
};

export function digest(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export async function containedFile(root: string, path: string) {
  const actualRoot = await realpath(root);
  const actualFile = await realpath(resolve(root, path));
  const inside = relative(actualRoot, actualFile);
  if (
    !inside ||
    inside === ".." ||
    inside.startsWith(`..${sep}`) ||
    isAbsolute(inside)
  ) {
    throw new Error("Path is outside the selected workspace");
  }
  return actualFile;
}

export function normalizeText(text: string) {
  if (text.includes("\0"))
    throw new Error("Binary content is not a text document");
  return text.replace(/\r\n?/g, "\n").normalize("NFC");
}

export async function createWorkspace(
  scenarioPath: string,
  runsRoot: string,
  options: { documentIds?: string[] } = {},
) {
  const sourceRoot = resolve(scenarioPath, "..");
  const scenario = scenarioSchema.parse(
    JSON.parse(await readFile(scenarioPath, "utf8")),
  );
  const ids = scenario.documents.map((document) => document.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Document IDs must be unique");
  if (options.documentIds) {
    if (
      options.documentIds.some((id) => !ids.includes(id)) ||
      new Set(options.documentIds).size !== options.documentIds.length
    )
      throw new Error("Unknown or duplicate document selection");
    scenario.documents = scenario.documents.filter((document) =>
      options.documentIds?.includes(document.id),
    );
  }
  if (!scenario.documents.some((document) => document.role === "tender"))
    throw new Error("A tender is required");
  if (!scenario.documents.some((document) => document.role === "bid"))
    throw new Error("A supplier document is required");
  if (
    scenario.documents.some(
      (document) =>
        (document.role === "bid") !== (document.supplier_id !== null),
    )
  ) {
    throw new Error("Only bid documents must name a supplier ID");
  }
  const root = join(resolve(runsRoot), randomUUID());
  await mkdir(join(root, "inputs"), { recursive: true });
  await mkdir(join(root, "sources"));
  await mkdir(join(root, "output"));
  const documents: DocumentRecord[] = [];
  let totalChars = 0;
  for (const document of scenario.documents) {
    if (isAbsolute(document.file) || basename(document.file) !== document.file)
      throw new Error("Use a selected file name, not a path");
    const source = await containedFile(sourceRoot, document.file);
    if (
      !(await stat(source)).isFile() ||
      (await stat(source)).size > 8 * 1024 * 1024
    )
      throw new Error("Input must be a file no larger than 8 MiB");
    const extension = extname(source).toLowerCase();
    const limitations: string[] = [];
    const text = await (async () => {
      if ([".md", ".txt"].includes(extension))
        return new TextDecoder("utf-8", { fatal: true }).decode(
          await readFile(source),
        );
      if (extension !== ".pdf")
        throw new Error(
          "Only UTF-8 text, Markdown and text-layer PDFs are supported",
        );
      const pdf = await getDocumentProxy(
        new Uint8Array(await readFile(source)),
      );
      try {
        if (pdf.numPages > 20) throw new Error("PDF exceeds the 20-page limit");
        const extracted = await extractText(pdf, { mergePages: false });
        limitations.push(
          "PDF layout, tables and reading order need human inspection; OCR is not provided.",
        );
        const pages = extracted.text as string[];
        if (pages.some((page) => !page.trim()))
          throw new Error(
            "PDF contains blank/unreadable pages; provide a reviewed text transcription",
          );
        return pages
          .map(
            (page, index) => `--- Extracted PDF page ${index + 1} ---\n${page}`,
          )
          .join("\n\n");
      } finally {
        await pdf.loadingTask.destroy();
      }
    })();
    const normalized = normalizeText(text);
    totalChars += normalized.length;
    if (!normalized.trim() || normalized.length > 60000 || totalChars > 180000)
      throw new Error("Extracted text is empty or exceeds the run text limit");
    const file = `${document.id}.txt`;
    await writeFile(join(root, "inputs", file), normalized, { flag: "wx" });
    documents.push({
      ...document,
      file,
      sha256: digest(normalized),
      limitations,
    });
  }
  const state: RunState = {
    id: basename(root),
    title: scenario.title,
    synthetic: true,
    ...(scenario.provenance ? { provenance: scenario.provenance } : {}),
    documents,
    legal_sources: [],
    requirements: [],
    findings: [],
    status: "collecting",
    report: null,
    report_sha256: null,
    execution: "ready",
    plan: null,
    provider: null,
    model: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
  await saveState(root, state);
  return root;
}

export async function loadState(root: string): Promise<RunState> {
  return JSON.parse(await readFile(join(root, "state.json"), "utf8"));
}

export async function saveState(root: string, state: RunState) {
  // Local state is for reproducibility, never authorization for external actions.
  const temporary = join(root, `state-${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(state, null, 2), { flag: "wx" });
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, join(root, "state.json"));
      return;
    } catch (error) {
      // Windows readers can briefly hold the destination open. Retrying this atomic,
      // local-state replacement is safe; paid requests and report writes are never retried.
      if (
        process.platform !== "win32" ||
        attempt >= 4 ||
        !(error instanceof Error) ||
        !("code" in error) ||
        !["EPERM", "EACCES", "EBUSY"].includes(String(error.code))
      )
        throw error;
      await setTimeout(10 * (attempt + 1));
    }
  }
}

export function numbered(text: string) {
  return text
    .split("\n")
    .map((line, index) => `${index + 1}: ${line}`)
    .join("\n");
}

export function isSubstantiveLegalReference(
  quote: string,
  sourceLines: string[],
): boolean {
  const trimmed = quote.trim();
  if (
    trimmed.startsWith("#") ||
    trimmed.startsWith("**") ||
    trimmed.startsWith("---") ||
    trimmed.includes("AKN URI:")
  ) {
    return false;
  }
  if (/[\u2014\u2013\-:]\s*$/.test(trimmed)) {
    return false;
  }
  if (
    /^(?:Part\s+[0-9IVXLCDM]+|Article\s+\d+|\d+\.)\s+[A-Za-z0-9\s,'"-]+$/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  for (const line of sourceLines) {
    const lTrim = line.trim();
    const headingMatch = lTrim.match(/^(?:\d+\.\s*)([A-Za-z0-9\s,'"-]+)$/);
    if (headingMatch) {
      if (trimmed === lTrim || trimmed === headingMatch[1]?.trim()) {
        return false;
      }
    }
    if (
      lTrim.startsWith("#") &&
      (trimmed === lTrim || trimmed === lTrim.replace(/^#+\s*/, "").trim())
    ) {
      return false;
    }
  }
  return true;
}

export async function validateReference(
  root: string,
  state: RunState,
  input: Reference,
  options: { legal?: boolean } = {},
) {
  const ref = referenceSchema.parse(input);
  const document = options.legal
    ? state.legal_sources.find((source) => source.id === ref.document_id)
    : state.documents.find((source) => source.id === ref.document_id);
  if (!document)
    throw new Error(
      options.legal
        ? "Legal reference must name a retrieved law-N source. Tender and bid evidence belongs in its separate evidence fields."
        : "Reference names an unregistered source",
    );
  const text = await readFile(
    await containedFile(
      root,
      join(options.legal ? "sources" : "inputs", document.file),
    ),
    "utf8",
  );
  if (digest(text) !== document.sha256)
    throw new Error("Source changed after registration");
  const lines = text.split("\n");
  if (
    ref.line_end < ref.line_start ||
    ref.line_end > lines.length ||
    ref.line_end - ref.line_start > 20
  )
    throw new Error("Invalid source line range");
  if (
    !lines
      .slice(ref.line_start - 1, ref.line_end)
      .join("\n")
      .includes(ref.quote)
  )
    throw new Error(
      `Quotation does not match ${document.id} lines ${ref.line_start}-${ref.line_end}. Preserve exact whitespace, punctuation and line breaks; use a shorter exact substring if needed.`,
    );
  if (options.legal) {
    const quotedLines = lines.slice(ref.line_start - 1, ref.line_end);
    if (!isSubstantiveLegalReference(ref.quote, quotedLines)) {
      throw new Error(
        `Legal reference must cite substantive statutory provisions; headings, metadata lines and incomplete introductory fragments are not valid legal citations.`,
      );
    }
  }
  return ref;
}

export function escaped(text: string) {
  return text.replace(/[&<>\\`*_[\]#|:@]/g, (character) =>
    character === "&"
      ? "&amp;"
      : character === "<"
        ? "&lt;"
        : character === ">"
          ? "&gt;"
          : `\\${character}`,
  );
}
