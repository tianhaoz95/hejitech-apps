# Branding

Marketing material that goes out into the world for any HEJI product: promo videos now, later
social cards, press kits and the like. Nothing here is used by an app or Worker build. Each
product's own icons, store screenshots and listing text stay in `projects/<name>/`, because its
builds and release scripts read them there.

## Promo videos (`promo-videos/`)

One Remotion project (React, code-driven video) for every product's promos, so there is one install,
one version to upgrade and shared pieces such as the green-screen replacement, caption style and
end card. Agents: the `heji-promo-video` skill (the whole workflow, from the guide report to YouTube and the pages) and `heji-remotion` (the edit).

```
promo-videos/
  package.json, package-lock.json   one Remotion install, pinned to one exact version
  src/Root.tsx                      registers every promo's composition
  src/shared/                       pieces any promo can use (never imports from a promo):
                                    Cuts (beat-timed cuts + transitions), KineticCaption, DemoLabel,
                                    FlowShot / DesktopRecording / PhoneRecording
  scripts/<promo>-*                 a promo's own tools (screen recordings, voiceover takes)
  src/<project>-<promo>/            one promo: Composition.tsx (the edit) + media.md (its files)
  public/<project>-<promo>/         its footage, voiceover, music, screenshots   (git-ignored)
  out/                              renders                                      (git-ignored)
```

```sh
cd branding/promo-videos
npm ci --loglevel=error
npm run dev                                   # Remotion Studio: preview every promo
npx remotion render tradeboard-launch         # MP4 into out/
npm run lint                                  # eslint + tsc
```

- **Naming.** A promo is `<project>-<promo>` (`tradeboard-launch`), used for its `src/` folder,
  its `public/` folder and its composition id, so one product's promos sort together.
- **Standalone npm, not a workspace.** `branding/` is outside the root `workspaces`, so `npm ci` at
  the root and every project's CI never install Remotion or its Chromium.
- **Media stays out of git.** Model-made clips (Flow/Veo) and renders are tens of MB each and
  can't be regenerated exactly. Everything a promo uses goes in `public/<promo>/` (ignored), is
  listed in `src/<promo>/media.md` (tracked), and is backed up outside the repo.
- **The planning kit is a report.** Story, shot list, Flow prompts and the real screenshots for a
  promo are a `reports/` site (Trading Plan Board: `reports/2026-10-30-tradeboard-promo-video`).
  Copy what the edit needs into `public/<promo>/`.
- **Public repo.** No credentials, real account numbers, personal data or unreleased plans in a
  composition, `media.md` or a render you publish.
- **License.** Remotion is free for individuals and companies of up to 3 people; a larger company
  needs a company license (github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Adding a promo

1. Follow `heji-promo-video`: plan it in a report (`heji-report`): story, shots, prompts, screenshots.
2. `mkdir -p branding/promo-videos/src/<project>-<promo> branding/promo-videos/public/<project>-<promo>`,
   add `Composition.tsx` (id `<project>-<promo>`) and `media.md`, register it in `src/Root.tsx`.
3. Put the footage in `public/<project>-<promo>/`, list it in `media.md`, back it up.
4. Show the product as real screen recordings (scripted, local stack, demo data), not green
   screens; have generated shots hide the screen. Cut to the voiceover and the music's beats.
5. Render, then normalise loudness to −14 LUFS with ffmpeg `loudnorm` before publishing.
