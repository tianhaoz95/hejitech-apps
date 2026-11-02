---
name: heji-youtube-studio-upload
description: Upload finished videos and Shorts in YouTube Studio on the Mac's signed-in Safari via computer use, and verify them at the source, with the channel, visibility, subtitles, and description/tags rules proven on HEJI TECH uploads. Use when asked to "upload <video> to YouTube", "upload the final cut / walkthrough / promo to HEJI TECH", "put this video on YouTube Studio", or when continuing a YouTube upload for a HEJI project. This skill cannot run without Mac computer use: see the self-check first.
---

# YouTube Studio Upload

## Capability self-check — do this first

- Before anything else, check whether you can drive the user's paired Mac (for example Tianhao's
  MacBook Air) through computer use: start a computer session, observe the window, and click and type
  in its signed-in Safari, with YouTube Studio signed in.
- If you cannot — no Mac device, no computer-use permission, or no signed-in Safari session — tell the
  user immediately that this skill cannot run in this environment and stop. Do not substitute a cloud
  browser, another browser profile, a headless browser, or an API workaround, and do not start the task
  hoping it will work.
- This applies on every run, in every environment that loads this skill: the symlink in
  `.agents/skills/` makes it visible to agents that have no Mac computer use, and for them the correct
  outcome is the notification and the stop, not an attempted upload.

## Prepare the upload on the right channel

- Work in YouTube Studio in the Mac's signed-in Safari, never a cloud browser: the signed-in state
  lives on the Mac.
- **Confirm the channel before the first upload** and stop if it is not the intended one; a
  wrong-channel upload has to be deleted and re-uploaded. Studio in a new tab defaults to the personal
  channel "Tianhao Zhou", not HEJI TECH. Check the dashboard's "Your channel" name and the Content list
  (the personal channel shows old personal videos; HEJI TECH shows the promo catalogue). Switch to HEJI
  TECH directly via `studio.youtube.com/channel/UCCx17EMpUwCYWkJYqXMQVRQ` and re-confirm before
  uploading anything.
- Stage uniquely named copies in `~/Downloads` before opening the file picker: the picker shows
  same-named files by size and date only and hides paths.
- Keep every upload **Private** until the user explicitly chooses Public, even when a kit says Public
  or Unlisted.
- Skip playlists entirely: don't create one or add a video to one, even when a kit names one.
- Leave thumbnails auto-generated and don't upload a kit thumbnail until the user decides which looks
  better.

## Fill the dialog without losing values

- Click a visibility radio explicitly before Save, even when it looks selected; Studio alerts otherwise.
- Fill the description with the full exact text in one fill, then verify its tail and length in the
  accessibility tree before saving; a tail edit can land mid-sentence.
- Re-verify the description tail after every click near the description field: a nearby hashtag
  suggestion chip can silently apply a tag.
- Accept YouTube's hashtag case normalization on save; the tag still matches.
- Scroll the upload dialog on a non-textarea control; scrolling on a focused description textarea does
  nothing.
- For dropdowns, open the menu and click the element with the exact option label, then verify the value
  in the button's subtree. Coordinate clicks on web dropdown items often close the menu without
  selecting.
- Set language, caption certification and category this way. Use "People & Blogs" only as a reported
  fallback when the intended category resists selection.
- Set a Short's language explicitly: a Short defaults to "Select", not English.

## When description or tags will not fill (proven 2026-11-02, G2 Digest walkthrough)

- Background text input can fail on Studio's description editor and tags field, in both the upload
  dialog and the edit page, while everything else works. Symptoms: a fill returns
  `text_input_unavailable` or dispatched-unverified with the field still empty, and click-then-type
  returns `keyboard_focus_unavailable` with focus staying on the webarea. Title fill, radios,
  checkboxes, label clicks, scrolls and the file picker working at the same time does not mean the text
  fields will: the failure is field-specific, not a whole-session failure.
- Don't loop on a failing description or tags fill, and don't force a Save. Verify in the accessibility
  tree and by screenshot that the field is actually empty (nothing half-filled or corrupted), and leave
  the video Private.
- Report the upload as **partial**, not complete, even if title, subtitles and visibility all verify.
  Give the user the exact description and tags text to paste by hand, and leave Safari on the video's
  edit page for that paste.
- A Save button reporting "no enabled control" on the edit page means there are no unsaved changes
  (for example, subtitles already published from the editor). It is not a failure.
- If the active Safari tab switches after a failed click, switch back to the Video details tab and
  re-verify the same state before continuing; the failed click sent no input.

## Handle blocks and stale dialogs

- A **Daily upload limit** banner is a rolling 24 h cap: stop retrying. Verification doesn't lift it and
  phone verification is not the fix. Recheck in a fresh tab the next day, and close the stale dialog
  without leaving duplicates.
- When a dialog's Save stays dead after a limit banner or a session drop, open a fresh tab; that has
  worked where the old dialog stayed dead.
- An "Allow automatic places" checkbox that won't toggle: record it as a deviation and move on.
- Fix chapters on the edit page after saving: the chapters checkbox can re-check itself on save.
- Use Find on the edit page to reach the Tags, Language or Chapters fields: page scrolls jump a full
  viewport and skip that middle band.
- When the upload dialog sits over an edit page, take a screenshot to tell whose control is whose
  (there can be two Save buttons and two Tags fields), and never toggle a checkbox you can't attribute.

## Verify at the source before reporting

- Add subtitles on the edit page with **Upload file** → **With timing** using the cut's SRT; the upload
  dialog may offer no subtitle step. On a wide video use the first **Add** button; on a Short use the
  second, because "Related video" comes first there.
- A Short's cover can only be picked in the YouTube app (choose the end-card frame); web Studio has no
  control for it.
- For each video, confirm title and description on its edit page, and the Private flag and date on the
  Content list. For a Short, check both the Videos and Shorts lists: each shows its own Private flag.
- Confirm exactly one copy of each cut exists, and close any stale dialog without duplicates, before
  reporting success.
- Flip to Public only after this verification and an explicit choice by the user, so a wrong channel
  or a wrong description never goes public.
- If the user needs the Mac screen mid-upload, stop all clicks immediately and leave any open dialog
  exactly as it is: don't save, close or discard it. Report the stage (staged file verified or not,
  dialog open and filled or not, channel confirmed or not), then wait. On resume, re-verify the
  channel, the staged file and the dialog state from scratch.

## Related skills

- `heji-promo-video` and `heji-demo-video` plan the video, build the report and produce the YouTube kit
  (titles, descriptions, tags, thumbnails, SRT subtitles); by default the owner uploads from that kit.
  When the agent itself is asked to do the Studio upload on the Mac, follow this skill instead of
  handing the kit back. Assets made in Flow by the agent: `heji-google-flow`.

## Websites

- [YouTube Studio](https://studio.youtube.com/): uploads and verification. Bring the staged files, the
  SRTs and the kit's verified title, description, tags, language, caption certification and category,
  and verify each result at the source.
