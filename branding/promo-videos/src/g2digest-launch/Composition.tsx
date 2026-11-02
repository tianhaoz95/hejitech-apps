import { Audio, Video } from "@remotion/media";
import { TransitionPresentation } from "@remotion/transitions";
import { blurSlide } from "@remotion/transitions/blur-slide";
import { crossZoom } from "@remotion/transitions/cross-zoom";
import { dreamyZoom } from "@remotion/transitions/dreamy-zoom";
import { fade } from "@remotion/transitions/fade";
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
import { FlowShot } from "../shared/Product";
import { LINES, Word } from "./voiceover";

// G2 Digest launch promo (reports/2026-11-01-g2digest-promo-video): underground, nothing loads,
// except Sam's brief, which his agent built overnight. Flow shots carry the comedy with the
// characters' own lines (Bea: "Is anyone's news loading?", Sam: "Mine was ready last night.",
// Bea: "It loaded! Oh, this is my stop."); real recordings show the product (the glasses display
// from the Even Hub simulator, the web app); Sam's narration is Kokoro am_echo, the closest to his
// Flow voice. Media: public/g2digest-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`g2digest-launch/${file}`);
const GREEN = "#3dff7a";
const DEEP =
  "radial-gradient(circle at 50% 35%, #0f2a1a 0%, #071a10 55%, #020a06 100%)";

const SHOT = {
  tunnel: media("Shot_1_draft_fa9eca7e_1080p.mp4"),
  loading: media("Shot_2_draft_5077911d_1080p.mp4"),
  glance: media("Shot_3_draft_259dd7ac_1080p.mp4"),
  ring: media("Shot_4_draft_0657d1fc_1080p.mp4"),
  listen: media("Shot_5_draft_78555101_1080p.mp4"),
  night: media("Shot_6_draft_54e21e40_1080p.mp4"),
  loaded: media("Shot_7_draft_b0a34f35_1080p.mp4"),
};
const REC = {
  open: media("rec-glasses-open.mp4"),
  swipe: media("rec-glasses-swipe.mp4"),
  deep: media("rec-glasses-deepdive.mp4"),
  brief: media("rec-web-brief.mp4"),
  preview: media("rec-web-edition.mp4"),
};
const VOICE = "am_echo";
const VO = (key: string) => media(`vo-${VOICE}-${key}.wav`);
const MUSIC = media("music-15s-take1-buffered-calm.mp3");

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const toEnd = { presentation: dreamyZoom({}) as P, frames: 16 };
// From the glasses view (screen-blended) dreamy zoom flashes white: a plain fade there.
const fadeToEnd = { presentation: fade() as P, frames: 14 };

