import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBand, DemoLabel, fontFamily, KineticCaption } from "../shared/Caption";
import {
  Backdrop,
  Badge,
  Box,
  cameraKeys,
  ChapterBar,
  Ev,
  GESTURE,
  Hud,
  MusicBed,
  PhoneStage,
  RingGesture,
  Scene,
  SideNote,
  SteppedClip,
  StepTitle,
  Theme,
  Track,
  Window,
} from "../shared/Walkthrough";
import { LINES } from "./voiceover";
import E_CONNECT from "./events/rec-1-connect.events.json";
import E_TERMINAL from "./events/rec-1-terminal.events.json";
import E_CONSENT from "./events/rec-1-consent.events.json";
import E_CONNECTED from "./events/rec-1-connected.events.json";
import E_AGENT1 from "./events/rec-1-agent.events.json";
import E_TODAY from "./events/rec-1-today.events.json";
import E_WORKOUT from "./events/rec-2-workout.events.json";
import E_PAIR from "./events/rec-3-pair.events.json";
import E_GLASSES from "./events/rec-3-glasses.events.json";
import E_MEAL from "./events/rec-4-meal.events.json";
import E_AGENT2 from "./events/rec-4-agent.events.json";
import E_REPLY from "./events/rec-4-reply.events.json";
import E_NEXT from "./events/rec-4-next.events.json";

// FitLoop walkthrough (reports/2026-11-02-fitloop-demo-video, skill heji-demo-video): your own agent writes
// the plan over MCP, you train with it on your phone and on Even G2 glasses + R1, a note from the gym goes
// back to the agent, and it changes the plan. Every product frame is a real recording from the local stack
// (scripts/fitloop-demo-record.mjs): two real Claude Code runs, the iPhone app driven on the simulator, the
// plugin in the Even Hub simulator. Backdrops and bridges are the owner's Google Flow art; the music is the
// owner's Flow Music take from the promo, fitted on bar lines. Media: public/fitloop-demo/ (media.md).

const FPS = 30;
const m = (f: string) => staticFile(`fitloop-demo/${f}`);
const T: Theme = { accent: "#ff7a45", ink: "#f5f7fa", panel: "rgba(18,16,32,0.94)", dim: "#b3aecb" };
const G: Theme = { accent: "#3dff7a", ink: "#e3f2e6", panel: "rgba(7,20,11,0.92)", dim: "#8fb39a" };
const VOICE = "af_sarah";
const PAD = 0.28;

type Clip = { clip: string; width: number; height: number; duration: number; events: Ev[] };
const C = (x: unknown) => x as Clip;
const CL = {
  connect: C(E_CONNECT), terminal: C(E_TERMINAL), consent: C(E_CONSENT), connected: C(E_CONNECTED), agent1: C(E_AGENT1),
  today: C(E_TODAY), workout: C(E_WORKOUT), pair: C(E_PAIR), glasses: C(E_GLASSES), meal: C(E_MEAL), agent2: C(E_AGENT2), reply: C(E_REPLY), next: C(E_NEXT),
};
const ev = (c: Clip, step: string) => {
  const e = c.events.find((x) => x.step === step);
  if (!e) throw new Error(`no event ${step} in ${c.clip}`);
  return e.t;
};
type RunMeta = { tools: { t: number; tool: string }[]; marks: { t: number; name: string; run_s: number }[] };
const R1 = E_AGENT1 as unknown as RunMeta, R2 = E_AGENT2 as unknown as RunMeta;
const mark = (r: RunMeta, n: string) => r.marks.find((x) => x.name === n)?.t;

// The account banner at the top of Claude Code (plan name, notices) is covered until it scrolls away.
const COVER1 = { box: { x: 0, y: 0, w: 1920, h: 345 }, from: 0, text: "Claude Code · any MCP agent works the same way" };
const COVER1T = { ...COVER1, box: { ...COVER1.box, h: 410 } }; // the first screen: a longer notice
const COVER2 = { box: { x: 0, y: 0, w: 1920, h: 280 }, from: 0, text: "Claude Code · a new session, later that day" };

// ---------------------------------------------------------------------------------------- the timeline

type Shot =
  | { kind: "web"; c: Clip; a: number; b: number; title: string }
  | { kind: "term"; c: Clip; a: number; b: number; title: string; run?: RunMeta; cover?: { box: Box; from: number; until?: number; text?: string }; fit?: boolean }
  | { kind: "phone"; c: Clip; a: number; b: number; kicker: string }
  | { kind: "hud"; c: Clip; a: number; b: number }
  | { kind: "card"; node: () => React.ReactNode };
