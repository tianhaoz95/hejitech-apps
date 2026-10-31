#!/usr/bin/env bash
# Refresh upstream/ from Remotion's official Agent Skills (github.com/remotion-dev/skills).
# Run from the repo root: .claude/skills/heji-remotion/update.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
git clone -q --depth 1 https://github.com/remotion-dev/skills "$tmp/skills"
src="$tmp/skills/skills/remotion-best-practices"
version="$(sed -n 's/^version: //p' "$src/SKILL.md")"
rm -rf "$here/upstream"
cp -R "$src" "$here/upstream"
rm -rf "$here/upstream/agents"
# Renamed so agents that scan for SKILL.md don't list it as a second, non-heji skill.
mv "$here/upstream/SKILL.md" "$here/upstream/ROUTER.md"
printf 'remotion-dev/skills skills/remotion-best-practices\ncommit %s (%s)\nversion %s\n' \
  "$(git -C "$tmp/skills" log -1 --format=%H)" "$(git -C "$tmp/skills" log -1 --format=%cs)" "$version" \
  > "$here/upstream/VERSION"
echo "heji-remotion: upstream skills now $version"
echo "Keep branding/promo-videos on the same version: cd branding/promo-videos && npx remotion upgrade"
