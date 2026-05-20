import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { RefreshCw, Search } from "lucide-react"
import { db } from "../core/firebase"

interface WaitlistEntry {
  id: string
  email: string
  name: string
  createdAt: Date | null
  source: string
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-sm text-gray-500 font-medium mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, "waitlist"), orderBy("createdAt", "desc"))
      )
      setEntries(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            email: data.email ?? "",
            name: data.name ?? "",
            createdAt: data.createdAt?.toDate() ?? null,
            source: data.source ?? "unknown",
          }
        })
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [])

  const total = entries.length
  const withName = entries.filter((e) => e.name).length

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgoStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgoStart = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000)

  const today = entries.filter((e) => e.createdAt && e.createdAt >= todayStart).length
  const last7 = entries.filter((e) => e.createdAt && e.createdAt >= weekAgoStart).length
  const prev7 = entries.filter(
    (e) => e.createdAt && e.createdAt >= twoWeeksAgoStart && e.createdAt < weekAgoStart
  ).length
  const growthPct =
    prev7 === 0 ? null : Math.round(((last7 - prev7) / prev7) * 100)

  // Daily bars — last 14 days
  const dailyCounts: Record<string, number> = {}
  for (let i = 0; i < 14; i++) {
    const d = new Date(todayStart.getTime() - (13 - i) * 24 * 60 * 60 * 1000)
    dailyCounts[d.toISOString().slice(0, 10)] = 0
  }
  entries.forEach((e) => {
    if (!e.createdAt) return
    const key = e.createdAt.toISOString().slice(0, 10)
    if (key in dailyCounts) dailyCounts[key]++
  })
  const dailyData = Object.entries(dailyCounts)
  const maxDay = Math.max(...dailyData.map(([, v]) => v), 1)
  const todayKey = todayStart.toISOString().slice(0, 10)

  const filtered = entries.filter(
    (e) =>
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 mb-1">Waitlist</h1>
          <p className="text-gray-500">{total.toLocaleString()} signups total</p>
        </div>
        <button
          onClick={fetchEntries}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Signups" value={total.toLocaleString()} />
        <StatCard label="Today" value={today} />
        <StatCard
          label="Last 7 Days"
          value={last7}
          sub={
            growthPct !== null
              ? `${growthPct >= 0 ? "+" : ""}${growthPct}% vs prior week`
              : undefined
          }
        />
        <StatCard
          label="Provided Name"
          value={`${withName} / ${total}`}
          sub={
            total > 0
              ? `${Math.round((withName / total) * 100)}% completion rate`
              : undefined
          }
        />
      </div>

      {/* Daily chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <p className="text-sm font-bold text-gray-700 mb-4">Signups — Last 14 Days</p>
        <div className="flex items-end gap-1 h-24">
          {dailyData.map(([date, count]) => (
            <div
              key={date}
              className="flex-1 flex flex-col items-center group relative"
              style={{ height: "100%" }}
            >
              {/* tooltip */}
              <div className="absolute bottom-full mb-1.5 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                {date.slice(5)}: {count}
              </div>
              <div className="w-full flex-1 flex items-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    date === todayKey
                      ? "bg-blue-500"
                      : "bg-blue-100 group-hover:bg-blue-300"
                  }`}
                  style={{ height: `${Math.max((count / maxDay) * 100, 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-2">
          <span>{dailyData[0]?.[0]?.slice(5)}</span>
          <span>Today</span>
        </div>
      </div>

      {/* Email table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">
            All Signups
            {searchQuery && (
              <span className="ml-2 text-gray-400 font-normal">
                — {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={14}
            />
            <input
              type="text"
              placeholder="Search email or name…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
            />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wide">
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Signed Up</th>
              <th className="text-left p-4">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  No signups found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{entry.email}</td>
                  <td className="p-4 text-gray-600">
                    {entry.name || (
                      <span className="text-gray-300 italic text-xs">—</span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500 text-xs tabular-nums">
                    {entry.createdAt ? entry.createdAt.toLocaleString() : "—"}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                      {entry.source}
                    </span>
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
