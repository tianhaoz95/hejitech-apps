---
name: heji-google-flow
description: Generate Google Flow video and Flow Music audio assets for a HEJI project from its kit, on the Mac's signed-in Safari via computer use, and deliver verified shots, stills, loops, and music into branding/promo-videos/public/. Use when asked to "make the Flow shots / Flow assets for <project>", "prepare the video material with Google Flow", "generate the promo/demo art in Flow", or when a kit in reports/ names Google Flow and Flow Music work. This skill cannot run without Mac computer use: see the self-check first.
---

# Google Flow Video Assets

## Capability self-check — do this first

- Before anything else, check whether you can drive the user's paired Mac (for example Tianhao's
  MacBook Air) through computer use: start a computer session, observe the window, and click and type
  in its signed-in Safari, with Google Flow and Flow Music signed in.
- If you cannot — no Mac device, no computer-use permission, or no signed-in Safari session — tell the
  user immediately that this skill cannot run in this environment and stop. Do not substitute a cloud
  browser, another browser profile, a headless browser, or an API workaround, and do not start the task
  hoping it will work.
- This applies on every run, in every environment that loads this skill: the symlink in
  `.agents/skills/` makes it visible to agents that have no Mac computer use, and for them the correct
  outcome is the notification and the stop, not an attempted generation.

## Start from the kit

- Read the project's promo or demo kit (its report in `reports/`) first. It is the source of truth for
  the concept, shot prompts, character descriptions and music prompts. Do not substitute a self-drafted
  plan, and copy every prompt verbatim.
- Confirm the scope before you start, and stop at finished assets unless the user also asks for
  recordings, voiceover, editing or upload work.
- Destination: `branding/promo-videos/public/<project>-<promo>/` (flat, no subfolders), the same `<id>`
  as the edit in `src/<project>-<promo>/` — e.g. `g2digest-launch/` for a promo, `g2digest-demo/` for a
  demo. When the kit or the editing agent names a folder, that folder wins. Never leave assets in `src/`,
  which holds code.
- Media is git-ignored, so it exists only in the main checkout at `/Volumes/DATA/GitHub/hejitech-apps`.
  From a worktree or any other checkout, still read and write media at that absolute path, never in
  your own checkout's `branding/`.

## Project settings and characters

- Create one new Google Flow project for the video, and work in the Mac's signed-in Safari through
  computer use.
- Turn the Flow agent on, set **Confirm before generating** to **Always**, and approve each generation
  individually. Never choose **Always approve**.
- Shots with characters: **Video · Ingredients**, 16:9, drafts on **Omni 1.1 Flash** at 720p ×1
  (observed: 12 credits for an 8 s shot, 10 credits for a 6 s shot).
- Create each character with a portrait first, then a full-length body shot, pasting the kit's
  character info verbatim, and verify each image by screenshot before moving on.
- Attach a voice to each character: search the voice name, fill the sample dialogue and the performance
  description, save it as a custom voice and add it to the character. Record each kept voice name for
  the final report; the editing agent needs it to match the narration.
- Keep the kit's hard rules in every generation: no logos, no text, no signs, no readable phone, watch
  or lens screens, and comedy that stays kind, never body-shaming.

## Generate and verify the shots

- Click the prompt box, type `@`, and pick each character from the **Characters** tab of the ingredient
  picker (search by name when another character shows first). Then type the shot prompt verbatim and
  start the generation.
- Wait about 30 s for the agent's proposal, click the **Approve** radio, then wait about 5–8 min through
  queue and render.
- Open the scene, play it, and screenshot it mid-play to verify framing, characters and action before
  you call the shot done.
- Rename the scene in its title field and press Return to commit; the **Done** button reverts a rename.
- Trash any take generated without ingredient chips, and confirm the trash message, so the editing
  agent is not confused by a generic take.

## Character-free art for demo and walkthrough runs (proven 2026-11-02, G2 Digest demo)

- When a kit needs backdrops and bridges with no characters, no character cards or voices are needed.
  The demo run delivered, in Flow project "G2 Digest demo", 6 stills, 5 backdrop loops and 2 videos,
  all 16:9 and screenshot- or play-verified, into `branding/promo-videos/public/g2digest-demo/`.
- **Stills:** Flow Images, 16:9, 2–4 per prompt (the demo run used ×2), keep the best, download the
  **2K Upscaled** version. 4K is behind an Upgrade link, so 2K Upscaled is the keeper, not a compromise
  to hide in the report. Stills have no Approve step even with Confirm before generating on Always:
  they generate directly after Start generation.
- **Loops:** Video with **Frames**, the kept still as first frame and the kit's loop prompt, 16:9, 8 s;
  draft on Omni 1.1 Flash at 720p, keeper as a 1080p upscale of the verified draft. Verify the frame
  ingredient by preview, not by title: takes can share a title (in the demo run one loop's take was
  the picker's first entry, one was found by title search, two were the second Recent entry).
- **Standalone videos:** Video with **Text to video**, 16:9, 8 s, same draft-then-upscale rule. The
  prefix `Create a video in 16:9, 8 seconds: ` ahead of the verbatim kit prompt worked for both demo
  videos and for the loop prompts.
- Videos do show the Approve proposal; approve each one individually.
- If an editor's main canvas does not render (a placeholder or thin strip, as happened for two demo
  backdrops), verify from the grid screenshot, history thumbnails, and an exact title and filename
  match instead of looping on it.

