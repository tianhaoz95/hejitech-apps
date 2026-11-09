// Build-time settings. Without them the portal talks to the local stack that `supabase start` runs
// and offers email sign-in (local accounts only; production signs in with GitHub, Google or Apple).
const env = import.meta.env;

export const config = {
  supabaseURL: (env.VITE_SUPABASE_URL || "http://127.0.0.1:55421").replace(/\/$/, ""),
  supabaseAnonKey:
    env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  emailSignIn: Boolean(env.VITE_EMAIL_SIGNIN) || env.DEV,
};
