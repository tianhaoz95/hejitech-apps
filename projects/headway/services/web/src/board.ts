// The home page: a live board for any pair of stations (the signed-in user's commute by default,
// else Mountain View → San Francisco) and the G2 preview driven by the same Navigator as the glasses.
import { clock, Navigator, STATIONS, untilText, type Board, type BoardTrain, type Command, type Input, type World } from "@headway/core";
import { api, currentSession, el } from "./supabase.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const from = $<HTMLSelectElement>("from"), to = $<HTMLSelectElement>("to");
for (const sel of [from, to]) for (const s of STATIONS) sel.append(el("option", { value: s.id }, s.name));

let current: Board | null = null;
let hasCommute = false;
const nav = new Navigator();
const world = (): World => ({ board: current, progress: null, hasCommute, custom: true, now: Date.now() });

function trainItem(t: BoardTrain, now: number) {
  const cls = t.status === "cancelled" ? "cancelled" : t.status === "late" ? "late" : t.status === "on_time" ? "ok" : "";
  const label = t.status === "cancelled" ? "Cancelled" : t.status === "late" ? `${t.delay_min} min late` : t.status === "early" ? `${-(t.delay_min ?? 0)} min early` : t.status === "on_time" ? "On time" : "Scheduled";
  return el("li", { class: "train" },
    el("span", { class: "num" }, t.train, el("span", { class: "kind" }, { LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" }[t.kind])),
    el("span", { class: "times" },
      el("b", {}, clock(t.pred_dep)), t.pred_dep !== t.dep ? el("s", {}, clock(t.dep)) : null, ` → ${clock(t.pred_arr)}`,
      el("span", { class: `kind ${cls}` }, label, t.stops_between ? ` · ${t.stops_between} stop${t.stops_between === 1 ? "" : "s"} between` : " · nonstop")),
    el("span", { class: `in ${cls}` }, t.status === "cancelled" ? "—" : untilText(t.pred_dep, now)));
}

function render() {
  const now = Date.now();
  const b = current;
  $("live").textContent = b ? (b.live ? "Live" : "Timetable") : "";
  $("live").title = b?.live ? "Predictions from Caltrain's live feed (511.org)" : "No fresh live data: scheduled times";
  $("trains").replaceChildren(...(b?.trains.length ? b.trains.map((t) => trainItem(t, now)) : [el("li", { class: "muted" }, b ? "No more trains today." : "Pick two different stations.")]));
  $("alerts").replaceChildren(...(b?.alerts ?? []).map((a) => el("div", { class: "alert-box" }, el("b", {}, a.header), a.description && a.description !== a.header ? el("div", { class: "muted small" }, a.description) : null)));
  $("g2").textContent = nav.lines(world()).join("\n");
}

async function load() {
  if (from.value === to.value) { current = null; return render(); }
  const res = await fetch(`/api/board?from=${from.value}&to=${to.value}`).catch(() => null);
  current = res?.ok ? ((await res.json()) as Board) : null;
  nav.boardChanged(world());
  render();
}

function apply(cmds: Command[]) {
  for (const c of cmds) {
    if (c.kind === "show_pair") {
      const pair = c.pair ?? { from: to.value, to: from.value };
      from.value = pair.from;
      to.value = pair.to;
      void load();
    }
    if (c.kind === "refresh") void load();
  }
  render();
}

$("swap").addEventListener("click", () => apply([{ kind: "show_pair", pair: { from: to.value, to: from.value } }]));
from.addEventListener("change", () => void load());
to.addEventListener("change", () => void load());
document.querySelectorAll<HTMLButtonElement>(".ring button").forEach((b) => b.addEventListener("click", () => {
  const cmds = nav.input(b.dataset.in as Input, world());
  // The web preview has no tracked train to show; tracking lives in the app and on the glasses.
  if (cmds.some((c) => c.kind === "track")) nav.screen = "board";
  apply(cmds.filter((c) => c.kind !== "track"));
}));

async function start() {
  from.value = "mountain_view";
  to.value = "san_francisco";
  if (await currentSession()) {
    const r = await api<{ board: Board | null; has_commute: boolean }>("/api/me/board");
    if (r.ok && r.body.board) {
      from.value = r.body.board.from.id;
      to.value = r.body.board.to.id;
      hasCommute = r.body.has_commute;
    }
  }
  await load();
  setInterval(() => void load(), 30_000);
  setInterval(render, 10_000);
}
void start();
