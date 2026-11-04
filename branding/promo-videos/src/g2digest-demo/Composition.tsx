import { Audio, Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionBand, DemoLabel, fontFamily, KineticCaption } from "../shared/Caption";
import {
  Backdrop,
  Badge,
  cameraKeys,
  ChapterBar,
  Ev,
  Hud,
  Phone,
  Scene,
  SteppedClip,
  StepTitle,
  Theme,
  Window,
} from "../shared/Walkthrough";
import { LINES } from "./voiceover";
import E_BRIEF from "./events/rec-1-brief.events.json";
import E_AGENTS from "./events/rec-2-agents.events.json";
import E_CONSENT from "./events/rec-2-consent.events.json";
import E_TERM from "./events/rec-2-terminal.events.json";
import E_CONNECTED from "./events/rec-2-connected.events.json";
import E_RUN from "./events/rec-3-agent.events.json";
import E_EDITION from "./events/rec-3-edition.events.json";
import E_PAIR from "./events/rec-4-pair.events.json";
import E_GLASSES_BEFORE from "./events/rec-4-glasses-before.events.json";
import E_RIDE from "./events/rec-5-ride.events.json";
void E_GLASSES_BEFORE;

// G2 Digest walkthrough (reports/2026-11-02-g2digest-demo-video, skill heji-demo-video): the edition's whole
// path — your brief → your agent (a real Claude Code run over MCP) → G2 Digest → web preview, glasses,
// podcast feed. Every product frame is a real recording from the local stack (demo brief and feeds);
// the backdrops and bridges are the owner's Google Flow art. Media: public/g2digest-demo/ (media.md).
// Each step plays its recording continuously from one action to the next at whatever speed fits its
// narration line; the camera, spotlight and labels follow the recorder's event logs.

const FPS = 30;
const m = (f: string) => staticFile(`g2digest-demo/${f}`);
const T: Theme = { accent: "#3dff7a", ink: "#e3f2e6", panel: "rgba(7,20,11,0.92)", dim: "#8fb39a" };
const VOICE = "am_echo";
const PAD = 0.3; // silence after each narration line

type Clip = { clip: string; width: number; height: number; duration?: number; events: Ev[] };
const ev = (c: Clip, step: string) => {
  const e = c.events.find((x) => x.step === step);
  if (!e) throw new Error(`no event ${step} in ${c.clip}`);
  return e.t;
};
const C = {
  brief: E_BRIEF as unknown as Clip,
  agents: E_AGENTS as unknown as Clip,
  consent: E_CONSENT as unknown as Clip,
  term: { ...(E_TERM as unknown as Clip), events: [] as Ev[] },
  connected: { ...(E_CONNECTED as unknown as Clip), events: [] as Ev[] },
  run: { ...(E_RUN as unknown as Clip), events: [] as Ev[] },
  edition: E_EDITION as unknown as Clip,
  pair: E_PAIR as unknown as Clip,
  ride: { ...(E_RIDE as unknown as Clip), duration: 23.8 },
};

// ---------------------------------------------------------------------------------------- the timeline

type Shot =
  | { kind: "web"; c: Clip; a: number; b: number; title: string }
  | { kind: "term"; c: Clip; a: number; b: number; title: string; lapse?: boolean }
  | { kind: "hud"; c: Clip; a: number; b: number; gestures?: boolean }
  | { kind: "pairing"; which: "before" | "after"; a: number; b: number }
  | { kind: "card"; node: () => React.ReactNode };
type Step = { line?: string; dur?: number; shot: Shot };
type Chapter = { id: string; n?: string; title: string; goal?: string; stop: number; still?: string; loop?: string; bridge?: { src: string; from: number; dur: number }; steps: Step[] };

const RUN_TOOLS = (E_RUN as unknown as { tools: { t: number; run_s: number; tool: string }[] }).tools;
const RUN_MARKS = (E_RUN as unknown as { marks: { t: number; run_s: number; name: string }[] }).marks;
const RUN_DUR = (E_RUN as unknown as { duration: number }).duration;
const firstTool = (name: string, after = 0) => RUN_TOOLS.find((x) => x.tool === name && x.t >= after)?.t;
const lastTool = (name: string) => [...RUN_TOOLS].reverse().find((x) => x.tool === name)?.t;

