// Plain script (not type="module"), loaded before assets/script.js, so the
// toggle is interactive immediately rather than waiting on that module's
// Firebase CDN imports to resolve. Same convention as
// branding/landing_v0/site/assets/script.js's theme toggle.
(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("theme-toggle");
  var stored = null;
  try {
    stored = localStorage.getItem("contempo-theme");
  } catch (e) {}
  if (stored === "dark" || stored === "light") {
    root.setAttribute("data-theme", stored);
  }

  function currentTheme() {
    var attr = root.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateIcon() {
    if (!toggle) return;
    toggle.textContent = currentTheme() === "dark" ? "○" : "◐";
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("contempo-theme", next);
      } catch (e) {}
      updateIcon();
    });
    updateIcon();
  }
})();
