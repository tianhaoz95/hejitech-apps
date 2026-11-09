// Shared by the portal pages: DOM building, the Supabase session, the current workspace, API calls.
import { createClient, type Session } from "@supabase/supabase-js";
import { config } from "./config.ts";

export const supabase = createClient(config.supabaseURL, config.supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
  db: { schema: "hq" },
});

type Child = Node | string | number | false | null | undefined | Child[];
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined | null>;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === "function") n.addEventListener(k.replace(/^on/, ""), v as EventListener);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, String(v));
  }
  const add = (c: Child) => {
    if (c === false || c === null || c === undefined) return;
    if (Array.isArray(c)) c.forEach(add);
    else n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  children.forEach(add);
  return n;
}

export async function session(): Promise<Session | null> {
  return (await supabase.auth.getSession()).data.session;
}

export interface Workspace {
  id: string;
  name: string;
  repo: string;
  role: "admin" | "approver" | "viewer";
  paused: boolean;
  synced_at: string | null;
}

const WS_KEY = "hq.workspace";
export const currentWorkspaceId = () => localStorage.getItem(WS_KEY) ?? "";
export const setCurrentWorkspace = (id: string) => (id ? localStorage.setItem(WS_KEY, id) : localStorage.removeItem(WS_KEY));

export class ApiError extends Error {
  status: number;
  details: string[];
  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Calls the API with the person's session. Paths starting with "~/" are in the current workspace. */
export async function api<T = any>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const s = await session();
  const headers = new Headers(init.headers);
  if (s) headers.set("Authorization", `Bearer ${s.access_token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const url = path.startsWith("~/") ? `/api/w/${currentWorkspaceId()}/${path.slice(2)}` : path;
  const res = await fetch(url, { ...init, headers, body });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `HTTP ${res.status}`, (data as { details?: string[] })?.details ?? []);
  return data as T;
}

/** Fetches a workspace file (screenshot) with the session and returns an object URL for <img>. */
export async function fileUrl(key: string): Promise<string> {
  const s = await session();
  const res = await fetch(`/api/w/${currentWorkspaceId()}/files/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${s?.access_token ?? ""}` } });
  if (!res.ok) throw new Error(`file ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function toast(msg: string, bad = false) {
  const t = el("div", { class: `toast${bad ? " bad" : ""}`, role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

export const spinner = () => el("div", { class: "spinner", "aria-label": "Loading" });

const ICONS: Record<string, string> = {
  github: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z"/></svg>`,
  google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>`,
};

/** Sign-in: GitHub, Google, Apple; plus email for local accounts in development. */
export function signInView(opts: { title: string; message: string; redirectTo: string; onSignedIn: () => void }) {
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const fail = (m: string) => {
    error.textContent = m;
    error.hidden = false;
  };
  const provider = (id: "github" | "google" | "apple", label: string) => {
    const b = el("button", {
      class: "btn provider",
      type: "button",
      onclick: async () => {
        const { error: e } = await supabase.auth.signInWithOAuth({ provider: id, options: { redirectTo: opts.redirectTo } });
        if (e) fail(e.message);
      },
    });
    b.innerHTML = ICONS[id];
    b.append(label);
    return b;
  };
  const view = el("div", { class: "panel signin" },
    el("div", { class: "logo big" }, "HQ"),
    el("h1", {}, opts.title),
    el("p", { class: "muted" }, opts.message),
    el("div", { class: "stack" }, provider("github", "Continue with GitHub"), provider("google", "Continue with Google"), provider("apple", "Continue with Apple")),
    error);
  if (config.emailSignIn) {
    const email = el("input", { type: "email", placeholder: "Email", autocomplete: "username", "aria-label": "Email" });
    const password = el("input", { type: "password", placeholder: "Password", autocomplete: "current-password", "aria-label": "Password" });
    const go = (signUp: boolean) => async (e: Event) => {
      e.preventDefault();
      const creds = { email: email.value.trim(), password: password.value };
      const { error: err } = signUp ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
      if (err) return fail(err.message);
      opts.onSignedIn();
    };
    view.append(el("form", { class: "stack dev", onsubmit: go(false) },
      el("p", { class: "small muted" }, "Local development: email accounts on this machine's Supabase."),
      email, password,
      el("div", { class: "actions" }, el("button", { class: "btn primary", type: "submit" }, "Sign in"), el("button", { class: "btn", type: "button", onclick: go(true) }, "Create local account"))));
  }
  return view;
}
