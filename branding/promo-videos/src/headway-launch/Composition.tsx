import { Audio, Video } from "@remotion/media";
import { TransitionPresentation } from "@remotion/transitions";
import { blurSlide } from "@remotion/transitions/blur-slide";
import { crossZoom } from "@remotion/transitions/cross-zoom";
import { dreamyZoom } from "@remotion/transitions/dreamy-zoom";
import {
  AbsoluteFill,
  Composition,
  Img,
  interpolate,
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
import { FlowShot, PhoneRecording } from "../shared/Product";
import { BEATS_15, BEATS_30, LINES, Word } from "./voiceover";

// Headway launch promo (reports/2026-10-30-headway-promo-video): everyone in the city runs for the
// train except Lin. Flow shots carry the comedy, with the characters' own lines from Flow ("Hold the
// door!", "Me? I don't run.", Max's "Stop the train!", "Bye, Max!"); real recordings show the
// product (glasses display through her eyes, iPhone alerts); narration af_heart (Kokoro) between.
// Media: public/headway-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`headway-launch/${file}`);
const GREEN = "#3dff7a";
const DEEP =
  "radial-gradient(circle at 50% 35%, #0f2a1a 0%, #071a10 55%, #020a06 100%)";

const SHOT = {
  city: media("shot-1_3dd25f09_1080p.mp4"),
  doors: media("shot-2_8a274762_1080p.mp4"),
  glance: media("shot-3_71eace70_1080p.mp4"),
  ring: media("shot-4_e9ea69f9_1080p.mp4"),
  cafe: media("shot-5_5067d91a_1080p.mp4"),
  train: media("shot-6_615d6383_1080p.mp4"),
  byeMax: media("shot-7_f2f5bf02_1080p.mp4"),
};
const REC = {
  board: media("rec-glasses-board.mp4"),
  swipe: media("rec-glasses-swipe.mp4"),
  leave: media("rec-phone-leave.mp4"),
  stop: media("rec-phone-stop.mp4"),
};
const VO = (key: string) => media(`vo-af_heart-${key}.wav`);

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const toEnd = { presentation: dreamyZoom({}) as P, frames: 16 };

// Cuts land on the music's beats: each planned cut moves to the nearest beat within 0.25 s.
const snapper = (beats: number[], musicFrom: number) => (t: number) => {
  if (t === 0) return 0;
  const near = beats
    .map((b) => b - musicFrom)
    .reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
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

// ---------------------------------------------------------------- 30-second cut
const END_30 = 30.3;
const MUSIC_30 = { file: "30-sec-music-take-2.mp3", from: 7.4 };
const s30 = snapper(BEATS_30, MUSIC_30.from);
const CLIPS_30: Clip[] = [
  {
    name: "1 · The city runs",
    at: 0,
    render: (l) => <FlowShot src={SHOT.city} from={1.0} lead={l} />,
  },
  {
    name: "2 · Hold the door!",
    at: s30(3.3),
    into: next,
    render: (l) => <FlowShot src={SHOT.doors} from={0.0} lead={l} />,
  },
  {
    name: "2 · Me? I don't run.",
    at: s30(5.6),
    into: next,
    render: (l) => <FlowShot src={SHOT.doors} from={5.5} lead={l} />,
  },
  {
    name: "3 · The glance",
    at: s30(7.9),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.5} lead={l} />,
  },
  {
    name: "3 · Glasses board",
    at: s30(9.1),
    into,
    render: (l) => <GlassesView src={REC.board} from={0.3} lead={l} />,
  },
  {
    name: "4 · The ring",
    at: s30(12.0),
    into: next,
    render: (l) => <FlowShot src={SHOT.ring} from={0.3} lead={l} />,
  },
  {
    name: "4 · Ring swipe",
    at: s30(13.2),
    into,
    render: (l) => <GlassesView src={REC.swipe} from={0.7} lead={l} />,
  },
  {
    name: "5 · Café, the tap",
    at: s30(16.0),
    into: next,
    render: (l) => <FlowShot src={SHOT.cafe} from={2.5} lead={l} />,
  },
  {
    name: "5 · Leave now",
    at: s30(17.3),
    into,
    render: (l) => <Phone src={REC.leave} from={2.9} lead={l} />,
  },
  {
    name: "6 · On the train",
    at: s30(19.9),
    into: next,
    render: (l) => <FlowShot src={SHOT.train} from={1.6} lead={l} />,
  },
  {
    name: "6 · Before her stop",
    at: s30(20.9),
    into,
    render: (l) => <Phone src={REC.stop} from={2.9} lead={l} />,
  },
  {
    name: "6 · Max asleep",
    at: s30(22.4),
    into: next,
    render: (l) => <FlowShot src={SHOT.train} from={5.0} lead={l} />,
  },
  {
    name: "7 · Bye, Max",
    at: 23.2,
    into: next,
    render: (l) => <FlowShot src={SHOT.byeMax} from={2.0} lead={l} />,
  },
  { name: "End card", at: 27.3, into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "city", at: 0.15 },
  { key: "door", at: at30("2 · Hold the door!"), shot: SHOT.doors, from: 0.0 },
  { key: "me", at: at30("2 · Me? I don't run."), shot: SHOT.doors, from: 5.5 },
  { key: "wear", at: 7.95 },
  { key: "ring", at: 12.15 },
  { key: "taps", at: 16.05 },
  { key: "stop", at: 19.85 },
  { key: "max", at: 23.2, shot: SHOT.byeMax, from: 2.0 },
  { key: "bye", at: 23.2, shot: SHOT.byeMax, from: 2.0 },
  { key: "tag", at: 27.45, caption: false },
];

// ---------------------------------------------------------------- 15-second cut
const END_15 = 15.3;
const MUSIC_15 = { file: "15-sec-music-take-2.mp3", from: 46.6 };
const s15 = snapper(BEATS_15, MUSIC_15.from);
const CLIPS_15: Clip[] = [
  {
    name: "The city runs",
    at: 0,
    render: (l) => <FlowShot src={SHOT.city} from={1.6} lead={l} />,
  },
  {
    name: "Hold the door!",
    at: s15(3.0),
    into: next,
    render: (l) => <FlowShot src={SHOT.doors} from={0.0} lead={l} />,
  },
  {
    name: "Me? I don't run.",
    at: s15(4.6),
    into: next,
    render: (l) => <FlowShot src={SHOT.doors} from={6.3} lead={l} />,
  },
  {
    name: "The glance",
    at: s15(6.2),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.7} lead={l} />,
  },
  {
    name: "Glasses board",
    at: s15(6.9),
    into,
    render: (l) => <GlassesView src={REC.board} from={0.3} lead={l} />,
  },
  {
    name: "Café, the tap",
    at: s15(9.4),
    into: next,
    render: (l) => <FlowShot src={SHOT.cafe} from={2.6} lead={l} />,
  },
  {
    name: "Leave now",
    at: s15(10.4),
    into,
    render: (l) => <Phone src={REC.leave} from={3.0} lead={l} />,
  },
  { name: "End card", at: 12.4, into: toEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "city", at: 0.15 },
  { key: "door", at: at15("Hold the door!"), shot: SHOT.doors, from: 0.0 },
  { key: "me", at: at15("Me? I don't run."), shot: SHOT.doors, from: 6.3 },
  { key: "puts", at: 6.3 },
  { key: "go", at: 9.55 },
  { key: "tag", at: 12.5, caption: false },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  music: { file: string; from: number };
  end: number;
}> = ({ clips, lines, music, end }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={clips} end={end} />
    <CaptionBand />
    <Soundtrack lines={lines} music={music} end={end} />
    {lines
      .filter((l) => l.caption !== false)
      .map((l) => (
        <KineticCaption
          key={l.key}
          words={LINES[l.key]}
          offset={l.at - (l.from ?? 0)}
        />
      ))}
  </AbsoluteFill>
);

