import { Audio } from "@remotion/media";
import { TransitionPresentation } from "@remotion/transitions";
import { blurSlide } from "@remotion/transitions/blur-slide";
import { crossZoom } from "@remotion/transitions/cross-zoom";
import { fade } from "@remotion/transitions/fade";
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
import { FlowShot, PhoneRecording } from "../shared/Product";
import { BEATS_15, BEATS_30, LINES, Word } from "./voiceover";

// ToddlerCam launch promo (reports/2026-10-31-toddlercam-promo-video): Nora has four hundred photos of
// the back of Milo's head, until he gets his own camera. Flow shots carry the comedy with their own
// lines ("Milo! Look at Mommy!", "Mine!", "Mommy!", "Quack."); the product is real recordings of the app
// on paired iPhone and Watch simulators, its cameras fed with frames of the same Flow shots
// (scripts/toddlercam-launch-record.mjs). Narration af_heart (Kokoro) as Nora. The phone's quack and
// shutter are the app's own sounds. Media: public/toddlercam-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`toddlercam-launch/${file}`);
const CORAL = "#ff6b6b";
const PAPER = "linear-gradient(135deg, #fffaf2 0%, #ffe9c7 55%, #ffd2a6 100%)";
const END_BG =
  "radial-gradient(circle at 50% 30%, #ffffff 0%, #fff4e2 45%, #ffd9b0 100%)";
const INK = "#26324a";

const SHOT = {
  look: media("shot-1_960421d8_1080p.mp4"),
  mine: media("shot-2_4ec85d38_1080p.mp4"),
  garden: media("shot-3_f37ad477_1080p.mp4"),
  watch: media("shot-4_ff5d5155_1080p.mp4"),
  hands: media("shot-5_4be3feb4_1080p.mp4"),
  evening: media("shot-6_114f7ee4_1080p.mp4"),
  quack: media("shot-7_2990a114_1080p.mp4"),
};
const REC = {
  dual: media("rec-dual.mp4"),
  watchSnap: media("rec-watch-snap.mp4"),
  phoneSnap: media("rec-phone-snap.mp4"),
  lock: media("rec-lock.mp4"),
};
// Where things happen in the recordings (seconds into each file), measured from their frames (pixel
// change over time; the watch and phone files of the snap were recorded together).
const T = {
  dualSwap: 34.0, // rec-dual: the tap on the bubble, Milo takes the screen
  quackTap: 11.4, // rec-watch-snap: Quack pressed (the simulator shows no press: the edit adds a ripple)
  laugh: 12.6, // rec-phone-snap: Milo looks up (the quack reached the phone)
  photo: 15.43, // rec-phone-snap: the photo from the wrist lands in the corner
  lockOn: 29.6, // rec-lock: locked, the taps start popping
};
const VO = (key: string) => media(`vo-af_heart-${key}.wav`);
const SFX = { quack: media("quack.wav"), shutter: media("shutter.wav") };

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const swap = { presentation: fade() as P, frames: 6 }; // between moments of one recording
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
// The phone's own sounds, at cut times.
type Sfx = { src: string; at: number };

// The music in parts: track second = from + cut second, each part until its cut second. Whole-bar
// jumps put the track's full stop under the quack and still end the cut on the track's own ending.
type Music = { file: string; parts: { until: number; from: number }[] };

