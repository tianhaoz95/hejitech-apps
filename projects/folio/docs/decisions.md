# Decisions

## Owner's choices (2026-11-17)

- **Name:** Folio (`projects/folio`, schema and bucket `folio`, tags `folio-v`).
- **Backend:** the shared HEJI Supabase project (own schema + bucket), one Cloudflare Worker.
- **Sign-in:** Google and Apple through the shared project (web only; no native app yet).
- **Shipping:** built overnight, pushed to `main` and deployed live the same night.
- **Scope:** the collaboration core only. Extensions brainstormed earlier (bake-offs across agents,
  file ownership roles, scheduled live data, hand-off packets, HQ integration, provenance badges)
  are left for the owner to pick next.
- **Price:** free for now.

## Design

1. **Artifacts are tiny repositories.** Immutable versions (manifest of path → content hash),
   content-addressed blobs per artifact, an append-only activity feed. Nothing is overwritten;
   restore makes a new version.
2. **Optimistic concurrency with safe auto-rebase.** Every edit names its `base_version`. If the
   artifact moved on, the edit is replayed only when that can't lose anyone's work (untouched files,
   or `replace` ops whose exact text still matches once). Otherwise a 409 tells the agent which
   files changed, in which versions, by whom, so it can read and retry. Whole-file writes onto a
   changed file always conflict.
3. **`replace` is the preferred op.** Agents already think in str_replace edits; the op accepts the
   common aliases (`old_string`, `new_string`, `str_replace`) and errors say exactly how to fix a
   miss (not found, found N times, differs only in whitespace).
4. **Suggestions are first-class**, not comments with code: stored ops on a base version, previewable
   live, accepted with the same rebase rules, revisable by their author. Viewers can suggest.
5. **Attribution without trusting much:** the agent may name itself (`agent`, `model` args); else
   Folio uses the MCP client's `clientInfo` (kept per `Mcp-Session-Id`), else the OAuth client or
   token name. It is a label for people, not an authorization boundary: access always comes from the
   person the agent acts for.
6. **Artifact content is untrusted.** Rendered with a CSP sandbox (opaque origin, no Folio cookies or
   storage, can't call the API as the viewer) on signed, expiring URLs for private artifacts. Text
   from other agents is labelled as data in tool results and in the server instructions.
7. **MCP Apps for inline display.** `show_artifact` declares `ui://folio/viewer.html`
   (`text/html;profile=mcp-app`, spec 2026-01-26); the view nests the sandboxed render URL
   (`csp.frameDomains`). Hosts without the extension get the link.
8. **Agents can't delete.** Deleting an artifact or the account happens only in the web or iPhone
   app, behind a confirmation. Agents can change visibility and make share links only for artifacts the person owns.
9. **Limits:** 200 files and 25 MB per version, 2 MB per text file, 8 MB per binary, 100 ops per edit,
   1000 artifacts per person.

## iPhone app (2026-11-19, owner: "Yes let's do that")

10. **A native iPhone app for reviewing, not authoring.** Agents make artifacts; the phone is where
    a person sees what they made and decides: the live preview, accept/reject with the diff and a
    preview, comments, history and restore, sharing. SwiftUI, iPhone only, iOS 17, same REST API as
    the web app (`X-Folio-Client: iPhone` labels its changes "iPhone").
11. **Notifications are the point.** APNs from the Worker (`push.ts`, the team's key) when a
    suggestion, comment or version arrives. Your own changes in the web or iPhone app don't notify
    you; your agents' changes do (same account, different surface). Three switches per device
    (suggestions, comments, agents' versions). Accept / Reject / Reply right on the notification.
12. **Share extension instead of in-app editing.** "Folio" in the share sheet turns a page, link,
    text, files or photos into a new artifact (`ShareDraft`: an HTML file stays the page; anything
    else gets an `index.html` that shows it, originals kept beside it) for an agent to pick up.
    The session is shared through a Keychain access group, not an App Group (CI signing can't
    register App Groups).
13. **App Review demo account** (skill heji-review-account): "Sign in with email" for accounts we
    hand out; every sign-in resets it to two artifacts different agents worked on, an open
    suggestion and comments (`demo.ts`). Delete my Folio data in Settings (never the shared sign-in).
14. **One version for every surface:** `services/web/package.json`; the TestFlight build ships it.
