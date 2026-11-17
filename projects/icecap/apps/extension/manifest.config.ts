// The extension's manifest (MV3), written to dist/manifest.json by scripts/build.mjs. One of the files
// backend.env lists: the CSP's connect-src names the backend (production or the local stack).

export const CONTENT_SCRIPTS = {
  redfin: "https://www.redfin.com/*",
  zillow: "https://www.zillow.com/*",
  realtor: "https://www.realtor.com/*",
} as const;

/** The production backend and the Worker; development builds add the local stack. */
const PRODUCTION = ["https://jitdzllkxfhlrxxvljhp.supabase.co", "wss://jitdzllkxfhlrxxvljhp.supabase.co", "https://icecap.hejitech.workers.dev"];
const LOCAL = ["http://127.0.0.1:55421", "ws://127.0.0.1:55421", "http://127.0.0.1:8800"];

export function manifest({ version, dev }: { version: string; dev: boolean }) {
  return {
    manifest_version: 3,
    name: dev ? "Icecap (dev)" : "Icecap — Real Estate Investment Analyzer",
    description: "Analyze real estate deals on your favorite sites",
    version,
    // Pins the extension id (gbjiibgccfkpodffchmnokflclbnbfpl, the Chrome Web Store listing's) for
    // unpacked and sideloaded builds too, so Google sign-in's redirect URL never changes.
    key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA04YTCSHdsQRiHr7hCNZ1M6EoFes2Qpl0xc2BtIKclzCeocA8wprcjbpYWgTl1AwCv6xuk4G9FMFyqrZwhzBV7URegBYVT5fb4b4zJ1HUDpCUV+c8UMiYDZPSIfWin+00k+Jq30IEiXjhNFhyv3WsUJpJJGUd4vqM1RECx00EqhQoFa00OoSLc/Lj2I5lR6cb+LoqZVfQtXuxgccid5cSRNaPah1HgTXNcsXNFZZPRVFo3GrpXPqaXXYhSSU5xESGTdT0RVqYzGMT8tYDX/mB+TL9IECj03seS0AepyDImrHUD585yn04ZzHEm73oys64XY9xacpW0UH1KuneSnoHNQIDAQAB",
    icons: { 16: "icon16.png", 32: "icon32.png", 48: "icon48.png", 128: "icon128.png" },
    action: { default_popup: "popup.html", default_icon: { 16: "icon16.png", 32: "icon32.png", 48: "icon48.png" } },
    side_panel: { default_path: "sidepanel.html" },
    options_ui: { page: "options.html", open_in_tab: true },
    background: { service_worker: "background.js", type: "module" },
    permissions: ["sidePanel", "tabs", "activeTab", "storage", "identity"],
    host_permissions: [...Object.values(CONTENT_SCRIPTS), ...(dev ? ["http://127.0.0.1/*", "http://localhost/*"] : [])],
    content_scripts: Object.entries(CONTENT_SCRIPTS).map(([site, match]) => ({ matches: [match], js: [`contents/${site}.js`], run_at: "document_idle" })),
    content_security_policy: {
      extension_pages: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; connect-src 'self' ${[...PRODUCTION, ...(dev ? LOCAL : [])].join(" ")}`,
    },
    // Origin trial for the Prompt API's multimodal input (tied to the extension id above).
    trial_tokens: [
      "A13LxbVEpSAm2rNiXS23jHQLQ0cb6dH/PGeeWWaPmLVL+LQm/CbcIit8f1GyYk1CKrCXda2JVtg08bl0R0ON2g0AAACPeyJvcmlnaW4iOiJjaHJvbWUtZXh0ZW5zaW9uOi8vZ2JqaWliZ2NjZmtwb2RmZmNobW5va2ZsY2xibmJmcGwiLCJmZWF0dXJlIjoiQUlQcm9tcHRBUElNdWx0aW1vZGFsSW5wdXQiLCJleHBpcnkiOjE3ODE1NjgwMDAsImlzVGhpcmRQYXJ0eSI6dHJ1ZX0=",
    ],
  };
}
