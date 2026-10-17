import { useAuth } from "../auth/AuthContext";

export function SignInPage() {
  const { signInWithGoogle } = useAuth();

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
      <h1 style={{ fontSize: "2rem" }}>Contempo</h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 380 }}>
        Sign in to see your material-participation dashboard, review entries, and manage your
        account.
      </p>
      <button
        onClick={() => void signInWithGoogle()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          background: "var(--pine)",
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "0.5rem 1.4rem 0.5rem 0.5rem",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        {/* White backing behind the multi-color "G" so it reads correctly
            against the button's pine background, per Google's sign-in
            button branding guidance for non-white buttons. */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "1.75rem",
            height: "1.75rem",
            borderRadius: "50%",
            background: "#fff",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M45.12,24.5c0,-1.56 -0.14,-3.06 -0.4,-4.5H24v8.51h11.84c-0.51,2.75 -2.06,5.08 -4.39,6.64v5.52h7.11c4.16,-3.83 6.56,-9.47 6.56,-16.17z"
            />
            <path
              fill="#34A853"
              d="M24,46c5.94,0 10.92,-1.97 14.56,-5.33l-7.11,-5.52c-1.97,1.32 -4.49,2.1 -7.45,2.1 -5.73,0 -10.58,-3.87 -12.31,-9.07H4.34v5.7C7.96,41.07 15.4,46 24,46z"
            />
            <path
              fill="#FBBC05"
              d="M11.69,28.18C11.25,26.86 11,25.45 11,24s0.25,-2.86 0.69,-4.18v-5.7H4.34C2.85,17.09 2,20.45 2,24c0,3.55 0.85,6.91 2.34,9.88l7.35,-5.7z"
            />
            <path
              fill="#EA4335"
              d="M24,10.75c3.23,0 6.13,1.11 8.41,3.29l6.31,-6.31C34.91,4.18 29.93,2 24,2 15.4,2 7.96,6.93 4.34,14.12l7.35,5.7c1.73,-5.2 6.58,-9.07 12.31,-9.07z"
            />
          </svg>
        </span>
        Sign in with Google
      </button>
    </div>
  );
}
