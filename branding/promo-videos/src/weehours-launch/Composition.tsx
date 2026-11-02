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
import { FlowShot, PhoneRecording } from "../shared/Product";
import { BEATS_15, BEATS_30, LINES, Word } from "./voiceover";

// Wee Hours launch promo (reports/2026-10-30-weehours-promo-video): at 3am nobody remembers who fed
// the baby, except the four-year-old. Flow shots carry the comedy with the family's own lines ("Did I
// feed her?", "I fed her.", Doudou's "Two-ten. Left side. You were snoring."); the product is real
// recordings of the app on paired iPhone and Watch simulators: Jun whispers to his watch, the phone
// logs it, Mei's phone has it, tilt mode logs silently. Narration am_fenrir (Kokoro) as Jun.
// Media: public/weehours-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`weehours-launch/${file}`);
const ACCENT = "#f6a46a";
const NIGHT =
  "radial-gradient(circle at 50% 35%, #2a2350 0%, #16132b 55%, #0a0818 100%)";

const SHOT = {
  panic: media("shot-1_65cc9fbe_1080p.mp4"),
  fridge: media("shot-2_55841c09_1080p.mp4"),
  witness: media("shot-3_2c1e4299_1080p.mp4"),
  whisper: media("shot-4_a9755028_1080p.mp4"),
  mei: media("shot-5-remake_e1a99771_1080p.mp4"),
  tilt: media("shot-6_4406e964_1080p.mp4"),
  cookies: media("shot-7_10fad4de_1080p.mp4"),
};
const REC = {
  listen: media("rec-watch-listen.mp4"),
  logged: media("rec-watch-logged.mp4"),
  phoneLog: media("rec-phone-log.mp4"),
  partner: media("rec-partner.mp4"),
  aim: media("rec-watch-tilt-aim.mp4"),
  confirm: media("rec-watch-tilt-confirm.mp4"),
  done: media("rec-watch-tilt-done.mp4"),
};
const VO = (key: string) => media(`vo-am_fenrir-${key}.wav`);

type P = TransitionPresentation<Record<string, unknown>>;
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const swap = { presentation: fade() as P, frames: 6 }; // between screens of one device
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

// The music: the track's sleepy opening, then (on a beat, whole bars apart) its ending, so each cut
// opens at 3am on the tiptoeing intro and still ends on the track's own ending.
type Music = { file: string; parts: { until: number; from: number }[] };

