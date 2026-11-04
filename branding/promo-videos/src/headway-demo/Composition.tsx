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
  ChapterBar,
  Theme,
} from "../shared/Walkthrough";
import { LINES, Word } from "./voiceover";

// Headway walkthrough (reports/2026-11-02-headway-demo-video, skill heji-demo-video):
// Caltrain departures, live delays, leave-by times, Even G2 glasses HUD, R1 ring gestures,
// express overtaking advice, and real-time tracking with Live Activities and ETA sharing.
// Media lives in public/headway-demo/ (media.md).

const FPS = 30;
const m = (f: string) => staticFile(`headway-demo/${f}`);
const T: Theme = { accent: "#e02424", ink: "#f0f4f8", panel: "rgba(18,22,28,0.94)", dim: "#8b9bb4" };
const HUD_GREEN = "#3dff7a";
const CALTRAIN_RED = "#e02424";
const PAD = 0.35; // silence after each narration line

const BACKDROPS: Record<string, { loop?: string; still?: string }> = {
  intro: { loop: m("Commuter_waiting_for_train_ad7ded41_1080p.mp4"), still: m("Dawn_breaking_over_train_platform_ef936758_2K.jpg") },
  commute: { loop: m("Steam_rising_from_coffee_cup_9744a41a_1080p.mp4"), still: m("Coffee_cup_on_wooden_desk_ea1ce458_2K.jpg") },
  glasses: { loop: m("Creating_futuristic_ambient_vide…_6a5496ec_1080p.mp4"), still: m("Illuminated_dark_stone_textures_c60e1bcc_2K.jpg") },
  overtake: { loop: m("Night_timelapse_of_railway_tracks_3fdf43be_1080p.mp4"), still: m("Trains_passing_on_railway_tracks_c740b68d_2K.jpg") },
  track: { loop: m("Train_carriage_passing_city_lights_a31219e1_1080p.mp4"), still: m("Passenger_looking_out_train_window_70f7f078_2K.jpg") },
  recap: { loop: m("Train_gliding_through_suburban_l…_31da0976_1080p.mp4"), still: m("Dawn_breaking_over_train_platform_ef936758_2K.jpg") },
};

// ---------------------------------------------------------------------------------------- timeline definition

