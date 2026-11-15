#!/usr/bin/env node
// In-app purchases in App Store Connect, by API, for the heji-app-store-iap skill. Idempotent: each
// command finds what exists and only adds what's missing. Uses heji-app-store-connect's asc.mjs
// (same credentials). Waypack's run of it (2026-11-14) is the model: projects/waypack/docs/DEPLOY.md §4a.
//
//   iap.mjs status <bundle id>
//   iap.mjs subscription <bundle id> --group "Waypack Pro" --product com.x.pro.annual --name "Waypack Pro Annual" \
//     --display "Waypack Pro (Annual)" --description "≤55 chars" --period ONE_YEAR --price 14.99 [--trial ONE_WEEK] --note "for App Review"
//   iap.mjs nonconsumable <bundle id> --product com.x.pro.lifetime --name "…" --display "…" --description "…" --price 39.99 --note "…"
//   iap.mjs review-shot <bundle id> <product id> <png>      # the purchase screen, required before review
//   iap.mjs notifications <bundle id> <https url>           # Server Notifications V2, production + sandbox
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { asc as ascOnce } from "../heji-app-store-connect/asc.mjs";

// App Store Connect rate-limits bursts (429 RATE_LIMIT_EXCEEDED, hit when three apps ran at once):
// wait and retry, up to ~2 minutes.
async function asc(method, path, body) {
  for (let i = 0; ; i++) {
    try {
      return await ascOnce(method, path, body);
    } catch (e) {
      if (!/: 429 /.test(e.message) || i >= 8) throw e;
      await new Promise((r) => setTimeout(r, Math.min(60000, 2000 * 2 ** i)));
    }
  }
}

const die = (m) => { console.error(`!! ${m}`); process.exit(1); };
const [cmd, bundleId, ...rest] = process.argv.slice(2);
const opt = {};
const pos = [];
for (let i = 0; i < rest.length; i++) rest[i].startsWith("--") ? (opt[rest[i].slice(2)] = rest[++i]) : pos.push(rest[i]);
const need = (...k) => k.forEach((x) => opt[x] || die(`--${x} is required`));

const all = async (path) => {
  const out = [];
  for (let next = path; next; ) {
    const r = await asc("GET", next);
    out.push(...r.data);
    next = r.links?.next?.replace("https://api.appstoreconnect.apple.com/", "");
  }
  return out;
};
const rel = (type, id) => ({ data: { type, id } });

async function appId(b) {
  const a = (await asc("GET", `v1/apps?filter[bundleId]=${encodeURIComponent(b)}`)).data.find((x) => x.attributes.bundleId === b);
  if (!a) die(`no app record for ${b}`);
  return a.id;
}
const territories = async () => (await all("v1/territories?limit=200")).map((t) => ({ type: "territories", id: t.id }));

async function findProduct(app, productId) {
  for (const g of await all(`v1/apps/${app}/subscriptionGroups?limit=50`)) {
    const s = (await all(`v1/subscriptionGroups/${g.id}/subscriptions?limit=50`)).find((x) => x.attributes.productId === productId);
    if (s) return { kind: "sub", id: s.id, group: g.id, s };
  }
  const i = (await all(`v1/apps/${app}/inAppPurchasesV2?limit=200`)).find((x) => x.attributes.productId === productId);
  return i ? { kind: "iap", id: i.id, s: i } : null;
}

