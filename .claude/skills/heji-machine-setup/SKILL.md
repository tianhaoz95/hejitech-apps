---
name: heji-machine-setup
description: Set up another Mac to work on this HEJI monorepo, all included -- walk the owner through everything the repo needs that git doesn't carry: the external drive and its mount path, Homebrew/Xcode/Node/Flutter/Android/Rust tools, the home-folder secrets (~/Credentials, App Store Connect keys, Tauri updater keys, SSH, signing variables) moved in an encrypted image, keychain signing identities restored without minting certificates, CLI logins, git-ignored Android paths, Python venvs, models and media, Claude Code memory and self-hosted runners. setup.sh audits any Mac and never prints a secret. Use when asked to "set up another Mac", "use the drive on a new machine", "move to a new Mac", "what's missing on this machine", "restore my setup", or when a build fails here because a key, certificate or local path is missing. For skills from the mac-skills catalog alone, new-machine-setup covers the generic Apple basics.
---

# Set up another Mac

Takes a Mac from blank to able to build, test and release every project here. Most of the work
isn't in git: it's in the home folder, the keychain and git-ignored files. `setup.sh` handles what
can be scripted, and the steps below cover the rest.

```sh
S=.claude/skills/heji-machine-setup/setup.sh
bash $S check                # any time, on any Mac; read-only; exits 1 if something required is missing
```

Run `check` first and let its output decide which steps to do. Don't repeat a step it reports as ok.

## Rules

- **The repo is public.** Never write a secret, key ID, IP address or the image password into a repo
  file, report or commit. Never put the image inside a checkout (`export` refuses).
- **Don't read secrets.** Report names and paths only. Don't `cat`, echo or paste the contents of
  `~/Credentials`, `.dev.vars`, keystores or `~/.config/heji/machine-env.zsh`.
- **The owner types the passwords** (the image, keychain prompts, logins), in their own Terminal
  window. Don't ask for them in chat.
- **Never mint a certificate.** Restore the `.p12` files. Apple caps certificates per team. If Xcode offers
  to create one, decline and fix the import instead.
- **Don't delete the originals** (old Mac, any credentials folder on a drive, the image) unless the owner
  asks. Don't touch the old Mac's runners or keychain.

## On the old Mac

### 1. Pack and protect

1. Run `bash $S check` so missing items show up while the old Mac can still supply them.
2. Encrypt the drive if `check` says it isn't (Finder: right-click the volume, Encrypt). Anything
   secret that travels on it should stay encrypted. Encryption
   runs in the background, and the password is needed on every Mac.
3. In Terminal, the owner runs this and picks a strong password kept in a password manager, not on the
   drive:
   ```sh
   bash $S export /Volumes/DATA/heji-machine.dmg              # a few MB: secrets, skills, memory
   bash $S export /Volumes/DATA/heji-machine.dmg --with-data  # adds ~/.meowtrix (2 GB+) and ~/heji-courses
   ```
   It packs `~/Credentials`, `~/.appstoreconnect`, `~/.tauri`, `~/.ssh`, `~/.config/evenhub`,
   `~/.feedbackkit`, `~/.npmrc`, `~/.gitconfig`, `~/.codex/config.toml`, `~/.claude/settings.json`,
   `~/.claude/skills`, `~/.agents/skills`, this repo's Claude memory, the 7 signing variables from
   `~/.zshrc`, and the old `.zshrc`/`.zprofile` for reference.
4. Eject the drive properly before unplugging it.

## On the new Mac

### 2. Install the tools

Plug in the drive first. The repo belongs at `/Volumes/proj/github/hejitech-apps`, and `/Volumes/DATA` holds
scratch and build caches. If this Mac already has a volume named `DATA`, this one mounts as `DATA 1`, which
breaks those paths, so rename the other volume.

```sh
xcode-select --install       # wait for its installer to finish
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv zsh)"
brew install gh uv xcodegen cocoapods supabase/tap/supabase ffmpeg imagemagick-full cmake deno actionlint openjdk@17
brew install --cask flutter android-studio docker tailscale
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/HEAD/install.sh | bash   # read it first; adds itself to the shell
nvm install 24 && nvm alias default 24 && corepack enable pnpm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
npm install -g @anthropic-ai/claude-code feedbackkit-cli @stripe/cli @evenrealities/even-terminal
```

Also install Xcode from the App Store, open it once, then run `sudo xcodebuild -runFirstLaunch`, which
simulators need. CI pins are in `.github/workflows` (`xcode-version`, `flutter-version`); `check`
compares Flutter with its pin. If the cask is newer, install the pinned Flutter from
flutter.dev's archive. Agents run login shells, so PATH and nvm lines must also be in `~/.zprofile`;
the old Mac's copy is saved in step 3.

### 3. Restore the secrets

In Terminal, the owner runs:

```sh
bash $S import /Volumes/DATA/heji-machine.dmg
```

It never overwrites an existing file and lists any that differ. It locks permissions on the secret
folders, rewrites old-home paths in `~/Credentials/*.env` if the username changed, links the signing
variables from `~/.zshrc`, and saves the old shell files in `~/.config/heji/`. Compare those with the
new ones for aliases and PATH lines worth keeping. Open a new shell afterwards.

