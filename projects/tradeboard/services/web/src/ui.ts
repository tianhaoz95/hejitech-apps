// Shared portal helpers: DOM building (text only, never HTML from data), the owner's API (cookie +
// same-origin header), status badges, PT/ET times, toasts and confirm dialogs.
import { ptEt, STATUS_LABEL, type Status } from "@tradeboard/core";

type Child = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | number | ((ev: Event) => void) | undefined> = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === "function") node.addEventListener(k.replace(/^on/, ""), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(typeof c === "number" ? String(c) : c);
  return node;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  body: T & { error_code?: string; message?: string };
}

/** The owner's API: the session cookie rides along; a 401 sends the page to sign-in. */
export async function api<T = Record<string, unknown>>(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Tradeboard": "1" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.json().catch(() => ({}))) as T & { error_code?: string; message?: string };
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  return { ok: res.ok, status: res.status, body };
}

export function badge(status: Status | string): HTMLElement {
  const label = STATUS_LABEL[status as Status] ?? status;
  return el("span", { class: `badge s-${status}` }, label);
}

export function modeBadge(mode: string): HTMLElement {
  const label = mode === "dry_run" ? "Dry-run" : mode === "live" ? "LIVE" : mode === "manual" ? "Manual" : mode;
  return el("span", { class: `badge mode-${mode}` }, label);
}

/** Both clocks, always with zones: "Oct 29, 2026, 1:00 PM PDT · 4:00 PM EDT". */
export function when(iso: string | null | undefined): HTMLElement {
  if (!iso) return el("span", { class: "muted" }, "—");
  return el("time", { datetime: iso, title: iso }, ptEt(iso));
}

export function who(type: string, id: string): string {
  if (type === "human") return "You";
  if (type === "executor") return `Executor ${id}`;
  if (type === "system") return "Board";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

let toastTimer = 0;
export function toast(message: string, bad = false) {
  document.querySelector(".toast")?.remove();
  const t = el("div", { class: `toast${bad ? " bad" : ""}`, role: "status", "aria-live": "polite" }, message);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 4500);
}

/** "message (code)" for an API failure. */
export const failure = (r: ApiResult<unknown>) => `${r.body.message ?? "Something went wrong"}${r.body.error_code ? ` (${r.body.error_code})` : ""}`;

/**
 * A confirm dialog: one tap to open (the button), one to confirm (§8.2: two taps at most).
 * `extra` can hold form fields; the promise resolves with the dialog's form or null.
 */
export function confirmDialog(opts: { title: string; body: (Node | string)[]; confirm: string; danger?: boolean; extra?: HTMLElement }): Promise<HTMLFormElement | null> {
  return new Promise((resolve) => {
    const form = el("form", { method: "dialog", class: "stack" },
      el("h2", {}, opts.title),
      ...opts.body.map((b) => (typeof b === "string" ? el("p", {}, b) : b)),
      opts.extra ?? null,
      el("div", { class: "row", style: "justify-content: flex-end" },
        el("button", { class: "btn", value: "cancel", type: "submit", formnovalidate: true }, "Cancel"),
        el("button", { class: `btn ${opts.danger ? "danger solid" : "primary"}`, value: "ok", type: "submit" }, opts.confirm)));
    const dlg = el("dialog", {}, form);
    document.body.append(dlg);
    dlg.addEventListener("close", () => {
      resolve(dlg.returnValue === "ok" ? form : null);
      dlg.remove();
    });
    dlg.showModal();
  });
}

export function spinner() {
  return el("div", { class: "spinner", role: "status", "aria-label": "Loading" });
}

export function copyButton(label: string, text: () => string): HTMLButtonElement {
  return el("button", {
    class: "btn small", type: "button",
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(text());
        toast("Copied");
      } catch {
        toast("Couldn't copy: select the text instead", true);
      }
    },
  }, label);
}

/** Every page: sign-out, the current nav item, and a PT/ET clock in the footer. */
export function chrome() {
  document.querySelector("[data-sign-out]")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { body: {} });
    location.href = "/login/";
  });
  const here = location.pathname.split("/")[1];
  document.querySelectorAll<HTMLAnchorElement>(".site-header nav a").forEach((a) => {
    const target = a.pathname.split("/")[1];
    if (target === here || (here === "plans" && target === "")) a.setAttribute("aria-current", "page");
  });
  const clock = document.querySelector<HTMLElement>("[data-clock]");
  const tick = () => clock && (clock.textContent = `Now ${ptEt(new Date())}`);
  tick();
  setInterval(tick, 30_000);
}

/** Calls `fn` now and every `ms` while the tab is visible (§8.2: an open plan refreshes within 10 s). */
export function every(ms: number, fn: () => Promise<void> | void) {
  void fn();
  setInterval(() => {
    if (document.visibilityState === "visible") void fn();
  }, ms);
}
