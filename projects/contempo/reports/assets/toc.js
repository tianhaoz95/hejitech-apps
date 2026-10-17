// Auto-builds the sidebar table of contents from h2/h3 headings inside .report-content.
(function () {
  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
  }

  function buildToc() {
    const content = document.querySelector(".report-content");
    const tocList = document.querySelector("#toc-list");
    if (!content || !tocList) return;

    const headings = content.querySelectorAll("h2, h3");
    const usedIds = new Set();
    let currentTopLi = null;
    let currentSubUl = null;

    headings.forEach((h) => {
      if (!h.id) {
        let base = slugify(h.textContent);
        let id = base;
        let n = 2;
        while (usedIds.has(id) || document.getElementById(id)) {
          id = `${base}-${n++}`;
        }
        h.id = id;
      }
      usedIds.add(h.id);

      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `#${h.id}`;
      a.textContent = h.textContent;
      li.appendChild(a);

      if (h.tagName === "H2") {
        tocList.appendChild(li);
        currentTopLi = li;
        currentSubUl = null;
      } else {
        if (!currentTopLi) {
          tocList.appendChild(li);
          return;
        }
        if (!currentSubUl) {
          currentSubUl = document.createElement("ul");
          currentSubUl.className = "toc-sub";
          currentTopLi.appendChild(currentSubUl);
        }
        currentSubUl.appendChild(li);
      }
    });

    const links = Array.from(tocList.querySelectorAll("a"));
    if (!links.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = tocList.querySelector(`a[href="#${entry.target.id}"]`);
          if (!link) return;
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            link.classList.add("active");
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
  }

  function setupMobileToggle() {
    const tocCol = document.querySelector(".toc-col");
    const title = document.querySelector(".toc-col .toc-title");
    if (!tocCol || !title) return;
    title.addEventListener("click", () => {
      if (window.innerWidth <= 900) {
        tocCol.classList.toggle("open");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    buildToc();
    setupMobileToggle();
  });
})();