type Step = { line?: string; extra?: number; dur?: number; shot: Shot };
type Chapter = { id: string; n?: string; title: string; goal?: string; stop: number; still?: string; loop?: string; bridge?: { src: string; from: number; dur: number }; steps: Step[] };

const A1_PROMPT_END = (mark(R1, "run") ?? 5.4) + 0.4;
const CHAPTERS: Chapter[] = [
  {
    id: "intro", title: "Intro", stop: -1, steps: [
      { line: "c0-1", extra: 0.3, shot: { kind: "card", node: () => <Opener /> } },
      { line: "c0-2", extra: 0.4, shot: { kind: "card", node: () => <Surfaces /> } },
    ],
  },
  {
    id: "agent", n: "1", title: "Your agent writes the plan", goal: "Any MCP agent. FitLoop says exactly what it may do.", stop: 0,
    still: "Minimalist_modern_desk_setup_fac639df_2K.jpg", loop: "Espresso_cup_on_modern_desk_b9287a95_1080p.mp4",
    steps: [
      { line: "c1-1", extra: 0.4, shot: { kind: "web", c: CL.connect, a: 0.2, b: CL.connect.duration - 0.2, title: "FitLoop · Settings" } },
      { line: "c1-2", extra: 0.8, shot: { kind: "term", c: CL.terminal, a: 2.4, b: CL.terminal.duration - 0.2, title: "claude — my-agent", cover: COVER1T } },
      { line: "c1-3", extra: 0.6, shot: { kind: "web", c: CL.consent, a: 0.3, b: CL.consent.duration - 0.1, title: "FitLoop · Connect an agent" } },
      { dur: 1.5, shot: { kind: "term", c: CL.connected, a: 0, b: CL.connected.duration - 0.1, title: "claude — my-agent", cover: COVER1T } },
      { line: "c1-4", shot: { kind: "term", c: CL.agent1, a: 0.1, b: A1_PROMPT_END, title: "claude — my-agent", cover: { ...COVER1, until: 27 } } },
      { line: "c1-5", extra: 2.2, shot: { kind: "term", c: CL.agent1, a: A1_PROMPT_END, b: CL.agent1.duration - 0.1, title: "claude — my-agent", run: R1, cover: { ...COVER1, until: 27 }, fit: true } },
      { line: "c1-6", extra: 0.6, shot: { kind: "phone", c: CL.today, a: 0.1, b: CL.today.duration - 0.1, kicker: "On your phone" } },
    ],
  },
  {
    id: "phone", n: "2", title: "Train with your phone", goal: "One set at a time. The rest timer runs itself.", stop: 1,
    still: "Adjustable_leather_workout_bench…_71ffa9b3_2K.jpg", loop: "Workout_bench_in_quiet_gym_49b56c2a_1080p.mp4",
    steps: [
      { line: "c2-1", extra: 0.3, shot: { kind: "phone", c: CL.workout, a: 0.1, b: ev(CL.workout, "2.2") - 0.6, kicker: "Today" } },
      { line: "c2-2", extra: 0.3, shot: { kind: "phone", c: CL.workout, a: ev(CL.workout, "2.2") - 0.6, b: ev(CL.workout, "2.3") - 0.7, kicker: "The workout" } },
      { line: "c2-3", extra: 0.8, shot: { kind: "phone", c: CL.workout, a: ev(CL.workout, "2.3") - 0.7, b: CL.workout.duration - 0.1, kicker: "The workout" } },
    ],
  },
  {
    id: "glasses", n: "3", title: "Hands-free on your glasses", goal: "Even G2 + R1 ring: the set, the rest, a note to your agent.", stop: 2,
    still: "Chalked_hands_gripping_pull_up_14681e3e_2K.jpg", loop: "Chalked_hands_gripping_pull_up_a1b0e94e_1080p.mp4",
    steps: [
      { line: "c3-1", extra: 0.3, shot: { kind: "phone", c: CL.pair, a: 0.1, b: CL.pair.duration - 0.1, kicker: "Settings" } },
      { line: "c3-2", shot: { kind: "hud", c: CL.glasses, a: 0, b: ev(CL.glasses, "Set done") - 0.5 } },
      { line: "c3-3", shot: { kind: "hud", c: CL.glasses, a: ev(CL.glasses, "Set done") - 0.5, b: ev(CL.glasses, "Next exercise") - 0.3 } },
      { line: "c3-4", extra: 0.9, shot: { kind: "hud", c: CL.glasses, a: ev(CL.glasses, "Next exercise") - 0.3, b: CL.glasses.duration - 0.1 } },
    ],
  },
  {
    id: "loop", n: "4", title: "Your agent adapts", goal: "Your notes and check-ins go back to it over MCP.", stop: 3,
    still: "Chicken_salad_on_kitchen_island_4af1f987_2K.jpg", loop: "Kitchen_island_with_healthy_food_805a1d69_1080p.mp4",
    steps: [
      { line: "c4-1", extra: 0.4, shot: { kind: "phone", c: CL.meal, a: 0.1, b: CL.meal.duration - 0.1, kicker: "Today · meals" } },
      { line: "c4-2", extra: 1.0, shot: { kind: "term", c: CL.agent2, a: 0.1, b: CL.agent2.duration - 0.1, title: "claude — my-agent", run: R2, cover: { ...COVER2, until: 24.8 }, fit: true } },
      { line: "c4-3", extra: 1.4, shot: { kind: "phone", c: CL.reply, a: 0.1, b: CL.reply.duration - 0.1, kicker: "Feedback" } },
      { line: "c4-4", extra: 1.0, shot: { kind: "phone", c: CL.next, a: 0.1, b: CL.next.duration - 0.1, kicker: "Today · plan version 2" } },
    ],
  },
  {
    id: "end", title: "Recap", stop: 3.999, bridge: { src: "Kettlebells_on_gym_floor_sunrise_1ac14484_1080p.mp4", from: 0.5, dur: 1.8 },
    steps: [
      { line: "c5-1", extra: 0.4, shot: { kind: "card", node: () => <Recap /> } },
      { line: "c5-2", extra: 1.2, shot: { kind: "card", node: () => <EndCard /> } },
    ],
  },
];

