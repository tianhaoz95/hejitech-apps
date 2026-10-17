---
name: candidate-review
description: Build a local review site (reports/<slug>/) that shows several candidate designs for something the user wants to build (a screen, a whole app flow, a logo/app icon, a web page, a feature's UX) as live HTML mocks, so the user can browse, compare side by side, heart, rate, write change requests, pick a winner and paste a summary back for the next round. Use when the user asks for "candidates", "options", "directions", "mockups to choose from", a "redesign" to pick from, or invokes /candidate-review with a description of what they want built. Also covers the explainer variant (a design walkthrough site for a technical proposal).
---

# Candidate review sites

Distilled from the review sites in `reports/` (2026-10): `ios-home-redesign` (10 home-screen
directions + today's screen), `ios-all-redesign` (one or two takes per screen, a pick per screen),
`logo-redesign` (20 icons shown at every size and platform), `marketplace-mock` (10 directions,
phone + web, plus the user's own "combo" added after feedback) and `feedback-kit-monorepo-support`
(a design walkthrough, no candidates). Open any of them for reference:
`reports/<name>/script/serve.sh`.

The loop: **brief → candidates → user reviews in the browser → "Copy summary" pasted back →
next round (variants, a combo) → winner → implement in the real project.**

`reports/` is ignored locally (`.git/info/exclude`): review sites are scratch work and never
committed. The skill and its template are.

## 1. Brief (ask only what blocks)

From the user's request, settle these; ask (one `AskUserQuestion`) only for what you can't infer
from the request or the project's code:

- **What surface** and so which frame: `phone` (iOS screen, 390×844), `browser` (web page,
  1280×792 with a URL bar), `icon` / `card` (any fixed `size: [w, h]`: logos, widgets, emails).
- **Which project** (`projects/<name>/`). Read its `CLAUDE.md` and the real screen/component you
  are redesigning, so candidates use the app's actual data fields, states and constraints.
- **How many**: default 8–10 single-axis candidates; 1–3 per slot when it's several screens.
- **Style brief** if they gave one ("scrapbook", "family warm trip"); otherwise spread widely.

## 2. Scaffold

```sh
.claude/skills/candidate-review/new.sh <slug> "<Title>"   # → reports/<slug>/, picks a free port
```

The template (`template/`) is a working 3-candidate example. You edit only:

| File | What goes in it |
|---|---|
| `site/js/candidates.js` | `window.REVIEW` config + the candidates (replace the example wholesale) |
| `site/css/candidates.css` | Shared mock chrome, then one block per candidate scoped to `.scr.<id>` (+ `.scr.<id>.dark`) |
| `site/js/kit.js` | Shared sample data, icons, formatters, scene/illustration helpers the candidates reuse |
| `site/index.html` | Only the Google Fonts URL (add every font the candidates use) |

`site/js/review.js` is the engine (gallery → detail → compare, ♥, ★, notes, winner per group,
overall notes, Copy summary, ←/→/F keys, light/dark/preferred toggle, localStorage). Don't fork
it per review; if a review needs a new engine feature, add it to the template so the next one
gets it too. Bespoke views (a home-screen mock with neighbour apps, a size ladder, a flow view)
go in a candidate's `views`, built from helpers in `kit.js`.

### `window.REVIEW`

```js
window.REVIEW = {
  key: "<slug>-v1", dir: "reports/<slug>", title, subtitle, heading, intro /* html */, legend: ["<b>7</b> sample trips"],
  round: 1,                 // bump each round; candidates with round === this get a "New" badge
  frame: "phone",           // | "browser" (+ url: "waypack.app") | "icon" | "card" (+ size: [w, h])
  modes: true,              // false hides the Light/Dark toggle (logos, docs)
  groups: [{ id, name, note }],           // optional: one winner per group (per screen, per surface)
  metrics: (c, scr) => [{ text, good }],  // optional: measured on the real render (e.g. "4/7 items on first screen")
  candidates: [{
    id, n, name, tagline, concept, moves: [], palette: [[name, hex]],
    facts: { Type: "...", Effort: "S|M|L", Needs: "what the app lacks for this" },
    baseline: true,         // today's design: shown first, labelled NOW, not rateable
    mine: true,             // the user's own combo: "Your combo" badge
    round, group, prefers: "dark",
    render: ({ dark }) => html,
    views: [{ name, render, dark, frame }],  // optional extra detail views (other screens, sizes, platforms)
  }],
};
```

## 3. Design the candidates (the part that matters)

What made the past reviews useful:

- **Include the baseline.** Today's screen as candidate 0 (`baseline: true`) gives scale. Recreate
  it faithfully from the code, not from memory.
- **Genuinely different directions**, not ten palettes on one layout. Vary the structure (list vs
  cards vs timeline vs map), density, type, tone. Name each with a short memorable name and a
  one-line tagline; the `concept` says the idea and its trade-off in 2–3 sentences; `moves` lists
  the 3–5 concrete changes.
- **Real data, real states.** One shared sample data set in `kit.js`, using only fields the app has
  (comment which model each field comes from). Include the awkward cases: a long title, a shared
  item, an in-progress/downloading item, an empty or past section, today's date relative to the
  data. Anything a candidate needs that the app lacks goes in `facts.Needs`.
- **Live HTML, not pictures.** Mocks are real DOM at device size, scrollable in the detail view.
  Draw illustrations as inline SVG; no external images, no real brand logos (use generic shapes).
- **Light and dark** for every candidate (`.scr.<id>.dark`), unless `modes: false`. Mark a
  dark-first design `prefers: "dark"`.
- **Effort** (S = restyle, M = new widgets/fonts, L = new data or architecture) so the user can
  weigh looks against cost.
- **Show it where it lives.** Icons: a home screen, a size ladder down to a 16px favicon, dark /
  tinted / Android / Dock. Multi-surface features: phone and web as separate `views`. Flows: one
  group per screen.
- **Measure, don't claim.** If density is the point, add a `metrics` hook that counts what is
  visible on the first screen of the actual render.

## 4. Check it, then hand it over

1. `node --check` the JS files, start `reports/<slug>/script/serve.sh` (in the background) and
   screenshot gallery, a detail page, compare and a 390px-wide gallery with the cached Playwright
   Chromium (`~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell
   --screenshot=… --window-size=1400,1100 <url>`). Look at every candidate in both modes: no
   overflow, no clipped text, no unstyled candidate, no console errors.
2. Tell the user the command and URL, the candidate list (number · name · tagline, one line each)
   and how to respond: ♥ / ★ / notes per candidate, the "Overall direction" box, then
   **Copy summary** and paste it back.

## 5. Next rounds

The pasted summary lists each touched candidate by `id` with ★, ♥, winner and notes, the ones not
reacted to, and the overall direction. Then:

- **Edit in place, same `key`**, so earlier ratings and notes survive. Bump `REVIEW.round`; give new
  candidates `round: <n>` (they get a "New" badge) and continue the numbering.
- Turn notes into new candidates rather than silently mutating rated ones: "03 but with 07's header"
  becomes a new candidate (`mine: true` when it's the user's combo, and put it first). Fix plain
  bugs the user points out in place.
- Drop candidates nobody reacted to only if the user says so (or moves them out of focus with a
  group); keep the baseline.
- When a winner is chosen, summarise the decision (winner, the notes that still apply, `Needs`)
  and move to implementing it in the real project, using the winning candidate's HTML/CSS as the
  spec. The review site stays local as the record.

## Variant: design walkthrough (no candidates)

For a technical proposal rather than a visual choice (`feedback-kit-monorepo-support`): a single
long page with a sticky table of contents and numbered sections — overview with "already works" /
"gaps" cards and a one-line proposal callout, an architecture diagram toggling **Today / Proposed**,
before/after views of the thing that changes (a prompt, a config), a stepper through a request's
journey, small interactive simulations (click a folder → what the CLI resolves; toggle commits →
what the release check says), the data-model diff as code, rollout and compatibility. Don't use
the template's engine for this; reuse `site.css` tokens and `serve.sh` from the template and write
the page by hand. Ground every claim in file paths from the repo.
