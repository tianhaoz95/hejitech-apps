// /login: Google sign-in through Supabase, then on to pairing (or wherever ?next= says).
import { currentSession, signInView } from "./supabase.ts";

const root = document.getElementById("app")!;
const next = new URLSearchParams(location.search).get("next") ?? "/today/";
const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/today/";

async function render() {
  if (await currentSession()) return location.replace(safeNext);
  root.replaceChildren(signInView({
    title: "Sign in to FitLoop",
    message: "Sign in to see your plan, check in, leave feedback for your agent and connect it. The glasses plugin pairs with a code afterwards; it never signs in itself.",
    redirectTo: `${location.origin}/login/?next=${encodeURIComponent(safeNext)}`,
    onSignedIn: () => location.replace(safeNext),
  }));
}
void render();
