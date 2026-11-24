// Build-time data for the live status page (live.md): the surfaces the probe checks, from
// scripts/status/targets.json. The measurements themselves are read in the browser from the
// `status-data` issue that live-status.yml keeps up to date (LiveStatus.vue).
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface LiveTarget {
  id: string;
  project: string;
  name: string;
  surface: string;
  url: string;
  via: string;
  worker?: string;
  expect?: "ok" | "reachable";
}

export interface LiveConfig {
  limit: number;
  targets: LiveTarget[];
}

// A plain object (not `defineLoader`): VitePress loads this file as CommonJS, and vitepress is ESM.
export default {
  watch: ["../scripts/status/targets.json"],
  load(): LiveConfig {
    const { limit, targets } = JSON.parse(readFileSync(join(process.cwd(), "scripts", "status", "targets.json"), "utf8"));
    return { limit, targets };
  },
};

export declare const data: LiveConfig;
