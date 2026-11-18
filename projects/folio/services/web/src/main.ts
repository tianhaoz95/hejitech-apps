// Runs on every page: header state (signed in or not) and sign-out.
import { currentSession, supabase } from "./supabase.ts";

async function header() {
  const s = await currentSession();
  for (const n of document.querySelectorAll<HTMLElement>("[data-signed-in]")) n.hidden = !s;
  for (const n of document.querySelectorAll<HTMLElement>("[data-signed-out]")) n.hidden = !!s;
  for (const n of document.querySelectorAll<HTMLElement>("[data-who]")) n.textContent = s?.user.email ? `Signed in as ${s.user.email}.` : "";
}

document.addEventListener("click", async (ev) => {
  const t = (ev.target as HTMLElement).closest("[data-sign-out]");
  if (!t) return;
  await supabase.auth.signOut();
  location.href = "/";
});

supabase.auth.onAuthStateChange(() => void header());
void header();
