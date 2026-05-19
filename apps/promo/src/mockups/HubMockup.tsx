import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Snowflake, Sparkles, ArrowLeft, BarChart2, FolderOpen, SlidersHorizontal, Send, Bot } from 'lucide-react'
import { HUB_DEALS, METRICS, AI_SUMMARY, AI_CHAT } from './data'

export function HubMockup() {
  const [searchParams] = useSearchParams()
  const screenshotMode = searchParams.get('screenshot') === '1'
  const [view, setView] = useState<'list' | 'detail'>(screenshotMode ? 'detail' : 'list')
  const [analysisStarted, setAnalysisStarted] = useState(screenshotMode)
  const [displayedText, setDisplayedText] = useState(screenshotMode ? AI_SUMMARY : '')
  const [chatVisible, setChatVisible] = useState(screenshotMode)
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
        setTimeout(() => setChatVisible(true), 400)
      }
    }, 18)
  }

  const reset = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setView('list')
    setAnalysisStarted(false)
    setDisplayedText('')
    setChatVisible(false)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 select-none">
      {/* Nav */}
      <nav className="flex-shrink-0 h-14 bg-white border-b border-gray-100 flex items-center px-6 gap-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
            <Snowflake size={16} className="text-white" />
          </div>
          <span className="font-black text-gray-900 tracking-tight">icecap</span>
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter bg-blue-50 px-1.5 py-0.5 rounded-full">Hub</span>
        </div>
        <nav className="flex items-center gap-1">
          {[
            { label: 'Portfolio', icon: FolderOpen },
            { label: 'Compare', icon: BarChart2 },
            { label: 'Settings', icon: SlidersHorizontal },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${label === 'Portfolio' ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'}`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ring-2 ring-white shadow-sm" />
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col py-4 px-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Deals</p>
          {[
            { label: 'All Deals', count: HUB_DEALS.length, active: true },
            { label: 'Favorites', count: 2, active: false },
            { label: 'Analyzed', count: 3, active: false },
            { label: 'Archived', count: 0, active: false },
          ].map(item => (
            <button key={item.label} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium transition-colors ${item.active ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}`}>
              {item.label}
              {item.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${item.active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}

          {/* AI Co-Pilot sidebar promo */}
          <div className="mt-auto mx-1 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Bot size={12} className="text-blue-500" />
              <span className="text-[10px] font-black text-blue-700 uppercase tracking-wide">AI Co-Pilot</span>
            </div>
            <p className="text-[10px] text-blue-600 leading-snug">Ask anything about your deals — cash flow, comparisons, market trends.</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {view === 'list' ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-xl font-black text-gray-900">My Portfolio</h1>
                  <p className="text-sm text-gray-400 mt-0.5">{HUB_DEALS.length} saved deals</p>
                </div>
                <button className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition-colors">
                  + Add Deal
                </button>
              </div>

              <div className="space-y-3">
                {HUB_DEALS.map(deal => (
                  <button
                    key={deal.id}
                    onClick={() => setView('detail')}
                    className={`w-full bg-white rounded-2xl border p-4 flex items-center gap-4 text-left hover:shadow-md transition-all duration-200 ${deal.id === 1 ? 'border-blue-200 ring-1 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <img src={deal.photo} alt="" className="w-16 h-12 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate text-sm">{deal.address}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{deal.city} · {deal.price}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Cap Rate</p>
                        <p className="text-sm font-black text-green-600">{deal.capRate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">CoC</p>
                        <p className="text-sm font-black text-green-600">{deal.coc}</p>
                      </div>
                      <span className="text-xs text-gray-300 w-16 text-right">{deal.saved}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <button onClick={reset} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 mb-6 transition-colors">
                <ArrowLeft size={14} />
                Back to Portfolio
              </button>

              {/* Property header */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4 shadow-sm">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-black text-gray-900">2847 Maplewood Drive</h2>
                    <p className="text-gray-400 text-sm mt-0.5">Austin, TX 78704 · $485,000</p>
                  </div>
                  <span className="bg-green-50 text-green-700 border border-green-100 text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0">
                    Strong Buy
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {METRICS.map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">{m.label}</p>
                      <p className="text-base font-black text-gray-900 tabular-nums">{m.value}</p>
                      {m.badge && (
                        <span className={`text-xs font-bold mt-0.5 inline-block ${m.status === 'good' ? 'text-green-500' : 'text-amber-500'}`}>
                          {m.status === 'good' ? '✓ Good' : '~ Okay'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI analysis card */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">AI Deal Analysis</h3>
                      <p className="text-[10px] text-gray-400">Powered by Icecap AI</p>
                    </div>
                  </div>
                  {!analysisStarted && (
                    <button
                      onClick={startTypewriter}
                      className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-bold rounded-xl transition-colors"
                      style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}
                    >
                      <Sparkles size={14} />
                      Analyze Deal
                    </button>
                  )}
                </div>

                {analysisStarted ? (
                  <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-xl p-4 min-h-[6rem] font-medium">
                    {displayedText}
                    {displayedText.length < AI_SUMMARY.length && (
                      <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Sparkles size={24} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Click Analyze Deal to generate an AI-powered investment summary.</p>
                  </div>
                )}
              </div>

              {/* AI Co-Pilot chat */}
              <div
                className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all duration-500 ${chatVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}
              >
                <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
                    <Bot size={14} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">AI Co-Pilot</h3>
                    <p className="text-[10px] text-gray-400">Ask anything about this deal</p>
                  </div>
                </div>

                <div className="px-6 py-4 space-y-3">
                  {AI_CHAT.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex transition-all duration-400 ${chatVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'} ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      style={{ transitionDelay: chatVisible ? `${i * 180 + 100}ms` : '0ms' }}
                    >
                      {msg.role === 'ai' && (
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 flex-shrink-0 mr-2 mt-0.5">
                          <Bot size={10} className="text-white" />
                        </div>
                      )}
                      <div className={`max-w-xs px-3.5 py-2.5 rounded-2xl text-xs font-medium leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-6 pb-5">
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                    <span className="text-xs text-gray-300 flex-1">Ask a follow-up question...</span>
                    <Send size={13} className="text-gray-300 flex-shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
