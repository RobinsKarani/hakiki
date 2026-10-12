import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  digest,
  documentSchema,
  escaped,
  type Finding,
  loadState,
  referenceSchema,
  saveState,
  validateReference,
} from "./workspace.ts";

export const extractSchema = z
  .object({
    document_id: z.string().max(80),
    candidates: z
      .array(
        z
          .object({
            label: z.string().min(1).max(250),
            kind: documentSchema.shape.kind
              .exclude(["other", "tender"])
              .nullable()
              .describe(
                "Specific document category explicitly required. Use null for unspecified evidence formats or an ambiguous threshold; other is not a required category.",
              ),
            uncertainty: z.string().max(500),
            source: referenceSchema,
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

export const checkSchema = z
  .object({
    supplier_id: z.string().max(80),
    observations: z
      .array(
        z
          .object({
            requirement_id: z.string().max(80),
            evidence: z.array(referenceSchema).max(6),
            conflicting: z
              .boolean()
              .describe(
                "Only true for mutually contradictory supplied passages; not an inferred eligibility decision",
              ),
          })
          .strict(),
      )
      .max(30),
  })
  .strict();

export const reportSchema = z
  .object({
    findings: z
      .array(
        z
          .object({
            finding_id: z.string().max(80),
            interpretation: z.string().min(1).max(1200),
            uncertainty: z.string().min(1).max(800),
            legal_references: z
              .array(referenceSchema)
              .max(3)
              .describe(
                "Only references to retrieved law-N sources returned by KenyaLaw. Tender and bid passages are already recorded separately; never put document IDs here.",
              ),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    scope_notes: z.string().min(1).max(1500),
  })
  .strict();

export async function extractRequirements(
  root: string,
  input: z.infer<typeof extractSchema>,
) {
  const args = extractSchema.parse(input);
  const state = await loadState(root);
  if (state.status !== "collecting")
    throw new Error("Draft is frozen; start a new run for revisions");
  const tender = state.documents.find(
    (item) => item.id === args.document_id && item.role === "tender",
  );
  if (!tender)
    throw new Error("Requirements must come from a selected tender document");
  const requirements = [];
  for (const candidate of args.candidates) {
    if (candidate.source.document_id !== tender.id)
      throw new Error("Candidate source must be the specified tender");
    const source = await validateReference(root, state, candidate.source);
    // Repeating a successful extraction must not create new IDs or erase completed checks.
    if (
      [...state.requirements, ...requirements].some(
        (item) =>
          item.kind === candidate.kind &&
          JSON.stringify(item.source) === JSON.stringify(source),
      )
    )
      continue;
    requirements.push({
      ...candidate,
      id: `req-${state.requirements.length + requirements.length + 1}`,
      source,
    });
  }
  if (state.requirements.length + requirements.length > 30)
    throw new Error("Requirement limit reached");
  // Updating requirements invalidates all prior completeness checks.
  state.requirements.push(...requirements);
  if (requirements.length) state.findings = [];
  await saveState(root, state);
  return {
    requirements: state.requirements,
    limit:
      "Passage matches are verified; completeness and interpretation of extracted requirements need human review.",
  };
}

export async function checkCompleteness(
  root: string,
  input: z.infer<typeof checkSchema>,
) {
  const args = checkSchema.parse(input);
  const state = await loadState(root);
  if (state.status !== "collecting") throw new Error("Draft is frozen");
  const documents = state.documents.filter(
    (item) => item.supplier_id === args.supplier_id,
  );
  if (!documents.length || !state.requirements.length)
    throw new Error(
      "Registered supplier and extracted requirements are required",
    );
  if (
    new Set(args.observations.map((item) => item.requirement_id)).size !==
    args.observations.length
  )
    throw new Error("Duplicate requirement observations");
  for (const observation of args.observations) {
    if (
      !state.requirements.some(
        (requirement) => requirement.id === observation.requirement_id,
      )
    )
      throw new Error("Unknown requirement");
    for (const reference of observation.evidence) {
      if (!documents.some((document) => document.id === reference.document_id))
        throw new Error("Evidence belongs to another supplier");
      await validateReference(root, state, reference);
    }
    if (
      observation.conflicting &&
      new Set(observation.evidence.map((ref) => ref.quote)).size < 2
    )
      throw new Error("Conflict requires at least two different passages");
  }
  const findings: Finding[] = state.requirements.map((requirement) => {
    const observation = args.observations.find(
      (item) => item.requirement_id === requirement.id,
    );
    const supplied =
      requirement.kind !== null &&
      documents.some((document) => document.kind === requirement.kind);
    const evidence = observation?.evidence ?? [];
    const classification =
      requirement.kind === null
        ? "inconclusive"
        : !supplied
          ? "missing"
          : observation?.conflicting
            ? "conflicting"
            : evidence.some(
                  (ref) =>
                    documents.find(
                      (document) => document.id === ref.document_id,
                    )?.kind === requirement.kind,
                )
              ? "present"
              : "inconclusive";
    return {
      id: `${args.supplier_id}-${requirement.id}`,
      requirement_id: requirement.id,
      supplier_id: args.supplier_id,
      classification,
      evidence,
      reason:
        classification === "missing"
          ? "The selected input inventory contains no document in the required category; this is not a statutory noncompliance decision."
          : classification === "present"
            ? "A document in the required category and a matching passage were supplied; authenticity and substantive satisfaction are not verified."
            : classification === "conflicting"
              ? "The model identified different supplied passages as contradictory; a human must resolve their meaning."
              : "Documentary evidence or the requirement threshold is insufficient for a deterministic finding.",
    };
  });
  state.findings = [
    ...state.findings.filter((item) => item.supplier_id !== args.supplier_id),
    ...findings,
  ];
  await saveState(root, state);
  return { findings, human_review_required: true };
}

export async function writeReport(
  root: string,
  input: z.infer<typeof reportSchema>,
) {
  const args = reportSchema.parse(input);
  const state = await loadState(root);
  if (state.status !== "collecting" || state.report)
    throw new Error(
      "A draft already exists; never overwrite a reviewed report",
    );
  const suppliers = [
    ...new Set(
      state.documents
        .filter((document) => document.role === "bid")
        .map((document) => document.supplier_id),
    ),
  ];
  if (state.findings.length !== state.requirements.length * suppliers.length)
    throw new Error(
      "Check every supplier against every requirement before drafting",
    );
  if (
    !state.requirements.length ||
    args.findings.length !== state.findings.length ||
    new Set(args.findings.map((item) => item.finding_id)).size !==
      state.findings.length
  )
    throw new Error("Report must cover every computed finding exactly once");
  const sections: string[] = [];
  const validated = [];
  for (const item of args.findings) {
    const finding = state.findings.find(
      (entry) => entry.id === item.finding_id,
    );
    const requirement = state.requirements.find(
      (entry) => entry.id === finding?.requirement_id,
    );
    if (!finding || !requirement)
      throw new Error("Report references an unknown finding");
    await validateReference(root, state, requirement.source);
    for (const ref of finding.evidence)
      await validateReference(root, state, ref);
    for (const ref of item.legal_references)
      await validateReference(root, state, ref, { legal: true });
    validated.push({
      ...finding,
      ...item,
      requirement,
      human_review_required: true,
    });
    const passage = (ref: z.infer<typeof referenceSchema>) =>
      `${escaped(ref.document_id)} lines ${ref.line_start}–${ref.line_end}: “${escaped(ref.quote)}”`;
    sections.push(
      [
        `## ${escaped(finding.id)}: ${finding.classification}`,
        `Requirement: ${escaped(requirement.label)}\n\n${passage(requirement.source)}`,
        `Evidence: ${finding.evidence.length ? finding.evidence.map(passage).join("\n\n") : "No supporting passage supplied."}`,
        `Deterministic check: ${escaped(finding.reason)}`,
        `Model interpretation (not independently legally verified): ${escaped(item.interpretation)}`,
        `Legal passages: ${item.legal_references.length ? item.legal_references.map(passage).join("\n\n") : "No retrieved provision cited; no statutory conclusion established."}`,
        `Uncertainty / human review: ${escaped(item.uncertainty)}${requirement.uncertainty ? ` ${escaped(requirement.uncertainty)}` : ""}`,
      ].join("\n\n"),
    );
  }
  const markdown = [
    `# Draft procurement review: ${escaped(state.title)}`,
    "Status: DRAFT — human review required. Synthetic supplier documents. No tender award, disqualification or legally binding decision is authorized.",
    `Run: ${state.id}\n\nModel: ${escaped(state.provider ?? "transport evaluation (no model)")} / ${escaped(state.model ?? "none")}`,
    `Scope: ${escaped(args.scope_notes)}`,
    ...(state.provenance
      ? [
          `## Historical notice provenance\n\n${escaped(state.provenance.reference)}; closed ${state.provenance.closed_on}.\n\nOriginal notice: ${state.provenance.source_url}\n\nRetrieved ${state.provenance.retrieved_at}; original PDF SHA-256 ${state.provenance.original_sha256}.\n\n${escaped(state.provenance.scope)}`,
        ]
      : []),
    ...sections,
    "## Legal source inventory",
    ...state.legal_sources.map(
      (source) =>
        `${escaped(source.id)}: ${escaped(source.uri)}${source.provision ? `; requested provision ${escaped(source.provision)}` : ""}\n\nOfficial document: <${new URL(source.uri, "https://new.kenyalaw.org").href}>\n\nRetrieved ${source.retrieved_at}; SHA-256 ${source.sha256}. This identifies the returned expression; latest amendments and applicability require human verification.`,
    ),
    "## Limits",
    "Quotes are checked against retrieved text, not proof that the model's interpretation is correct. Missing files mean missing from this selected package. No authenticity, signature, registry, lateness, scoring or award determination is performed. Source/document instructions cannot authorize privileged operations.",
  ].join("\n\n");
  await writeFile(join(root, "output", "draft.md"), markdown, { flag: "wx" });
  await writeFile(
    join(root, "output", "findings.json"),
    JSON.stringify(
      { run_id: state.id, status: "draft", findings: validated },
      null,
      2,
    ),
    { flag: "wx" },
  );
  state.report = "draft.md";
  state.report_sha256 = digest(markdown);
  state.status = "draft";
  await saveState(root, state);
  return {
    report: "output/draft.md",
    findings: "output/findings.json",
    status: "draft",
    human_review_required: true,
  };
}