// The music is one Flow Music track (103.4 BPM, measured with librosa: a beat every 0.5796 s, the
// first downbeat at 0.07 s), cut on its bar lines: its two "buffering" bars, then (30 s only) its
// one-bar stop under Sam's deadpan line, then the groove from bar 17 (30 s) or 23 (15 s) to the
// track's own ending. Every cut sits on a beat of that edited bed.
const B = 0.5796;
const BAR = 4 * B;
const bar = (k: number) => 0.07 + k * BAR; // track time of bar k's downbeat
const TRACK_END = 63.2; // the last chord has rung out
type Seg = { at: number; from: number; to: number };
const bed = (groove: number, withStop: boolean): Seg[] => {
  const segs: Seg[] = [{ at: 0, from: bar(0), to: bar(2) }];
  if (withStop) segs.push({ at: 2 * BAR, from: bar(4), to: bar(5) });
  const at = (withStop ? 3 : 2) * BAR;
  segs.push({ at, from: bar(groove), to: TRACK_END });
  return segs;
};
const bedEnd = (segs: Seg[]) => {
  const s = segs[segs.length - 1];
  return s.at + s.to - s.from;
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
const MUSIC_30 = bed(17, true);
const END_30 = Math.round(bedEnd(MUSIC_30) * FPS) / FPS;
const g30 = (n: number) => 3 * BAR + n * B; // beat n of the groove
const CLIPS_30: Clip[] = [
  {
    name: "1 · Into the tunnel",
    at: 0,
    render: (l) => <FlowShot src={SHOT.tunnel} from={0.0} lead={l} />,
  },
  {
    name: "2 · Is anyone's news loading?",
    at: BAR,
    into: next,
    render: (l) => <FlowShot src={SHOT.loading} from={0.75} lead={l} />,
  },
  {
    name: "2 · Mine was ready last night.",
    at: 2 * BAR,
    into: next,
    render: (l) => <FlowShot src={SHOT.loading} from={4.35} lead={l} />,
  },
  {
    name: "3 · The glance",
    at: 2 * BAR + 3 * B,
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.9} lead={l} />,
  },
  {
    name: "3 · Glasses: today's edition",
    at: g30(1),
    into,
    render: (l) => <GlassesView src={REC.open} from={0.5} lead={l} />,
  },
  {
    name: "4 · The ring",
    at: g30(6),
    into: next,
    render: (l) => <FlowShot src={SHOT.ring} from={0.2} lead={l} />,
  },
  {
    name: "4 · Glasses: swipe",
    at: g30(8),
    into,
    render: (l) => <GlassesView src={REC.swipe} from={0.4} lead={l} />,
  },
  {
    name: "5 · Earbud, listening",
    at: g30(13),
    into: next,
    render: (l) => <FlowShot src={SHOT.listen} from={0.0} lead={l} />,
  },
  {
    name: "5 · Glasses: deep dive",
    at: g30(15),
    into,
    render: (l) => <GlassesView src={REC.deep} from={0.6} lead={l} />,
  },
  {
    name: "6 · The night before",
    at: g30(19),
    into: next,
    render: (l) => <FlowShot src={SHOT.night} from={0.4} lead={l} />,
  },
  {
    name: "6 · Web: the brief",
    at: g30(21),
    into,
    render: (l) => (
      <WebView src={REC.brief} from={2.4} lead={l} zoom={1.35} originX={2} originY={46} />
    ),
  },
  {
    name: "6 · Web: the edition",
    at: g30(24),
    into: next,
    render: (l) => <WebView src={REC.preview} from={0.5} lead={l} />,
  },
  {
    name: "7 · It loaded!",
    at: g30(27),
    into: next,
    render: (l) => <FlowShot src={SHOT.loaded} from={1.2} lead={l} />,
  },
  {
    name: "7 · Oh, this is my stop.",
    at: g30(30),
    into: next,
    render: (l) => <FlowShot src={SHOT.loaded} from={4.2} lead={l} />,
  },
  {
    name: "7 · Sam steps off",
    at: g30(33),
    into: next,
    render: (l) => <FlowShot src={SHOT.loaded} from={6.4} lead={l} />,
  },
  { name: "End card", at: g30(35), into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "under", at: 0.25 },
  { key: "bea", at: at30("2 · Is anyone's news loading?"), shot: SHOT.loading, from: 0.75 },
  { key: "sam", at: at30("2 · Mine was ready last night."), shot: SHOT.loading, from: 4.35 },
  { key: "agent", at: 6.6 },
  { key: "swipe", at: 10.8 },
  { key: "hold", at: 14.6 },
  { key: "write", at: 18.05 },
  { key: "loaded", at: at30("7 · It loaded!"), shot: SHOT.loaded, from: 1.2 },
  { key: "stop", at: at30("7 · Oh, this is my stop."), shot: SHOT.loaded, from: 4.2 },
  { key: "tag", at: 26.4, caption: false },
];