type Step = {
  id: string;
  line: string;
  screen: string;
  device: "phone" | "hud" | "watch" | "card";
  title: string;
  detail: string;
  badge?: string;
  hold?: number;
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
    backdropArt: "art-A1_Platform_dusk_caltrain.jpg",
    steps: [
      { id: "0.1", line: "c0-1", screen: "Platform", device: "card", title: "Caltrain Commute", detail: "The morning rush down the platform." },
      { id: "0.2", line: "c0-2", screen: "Overview", device: "card", title: "Headway at a glance", detail: "Live departures, leave-by countdowns, glasses HUD, and real-time alerts." },
    ],
  },
  {
    id: "commute",
    n: "1",
    title: "Commute & leave-by times",
    goal: "Never guess when to walk out the door: live board with exact walk countdown.",
    stop: 0,
    backdropArt: "art-B1_Commute_desk_morning.jpg",
    steps: [
      { id: "1.1", line: "c1-1", screen: "Commute tab", device: "phone", title: "Commute Station Pairs", detail: "Morning: San Francisco → Palo Alto. Evening: Palo Alto → San Francisco.", badge: "Walk buffer: 6m" },
      { id: "1.2", line: "c1-2", screen: "Trains tab", device: "phone", title: "Live Departure Board", detail: "Train 618 on time (11:55), Train 620 delayed (+4m at 12:15).", badge: "Live 511 GTFS-RT" },
      { id: "1.3", line: "c1-3", screen: "CatchCard", device: "phone", title: "Leave-By Countdown Ring", detail: "Leave in 12m: accounts for your walking buffer so you arrive with minutes to spare.", badge: "Catch state: LEAVE" },
      { id: "1.4", line: "c1-4", screen: "Catch state", device: "phone", title: "Hustle Alerts", detail: "Green when on track, pulsing orange RUN alert if departure approaches walk buffer.", badge: "State: RUN / ON TIME" },
    ],
  },
  {
    id: "glasses",
    n: "2",
    title: "Even G2 glasses & R1 ring",
    goal: "Live Caltrain HUD right in your vision, controlled with fingertip gestures.",
    stop: 1,
    backdropArt: "art-B2_Glasses_slate_emerald.jpg",
    steps: [
      { id: "2.1", line: "c2-1", screen: "Glasses tab", device: "phone", title: "One-Time Pairing", detail: "Generate six-digit code (e.g. 842 195) in app and submit in Even app.", badge: "Code: 842 195" },
      { id: "2.2", line: "c2-2", screen: "HUD Board", device: "hud", title: "Even G2 Departure Board", detail: "Crisp 9-line green display: 618 ok (11:55), 620 +4m (12:15), leave 12m.", badge: "9-Line Monochrome" },
      { id: "2.3", line: "c2-3", screen: "HUD Swipe", device: "hud", title: "R1 Ring Swipe Down", detail: "Ring gesture navigates through upcoming trains without reaching for your phone.", badge: "Gesture: Swipe Down" },
      { id: "2.4", line: "c2-4", screen: "HUD Flip", device: "hud", title: "R1 Ring Tap to Flip", detail: "Single tap flips direction (Palo Alto → San Francisco) for the return commute.", badge: "Gesture: Tap" },
      { id: "2.5", line: "c2-5", screen: "HUD Menu", device: "hud", title: "R1 Ring Hold Menu", detail: "Hold opens quick actions: Track train, Any Station search, and Alerts.", badge: "Gesture: Hold" },
    ],
  },
  {
    id: "overtake",
    n: "3",
    title: "Wait for the Express",
    goal: "Smart transit intelligence that prevents boarding a delayed local when an express is faster.",
    stop: 2,
    backdropArt: "art-B3_Express_night_timelapse.jpg",
    steps: [
      { id: "3.1", line: "c3-1", screen: "Delayed Board", device: "phone", title: "Local 113 Delayed", detail: "Local 113 delayed by 14m (departs 8:15). Express 511 departs 8:22.", badge: "113 Delayed +14m" },
      { id: "3.2", line: "c3-2", screen: "InsightBanner", device: "phone", title: "Express Overtake Advice", detail: "Wait for 511: departs 7 min later, arrives 4 min earlier. Saves travel time.", badge: "Advice: Wait for 511" },
      { id: "3.3", line: "c3-3", screen: "HUD Tip", device: "hud", title: "HUD Overtake Footer", detail: "Footer alert: 'Wait for 511: beats 113 by 4m' right in your field of view.", badge: "Glasses Footer Tip" },
      { id: "3.4", line: "c3-4", screen: "Push Alert", device: "phone", title: "Time-Sensitive Alert", detail: "'Take 511 instead: arrives 4m earlier than 113' delivered before departure.", badge: "APNs Push Notification" },
    ],
  },
  {
    id: "track",
    n: "4",
    title: "Track ride & Share ETA",
    goal: "Live Activities on Lock Screen & Dynamic Island, Apple Watch glance, and private ETA sharing.",
    stop: 3,
    backdropArt: "art-B4_Train_window_reflections.jpg",
    steps: [
      { id: "4.1", line: "c4-1", screen: "Track swipe", device: "phone", title: "Swipe to Track", detail: "Swipe right on Train 511 to begin active trip tracking.", badge: "Action: Track 511" },
      { id: "4.2", line: "c4-2", screen: "Live Activity", device: "phone", title: "Lock Screen & Dynamic Island", detail: "Real-time stop progress timeline, speed status, and countdown to destination.", badge: "ActivityKit Live Push" },
      { id: "4.3", line: "c4-3", screen: "Watch glance", device: "watch", title: "Apple Watch Companion", detail: "Glanceable departure countdown complication and on-wrist trip progress.", badge: "watchOS & Complication" },
      { id: "4.4", line: "c4-4", screen: "Share ETA", device: "phone", title: "Private Shareable ETA Link", detail: "Generates /eta/:token link with 30s live polling for family, no login required.", badge: "Ephemeral Link: /eta/..." },
      { id: "4.5", line: "c4-5", screen: "Arrival alert", device: "phone", title: "5-Minute Arrival Alert", detail: "'Palo Alto in 5 min — time to gather your things' haptic notification.", badge: "Haptic Arrival Tap" },
    ],
  },
  {
    id: "recap",
    title: "Recap",
    stop: -1,
    backdropArt: "art-A3_Terminal_morning_light.jpg",
    steps: [
      { id: "5.1", line: "c5-1", screen: "Montage", device: "card", title: "Commute on your schedule", detail: "Leave countdown • Glasses HUD • Express tips • Live tracking." },
      { id: "5.2", line: "c5-2", screen: "End card", device: "card", title: "Headway", detail: "Your next Caltrain, at a glance." },
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
  "headway-demo": {
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
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepFrame = frame - Math.round(step.start * fps);
  const enter = spring({ frame: stepFrame, fps, config: { damping: 14, stiffness: 120 } });
  const opacity = interpolate(stepFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  const isHud = step.device === "hud";
  const isWatch = step.device === "watch";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 100px",
      }}
    >
      <div
        style={{
          width: 1040,
          background: isHud ? "rgba(4, 14, 8, 0.95)" : T.panel,
          border: `2px solid ${isHud ? HUD_GREEN : T.accent}`,
          borderRadius: 24,
          padding: 40,
          color: isHud ? HUD_GREEN : T.ink,
          boxShadow: isHud
            ? "0 24px 64px rgba(61, 255, 122, 0.18)"
            : "0 24px 64px rgba(0, 0, 0, 0.65)",
          transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
          opacity,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 700,
                fontSize: 16,
                padding: "4px 12px",
                borderRadius: 999,
                background: isHud ? "rgba(61,255,122,0.2)" : "rgba(224,36,36,0.2)",
                color: isHud ? HUD_GREEN : CALTRAIN_RED,
              }}
            >
              STEP {step.id} · {step.screen.toUpperCase()}
            </span>
            {ch.n && (
              <span style={{ fontSize: 16, color: isHud ? "#70e89c" : T.dim }}>
                Chapter {ch.n}: {ch.title}
              </span>
            )}
          </div>
          {step.badge && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 14,
                padding: "4px 10px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.08)",
                color: isHud ? HUD_GREEN : T.ink,
              }}
            >
              {step.badge}
            </span>
          )}
        </div>

        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 800,
              fontFamily,
              color: isHud ? HUD_GREEN : T.ink,
              letterSpacing: "-0.02em",
            }}
          >
            {step.title}
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 20,
              color: isHud ? "#8eedaa" : T.dim,
              lineHeight: 1.4,
              fontFamily,
            }}
          >
            {step.detail}
          </p>
        </div>

        {/* Visual device simulator representation */}
        <div
          style={{
            height: 250,
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
                <div style={{ color: "rgba(61,255,122,0.6)", fontSize: 13, textTransform: "uppercase" }}>Even G2 · Heads-Up Display</div>
                <div style={{ fontWeight: 700, fontSize: 20, marginTop: 4 }}>
                  SF &gt; PALO ALTO
                </div>
                <div style={{ color: "#a5f3bf" }}>
                  11:55  L-618  ON TIME  [LEAVE 12m]
                </div>
                <div style={{ color: "#70e89c", fontSize: 14 }}>
                  12:15  L-620  +4m LATE
                </div>
              </div>
              <div style={{ width: 340, height: 210, borderRadius: 12, overflow: "hidden", border: `1px solid ${HUD_GREEN}`, background: "#020804" }}>
                <Video
                  src={m(step.id.startsWith("2.3") || step.id.startsWith("2.4") ? "rec-glasses-swipe.mp4" : "rec-glasses-board.mp4")}
                  muted
                  loop
                  objectFit="contain"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          ) : isWatch ? (
            <>
              <div style={{ flex: 1, textAlign: "left", lineHeight: 1.6 }}>
                <div style={{ fontSize: 14, color: T.dim, textTransform: "uppercase" }}>Apple Watch · Caltrain Complication</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: CALTRAIN_RED }}>12m</div>
                <div style={{ fontSize: 16, color: T.ink }}>Train 618 · Leaves 11:55</div>
              </div>
              <div style={{ width: 140, height: 210, borderRadius: 12, overflow: "hidden", border: `1px solid ${CALTRAIN_RED}`, background: "#000" }}>
                <Video
                  src={m("rec-phone-stop.mp4")}
                  muted
                  loop
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, textAlign: "left", lineHeight: 1.6 }}>
                <div style={{ fontSize: 14, color: T.dim, textTransform: "uppercase" }}>iPhone App · Live Departure Board</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: T.ink }}>
                  {step.screen}
                </div>
                <div style={{ fontSize: 16, color: T.accent, marginTop: 4 }}>
                  {step.title}
                </div>
              </div>
              <div style={{ width: 140, height: 210, borderRadius: 12, overflow: "hidden", border: `1px solid ${CALTRAIN_RED}`, background: "#000" }}>
                <Video
                  src={m(step.id.startsWith("4.") ? "rec-phone-stop.mp4" : "rec-phone-leave.mp4")}
                  muted
                  loop
                  objectFit="cover"
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- main composition

