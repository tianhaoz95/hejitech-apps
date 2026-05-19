import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { HUB_DEALS, METRICS, AI_SUMMARY } from './data'

export function HubMockup() {
  const [searchParams] = useSearchParams()
  const screenshotMode = searchParams.get('screenshot') === '1'
  const [view, setView] = useState<'list' | 'detail'>(screenshotMode ? 'detail' : 'list')
  const [analysisStarted, setAnalysisStarted] = useState(screenshotMode)
  const [displayedText, setDisplayedText] = useState(screenshotMode ? AI_SUMMARY : '')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTypewriter = () => {
    if (intervalRef.current) return
    setAnalysisStarted(true)
    let i = 0
    intervalRef.current = setInterval(() => {
      i++
      setDisplayedText(AI_SUMMARY.slice(0, i))
      if (i >= AI_SUMMARY.length && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }, 18)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 select-none">
      {/* Nav */}
      <nav className="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <div className="w-3.5 h-3.5 bg-white rounded-sm" />
          </div>
          <span className="font-black text-gray-900 tracking-tight">Icecap</span>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter ml-0.5">Hub</span>
        </div>
        <div className="flex items-center gap-1">
          {['Portfolio', 'Compare', 'Reports'].map(tab => (
            <button key={tab} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'Portfolio' ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}>
              {tab}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-100 p-4 flex flex-col gap-1">
          {['All Deals', 'Favorites', 'Analyzed', 'Archived'].map((item, i) => (
            <button key={item} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${i === 0 ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
              {item}
              {i === 0 && <span className="float-right text-xs bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">{HUB_DEALS.length}</span>}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6">
          {view === 'list' ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-black text-gray-900">My Portfolio</h1>
                <span className="text-sm text-gray-400">{HUB_DEALS.length} saved deals</span>
              </div>
              <div className="space-y-3">
                {HUB_DEALS.map(deal => (
                  <div
                    key={deal.id}
                    onClick={() => setView('detail')}
                    className={`bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all ${deal.id === 1 ? 'ring-2 ring-blue-100 border-blue-200' : ''}`}
                  >
                    <img src={deal.photo} alt="" className="w-20 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{deal.address}</p>
                      <p className="text-sm text-gray-400">{deal.city} · {deal.price}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 font-medium">Cap Rate</p>
                        <p className="text-sm font-black text-green-600">{deal.capRate}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 font-medium">CoC</p>
                        <p className="text-sm font-black text-green-600">{deal.coc}</p>
                      </div>
                      <span className="text-xs text-gray-300">{deal.saved}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => { setView('list'); setAnalysisStarted(false); setDisplayedText(''); intervalRef.current = null }} className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-6 transition-colors">
                ← Back to Portfolio
              </button>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-900">2847 Maplewood Drive</h2>
                    <p className="text-gray-400">Austin, TX 78704 · $485,000</p>
                  </div>
                  <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">Strong Buy</span>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {METRICS.map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 font-medium mb-1">{m.label}</p>
                      <p className="text-base font-black text-gray-900">{m.value}</p>
                      {m.badge && (
                        <span className={`text-xs font-bold ${m.status === 'good' ? 'text-green-600' : 'text-yellow-600'}`}>{m.badge}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Analysis */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-sm" />
                    </div>
                    <h3 className="font-bold text-gray-900">AI Deal Analysis</h3>
                  </div>
                  {!analysisStarted && (
                    <button
                      onClick={startTypewriter}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                      Analyze Deal →
                    </button>
                  )}
                </div>
                {analysisStarted ? (
                  <div className="text-sm text-gray-700 leading-relaxed min-h-[5rem]">
                    {displayedText}
                    {displayedText.length < AI_SUMMARY.length && (
                      <span className="inline-block w-0.5 h-4 bg-blue-600 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Click "Analyze Deal" to generate an AI-powered investment summary for this property.</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
