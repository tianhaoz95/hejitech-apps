---
name: heji-candidate-review
description: Build a local review site (reports/<slug>/) that shows several candidate designs for something the user wants to build (a screen, a whole app flow, a logo/app icon, a web page, a feature's UX) as live HTML mocks, so the user can browse, compare side by side, heart, rate, write change requests, pick a winner and copy a self-contained hand-off (report location, brief, each candidate's full design, the user's feedback, next steps) that any agent in any session can act on. Candidates that change more than UI carry a design section: today/proposed spec, structure and data-flow diagrams, ML/eval charts, schema tables. Use when the user asks for "candidates", "options", "directions", "mockups to choose from", a "redesign" to pick from, or invokes /heji-candidate-review with a description of what they want built. Also covers the explainer variant (a design walkthrough site for a technical proposal).
---

# Candidate review sites

Distilled from the review sites now in `reports/archive/` (2026-10): `ios-home-redesign` (10 home-screen
directions + today's screen), `ios-all-redesign` (one or two takes per screen, a pick per screen),
`logo-redesign` (20 icons shown at every size and platform), `marketplace-mock` (10 directions,
phone + web, plus the user's own "combo" added after feedback) and `feedback-kit-monorepo-support`
(a design walkthrough, no candidates), plus `voxbrief-candidates-2026-10-19` and
`weehours-roadmap` (features and improvements, with a today/proposed spec per candidate). Open any
of them for reference: `reports/archive/<name>/script/serve.sh`.

The loop: **brief → candidates → user reviews in the browser → "Copy summary" (a hand-off) pasted to
an agent → next round (variants, a combo) → winner → implement in the real project.** The agent
that reads the hand-off may be another agent in a new session, so the site and the hand-off must
carry everything: where things are, the brief, every candidate's full design and the user's
feedback.

Review sites in `reports/` are committed with the work they belong to, so they stay reviewable
from any checkout. Old ones move to `reports/archive/` (the `heji-archive-reports` skill).

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
.claude/skills/heji-candidate-review/new.sh <slug> "<Title>"   # → reports/<YYYY-MM-DD>-<slug>/, picks a free port
```

Every report folder starts with the date it was generated (`reports/2026-10-20-voxbrief-ask/`): pass
the slug without a date and `new.sh` adds today's. Below, `<slug>` means that full dated name.

The template (`template/`) is a working 3-candidate example. You edit only:

| File | What goes in it |
|---|---|
| `site/js/candidates.js` | `window.REVIEW` config + the candidates (replace the example wholesale) |
| `site/css/candidates.css` | Shared mock chrome, then one block per candidate scoped to `.scr.<id>` (+ `.scr.<id>.dark`) |
| `site/js/kit.js` | Shared sample data, icons, formatters, scene/illustration helpers the candidates reuse |
| `site/index.html` | Only the Google Fonts URL (add every font the candidates use) |

`new.sh` fills in `dir`, `repo` and `port`. Fill in `project`, `context` and `brief` yourself: the
hand-off only includes them once they're no longer the template's placeholders.

`site/js/review.js` is the engine (gallery → detail → compare, ♥, ★, a note box per candidate on
its card, compare column and page, winner per group,
overall notes, Copy summary → hand-off, ←/→/F keys, light/dark/preferred toggle, localStorage), and
`site/js/design.js` renders the design section (§3b) on the page and as text in the hand-off. Don't fork
it per review; if a review needs a new engine feature, add it to the template so the next one
gets it too. Bespoke views (a home-screen mock with neighbour apps, a size ladder, a flow view)
go in a candidate's `views`, built from helpers in `kit.js`.

### `window.REVIEW`

```js
window.REVIEW = {
  key: "<slug>-v1", dir: "reports/<slug>", repo: "<owner>/<repo>", port: 8787,   // new.sh fills these
  project: "projects/<name>",             // where the work lands
  context: ["projects/<name>/CLAUDE.md", "<the files the candidates change>"],  // read first
  brief: "the user's ask in their words + the constraints settled in the brief",
  title, subtitle, heading, intro /* html */, legend: ["<b>7</b> sample trips"],
  round: 1,                 // bump each round; candidates with round === this get a "New" badge
  frame: "phone",           // | "browser" (+ url: "waypack.app") | "icon" | "card" (+ size: [w, h])
  modes: true,              // false hides the Light/Dark toggle (logos, docs)
  groups: [{ id, name, note }],           // optional: one winner per group (per screen, per surface)
  metrics: (c, scr) => [{ text, good }],  // optional: measured on the real render (e.g. "4/7 items on first screen")
  nextSteps: ({ winners, groups, decided, allDecided, dir }) => [lines],  // optional: replaces the hand-off's "What to do next"
  candidates: [{
    id, n, name, tagline, concept, moves: [], palette: [[name, hex]],
    facts: { Type: "...", Effort: "S|M|L", Needs: "what the app lacks for this" },
    baseline: true,         // today's design: shown first, labelled NOW, not rateable
    mine: true,             // the user's own combo: "Your combo" badge
    round, group, prefers: "dark",
    render: ({ dark }) => html,
    views: [{ name, render, dark, frame }],  // optional extra detail views (other screens, sizes, platforms)
    spec: { today: [], proposed: [], files: [], risks: [], verify: [] },  // §3b
    design: [{ kind: "flow" | "chart" | "table" | "code" | "steps" | "html", ... }],  // §3b, see js/design.js
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

## 3b. Design for anything beyond looks

A candidate that changes more than UI (data model, sync, services, APIs, background work,
performance, ML models, prompts, evals, pipelines) gets a **design section**: a `spec` and `design`
blocks, shown under its mocks and written into the hand-off as text. The mock shows what the user
sees; the design shows how it works. The bar: an engineer who never saw the conversation could build
it from the design section and the files it names.

- **`spec` on every such candidate:** `today` (how it works now, with file/type names from the
  code), `proposed` (what changes), `files` (repo paths, `(new)` for new ones), `risks` (open
  questions, migrations, what could regress), `verify` (how to prove it works: tests, evals, device
  checks).
- **Structure changes → a `flow` diagram with `today` and `proposed`.** Components, stores, models
  and the edges between them; mark `state: "new" | "changed" | "removed"` so the diff is visible.
  Use it for architecture, data flow, sync, request/sample journeys.
- **ML / eval / pipeline work → a data-flow diagram plus numbers.** The pipeline from raw input to
  shipped artefact (data sources → generation/labeling → training → conversion → eval → app), with
  model types (`type: "model"`) and stores. Then `chart`s of the numbers the decision rests on:
  current eval results per class/question, latency, size, accuracy by run. Take numbers from the
  repo (eval results, reports, logs) and set `basis: "measured"` with a `source`; projections are
  `basis: "estimate"`, goals `basis: "target"` (drawn hatched/dashed, labelled in the hand-off).
  Never present an estimate as measured, and never invent a measured number: if there's none, say
  so in the `note` and chart only what exists.
- **Data model changes → a `table`** (column/field, today, proposed) or a before/after `code` block
  (schema, JSON shape, prompt, config).
- **Multi-step behaviour → `steps`** (actor + action), e.g. what happens from tap to synced.
- **Performance → measured numbers**, before (and target), with how they were measured.

Keep blocks few and specific: one diagram that shows the real change beats three generic ones.
Pure visual candidates (a restyle) need no design section.

## 4. Check it, then hand it over

1. `node --check` the JS files, start `reports/<slug>/script/serve.sh` (in the background) and
   screenshot gallery, a detail page, compare and a 390px-wide gallery with the cached Playwright
   Chromium (`~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell
   --screenshot=… --window-size=1400,1100 <url>`). Look at every candidate in both modes: no
   overflow, no clipped text, no unstyled candidate, no console errors. Open every design section in
   both modes: diagrams readable, Today/Proposed toggles work, charts labelled.
2. Read the hand-off as a stranger would: rate one candidate, click **Copy summary** (or, headless,
   stub `navigator.clipboard.writeText` and click `#copy`) and check it names the project, the
   context files and the brief, and carries the design sections as text.
3. Tell the user the command and URL, the candidate list (number · name · tagline, one line each)
   and how to respond: ♥ / ★ per candidate, notes in the box under each candidate (on its gallery
   card, in Compare or on its page; all the same note), the "Overall direction" box only for what
   cuts across candidates, then
   **Copy summary** and paste it to any agent (this session or a new one).

## 5. Next rounds

The pasted hand-off says where everything is (repo, `reports/<slug>/`, `candidates.js` by `id`, the
project and the files to read), the brief, the decision so far, what to do next (another round, or
implement the winners), each touched candidate in full (concept, moves, facts, design as text) with
★, ♥, winner and the user's notes, the ones not reacted to, and the overall direction. If you're
picking it up in a new session, read the files it names before acting. Then:

- **Edit in place, same `key`**, so earlier ratings and notes survive. Bump `REVIEW.round`; give new
  candidates `round: <n>` (they get a "New" badge) and continue the numbering.
- Turn notes into new candidates rather than silently mutating rated ones: "03 but with 07's header"
  becomes a new candidate (`mine: true` when it's the user's combo, and put it first). Fix plain
  bugs the user points out in place.
- Drop candidates nobody reacted to only if the user says so (or moves them out of focus with a
  group); keep the baseline.
- When a winner is chosen, summarise the decision (winner, the notes that still apply, `Needs`)
  and move to implementing it in the real project, using the winning candidate's HTML/CSS as the
  spec and its design section as the technical spec. The review site is committed with the work as
  the record (`heji-archive-reports` moves it to `reports/archive/` once it's done).

## Variant: finished builds (heji-build-next)

The `heji-build-next` skill uses this engine twice, one group per project each time. First for
proposals (`proposals.example.js`: a "skip" entry plus N proposals per project; 🏆 + ♥ = build
these), then for the finished builds on local branches (`candidates.example.js`: a "keep main"
entry beside each build, `<img>` renders of real screenshots/GIFs in `site/media/`). Each site's
`nextSteps` turns its hand-off into the next phase's instructions.

## Variant: design walkthrough (no candidates)

For a technical proposal rather than a visual choice (`feedback-kit-monorepo-support`): a single
long page with a sticky table of contents and numbered sections — overview with "already works" /
"gaps" cards and a one-line proposal callout, an architecture diagram toggling **Today / Proposed**,
before/after views of the thing that changes (a prompt, a config), a stepper through a request's
journey, small interactive simulations (click a folder → what the CLI resolves; toggle commits →
what the release check says), the data-model diff as code, rollout and compatibility. Don't use
the template's engine for this; reuse `site.css` tokens and `serve.sh` from the template and write
the page by hand. `site/js/design.js` works here too (`DESIGN.block({...})` for diagrams and
charts). Ground every claim in file paths from the repo.
