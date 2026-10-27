// Server-rendered and client-refreshed public ETA page (/eta/:token).
import type { EtaStopInfo } from "@headway/core";

export interface EtaPayload {
  name: string | null;
  train: string;
  kind: string;
  to: string;
  to_name: string;
  to_short: string;
  pred_arr: number;
  arr: number;
  delay_min: number | null;
  cancelled: boolean;
  arrived: boolean;
  stops: EtaStopInfo[];
  updated_at: number;
}

const timeStr = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });

const untilStr = (targetMs: number, nowMs: number) => {
  const m = Math.round((targetMs - nowMs) / 60_000);
  if (m <= 0) return "now";
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

export function renderEtaHtml(token: string, data: EtaPayload): string {
  const now = Date.now();
  const rider = data.name ? `${escapeHtml(data.name)}` : "Your rider";
  const title = data.arrived
    ? `${rider} has arrived`
    : `${rider} is on Caltrain ${escapeHtml(data.train)}`;
  const formattedArr = timeStr(data.pred_arr);
  const minutesLeft = Math.max(0, Math.round((data.pred_arr - now) / 60_000));
  const delayText =
    data.delay_min !== null && data.delay_min > 0
      ? `${data.delay_min} min late`
      : data.delay_min !== null && data.delay_min < 0
      ? `${Math.abs(data.delay_min)} min early`
      : "on time";
  const statusColor = (data.delay_min ?? 0) >= 3 ? "color: #ff9f0a;" : "color: #34c759;";

  const stopsHtml = data.stops
    .map((s, idx) => {
      const isLast = idx === data.stops.length - 1;
      const cls = s.status === "done" ? "es past" : s.status === "now" ? "es next" : isLast ? "es dest" : "es";
      return `<div class="${cls}"><i></i><span>${escapeHtml(s.name)}</span><b>${timeStr(s.pred)}</b></div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)} · Headway</title>
  <style>
    :root {
      --bg: #090a0f;
      --cell: #151722;
      --ink: #f2f4f8;
      --sec: #8c92a4;
      --sep: #272a38;
      --acc: #0a84ff;
      --orange: #ff9f0a;
      --green: #34c759;
      --red: #ff453a;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f2f2f7;
        --cell: #ffffff;
        --ink: #000000;
        --sec: #6e6e73;
        --sep: #e5e5ea;
        --acc: #007aff;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--ink);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 48px;
    }
    .wrap {
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 16px;
      color: var(--ink);
    }
    .brand-icon {
      width: 28px;
      height: 28px;
      background: var(--acc);
      color: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
    }
    h1 {
      font-size: 26px;
      letter-spacing: -0.02em;
      margin-top: 8px;
    }
    .big-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-radius: 18px;
      background: var(--cell);
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .big-time {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
    }
    .big-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 15px;
    }
    .big-sub {
      color: var(--sec);
    }
    .stops-card {
      padding: 8px 18px;
      border-radius: 18px;
      background: var(--cell);
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .es {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 0;
      font-size: 15px;
    }
    .es i {
      position: relative;
      z-index: 1;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--sep);
    }
    .es:not(:last-child)::after {
      content: "";
      position: absolute;
      left: 5px;
      top: 28px;
      height: 22px;
      width: 2px;
      background: var(--sep);
    }
    .es.past { color: var(--sec); }
    .es.past i { background: var(--acc); }
    .es.next i {
      background: var(--cell);
      box-shadow: 0 0 0 3.5px var(--acc);
    }
    .es.next span { font-weight: 700; color: var(--ink); }
    .es.dest i { background: var(--ink); }
    .es.dest span { font-weight: 700; }
    .es b {
      margin-left: auto;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: var(--sec);
    }
    .footer-note {
      font-size: 13px;
      color: var(--sec);
      line-height: 1.4;
      text-align: center;
      padding: 8px 12px;
    }
    .live-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      margin-right: 4px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="brand-icon">H</div>
      <span>Headway</span>
    </div>

    <h1 id="title">${escapeHtml(title)}</h1>

    ${
      data.arrived
        ? `<div class="big-card">
             <div class="big-time">✓</div>
             <div class="big-meta">
               <b>Arrived at ${escapeHtml(data.to_name)}</b>
               <span class="big-sub">Reached destination at ${formattedArr}.</span>
             </div>
           </div>`
        : `<div class="big-card">
             <div class="big-time" id="bigTime">${formattedArr}</div>
             <div class="big-meta">
               <span>arrives <b>${escapeHtml(data.to_name)}</b></span>
               <span class="big-sub" id="bigStatus" style="${statusColor}">in ${minutesLeft} min · ${delayText}</span>
             </div>
           </div>
           <div class="stops-card" id="stopsBox">
             ${stopsHtml}
           </div>`
    }

    <div class="footer-note" id="footNote">
      <span class="live-dot"></span> Live Caltrain predictions · Refreshes every 30s · Expires 30 min after arrival
    </div>
  </div>

  <script>
    const token = ${JSON.stringify(token)};
    async function refresh() {
      try {
        const res = await fetch("/api/eta/" + token);
        if (!res.ok) {
          if (res.status === 404) {
            document.getElementById("footNote").textContent = "This live ETA link has ended or expired.";
          }
          return;
        }
        const data = await res.json();
        if (data.arrived) {
          location.reload();
          return;
        }
        const now = Date.now();
        const d = new Date(data.pred_arr);
        const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        const mLeft = Math.max(0, Math.round((data.pred_arr - now) / 60000));
        const late = data.delay_min ? data.delay_min + " min late" : "on time";
        const bigTime = document.getElementById("bigTime");
        const bigStatus = document.getElementById("bigStatus");
        if (bigTime) bigTime.textContent = timeStr;
        if (bigStatus) bigStatus.textContent = "in " + mLeft + " min · " + late;
      } catch (e) {
        console.error(e);
      }
    }
    setInterval(refresh, 30000);
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
