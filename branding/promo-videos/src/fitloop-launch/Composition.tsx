import { Audio } from "@remotion/media";
import { TransitionPresentation } from "@remotion/transitions";
import { blurSlide } from "@remotion/transitions/blur-slide";
import { crossZoom } from "@remotion/transitions/cross-zoom";
import { dreamyZoom } from "@remotion/transitions/dreamy-zoom";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  CaptionBand,
  DemoLabel,
  fontFamily,
  KineticCaption,
} from "../shared/Caption";
import { Clip, Cuts } from "../shared/Cuts";
import { BEATS_15, BEATS_30, LINES, Word } from "./voiceover";

// FitLoop launch promo (reports/2026-11-01-fitloop-promo-video): everyone at the gym is guessing
// except Maya, whose own AI agent wrote her plan. Flow shots carry the comedy, with the characters'
// own lines from Flow (Theo: "Wait, how many sets is this?", Maya: "My agent wrote mine.", Theo:
// "Okay. I'm getting an agent."); real recordings show the product (the G2 display through her eyes,
// the iPhone app); narration af_sarah (Kokoro) between. Media: public/fitloop-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`fitloop-launch/${file}`);
const ORANGE = "#ff7a45";
const INDIGO =
  "radial-gradient(circle at 50% 35%, #241d4a 0%, #14112b 50%, #05040f 100%)";

const SHOT = {
  gym: media("Shot_1_draft_8b07ecbb_1080p.mp4"),
  sets: media("Shot_2_draft_2dbd05aa_1080p.mp4"),
  glance: media("Shot_3_draft_09a6abcf_1080p.mp4"),
  tap: media("Shot_4_draft_03caaeb0_1080p.mp4"),
  hurts: media("Shot_5_draft_dfd56833_1080p.mp4"),
  kitchen: media("Shot_6_draft_caff71ad_1080p.mp4"),
  agent: media("Shot_7_draft_654094cd_1080p.mp4"),
};
const REC = {
  set: media("rec-glasses-set.mp4"),
  rest: media("rec-glasses-rest.mp4"),
  hurts: media("rec-glasses-hurts.mp4"),
  reply: media("still-phone-reply.png"),
  today: media("still-phone-today.png"),
};
const VO = (key: string) => media(`vo-af_sarah-${key}.wav`);

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const toEnd = { presentation: dreamyZoom({}) as P, frames: 16 };

// Cuts land on the music's beats: each planned cut moves to the nearest beat within 0.25 s.
const snapper = (beats: number[]) => (t: number) => {
  if (t === 0) return 0;
  const near = beats.reduce((a, b) =>
    Math.abs(b - t) < Math.abs(a - t) ? b : a,
  );
  return Math.abs(near - t) <= 0.25 ? near : t;
};

// Speech in the timeline: narration files and the characters' lines from Flow shots.
type Line = {
  key: string;
  at: number;
  shot?: string;
  from?: number;
  caption?: boolean;
};
// Sounds kept from a Flow shot that aren't speech (the phone buzzing on the counter).
type Sfx = { at: number; shot: string; from: number; to: number };

