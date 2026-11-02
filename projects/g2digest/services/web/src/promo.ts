// The home page's promo video: a poster served by the Worker, swapped for the YouTube player only
// after a click, so nothing loads from YouTube until then (the privacy page says so).
const promo = document.querySelector<HTMLButtonElement>("[data-promo] .promo");
promo?.addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.className = "promo";
  frame.src = "https://www.youtube-nocookie.com/embed/gcS32dRwPMo?autoplay=1&rel=0";
  frame.title = "G2 Digest: your brief, ready before the train, on Even G2 glasses (30 s)";
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  promo.replaceWith(frame);
});
