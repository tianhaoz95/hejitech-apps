import { Audio } from "@remotion/media";
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
import { FlowShot } from "../shared/Product";
import { LINES, Word } from "./voiceover";

// TinyTouch launch promo (reports/2026-10-31-tinytouch-promo-video): two-year-old Pip keeps calling
// her dad's boss from his watch. The Flow shots carry the joke with Leo's and Pip's own lines ("Please
// don't call anyone.", "Hiii!", "She's called my boss. Twice.", "Zero calls."); the product is real
// recordings of the watch and iPhone apps on paired simulators, driven by UI tests
// (scripts/tinytouch-launch-record.mjs). Narration am_echo (Kokoro) as Leo. Media:
// public/tinytouch-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`tinytouch-launch/${file}`);
const STAR = "#ffe45c";
const PURPLE =
  "linear-gradient(135deg, #2a1f5c 0%, #4a2a80 45%, #7a3d86 75%, #c85f72 100%)";
const NIGHT =
  "radial-gradient(circle at 50% 35%, #4a2a80 0%, #2a1f5c 55%, #150f30 100%)";

const SHOT = {
  grab: media("shot-1_2a383874_1080p.mp4"),
  hi: media("shot-2_7c66a367_1080p.mp4"),
  boss: media("shot-3_1ed7edb7_1080p.mp4"),
  turn: media("shot-4_b47aea52_1080p.mp4"),
  remote: media("shot-5_2ba75d02_1080p.mp4"),
  zero: media("shot-6_7282292c_1080p.mp4"),
};
const REC = {
  bubbles: media("rec-watch-bubbles.mp4"),
  animals: media("rec-watch-animals.mp4"),
  swipe: media("rec-watch-swipe.mp4"),
  garden: media("rec-watch-garden.mp4"),
  shield: media("rec-watch-shield.mp4"),
  phone: media("rec-phone-remote.mp4"),
};
const VO = (key: string) => media(`vo-am_echo-${key}.wav`);

// Shot 2: Flow burned "Hiii!" into the frame from 4.25 s, low in the middle; a 1.2× zoom anchored at
// the top keeps it out. Shot 6 opens on a pink watch with a lit screen (used from 2.85 s only) and
// still glows at the bottom edge: the same zoom.
const TOP = "50% 0%";

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const swap = { presentation: fade() as P, frames: 6 }; // between screens of one device
const toEnd = { presentation: dreamyZoom({}) as P, frames: 16 };

// The music is take 2 / take 1 of Flow Music's tracks, 104.1 BPM (a beat is 0.5763 s, measured with
// librosa over each groove). Cut times below are on that grid: the groove kicks in at `GROOVE`.
const BEAT = 0.5763;

// Speech in the timeline: narration files and the characters' lines from Flow shots.
type Line = {
  key: string;
  at: number;
  shot?: string;
  from?: number;
  caption?: boolean;
};

// The music in parts: `from` is the track's time at cut 0 for that part, so the track at cut t is
// from + t. Each cut opens on the track's quiet intro, the groove comes in as Leo hands Pip the watch,
// then the edit jumps (on a beat) to just before the track's own stop and final hit.
type Music = { file: string; parts: { until: number; from: number }[] };

