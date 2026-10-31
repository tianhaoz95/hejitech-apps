// The public landing page (served at / to signed-out visitors, and at /welcome/). Static except for
// the promo video, which loads YouTube only after a click, and the buttons, which open the board
// instead of the sign-in page when there's already a session.
import { el } from "./ui.ts";

const promo = document.querySelector<HTMLElement>("[data-promo] .promo");
promo?.addEventListener("click", () => {
  promo.replaceWith(el("iframe", {
    class: "promo", src: "https://www.youtube-nocookie.com/embed/7zRrCZNjr8s?autoplay=1&rel=0", title: "How Trading Plan Board works (30 s)",
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen", allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin",
  }));
});

// At / the Worker only serves this page without a session cookie, so only /welcome/ needs to ask.
if (location.pathname !== "/") void fetch("/api/me", { credentials: "same-origin" }).then((me) => {
  if (!me.ok) return;
  document.querySelectorAll<HTMLElement>("[data-signed-out]").forEach((e) => (e.hidden = true));
  document.querySelectorAll<HTMLElement>("[data-signed-in]").forEach((e) => (e.hidden = false));
}).catch(() => {});
