import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Snowflake, Sparkles, Bot, ChevronLeft, ChevronRight } from 'lucide-react'
import { METRICS, AI_BULLETS, AI_CHAT } from './data'

// Horizontal px shift between top and bottom of the angled divider
const ANGLE_PX = 48

const SPREADSHEET_ROWS = [
  { row: '1',  cells: ['Field', 'Value', 'Notes'], header: true },
  { row: '2',  cells: ['Purchase Price', '$485,000', 'From Redfin'] },
  { row: '3',  cells: ['Down Payment (20%)', '=B2*0.2', ''], formula: true },
  { row: '4',  cells: ['Monthly Rent', '$2,950', 'Estimate ❓'] },
  { row: '5',  cells: ['Vacancy Rate', '5%', 'Assumed ❓'] },
  { row: '6',  cells: ['Operating Expenses', '35%', 'Rule of thumb ❓'] },
  { row: '7',  cells: ['Annual NOI', '=B4*(1–B5)*(1–B6)*12', ''], formula: true },
  { row: '8',  cells: ['Cap Rate', '=B7/B2', ''], formula: true },
  { row: '9',  cells: ['Cash-on-Cash', '???', 'Need mortgage calc'], warning: true },
  { row: '10', cells: ['GRM', '=B2/(B4*12)', ''], formula: true },
  { row: '',   cells: ['', '', ''] },
  { row: '12', cells: ['⚠️ Still need to verify:', '', ''], warning: true },
  { row: '13', cells: ['  › Confirm rent estimate', '', ''], sub: true },
  { row: '14', cells: ['  › Add mortgage details', '', ''], sub: true },
  { row: '15', cells: ['  › Check comparable sales', '', ''], sub: true },
]

