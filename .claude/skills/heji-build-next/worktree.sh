#!/usr/bin/env bash
# Local-only build branches for heji-build-next: one branch + git worktree per project, never pushed.
#
#   .claude/skills/heji-build-next/worktree.sh new <project> <slug>   # → heji-build/<date>-<project>-<slug>, prints the worktree path
#   .claude/skills/heji-build-next/worktree.sh list                   # every build branch: worktree, commits ahead of main, files changed
#   .claude/skills/heji-build-next/worktree.sh cleanup                # remove every build worktree and delete every build branch
#
# Worktrees live next to the repo (../<repo>-heji-build/<project>-<slug>), so the main checkout stays on
# main with a clean tree. A pre-push hook (installed once, shared by all worktrees) refuses to push
# any heji-build/* ref, and each branch's pushRemote points nowhere, so a stray `git push` fails.
set -euo pipefail

ROOT="$(git rev-parse --path-format=absolute --git-common-dir | sed 's#/\.git$##')"
cd "$ROOT"
PREFIX="heji-build/"
BASE="$(dirname "$ROOT")/$(basename "$ROOT")-heji-build"
die() { echo "!! $*" >&2; exit 1; }

install_hook() {
  local hook="$ROOT/.git/hooks/pre-push"
  if [ -e "$hook" ]; then
    grep -q 'heji-build/' "$hook" || echo "!! $hook exists without the heji-build guard: add a check that refuses refs/heads/heji-build/*" >&2
    return
  fi
  cat >"$hook" <<'EOF'
#!/usr/bin/env bash
# Installed by .claude/skills/heji-build-next/worktree.sh: heji-build/* branches are local-only.
while read -r local_ref _ remote_ref _; do
  case "$local_ref $remote_ref" in
    *refs/heads/heji-build/*) echo "!! refusing to push $local_ref: heji-build branches never leave this machine (merge into main instead)" >&2; exit 1 ;;
  esac
done
EOF
  chmod +x "$hook"
}

case "${1:-}" in
  new)
    PROJECT="${2:?usage: worktree.sh new <project> <slug>}" SLUG="${3:?usage: worktree.sh new <project> <slug>}"
    [ -d "projects/$PROJECT" ] || die "no projects/$PROJECT"
    [[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]*$ ]] || die "slug must be lowercase-kebab: $SLUG"
    BRANCH="$PREFIX$(date +%F)-$PROJECT-$SLUG"
    DIR="$BASE/$PROJECT-$SLUG"   # one per pick, so a project can have several builds
    [ -e "$DIR" ] && die "$DIR already exists (worktree.sh list; finish or clean up the earlier build first)"
    install_hook
    git fetch -q origin main
    git worktree add -q -b "$BRANCH" "$DIR" origin/main
    git config "branch.$BRANCH.pushRemote" no-push-heji-build   # no such remote: `git push` fails
    git -C "$DIR" branch -q --unset-upstream 2>/dev/null || true
    echo "$DIR"
    ;;
  list)
    git for-each-ref --format='%(refname:short)' "refs/heads/$PREFIX" | while read -r b; do
      wt="$(git worktree list --porcelain | awk -v b="refs/heads/$b" '/^worktree /{w=$2} $0=="branch "b{print w}')"
      printf '%s\t%s ahead\t%s files\t%s\n' "$b" "$(git rev-list --count "main..$b")" \
        "$(git diff --name-only "main...$b" | wc -l | tr -d ' ')" "${wt:-(no worktree)}"
    done
    ;;
  cleanup)
    git worktree list --porcelain | awk '/^worktree /{w=$2} /^branch refs\/heads\/heji-build\//{print w}' | while read -r w; do
      git worktree remove --force "$w" && echo "removed worktree $w"
    done
    git worktree prune
    git for-each-ref --format='%(refname:short)' "refs/heads/$PREFIX" | while read -r b; do
      git branch -D "$b" >/dev/null && echo "deleted branch $b"   # -D also drops its branch.<b>.* config
    done
    rmdir "$BASE" 2>/dev/null || true
    ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
