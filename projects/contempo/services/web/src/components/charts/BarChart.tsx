import { useState } from "react";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  data: BarDatum[];
  colors: string[]; // one per datum, positional, fixed order — never cycled
  formatValue?: (value: number) => string;
}

const defaultFormat = (v: number) => v.toFixed(1);

// Horizontal bar chart: direct value labels on every bar (the relief channel
// the dataviz skill requires for the categorical slots that sit under 3:1
// contrast on a light surface), plus a table-view toggle so the same data is
// always available without color at all.
export function BarChart({ title, data, colors, formatValue = defaultFormat }: BarChartProps) {
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="viz-root chart-card">
      <h3>
        {title}
        <button className="chart-toggle" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "View as chart" : "View as table"}
        </button>
      </h3>

      {asTable ? (
        <table className="chart-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        data.map((d, i) => (
          <div className="bar-row" key={d.label} title={`${d.label}: ${formatValue(d.value)}`}>
            <span className="bar-label">{d.label}</span>
            <span className="bar-track">
              <span
                className="bar-fill"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: colors[i % colors.length],
                }}
              />
            </span>
            <span className="bar-value">{formatValue(d.value)}</span>
          </div>
        ))
      )}
    </div>
  );
}
