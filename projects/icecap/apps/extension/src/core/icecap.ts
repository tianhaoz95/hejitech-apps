// The extension's Icecap client. The session lives in chrome.storage.local, so the side panel, the
// options page and the popup share it. Sign-in is Google through Supabase (PKCE) inside
// chrome.identity.launchWebAuthFlow, which returns to https://<extension id>.chromiumapp.org/ (on the
// shared Supabase project's redirect allow-list).
import { createIcecap } from "@icecap/client"
import type { SupportedStorage } from "@supabase/supabase-js"

const chromeStorage: SupportedStorage = {
  getItem: async (key) => ((await chrome.storage.local.get(key))[key] as string | undefined) ?? null,
  setItem: (key, value) => chrome.storage.local.set({ [key]: value }),
  removeItem: (key) => chrome.storage.local.remove(key),
}

export const icecap = createIcecap({ storage: chromeStorage })

/** Development builds (vite --mode development) talk to the local stack and can use the test user. */
export const IS_DEV = import.meta.env.MODE === "development"

/** The web app: where saved deals, billing and the co-pilot live. */
export const HUB_URL = `${icecap.config.apiUrl}/app/`

export async function signInWithGoogle(): Promise<void> {
  const redirectTo = chrome.identity.getRedirectURL()
  const { data, error } = await icecap.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  })
  if (error || !data.url) throw error ?? new Error("Couldn't start Google sign-in")
  const back = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true })
  if (!back) throw new Error("Sign-in was cancelled")
  const url = new URL(back)
  const code = url.searchParams.get("code")
  if (!code) throw new Error(url.searchParams.get("error_description") ?? "Sign-in was cancelled")
  const { error: exchange } = await icecap.auth.exchangeCodeForSession(code)
  if (exchange) throw exchange
}

/** The seeded local test user (supabase/seeds/icecap.sql), development builds only. */
export async function signInAsTestUser(): Promise<void> {
  const { error } = await icecap.auth.signInWithPassword({ email: "pro@icecap.test", password: "icecap-dev-123" })
  if (error) throw error
}

export const signOut = () => icecap.auth.signOut()
