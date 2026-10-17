import { useAuth } from "../auth/AuthContext";

/** Shown when a signed-in Google account has no admin:true custom claim — see backend/scripts/set-admin-claim.js. */
export function AccessDeniedPage() {
  const { user, signOutUser } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "1.5rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem" }}>Access denied</h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 420 }}>
        {user?.email} isn't granted admin access. Ask an existing admin to run{" "}
        <code>node backend/scripts/set-admin-claim.js --grant {user?.email}</code>, then sign out
        and back in here.
      </p>
      <button className="btn-secondary" onClick={() => void signOutUser()}>
        Sign out
      </button>
    </div>
  );
}
