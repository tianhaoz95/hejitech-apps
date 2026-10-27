# Polymath Deployment Guide

## 1. Cloudflare Worker (Web & MCP)
- Worker: `projects/polymath/services/web`
- Production URL: `https://polymath.hejitech.workers.dev`
- Deploy command: `npm run deploy -w @polymath/web`
- Shared Supabase backend:
  - URL: `https://jitdzllkxfhlrxxvljhp.supabase.co`
  - Key: `sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8`
  - Schema: `polymath`

## 2. Desktop Tauri App (macOS)
- Project directory: `projects/polymath/apps/desktop`
- Run local dev: `npm run dev -w @polymath/desktop`
- Build release: `npm run build -w @polymath/desktop`
- Signed & notarized release via `scripts/cut_release.sh polymath`
