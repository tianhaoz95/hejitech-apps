#!/usr/bin/env node
// Keeps projects apart inside the shared supabase/ folder (conventions: supabase/README.md).
//   node scripts/check_supabase.mjs          # exit 1 and list problems if any
//
// Rules, per migration and per declarative file:
//   - migrations are named <timestamp>_<project>_<what>.sql, <project> a folder in projects/,
//     timestamps unique (Waypack's migrations from before the monorepo are grandfathered);
//   - declarative files live in supabase/schemas/<project>/;
//   - SQL only touches its own project's schema (Waypack's is `public`), objects are
//     schema-qualified, nothing is created in shared schemas (auth, storage, …), no triggers on
//     auth.users, and a storage bucket is only inserted under the project's own name.
// This is a lint over the SQL text, not a parser: it catches mistakes, not determined misuse.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Waypack predates per-project schemas: its tables are in public, its migrations unprefixed. */
export const LEGACY_SCHEMA = { waypack: "public" };
export const LEGACY_MIGRATIONS = {
  waypack: [
    "20261003000000_init.sql",
    "20261004000000_stripe_billing.sql",
    "20261005000000_trip_previews.sql",
    "20261006000000_trip_shares.sql",
    "20261007000000_trip_members.sql",
    "20261008000000_preview_revisions.sql",
    "20261009000000_file_storage.sql",
    "20261010000000_trip_templates.sql",
    "20261011000000_price_tracking.sql",
  ],
};
/** Platform schemas a project may reference (auth.uid(), FKs to auth.users, storage policies). */
const SHARED = ["auth", "storage", "extensions", "pg_catalog", "information_schema", "vault", "cron", "net", "realtime", "graphql", "graphql_public", "pgsodium", "supabase_functions"];

export const schemaOf = (project) => LEGACY_SCHEMA[project] ?? project;
const AUTH_TRIGGER = "trigger on auth.users runs for every project's sign-ups; create per-project rows lazily instead";

/** Problems in one SQL text owned by `project`, given every project's name. */
export function checkSql(sql, project, projects) {
  const problems = [];
  const own = schemaOf(project);
  const others = new Set(projects.filter((p) => p !== project).map(schemaOf));
  if (own !== "public") others.add("public");
  const text = stripComments(sql);
  const code = stripStrings(text);
  const ident = String.raw`(?:"[^"]+"|[A-Za-z_][\w$]*)`;
  const qname = String.raw`${ident}(?:\s*\.\s*${ident})?`;
  const unquote = (s) => s.replace(/"/g, "").toLowerCase();
  const schemaPart = (name) => (name.includes(".") ? unquote(name.split(".")[0].trim()) : null);

  // References to other projects' schemas anywhere (DDL, DML, function bodies, FKs).
  for (const m of code.matchAll(new RegExp(String.raw`(?<![\w$."])(${ident})\s*\.\s*${ident}`, "g"))) {
    const s = unquote(m[1]);
    if (others.has(s)) problems.push(`references schema "${s}" (${s === "public" ? "not this project's schema" : "another project's"}): ${m[0]}`);
  }

  // Objects created or altered: must be schema-qualified and in the project's own schema.
  const kinds = String.raw`(?:table|view|materialized\s+view|function|procedure|type|sequence|domain|aggregate)`;
  const defs = [
    new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:(?:temp|temporary|unlogged|recursive)\s+)?${kinds}\s+(?:if\s+not\s+exists\s+)?(${qname})`, "gi"),
    new RegExp(String.raw`\balter\s+${kinds}\s+(?:if\s+exists\s+)?(?:only\s+)?(${qname})`, "gi"),
    new RegExp(String.raw`\bdrop\s+${kinds}\s+(?:if\s+exists\s+)?(${qname})`, "gi"),
    new RegExp(String.raw`\bcreate\s+policy\s+${ident}\s+on\s+(${qname})`, "gi"),
    new RegExp(String.raw`\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:${ident}\s+)?on\s+(?:only\s+)?(${qname})`, "gi"),
  ];
  for (const re of defs) {
    for (const m of code.matchAll(re)) {
      const name = m[1].replace(/\s+/g, "");
      const s = schemaPart(name);
      if (s === null) {
        if (own !== "public") problems.push(`unqualified name (write ${own}.${unquote(name)}): ${oneLine(m[0])}`);
      } else if (s !== own && SHARED.includes(s) && !/^create\s+policy/i.test(m[0])) {
        problems.push(`creates or changes objects in shared schema "${s}": ${oneLine(m[0])}`);
      }
    }
  }
  for (const m of code.matchAll(new RegExp(String.raw`\bcreate\s+schema\s+(?:if\s+not\s+exists\s+)?(${ident})`, "gi"))) {
    const s = unquote(m[1]);
    if (s !== own) problems.push(`creates schema "${s}" (this project's schema is "${own}")`);
  }

  // Users are shared by every project.
  if (/\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\b[^;]*?\bon\s+"?auth"?\s*\.\s*"?users"?/i.test(code)) {
    problems.push(AUTH_TRIGGER);
  }

  // Buckets: only the project's own (bucket name = project name).
  for (const m of text.matchAll(/\binsert\s+into\s+"?storage"?\s*\.\s*"?buckets"?[^;]*?\bvalues\s*\(\s*'([^']*)'/gi)) {
    if (m[1] !== project) problems.push(`inserts storage bucket '${m[1]}' (this project's bucket is '${project}')`);
  }
  return problems;
}

