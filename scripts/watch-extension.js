#!/usr/bin/env node
// Custom watcher for the Plasmo extension.
// @parcel/watcher@2.5.1 crashes on Node 24 (FSEventStreamStart returns false).
// chokidar@3.6.0 with usePolling works reliably on macOS arm64 + Node 24.

const chokidar = require("chokidar")
const { execSync, spawn } = require("child_process")
const path = require("path")

const EXT_DIR = path.join(__dirname, "..", "apps", "extension")
const LOG_FILE = path.join(__dirname, "..", ".extension.log")
const EXT_TAG = process.env.EXT_TAG || "dev"

let building = false
let pendingRebuild = false

function build() {
  if (building) {
    pendingRebuild = true
    return
  }
  building = true
  console.log("\n[watch-extension] Change detected — rebuilding...")
  const proc = spawn(
    "pnpm",
    ["plasmo", "build", "--target=chrome-mv3", `--tag=${EXT_TAG}`],
    { cwd: EXT_DIR, stdio: "inherit", shell: false }
  )
  proc.on("close", (code) => {
    building = false
    if (code === 0) {
      console.log("[watch-extension] Build complete — reload extension in chrome://extensions")
    } else {
      console.error(`[watch-extension] Build failed (exit ${code})`)
    }
    if (pendingRebuild) {
      pendingRebuild = false
      build()
    }
  })
}

const watcher = chokidar.watch(
  [
    path.join(EXT_DIR, "src"),
    path.join(EXT_DIR, "assets"),
    path.join(EXT_DIR, "package.json"),
  ],
  {
    usePolling: true,
    interval: 500,
    ignoreInitial: true,
    ignored: [/node_modules/, /\.plasmo/, /build/],
  }
)

watcher
  .on("ready", () => {
    console.log("[watch-extension] Watching extension source for changes (polling)...")
    console.log("[watch-extension] Reload extension in chrome://extensions after each rebuild.")
  })
  .on("change", (p) => {
    console.log(`[watch-extension] Changed: ${path.relative(EXT_DIR, p)}`)
    build()
  })
  .on("add", (p) => {
    console.log(`[watch-extension] Added: ${path.relative(EXT_DIR, p)}`)
    build()
  })
  .on("unlink", (p) => {
    console.log(`[watch-extension] Removed: ${path.relative(EXT_DIR, p)}`)
    build()
  })
  .on("error", (err) => console.error("[watch-extension] Watcher error:", err))

process.on("SIGINT", () => { watcher.close(); process.exit(0) })
process.on("SIGTERM", () => { watcher.close(); process.exit(0) })
