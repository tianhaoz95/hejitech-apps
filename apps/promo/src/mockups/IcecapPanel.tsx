import { Snowflake, TrendingUp } from 'lucide-react'
import { METRICS } from './data'

interface Props {
  triggered: boolean
}

export function IcecapPanel({ triggered }: Props) {
  return (
    <div className="w-80 h-full flex-shrink-0 flex flex-col bg-white shadow-2xl">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Snowflake size={16} className="text-blue-200" />
          <span className="text-white font-black tracking-tight text-sm">icecap</span>
        </div>
        <p className="text-blue-300 text-xs font-medium">Investment Analysis</p>
      </div>

      {/* Property card */}
      <div
        className={`flex-shrink-0 mx-3 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 transition-all duration-300 ${triggered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
        style={{ transitionDelay: triggered ? '100ms' : '0ms' }}
      >
        <p className="text-xs font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
        <p className="text-xs text-gray-500 mt-0.5">Austin, TX 78704 · $485,000</p>
      </div>

      {/* Metrics */}
      <div className="flex-1 px-3 pt-3 pb-2 space-y-2 overflow-auto">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className={`flex items-center justify-between px-3.5 py-3 rounded-xl border transition-all duration-500 ${
              triggered
                ? 'opacity-100 translate-y-0 border-gray-100 bg-white shadow-sm'
                : 'opacity-0 translate-y-2 border-transparent bg-transparent'
            }`}
            style={{ transitionDelay: triggered ? `${i * 120 + 280}ms` : '0ms' }}
          >
            <span className="text-xs text-gray-500 font-medium">{m.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-gray-900 tabular-nums">{m.value}</span>
              {m.status === 'good' && (
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-black flex items-center justify-center flex-shrink-0">✓</span>
              )}
              {m.status === 'warn' && (
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black flex items-center justify-center flex-shrink-0">~</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* AI insight chip */}
      <div
        className={`mx-3 mb-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 flex items-center gap-2 transition-all duration-300 ${triggered ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDelay: triggered ? '900ms' : '0ms' }}
      >
        <TrendingUp size={13} className="text-blue-500 flex-shrink-0" />
        <p className="text-xs text-blue-700 font-medium">Outperforms Austin avg by 1.4 pts</p>
      </div>

      {/* Save button */}
      <div
        className={`px-3 pb-4 flex-shrink-0 transition-all duration-300 ${triggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
        style={{ transitionDelay: triggered ? '1050ms' : '0ms' }}
      >
        <button className="w-full py-3 font-bold text-sm text-white rounded-xl transition-colors" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
          Save Deal →
        </button>
      </div>
    </div>
  )
}