/**
 * Problems across supabase/: migration names, declarative layout, and each file's SQL.
 * Warnings are known issues in grandfathered migrations, which can't change once applied.
 */
export function checkRepo(root) {
  const problems = [], warnings = [];
  const projectsDir = join(root, "projects");
  const projects = readdirSync(projectsDir).filter((d) => statSync(join(projectsDir, d)).isDirectory());
  for (const p of projects) {
    if (!/^[a-z][a-z0-9_]*$/.test(p)) problems.push(`projects/${p}: name must be a valid schema name (lowercase letters, digits, _)`);
  }
  const report = (file, list) => list.forEach((msg) => problems.push(`${relative(root, file)}: ${msg}`));
  const legacy = new Map(Object.entries(LEGACY_MIGRATIONS).flatMap(([p, files]) => files.map((f) => [f, p])));

  const migDir = join(root, "supabase/migrations");
  const seen = new Map();
  for (const f of existsSync(migDir) ? readdirSync(migDir).sort() : []) {
    const file = join(migDir, f);
    if (!f.endsWith(".sql")) continue;
    const m = /^(\d{14})_([a-z][a-z0-9_]*)\.sql$/.exec(f);
    if (!m) { report(file, ["name must be <14-digit timestamp>_<project>_<what>.sql"]); continue; }
    if (seen.has(m[1])) report(file, [`timestamp ${m[1]} also used by ${seen.get(m[1])}`]);
    seen.set(m[1], f);
    let project = legacy.get(f);
    if (!project) {
      // Longest matching project prefix, so `foo_bar` wins over `foo` for foo_bar_x.sql.
      project = projects.filter((p) => m[2].startsWith(p + "_")).sort((a, b) => b.length - a.length)[0];
      if (!project) { report(file, [`must start with a project name after the timestamp (projects: ${projects.join(", ")})`]); continue; }
    }
    const found = checkSql(readFileSync(file, "utf8"), project, projects);
    if (legacy.has(f)) found.filter((msg) => msg === AUTH_TRIGGER).forEach((msg) => warnings.push(`${relative(root, file)}: ${msg}`));
    report(file, legacy.has(f) ? found.filter((msg) => msg !== AUTH_TRIGGER) : found);
  }

  const declDir = join(root, "supabase/schemas");
  for (const d of existsSync(declDir) ? readdirSync(declDir) : []) {
    const dir = join(declDir, d);
    if (d.startsWith(".")) continue;
    if (!statSync(dir).isDirectory() || !projects.includes(d)) { report(dir, [`declarative files go in supabase/schemas/<project>/ (projects: ${projects.join(", ")})`]); continue; }
    if (LEGACY_SCHEMA[d]) { report(dir, [`${d} lives in "${LEGACY_SCHEMA[d]}" and uses hand-written migrations`]); continue; }
    for (const file of walk(dir).filter((f) => f.endsWith(".sql"))) report(file, checkSql(readFileSync(file, "utf8"), d, projects));
  }
  return { problems, warnings };
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}
function stripComments(sql) {
  // Keeps strings and dollar-quoted bodies intact; removes -- and /* */ comments outside them.
  let out = "";
  for (let i = 0; i < sql.length; ) {
    const c = sql[i];
    const dollar = c === "$" ? /^\$[A-Za-z_]*\$/.exec(sql.slice(i)) : null;
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c ? 2 : 1;
      out += sql.slice(i, j + 1); i = j + 1;
    } else if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      const stop = end < 0 ? sql.length : end + dollar[0].length;
      out += sql.slice(i, stop); i = stop;
    } else if (sql.startsWith("--", i)) {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (sql.startsWith("/*", i)) {
      const end = sql.indexOf("*/", i + 2); i = end < 0 ? sql.length : end + 2; out += " ";
    } else { out += c; i++; }
  }
  return out;
}
/** Blanks single-quoted literals (so 'public.x' in a string isn't a reference); keeps $$ bodies. */
const stripStrings = (sql) => sql.replace(/'(?:[^']|'')*'/g, "''");
const oneLine = (s) => s.replace(/\s+/g, " ").trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "../..");
  const { problems, warnings } = checkRepo(root);
  for (const w of warnings) console.warn(`warning (grandfathered): ${w}`);
  if (problems.length) {
    console.error(`supabase/ has ${problems.length} problem(s) (conventions: supabase/README.md):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("supabase/: migrations and declarative schemas follow the per-project conventions");
}
