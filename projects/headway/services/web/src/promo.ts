// The home page's promo video: a poster served by the Worker, swapped for the YouTube player only
// after a click, so nothing loads from YouTube until then (the privacy page says so).
import { el } from "./supabase.ts";

const promo = document.querySelector<HTMLElement>("[data-promo] .promo");
promo?.addEventListener("click", () => {
  promo.replaceWith(el("iframe", {
    class: "promo", src: "https://www.youtube-nocookie.com/embed/dAxVDil4ARA?autoplay=1&rel=0", title: "Headway: your next Caltrain, at a glance (30 s)",
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin",
  }));
});
