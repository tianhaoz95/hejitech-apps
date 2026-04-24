import { useEffect, useState } from "react"
import { collection, query, onSnapshot, orderBy } from "firebase/firestore"
import { GitCompare, Home, TrendingUp } from "lucide-react"
import { db } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { SavedProperty } from "@icecap/types"

const METRICS = [
  { key: "price", label: "Purchase Price", fmt: (p: SavedProperty) => `$${p.price?.toLocaleString() ?? 0}` },
  { key: "cashFlow", label: "Monthly Cash Flow", fmt: (p: SavedProperty) => `$${Math.round(p.rentalMetrics?.monthlyCashFlow ?? 0)}` },
  { key: "capRate", label: "Cap Rate", fmt: (p: SavedProperty) => `${(p.rentalMetrics?.capRate ?? 0).toFixed(1)}%` },
  { key: "coc", label: "CoC Return", fmt: (p: SavedProperty) => `${(p.rentalMetrics?.cocReturn ?? 0).toFixed(1)}%` },
  { key: "grm", label: "GRM", fmt: (p: SavedProperty) => (p.rentalMetrics?.grm ?? 0).toFixed(1) },
  { key: "onePercent", label: "1% Rule", fmt: (p: SavedProperty) => `${(p.rentalMetrics?.onePercentRule ?? 0).toFixed(2)}%` },
  { key: "cashToClose", label: "Cash to Close", fmt: (p: SavedProperty) => `$${(p.rentalMetrics?.totalCashToClose ?? 0).toLocaleString()}` },
  { key: "mode", label: "Strategy", fmt: (p: SavedProperty) => p.mode?.toUpperCase() ?? "-" },
]

export function ComparePage() {
  const { user } = useAuth()
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "users", user.uid, "properties"), orderBy("createdAt", "desc"))
    return onSnapshot(q, (snap) => {
      const props = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedProperty))
      setProperties(props)
      // Auto-select first 3
      if (props.length > 0 && selected.size === 0) {
        setSelected(new Set(props.slice(0, 3).map((p) => p.id)))
      }
    })
  }, [user])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const compared = properties.filter((p) => selected.has(p.id))

  return (
    <div className="p-10">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Compare Deals</h2>
      <p className="text-gray-400 mb-6">Select up to 4 deals to compare side-by-side.</p>

      {/* Deal selector */}
      <div className="flex flex-wrap gap-3 mb-8">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold border transition-all ${
              selected.has(p.id)
                ? "bg-blue-600 text-white border-blue-600 shadow-md"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {p.mode === "rental" ? <Home size={14} /> : <TrendingUp size={14} />}
            {(p.address || "Unknown").split(",")[0]}
          </button>
        ))}
        {properties.length === 0 && (
          <p className="text-gray-400 text-sm">No deals saved yet.</p>
        )}
      </div>

      {/* Comparison matrix */}
      {compared.length >= 2 && (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left p-4 text-gray-400 font-semibold uppercase text-xs tracking-wide w-40">
                  Metric
                </th>
                {compared.map((p) => (
                  <th key={p.id} className="text-left p-4">
                    <p className="font-black text-gray-900">{(p.address || "Unknown").split(",")[0]}</p>
                    <p className="text-gray-400 font-normal text-xs">${p.price?.toLocaleString()}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(({ key, label, fmt }) => (
                <tr key={key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-500 font-medium">{label}</td>
                  {compared.map((p) => {
                    const val = fmt(p)
                    const isPositive = key === "cashFlow" && (p.rentalMetrics?.monthlyCashFlow ?? 0) > 0
                    const isNegative = key === "cashFlow" && (p.rentalMetrics?.monthlyCashFlow ?? 0) < 0
                    return (
                      <td key={p.id} className="p-4">
                        <span
                          className={`font-black text-base ${
                            isPositive ? "text-green-600" : isNegative ? "text-red-500" : "text-gray-900"
                          }`}
                        >
                          {val}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {compared.length < 2 && properties.length >= 2 && (
        <div className="text-center py-12 text-gray-400">
          <GitCompare size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select at least 2 deals to compare.</p>
        </div>
      )}
    </div>
  )
}
