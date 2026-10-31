import { Audio } from "@remotion/media";
import { crossZoom } from "@remotion/transitions/cross-zoom";
import { blurSlide } from "@remotion/transitions/blur-slide";
import { dreamyZoom } from "@remotion/transitions/dreamy-zoom";
import { TransitionPresentation } from "@remotion/transitions";
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
import { CaptionBand, fontFamily, KineticCaption } from "../shared/Caption";
import { Clip, Cuts } from "../shared/Cuts";
import { DesktopRecording, FlowShot, PhoneRecording } from "../shared/Product";
import { VO_15, VO_30 } from "./voiceover";

// Trading Plan Board launch promo, v2 (reports/2026-10-30-tradeboard-promo-video §3): Flow shots with
// the screen hidden hand over to real portal recordings; cut on the music's beats; voiceover am_michael.
// Media: public/tradeboard-launch/ (media.md).

const FPS = 30;
const media = (file: string) => staticFile(`tradeboard-launch/${file}`);
const BEAT = 60 / 103.4; // both music tracks run at 103.4 BPM
const b = (n: number) => n * BEAT;

type P = TransitionPresentation<Record<string, unknown>>;
// Into the product: the shot zooms through into its recording. Between story beats: a blurred slide.
const into = { presentation: crossZoom({ strength: 0.35 }) as P, frames: 12 };
const next = {
  presentation: blurSlide({ direction: "from-right", blur: 24 }) as P,
  frames: 10,
};
const toEnd = { presentation: dreamyZoom({}) as P, frames: 16 };

const SHOT = {
  rushed: media("Shot-1_87539a4b_1080p.mp4"),
  laptop: media("Shot-2-v2_ab3266c7_1080p.mp4"),
  debate: media("Shot-3_c4b1bc1f_1080p.mp4"),
  phone: media("Shot-4-v2_56e49459_1080p.mp4"),
  machine: media("Shot-5_81ca53f9_1080p.mp4"),
  lights: media("Shot-6_aa07334d_1080p.mp4"),
  end: media("Shot-7_23b429a3_1080p.mp4"),
};
const REC = {
  board: media("rec-board.mp4"),
  debate: media("rec-debate.mp4"),
  approve: media("rec-approve.mp4"),
  receipt: media("rec-receipt.mp4"),
  failclosed: media("rec-failclosed.mp4"),
};
const DEBATE_ZOOM = 1.08; // shot 3 has a film-frame border baked in; zoom past it

// ---------------------------------------------------------------- 30-second cut
const END_30 = 29.6;
const VO_30_AT = 0.35;
const CLIPS_30: Clip[] = [
  {
    name: "1 · Rushed, wide",
    at: 0,
    render: (l) => <FlowShot src={SHOT.rushed} from={0.4} lead={l} />,
  },
  {
    name: "1 · Hesitating thumb",
    at: b(3),
    into,
    render: (l) => <FlowShot src={SHOT.rushed} from={5.0} lead={l} />,
  },
  {
    name: "2 · Reading the plan",
    at: b(6),
    into: next,
    render: (l) => <FlowShot src={SHOT.laptop} from={4.2} lead={l} />,
  },
  {
    name: "2 · Board recording",
    at: b(9),
    into,
    render: (l) => (
      <DesktopRecording src={REC.board} from={0.9} rate={1.6} lead={l} />
    ),
  },
  {
    name: "3 · Debate",
    at: b(15),
    into: next,
    render: (l) => (
      <FlowShot src={SHOT.debate} from={2.5} lead={l} zoom={DEBATE_ZOOM} />
    ),
  },
  {
    name: "3 · Debate recording",
    at: b(17),
    into,
    render: (l) => (
      <DesktopRecording src={REC.debate} from={0.6} rate={2} lead={l} />
    ),
  },
  {
    name: "4 · The tap",
    at: b(21),
    into: next,
    render: (l) => <FlowShot src={SHOT.phone} from={1.6} lead={l} />,
  },
  {
    name: "4 · Approve recording",
    at: b(23),
    into,
    render: (l) => (
      <PhoneRecording src={REC.approve} from={1.4} rate={1.6} lead={l} />
    ),
  },
  {
    name: "5 · Machine",
    at: b(27),
    into: next,
    render: (l) => <FlowShot src={SHOT.machine} from={1.2} lead={l} />,
  },
  {
    name: "5 · Receipt recording",
    at: b(30),
    into,
    render: (l) => (
      <DesktopRecording
        src={REC.receipt}
        focus={0}
        from={0.4}
        rate={1.3}
        lead={l}
      />
    ),
  },
  {
    name: "6 · Lights",
    at: b(35),
    into: next,
    render: (l) => <FlowShot src={SHOT.lights} from={3.4} lead={l} />,
  },
  {
    name: "6 · Fail-closed recording",
    at: b(37),
    into,
    render: (l) => (
      <DesktopRecording src={REC.failclosed} from={1.0} rate={0.9} lead={l} />
    ),
  },
  {
    name: "7 · End card",
    at: b(40),
    into: toEnd,
    render: (l) => <EndCard from={0} lead={l} />,
  },
];

