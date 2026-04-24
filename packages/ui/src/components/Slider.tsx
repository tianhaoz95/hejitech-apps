import React from "react"

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  formatValue?: (v: number) => string
  onChange: (v: number) => void
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue = (v) => `${v}%`,
  onChange,
}: SliderProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold text-gray-800">{formatValue(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  )
}
