import React from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  prefix?: string
  suffix?: string
  error?: string
}

export function Input({ label, prefix, suffix, error, className = "", ...props }: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs text-gray-400 mb-0.5">{label}</label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-0 text-gray-400 text-sm">{prefix}</span>
        )}
        <input
          className={`w-full font-medium border-b-2 border-gray-200 focus:border-blue-600 outline-hidden bg-transparent py-1 transition-colors
            ${prefix ? "pl-4" : ""}
            ${suffix ? "pr-8" : ""}
            ${error ? "border-red-400" : ""}
            ${className}`}
          {...props}
        />
        {suffix && (
          <span className="absolute right-0 text-gray-400 text-sm">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}
