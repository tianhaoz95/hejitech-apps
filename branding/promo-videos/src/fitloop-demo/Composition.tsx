import { Audio, Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Composition,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { CaptionBand, DemoLabel, fontFamily, KineticCaption } from "../shared/Caption";
import {
  Backdrop,
  ChapterBar,
  Theme,
} from "../shared/Walkthrough";
import { LINES, Word } from "./voiceover";

// FitLoop walkthrough (reports/2026-11-02-fitloop-demo-video, skill heji-demo-video):
// Your AI agent coaches, FitLoop keeps you on the plan across iPhone, Apple Watch, and Even G2 glasses.
// Media lives in public/fitloop-demo/ (media.md).

const FPS = 30;
const m = (f: string) => staticFile(`fitloop-demo/${f}`);
const launchM = (f: string) => staticFile(`fitloop-launch/${f}`);
const T: Theme = { accent: "#ff7a45", ink: "#f5f7fa", panel: "rgba(18,16,32,0.94)", dim: "#958fb0" };
const ORANGE = "#ff7a45";
const HUD_GREEN = "#3dff7a";
const PAD = 0.35; // silence buffer after narration lines

const BACKDROPS: Record<string, { loop?: string; still?: string }> = {
  intro: { loop: m("Athletic_training_studio_interior_02060045_1080p.mp4"), still: m("Empty_gym_interior_at_night_f9e49980_2K.jpg") },
  agent: { loop: m("Espresso_cup_on_modern_desk_b9287a95_1080p.mp4"), still: m("Minimalist_modern_desk_setup_fac639df_2K.jpg") },
  workout: { loop: m("Workout_bench_in_quiet_gym_49b56c2a_1080p.mp4"), still: m("Adjustable_leather_workout_bench…_71ffa9b3_2K.jpg") },
  glasses: { loop: m("Chalked_hands_gripping_pull_up_a1b0e94e_1080p.mp4"), still: m("Chalked_hands_gripping_pull_up_14681e3e_2K.jpg") },
  loop: { loop: m("Kitchen_island_with_healthy_food_805a1d69_1080p.mp4"), still: m("Chicken_salad_on_kitchen_island_4af1f987_2K.jpg") },
  recap: { loop: m("Kettlebells_on_gym_floor_sunrise_1ac14484_1080p.mp4"), still: m("Empty_gym_interior_at_night_f9e49980_2K.jpg") },
};

// ---------------------------------------------------------------------------------------- timeline definition

type Step = {
  id: string;
  line: string;
  screen: string;
  device: "phone" | "hud" | "watch" | "agent" | "card";
  title: string;
  detail: string;
  badge?: string;
  hold?: number;
  recSrc?: string;
};

type ChapterDef = {
  id: string;
  n?: string;
  title: string;
  goal?: string;
  stop: number;
  backdropArt?: string;
  steps: Step[];
};

const CHAPTERS: ChapterDef[] = [
  {
    id: "intro",
    title: "Intro",
    stop: -1,
    backdropArt: "art-A1_Opener_athletic_studio.jpg",
    steps: [
      { id: "0.1", line: "c0-1", screen: "Gym Floor", device: "card", title: "Stop Guessing Sets", detail: "Everyone at the gym is guessing weights and counting reps." },
      { id: "0.2", line: "c0-2", screen: "Surfaces", device: "card", title: "FitLoop at a glance", detail: "Your AI agent coaches. FitLoop delivers it on iPhone, Watch, and Even G2 glasses." },
    ],
  },
  {
    id: "agent",
    n: "1",
    title: "Bring your agent & generate plan",
    goal: "Connect Claude or any MCP agent, validate glasses limits, and publish your training routine.",
    stop: 0,
    backdropArt: "art-B1_Agent_desk_tablet.jpg",
    steps: [
      { id: "1.1", line: "c1-1", screen: "OAuth MCP", device: "agent", title: "Connect MCP Agent", detail: "Authorize Claude Code, Cursor, or any MCP client via OAuth with local agent tokens.", badge: "MCP Protocol" },
      { id: "1.2", line: "c1-2", screen: "Plan Guide", device: "agent", title: "Fetch Profile & Guide", detail: "Agent calls get_plan_guide and get_profile to structure weekly goals and constraints.", badge: "get_plan_guide" },
      { id: "1.3", line: "c1-3", screen: "Validator", device: "agent", title: "Validate G2 Limits", detail: "Validates exercise names (≤28 chars), cues (≤60 chars), rest timers, and unique IDs.", badge: "validate_plan" },
      { id: "1.4", line: "c1-4", screen: "Publish", device: "agent", title: "Publish Plan v1", detail: "Agent publishes version 1, instantly syncing to iPhone, Watch, and Even G2 glasses.", badge: "publish_plan (v1)" },
    ],
  },
  {
    id: "workout",
    n: "2",
    title: "Mid-workout on iPhone & Apple Watch",
    goal: "Follow today's workout player, procedural demo GIFs, set logging, and Apple Watch heart rate.",
    stop: 1,
    backdropArt: "art-B2_Workout_bench_dumbbells.jpg",
    steps: [
      { id: "2.1", line: "c2-1", screen: "Today tab", device: "phone", title: "Daily Training Session", detail: "Morning Lower Body: Goblet squats, reverse lunges, rows, and meals around 2,000 kcal.", badge: "Today: Lower Body" },
      { id: "2.2", line: "c2-2", screen: "Exercise GIF", device: "phone", title: "Procedural Form Guide", detail: "Interactive 2D procedural rigging demo GIF (/api/exercises/goblet-squat.gif) and form cues.", badge: "Live Exercise GIF" },
      { id: "2.3", line: "c2-3", screen: "Watch workout", device: "watch", title: "Apple Watch HR Sync", detail: "Watch runs HKWorkoutSession and relays live heart rate (132 bpm) and haptic cues.", badge: "Heart Rate: 132 bpm" },
      { id: "2.4", line: "c2-4", screen: "Workout player", device: "phone", title: "Check Off Sets & Timer", detail: "Tap set 1 done (10 reps @ 16 kg); 60-second rest timer counts down automatically.", badge: "Rest Timer: 60s" },
    ],
  },
  {
    id: "glasses",
    n: "3",
    title: "Hands-free on Even G2 & R1 ring",
    goal: "Monochrome 9-line green HUD, R1 ring single-tap set completion, and hold-for-menu gestures.",
    stop: 2,
    backdropArt: "art-B3_Glasses_hud_perspective.jpg",
    steps: [
      { id: "3.1", line: "c3-1", screen: "Pairing code", device: "phone", title: "One-Time 6-Digit Pairing", detail: "Generate pairing code in FitLoop and link glasses for offline-first Bluetooth sync.", badge: "Pair Code: 842 195" },
      { id: "3.2", line: "c3-2", screen: "G2 HUD", device: "hud", title: "9-Line Monochrome HUD", detail: "Goblet squat, Set 1/4 (10 reps @ 16 kg), live heart rate streamed right in vision.", badge: "1728x864 Green HUD", recSrc: launchM("rec-glasses-set.mp4") },
      { id: "3.3", line: "c3-3", screen: "R1 Tap", device: "hud", title: "R1 Ring Tap to Finish Set", detail: "Single tap marks set done; rest timer initiates without touching gym equipment or phone.", badge: "Gesture: Single Tap", recSrc: launchM("rec-glasses-rest.mp4") },
      { id: "3.4", line: "c3-4", screen: "R1 Hold", device: "hud", title: "R1 Hold Menu & Cues", detail: "Hold ring opens quick menu: coaching cues, skip exercise, or in-the-moment notes.", badge: "Gesture: Ring Hold", recSrc: launchM("rec-glasses-hurts.mp4") },
    ],
  },
  {
    id: "loop",
    n: "4",
    title: "The closed loop: instant feedback & plan adaptation",
    goal: "Flag pain or difficulty mid-set, check off meals, and watch your agent adjust tomorrow's plan.",
    stop: 3,
    backdropArt: "art-B4_Kitchen_healthy_meal.jpg",
    steps: [
      { id: "4.1", line: "c4-1", screen: "Feedback", device: "hud", title: "Tell Agent: 'It Hurts'", detail: "User flags left knee discomfort mid-set on lunges; note queues and syncs to Worker.", badge: "Note: It hurts", recSrc: launchM("rec-glasses-hurts.mp4") },
      { id: "4.2", line: "c4-2", screen: "Diet check-in", device: "phone", title: "Nutritional Check-In", detail: "Lunch chicken bowl checked as eaten; user notes feeling energized with good recovery.", badge: "Meals: Eaten" },
      { id: "4.3", line: "c4-3", screen: "Agent MCP", device: "agent", title: "Agent Reads & Responds", detail: "Agent calls get_feedback, explains knee deload strategy, and replies directly in-app.", badge: "respond_to_feedback" },
      { id: "4.4", line: "c4-4", screen: "Plan v2", device: "phone", title: "Plan v2: Swapped for Step-ups", detail: "Tomorrow's workout automatically replaces lunges with box step-ups to reduce knee strain.", badge: "Plan v2 Synced" },
    ],
  },
  {
    id: "recap",
    title: "Recap",
    stop: -1,
    backdropArt: "art-A3_Endcard_indigo_glow.jpg",
    steps: [
      { id: "5.1", line: "c5-1", screen: "Montage", device: "card", title: "Your agent coaches", detail: "MCP Agent • iPhone & Watch • Even G2 Glasses • Closed-Loop Adaptation." },
      { id: "5.2", line: "c5-2", screen: "End card", device: "card", title: "FitLoop", detail: "Smarter training, right in your vision." },
    ],
  },
];

// Calculate start times and durations for all steps and chapters
type TimedStep = Step & { start: number; dur: number; lineDur: number; words: Word[] };
type TimedChapter = Omit<ChapterDef, "steps"> & { start: number; dur: number; steps: TimedStep[] };

function buildTimeline(): { chapters: TimedChapter[]; totalDuration: number } {
  let t = 0;
  const chapters: TimedChapter[] = [];

  for (const ch of CHAPTERS) {
    const chStart = t;
    const timedSteps: TimedStep[] = [];

    for (const step of ch.steps) {
      const vo = LINES[step.line];
      const lineDur = vo ? vo.dur : 4.0;
      const stepDur = Math.max(lineDur + PAD, step.hold ?? 0);
      timedSteps.push({
        ...step,
        start: t,
        dur: stepDur,
        lineDur,
        words: vo ? vo.words : [],
      });
      t += stepDur;
    }

    chapters.push({
      ...ch,
      start: chStart,
      dur: t - chStart,
      steps: timedSteps,
    });
  }

  return { chapters, totalDuration: t };
}

const { chapters: TIMED_CHAPTERS, totalDuration: TOTAL_DURATION } = buildTimeline();

// Build YouTube CHAPTER_LIST
export const CHAPTER_LIST = TIMED_CHAPTERS.map((ch) => ({
  id: ch.id,
  title: ch.n ? `${ch.n}. ${ch.title}` : ch.title,
  start: Math.round(ch.start * 10) / 10,
}));

// Build Speech exports for SRT generation
export const SPEECH_BY_ID: Record<string, { cues: { at: number; words: Word[] }[]; end: number }> = {
  "fitloop-demo": {
    cues: TIMED_CHAPTERS.flatMap((ch) =>
      ch.steps.map((st) => ({
        at: st.start,
        words: st.words,
      }))
    ),
    end: TOTAL_DURATION,
  },
};

// ---------------------------------------------------------------------------------------- step animatic card

const StepCard: React.FC<{ step: TimedStep; ch: TimedChapter }> = ({ step, ch }) => {
  const isHud = step.device === "hud";
  const isAgent = step.device === "agent";
  const isWatch = step.device === "watch";

  const borderColor = isHud ? HUD_GREEN : isAgent ? "#a78bfa" : isWatch ? "#38bdf8" : ORANGE;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 100px",
        fontFamily,
        color: T.ink,
      }}
    >
      <div
        style={{
          width: 1040,
          background: isHud ? "#020804" : T.panel,
          border: `2px solid ${borderColor}`,
          borderRadius: 32,
          padding: "36px 48px",
          boxShadow: isHud
            ? `0 24px 64px rgba(61,255,122,0.18)`
            : `0 24px 64px rgba(0,0,0,0.75)`,
          backdropFilter: "blur(20px)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {step.recSrc ? (
          <div style={{ position: "relative", width: "100%", height: 320, borderRadius: 16, overflow: "hidden", background: "#000" }}>
            <Video
              src={step.recSrc}
              objectFit="contain"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                background: borderColor,
                color: isHud ? "#020804" : "#fff",
                fontWeight: 800,
                fontSize: 14,
                padding: "4px 12px",
                borderRadius: 999,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {ch.n ? `Chapter ${ch.n}` : "Walkthrough"}
            </span>
            <span style={{ fontSize: 18, color: T.dim, fontWeight: 600 }}>
              {step.screen}
            </span>
          </div>
          {step.badge ? (
            <span
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: isHud ? HUD_GREEN : T.ink,
                fontSize: 13,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 600,
                padding: "4px 12px",
                borderRadius: 8,
              }}
            >
              {step.badge}
            </span>
          ) : null}
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: isHud ? HUD_GREEN : T.ink,
            }}
          >
            {step.title}
          </h2>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 22,
              lineHeight: 1.45,
              color: isHud ? "#9ae6b4" : "#d8dfeb",
            }}
          >
            {step.detail}
          </p>
        </div>

        <div
          style={{
            height: 220,
            borderRadius: 16,
            background: isHud
              ? "radial-gradient(circle at 50% 50%, #061f10 0%, #020a05 100%)"
              : "rgba(0,0,0,0.55)",
            border: `1px solid ${isHud ? "rgba(61,255,122,0.3)" : "rgba(255,255,255,0.12)"}`,
            padding: 20,
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            fontFamily: isHud ? "monospace" : fontFamily,
          }}
        >
          {isHud ? (
            <>
              <div style={{ flex: 1, textAlign: "left", lineHeight: 1.8, fontSize: 17, color: HUD_GREEN }}>
                <div style={{ color: "rgba(61,255,122,0.6)", fontSize: 13, textTransform: "uppercase" }}>Even G2 · Workout HUD</div>
                <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>
                  REVERSE LUNGE
                </div>
                <div style={{ color: "#a5f3bf" }}>
                  SET 2/3 · 8 REPS · 2x10kg
                </div>
                <div style={{ color: "#70e89c", fontSize: 14 }}>
                  TAP RING: SET DONE (REST 60s)
                </div>
              </div>
              <div style={{ width: 340, height: 180, borderRadius: 12, overflow: "hidden", border: `1px solid ${HUD_GREEN}`, background: "#020804" }}>
                <Video
                  src={m(step.id === "4.1" ? "rec-glasses-hurts.mp4" : step.id.startsWith("3.2") ? "rec-glasses-set.mp4" : step.id.startsWith("3.3") ? "rec-glasses-rest.mp4" : "rec-glasses-today.mp4")}
                  muted
                  loop
                  objectFit="contain"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          ) : step.device === "phone" ? (
            <>
              <div style={{ flex: 1, textAlign: "left", lineHeight: 1.6 }}>
                <div style={{ fontSize: 14, color: T.dim, textTransform: "uppercase" }}>iPhone · Training Player</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: T.ink }}>
                  {step.screen}
                </div>
                <div style={{ fontSize: 16, color: T.accent, marginTop: 4 }}>
                  {step.title}
                </div>
              </div>
              <div style={{ width: 120, height: 180, borderRadius: 12, overflow: "hidden", border: `1px solid ${ORANGE}`, background: "#000" }}>
                <Video
                  src={m(step.id.startsWith("4.") ? "rec-phone-reply.mp4" : "rec-phone-today.mp4")}
                  muted
                  loop
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          ) : step.device === "watch" ? (
            <>
              <div style={{ flex: 1, textAlign: "left", lineHeight: 1.6 }}>
                <div style={{ fontSize: 14, color: T.dim, textTransform: "uppercase" }}>Apple Watch · HKWorkoutSession</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: ORANGE }}>132 bpm</div>
                <div style={{ fontSize: 16, color: T.ink }}>Active Cal: 184 kcal · Lower Body</div>
              </div>
              <div style={{ width: 120, height: 180, borderRadius: 12, overflow: "hidden", border: `1px solid ${ORANGE}`, background: "#000" }}>
                <Video
                  src={m("rec-phone-today.mp4")}
                  muted
                  loop
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", lineHeight: 1.6 }}>
              <div style={{ fontSize: 15, color: T.dim }}>[ FITLOOP AI AGENT MCP ]</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: T.ink }}>
                {step.screen}
              </div>
              <div style={{ fontSize: 16, color: T.accent, marginTop: 4 }}>
                {step.title}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 10,
            padding: "16px 20px",
            background: "rgba(0,0,0,0.35)",
            borderRadius: 14,
            borderLeft: `4px solid ${borderColor}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: T.dim, textTransform: "uppercase" }}>
            VO
          </span>
          <span style={{ fontSize: 17, color: T.ink, fontStyle: "italic" }}>
            "{LINES[step.line]?.words.map((w) => w[0]).join(" ") ?? ""}"
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- main walkthrough composition

export const FitloopDemoWalkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const rel = frame / FPS;

  const curChIndex = TIMED_CHAPTERS.findIndex(
    (ch) => rel >= ch.start && rel < ch.start + ch.dur
  );
  const curCh = TIMED_CHAPTERS[curChIndex >= 0 ? curChIndex : 0];
  const activeChapterStop = curCh.stop;
  const bg = BACKDROPS[curCh.id] ?? BACKDROPS.intro;

  return (
    <AbsoluteFill style={{ background: "#0c0a1a", color: "#fff" }}>
      <Backdrop loop={bg.loop} still={bg.still} dark={0.45} />
      <Audio src={m("music.mp3")} volume={0.16} loop />

      {TIMED_CHAPTERS.map((ch) =>
        ch.steps.map((st) => (
          <Sequence
            key={st.id}
            from={Math.round(st.start * FPS)}
            durationInFrames={Math.round(st.dur * FPS)}
          >
            <StepCard step={st} ch={ch} />
            <Audio src={m(`vo-af_sarah-${st.line}.wav`)} />
          </Sequence>
        ))
      )}

      {activeChapterStop >= 0 ? (
        <ChapterBar
          at={activeChapterStop}
          stops={["Agent MCP", "Workout & Watch", "Even G2 HUD", "Closed Loop"]}
          theme={T}
        />
      ) : null}

      <CaptionBand />
      {TIMED_CHAPTERS.flatMap((ch) => ch.steps).map((st) => (
        <Sequence
          key={`caption-${st.id}`}
          from={Math.round(st.start * FPS)}
          durationInFrames={Math.round(st.dur * FPS)}
        >
          <KineticCaption words={st.words} offset={st.start} />
        </Sequence>
      ))}

      <DemoLabel />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- short composition (9:16)

export const FitloopDemoShort: React.FC = () => {
  const frame = useCurrentFrame();
  const rel = frame / FPS;

  const shortSteps = [
    { line: "s-1", title: "Tired of phone-fiddling?", badge: "Gym Pacing" },
    { line: "s-2", title: "AI Plan in Even G2 Glasses", badge: "G2 HUD" },
    { line: "s-3", title: "R1 Ring Tap for Auto-Rest", badge: "R1 Smart Ring" },
    { line: "s-4", title: "Mid-Set Pain Adapts Plan", badge: "Closed-Loop MCP" },
    { line: "s-5", title: "FitLoop: Your Agent Coaches", badge: "FitLoop" },
  ];

  let t = 0;
  const timed = shortSteps.map((st) => {
    const vo = LINES[st.line];
    const dur = vo ? vo.dur + PAD : 4.0;
    const start = t;
    t += dur;
    return { ...st, start, dur, words: vo ? vo.words : [] };
  });

  const cur = timed.find((s) => rel >= s.start && rel < s.start + s.dur) ?? timed[0];

  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 30%, #241d4a 0%, #0d0b1d 100%)",
        color: "#fff",
        fontFamily,
      }}
    >
      <Backdrop
        loop={m("Athletic_training_studio_interior_02060045_1080p.mp4")}
        still={m("Empty_gym_interior_at_night_f9e49980_2K.jpg")}
        dark={0.45}
      />
      <Audio src={m("music.mp3")} volume={0.18} loop />

      {timed.map((s) => (
        <Sequence
          key={s.line}
          from={Math.round(s.start * FPS)}
          durationInFrames={Math.round(s.dur * FPS)}
        >
          <Audio src={m(`vo-af_sarah-${s.line}.wav`)} />
        </Sequence>
      ))}

      <div
        style={{
          position: "absolute",
          top: "35%",
          left: 60,
          right: 60,
          padding: 40,
          background: T.panel,
          border: `2px solid ${ORANGE}`,
          borderRadius: 28,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ fontSize: 18, color: ORANGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {cur.badge}
        </div>
        <div style={{ fontSize: 44, fontWeight: 800, marginTop: 12, lineHeight: 1.2 }}>
          {cur.title}
        </div>
      </div>

      <CaptionBand />
      {timed.map((s) => (
        <KineticCaption
          key={s.line}
          words={LINES[s.line].words}
          offset={s.start}
        />
      ))}
      <DemoLabel />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- thumbnail composition

export const FitloopDemoThumb: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "radial-gradient(circle at 50% 35%, #241d4a 0%, #14112b 50%, #05040f 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        color: "#fff",
        fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 20,
          marginBottom: 20,
        }}
      >
        <Img src={m("icon.png")} style={{ width: 100, height: 100, borderRadius: 24 }} />
        <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em" }}>FitLoop</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: ORANGE, marginBottom: 12 }}>
        Your agent coaches. FitLoop keeps you on the plan.
      </div>
      <div style={{ fontSize: 24, color: T.dim }}>
        Even G2 Glasses HUD · Apple Watch · Closed-Loop MCP
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- Root registration

export const FitloopDemo: React.FC = () => {
  return (
    <>
      <Composition
        id="fitloop-demo"
        component={FitloopDemoWalkthrough}
        durationInFrames={Math.ceil(TOTAL_DURATION * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="fitloop-demo-short"
        component={FitloopDemoShort}
        durationInFrames={Math.ceil(
          (LINES["s-1"].dur + LINES["s-2"].dur + LINES["s-3"].dur + LINES["s-4"].dur + LINES["s-5"].dur + PAD * 5) * FPS
        )}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="fitloop-demo-thumb"
        component={FitloopDemoThumb}
        durationInFrames={1}
        fps={FPS}
        width={1280}
        height={720}
      />
    </>
  );
};
