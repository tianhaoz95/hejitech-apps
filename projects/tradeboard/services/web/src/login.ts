// /login: Google or Apple through Supabase proves the account, then a TOTP code (enrolled on the first
// visit) proves the second factor. The Worker sets an HttpOnly session cookie and this page drops the
// Supabase session, so no token stays readable by scripts (§11.10).
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode-svg";
import { config } from "./config.ts";
import { api, el, failure, spinner } from "./ui.ts";

const supabase = createClient(config.supabaseURL, config.supabaseAnonKey, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, storageKey: "tradeboard-signin" },
});

const root = document.getElementById("app")!;
const nextRaw = new URLSearchParams(location.search).get("next") ?? "/";
const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") && !nextRaw.startsWith("/login") ? nextRaw : "/";

const panel = (...nodes: (Node | string | null | false)[]) => root.replaceChildren(el("div", { class: "panel signin stack" }, ...nodes));
const errorLine = () => el("p", { class: "error", role: "alert", hidden: true });
const showError = (p: HTMLElement, msg: string) => { p.textContent = msg; p.hidden = false; };

function providers() {
  const err = errorLine();
  const go = (provider: "google" | "apple") => async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/login/?next=${encodeURIComponent(next)}` } });
    if (error) showError(err, error.message);
  };
  const nodes: (Node | false)[] = [
    el("h1", {}, "Sign in or sign up"),
    el("p", { class: "muted" }, "Your own private board for trade plans your AI agents debate and only you approve. Continue with Google or Apple; the first time, you'll also set up an authenticator app (approvals can place real orders, so the board asks for a second factor)."),
    el("button", { class: "btn", type: "button", onclick: go("google") }, "Continue with Google"),
    el("button", { class: "btn", type: "button", onclick: go("apple") }, "Continue with Apple"),
  ];
  if (config.emailSignIn) {
    const email = el("input", { type: "email", name: "email", value: "owner@example.com", autocomplete: "username", required: true });
    const password = el("input", { type: "password", name: "password", placeholder: "Password", autocomplete: "current-password", required: true });
    const form = el("form", { class: "stack" }, email, password, el("button", { class: "btn primary", type: "submit" }, "Sign in"));
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
      if (error) showError(err, error.message);
      else void secondFactor();
    });
    nodes.push(el("div", { class: "divider" }, "or with email (local development)"), form);
  }
  nodes.push(el("p", { class: "small muted" }, "By continuing you agree to the ", el("a", { href: "/terms/" }, "Terms"), " and the ", el("a", { href: "/privacy/" }, "Privacy Policy"), ". Not financial advice."));
  panel(...nodes, err);
}

async function secondFactor() {
  root.replaceChildren(spinner());
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return providers();
  const begin = await api<{ enroll: boolean; secret?: string; otpauth?: string }>("/api/auth/begin", { body: { access_token: token } });
  if (!begin.ok) {
    await supabase.auth.signOut({ scope: "local" });
    const err = errorLine();
    panel(el("h1", {}, "Can't sign in"), err, el("button", { class: "btn", type: "button", onclick: () => providers() }, "Use a different account"));
    return showError(err, failure(begin));
  }
  const err = errorLine();
  const code = el("input", { inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]{6}", maxlength: 6, required: true, placeholder: "123456", "aria-label": "6-digit code" });
  const form = el("form", { class: "stack" }, code, el("button", { class: "btn primary", type: "submit" }, begin.body.enroll ? "Finish setup" : "Sign in"));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fresh = (await supabase.auth.getSession()).data.session?.access_token ?? token;
    const r = await api("/api/auth/verify", { body: { access_token: fresh, code: code.value } });
    if (!r.ok) return showError(err, failure(r));
    // The cookie is set; nothing else of the sign-in stays in the browser.
    await supabase.auth.signOut({ scope: "local" });
    location.replace(next);
  });
  if (begin.body.enroll) {
    const qr = el("div", { class: "qr", role: "img", "aria-label": "QR code for your authenticator app" });
    qr.innerHTML = new QRCode({ content: begin.body.otpauth!, padding: 1, width: 220, height: 220, ecl: "M", join: true, container: "svg-viewbox" }).svg(); // generated SVG, no user data
    panel(
      el("h1", {}, "Set up your authenticator"),
      el("p", { class: "muted" }, "Scan this with an authenticator app (1Password, Google Authenticator, iOS Passwords…), or on this phone tap “Open in authenticator”. Then enter the 6-digit code it shows."),
      qr,
      el("a", { class: "btn small", href: begin.body.otpauth! }, "Open in authenticator"),
      el("p", { class: "small" }, "Or type this key: ", el("code", {}, begin.body.secret!.replace(/(.{4})/g, "$1 ").trim())),
      el("p", { class: "small warn" }, "This key is shown once. Without the authenticator you can't sign in (recovery is in the deploy guide)."),
      form, err);
  } else {
    panel(el("h1", {}, "Enter your code"), el("p", { class: "muted" }, "The 6-digit code from your authenticator app."), form, err);
  }
  code.focus();
}

async function start() {
  const me = await fetch("/api/me", { credentials: "same-origin" });
  if (me.ok) return location.replace(next);
  const { data } = await supabase.auth.getSession();
  if (data.session) return secondFactor();
  providers();
}
void start();
