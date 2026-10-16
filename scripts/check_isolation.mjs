#!/usr/bin/env node
// Keeps every project able to leave the shared Supabase project at any time (supabase/GRADUATION.md).
//   node scripts/check_isolation.mjs          # exit 1 and list problems if any
//
// Projects share a backend only until they can pay for their own. Graduating must be a known,
// mechanical edit, so the repo may never grow hidden ties between projects:
//   - each project declares its backend in projects/<name>/backend.env, and its Supabase ref, URL
//     and publishable key appear only in the files it lists there (BACKEND_FILES);
//   - its schema and bucket are named after it;
//   - no project references another one: no paths into projects/<other>/, no @<other>/ packages,
//     no other project's schema or bucket in Supabase calls;
//   - its workflows (.github/workflows/<name>-*.yml) use only its own variables and secrets
//     (<NAME>_…) or the team-wide Apple signing ones, never another project's or unprefixed
//     backend settings that would silently follow a graduation.
// SQL is checked by check_supabase.mjs. Like it, this is a lint over text: it catches mistakes.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaOf } from "./check_supabase.mjs";

/** Team-wide CI secrets every project may use (one Apple developer team). */
export const SHARED_CI_NAMES = new Set([
  "GITHUB_TOKEN", "ASC_KEY_ID", "ASC_ISSUER_ID", "ASC_KEY_P8_BASE64",
  "SIGNING_P12_BASE64", "SIGNING_P12_PASSWORD", "DEV_SIGNING_P12_BASE64", "DEV_SIGNING_P12_PASSWORD",
  "MAC_SIGNING_P12_BASE64", "MAC_SIGNING_P12_PASSWORD",
]);
/** Unprefixed names from before this rule, not backend-related. Don't add to this list. */
export const LEGACY_CI_NAMES = { waypack: ["SPARKLE_PRIVATE_KEY"] };

const TEXT = /\.(?:[cm]?[jt]sx?|json[c5]?|swift|dart|kt|java|ya?ml|toml|env|sh|md|html|css|sql|plist|xcconfig|gradle|txt|rb|py)$|(?:^|\/)\.env[^/]*$|(?:^|\/)backend\.env$/;
const SUPABASE_HOST = /\b([a-z0-9]{20})\.supabase\.(?:co|in)\b/g;

/** Parses a backend.env (bash syntax) by sourcing it. */
export function readBackend(file) {
  const out = execFileSync("bash", ["-c", 'set -e; source "$1"; printf "%s\\n" "$BACKEND" "$SUPABASE_REF" "$SUPABASE_URL" "$SUPABASE_PUBLISHABLE_KEY" "$SCHEMA" "$BUCKET" "${EXTERNAL_SUPABASE_HOSTS[*]:-}" "${BACKEND_FILES[@]}"', "_", file], { encoding: "utf8" });
  const [backend, ref, url, key, schema, bucket, external, ...files] = out.split("\n").filter((l, i, a) => i < a.length - 1 || l);
  return { backend, ref, url, key, schema, bucket, external: external ? external.split(" ") : [], files: files.filter(Boolean) };
}

/** Problems in one project file's text (cross-project references), given every project. */
export function checkFile(path, text, project, backends) {
  const problems = [];
  const others = Object.keys(backends).filter((p) => p !== project);
  const dir = dirname(path);
  for (const q of others) {
    if (new RegExp(String.raw`(?<![\w-])projects/${q}(?:/|\b)`).test(text)) problems.push(`refers to projects/${q}/ (another project)`);
    if (new RegExp(String.raw`["'\s(]@${q}/[\w-]`).test(text)) problems.push(`uses @${q}/ packages (another project)`);
    const { schema, bucket } = backends[q];
    const names = [...new Set([schema !== "public" && schema, bucket].filter(Boolean))].join("|");
    const supa = [
      String.raw`(?:Accept|Content)-Profile["']?\s*[:,]\s*["']?(?:${names})\b`,
      String.raw`\bschema\s*[:=]\s*["'](?:${names})["']`,
      String.raw`\.schema\(\s*["'](?:${names})["']`,
      String.raw`storage\s*\.\s*from\(\s*["'](?:${names})["']`,
      String.raw`/storage/v1/object/(?:public/|sign/|authenticated/|list/|info/)?(?:${names})\b`,
    ];
    for (const re of supa) {
      const m = text.match(new RegExp(re));
      if (m) problems.push(`uses project ${q}'s schema or bucket: ${m[0].trim()}`);
    }
  }
  // Relative paths that climb out of this project into another one.
  for (const m of text.matchAll(/(?:\.\.\/){2,}[\w@.-]+(?:\/[\w@.-]+)*/g)) {
    const target = normalize(join(dir, m[0]));
    const hit = others.find((q) => target === `projects/${q}` || target.startsWith(`projects/${q}/`));
    if (hit) problems.push(`relative path into projects/${hit}/: ${m[0]}`);
  }
  return problems;
}

