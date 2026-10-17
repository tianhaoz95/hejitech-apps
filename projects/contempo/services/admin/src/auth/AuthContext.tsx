import type { User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  user: User | null;
  /** null while unknown; from contempo.admins (RLS lets a user see only their own row). */
  isAdmin: boolean | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apply = async (next: User | null) => {
      setUser(next);
      if (!next) {
        setIsAdmin(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", next.id).maybeSingle();
      setIsAdmin(!error && !!data);
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => void apply(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run outside the auth callback (supabase-js holds a lock while it runs).
      setTimeout(() => void apply(session?.user ?? null), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    if (error) throw error;
  };

  const signOutUser = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, signInWithGoogle, signOutUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
