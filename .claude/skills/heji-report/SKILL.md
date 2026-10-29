---
name: heji-report
description: The repo standard for writing any report in reports/ that isn't a pick-a-candidate review -- a status or release walkthrough, an investigation or postmortem, an audit, a research or comparison write-up, a technical design walkthrough, a how-to with a checklist. Scaffolds reports/<date>-<slug>/ (site/ + script/serve.sh on its own port) as one long page with numbered sections, a sticky table of contents, status cards, design diagrams and charts, checklists, light/dark, and a "Copy summary" hand-off that carries the whole report and the reader's notes to any agent. Use when asked to "write a report", "make a report in reports/", "write this up", "put together a walkthrough", "document what we found", "make a status page for the owner", or when another task ends in a report that isn't a set of candidates.
---

# Reports in `reports/`

Every report in `reports/` follows one format (`reports/README.md`): a dated folder
`reports/<YYYY-MM-DD>-<slug>/` holding `site/` (the served root) and `script/serve.sh` (serves it on
a port no other report has ever used), self-contained, safe to publish, and archived with
`heji-archive-reports` once the owner is done with it.

Pick the kind first:

- **The owner chooses between options** (designs, logos, features, build proposals) → not this
  skill: `heji-candidate-review` (and `heji-build-next` for build rounds).
- **Anything else** (where things stand, what we found, how something works, what to do and in
  what order) → this skill. The models are `reports/archive/2026-10-23-weehours-glasses-even-hub` (release
  walkthrough: status, diagram, steps with checklists, troubleshooting) and
  `reports/archive/feedback-kit-monorepo-support` (design walkthrough: today/gaps, proposal,
  architecture, rollout).

A project's own reports (ones its code or docs link to) stay in `projects/<name>/reports/`; this
skill is for the repo-root `reports/`.

## 1. Scaffold

```sh
.claude/skills/heji-report/new.sh <slug> "<Title>"   # → reports/<today>-<slug>/, picks a free port
```

Pass the slug without a date; `new.sh` adds today's. It copies `template/`, fills in the slug, title,
date, repo and port, and copies `js/design.js` + its styles (`css/design.css`) from
`heji-candidate-review`'s template, which stays the one real copy of the diagram engine.

| File | What goes in it |
|---|---|
| `site/index.html` | The report: the bar's subtitle, then one `<section id>` per part (replace the example wholesale) |
| `site/js/content.js` | `window.REPORT`: `project`, `context`, `brief`, optional `nextSteps`, and the design `blocks` |
| `site/media/` | Screenshots, GIFs, recordings the page shows (never hot-linked) |
| `site/css/site.css` | Shared look; add page-specific styles in a `<style>` in `index.html`, not here |

`site/js/report.js` is the engine (numbered `<h2>`s, TOC with scroll-spy, copy buttons on
`pre.cmd`, checklist ticks and notes saved per browser, design blocks, Copy summary). Don't fork it
per report; improve the template so the next report gets the fix.

## 2. Write it

Structure (adapt the headings, keep the order of ideas):

1. **Summary** (first section, `<h1>` + `.lede`): the answer first. What's true now, what changed,
   what the reader must decide or do. A `.status` grid for where each piece stands (`.ok`, `.todo`,
   `.bad`), `.cards` for verified vs not verified, a `.callout` for the one recommendation.
2. **The substance**: how it works / what we found / the evidence, one `<section>` per topic.
3. **What to do**: ordered steps (`ol.do`, `pre.cmd` for commands) and a `ul.checks` checklist when
   the reader will work through it.
4. **Edge cases**: troubleshooting table, risks, open questions (`.unknown` for what isn't known).

Rules that make these reports useful:

- **Ground every claim in the repo or a real run.** Name files (`projects/<name>/…`), commits,
  workflow runs, test names. Numbers are measured (say how and where) or explicitly an estimate
  or target; never invent a measured number. Say what wasn't verified.
- **Show, don't describe.** A diagram for anything structural (`flow` block with Today/Proposed),
  a `chart` for numbers, a `table` for comparisons or schema changes, `steps` for a journey; real
  screenshots in `media/` with alt text that says what they show (the alt goes into the hand-off).
  Block kinds and fields: the header comment of `site/js/design.js`. Hand-drawn SVG goes in
  `<figure class="diagram">` with an `aria-label`.
- **Plain, short sentences**, the reader's words, no filler. Headings say what the section answers.
- **Values the reader pastes somewhere else** (form fields, store listings, settings) go in
  `.fields > .field` (label in `<b>`, value in `<pre>`, `data-max` for a length limit): each gets a
  Copy button that copies the value exactly and a character count. Files to download (`media/`) get
  `<a class="dl" href="media/…" download>`.
- **Checklist ids are unique and stable** (`id="c-upload"`): ticks are saved by id.
- **Fill in `REPORT`** (`project`, `context`, `brief`): the hand-off leaves out anything still a
  placeholder. `nextSteps` is what an agent should do with the reader's notes.
- **Public repo** (`reports/README.md`): no credentials, signed URLs, private hosts, personal data,
  unreleased plans the owner hasn't agreed to publish, or details of an unfixed security problem.
  No links or paths out of the report's folder; everything it shows lives in `site/`.

## 3. Check it, then hand it over

1. `node --check reports/<slug>/site/js/*.js`, then start `reports/<slug>/script/serve.sh` in the
   background (`NO_OPEN=1`).
2. Screenshot it at desktop and phone width, light and dark, with the cached Playwright Chromium
   (`~/Library/Caches/ms-playwright/chromium_headless_shell-*/…/chrome-headless-shell
   --screenshot=… --window-size=1400,1100 <url>`, and `--window-size=390,900`). No overflow, no
   clipped text, diagrams readable, TOC numbered, no console errors.
3. Read the hand-off as a stranger: evaluate `REPORT_HANDOFF()` headlessly (or stub
   `navigator.clipboard.writeText` and click `#copy`) and check it names the report, project,
   context and brief and carries every section, table and design block as text.
4. Grep the folder for anything that mustn't be public, and for absolute paths
   (`grep -rn '/Users/\|/Volumes/' reports/<slug>`).
5. Stop the server. Tell the user the serve command and URL, a few lines on what the report says,
   and how to respond: tick the checklist, write in **Your notes**, click **Copy summary** and paste
   it to any agent.

Reports are committed with the work they belong to. When the owner is done with one, archive it:
`.claude/skills/heji-archive-reports/reports.py archive <slug>`.
