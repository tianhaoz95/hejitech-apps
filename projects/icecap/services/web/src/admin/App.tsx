import { useEffect, useState } from "react"
import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import { ShieldCheck, Crown, Activity, LogIn, LogOut, AlertTriangle, ListOrdered } from "lucide-react"
import { ApiError } from "@icecap/client"
import { icecap, signInWithGoogle, signOut, useUser } from "../lib/icecap"
import { OverviewPage } from "./pages/OverviewPage"
import { ProPage } from "./pages/ProPage"
import { WaitlistPage } from "./pages/WaitlistPage"

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="bg-white p-8 rounded-2xl shadow-xs border border-gray-100 text-center max-w-sm w-full">{children}</div>
  </div>
)

const navItems = [
  { to: "/", label: "Overview", Icon: Activity, end: true },
  { to: "/pro", label: "Pro accounts", Icon: Crown },
  { to: "/waitlist", label: "Waitlist", Icon: ListOrdered },
]

export default function App() {
  const user = useUser()
  // The Worker decides (icecap.admins); 403 for everyone else.
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return setIsAdmin(null)
    icecap
      .api("/api/admin/stats")
      .then(() => setIsAdmin(true))
      .catch((e) => setIsAdmin(e instanceof ApiError && e.status === 403 ? false : null))
  }, [user])

  if (user === undefined || (user && isAdmin === null)) return <Spinner />
  if (!user) {
    return (
      <Card>
        <ShieldCheck size={40} className="text-blue-600 mx-auto mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">Icecap Admin</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in with an admin account to continue.</p>
        <button onClick={() => signInWithGoogle("/admin/")} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
          <LogIn size={16} className="inline mr-2" />
          Sign in with Google
        </button>
      </Card>
    )
  }
  if (!isAdmin) {
    return (
      <Card>
        <AlertTriangle size={40} className="text-yellow-500 mx-auto mb-4" />
        <h1 className="text-xl font-black text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-2">This account isn't an Icecap admin.</p>
        <p className="text-[10px] text-gray-400 font-mono break-all mb-6">{user.email} · {user.id}</p>
        <button onClick={() => signOut()} className="w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">
          Sign Out
        </button>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex">
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isActive ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"}`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2 truncate">{user.email}</p>
          <button onClick={() => signOut()} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-56 p-8">
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="/pro" element={<ProPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
