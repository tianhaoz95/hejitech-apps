import { useMemo, useState } from "react";
import { useEntries } from "../hooks/useEntries";
import { useProperties } from "../hooks/useProperties";
import { ENTRY_CATEGORY_LABELS, isFlagged } from "../lib/entryModel";
import { downloadCsv, entriesToCsv } from "../lib/csv";

export function EntriesPage() {
  const { entries, loading } = useEntries();
  const { properties } = useProperties();
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmed" | "pending_review">("all");

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (propertyFilter !== "all" && e.propertyId !== propertyFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [entries, propertyFilter, statusFilter]);

  if (loading) return <p>Loading…</p>;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", margin: 0, flex: 1 }}>Entries</h1>
        <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)}>
          <option value="all">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_review">Pending review</option>
        </select>
        <button
          className="chart-toggle"
          onClick={() => downloadCsv(`contempo-entries-${Date.now()}.csv`, entriesToCsv(filtered))}
        >
          Export CSV
        </button>
        <button className="chart-toggle" onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>

      <table className="chart-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Property</th>
            <th>Task</th>
            <th>Category</th>
            <th>Status</th>
            <th>Flags</th>
            <th>Hours</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => (
            <tr key={e.id}>
              <td>{e.activityDate.toDate().toLocaleDateString()}</td>
              <td>{e.propertyName}</td>
              <td>{e.task}</td>
              <td>{ENTRY_CATEGORY_LABELS[e.category]}</td>
              <td>{e.status === "confirmed" ? "Confirmed" : "Pending review"}</td>
              <td style={{ color: isFlagged(e) ? "var(--danger)" : "var(--ink-faint)" }}>
                {isFlagged(e) ? e.riskReasons.join(", ") || "Flagged" : "—"}
              </td>
              <td>{(e.durationMinutes / 60).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <p style={{ color: "var(--ink-faint)", marginTop: "1rem" }}>No entries match these filters.</p>
      )}
    </div>
  );
}
