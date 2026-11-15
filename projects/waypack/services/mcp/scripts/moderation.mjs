#!/usr/bin/env node
// Reviews reports on gallery templates (DECISIONS #73). A template reported by AUTO_HIDE_REPORTS people
// is already hidden from everyone; this is where the owner decides for good.
//
//   node projects/waypack/services/mcp/scripts/moderation.mjs list            # open reports, by template
//   node …/moderation.mjs remove <slug> ["why"]   # keep it out of the gallery; resolves its reports
//   node …/moderation.mjs keep <slug>             # back in the gallery; reports resolved as kept
//   add --local for the local stack (keys from services/mcp/.dev.vars)
//
// Production: SUPABASE_SECRET_KEY from the environment, else ~/Credentials/waypack.env; the URL from
// projects/waypack/backend.env. Prints no reporter or author identities, only counts and their words.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const local = args.includes("--local");
const [cmd, slug, why] = args.filter((a) => a !== "--local");
const die = (m) => { console.error(`!! ${m}`); process.exit(1); };
const envFile = (path) => Object.fromEntries(readFileSync(path, "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]));

let url, key;
if (local) {
  const dev = envFile(new URL("../.dev.vars", import.meta.url));
  url = process.env.SUPABASE_URL ?? "http://127.0.0.1:55421";
  key = dev.SUPABASE_SERVICE_ROLE_KEY;
} else {
  url = envFile(new URL("../../../backend.env", import.meta.url)).SUPABASE_URL;
  key = process.env.SUPABASE_SECRET_KEY ?? envFile(`${homedir()}/Credentials/waypack.env`).SUPABASE_SECRET_KEY;
}
if (!url || !key) die("no database URL or key");
const site = local ? "http://127.0.0.1:8787" : "https://waypack.hejitech.workers.dev";

async function rest(method, path, body) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Accept-Profile": "waypack", "Content-Profile": "waypack", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) die(`${method} ${path.split("?")[0]}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const template = async (s) => (await rest("GET", `trip_templates?select=id,slug,title,status,moderated_at,moderation_note&slug=eq.${encodeURIComponent(s ?? "")}`))[0] ?? die(`no template ${s}`);
const resolve = (id, resolution) => rest("PATCH", `template_reports?template_id=eq.${id}&resolved_at=is.null`, { resolved_at: new Date().toISOString(), resolution });

if (cmd === "list") {
  const reports = await rest("GET", "template_reports?select=template_id,reason,details,created_at&resolved_at=is.null&order=created_at.asc");
  if (!reports.length) { console.log(`No open reports (${local ? "local" : "production"}).`); process.exit(0); }
  const ids = [...new Set(reports.map((r) => r.template_id))];
  const rows = await rest("GET", `trip_templates?select=id,slug,title,status,moderated_at,moderation_note&id=in.(${ids.join(",")})`);
  for (const t of rows) {
    const mine = reports.filter((r) => r.template_id === t.id);
    console.log(`\n${t.title}  ${site}/trips/${t.slug}`);
    console.log(`  ${mine.length} open report(s) · ${t.moderated_at ? `HIDDEN (${t.moderation_note ?? "moderated"})` : "still in the gallery"} · status ${t.status}`);
    for (const r of mine) console.log(`  - ${r.created_at.slice(0, 16)} ${r.reason}${r.details ? `: ${r.details}` : ""}`);
  }
  console.log(`\nDecide with: moderation.mjs remove <slug> "why"  |  moderation.mjs keep <slug>`);
} else if (cmd === "remove") {
  const t = await template(slug);
  await rest("PATCH", `trip_templates?id=eq.${t.id}`, { moderated_at: t.moderated_at ?? new Date().toISOString(), moderation_note: why ? `removed: ${why}` : "removed after review" });
  const n = (await resolve(t.id, "removed"))?.length ?? 0;
  console.log(`Removed "${t.title}" from the gallery; ${n} report(s) resolved. Its author still sees it on their template page.`);
} else if (cmd === "keep") {
  const t = await template(slug);
  await rest("PATCH", `trip_templates?id=eq.${t.id}`, { moderated_at: null, moderation_note: null });
  const n = (await resolve(t.id, "kept"))?.length ?? 0;
  console.log(`Kept "${t.title}" in the gallery; ${n} report(s) resolved. People who reported it still don't see it.`);
} else {
  die("usage: moderation.mjs list | remove <slug> [\"why\"] | keep <slug>   [--local]");
}
