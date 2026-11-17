import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import type { AdminStats } from "@icecap/types"
import { icecap } from "../../lib/icecap"

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function OverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [error, setError] = useState("")
  const load = () => {
    setError("")
    icecap.api<AdminStats>("/api/admin/stats").then(setStats, (e: Error) => setError(e.message))
  }
  useEffect(load, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">Overview</h1>
          <p className="text-gray-500">Icecap on the shared HEJI backend.</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Accounts with deals" value={stats?.accounts ?? "—"} />
        <Stat label="Saved deals" value={stats?.properties ?? "—"} />
        <Stat label="Pro accounts" value={stats ? stats.pro.stripe + stats.pro.grants : "—"} sub={stats ? `${stats.pro.stripe} paid · ${stats.pro.grants} given` : undefined} />
        <Stat label="Waitlist" value={stats?.waitlist ?? "—"} />
      </div>
    </div>
  )
}
