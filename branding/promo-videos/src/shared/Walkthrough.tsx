import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "./Caption";

// Walkthrough pieces for product demo videos (skill heji-demo-video): the real recording in a device
// frame over a generated backdrop, a camera that follows the recorder's event log, a spotlight, touch
// marks, labels, chapter titles and a chapter bar. Generic: no product names; a demo passes its colours.
// Event logs come from the demo's recorder: { t (clip seconds), box: {x,y,w,h} (clip pixels), label, type }.

export type Box = { x: number; y: number; w: number; h: number };
export type Ev = { step: string; t: number; type: string; label: string; box: Box | null };
export type Theme = { accent: string; ink: string; panel: string; dim: string };

const ease = Easing.bezier(0.45, 0, 0.25, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------------------- backdrop

/** A Flow still (slow push and drift) or loop video, darkened so the device stays the brightest thing. */
export const Backdrop: React.FC<{ still?: string; loop?: string; dark?: number; drift?: number }> = ({ still, loop, dark = 0.35, drift = 1 }) => {
  const frame = useCurrentFrame();
  const s = 1.06 + frame * 0.00035 * drift;
  const x = Math.sin(frame / 260) * 14 * drift;
  return (
    <AbsoluteFill style={{ background: "#020a06", overflow: "hidden" }}>
      {loop ? (
        <Video src={loop} muted loop objectFit="cover" style={{ width: "100%", height: "100%", transform: `scale(${s}) translateX(${x}px)` }} />
      ) : still ? (
        <Img src={still} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${s}) translateX(${x}px)` }} />
      ) : null}
      <AbsoluteFill style={{ background: `rgba(2,8,5,${dark})` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------- camera

export type Cam = { z: number; cx: number; cy: number }; // zoom, focus point in clip pixels

/** Camera keyframes from an event log: settle on each target just before it happens, hold, ease back out. */
export function cameraKeys(events: Ev[], clipW: number, clipH: number, opts: { max?: number; lead?: number; hold?: number; frameW?: number; frameH?: number } = {}) {
  const { max = 2, lead = 0.55, hold = 1.4 } = opts;
  const full: Cam = { z: 1, cx: clipW / 2, cy: clipH / 2 };
  const keys: [number, Cam][] = [[-1, full]];
  const target = (b: Box): Cam => {
    const pad = 1.9;
    const z = Math.max(1, Math.min(max, Math.min(clipW / (b.w * pad), clipH / (b.h * pad * 1.4))));
    const half = [clipW / 2 / z, clipH / 2 / z];
    const cx = Math.min(clipW - half[0], Math.max(half[0], b.x + b.w / 2));
    const cy = Math.min(clipH - half[1], Math.max(half[1], b.y + b.h / 2));
    return { z, cx, cy };
  };
  // A wide target (a long field, a whole panel): aim at its left part, where typing and reading start.
  const evs = events.filter((e) => e.box).map((e) => (e.box!.w > clipW * 0.4 ? { ...e, box: { ...e.box!, w: Math.round(clipW * 0.36) } } : e));
  evs.forEach((e, i) => {
    const c = target(e.box!);
    const next = evs[i + 1];
    keys.push([e.t - lead, keys[keys.length - 1][1]]);
    keys.push([e.t - 0.05, c]);
    const end = e.t + hold;
    if (next && next.t - lead - end < 0.9) keys.push([Math.max(e.t, next.t - lead), c]);
    else { keys.push([end, c]); keys.push([end + 0.6, full]); }
  });
  keys.sort((a, b) => a[0] - b[0]);
  return keys;
}
export function camAt(keys: [number, Cam][], t: number): Cam {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const [t0, a] = keys[i];
  const nxt = keys[i + 1];
  if (!nxt) return a;
  const [t1, b] = nxt;
  const p = t1 > t0 ? ease(Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))) : 1;
  return { z: a.z + (b.z - a.z) * p, cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p };
}

// ---------------------------------------------------------------------------- the recording, stepped

/**
 * Plays [a, b] seconds of a clip over `dur` seconds of composition (rate = (b-a)/dur), inside a camera
 * that follows `keys`, with the spotlight, touch marks and labels from `events`. Place it in a Sequence.
 */
export const SteppedClip: React.FC<{
  src: string;
  clipW: number;
  clipH: number;
  a: number;
  b: number;
  dur: number;
  keys: [number, Cam][];
  events: Ev[];
  theme: Theme;
  labels?: boolean;
  spot?: boolean;
  touch?: "cursor" | "tap" | "none";
  /** Boxes (clip pixels) to blur from clip time `from`: tokens, private URLs. */
  redact?: { box: Box; from: number }[];
}> = ({ src, clipW, clipH, a, b, dur, keys, events, theme, labels = true, spot = true, touch = "cursor", redact = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rate = Math.max(0.25, (b - a) / dur);
  const t = a + (frame / fps) * rate;
  const cam = camAt(keys, t);
  const tx = clipW / 2 - cam.cx * cam.z, ty = clipH / 2 - cam.cy * cam.z;
  // The event in focus: within [t-lead, t+hold] of now.
  const on = events.filter((e) => e.box && t >= e.t - 0.25 && t <= e.t + 1.6);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: clipW, height: clipH, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${cam.z})` }}>
        <Video src={src} muted trimBefore={Math.round(a * fps)} playbackRate={rate} style={{ width: clipW, height: clipH, display: "block" }} />
        {redact.filter((r) => t >= r.from).map((r, i) => (
          <div key={`x${i}`} style={{ position: "absolute", left: r.box.x, top: r.box.y, width: r.box.w, height: r.box.h, borderRadius: 10, background: "#101a14", border: `2px dashed ${theme.accent}66`, display: "flex", alignItems: "center", paddingLeft: 24, fontFamily, fontWeight: 600, fontSize: 30, color: theme.dim }}>private link · hidden</div>
        ))}
        {spot && on.slice(-1).map((e) => <Spot key={e.step} box={e.box!} t={t} at={e.t} />)}
        {touch !== "none" && events.filter((e) => e.box && (e.type === "click" || e.type === "select") && t >= e.t - 0.05 && t <= e.t + 0.7).map((e) => (
          <Ripple key={`r${e.step}`} x={e.box!.x + e.box!.w / 2} y={e.box!.y + Math.min(e.box!.h / 2, 27)} p={(t - e.t) / 0.7} color={theme.accent} />
        ))}
        {labels && on.slice(-1).map((e) => <Label key={`l${e.step}`} box={e.box!} text={e.label} p={Math.min(1, (t - e.t + 0.15) / 0.3)} z={cam.z} clipW={clipW} theme={theme} />)}
      </div>
    </div>
  );
};

