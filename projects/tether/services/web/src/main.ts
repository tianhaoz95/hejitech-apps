import { currentSession, supabase } from "./supabase.ts";

async function header() {
  const s = await currentSession();
  document.querySelectorAll<HTMLElement>("[data-signed-in]").forEach((n) => (n.hidden = !s));
  document.querySelectorAll<HTMLElement>("[data-signed-out]").forEach((n) => (n.hidden = Boolean(s)));
  const who = document.querySelector<HTMLElement>("[data-who]");
  if (who) who.textContent = s?.user.email ?? "";
  document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.href = "/";
  });
  const here = location.pathname.split("/")[1];
  document.querySelectorAll<HTMLAnchorElement>(".site-header nav a").forEach((a) => {
    if (a.pathname.split("/")[1] === here) a.setAttribute("aria-current", "page");
  });
}
void header();
