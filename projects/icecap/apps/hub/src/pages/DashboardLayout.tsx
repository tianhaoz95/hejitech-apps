import { useState, useEffect } from "react"
import { NavLink, Outlet } from "react-router-dom"
import { signOut } from "firebase/auth"
import {
  LayoutDashboard, Home, GitCompare, Settings, LogOut, User, Crown, Sparkles, CreditCard
} from "lucide-react"
import { auth } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import { CopilotSidebar } from "../components/CopilotSidebar"

const navItems = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfolio", Icon: Home },
  { to: "/compare", label: "Compare", Icon: GitCompare },
  { to: "/settings", label: "Settings", Icon: Settings },
  { to: "/billing", label: "Billing", Icon: CreditCard },
]

export function DashboardLayout() {
  const { user, subscription, isSubscribed } = useAuth()
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  useEffect(() => {
    if (user) {
      console.log(`[Hub] Logged in as: ${user.email}, UID: ${user.uid}, Project ID: ${auth.app.options.projectId}`)
    }
  }, [user])

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col fixed h-full z-20">
        <div className="flex items-center mb-10">
          <img src="/logo-color.svg" alt="Icecap" className="h-9" />
        </div>

        <nav className="space-y-0.5 flex-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          <button
            onClick={() => setIsCopilotOpen((o) => !o)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors mt-2 ${
              isCopilotOpen
                ? "bg-purple-50 text-purple-700"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <Sparkles size={18} />
            AI Co-Pilot
          </button>
        </nav>

        {/* Subscription status */}
        <div className="mb-4">
          {subscription ? (
            <div className="p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-0.5">
                <Crown size={12} className="text-yellow-500" />
                <span className="text-xs font-bold text-gray-700 capitalize">
                  {subscription.tier?.replace("_", " ") ?? "Free"}
                </span>
                <span
                  className={`ml-auto text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    isSubscribed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              {subscription.tier === "pro" && (
                <div className="mt-2">
                  <p className="text-[10px] text-gray-400 mb-2">
                    {subscription.aiUsageCurrentMonth}/{subscription.aiQuotaLimit} AI uses this month
                  </p>
                  <NavLink
                    to="/subscribe"
                    className="block w-full py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg text-center hover:bg-blue-700 transition-colors"
                  >
                    Upgrade to Pro Max
                  </NavLink>
                </div>
              )}
              {subscription.tier === "pro_max" && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Unlimited AI Analysis enabled
                </p>
              )}
            </div>
          ) : (
            <NavLink
              to="/subscribe"
              className="flex flex-col gap-2 p-4 rounded-2xl bg-gray-900 text-white shadow-xl shadow-gray-200 group hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-center gap-2">
                <Crown size={16} className="text-yellow-400" />
                <span className="text-sm font-black">Upgrade to Pro</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Unlock full Redfin/Zillow scraping and AI-powered deal analysis.
              </p>
            </NavLink>
          )}
        </div>

        {/* User profile */}
        <div className="p-3 bg-gray-50 rounded-2xl flex items-center gap-3 border border-gray-100">
          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full" />
            ) : (
              <User size={18} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">
              {user?.displayName ?? user?.email}
            </p>
            <button
              onClick={() => signOut(auth)}
              className="text-[10px] text-red-500 font-bold hover:underline"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto">
        <Outlet />
      </main>

      <CopilotSidebar isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  )
}
