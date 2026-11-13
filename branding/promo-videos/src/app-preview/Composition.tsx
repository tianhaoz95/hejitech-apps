// App Store app previews (886 x 1920, 30 fps, under 30 s): the iPhone screen recordings from
// scripts/app-preview-record.mjs, each under a headline like the captioned screenshots, over the launch
// music. Apple's rules: footage of the app itself only (no glasses or other hardware), text overlays allowed.
import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Composition, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const FPS = 30, W = 886, H = 1920;
type Shot = { clip: string; from: number; to: number; title: string; sub?: string; zoom?: { scale: number; y: number } };
type Preview = { id: string; dir: string; accent: string; music: string; shots: Shot[] };

const frames = (s: number) => Math.round(s * FPS);
const total = (p: Preview) => p.shots.reduce((n, s) => n + frames(s.to - s.from), 0);

const ScreenShot: React.FC<{ p: Preview; s: Shot }> = ({ p, s }) => {
  const f = useCurrentFrame();
  const len = frames(s.to - s.from);
  const fade = interpolate(f, [0, 5, len - 4, len], [0, 1, 1, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(f, [0, 8], [24, 0], { extrapolateRight: "clamp" });
  // The recordings are 1320 x 2868; the screen shows at 720 wide. A zoom crops into part of it (the Lock
  // Screen's Live Activity, not its clock).
  const vw = 720, vh = Math.round((vw * 2868) / 1320);
  const z = s.zoom;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 55% at 50% 0%, ${p.accent}40 0%, #0b0c0e 60%), #0b0c0e`, alignItems: "center" }}>
      <div style={{ position: "absolute", top: 92, width: W - 90, textAlign: "center", transform: `translateY(${rise}px)`, opacity: fade, fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
        <div style={{ color: "#fff", fontSize: 66, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1.08 }} dangerouslySetInnerHTML={{ __html: s.title.replace(/<em>/g, `<span style="color:${p.accent}">`).replace(/<\/em>/g, "</span>") }} />
        {s.sub ? <div style={{ color: "#b9bdc6", fontSize: 32, fontWeight: 500, marginTop: 16, lineHeight: 1.3 }}>{s.sub}</div> : null}
      </div>
      <div style={{ position: "absolute", top: 330, width: vw, height: H - 330 - 30, borderRadius: 54, overflow: "hidden", border: "6px solid #2a2d33", boxShadow: "0 30px 90px #000c", background: "#000" }}>
        <div style={{ width: vw, height: vh, transformOrigin: `50% ${z ? z.y * 100 : 0}%`, transform: z ? `scale(${z.scale})` : undefined }}>
          <Video src={staticFile(`${p.dir}/${s.clip}`)} trimBefore={frames(s.from)} muted style={{ width: vw, height: vh }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PreviewVideo: React.FC<{ p: Preview }> = ({ p }) => {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: "#0b0c0e" }}>
      {p.shots.map((s) => {
        const from = at;
        at += frames(s.to - s.from);
        return (
          <Sequence key={`${s.clip}-${s.from}`} from={from} durationInFrames={frames(s.to - s.from)}>
            <ScreenShot p={p} s={s} />
          </Sequence>
        );
      })}
      <Audio src={staticFile(p.music)} volume={(f) => interpolate(f, [0, 10, durationInFrames - 30, durationInFrames], [0, 0.55, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};

export const HEADWAY: Preview = {
  id: "headway-preview", dir: "headway-preview", accent: "#3EE07A", music: "headway-launch/30-sec-music.mp3",
  shots: [
    { clip: "rec-4-track.mp4", from: 0.0, to: 2.6, title: "Know when to <em>leave</em>", sub: "Live Caltrain departures and a leave-by countdown" },
    { clip: "rec-1-board.mp4", from: 0.4, to: 3.4, title: "Every train, <em>live</em>", sub: "Delays, express and local, and when to go for each" },
    { clip: "rec-4-track.mp4", from: 2.6, to: 6.2, title: "Track your <em>train</em>", sub: "Next stop, arrival and stops to go" },
    { clip: "rec-5-lock.mp4", from: 1.0, to: 5.0, title: "On your <em>Lock Screen</em>", sub: "A Live Activity until you arrive" },
    { clip: "rec-5-lock.mp4", from: 6.2, to: 10.2, title: "Told when it's <em>late</em>", sub: "Alerts only for your trains" },
    { clip: "rec-2-commute.mp4", from: 0.3, to: 5.6, title: "Set your commute <em>once</em>", sub: "Morning and evening, your walk, your alert hours" },
    { clip: "rec-3-family.mp4", from: 0.3, to: 4.6, title: "Follow your <em>family</em>", sub: "Their trains, and only what each person shares" },
    { clip: "rec-3-family.mp4", from: 4.6, to: 6.4, title: "One price · <em>no subscription</em>" },
  ],
};

export const FITLOOP: Preview = {
  id: "fitloop-preview", dir: "fitloop-preview", accent: "#FF7A3D", music: "fitloop-launch/music-30s-take1-gym-pro-grooves.mp3",
  shots: [
    { clip: "rec-1-today.mp4", from: 0.3, to: 3.6, title: "Your agent's plan, <em>ready</em>", sub: "Your AI assistant writes it; FitLoop runs it" },
    { clip: "rec-1-today.mp4", from: 4.2, to: 7.0, title: "Check off <em>meals</em>", sub: "Calories and protein against your targets" },
    { clip: "rec-2-workout.mp4", from: 0.3, to: 5.8, title: "Follow it <em>set by set</em>", sub: "Targets, cues and every exercise in order" },
    { clip: "rec-2-workout.mp4", from: 7.1, to: 11.2, title: "Rest timer <em>starts itself</em>", sub: "Mark a set done and the rest counts down" },
    { clip: "rec-3-feedback.mp4", from: 0.3, to: 4.3, title: "Your agent <em>listens</em>", sub: "Leave a note; it replies and adjusts the plan" },
    { clip: "rec-4-plan.mp4", from: 0.3, to: 5.8, title: "Built around <em>you</em>", sub: "Goals, limits, targets and the week ahead" },
    { clip: "rec-5-progress.mp4", from: 0.3, to: 3.3, title: "One price · <em>no subscription</em>", sub: "No AI bill: bring the assistant you already use" },
  ],
};

// ---------- Google Play promo videos (YouTube link on the listing): 1920 x 1080, the Android app on the
// emulator (scripts/play-video-record.mjs), headline on the left, the phone screen on the right.
const PW = 1920, PH = 1080;
const PlayShot: React.FC<{ p: Preview; s: Shot; light?: boolean }> = ({ p, s, light }) => {
  const f = useCurrentFrame();
  const len = frames(s.to - s.from);
  const fade = interpolate(f, [0, 6, len - 4, len], [0, 1, 1, 0.9], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(f, [0, 9], [26, 0], { extrapolateRight: "clamp" });
  // The recordings are 1080 x 2400; the screen shows 440 wide (978 high) inside a phone frame.
  const vw = 440, vh = Math.round((vw * 2400) / 1080);
  return (
    <AbsoluteFill style={{ background: `radial-gradient(70% 90% at 72% 50%, ${p.accent}38 0%, #0b0c0e 62%), #0b0c0e` }}>
      <div style={{ position: "absolute", left: 150, top: 0, bottom: 0, width: 900, display: "flex", flexDirection: "column", justifyContent: "center", transform: `translateY(${rise}px)`, opacity: fade, fontFamily: "-apple-system, 'SF Pro Display', 'Helvetica Neue', sans-serif" }}>
        <div style={{ color: "#fff", fontSize: 84, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1.06 }} dangerouslySetInnerHTML={{ __html: s.title.replace(/<em>/g, `<span style="color:${p.accent}">`).replace(/<\/em>/g, "</span>") }} />
        {s.sub ? <div style={{ color: "#b9bdc6", fontSize: 38, fontWeight: 500, marginTop: 26, lineHeight: 1.3 }}>{s.sub}</div> : null}
      </div>
      <div style={{ position: "absolute", right: 250, top: (PH - vh) / 2 - 8, width: vw, height: vh, borderRadius: 44, overflow: "hidden", border: `8px solid ${light ? "#3a3d44" : "#2a2d33"}`, boxShadow: "0 30px 90px #000c", background: "#000" }}>
        <Video src={staticFile(`${p.dir}/${s.clip}`)} trimBefore={frames(s.from)} muted style={{ width: vw, height: vh }} />
      </div>
    </AbsoluteFill>
  );
};

const PlayVideo: React.FC<{ p: Preview; light?: boolean }> = ({ p, light }) => {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: "#0b0c0e" }}>
      {p.shots.map((s) => {
        const from = at;
        at += frames(s.to - s.from);
        return (
          <Sequence key={`${s.clip}-${s.from}`} from={from} durationInFrames={frames(s.to - s.from)}>
            <PlayShot p={p} s={s} light={light} />
          </Sequence>
        );
      })}
      <Audio src={staticFile(p.music)} volume={(f) => interpolate(f, [0, 10, durationInFrames - 30, durationInFrames], [0, 0.55, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </AbsoluteFill>
  );
};

export const HEADWAY_PLAY: Preview = {
  id: "headway-play", dir: "headway-play", accent: HEADWAY.accent, music: HEADWAY.music,
  shots: [
    { clip: "rec-1-board.mp4", from: 0.2, to: 3.2, title: "Know when to <em>leave</em>", sub: "Live Caltrain departures and a leave-by countdown" },
    { clip: "rec-1-board.mp4", from: 3.2, to: 6.6, title: "Every train, <em>live</em>", sub: "Delays, express and local, and when to go for each" },
    { clip: "rec-2-track.mp4", from: 3.6, to: 7.4, title: "Track your <em>train</em>", sub: "Next stop, arrival and stops to go" },
    { clip: "rec-3-commute.mp4", from: 0.3, to: 6.1, title: "Set your commute <em>once</em>", sub: "Morning and evening, your walk, your alert hours" },
    { clip: "rec-5-settings.mp4", from: 0.2, to: 4.0, title: "Told when it's <em>late</em>", sub: "Alerts only for your trains: delays, cancellations, when to leave" },
    { clip: "rec-4-family.mp4", from: 0.3, to: 4.6, title: "Follow your <em>family</em>", sub: "Their trains, and only what each person shares" },
    { clip: "rec-4-family.mp4", from: 4.6, to: 7.0, title: "One price · <em>no subscription</em>", sub: "On your phone and your Wear OS watch" },
  ],
};

export const FITLOOP_PLAY: Preview = {
  id: "fitloop-play", dir: "fitloop-play", accent: FITLOOP.accent, music: FITLOOP.music,
  shots: [
    { clip: "rec-1-today.mp4", from: 0.3, to: 3.0, title: "Your agent's plan, <em>ready</em>", sub: "Your AI assistant writes it; FitLoop runs it" },
    { clip: "rec-1-today.mp4", from: 3.0, to: 7.2, title: "Check off <em>meals</em>", sub: "Calories and protein against your targets" },
    { clip: "rec-2-workout.mp4", from: 2.6, to: 6.6, title: "Follow it <em>set by set</em>", sub: "Targets, cues and every exercise in order" },
    { clip: "rec-2-workout.mp4", from: 8.5, to: 12.7, title: "Rest timer <em>starts itself</em>", sub: "Mark a set done and the rest counts down" },
    { clip: "rec-3-feedback.mp4", from: 0.2, to: 4.2, title: "Your agent <em>listens</em>", sub: "Leave a note; it replies and adjusts the plan" },
    { clip: "rec-4-plan.mp4", from: 0.3, to: 6.1, title: "Built around <em>you</em>", sub: "Goals, limits, targets and the week ahead" },
    { clip: "rec-5-progress.mp4", from: 0.2, to: 3.6, title: "One price · <em>no subscription</em>", sub: "No AI bill: bring the assistant you already use" },
  ],
};

export const AppPreviews: React.FC = () => (
  <>
    {[HEADWAY, FITLOOP].map((p) => (
      <Composition key={p.id} id={p.id} component={PreviewVideo} defaultProps={{ p }} durationInFrames={total(p)} fps={FPS} width={W} height={H} />
    ))}
    <Composition id={HEADWAY_PLAY.id} component={PlayVideo} defaultProps={{ p: HEADWAY_PLAY }} durationInFrames={total(HEADWAY_PLAY)} fps={FPS} width={PW} height={PH} />
    <Composition id={FITLOOP_PLAY.id} component={PlayVideo} defaultProps={{ p: FITLOOP_PLAY, light: true }} durationInFrames={total(FITLOOP_PLAY)} fps={FPS} width={PW} height={PH} />
  </>
);
