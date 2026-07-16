(function () {
  "use strict";

  var root = document.documentElement;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- theme toggle ---------- */
  var themeToggle = document.getElementById("theme-toggle");
  var stored = null;
  try { stored = localStorage.getItem("contempo-theme"); } catch (e) {}
  if (stored === "dark" || stored === "light") {
    root.setAttribute("data-theme", stored);
  }

  function currentTheme() {
    var attr = root.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function updateToggleIcon() {
    if (!themeToggle) return;
    themeToggle.textContent = currentTheme() === "dark" ? "○" : "◐";
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("contempo-theme", next); } catch (e) {}
      updateToggleIcon();
    });
    updateToggleIcon();
  }

  /* ---------- mobile nav ---------- */
  var nav = document.getElementById("nav");
  var navToggle = document.getElementById("nav-toggle");
  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("menu-open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("menu-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("menu-open")) {
        nav.classList.remove("menu-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.focus();
      }
    });
  }

  /* ---------- active nav link, synced to scroll position ---------- */
  var navLinks = document.querySelectorAll("[data-nav-link]");
  if (navLinks.length) {
    var sections = [];
    navLinks.forEach(function (link) {
      var id = link.getAttribute("href");
      var section = id && id.charAt(0) === "#" ? document.querySelector(id) : null;
      if (section) sections.push({ link: link, section: section });
    });

    if (sections.length && "IntersectionObserver" in window) {
      var navObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var match = sections.find(function (s) { return s.section === entry.target; });
            if (!match) return;
            if (entry.isIntersecting) {
              navLinks.forEach(function (l) { l.classList.remove("active"); });
              match.link.classList.add("active");
            }
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );
      sections.forEach(function (s) { navObserver.observe(s.section); });
    }
  }

  /* ---------- hero live session timer ---------- */
  var sessionTimerEl = document.getElementById("session-timer");
  var liveActivityTimeEl = document.getElementById("live-activity-time");
  var lockElapsedEl = document.getElementById("lock-elapsed");

  if (!reducedMotion && (sessionTimerEl || liveActivityTimeEl || lockElapsedEl)) {
    var elapsedSeconds = 12 * 60 + 47;

    function formatHMS(total) {
      var h = Math.floor(total / 3600);
      var m = Math.floor((total % 3600) / 60);
      var s = total % 60;
      return [h, m, s].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
    }

    function formatMS(total) {
      var m = Math.floor(total / 60);
      var s = total % 60;
      return [m, s].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
    }

    setInterval(function () {
      elapsedSeconds += 1;
      if (sessionTimerEl) sessionTimerEl.textContent = formatHMS(elapsedSeconds);
      if (liveActivityTimeEl) liveActivityTimeEl.textContent = formatMS(elapsedSeconds);
      if (lockElapsedEl) lockElapsedEl.textContent = formatMS(elapsedSeconds);
    }, 1000);
  }

  /* ---------- count-up numbers, once their card scrolls into view ---------- */
  var countEls = document.querySelectorAll(".count-up");
  if (countEls.length) {
    countEls.forEach(function (el) {
      var target = parseInt(el.getAttribute("data-target"), 10) || 0;
      if (reducedMotion || !("IntersectionObserver" in window)) {
        el.textContent = String(target);
        return;
      }
      var countObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            countObserver.unobserve(entry.target);
            var start = null;
            var duration = 900;
            function step(ts) {
              if (start === null) start = ts;
              var progress = Math.min((ts - start) / duration, 1);
              el.textContent = String(Math.round(progress * target));
              if (progress < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.4 }
      );
      countObserver.observe(el);
    });
  }

  /* ---------- FAQ accordion ---------- */
  document.querySelectorAll(".faq-item").forEach(function (item) {
    var btn = item.querySelector(".faq-q");
    var answer = item.querySelector(".faq-a");
    if (!btn || !answer) return;

    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove("open");
          openItem.querySelector(".faq-a").style.maxHeight = null;
        }
      });
      if (isOpen) {
        item.classList.remove("open");
        answer.style.maxHeight = null;
      } else {
        item.classList.add("open");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });

  /* ---------- reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("in-view"); });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("in-view");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.2 }
      );
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  /* ---------- waitlist mock submit ---------- */
  var form = document.getElementById("waitlist-form");
  var success = document.getElementById("waitlist-success");
  if (form && success) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.style.display = "none";
      success.classList.add("show");
    });
  }
})();
