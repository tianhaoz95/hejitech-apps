// Folio Pro on the web: what the plan is, what it adds, and buying it with Stripe Checkout (or
// managing a web subscription in Stripe's portal). The iPhone app sells the same plan through the
// App Store; either purchase unlocks Pro for the whole account (GET /api/pro is the one answer).
import { api, el, requireSession, spinner, toast } from "./common.ts";

interface Limits { artifacts: number; versionBytes: number; webhooks: number }
interface Pro {
  pro: boolean;
  source: "app_store" | "stripe" | "grant" | null;
  plan: "annual" | "lifetime" | null;
  until: string | null;
  manage: "app_store" | "stripe" | null;
  had_purchase: boolean;
  limits: Limits;
  free: Limits;
  pro_limits: Limits;
  artifacts: number;
  offers: { plan: "annual" | "lifetime"; price: string; interval: "year" | null; trial_days: number }[];
}

const root = document.getElementById("app")!;
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

async function go(path: string, plan?: string) {
  const r = await api<{ url: string }>(path, { method: "POST", json: plan ? { plan } : {} });
  location.href = r.url;
}

async function render() {
  root.replaceChildren(spinner());
  const s = await requireSession(root, render, "Sign in to see your plan.");
  if (!s) return;
  const p = await api<Pro>("/api/pro");
  const q = new URLSearchParams(location.search).get("pro");
  if (q === "success") toast("Thanks! Pro is on for your account.");

  const row = (what: string, free: string, pro: string) => el("tr", {}, el("td", {}, what), el("td", {}, free), el("td", {}, el("strong", {}, pro)));
  const table = el(
    "table",
    { class: "plan-table" },
    el("thead", {}, el("tr", {}, el("th", {}, ""), el("th", {}, "Free"), el("th", {}, "Pro"))),
    el(
      "tbody",
      {},
      row("Artifacts you own", String(p.free.artifacts), p.pro_limits.artifacts.toLocaleString()),
      row("One version, all files", mb(p.free.versionBytes), mb(p.pro_limits.versionBytes)),
      row("Webhooks for your routines", "—", `${p.pro_limits.webhooks}`),
      row("Agents, history, suggestions, comments, search, live data, sharing", "✓", "✓")
    )
  );

  let status: HTMLElement;
  if (p.pro) {
    const from = p.source === "app_store" ? "the App Store" : p.source === "stripe" ? "the web" : "an invite";
    const when = p.plan === "lifetime" ? "for good" : p.until ? `until ${day(p.until)} (renews unless cancelled)` : "";
    status = el(
      "div",
      { class: "panel flat" },
      el("h2", {}, "You have Folio Pro"),
      el("p", { class: "muted" }, `From ${from}, ${when}.`),
      p.manage === "stripe"
        ? el("button", { class: "btn secondary", type: "button", onclick: () => go("/api/billing/portal") }, "Manage or cancel")
        : p.manage === "app_store"
          ? el("p", { class: "muted small" }, "Manage it on your iPhone: Settings › your name › Subscriptions.")
          : el("span", {})
    );
  } else if (p.offers.length) {
    status = el(
      "div",
      { class: "offers" },
      ...p.offers.map((o) =>
        el(
          "div",
          { class: "panel flat offer" },
          el("h2", {}, o.plan === "annual" ? "Yearly" : "Lifetime"),
          el("p", { class: "price" }, o.price, el("span", { class: "muted small" }, o.interval ? " a year" : " once")),
          el("p", { class: "muted small" }, o.plan === "annual" ? (p.had_purchase ? "Renews every year. Cancel any time." : `${o.trial_days} days free, then ${o.price} a year. Cancel any time.`) : "Pay once, Pro for good."),
          el("button", { class: "btn", type: "button", onclick: () => go("/api/billing/checkout", o.plan) }, o.plan === "annual" && !p.had_purchase ? "Start the free week" : "Get Pro")
        )
      )
    );
  } else {
    status = el("div", { class: "panel flat" }, el("p", {}, "Pro is sold in the Folio iPhone app for now. Buy it there and it unlocks here too."));
  }

  root.replaceChildren(
    el(
      "div",
      { class: "page" },
      el("h1", {}, "Folio Pro"),
      el("p", { class: "muted" }, `Folio is free for everything you do with your agents. Pro is for when it becomes your workspace: more artifacts, larger ones, and webhooks so your own routines answer comments as they come in. You own ${p.artifacts} artifact${p.artifacts === 1 ? "" : "s"}.`),
      status,
      el("section", { class: "section", style: "margin-top: 32px" }, el("h2", {}, "What Pro adds"), table),
      el("p", { class: "muted small" }, "Payments by Stripe. ", el("a", { href: "/terms/" }, "Terms"), " · ", el("a", { href: "/privacy/" }, "Privacy"))
    )
  );
}
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
