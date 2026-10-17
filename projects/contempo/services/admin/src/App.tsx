import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { AccessDeniedPage } from "./pages/AccessDeniedPage";
import { CouponsPage } from "./pages/CouponsPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { SignInPage } from "./pages/SignInPage";

export function App() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <p style={{ padding: "1.5rem" }}>Loading…</p>;
  }
  if (!user) {
    return <SignInPage />;
  }
  if (!isAdmin) {
    return <AccessDeniedPage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/coupons" replace />} />
        <Route path="/coupons" element={<CouponsPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="*" element={<Navigate to="/coupons" replace />} />
      </Route>
    </Routes>
  );
}
