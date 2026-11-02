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

// Waypack launch promo (reports/2026-11-01-waypack-promo-video): no signal in the mountains, and
// Rosa doesn't need any, because her agent planned the trip and Waypack keeps it working offline.
// Flow shots carry the comedy with the characters' own lines (Gus: "Does anyone have a single bar?",
// Rosa: "Don't need one.", Gus: "Okay. Where's the sledding hill?"); real recordings show the
// product (the iPhone app on the app's example trip, the live preview on the web); narration
// af_heart (Kokoro) between. Media: public/waypack-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`waypack-launch/${file}`);
const TERRA = "#d9694f";
const INK = "#3c2814";
const CREAM = "#fffdf8";
const PAPER = "#f3eadb";
// Behind the recordings: the app's warm paper, a little darker at the edges.
const BACKDROP = `radial-gradient(circle at 50% 38%, ${CREAM} 0%, ${PAPER} 55%, #e2d3bc 100%)`;

const SHOT = {
  pullout: media("Shot_1_draft_0053f221_1080p.mp4"),
  bar: media("Shot_2_draft_7f6bcbf6_1080p.mp4"),
  glance: media("Shot_3_draft_b1eb4bdb_1080p.mp4"),
  car: media("Shot_4_draft_96bd62cb_1080p.mp4"),
  cabin: media("Shot_5_draft_0479c9b2_1080p.mp4"),
  home: media("Shot_6_draft_3fd44a22_1080p.mp4"),
  sled: media("Shot_7_draft_cf6f09dc_1080p.mp4"),
};
const REC = {
  today: media("rec-phone-today.mp4"),
  map: media("rec-phone-map.mp4"),
  stay: media("rec-phone-stay.mp4"),
  plan: media("rec-phone-plan.mp4"),
  download: media("rec-phone-download.mp4"),
  preview: media("rec-web-preview.mp4"),
};
const VO = (key: string) => media(`vo-af_heart-${key}.wav`);
const TAG = "Example trip";

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
  volume?: number; // Flow lines: Gus's takes are hotter than Rosa's
};

