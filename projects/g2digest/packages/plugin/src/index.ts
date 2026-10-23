// @g2digest/plugin: the glasses plugin and the browser G2 preview, one codebase (PRD §2, §6).
export { bootPlugin, BRIDGE_TIMEOUT_MS, type PluginOptions } from "./plugin.ts";
export { bootSpike } from "./spike.ts";
export { mountPreview, previewStatus, FIDELITY_NOTE, type PreviewHandle } from "./preview.ts";
export { Reader, type AudioMode, type AudioOut } from "./reader.ts";
export { AudioCache, HtmlAudio } from "./audio.ts";