// ---------------------------------------------------------------- 30-second cut
const END_30 = 30.3;
// 2.6 s in, the groove kicks in at 6.4 (Saturday morning); at 14.91 the edit jumps 30 bars ahead so
// the groove stops at 26.69, as the end card comes in, and the quiet outro plays under it.
const MUSIC_30: Music = {
  file: "30-sec-music-take-2.mp3",
  parts: [
    { until: 14.91, from: 2.6 },
    { until: END_30, from: 72.306 },
  ],
};
const s30 = snapper(BEATS_30);
const CLIPS_30: Clip[] = [
  {
    name: "1 · Did I feed her?",
    at: 0,
    render: (l) => <FlowShot src={SHOT.panic} from={3.7} lead={l} />,
  },
  {
    name: "2 · I fed her.",
    at: s30(2.75),
    into: next,
    render: (l) => <FlowShot src={SHOT.fridge} from={2.6} lead={l} />,
  },
  {
    name: "3 · The witness",
    at: s30(6.4),
    into: next,
    render: (l) => <FlowShot src={SHOT.witness} from={0.0} lead={l} />,
  },
  {
    name: "4 · He tells his watch",
    at: s30(11.6),
    into: next,
    render: (l) => <FlowShot src={SHOT.whisper} from={2.7} lead={l} />,
  },
  {
    name: "4 · The watch listens",
    at: s30(13.75),
    into,
    render: (l) => (
      <Watch src={REC.listen} from={2.9} lead={l} behind={SHOT.whisper} />
    ),
  },
  {
    name: "4 · The phone logs it",
    at: s30(15.0),
    into: next,
    render: (l) => <Phone src={REC.phoneLog} from={18.8} lead={l} />,
  },
  {
    name: "4 · The watch knows",
    at: s30(16.5),
    into: next,
    render: (l) => (
      <Watch src={REC.logged} from={0.5} lead={l} behind={SHOT.whisper} />
    ),
  },
  {
    name: "5 · Mei's phone lights up",
    at: s30(17.9),
    into: next,
    render: (l) => <FlowShot src={SHOT.mei} from={2.6} lead={l} />,
  },
  {
    name: "5 · Fed just now",
    at: s30(18.8),
    into,
    render: (l) => <Phone src={REC.partner} from={0.6} lead={l} />,
  },
  {
    name: "5 · Back to sleep",
    at: s30(20.0),
    into: next,
    render: (l) => <FlowShot src={SHOT.mei} from={4.5} lead={l} />,
  },
  {
    name: "6 · Not a word",
    at: s30(20.9),
    into: next,
    render: (l) => <FlowShot src={SHOT.tilt} from={2.0} lead={l} />,
  },
  {
    name: "6 · Tilt",
    at: s30(21.8),
    into,
    render: (l) => (
      <Watch src={REC.aim} from={1.75} lead={l} behind={SHOT.tilt} />
    ),
  },
  {
    name: "6 · Locked",
    at: s30(22.5),
    into: swap,
    render: (l) => (
      <Watch src={REC.confirm} from={2.45} lead={l} behind={SHOT.tilt} />
    ),
  },
  {
    name: "6 · Logged",
    at: s30(23.1),
    into: swap,
    render: (l) => (
      <Watch src={REC.done} from={2.35} lead={l} behind={SHOT.tilt} />
    ),
  },
  {
    name: "7 · Two cookies",
    at: s30(23.7),
    into: next,
    render: (l) => <FlowShot src={SHOT.cookies} from={1.5} lead={l} />,
  },
  {
    name: "7 · Facepalm",
    at: s30(25.8),
    into: next,
    render: (l) => <FlowShot src={SHOT.cookies} from={6.5} lead={l} />,
  },
  { name: "End card", at: 26.69, into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "feed", at: 0, shot: SHOT.panic, from: 3.7 },
  { key: "fed", at: at30("2 · I fed her."), shot: SHOT.fridge, from: 2.6 },
  { key: "nobody", at: 4.25 },
  { key: "twoten", at: at30("3 · The witness"), shot: SHOT.witness, from: 0.0 },
  {
    key: "snoring",
    at: at30("3 · The witness"),
    shot: SHOT.witness,
    from: 0.0,
  },
  {
    key: "bottle",
    at: at30("4 · He tells his watch"),
    shot: SHOT.whisper,
    from: 2.7,
  },
  { key: "watch", at: 13.85 },
  { key: "mei", at: 18.0 },
  { key: "tilt", at: 21.0 },
  {
    key: "cookies",
    at: at30("7 · Two cookies"),
    shot: SHOT.cookies,
    from: 1.5,
  },
  { key: "tag", at: 26.85, caption: false },
];

