// /pro/: FitLoop Pro on the web. Without Pro, the offer (every other page sends a browser here on a 402);
// with it, where it comes from and where to manage it. Stripe Checkout and its portal return here.
import { el, requireSession, spinner } from "./supabase.ts";
import { loadPro, paywall, planPanel, waitForPro } from "./pro.ts";

const root = document.getElementById("app")!;

async function render() {
  root.replaceChildren(spinner());
  if (!(await requireSession(root, render))) return;
  const back = new URLSearchParams(location.search).get("pro");
  const pro = back === "success" ? await waitForPro() : await loadPro();
  if (back) history.replaceState(null, "", location.pathname);
  if (!pro) {
    root.replaceChildren(el("p", { class: "error" }, "Couldn't check your account. Reload to try again."));
    return;
  }
  root.replaceChildren(pro.pro ? planPanel(pro) : paywall(pro));
}
render().catch((e) => root.replaceChildren(el("p", { class: "error" }, (e as Error).message)));
