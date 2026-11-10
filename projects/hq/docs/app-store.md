# HQ on the App Store: everything needed, step by step

A runbook a person or any agent can follow to take HQ's iPhone app from "bundle id registered" to
TestFlight and a filled-in App Store draft. It follows the repo skill `heji-app-store-connect`
(`.claude/skills/heji-app-store-connect/SKILL.md`), whose `asc.mjs` client does the API steps.

Never: submit for review, set a price other than free, accept an agreement. Those are the owner's.

## Where things stand (2026-11-09)

| Step | State |
|---|---|
| Bundle id `com.hejitech.hq` | **Registered** (id `74L74S9UTF`, by automatic signing) |
| App Store Connect app record | **Not created** (step 2, needs a signed-in browser) |
| Code on `main` | **No**: still the local branch `hq/initial` |
| Production Worker + database | **Not deployed** (`projects/hq/docs/DEPLOY.md`) |
| Privacy policy page | **Missing**: the portal has no `/privacy/` yet (blocker for the store draft) |
| In-app account deletion | **Missing** (guideline 5.1.1(v), blocker for review) |
| TestFlight workflow | **Missing** (step 3) |
| Device build | Signed Debug build installs and runs on the owner's iPhone 13 |

Check any time:

```sh
source ~/.config/heji/machine-env.zsh            # FA_ASC_KEY_ID / FA_ASC_ISSUER_ID
A=.claude/skills/heji-app-store-connect/asc.mjs
node $A status com.hejitech.hq                   # exit 3 = no app record yet
```

## 1. Bundle id: done

`node $A register-bundle com.hejitech.hq HQ` is idempotent if it ever needs repeating. Capabilities:
Sign in with Apple (`com.apple.developer.applesignin`, in `apps/ios/project.yml`). No App Groups.

## 2. App record (browser; the API can't create apps)

appstoreconnect.apple.com → **Apps** → **+** → **New App**. A sign-in or 2FA prompt is the only
reason to stop and hand back to the owner.

| Field | Value |
|---|---|
| Platforms | iOS |
| Name | `HQ`. If "already being used": `HQ: Repo Autopilot` (18 chars) |
| Primary Language | English (U.S.) |
| Bundle ID | `com.hejitech.hq` |
| SKU | `com.hejitech.hq` |
| User Access | Full Access |

Confirm: `node $A status com.hejitech.hq` now shows the app record. Record the final name in this
file and in `projects/hq/apps/ios/project.yml` only if it changes the display name (it doesn't: the
home-screen name stays "HQ").

## 3. Before the first build

