import { Snowflake, Sparkles, Send } from 'lucide-react'
import { METRICS, AI_BULLETS } from './data'

interface Props {
  triggered: boolean
}

export function IcecapPanel({ triggered }: Props) {
  return (
    <div className="w-80 flex-1 flex flex-col bg-white shadow-2xl">
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
        className={`flex-shrink-0 mx-3 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 transition-all duration-[240ms] ${triggered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
        style={{ transitionDelay: triggered ? '80ms' : '0ms' }}
      >
        <p className="text-xs font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
        <p className="text-xs text-gray-500 mt-0.5">Austin, TX 78704 · $485,000</p>
      </div>

      {/* Metrics */}
      <div className="flex-shrink-0 px-3 pt-2.5 space-y-1.5">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-[400ms] ${
              triggered
                ? 'opacity-100 translate-y-0 border-gray-100 bg-white shadow-sm'
                : 'opacity-0 translate-y-2 border-transparent bg-transparent'
            }`}
            style={{ transitionDelay: triggered ? `${i * 80 + 200}ms` : '0ms' }}
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

      {/* AI Verdict */}
      <div
        className={`mx-3 mt-2.5 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden transition-all duration-[320ms] ${triggered ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDelay: triggered ? '640ms' : '0ms' }}
      >
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-blue-500" />
            <span className="text-xs font-bold text-blue-700">AI Verdict</span>
          </div>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
            BUY &amp; HOLD ✓
          </span>
        </div>
        <div className="px-3 pb-3 space-y-1.5">
          {AI_BULLETS.map((bullet, i) => (
            <div
              key={i}
              className={`flex items-start gap-1.5 transition-all duration-[240ms] ${triggered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'}`}
              style={{ transitionDelay: triggered ? `${i * 80 + 760}ms` : '0ms' }}
            >
              <span className="text-blue-400 flex-shrink-0 text-[10px] mt-0.5">›</span>
              <p className="text-[11px] text-blue-800 font-medium leading-snug">{bullet}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div
        className={`px-3 pt-2.5 flex-shrink-0 transition-all duration-[240ms] ${triggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
        style={{ transitionDelay: triggered ? '1024ms' : '0ms' }}
      >
        <button className="w-full py-2.5 font-bold text-sm text-white rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)' }}>
          Save Deal →
        </button>
      </div>

      {/* Ask AI Co-Pilot */}
      <div
        className={`px-3 pb-3 pt-2 flex-shrink-0 transition-all duration-[240ms] ${triggered ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDelay: triggered ? '1136ms' : '0ms' }}
      >
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 cursor-text">
          <Sparkles size={11} className="text-blue-300 flex-shrink-0" />
          <span className="text-xs text-gray-300 flex-1 select-none">Ask AI Co-Pilot...</span>
          <Send size={11} className="text-gray-300 flex-shrink-0" />
        </div>
      </div>

      {/* Fill remaining space so bg-white extends to screen bottom */}
      <div className="flex-1" />
    </div>
  )
}
