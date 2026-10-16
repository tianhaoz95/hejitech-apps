#!/usr/bin/env bash
# Graduation dry run: replays ONE project's migrations (and seed) alone on a fresh local Supabase,
# proving it could move to its own Supabase project today (supabase/GRADUATION.md). Fails if any
# migration depends on another project's objects or on migrations it doesn't own.
#
#   scripts/graduation_check.sh <project>       # Docker; uses ports 566xx, leaves nothing behind
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${1:-}"
[ -n "$PROJECT" ] && [ -d "projects/$PROJECT" ] || { echo "usage: scripts/graduation_check.sh <project>" >&2; exit 2; }
# shellcheck source=/dev/null
source "projects/$PROJECT/backend.env"
if [ "$BACKEND" = own ]; then echo "==> $PROJECT has graduated: its migrations live in projects/$PROJECT/supabase"; exit 0; fi

WORK="$(mktemp -d)"
trap 'supabase stop --workdir "$WORK" --no-backup >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
mkdir -p "$WORK/supabase/migrations" "$WORK/supabase/seeds"

# Only this project's migrations (same ownership rules as check_supabase.mjs).
node --input-type=module -e '
  import { migrationProject } from "./scripts/check_supabase.mjs";
  import { readdirSync, statSync, copyFileSync } from "node:fs";
  const [project, out] = process.argv.slice(1);
  const projects = readdirSync("projects").filter((d) => statSync(`projects/${d}`).isDirectory());
  const mine = readdirSync("supabase/migrations").filter((f) => migrationProject(f, projects) === project);
  for (const f of mine) copyFileSync(`supabase/migrations/${f}`, `${out}/${f}`);
  console.log(`==> ${project}: ${mine.length} migration(s) of ${readdirSync("supabase/migrations").length}`);
' "$PROJECT" "$WORK/supabase/migrations"
[ -f "supabase/seeds/$PROJECT.sql" ] && cp "supabase/seeds/$PROJECT.sql" "$WORK/supabase/seeds/"

# Same config, own project id and ports, and only this project's schema exposed.
if [ "$SCHEMA" = public ]; then SCHEMAS='["public", "graphql_public"]'; else SCHEMAS="[\"public\", \"graphql_public\", \"$SCHEMA\"]"; fi
sed -E -e "s/^project_id = .*/project_id = \"graduation-$PROJECT\"/" \
       -e 's/^((shadow_)?port = )554/\1566/' -e 's/^(inspector_port = )[0-9]+/\18183/' \
       -e "s/^schemas = .*/schemas = $SCHEMAS/" \
       supabase/config.toml > "$WORK/supabase/config.toml"

echo "==> starting a fresh stack with only $PROJECT's migrations"
if ! supabase start --workdir "$WORK" -x studio,imgproxy,vector,logflare,supavisor,mailpit,edge-runtime > "$WORK/start.log" 2>&1; then
  grep -iE "error|failed|ERROR:" "$WORK/start.log" | head -20 >&2
  echo "!! $PROJECT can't stand alone: its migrations depend on something outside them" >&2
  exit 1
fi
# Its declarative source must describe exactly what its migrations build (no undiffed changes).
if [ -d "supabase/schemas/$PROJECT" ]; then
  mkdir -p "$WORK/supabase/schemas" && cp -R "supabase/schemas/$PROJECT" "$WORK/supabase/schemas/"
  supabase db schema declarative sync --workdir "$WORK" --schema "$SCHEMA" --name drift --no-apply > "$WORK/drift.log" 2>&1 || { cat "$WORK/drift.log" >&2; exit 1; }
  if ls "$WORK"/supabase/migrations/*_drift.sql >/dev/null 2>&1; then
    echo "!! supabase/schemas/$PROJECT differs from what its migrations build:" >&2; cat "$WORK"/supabase/migrations/*_drift.sql >&2; exit 1
  fi
  echo "==> supabase/schemas/$PROJECT matches its migrations"
fi
echo "==> $PROJECT stands alone: its migrations and seed replay on an empty Supabase project"
