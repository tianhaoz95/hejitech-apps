import React from "react"
import { Home, TrendingUp, RefreshCw } from "lucide-react"
import type { AnalysisMode } from "@icecap/types"

interface StrategyToggleProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  showBrrrr?: boolean
}

const modes: { id: AnalysisMode; label: string; Icon: React.FC<{ size?: number }> }[] = [
  { id: "rental", label: "Rental", Icon: Home },
  { id: "flip", label: "Flip", Icon: TrendingUp },
  { id: "brrrr", label: "BRRRR", Icon: RefreshCw },
]

export function StrategyToggle({ value, onChange, showBrrrr = false }: StrategyToggleProps) {
  const visible = showBrrrr ? modes : modes.slice(0, 2)
  return (
    <div className="flex p-1 bg-gray-200 rounded-xl">
      {visible.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-semibold transition-all
            ${value === id ? "bg-white shadow-2xs text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Icon size={15} />
          {label}
        </button>
      ))}
    </div>
  )
}