async function subscription(app) {
  need("group", "product", "name", "display", "description", "period", "price");
  let group = (await all(`v1/apps/${app}/subscriptionGroups?limit=50`)).find((g) => g.attributes.referenceName === opt.group);
  group ??= (await asc("POST", "v1/subscriptionGroups", { data: { type: "subscriptionGroups", attributes: { referenceName: opt.group }, relationships: { app: rel("apps", app) } } })).data;
  if (!(await all(`v1/subscriptionGroups/${group.id}/subscriptionGroupLocalizations`)).length)
    await asc("POST", "v1/subscriptionGroupLocalizations", { data: { type: "subscriptionGroupLocalizations", attributes: { name: opt.group, locale: "en-US" }, relationships: { subscriptionGroup: rel("subscriptionGroups", group.id) } } });
  let sub = (await all(`v1/subscriptionGroups/${group.id}/subscriptions?limit=50`)).find((s) => s.attributes.productId === opt.product);
  sub ??= (await asc("POST", "v1/subscriptions", { data: { type: "subscriptions", attributes: { name: opt.name, productId: opt.product, subscriptionPeriod: opt.period, familySharable: false, groupLevel: 1, reviewNote: opt.note }, relationships: { group: rel("subscriptionGroups", group.id) } } })).data;
  if (!(await all(`v1/subscriptions/${sub.id}/subscriptionLocalizations`)).length)
    await asc("POST", "v1/subscriptionLocalizations", { data: { type: "subscriptionLocalizations", attributes: { name: opt.display, description: opt.description, locale: "en-US" }, relationships: { subscription: rel("subscriptions", sub.id) } } });
  const av = await asc("GET", `v1/subscriptions/${sub.id}/subscriptionAvailability`).catch(() => null);
  if (!av?.data) await asc("POST", "v1/subscriptionAvailabilities", { data: { type: "subscriptionAvailabilities", attributes: { availableInNewTerritories: true }, relationships: { subscription: rel("subscriptions", sub.id), availableTerritories: { data: await territories() } } } });
  // Prices: the US point and Apple's equalized point in every other territory (one POST each).
  const usa = (await all(`v1/subscriptions/${sub.id}/pricePoints?filter[territory]=USA&limit=200`)).find((p) => p.attributes.customerPrice === opt.price) ?? die(`no US price point ${opt.price}`);
  const have = new Set((await all(`v1/subscriptions/${sub.id}/prices?limit=200&include=territory`)).map((p) => p.relationships?.territory?.data?.id));
  let added = 0;
  for (const pp of [usa, ...(await all(`v1/subscriptionPricePoints/${usa.id}/equalizations?limit=200&include=territory`))]) {
    const t = pp.relationships?.territory?.data?.id ?? "USA";
    if (have.has(t)) continue;
    await asc("POST", "v1/subscriptionPrices", { data: { type: "subscriptionPrices", attributes: { startDate: null, preserveCurrentPrice: false }, relationships: { subscription: rel("subscriptions", sub.id), subscriptionPricePoint: rel("subscriptionPricePoints", pp.id), territory: rel("territories", t) } } });
    added++;
  }
  // A free trial is an introductory offer per territory (the API refuses one without a territory).
  const offered = opt.trial ? new Set((await all(`v1/subscriptions/${sub.id}/introductoryOffers?limit=200&include=territory`)).map((o) => o.relationships?.territory?.data?.id)) : new Set();
  if (opt.trial)
    for (const t of (await territories()).filter((x) => !offered.has(x.id)))
      await asc("POST", "v1/subscriptionIntroductoryOffers", { data: { type: "subscriptionIntroductoryOffers", attributes: { duration: opt.trial, offerMode: "FREE_TRIAL", numberOfPeriods: 1 }, relationships: { subscription: rel("subscriptions", sub.id), territory: rel("territories", t.id) } } });
  console.log(`subscription ${opt.product}: id ${sub.id}, group ${group.id}, ${added} prices added, state ${(await asc("GET", `v1/subscriptions/${sub.id}`)).data.attributes.state}`);
}

async function nonconsumable(app) {
  need("product", "name", "display", "description", "price");
  let iap = (await all(`v1/apps/${app}/inAppPurchasesV2?limit=200`)).find((x) => x.attributes.productId === opt.product);
  iap ??= (await asc("POST", "v2/inAppPurchases", { data: { type: "inAppPurchases", attributes: { name: opt.name, productId: opt.product, inAppPurchaseType: "NON_CONSUMABLE", familySharable: false, reviewNote: opt.note }, relationships: { app: rel("apps", app) } } })).data;
  if (!(await all(`v2/inAppPurchases/${iap.id}/inAppPurchaseLocalizations`)).length)
    await asc("POST", "v1/inAppPurchaseLocalizations", { data: { type: "inAppPurchaseLocalizations", attributes: { name: opt.display, description: opt.description, locale: "en-US" }, relationships: { inAppPurchaseV2: rel("inAppPurchases", iap.id) } } });
  const av = await asc("GET", `v2/inAppPurchases/${iap.id}/inAppPurchaseAvailability`).catch(() => null);
  if (!av?.data) await asc("POST", "v1/inAppPurchaseAvailabilities", { data: { type: "inAppPurchaseAvailabilities", attributes: { availableInNewTerritories: true }, relationships: { inAppPurchase: rel("inAppPurchases", iap.id), availableTerritories: { data: await territories() } } } });
  // GET …/iapPriceSchedule answers even when no price is set: check the manual prices instead.
  const priced = (await asc("GET", `v1/inAppPurchasePriceSchedules/${iap.id}/manualPrices`).catch(() => ({ data: [] }))).data.length;
  if (!priced) {
    const pp = (await all(`v2/inAppPurchases/${iap.id}/pricePoints?filter[territory]=USA&limit=200`)).find((p) => p.attributes.customerPrice === opt.price) ?? die(`no US price point ${opt.price}`);
    await asc("POST", "v1/inAppPurchasePriceSchedules", { data: { type: "inAppPurchasePriceSchedules", relationships: { inAppPurchase: rel("inAppPurchases", iap.id), baseTerritory: rel("territories", "USA"), manualPrices: { data: [{ type: "inAppPurchasePrices", id: "${p1}" }] } } }, included: [{ type: "inAppPurchasePrices", id: "${p1}", attributes: { startDate: null }, relationships: { inAppPurchasePricePoint: rel("inAppPurchasePricePoints", pp.id) } }] });
  }
  console.log(`non-consumable ${opt.product}: id ${iap.id}, price ${priced ? "already set" : `${opt.price} (USA base, equalized)`}, state ${(await asc("GET", `v2/inAppPurchases/${iap.id}`)).data.attributes.state}`);
}

