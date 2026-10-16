// Runs on every page: fills in build-time values and wires copy buttons and tabs.
import { config, mcpURL } from "./config.ts";

for (const el of document.querySelectorAll<HTMLElement>("[data-mcp-url]")) el.textContent = mcpURL;
for (const el of document.querySelectorAll<HTMLElement>("[data-mcp-url-in]")) {
  el.textContent = el.textContent!.replaceAll("MCP_URL", mcpURL);
}
for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-support-email]")) {
  a.href = `mailto:${config.supportEmail}`;
  if (!a.textContent?.trim()) a.textContent = config.supportEmail;
}
for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-app-store]")) {
  if (config.appStoreURL) a.href = config.appStoreURL;
  else {
    a.removeAttribute("href");
    a.classList.add("disabled");
    a.setAttribute("aria-disabled", "true");
    a.textContent = "Coming soon to the App Store";
  }
}
for (const el of document.querySelectorAll("[data-year]")) el.textContent = String(new Date().getFullYear());
for (const a of document.querySelectorAll<HTMLAnchorElement>(".site-header nav a")) {
  if (a.getAttribute("href") === location.pathname) a.setAttribute("aria-current", "page");
}

/** `<button data-copy="#id">` copies that element's text; `data-copy-text` copies a literal. */
document.addEventListener("click", async (ev) => {
  const btn = (ev.target as Element).closest<HTMLButtonElement>("[data-copy], [data-copy-text]");
  if (!btn) return;
  const sel = btn.dataset.copy;
  const text = btn.dataset.copyText ?? (sel ? document.querySelector(sel)?.textContent : "") ?? "";
  try {
    await navigator.clipboard.writeText(text.trim());
    const label = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(() => (btn.textContent = label), 1400);
  } catch {
    /* clipboard blocked: the text stays selectable */
  }
});

/** `.tabs` buttons with `data-tab="id"` show the matching `[data-panel="id"]` in the same `[data-tabs]`. */
for (const group of document.querySelectorAll<HTMLElement>("[data-tabs]")) {
  const buttons = [...group.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const show = (id: string) => {
    for (const b of buttons) b.setAttribute("aria-selected", String(b.dataset.tab === id));
    for (const p of group.querySelectorAll<HTMLElement>("[data-panel]")) p.hidden = p.dataset.panel !== id;
  };
  for (const b of buttons) b.addEventListener("click", () => show(b.dataset.tab!));
  if (buttons[0]) show(buttons[0].dataset.tab!);
}
