import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RunState } from "../../src/workspace.ts";
import "./style.css";

type Entry = {
  timestamp: string;
  type: string;
  tool?: string;
  server?: string;
  text?: string;
  status?: string;
  [key: string]: unknown;
};
type Snapshot = {
  state: RunState;
  events: Entry[];
  active: boolean;
  error: string | null;
  findings: {
    findings: {
      finding_id: string;
      interpretation: string;
      uncertainty: string;
      legal_references: {
        document_id: string;
        line_start: number;
        line_end: number;
        quote: string;
      }[];
    }[];
  } | null;
  decision: { reviewer: string; note: string; action: string } | null;
};
type Scenario = {
  provenance?: {
    reference: string;
    source_url: string;
    closed_on: string;
    scope: string;
  };
  title: string;
  documents: {
    id: string;
    role: string;
    supplier_id: string | null;
    file: string;
    text: string;
  }[];
};
type Config = {
  token: string;
  choice: { provider: string; model: string };
  openai_configured: boolean;
  gemini_configured: boolean;
  groq_configured: boolean;
  local_base_url: string;
};

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [reviewPackage, setReviewPackage] = useState("synthetic");
  const [selected, setSelected] = useState<string[]>([]);
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-3.5-flash-lite");
  const [consent, setConsent] = useState(false);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434/v1");
  const [probe, setProbe] = useState("");
  const [run, setRun] = useState("");
  const [runs, setRuns] = useState<
    { id: string; status: string; model: string | null }[]
  >([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [report, setReport] = useState("");
  const [source, setSource] = useState<{
    text: string;
    source: { id: string };
  } | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const api = async (path: string, data?: unknown) => {
    const response = await fetch(
      `/api${path}`,
      data === undefined
        ? {}
        : {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Review-Token": config?.token ?? "",
            },
            body: JSON.stringify(data),
          },
    );
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? "Request failed");
    return value;
  };
  useEffect(() => {
    void Promise.all([
      fetch("/api/config").then((response) => response.json()),
      fetch("/api/scenario").then((response) => response.json()),
      fetch("/api/runs").then((response) => response.json()),
    ])
      .then(([settings, fixture, previous]) => {
        setConfig(settings);
        setProvider(settings.choice.provider);
        setModel(settings.choice.model);
        setBaseUrl(settings.choice.baseUrl ?? settings.local_base_url);
        setScenario(fixture);
        setSelected(
          fixture.documents.map((document: { id: string }) => document.id),
        );
        setRuns(previous);
      })
      .catch(() =>
        setError("Local setup could not be loaded. Check the server terminal."),
      );
  }, []);
  useEffect(() => {
    if (!run) return;
    let disposed = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/runs/${run}`);
        if (!response.ok) throw new Error("Run could not be loaded");
        const current: Snapshot = await response.json();
        if (disposed) return;
        setSnapshot(current);
        setRuns((previous) =>
          previous.map((item) =>
            item.id === run
              ? {
                  ...item,
                  status: current.state.status,
                  model: current.state.model,
                }
              : item,
          ),
        );
        if (current.state.report) {
          const text = await fetch(`/api/runs/${run}/report`).then((result) =>
            result.text(),
          );
          if (!disposed) setReport(text);
        }
      } catch (failure) {
        if (!disposed)
          setError(
            failure instanceof Error ? failure.message : "Refresh failed",
          );
      }
    };
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [run]);
  const act = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };
  const showSource = async (id: string) => {
    await act(async () => {
      setSource(await api(`/runs/${run}/source?id=${encodeURIComponent(id)}`));
    });
  };

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">LOCAL WORKSPACE · SYNTHETIC DATA</p>
          <h1>Kenya Procurement Review</h1>
          <p>
            A sourced documentary draft for a procurement officer to review.
          </p>
        </div>
        <span className="badge">No award or eligibility decision</span>
      </header>
      <section className="setup">
        <div>
          <h2>1. Select the review package</h2>
          <label htmlFor="review-package">Review package</label>
          <select
            id="review-package"
            value={reviewPackage}
            disabled={busy || snapshot?.active}
            onChange={(event) => {
              const id = event.target.value;
              void act(async () => {
                const fixture = await api(`/scenario?package=${id}`);
                setScenario(fixture);
                setSelected(
                  fixture.documents.map(
                    (document: { id: string }) => document.id,
                  ),
                );
                setReviewPackage(id);
              });
            }}
          >
            <option value="synthetic">Fictional Amani package (7 files)</option>
            <option value="archived">
              Archived ICT Authority notice + synthetic bids (4 files)
            </option>
          </select>
          <p>{scenario?.title ?? "Loading local scenario…"}</p>
          <p className="muted">
            All supplier records are fictional. Legal provisions are retrieved
            from KenyaLaw during execution.
          </p>
          {scenario?.provenance ? (
            <p className="muted">
              <a
                href={scenario.provenance.source_url}
                target="_blank"
                rel="noreferrer"
              >
                {scenario.provenance.reference}: original public notice
              </a>{" "}
              · Closed {scenario.provenance.closed_on}.{" "}
              {scenario.provenance.scope}
            </p>
          ) : (
            <p className="muted">
              The selected tender is also fictional. No historical data is used
              in this package.
            </p>
          )}
          {scenario?.documents.map((document) => (
            <details key={document.id}>
              <summary>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.includes(document.id)}
                    disabled={busy || snapshot?.active}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...selected, document.id]
                          : selected.filter((id) => id !== document.id),
                      )
                    }
                  />{" "}
                  {document.file}{" "}
                  <span className="muted">
                    {document.supplier_id ?? document.role}
                  </span>
                </label>
              </summary>
              <pre>{document.text}</pre>
            </details>
          ))}
        </div>
        <div>
          <h2>2. Run the agent</h2>
          <label htmlFor="provider">Provider</label>
          <select
            id="provider"
            value={provider}
            disabled={busy || snapshot?.active}
            onChange={(event) => {
              setProvider(event.target.value);
              setProbe("");
              setModel(
                event.target.value === "openai"
                  ? "gpt-5.6-terra"
                  : event.target.value === "groq"
                    ? "openai/gpt-oss-120b"
                    : event.target.value === "local"
                      ? "qwen3:8b"
                      : "gemini-3.5-flash-lite",
              );
            }}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="groq">Groq (open-weight)</option>
            <option value="local">Local compatible endpoint</option>
          </select>
          <label htmlFor="model">Model</label>
          {provider === "local" ? (
            <input
              id="model"
              value={model}
              disabled={busy || snapshot?.active}
              onChange={(event) => {
                setModel(event.target.value);
                setProbe("");
              }}
            />
          ) : (
            <select
              id="model"
              value={model}
              disabled={busy || snapshot?.active}
              onChange={(event) => setModel(event.target.value)}
            >
              {(provider === "openai"
                ? [
                    "gpt-5.6-terra",
                    "gpt-5.6",
                    "gpt-5.6-sol",
                    "gpt-5.5",
                    "gpt-5.4",
                    "gpt-5.4-mini",
                  ]
                : provider === "groq"
                  ? ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
                  : ["gemini-3.5-flash-lite", "gemini-2.5-pro"]
              ).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          )}
          {provider === "local" && (
            <>
              <label htmlFor="endpoint">
                Inference endpoint (HTTP loopback /v1)
              </label>
              <input
                id="endpoint"
                value={baseUrl}
                disabled={busy || snapshot?.active}
                onChange={(event) => {
                  setBaseUrl(event.target.value);
                  setProbe("");
                }}
              />
              <button
                type="button"
                className="secondary"
                disabled={busy || snapshot?.active}
                onClick={() => {
                  void act(async () => {
                    await api("/model-probe", {
                      provider: "local",
                      model,
                      baseUrl,
                    });
                    setProbe(
                      "Tool call and response continuation verified. Procurement accuracy remains unverified.",
                    );
                  });
                }}
              >
                Test local tool calling
              </button>
              <p className="muted">
                {probe ||
                  "No local compatibility probe run for these settings. The server may forward inference elsewhere."}
              </p>
            </>
          )}
          <p className="muted">
            Selected key:{" "}
            {(
              provider === "local"
                ? true
                : provider === "groq"
                  ? config?.groq_configured
                  : provider === "openai"
                    ? config?.openai_configured
                    : config?.gemini_configured
            )
              ? "configured locally"
              : "not configured"}
            . Provider and model stay fixed for this run.
          </p>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />{" "}
            Send selected synthetic document text and retrieved laws to this
            provider or endpoint. Hosted inference incurs API charges.
          </label>
          <div className="actions">
            <button
              type="button"
              disabled={
                !config ||
                !consent ||
                busy ||
                snapshot?.active ||
                selected.length < 2
              }
              onClick={() => {
                void act(async () => {
                  const value = await api("/runs", {
                    provider,
                    model,
                    ...(provider === "local" ? { baseUrl } : {}),
                    consent,
                    document_ids: selected,
                    package: reviewPackage,
                  });
                  setSnapshot(null);
                  setReport("");
                  setSource(null);
                  setRun(value.id);
                  setRuns(await api("/runs"));
                });
              }}
            >
              Start genuine review
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!snapshot?.active || busy}
              onClick={() => {
                void act(async () => {
                  await api(`/runs/${run}/cancel`, {});
                });
              }}
            >
              Cancel run
            </button>
          </div>
          <label htmlFor="previous-run">Inspect a previous actual run</label>
          <select
            id="previous-run"
            value={run}
            onChange={(event) => {
              setRun(event.target.value);
              setSnapshot(null);
              setReport("");
              setSource(null);
            }}
          >
            <option value="">Choose a run</option>
            {runs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id.slice(0, 8)} · {item.model ?? "transport check"} ·{" "}
                {item.status}
              </option>
            ))}
          </select>
          <p className="muted">
            Previous runs are stored records, not a live demonstration. No
            automatic retry or provider fallback.
          </p>
        </div>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {snapshot && (
        <>
          <section>
            <div className="section-title">
              <h2>3. Planning and execution</h2>
              <span className="badge">
                {snapshot.active
                  ? "Running"
                  : (snapshot.state.execution ?? "Legacy run")}{" "}
                · {snapshot.state.status}
              </span>
            </div>
            <p className="muted">
              Run {run} · {snapshot.state.provider}/{snapshot.state.model} ·{" "}
              {snapshot.state.usage.input_tokens} input /{" "}
              {snapshot.state.usage.output_tokens} output tokens
              {snapshot.state.model === "gpt-5.6-terra"
                ? ` · Estimated $${((snapshot.state.usage.input_tokens * 2 + snapshot.state.usage.output_tokens * 12) / 1000000).toFixed(3)} before cache discounts`
                : snapshot.state.model === "gemini-3.5-flash-lite"
                  ? ` · Estimated $${((snapshot.state.usage.input_tokens * 0.3 + snapshot.state.usage.output_tokens * 2.5) / 1000000).toFixed(3)} before cache discounts`
                  : snapshot.state.provider === "groq" &&
                      snapshot.state.model === "openai/gpt-oss-120b"
                    ? ` · Estimated $${((snapshot.state.usage.input_tokens * 0.15 + snapshot.state.usage.output_tokens * 0.6) / 1000000).toFixed(3)} before cache discounts`
                    : ""}
            </p>
            <h3>Agent's recorded plan</h3>
            <p>
              {snapshot.state.plan ?? "No plan has been recorded in this run."}
            </p>
            {snapshot.error && <p className="error">{snapshot.error}</p>}
            {!snapshot.active &&
              ["failed", "cancelled"].includes(snapshot.state.execution) && (
                <p className="error">
                  Execution stopped. Inspect returned errors below. A fresh run
                  is required; this result is not a successful review.
                </p>
              )}
            <div className="timeline">
              {snapshot.events
                .filter((entry) =>
                  [
                    "mcp_connected",
                    "model_turn",
                    "tool_start",
                    "tool_end",
                    "agent_tool_start",
                    "agent_tool_end",
                    "run_end",
                    "human_decision",
                  ].includes(entry.type),
                )
                .map((entry) => (
                  <details
                    key={`${entry.timestamp}-${entry.type}-${String(entry.call_id ?? entry.turn ?? entry.server ?? "")}`}
                  >
                    <summary>
                      <time>
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </time>{" "}
                      {entry.type.replaceAll("_", " ")}{" "}
                      {entry.server && `${entry.server}/`}
                      {entry.tool ?? ""}{" "}
                      {entry.status && (
                        <strong
                          className={
                            entry.status === "error" ||
                            entry.status === "transport_error"
                              ? "error"
                              : ""
                          }
                        >
                          {entry.status}
                        </strong>
                      )}
                    </summary>
                    {entry.text && <p>{entry.text}</p>}
                    <pre>{JSON.stringify(entry, null, 2)}</pre>
                  </details>
                ))}
            </div>
          </section>
          <section>
            <h2>4. Findings and sources</h2>
            <p className="muted">
              “Present” means a matching passage was supplied. It does not
              establish authenticity or substantive compliance. Conflicts and
              interpretation require human review.
            </p>
            <div className="findings">
              {snapshot.state.findings.map((finding) => {
                const detail = snapshot.findings?.findings.find(
                  (item) => item.finding_id === finding.id,
                );
                const requirement = snapshot.state.requirements.find(
                  (item) => item.id === finding.requirement_id,
                );
                return (
                  <article key={finding.id}>
                    <div className="section-title">
                      <h3>
                        {finding.supplier_id} ·{" "}
                        {requirement?.label ?? finding.requirement_id}
                      </h3>
                      <span className={`badge ${finding.classification}`}>
                        {finding.classification}
                      </span>
                    </div>
                    <p>{finding.reason}</p>
                    {requirement && (
                      <blockquote>
                        <button
                          type="button"
                          className="link"
                          onClick={() => {
                            void showSource(requirement.source.document_id);
                          }}
                        >
                          Tender lines {requirement.source.line_start}–
                          {requirement.source.line_end}
                        </button>
                        <p>{requirement.source.quote}</p>
                      </blockquote>
                    )}
                    {finding.evidence.map((reference) => (
                      <blockquote
                        key={`${reference.document_id}-${reference.line_start}-${reference.line_end}-${reference.quote}`}
                      >
                        <button
                          type="button"
                          className="link"
                          onClick={() => {
                            void showSource(reference.document_id);
                          }}
                        >
                          {reference.document_id}, lines {reference.line_start}–
                          {reference.line_end}
                        </button>
                        <p>{reference.quote}</p>
                      </blockquote>
                    ))}
                    {detail && (
                      <>
                        <p>
                          <strong>Model interpretation:</strong>{" "}
                          {detail.interpretation}
                        </p>
                        <p>
                          <strong>Uncertainty:</strong> {detail.uncertainty}
                        </p>
                        {detail.legal_references.map((reference) => (
                          <blockquote
                            key={`${reference.document_id}-${reference.line_start}-${reference.line_end}-${reference.quote}`}
                          >
                            <button
                              type="button"
                              className="link"
                              onClick={() => {
                                void showSource(reference.document_id);
                              }}
                            >
                              Legal source {reference.document_id}, lines{" "}
                              {reference.line_start}–{reference.line_end}
                            </button>
                            <p>{reference.quote}</p>
                          </blockquote>
                        ))}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
            <h3>Retrieved KenyaLaw sources</h3>
            {snapshot.state.legal_sources.map((law) => (
              <p key={law.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    void showSource(law.id);
                  }}
                >
                  {law.id}: {law.uri}
                </button>
                <br />
                <small>
                  Retrieved {law.retrieved_at} · SHA-256 {law.sha256}
                </small>
              </p>
            ))}
            <p className="muted">
              Quotes match stored text; latest amendments and legal
              applicability have not been independently established.
            </p>
            {source && (
              <details open>
                <summary>Source: {source.source.id}</summary>
                <pre>
                  {source.text
                    .split("\n")
                    .map((line, index) => `${index + 1}: ${line}`)
                    .join("\n")}
                </pre>
              </details>
            )}
          </section>
          <section>
            <h2>5. Draft and human review</h2>
            {report ? (
              <>
                <a href={`/api/runs/${run}/report?download=1`}>
                  Download Markdown draft
                </a>
                <details>
                  <summary>Read the complete generated draft</summary>
                  <pre>{report}</pre>
                </details>
                <p>
                  This records review of the draft only. It cannot award,
                  disqualify or transmit a procurement decision.
                </p>
                {snapshot.decision ? (
                  <p>
                    <strong>Recorded: {snapshot.decision.action}</strong> by{" "}
                    {snapshot.decision.reviewer}. {snapshot.decision.note}
                  </p>
                ) : (
                  <>
                    <label>
                      Named reviewer
                      <input
                        value={reviewer}
                        onChange={(event) => setReviewer(event.target.value)}
                      />
                    </label>
                    <label>
                      Review note
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                      />
                    </label>
                    <div className="actions">
                      {["approve", "request_revision", "reject"].map(
                        (action) => (
                          <button
                            type="button"
                            key={action}
                            className={action === "approve" ? "" : "secondary"}
                            disabled={
                              snapshot.active ||
                              busy ||
                              snapshot.state.status !== "draft" ||
                              snapshot.state.execution !== "completed" ||
                              reviewer.trim().length < 2 ||
                              !note.trim()
                            }
                            onClick={() => {
                              void act(async () => {
                                await api(`/runs/${run}/decision`, {
                                  action,
                                  reviewer,
                                  note,
                                });
                              });
                            }}
                          >
                            {action === "approve"
                              ? "Approve this draft"
                              : action.replaceAll("_", " ")}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <p>No draft has been generated in this run.</p>
            )}
          </section>
        </>
      )}
      <footer>
        Local evidence files and traces remain on this computer. Draft-only
        assistance; a qualified human must determine legal consequences.
      </footer>
    </main>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
