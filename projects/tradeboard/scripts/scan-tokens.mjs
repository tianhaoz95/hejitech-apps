#!/usr/bin/env node
// PRD §12.1 test 16 / §14.6 for the repo: no token-shaped strings in the project's files. Real
// tokens are a prefix plus 43 random characters; the fake local ones (tba_dev_claude, tbx_dev_local)
// are short and don't match. Run by CI.
import { execFileSync } from "node:child_process";

const pattern = "tb[ax]_[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\"refresh_token\"\\s*:\\s*\"[^\"]{8,}";
let out = "";
try {
  out = execFileSync("git", ["grep", "--untracked", "-nE", pattern, "--", "projects/tradeboard", "supabase/schemas/tradeboard", "supabase/seeds/tradeboard.sql", ":!projects/tradeboard/scripts/scan-tokens.mjs", ":!**/node_modules/**", ":!**/dist/**"], { encoding: "utf8" });
} catch (e) {
  if (e.status !== 1) throw e; // 1 = no match
}
if (out.trim()) {
  console.error(`token-shaped strings in the repo:\n${out}`);
  process.exit(1);
}
console.log("no secrets in projects/tradeboard");
