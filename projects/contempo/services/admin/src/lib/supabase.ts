import { createClient } from "@supabase/supabase-js";

// Same Supabase project and schema as the web app (projects/contempo/backend.env); served by the
// Contempo Worker at /admin/, so the session is shared with the web app on the same origin.
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "contempo" },
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

/** Calls the Contempo Worker's API as the signed-in user (admin routes check contempo.admins). */
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
