// Icecap's client: the Supabase session (Google sign-in, shared with every HEJI app), saved deals and
// settings straight from the `icecap` schema (RLS: each user's own rows), and Pro, billing and the
// waitlist from the Worker's API. Used by the Chrome extension and every page of the web app.
import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";
import type { PropertyAssumptions, ProStatus, SavedProperty, UserSettings } from "@icecap/types";
import { defaultConfig, SCHEMA, type IcecapConfig } from "./config.ts";

export { defaultConfig, LOCAL, PRODUCTION, SCHEMA, type IcecapConfig } from "./config.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;

/** What a saved deal holds besides its id, owner and timestamps. */
export type DealData = Omit<SavedProperty, "id" | "userId" | "createdAt" | "updatedAt">;

interface PropertyRow {
  id: string;
  user_id: string;
  data: DealData;
  created_at: string;
  updated_at: string;
}

const fromRow = (r: PropertyRow): SavedProperty => ({
  ...r.data,
  id: r.id,
  userId: r.user_id,
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
});

/** Strips the row fields so only the deal goes into `data`. */
export function dealData(p: Partial<SavedProperty>): DealData {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, userId, createdAt, updatedAt, ...rest } = p as SavedProperty;
  return rest;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body: unknown = null) {
    super(message);
  }
}

export interface ClientOptions {
  config?: IcecapConfig;
  /** Where the session is kept (the extension passes chrome.storage.local). */
  storage?: SupportedStorage;
  /** Pick up the session from the URL after the OAuth redirect (the web app). */
  detectSessionInUrl?: boolean;
  /** The API's origin; "" = same origin (the web app). */
  apiUrl?: string;
}

export function createIcecap(o: ClientOptions = {}) {
  const config = o.config ?? defaultConfig();
  const apiUrl = o.apiUrl ?? config.apiUrl;
  const db: Db = createClient(config.supabaseUrl, config.supabaseKey, {
    db: { schema: SCHEMA },
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: o.detectSessionInUrl ?? false, ...(o.storage ? { storage: o.storage } : {}) },
  });

  async function token(): Promise<string | null> {
    return (await db.auth.getSession()).data.session?.access_token ?? null;
  }

  /** Calls the Worker's API with the user's session (when signed in). */
  async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.auth !== false) {
      const t = await token();
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    const res = await fetch(`${apiUrl}${path}`, { method: init.method ?? (init.body === undefined ? "GET" : "POST"), headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const body = (await res.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
    if (!res.ok) throw new ApiError(body?.message ?? body?.error ?? `request failed (${res.status})`, res.status, body);
    return body as T;
  }

  const properties = {
    async list(): Promise<SavedProperty[]> {
      const { data, error } = await db.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as PropertyRow[]).map(fromRow);
    },
    async get(id: string): Promise<SavedProperty | null> {
      const { data, error } = await db.from("properties").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? fromRow(data as PropertyRow) : null;
    },
    async add(deal: DealData): Promise<SavedProperty> {
      const { data, error } = await db.from("properties").insert({ data: deal }).select("*").single();
      if (error) throw new Error(error.message);
      return fromRow(data as PropertyRow);
    },
    /** Replaces the deal's data (pass the whole deal, as edited). */
    async update(id: string, deal: DealData): Promise<void> {
      const { error } = await db.from("properties").update({ data: deal, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    async remove(id: string): Promise<void> {
      const { error } = await db.from("properties").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    /**
     * Calls `onChange` with the current list now and whenever a deal is added, edited or removed
     * (Realtime). Returns the unsubscribe function.
     */
    watch(onChange: (list: SavedProperty[]) => void, onError?: (e: Error) => void): () => void {
      let stopped = false;
      const refresh = () => properties.list().then((l) => !stopped && onChange(l), (e: Error) => onError?.(e));
      refresh();
      const channel = db
        .channel(`icecap-properties-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "*", schema: SCHEMA, table: "properties" }, refresh)
        .subscribe();
      return () => {
        stopped = true;
        db.removeChannel(channel);
      };
    },
  };

  const settings = {
    async get(): Promise<UserSettings | null> {
      const { data, error } = await db.from("settings").select("default_assumptions, updated_at").maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { defaultAssumptions: data.default_assumptions as PropertyAssumptions, updatedAt: Date.parse(data.updated_at) } : null;
    },
    async save(defaultAssumptions: PropertyAssumptions): Promise<void> {
      const { data: s } = await db.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) throw new Error("sign in first");
      const { error } = await db.from("settings").upsert({ user_id: userId, default_assumptions: defaultAssumptions, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    },
  };

  const pro = {
    status: () => api<ProStatus>("/api/pro"),
    /** A Stripe Checkout URL (yearly with a free week on the first purchase, or lifetime). */
    checkout: (plan: "annual" | "lifetime") => api<{ url: string }>("/api/billing/checkout", { body: { plan } }).then((r) => r.url),
    /** Stripe's billing portal URL. */
    portal: () => api<{ url: string }>("/api/billing/portal", { body: {} }).then((r) => r.url),
  };

  const waitlist = {
    join: (email: string, source?: string) => api<{ ok: true; count: number; already: boolean }>("/api/waitlist", { body: { email, source }, auth: false }),
    count: () => api<{ count: number }>("/api/waitlist", { auth: false }).then((r) => r.count),
  };

  return { db, auth: db.auth, config, api, properties, settings, pro, waitlist };
}

export type Icecap = ReturnType<typeof createIcecap>;