const CHAPTERS: Chapter[] = [
  {
    id: "intro", title: "Intro", stop: -1, steps: [
      { line: "c0-1", shot: { kind: "card", node: () => <Opener /> } },
      { line: "c0-2", shot: { kind: "card", node: () => <FirstCard /> } },
      { line: "c0-3", shot: { kind: "card", node: () => <PathMap /> } },
    ],
  },
  {
    id: "brief", n: "1", title: "Write your brief", goal: "An edition that follows what you care about, ready when you leave.", stop: 0,
    still: "art-B1_Desk_with_lamp_and_tea_11db2d09_2K.jpg", loop: "B1_Lamp_light_flickers_and_steams_feea8276_1080p.mp4",
    steps: [
      { line: "c1-1", shot: { kind: "web", c: C.brief, a: 0.4, b: ev(C.brief, "1.2") - 0.7, title: "/brief/" } },
      { line: "c1-2", shot: { kind: "web", c: C.brief, a: ev(C.brief, "1.2") - 0.7, b: ev(C.brief, "1.3") - 0.7, title: "/brief/" } },
      { line: "c1-3", shot: { kind: "web", c: C.brief, a: ev(C.brief, "1.3") - 0.7, b: ev(C.brief, "1.4") - 0.7, title: "/brief/" } },
      { line: "c1-4", shot: { kind: "web", c: C.brief, a: ev(C.brief, "1.4") - 0.7, b: (C.brief.duration ?? 24) - 0.3, title: "/brief/" } },
    ],
  },
  {
    id: "agent", n: "2", title: "Connect your agent", goal: "Your own agent, allowed to do exactly one job.", stop: 1,
    still: "art-B2_Glowing_green_threads_connecting_931e5e3c_2K.jpg", loop: "B2_Green_lights_traveling_along_threads_007d5b5d_1080p.mp4",
    steps: [
      { line: "c2-1", shot: { kind: "web", c: C.agents, a: 0.3, b: ev(C.agents, "2.4") - 3.2, title: "/agents/" } },
      { line: "c2-2", shot: { kind: "term", c: C.term, a: 0.5, b: 8.4, title: "claude — g2digest-agent" } },
      { line: "c2-3", dur: LINES["c2-3"].dur + 1.4, shot: { kind: "web", c: C.consent, a: 0.3, b: (C.consent.duration ?? 7) - 0.2, title: "/oauth/consent/" } },
      { dur: 1.6, shot: { kind: "term", c: C.connected, a: 0, b: (C.connected.duration ?? 2.4) - 0.1, title: "claude — g2digest-agent" } },
      { line: "c2-4", shot: { kind: "web", c: C.agents, a: ev(C.agents, "2.4") - 1.6, b: (C.agents.duration ?? 12) - 0.3, title: "/agents/" } },
    ],
  },
  {
    id: "build", n: "3", title: "Your agent builds the edition", goal: "What happens while you sleep. A real run, sped up.", stop: 2,
    still: "art-B3_City_skyline_at_night_9a7e0a7e_2K.jpg", loop: "B3_Green_light_trails_flow_viaduct_e19a76be_1080p.mp4",
    bridge: { src: "Shot_6_draft_54e21e40_1080p.mp4", from: 4.4, dur: 1.7 },
    steps: [
      { line: "c3-1", shot: { kind: "term", c: C.run, a: 0, b: (firstTool("get_user_brief") ?? 6) + 2.5, title: "claude — g2digest-agent" } },
      { line: "c3-2", shot: { kind: "term", c: C.run, a: (firstTool("get_user_brief") ?? 6) + 2.5, b: (firstTool("create_audio_upload") ?? RUN_DUR * 0.5) - 6, title: "claude — g2digest-agent", lapse: true } },
      { line: "c3-3", shot: { kind: "term", c: C.run, a: (firstTool("create_audio_upload") ?? RUN_DUR * 0.5) - 6, b: (firstTool("validate_cards") ?? RUN_DUR * 0.8) - 1, title: "claude — g2digest-agent", lapse: true } },
      { line: "c3-4", dur: LINES["c3-4"].dur + 1.8, shot: { kind: "term", c: C.run, a: (firstTool("validate_cards") ?? RUN_DUR * 0.8) - 1, b: (lastTool("publish_cards") ?? RUN_DUR - 4) + 1.5, title: "claude — g2digest-agent", lapse: true } },
      { line: "c3-5", shot: { kind: "web", c: C.edition, a: 0.4, b: (C.edition.duration ?? 8) - 0.3, title: "/preview/" } },
    ],
  },
  {
    id: "pair", n: "4", title: "Pair your glasses", goal: "Once. Then every edition finds its way to you.", stop: 3,
    still: "art-B4_Glasses_and_ring_on_table_a6a39be2_2K.jpg", loop: "B4_Sunlight_moves_across_table_2d7766a9_1080p.mp4",
    bridge: { src: "A2_City_sunrise_timelapse_with_train_9c01ac76_1080p.mp4", from: 1.0, dur: 2.4 },
    steps: [
      { line: "c4-1", shot: { kind: "web", c: C.pair, a: 0.3, b: ev(C.pair, "4.4") - 1.8, title: "/pair/" } },
      { line: "c4-2", shot: { kind: "pairing", which: "before", a: 0, b: 4.6 } },
      { line: "c4-3", shot: { kind: "pairing", which: "after", a: 0.4, b: 5.2 } },
      { line: "c4-4", shot: { kind: "web", c: C.pair, a: ev(C.pair, "4.4") - 1.8, b: (C.pair.duration ?? 9) - 0.2, title: "/pair/" } },
    ],
  },
  {
    id: "ride", n: "5", title: "Read on the ride", goal: "Skim with the ring. Listen for depth. Offline.", stop: 4,
    still: "art-B5_Metro_carriage_in_dark_tunnel_864794db_2K.jpg", loop: "B5_Train_moving_through_tunnel_lights_1c1dc915_1080p.mp4",
    bridge: { src: "Shot_7_draft_b0a34f35_1080p.mp4", from: 0.3, dur: 1.6 },
    steps: [
      { line: "c5-1", shot: { kind: "hud", c: C.ride, a: 0, b: ev(C.ride, "5.2") - 0.5, gestures: true } },
      { line: "c5-2", shot: { kind: "hud", c: C.ride, a: ev(C.ride, "5.2") - 0.5, b: ev(C.ride, "5.3") - 0.5, gestures: true } },
      { line: "c5-3", dur: LINES["c5-3"].dur + 1.8, shot: { kind: "hud", c: C.ride, a: ev(C.ride, "5.3") - 0.5, b: ev(C.ride, "5.4") - 0.6, gestures: true } },
      { line: "c5-4", shot: { kind: "hud", c: C.ride, a: ev(C.ride, "5.4") - 0.6, b: ev(C.ride, "5.4a") + 1.8, gestures: true } },
    ],
  },
  {
    id: "end", title: "Recap", stop: 4.999, steps: [
      { line: "c6-1", dur: 4.6, shot: { kind: "card", node: () => <Recap /> } },
      { line: "c6-2", dur: 5.4, shot: { kind: "card", node: () => <EndCard /> } },
    ],
  },
];

