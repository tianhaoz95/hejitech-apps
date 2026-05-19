import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Snowflake, Sparkles, Bot, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import { METRICS, AI_BULLETS } from './data'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)

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

  // Animate split to reveal the other side
  const animate = useCallback(() => {
    if (animating) return
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setAnimating(true)
    const from = splitPct
    const to = from > 50 ? 28 : 62
    const duration = 900
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      setSplitPct(from + (to - from) * ease)
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick)
      } else {
        setSplitPct(to)
        setAnimating(false)
      }
    }
    animRef.current = requestAnimationFrame(tick)
  }, [animating, splitPct])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); animate() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animate])

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

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
        <div className="flex-shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-black text-red-400 uppercase tracking-widest">Before</span>
          <span className="text-xs text-gray-600 font-medium">Manual spreadsheet analysis</span>
        </div>

        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          <div className="flex-shrink-0 h-8 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-sm" />
              </div>
              <span className="text-xs font-semibold text-gray-600 truncate">Deal Analysis — Maplewood Dr</span>
            </div>
          </div>
          <div className="flex-shrink-0 flex bg-gray-50 border-b border-gray-200 text-xs text-gray-400 font-medium">
            <div className="w-8 border-r border-gray-200 flex-shrink-0" />
            {['A', 'B', 'C'].map(c => (
              <div key={c} className="flex-1 border-r border-gray-200 text-center py-1.5">{c}</div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {SPREADSHEET_ROWS.map((r, idx) => (
              <div key={idx} className={`flex border-b text-xs ${(r as any).header ? 'bg-gray-50 font-bold text-gray-500 border-gray-200' : 'border-gray-100'} ${(r as any).warning ? 'bg-orange-50' : ''}`}>
                <div className="w-8 border-r border-gray-100 px-1.5 py-1.5 text-center text-gray-300 bg-gray-50 flex-shrink-0 text-[10px]">{r.row}</div>
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
          <div className="flex-shrink-0 h-7 bg-gray-50 border-t border-gray-200 flex items-center px-2">
            <div className="bg-white border border-gray-200 text-[10px] font-semibold text-gray-600 px-3 py-0.5 rounded-sm shadow-sm">Sheet1</div>
            <span className="text-gray-300 text-lg ml-2">+</span>
          </div>
        </div>
      </div>

      {/* ── AFTER panel ── */}
      <div className="absolute inset-0 flex flex-col" style={{ clipPath: afterClip }}>
        <div className="flex-shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-3">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-black text-green-400 uppercase tracking-widest">After</span>
          <span className="text-xs text-gray-600 font-medium">Icecap — instant analysis</span>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Real Redfin screenshot */}
          <div className="flex-1 bg-white overflow-y-auto">
            <img src="/listing-redfin.png" alt="Redfin listing" className="w-full block" />
          </div>

          {/* Icecap panel — wider to emphasize the product */}
          <div className="w-80 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white shadow-xl self-stretch">
            <div className="flex-shrink-0 px-5 py-4" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Snowflake size={15} className="text-blue-200" />
                <span className="text-white font-black text-sm tracking-tight">icecap</span>
              </div>
              <p className="text-blue-300 text-xs font-medium">Investment Analysis</p>
            </div>

            <div className="mx-3 mt-3 p-3 rounded-xl bg-blue-50 border border-blue-100 flex-shrink-0">
              <p className="text-xs font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
              <p className="text-xs text-gray-500 mt-0.5">Austin, TX · $485,000</p>
            </div>

            <div className="flex-shrink-0 px-3 pt-2.5 space-y-1.5">
              {METRICS.map(m => (
                <div key={m.label} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-gray-100 bg-white shadow-sm">
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
            <div className="mx-3 mt-2.5 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 flex-shrink-0">
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
                    <span className="text-blue-400 flex-shrink-0 text-[10px] mt-0.5">›</span>
                    <p className="text-[11px] text-blue-800 font-medium leading-snug">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-3 mt-2.5 flex-shrink-0">
              <button className="w-full py-2.5 text-white text-sm font-bold rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                Save Deal →
              </button>
            </div>

            <div className="px-3 pt-2 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <Bot size={11} className="text-blue-300 flex-shrink-0" />
                <span className="text-xs text-gray-300 flex-1">Ask AI Co-Pilot...</span>
              </div>
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

      {/* ── Play button ── */}
      {!screenshotMode && (
        <button
          onClick={animate}
          disabled={animating}
          className="fixed bottom-5 left-5 bg-gray-900/80 hover:bg-gray-900 disabled:opacity-60 text-white text-xs font-bold px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg transition-colors z-50 flex items-center gap-2"
        >
          <Play size={10} className="fill-white flex-shrink-0" />
          {animating ? 'Animating…' : splitPct > 50 ? 'Reveal Icecap →' : '← Reveal Before'}
        </button>
      )}
    </div>
  )
}
