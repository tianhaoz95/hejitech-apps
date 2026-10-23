// /brief: the brief editor (PRD §5.2, §9). Every field of the brief config is editable here, by the
// user only; saving a changed brief bumps brief_version, and the next edition follows it with no
// other change anywhere. Checked live with the same rules the Worker applies before saving.
import {
  checkBrief, DEEP_DIVE_POLICIES, QUIET_BEHAVIORS, SOURCE_KINDS, starterSection, TEMPLATES, WEEKDAYS,
  type Brief, type Section,
} from "@g2digest/core";
import { api, el, requireSession, spinner } from "./supabase.ts";

const root = document.getElementById("app")!;
let brief: Brief;
let version = 0;
let dirty = false;

const TEMPLATE_HELP: Record<string, string> = {
  status: "a tracked thing changed or didn't",
  discovery: "ranked new items (with a method keyword)",
  metric: "up to three numbers and one driver",
  agenda: "time-ordered items",
  note: "a single free item",
};
const QUIET_HELP: Record<string, string> = { show_status: "one card saying nothing changed", omit: "leave the section out", show_last: "repeat the last edition's card" };
const SOURCE_HELP: Record<string, string> = { web_news: "web search for news", rss: "the RSS feeds you list", finance: "quotes for the entities", calendar: "your calendar", feed: "another structured feed (URLs)" };

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function changed() {
  dirty = true;
  checkNow();
}

const issuesBox = el("ul", { class: "issues" });
const saveBtn = el("button", { class: "btn primary", type: "button" }, "Save brief");
const status = el("span", { class: "muted small" });

function checkNow() {
  const issues = checkBrief(brief);
  issuesBox.replaceChildren(...issues.map((i) => el("li", {}, i.message)));
  saveBtn.disabled = issues.length > 0 || !dirty;
  status.textContent = dirty ? "Unsaved changes" : `Saved · version ${version}`;
}

function field(label: string, input: HTMLElement, hint?: string) {
  return el("label", { class: "field" }, el("span", {}, el("b", {}, label), hint ? ` · ${hint}` : ""), input);
}

function text(get: () => string, set: (v: string) => void, attrs: Record<string, string> = {}) {
  const i = el("input", { ...attrs, value: get() });
  i.addEventListener("input", () => { set(i.value); changed(); });
  return i;
}
function num(get: () => number, set: (v: number) => void, attrs: Record<string, string> = {}) {
  const i = el("input", { type: "number", inputmode: "numeric", ...attrs, value: String(get()) });
  i.addEventListener("input", () => { set(i.value === "" ? NaN : Number(i.value)); changed(); });
  return i;
}
function area(get: () => string, set: (v: string) => void, attrs: Record<string, string> = {}) {
  const t = el("textarea", attrs);
  t.value = get();
  t.addEventListener("input", () => { set(t.value); changed(); });
  return t;
}
function select<T extends string>(options: readonly T[], get: () => T, set: (v: T) => void, help?: Record<string, string>) {
  const s = el("select", {}, ...options.map((o) => el("option", { value: o, ...(o === get() ? { selected: true } : {}) }, help?.[o] ? `${o} (${help[o]})` : o)));
  s.addEventListener("change", () => { set(s.value as T); changed(); });
  return s;
}
function check(label: string, get: () => boolean, set: (v: boolean) => void) {
  const i = el("input", { type: "checkbox", ...(get() ? { checked: true } : {}) });
  i.addEventListener("change", () => { set(i.checked); changed(); });
  return el("label", { class: "check" }, i, label);
}