// ---------------------------------------------------------------- 30-second cut
const END_30 = 30.4;
// Take 2 (≈112 BPM, chosen by measurement: the only take with the full stop). Its toy-piano intro until
// the groove hits on "Mine!" at 5.5; at 9.58 a jump of 20 beats so the stop lands at 12.30 (the quack);
// 2 beats of silence, then into the groove's return; at 19.85 a jump of 20 beats so the track's last
// little stop sits under "Quack." and its final hit comes with the end card.
const MUSIC_30: Music = {
  file: "30-sec-music-take-2.mp3",
  parts: [
    { until: 9.58, from: 5.88 },
    { until: 13.37, from: 16.68 },
    { until: 19.85, from: 18.3 },
    { until: END_30, from: 29.01 },
  ],
};
const s30 = snapper(BEATS_30);
const CLIPS_30: Clip[] = [
  {
    name: "1 · Look at Mommy",
    at: 0,
    render: (l) => <FlowShot src={SHOT.look} from={1.4} lead={l} />,
  },
  {
    name: "2 · Mine!",
    at: s30(4.2),
    into: next,
    render: (l) => <FlowShot src={SHOT.mine} from={3.2} lead={l} />,
  },
  {
    name: "3 · His own camera",
    at: s30(6.6),
    into: next,
    render: (l) => <FlowShot src={SHOT.garden} from={2.2} lead={l} />,
  },
  {
    name: "3 · Both cameras",
    at: s30(8.5),
    into,
    render: (l) => <Phone src={REC.dual} from={T.dualSwap - 2.1} lead={l} />,
  },
  {
    name: "4 · Nora's watch",
    at: s30(11.18),
    into: next,
    render: (l) => <FlowShot src={SHOT.watch} from={0.2} lead={l} />,
  },
  {
    name: "4 · Quack",
    at: s30(12.3),
    into,
    render: (l) => (
      <Watch
        src={REC.watchSnap}
        from={T.quackTap - 0.25}
        lead={l}
        behind={SHOT.watch}
        tapAt={0.25}
      />
    ),
  },
  {
    name: "4 · He looks",
    at: s30(13.37),
    into: next,
    render: (l) => <Phone src={REC.phoneSnap} from={T.laugh + 0.6} lead={l} />,
  },
  {
    name: "4 · Snap",
    at: s30(13.91),
    into: swap,
    render: (l) => <Phone src={REC.phoneSnap} from={T.photo - 0.4} lead={l} />,
  },
  {
    name: "5 · Little hands",
    at: s30(16.07),
    into: next,
    render: (l) => <FlowShot src={SHOT.hands} from={0.2} lead={l} />,
  },
  {
    name: "5 · Bubbles",
    at: s30(17.16),
    into,
    render: (l) => <Phone src={REC.lock} from={T.lockOn} lead={l} />,
  },
  {
    name: "6 · The day's photos",
    at: s30(19.85),
    into: next,
    render: (l) => <FlowShot src={SHOT.evening} from={2.4} lead={l} />,
  },
  {
    name: "7 · Mommy! Quack.",
    at: s30(23.47),
    into: next,
    render: (l) => <FlowShot src={SHOT.quack} from={1.2} lead={l} />,
  },
  { name: "End card", at: s30(26.72), into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "milo", at: 0, shot: SHOT.look, from: 1.4 },
  { key: "look", at: 0, shot: SHOT.look, from: 1.4 },
  { key: "photos", at: 2.75 },
  { key: "mine", at: at30("2 · Mine!"), shot: SHOT.mine, from: 3.2 },
  { key: "camera", at: 6.15 },
  { key: "both", at: 8.35 },
  { key: "remote", at: 11.0 },
  { key: "snap", at: 13.45 },
  { key: "bubbles", at: 16.3 },
  { key: "account", at: 20.0 },
  { key: "mommy", at: at30("7 · Mommy! Quack."), shot: SHOT.quack, from: 1.2 },
  { key: "quack", at: at30("7 · Mommy! Quack."), shot: SHOT.quack, from: 1.2 },
  { key: "tag", at: 26.85, caption: false },
];
// The quack plays on the watch tap's frame, the shutter on the shutter's.
const SFX_30: Sfx[] = [
  { src: SFX.quack, at: at30("4 · Quack") + 0.25 },
  { src: SFX.shutter, at: at30("4 · Snap") + 0.35 },
];

