import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  color: isActive ? "var(--pine)" : "var(--ink-soft)",
  fontWeight: isActive ? 600 : 400,
  textDecoration: "none",
});

export function Layout() {
  const { user, signOutUser } = useAuth();

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1.5rem",
          padding: "0.9rem 1.5rem",
          borderBottom: "1px solid var(--hairline)",
          background: "var(--paper-raised)",
        }}
      >
        <strong style={{ fontFamily: "var(--font-serif)" }}>Contempo Admin</strong>
        <nav style={{ display: "flex", gap: "1.25rem", flex: 1 }}>
          <NavLink to="/coupons" style={navLinkStyle}>
            Coupons
          </NavLink>
          <NavLink to="/feedback" style={navLinkStyle}>
            Feedback
          </NavLink>
        </nav>
        <ThemeToggle />
        {user && <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{user.email}</span>}
        <button className="btn-secondary" onClick={() => void signOutUser()}>
          Sign out
        </button>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "1.5rem" }}>
        <Outlet />
      </main>
    </div>
  );
}
