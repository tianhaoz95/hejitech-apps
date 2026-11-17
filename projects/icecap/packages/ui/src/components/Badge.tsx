import React from "react"

interface BadgeProps {
  value: number
  prefix?: string
  suffix?: string
  className?: string
}

export function Badge({ value, prefix = "$", suffix = "", className = "" }: BadgeProps) {
  const positive = value >= 0
  const colorClass = positive ? "bg-green-600" : "bg-red-600"
  const sign = positive ? "+" : "-"

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-xs text-xs font-black text-white shadow-2xs border border-white ${colorClass} ${className}`}
    >
      {sign}{prefix}{Math.abs(Math.round(value)).toLocaleString()}{suffix}
    </span>
  )
}
