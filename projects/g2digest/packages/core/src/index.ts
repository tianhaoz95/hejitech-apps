// @g2digest/core: the contracts (types), the card renderer, the validator, the brief checks and
// the gesture state machine, shared as TypeScript source by the Worker (MCP), the web app, the
// glasses plugin and the tests. One render function for all of them (PRD §6).
export * from "./types.ts";
export * from "./render.ts";
export * from "./validate.ts";
export * from "./brief.ts";
export * from "./player.ts";
export { GUIDE, GUIDE_VERSION } from "./guide.gen.ts";
export * from "./episodes.ts";
export * from "./tour.ts";
