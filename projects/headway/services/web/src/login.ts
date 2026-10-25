// /login: Google sign-in through Supabase, then on to pairing (or wherever ?next= says).
import { currentSession, signInView } from "./supabase.ts";

const root = document.getElementById("app")!;
const next = new URLSearchParams(location.search).get("next") ?? "/settings/";
const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/settings/";

async function render() {
  if (await currentSession()) return location.replace(safeNext);
  root.replaceChildren(signInView({
    title: "Sign in to Headway",
    message: "Sign in to save your morning and evening stations, pair your glasses and connect an assistant. The glasses plugin pairs with a code afterwards; it never signs in itself.",
    redirectTo: `${location.origin}/login/?next=${encodeURIComponent(safeNext)}`,
    onSignedIn: () => location.replace(safeNext),
  }));
}
void render();
