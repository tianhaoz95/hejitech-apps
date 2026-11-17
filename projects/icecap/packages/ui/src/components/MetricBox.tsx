import React from "react"

interface MetricBoxProps {
  label: string
  value: string
  large?: boolean
  className?: string
}

export function MetricBox({ label, value, large = false, className = "" }: MetricBoxProps) {
  return (
    <div className={className}>
      <p className="text-xs opacity-80">{label}</p>
      <p className={`font-bold ${large ? "text-2xl" : "text-xl"}`}>{value}</p>
    </div>
  )
}