const TITLE = 1.7; // chapter title card
type Placed = Step & { at: number; len: number; ch: Chapter; i: number };
type PlacedChapter = { ch: Chapter; at: number; end: number; body: number; bridgeAt?: number };
function layout() {
  const steps: Placed[] = [];
  const chapters: PlacedChapter[] = [];
  let t = 0;
  for (const ch of CHAPTERS) {
    const start = t;
    let bridgeAt: number | undefined;
    if (ch.bridge) { bridgeAt = t; t += ch.bridge.dur; }
    const chAt = t;
    if (ch.n) t += TITLE;
    const body = t;
    ch.steps.forEach((s, i) => {
      const len = s.dur ?? (s.line ? LINES[s.line].dur + PAD : 2);
      steps.push({ ...s, at: t, len, ch, i });
      t += len;
    });
    chapters.push({ ch, at: chAt, end: t, body, bridgeAt: bridgeAt ?? (start === chAt ? undefined : start) });
  }
  return { steps, chapters, total: t };
}
const L = layout();
export const DURATION = Math.ceil(L.total * FPS) + 6;

// YouTube chapters and the SRT come from here (scripts/g2digest-demo-srt.mjs).
export const CHAPTER_LIST = L.chapters.map((c) => ({ title: c.ch.n ? `${c.ch.n} · ${c.ch.title}` : c.ch.title, start: +(c.bridgeAt ?? c.at).toFixed(2) }));
export const SPEECH = L.steps.filter((s) => s.line).map((s) => ({ id: s.line!, at: +(s.at + 0.12).toFixed(2), words: LINES[s.line!].words }));

export const SPEECH_BY_ID: Record<string, { cues: { at: number; words: [string, number, number][] }[]; end: number }> = {
  "g2digest-demo": { cues: SPEECH, end: L.total },
};

// ---------------------------------------------------------------------------------------- pieces

const DESK_W = 1360, DESK_H = 765;
const RUN_W = 1260, RUN_H = 709; // the agent run sits left, the MCP-call ticker gets the right column

// The run's real elapsed time at a clip time of rec-3-agent (from its marks and tool events).
const RUN_PTS = [...RUN_MARKS.map((x) => [x.t, x.run_s]), ...RUN_TOOLS.map((x) => [x.t, x.run_s])].sort((p, q) => p[0] - q[0]);
const runAt = (ct: number) => {
  let i = 0;
  while (i < RUN_PTS.length - 1 && RUN_PTS[i + 1][0] <= ct) i++;
  const [t0, r0] = RUN_PTS[i];
  const [t1, r1] = RUN_PTS[i + 1] ?? [t0 + 1, r0 + 1];
  return r0 + ((r1 - r0) * (ct - t0)) / Math.max(0.001, t1 - t0);
};
const RUN_START = RUN_MARKS.find((x) => x.name === "run")?.run_s ?? 0;
// Terminal camera: on the top rows while the screen fills, then on the newest output at the bottom.
const TERM_TOP: [number, { z: number; cx: number; cy: number }][] = [[-1, { z: 1, cx: 960, cy: 540 }]];
const TERM_RUN: [number, { z: number; cx: number; cy: number }][] = [[-1, { z: 1.22, cx: 787, cy: 443 }], [13, { z: 1.22, cx: 787, cy: 443 }], [17, { z: 1.22, cx: 787, cy: 637 }]];
const fmt = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