// ---------------------------------------------------------------- 30-second cut
// music-30-edit.wav: take 1 ("lost on the mountain"), its last 30 s (35.0 s to the end): the searching
// intro under Gus's hunt, the stop (6.2–8.8 s) under Rosa's "Don't need one.", the groove kicking in at
// 11.25 s as the app appears, and the final chord ending on the end card.
const END_30 = 30.0;
const s30 = snapper(BEATS_30);
const CLIPS_30: Clip[] = [
  {
    name: "1 · No signal up here",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.pullout} from={4.4} lead={l} focusX={0.4} />
    ),
  },
  {
    name: "2 · A single bar?",
    at: s30(3.1),
    into: next,
    render: (l) => <FlowShot src={SHOT.bar} from={0.7} lead={l} focusX={0.4} />,
  },
  {
    name: "3 · The glance",
    at: s30(8.31),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.2} lead={l} />,
  },
  {
    name: "3 · Phone: Today",
    at: s30(10.61),
    into,
    render: (l) => (
      <Phone src={REC.today} from={1.4} lead={l} h={1750} top={60} />
    ),
  },
  {
    name: "4 · Zero bars in the car",
    at: s30(13.19),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.car} from={0.25} lead={l} focusX={0.62} />
    ),
  },
  {
    name: "4 · Phone: the offline map",
    at: s30(14.35),
    into,
    render: (l) => (
      <Phone src={REC.map} from={2.0} rate={1.6} lead={l} h={1500} top={-150} />
    ),
  },
  {
    name: "5 · The cabin, Gus topples",
    at: s30(16.65),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.cabin} from={4.85} lead={l} focusX={0.55} />
    ),
  },
  {
    name: "5 · Phone: where you're staying",
    at: s30(17.81),
    into,
    render: (l) => (
      <Phone src={REC.stay} from={0.3} lead={l} h={1750} top={-60} />
    ),
  },
  {
    name: "5 · Phone: backup plans",
    at: s30(18.97),
    into: next,
    render: (l) => (
      <Phone src={REC.plan} from={9.6} lead={l} h={1750} top={-40} settled />
    ),
  },
  {
    name: "6 · Weeks before, at home",
    at: s30(20.11),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.home} from={0.4} lead={l} focusX={0.6} />
    ),
  },
  {
    name: "6 · Web: the live preview",
    at: s30(21.27),
    into,
    render: (l) => <Desktop src={REC.preview} from={4.4} rate={1.4} lead={l} />,
  },
  {
    name: "6 · Phone: Download",
    at: s30(22.43),
    into: next,
    render: (l) => (
      <Phone
        src={REC.download}
        from={3.4}
        rate={2.4}
        lead={l}
        h={2700}
        top={-260}
        x={0.27}
      />
    ),
  },
  {
    name: "7 · The sledding hill",
    at: s30(24.17),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.sled} from={0.15} lead={l} focusX={0.5} />
    ),
  },
  {
    name: "7 · Where's the sledding hill?",
    at: s30(25.31),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.sled} from={4.42} lead={l} focusX={0.5} />
    ),
  },
  { name: "End card", at: s30(28.19), into: toEnd, render: () => <EndCard /> },
];
const at30 = (name: string) => CLIPS_30.find((c) => c.name === name)!.at;
const LINES_30: Line[] = [
  { key: "signal", at: 0.3 },
  {
    key: "bar",
    at: at30("2 · A single bar?"),
    shot: SHOT.bar,
    from: 0.7,
    volume: 1.05,
  },
  { key: "need", at: at30("2 · A single bar?"), shot: SHOT.bar, from: 0.7 },
  { key: "planned", at: 8.45 },
  { key: "next", at: 13.3 },
  { key: "lodging", at: 16.75 },
  { key: "home", at: 20.6 },
  {
    key: "hill",
    at: at30("7 · Where's the sledding hill?"),
    shot: SHOT.sled,
    from: 4.42,
    volume: 1.15,
  },
  { key: "tag", at: 28.3, caption: false },
];

// ---------------------------------------------------------------- 15-second cut
// music-15-edit.wav: take 1 ("road trip sting"), its searching intro (5.35–8.59 s, into the stop),
// spliced in the silence to 52.76 s–end: the groove kicks in at 3.25 s as Rosa reaches for her phone.
const END_15 = 15.0;
const s15 = snapper(BEATS_15);
const CLIPS_15: Clip[] = [
  {
    name: "No signal up here",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.pullout} from={4.6} lead={l} focusX={0.4} />
    ),
  },
  {
    name: "Gus hunts for a bar",
    at: s15(1.9),
    into: next,
    render: (l) => <FlowShot src={SHOT.bar} from={0.4} lead={l} focusX={0.4} />,
  },
  {
    name: "The glance",
    at: s15(3.25),
    into: next,
    render: (l) => <FlowShot src={SHOT.glance} from={0.2} lead={l} />,
  },
  {
    name: "Phone: Today",
    at: s15(4.39),
    into,
    render: (l) => (
      <Phone src={REC.today} from={1.4} lead={l} h={1750} top={60} />
    ),
  },
  {
    name: "Zero bars in the car",
    at: s15(6.71),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.car} from={0.25} lead={l} focusX={0.62} />
    ),
  },
  {
    name: "Phone: the offline map",
    at: s15(7.89),
    into,
    render: (l) => (
      <Phone src={REC.map} from={2.0} rate={1.6} lead={l} h={1500} top={-150} />
    ),
  },
  {
    name: "The sledding hill",
    at: s15(10.22),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.sled} from={0.15} lead={l} focusX={0.5} />
    ),
  },
  { name: "End card", at: s15(11.94), into: toEnd, render: () => <EndCard /> },
];
const LINES_15: Line[] = [
  { key: "signal", at: 0.25 },
  { key: "agent", at: 3.4 },
  { key: "next", at: 7.05 },
  { key: "tag", at: 12.25, caption: false },
];

