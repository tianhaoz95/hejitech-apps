import { loadFont } from "@remotion/google-fonts/Inter";
import {
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const { fontFamily } = loadFont("normal", {
  weights: ["500", "700", "800"],
  subsets: ["latin"],
});
export { fontFamily };

type Word = [text: string, start: number, end: number];

// One voiceover line as a kinetic caption: each word rises in as it is spoken, the spoken word is
// bright and the rest dimmed, and the line lifts away just after it ends. Times are seconds from the
// start of the voiceover, which plays from `offset`.
export const KineticCaption: React.FC<{ words: Word[]; offset: number }> = ({
  words,
  offset,
}) => {
  const { fps } = useVideoConfig();
  const from = Math.round((offset + words[0][1]) * fps) - 3;
  const until = Math.round((offset + words[words.length - 1][2]) * fps) + 10;
  return (
    <Sequence
      from={from}
      durationInFrames={until - from}
      name={`Caption: ${words.map((w) => w[0]).join(" ")}`}
      layout="none"
    >
      <Line words={words} offset={offset} from={from} total={until - from} />
    </Sequence>
  );
};

const Line: React.FC<{
  words: Word[];
  offset: number;
  from: number;
  total: number;
}> = ({ words, offset, from, total }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const out = interpolate(frame, [total - 7, total], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: vertical ? 300 : 84,
        display: "flex",
        justifyContent: "center",
        padding: "0 60px",
        opacity: 1 - out,
        transform: `translateY(${-14 * out}px)`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: vertical ? 70 : 58,
          lineHeight: 1.15,
          letterSpacing: -1,
          textAlign: "center",
          maxWidth: vertical ? 940 : 1500,
          textShadow: "0 3px 18px rgba(0,0,0,0.55)",
        }}
      >
        {words.map(([text, start, end], i) => {
          const at = (offset + start) * fps - from;
          const s = spring({
            frame: frame - at + 2,
            fps,
            config: { damping: 18, stiffness: 220 },
          });
          const speaking =
            frame >= at && frame <= (offset + end) * fps - from + 4;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                marginRight: "0.26em",
                opacity: s,
                transform: `translateY(${(1 - s) * 22}px)`,
                color: speaking ? "#ffffff" : "rgba(255,255,255,0.82)",
              }}
            >
              {text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// A soft dark band along the bottom so white captions read over bright footage.
export const CaptionBand: React.FC = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: vertical ? 760 : 340,
        pointerEvents: "none",
        background:
          "linear-gradient(to bottom, rgba(5,12,22,0) 0%, rgba(5,12,22,0.5) 70%, rgba(5,12,22,0.6) 100%)",
      }}
    />
  );
};

// Small tag on product footage so prices aren't read as real.
export const DemoLabel: React.FC = () => {
  const { width, height } = useVideoConfig();
  const vertical = height > width;
  return (
    <div
      style={{
        position: "absolute",
        top: vertical ? 120 : 34,
        right: vertical ? 40 : 44,
        fontFamily,
        fontWeight: 500,
        fontSize: 22,
        color: "rgba(255,255,255,0.88)",
        padding: "6px 14px",
        borderRadius: 999,
        background: "rgba(14, 27, 43, 0.6)",
      }}
    >
      Demo data
    </div>
  );
};
