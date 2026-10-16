# Temporary deploy shim

The Waypack Worker moved to `projects/waypack/services/mcp`. Cloudflare Workers Builds (dashboard →
Workers → `waypack` → Settings → Build) still runs the old commands, so this folder forwards them:

- Deploy command: `cd services/mcp && npm run deploy -- --env production`
- Non-production branch deploy command: `cd services/mcp && npm run upload-version -- --env production`

Once both say `cd projects/waypack/services/mcp && …` instead, delete this folder (and the root
`services/` directory).