// ---------------------------------------------------------------- 30-second cut
const END_30 = 30.0;
const G30 = 8.3; // the groove (track 27.24 s) under shot 4
const b30 = (k: number) => +(G30 + k * BEAT).toFixed(3);
const MUSIC_30: Music = {
  file: "30-sec-music-take-2.mp3",
  parts: [
    { until: b30(31), from: 27.24 - G30 },
    // track 117.623: a beat before the final hit at 118.2, so the hit lands on b30(32) with the end card
    { until: END_30, from: 117.623 - b30(31) },
  ],
};
const CLIPS_30: Clip[] = [
  {
    name: "1 · The grab",
    at: 0,
    render: (l) => <FlowShot src={SHOT.grab} from={3.9} lead={l} />,
  },
  {
    name: "2 · Hiii!",
    at: b30(-9),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.hi} from={3.2} lead={l} zoom={1.2} origin={TOP} focusX={0.36} />
    ),
  },
  {
    name: "3 · My boss",
    at: b30(-5),
    into: next,
    render: (l) => <FlowShot src={SHOT.boss} from={3.05} lead={l} />,
  },
  {
    name: "4 · Her turn",
    at: b30(0),
    into: next,
    render: (l) => <FlowShot src={SHOT.turn} from={2.6} lead={l} focusX={0.42} />,
  },
  {
    name: "4 · Bubbles",
    at: b30(4),
    into,
    render: (l) => <Watch src={REC.bubbles} from={0.6} lead={l} behind={SHOT.turn} />,
  },
  {
    name: "4 · Animals",
    at: b30(7),
    into: swap,
    render: (l) => <Watch src={REC.animals} from={1.0} lead={l} behind={SHOT.turn} />,
  },
  {
    name: "4 · Swipes",
    at: b30(9),
    into: swap,
    render: (l) => <Watch src={REC.swipe} from={1.0} lead={l} behind={SHOT.turn} />,
  },
  {
    name: "5 · The remote",
    at: b30(16),
    into: next,
    render: (l) => <FlowShot src={SHOT.remote} from={1.9} lead={l} />,
  },
  {
    name: "5 · Sound Garden",
    at: b30(18),
    into,
    render: (l) => (
      <Phone src={REC.phone} from={0.4} lead={l} tap={{ at: 0.85, x: 0.71, y: 0.6 }} />
    ),
  },
  {
    name: "5 · The watch follows",
    at: b30(20),
    into: next,
    render: (l) => <Watch src={REC.garden} from={3.2} lead={l} behind={SHOT.remote} />,
  },
  {
    name: "6 · The 3-second hold",
    at: b30(22),
    into: swap,
    render: (l) => (
      <Watch src={REC.shield} from={0.8} rate={1.25} lead={l} behind={SHOT.remote} />
    ),
  },
  {
    name: "7 · Zero calls",
    at: b30(28),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.zero} from={2.85} lead={l} zoom={1.15} origin={TOP} />
    ),
  },
  { name: "End card", at: b30(31) + 0.4, into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "please", at: 0, shot: SHOT.grab, from: 3.9 },
  { key: "hi", at: at30("2 · Hiii!"), shot: SHOT.hi, from: 3.2 },
  { key: "boss", at: at30("3 · My boss"), shot: SHOT.boss, from: 3.05 },
  { key: "twice", at: at30("3 · My boss"), shot: SHOT.boss, from: 3.05 },
  { key: "first", at: 8.45 },
  { key: "play", at: 11.15 },
  { key: "nothing", at: 14.1 },
  { key: "phone", at: 17.6 },
  { key: "hold", at: 20.95 },
  { key: "zero", at: at30("7 · Zero calls"), shot: SHOT.zero, from: 2.85 },
  { key: "tag", at: 26.95, caption: false },
];

// ---------------------------------------------------------------- 15-second cut
const END_15 = 15.0;
const G15 = 4.9; // the groove (track 17.92 s) under shot 4
const b15 = (k: number) => +(G15 + k * BEAT).toFixed(3);
const MUSIC_15: Music = {
  file: "15-sec-music-take-1.mp3",
  parts: [
    { until: b15(10), from: 17.92 - G15 },
    // track 100.08, a beat, then the drop into the track's quiet outro at 100.45, under the end card
    { until: END_15, from: 100.08 - b15(10) },
  ],
};
const CLIPS_15: Clip[] = [
  {
    name: "Hiii!",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.hi} from={3.25} lead={l} zoom={1.2} origin={TOP} focusX={0.36} />
    ),
  },
  {
    name: "My boss",
    at: b15(-5),
    into: next,
    render: (l) => <FlowShot src={SHOT.boss} from={3.0} lead={l} focusX={0.45} />,
  },
  {
    name: "Her turn",
    at: b15(0),
    into: next,
    render: (l) => <FlowShot src={SHOT.turn} from={2.6} lead={l} focusX={0.42} />,
  },
  {
    name: "Bubbles",
    at: b15(2),
    into,
    render: (l) => <Watch src={REC.bubbles} from={0.6} lead={l} behind={SHOT.turn} />,
  },
  {
    name: "Swipes",
    at: b15(4),
    into: swap,
    render: (l) => <Watch src={REC.swipe} from={1.0} lead={l} behind={SHOT.turn} />,
  },
  {
    name: "The 3-second hold",
    at: b15(6),
    into: swap,
    render: (l) => (
      <Watch src={REC.shield} from={1.0} rate={1.4} lead={l} behind={SHOT.turn} />
    ),
  },
  { name: "End card", at: b15(11), into: toEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "hi", at: 0, shot: SHOT.hi, from: 3.25 },
  { key: "boss", at: at15("My boss"), shot: SHOT.boss, from: 3.0 },
  { key: "twice", at: at15("My boss"), shot: SHOT.boss, from: 3.0 },
  { key: "turns", at: 5.0 },
  { key: "hold15", at: 8.6 },
  { key: "tag", at: 11.55, caption: false },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  music: Music;
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
          before={shown[i + 1] && span(shown[i + 1])[0]}
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

