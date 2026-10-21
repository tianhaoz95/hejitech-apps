import type { RoleHours, TestYearProgress } from "../../lib/metrics";

interface ThresholdProgressProps {
  confirmedHours: number;
  thresholdHours: number;
  testName: string;
  pendingCount: number;
  /** The tax year the hours count and the pace toward the threshold. */
  testProgress: TestYearProgress;
  /** "Me" first, then other roles (see dashboardMetrics); empty hides the comparison. */
  roleBreakdown?: RoleHours[];
}

// Single value vs. a threshold — a stat tile + progress bar, not a
// categorical chart, so it stays in the brand's single accent hue (pine)
// rather than the data-viz categorical set.
export function ThresholdProgress({
  confirmedHours,
  thresholdHours,
  testName,
  pendingCount,
  testProgress,
  roleBreakdown = [],
}: ThresholdProgressProps) {
  const fraction = Math.min(1, Math.max(0, confirmedHours / thresholdHours));
  // Bars compare participants with each other, so they scale to the largest
  // bucket, not to the threshold (same as the apps' "Hours by role").
  const maxRoleHours = Math.max(0.01, ...roleBreakdown.map((r) => r.hours));
  const outworked = roleBreakdown.some((r) => r.id !== "" && r.hours >= confirmedHours);

  return (
    <div className="viz-root chart-card">
      <h3>
        {testName} test progress · {testProgress.year}
      </h3>
      <p style={{ margin: "0 0 0.6rem", fontFamily: "var(--font-serif)", fontSize: "2rem" }}>
        {confirmedHours.toFixed(1)}
        <span style={{ fontSize: "1.1rem", color: "var(--ink-faint)" }}> / {thresholdHours}h</span>
      </p>
      <div className="progress-track" role="progressbar" aria-label="Your confirmed hours" aria-valuenow={Math.round(fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${fraction * 100}%` }} />
      </div>
      <PaceLine progress={testProgress} thresholdHours={thresholdHours} />
      <p style={{ marginTop: "0.35rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
        {pendingCount > 0
          ? `${pendingCount} entr${pendingCount === 1 ? "y" : "ies"} pending review`
          : "No entries pending review"}
      </p>
      {roleBreakdown.length > 0 && (
        <details className="role-breakdown" open={outworked}>
          <summary>
            Hours by role
            {outworked && <span className="role-warning"> · someone else logged as much as you</span>}
          </summary>
          <p className="role-note">
            Only your own hours count above — the IRS tests require your participation to exceed everyone else's.
          </p>
          <ul>
            {roleBreakdown.map((r) => (
              <li key={r.id || "me"}>
                <span className="role-row">
                  <span>{r.name}</span>
                  <span>{r.hours.toFixed(1)} hrs</span>
                </span>
                <span className="role-track">
                  <span
                    className={r.id === "" ? "role-fill me" : "role-fill"}
                    style={{ width: `${Math.max(2, (r.hours / maxRoleHours) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Met, the projected finish date, or the weekly hours that still reach the threshold by Dec 31. */
function PaceLine({ progress, thresholdHours }: { progress: TestYearProgress; thresholdHours: number }) {
  const { pace } = progress;
  const text =
    pace.kind === "met"
      ? `Test met for ${progress.year}`
      : pace.kind === "onPace"
        ? `On pace to reach ${thresholdHours} hrs by ${pace.finish.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : `${pace.weeklyHoursNeeded.toFixed(1)} hrs a week reaches ${thresholdHours} by Dec 31`;
  return (
    <p
      data-testid="dashboard-pace"
      style={{ marginTop: "0.6rem", fontSize: "0.9rem", fontWeight: 600, color: pace.kind === "behind" ? "var(--ink)" : "var(--pine)" }}
    >
      {text}
    </p>
  );
}
