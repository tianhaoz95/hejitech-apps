---
name: heji-update-toolchain
description: Audit and update pinned toolchain and CLI versions across the HEJI monorepo (Supabase CLI, Node.js runner version, Even Hub CLI, GitHub Actions, Xcode/macOS runners). Keeps all workflows synchronized, verifies against isolation and graduation checks, and proposes upgrades safely. Use when asked to "update toolchains", "update supabase cli", "upgrade dependencies across workflows", "bump toolchain versions", or invoked as /heji-update-toolchain.
---

# Update pinned toolchains & CLI dependencies

The monorepo pins toolchains and CLIs across GitHub Actions workflows and local scripts to ensure
deterministic builds and prevent unauthenticated rate-limiting on shared runners (such as GitHub
API rate limits with unpinned actions like `supabase/setup-cli`).

The loop: **audit → inspect upstreams → propose → (approval) → update → verify locally → commit + push → watch.**
Never unpin versions to `latest` or floating tags in CI. All workflows must stay synchronized on the
same version.

---

## 1. Tracked toolchains

| Toolchain / CLI | Locations | Why pinned / Rules |
| :--- | :--- | :--- |
| **Supabase CLI** | `.github/workflows/*.yml`<br>`supabase/setup-cli@v1` | Pinned to prevent GitHub API rate limits on shared runners. Must match across all workflows (`supabase-ci.yml`, `headway-ci.yml`, `weehours-ci.yml`, `tether-ci.yml`, `fitloop-ci.yml`, `polymath-ci.yml`, `feedbackkit-backend-ci.yml`, `g2digest-ci.yml`, `feedbackkit-deploy-functions.yml`). |
| **Node.js runner** | `.github/workflows/*.yml`<br>`actions/setup-node@v4` | Pinned across all workflows (e.g. `node-version: 24`). |
| **Even Hub CLI** | `.github/workflows/*glasses*.yml`<br>`EVENHUB_CLI` env var | Pinned (e.g. `@evenrealities/evenhub-cli@0.2.0`) for packing Even G2 plugins. |
| **macOS / Xcode runners** | `.github/workflows/*.yml`<br>`runs-on: macos-26` | macOS runner image for Swift, XcodeGen, and iOS/macOS simulators. |
| **GitHub Actions core** | `.github/workflows/*.yml` | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/setup-java@v4`. |

---

## 2. Audit current versions

Scan current pinned versions across all workflows:

```sh
# Supabase CLI versions
grep -rn -C 2 "supabase/setup-cli" .github/workflows/

# Node versions
grep -rn -C 1 "node-version:" .github/workflows/

# Even Hub CLI
grep -rn "EVENHUB_CLI" .github/workflows/

# macOS runners
grep -rn "runs-on: macos-" .github/workflows/
```

Check the latest stable releases:
```sh
# Supabase CLI latest release
gh api repos/supabase/cli/releases/latest -q '.tag_name'

# Even Hub CLI latest on npm
npm view @evenrealities/evenhub-cli version

# Node LTS
node -v
```

---

## 3. Verify compatibility locally

Before proposing a version bump:

1. **Supabase CLI bump**:
   - Test locally with the candidate version:
     ```sh
     # Verify isolation and migration rules
     node --test scripts/check_supabase.test.mjs scripts/check_isolation.test.mjs
     node scripts/check_supabase.mjs && node scripts/check_isolation.mjs

     # Run graduation check for at least one backend-enabled project
     scripts/graduation_check.sh headway
     ```
2. **Even Hub CLI bump**:
   - Verify that packing glasses plugins succeeds:
     ```sh
     npm run package -w @weehours/glasses
     npm run package -w @g2digest/glasses
     npm run package -w @fitloop/glasses
     ```

---

## 4. Propose (stop here and wait)

Present:
- **Toolchain / CLI**: current version vs proposed version
- **Affected files**: every workflow and script that references it
- **Changelog / Release highlights**: breaking changes or key fixes in the upstream release
- **Local verification result**: graduation check and isolation output
- **Risk assessment**: why it is safe, what CI workflows will be triggered

Wait for user approval before making edits.

---

## 5. Apply, verify, commit & watch

1. Apply changes across **all** affected files (never leave partial updates).
2. Run local checks:
   ```sh
   node --test scripts/check_supabase.test.mjs scripts/check_isolation.test.mjs
   node scripts/check_supabase.mjs && node scripts/check_isolation.mjs
   ```
3. Commit with a clear scope:
   ```sh
   git commit -am "chore(toolchain): bump supabase cli to <version> across workflows"
   git push
   ```
4. Watch re-triggered CI runs to completion:
   ```sh
   gh run list --branch main --limit 10
   gh run watch <run-id>
   ```
