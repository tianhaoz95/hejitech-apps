import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function SignInPage() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "2rem" }}>Contempo Admin</h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 380 }}>
        Sign in with the same Google account you use for Contempo. Access is
        restricted to admin-granted accounts.
      </p>
      <button
        type="button"
        onClick={() => signInWithGoogle().catch((err) => setError(err instanceof Error ? err.message : String(err)))}
      >
        Sign in with Google
      </button>
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", maxWidth: 380 }}>{error}</p>}
    </div>
  );
}