async function reviewShot(app) {
  const [productId, file] = pos;
  if (!productId || !file) die("usage: iap.mjs review-shot <bundle id> <product id> <png>");
  const p = (await findProduct(app, productId)) ?? die(`no product ${productId}`);
  const buf = readFileSync(file);
  const type = p.kind === "sub" ? "subscriptionAppStoreReviewScreenshots" : "inAppPurchaseAppStoreReviewScreenshots";
  const relationships = p.kind === "sub" ? { subscription: rel("subscriptions", p.id) } : { inAppPurchaseV2: rel("inAppPurchases", p.id) };
  const r = (await asc("POST", `v1/${type}`, { data: { type, attributes: { fileName: file.split("/").pop(), fileSize: buf.length }, relationships } })).data;
  for (const op of r.attributes.uploadOperations) {
    const res = await fetch(op.url, { method: op.method, headers: Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value])), body: buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) die(`upload ${res.status}`);
  }
  const done = await asc("PATCH", `v1/${type}/${r.id}`, { data: { type, id: r.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(buf).digest("hex") } } });
  console.log(`review screenshot for ${productId}: ${done.data.attributes.assetDeliveryState?.state}`);
}

async function notifications(app) {
  const [url] = pos;
  if (!url?.startsWith("https://")) die("usage: iap.mjs notifications <bundle id> <https url>");
  const a = { subscriptionStatusUrl: url, subscriptionStatusUrlVersion: "V2", subscriptionStatusUrlForSandbox: url, subscriptionStatusUrlVersionForSandbox: "V2" };
  await asc("PATCH", `v1/apps/${app}`, { data: { type: "apps", id: app, attributes: a } });
  console.log(`notifications (production + sandbox, V2): ${url}`);
}

async function status(app) {
  for (const g of await all(`v1/apps/${app}/subscriptionGroups?limit=50`))
    for (const s of await all(`v1/subscriptionGroups/${g.id}/subscriptions?limit=50`)) {
      const prices = (await asc("GET", `v1/subscriptions/${s.id}/prices?limit=1`)).meta?.paging?.total;
      const offers = (await asc("GET", `v1/subscriptions/${s.id}/introductoryOffers?limit=1`)).meta?.paging?.total;
      console.log(`subscription ${s.attributes.productId} [${g.attributes.referenceName}] ${s.attributes.subscriptionPeriod} ${s.attributes.state}: ${prices} territory prices, ${offers} intro offers`);
    }
  for (const i of await all(`v1/apps/${app}/inAppPurchasesV2?limit=200`)) {
    const prices = (await asc("GET", `v1/inAppPurchasePriceSchedules/${i.id}/manualPrices?include=inAppPurchasePricePoint`).catch(() => ({ included: [] }))).included?.map((x) => x.attributes.customerPrice);
    console.log(`${i.attributes.inAppPurchaseType} ${i.attributes.productId} ${i.attributes.state}: base price ${prices?.join(",") || "none"}`);
  }
  const a = (await asc("GET", `v1/apps/${app}`)).data.attributes;
  console.log(`notifications: ${a.subscriptionStatusUrl ?? "none"} (${a.subscriptionStatusUrlVersion ?? "-"}); sandbox ${a.subscriptionStatusUrlForSandbox ?? "none"}`);
}

const cmds = { status, subscription, nonconsumable, "review-shot": reviewShot, notifications };
if (!cmds[cmd] || !bundleId) die("usage: iap.mjs <status|subscription|nonconsumable|review-shot|notifications> <bundle id> …");
try {
  await cmds[cmd](await appId(bundleId));
} catch (e) {
  die(e.message);
}
