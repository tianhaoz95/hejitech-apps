// Bundles the executor into one file (cli.ts keeps its #! line), dist/tradeboard-executor.mjs (Node ≥ 22.18, no install step),
// the artifact the tradeboard-v<version> release attaches.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
await build({
  entryPoints: [new URL("../src/cli.ts", import.meta.url).pathname],
  outfile: new URL("../dist/tradeboard-executor.mjs", import.meta.url).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  legalComments: "inline",
  define: { "process.env.TRADEBOARD_EXECUTOR_VERSION": JSON.stringify(version) },
  banner: { js: `// tradeboard-executor ${version} (bundled)\nimport { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);` },
});
console.log(`dist/tradeboard-executor.mjs ${version}`);