const WebShot: React.FC<{ s: Extract<Shot, { kind: "web" | "term" }>; len: number; tilt: boolean }> = ({ s, len, tilt }) => {
  const isRun = s.c === C.run;
  const k = (isRun ? RUN_W : DESK_W) / s.c.width;
  const keys = s.kind === "term" ? (isRun ? TERM_RUN : TERM_TOP) : cameraKeys(s.c.events, s.c.width, s.c.height, { max: 1.9 });
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (s.b - s.a) / len);
  const t = s.a + (frame / FPS) * rate;
  const eff = isRun ? (runAt(t + 0.5 * rate) - runAt(t)) / 0.5 : rate; // real seconds per second of video
  const redact = s.c === C.pair ? s.c.events.filter((e) => e.step === "4.4a" && e.box).map((e) => ({ box: { ...e.box!, y: e.box!.y - 6, h: e.box!.h + 12 }, from: e.t - 0.4 })) : [];
  return (
    <AbsoluteFill style={{ alignItems: isRun ? "flex-start" : "center", justifyContent: "flex-start", paddingTop: isRun ? 150 : 118, paddingLeft: isRun ? 60 : 0 }}>
      <Window width={isRun ? RUN_W : DESK_W} height={isRun ? RUN_H : DESK_H} title={s.title} mono={s.kind === "term"} theme={T} tiltFrom={tilt ? 0 : -60}>
        <div style={{ position: "absolute", left: 0, top: 0, width: s.c.width, height: s.c.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <SteppedClip src={m(s.c.clip)} clipW={s.c.width} clipH={s.c.height} a={s.a} b={s.b} dur={len} keys={keys} events={s.c.events} theme={T} touch={s.kind === "term" ? "none" : "cursor"} redact={redact} />
        </div>
      </Window>
      {s.kind === "web" ? <DemoLabel /> : null}
      {isRun ? <Badge theme={T} style={{ top: 34, right: 44 }}>{eff > 1.5 ? `⏩ ${Math.round(eff)}× · ` : ""}real time {fmt(runAt(t) - RUN_START)}</Badge> : null}
      {s.kind === "web" && rate > 1.6 ? <Badge theme={T} style={{ top: 92, right: 44 }}>⏩ {rate.toFixed(1)}×</Badge> : null}
      {isRun ? <ToolTicker t={t} /> : null}
    </AbsoluteFill>
  );
};

/** The MCP calls the terminal collapses ("Called g2digest 6 times"), named as they happen, with the validator's verdicts. */
type Tool = { t: number; tool: string; ok?: boolean; codes?: string[] };
const TOOLS = (RUN_TOOLS as Tool[]).filter((x) => !["Bash", "ToolSearch", "Read", "Write", "Edit"].includes(x.tool));
const ToolTicker: React.FC<{ t: number; style?: React.CSSProperties; size?: number }> = ({ t, style, size = 22 }) => {
  const seen = TOOLS.filter((x) => x.t <= t);
  // Collapse repeats (six uploads → "create_audio_upload ×6").
  const rows: { tool: string; n: number; ok?: boolean; codes?: string[]; t: number }[] = [];
  for (const x of seen) {
    const last = rows[rows.length - 1];
    if (last && last.tool === x.tool && x.ok === undefined && last.ok === undefined) { last.n++; last.t = x.t; } else rows.push({ tool: x.tool, n: 1, ok: x.ok, codes: x.codes, t: x.t });
  }
  const show = rows.slice(-5);
  return (
    <div style={{ position: "absolute", right: 40, top: 160, width: 520, display: "flex", flexDirection: "column", gap: 10, fontFamily, ...style }}>
      <div style={{ fontSize: size, fontWeight: 700, color: T.dim, textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>G2 Digest MCP calls</div>
      {show.map((r, i) => {
        const age = t - r.t;
        const p = Math.min(1, age / 0.25);
        const verdict = r.ok === undefined ? "" : r.ok ? " ✓" : ` ✗ ${r.codes?.[0] === "error" ? "server error" : (r.codes?.[0] ?? "")}`;
        return (
          <div key={`${r.tool}-${i}-${r.t}`} style={{ opacity: 0.35 + 0.65 * p, transform: `translateX(${(1 - p) * 30}px)`, background: "rgba(5,12,8,0.86)", border: `2px solid ${r.ok === false ? "#ff6b6b" : T.accent}${i === show.length - 1 ? "" : "55"}`, borderRadius: 14, padding: "10px 16px", fontFamily: "Menlo, monospace", fontSize: size, color: r.ok === false ? "#ffb3b3" : T.ink }}>
            {r.tool}{r.n > 1 ? ` ×${r.n}` : ""}<span style={{ color: r.ok === false ? "#ff6b6b" : T.accent, fontWeight: 700 }}>{verdict}</span>
          </div>
        );
      })}
    </div>
  );
};

const HUD_W = 1240;
const GESTURE: Record<string, string> = { up: "Swipe up", click: "Tap", long_press: "Tap, then hold", double_click: "Double tap" };
const HudShot: React.FC<{ s: Extract<Shot, { kind: "hud" }>; len: number; at: number }> = ({ s, len, at }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (s.b - s.a) / len);
  const t = s.a + (frame / FPS) * rate;
  const k = HUD_W / s.c.width;
  const g = s.c.events.filter((e) => GESTURE[e.type] && t >= e.t - 0.15 && t <= e.t + 1.4).slice(-1)[0];
  // The edition's own audio under the glance and the deep dive, at 1× from the moment it starts on screen.
  const toComp = (ct: number) => (ct - s.a) / rate;
  const glance = s.c.events.find((e) => e.step === "5.3"), hold = s.c.events.find((e) => e.step === "5.3a"), stop = s.c.events.find((e) => e.step === "5.4");
  const vol = (f: number, from: number) => (talking(at + from + f / FPS) ? 0.16 : 0.75);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 170 }}>
      <Hud width={HUD_W} height={s.c.height * k} theme={T}>
        <div style={{ width: s.c.width, height: s.c.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(s.c.clip)} muted trimBefore={Math.round(s.a * FPS)} playbackRate={rate} style={{ width: s.c.width, height: s.c.height }} />
        </div>
      </Hud>
      {s.gestures && g ? <RingGesture label={GESTURE[g.type]} p={(t - g.t) / 1.4} kind={g.type} /> : null}
      {glance && hold && glance.t >= s.a && glance.t < s.b ? (
        <Sequence from={Math.round(toComp(glance.t) * FPS)} durationInFrames={Math.max(1, Math.round((toComp(hold.t) - toComp(glance.t)) * FPS))} layout="none">
          <Audio src={m("edition-reef-glance.mp3")} volume={(f) => vol(f, toComp(glance.t))} />
        </Sequence>
      ) : null}
      {hold && stop && hold.t >= s.a && hold.t < s.b ? (
        <Sequence from={Math.round(toComp(hold.t + 0.3) * FPS)} durationInFrames={Math.max(1, Math.round((toComp(Math.min(stop.t, s.b)) - toComp(hold.t + 0.3)) * FPS))} layout="none">
          <Audio src={m("edition-reef-deep-dive.mp3")} volume={(f) => vol(f, toComp(hold.t + 0.3))} />
        </Sequence>
      ) : null}
      <SimLabel text="Glasses · Even Hub simulator" />
      <DemoLabel />
    </AbsoluteFill>
  );
};
const SimLabel: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => (
  <div style={{ position: "absolute", top: 118, left: 0, right: 0, textAlign: "center", fontFamily, fontWeight: 600, fontSize: 24, color: T.dim, textShadow: "0 2px 10px rgba(0,0,0,0.9)", ...style }}>{text}</div>
);

