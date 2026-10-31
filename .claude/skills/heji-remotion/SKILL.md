---
name: heji-remotion
description: Make, edit, preview and render videos in code with Remotion (React) in this HEJI monorepo -- Remotion's own official Agent Skills (create, markup, animation, effects such as colorKey green-screen keying, video editing, captions, voiceover, Studio, rendering, upgrades) plus where they live here (branding/promo-videos, media git-ignored) and how it stays out of the root workspaces. Use when asked to "make a video in code", "edit the promo with Remotion", "key out the green screen", "add captions", "open Remotion Studio", "render the MP4", "upgrade Remotion", or when working in branding/promo-videos (every product's promo videos, e.g. tradeboard-launch).
---

# Remotion in this repo

Remotion's guidance, vendored unchanged in `upstream/`, plus the repo rules below.
**Read `upstream/ROUTER.md` first**: it routes each task (create, markup, studio, render, captions,
multimedia, docs, upgrade) to the right reference file under `upstream/`. Its links are relative and
resolve inside `upstream/`.

## Where Remotion lives here

- **One Remotion project for every product's promos: `branding/promo-videos/`.** Layout, naming
  and rules: `branding/README.md` (read it first). Each promo is `<project>-<promo>`
  (`tradeboard-launch`): its edit in `src/<promo>/Composition.tsx` (composition id = the same
  name), its file list in `src/<promo>/media.md`, registered in `src/Root.tsx`. Shared pieces
  (cuts, captions, recording frames) go in `src/shared/`, which never imports from a promo.
- **Standalone npm, not a workspace.** `branding/` is outside the root `workspaces` globs on purpose,
  so `npm ci` at the root and every project's CI never install Remotion or its Chromium. Install and
  run from the folder: `cd branding/promo-videos && npm ci && npm run dev`. Never add it to the root
  `workspaces`.
- Pin every `remotion` / `@remotion/*` package to the same exact version (`npm i -E`); upgrade
  them together with `npx remotion upgrade`. Check with `npm run lint` (eslint + tsc).
- **How promos are made here** (the whole workflow, report to YouTube: skill `heji-promo-video`): AI-generated shots (Google Flow)
  show people and places with the screen hidden; the product is a real screen recording of the app
  (a scripted Playwright run on the local stack, never production), not a green screen (keying and
  corner-pinning looked shaky and covered the hand). Cut on the music's beats with
  `src/shared/Cuts.tsx` (cut times in seconds, transitions centred on each cut), frame recordings with
  `src/shared/Product.tsx`, and caption the voiceover word by word with `KineticCaption`. The shader
  transitions (`@remotion/transitions` cross-zoom, blur-slide, dreamy-zoom) need WebGL:
  `Config.setChromiumOpenGlRenderer("angle")`, already in `remotion.config.ts`.
- Social platforms expect about −14 LUFS: after rendering, normalise with ffmpeg
  `loudnorm=I=-14:TP=-1.5:LRA=11`. In 9:16, size 16:9 footage to the frame height instead of
  `objectFit="cover"` (the canvas-backed `<Video>` stretched).
- **Media never goes in git.** Footage, voiceover, music and screenshots go in `public/<promo>/`,
  renders in `out/`; both are ignored. Load media with `staticFile("<promo>/<file>")`. Keep
  `src/<promo>/media.md` listing every file, since model-made clips can't be regenerated exactly.
- The repo is public: no credentials, real account numbers or unreleased plans in compositions,
  `media.md` or anything rendered for publishing.

## Preview and render

Follow `upstream/ROUTER.md`: start Studio (`npx remotion studio --no-open` in this CLI, then open the
printed URL) and render only when the user explicitly asks for the MP4. Stop Studio when done.

## License

Remotion is free for individuals and companies of up to 3 people; a larger company needs a company
license (github.com/remotion-dev/remotion/blob/main/LICENSE.md; it changes in Remotion 5.0).
The vendored guidance in `upstream/` is Remotion's (version in `upstream/VERSION`).

## Updating the guidance

`.claude/skills/heji-remotion/update.sh` re-fetches `upstream/` from github.com/remotion-dev/skills.
Use it instead of the `npx skills update …` command in `upstream/remotion-upgrade/REFERENCE.md`:
those skills aren't installed under their own names here, because every repo skill is `heji-*`.
