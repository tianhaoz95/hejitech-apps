#!/usr/bin/env bash
# Installs (or updates) the Trading Plan Board executor on this machine: the bundled
# tradeboard-executor.mjs from a tradeboard-v<version> GitHub release, a Node runtime if there's none
# (≥ 22.18, into ~/.tradeboard/node, no sudo), and a service that keeps it running
# (systemd --user on Linux, launchd on macOS). Secrets stay in ~/.tradeboard (mode 700).
#
#   curl -fsSL https://github.com/tianhaoz95/hejitech-apps/releases/download/tradeboard-v0.1.0/install.sh | bash -s -- 0.1.0
#   bash install.sh 0.1.0            # or from a checkout: bash install.sh --local
#   bash install.sh --file ./tradeboard-executor.mjs   # a bundle you copied over
set -euo pipefail
REPO="tianhaoz95/hejitech-apps"
HOME_DIR="${TRADEBOARD_HOME:-$HOME/.tradeboard}"
BIN="$HOME_DIR/bin"
VERSION="${1:-}"
mkdir -p "$BIN" && chmod 700 "$HOME_DIR"

node_ok() { command -v "$1" >/dev/null && "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'; }
NODE="$(command -v node || true)"
if ! node_ok "${NODE:-false}"; then
  NODE="$HOME_DIR/node/bin/node"
  if ! node_ok "$NODE"; then
    os=$(uname -s | tr A-Z a-z); arch=$(uname -m); [ "$arch" = x86_64 ] && arch=x64; [ "$arch" = aarch64 ] && arch=arm64
    v=24.20.0
    echo "Installing Node $v into $HOME_DIR/node"
    curl -fsSL "https://nodejs.org/dist/v$v/node-v$v-$os-$arch.tar.xz" | tar -xJ -C "$HOME_DIR"
    rm -rf "$HOME_DIR/node" && mv "$HOME_DIR/node-v$v-$os-$arch" "$HOME_DIR/node"
  fi
fi

if [ "$VERSION" = "--file" ]; then
  cp "${2:?--file needs a path}" "$BIN/tradeboard-executor.mjs"
elif [ "$VERSION" = "--local" ]; then
  here="$(cd "$(dirname "$0")/.." && pwd)"
  (cd "$here" && node scripts/build.mjs >/dev/null)
  cp "$here/dist/tradeboard-executor.mjs" "$BIN/tradeboard-executor.mjs"
else
  [ -n "$VERSION" ] || { echo "usage: install.sh <version> | --local | --file <bundle>" >&2; exit 2; }
  curl -fsSL -o "$BIN/tradeboard-executor.mjs" "https://github.com/$REPO/releases/download/tradeboard-v$VERSION/tradeboard-executor.mjs"
fi
cat > "$BIN/tradeboard-executor" <<SH
#!/usr/bin/env bash
exec "$NODE" "$BIN/tradeboard-executor.mjs" "\$@"
SH
chmod 755 "$BIN/tradeboard-executor" "$BIN/tradeboard-executor.mjs"
echo "Installed $("$BIN/tradeboard-executor" version) at $BIN/tradeboard-executor"

if [ "$(uname -s)" = Linux ]; then
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/tradeboard-executor.service" <<UNIT
[Unit]
Description=Trading Plan Board executor
After=network-online.target

[Service]
ExecStart=$BIN/tradeboard-executor run
Restart=always
RestartSec=10
Environment=TRADEBOARD_HOME=$HOME_DIR

[Install]
WantedBy=default.target
UNIT
  systemctl --user daemon-reload
  echo "Service: systemctl --user enable --now tradeboard-executor   (logs: journalctl --user -u tradeboard-executor -f)"
  echo "To keep it running while you're logged out: loginctl enable-linger \$USER (may need an admin)."
elif [ "$(uname -s)" = Darwin ]; then
  plist="$HOME/Library/LaunchAgents/com.hejitech.tradeboard-executor.plist"
  mkdir -p "$(dirname "$plist")"
  cat > "$plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.hejitech.tradeboard-executor</string>
  <key>ProgramArguments</key><array><string>$BIN/tradeboard-executor</string><string>run</string></array>
  <key>EnvironmentVariables</key><dict><key>TRADEBOARD_HOME</key><string>$HOME_DIR</string></dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME_DIR/executor.log</string><key>StandardErrorPath</key><string>$HOME_DIR/executor.log</string>
</dict></plist>
PL
  echo "Service: launchctl bootstrap gui/\$(id -u) $plist   (logs: $HOME_DIR/executor.log)"
fi
echo "Next: $BIN/tradeboard-executor setup, then auth, then check (README: Executor)."
