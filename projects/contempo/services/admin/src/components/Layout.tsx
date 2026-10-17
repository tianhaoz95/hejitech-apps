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
      <header className="admin-header">
        <strong style={{ fontFamily: "var(--font-serif)" }}>Contempo Admin</strong>
        <nav className="admin-header-nav">
          <NavLink to="/coupons" style={navLinkStyle}>
            Coupons
          </NavLink>
        </nav>
        <div className="admin-header-actions">
          <ThemeToggle />
          {user && (
            <span className="admin-header-user" title={user.email ?? undefined}>
              {user.email}
            </span>
          )}
          <button className="btn-secondary" onClick={() => void signOutUser()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
