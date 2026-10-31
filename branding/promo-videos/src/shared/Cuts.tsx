import {
  linearTiming,
  TransitionPresentation,
  TransitionSeries,
} from "@remotion/transitions";
import { Fragment } from "react";
import { useVideoConfig } from "remotion";

// A timeline written as cut points (seconds), so cuts can sit exactly on the music's beats.
// Each transition is centred on its cut: the outgoing clip runs T/2 past it, the incoming one starts
// T/2 before it. A clip's `src` is the source second that should be on screen at its cut.
export type Clip = {
  name: string;
  at: number; // cut time (s) where this clip takes over
  // Renders the clip. `lead` = frames the clip is on screen before its cut (half the transition),
  // so a video can start at src - lead to have src exactly on the cut.
  render: (lead: number) => React.ReactNode;
  // Transition into this clip from the previous one.
  into?: {
    presentation: TransitionPresentation<Record<string, unknown>>;
    frames: number;
  };
};

export const Cuts: React.FC<{ clips: Clip[]; end: number }> = ({
  clips,
  end,
}) => {
  const { fps } = useVideoConfig();
  const t = (i: number) =>
    i > 0 && i < clips.length ? (clips[i].into?.frames ?? 0) : 0;
  return (
    <TransitionSeries name="Cuts">
      {clips.map((clip, i) => {
        const start = Math.round(clip.at * fps) - Math.floor(t(i) / 2);
        const stop =
          i + 1 < clips.length
            ? Math.round(clips[i + 1].at * fps) + Math.ceil(t(i + 1) / 2)
            : Math.round(end * fps);
        return (
          <Fragment key={clip.name}>
            {i > 0 && clip.into ? (
              <TransitionSeries.Transition
                presentation={clip.into.presentation}
                timing={linearTiming({ durationInFrames: clip.into.frames })}
              />
            ) : null}
            <TransitionSeries.Sequence
              name={clip.name}
              durationInFrames={stop - start}
            >
              {clip.render(Math.floor(t(i) / 2))}
            </TransitionSeries.Sequence>
          </Fragment>
        );
      })}
    </TransitionSeries>
  );
};
