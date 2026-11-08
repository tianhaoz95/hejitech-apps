import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Composition, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBand, DemoLabel, fontFamily, KineticCaption } from "../shared/Caption";
import { Backdrop, ChapterBar, Ev, GESTURE, Hud, MusicBed, PhoneStage, RingGesture, Scene, SideNote, StepTitle, Theme, Track } from "../shared/Walkthrough";
import { LINES } from "./voiceover";
import E_COMMUTE from "./events/rec-1-commute.events.json";
import E_BOARD from "./events/rec-1-board.events.json";
import E_PAIR from "./events/rec-2-pair.events.json";
import E_GLASSES from "./events/rec-2-glasses.events.json";
import E_LATE from "./events/rec-3-board.events.json";
import E_HUD from "./events/rec-3-hud.events.json";
import E_PUSH from "./events/rec-3-push.events.json";
import E_TRACK from "./events/rec-4-track.events.json";
import E_ETA from "./events/rec-4-eta.events.json";
import E_ARRIVAL from "./events/rec-4-arrival.events.json";

// Headway walkthrough (reports/2026-11-02-headway-demo-video, skill heji-demo-video): set your commute and see
// when to leave, the board on Even G2 glasses with the R1 ring, the tip when a late train is beaten by the
// next one (an express), and tracking a ride (Share live ETA, the Live Activity, the arrival alert). Every product frame is
// a real recording from the local stack, on the Worker's demo clock set to a Monday morning (Caltrain's real
// weekday timetable) and a staged live snapshot (the delays are demo data), the iPhone app driven on the simulator (scripts/headway-demo-record.mjs),
// the plugin in the Even Hub simulator. Pushes are the alert engine's wording delivered with `simctl push`.
// Backdrops and bridges are the owner's Google Flow art; the music is the owner's Flow Music take from the
// promo, fitted on bar lines. Media: public/headway-demo/ (media.md).

const FPS = 30;
const m = (f: string) => staticFile(`headway-demo/${f}`);
const T: Theme = { accent: "#e8413c", ink: "#f0f4f8", panel: "rgba(18,22,28,0.94)", dim: "#a9b6c8" };
const G: Theme = { accent: "#3dff7a", ink: "#e3f2e6", panel: "rgba(7,20,11,0.92)", dim: "#8fb39a" };
const VOICE = "af_heart";
const PAD = 0.28;

type Clip = { clip: string; width: number; height: number; duration: number; events: Ev[] };
const C = (x: unknown) => x as Clip;
const CL = {
  commute: C(E_COMMUTE), board: C(E_BOARD), pair: C(E_PAIR), glasses: C(E_GLASSES), late: C(E_LATE), hud: C(E_HUD), push: C(E_PUSH),
  track: C(E_TRACK), eta: C(E_ETA), arrival: C(E_ARRIVAL),
};
const ev = (c: Clip, step: string, fallback?: number) => {
  const e = c.events.find((x) => x.step === step);
  if (!e) { if (fallback !== undefined) return fallback; throw new Error(`no event ${step} in ${c.clip}`); }
  return e.t;
};

// ---------------------------------------------------------------------------------------- the timeline

type Shot =
  | { kind: "phone"; c: Clip; a: number; b: number; kicker: string; label?: string }
  | { kind: "hud"; c: Clip; a: number; b: number; label?: string }
  | { kind: "card"; node: () => React.ReactNode };
type Step = { line?: string; extra?: number; dur?: number; shot: Shot };
type Chapter = { id: string; n?: string; title: string; goal?: string; stop: number; still?: string; loop?: string; bridge?: { src: string; from: number; dur: number }; steps: Step[] };

