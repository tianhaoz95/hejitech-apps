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
8. **Agents can't delete.** Deleting an artifact or the account is web-only, behind a typed
   confirmation. Agents can change visibility and make share links only for artifacts the person owns.
9. **Limits:** 200 files and 25 MB per version, 2 MB per text file, 8 MB per binary, 100 ops per edit,
   1000 artifacts per person.
