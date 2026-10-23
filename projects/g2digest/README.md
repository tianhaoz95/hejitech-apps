# G2 Digest

A daily brief compiled ahead of time into glanceable cards for Even G2 glasses + R1 ring, with
pre-made audio for the headphones (PRD v1.0, 2026-10-22). The hard work happens when an agent
builds the edition; on the train the plugin only plays it back.

```
packages/core      @g2digest/core: types, render (bundle → frames), validator, brief checks, gesture
                   state machine, card authoring guide (guide/*.md → src/guide.gen.ts), fixtures
packages/plugin    @g2digest/plugin: the glasses plugin + <G2Preview> + audio + spike (one codebase)
services/web       @g2digest/web: Worker (API, pairing, podcast feed, MCP + OAuth) and the web app
apps/glasses       @g2digest/glasses: the packed .ehpk (plugin pointed at the hosted app)
pipeline/          the build agent's prompt and how to schedule it
scripts/           test-api.mjs (integration), publish-bundle.mjs (reference pipeline run),
                   check-no-topics.mjs, sync-guide.mjs
supabase           ../../supabase/schemas/g2digest, migrations *_g2digest_*, seeds/g2digest.sql
```

Docs: [decisions](docs/decisions.md), [deployment](docs/DEPLOY.md), [pipeline](pipeline/README.md).
Working on it: [CLAUDE.md](CLAUDE.md).