const Promo30: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={CLIPS_30} end={END_30} />
    <CaptionBand />
    <Soundtrack
      music="30-sec-music.mp3"
      musicFrom={85.217}
      vo="vo-30-am_michael.wav"
      voAt={VO_30_AT}
      end={END_30}
    />
    {VO_30.slice(0, -1).map((words, i) => (
      <KineticCaption key={i} words={words} offset={VO_30_AT} />
    ))}
  </AbsoluteFill>
);

// ---------------------------------------------------------------- 15-second cut
const END_15 = 15;
const VO_15_AT = 0.25;
const CLIPS_15: Clip[] = [
  {
    name: "Debate",
    at: 0,
    render: (l) => (
      <FlowShot src={SHOT.debate} from={2.5} lead={l} zoom={DEBATE_ZOOM} />
    ),
  },
  {
    name: "Debate recording",
    at: b(2),
    into,
    render: (l) => (
      <DesktopRecording src={REC.debate} from={0.6} rate={2} lead={l} />
    ),
  },
  {
    name: "The tap",
    at: b(6),
    into: next,
    render: (l) => <FlowShot src={SHOT.phone} from={1.6} lead={l} />,
  },
  {
    name: "Approve recording",
    at: b(8),
    into,
    render: (l) => (
      <PhoneRecording src={REC.approve} from={1.8} rate={2} lead={l} />
    ),
  },
  {
    name: "Receipt recording",
    at: b(11),
    into: next,
    render: (l) => (
      <DesktopRecording
        src={REC.receipt}
        focus={0}
        from={0.6}
        rate={1.4}
        lead={l}
      />
    ),
  },
  {
    name: "Lights",
    at: b(15),
    into: next,
    render: (l) => <FlowShot src={SHOT.lights} from={3.4} lead={l} />,
  },
  {
    name: "Fail-closed recording",
    at: b(17),
    into,
    render: (l) => (
      <DesktopRecording src={REC.failclosed} from={1.2} rate={1} lead={l} />
    ),
  },
  {
    name: "End card",
    at: b(19),
    into: toEnd,
    render: (l) => <EndCard from={0.5} lead={l} />,
  },
];

const Promo15: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Cuts clips={CLIPS_15} end={END_15} />
    <CaptionBand />
    <Soundtrack
      music="15-sec-music.mp3"
      musicFrom={43.328}
      vo="vo-15-am_michael.wav"
      voAt={VO_15_AT}
      end={END_15}
    />
    {VO_15.slice(0, -1).map((words, i) => (
      <KineticCaption key={i} words={words} offset={VO_15_AT} />
    ))}
  </AbsoluteFill>
);

// ---------------------------------------------------------------- shared
// Music from a section that ends naturally on its own, ducked under the voiceover.
const Soundtrack: React.FC<{
  music: string;
  musicFrom: number;
  vo: string;
  voAt: number;
  end: number;
}> = ({ music, musicFrom, vo, voAt, end }) => {
  const { fps } = useVideoConfig();
  const last = Math.round(end * fps);
  return (
    <>
      <Audio
        name="Music"
        src={media(music)}
        trimBefore={Math.round(musicFrom * fps)}
        volume={(f) =>
          interpolate(
            f,
            [0, 4, last - 90, last - 30, last],
            [0, 0.42, 0.42, 0.6, 0.6],
            { extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={Math.round(voAt * fps)} name="Voiceover" layout="none">
        <Audio src={media(vo)} volume={1} />
      </Sequence>
    </>
  );
};

const EndCard: React.FC<{ from: number; lead: number }> = ({ from, lead }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <AbsoluteFill>
      {vertical ? (
        // The 16:9 animated card would crop its title; use the 9:16 still with a slow zoom.
        <Img
          src={media("end-card-9x16.jpg")}
          style={{
            width: "100%",
            height: "100%",
            transform: `scale(${1 + frame * 0.0008})`,
          }}
        />
      ) : (
        <FlowShot src={SHOT.end} from={from} lead={lead} />
      )}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: vertical ? 220 : 60,
          textAlign: "center",
          fontFamily,
          fontWeight: 500,
          fontSize: vertical ? 28 : 24,
          color: "rgba(255,255,255,0.72)",
          opacity: interpolate(frame, [20, 36], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Not financial advice. You remain responsible for every trade. Dry-run by
        default.
      </div>
    </AbsoluteFill>
  );
};

const at = (end: number) => Math.round(end * FPS);
export const TradeboardLaunch = () => (
  <>
    <Composition
      id="tradeboard-launch-30"
      component={Promo30}
      durationInFrames={at(END_30)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="tradeboard-launch-15"
      component={Promo15}
      durationInFrames={at(END_15)}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="tradeboard-launch-15-vertical"
      component={Promo15}
      durationInFrames={at(END_15)}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
