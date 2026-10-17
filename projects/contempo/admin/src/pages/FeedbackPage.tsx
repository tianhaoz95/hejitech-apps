import { useEffect, useMemo, useState } from "react";
import {
  listAnonymousFeedback,
  listAppFeedback,
  markAppFeedback,
  type AnonymousFeedback,
  type AppFeedbackReport,
  type FeedbackStatus,
} from "../lib/feedback";
import { buildAnonymousFeedbackPrompt, buildAppFeedbackPrompt, buildCombinedFeedbackPrompt, type FeedbackSelection } from "../lib/prompts";

type Tab = "app" | "anonymous";

const DISMISSED_KEY = "contempo-admin-dismissed-anon-feedback";

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function statusBadgeClass(status: FeedbackStatus): string {
  if (status === "resolved") return "badge-resolved";
  if (status === "triaged") return "badge-triaged";
  return "badge-pending";
}

function PromptModal({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>Prompt for your local coding agent</h2>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "var(--paper)",
            padding: "1rem",
            borderRadius: "var(--radius-md)",
            fontSize: "0.82rem",
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          {prompt}
        </pre>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              void navigator.clipboard.writeText(prompt);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied!" : "Copy prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AppFeedbackCard({ report, onChanged, onPrompt, selected, onToggleSelect }: {
  report: AppFeedbackReport;
  onChanged: () => void;
  onPrompt: (prompt: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function mark(status: "triaged" | "resolved") {
    setBusy(true);
    try {
      await markAppFeedback(report.docPath, status);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card feedback-card">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select report for ${report.screenName}`}
        style={{ marginTop: "0.3rem", width: "1.1rem", height: "1.1rem", flexShrink: 0 }}
      />
      <div className="feedback-card-thumb" style={{ position: "relative" }}>
        {report.screenshotUrl ? (
          <div style={{ position: "relative", width: "100%" }}>
            <img src={report.screenshotUrl} alt="" style={{ width: "100%", borderRadius: "var(--radius-sm)", display: "block" }} />
            {report.region && (
              <div
                style={{
                  position: "absolute",
                  left: `${report.region.x * 100}%`,
                  top: `${report.region.y * 100}%`,
                  width: `${report.region.w * 100}%`,
                  height: `${report.region.h * 100}%`,
                  border: "2px solid var(--danger)",
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        ) : (
          <div
            style={{
              width: "100%",
              aspectRatio: "9/16",
              background: "var(--hairline)",
              borderRadius: "var(--radius-sm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-faint)",
              fontSize: "0.75rem",
            }}
          >
            No screenshot
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
          <span className={`badge ${statusBadgeClass(report.status)}`}>{report.status}</span>
          <strong>{report.screenName}</strong>
          <span style={{ color: "var(--ink-faint)", fontSize: "0.8rem" }}>{report.createdAt.toLocaleString()}</span>
        </div>
        <p style={{ margin: "0 0 0.6rem" }}>{report.description}</p>
        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-faint)" }}>
          v{report.appVersion} ({report.buildNumber}) · {report.deviceModel} · {report.osVersion} · {report.locale}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginTop: "0.75rem" }}>
          <button className="btn-primary" onClick={() => onPrompt(buildAppFeedbackPrompt(report))}>
            Generate prompt
          </button>
          {report.status !== "triaged" && (
            <button className="btn-secondary" disabled={busy} onClick={() => void mark("triaged")}>
              Mark triaged
            </button>
          )}
          {report.status !== "resolved" && (
            <button className="btn-secondary" disabled={busy} onClick={() => void mark("resolved")}>
              Mark resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const [tab, setTab] = useState<Tab>("app");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("pending");
  const [reports, setReports] = useState<AppFeedbackReport[]>([]);
  const [anonymous, setAnonymous] = useState<AnonymousFeedback[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<Set<string>>(new Set());
  const [selectedAnon, setSelectedAnon] = useState<Set<string>>(new Set());

  async function refreshApp() {
    setLoading(true);
    setError(null);
    try {
      setReports(await listAppFeedback(statusFilter));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function refreshAnonymous() {
    setLoading(true);
    setError(null);
    try {
      setAnonymous(await listAnonymousFeedback());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "app") void refreshApp();
    else void refreshAnonymous();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter]);

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
  }

  const visibleAnonymous = useMemo(() => anonymous.filter((a) => !dismissed.has(a.id)), [anonymous, dismissed]);

  function toggleApp(docPath: string) {
    setSelectedApp((prev) => {
      const next = new Set(prev);
      if (next.has(docPath)) next.delete(docPath);
      else next.add(docPath);
      return next;
    });
  }

  function toggleAnon(id: string) {
    setSelectedAnon((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allAppSelected = reports.length > 0 && reports.every((r) => selectedApp.has(r.docPath));
  const allAnonSelected = visibleAnonymous.length > 0 && visibleAnonymous.every((a) => selectedAnon.has(a.id));

  function toggleSelectAllApp() {
    setSelectedApp(allAppSelected ? new Set() : new Set(reports.map((r) => r.docPath)));
  }

  function toggleSelectAllAnon() {
    setSelectedAnon(allAnonSelected ? new Set() : new Set(visibleAnonymous.map((a) => a.id)));
  }

  function clearSelection() {
    setSelectedApp(new Set());
    setSelectedAnon(new Set());
  }

  const selectionCount = selectedApp.size + selectedAnon.size;

  function generateCombinedPrompt() {
    const selection: FeedbackSelection[] = [
      ...reports.filter((r) => selectedApp.has(r.docPath)).map((report) => ({ type: "app" as const, report })),
      ...anonymous.filter((a) => selectedAnon.has(a.id)).map((item) => ({ type: "anonymous" as const, item })),
    ];
    if (selection.length === 0) return;
    setPrompt(buildCombinedFeedbackPrompt(selection));
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Feedback</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          {tab === "app" && (
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
              Status
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}>
                <option value="pending">Pending</option>
                <option value="triaged">Triaged</option>
                <option value="resolved">Resolved</option>
                <option value="all">All</option>
              </select>
            </label>
          )}
          <button className="btn-secondary" onClick={() => (tab === "app" ? void refreshApp() : void refreshAnonymous())}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", marginBottom: "1.25rem", borderBottom: "1px solid var(--hairline)" }}>
        <button
          className="btn-link"
          style={{
            textDecoration: "none",
            paddingBottom: "0.5rem",
            fontWeight: tab === "app" ? 600 : 400,
            borderBottom: tab === "app" ? "2px solid var(--pine)" : "2px solid transparent",
          }}
          onClick={() => setTab("app")}
        >
          In-app reports
        </button>
        <button
          className="btn-link"
          style={{
            textDecoration: "none",
            paddingBottom: "0.5rem",
            fontWeight: tab === "anonymous" ? 600 : 400,
            borderBottom: tab === "anonymous" ? "2px solid var(--pine)" : "2px solid transparent",
          }}
          onClick={() => setTab("anonymous")}
        >
          Anonymous submissions
        </button>
      </div>

      {error && (
        <p className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {selectionCount > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            position: "sticky",
            top: "0.5rem",
            zIndex: 1,
          }}
        >
          <strong>
            {selectionCount} selected ({selectedApp.size} in-app, {selectedAnon.size} anonymous)
          </strong>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn-secondary" onClick={clearSelection}>
              Clear selection
            </button>
            <button className="btn-primary" onClick={generateCombinedPrompt}>
              Generate combined prompt ({selectionCount})
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : tab === "app" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {reports.length === 0 && <p style={{ color: "var(--ink-faint)" }}>No reports.</p>}
          {reports.length > 0 && (
            <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <input type="checkbox" checked={allAppSelected} onChange={toggleSelectAllApp} />
              Select all visible ({reports.length})
            </label>
          )}
          {reports.map((report) => (
            <AppFeedbackCard
              key={report.docPath}
              report={report}
              onChanged={() => void refreshApp()}
              onPrompt={setPrompt}
              selected={selectedApp.has(report.docPath)}
              onToggleSelect={() => toggleApp(report.docPath)}
            />
          ))}
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allAnonSelected} onChange={toggleSelectAllAnon} aria-label="Select all visible" />
                </th>
                <th>Submitted</th>
                <th>Email</th>
                <th>Message</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleAnonymous.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--ink-faint)" }}>
                    Nothing here.
                  </td>
                </tr>
              )}
              {visibleAnonymous.map((item) => (
                <tr key={item.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedAnon.has(item.id)}
                      onChange={() => toggleAnon(item.id)}
                      aria-label={`Select feedback from ${item.email ?? "anonymous"}`}
                    />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{item.createdAt.toLocaleString()}</td>
                  <td>{item.email ?? "—"}</td>
                  <td>{item.message}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-primary" onClick={() => setPrompt(buildAnonymousFeedbackPrompt(item))}>
                      Generate prompt
                    </button>{" "}
                    <button className="btn-secondary" onClick={() => dismiss(item.id)}>
                      Hide
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {prompt && <PromptModal prompt={prompt} onClose={() => setPrompt(null)} />}
    </div>
  );
}
