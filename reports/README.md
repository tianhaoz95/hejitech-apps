# reports/

Review sites: small static sites, one folder each, where the owner reviews options before
something is built or merged (design candidates, build-round proposals and results, technical
walkthroughs). They're the record of what was proposed and decided, so they're committed.

```
reports/
  <date>-<slug>/          a review still waiting on the owner's picks
    site/                 the served root (index.html, js/candidates.js, media/)
    script/serve.sh       serves site/ on the report's own fixed port
  archive/<slug>/         finished reviews, still working exactly as before
```

## Rules

- **Make them with the skills.** `heji-candidate-review` scaffolds a review
  (`.claude/skills/heji-candidate-review/new.sh <slug> "<Title>"`) and `heji-build-next` uses it for
  build rounds. Each report keeps its own port for good: hearts, ratings and notes live in the
  browser per port, and `new.sh` never reuses one, archived reports included.
- **Archive when done.** Once the owner has decided, move it with `heji-archive-reports`
  (`.claude/skills/heji-archive-reports/reports.py archive <slug>`), never by hand: the script
  rewrites the report's paths and checks it still serves. Only reports awaiting a decision stay at
  the top level.
- **Self-contained.** No links out of the report's folder, no absolute local paths, no symlinks
  out; media go in `site/media/`.
- **The repo is public.** Before committing a report: no credentials or signed URLs, no personal
  data (real names, family details, emails other than `@example.com`; the owner's own screenshots
  can show them), no private hosts, no unreleased plans the owner hasn't agreed to publish, and no
  working details of a security problem that isn't fixed yet. Mock data uses invented names.
- **Only repo-wide reviews live here.** A project's own reports stay in `projects/<name>/reports/`,
  which app code and docs reference by path; these skills don't touch them.
