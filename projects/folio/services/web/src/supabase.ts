// Supabase session (sign-in through the shared HEJI project), a tiny DOM helper and the API client.
import { createClient, type Session } from "@supabase/supabase-js";
import { config } from "./config.ts";

export const supabase = createClient(config.supabaseURL, config.supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
  db: { schema: "folio" },
});

type Child = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | undefined | ((ev: Event) => void)> = {},
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") node.addEventListener(k.replace(/^on/, ""), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v !== undefined) node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(typeof c === "number" ? String(c) : c);
  return node;
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown>
  ) {
    super(message);
  }
}

/** Calls the site's API with the session, throwing ApiError with the server's message. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const session = await currentSession();
  const res = await fetch(path, {
    ...init,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, String(body.error ?? `Request failed (${res.status})`), body);
  return body as T;
}

/** Downloads a file from the API with the session (used for .zip export). */
export async function download(path: string, fallbackName: string): Promise<void> {
  const session = await currentSession();
  const res = await fetch(path, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = el("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const appleIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>`;
const googleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;

function iconButton(svg: string, label: string, onclick: () => void) {
  const b = el("button", { class: "btn secondary wide", type: "button", onclick });
  b.innerHTML = svg; // static markup above, no user data
  b.append(label);
  return b;
}

/** Sign-in options. OAuth returns to `redirectTo`; email sign-in (local dev only) calls `onSignedIn`. */
export function signInView(opts: { title: string; message: string; redirectTo: string; onSignedIn: () => void }) {
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const fail = (msg: string) => {
    error.textContent = msg;
    error.hidden = false;
  };
  const oauth = (provider: "apple" | "google") => async () => {
    const { error: e } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: opts.redirectTo } });
    if (e) fail(e.message);
  };
  const view = el(
    "div",
    { class: "panel signin" },
    el("h1", {}, opts.title),
    el("p", { class: "muted" }, opts.message),
    el("div", { class: "stack", style: "margin-top: 20px" }, iconButton(appleIcon, "Continue with Apple", oauth("apple")), iconButton(googleIcon, "Continue with Google", oauth("google")))
  );
  if (config.emailSignIn) {
    const email = el("input", { type: "email", name: "email", placeholder: "Email", autocomplete: "username", required: true, value: "folio-dev@example.com" });
    const password = el("input", { type: "password", name: "password", placeholder: "Password", autocomplete: "current-password", required: true });
    const form = el("form", { class: "stack" }, email, password, el("button", { class: "btn primary", type: "submit" }, "Sign in"));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
      if (e) fail(e.message);
      else opts.onSignedIn();
    });
    view.append(el("div", { class: "divider" }, "or with email (local development)"), form);
  }
  view.append(error, el("p", { class: "muted small", style: "margin: 18px 0 0" }, "One HEJI account works across every HEJI app."));
  return view;
}

export function spinner() {
  return el("div", { class: "spinner", role: "status", "aria-label": "Loading" });
}

/** A stable color for an agent's name, so the same agent looks the same everywhere. */
export function agentHue(name: string): number {
  const n = name.toLowerCase();
  if (n === "web") return 210;
  if (/claude/.test(n)) return 22;
  if (/gemini|google|antigravity/.test(n)) return 222;
  if (/chatgpt|openai|codex|gpt/.test(n)) return 160;
  if (/cursor/.test(n)) return 270;
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function agentBadge(name: string, model?: string | null) {
  const span = el("span", { class: "agent", style: `--h: ${agentHue(name)}`, title: model ? `${name} · ${model}` : name }, el("span", { class: "dot", "aria-hidden": "true" }), name === "Web" ? "You (web)" : name);
  return span;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export function toast(message: string, kind: "ok" | "error" = "ok") {
  let host = document.getElementById("toasts");
  if (!host) {
    host = el("div", { id: "toasts", "aria-live": "polite" });
    document.body.append(host);
  }
  const t = el("div", { class: `toast ${kind}` }, message);
  host.append(t);
  setTimeout(() => t.classList.add("out"), 3600);
  setTimeout(() => t.remove(), 4200);
}

export async function copyText(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    window.prompt("Copy this:", text);
  }
}
