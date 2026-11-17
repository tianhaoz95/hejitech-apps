import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Home, Zap, Calculator, TrendingUp, Info } from "lucide-react"
import { useProperties } from "../../lib/icecap"
import { useAuth } from "../hooks/useAuth"
import { calcRentalMetrics, calcStrMetrics, compareRentalStrategies } from "@icecap/math"
import type { SavedProperty } from "@icecap/types"

export function PropertyDetailsPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [property, setProperty] = useState<SavedProperty | null>(null)
  const [loading, setLoading] = useState(true)

  const live = useProperties(user)
  useEffect(() => {
    if (!live) return
    setProperty(live.find((p) => p.id === id) ?? null)
    setLoading(false)
  }, [live, id])

  if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" /></div>
  if (!property) return <div className="p-10 text-center">Property not found.</div>

  const ltrMetrics = calcRentalMetrics(property)
  const strMetrics = property.strAssumptions ? calcStrMetrics(property) : null
  const comparison = property.strAssumptions ? compareRentalStrategies(property) : null

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  const fmtPct = (n: number) => `${n.toFixed(1)}%`

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-8 font-bold transition-colors"
      >
        <ArrowLeft size={20} />
        Back to Portfolio
      </button>

      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">{property.address || "Unknown Address"}</h1>
          <p className="text-gray-400 font-medium">Analyzed on {new Date(property.createdAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-1">Purchase Price</p>
            <p className="text-2xl font-black text-gray-900">{fmt(property.price)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LTR Card */}
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <Home size={24} />
            </div>
            <h3 className="text-xl font-black">Long-Term Rental</h3>
          </div>
          
          <div className="space-y-6">
            <MetricRow label="Monthly Cash Flow" value={fmt(ltrMetrics.monthlyCashFlow)} highlighted={ltrMetrics.monthlyCashFlow > 0} />
            <MetricRow label="Cap Rate" value={fmtPct(ltrMetrics.capRate)} />
            <MetricRow label="CoC Return" value={fmtPct(ltrMetrics.cocReturn)} />
            <MetricRow label="NOI" value={fmt(ltrMetrics.noi)} />
            <MetricRow label="Monthly Rent" value={fmt(property.estimatedRent)} />
          </div>
        </div>

        {/* STR Card */}
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-xs relative overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-100">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-black">Short-Term Rental</h3>
          </div>
          
          {strMetrics ? (
            <div className="space-y-6">
              <MetricRow label="Monthly Cash Flow" value={fmt(strMetrics.monthlyCashFlow)} highlighted={strMetrics.monthlyCashFlow > 0} color="text-purple-600" />
              <MetricRow label="Cap Rate" value={fmtPct(strMetrics.capRate)} />
              <MetricRow label="CoC Return" value={fmtPct(strMetrics.cocReturn)} />
              <MetricRow label="ADR" value={fmt(strMetrics.adr)} />
              <MetricRow label="Occupancy" value={fmtPct(strMetrics.occupancyRate)} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center text-gray-400">
              <p className="text-sm font-bold italic">No STR assumptions provided for this deal.</p>
            </div>
          )}
        </div>

        {/* Comparison & Breakeven */}
        <div className="space-y-8">
          {comparison && (
            <div className="bg-linear-to-br from-gray-900 to-gray-800 p-8 rounded-[40px] text-white shadow-xl shadow-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <Calculator className="text-blue-400" size={24} />
                <h3 className="text-xl font-black">Deal Verdict</h3>
              </div>
              
              <div className="mb-8">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Recommended Strategy</p>
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-black ${comparison.bestStrategy === "str" ? "text-purple-400" : "text-blue-400"}`}>
                    {comparison.bestStrategy.toUpperCase()}
                  </span>
                  <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                    +{fmt(Math.abs(comparison.monthlyDifference))}/mo
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-amber-400" />
                  <p className="text-sm font-bold">Breakeven Occupancy</p>
                </div>
                <p className="text-3xl font-black text-amber-400 mb-2">{comparison.breakevenOccupancy}%</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  STR becomes more profitable than LTR once your occupancy exceeds this threshold.
                </p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 p-8 rounded-[40px] border border-blue-100">
            <div className="flex items-center gap-3 mb-4 text-blue-900">
              <Info size={20} />
              <h3 className="font-black">Strategy Insight</h3>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">
              {comparison?.bestStrategy === "str" 
                ? "This property shows significant STR potential. Consider the higher management effort (15-30%) vs the passive LTR strategy."
                : "LTR offers better stability and higher net returns based on current estimates. STR might only work with higher ADR or direct management."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value, highlighted, color = "text-blue-600" }: { label: string; value: string; highlighted?: boolean; color?: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-gray-50 last:border-0">
      <span className="text-gray-400 text-sm font-bold uppercase tracking-wide">{label}</span>
      <span className={`text-lg font-black ${highlighted ? "text-green-500" : color}`}>{value}</span>
    </div>
  )
}
