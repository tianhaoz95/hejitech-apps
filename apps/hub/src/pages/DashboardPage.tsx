import { useEffect, useState } from "react"
import { collection, query, onSnapshot, orderBy } from "firebase/firestore"
import { TrendingUp, Home, Plus, Download } from "lucide-react"
import { db } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { SavedProperty } from "@icecap/types"

function StatCard({ label, value, color = "text-gray-900" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <TrendingUp size={80} />
      </div>
      <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-4xl font-black tracking-tight ${color}`}>{value}</p>
    </div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, "users", user.uid, "properties"),
      orderBy("createdAt", "desc")
    )
    return onSnapshot(q, (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedProperty)))
      setLoading(false)
    })
  }, [user])

  const stats = {
    totalValue: properties.reduce((a, p) => a + (p.price || 0), 0),
    monthlyCashFlow: properties.reduce((a, p) => a + (p.rentalMetrics?.monthlyCashFlow || 0), 0),
    avgCapRate:
      properties.length
        ? properties.reduce((a, p) => a + (p.rentalMetrics?.capRate || 0), 0) / properties.length
        : 0,
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-10">
      <header className="flex justify-between items-start mb-10">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900">Portfolio Health</h2>
          <p className="text-gray-400 font-medium mt-1">
            {loading ? "Loading…" : `Real-time data from ${properties.length} analyzed deal${properties.length !== 1 ? "s" : ""}.`}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white text-gray-900 border border-gray-200 px-5 py-2.5 rounded-2xl font-bold hover:bg-gray-50 transition-all text-sm">
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-8 mb-12" data-testid="stats-strip">
        <StatCard label="Total Value" value={fmt(stats.totalValue)} />
        <StatCard
          label="Monthly Cashflow"
          value={`${stats.monthlyCashFlow >= 0 ? "+" : ""}${fmt(stats.monthlyCashFlow)}`}
          color={stats.monthlyCashFlow >= 0 ? "text-green-500" : "text-red-500"}
        />
        <StatCard
          label="Avg. Cap Rate"
          value={`${stats.avgCapRate.toFixed(1)}%`}
          color="text-blue-600"
        />
      </div>

      {/* Recent deals preview */}
      <section>
        <h3 className="text-xl font-black text-gray-900 mb-6">Recent Deals</h3>
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : properties.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] py-24 text-center">
            <div className="bg-gray-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Home className="text-gray-300" size={32} />
            </div>
            <p className="text-gray-600 text-lg font-bold">No deals analyzed yet</p>
            <p className="text-gray-400 max-w-xs mx-auto mt-2">
              Open the Icecap extension on Redfin, Zillow, or Realtor.com to start.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.slice(0, 5).map((p) => (
              <DealRow key={p.id} property={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DealRow({ property: p }: { property: SavedProperty }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  const cashFlow = p.rentalMetrics?.monthlyCashFlow ?? 0

  return (
    <div
      className="bg-white p-5 rounded-[24px] border border-gray-50 shadow-sm flex items-center justify-between hover:shadow-lg hover:border-blue-100 transition-all"
      data-testid="deal-card"
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${
            p.mode === "rental" ? "bg-blue-600 shadow-blue-100" : "bg-orange-500 shadow-orange-100"
          }`}
        >
          {p.mode === "rental" ? <Home size={24} /> : <TrendingUp size={24} />}
        </div>
        <div>
          <p className="font-black text-gray-900">{p.address || "Unknown Address"}</p>
          <div className="flex items-center gap-3 text-sm mt-0.5">
            <span className="text-gray-400">
              Price: <b className="text-gray-700">{fmt(p.price)}</b>
            </span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase text-gray-500">
              {p.mode}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-0.5">Cash Flow</p>
          <p className={`text-lg font-black ${cashFlow >= 0 ? "text-green-500" : "text-red-400"}`}>
            {fmt(cashFlow)}<span className="text-xs opacity-50">/mo</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-0.5">Cap Rate</p>
          <p className="text-lg font-black text-blue-600">{(p.rentalMetrics?.capRate ?? 0).toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}