// ---------------------------------------------------------------- 30-second cut
// music-30-edit.wav: take 2 ("form-check"), 2.0–27.96 s spliced on the beat to 55.96 s–end, so the
// groove arrives at ~7 s, a one-bar drop sits just before Theo's last line and the hard stop
// (30.25 s) lands on the end card.
const END_30 = 30.4;
const s30 = snapper(BEATS_30);
const CLIPS_30: Clip[] = [
  {
    name: "1 · The gym is guessing",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.gym} from={3.4} lead={l} focusX={0.42} />
    ),
  },
  {
    name: "2 · How many sets?",
    at: s30(3.11),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.sets} from={0.8} lead={l} focusX={0.6} />
    ),
  },
  {
    name: "2 · My agent wrote mine.",
    at: s30(5.41),
    into: next,
    render: (l) => (
      <FlowShot
        src={SHOT.sets}
        from={5.15}
        lead={l}
        zoom={1.18}
        origin="30% 40%"
        focusX={0.36}
      />
    ),
  },
  {
    name: "3 · The glance",
    at: s30(7.11),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.4} lead={l} />,
  },
  {
    name: "3 · Glasses: the set",
    at: s30(8.24),
    into,
    render: (l) => <GlassesView src={REC.set} from={0.2} lead={l} />,
  },
  {
    name: "4 · The ring tap",
    at: s30(11.66),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.tap} from={1.6} lead={l} focusX={0.62} />
    ),
  },
  {
    name: "4 · Glasses: rest timer",
    at: s30(12.82),
    into,
    render: (l) => <GlassesView src={REC.rest} from={0.0} lead={l} />,
  },
  {
    name: "5 · The wince",
    at: s30(15.67),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.hurts} from={0.7} lead={l} focusX={0.4} />
    ),
  },
  {
    name: "5 · Theo topples",
    at: s30(16.81),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.hurts} from={4.5} lead={l} focusX={0.55} />
    ),
  },
  {
    name: "5 · Glasses: It hurts",
    at: s30(18.53),
    into,
    render: (l) => <GlassesView src={REC.hurts} from={0.8} rate={2} lead={l} />,
  },
  {
    name: "6 · Kitchen, the buzz",
    at: s30(20.81),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.kitchen} from={3.3} lead={l} focusX={0.62} />
    ),
  },
  {
    name: "6 · Phone: the reply",
    at: s30(22.52),
    into,
    render: () => <Phone src={REC.reply} />,
  },
  {
    name: "6 · Phone: tomorrow",
    at: s30(23.68),
    into: next,
    render: () => <Phone src={REC.today} settled />,
  },
  {
    name: "7 · I'm getting an agent",
    at: s30(24.8),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.agent} from={4.95} lead={l} focusX={0.6} />
    ),
  },
  { name: "End card", at: s30(27.1), into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "guess", at: 0.0 },
  { key: "sets", at: at30("2 · How many sets?"), shot: SHOT.sets, from: 0.8 },
  {
    key: "mine",
    at: at30("2 · My agent wrote mine."),
    shot: SHOT.sets,
    from: 5.15,
  },
  { key: "plans", at: 6.9 },
  { key: "tap", at: 11.5 },
  { key: "hurts", at: 15.4 },
  { key: "reads", at: 21.0 },
  {
    key: "getting",
    at: at30("7 · I'm getting an agent"),
    shot: SHOT.agent,
    from: 4.95,
  },
  { key: "tag", at: 26.95, caption: false },
];
const SFX_30: Sfx[] = [
  {
    at: at30("6 · Kitchen, the buzz") + 0.3,
    shot: SHOT.kitchen,
    from: 3.6,
    to: 5.0,
  },
];

// ---------------------------------------------------------------- 15-second cut
// music-15-edit.wav: take 1 ("gym-sting"), 6.5–17.55 s spliced on the beat to 54.71 s–end: the
// groove arrives at 3 s, a stop at 12 s and the final hit at 13 s under the end card.
const END_15 = 15.3;
const s15 = snapper(BEATS_15);
const CLIPS_15: Clip[] = [
  {
    name: "The gym is guessing",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.gym} from={3.6} lead={l} focusX={0.42} />
    ),
  },
  {
    name: "How many sets?",
    at: s15(2.35),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.sets} from={0.9} lead={l} focusX={0.6} />
    ),
  },
  {
    name: "My agent wrote mine.",
    at: s15(4.64),
    into: next,
    render: (l) => (
      <FlowShot
        src={SHOT.sets}
        from={5.2}
        lead={l}
        zoom={1.18}
        origin="30% 40%"
        focusX={0.36}
      />
    ),
  },
  {
    name: "The glance",
    at: s15(6.39),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.5} lead={l} />,
  },
  {
    name: "Glasses: the set",
    at: s15(6.97),
    into,
    render: (l) => <GlassesView src={REC.set} from={0.2} lead={l} />,
  },
  {
    name: "The wince",
    at: s15(9.31),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.hurts} from={0.7} lead={l} focusX={0.4} />
    ),
  },
  {
    name: "Glasses: It hurts",
    at: s15(10.47),
    into,
    render: (l) => (
      <GlassesView src={REC.hurts} from={0.8} rate={2.2} lead={l} />
    ),
  },
  { name: "End card", at: s15(12.35), into: toEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "guess", at: 0.0 },
  { key: "sets", at: at15("How many sets?"), shot: SHOT.sets, from: 0.9 },
  { key: "mine", at: at15("My agent wrote mine."), shot: SHOT.sets, from: 5.2 },
  { key: "puts", at: 6.3 },
  { key: "hurts", at: 9.2 },
  { key: "tag", at: 12.2, caption: false },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  sfx: Sfx[];
  music: string;
  end: number;
}> = ({ clips, lines, sfx, music, end }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={clips} end={end} />
    <CaptionBand />
    <Soundtrack lines={lines} sfx={sfx} music={music} end={end} />
    {lines
      .filter((l) => l.caption !== false)
      .map((l, i, all) => {
        const nextLine = all[i + 1];
        return (
          <KineticCaption
            key={l.key}
            words={LINES[l.key]}
            offset={l.at - (l.from ?? 0)}
            before={nextLine ? span(nextLine)[0] : undefined}
          />
        );
      })}
  </AbsoluteFill>
);

