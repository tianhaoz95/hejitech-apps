import { createClient, type Session } from "@supabase/supabase-js";
import { config } from "./config.ts";

export const supabase = createClient(config.supabaseURL, config.supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
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

const appleIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>`;
const googleIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;

function iconButton(svg: string, label: string, onclick: () => void) {
  const b = el("button", { class: "btn secondary", type: "button", onclick });
  b.innerHTML = svg; // static markup above, no user data
  b.append(label);
  return b;
}

/** Sign-in options. OAuth returns to `redirectTo`; email sign-in (dev accounts) calls `onSignedIn`. */
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
    el("h1", { style: "font-size: 28px" }, opts.title),
    el("p", { class: "muted" }, opts.message),
    el("div", { style: "display: grid; gap: 10px; margin-top: 20px" },
      iconButton(appleIcon, "Continue with Apple", oauth("apple")),
      iconButton(googleIcon, "Continue with Google", oauth("google")),
    ),
  );

  if (config.emailSignIn) {
    const email = el("input", { type: "email", name: "email", placeholder: "Email", autocomplete: "username", required: true });
    const password = el("input", { type: "password", name: "password", placeholder: "Password", autocomplete: "current-password", required: true });
    const form = el("form", {}, email, password, el("button", { class: "btn primary", type: "submit" }, "Sign in"));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
      if (e) fail(e.message);
      else opts.onSignedIn();
    });
    view.append(el("div", { class: "divider" }, "or with email"), form);
  }
  view.append(error, el("p", { class: "muted small", style: "margin: 18px 0 0" }, "Use the same account as in the iPhone app."));
  return view;
}

export function spinner() {
  return el("div", { class: "spinner", role: "status", "aria-label": "Loading" });
}