/** The R1 ring and what the thumb did, beside the glasses. */
const RingGesture: React.FC<{ label: string; p: number; kind: string }> = ({ label, p, kind }) => {
  const o = interpolate(p, [0, 0.1, 0.85, 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dy = kind === "up" ? -26 * Math.min(1, p * 3) : 0;
  const pulse = kind === "long_press" ? 1 + 0.08 * Math.sin(p * 20) : kind === "double_click" || kind === "click" ? 1 + 0.15 * Math.max(0, 1 - p * 4) : 1;
  return (
    <div style={{ position: "absolute", bottom: 200, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, opacity: o, fontFamily }}>
      <div style={{ width: 74, height: 74, borderRadius: 37, border: `9px solid #1a1f1c`, boxShadow: `0 0 0 3px ${T.accent}, 0 0 26px ${T.accent}88`, transform: `translateY(${dy}px) scale(${pulse})`, background: "rgba(0,0,0,0.4)" }} />
      <div style={{ fontSize: 40, fontWeight: 800, color: T.ink, textShadow: "0 3px 18px rgba(0,0,0,0.8)" }}>{label}</div>
    </div>
  );
};

/** Chapter 4: the phone page and the glasses in the Even Hub simulator, side by side and in sync; before or after pairing. */
const GW = 1728, GH = 864;
const PairingShot: React.FC<{ s: Extract<Shot, { kind: "pairing" }>; len: number }> = ({ s, len }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (s.b - s.a) / len);
  const t = s.a + (frame / FPS) * rate;
  const hw = 1000, k = hw / GW;
  const pw = 470, ph = Math.round((pw * 1382) / 1080);
  const zp = s.which === "before" ? 1.3 : 1; // before pairing: the form, larger
  const base = s.which === "before" ? "rec-4-glasses-before" : "rec-4-glasses";
  const lab = spring({ frame: frame - 12, fps: FPS, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 80, paddingTop: 60 }}>
      <div style={{ position: "relative" }}>
        <Phone width={pw} height={ph} theme={T} label="Phone · Even Hub simulator">
          <Video src={m(`${base}-phone.mp4`)} muted trimBefore={Math.round(s.a * FPS)} playbackRate={rate} style={{ width: pw * zp, height: ph * zp, transformOrigin: "0 0" }} />
          {s.which === "before" ? (
            <div style={{ position: "absolute", left: 24, top: Math.round(ph * 0.235 * zp) + 70, opacity: lab, transform: `scale(${0.85 + 0.15 * lab})`, transformOrigin: "0 0", fontFamily, fontWeight: 700, fontSize: 28, color: T.ink, background: T.panel, border: `2px solid ${T.accent}`, padding: "8px 16px", borderRadius: 999, whiteSpace: "nowrap", boxShadow: "0 8px 30px rgba(0,0,0,0.6)" }}>↑ type the code from Pair</div>
          ) : null}
        </Phone>
      </div>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: -54, left: 0, right: 0, textAlign: "center", fontFamily, fontWeight: 700, fontSize: 26, color: T.dim }}>Glasses · {s.which === "before" ? "the tour" : "paired"}</div>
        <Hud width={hw} height={GH * k} theme={T}>
          <div style={{ width: GW, height: GH, transform: `scale(${k})`, transformOrigin: "0 0" }}>
            <Video src={m(`${base}.mp4`)} muted trimBefore={Math.round(s.a * FPS)} playbackRate={rate} style={{ width: GW, height: GH }} />
          </div>
        </Hud>
      </div>
      <DemoLabel />
      <span style={{ display: "none" }}>{t}</span>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- intro + end

const Opener: React.FC = () => (
  <AbsoluteFill>
    <Video src={m("A1_Glasses_and_ring_on_windowsill_0bbc10b6_1080p.mp4")} muted trimBefore={8} objectFit="cover" style={{ width: "100%", height: "100%" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0) 40%)" }} />
  </AbsoluteFill>
);

const FirstCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 90 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("art-B5_Metro_carriage_in_dark_tunnel_864794db_2K.jpg")} dark={0.55} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 90 }}>
        <div style={{ transform: `scale(${0.9 + 0.1 * s})`, opacity: s }}>
          <Hud width={1240} height={620} theme={T}>
            <Img src={m("still-5-ride-card.png")} style={{ width: 1240, height: 620 }} />
          </Hud>
        </div>
      </AbsoluteFill>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const STOPS = ["Brief", "Agent", "Build", "Pair", "Ride"];