const TITLE = 1.6;
type Placed = Step & { at: number; len: number; ch: Chapter; i: number };
function layout() {
  const steps: Placed[] = [];
  const chapters: { ch: Chapter; at: number; end: number; body: number; bridgeAt?: number }[] = [];
  let t = 0;
  for (const ch of CHAPTERS) {
    let bridgeAt: number | undefined;
    if (ch.bridge) { bridgeAt = t; t += ch.bridge.dur; }
    const chAt = t;
    if (ch.n) t += TITLE;
    const body = t;
    ch.steps.forEach((s, i) => {
      const len = s.dur ?? LINES[s.line!].dur + PAD + (s.extra ?? 0);
      steps.push({ ...s, at: t, len, ch, i });
      t += len;
    });
    chapters.push({ ch, at: chAt, end: t, body, bridgeAt });
  }
  return { steps, chapters, total: t };
}
const L = layout();
export const DURATION = Math.ceil(L.total * FPS);

// YouTube chapters and the SRT come from here (scripts/fitloop-demo-srt.mjs).
export const CHAPTER_LIST = L.chapters.map((c) => ({ title: c.ch.n ? `${c.ch.n} · ${c.ch.title}` : c.ch.title, start: +(c.bridgeAt ?? c.at).toFixed(2) }));
export const SPEECH = L.steps.filter((s) => s.line).map((s) => ({ id: s.line!, at: +(s.at + 0.1).toFixed(2), words: LINES[s.line!].words }));
export const SPEECH_BY_ID: Record<string, { cues: { at: number; words: [string, number, number][] }[]; end: number }> = {
  "fitloop-demo": { cues: SPEECH, end: L.total },
};
const talking = (t: number) => SPEECH.some((s) => t >= s.at - 0.15 && t <= s.at + LINES[s.id].dur + 0.2);

// Gym Pro Grooves (Flow Music, 103.4 BPM, 59 s): its intro, a middle section repeated on bar lines, its ending.
const TRACK: Track = { bpm: 103.4, beat0: 0.09, end: 58.9, loopEndBar: 22 };

// ---------------------------------------------------------------------------------------- shots

