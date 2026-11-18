import { currentSession, signInView } from "./supabase.ts";

const root = document.getElementById("app")!;
const next = new URLSearchParams(location.search).get("next") ?? "/app/";
const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app/";

async function render() {
  if (await currentSession()) return location.replace(safeNext);
  root.replaceChildren(
    signInView({
      title: "Sign in to Folio",
      message: "Your artifacts, and every agent you connect, live under one account.",
      redirectTo: `${location.origin}/login/?next=${encodeURIComponent(safeNext)}`,
      onSignedIn: () => location.replace(safeNext),
    })
  );
}
void render();
