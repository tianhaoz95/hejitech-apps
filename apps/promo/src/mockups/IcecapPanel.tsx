import { METRICS } from './data'

interface Props {
  triggered: boolean
}

export function IcecapPanel({ triggered }: Props) {
  return (
    <div className="w-80 flex-shrink-0 flex flex-col bg-white border-l border-gray-200 shadow-2xl">
      {/* Header */}
      <div className="bg-blue-600 px-5 py-4">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-6 h-6 bg-white rounded-md flex items-center justify-center">
            <div className="w-3 h-3 bg-blue-600 rounded-sm" />
          </div>
          <span className="text-white font-black tracking-tight">Icecap</span>
        </div>
        <p className="text-blue-200 text-xs">Investment Analysis</p>
      </div>

      {/* Property summary */}
      <div className={`px-5 py-3 bg-gray-50 border-b border-gray-100 transition-opacity duration-300 ${triggered ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDelay: triggered ? '100ms' : '0ms' }}>
        <p className="text-xs font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
        <p className="text-xs text-gray-500">Austin, TX 78704 · $485,000</p>
      </div>

      {/* Metrics */}
      <div className="flex-1 p-4 space-y-2.5 overflow-auto">
        {METRICS.map((m, i) => (
          <div
            key={m.label}
            className={`flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-400 ${
              triggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={{ transitionDelay: triggered ? `${i * 150 + 250}ms` : '0ms' }}
          >
            <span className="text-sm text-gray-500 font-medium">{m.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{m.value}</span>
              {m.status === 'good' && (
                <span className="bg-green-100 text-green-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">✓</span>
              )}
              {m.status === 'warn' && (
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">~</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div
        className={`px-4 pb-5 pt-2 transition-all duration-300 ${triggered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        style={{ transitionDelay: triggered ? '1050ms' : '0ms' }}
      >
        <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors">
          Save Deal →
        </button>
      </div>
    </div>
  )
}
