import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import { PrivacyPage } from "./pages/PrivacyPage"
import { TermsPage } from "./pages/TermsPage"

export default function App() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <nav className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-lg">
          ⚖️ Icecap Legal
        </div>
        <div className="flex items-center gap-6 text-sm font-semibold">
          <NavLink to="/privacy" className={({ isActive }) => isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}>
            Privacy Policy
          </NavLink>
          <NavLink to="/terms" className={({ isActive }) => isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"}>
            Terms of Service
          </NavLink>
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/privacy" replace />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
    </div>
  )
}
