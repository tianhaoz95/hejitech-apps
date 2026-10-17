import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { BillingPage } from "./pages/BillingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EntriesPage } from "./pages/EntriesPage";
import { LegalPage } from "./pages/LegalPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SignInPage } from "./pages/SignInPage";

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      {/* Public, regardless of sign-in state — this is the URL submitted to
          Google Play Console's privacy policy field, which Google's review
          requires to be viewable without an account. Declared before the
          loading/auth branches below so it never gets swallowed by them. */}
      <Route path="/legal/privacy" element={<LegalPage doc="privacy" />} />
      <Route path="/legal/terms" element={<LegalPage doc="terms" />} />

      {loading ? (
        <Route path="*" element={<p style={{ padding: "1.5rem" }}>Loading…</p>} />
      ) : !user ? (
        <Route path="*" element={<SignInPage />} />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      )}
    </Routes>
  );
}