const PATH_SUB = ["you write it", "any MCP agent", "checked, published", "via the Even app", "glasses · podcast · web"];
const PathMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // The stops light up with the narration: "You write the brief. Your own agent builds the edition. G2 Digest checks it, and delivers it."
  const lit = [0.2, 1.4, 3.0, 4.6, 5.4];
  return (
    <AbsoluteFill>
      <Backdrop still={m("art-B2_Glowing_green_threads_connecting_931e5e3c_2K.jpg")} dark={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 120, fontFamily }}>
        <div style={{ position: "relative", width: 1500, height: 260 }}>
          <div style={{ position: "absolute", top: 58, left: 75, width: 1350, height: 6, background: "rgba(255,255,255,0.15)", borderRadius: 3 }} />
          <div style={{ position: "absolute", top: 58, left: 75, width: 1350 * interpolate(t, [0.2, 5.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), height: 6, background: T.accent, borderRadius: 3, boxShadow: `0 0 18px ${T.accent}` }} />
          {STOPS.map((name, i) => {
            const p = spring({ frame: frame - lit[i] * fps, fps, config: { damping: 16, stiffness: 140 } });
            return (
              <div key={name} style={{ position: "absolute", left: 75 + i * 337.5, top: 0, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", width: 300 }}>
                <div style={{ width: 120, height: 120, borderRadius: 60, background: p > 0.5 ? T.accent : "#0b130e", border: `5px solid ${p > 0.5 ? T.accent : "rgba(255,255,255,0.3)"}`, transform: `scale(${0.75 + 0.25 * p})`, boxShadow: p > 0.5 ? `0 0 40px ${T.accent}aa` : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, fontWeight: 800, color: p > 0.5 ? "#04140a" : T.dim }}>{i + 1}</div>
                <div style={{ marginTop: 22, fontSize: 46, fontWeight: 800, color: T.ink, opacity: 0.35 + 0.65 * p }}>{name}</div>
                <div style={{ marginTop: 6, fontSize: 26, fontWeight: 500, color: T.dim, opacity: p }}>{PATH_SUB[i]}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const RECAP = ["still-recap-1.jpg", "still-recap-2.jpg", "still-recap-3.jpg", "still-recap-4.jpg", "still-recap-5.jpg"];
const Recap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Backdrop still={m("art-B4_Glasses_and_ring_on_table_a6a39be2_2K.jpg")} dark={0.6} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 26, paddingBottom: 140, fontFamily }}>
        {RECAP.map((f, i) => {
          const p = spring({ frame: frame - i * 0.45 * fps, fps, config: { damping: 18, stiffness: 120 } });
          return (
            <div key={f} style={{ width: 330, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: T.accent, marginBottom: 10 }}>{i + 1} · {STOPS[i]}</div>
              <Img src={m(f)} style={{ width: 330, height: 186, objectFit: "cover", borderRadius: 14, border: `2px solid ${T.accent}55`, boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("art-A3_Train_waiting_at_metro_platform_53d19a0d_2K.jpg")} dark={0.25} drift={0.6} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(2,10,6,0.88) 0%, rgba(2,10,6,0.6) 50%, rgba(2,10,6,0) 75%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", fontFamily, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <Img src={m("icon.png")} style={{ width: 130, height: 130, borderRadius: 30 }} />
          <div style={{ fontSize: 110, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>G2 Digest</div>
        </div>
        <div style={{ marginTop: 24, fontSize: 54, fontWeight: 700, color: T.accent }}>Your brief, ready before the train.</div>
        <div style={{ marginTop: 34, fontSize: 32, fontWeight: 600, color: T.ink }}>g2digest.hejitech.workers.dev</div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 500, color: T.dim }}>For Even G2 glasses + R1 ring · works with any MCP agent</div>
        <div style={{ position: "absolute", bottom: 46, left: 150, fontSize: 20, color: "rgba(227,242,230,0.6)" }}>Demo data. Backdrops and scenes are AI-generated; the narration is a synthetic voice. Claude Code is shown as one example of an MCP agent.</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- music

// 107.7 BPM track (172.27 s): its soft intro opens the video, then it splices on a bar line into the
// section that runs to the track's own ending, so the video ends on it. Ducked under the narration.
const BEAT = 0.5573, BEAT0 = 21.18, TRACK = 172.27;
const bar = (t: number) => BEAT0 + Math.round((t - BEAT0) / (BEAT * 4)) * BEAT * 4;
const SPLICE_V = bar(40); // video time of the splice
const SPLICE_B = bar(TRACK - (L.total + 0.8 - SPLICE_V)); // where part B starts in the track
const talking = (t: number) => SPEECH.some((s) => t >= s.at - 0.15 && t <= s.at + LINES[s.id].dur + 0.25);
const Music: React.FC = () => {
  const { fps } = useVideoConfig();
  const vol = (f: number, base: number) => {
    const t = f / fps;
    return (talking(t) ? 0.24 : 0.5) * base;
  };
  const xf = 0.6;
  return (
    <>
      <Sequence durationInFrames={Math.round((SPLICE_V + xf) * fps)} name="Music A">
        <Audio src={m("music-172s-take1-first-light-walkthrough.mp3")} volume={(f) => vol(f, interpolate(f / fps, [SPLICE_V, SPLICE_V + xf], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))} />
      </Sequence>
      <Sequence from={Math.round(SPLICE_V * fps)} name="Music B">
        <Audio src={m("music-172s-take1-first-light-walkthrough.mp3")} trimBefore={Math.round(SPLICE_B * fps)} volume={(f) => vol(f + SPLICE_V * fps, interpolate(f / fps, [0, xf], [0, 1], { extrapolateRight: "clamp" }))} />
      </Sequence>
    </>
  );
};


// ---------------------------------------------------------------------------------------- the short (9:16)

// From your agent to your glasses in ~27 s: the real run (time-lapsed, the MCP calls named), the publish,
// night to morning, the ring on the glasses, the end card. Lines s-1…s-6 (scripts/g2digest-demo-vo.py).
const pub = lastTool("publish_cards") ?? RUN_DUR - 6;
const SHORT: { line: string; extra?: number; part: "card" | "run" | "publish" | "bridge" | "ride" | "end"; a?: number; b?: number }[] = [
  { line: "s-1", part: "card" },
  { line: "s-2", extra: 0.4, part: "run", a: (firstTool("get_user_brief") ?? 6) - 1, b: pub - 3 },
  { line: "s-3", extra: 0.6, part: "publish", a: pub - 3, b: pub + 1.2 },
  { line: "s-4", extra: 0.3, part: "bridge" },
  { line: "s-5", extra: 0.8, part: "ride", a: ev(C.ride, "5.2c") - 0.6, b: ev(C.ride, "5.3a") + 3.5 },
  { line: "s-6", extra: 1.2, part: "end" },
];
const SL = (() => {
  let t = 0;
  return SHORT.map((x) => { const len = LINES[x.line].dur + PAD + (x.extra ?? 0); const r = { ...x, at: t, len }; t += len; return r; });
})();
const SHORT_TOTAL = SL[SL.length - 1].at + SL[SL.length - 1].len;
export const SHORT_DURATION = Math.ceil(SHORT_TOTAL * FPS) + 6;
SPEECH_BY_ID["g2digest-demo-short"] = { cues: SL.map((x) => ({ at: +(x.at + 0.12).toFixed(2), words: LINES[x.line].words })), end: SHORT_TOTAL };

const ShortRun: React.FC<{ a: number; b: number; len: number }> = ({ a, b, len }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (b - a) / len);
  const t = a + (frame / FPS) * rate;
  const w = 1000, k = w / 1920, h = 1080 * k;
  const eff = (runAt(t + 0.5 * rate) - runAt(t)) / 0.5;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 230 }}>
      <Window width={w} height={h} title="claude — g2digest-agent" mono theme={T}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(C.run.clip)} muted trimBefore={Math.round(a * FPS)} playbackRate={rate} style={{ width: 1920, height: 1080 }} />
        </div>
      </Window>
      <Badge theme={T} style={{ top: 140, left: 40 }}>{eff > 1.5 ? `⏩ ${Math.round(eff)}× · ` : ""}real time {fmt(runAt(t) - RUN_START)}</Badge>
      <ToolTicker t={t} size={34} style={{ left: 70, right: "auto", top: 820, width: 940, gap: 14 }} />
    </AbsoluteFill>
  );
};

const ShortRide: React.FC<{ a: number; b: number; len: number; at: number }> = ({ a, b, len, at }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (b - a) / len);
  const t = a + (frame / FPS) * rate;
  const w = 1000, k = w / C.ride.width;
  const g = C.ride.events.filter((e) => GESTURE[e.type] && t >= e.t - 0.15 && t <= e.t + 1.4).slice(-1)[0];
  const hold = C.ride.events.find((e) => e.step === "5.3a")!;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 520 }}>
      <Hud width={w} height={C.ride.height * k} theme={T}>
        <div style={{ width: C.ride.width, height: C.ride.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(C.ride.clip)} muted trimBefore={Math.round(a * FPS)} playbackRate={rate} style={{ width: C.ride.width, height: C.ride.height }} />
        </div>
      </Hud>
      {g ? <div style={{ position: "absolute", top: 1110, left: 0, right: 0, height: 200 }}><RingGesture label={GESTURE[g.type]} p={(t - g.t) / 1.4} kind={g.type} /></div> : null}
      <Sequence from={Math.round(((hold.t + 0.3 - a) / rate) * FPS)} layout="none">
        <Audio src={m("edition-reef-deep-dive.mp3")} volume={(f) => (talkingShort(at + (hold.t + 0.3 - a) / rate + f / FPS) ? 0.16 : 0.75)} />
      </Sequence>
      <SimLabel text="Glasses · Even Hub simulator" style={{ top: 440 }} />
    </AbsoluteFill>
  );
};
const talkingShort = (t: number) => SL.some((x) => t >= x.at && t <= x.at + 0.12 + LINES[x.line].dur + 0.2);

const ShortEnd: React.FC = () => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: FPS, config: { damping: 20, stiffness: 80 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("art-A3_Train_waiting_at_metro_platform_53d19a0d_2K.jpg")} dark={0.45} drift={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 420, fontFamily, opacity: s, transform: `translateY(${(1 - s) * 30}px)`, textAlign: "center" }}>
        <Img src={m("icon.png")} style={{ width: 170, height: 170, borderRadius: 38 }} />
        <div style={{ marginTop: 26, fontSize: 110, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>G2 Digest</div>
        <div style={{ marginTop: 16, fontSize: 52, fontWeight: 700, color: T.accent, lineHeight: 1.15, padding: "0 60px" }}>Your brief, ready before the train.</div>
        <div style={{ marginTop: 30, fontSize: 34, fontWeight: 600, color: T.ink }}>g2digest.hejitech.workers.dev</div>
        <div style={{ marginTop: 10, fontSize: 28, color: T.dim }}>Even G2 + R1 · any MCP agent</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 140, left: 60, right: 60, textAlign: "center", fontFamily, fontSize: 22, color: "rgba(227,242,230,0.6)" }}>Demo data. Backdrops are AI-generated; synthetic narration. Claude Code shown as one MCP agent.</div>
    </AbsoluteFill>
  );
};