// ---------------------------------------------------------------- 15-second cut
const END_15 = 16.0;
// The 15 s track (≈103 BPM): its intro under the first two lines, the groove from "Mine!" at 4.2; at
// 6.55 a jump of 56 beats so its short stop falls on the quack at 8.71; at 10.5 a jump of 8 beats to
// the track's ending under the tagline.
const MUSIC_15: Music = {
  file: "15-sec-music.mp3",
  parts: [
    { until: 6.55, from: 5.06 },
    { until: 10.5, from: 37.61 },
    { until: END_15, from: 42.26 },
  ],
};
const s15 = snapper(BEATS_15);
const CLIPS_15: Clip[] = [
  {
    name: "Look at Mommy",
    at: 0,
    render: (l) => <FlowShot src={SHOT.look} from={1.4} lead={l} />,
  },
  {
    name: "Mine!",
    at: s15(2.8),
    into: next,
    render: (l) => <FlowShot src={SHOT.mine} from={3.4} lead={l} />,
  },
  {
    name: "His own camera",
    at: s15(4.5),
    into: next,
    render: (l) => <FlowShot src={SHOT.garden} from={2.6} lead={l} />,
  },
  {
    name: "Both cameras",
    at: s15(5.95),
    into,
    render: (l) => <Phone src={REC.dual} from={T.dualSwap - 0.9} lead={l} />,
  },
  {
    name: "Nora's watch",
    at: s15(7.53),
    into: next,
    render: (l) => <FlowShot src={SHOT.watch} from={0.4} lead={l} />,
  },
  {
    name: "Quack",
    at: s15(8.71),
    into,
    render: (l) => (
      <Watch
        src={REC.watchSnap}
        from={T.quackTap - 0.25}
        lead={l}
        behind={SHOT.watch}
        tapAt={0.25}
      />
    ),
  },
  {
    name: "He looks",
    at: s15(9.9),
    into: next,
    render: (l) => <Phone src={REC.phoneSnap} from={T.laugh + 0.6} lead={l} />,
  },
  {
    name: "Snap",
    at: s15(10.5),
    into: swap,
    render: (l) => <Phone src={REC.phoneSnap} from={T.photo - 0.35} lead={l} />,
  },
  {
    name: "Mommy! Quack.",
    at: s15(11.12),
    into: next,
    render: (l) => <FlowShot src={SHOT.quack} from={3.0} lead={l} />,
  },
  { name: "End card", at: s15(12.28), into: toEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "milo", at: 0, shot: SHOT.look, from: 1.4 },
  { key: "look", at: 0, shot: SHOT.look, from: 1.4 },
  { key: "mine", at: at15("Mine!"), shot: SHOT.mine, from: 3.4 },
  { key: "camera15", at: 4.55 },
  { key: "remote", at: 7.55 },
  { key: "snap", at: 9.95 },
  { key: "quack", at: at15("Mommy! Quack."), shot: SHOT.quack, from: 3.0 },
  { key: "tag", at: 12.4, caption: false },
];
const SFX_15: Sfx[] = [
  { src: SFX.quack, at: at15("Quack") + 0.25 },
  { src: SFX.shutter, at: at15("Snap") + 0.3 },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  sfx: Sfx[];
  music: Music;
  end: number;
}> = ({ clips, lines, sfx, music, end }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={clips} end={end} />
    <Band until={clips[clips.length - 1].at} />
    <Soundtrack lines={lines} sfx={sfx} music={music} end={end} />
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

// The caption band over the footage, faded out as the (light) end card comes in.
const Band: React.FC<{ until: number }> = ({ until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [(until - 0.3) * fps, (until + 0.2) * fps],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  return opacity > 0 ? (
    <AbsoluteFill style={{ opacity }}>
      <CaptionBand />
    </AbsoluteFill>
  ) : null;
};

// The speech span of a line in the timeline, from its word timings.
const span = (l: Line): [number, number] => {
  const w: Word[] = LINES[l.key];
  const o = l.at - (l.from ?? 0);
  return [o + w[0][1], o + w[w.length - 1][2]];
};

// Music under everything, ducked under speech, its parts crossfaded over a few frames at each
// splice; narration from its files; the characters' lines from their Flow shots' own sound.
const Soundtrack: React.FC<{
  lines: Line[];
  sfx: Sfx[];
  music: Music;
  end: number;
}> = ({ lines, sfx, music, end }) => {
  const { fps } = useVideoConfig();
  const last = Math.round(end * fps);
  const speech = lines.map(span);
  const duck = (t: number) => {
    const d = Math.min(
      ...speech.map(([a, b]) => (t < a ? a - t : t > b ? t - b : 0)),
    );
    return interpolate(d, [0, 0.35], [0.28, 0.6], {
      extrapolateRight: "clamp",
    });
  };
  const X = 4; // crossfade frames at a splice
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
                    : interpolate(g, [last - 20, last], [1, 0.7], {
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
            from={Math.round((a - 0.12) * fps)}
            durationInFrames={Math.round((b - a + 0.35) * fps)}
            layout="none"
          >
            <Audio
              src={l.shot}
              trimBefore={Math.round((a - 0.12 - (l.at - (l.from ?? 0))) * fps)}
              volume={0.65}
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
          key={`sfx${i}`}
          name="The app's sound"
          from={Math.round(s.at * fps)}
          layout="none"
        >
          <Audio src={s.src} volume={0.4} />
        </Sequence>
      ))}
    </>
  );
};