const Spot: React.FC<{ box: Box; t: number; at: number }> = ({ box, t, at }) => {
  const o = interpolate(t, [at - 0.25, at, at + 1.3, at + 1.6], [0, 1, 1, 0], clamp);
  const pad = 10;
  return (
    <div style={{ position: "absolute", left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2, borderRadius: 14,
      boxShadow: `0 0 0 6000px rgba(0,0,0,${0.5 * o}), 0 0 24px 6px rgba(0,0,0,${0.35 * o})`, pointerEvents: "none" }} />
  );
};

const Ripple: React.FC<{ x: number; y: number; p: number; color: string }> = ({ x, y, p, color }) => {
  const r = 18 + p * 46;
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, border: `4px solid ${color}`, opacity: Math.max(0, 1 - p) * 0.9 }} />;
};

/** A short label beside the target, in the UI's own words; counter-scaled so it reads the same at any zoom. */
const Label: React.FC<{ box: Box; text: string; p: number; z: number; clipW: number; theme: Theme }> = ({ box, text, p, z, clipW, theme }) => {
  if (p <= 0 || !text) return null;
  const right = box.x + box.w + 380 / z < clipW;
  const s = 1 / z;
  const left = right ? box.x + box.w + 18 * s : box.x;
  const top = right ? box.y + box.h / 2 : box.y - 14 * s;
  return (
    <div style={{ position: "absolute", left, top, transformOrigin: right ? "0 50%" : "0 100%",
      transform: `translate(0, ${right ? "-50%" : "-100%"}) scale(${s * (0.85 + 0.15 * p)})`, opacity: p,
      fontFamily, fontWeight: 700, fontSize: 44, color: theme.ink, background: theme.panel, border: `2px solid ${theme.accent}`,
      padding: "8px 18px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}>
      {text}
    </div>
  );
};

// ---------------------------------------------------------------------------- frames

/** A slim dark window around a clip (browser path or terminal title), with a tilt that springs flat. */
export const Window: React.FC<{ width: number; height: number; title?: string; mono?: boolean; tiltFrom?: number; children: React.ReactNode; theme: Theme }> = ({ width, height, title, mono, tiltFrom = 0, children, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - tiltFrom, fps, config: { damping: 22, stiffness: 70 } });
  const rx = 9 * (1 - s), ry = -11 * (1 - s), sc = 0.94 + 0.06 * s;
  const bar = 40;
  return (
    <div style={{ width, height: height + bar, borderRadius: 18, overflow: "hidden", background: "#0b0f0c",
      boxShadow: `0 50px 120px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08), 0 0 60px ${theme.accent}22`,
      transform: `perspective(2400px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${sc})` }}>
      <div style={{ height: bar, background: "#121a15", display: "flex", alignItems: "center", gap: 9, padding: "0 18px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.85 }} />)}
        {title ? <span style={{ marginLeft: 14, fontFamily: mono ? "Menlo, monospace" : fontFamily, fontSize: 18, color: theme.dim }}>{title}</span> : null}
      </div>
      <div style={{ position: "relative", width, height, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

/** A plain dark phone outline (no brand), for a phone-page recording. */
export const Phone: React.FC<{ width: number; height: number; children: React.ReactNode; label?: string; theme: Theme }> = ({ width, height, children, label, theme }) => (
  <div style={{ position: "relative" }}>
    <div style={{ width: width + 28, height: height + 28, borderRadius: 64, background: "#050807", padding: 14, boxShadow: `0 50px 120px rgba(0,0,0,0.6), 0 0 0 2px #26302a` }}>
      <div style={{ position: "relative", width, height, borderRadius: 52, overflow: "hidden", background: "#000" }}>{children}</div>
    </div>
    {label ? <div style={{ position: "absolute", top: -54, left: 0, right: 0, textAlign: "center", fontFamily, fontWeight: 700, fontSize: 26, color: theme.dim }}>{label}</div> : null}
  </div>
);

/** The glasses display: green on black inside a soft rounded frame, floating. */
export const Hud: React.FC<{ width: number; height: number; children: React.ReactNode; theme: Theme }> = ({ width, height, children, theme }) => (
  <div style={{ width: width + 24, height: height + 24, padding: 12, borderRadius: 28, background: "rgba(0,0,0,0.85)", boxShadow: `0 40px 110px rgba(0,0,0,0.6), 0 0 0 1px ${theme.accent}33, 0 0 80px ${theme.accent}1f` }}>
    <div style={{ position: "relative", width, height, borderRadius: 18, overflow: "hidden" }}>{children}</div>
  </div>
);

// ---------------------------------------------------------------------------- titles, bar, badges

export const StepTitle: React.FC<{ n?: string; title: string; goal?: string; theme: Theme }> = ({ n, title, goal, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 120 } });
  const s2 = spring({ frame: frame - 6, fps, config: { damping: 20, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: "0 170px", fontFamily }}>
      {n ? <div style={{ fontSize: 40, fontWeight: 800, color: theme.accent, opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>{n}</div> : null}
      <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, color: theme.ink, lineHeight: 1.02, opacity: s, transform: `translateY(${(1 - s) * 30}px)`, textShadow: "0 6px 40px rgba(0,0,0,0.6)" }}>{title}</div>
      {goal ? <div style={{ marginTop: 22, fontSize: 40, fontWeight: 500, color: theme.ink, opacity: 0.8 * s2, maxWidth: 1300, transform: `translateY(${(1 - s2) * 20}px)`, textShadow: "0 4px 24px rgba(0,0,0,0.7)" }}>{goal}</div> : null}
    </AbsoluteFill>
  );
};

/** The path as a line of stops at the top; `at` is the current stop (fractional while travelling). */
export const ChapterBar: React.FC<{ stops: string[]; at: number; theme: Theme; opacity?: number }> = ({ stops, at, theme, opacity = 1 }) => {
  const w = 1100, gap = w / (stops.length - 1);
  return (
    <div style={{ position: "absolute", top: 34, left: (1920 - w) / 2, width: w, height: 60, opacity, fontFamily }}>
      <div style={{ position: "absolute", top: 11, left: 0, width: w, height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
      <div style={{ position: "absolute", top: 11, left: 0, width: Math.max(0, at) * gap, height: 3, background: theme.accent, borderRadius: 2, boxShadow: `0 0 12px ${theme.accent}` }} />
      {stops.map((s, i) => {
        const lit = at >= i - 0.02;
        const cur = Math.abs(at - i) < 0.5;
        return (
          <div key={s} style={{ position: "absolute", left: i * gap, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: cur ? 25 : 19, height: cur ? 25 : 19, marginTop: cur ? 0 : 3, borderRadius: 13, background: lit ? theme.accent : "#0b130e", border: `3px solid ${lit ? theme.accent : "rgba(255,255,255,0.35)"}`, boxShadow: cur ? `0 0 18px ${theme.accent}` : "none" }} />
            <div style={{ marginTop: 8, fontSize: 22, fontWeight: cur ? 800 : 600, color: cur ? theme.ink : "rgba(255,255,255,0.6)", textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>{s}</div>
          </div>
        );
      })}
    </div>
  );
};

/** A pill badge (speed, clock, "In the Even app"). */
export const Badge: React.FC<{ children: React.ReactNode; theme: Theme; style?: React.CSSProperties }> = ({ children, theme, style }) => (
  <div style={{ position: "absolute", fontFamily, fontWeight: 700, fontSize: 26, color: theme.ink, background: "rgba(5,12,8,0.78)", border: `2px solid ${theme.accent}66`, padding: "8px 18px", borderRadius: 999, ...style }}>{children}</div>
);

/** Plays children for `dur` seconds from `from`, fading in/out over `fade` seconds. */
export const Scene: React.FC<{ from: number; dur: number; fade?: number; children: React.ReactNode; name?: string }> = ({ from, dur, fade = 0.4, children, name }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={Math.round(from * fps)} durationInFrames={Math.round(dur * fps)} name={name}>
      <FadeBox dur={dur} fade={fade}>{children}</FadeBox>
    </Sequence>
  );
};
const FadeBox: React.FC<{ dur: number; fade: number; children: React.ReactNode }> = ({ dur, fade, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const o = fade ? interpolate(t, [0, fade, dur - fade, dur], [0, 1, 1, 0], clamp) : 1;
  const blur = fade ? interpolate(t, [0, fade, dur - fade, dur], [12, 0, 0, 12], clamp) : 0;
  return <AbsoluteFill style={{ opacity: o, filter: blur > 0.2 ? `blur(${blur}px)` : undefined }}>{children}</AbsoluteFill>;
};