const Short: React.FC = () => (
  <AbsoluteFill style={{ background: "#020a06" }}>
    <Scene from={0} dur={SHORT_TOTAL - SL[SL.length - 1].len + 0.4} fade={0}>
      <Backdrop still={m("art-B3_City_skyline_at_night_9a7e0a7e_2K.jpg")} loop={m("B3_Green_light_trails_flow_viaduct_e19a76be_1080p.mp4")} dark={0.45} />
    </Scene>
    {SL.map((x) => (
      <Scene key={x.line} from={x.at} dur={x.len + 0.3} fade={0.3}>
        {x.part === "card" ? (
          <AbsoluteFill style={{ alignItems: "center", paddingTop: 300, fontFamily }}>
            <div style={{ fontSize: 76, fontWeight: 800, color: T.ink, textAlign: "center", lineHeight: 1.08, padding: "0 70px", textShadow: "0 6px 30px rgba(0,0,0,0.7)" }}>Built overnight by <span style={{ color: T.accent }}>your own agent</span></div>
            <div style={{ marginTop: 90 }}><Hud width={1000} height={500} theme={T}><Img src={m("still-5-ride-card.png")} style={{ width: 1000, height: 500 }} /></Hud></div>
          </AbsoluteFill>
        ) : null}
        {x.part === "run" || x.part === "publish" ? <ShortRun a={x.a!} b={x.b!} len={x.len} /> : null}
        {x.part === "bridge" ? <Video src={m("A2_City_sunrise_timelapse_with_train_9c01ac76_1080p.mp4")} muted trimBefore={30} objectFit="cover" style={{ width: "100%", height: "100%" }} /> : null}
        {x.part === "ride" ? (
          <>
            <Backdrop still={m("art-B5_Metro_carriage_in_dark_tunnel_864794db_2K.jpg")} loop={m("B5_Train_moving_through_tunnel_lights_1c1dc915_1080p.mp4")} dark={0.4} />
            <ShortRide a={x.a!} b={x.b!} len={x.len} at={x.at} />
          </>
        ) : null}
        {x.part === "end" ? <ShortEnd /> : null}
        {x.part !== "bridge" && x.part !== "end" ? <DemoLabel /> : null}
      </Scene>
    ))}
    <CaptionBand />
    {SL.map((x, i) => (
      <React.Fragment key={`vo-${x.line}`}>
        <Sequence from={Math.round((x.at + 0.12) * FPS)}><Audio src={m(`vo-${VOICE}-${x.line}.wav`)} /></Sequence>
        {x.part !== "end" ? <KineticCaption words={LINES[x.line].words} offset={x.at + 0.12} before={SL[i + 1] ? SL[i + 1].at + 0.12 : undefined} /> : null}
      </React.Fragment>
    ))}
    <Audio src={m("music-172s-take1-first-light-walkthrough.mp3")} trimBefore={Math.round((TRACK - SHORT_TOTAL - 0.5) * FPS)} volume={(f) => (talkingShort(f / FPS) ? 0.24 : 0.5) * Math.min(1, f / 8)} />
  </AbsoluteFill>
);


