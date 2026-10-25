// The tour: a built-in bundle the plugin plays whenever there's no edition to read (not paired yet,
// paired but nothing published, offline with nothing fetched). The glasses never show a dead end:
// every gesture works on it, it teaches the ring, and its last section says what to do next. Even
// Hub reviewers see it too, since they install without an account. Generic product copy only, no
// topics (check-no-topics.mjs), no audio (nothing to fetch), and no URLs (cards never show one: the
// phone page carries the address).
import type { Bundle, CardInput } from "./types.ts";

/** Why there's no edition: decides the tour's "next step" card. */
export type TourReason = "pair" | "waiting" | "offline";

const NEXT: Record<TourReason, Pick<CardInput, "title" | "body">> = {
  pair: { title: "Pair your glasses", body: "Sign in to G2 Digest on the web, open Pair, and type the code on your phone." },
  waiting: { title: "Paired", body: "Your first edition isn't out yet. Connect an agent from Agents on the web." },
  offline: { title: "Offline", body: "Nothing fetched yet. Connect your phone, then open G2 Digest again." },
};

/** True for a bundle made by `tour()` (the plugin doesn't remember a position on it). */
export const isTour = (b: Bundle | null | undefined) => b?.edition.title === TOUR_TITLE;
const TOUR_TITLE = "Welcome to G2 Digest";

export function tour(reason: TourReason, date: string): Bundle {
  const section = (section_id: string, slug: string, title: string, body: string): CardInput => ({ slug, kind: "section", section_id, template: "note", title, body });
  return {
    date,
    guide_version: "tour",
    brief_version: 0,
    edition: {
      title: TOUR_TITLE,
      sections: [
        { section_id: "how", title: "How it works", body: "An agent compiles each edition ahead of time from your brief. The glasses only play it back.", sources: [] },
        { section_id: "ring", title: "The ring", body: "Swipe to move between cards, tap to listen, double-tap to stop or exit.", sources: [] },
        { section_id: "next", title: "Next step", body: NEXT[reason].body, sources: [] },
      ],
    },
    cards: [
      { slug: "cover", kind: "cover", title: "G2 Digest", body: "Your brief as cards and audio. Swipe down for a short tour." },
      section("how", "made-ahead", "Made before you wake", "An agent writes each edition from your brief. The glasses only play it back."),
      section("ring", "swipe", "Swipe to move", "Down for the next card, up for the previous one."),
      section("ring", "tap", "Tap to listen", "Tap plays a card's short audio. Tap, then hold, plays its deep dive."),
      section("ring", "double-tap", "Double-tap to leave", "Double-tap stops audio. With nothing playing, it asks to exit."),
      section("next", "next-step", NEXT[reason].title, NEXT[reason].body),
      { slug: "end", kind: "end", title: "End of the tour", body: "Swipe up to go back through it." },
    ],
  };
}