const DESK_W = 1440, DESK_H = 810;
// The terminal: wide enough to read (~27 px text), cropped to its lower rows (the newest output; the
// account banner sits in the rows above).
const TERM_W = 1700, TERM_VIS = 742, TERM_K = TERM_W / 1920, TERM_OFF = 1080 - TERM_VIS / TERM_K;
const WebShot: React.FC<{ s: Extract<Shot, { kind: "web" | "term" }>; len: number; tilt: boolean }> = ({ s, len, tilt }) => {
  const term = s.kind === "term";
  const run = term ? s.run : undefined;
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (s.b - s.a) / len);
  const t = s.a + (frame / FPS) * rate;
  const lapse = run ? (() => { const pts = run.marks.map((x) => [x.t, x.run_s]); let i = 0; while (i < pts.length - 1 && pts[i + 1][0] <= t) i++; const [t0, r0] = pts[i]; const [t1, r1] = pts[i + 1] ?? [t0 + 1, r0 + 1]; return { real: r0 + ((r1 - r0) * (t - t0)) / Math.max(0.001, t1 - t0), speed: (r1 - r0) / Math.max(0.001, t1 - t0) }; })() : null;
  if (term) {
    return (
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 140 }}>
        <Window width={TERM_W} height={TERM_VIS} title={s.title} mono theme={T} tiltFrom={tilt ? 0 : -60}>
          <div style={{ position: "absolute", left: 0, top: -TERM_OFF * TERM_K, width: 1920, height: 1080, transform: `scale(${TERM_K})`, transformOrigin: "0 0" }}>
            <SteppedClip src={m(s.c.clip)} clipW={1920} clipH={1080} a={s.a} b={s.b} dur={len} keys={[[-1, { z: 1, cx: 960, cy: 540 }]]} events={[]} theme={T} touch="none" redact={s.cover ? [s.cover] : []} />
          </div>
        </Window>
        {run && lapse ? <Badge theme={T} style={{ top: 104, left: 110 }}>{lapse.speed * rate > 1.6 ? `⏩ ${Math.round(lapse.speed * rate)}× · ` : ""}real time {fmt(lapse.real - (run.marks.find((x) => x.name === "prompt")?.run_s ?? 0))}</Badge> : null}
        {!run && rate > 1.6 ? <Badge theme={T} style={{ top: 104, left: 110 }}>⏩ {rate.toFixed(1)}×</Badge> : null}
        {run ? <ToolChips run={run} t={t} /> : null}
      </AbsoluteFill>
    );
  }
  const k = DESK_W / s.c.width;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 112 }}>
      <Window width={DESK_W} height={DESK_H} title={s.title} theme={T} tiltFrom={tilt ? 0 : -60}>
        <div style={{ position: "absolute", left: 0, top: 0, width: s.c.width, height: s.c.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <SteppedClip src={m(s.c.clip)} clipW={s.c.width} clipH={s.c.height} a={s.a} b={s.b} dur={len} keys={cameraKeys(s.c.events, s.c.width, s.c.height, { max: 1.7 })} events={s.c.events} theme={T} touch="cursor" />
        </div>
      </Window>
      {rate > 1.6 ? <Badge theme={T} style={{ top: 104, right: 60 }}>⏩ {rate.toFixed(1)}×</Badge> : null}
      <DemoLabel />
    </AbsoluteFill>
  );
};
const fmt = (sec: number) => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.floor(Math.max(0, sec) % 60)).padStart(2, "0")}`;

/** FitLoop's MCP calls (the terminal collapses them into "Called fitloop 6 times"), as chips that pop in when called. */
const ToolChips: React.FC<{ run: RunMeta; t: number; style?: React.CSSProperties; size?: number; max?: number }> = ({ run, t, style, size = 24, max = 5 }) => {
  const rows = run.tools.filter((x) => x.tool !== "ToolSearch" && x.t <= t).slice(-max);
  return (
    <div style={{ position: "absolute", left: 520, right: 110, top: 100, display: "flex", gap: 10, justifyContent: "flex-end", fontFamily, ...style }}>
      <div style={{ fontSize: size * 0.85, fontWeight: 700, color: T.dim, alignSelf: "center", textShadow: "0 2px 8px rgba(0,0,0,0.9)", marginRight: 6 }}>FitLoop MCP</div>
      {rows.map((r, i) => {
        const p = Math.min(1, (t - r.t) / 0.25);
        return (
          <div key={`${r.tool}-${r.t}`} style={{ opacity: 0.45 + 0.55 * p, transform: `scale(${0.8 + 0.2 * p})`, background: "rgba(14,10,24,0.9)", border: `2px solid ${T.accent}${i === rows.length - 1 ? "" : "55"}`, borderRadius: 999, padding: "5px 14px", fontFamily: "Menlo, monospace", fontSize: size, color: T.ink, whiteSpace: "nowrap" }}>
            {r.tool}{r.tool === "publish_plan" || r.tool === "respond_to_feedback" ? <span style={{ color: T.accent, fontWeight: 700 }}> ✓</span> : null}
          </div>
        );
      })}
    </div>
  );
};

const PhoneShot: React.FC<{ s: Extract<Shot, { kind: "phone" }>; len: number }> = ({ s, len }) => (
  <AbsoluteFill>
    <SideNote events={s.c.events} a={s.a} b={s.b} dur={len} theme={T} kicker={s.kicker} left={150} top={360} width={720} />
    <PhoneStage src={m(s.c.clip)} clipW={s.c.width} clipH={s.c.height} a={s.a} b={s.b} dur={len} events={s.c.events} theme={T} x={1290} width={600} />
    <SimLabel text="iPhone app · simulator" left={1290} />
    <DemoLabel />
  </AbsoluteFill>
);
const SimLabel: React.FC<{ text: string; left?: number; top?: number }> = ({ text, left, top = 104 }) => (
  <div style={{ position: "absolute", top, left: left !== undefined ? left - 300 : 0, width: left !== undefined ? 600 : "100%", textAlign: "center", fontFamily, fontWeight: 600, fontSize: 22, color: T.dim, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>{text}</div>
);

const HUD_W = 1240;
const HudShot: React.FC<{ s: Extract<Shot, { kind: "hud" }>; len: number }> = ({ s, len }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (s.b - s.a) / len);
  const t = s.a + (frame / FPS) * rate;
  const k = HUD_W / s.c.width;
  const g = s.c.events.filter((e) => GESTURE[e.type] && t >= e.t - 0.15 && t <= e.t + 1.4).slice(-1)[0];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 165 }}>
      <Hud width={HUD_W} height={s.c.height * k} theme={G}>
        <div style={{ width: s.c.width, height: s.c.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(s.c.clip)} muted trimBefore={Math.round(s.a * FPS)} playbackRate={rate} style={{ width: s.c.width, height: s.c.height }} />
        </div>
      </Hud>
      {g ? <RingGesture label={g.label && g.label !== g.type ? `${GESTURE[g.type]} · ${g.label}` : GESTURE[g.type]} p={(t - g.t) / 1.4} kind={g.type} theme={T} style={{ bottom: 236 }} /> : null}
      <SimLabel text="Even G2 · Even Hub simulator · heart rate is demo data" top={112} />
      <DemoLabel />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- intro + end

const Opener: React.FC = () => {
  const frame = useCurrentFrame();
  const s = spring({ frame: frame - 12, fps: FPS, config: { damping: 20, stiffness: 90 } });
  return (
    <AbsoluteFill>
      <Video src={m("Athletic_training_studio_interior_02060045_1080p.mp4")} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(6,4,15,0.75) 0%, rgba(6,4,15,0.25) 55%, rgba(6,4,15,0) 80%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", fontFamily, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Img src={m("icon.png")} style={{ width: 110, height: 110, borderRadius: 26 }} />
          <div style={{ fontSize: 100, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>FitLoop</div>
        </div>
        <div style={{ marginTop: 18, fontSize: 48, fontWeight: 700, color: T.accent }}>How it works, in two minutes</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** The surfaces: the real phone and the real glasses, side by side. */
const Surfaces: React.FC = () => {
  const frame = useCurrentFrame();
  const a = spring({ frame, fps: FPS, config: { damping: 20, stiffness: 90 } });
  const b = spring({ frame: frame - 14, fps: FPS, config: { damping: 20, stiffness: 90 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("Empty_gym_interior_at_night_f9e49980_2K.jpg")} dark={0.5} />
      <div style={{ position: "absolute", left: 230, top: 110, transform: `translateY(${(1 - a) * 60}px) rotate(-2deg)`, opacity: a }}>
        <div style={{ width: 420, height: 913, borderRadius: 60, background: "#050608", padding: 14, boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 2px #2a2d33" }}>
          <Img src={m("still-2-workout.png")} style={{ width: 392, height: 885, borderRadius: 48, objectFit: "cover", objectPosition: "top" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 800, top: 260, transform: `translateY(${(1 - b) * 60}px) rotate(1.5deg)`, opacity: b }}>
        <Hud width={920} height={460} theme={G}><Img src={m("still-3-today.png")} style={{ width: 920, height: 460 }} /></Hud>
        <div style={{ marginTop: 22, textAlign: "center", fontFamily, fontSize: 30, fontWeight: 700, color: G.ink, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>Even G2 glasses + R1 ring</div>
      </div>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const RECAP: { f: string; label: string; hud?: boolean }[] = [
  { f: "still-1-connect.png", label: "1 · Agent writes the plan" },
  { f: "still-2-workout.png", label: "2 · Train with your phone" },
  { f: "still-3-today.png", label: "3 · Hands-free on G2", hud: true },
  { f: "still-4-reply.png", label: "4 · Your agent adapts" },
];
const Recap: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop still={m("Empty_gym_interior_at_night_f9e49980_2K.jpg")} loop={m("Kettlebells_on_gym_floor_sunrise_1ac14484_1080p.mp4")} dark={0.55} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 30, paddingBottom: 150, fontFamily }}>
        {RECAP.map((r, i) => {
          const p = spring({ frame: frame - i * 0.4 * FPS, fps: FPS, config: { damping: 18, stiffness: 120 } });
          return (
            <div key={r.f} style={{ width: 380, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: T.ink, marginBottom: 12, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>{r.label}</div>
              <Img src={m(r.f)} style={{ width: 380, height: 480, objectFit: "cover", objectPosition: r.hud ? "left center" : "top", borderRadius: 18, border: `2px solid ${(r.hud ? G : T).accent}66`, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", background: "#000" }} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ vertical?: boolean }> = ({ vertical }) => {
  const frame = useCurrentFrame();
  const s = spring({ frame, fps: FPS, config: { damping: 20, stiffness: 80 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("Empty_gym_interior_at_night_f9e49980_2K.jpg")} dark={0.3} drift={0.6} />
      <AbsoluteFill style={{ background: vertical ? "rgba(6,4,15,0.55)" : "linear-gradient(90deg, rgba(6,4,15,0.9) 0%, rgba(6,4,15,0.6) 50%, rgba(6,4,15,0) 78%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", padding: vertical ? "0 60px 420px" : "0 150px", fontFamily, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 30 }}>
          <Img src={m("icon.png")} style={{ width: 130, height: 130, borderRadius: 30 }} />
          <div style={{ fontSize: 110, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>FitLoop</div>
        </div>
        <div style={{ marginTop: 24, fontSize: vertical ? 56 : 54, fontWeight: 700, color: T.accent, lineHeight: 1.15 }}>Your agent's plan, wherever you train.</div>
        <div style={{ marginTop: 34, fontSize: 32, fontWeight: 600, color: T.ink }}>fitloop.hejitech.workers.dev</div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 500, color: T.dim }}>iPhone · Apple Watch · Even G2 + R1 · any MCP agent</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: vertical ? 150 : 40, left: vertical ? 60 : 150, right: vertical ? 60 : undefined, textAlign: vertical ? "center" : "left", fontFamily, fontSize: vertical ? 22 : 20, color: "rgba(245,247,250,0.6)" }}>
        Demo data. FitLoop and your agent give no medical advice. Backdrops are AI-generated; the narration is a synthetic voice. Claude Code is shown as one example of an MCP agent.
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- the video

const STOPS = ["Agent", "Phone", "Glasses", "Adapts"];
const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cur = L.chapters.filter((c) => c.ch.stop >= 0 && t >= c.at).slice(-1)[0];
  const idx = cur ? L.chapters.indexOf(cur) : 0;
  const prevStop = cur ? Math.max(0, L.chapters[idx - 1]?.ch.stop ?? 0) : 0;
  const at = cur ? interpolate(t, [cur.at, cur.at + 1], [prevStop, cur.ch.stop], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const barOn = cur && cur.ch.id !== "end" ? interpolate(t, [L.chapters[1].at - 0.2, L.chapters[1].at + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: "#06040f" }}>
      {L.chapters.map(({ ch, at: chAt, end, body, bridgeAt }) => (
        <React.Fragment key={ch.id}>
          {ch.bridge && bridgeAt !== undefined ? (
            <Scene from={bridgeAt} dur={ch.bridge.dur + 0.4} name={`${ch.id}: bridge`}>
              <Video src={m(ch.bridge.src)} muted trimBefore={Math.round(ch.bridge.from * FPS)} objectFit="cover" style={{ width: "100%", height: "100%" }} />
            </Scene>
          ) : null}
          {ch.still || ch.loop ? (
            <Scene from={chAt} dur={end - chAt + 0.4} name={`${ch.id}: backdrop`}>
              <Backdrop still={ch.still ? m(ch.still) : undefined} loop={ch.loop ? m(ch.loop) : undefined} dark={0.42} />
            </Scene>
          ) : null}
          {ch.n ? (
            <Scene from={chAt} dur={body - chAt + 0.3} name={`${ch.id}: title`}>
              <StepTitle n={`Step ${ch.n}`} title={ch.title} goal={ch.goal} theme={T} />
            </Scene>
          ) : null}
        </React.Fragment>
      ))}
      {L.steps.map((s, j) => {
        const prev = L.steps[j - 1];
        const sameClip = prev && prev.ch === s.ch && "c" in prev.shot && "c" in s.shot && prev.shot.c === s.shot.c;
        const sh = s.shot;
        return (
          <Scene key={`${s.ch.id}-${s.i}`} from={s.at} dur={s.len + (sameClip ? 0 : 0.3)} fade={sameClip ? 0 : 0.35} name={`${s.ch.id} ${s.i}: ${s.line ?? ""}`}>
            {sh.kind === "web" || sh.kind === "term" ? <WebShot s={sh} len={s.len} tilt={!sameClip} /> : null}
            {sh.kind === "phone" ? <PhoneShot s={sh} len={s.len} /> : null}
            {sh.kind === "hud" ? <HudShot s={sh} len={s.len} /> : null}
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
      <MusicBed src={m("music.mp3")} track={TRACK} total={L.total} talking={talking} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- the short (9:16)

// One task start to finish: the agent's workout on the glasses, a set, a note that something hurts, the
// agent changing the plan, the new exercise on the phone. Lines s-1…s-6.
const gl = CL.glasses;
const SHORT: { line: string; extra?: number; part: "hud" | "run" | "phone" | "end"; a?: number; b?: number }[] = [
  { line: "s-1", extra: 0.2, part: "hud", a: 0, b: ev(gl, "Open the workout") + 0.6 },
  { line: "s-2", extra: 0.2, part: "hud", a: ev(gl, "Set done") - 0.4, b: ev(gl, "Next exercise") - 0.3 },
  { line: "s-3", extra: 0.6, part: "hud", a: ev(gl, "Menu") - 0.4, b: gl.duration - 0.1 },
  { line: "s-4", extra: 0.6, part: "run", a: 6.5, b: CL.agent2.duration - 4 },
  { line: "s-5", extra: 1.0, part: "phone", a: ev(CL.next, "4.4a") - 0.4, b: CL.next.duration - 0.1 },
  { line: "s-6", extra: 1.4, part: "end" },
];
const SL = (() => { let t = 0; return SHORT.map((x) => { const len = LINES[x.line].dur + PAD + (x.extra ?? 0); const r = { ...x, at: t, len }; t += len; return r; }); })();
const SHORT_TOTAL = SL[SL.length - 1].at + SL[SL.length - 1].len;
export const SHORT_DURATION = Math.ceil(SHORT_TOTAL * FPS);
SPEECH_BY_ID["fitloop-demo-short"] = { cues: SL.map((x) => ({ at: +(x.at + 0.1).toFixed(2), words: LINES[x.line].words })), end: SHORT_TOTAL };
const talkingShort = (t: number) => SL.some((x) => t >= x.at && t <= x.at + 0.1 + LINES[x.line].dur + 0.2);

const ShortHud: React.FC<{ a: number; b: number; len: number; head?: string }> = ({ a, b, len, head }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (b - a) / len);
  const t = a + (frame / FPS) * rate;
  const w = 1020, k = w / gl.width;
  const g = gl.events.filter((e) => GESTURE[e.type] && t >= e.t - 0.15 && t <= e.t + 1.4).slice(-1)[0];
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 470 }}>
      {head ? <div style={{ position: "absolute", top: 210, left: 60, right: 60, textAlign: "center", fontFamily, fontSize: 70, fontWeight: 800, color: T.ink, lineHeight: 1.08, textShadow: "0 6px 30px rgba(0,0,0,0.7)" }}>{head}</div> : null}
      <Hud width={w} height={gl.height * k} theme={G}>
        <div style={{ width: gl.width, height: gl.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(gl.clip)} muted trimBefore={Math.round(a * FPS)} playbackRate={rate} style={{ width: gl.width, height: gl.height }} />
        </div>
      </Hud>
      {g ? <RingGesture label={g.label && g.label !== g.type ? `${GESTURE[g.type]} · ${g.label}` : GESTURE[g.type]} p={(t - g.t) / 1.4} kind={g.type} theme={T} style={{ bottom: undefined, top: 1060 }} /> : null}
      <SimLabel text="Even G2 · Even Hub simulator" top={420} />
    </AbsoluteFill>
  );
};
const ShortRun: React.FC<{ a: number; b: number; len: number }> = ({ a, b, len }) => {
  const frame = useCurrentFrame();
  const rate = Math.max(0.25, (b - a) / len);
  const t = a + (frame / FPS) * rate;
  // The left 1240 px and the lower rows of the terminal, large enough to read on a phone.
  const VW = 1240, k = 1000 / VW, top = 330, vis = 1080 - top;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 300 }}>
      <Window width={1000} height={vis * k} title="claude — my-agent" mono theme={T}>
        <div style={{ position: "absolute", left: 0, top: -top * k, width: 1920, height: 1080, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <SteppedClip src={m(CL.agent2.clip)} clipW={1920} clipH={1080} a={a} b={b} dur={len} keys={[[-1, { z: 1, cx: 960, cy: 540 }]]} events={[]} theme={T} touch="none" redact={[{ ...COVER2, until: 24.8 }]} />
        </div>
      </Window>
      <Badge theme={T} style={{ top: 210, left: 40 }}>⏩ time-lapse · a real agent run</Badge>
      <ToolChips run={R2} t={t} size={30} max={4} style={{ left: 40, right: 40, top: 960, flexWrap: "wrap", justifyContent: "center" }} />
    </AbsoluteFill>
  );
};
const Short: React.FC = () => (
  <AbsoluteFill style={{ background: "#06040f" }}>
    <Scene from={0} dur={SHORT_TOTAL - SL[SL.length - 1].len + 0.4} fade={0}>
      <Backdrop still={m("Chalked_hands_gripping_pull_up_14681e3e_2K.jpg")} loop={m("Chalked_hands_gripping_pull_up_a1b0e94e_1080p.mp4")} dark={0.5} />
    </Scene>
    {SL.map((x, i) => {
      const prev = SL[i - 1];
      const same = prev && prev.part === x.part;
      return (
        <Scene key={x.line} from={x.at} dur={x.len + (same ? 0 : 0.3)} fade={same ? 0 : 0.3}>
          {x.part === "hud" ? <ShortHud a={x.a!} b={x.b!} len={x.len} head={i === 0 ? "My agent wrote this workout" : undefined} /> : null}
          {x.part === "run" ? <ShortRun a={x.a!} b={x.b!} len={x.len} /> : null}
          {x.part === "phone" ? (
            <AbsoluteFill>
              <PhoneStage src={m(CL.next.clip)} clipW={CL.next.width} clipH={CL.next.height} a={x.a!} b={x.b!} dur={x.len} events={CL.next.events} theme={T} x={540} width={860} focusY={900} top={230} />
            </AbsoluteFill>
          ) : null}
          {x.part === "end" ? <EndCard vertical /> : null}
          {x.part !== "end" ? <DemoLabel /> : null}
        </Scene>
      );
    })}
    <CaptionBand />
    {SL.map((x, i) => (
      <React.Fragment key={`vo-${x.line}`}>
        <Sequence from={Math.round((x.at + 0.1) * FPS)}><Audio src={m(`vo-${VOICE}-${x.line}.wav`)} /></Sequence>
        {x.part !== "end" ? <KineticCaption words={LINES[x.line].words} offset={x.at + 0.1} before={SL[i + 1] ? SL[i + 1].at + 0.1 : undefined} /> : null}
      </React.Fragment>
    ))}
    <Audio src={m("music.mp3")} trimBefore={Math.round(Math.max(0, TRACK.end - SHORT_TOTAL - 0.3) * FPS)} volume={(f) => (talkingShort(f / FPS) ? 0.22 : 0.5) * Math.min(1, f / 8)} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------------------- thumbnails

const Thumb: React.FC = () => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Backdrop still={m("Chalked_hands_gripping_pull_up_14681e3e_2K.jpg")} dark={0.45} drift={0} />
      <div style={{ position: "absolute", left: v ? 60 : 64, top: v ? 150 : 70, fontSize: v ? 120 : 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -3, color: T.ink, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
        Agent <span style={{ color: T.accent }}>→</span><br />gym
      </div>
      <div style={{ position: "absolute", left: v ? 560 : 840, top: v ? 520 : 40, transform: "rotate(3deg)" }}>
        <div style={{ width: v ? 440 : 330, height: v ? 956 : 640, borderRadius: 48, background: "#050608", padding: 12, boxShadow: "0 40px 100px rgba(0,0,0,0.7), 0 0 0 2px #2a2d33", overflow: "hidden" }}>
          <Img src={m("still-4-next.png")} style={{ width: "100%", height: "100%", borderRadius: 38, objectFit: "cover", objectPosition: "top" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: v ? 40 : 56, top: v ? 1180 : 290, transform: "rotate(-2deg)" }}>
        <Hud width={v ? 700 : 640} height={v ? 350 : 320} theme={G}><Img src={m("still-3-today.png")} style={{ width: "100%", height: "100%" }} /></Hud>
      </div>
      <div style={{ position: "absolute", left: v ? 60 : 64, bottom: v ? 150 : 22, display: "flex", alignItems: "center", gap: 16 }}>
        <Img src={m("icon.png")} style={{ width: v ? 96 : 60, height: v ? 96 : 60, borderRadius: 16 }} />
        <span style={{ fontSize: v ? 54 : 38, fontWeight: 800, color: T.ink, textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>FitLoop</span>
      </div>
    </AbsoluteFill>
  );
};

export const FitloopDemo: React.FC = () => (
  <>
    <Composition id="fitloop-demo" component={Walkthrough} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="fitloop-demo-short" component={Short} durationInFrames={SHORT_DURATION} fps={FPS} width={1080} height={1920} />
    <Composition id="fitloop-demo-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
    <Composition id="fitloop-demo-short-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