export const HeadwayDemoWalkthrough: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const curTime = frame / fps;

  // Active chapter and step
  const activeChapter =
    TIMED_CHAPTERS.find((ch) => curTime >= ch.start && curTime < ch.start + ch.dur) ??
    TIMED_CHAPTERS[TIMED_CHAPTERS.length - 1];

  const activeStep =
    activeChapter.steps.find((st) => curTime >= st.start && curTime < st.start + st.dur) ??
    activeChapter.steps[activeChapter.steps.length - 1];

  const bg = BACKDROPS[activeChapter.id] ?? BACKDROPS.intro;

  return (
    <AbsoluteFill style={{ background: "#0a0c10", color: T.ink, fontFamily }}>
      {/* Background with real Flow backdrop */}
      <Backdrop loop={bg.loop} still={bg.still} dark={0.45} />

      {/* Background music */}
      <Audio src={m("music.mp3")} volume={0.16} loop />

      {/* Voiceover audio sequences */}
      {TIMED_CHAPTERS.map((ch) =>
        ch.steps.map((st) => (
          <Sequence
            key={st.line}
            from={Math.round(st.start * fps)}
            durationInFrames={Math.round(st.dur * fps)}
          >
            <Audio src={m(`vo-af_heart-${st.line}.wav`)} volume={1.0} />
          </Sequence>
        ))
      )}

      {/* Render active step card */}
      <StepCard step={activeStep} ch={activeChapter} />

      {/* Top Chapter Progress Bar */}
      {activeChapter.stop >= 0 && (
        <ChapterBar
          stops={TIMED_CHAPTERS.filter((c) => c.stop >= 0).map((c) => c.title)}
          at={activeChapter.stop}
          theme={{ accent: CALTRAIN_RED, ink: T.ink, panel: T.panel, dim: T.dim }}
        />
      )}

      {/* Captions */}
      <CaptionBand />
      {TIMED_CHAPTERS.map((ch) =>
        ch.steps.map((st) => (
          <KineticCaption
            key={st.line}
            words={st.words}
            offset={st.start}
          />
        ))
      )}

      {/* Demo data label in corner */}
      <DemoLabel />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- short composition (9:16)

export const HeadwayDemoShort: React.FC = () => {
  const SHORT_STEPS = [
    { line: "s-1", title: "Still sprinting for Caltrain?", badge: "Caltrain Commute", dur: LINES["s-1"].dur + PAD },
    { line: "s-2", title: "Exact Leave-By Countdown", badge: "Leave in 12m", dur: LINES["s-2"].dur + PAD },
    { line: "s-3", title: "Wait for the Express", badge: "Express Overtake Advice", dur: LINES["s-3"].dur + PAD },
    { line: "s-4", title: "Live Activity & 5-min Tap", badge: "Dynamic Island + Haptics", dur: LINES["s-4"].dur + PAD },
    { line: "s-5", title: "Your Next Caltrain, at a Glance", badge: "Headway", dur: LINES["s-5"].dur + PAD },
  ];

  let t = 0;
  const timed = SHORT_STEPS.map((s) => {
    const st = { ...s, start: t };
    t += s.dur;
    return st;
  });

  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const curTime = frame / fps;
  const cur = timed.find((s) => curTime >= s.start && curTime < s.start + s.dur) ?? timed[timed.length - 1];

  return (
    <AbsoluteFill style={{ background: "#06090e", color: "#fff", fontFamily }}>
      <Backdrop
        loop={m("Commuter_waiting_for_train_ad7ded41_1080p.mp4")}
        still={m("Dawn_breaking_over_train_platform_ef936758_2K.jpg")}
        dark={0.45}
      />
      <Audio src={m("music.mp3")} volume={0.18} loop />
      <Backdrop dark={0.4} />

      {timed.map((s) => (
        <Sequence
          key={s.line}
          from={Math.round(s.start * fps)}
          durationInFrames={Math.round(s.dur * fps)}
        >
          <Audio src={m(`vo-af_heart-${s.line}.wav`)} volume={1.0} />
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
          border: `2px solid ${CALTRAIN_RED}`,
          borderRadius: 28,
          textAlign: "center",
          boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
        }}
      >
        <div style={{ fontSize: 18, color: CALTRAIN_RED, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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

export const HeadwayDemoThumb: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0b111a 0%, #171d28 100%)",
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
        <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em" }}>Headway</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: CALTRAIN_RED, marginBottom: 12 }}>
        Caltrain, at a glance
      </div>
      <div style={{ fontSize: 24, color: T.dim }}>
        Leave-By Times · Even G2 HUD · Live Tracking
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------- Root registration

export const HeadwayDemo: React.FC = () => {
  return (
    <>
      <Composition
        id="headway-demo"
        component={HeadwayDemoWalkthrough}
        durationInFrames={Math.ceil(TOTAL_DURATION * FPS)}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="headway-demo-short"
        component={HeadwayDemoShort}
        durationInFrames={Math.ceil(
          (LINES["s-1"].dur + LINES["s-2"].dur + LINES["s-3"].dur + LINES["s-4"].dur + LINES["s-5"].dur + PAD * 5) * FPS
        )}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="headway-demo-thumb"
        component={HeadwayDemoThumb}
        durationInFrames={1}
        fps={FPS}
        width={1280}
        height={720}
      />
    </>
  );
};
