import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_ADMIN_GOOGLE_CLIENT_ID;

export function SignInPage() {
  const { signInWithGoogleCredential } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The GIS script (index.html) loads async — poll briefly rather than
    // assuming it's already on window by the time this effect runs.
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !buttonRef.current) {
        setTimeout(tryInit, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          signInWithGoogleCredential(response.credential).catch((err) => {
            setError(err instanceof Error ? err.message : String(err));
          });
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
      });
      setReady(true);
    };
    tryInit();
    return () => {
      cancelled = true;
    };
  }, [signInWithGoogleCredential]);

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
      <div ref={buttonRef} />
      {!ready && <p style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>Loading sign-in…</p>}
      {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", maxWidth: 380 }}>{error}</p>}
    </div>
  );
}
