import type { Entry } from "./entryModel";
import { ENTRY_CATEGORY_LABELS } from "./entryModel";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function entriesToCsv(entries: Entry[]): string {
  const header = [
    "Property",
    "Date",
    "Task",
    "Logged for",
    "Category",
    "Duration (hours)",
    "Status",
    "Flagged",
  ];
  const rows = entries.map((e) => [
    e.propertyName,
    e.activityDate.toDate().toLocaleDateString(),
    e.task,
    e.roleId === "" ? "Owner" : e.roleName || "Other",
    ENTRY_CATEGORY_LABELS[e.category],
    (e.durationMinutes / 60).toFixed(2),
    e.status === "confirmed" ? "Confirmed" : "Pending review",
    e.isVague || e.isBackfilled || e.riskReasons.length > 0 ? "Yes" : "No",
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
