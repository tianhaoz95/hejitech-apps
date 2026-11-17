// Where Icecap's clients find the backend. One of the files backend.env lists: the only client file
// with the Supabase coordinates. Development builds (vite --mode development) use the local stack
// (`supabase start`, `npm run dev:worker -w @icecap/web`); everything else uses production.

export interface IcecapConfig {
  supabaseUrl: string;
  /** Publishable key (safe in clients; RLS decides what each user can read). */
  supabaseKey: string;
  /** The Worker (web pages + /api). The web app calls it same-origin; the extension needs the full URL. */
  apiUrl: string;
}

export const PRODUCTION: IcecapConfig = {
  supabaseUrl: "https://jitdzllkxfhlrxxvljhp.supabase.co",
  supabaseKey: "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8",
  apiUrl: "https://icecap.hejitech.workers.dev",
};

export const LOCAL: IcecapConfig = {
  supabaseUrl: "http://127.0.0.1:55421",
  // The demo anon key every local `supabase start` ships with.
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  apiUrl: "http://127.0.0.1:8800",
};

export const SCHEMA = "icecap";

/** Production unless this is a development build. */
export function defaultConfig(): IcecapConfig {
  const env = (import.meta as ImportMeta & { env?: { MODE?: string } }).env;
  return env?.MODE === "development" ? LOCAL : PRODUCTION;
}