// ---------------------------------------------------------------- 15-second cut
const END_15 = 15.4;
// 7.6 s in: tiptoeing under the 3am lines, the groove at 5.4 as Jun whispers; at 9.75 a jump of 18
// bars to the track's final hit at 14.95, under the tagline.
const MUSIC_15: Music = {
  file: "15-sec-music-take-2.mp3",
  parts: [
    { until: 9.75, from: 7.6 },
    { until: END_15, from: 49.442 },
  ],
};
const s15 = snapper(BEATS_15);
const CLIPS_15: Clip[] = [
  {
    name: "Did I feed her?",
    at: 0,
    render: (l) => <FlowShot src={SHOT.panic} from={3.7} lead={l} />,
  },
  {
    name: "I fed her.",
    at: s15(2.75),
    into: next,
    render: (l) => <FlowShot src={SHOT.fridge} from={2.6} lead={l} />,
  },
  {
    name: "He tells his watch",
    at: s15(4.3),
    into: next,
    render: (l) => <FlowShot src={SHOT.whisper} from={2.7} lead={l} />,
  },
  {
    name: "The watch listens",
    at: s15(6.3),
    into,
    render: (l) => (
      <Watch src={REC.listen} from={2.9} lead={l} behind={SHOT.whisper} />
    ),
  },
  {
    name: "The phone logs it",
    at: s15(7.5),
    into: next,
    render: (l) => <Phone src={REC.phoneLog} from={18.9} lead={l} />,
  },
  {
    name: "The watch knows",
    at: s15(8.7),
    into: next,
    render: (l) => (
      <Watch src={REC.logged} from={0.5} lead={l} behind={SHOT.whisper} />
    ),
  },
  {
    name: "Mei's phone lights up",
    at: s15(9.6),
    into: next,
    render: (l) => <FlowShot src={SHOT.mei} from={2.6} lead={l} />,
  },
  {
    name: "Fed just now",
    at: s15(10.4),
    into,
    render: (l) => <Phone src={REC.partner} from={0.6} lead={l} />,
  },
  {
    name: "Back to sleep",
    at: s15(11.4),
    into: next,
    render: (l) => <FlowShot src={SHOT.mei} from={4.6} lead={l} />,
  },
  { name: "End card", at: 12.3, into: toEnd, render: () => <EndCard /> },
];
const at15 = (name: string) => CLIPS_15.find((c) => c.name === name)!.at;
const LINES_15: Line[] = [
  { key: "feed", at: 0, shot: SHOT.panic, from: 3.7 },
  { key: "fed", at: at15("I fed her."), shot: SHOT.fridge, from: 2.6 },
  {
    key: "bottle",
    at: at15("He tells his watch"),
    shot: SHOT.whisper,
    from: 2.7,
  },
  { key: "whisper", at: 6.4 },
  { key: "both", at: 9.75 },
  { key: "tag", at: 12.45, caption: false },
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

// Music under everything, ducked under speech, its parts crossfaded over a few frames at each
// splice; narration from its files; the characters' lines from their Flow shots' own sound.
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

// A watch recording (416×496 simulator screen) in a plain watch body over the shot it belongs to,
// blurred. The simulator's clock shows the Mac's time, not 3am, so it's covered.
const Watch: React.FC<{
  src: string;
  from: number;
  lead: number;
  behind: string;
}> = ({ src, from, lead, behind }) => {
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
          filter: "blur(22px) brightness(0.4)",
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
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 175 * k * INSET,
                  height: 72 * k * INSET,
                  background: "black",
                }}
              />
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <DemoLabel />
    </AbsoluteFill>
  );
};

const Phone: React.FC<{ src: string; from: number; lead: number }> = (p) => (
  <PhoneRecording {...p} backdrop={NIGHT} />
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
        background: NIGHT,
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
          boxShadow: "0 0 60px rgba(246,164,106,0.25)",
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
        Wee Hours
      </div>
      <div
        style={{
          fontSize: vertical ? 56 : 50,
          fontWeight: 500,
          color: ACCENT,
          marginTop: 6,
          textAlign: "center",
          padding: "0 60px",
          ...rise(16),
        }}
      >
        A newborn log built for 3am.
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
        iPhone · Apple Watch · Even G2 glasses
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
        A log, not medical advice. Times shown are demo data. People and scenes
        are AI-generated.
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

// Where each cut's speech sits, for its subtitle file (scripts/weehours-launch-srt.mjs).
export const SPEECH = {
  "weehours-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "weehours-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "weehours-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const WeehoursLaunch = () => (
  <>
    <Composition
      id="weehours-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="weehours-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="weehours-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
