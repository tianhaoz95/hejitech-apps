import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./hooks/useAuth"
import { LoginPage } from "./pages/LoginPage"
import { DashboardLayout } from "./pages/DashboardLayout"
import { DashboardPage } from "./pages/DashboardPage"
import { PropertyDetailsPage } from "./pages/PropertyDetailsPage"
import { PortfolioPage } from "./pages/PortfolioPage"
import { ComparePage } from "./pages/ComparePage"
import { SettingsPage } from "./pages/SettingsPage"
import { BillingPage } from "./pages/BillingPage"
import { SubscribePage } from "./pages/SubscribePage"
import { SubscribeSuccessPage } from "./pages/SubscribeSuccessPage"
import { SubscribeCancelPage } from "./pages/SubscribeCancelPage"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loadingAuth, isPastDue } = useAuth()

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (isPastDue) return <Navigate to="/subscribe?reason=past_due" replace />

  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/subscribe" element={<SubscribePage />} />
      <Route path="/subscribe/success" element={<SubscribeSuccessPage />} />
      <Route path="/subscribe/cancel" element={<SubscribeCancelPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="portfolio" element={<PortfolioPage />} />
        <Route path="property/:id" element={<PropertyDetailsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
