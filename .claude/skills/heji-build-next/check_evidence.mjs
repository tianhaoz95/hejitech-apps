#!/usr/bin/env node
// heji-build-next §6: check a build review's evidence against the branches it claims to show.
//   node .claude/skills/heji-build-next/check_evidence.mjs reports/<date>-build-next
// Exit 1 on any FAIL. It's a tripwire for invented evidence, not a proof that captures are real:
// still look at every capture yourself.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const dir = process.argv[2];
if (!dir) { console.error("usage: check_evidence.mjs reports/<date>-build-next"); process.exit(2); }
const site = path.join(dir, "site");
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(site, "js/candidates.js"), "utf8"), { window });
const R = window.REVIEW;
const git = (...a) => { try { return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };

// PNG/GIF/JPEG pixel size from the header.
function size(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 1, 4) === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString("ascii", 0, 3) === "GIF") return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 8;) {
      const len = b.readUInt16BE(i + 2);
      if (b[i + 1] >= 0xc0 && b[i + 1] <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}

// Every frame size the review draws at: a capture exactly that size (or 2x/3x) was rendered for the
// review, not taken from the app.
const frames = new Set();
const addFrame = (s) => s && [1, 2, 3].forEach((k) => frames.add(`${s[0] * k}x${s[1] * k}`));
addFrame(R.size);
for (const c of R.candidates) for (const v of c.views || []) addFrame(v.size);

let fails = 0, warns = 0;
const fail = (id, m) => { fails++; console.log(`FAIL ${id}: ${m}`); };
const warn = (id, m) => { warns++; console.log(`warn ${id}: ${m}`); };

const mediaOf = (c) => {
  const html = [c.render, ...(c.views || []).map((v) => v.render)].map((f) => { try { return typeof f === "function" ? f() : ""; } catch { return ""; } }).join(" ");
  return [...html.matchAll(/media\/([^"'\s)]+)/g)].map((m) => m[1]);
};

for (const c of R.candidates) {
  const f = c.facts || {};
  if (!f.Branch) continue;
  const id = c.id;
  const head = git("rev-parse", "--short", f.Branch);
  if (!head) { fail(id, `branch ${f.Branch} doesn't exist here`); continue; }
  if (!f.Commit || !git("rev-parse", "--short", f.Commit) || git("rev-parse", "--short", f.Commit) !== head) fail(id, `Commit ${f.Commit} isn't the head of ${f.Branch} (${head})`);
  const stat = git("diff", "--shortstat", `main...${f.Branch}`);
  const nums = (s) => (String(s).match(/\d+/g) || []).join(",");
  if (f.Diff && nums(f.Diff) !== nums(stat)) fail(id, `Diff "${f.Diff}" ≠ git diff --shortstat "${stat}"`);

  // Test files named in Tests must exist on the branch.
  const tree = new Set((git("ls-tree", "-r", "--name-only", f.Branch) || "").split("\n").map((p) => path.basename(p).replace(/\.[^.]+$/, "")));
  const named = [...String(f.Tests || "").matchAll(/\b([A-Z]\w*Tests?|[\w-]+[._](?:test|spec))\b/g)].map((m) => m[1].replace(/\.(test|spec)$/, ".$1"));
  for (const t of named) if (!tree.has(t) && !tree.has(t.replace(/\.(test|spec)$/, "")) && ![...tree].some((n) => n.startsWith(t))) fail(id, `Tests names "${t}", which isn't a file on ${f.Branch}`);
  if (!/\d+\s+(\w+\s+)?(tests?|passed|passing)\b/i.test(String(f.Tests || ""))) warn(id, `Tests should quote the command and the count from its output: "${f.Tests}"`);

  // The evidence log: media/<project>/<slug>.log, written for this head.
  const slug = f.Branch.replace(/^heji-build\/\d{4}-\d{2}-\d{2}-/, "").replace(new RegExp(`^${c.group}-`), "");
  const logRel = `${c.group}/${slug}.log`, logPath = path.join(site, "media", logRel);
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : null;
  if (!log) fail(id, `no evidence log media/${logRel}`);
  else {
    if (!log.includes(head)) fail(id, `media/${logRel} never names the branch head ${head}`);
    if (!/^\$ /m.test(log)) fail(id, `media/${logRel} has no "$ <command>" lines`);
    if (/setContent\(|<html|<!doctype/i.test(log)) fail(id, `media/${logRel} shows a page the agent wrote`);
  }

  const media = mediaOf(c).filter((m) => !m.endsWith(".log"));
  const notCaptured = /^not captured/i.test(String(f.Captured || ""));
  if (!media.length && !notCaptured) fail(id, `no captures: show some, or say "Not captured: <why>" in Captured`);
  if (media.length && notCaptured) fail(id, `Captured says "Not captured" but the build shows media`);
  for (const m of media) {
    const p = path.join(site, "media", m);
    if (!fs.existsSync(p)) { fail(id, `media/${m} is missing`); continue; }
    if (/\.(html?|svg)$/i.test(m)) { fail(id, `media/${m}: captures are screenshots, recordings or logs, not pages or drawings`); continue; }
    const s = /\.(png|gif|jpe?g)$/i.test(m) && size(p);
    if (s && frames.has(`${s[0]}x${s[1]}`)) fail(id, `media/${m} is ${s[0]}x${s[1]}, exactly a review frame size: rendered for the review, not captured from the app`);
    if (log && !log.includes(path.basename(m))) fail(id, `media/${m} isn't in media/${logRel} (which command made it?)`);
  }
}

// Media nothing references, or pages hiding in media/.
for (const p of fs.readdirSync(path.join(site, "media"), { recursive: true })) {
  if (/\.(html?|js)$/i.test(p)) { fails++; console.log(`FAIL media/${p}: no pages or scripts in media/`); }
}

console.log(fails ? `${fails} failed, ${warns} warnings` : `ok (${warns} warnings)`);
process.exit(fails ? 1 : 0);
