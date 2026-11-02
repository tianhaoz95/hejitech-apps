// The home page's promo video: a poster served by the Worker, swapped for the YouTube player only
// after a click, so nothing loads from YouTube until then (the privacy page says so).
const promo = document.querySelector<HTMLButtonElement>("[data-promo] .promo");
promo?.addEventListener("click", () => {
  const frame = document.createElement("iframe");
  frame.className = "promo";
  frame.src = "https://www.youtube-nocookie.com/embed/To1mquGs_JQ?autoplay=1&rel=0";
  frame.title = "Wee Hours: whisper the 3am feed to your watch, and both parents know (30 s)";
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  promo.replaceWith(frame);
});