function sectionCard(s: Section, i: number): HTMLElement {
  const move = (d: number) => () => {
    const j = i + d;
    if (j < 0 || j >= brief.sections.length) return;
    [brief.sections[i], brief.sections[j]] = [brief.sections[j], brief.sections[i]];
    changed();
    drawSections();
  };
  return el("div", { class: "section-card" },
    el("header", {},
      el("b", {}, `${i + 1}. ${s.title || "Untitled"}`),
      el("div", { class: "row" },
        el("button", { class: "btn", type: "button", title: "Move up", onclick: move(-1) }, "↑"),
        el("button", { class: "btn", type: "button", title: "Move down", onclick: move(1) }, "↓"),
        el("button", { class: "btn danger", type: "button", onclick: () => { brief.sections.splice(i, 1); changed(); drawSections(); } }, "Remove"))),
    el("div", { class: "fields" },
      field("Title", text(() => s.title, (v) => (s.title = v), { maxlength: "18" }), "card kicker"),
      field("Id", text(() => s.id, (v) => (s.id = v)), "kebab-case"),
      field("Template", select(TEMPLATES, () => s.template, (v) => (s.template = v), TEMPLATE_HELP)),
      field("Max cards", num(() => s.max_cards, (v) => (s.max_cards = v), { min: "1", max: "10" }), "a ceiling, not a quota"),
      field("Quiet day", select(QUIET_BEHAVIORS, () => s.quiet_behavior, (v) => (s.quiet_behavior = v), QUIET_HELP)),
      field("Deep dive", select(DEEP_DIVE_POLICIES, () => s.audio.deep_dive, (v) => (s.audio.deep_dive = v))),
      el("div", { class: "field" }, el("span", {}, el("b", {}, "Glance audio")), check("every card gets a ~30 s glance", () => s.audio.glance, (v) => (s.audio.glance = v)))),
    el("div", { class: "fields" },
      field("Source", select(SOURCE_KINDS, () => s.source.kind, (v) => (s.source.kind = v), SOURCE_HELP)),
      field("Entities", text(() => (s.source.entities ?? []).join(", "), (v) => (s.source.entities = list(v))), "comma-separated"),
      field("Query", text(() => s.source.query ?? "", (v) => (s.source.query = v || undefined)))),
    field("Feed URLs", area(() => (s.source.urls ?? []).join("\n"), (v) => (s.source.urls = lines(v).length ? lines(v) : undefined), { rows: "2", placeholder: "one per line (rss, feed)" })),
    field("Instructions", area(() => s.instructions, (v) => (s.instructions = v), { rows: "4" }), "what counts, how to rank, what a quiet day looks like"));
}

const sectionsBox = el("div", { class: "stack" });
function drawSections() {
  sectionsBox.replaceChildren(...brief.sections.map(sectionCard),
    el("button", { class: "btn secondary", type: "button", onclick: () => {
      let n = brief.sections.length + 1;
      while (brief.sections.some((x) => x.id === `section-${n}`)) n++;
      brief.sections.push(starterSection(n));
      changed();
      drawSections();
    } }, "Add section"));
}

function glossaryBox(): HTMLElement {
  const box = el("div", { class: "stack" });
  const draw = () => {
    box.replaceChildren(...brief.glossary.map((g, i) => el("div", { class: "row" },
      el("div", { style: "flex: 1" }, text(() => g.term, (v) => (g.term = v), { placeholder: "term", "aria-label": "Term" })),
      el("div", { style: "flex: 3" }, text(() => g.gloss, (v) => (g.gloss = v), { placeholder: "how to explain it", "aria-label": "Gloss" })),
      el("button", { class: "btn danger", type: "button", onclick: () => { brief.glossary.splice(i, 1); changed(); draw(); } }, "×"))),
      el("button", { class: "btn secondary", type: "button", onclick: () => { brief.glossary.push({ term: "", gloss: "" }); changed(); draw(); } }, "Add term"));
  };
  draw();
  return box;
}