// The speech span of a line in the timeline, from its word timings.
const span = (l: Line): [number, number] => {
  const w: Word[] = LINES[l.key];
  const o = l.at - (l.from ?? 0);
  return [o + w[0][1], o + w[w.length - 1][2]];
};

// Music under everything (starting so it ends on the track's own ending), ducked under speech;
// narration from its files; the characters' lines from their Flow shots' own sound.
const Soundtrack: React.FC<{
  lines: Line[];
  music: { file: string; from: number };
  end: number;
}> = ({ lines, music, end }) => {
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
        src={media(music.file)}
        trimBefore={Math.round(music.from * fps)}
        volume={(f) =>
          duck(f) *
          interpolate(f, [0, 4, last - 20, last], [0, 1, 1, 0.7], {
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
    </>
  );
};

// The glasses display, as if through Lin's glasses: the street from shot 3 out of focus behind,
// the green display floating over it.
const GlassesView: React.FC<{ src: string; from: number; lead: number }> = ({
  src,
  from,
  lead,
}) => {
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
        <FlowShot src={SHOT.glance} from={5.5} lead={lead} />
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
          <Video
            src={src}
            trimBefore={Math.max(0, Math.round(from * fps) - lead)}
            muted
            style={{ width: "100%", display: "block", mixBlendMode: "screen" }}
          />
        </div>
      </AbsoluteFill>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const Phone: React.FC<{ src: string; from: number; lead: number }> = (p) => (
  <PhoneRecording {...p} backdrop={DEEP} />
);

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
        background: DEEP,
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
          boxShadow: "0 0 60px rgba(61,255,122,0.25)",
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
        Headway
      </div>
      <div
        style={{
          fontSize: vertical ? 56 : 50,
          fontWeight: 500,
          color: GREEN,
          marginTop: 6,
          textAlign: "center",
          padding: "0 60px",
          ...rise(16),
        }}
      >
        Your next Caltrain, at a glance.
      </div>
      <div
        style={{
          fontSize: vertical ? 30 : 26,
          fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          marginTop: 34,
          ...rise(22),
        }}
      >
        Even G2 glasses · R1 ring · iPhone · Apple Watch
      </div>
      <div
        style={{
          position: "absolute",
          bottom: vertical ? 200 : 52,
          left: 40,
          right: 40,
          textAlign: "center",
          fontSize: vertical ? 26 : 22,
          fontWeight: 500,
          color: "rgba(255,255,255,0.6)",
          ...rise(26),
        }}
      >
        Not affiliated with Caltrain. Alerts shown are a demonstration. People
        and scenes are AI-generated.
      </div>
    </AbsoluteFill>
  );
};

const Promo30: React.FC = () => (
  <Promo clips={CLIPS_30} lines={LINES_30} music={MUSIC_30} end={END_30} />
);
const Promo15: React.FC = () => (
  <Promo clips={CLIPS_15} lines={LINES_15} music={MUSIC_15} end={END_15} />
);

// Where each cut's speech sits, for its subtitle file (scripts/headway-launch-srt.mjs).
export const SPEECH = {
  "headway-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "headway-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "headway-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const HeadwayLaunch = () => (
  <>
    <Composition
      id="headway-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="headway-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="headway-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
