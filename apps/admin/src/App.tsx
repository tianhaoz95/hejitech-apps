import { useState, useEffect } from "react"
import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth"
import {
  ShieldCheck, Users, Activity, Tag, BarChart2, LogIn, LogOut, AlertTriangle
} from "lucide-react"
import { auth, googleProvider, functions } from "./core/firebase"
import { SystemHealthPage } from "./pages/SystemHealthPage"
import { UsersPage } from "./pages/UsersPage"
import { ScraperHealthPage } from "./pages/ScraperHealthPage"
import { PromoCodesPage } from "./pages/PromoCodesPage"

function AdminGate({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) {
      setIsAdmin(null)
      return
    }

    // In emulator mode all users are treated as admin
    const isEmulator = import.meta.env.DEV
    if (isEmulator) {
      setIsAdmin(true)
      return
    }

    user.getIdTokenResult(true).then((result) => {
      setIsAdmin(!!result.claims.admin)
    })
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <ShieldCheck size={40} className="text-blue-600 mx-auto mb-4" />
          <h1 className="text-xl font-black text-gray-900 mb-2">Icecap Admin</h1>
          <p className="text-gray-500 text-sm mb-6">Sign in with an admin account to continue.</p>
          <button
            onClick={() => signInWithPopup(auth, googleProvider).catch(console.error)}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            <LogIn size={16} className="inline mr-2" />
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-sm w-full">
          <AlertTriangle size={40} className="text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-black text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">This account does not have admin privileges.</p>
          <p className="text-[10px] text-gray-400 font-mono break-all mb-6">UID: {user.uid}</p>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const navItems = [
  { to: "/", label: "System Health", Icon: Activity, end: true },
  { to: "/users", label: "Users", Icon: Users },
  { to: "/scraper", label: "Scraper Health", Icon: BarChart2 },
  { to: "/promos", label: "Promo Codes", Icon: Tag },
]

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => {
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AdminGate user={user}>
      <div className="min-h-screen bg-gray-50 text-gray-900 flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white border-r border-gray-100 p-5 flex flex-col fixed h-full">
          <div className="flex items-center gap-2 mb-8">
            <img src="/logo-color.svg" alt="Icecap" className="h-7" />
            <span className="font-black text-gray-900 text-sm">Admin</span>
          </div>

          <nav className="space-y-0.5 flex-1">
            {navItems.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2 truncate">{user?.email}</p>
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </aside>

        <main className="flex-1 ml-56 p-8">
          <Routes>
            <Route index element={<SystemHealthPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/scraper" element={<ScraperHealthPage />} />
            <Route path="/promos" element={<PromoCodesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AdminGate>
  )
}