// ---------------------------------------------------------------- 15-second cut (and 9:16)
const MUSIC_15 = bed(23, false);
const END_15 = Math.round(bedEnd(MUSIC_15) * FPS) / FPS;
const g15 = (n: number) => 2 * BAR + n * B;
const CLIPS_15: Clip[] = [
  {
    name: "Into the tunnel",
    at: 0,
    render: (l) => <FlowShot src={SHOT.tunnel} from={0.0} lead={l} focusX={0.42} />,
  },
  {
    name: "Is anyone's news loading?",
    at: BAR,
    into: next,
    render: (l) => <FlowShot src={SHOT.loading} from={0.75} lead={l} focusX={0.4} />,
  },
  {
    name: "The glance",
    at: g15(0),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.9} lead={l} focusX={0.45} />,
  },
  {
    name: "Glasses: today's edition",
    at: g15(1),
    into,
    render: (l) => <GlassesView src={REC.open} from={0.6} lead={l} />,
  },
  {
    name: "The ring",
    at: g15(5),
    into: next,
    render: (l) => <FlowShot src={SHOT.ring} from={0.2} lead={l} focusX={0.4} />,
  },
  {
    name: "Glasses: swipe",
    at: g15(6),
    into,
    render: (l) => <GlassesView src={REC.swipe} from={0.6} lead={l} />,
  },
  {
    name: "Glasses: deep dive",
    at: g15(9),
    into: next,
    render: (l) => <GlassesView src={REC.deep} from={0.6} lead={l} />,
  },
  { name: "End card", at: g15(11), into: fadeToEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "under", at: 0.25 },
  { key: "bea", at: at15("Is anyone's news loading?"), shot: SHOT.loading, from: 0.75 },
  { key: "ready15", at: 4.65 },
  { key: "skim15", at: 8.85 },
  { key: "tag", at: 11.2, caption: false },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  music: Seg[];
  end: number;
}> = ({ clips, lines, music, end }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={clips} end={end} />
    <CaptionBand />
    <Soundtrack lines={lines} music={music} end={end} />
    {lines
      .filter((l) => l.caption !== false)
      .map((l, i, shown) => (
        <KineticCaption
          key={l.key}
          words={LINES[l.key]}
          offset={l.at - (l.from ?? 0)}
          before={shown[i + 1] ? span(shown[i + 1])[0] : undefined}
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

// The music bed (its segments with a 3-frame fade at each splice), ducked under speech; narration
// from its files; the characters' lines from their Flow shots' own sound (every other Flow sound,
// ad-libs included, stays muted).
const Soundtrack: React.FC<{ lines: Line[]; music: Seg[]; end: number }> = ({
  lines,
  music,
  end,
}) => {
  const { fps } = useVideoConfig();
  const last = Math.round(end * fps);
  const speech = lines.map(span);
  const duck = (t: number) => {
    const d = Math.min(
      ...speech.map(([a, b]) => (t < a ? a - t : t > b ? t - b : 0)),
    );
    return interpolate(d, [0, 0.35], [0.3, 0.62], {
      extrapolateRight: "clamp",
    });
  };
  return (
    <>
      {music.map((s, i) => {
        const from = Math.round(s.at * fps);
        const len = Math.min(Math.round((s.to - s.from) * fps), last - from);
        return (
          <Sequence key={i} name={`Music ${i + 1}`} from={from} durationInFrames={len} layout="none">
            <Audio
              src={MUSIC}
              trimBefore={Math.round(s.from * fps)}
              volume={(f) =>
                duck((from + f) / fps) *
                interpolate(f, [0, 3, len - 3, len], [i === 0 ? 1 : 0, 1, 1, i === music.length - 1 ? 1 : 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              }
            />
          </Sequence>
        );
      })}
      {lines.map((l) => {
        const [a, b] = span(l);
        return l.shot ? (
          <Sequence
            key={l.key}
            name={`Flow line: ${l.key}`}
            from={Math.round((a - 0.12) * fps)}
            durationInFrames={Math.round((b - a + 0.3) * fps)}
            layout="none"
          >
            <Audio
              src={l.shot}
              trimBefore={Math.round((a - 0.12 - (l.at - (l.from ?? 0))) * fps)}
              volume={(f) => 0.5 * interpolate(f, [0, 3], [0, 1], { extrapolateRight: "clamp" })}
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

// The glasses display, as if through Sam's glasses: the carriage out of focus behind, the green
// display floating over it (simulator frames: lit pixels on black, so "screen" blends them in).
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
          filter: "blur(18px) brightness(0.42) saturate(0.85)",
          transform: "scale(1.08)",
        }}
      >
        <FlowShot src={SHOT.tunnel} from={1.0} lead={lead} />
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

// The web app (dark theme) in a dark window on the brand green, pushing in; `zoom` with `originX` /
// `originY` (percent of the recording) frames the part that matters.
const WebView: React.FC<{
  src: string;
  from: number;
  lead: number;
  zoom?: number;
  originX?: number;
  originY?: number;
}> = ({ src, from, lead, zoom = 1, originX = 50, originY = 50 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const w = vertical ? 1010 : 1380;
  const push = 1 + frame * 0.0006;
  const z = vertical ? Math.max(zoom, 1.6) : zoom;
  return (
    <AbsoluteFill
      style={{
        background: DEEP,
        alignItems: "center",
        justifyContent: vertical ? "center" : "flex-start",
        paddingTop: vertical ? 0 : 40,
      }}
    >
      <div
        style={{
          width: w,
          borderRadius: 18,
          overflow: "hidden",
          background: "#0b110d",
          transform: `scale(${push}) translateY(${vertical ? -150 : 0}px)`,
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(61,255,122,0.18)",
        }}
      >
        <div
          style={{
            height: 34,
            background: "#18211b",
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 16,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
          ))}
        </div>
        <div style={{ height: vertical ? 900 : (w * 9) / 16, overflow: "hidden" }}>
          <Video
            src={src}
            trimBefore={Math.max(0, Math.round(from * fps) - lead)}
            muted
            style={{
              width: "100%",
              display: "block",
              transform: `scale(${z})`,
              transformOrigin: `${originX}% ${originY}%`,
            }}
          />
        </div>
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
        G2 Digest
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
        Your brief, ready before the train.
      </div>
      <div
        style={{
          fontSize: vertical ? 30 : 26,
          fontWeight: 500,
          color: "rgba(255,255,255,0.72)",
          marginTop: 34,
          textAlign: "center",
          padding: "0 60px",
          ...rise(22),
        }}
      >
        For Even G2 glasses + R1 ring · Works with any MCP agent
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
        Not affiliated with Even Realities. Editions shown are demo data. People
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

// Where each cut's speech sits, for its subtitle file (scripts/g2digest-launch-srt.mjs).
export const SPEECH = {
  "g2digest-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "g2digest-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "g2digest-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const G2digestLaunch = () => (
  <>
    <Composition
      id="g2digest-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="g2digest-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="g2digest-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