// ---------------------------------------------------------------------------------------- thumbnails

/** YouTube thumbnails: a real glasses card and the real agent run over the night backdrop, ≤ 4 words. */
const Thumb: React.FC = () => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Backdrop still={m("art-B3_City_skyline_at_night_9a7e0a7e_2K.jpg")} dark={0.35} drift={0} />
      <div style={{ position: "absolute", left: v ? 60 : 70, top: v ? 160 : 60, fontSize: v ? 120 : 92, fontWeight: 800, lineHeight: 0.98, letterSpacing: -3, color: T.ink, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
        Agent <span style={{ color: T.accent }}>→</span><br />glasses
      </div>
      <div style={{ position: "absolute", left: v ? 40 : 600, top: v ? 520 : 70, transform: `rotate(-3deg)` }}>
        <Window width={v ? 760 : 620} height={v ? 428 : 349} title="claude — agent" mono theme={T}>
          <Img src={m("still-recap-3.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "0 0" }} />
        </Window>
      </div>
      <div style={{ position: "absolute", left: v ? 160 : 520, top: v ? 1080 : 330, transform: "rotate(2deg)" }}>
        <Hud width={v ? 860 : 700} height={v ? 430 : 350} theme={T}>
          <Img src={m("still-5-ride-card.png")} style={{ width: "100%", height: "100%" }} />
        </Hud>
      </div>
      <div style={{ position: "absolute", left: v ? 60 : 70, bottom: v ? 160 : 60, display: "flex", alignItems: "center", gap: 18 }}>
        <Img src={m("icon.png")} style={{ width: v ? 96 : 72, height: v ? 96 : 72, borderRadius: 18 }} />
        <span style={{ fontSize: v ? 54 : 42, fontWeight: 800, color: T.ink }}>G2 Digest</span>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- the video

const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cur = L.chapters.filter((c) => c.ch.stop >= 0 && t >= c.at).slice(-1)[0];
  const prevStop = cur ? (L.chapters[L.chapters.indexOf(cur) - 1]?.ch.stop ?? 0) : 0;
  const at = cur ? interpolate(t, [cur.at, cur.at + 1], [Math.max(0, prevStop), cur.ch.stop], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const barOn = cur && cur.ch.id !== "end" ? interpolate(t, [L.chapters[1].at - 0.2, L.chapters[1].at + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: "#020a06" }}>
      {L.chapters.map(({ ch, at: chAt, end, body, bridgeAt }) => (
        <React.Fragment key={ch.id}>
          {ch.bridge && bridgeAt !== undefined ? (
            <Scene from={bridgeAt} dur={ch.bridge.dur + 0.4} name={`${ch.id}: bridge`}>
              <Video src={m(ch.bridge.src)} muted trimBefore={Math.round(ch.bridge.from * FPS)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
            </Scene>
          ) : null}
          {ch.still || ch.loop ? (
            <Scene from={chAt} dur={end - chAt + 0.4} name={`${ch.id}: backdrop`}>
              <Backdrop still={m(ch.still!)} loop={ch.loop ? m(ch.loop) : undefined} dark={0.3} />
            </Scene>
          ) : null}
          {ch.n ? (
            <Scene from={chAt} dur={body - chAt + 0.3} name={`${ch.id}: title`}>
              <StepTitle n={`${ch.n}`} title={ch.title} goal={ch.goal} theme={T} />
            </Scene>
          ) : null}
        </React.Fragment>
      ))}
      {L.steps.map((s) => {
        const prev = L.steps[L.steps.indexOf(s) - 1];
        const sameClip = prev && prev.ch === s.ch && "c" in prev.shot && "c" in s.shot && prev.shot.c === s.shot.c;
        const fade = sameClip ? 0 : 0.35;
        const sh = s.shot;
        return (
          <Scene key={`${s.ch.id}-${s.i}`} from={s.at} dur={s.len + (sameClip ? 0 : 0.3)} fade={fade} name={`${s.ch.id} ${s.i}: ${s.line ?? ""}`}>
            {sh.kind === "web" || sh.kind === "term" ? <WebShot s={sh} len={s.len} tilt={!sameClip} /> : null}
            {sh.kind === "hud" ? <HudShot s={sh} len={s.len} at={s.at} /> : null}
            {sh.kind === "pairing" ? <PairingShot s={sh} len={s.len} /> : null}
            {sh.kind === "card" ? sh.node() : null}
          </Scene>
        );
      })}
      <ChapterBar stops={STOPS} at={at} theme={T} opacity={barOn} />
      <CaptionBand />
      {SPEECH.map((s, i) => (
        <React.Fragment key={s.id}>
          <Sequence from={Math.round(s.at * FPS)} name={`VO ${s.id}`}>
            <Audio src={m(`vo-${VOICE}-${s.id}.wav`)} volume={1} />
          </Sequence>
          <KineticCaption words={s.words} offset={s.at} before={SPEECH[i + 1]?.at} />
        </React.Fragment>
      ))}
      <Music />
    </AbsoluteFill>
  );
};

export const G2digestDemo: React.FC = () => (
  <>
    <Composition id="g2digest-demo" component={Walkthrough} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="g2digest-demo-short" component={Short} durationInFrames={SHORT_DURATION} fps={FPS} width={1080} height={1920} />
    <Composition id="g2digest-demo-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
    <Composition id="g2digest-demo-short-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