// A watch recording (416×496 simulator screen) in a plain watch body over the shot it belongs to,
// blurred. The simulator's clock shows the Mac's time, so it's covered.
const Watch: React.FC<{
  src: string;
  from: number;
  lead: number;
  behind: string;
  tapAt?: number; // seconds into the clip: a ripple on Quack, where the driver tapped
}> = ({ src, from, lead, behind, tapAt }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const h = vertical ? 1040 : 760; // screen height
  const w = (h * 416) / 496;
  const k = h / 496; // source px → frame px
  const INSET = 0.86; // the recording's share of the screen
  const bezel = h * 0.07;
  const settle = interpolate(frame, [0, 14], [1, 0], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          filter: "blur(22px) brightness(0.55)",
          transform: "scale(1.1)",
        }}
      >
        <FlowShot src={behind} from={3.5} lead={lead} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: w + 2 * bezel,
            height: h + 2 * bezel,
            padding: bezel,
            borderRadius: (h + 2 * bezel) * 0.25,
            background: "linear-gradient(145deg, #2b2b33, #0c0c10)",
            boxShadow: "0 50px 110px rgba(0,0,0,0.65), inset 0 0 0 3px #3a3a44",
            transform: `translateY(${(vertical ? -90 : -40) + 28 * settle}px) scale(${1 + frame * 0.0005})`,
          }}
        >
          {/* a coral band, as in the shots */}
          {[-1, 1].map((side) => (
            <div
              key={side}
              style={{
                position: "absolute",
                left: bezel + w * 0.18,
                width: w * 0.64,
                height: h * 0.5,
                [side < 0 ? "bottom" : "top"]: "100%",
                background: `linear-gradient(${side < 0 ? 0 : 180}deg, #f0705f, #e25a4c)`,
                borderRadius: side < 0 ? "30px 30px 0 0" : "0 0 30px 30px",
                zIndex: -1,
              }}
            />
          ))}
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
              borderRadius: h * 0.2,
              overflow: "hidden",
              background: "black",
            }}
          >
            {/* The simulator records the screen edge to edge; a real watch face keeps its text clear of
                the rounded edge, so the recording sits inset on the black screen. */}
            <div
              style={{
                position: "absolute",
                left: (w * (1 - INSET)) / 2,
                top: (h * (1 - INSET)) / 2,
                width: w * INSET,
                height: h * INSET,
              }}
            >
              <OffthreadVideo
                src={src}
                trimBefore={Math.max(0, Math.round(from * fps) - lead)}
                muted
                style={{
                  width: w * INSET,
                  height: h * INSET,
                  display: "block",
                }}
              />
              {tapAt !== undefined ? (
                <Ripple
                  t={(frame - lead) / fps - tapAt}
                  x={0.155 * w * INSET}
                  y={0.93 * h * INSET}
                  size={0.25 * w}
                />
              ) : null}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: 150 * k * INSET,
                  height: 66 * k * INSET,
                  background: "black",
                }}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <DemoLabel text="Demo footage" />
    </AbsoluteFill>
  );
};

// A finger's tap: a soft ring that grows and fades, t seconds after the tap.
const Ripple: React.FC<{ t: number; x: number; y: number; size: number }> = ({
  t,
  x,
  y,
  size,
}) => {
  if (t < 0 || t > 0.6) return null;
  const k = t / 0.6;
  const d = size * (0.4 + 0.8 * k);
  return (
    <div
      style={{
        position: "absolute",
        left: x - d / 2,
        top: y - d / 2,
        width: d,
        height: d,
        borderRadius: "50%",
        background: `rgba(255,255,255,${0.35 * (1 - k)})`,
        border: `4px solid rgba(255,255,255,${0.9 * (1 - k)})`,
      }}
    />
  );
};

const Phone: React.FC<{ src: string; from: number; lead: number }> = (p) => (
  <PhoneRecording {...p} backdrop={PAPER} label="Demo footage" />
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
        background: END_BG,
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        color: INK,
      }}
    >
      <Img
        src={media("icon.png")}
        style={{
          width: icon,
          height: icon,
          borderRadius: icon * 0.22,
          boxShadow: "0 20px 60px rgba(255,107,107,0.35)",
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
        ToddlerCam
      </div>
      <div
        style={{
          fontSize: vertical ? 54 : 48,
          fontWeight: 600,
          color: CORAL,
          marginTop: 6,
          textAlign: "center",
          padding: "0 60px",
          lineHeight: 1.2,
          ...rise(16),
        }}
      >
        A camera for little hands{vertical ? <br /> : ", "}and a remote on
        yours.
      </div>
      <div
        style={{
          fontSize: vertical ? 30 : 26,
          fontWeight: 500,
          color: "rgba(38,50,74,0.7)",
          marginTop: 34,
          ...rise(22),
        }}
      >
        Free on iPhone · with a watch remote
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
          color: "rgba(38,50,74,0.6)",
          ...rise(26),
        }}
      >
        People and scenes are AI-generated. In-app footage is demo footage.
      </div>
    </AbsoluteFill>
  );
};

const Promo30: React.FC = () => (
  <Promo
    clips={CLIPS_30}
    lines={LINES_30}
    sfx={SFX_30}
    music={MUSIC_30}
    end={END_30}
  />
);
const Promo15: React.FC = () => (
  <Promo
    clips={CLIPS_15}
    lines={LINES_15}
    sfx={SFX_15}
    music={MUSIC_15}
    end={END_15}
  />
);

// Where each cut's speech sits, for its subtitle file (scripts/toddlercam-launch-srt.mjs).
export const SPEECH = {
  "toddlercam-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "toddlercam-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "toddlercam-launch-15-vertical": {
    lines: LINES_15,
    end: END_15,
    words: LINES,
  },
};

const frames = (s: number) => Math.round(s * FPS);
export const ToddlercamLaunch = () => (
  <>
    <Composition
      id="toddlercam-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="toddlercam-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="toddlercam-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
