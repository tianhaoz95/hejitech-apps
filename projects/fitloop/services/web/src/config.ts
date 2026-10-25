// Build-time settings (see .env.example). Without them the web app talks to the local stack that
// `supabase start` runs and offers email sign-in for the seed account.
const env = import.meta.env;

export const config = {
  supabaseURL: (env.VITE_SUPABASE_URL || "http://127.0.0.1:55421").replace(/\/$/, ""),
  supabaseAnonKey:
    env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  /** Email/password sign-in: local seed account only. Production signs in with Google (PRD §4). */
  emailSignIn: Boolean(env.VITE_EMAIL_SIGNIN) || env.DEV,
};
