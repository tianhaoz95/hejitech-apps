#!/usr/bin/env bash
# Moves this repo's local setup between Macs. Needs only what ships with macOS, so it runs on a blank
# machine. Never prints a secret: it reports names and paths only. See SKILL.md.
#
#   setup.sh check                        audit this Mac (read-only); exits 1 if something required is missing
#   setup.sh export <image.dmg> [--with-data]  old Mac: pack home-folder secrets into an encrypted image
#   setup.sh import <image.dmg>           new Mac: unpack it, never overwriting an existing file
#   setup.sh fix                          new Mac: repoint git-ignored Android paths, repair worktrees
#
# The image password is typed at a prompt, or read from stdin when stdin is not a terminal.
set -uo pipefail

REPO=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && cd ../../.. && pwd -P)
EXPECTED_REPO=/Volumes/proj/github/hejitech-apps
MEMORY=".claude/projects/$(printf '%s' "$REPO" | sed 's#[/.]#-#g')/memory"
ENV_FILE=".config/heji/machine-env.zsh"
ENV_VARS='FA_ASC_KEY_ID|FA_ASC_ISSUER_ID|FA_KEY_LOCATION|SIGNING_P12_PATH|SIGNING_P12_PASSWORD|TAURI_SIGNING_PRIVATE_KEY|TAURI_SIGNING_PRIVATE_KEY_PASSWORD'
ITEMS=(Credentials .appstoreconnect .tauri .ssh .config/evenhub .feedbackkit .npmrc .gitconfig
  .codex/config.toml .claude/settings.json .claude/skills .agents/skills "$MEMORY")
DATA_ITEMS=(.meowtrix heji-courses)
PRIVATE_DIRS=(Credentials .appstoreconnect .tauri .ssh .config/evenhub .config/heji .feedbackkit)

MOUNT=""
detach() { [ -n "$MOUNT" ] && { hdiutil detach "$MOUNT" -quiet || hdiutil detach "$MOUNT" -force -quiet; rmdir "$MOUNT" 2>/dev/null; MOUNT=""; }; return 0; }
trap detach EXIT

read_password() { # $1 = "new" asks twice
  PASS=""
  if [ -t 0 ]; then
    printf 'Image password: ' >&2; read -rs PASS; echo >&2
    if [ "${1:-}" = new ]; then
      printf 'Again: ' >&2; local again; read -rs again; echo >&2
      [ "$PASS" = "$again" ] || { echo "Passwords differ." >&2; exit 2; }
    fi
  else
    read -r PASS
  fi
  [ -n "$PASS" ] || { echo "Empty password." >&2; exit 2; }
}

attach() { # $1 image, rest: extra hdiutil flags
  local image=$1; shift
  MOUNT=$(mktemp -d "${TMPDIR:-/tmp}/heji-machine.XXXXXX")
  printf '%s' "$PASS" | hdiutil attach "$image" -stdinpass -nobrowse -owners off -mountpoint "$MOUNT" -quiet "$@" \
    || { rmdir "$MOUNT"; MOUNT=""; echo "Could not open the image (wrong password?)." >&2; exit 2; }
}

copy_item() { # $1 source, $2 destination, $3 extra rsync flag or ""
  mkdir -p "$(dirname "$2")"
  if [ -d "$1" ] && [ ! -L "$1" ]; then
    mkdir -p "$2"
    local skip=(); case "$1" in */.ssh) skip=(--exclude=/agent) ;; esac   # agent sockets
    rsync -rlpt --exclude=.DS_Store ${3:+"$3"} ${skip[@]+"${skip[@]}"} "$1/" "$2/"
  elif [ "${3:-}" = --ignore-existing ] && [ -e "$2" ]; then
    :
  else
    cp -pP "$1" "$2"
  fi
}