export function SplitImage() {
  const [searchParams] = useSearchParams()
  const screenshotMode = searchParams.get('screenshot') === '1'

  const [splitPct, setSplitPct] = useState(screenshotMode ? 45 : 62)
  const [isDragging, setIsDragging] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [size, setSize] = useState({ w: 0, h: 0 })
  // Panel animation state — default to fully revealed (static view)
  const [metricsVisible, setMetricsVisible] = useState(METRICS.length)
  const [verdictVisible, setVerdictVisible] = useState(true)
  const [chatVisible, setChatVisible] = useState(false)
  const [chatQ, setChatQ] = useState('')
  const [chatA, setChatA] = useState('')
  const [chatIsTyping, setChatIsTyping] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)
  const allTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const typeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track container dimensions for SVG line coordinates
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      setSize({ w: containerRef.current.offsetWidth, h: containerRef.current.offsetHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Drag to move split
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setSplitPct(Math.max(15, Math.min(85, ((e.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  // Full product showcase: divider sweep + staggered panel reveal + AI chat typewriter
  const animate = useCallback(() => {
    if (animating) return

    // Cancel any in-flight animations
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current)
    allTimersRef.current.forEach(clearTimeout)
    allTimersRef.current = []

    setAnimating(true)

    // Reset panel to blank state
    setMetricsVisible(0)
    setVerdictVisible(false)
    setChatVisible(false)
    setChatQ('')
    setChatA('')
    setChatIsTyping(false)

    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const schedule = (fn: () => void, delay: number) => {
      const id = setTimeout(fn, delay)
      allTimersRef.current.push(id)
    }

    const animateTo = (from: number, to: number, duration: number, onDone: () => void) => {
      const t0 = performance.now()
      const tick = (now: number) => {
        const t = Math.min((now - t0) / duration, 1)
        setSplitPct(from + (to - from) * ease(t))
        if (t < 1) { animRef.current = requestAnimationFrame(tick) }
        else { setSplitPct(to); onDone() }
      }
      animRef.current = requestAnimationFrame(tick)
    }

    // Typewriter — recursive setTimeout so it can be cancelled mid-flight
    const typeText = (text: string, setter: (s: string) => void, perChar: number, onDone: () => void) => {
      let i = 0
      const next = () => {
        i++
        setter(text.slice(0, i))
        if (i < text.length) { typeTimerRef.current = setTimeout(next, perChar) }
        else { onDone() }
      }
      typeTimerRef.current = setTimeout(next, perChar)
    }

    const start = splitPct

    // ── Divider phases ──
    // Phase 1: sweep right to show Before spreadsheet
    animateTo(start, 88, 520, () => {
      schedule(() => {
        // Phase 2: dramatic sweep left to reveal Icecap
        animateTo(88, 18, 880, () => {
          // ── Panel reveal sequence (runs concurrently with the hold) ──

          // Metrics pop in one by one
          METRICS.forEach((_, i) => {
            schedule(() => setMetricsVisible(i + 1), i * 216)
          })

          // AI verdict fades in after all metrics
          schedule(() => setVerdictVisible(true), METRICS.length * 216 + 200)

          // Chat: question types in, then dots, then answer
          const chatDelay = METRICS.length * 216 + 720
          schedule(() => {
            setChatVisible(true)
            typeText(AI_CHAT[0].text, setChatQ, 24, () => {
              setChatIsTyping(true)
              schedule(() => {
                setChatIsTyping(false)
                typeText(AI_CHAT[1].text, setChatA, 18, () => {/* done */})
              }, 880)
            })
          }, chatDelay)

          // Phase 3: settle divider to balanced split after hold
          schedule(() => {
            animateTo(18, 52, 560, () => setAnimating(false))
          }, 2560)
        })
      }, 600)
    })
  }, [animating, splitPct])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyA') { e.preventDefault(); animate() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animate])

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    if (typeTimerRef.current) clearTimeout(typeTimerRef.current)
    allTimersRef.current.forEach(clearTimeout)
  }, [])

  const A = ANGLE_PX / 2
  const beforeClip = `polygon(0 0, calc(${splitPct}% + ${A}px) 0, calc(${splitPct}% - ${A}px) 100%, 0 100%)`
  const afterClip  = `polygon(calc(${splitPct}% + ${A}px) 0, 100% 0, 100% 100%, calc(${splitPct}% - ${A}px) 100%)`

  // Pixel coordinates for the SVG divider — identical to the clip-path boundary
  const lineX1 = size.w * (splitPct / 100) + A
  const lineX2 = size.w * (splitPct / 100) - A

  return (
    <div ref={containerRef} className="h-screen relative overflow-hidden bg-gray-950 select-none">

      {/* ── BEFORE panel ── */}
      <div className="absolute inset-0 flex flex-col" style={{ clipPath: beforeClip }}>
        <div className="shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-black text-red-400 uppercase tracking-widest">Before</span>
          <span className="text-xs text-gray-600 font-medium">Manual spreadsheet analysis</span>
        </div>

        <div className="flex-1 bg-white flex flex-col overflow-hidden relative">
          <div className="shrink-0 h-8 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-sm bg-green-500 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-xs" />
              </div>
              <span className="text-xs font-semibold text-gray-600 truncate">Deal Analysis — Maplewood Dr</span>
            </div>
          </div>
          <div className="shrink-0 flex bg-gray-50 border-b border-gray-200 text-xs text-gray-400 font-medium">
            <div className="w-8 border-r border-gray-200 shrink-0" />
            {['A', 'B', 'C'].map(c => (
              <div key={c} className="flex-1 border-r border-gray-200 text-center py-1.5">{c}</div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {SPREADSHEET_ROWS.map((r, idx) => (
              <div key={idx} className={`flex border-b text-xs ${(r as any).header ? 'bg-gray-50 font-bold text-gray-500 border-gray-200' : 'border-gray-100'} ${(r as any).warning ? 'bg-orange-50' : ''}`}>
                <div className="w-8 border-r border-gray-100 px-1.5 py-1.5 text-center text-gray-300 bg-gray-50 shrink-0 text-[10px]">{r.row}</div>
                {r.cells.map((cell, ci) => (
                  <div key={ci} className={`flex-1 border-r border-gray-100 px-2 py-1.5 truncate ${
                    (r as any).formula && ci === 1 ? 'text-green-700 font-mono text-[10px]' :
                    (r as any).warning ? 'text-orange-600 font-semibold' :
                    (r as any).sub ? 'text-gray-400 pl-4' :
                    ci === 0 ? 'text-gray-600' : 'text-gray-900 font-medium'
                  }`}>
                    {cell}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="shrink-0 h-7 bg-gray-50 border-t border-gray-200 flex items-center px-2">
            <div className="bg-white border border-gray-200 text-[10px] font-semibold text-gray-600 px-3 py-0.5 rounded-xs shadow-xs">Sheet1</div>
            <span className="text-gray-300 text-lg ml-2">+</span>
          </div>

          {/* Bottom overlay — Before callout */}
          <div className="absolute bottom-0 inset-x-0 px-7 pb-8 pt-28 bg-linear-to-t from-gray-950 via-gray-950/80 to-transparent pointer-events-none">
            <p className="text-[11px] font-black text-red-400 uppercase tracking-widest mb-2">Before Icecap</p>
            <p className="text-4xl font-black text-white leading-tight">Hours of<br/>guesswork</p>
            <p className="text-sm text-white/40 mt-3 font-medium">per deal · error-prone · exhausting</p>
          </div>
        </div>
      </div>

      {/* ── AFTER panel ── */}
      <div className="absolute inset-0 flex flex-col" style={{ clipPath: afterClip }}>
        <div className="shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center justify-end px-5 gap-3">
          <span className="text-xs text-gray-600 font-medium">Icecap — instant analysis</span>
          <span className="text-xs font-black text-green-400 uppercase tracking-widest">After</span>
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Real Redfin screenshot — wrapper is relative so overlay anchors to visible area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto">
              <img src="/promo/listing-redfin.png" alt="Redfin listing" className="w-full block" />
            </div>

            {/* Bottom overlay — After callout (right-aligned so it's visible past the divider) */}
            <div className="absolute bottom-0 inset-x-0 px-7 pb-8 pt-28 bg-linear-to-t from-blue-950 via-blue-950/80 to-transparent pointer-events-none text-right">
              <p className="text-[11px] font-black text-blue-400 uppercase tracking-widest mb-2">After Icecap</p>
              <p className="text-4xl font-black text-white leading-tight">Instant<br/>analysis</p>
              <p className="text-sm text-blue-300/60 mt-3 font-medium flex items-center justify-end gap-1.5">
                30 seconds · always accurate
                <Snowflake size={13} className="text-blue-400 shrink-0" />
              </p>
            </div>
          </div>

          {/* Icecap panel — wider to emphasize the product */}
          <div className="w-80 shrink-0 border-l border-gray-100 flex flex-col bg-white shadow-xl self-stretch">
            <div className="shrink-0 px-5 py-4" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Snowflake size={15} className="text-blue-200" />
                <span className="text-white font-black text-sm tracking-tight">icecap</span>
              </div>
              <p className="text-blue-300 text-xs font-medium">Investment Analysis</p>
            </div>

            <div className="mx-3 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 shrink-0">
              <p className="text-xs font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
              <p className="text-xs text-gray-500 mt-0.5">Austin, TX · $485,000</p>
            </div>

            <div className="shrink-0 px-3 pt-2.5 space-y-1.5">
              {METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-100 bg-white shadow-xs transition-all duration-240 ${
                    i < metricsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                  }`}
                >
                  <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-gray-900 tabular-nums">{m.value}</span>
                    {m.status === 'good' && <span className="w-5 h-5 rounded-full bg-green-100 text-green-600 text-[10px] font-black flex items-center justify-center">✓</span>}
                    {m.status === 'warn' && <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 text-[10px] font-black flex items-center justify-center">~</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Verdict */}
            <div className={`mx-3 mt-2.5 rounded-xl border border-blue-100 bg-linear-to-br from-blue-50 to-indigo-50 shrink-0 transition-all duration-400 ${verdictVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
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
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-blue-400 shrink-0 text-[10px] mt-0.5">›</span>
                    <p className="text-[11px] text-blue-800 font-medium leading-snug">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Co-Pilot chat conversation */}
            {chatVisible && (
              <div className="px-3 pt-1 pb-2 shrink-0 space-y-2">
                {/* User message */}
                {chatQ && (
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-xl rounded-tr-sm max-w-[90%] leading-snug">
                      {chatQ}
                      {chatQ.length < AI_CHAT[0].text.length && (
                        <span className="inline-block w-px h-3 bg-white/80 ml-0.5 align-middle animate-pulse" />
                      )}
                    </div>
                  </div>
                )}
                {/* Typing dots */}
                {chatIsTyping && (
                  <div className="flex items-center gap-1.5 pl-1">
                    <Snowflake size={10} className="text-blue-400 shrink-0" />
                    <div className="flex gap-1 py-0.5">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                {/* AI answer */}
                {chatA && (
                  <div className="flex items-start gap-1.5">
                    <Snowflake size={10} className="text-blue-400 mt-1 shrink-0" />
                    <div className="bg-blue-50 border border-blue-100 text-[11px] text-blue-900 font-medium px-2.5 py-1.5 rounded-xl rounded-tl-sm flex-1 leading-snug">
                      {chatA}
                      {chatA.length < AI_CHAT[1].text.length && (
                        <span className="inline-block w-px h-3 bg-blue-500 ml-0.5 align-middle animate-pulse" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Co-Pilot input bar */}
            <div className="px-3 pt-1 pb-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <Bot size={11} className="text-blue-300 shrink-0" />
                <span className="text-xs text-gray-300 flex-1">
                  {chatVisible ? 'Ask a follow-up...' : 'Ask AI Co-Pilot...'}
                </span>
              </div>
            </div>

            {/* Save Deal — bottom CTA after all analysis + conversation */}
            <div className="px-3 pt-1 pb-3 shrink-0">
              <button className="w-full py-2.5 text-white text-sm font-bold rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                Save Deal →
              </button>
            </div>

            {/* Fill remaining space so bg-white extends to screen bottom */}
            <div className="flex-1 bg-white" />
          </div>
        </div>
      </div>

      {/* ── SVG divider — pixel-perfect match to clip-path boundary ── */}
      {size.w > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none z-10"
          width={size.w}
          height={size.h}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="lineGlow" x="-300%" width="700%" y="-5%" height="110%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Outer halo */}
          <line x1={lineX1} y1={0} x2={lineX2} y2={size.h} stroke="rgba(255,255,255,0.12)" strokeWidth="40" />
          {/* Mid glow */}
          <line x1={lineX1} y1={0} x2={lineX2} y2={size.h} stroke="rgba(255,255,255,0.35)" strokeWidth="12" />
          {/* Crisp white core */}
          <line x1={lineX1} y1={0} x2={lineX2} y2={size.h} stroke="white" strokeWidth="3" filter="url(#lineGlow)" />
        </svg>
      )}

      {/* ── Drag handle ── */}
      <div
        className={`absolute z-20 ${isDragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
        style={{ left: `${splitPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        onMouseDown={e => { e.preventDefault(); setIsDragging(true) }}
      >
        <div
          className="w-16 h-16 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-all duration-150"
          style={{ boxShadow: '0 0 0 5px rgba(255,255,255,0.25), 0 0 0 10px rgba(255,255,255,0.1), 0 8px 40px rgba(0,0,0,0.5)' }}
        >
          <ChevronLeft size={18} strokeWidth={2.5} className="text-gray-800 -mr-0.5" />
          <ChevronRight size={18} strokeWidth={2.5} className="text-gray-800 -ml-0.5" />
        </div>
      </div>

    </div>
  )
}
