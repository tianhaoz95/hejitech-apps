import React from "react"
import { MetricBox } from "./MetricBox"
import type { RentalMetrics, FlipMetrics, AnalysisMode } from "@icecap/types"

interface ResultCardProps {
  mode: AnalysisMode
  rental?: RentalMetrics
  flip?: FlipMetrics
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

export function ResultCard({ mode, rental, flip }: ResultCardProps) {
  return (
    <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg w-full">
      <h2 className="text-xs font-semibold opacity-80 uppercase mb-4">
        {mode === "rental" ? "Rental Metrics" : mode === "flip" ? "Flip Metrics" : "BRRRR Metrics"}
      </h2>

      {(mode === "rental" || mode === "brrrr") && rental && (
        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
          <MetricBox label="Monthly Cash Flow" value={fmt(rental.monthlyCashFlow)} large />
          <MetricBox label="CoC Return" value={fmtPct(rental.cocReturn)} large />
          <MetricBox label="Cap Rate" value={fmtPct(rental.capRate)} />
          <MetricBox label="1% Rule" value={fmtPct(rental.onePercentRule)} />
          <MetricBox label="GRM" value={rental.grm.toFixed(1)} />
          <MetricBox label="Cash to Close" value={fmt(rental.totalCashToClose)} />
        </div>
      )}

      {mode === "flip" && flip && (
        <div className="grid grid-cols-2 gap-y-4 gap-x-4">
          <MetricBox label="Estimated Profit" value={fmt(flip.flipProfit)} large />
          <MetricBox label="ROI" value={fmtPct(flip.flipROI)} large />
          <div className="col-span-2">
            <div className="p-3 bg-white/10 rounded-xl">
              <p className="text-xs opacity-80 mb-1">70% Rule MAO (Max Allowable Offer)</p>
              <p className="text-2xl font-bold text-yellow-300">{fmt(flip.mao)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
