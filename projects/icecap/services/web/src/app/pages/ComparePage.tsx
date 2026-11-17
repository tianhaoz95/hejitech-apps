import { useEffect, useState } from "react"
import { GitCompare, Home, TrendingUp, Crown } from "lucide-react"
import { useProperties } from "../../lib/icecap"
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
  const { user, isPro: isSubscribed } = useAuth()
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const live = useProperties(user)
  useEffect(() => {
    if (!live) return
    {
      const props = live
      setProperties(props)
      // Auto-select first 3
      if (props.length > 0 && selected.size === 0) {
        setSelected(new Set(props.slice(0, 3).map((p) => p.id)))
      }
    }
  }, [live])

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
      {!isSubscribed && (
        <div className="mb-10 p-6 bg-linear-to-r from-blue-600 to-purple-600 rounded-4xl text-white shadow-xl shadow-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Crown size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black">Unlock Icecap Pro</h3>
              <p className="opacity-80 text-sm font-medium">Unlock full Redfin/Zillow scraping, AI Deal Summaries, and unlimited property saves.</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = "/subscribe"}
            className="px-8 py-3 bg-white text-blue-600 rounded-2xl font-black shadow-lg hover:bg-gray-50 transition-all active:scale-95"
          >
            Upgrade Now
          </button>
        </div>
      )}

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
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-xs">
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