// The speech span of a line in the timeline, from its word timings.
const span = (l: Line): [number, number] => {
  const w: Word[] = LINES[l.key];
  const o = l.at - (l.from ?? 0);
  return [o + w[0][1], o + w[w.length - 1][2]];
};

// Music under everything, ducked under speech; narration from its files; the characters' lines
// and the phone's buzz from their Flow shots' own sound. Flow's sound is muted everywhere else.
const Soundtrack: React.FC<{
  lines: Line[];
  sfx: Sfx[];
  music: string;
  end: number;
}> = ({ lines, sfx, music, end }) => {
  const { fps } = useVideoConfig();
  const last = Math.round(end * fps);
  const speech = lines.map(span);
  const duck = (f: number) => {
    const t = f / fps;
    const d = Math.min(
      ...speech.map(([a, b]) => (t < a ? a - t : t > b ? t - b : 0)),
    );
    return interpolate(d, [0, 0.35], [0.28, 0.6], {
      extrapolateRight: "clamp",
    });
  };
  return (
    <>
      <Audio
        name="Music"
        src={media(music)}
        volume={(f) =>
          duck(f) *
          interpolate(f, [0, 4, last - 6, last], [0, 1, 1, 0.8], {
            extrapolateRight: "clamp",
          })
        }
      />
      {lines.map((l) => {
        const [a, b] = span(l);
        return l.shot ? (
          <Sequence
            key={l.key}
            name={`Flow line: ${l.key}`}
            from={Math.round((a - 0.12) * fps)}
            durationInFrames={Math.round((b - a + 0.35) * fps)}
            layout="none"
          >
            <Audio
              src={l.shot}
              trimBefore={Math.round((a - 0.12 - (l.at - (l.from ?? 0))) * fps)}
              volume={1.6}
            />
          </Sequence>
        ) : (
          <Sequence
            key={l.key}
            name={`Narration: ${l.key}`}
            from={Math.round(l.at * fps)}
            layout="none"
          >
            <Audio src={VO(l.key)} volume={1} />
          </Sequence>
        );
      })}
      {sfx.map((s, i) => (
        <Sequence
          key={i}
          name="Flow sound: phone buzz"
          from={Math.round(s.at * fps)}
          durationInFrames={Math.round((s.to - s.from) * fps)}
          layout="none"
        >
          <Audio
            src={s.shot}
            trimBefore={Math.round(s.from * fps)}
            volume={0.9}
          />
        </Sequence>
      ))}
    </>
  );
};

// A Flow shot filling the frame with a slow push-in; in 9:16 sized to the frame's height and centred
// on `focusX`. Like shared/Product's FlowShot, but with OffthreadVideo: the canvas-backed Video didn't
// scale in the browser these renders use (see media.md).
const FlowShot: React.FC<{
  src: string;
  from: number;
  lead: number;
  zoom?: number;
  origin?: string;
  focusX?: number;
}> = ({ src, from, lead, zoom = 1, origin = "50% 50%", focusX = 0.5 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const push = zoom * (1 + frame * 0.0007);
  const w = Math.max(width, (height * 16) / 9);
  const h = (w * 9) / 16;
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <OffthreadVideo
        src={src}
        trimBefore={Math.max(0, Math.round(from * fps) - lead)}
        muted
        style={{
          position: "absolute",
          width: w,
          height: h,
          maxWidth: "none",
          left: Math.min(0, Math.max(width - w, width / 2 - focusX * w)),
          top: (height - h) / 2,
          transform: `scale(${push})`,
          transformOrigin: origin,
        }}
      />
    </AbsoluteFill>
  );
};

// The G2 display, as if through Maya's glasses: the gym from shot 3 out of focus behind, the green
// display floating over it.
const GlassesView: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
}> = ({ src, from, rate = 1, lead }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const w = vertical ? width * 0.94 : width * 0.66;
  const push = 1 + frame * 0.0006;
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          filter: "blur(18px) brightness(0.45) saturate(0.9)",
          transform: "scale(1.08)",
        }}
      >
        <FlowShot src={SHOT.glance} from={0.3} lead={lead} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: w,
            transform: `scale(${push}) translateY(${vertical ? -120 : -30}px)`,
            filter: `drop-shadow(0 0 14px rgba(61,255,122,0.45))`,
            mixBlendMode: "screen",
          }}
        >
          {/* OffthreadVideo with an explicit size: the canvas-backed Video didn't scale to the box. */}
          <OffthreadVideo
            src={src}
            trimBefore={Math.max(
              0,
              Math.round((from - (lead / fps) * rate) * fps),
            )}
            playbackRate={rate}
            muted
            style={{ width: w, height: w / 2, display: "block" }}
          />
        </div>
      </AbsoluteFill>
      <DemoLabel />
    </AbsoluteFill>
  );
};

