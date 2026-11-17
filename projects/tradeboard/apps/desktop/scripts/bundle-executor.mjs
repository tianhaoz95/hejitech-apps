// Puts the executor the app installs into src-tauri/resources/: the same single-file bundle and
// install.sh the tradeboard-v<version> release attaches, built from this checkout.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";

const here = (p) => new URL(p, import.meta.url).pathname;
execFileSync(process.execPath, [here("../../executor/scripts/build.mjs")], { stdio: "inherit" });
mkdirSync(here("../src-tauri/resources"), { recursive: true });
copyFileSync(here("../../executor/dist/tradeboard-executor.mjs"), here("../src-tauri/resources/tradeboard-executor.mjs"));
copyFileSync(here("../../executor/deploy/install.sh"), here("../src-tauri/resources/install.sh"));
console.log("src-tauri/resources: tradeboard-executor.mjs, install.sh");