cmd_export() {
  local image=${1:-} with_data=${2:-}
  [ -n "$image" ] || { echo "usage: setup.sh export <image.dmg> [--with-data]" >&2; exit 2; }
  case "$image" in *.dmg) ;; *) echo "The image name must end in .dmg." >&2; exit 2 ;; esac
  [ ! -e "$image" ] || { echo "Refusing to overwrite $image." >&2; exit 2; }
  local dir; dir=$(cd -P "$(dirname "$image")" 2>/dev/null && pwd -P) || { echo "No such folder: $(dirname "$image")" >&2; exit 2; }
  if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Refusing to write secrets inside a git checkout ($dir). Pick a folder outside it." >&2; exit 2
  fi
  image="$dir/$(basename "$image")"

  local items=("${ITEMS[@]}") item kb=0 size
  [ "$with_data" = --with-data ] && items+=("${DATA_ITEMS[@]}")
  for item in "${items[@]}"; do
    [ -e "$HOME/$item" ] && kb=$((kb + $(du -sk "$HOME/$item" | cut -f1)))
  done
  size=$(( kb * 13 / 10 / 1024 + 128 ))

  read_password new
  printf '%s' "$PASS" | hdiutil create -quiet -size "${size}m" -fs HFS+ -volname HEJI-Machine \
    -encryption AES-256 -stdinpass "$image" || { echo "Could not create the image." >&2; exit 1; }
  chmod 600 "$image"
  attach "$image"

  for item in "${items[@]}"; do
    if [ -e "$HOME/$item" ]; then
      copy_item "$HOME/$item" "$MOUNT/home/$item" "" || { echo "Failed to copy ~/$item" >&2; exit 1; }
      echo "packed   ~/$item"
    else
      echo "absent   ~/$item"
    fi
  done
  mkdir -p "$MOUNT/home/.config/heji" "$MOUNT/reference"
  grep -E "^export ($ENV_VARS)=" "$HOME/.zshrc" > "$MOUNT/home/$ENV_FILE" 2>/dev/null
  echo "packed   $(wc -l < "$MOUNT/home/$ENV_FILE" | tr -d ' ') signing variables from ~/.zshrc"
  for f in .zshrc .zprofile; do [ -e "$HOME/$f" ] && cp -p "$HOME/$f" "$MOUNT/reference/${f#.}"; done
  printf '%s\n' "$HOME" > "$MOUNT/source-home"
  detach
  echo "Encrypted image: $image"
}

