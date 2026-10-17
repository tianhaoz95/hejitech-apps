interface ThresholdProgressProps {
  confirmedHours: number;
  thresholdHours: number;
  testName: string;
  pendingCount: number;
}

// Single value vs. a threshold — a stat tile + progress bar, not a
// categorical chart, so it stays in the brand's single accent hue (pine)
// rather than the data-viz categorical set.
export function ThresholdProgress({
  confirmedHours,
  thresholdHours,
  testName,
  pendingCount,
}: ThresholdProgressProps) {
  const fraction = Math.min(1, Math.max(0, confirmedHours / thresholdHours));

  return (
    <div className="viz-root chart-card">
      <h3>{testName} test progress</h3>
      <p style={{ margin: "0 0 0.6rem", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
        {confirmedHours.toFixed(1)}
        <span style={{ fontSize: "1.1rem", color: "var(--ink-faint)" }}> / {thresholdHours}h</span>
      </p>
      <div className="progress-track" role="progressbar" aria-valuenow={Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <p style={{ marginTop: "0.6rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
        {pendingCount > 0
          ? `${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} pending review`
          : "No entries pending review"}
      </p>
    </div>
  );
}
