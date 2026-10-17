import { createClient } from "@supabase/supabase-js";

// Contempo's backend: the shared HEJI Supabase project, schema `contempo` (projects/contempo/
// backend.env). Build-time values come from .env.production (hosted) or .env.development (the local
// stack, `supabase start` at the repo root).
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "contempo" },
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

/** Calls the Contempo Worker's API (same origin) as the signed-in user. */
export async function api<T>(path: string, body: unknown = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `${path} failed (${res.status})`);
  return json as T;
}

/** Firestore-era Timestamp shape the pages still use (toDate/toMillis), built from a Postgres timestamptz. */
export interface Timestamp {
  toDate(): Date;
  toMillis(): number;
}
export function timestamp(iso: string): Timestamp {
  const ms = Date.parse(iso);
  return { toDate: () => new Date(ms), toMillis: () => ms };
}