// Music under everything, ducked under speech, its parts crossfaded over a few frames at the splice;
// narration from its files; the characters' lines from their Flow shots' own sound (the rest of
// Flow's sound, ad-libs included, stays muted).
const Soundtrack: React.FC<{ lines: Line[]; music: Music; end: number }> = ({
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
  const X = 3; // crossfade frames at a splice
  return (
    <>
      {music.parts.map((p, i) => {
        const start =
          i === 0 ? 0 : Math.round(music.parts[i - 1].until * fps) - X;
        const stop =
          Math.round(p.until * fps) + (i + 1 < music.parts.length ? X : 0);
        return (
          <Sequence
            key={i}
            name={`Music ${i + 1}`}
            from={start}
            durationInFrames={stop - start}
            layout="none"
          >
            <Audio
              src={media(music.file)}
              trimBefore={Math.round((p.from + start / fps) * fps)}
              volume={(f) => {
                const g = start + f; // frame in the cut
                const xin =
                  i === 0
                    ? interpolate(g, [0, 4], [0, 1], {
                        extrapolateRight: "clamp",
                      })
                    : interpolate(f, [0, 2 * X], [0, 1], {
                        extrapolateRight: "clamp",
                      });
                const xout =
                  i + 1 < music.parts.length
                    ? interpolate(
                        f,
                        [stop - start - 2 * X, stop - start],
                        [1, 0],
                        { extrapolateLeft: "clamp" },
                      )
                    : interpolate(g, [last - 18, last], [1, 0], {
                        extrapolateLeft: "clamp",
                      });
                return duck(g / fps) * xin * xout;
              }}
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
            from={Math.round((a - 0.1) * fps)}
            durationInFrames={Math.round((b - a + 0.3) * fps)}
            layout="none"
          >
            <Audio
              src={l.shot}
              trimBefore={Math.round((a - 0.1 - (l.at - (l.from ?? 0))) * fps)}
              volume={1.5}
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

// A watch recording (Apple Watch Ultra simulator, 422×514) in a plain watch body over the Flow shot it
// belongs to, blurred. The simulator's clock (top right) shows the Mac's time, so it's blurred out.
const SRC_W = 422;
const SRC_H = 514;
const Watch: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
  behind: string;
}> = ({ src, from, rate = 1, lead, behind }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const h = vertical ? 880 : 760; // screen height
  const w = (h * SRC_W) / SRC_H;
  const k = h / SRC_H; // source px → frame px
  const bezel = h * 0.07;
  const settle = interpolate(frame, [0, 14], [1, 0], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          filter: "blur(22px) brightness(0.45)",
          transform: "scale(1.1)",
        }}
      >
        <FlowShot src={behind} from={4.5} lead={lead} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: w + 2 * bezel,
            height: h + 2 * bezel,
            padding: bezel,
            borderRadius: (h + 2 * bezel) * 0.22,
            background: "linear-gradient(145deg, #2b2b33, #0c0c10)",
            boxShadow: "0 50px 110px rgba(0,0,0,0.65), inset 0 0 0 3px #3a3a44",
            transform: `translateY(${(vertical ? -90 : -40) + 28 * settle}px) scale(${1 + frame * 0.0005})`,
          }}
        >
          {/* the crown */}
          <div
            style={{
              position: "absolute",
              right: -h * 0.03,
              top: h * 0.3,
              width: h * 0.045,
              height: h * 0.14,
              borderRadius: h * 0.02,
              background: "linear-gradient(90deg, #3a3a44, #1a1a20)",
            }}
          />
          <div
            style={{
              position: "relative",
              width: w,
              height: h,
              borderRadius: h * 0.17,
              overflow: "hidden",
              background: "black",
            }}
          >
            <OffthreadVideo
              src={src}
              trimBefore={Math.max(0, Math.round((from - (lead / fps) * rate) * fps))}
              playbackRate={rate}
              muted
              style={{ width: w, height: h, display: "block" }}
            />
            {/* the simulator's clock */}
            <div
              style={{
                position: "absolute",
                left: 296 * k,
                top: 22 * k,
                width: 116 * k,
                height: 68 * k,
                borderRadius: 30 * k,
                backdropFilter: "blur(14px) brightness(0.2)",
                WebkitBackdropFilter: "blur(14px) brightness(0.2)",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
      <DemoLabel text="Simulator recording" />
    </AbsoluteFill>
  );
};

// The iPhone remote (1206×2622 simulator screen) in a phone frame, large and cropped by the bottom of
// the frame, so the status card and the game switcher read; a ripple marks the scripted tap.
const PHONE_W = 1206;
const PHONE_H = 2622;
const Phone: React.FC<{
  src: string;
  from: number;
  lead: number;
  tap?: { at: number; x: number; y: number }; // source second, position as a share of the screen
}> = ({ src, from, lead, tap }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const h = vertical ? 2300 : 1780; // screen height; the frame's bottom crops the rest
  const w = (h * PHONE_W) / PHONE_H;
  const pad = h * 0.018;
  const settle = interpolate(frame, [0, 16], [1, 0], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  const t = from + (frame - lead) / fps; // source second on screen
  const r = tap ? interpolate(t, [tap.at, tap.at + 0.45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  const showTap = tap && t >= tap.at && t <= tap.at + 0.45;
  return (
    <AbsoluteFill style={{ background: NIGHT, alignItems: "center", overflow: "hidden" }}>
      <div
        style={{
          position: "relative",
          marginTop: vertical ? -300 : -440, // from the status card to the game switcher
          width: w + 2 * pad,
          height: h + 2 * pad,
          padding: pad,
          borderRadius: h * 0.075,
          background: "#0b0f14",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 3px #2b3440",
          transform: `perspective(1800px) rotateX(${8 * settle}deg) translateY(${40 * settle}px) scale(${1 + frame * 0.0004})`,
          transformOrigin: "50% 0%",
        }}
      >
        <div style={{ position: "relative", width: w, height: h, borderRadius: h * 0.065, overflow: "hidden" }}>
          <OffthreadVideo
            src={src}
            trimBefore={Math.max(0, Math.round(from * fps) - lead)}
            muted
            style={{ width: w, height: h, display: "block" }}
          />
          {showTap ? (
            <div
              style={{
                position: "absolute",
                left: tap.x * w - 70,
                top: tap.y * h - 70,
                width: 140,
                height: 140,
                borderRadius: 70,
                border: "6px solid rgba(124,77,255,0.9)",
                background: "rgba(124,77,255,0.18)",
                transform: `scale(${0.5 + r})`,
                opacity: 1 - r,
              }}
            />
          ) : null}
        </div>
      </div>
      <DemoLabel text="Simulator recording" />
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
        background: PURPLE,
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
          boxShadow: "0 0 70px rgba(255,228,92,0.25)",
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
        TinyTouch
      </div>
      <div
        style={{
          fontSize: vertical ? 56 : 50,
          fontWeight: 700,
          color: STAR,
          marginTop: 6,
          textAlign: "center",
          padding: "0 60px",
          ...rise(16),
        }}
      >
        Gentle play. No surprise calls.
      </div>
      <div
        style={{
          fontSize: vertical ? 32 : 28,
          fontWeight: 500,
          color: "rgba(255,255,255,0.8)",
          marginTop: 30,
          textAlign: "center",
          padding: "0 60px",
          ...rise(22),
        }}
      >
        No ads. No account. Nothing leaves your devices.
      </div>
      <div
        style={{
          position: "absolute",
          bottom: vertical ? 200 : 46,
          left: vertical ? 70 : 80,
          right: vertical ? 70 : 80,
          textAlign: "center",
          fontSize: vertical ? 26 : 21,
          lineHeight: 1.4,
          fontWeight: 500,
          color: "rgba(255,255,255,0.62)",
          ...rise(26),
        }}
      >
        Watch and iPhone screens recorded in the simulator. People and scenes
        are AI-generated. The side-button SOS is a watch setting: the app
        shows how to turn it off.
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

// Where each cut's speech sits, for its subtitle file (scripts/tinytouch-launch-srt.mjs).
export const SPEECH = {
  "tinytouch-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "tinytouch-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "tinytouch-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const TinytouchLaunch = () => (
  <>
    <Composition
      id="tinytouch-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="tinytouch-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="tinytouch-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
