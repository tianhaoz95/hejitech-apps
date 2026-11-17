// The web pages' one Icecap client: same-origin API (the Worker serves both), the session in
// localStorage, picked up from the URL after Google sign-in (PKCE).
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { ProStatus, SavedProperty } from "@icecap/types";
import { createIcecap } from "@icecap/client";

export const icecap = createIcecap({ apiUrl: "", detectSessionInUrl: true });

/** Google sign-in; comes back to `next` (a path on this site) signed in. */
export function signInWithGoogle(next = location.pathname + location.search) {
  return icecap.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: new URL(next, location.origin).toString(), queryParams: { prompt: "select_account" } },
  });
}

export const signOut = () => icecap.auth.signOut();

/** The signed-in user: undefined while loading, null when signed out. */
export function useUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    icecap.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = icecap.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return user;
}

/** The user plus their Pro status from the Worker (GET /api/pro). */
export function useAuth() {
  const user = useUser();
  const [pro, setPro] = useState<ProStatus | null>(null);
  const [loadingPro, setLoadingPro] = useState(false);
  const refresh = useCallback(async () => {
    setLoadingPro(true);
    try {
      setPro(await icecap.pro.status());
    } catch (e) {
      console.error("[Icecap] Pro status failed", e);
      setPro(null);
    } finally {
      setLoadingPro(false);
    }
  }, []);
  useEffect(() => {
    if (user) refresh();
    else setPro(null);
  }, [user, refresh]);
  return { user, pro, isPro: !!pro?.pro, loadingAuth: user === undefined || (!!user && loadingPro && !pro), refreshPro: refresh };
}

/** The user's saved deals, live (Realtime): null until the first load. */
export function useProperties(user: User | null | undefined) {
  const [list, setList] = useState<SavedProperty[] | null>(null);
  useEffect(() => {
    if (!user) return;
    return icecap.properties.watch(setList, (e) => console.error("[Icecap] deals failed", e));
  }, [user]);
  return list;
}
