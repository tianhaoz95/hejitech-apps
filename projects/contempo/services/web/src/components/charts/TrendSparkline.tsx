export interface TrendPoint {
  label: string;
  value: number;
}

interface TrendSparklineProps {
  title: string;
  points: TrendPoint[];
  formatValue?: (value: number) => string;
}

const defaultFormat = (v: number) => `${v.toFixed(0)}%`;

// A single series (one line, one hue) needs no categorical palette or
// legend box — the title names it. Uses the brand accent (pine), not the
// data-viz categorical set, same reasoning as ThresholdProgress.
export function TrendSparkline({ title, points, formatValue = defaultFormat }: TrendSparklineProps) {
  const width = 480;
  const height = 60;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: points.length > 1 ? i * stepX : width / 2,
    y: height - (p.value / max) * (height - 8) - 4,
    ...p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  return (
    <div className="viz-root chart-card">
      <h3>{title}</h3>
      {points.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>Not enough data yet.</p>
      ) : (
        <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <line x1={0} y1={height - 4} x2={width} y2={height - 4} stroke="var(--hairline)" strokeWidth={1} />
          <path d={path} fill="none" stroke="var(--pine)" strokeWidth={2} />
          {coords.map((c) => (
            <circle key={c.label} cx={c.x} cy={c.y} r={4} fill="var(--pine)">
              <title>{`${c.label}: ${formatValue(c.value)}`}</title>
            </circle>
          ))}
        </svg>
      )}
    </div>
  );
}
