import { useMemo } from "react";
import { BarChart } from "../components/charts/BarChart";
import { ThresholdProgress } from "../components/charts/ThresholdProgress";
import { TrendSparkline } from "../components/charts/TrendSparkline";
import { useEntries } from "../hooks/useEntries";
import {
  ENTRY_CATEGORIES,
  ENTRY_CATEGORY_LABELS,
  MATERIAL_PARTICIPATION_TEST,
  isFlagged,
} from "../lib/entryModel";

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function DashboardPage() {
  const { entries, loading } = useEntries();

  const confirmed = useMemo(() => entries.filter((e) => e.status === "confirmed"), [entries]);
  const pendingCount = useMemo(
    () => entries.filter((e) => e.status === "pending_review").length,
    [entries],
  );
  const confirmedHours = useMemo(
    () => confirmed.reduce((sum, e) => sum + e.durationMinutes, 0) / 60,
    [confirmed],
  );

  const hoursByProperty = useMemo(() => {
    const byProperty = new Map<string, number>();
    for (const e of confirmed) {
      byProperty.set(e.propertyName, (byProperty.get(e.propertyName) ?? 0) + e.durationMinutes / 60);
    }
    return [...byProperty.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [confirmed]);

  const hoursByCategory = useMemo(() => {
    const byCategory = new Map(ENTRY_CATEGORIES.map((c) => [c, 0]));
    for (const e of confirmed) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.durationMinutes / 60);
    }
    return ENTRY_CATEGORIES.map((c) => ({ label: ENTRY_CATEGORY_LABELS[c], value: byCategory.get(c) ?? 0 }));
  }, [confirmed]);

  const flaggedTrend = useMemo(() => {
    const buckets = new Map<string, { flagged: number; total: number; sortKey: number }>();
    for (const e of confirmed) {
      const start = weekStart(e.activityDate.toDate());
      const label = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const bucket = buckets.get(label) ?? { flagged: 0, total: 0, sortKey: start.getTime() };
      bucket.total += 1;
      if (isFlagged(e)) bucket.flagged += 1;
      buckets.set(label, bucket);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .slice(-12)
      .map(([label, b]) => ({ label, value: b.total > 0 ? (b.flagged / b.total) * 100 : 0 }));
  }, [confirmed]);

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <h1 style={{ fontSize: "1.5rem" }}>Dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        <ThresholdProgress
          confirmedHours={confirmedHours}
          thresholdHours={MATERIAL_PARTICIPATION_TEST.thresholdHours}
          testName={MATERIAL_PARTICIPATION_TEST.name}
          pendingCount={pendingCount}
        />
        <TrendSparkline title="Flagged entries, by week" points={flaggedTrend} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem" }}>
        <BarChart
          title="Hours by property"
          data={hoursByProperty}
          colors={SERIES_COLORS}
          formatValue={(v) => `${v.toFixed(1)}h`}
        />
        <BarChart
          title="Hours by category"
          data={hoursByCategory}
          colors={SERIES_COLORS}
          formatValue={(v) => `${v.toFixed(1)}h`}
        />
      </div>
    </div>
  );
}