cmd_import() {
  local image=${1:-}
  [ -f "$image" ] || { echo "usage: setup.sh import <image.dmg>" >&2; exit 2; }
  read_password
  attach "$image" -readonly

  local src="$MOUNT/home" rel skipped=0 old
  for rel in Credentials .appstoreconnect .tauri .ssh .config/evenhub .config/heji .feedbackkit .npmrc .gitconfig \
    .codex/config.toml .claude/settings.json .claude/skills .agents/skills "$MEMORY" .meowtrix heji-courses; do
    [ -e "$src/$rel" ] || continue
    copy_item "$src/$rel" "$HOME/$rel" --ignore-existing || { echo "Failed to restore ~/$rel" >&2; exit 1; }
    echo "restored ~/$rel"
  done
  for rel in "${PRIVATE_DIRS[@]}"; do [ -e "$HOME/$rel" ] && chmod -R go-rwx "$HOME/$rel"; done

  echo "Files that already existed and differ from the image (kept as they were, names only):"
  for rel in Credentials .appstoreconnect .tauri .ssh .config/evenhub; do
    [ -e "$src/$rel" ] && diff -rq "$src/$rel" "$HOME/$rel" 2>/dev/null | grep '^Files ' | sed -E 's/^Files .* and (.*) differ$/  \1/'
  done

  old=$(cat "$MOUNT/source-home")
  if [ "$old" != "$HOME" ]; then
    local f
    for f in "$HOME"/Credentials/*.env "$HOME/$ENV_FILE"; do
      [ -f "$f" ] && sed -i '' "s#$old#$HOME#g" "$f"
    done
    echo "repointed $old to $HOME in the credential env files"
  fi

  local line="[ -f \"\$HOME/$ENV_FILE\" ] && . \"\$HOME/$ENV_FILE\"  # heji-machine-setup"
  touch "$HOME/.zshrc"
  if ! grep -qF 'heji-machine-setup' "$HOME/.zshrc"; then printf '\n%s\n' "$line" >> "$HOME/.zshrc"; echo "linked   signing variables from ~/.zshrc"; fi

  [ -d "$MOUNT/reference" ] && mkdir -p "$HOME/.config/heji" && cp -p "$MOUNT"/reference/* "$HOME/.config/heji/" 2>/dev/null \
    && { chmod 600 "$HOME"/.config/heji/*; echo "old shell files saved to ~/.config/heji/ (zshrc, zprofile) for aliases and PATH lines"; }
  detach
}

cmd_fix() {
  local sdk="$HOME/Library/Android/sdk" flutter="" f v
  command -v brew >/dev/null && flutter="$(brew --prefix)/share/flutter"
  while IFS= read -r f; do
    v=$(sed -n 's/^sdk\.dir=//p' "$f")
    if [ -n "$v" ] && [ ! -d "$v" ] && [ -d "$sdk" ]; then sed -i '' "s#^sdk\.dir=.*#sdk.dir=$sdk#" "$f"; echo "fixed sdk.dir     ${f#"$REPO"/}"; fi
    v=$(sed -n 's/^flutter\.sdk=//p' "$f")
    if [ -n "$v" ] && [ ! -d "$v" ] && [ -d "$flutter" ]; then sed -i '' "s#^flutter\.sdk=.*#flutter.sdk=$flutter#" "$f"; echo "fixed flutter.sdk ${f#"$REPO"/}"; fi
  done < <(find "$REPO/projects" -name local.properties -not -path '*/node_modules/*' -not -path '*/build/*' 2>/dev/null)
  git -C "$REPO" worktree repair 2>&1 | sed 's/^/worktree: /'
  echo "Done. Run setup.sh check next."
}

# ---- check ----------------------------------------------------------------------------------------
MISSING=0; WARNED=0
ok()   { printf '  ok    %s\n' "$1"; }
miss() { printf '  MISS  %s\n' "$1"; [ -n "${2:-}" ] && printf '        -> %s\n' "$2"; MISSING=$((MISSING+1)); }
warn() { printf '  warn  %s\n' "$1"; [ -n "${2:-}" ] && printf '        -> %s\n' "$2"; WARNED=$((WARNED+1)); }
need_cmd() { if command -v "$1" >/dev/null 2>&1; then ok "$1"; else miss "$1" "$2"; fi; }
need_file() { if [ -e "$1" ]; then ok "${1/#$HOME/~}"; else miss "${1/#$HOME/~}" "$2"; fi; }
want_file() { if [ -e "$1" ]; then ok "${1/#$REPO\//}"; else warn "${1/#$REPO\//}" "$2"; fi; }
section() { printf '\n%s\n' "$1"; }

cmd_check() {
  section "Drive"
  if [ "$REPO" = "$EXPECTED_REPO" ]; then ok "repo mounted at $EXPECTED_REPO"; else warn "repo is at $REPO, not $EXPECTED_REPO" "Hardcoded paths in the skills and video scripts expect this path. Move the checkout there, or update EXPECTED_REPO and those paths."; fi
  [ "$(uname -m)" = arm64 ] && ok "Apple silicon" || warn "not arm64" "Delete node_modules, venvs and build folders, then reinstall them."
  local dev; dev=$(df "$REPO" | awk 'NR==2{print $1}')
  if [ "$(diskutil info "$dev" 2>/dev/null | awk -F: '/^ *FileVault/{gsub(/ /,"",$2);print $2}')" = Yes ]; then ok "volume is encrypted"; else warn "volume is NOT encrypted, and the repo tree holds keystores and .dev.vars" "Encrypt it: right-click the volume in Finder, Encrypt."; fi
  [ -d /Volumes/DATA/Credentials ] && warn "A credentials folder is on the external drive" "Keep that volume encrypted. Removing the folder is the owner's call."

  section "Base tools"
  xcode-select -p >/dev/null 2>&1 && ok "Xcode command line tools" || miss "Xcode command line tools" "xcode-select --install"
  if [ -d /Applications/Xcode.app ]; then ok "$(xcodebuild -version 2>/dev/null | head -1)"; else miss "Xcode.app" "Install from the App Store, then: sudo xcodebuild -runFirstLaunch"; fi
  need_cmd brew "See SKILL.md step 2"
  local c
  for c in gh uv xcodegen pod supabase ffmpeg cmake deno actionlint magick; do need_cmd "$c" "See the brew line in SKILL.md step 2"; done
  need_cmd cargo "Install rustup: https://rustup.rs"
  need_cmd pnpm "corepack enable pnpm"
  if command -v node >/dev/null; then
    [ "$(node -p 'process.versions.node.split(".")[0]')" = 24 ] && ok "node $(node -v)" || warn "node $(node -v), this repo develops on 24" "nvm install 24 && nvm alias default 24"
  else miss node "Install nvm, then: nvm install 24 && nvm alias default 24"; fi
  local pin have
  pin=$(grep -rhoE "flutter-version: *['\"]?[0-9.]+" "$REPO/.github" 2>/dev/null | head -1 | grep -oE '[0-9.]+$')
  if command -v flutter >/dev/null; then
    have=$(flutter --version 2>/dev/null | awk 'NR==1{print $2}')
    [ "$have" = "$pin" ] && ok "flutter $have (matches CI)" || warn "flutter $have, CI pins $pin"
  else miss flutter "brew install --cask flutter"; fi
  for c in "Android Studio" Docker Tailscale; do [ -d "/Applications/$c.app" ] && ok "$c.app" || warn "$c.app not installed" "See SKILL.md step 2"; done
  [ -d "$HOME/Library/Android/sdk/platforms" ] && ok "Android SDK" || warn "Android SDK missing" "See SKILL.md step 6"

  section "Secrets in your home folder"
  local f
  for f in hejitech.env hejitech-apps.env hejitech-apple-distribution.p12 hejiteh-developer-id-application.p12 \
    tianhaozhou-apple-dev-cert.p12 hejitech-google-auth.json waypack.env waypack-sparkle-ed25519.key contempo feedback-kit.env \
    feedbackkit-github-app.private-key.pem review-accounts.env stripe.env evenhub.env hf.env npm.env claude.env crates-io.env 511.env; do
    need_file "$HOME/Credentials/$f" "setup.sh import, or copy it from the old Mac"
  done
  if ls "$HOME"/Credentials/AuthKey_*.p8 >/dev/null 2>&1; then ok "~/Credentials APNs key"; else miss "~/Credentials APNs key" "setup.sh import"; fi
  if ls "$HOME"/.appstoreconnect/private_keys/AuthKey_*.p8 >/dev/null 2>&1; then ok "~/.appstoreconnect/private_keys"; else miss "~/.appstoreconnect/private_keys" "setup.sh import"; fi
  ls "$HOME"/.tauri/*-updater.key >/dev/null 2>&1 && ok "~/.tauri updater keys" || miss "~/.tauri updater keys" "setup.sh import"
  need_file "$HOME/.ssh/config" "setup.sh import"
  [ -f "$HOME/.ssh/id_ed25519" ] && ok "~/.ssh/id_ed25519" || miss "~/.ssh/id_ed25519" "setup.sh import, or make a key and add it to GitHub and your servers"

  local name stale=0 p
  for name in FA_ASC_KEY_ID FA_ASC_ISSUER_ID FA_KEY_LOCATION SIGNING_P12_PATH SIGNING_P12_PASSWORD TAURI_SIGNING_PRIVATE_KEY TAURI_SIGNING_PRIVATE_KEY_PASSWORD; do
    if grep -qE "^export $name=" "$HOME/.zshrc" "$HOME/$ENV_FILE" 2>/dev/null; then ok "$name is exported"; else miss "$name not exported" "setup.sh import"; fi
  done
  while IFS= read -r p; do [ -e "$p" ] || { miss "a credential env file points at a missing file: $p" "setup.sh import rewrites these"; stale=1; }; done \
    < <(sed -nE 's/^(export )?[A-Z0-9_]+_(PATH|LOCATION)="?([^"]*)"?$/\3/p' "$HOME"/Credentials/*.env 2>/dev/null)
  [ "$stale" = 0 ] && ok "paths inside the credential env files resolve"

  section "Signing identities in the keychain"
  local ids; ids=$(security find-identity -v -p codesigning 2>/dev/null)
  for c in "Apple Development" "Apple Distribution" "Developer ID Application"; do
    printf '%s' "$ids" | grep -q "$c" && ok "$c" || miss "$c" "Import its .p12: see SKILL.md step 4. Never let Xcode make a new certificate."
  done

  section "Logins"
  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then ok "gh"; else miss "gh" "gh auth login"; fi
  if command -v supabase >/dev/null && supabase projects list >/dev/null 2>&1; then ok "supabase"; else warn "supabase" "supabase login"; fi
  [ -f "$HOME/Library/Preferences/.wrangler/config/default.toml" ] && ok "wrangler" || warn "wrangler" "npx wrangler login"
  [ -f "$HOME/.config/evenhub/credentials.yaml" ] && ok "Even Hub" || warn "Even Hub" "setup.sh import, or log in again"
  if command -v tailscale >/dev/null && tailscale status >/dev/null 2>&1; then ok "tailscale"; else warn "tailscale" "Open Tailscale and sign in. The dgx and framework-linux hosts need it."; fi
  for c in dgx framework-linux; do
    if grep -qE "^Host $c\$" "$HOME/.ssh/config" 2>/dev/null; then ssh -o BatchMode=yes -o ConnectTimeout=5 "$c" true >/dev/null 2>&1 && ok "ssh $c" || warn "ssh $c does not connect" "Check Tailscale, or the host may be off."; else warn "ssh host $c not configured" "setup.sh import"; fi
  done
  if command -v docker >/dev/null; then docker context inspect remote-framework >/dev/null 2>&1 && ok "docker context remote-framework" || warn "docker context remote-framework missing" "docker context create remote-framework --docker host=ssh://framework-linux"; fi

  section "Repo files git does not track"
  git -C "$REPO" status --short >/dev/null 2>&1 && ok "git works here" || miss "git cannot read the repo" "If it says dubious ownership: git config --global --add safe.directory $REPO"
  git -C "$REPO" worktree list --porcelain 2>/dev/null | grep -q '^prunable' && warn "a git worktree link is broken" "setup.sh fix" || ok "git worktrees"
  want_file "$REPO/.git/hooks/pre-push" "Comes from heji-build-next's worktree.sh; only matters on a fresh clone."
  [ -d "$REPO/node_modules" ] && ok "node_modules" || warn "node_modules" "npm ci"
  while IFS= read -r f; do
    local v; v=$(sed -n 's/^sdk\.dir=//p' "$f")
    if [ -n "$v" ] && [ ! -d "$v" ]; then warn "${f#"$REPO"/} points at a missing SDK" "Install the SDK, then setup.sh fix"; else ok "${f#"$REPO"/}"; fi
  done < <(find "$REPO/projects" -name local.properties -not -path '*/node_modules/*' -not -path '*/build/*' 2>/dev/null)
  for f in projects/contempo/android/keystore.properties projects/contempo/android/upload-keystore.jks projects/contempo/android/wear-keystore.properties projects/contempo/android/wear-upload-keystore.jks \
    projects/contempo/services/web/.dev.vars projects/fitloop/services/web/.dev.vars projects/g2digest/services/web/.dev.vars projects/headway/services/web/.dev.vars \
    projects/tether/services/web/.dev.vars projects/tradeboard/services/web/.dev.vars projects/waypack/services/mcp/.dev.vars projects/weehours/services/web/.dev.vars \
    projects/contempo/ios/Contempo/Resources/Models projects/voxbrief/VoxbriefApp/Resources/Models branding/promo-videos/public/g2digest-demo; do
    want_file "$REPO/$f" "Git-ignored and only on the drive, so a fresh clone lacks it. See SKILL.md step 7."
  done
  while IFS= read -r f; do
    local base; base=$(sed -n 's/^home = //p' "$f"); f=$(dirname "$f")
    if [ -x "$base/python3" ] || [ -x "$base/python" ]; then ok "venv ${f/#$REPO\//}"; else warn "venv ${f/#$REPO\//} has lost its Python" "Recreate it: see SKILL.md step 7"; fi
  done < <(find "$REPO/projects" /Volumes/proj/scratch/heji-video -maxdepth 4 -name pyvenv.cfg -not -path '*/node_modules/*' 2>/dev/null)

  section "Claude Code"
  need_cmd claude "npm install -g @anthropic-ai/claude-code"
  [ -d "$HOME/$MEMORY" ] && ok "project memory" || warn "project memory is missing" "setup.sh import"
  [ -d "$HOME/.agents/skills/new-machine-setup" ] && ok "user skills" || warn "user skills are missing" "setup.sh import"

  section "Tied to one Mac (for information)"
  local runners; runners=$(ls "$HOME"/Library/LaunchAgents/actions.runner.* 2>/dev/null | wc -l | tr -d ' ')
  [ "$runners" -gt 0 ] && echo "  $runners self-hosted GitHub Actions runner(s) on this Mac. They do not move with the drive: see SKILL.md step 8." || echo "  no self-hosted runners on this Mac"

  printf '\n%s missing, %s warnings\n' "$MISSING" "$WARNED"
  [ "$MISSING" = 0 ]
}

case "${1:-}" in
  check) cmd_check ;;
  export) shift; cmd_export "$@" ;;
  import) shift; cmd_import "$@" ;;
  fix) cmd_fix ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
