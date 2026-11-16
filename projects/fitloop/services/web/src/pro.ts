// FitLoop Pro on the web: the same paywall as the apps ("Peek": the offer over a blurred glimpse of
// the app), sold through Stripe Checkout, and the plan panel for people who have Pro from any store.
// The Worker's GET /api/pro is the one answer for every platform (worker/billing.ts).
import { api, el } from "./supabase.ts";

const CONFIG = {
  "name": "FitLoop",
  "proName": "FitLoop Pro",
  "hook": "Your agent writes the plan. You just press play.",
  "perks": [
    "Daily plan",
    "Workout player",
    "Heart rate",
    "Check-ins"
  ],
  "glimpse": [
    [
      "7:00",
      "Push day",
      "6 exercises · 50 min"
    ],
    [
      "8:30",
      "Breakfast",
      "Greek yogurt bowl · 31 g protein"
    ],
    [
      "12:30",
      "Lunch",
      "Chicken rice bowl · 42 g protein"
    ],
    [
      "19:00",
      "Dinner",
      "Salmon and greens · 38 g protein"
    ]
  ],
  "glimpseTitle": "Today",
  "home": "/today/"
};

export interface Offer { plan: "annual" | "lifetime"; price: string; interval: "year" | null; trial_days: number }
export interface ProAnswer {
  pro: boolean;
  source: "app_store" | "stripe" | "play" | "grant" | null;
  plan: "annual" | "lifetime" | null;
  until: string | null;
  manage: "app_store" | "stripe" | "play" | null;
  had_purchase: boolean;
  email: string | null;
  offers: Offer[];
}

export async function loadPro(): Promise<ProAnswer | null> {
  const r = await api<ProAnswer>("/api/pro");
  return r.ok ? r.body : null;
}

/** After Stripe Checkout the webhook may land a moment later: ask a few times. */
export async function waitForPro(tries = 8): Promise<ProAnswer | null> {
  let p = await loadPro();
  for (let i = 0; i < tries && p && !p.pro; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    p = await loadPro();
  }
  return p;
}

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

async function go(path: string, body: object, button: HTMLButtonElement, error: HTMLElement) {
  button.disabled = true;
  error.hidden = true;
  const r = await api<{ url?: string; error?: string }>(path, { method: "POST", body: JSON.stringify(body) });
  if (r.ok && r.body.url) {
    location.href = r.body.url;
    return;
  }
  error.textContent = r.body.error ?? "Something went wrong. Try again.";
  error.hidden = false;
  button.disabled = false;
}

/** The offer, over a blurred glimpse of the app. */
export function paywall(p: ProAnswer): HTMLElement {
  const annual = p.offers.find((o) => o.plan === "annual");
  const lifetime = p.offers.find((o) => o.plan === "lifetime");
  const trial = annual && annual.trial_days > 0 && !p.had_purchase ? annual.trial_days : 0;
  let chosen: Offer | undefined = annual ?? lifetime;
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const cta = el("button", { class: "btn primary pro-cta", type: "button" });
  const note = el("p", { class: "muted small pro-center" });
  const rows: HTMLElement[] = [];
  const update = () => {
    for (const r of rows) r.classList.toggle("on", r.dataset.plan === chosen?.plan);
    if (!chosen) return;
    cta.textContent = chosen.plan === "lifetime" ? `Unlock for life · ${chosen.price}` : trial ? `Try ${trial === 7 ? "1 week" : `${trial} days`} free` : `Continue · ${chosen.price}/year`;
    note.textContent = chosen.plan === "lifetime" ? "One payment. Yours for good." : trial ? `Then ${chosen.price} a year. Cancel anytime.` : "Renews every year. Cancel anytime.";
  };
  const row = (o: Offer) => {
    const yearly = o.plan === "annual";
    const r = el("button", { class: "pro-plan", type: "button", "data-plan": o.plan, onclick: () => { chosen = o; update(); } },
      el("span", { class: "pro-radio", "aria-hidden": "true" }),
      el("span", { class: "pro-plan-text" },
        el("b", {}, yearly ? "Yearly" : "Lifetime"),
        el("small", {}, yearly ? (trial ? `1 week free, then ${o.price}/year` : `${o.price} every year`) : "Pay once, keep it for good")),
      el("span", { class: "pro-plan-price" }, el("b", {}, yearly ? `${o.price}/year` : `${o.price} once`)),
      yearly && trial ? el("em", { class: "pro-tag" }, "1 week free") : null);
    rows.push(r);
    return r;
  };
  cta.addEventListener("click", () => chosen && go("/api/billing/checkout", { plan: chosen.plan }, cta, error));
  const sheet = el("section", { class: "pro-sheet" },
    el("div", { class: "pro-lock" }, `🔒 Unlock ${CONFIG.name}`),
    el("h1", { class: "pro-hook" }, CONFIG.hook),
    el("div", { class: "pro-tiles" }, ...CONFIG.perks.map((t) => el("span", {}, t))),
    p.offers.length
      ? el("div", { class: "pro-plans" }, ...(annual ? [row(annual)] : []), ...(lifetime ? [row(lifetime)] : []))
      : el("p", { class: "muted" }, `${CONFIG.proName} isn't on sale on the web yet: start your free week in the ${CONFIG.name} app.`),
    p.offers.length ? cta : null,
    p.offers.length ? note : null,
    error,
    annual ? el("p", { class: "muted tiny pro-center" },
      `${trial ? `Free for 1 week, then ${annual.price}` : annual.price} a year, charged by Stripe. Renews automatically until you cancel; cancel anytime from this page. Lifetime is a one-time payment.`) : null,
    el("p", { class: "muted small pro-center" },
      `Already have ${CONFIG.proName} from the iPhone app? Open the app signed in as ${p.email ?? "this account"}, and it's here too.`),
    el("p", { class: "tiny pro-center" }, el("a", { href: "/terms/" }, "Terms"), " · ", el("a", { href: "/privacy/" }, "Privacy")));
  update();
  const glimpse = el("div", { class: "pro-glimpse", "aria-hidden": "true" },
    el("h2", {}, CONFIG.glimpseTitle),
    ...CONFIG.glimpse.map(([a, b, c]) => el("div", { class: "pro-glimpse-row" }, el("b", {}, a), el("span", {}, b, el("small", {}, c)))));
  return el("div", { class: "pro-peek" }, glimpse, sheet);
}

/** For people with Pro: where it comes from and where to manage it. */
export function planPanel(p: ProAnswer): HTMLElement {
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const what = p.plan === "lifetime" ? "Lifetime" : p.until ? `Yearly · renews or ends ${date(p.until)}` : "Active";
  const where: Record<string, string> = {
    app_store: "Bought in the iPhone app: manage it in your iPhone's Settings › your name › Subscriptions.",
    play: "Bought in the Android app: manage it in Google Play › Payments & subscriptions.",
    stripe: "Bought here on the web.",
    grant: "Given to your account.",
  };
  const manage = p.manage === "stripe" && p.plan !== "lifetime"
    ? el("button", { class: "btn", type: "button" }, "Manage subscription")
    : null;
  manage?.addEventListener("click", () => go("/api/billing/portal", {}, manage, error));
  return el("section", { class: "panel pro-have" },
    el("h2", {}, `${CONFIG.proName} ✓`),
    el("p", { class: "muted small" }, `${what}. ${where[p.source ?? ""] ?? ""} It works on the web, your phone and your glasses.`),
    error,
    el("div", { class: "pro-have-actions" }, el("a", { class: "btn primary", href: CONFIG.home }, `Open ${CONFIG.name}`), manage));
}
