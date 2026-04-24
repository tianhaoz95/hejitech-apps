import { useState, useEffect } from "react"
import { collection, getDocs, doc, getDoc } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { User, Crown, RefreshCw } from "lucide-react"
import { db, functions } from "../core/firebase"
import type { Subscription } from "@icecap/types"

interface UserRow {
  uid: string
  sub: Subscription | null
}

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionUid, setActionUid] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, "subscriptions"))
      const rows: UserRow[] = snap.docs.map((d) => ({
        uid: d.id,
        sub: d.data() as Subscription,
      }))
      setUsers(rows)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const runAction = async (uid: string, action: string, value?: unknown) => {
    setActionUid(uid)
    try {
      const fn = httpsCallable(functions, "manageSubscription")
      await fn({ uid, action, value })
      await fetchUsers()
    } catch (e) {
      alert(`Action failed: ${(e as Error).message}`)
    } finally {
      setActionUid(null)
    }
  }

  const statusColor = (status: string) => {
    if (status === "active") return "text-green-400 bg-green-500/10"
    if (status === "trialling") return "text-blue-400 bg-blue-500/10"
    if (status === "past_due") return "text-yellow-400 bg-yellow-500/10"
    if (status === "cancelled") return "text-red-400 bg-red-500/10"
    return "text-gray-400 bg-gray-500/10"
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">Users</h1>
          <p className="text-gray-400">{users.length} subscriptions found</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs font-bold uppercase tracking-wide">
              <th className="text-left p-4">User ID</th>
              <th className="text-left p-4">Tier</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">AI Usage</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Loading…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">No users found</td>
              </tr>
            ) : (
              users.map(({ uid, sub }) => (
                <tr key={uid} className="hover:bg-gray-700/50 transition-colors">
                  <td className="p-4 font-mono text-xs text-gray-300">{uid.slice(0, 16)}…</td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Crown size={14} className="text-yellow-400" />
                      <span className="font-semibold text-white capitalize">
                        {sub?.tier?.replace("_", " ") ?? "none"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-bold capitalize ${statusColor(sub?.status ?? "none")}`}>
                      {sub?.status ?? "none"}
                    </span>
                  </td>
                  <td className="p-4 text-gray-300">
                    {sub ? `${sub.aiUsageCurrentMonth}/${sub.aiQuotaLimit === Infinity ? "∞" : sub.aiQuotaLimit}` : "—"}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => runAction(uid, "reset_usage")}
                        disabled={actionUid === uid}
                        className="px-2.5 py-1 bg-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors disabled:opacity-50"
                      >
                        Reset Quota
                      </button>
                      <button
                        onClick={() => runAction(uid, "set_status", "active")}
                        disabled={actionUid === uid}
                        className="px-2.5 py-1 bg-green-600/20 text-green-400 rounded-lg text-xs font-semibold hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        Activate
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
