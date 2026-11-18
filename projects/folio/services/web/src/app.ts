// The dashboard: your artifacts and the ones shared with you, recent activity, and a blank new one.
import { agentBadge, api, el, requireSession, spinner, timeAgo } from "./common.ts";

const root = document.getElementById("app")!;

interface Summary {
  slug: string;
  title: string;
  description: string;
  visibility: "private" | "link";
  role: "owner" | "editor" | "viewer";
  head_version: number;
  open_suggestions: number;
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

async function render() {
  const s = await requireSession(root, render);
  if (!s) return;
  root.replaceChildren(spinner());
  const [items, events] = await Promise.all([api<Summary[]>("/api/artifacts"), api<Ev[]>("/api/activity")]);

  const grid = el("div", { class: "artifact-grid" });
  const draw = () => {
    const q = query.trim().toLowerCase();
    const shown = items.filter((a) => !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    grid.replaceChildren(
      ...(shown.length
        ? shown.map((a) =>
            el(
              "a",
              { class: "card", href: `/a/${a.slug}` },
              el("div", { class: "title" }, a.title),
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
            )
          )
        : [el("div", { class: "empty", style: "grid-column: 1 / -1" }, items.length ? "Nothing matches." : "No artifacts yet. Ask a connected agent to make one, or start a blank one.")])
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
      grid,
      el("section", { class: "section", style: "margin-top: 36px" }, el("div", { class: "row" }, el("h2", { style: "margin: 0" }, "Recent activity"), el("span", { class: "spacer" }), el("a", { href: "/connect/", class: "small" }, "Connect another agent")), el("div", { style: "margin-top: 10px" }, feed))
    )
  );
}
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
