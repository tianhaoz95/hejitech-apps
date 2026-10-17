import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/supabase";

export function SettingsPage() {
  const { user, signOutUser } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!user) return null;

  // Calls the same deleteAccount Cloud Function the Android app uses (see
  // backend/functions/src/account.ts) — this is the web-accessible deletion
  // path Google Play's account deletion policy requires alongside the
  // in-app one, reachable by anyone who can sign in here even without the
  // Android app installed. Deletion runs server-side via the Admin SDK, so
  // there's no client-side "recent sign-in" re-auth step needed first.
  async function handleDeleteAccount() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api("account/delete");
      await signOutUser();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account. Please try again.");
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem" }}>Account settings</h1>
      <div className="chart-card viz-root" style={{ maxWidth: 420 }}>
        {user.user_metadata?.avatar_url && (
          <img
            src={user.user_metadata?.avatar_url}
            alt=""
            width={56}
            height={56}
            style={{ borderRadius: "50%", marginBottom: "0.75rem" }}
          />
        )}
        <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.4rem 1rem", fontSize: "0.9rem" }}>
          <dt style={{ color: "var(--ink-faint)" }}>Name</dt>
          <dd style={{ margin: 0 }}>{(user.user_metadata?.full_name as string | undefined) ?? "—"}</dd>
          <dt style={{ color: "var(--ink-faint)" }}>Email</dt>
          <dd style={{ margin: 0 }}>{user.email}</dd>
          <dt style={{ color: "var(--ink-faint)" }}>User ID</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{user.id}</dd>
        </dl>
        <button
          onClick={() => void signOutUser()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--hairline-strong)",
            background: "var(--paper)",
            cursor: "pointer",
          }}
        >
          Sign out
        </button>

        <div style={{ marginTop: "1rem" }}>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isDeleting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid transparent",
              background: "transparent",
              color: "var(--danger)",
              cursor: isDeleting ? "default" : "pointer",
              opacity: isDeleting ? 0.6 : 1,
            }}
          >
            {isDeleting ? "Deleting…" : "Delete account"}
          </button>
          {deleteError && (
            <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
              {deleteError}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginTop: "1.5rem", fontSize: "0.9rem", display: "flex", gap: "1.25rem" }}>
        <Link to="/legal/privacy" style={{ color: "var(--ink-soft)" }}>
          Privacy Policy
        </Link>
        <Link to="/legal/terms" style={{ color: "var(--ink-soft)" }}>
          Terms of Service
        </Link>
      </div>

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            className="chart-card"
            style={{ maxWidth: 380, padding: "1.5rem" }}
          >
            <h2 style={{ fontSize: "1.15rem", marginTop: 0 }}>Delete your account?</h2>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>
              This permanently deletes your account and all your logged entries, properties,
              photos, and voice recordings. This cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--hairline-strong)",
                  background: "var(--paper)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  void handleDeleteAccount();
                }}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--radius-md)",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