No image? A Time Machine backup of the old Mac has the same list under `<backup>/Macintosh HD - Data/Users/<you>`;
the signing variables are the `export` lines in its `.zshrc`. Or copy it by hand over AirDrop or an encrypted channel, and set `~/.ssh` to 700
and its keys to 600.

### 4. Restore the signing identities

`check` looks for three. Import each `.p12`; macOS asks for its password in a dialog:

```sh
K=~/Library/Keychains/login.keychain-db
security import ~/Credentials/tianhaozhou-apple-dev-cert.p12 -k $K -T /usr/bin/codesign -T /usr/bin/security
security import ~/Credentials/hejitech-apple-distribution.p12 -k $K -T /usr/bin/codesign -T /usr/bin/security
security import ~/Credentials/hejiteh-developer-id-application.p12 -k $K -T /usr/bin/codesign -T /usr/bin/security
security find-identity -v -p codesigning
```

| Certificate | Where its password is |
|---|---|
| Apple Development | `APPLE_DEV_CERT_PASSWORD` in `hejitech.env`, also `SIGNING_P12_PASSWORD` |
| Apple Distribution | `APPLE_DISTRIBUTION_P12_PASSWORD` in `hejitech.env` |
| Developer ID | Not recorded in `~/Credentials`: the owner's password manager. Ask them. |

If an identity imports but `find-identity` says 0 valid, the Apple intermediates are missing: open
Xcode once, or install the WWDR and Developer ID intermediates from apple.com/certificateauthority.
Then sign in to Xcode with the team's Apple ID (Settings, Accounts).

### 5. Log in

The owner runs each one; tokens live in the keychain or per-machine config, so they don't transfer:

```sh
gh auth login
supabase login
npx wrangler login
stripe login                  # only for Stripe work
```

Sign in to Tailscale (the app), which `dgx` and `framework-linux` need. If the new Mac's SSH key is new
rather than restored, add it to GitHub and both hosts. Recreate the Docker context with
`docker context create remote-framework --docker host=ssh://framework-linux` if `check` asks. Claude
Code: run `claude` and sign in.

### 6. Android

In Android Studio's SDK Manager, or:

```sh
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager \
  "platforms;android-34" "platforms;android-35" "platforms;android-36" "platforms;android-37.0" \
  "build-tools;34.0.0" "build-tools;35.0.0" "build-tools;36.0.0" "build-tools;37.0.0" \
  "ndk;27.1.12297006" "ndk;28.2.13676358" "cmake;3.22.1" platform-tools emulator
bash $S fix        # repoints git-ignored local.properties and repairs worktree links
```

The system has no default Java. Build through Android Studio, or set
`JAVA_HOME="$(brew --prefix)/opt/openjdk@17"` for that command.

### 7. Repo dependencies and git-ignored files

On the drive these all travel already. Recreate only what `check` flags:

```sh
npm ci                                       # root workspaces; other projects: see their CLAUDE.md
(cd branding/promo-videos && npm ci)         # stays outside the root workspaces
(cd projects/waypack/apps/mobile && flutter pub get && cd ios && pod install)
(cd projects/weehours/ml && uv venv --python 3.12 && uv pip install -e .)
```

Venvs copied with the drive point at uv's Python under the old home folder. Keep the same username
and run `uv python install 3.12`, or recreate them. Kokoro (the path the video scripts use):

```sh
V=/Volumes/DATA/Scratch/heji-video/kokoro-venv
rm -rf "$V" && uv venv --python 3.12 "$V"
uv pip install --python "$V/bin/python" "kokoro>=0.9" soundfile "misaki[en]" \
  "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
```

Xcode, SwiftPM and Gradle caches (`.derived`, `.build`, `.gradle`, `/Volumes/DATA/.derivedData`) carry
absolute paths and rebuild themselves. Delete them if a build complains. Generated `.xcodeproj`s are
git-ignored: run `xcodegen` in that project's folder.

**From a fresh clone instead of the drive** these aren't available and must come from elsewhere:

- Contempo keystores: `~/Credentials/contempo/`, restored to `projects/contempo/android/`.
- `.dev.vars` and `.env`: rebuild from the project's `.env.example` and `CLAUDE.md`.
- Models: `projects/contempo/scripts/fetch-models.sh`; for other projects, see their `CLAUDE.md`.
- Video media in `branding/promo-videos/public/`: only on the drive, with no other copy.

### 8. Move what's tied to the old Mac (only if retiring it)

The Actions runners for FeedbackKit and Meowtrix live in `~/Actions` on the old Mac, and their jobs
queue when it's off. Register new ones with the `setup-agent-runner` skill, then remove the old ones.
Check first whether the owner wants both Macs running. The Meowtrix server and app data are per Mac:
`~/.meowtrix`. Read the Meowtrix env trap in Claude memory before running servers.

### 9. Prove it works

```sh
bash $S check                                 # 0 missing; go through each warning with the owner
xcrun devicectl list devices                  # root CLAUDE.md: test on the attached iPhone
scripts/cut_release.sh waypack --dry-run      # read-only release path
```

Then build one iOS project for the attached iPhone, following that project's `CLAUDE.md`, and run one
project's Worker locally. Report honestly what was and wasn't tried. A passing `check` means the files
are in place, not that every build works.

## Keep this skill current

When a project adds a machine-level dependency (a new file in `~/Credentials`, a CLI, an SDK, a
git-ignored secret), add it to the matching list in `setup.sh` and the matching step here.