1. **Merge `hq/initial` to `main` and push** (owner's call; it creates a public project).
2. **Deploy production** per `DEPLOY.md`: `supabase db push`, expose schema `hq`, redirect URLs
   `https://hq.hejitech.workers.dev/**` and `hq://login-callback`, add `com.hejitech.hq` to Apple's
   client ids on the shared Supabase project, Worker secret, `npm run deploy -w @hq/web`.
3. **Add the missing pages to the portal** (`services/web`): `/privacy/`, `/terms/`, `/support/`,
   copying the other projects' pages (e.g. `projects/tether/services/web/{privacy,terms,support}`).
4. **Add in-app account deletion** (Settings → Delete account): delete the person's HQ rows
   (memberships; workspaces where they're the only admin, after a warning) and never the shared
   `auth.users` row (`supabase/README.md`: no project deletes an auth user). Revoke Sign in with
   Apple tokens like Tether does (`projects/tether/services/web/src/worker/apple.ts`).
5. **TestFlight plumbing**, copied from the newest iOS project (Tether):
   - `projects/hq/scripts/release_testflight.sh` and `scripts/asc_build_status.swift`
   - `.github/workflows/hq-testflight.yml`, triggered by published `hq-v*` releases, with the
     weekly schedule `cron: "45 19 * * 3"` (Wednesdays 19:45 UTC, after `19:30`, the latest today)
   - `projects/hq/release.env`: `RELEASE_WORKFLOWS=(hq-testflight.yml)` and the team signing
     `REQUIRED_SECRETS=(ASC_KEY_ID ASC_ISSUER_ID ASC_KEY_P8_BASE64 SIGNING_P12_BASE64 SIGNING_P12_PASSWORD DEV_SIGNING_P12_BASE64 DEV_SIGNING_P12_PASSWORD)`;
     the What's New `release_check` is already there
6. Test the Release build on the attached iPhone against production (sign in with Google and Apple,
   create a workspace, invite, approve a card).

## 4. First build on TestFlight

```sh
scripts/cut_release.sh hq --dry-run
scripts/cut_release.sh hq --watch          # 0.1.0 → What's New must describe the version
node $A status com.hejitech.hq             # wait for processingState VALID (an upload alone proves nothing)
```

## 5. Tester

```sh
node $A invite-tester com.hejitech.hq tianhaozhou95@icloud.com   # internal group "Team"; rerun if no build has processed yet
```

## 6. Store draft (API, `asc.mjs`)

Find ids: `v1/apps/<app>/appInfos`, `v1/appInfos/<id>/appInfoLocalizations`,
`v1/apps/<app>/appStoreVersions`, `v1/appStoreVersions/<id>/appStoreVersionLocalizations`.

### Version (`PATCH v1/appStoreVersions/<id>`)

| Field | Value |
|---|---|
| versionString | `1.0.0` |
| copyright | `2026 HEJI TECHNOLOGY LLC` |

### App info localization (`PATCH v1/appInfoLocalizations/<id>`)

| Field | Value |
|---|---|
| subtitle (≤ 30) | `Approve what your agents ship` (29) |
| privacyPolicyUrl | `https://hq.hejitech.workers.dev/privacy/` (create it first, step 3) |

### Version localization (`PATCH v1/appStoreVersionLocalizations/<id>`)

**promotionalText (≤ 170)**

```
Your repo's autopilot. Agents find the maintenance and reliability work, show the evidence, and wait for your team to approve.
```

**description**

```
HQ is the autopilot for your team's repository. Scheduled AI agents look for the work that keeps a codebase healthy — failing CI, flaky tests, outdated toolchains, slow builds — and turn each finding into a card with the evidence behind it: the CI run, the log line, the measured number.

Your team decides, in a few minutes a day:
• Approve, reject with a reason, or ask a question. The agent that wrote the card answers.
• Approved work is built on a branch, tested, and checked by a second agent before it comes back to you.
• Every card says how HQ will know the change worked.

Built for monorepos: one workspace is one repository and the people who work on it. Admins manage members and the kill switch; approvers decide; viewers follow along.

Guardrails live in HQ, not in prompts: each project sets how much autonomy agents get, releases always need a person, and agents can never approve their own work. Runners and agents run on your own machines with your own keys.

HQ works with Claude Code and other agents that speak MCP. Sign in with GitHub, Google or Apple.
```

**keywords (≤ 100, commas, no spaces after commas)**

```
AI agents,code review,devops,CI,monorepo,developer tools,approvals,automation,GitHub,engineering
```
(96 characters)

| Field | Value |
|---|---|
| supportUrl | `https://hq.hejitech.workers.dev/support/` (create it, step 3); until then `https://tianhaoz95.github.io/hejitech-apps/hq/` |
| marketingUrl | `https://tianhaoz95.github.io/hejitech-apps/hq/` |

### Categories (`PATCH v1/appInfos/<id>`)

Primary `DEVELOPER_TOOLS`, secondary `PRODUCTIVITY`. (A guess: the owner can change it.)

### Age rating (`GET v1/appInfos/<id>/ageRatingDeclaration`, then `PATCH v1/ageRatingDeclarations/<id>`)

Every frequency answer `NONE`, every boolean `false`: no violence, sexual content, profanity,
drugs, gambling, contests, horror or medical content; no unrestricted web access (links open in
the system browser); no user-generated content visible to strangers (only to members of the same
workspace); no messaging with strangers; no in-app purchases; not made for kids. Result: 4+.

### Content rights (`PATCH v1/apps/<app>`)

`contentRightsDeclaration`: `DOES_NOT_USE_THIRD_PARTY_CONTENT`. HQ shows the team's own repository
data and links to GitHub runs. (Flag to the owner as a judgement call.)

### Price and availability

- Free: `POST v1/appPriceSchedules` with the USA price point whose `customerPrice` is `0`
  (`v1/apps/<app>/appPricePoints?filter[territory]=USA`).
- Availability: `POST v2/appAvailabilities` with **every** territory `available: true`.

### What's New (1.0.0)

```
First release: your team's inbox for what HQ's agents propose — approve, reject or discuss, with the evidence on every card. Workspaces for your repo, roles for your team, health for every project.
```
(Update `apps/ios/App/Sources/WhatsNewView.swift` to match before `cut_release.sh`.)

## 7. App Privacy (owner, in App Store Connect; no API)

| Data | Collected | Linked to user | Tracking | Purpose |
|---|---|---|---|---|
| Email address (from GitHub, Google or Apple sign-in) | Yes | Yes | No | App functionality (sign-in, member list) |
| Name | No | — | — | — |
| User content (cards, comments, decisions in your workspace) | Yes | Yes | No | App functionality |
| Identifiers (account id) | Yes | Yes | No | App functionality |
| Diagnostics, usage data, location, contacts | No | — | — | — |

No third-party analytics or ads SDKs.

## 8. App Review account and notes

Build it with the `heji-review-account` skill (`scripts/review_account.sh hq`): a Worker endpoint
`/api/review-sign-in`, a small "Sign in with email" entry (no sign-up), and a demo account reset to a
seeded workspace with a few cards in every state (proposed, discussing, in review, shipped), a
health board and run history. Fill the review contact (name, phone, email) before its PATCH.

Review notes (paste into App Review Information → Notes):

```
HQ is a companion to an engineering team's repository. AI agents (run by the team on their own machines) propose maintenance work as "cards"; people approve, reject or discuss them here.

Demo account: use "Sign in with email" on the sign-in screen with the credentials above. It opens a seeded workspace with cards in every state.

- Inbox → tap a card → Approve / Reject / Discuss.
- Health shows each project's CI status; Runs shows agent activity; Settings has members, invites and the kill switch.
- Sign in with Apple and Google are also offered. Account deletion: Settings → Delete account.
- The app has no purchases. Agents and runners are configured on the team's computers, not in the app.
```

## 9. Screenshots (owner or agent)

The 6.9" iPhone size is required; the owner's iPhone 13 is 6.1", so use a simulator:

```sh
xcrun simctl io booted screenshot inbox.png    # with the demo account, Release build against production
```

1. Inbox: "2 need you", a card to decide and one ready to ship
2. Card: evidence list (CI runs, log excerpt, metric with its source) and Approve / Reject / Discuss
3. Discussion: a question and the agent's answer
4. Build & review evidence with the reviewer's verdict
5. Health: every project's CI and latest release
6. Settings: members with roles and the invite menu

## 10. Owner-only, at the end

- Merge and deploy (step 3), enable GitHub sign-in on the shared Supabase project (`DEPLOY.md` §2).
- App Privacy questionnaire (step 7), and confirm the category and content-rights guesses.
- Paid Apps agreement isn't needed (free).
- Submit for Review.
