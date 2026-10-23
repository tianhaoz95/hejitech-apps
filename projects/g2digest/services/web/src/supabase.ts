import { createClient, type Session } from "@supabase/supabase-js";
import { config } from "./config.ts";

export const supabase = createClient(config.supabaseURL, config.supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
  // G2 Digest's tables live in their own schema of the shared Supabase project.
  db: { schema: "g2digest" },
});

type Child = Node | string | null | undefined | false;

/** Builds an element; strings become text nodes, so user data is never parsed as HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((ev: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") node.addEventListener(k.replace(/^on/, ""), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false) node.setAttribute(k, v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Calls this site's API with the user's session. */
export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: T }> {
  const session = await currentSession();
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, body };
}

const googleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;

/** Sign-in: Google through Supabase (in the system browser, never the plugin WebView, PRD §4.2). */
export function signInView(opts: { title: string; message: string; redirectTo: string; onSignedIn: () => void }) {
  const error = el("p", { class: "error", role: "alert", hidden: true });
  const fail = (msg: string) => {
    error.textContent = msg;
    error.hidden = false;
  };
  const google = el("button", {
    class: "btn secondary", type: "button",
    onclick: async () => {
      const { error: e } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: opts.redirectTo } });
      if (e) fail(e.message);
    },
  });
  google.innerHTML = googleIcon; // static markup above, no user data
  google.append("Continue with Google");

  const view = el("div", { class: "panel signin" },
    el("h1", {}, opts.title),
    el("p", { class: "muted" }, opts.message),
    el("div", { style: "display: grid; gap: 10px; margin-top: 18px" }, google));

  if (config.emailSignIn) {
    const email = el("input", { type: "email", name: "email", placeholder: "Email", autocomplete: "username", required: true, value: "reader@example.com" });
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
  view.append(error);
  return view;
}

export function spinner() {
  return el("div", { class: "spinner", role: "status", "aria-label": "Loading" });
}

/** The page's session, or a sign-in panel in `root` (returns null). */
export async function requireSession(root: HTMLElement, onSignedIn: () => void): Promise<Session | null> {
  const s = await currentSession();
  if (s) return s;
  root.replaceChildren(signInView({
    title: "Sign in",
    message: "Sign in with Google to edit your brief, pair your glasses and read your editions.",
    redirectTo: location.href,
    onSignedIn,
  }));
  return null;
}
