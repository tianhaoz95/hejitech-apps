import { currentSession, signInView } from "./supabase.ts";

const root = document.getElementById("app")!;
const next = new URLSearchParams(location.search).get("next") ?? "/settings/";
let safeNext = "/settings/";
if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
  try {
    const parsed = new URL(next, location.origin);
    if (parsed.origin === location.origin) safeNext = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    safeNext = "/settings/";
  }
}

async function render() {
  if (await currentSession()) return location.replace(safeNext);
  root.replaceChildren(
    signInView({
      title: "Sign in to Tether",
      message:
        "Sign in to sync your non-secret SSH host metadata, tiling layout presets, and bookmarks across your devices and MCP assistant. Passwords and private keys remain strictly in device Keychain/Keystore.",
      redirectTo: `${location.origin}/login/?next=${encodeURIComponent(safeNext)}`,
      onSignedIn: () => location.replace(safeNext),
    })
  );
}
void render();
