import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DemoLabel } from "./Caption";

const BACKDROP =
  "radial-gradient(circle at 50% 38%, #2a5582 0%, #1a3653 45%, #0e1b2b 100%)";

// A desktop screen recording in a window on the brand navy, gently pushing in so it never sits still.
export const DesktopRecording: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
  focus?: number; // 9:16 only: horizontal zoom origin, 0 (left) to 100 (right); 50 for centred pages
}> = ({ src, from, rate = 1, lead, focus = 50 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const w = vertical ? 1010 : 1380; // leaves the bottom band free for captions
  const push = 1 + frame * 0.0006; // useVideoConfig() is the whole video's length, not this clip's
  return (
    <AbsoluteFill
      style={{
        background: BACKDROP,
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
          background: "#f6f7f9",
          transform: `scale(${push}) translateY(${vertical ? -150 : 0}px)`,
          boxShadow:
            "0 40px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: 34,
            background: "#e9ecf1",
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
        <div style={{ height: vertical ? 900 : undefined, overflow: "hidden" }}>
          <Video
            src={src}
            trimBefore={Math.max(
              0,
              Math.round((from - (lead / fps) * rate) * fps),
            )}
            playbackRate={rate}
            muted
            // 9:16: a taller window zoomed onto the portal's centred content column, so text stays readable
            style={{
              width: "100%",
              display: "block",
              transform: vertical ? "scale(1.6)" : undefined,
              transformOrigin: `${focus}% 0`,
            }}
          />
        </div>
      </div>
      <DemoLabel />
    </AbsoluteFill>
  );
};

// The phone recording in a plain phone frame that settles into place.
export const PhoneRecording: React.FC<{
  src: string;
  from: number;
  rate?: number;
  lead: number;
}> = ({ src, from, rate = 1, lead }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const h = vertical ? 1560 : 960;
  const settle = interpolate(frame, [0, 16], [1, 0], {
    extrapolateRight: "clamp",
    easing: (t) => 1 - (1 - t) ** 3,
  });
  return (
    <AbsoluteFill
      style={{
        background: BACKDROP,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          height: h,
          width: (h * 1080) / 2340 + 28,
          padding: 14,
          borderRadius: h * 0.075,
          background: "#0b0f14",
          boxShadow: "0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 2px #2b3440",
          transform: `perspective(1600px) rotateY(${-10 * settle}deg) translateY(${(vertical ? -60 : 0) + 30 * settle}px)`,
        }}
      >
        <Video
          src={src}
          trimBefore={Math.max(
            0,
            Math.round((from - (lead / fps) * rate) * fps),
          )}
          playbackRate={rate}
          muted
          objectFit="cover"
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

// A Flow shot (16:9 source), filling the frame with a slow push-in. In 9:16 it is sized to the
// frame's height and centred, i.e. cropped at the sides (objectFit stretched the canvas-backed Video).
export const FlowShot: React.FC<{
  src: string;
  from: number;
  lead: number;
  zoom?: number;
}> = ({ src, from, lead, zoom = 1 }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const push = zoom * (1 + frame * 0.0007);
  const w = Math.max(width, (height * 16) / 9);
  const h = (w * 9) / 16;
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Video
        src={src}
        trimBefore={Math.max(0, Math.round(from * fps) - lead)}
        muted
        style={{
          position: "absolute",
          width: w,
          height: h,
          left: (width - w) / 2,
          top: (height - h) / 2,
          transform: `scale(${push})`,
        }}
      />
    </AbsoluteFill>
  );
};