// ---------------------------------------------------------------- the pieces
const Promo: React.FC<{
  clips: Clip[];
  lines: Line[];
  music: string;
  end: number;
}> = ({ clips, lines, music, end }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={clips} end={end} />
    <BandUntil t={clips[clips.length - 1].at} />
    <Soundtrack lines={lines} music={music} end={end} />
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

// The captions' dark band, faded out as the cream end card comes in (it would muddy the small print).
const BandUntil: React.FC<{ t: number }> = ({ t }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [t * fps - 8, t * fps + 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <CaptionBand />
    </AbsoluteFill>
  );
};

// The speech span of a line in the timeline, from its word timings.
const span = (l: Line): [number, number] => {
  const w: Word[] = LINES[l.key];
  const o = l.at - (l.from ?? 0);
  return [o + w[0][1], o + w[w.length - 1][2]];
};

// Music under everything, ducked under speech; narration from its files; the characters' lines
// from their Flow shots' own sound. Flow's sound (and its ad-libs) is muted everywhere else.
const Soundtrack: React.FC<{
  lines: Line[];
  music: string;
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
              volume={l.volume ?? 1.6}
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

// A Flow shot filling the frame with a slow push-in; in 9:16 sized to the frame's height and centred
// on `focusX`. OffthreadVideo: the canvas-backed Video doesn't scale in the browser these renders use.
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

// The iPhone app (a simulator recording, 1206×2622) in a phone frame on the app's paper, swinging
// into place and pushing in slowly. `h` is the screen height in 16:9 (larger than the frame, so the
// part that matters is readable), `top` where the phone's top sits, `x` the screen's x (0–1) to
// centre. 9:16 scales both up by 1.4.
const Phone: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
  h: number;
  top: number;
  x?: number;
  settled?: boolean;
}> = ({ src, from, rate = 1, lead, h: h16, top: top16, x = 0.5, settled }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const h = vertical ? h16 * 1.4 : h16;
  const top = vertical ? top16 * 1.4 + 180 : top16;
  const w = (h * 1206) / 2622;
  const settle = settled
    ? 0
    : interpolate(frame, [0, 16], [1, 0], {
        extrapolateRight: "clamp",
        easing: (t) => 1 - (1 - t) ** 3,
      });
  const push = 1 + frame * 0.0006;
  return (
    <AbsoluteFill style={{ background: BACKDROP, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top,
          left: width / 2 - 14 - x * w,
          height: h,
          width: w + 28,
          padding: 14,
          borderRadius: h * 0.075,
          background: "#14100c",
          boxShadow: "0 40px 90px rgba(60,40,20,0.45), inset 0 0 0 2px #3a3128",
          transform: `perspective(1600px) rotateY(${-10 * settle}deg) translateY(${30 * settle}px) scale(${push})`,
          transformOrigin: `${x * 100}% ${top < 0 ? 40 : 15}%`,
        }}
      >
        <OffthreadVideo
          src={src}
          trimBefore={Math.max(
            0,
            Math.round((from - (lead / fps) * rate) * fps),
          )}
          playbackRate={rate}
          muted
          style={{
            width: w,
            height: h - 28,
            borderRadius: h * 0.065,
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>
      <DemoLabel text={TAG} />
    </AbsoluteFill>
  );
};

// The live preview in a browser window (1920×1080 recording), on the paper backdrop.
const Desktop: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
}> = ({ src, from, rate = 1, lead }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const w = vertical ? 1700 : 1460;
  const push = 1 + frame * 0.0006;
  return (
    <AbsoluteFill
      style={{
        background: BACKDROP,
        alignItems: vertical ? "flex-start" : "center",
        justifyContent: vertical ? "center" : "flex-start",
        paddingTop: vertical ? 0 : 40,
        paddingLeft: vertical ? 40 : 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: w,
          borderRadius: 18,
          overflow: "hidden",
          background: "#fff",
          transform: `scale(${push})`,
          boxShadow: "0 40px 90px rgba(60,40,20,0.4), 0 0 0 1px rgba(60,40,20,0.12)",
        }}
      >
        <div
          style={{
            height: 34,
            background: "#ece4d6",
            display: "flex",
            alignItems: "center",
            gap: 8,
            paddingLeft: 16,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span
              key={c}
              style={{ width: 12, height: 12, borderRadius: 6, background: c }}
            />
          ))}
        </div>
        <OffthreadVideo
          src={src}
          trimBefore={Math.max(
            0,
            Math.round((from - (lead / fps) * rate) * fps),
          )}
          playbackRate={rate}
          muted
          style={{ width: w, height: (w * 9) / 16, display: "block" }}
        />
      </div>
      <DemoLabel text={TAG} />
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
  const icon = vertical ? 260 : 190;
  return (
    <AbsoluteFill
      style={{
        background: BACKDROP,
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
          boxShadow: "0 18px 50px rgba(217,105,79,0.35)",
          ...rise(2),
        }}
      />
      <div
        style={{
          fontSize: vertical ? 124 : 108,
          fontWeight: 800,
          letterSpacing: -2,
          marginTop: 30,
          ...rise(6),
        }}
      >
        Waypack
      </div>
      <div
        style={{
          fontSize: vertical ? 66 : 58,
          fontWeight: 700,
          color: TERRA,
          marginTop: 2,
          ...rise(10),
        }}
      >
        Your trip, packed.
      </div>
      <div
        style={{
          fontSize: vertical ? 38 : 32,
          fontWeight: 500,
          color: "rgba(60,40,20,0.8)",
          marginTop: 26,
          textAlign: "center",
          padding: "0 70px",
          lineHeight: 1.3,
          ...rise(16),
        }}
      >
        {vertical ? (
          <>
            Your AI agent plans the trip.
            <br />
            Waypack keeps it working offline.
          </>
        ) : (
          "Your AI agent plans the trip. Waypack keeps it working offline."
        )}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: vertical ? 200 : 46,
          left: 60,
          right: 60,
          textAlign: "center",
          fontSize: vertical ? 26 : 21,
          fontWeight: 500,
          color: "rgba(60,40,20,0.62)",
          lineHeight: 1.45,
          ...rise(20),
        }}
      >
        Works with any MCP agent. Offline map with Waypack Pro. Example trip:
        check road and park conditions before you go. People and scenes are
        AI-generated.
      </div>
    </AbsoluteFill>
  );
};

const Promo30: React.FC = () => (
  <Promo
    clips={CLIPS_30}
    lines={LINES_30}
    music="music-30-edit.wav"
    end={END_30}
  />
);
const Promo15: React.FC = () => (
  <Promo
    clips={CLIPS_15}
    lines={LINES_15}
    music="music-15-edit.wav"
    end={END_15}
  />
);

// Where each cut's speech sits, for its subtitle file (scripts/waypack-launch-srt.mjs).
export const SPEECH = {
  "waypack-launch-30": { lines: LINES_30, end: END_30, words: LINES },
  "waypack-launch-15": { lines: LINES_15, end: END_15, words: LINES },
  "waypack-launch-15-vertical": { lines: LINES_15, end: END_15, words: LINES },
};

const frames = (s: number) => Math.round(s * FPS);
export const WaypackLaunch = () => (
  <>
    <Composition
      id="waypack-launch-30"
      component={Promo30}
      durationInFrames={frames(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="waypack-launch-15"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="waypack-launch-15-vertical"
      component={Promo15}
      durationInFrames={frames(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
