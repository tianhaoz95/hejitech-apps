#!/usr/bin/env node
// Sets up a project's Pro on the shared HEJI Stripe account, idempotently: the product, a yearly
// price and a one-time lifetime price (same as the App Store), and, in live mode, the webhook
// endpoint for its Worker. Prints the ids for the Worker (STRIPE_PRICE_* vars, STRIPE_WEBHOOK_SECRET).
//
//   node scripts/stripe_pro.mjs <headway|fitloop|g2digest|icecap> [--live]     # sandbox unless --live
//
// Keys: ~/Credentials/stripe.env (HEJI_TECHNOLOGY_SANDBOX_SECRET_KEY / HEJI_TECHNOLOGY_LIVE_SECRET_KEY).
// Everything it creates carries metadata app=<project>, which is how each Worker's webhook tells
// its own events from the other HEJI products' on the same account.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const PROJECTS = {
  headway: { name: "Headway Pro", annual: 499, lifetime: 999, url: "https://headway.hejitech.workers.dev" },
  fitloop: { name: "FitLoop Pro", annual: 1999, lifetime: 3999, url: "https://fitloop.hejitech.workers.dev" },
  g2digest: { name: "G2 Digest Pro", annual: 1499, lifetime: 2999, url: "https://g2digest.hejitech.workers.dev" },
  icecap: { name: "Icecap Pro", annual: 9999, lifetime: 19999, url: "https://icecap.hejitech.workers.dev" },
};
const EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "charge.refunded"];

const [project, ...flags] = process.argv.slice(2);
const live = flags.includes("--live");
const cfg = PROJECTS[project];
if (!cfg) {
  console.error(`usage: stripe_pro.mjs <${Object.keys(PROJECTS).join("|")}> [--live]`);
  process.exit(2);
}
const env = Object.fromEntries(readFileSync(`${homedir()}/Credentials/stripe.env`, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const key = env[live ? "HEJI_TECHNOLOGY_LIVE_SECRET_KEY" : "HEJI_TECHNOLOGY_SANDBOX_SECRET_KEY"];
if (!key) throw new Error("no Stripe key in ~/Credentials/stripe.env");

const form = (o, prefix = "") => Object.entries(o).flatMap(([k, v]) => {
  const name = prefix ? `${prefix}[${k}]` : k;
  if (Array.isArray(v)) return v.map((x, i) => `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(x)}`);
  if (v && typeof v === "object") return [form(v, name)];
  return v === undefined ? [] : [`${encodeURIComponent(name)}=${encodeURIComponent(v)}`];
}).join("&");
async function stripe(method, path, params) {
  const body = params ? form(params) : "";
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": "2025-09-30.clover" },
    body: method === "POST" ? body : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${j.error?.message ?? res.status}`);
  return j;
}

// Listed, not searched: Stripe's search index lags a minute behind, so a second run would make a duplicate.
const all = (await stripe("GET", "products", { active: "true", limit: "100" })).data;
const product = all.find((p) => p.metadata?.app === project && p.metadata?.kind === "pro")
  ?? await stripe("POST", "products", { name: cfg.name, metadata: { app: project, kind: "pro" } });
const prices = (await stripe("GET", "prices", { product: product.id, active: "true", limit: "20" })).data;
const annual = prices.find((p) => p.recurring?.interval === "year" && p.unit_amount === cfg.annual)
  ?? await stripe("POST", "prices", { product: product.id, currency: "usd", unit_amount: cfg.annual, recurring: { interval: "year" }, nickname: "Yearly", metadata: { app: project, plan: "annual" } });
const lifetime = prices.find((p) => !p.recurring && p.unit_amount === cfg.lifetime)
  ?? await stripe("POST", "prices", { product: product.id, currency: "usd", unit_amount: cfg.lifetime, nickname: "Lifetime", metadata: { app: project, plan: "lifetime" } });

console.log(`${live ? "LIVE" : "sandbox"} ${cfg.name}: product ${product.id}`);
console.log(`STRIPE_PRICE_ANNUAL=${annual.id}`);
console.log(`STRIPE_PRICE_LIFETIME=${lifetime.id}`);

if (live) {
  const url = `${cfg.url}/stripe/webhook`;
  const hooks = (await stripe("GET", "webhook_endpoints", { limit: "100" })).data;
  const have = hooks.find((h) => h.url === url);
  if (have) {
    console.log(`webhook ${have.id} → ${url} already exists (its secret was printed when it was made; it's in ~/Credentials/stripe.env)`);
  } else {
    const h = await stripe("POST", "webhook_endpoints", { url, enabled_events: EVENTS, api_version: "2025-09-30.clover", description: `${cfg.name} (Worker ${project})`, metadata: { app: project } });
    console.log(`webhook ${h.id} → ${url}`);
    console.log(`STRIPE_WEBHOOK_SECRET=${h.secret}`);
  }
}