/** Problems in a project's workflow: CI names that aren't its own or team-wide. */
export function checkWorkflow(text, project) {
  const prefix = `${project.toUpperCase()}_`;
  const legacy = new Set(LEGACY_CI_NAMES[project] ?? []);
  const problems = [];
  for (const m of text.matchAll(/\b(vars|secrets)\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = m[2];
    if (name.startsWith(prefix) || SHARED_CI_NAMES.has(name) || legacy.has(name)) continue;
    problems.push(`${m[1]}.${name}: project settings must be named ${prefix}… (only the Apple team secrets are shared)`);
  }
  return [...new Set(problems)];
}

export function checkRepo(root) {
  const problems = [];
  const projects = readdirSync(join(root, "projects")).filter((d) => statSync(join(root, "projects", d)).isDirectory());
  const backends = {};
  for (const p of projects) {
    const file = join(root, "projects", p, "backend.env");
    if (!existsSync(file)) { problems.push(`projects/${p}: missing backend.env (copy projects/weehours/backend.env)`); continue; }
    const b = (backends[p] = readBackend(file));
    if (!["shared", "own"].includes(b.backend)) problems.push(`projects/${p}/backend.env: BACKEND must be shared or own`);
    for (const k of ["ref", "url", "key"]) if (!b[k]) problems.push(`projects/${p}/backend.env: SUPABASE_${k === "key" ? "PUBLISHABLE_KEY" : k.toUpperCase()} is empty`);
    if (b.url && b.ref && !b.url.includes(b.ref)) problems.push(`projects/${p}/backend.env: SUPABASE_URL doesn't match SUPABASE_REF`);
    const schema = schemaOf(p);
    if (b.schema !== schema) problems.push(`projects/${p}/backend.env: SCHEMA must be ${schema}`);
    if (b.bucket !== p) problems.push(`projects/${p}/backend.env: BUCKET must be ${p}`);
    for (const f of b.files) {
      if (!existsSync(join(root, f))) problems.push(`projects/${p}/backend.env: BACKEND_FILES lists missing ${f}`);
      else if (!f.startsWith(`projects/${p}/`)) problems.push(`projects/${p}/backend.env: BACKEND_FILES may only list files in projects/${p}/ (${f})`);
    }
  }

  // Where each coordinate may appear: the declaring projects' BACKEND_FILES, plus supabase/ for
  // the shared project (its config and docs).
  const allowed = new Map();
  for (const [p, b] of Object.entries(backends)) {
    for (const v of [b.ref, b.key].filter(Boolean)) {
      const set = allowed.get(v) ?? new Set();
      b.files.forEach((f) => set.add(f));
      if (b.backend === "shared") set.add("supabase/");
      allowed.set(v, set);
    }
  }
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => f && TEXT.test(f));
  for (const f of tracked) {
    let text;
    try { text = readFileSync(join(root, f), "utf8"); } catch { continue; }
    const owner = projects.find((p) => f.startsWith(`projects/${p}/`));
    for (const [v, set] of allowed) {
      if (!text.includes(v)) continue;
      const ok = set.has(f) || [...set].some((s) => s.endsWith("/") && f.startsWith(s));
      if (!ok) problems.push(`${f}: contains backend coordinate ${v.slice(0, 16)}… outside BACKEND_FILES${owner ? ` (add it to projects/${owner}/backend.env, or read the value from there)` : ""}`);
    }
    if (owner && backends[owner]) {
      const b = backends[owner];
      for (const m of text.matchAll(SUPABASE_HOST)) {
        if (m[1] !== b.ref && !b.external.includes(m[1])) problems.push(`${f}: Supabase project ${m[1]} isn't ${owner}'s backend (${b.ref}); list third-party services in EXTERNAL_SUPABASE_HOSTS`);
      }
      checkFile(f, text, owner, backends).forEach((msg) => problems.push(`${f}: ${msg}`));
    }
    if (f.startsWith(".github/workflows/")) {
      const p = projects.find((q) => relative(".github/workflows", f).startsWith(`${q}-`));
      if (p) checkWorkflow(text, p).forEach((msg) => problems.push(`${f}: ${msg}`));
    }
  }
  return [...new Set(problems)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "../..");
  const problems = checkRepo(root);
  if (problems.length) {
    console.error(`${problems.length} isolation problem(s) (rules: supabase/GRADUATION.md):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("projects are isolated: each can move to its own Supabase project (supabase/GRADUATION.md)");
}
