import { NavLink, Outlet } from "react-router-dom"
import { signOut } from "firebase/auth"
import {
  LayoutDashboard, Home, GitCompare, Settings, PieChart, LogOut, User, Bell, Crown
} from "lucide-react"
import { auth } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"

const navItems = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard, end: true },
  { to: "/portfolio", label: "Portfolio", Icon: Home },
  { to: "/compare", label: "Compare", Icon: GitCompare },
  { to: "/settings", label: "Settings", Icon: Settings },
]

export function DashboardLayout() {
  const { user, subscription, isSubscribed } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col fixed h-full z-20">
        <div className="flex items-center gap-2 mb-10">
          <div className="bg-blue-600 p-1.5 rounded-xl text-white shadow-md shadow-blue-100">
            <PieChart size={22} />
          </div>
          <span className="text-xl font-black tracking-tight">Icecap Hub</span>
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
        </nav>

        {/* Subscription badge */}
        {subscription && (
          <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
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
              <p className="text-[10px] text-gray-400">
                {subscription.aiUsageCurrentMonth}/{subscription.aiQuotaLimit} AI uses this month
              </p>
            )}
          </div>
        )}

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
    </div>
  )
}
