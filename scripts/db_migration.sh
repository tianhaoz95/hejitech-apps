#!/usr/bin/env bash
# New migration for one project in the shared Supabase project (conventions: supabase/README.md).
#
#   scripts/db_migration.sh <project> <what>     # e.g. scripts/db_migration.sh foo add_orders
#
# Projects keep their desired schema in supabase/schemas/<project>/*.sql (declarative). This diffs
# only that project's Postgres schema against the migration history and writes
# supabase/migrations/<timestamp>_<project>_<what>.sql. Review it, then `supabase db reset` locally
# and `supabase db push` for production. Needs the local stack (`supabase start`, i.e. Docker).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${1:-}" WHAT="${2:-}"
die() { echo "!! $*" >&2; exit 1; }
[ -n "$PROJECT" ] && [ -n "$WHAT" ] || die "usage: scripts/db_migration.sh <project> <what>"
[ -d "projects/$PROJECT" ] || die "no projects/$PROJECT"
[[ "$WHAT" =~ ^[a-z0-9_]+$ ]] || die "<what> must be lowercase letters, digits and _ (got $WHAT)"

[ -d "supabase/schemas/$PROJECT" ] || die "no supabase/schemas/$PROJECT/: put $PROJECT's tables there first (create schema $PROJECT; create table $PROJECT.…)"
# --schema keeps the diff to this project's schema: without it, every other project's objects
# (absent from this project's declarative tree) could be diffed as drops.
supabase db schema declarative sync --schema "$PROJECT" --name "${PROJECT}_$WHAT" --no-apply
node scripts/check_supabase.mjs