## Get the 1080p keepers

- 1080p was not available for direct generation through the assistant, Veo 3.1 Quality does not
  support reference-to-video with character entities, and Veo 3.1 Lite at 720p can fail to generate.
  The proven route is a **1080p Upscaled** download of the verified draft; say so plainly in the final
  report instead of presenting an upscale as a fresh generation.
- In the scene editor, open **Download media** (coordinate click, see below) and choose **1080p
  Upscaled**. Wait about 5–6 min for the upscale banner to clear, then find the file in Downloads and
  check its size is nonzero. Flow names it like `Shot_3_draft_09a6abcf_1080p.mp4`.

## Generate and download the music

- Create the music in Flow Music in a session named for the cue, using the kit's prompts verbatim for
  each length. **The take count follows the kit.** A kit asking for one track is satisfied by one
  downloaded take; when the kit asks for takes to choose from, or says nothing, download two per
  length so the editing agent has a choice and a fallback. (The user closed the demo run on 2026-11-02
  with one take; the second generated take stays in Flow Music.)
- Never trust a Flow Music song page header for visibility: it reads "Published" regardless. The
  checkmark inside the visibility dropdown is the ground truth. If a track is published by accident,
  revert it to "Only me", re-inspect, and confirm the checkmark actually moved; a first revert click
  may not stick. Never click **Publish**.
- Tell the editing agent when a track is full length rather than an exact cut (one observed at about
  1 min still needs cutting to 30 s or 15 s).
- Download from the song page: overflow menu → **Download** → **MP3** (coordinates below), then verify
  the named mp3 in Downloads. When clicking a track title only opens the Details panel, reach the song
  page through the panel's **Share** → **Copy link**.

## Move the assets and report

- Move every shot, still, loop and music file from Downloads into the destination folder, renamed to
  the `heji-promo-video` convention, and verify the folder listing afterwards:
  - shots: Flow's download name with the shot number in front (`Shot_3_draft_09a6abcf_1080p.mp4`);
  - stills: `art-<name>.png`; loops and standalone videos: a short name for what they are, keeping
    Flow's id and resolution;
  - music: length, take and track title, e.g. `music-30s-take1-<track title>.mp3`.
- List every new file in the edit's `branding/promo-videos/src/<id>/media.md` (tracked; create it if the
  edit has none yet) and remind the user that media is backed up outside the repo (`branding/README.md`).
- Report the folder, the counts (shots, stills, loops, music), the kept voice names, and every deviation
  from the kit, including upscales instead of fresh high-resolution runs and full-length music tracks
  instead of exact cuts.
- Do not publish anything unless the user explicitly asks.

## Handle the Flow interface quirks

- Avoid popup buttons where possible: clicking one through computer control can open Safari's page
  context menu instead. Dismiss that menu by clicking a textarea.
- After typing `@`, treat an unconfirmed error receipt as a warning only: check the picker in the next
  observation and never retype blindly. When an `@` typed mid-sentence opens the picker, press Escape
  and finish the sentence with plain character names.
- Click a textarea before typing in it, and verify the text through the accessibility tree. The tree
  can garble middle characters, so trust the dispatched count plus the head and tail.
- Fill the browser address field instead of typing into it, and submit with a separate Return key
  action; typing into the smart search field fails.
- Re-observe before clicking when several receipts have passed (observations go stale fast), and
  switch windows inside the same browser when clicks stop working in one.
- If the computer session drops, restart it, re-activate the same Safari window and continue: no
  server-side Flow work is lost. Use single 10 s waits only, never multi-wait batches, which preceded
  session drops in the demo run.
- If the Safari-focus blocker recurs (another Safari window holds focus, coordinate clicks are refused,
  keyboard steps return focus unavailable, Flow Music popup clicks open the context menu), stop and
  report it plainly instead of looping. Dismiss any open context menu by clicking a textarea and leave
  the page clean. Resume with one retry once no other Safari window holds focus, or ask the user to
  download the file by hand.

## Observed coordinates (as of 2026-11, re-check by screenshot)

Element clicks on the download controls open Safari's context menu, so these are coordinate clicks in
normalized window coordinates. They are hints from past runs, not rules: Flow's UI and the window size
change them. Screenshot first and adjust.

| Control | Where |
|---|---|
| Download media, shot/video editor (history collapsed) | ≈ (869, 88) |
| Download, image editor | ≈ (901, 87) |
| Flow Music song page: overflow menu → Download → MP3 | ≈ (640, 294) → (660, 385) → (749, 468) |

## Better results

- Rerun a failed take with the same verbatim prompt instead of editing the prompt on the fly; a changed
  prompt makes takes hard to compare.
- Ask the user to confirm the destination folder and the voice choices before a long generation run
  when either is still open; both are expensive to change after rendering.

## Related skills

- `heji-promo-video` and `heji-demo-video` are the end-to-end video skills: by default the owner makes
  the Flow shots and music from the report's prompts, and the agent does the rest (recordings,
  voiceover, Remotion edit, YouTube kit). This skill covers the agent driving Google Flow and Flow Music
  itself on the Mac; it does not replace the report, the edit, or the upload (`heji-youtube-studio-upload`).

## Websites

- [Google Flow](https://flow.google.com/): characters, shots, stills, loops, 1080p upscaled downloads.
- [Flow Music](https://www.flowmusic.app/): background music and mp3 downloads.
