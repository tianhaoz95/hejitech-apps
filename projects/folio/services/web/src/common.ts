export * from "./supabase.ts";
import type { Session } from "@supabase/supabase-js";
import { currentSession, signInView } from "./supabase.ts";

/** Returns the session, or shows the sign-in view in `root` and returns null. */
export async function requireSession(root: HTMLElement, onSignedIn: () => void, message = "Sign in to see your artifacts and connect your agents."): Promise<Session | null> {
  const s = await currentSession();
  if (s) return s;
  const wrap = document.createElement("div");
  wrap.className = "wrap narrow";
  wrap.append(signInView({ title: "Sign in to Folio", message, redirectTo: location.href, onSignedIn }));
  root.replaceChildren(wrap);
  return null;
}
