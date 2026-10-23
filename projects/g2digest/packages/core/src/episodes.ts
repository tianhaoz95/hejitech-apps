// Podcast-feed episode numbers (PRD §7.3 fallback): every audio file of an edition in card order,
// glance before deep dive. The feed and the plugin's "podcast app" mode share this numbering, so
// the glasses can say which episode to play.
import type { AudioKind } from "./player.ts";
import type { Bundle } from "./types.ts";

export interface Episode {
  n: number;
  slug: string;
  card_index: number;
  kind: AudioKind;
  audio_path: string;
  duration_sec: number;
}

export function episodes(bundle: Bundle): Episode[] {
  const out: Episode[] = [];
  bundle.cards.forEach((c, i) => {
    for (const kind of ["glance", "deep_dive"] as const) {
      const a = c[kind];
      if (a) out.push({ n: out.length + 1, slug: c.slug, card_index: i, kind, audio_path: a.audio_path, duration_sec: a.duration_sec });
    }
  });
  return out;
}