const tr = CL.track;
const CHAPTERS: Chapter[] = [
  {
    id: "intro", title: "Intro", stop: -1, steps: [
      { line: "c0-1", extra: 0.4, shot: { kind: "card", node: () => <Opener /> } },
      { line: "c0-2", extra: 0.4, shot: { kind: "card", node: () => <Surfaces /> } },
    ],
  },
  {
    id: "commute", n: "1", title: "When to leave", goal: "Your stations and your walk, once. Then a countdown.", stop: 0,
    still: "Coffee_cup_on_wooden_desk_ea1ce458_2K.jpg", loop: "Steam_rising_from_coffee_cup_9744a41a_1080p.mp4",
    steps: [
      { line: "c1-1", extra: 0.4, shot: { kind: "phone", c: CL.commute, a: 0.1, b: CL.commute.duration - 0.1, kicker: "Commute" } },
      { line: "c1-2", extra: 0.4, shot: { kind: "phone", c: CL.board, a: 0.1, b: ev(CL.board, "1.3") - 0.5, kicker: "Trains" } },
      { line: "c1-3", extra: 1.0, shot: { kind: "phone", c: CL.board, a: ev(CL.board, "1.3") - 0.5, b: CL.board.duration - 0.1, kicker: "Trains" } },
    ],
  },
  {
    id: "glasses", n: "2", title: "On your glasses", goal: "Even G2 + the R1 ring: no phone on the platform.", stop: 1,
    still: "Illuminated_dark_stone_textures_c60e1bcc_2K.jpg", loop: "Creating_futuristic_ambient_vide…_6a5496ec_1080p.mp4",
    steps: [
      { line: "c2-1", extra: 0.3, shot: { kind: "phone", c: CL.pair, a: 0.1, b: CL.pair.duration - 0.1, kicker: "Glasses" } },
      { line: "c2-2", extra: 0.2, shot: { kind: "hud", c: CL.glasses, a: 0, b: ev(CL.glasses, "Next trains") - 0.4 } },
      { line: "c2-3", extra: 0.4, shot: { kind: "hud", c: CL.glasses, a: ev(CL.glasses, "Next trains") - 0.4, b: ev(CL.glasses, "Flip direction") - 0.4 } },
      { line: "c2-4", extra: 0.6, shot: { kind: "hud", c: CL.glasses, a: ev(CL.glasses, "Flip direction") - 0.4, b: ev(CL.glasses, "Flip back") - 0.2 } },
      { line: "c2-5", extra: 0.8, shot: { kind: "hud", c: CL.glasses, a: ev(CL.glasses, "Menu") - 0.6, b: CL.glasses.duration - 0.1 } },
    ],
  },
  {
    id: "late", n: "3", title: "Wait for the Express", goal: "When a later train gets you there first.", stop: 2,
    still: "Trains_passing_on_railway_tracks_c740b68d_2K.jpg", loop: "Night_timelapse_of_railway_tracks_3fdf43be_1080p.mp4",
    steps: [
      { line: "c3-1", extra: 0.4, shot: { kind: "phone", c: CL.late, a: 0.1, b: ev(CL.late, "3.2") - 0.5, kicker: "Trains" } },
      { line: "c3-2", extra: 1.2, shot: { kind: "phone", c: CL.late, a: ev(CL.late, "3.2") - 0.5, b: CL.late.duration - 0.1, kicker: "Trains" } },
      { line: "c3-3", extra: 1.0, shot: { kind: "hud", c: CL.hud, a: 0.3, b: CL.hud.duration - 0.1, label: "The same tip, in the footer" } },
      { line: "c3-4", extra: 1.2, shot: { kind: "phone", c: CL.push, a: Math.max(0.1, ev(CL.push, "3.4") - 1.6), b: CL.push.duration - 0.1, kicker: "A minute later" } },
    ],
  },
  {
    id: "track", n: "4", title: "Track your ride", goal: "Live on your Lock Screen, and on someone else's phone.", stop: 3,
    still: "Passenger_looking_out_train_window_70f7f078_2K.jpg", loop: "Train_carriage_passing_city_lights_a31219e1_1080p.mp4",
    steps: [
      { line: "c4-1", extra: 0.4, shot: { kind: "phone", c: tr, a: 0.1, b: ev(tr, "4.2") - 0.3, kicker: "Trains" } },
      { line: "c4-2", extra: 0.6, shot: { kind: "phone", c: tr, a: ev(tr, "4.2") - 0.3, b: ev(tr, "4.3") - 0.5, kicker: "Tracking" } },
      { line: "c4-3", extra: 1.0, shot: { kind: "phone", c: CL.eta, a: 0.1, b: CL.eta.duration - 0.1, kicker: "What they see", label: "No app, no sign-in" } },
      { line: "c4-4", extra: 0.8, shot: { kind: "phone", c: tr, a: ev(tr, "4.3") - 0.5, b: tr.duration - 0.1, kicker: "Live Activity" } },
      { line: "c4-5", extra: 1.0, shot: { kind: "phone", c: CL.arrival, a: Math.max(0.1, ev(CL.arrival, "4.5") - 1.2), b: CL.arrival.duration - 0.1, kicker: "Lock Screen" } },
    ],
  },
  {
    id: "end", title: "Recap", stop: 3.999, bridge: { src: "Train_gliding_through_suburban_l…_31da0976_1080p.mp4", from: 0.6, dur: 1.8 },
    steps: [
      { line: "c5-1", extra: 0.6, shot: { kind: "card", node: () => <Recap /> } },
      { line: "c5-2", extra: 1.8, shot: { kind: "card", node: () => <EndCard /> } },
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

// YouTube chapters and the SRT come from here (scripts/headway-demo-srt.mjs).
export const CHAPTER_LIST = L.chapters.map((c) => ({ title: c.ch.n ? `${c.ch.n} · ${c.ch.title}` : c.ch.title, start: +(c.bridgeAt ?? c.at).toFixed(2) }));
export const SPEECH = L.steps.filter((s) => s.line).map((s) => ({ id: s.line!, at: +(s.at + 0.1).toFixed(2), words: LINES[s.line!].words }));
export const SPEECH_BY_ID: Record<string, { cues: { at: number; words: [string, number, number][] }[]; end: number }> = {
  "headway-demo": { cues: SPEECH, end: L.total },
};
const talking = (t: number) => SPEECH.some((s) => t >= s.at - 0.15 && t <= s.at + LINES[s.id].dur + 0.2);

// The promo's Flow Music take "15-sec-music" (99.4 BPM, 68 s): its intro, a middle section repeated on bar lines, its ending.
const MUSIC = "music-68s-take1-commute-groove.mp3";
const TRACK: Track = { bpm: 99.4, beat0: 0.6, end: 67.7, loopEndBar: 24 };

// ---------------------------------------------------------------------------------------- shots

const SimLabel: React.FC<{ text: string; left?: number; top?: number }> = ({ text, left, top = 104 }) => (
  <div style={{ position: "absolute", top, left: left !== undefined ? left - 300 : 0, width: left !== undefined ? 600 : "100%", textAlign: "center", fontFamily, fontWeight: 600, fontSize: 22, color: T.dim, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>{text}</div>
);
const PhoneShot: React.FC<{ s: Extract<Shot, { kind: "phone" }>; len: number }> = ({ s, len }) => {
  const evs: Ev[] = s.label ? [{ step: "x", t: s.a, type: "look", label: s.label, box: null }, ...s.c.events] : s.c.events;
  return (
    <AbsoluteFill>
      <SideNote events={evs} a={s.a} b={s.b} dur={len} theme={T} kicker={s.kicker} left={150} top={360} width={720} />
      <PhoneStage src={m(s.c.clip)} clipW={s.c.width} clipH={s.c.height} a={s.a} b={s.b} dur={len} events={s.c.events} theme={T} x={1290} width={600} />
      <SimLabel text={s.c === CL.eta ? "A phone's browser · the shared link" : "iPhone app · simulator"} left={1290} />
      <DemoLabel />
    </AbsoluteFill>
  );
};

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
      {s.label ? <div style={{ position: "absolute", bottom: 236, left: 0, right: 0, textAlign: "center", fontFamily, fontSize: 40, fontWeight: 800, color: T.ink, textShadow: "0 3px 18px rgba(0,0,0,0.8)" }}>↑ {s.label}</div> : null}
      <SimLabel text="Even G2 · Even Hub simulator" top={112} />
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
      <Video src={m("Commuter_waiting_for_train_ad7ded41_1080p.mp4")} muted objectFit="cover" style={{ width: "100%", height: "100%" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(8,10,14,0.78) 0%, rgba(8,10,14,0.25) 55%, rgba(8,10,14,0) 80%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 150px", fontFamily, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Img src={m("icon.png")} style={{ width: 110, height: 110, borderRadius: 26 }} />
          <div style={{ fontSize: 100, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>Headway</div>
        </div>
        <div style={{ marginTop: 18, fontSize: 48, fontWeight: 700, color: T.accent }}>How it works, in two minutes</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const PhoneStill: React.FC<{ src: string; w: number }> = ({ src, w }) => (
  <div style={{ width: w, height: w * 2.174, borderRadius: w * 0.14, background: "#050608", padding: 14, boxShadow: "0 50px 120px rgba(0,0,0,0.7), 0 0 0 2px #2a2d33" }}>
    <Img src={src} style={{ width: w - 28, height: w * 2.174 - 28, borderRadius: w * 0.115, objectFit: "cover", objectPosition: "top" }} />
  </div>
);
const Surfaces: React.FC = () => {
  const frame = useCurrentFrame();
  const a = spring({ frame, fps: FPS, config: { damping: 20, stiffness: 90 } });
  const b = spring({ frame: frame - 14, fps: FPS, config: { damping: 20, stiffness: 90 } });
  return (
    <AbsoluteFill>
      <Backdrop still={m("Dawn_breaking_over_train_platform_ef936758_2K.jpg")} dark={0.5} />
      <div style={{ position: "absolute", left: 230, top: 110, transform: `translateY(${(1 - a) * 60}px) rotate(-2deg)`, opacity: a }}><PhoneStill src={m("still-1-board.png")} w={420} /></div>
      <div style={{ position: "absolute", left: 800, top: 260, transform: `translateY(${(1 - b) * 60}px) rotate(1.5deg)`, opacity: b }}>
        <Hud width={920} height={460} theme={G}><Img src={m("still-2-board.png")} style={{ width: 920, height: 460 }} /></Hud>
        <div style={{ marginTop: 22, textAlign: "center", fontFamily, fontSize: 30, fontWeight: 700, color: G.ink, textShadow: "0 2px 10px rgba(0,0,0,0.9)" }}>Even G2 glasses + R1 ring</div>
      </div>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const RECAP: { f: string; label: string; hud?: boolean }[] = [
  { f: "still-1-board.png", label: "1 · When to leave" },
  { f: "still-2-board.png", label: "2 · On your glasses", hud: true },
  { f: "still-3-board.png", label: "3 · Wait for the Express" },
  { f: "still-4-lock.png", label: "4 · Track your ride" },
];
const Recap: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Backdrop still={m("Dawn_breaking_over_train_platform_ef936758_2K.jpg")} loop={m("Train_gliding_through_suburban_l…_31da0976_1080p.mp4")} dark={0.55} />
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
      <Backdrop still={m("Dawn_breaking_over_train_platform_ef936758_2K.jpg")} dark={0.3} drift={0.6} />
      <AbsoluteFill style={{ background: vertical ? "rgba(8,10,14,0.55)" : "linear-gradient(90deg, rgba(8,10,14,0.9) 0%, rgba(8,10,14,0.6) 50%, rgba(8,10,14,0) 78%)" }} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: vertical ? "center" : "flex-start", textAlign: vertical ? "center" : "left", padding: vertical ? "0 60px 420px" : "0 150px", fontFamily, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", alignItems: "center", gap: 30 }}>
          <Img src={m("icon.png")} style={{ width: 130, height: 130, borderRadius: 30 }} />
          <div style={{ fontSize: 110, fontWeight: 800, color: T.ink, letterSpacing: -3 }}>Headway</div>
        </div>
        <div style={{ marginTop: 24, fontSize: 54, fontWeight: 700, color: T.accent, lineHeight: 1.15 }}>Your next Caltrain, at a glance.</div>
        <div style={{ marginTop: 34, fontSize: 32, fontWeight: 600, color: T.ink }}>headway.hejitech.workers.dev</div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 500, color: T.dim }}>iPhone · Apple Watch · Even G2 + R1 · Android</div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: vertical ? 150 : 40, left: vertical ? 60 : 150, right: vertical ? 60 : undefined, textAlign: vertical ? "center" : "left", fontFamily, fontSize: vertical ? 22 : 20, color: "rgba(240,244,248,0.6)" }}>
        Caltrain's real timetable; the delays shown are demo data. Not affiliated with Caltrain. Backdrops are AI-generated; the narration is a synthetic voice.
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- the video

const STOPS = ["When to leave", "Glasses", "Express", "Track"];
const Walkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cur = L.chapters.filter((c) => c.ch.stop >= 0 && t >= c.at).slice(-1)[0];
  const idx = cur ? L.chapters.indexOf(cur) : 0;
  const prevStop = cur ? Math.max(0, L.chapters[idx - 1]?.ch.stop ?? 0) : 0;
  const at = cur ? interpolate(t, [cur.at, cur.at + 1], [prevStop, cur.ch.stop], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const barOn = cur && cur.ch.id !== "end" ? interpolate(t, [L.chapters[1].at - 0.2, L.chapters[1].at + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: "#080a0e" }}>
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
      <MusicBed src={m(MUSIC)} track={TRACK} total={L.total} talking={talking} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- the short (9:16)

// One task: a badly late train, Headway's tip on the phone and the glasses, the alert. Lines s-1…s-5.
const SHORT: { line: string; extra?: number; part: "phone" | "hud" | "push" | "end"; a?: number; b?: number }[] = [
  { line: "s-1", extra: 0.4, part: "phone", a: 0.1, b: ev(CL.late, "3.2") - 0.4 },
  { line: "s-2", extra: 0.8, part: "phone", a: ev(CL.late, "3.2") - 0.4, b: CL.late.duration - 0.1 },
  { line: "s-3", extra: 0.8, part: "hud", a: 0.3, b: CL.hud.duration - 0.1 },
  { line: "s-4", extra: 1.0, part: "push", a: Math.max(0.1, ev(CL.push, "3.4") - 1.2), b: CL.push.duration - 0.1 },
  { line: "s-5", extra: 1.6, part: "end" },
];
const SL = (() => { let t = 0; return SHORT.map((x) => { const len = LINES[x.line].dur + PAD + (x.extra ?? 0); const r = { ...x, at: t, len }; t += len; return r; }); })();
const SHORT_TOTAL = SL[SL.length - 1].at + SL[SL.length - 1].len;
export const SHORT_DURATION = Math.ceil(SHORT_TOTAL * FPS);
SPEECH_BY_ID["headway-demo-short"] = { cues: SL.map((x) => ({ at: +(x.at + 0.1).toFixed(2), words: LINES[x.line].words })), end: SHORT_TOTAL };
const talkingShort = (t: number) => SL.some((x) => t >= x.at && t <= x.at + 0.1 + LINES[x.line].dur + 0.2);

const ShortHud: React.FC<{ a: number; b: number; len: number }> = ({ a, b, len }) => {
  const rate = Math.max(0.25, (b - a) / len);
  const w = 1020, k = w / CL.hud.width;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 560 }}>
      <Hud width={w} height={CL.hud.height * k} theme={G}>
        <div style={{ width: CL.hud.width, height: CL.hud.height, transform: `scale(${k})`, transformOrigin: "0 0" }}>
          <Video src={m(CL.hud.clip)} muted trimBefore={Math.round(a * FPS)} playbackRate={rate} style={{ width: CL.hud.width, height: CL.hud.height }} />
        </div>
      </Hud>
      <SimLabel text="Even G2 · Even Hub simulator" top={510} />
    </AbsoluteFill>
  );
};
const Short: React.FC = () => (
  <AbsoluteFill style={{ background: "#080a0e" }}>
    <Scene from={0} dur={SHORT_TOTAL - SL[SL.length - 1].len + 0.4} fade={0}>
      <Backdrop still={m("Trains_passing_on_railway_tracks_c740b68d_2K.jpg")} loop={m("Night_timelapse_of_railway_tracks_3fdf43be_1080p.mp4")} dark={0.5} />
    </Scene>
    {SL.map((x, i) => {
      const prev = SL[i - 1];
      const same = prev && prev.part === x.part;
      const clip = x.part === "push" ? CL.push : CL.late;
      return (
        <Scene key={x.line} from={x.at} dur={x.len + (same ? 0 : 0.3)} fade={same ? 0 : 0.3}>
          {x.part === "phone" || x.part === "push" ? (
            <AbsoluteFill>
              <PhoneStage src={m(clip.clip)} clipW={clip.width} clipH={clip.height} a={x.a!} b={x.b!} dur={x.len} events={clip.events} theme={T} x={540} width={860} focusY={1200} top={160} />
            </AbsoluteFill>
          ) : null}
          {x.part === "hud" ? <ShortHud a={x.a!} b={x.b!} len={x.len} /> : null}
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
    <Audio src={m(MUSIC)} trimBefore={Math.round(Math.max(0, TRACK.end - SHORT_TOTAL - 0.3) * FPS)} volume={(f) => (talkingShort(f / FPS) ? 0.22 : 0.5) * Math.min(1, f / 8)} />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------------------- thumbnails

const Thumb: React.FC = () => {
  const { width, height } = useVideoConfig();
  const v = height > width;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Backdrop still={m("Trains_passing_on_railway_tracks_c740b68d_2K.jpg")} dark={0.4} drift={0} />
      <div style={{ position: "absolute", left: v ? 60 : 64, top: v ? 150 : 70, fontSize: v ? 120 : 96, fontWeight: 800, lineHeight: 0.98, letterSpacing: -3, color: T.ink, textShadow: "0 6px 30px rgba(0,0,0,0.8)" }}>
        When to<br /><span style={{ color: T.accent }}>leave</span>
      </div>
      <div style={{ position: "absolute", left: v ? 560 : 840, top: v ? 520 : 40, transform: "rotate(3deg)" }}><PhoneStill src={m("still-3-board.png")} w={v ? 440 : 300} /></div>
      <div style={{ position: "absolute", left: v ? 40 : 56, top: v ? 1180 : 290, transform: "rotate(-2deg)" }}>
        <Hud width={v ? 700 : 640} height={v ? 350 : 320} theme={G}><Img src={m("still-2-board.png")} style={{ width: "100%", height: "100%" }} /></Hud>
      </div>
      <div style={{ position: "absolute", left: v ? 60 : 64, bottom: v ? 150 : 22, display: "flex", alignItems: "center", gap: 16 }}>
        <Img src={m("icon.png")} style={{ width: v ? 96 : 60, height: v ? 96 : 60, borderRadius: 16 }} />
        <span style={{ fontSize: v ? 54 : 38, fontWeight: 800, color: T.ink, textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}>Headway</span>
      </div>
    </AbsoluteFill>
  );
};

export const HeadwayDemo: React.FC = () => (
  <>
    <Composition id="headway-demo" component={Walkthrough} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="headway-demo-short" component={Short} durationInFrames={SHORT_DURATION} fps={FPS} width={1080} height={1920} />
    <Composition id="headway-demo-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1280} height={720} />
    <Composition id="headway-demo-short-thumb" component={Thumb} durationInFrames={1} fps={FPS} width={1080} height={1920} />
  </>
);