// The iPhone app (a still screen from the simulator) in a phone frame on FitLoop's indigo, swinging
// into place and pushing in slowly.
const Phone: React.FC<{ src: string; settled?: boolean }> = ({
  src,
  settled,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  // Big enough to read the agent's reply: the top of the screen in frame, the bottom running off it.
  const h = vertical ? 2500 : 1750;
  const settle = settled
    ? 0
    : interpolate(frame, [0, 16], [1, 0], {
        extrapolateRight: "clamp",
        easing: (t) => 1 - (1 - t) ** 3,
      });
  const push = 1 + frame * 0.0006;
  return (
    <AbsoluteFill
      style={{
        background: INDIGO,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: vertical ? 170 : 70,
      }}
    >
      <div
        style={{
          height: h,
          width: (h * 1206) / 2622 + 28,
          padding: 14,
          borderRadius: h * 0.075,
          background: "#0b0f14",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 2px #2b3440",
          transform: `perspective(1600px) rotateY(${-10 * settle}deg) translateY(${(vertical ? -60 : 0) + 30 * settle}px) scale(${push})`,
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: h * 0.065,
            display: "block",
          }}
        />
      </div>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  const rise = (start: number) => ({
    opacity: interpolate(frame, [start, start + 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    transform: `translateY(${interpolate(frame, [start, start + 12], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
  });
  const icon = vertical ? 260 : 200;
  return (
    <AbsoluteFill
      style={{
        background: INDIGO,
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        color: "white",
      }}
    >
      <Img
        src={media("icon.png")}
        style={{
          width: icon,
          height: icon,
          borderRadius: icon * 0.22,
          boxShadow: "0 0 70px rgba(255,122,69,0.35)",
          ...rise(4),
        }}
      />
      <div
        style={{
          fontSize: vertical ? 120 : 104,
          fontWeight: 800,
          letterSpacing: -2,
          marginTop: 34,
          ...rise(10),
        }}
      >
        FitLoop
      </div>
      <div
        style={{
          fontSize: vertical ? 54 : 50,
          fontWeight: 500,
          color: ORANGE,
          marginTop: 6,
          textAlign: "center",
          padding: "0 60px",
          lineHeight: 1.25,
          ...rise(16),
        }}
      >
        {vertical ? (
          <>
            Your agent coaches.
            <br />
            FitLoop keeps you on the plan.
          </>
        ) : (
          "Your agent coaches. FitLoop keeps you on the plan."
        )}
      </div>
      <div
        style={{
          fontSize: vertical ? 30 : 26,
          fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          marginTop: 34,
          textAlign: "center",
          padding: "0 40px",
          ...rise(22),
        }}
      >
        iPhone · Apple Watch · web · Even G2 glasses
      </div>
      <div
        style={{
          position: "absolute",
          bottom: vertical ? 200 : 52,
          left: 60,
          right: 60,
          textAlign: "center",
          fontSize: vertical ? 26 : 22,
          fontWeight: 500,
          color: "rgba(255,255,255,0.6)",
          lineHeight: 1.4,
          ...rise(26),
        }}
      >
        Works with any MCP agent. Plans shown are demo data. Not medical advice.
        People and scenes are AI-generated.
      </div>
    </AbsoluteFill>
  );
};

const Promo30: React.FC = () => (
  <Promo
    clips={CLIPS_30}
    lines={LINES_30}
    sfx={SFX_30}
    music="music-30-edit.wav"
    end={END_30}
  />
);
const Promo15: React.FC = () => (
  <Promo
    clips={CLIPS_15}
    lines={LINES_15}
    sfx={[]}
    music="music-15-edit.wav"
    end={END_15}
  />
);

// Where each cut's speech sits, for its subtitle file (scripts/fitloop-launch-srt.mjs).
export const SPEECH = {
  "fitloop-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "fitloop-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "fitloop-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const FitloopLaunch = () => (
  <>
    <Composition
      id="fitloop-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="fitloop-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="fitloop-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