function draw() {
  const days = el("div", { class: "row" }, ...WEEKDAYS.map((d) => check(d, () => brief.delivery.days.includes(d), (v) => {
    brief.delivery.days = WEEKDAYS.filter((x) => (x === d ? v : brief.delivery.days.includes(x)));
  })));
  const jsonArea = el("textarea", { rows: "18", class: "mono", spellcheck: "false" });
  const jsonMsg = el("p", { class: "small" });
  const jsonPanel = el("details", { class: "panel" },
    el("summary", {}, el("b", {}, "Edit as JSON"), el("span", { class: "muted small" }, " · paste a whole brief to import it")),
    el("div", { class: "stack", style: "margin-top: 12px" }, jsonArea, jsonMsg,
      el("div", { class: "row" }, el("button", { class: "btn secondary", type: "button", onclick: () => {
        try {
          const next = JSON.parse(jsonArea.value) as Brief;
          const issues = checkBrief(next);
          if (issues.length) return void (jsonMsg.textContent = `Not applied: ${issues.map((i) => i.message).join("; ")}`);
          brief = next;
          changed();
          draw();
        } catch (e) {
          jsonMsg.textContent = `Not JSON: ${(e as Error).message}`;
        }
      } }, "Apply JSON"))));
  jsonPanel.addEventListener("toggle", () => { if ((jsonPanel as HTMLDetailsElement).open) jsonArea.value = JSON.stringify(brief, null, 2); });

  root.replaceChildren(
    el("div", { class: "row", style: "justify-content: space-between; margin-bottom: 14px" },
      el("div", {}, el("h1", {}, "Your brief"), el("p", { class: "muted", style: "margin: 0" }, "What goes in your edition. The build agent reads it and never edits it.")),
      el("div", { class: "row" }, status, saveBtn)),
    issuesBox,
    el("section", { class: "panel" },
      el("h2", {}, "Edition"),
      el("div", { class: "fields" },
        field("Name", text(() => brief.title, (v) => (brief.title = v)), "on the Cover card"),
        field("Card budget", num(() => brief.total_card_budget, (v) => (brief.total_card_budget = v), { min: "3", max: "40" }), "Cover, TL;DR and End count"),
        field("Audio budget (minutes)", num(() => Math.round(brief.total_audio_budget_sec / 60), (v) => (brief.total_audio_budget_sec = Math.round(v * 60)), { min: "0", max: "120" })),
        el("div", { class: "field" }, el("span", {}, el("b", {}, "TL;DR card")), check("one card with the thing to know", () => brief.tldr, (v) => (brief.tldr = v))))),
    el("section", { class: "panel" },
      el("h2", {}, "Delivery and language"),
      el("div", { class: "fields" },
        field("Ready by", text(() => brief.delivery.time, (v) => (brief.delivery.time = v), { type: "time" })),
        field("Time zone", text(() => brief.delivery.timezone, (v) => (brief.delivery.timezone = v), { placeholder: "America/Los_Angeles" })),
        field("Language", text(() => brief.language, (v) => (brief.language = v), { placeholder: "en" })),
        field("Temperature", select(["C", "F"] as const, () => brief.units.temperature, (v) => (brief.units.temperature = v))),
        field("Distance", select(["km", "mi"] as const, () => brief.units.distance, (v) => (brief.units.distance = v)))),
      el("div", { class: "field", style: "margin-top: 12px" }, el("span", {}, el("b", {}, "Days")), days)),
    el("section", { class: "panel" },
      el("h2", {}, "Sections"),
      el("p", { class: "muted small" }, "In edition order. When there's more than the budget allows, later sections lose cards first; alerts are never cut."),
      sectionsBox),
    el("section", { class: "panel" },
      el("h2", {}, "Glossary"),
      el("p", { class: "muted small" }, "Terms the audio always explains your way."),
      glossaryBox(),
      el("div", { style: "margin-top: 14px" }, field("Never explain", text(() => brief.no_gloss.join(", "), (v) => (brief.no_gloss = list(v))), "comma-separated terms you know"))),
    jsonPanel);
  drawSections();
  checkNow();
}

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  status.textContent = "Saving…";
  const r = await api<{ brief_version?: number; changed?: boolean; error?: string; issues?: { message: string }[] }>("/api/brief", {
    method: "PUT", body: JSON.stringify({ brief, expected_version: version }),
  });
  if (!r.ok) {
    status.textContent = r.body.error ?? "Couldn't save.";
    issuesBox.replaceChildren(...(r.body.issues ?? []).map((i) => el("li", {}, i.message)));
    saveBtn.disabled = false;
    return;
  }
  version = r.body.brief_version ?? version;
  dirty = false;
  checkNow();
  status.textContent = r.body.changed ? `Saved · version ${version}. The next edition follows it.` : `No changes · version ${version}`;
});

window.addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });

async function load() {
  root.replaceChildren(spinner());
  const session = await requireSession(root, load);
  if (!session) return;
  const r = await api<{ brief: Brief; brief_version: number }>("/api/brief");
  if (!r.ok) return root.replaceChildren(el("p", { class: "error" }, "Couldn't load your brief."));
  brief = r.body.brief;
  version = r.body.brief_version;
  dirty = false;
  draw();
}
void load();
