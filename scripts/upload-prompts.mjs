#!/usr/bin/env node
/**
 * Syncs firebase/prompts/*.prompt files into Remote Config and deploys.
 *
 * Each .prompt file becomes a Remote Config STRING parameter:
 *   deal-summary.prompt  →  prompt_deal_summary
 *   chat-assistant.prompt →  prompt_chat_assistant
 *
 * The extension reads these at runtime via getString(remoteConfig, key).
 * In dev/emulator mode it uses the local copies in src/core/aiTemplates.ts instead.
 *
 * NOTE: Firebase's getTemplateGenerativeModel() is not yet in the JS SDK.
 * When it ships, this script will also push to Firebase AI Logic so the
 * prompt stays server-side. For now Remote Config achieves the same goal
 * (update prompt without shipping a new extension version).
 *
 * Usage:
 *   node scripts/upload-prompts.mjs               # update RC file + deploy
 *   node scripts/upload-prompts.mjs --no-deploy   # update RC file only
 *   node scripts/upload-prompts.mjs --dry-run     # preview changes, no writes
 *   node scripts/upload-prompts.mjs -P <project>  # target a specific Firebase project
 */

import { readFileSync, readdirSync, writeFileSync } from "fs"
import { join, basename, dirname } from "path"
import { fileURLToPath } from "url"
import { execSync } from "child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const PROMPTS_DIR = join(ROOT, "firebase", "prompts")
const RC_PATH = join(ROOT, "firebase", "remoteconfig.json")

// ── arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun = args.includes("--dry-run")
const noDeploy = args.includes("--no-deploy")
const projectIdx = args.findIndex(a => a === "-P" || a === "--project")
const projectFlag = projectIdx !== -1 ? `-P ${args[projectIdx + 1]}` : ""

// ── helpers ──────────────────────────────────────────────────────────────────

function parsePromptFile(content, filename) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error(`${filename}: missing --- frontmatter block`)

  const frontmatter = match[1]
  const body = match[2].trimEnd()

  const id = frontmatter.match(/^id:\s*(.+)$/m)?.[1]?.trim()
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? ""

  return { id, description, body }
}

function rcKeyFromFilename(filename) {
  // deal-summary.prompt → prompt_deal_summary
  return "prompt_" + basename(filename, ".prompt").replace(/-/g, "_")
}

// ── main ─────────────────────────────────────────────────────────────────────

if (!readdirSync(PROMPTS_DIR).some(f => f.endsWith(".prompt"))) {
  console.error("No .prompt files found in", PROMPTS_DIR)
  process.exit(1)
}

const files = readdirSync(PROMPTS_DIR).filter(f => f.endsWith(".prompt")).sort()
console.log(`Found ${files.length} prompt file(s):\n`)

const templates = files.map(file => {
  const content = readFileSync(join(PROMPTS_DIR, file), "utf-8")
  const { id, description, body } = parsePromptFile(content, file)
  const rcKey = rcKeyFromFilename(file)
  console.log(`  ${file}`)
  console.log(`    Firebase AI Logic id : ${id ?? "(none)"}`)
  console.log(`    Remote Config key    : ${rcKey}`)
  console.log(`    Body length          : ${body.length} chars\n`)
  return { file, id, description, rcKey, body }
})

const rc = JSON.parse(readFileSync(RC_PATH, "utf-8"))

for (const { rcKey, description, body } of templates) {
  const isNew = !rc.parameters[rcKey]
  rc.parameters[rcKey] = {
    defaultValue: { value: body },
    description: description || `Prompt template — update via scripts/upload-prompts.mjs`,
    valueType: "STRING",
  }
  console.log(`  ${isNew ? "+" : "~"} parameters.${rcKey}`)
}

if (dryRun) {
  console.log("\n[dry-run] No files written. remoteconfig.json would become:\n")
  console.log(JSON.stringify(rc, null, 2))
  process.exit(0)
}

writeFileSync(RC_PATH, JSON.stringify(rc, null, 2) + "\n")
console.log(`\nWrote ${RC_PATH}`)

if (noDeploy) {
  console.log("Skipping deploy (--no-deploy). Run scripts/deploy-remote-config.sh to push.")
  process.exit(0)
}

if (!process.env.PATH?.includes("firebase") && !commandExists("firebase")) {
  console.warn("firebase CLI not found — skipping deploy. Run scripts/deploy-remote-config.sh manually.")
  process.exit(0)
}

function commandExists(cmd) {
  try { execSync(`which ${cmd}`, { stdio: "ignore" }); return true } catch { return false }
}

console.log("Deploying Remote Config…")
execSync(`firebase deploy --only remoteconfig ${projectFlag}`, { cwd: ROOT, stdio: "inherit" })
console.log("\nDone. Prompt templates are live in Remote Config.")
