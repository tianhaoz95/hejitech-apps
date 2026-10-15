// Build-time settings (see .env.example). Without them the site talks to the local stack that
// `supabase start` runs, with the same anon key as BackendConfig.local in the app.
const env = import.meta.env;

export const config = {
  supabaseURL: (env.VITE_SUPABASE_URL || "http://127.0.0.1:54321").replace(/\/$/, ""),
  supabaseAnonKey:
    env.VITE_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
  supportEmail: env.VITE_SUPPORT_EMAIL || "support@example.com",
  appStoreURL: env.VITE_APP_STORE_URL || "",
  emailSignIn: Boolean(env.VITE_EMAIL_SIGNIN) || env.DEV,
};

export const mcpURL = `${config.supabaseURL}/functions/v1/mcp`;
