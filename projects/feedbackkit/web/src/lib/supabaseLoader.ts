import type { SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient> | undefined;

/**
 * The browser Supabase client (lib/supabase.ts), loaded on first use. supabase-js is most of the
 * entry script's weight, so code that runs on the landing page (the auth provider, analytics)
 * goes through this instead of importing it, and the landing page paints without waiting for it.
 * Dashboard code, already in lazily loaded chunks, imports lib/supabase directly.
 */
export function loadSupabase(): Promise<SupabaseClient> {
  return (client ??= import("@/lib/supabase").then((m) => m.supabase));
}
