#!/usr/bin/env node
// Reference pipeline run (PRD §8.2) for a bundle that's already written, with its audio files on
// disk: the same tool sequence a build agent performs. CI runs it against the local stack with the
// 2026-10-22 fixture; it is also how to republish a fixed bundle by hand.
//
//   node projects/g2digest/scripts/publish-bundle.mjs --site http://127.0.0.1:8790 --token g2a_dev_local_token \
//     --bundle projects/g2digest/packages/core/fixtures/2026-10-22/bundle.json \
//     --audio projects/g2digest/packages/core/fixtures/2026-10-22/audio [--log run.log]
//
// Steps: guide + brief (stop if either fails) → upload every audio file → validate (stop on errors)
// → write the preview snapshot to the run log → publish with the preview_hash.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { mcpClient } from "./mcp-client.mjs";

const { values: a } = parseArgs({ options: { site: { type: "string", default: "http://127.0.0.1:8790" }, token: { type: "string" }, bundle: { type: "string" }, audio: { type: "string" }, log: { type: "string" } } });
if (!a.token || !a.bundle || !a.audio) {
  console.error("usage: publish-bundle.mjs --token g2a_… --bundle bundle.json --audio <dir> [--site URL] [--log file]");
  process.exit(2);
}
const say = (m) => { console.log(m); if (a.log) appendFileSync(a.log, m + "\n"); };
if (a.log) writeFileSync(a.log, "");
const { tool } = mcpClient(`${a.site.replace(/\/$/, "")}/mcp`, a.token);

const guide = await tool("get_card_authoring_guide");
const { brief_version, user_id } = await tool("get_user_brief");
say(`guide ${guide.guide_version} · brief v${brief_version} · user ${user_id}`);

const bundle = JSON.parse(readFileSync(a.bundle, "utf8"));
bundle.guide_version = guide.guide_version;
bundle.brief_version = brief_version;

for (const c of bundle.cards) {
  for (const kind of ["glance", "deep_dive"]) {
    if (!c[kind]) continue;
    const file = `${c.slug}-${kind === "glance" ? "glance" : "deep-dive"}.mp3`;
    const bytes = readFileSync(join(a.audio, file));
    const up = await tool("create_audio_upload", { date: c.carried_from ?? bundle.date, slug: c.slug, kind, content_type: "audio/mpeg" });
    const put = await fetch(up.upload_url, { method: "PUT", headers: up.headers, body: bytes });
    if (!put.ok) throw new Error(`upload ${file}: HTTP ${put.status} ${await put.text()}`);
    c[kind].audio_path = up.audio_path;
    say(`uploaded ${up.audio_path} (${bytes.length} bytes)`);
  }
}

const v = await tool("validate_cards", { bundle });
for (const w of v.warnings) say(`warning ${w.code} ${w.card ?? ""}: ${w.message}`);
if (!v.ok) {
  for (const e of v.errors) say(`ERROR ${e.code} ${e.card ?? ""}: ${e.message}`);
  say("not published: fix the errors and validate again");
  process.exit(1);
}
say("preview snapshot:\n" + v.snapshot);
const p = await tool("publish_cards", { bundle, preview_hash: v.preview_hash });
if (!p.published) {
  for (const e of p.errors) say(`ERROR ${e.code}: ${e.message}`);
  process.exit(1);
}
say(`published ${p.date}: ${p.cards.length} cards`);
