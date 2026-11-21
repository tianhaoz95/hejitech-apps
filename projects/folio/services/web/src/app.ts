// The dashboard: your artifacts and the ones shared with you, recent activity, and a blank new one.
import { agentBadge, api, el, requireSession, spinner, timeAgo, toast } from "./common.ts";

const root = document.getElementById("app")!;

interface Summary {
  slug: string;
  title: string;
  description: string;
  visibility: "private" | "link";
  role: "owner" | "editor" | "viewer";
  head_version: number;
  open_suggestions: number;
  favorite?: boolean;
  updated_at: string;
}
interface Ev {
  id: number;
  kind: string;
  agent: string;
  summary: string;
  created_at: string;
  artifact: { slug: string; title: string };
}

const STARTER = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Untitled</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <h1>Untitled</h1>
    <p>Ask any connected agent to build this out: “Edit my Folio artifact … into …”.</p>
  </main>
</body>
</html>
`;
const STARTER_CSS = `body { font: 17px/1.6 system-ui, sans-serif; margin: 0; color: #1c1c1a; background: #fff; }
main { max-width: 680px; margin: 64px auto; padding: 0 20px; }
`;

let query = "";
let openMenuEl: { menu: HTMLElement; anchor: HTMLElement } | null = null;

function closeMenu() {
  if (!openMenuEl) return;
  openMenuEl.menu.remove();
  openMenuEl.anchor.setAttribute("aria-expanded", "false");
  openMenuEl = null;
}
document.addEventListener("click", (e) => {
  if (openMenuEl && !openMenuEl.menu.contains(e.target as Node)) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && openMenuEl) {
    const a = openMenuEl.anchor;
    closeMenu();
    a.focus();
  }
});

async function render() {
  const s = await requireSession(root, render);
  if (!s) return;
  root.replaceChildren(spinner());
  const [items, events] = await Promise.all([api<Summary[]>("/api/artifacts"), api<Ev[]>("/api/activity")]);

  let items_ = items;
  const favGrid = el("div", { class: "artifact-grid" });
  const favSection = el("section", { class: "section", style: "margin-bottom: 28px" }, el("h2", { class: "grid-head" }, "Favorites"), favGrid);
  const allHead = el("h2", { class: "grid-head" }, "Artifacts");
  const grid = el("div", { class: "artifact-grid" });

  const card = (a: Summary) =>
    el(
      "a",
      { class: "card", href: `/a/${a.slug}` },
      el("div", { class: "title" }, a.favorite ? el("span", { class: "fav-star", "aria-label": "Favorite" }, "★") : null, a.title),
      moreButton(a),
              a.description ? el("div", { class: "desc" }, a.description) : el("div", { class: "desc faint" }, "No description"),
              el(
                "div",
                { class: "foot" },
                el("span", {}, `v${a.head_version}`),
                el("span", {}, "·"),
                el("span", {}, timeAgo(a.updated_at)),
                a.role !== "owner" && el("span", { class: "pill" }, a.role === "editor" ? "Shared · editor" : "Shared · viewer"),
                a.visibility === "link" && el("span", { class: "pill" }, "Link"),
                a.open_suggestions > 0 && el("span", { class: "pill accent" }, `${a.open_suggestions} suggestion${a.open_suggestions === 1 ? "" : "s"}`)
      )
    );

  // The ⋯ menu on a card: favorite, and delete (yours) or leave (shared with you).
  const moreButton = (a: Summary) => {
    const btn = el("button", { class: "card-more", type: "button", "aria-label": `More for ${a.title}`, "aria-haspopup": "menu", title: "More" }, "⋯");
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openMenu(btn, a);
    });
    return btn;
  };

  const openMenu = (anchor: HTMLElement, a: Summary) => {
    closeMenu();
    const item = (label: string, cls: string, run: () => void) => {
      const b = el("button", { type: "button", role: "menuitem", class: cls }, label);
      b.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        closeMenu();
        run();
      });
      return b;
    };
    const menu = el(
      "div",
      { class: "card-menu", role: "menu" },
      item(a.favorite ? "Remove from favorites" : "Add to favorites", "", () => void toggleFavorite(a)),
      a.role === "owner" ? item("Delete…", "danger", () => void remove(a)) : item("Leave…", "danger", () => void remove(a))
    );
    menu.addEventListener("click", (ev) => ev.preventDefault()); // it sits inside the card's link
    anchor.parentElement!.append(menu);
    anchor.setAttribute("aria-expanded", "true");
    (menu.firstElementChild as HTMLElement).focus();
    openMenuEl = { menu, anchor };
  };

  const toggleFavorite = async (a: Summary) => {
    const on = !a.favorite;
    a.favorite = on;
    draw();
    try {
      await api(`/api/artifacts/${a.slug}/favorite`, { method: on ? "POST" : "DELETE" });
    } catch (e) {
      a.favorite = !on;
      draw();
      toast((e as Error).message, "error");
    }
  };

  const remove = async (a: Summary) => {
    if (a.role === "owner") {
      if (prompt(`Delete "${a.title}" with every version, suggestion and comment? This can't be undone.\n\nType DELETE to confirm.`) !== "DELETE") return;
    } else if (!confirm(`Leave "${a.title}"? You (and your agents) will lose access until invited again.`)) return;
    try {
      if (a.role === "owner") await api(`/api/artifacts/${a.slug}`, { method: "DELETE" });
      else {
        const me = await api<{ id: string }>("/api/me");
        await api(`/api/artifacts/${a.slug}/members/${me.id}`, { method: "DELETE" });
      }
      items_ = items_.filter((x) => x.slug !== a.slug);
      draw();
      toast(a.role === "owner" ? `Deleted "${a.title}"` : `Left "${a.title}"`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const draw = () => {
    const q = query.trim().toLowerCase();
    const shown = items_.filter((a) => !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    const favs = shown.filter((a) => a.favorite);
    const rest = shown.filter((a) => !a.favorite);
    favSection.hidden = !favs.length;
    allHead.hidden = !favs.length || !rest.length;
    favGrid.replaceChildren(...favs.map(card));
    grid.replaceChildren(
      ...(rest.length
        ? rest.map(card)
        : favs.length
          ? []
          : [el("div", { class: "empty", style: "grid-column: 1 / -1" }, items_.length ? "Nothing matches." : "No artifacts yet. Ask a connected agent to make one, or start a blank one.")])
    );
  };
  draw();

  const search = el("input", { type: "search", placeholder: "Search artifacts", value: query, style: "max-width: 260px" });
  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });

  const create = el("button", { class: "btn primary", type: "button" }, "New artifact");
  create.addEventListener("click", async () => {
    create.disabled = true;
    try {
      const r = await api<{ slug: string }>("/api/artifacts", {
        method: "POST",
        json: { title: "Untitled", files: [{ path: "index.html", content: STARTER }, { path: "style.css", content: STARTER_CSS }], message: "Blank page" },
      });
      location.href = `/a/${r.slug}`;
    } finally {
      create.disabled = false;
    }
  });

  const feed = el(
    "div",
    { class: "list feed" },
    events.length
      ? [...events].reverse().slice(0, 12).map((e) =>
          el(
            "a",
            { class: "feed-item", href: `/a/${e.artifact.slug}`, style: "color: inherit" },
            agentBadge(e.agent),
            el("span", { class: "what" }, el("strong", {}, e.artifact.title), " · ", e.summary),
            el("span", { class: "when" }, timeAgo(e.created_at))
          )
        )
      : el("div", { class: "empty" }, "Activity from you and your agents shows up here.")
  );

  root.replaceChildren(
    el(
      "div",
      { class: "page" },
      el("div", { class: "page-head" }, el("h1", {}, "Artifacts"), el("span", { class: "spacer" }), search, create),
      favSection,
      allHead,
      grid,
      el("section", { class: "section", style: "margin-top: 36px" }, el("div", { class: "row" }, el("h2", { style: "margin: 0" }, "Recent activity"), el("span", { class: "spacer" }), el("a", { href: "/connect/", class: "small" }, "Connect another agent")), el("div", { style: "margin-top: 10px" }, feed))
    )
  );
}
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
