/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_FIREBASE_API_KEY: string;
  readonly VITE_ADMIN_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_ADMIN_FIREBASE_PROJECT_ID: string;
  readonly VITE_ADMIN_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_ADMIN_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_ADMIN_FIREBASE_APP_ID: string;
  readonly VITE_ADMIN_FIREBASE_MEASUREMENT_ID: string;
  // OAuth Web Client ID for Google Identity Services — see
  // src/pages/SignInPage.tsx. Same client used across the whole project
  // (Android's GOOGLE_WEB_CLIENT_ID in local.properties.example is the
  // identical value) — not a secret, it's a public OAuth client identifier.
  readonly VITE_ADMIN_GOOGLE_CLIENT_ID: string;
  readonly VITE_USE_FIREBASE_EMULATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
