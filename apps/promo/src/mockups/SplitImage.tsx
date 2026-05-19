import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Snowflake, Sparkles, Bot, Play } from 'lucide-react'
import { METRICS, AI_BULLETS } from './data'

// Horizontal pixel shift between top and bottom of the angled divider
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

  const [splitPct, setSplitPct] = useState(screenshotMode ? 48 : 64)
  const [isDragging, setIsDragging] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [lineAngle, setLineAngle] = useState(2.5)
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number | null>(null)

  // Keep line angle in sync with container height
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const h = containerRef.current.offsetHeight
      setLineAngle(Math.atan2(ANGLE_PX, h) * (180 / Math.PI))
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
    const to = from > 50 ? 28 : 66
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

          {/* Icecap panel */}
          <div className="w-60 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white shadow-xl">
            <div className="flex-shrink-0 px-4 py-3.5" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Snowflake size={13} className="text-blue-200" />
                <span className="text-white font-black text-xs tracking-tight">icecap</span>
              </div>
              <p className="text-blue-300 text-[10px] font-medium">Investment Analysis</p>
            </div>

            <div className="mx-2.5 mt-2.5 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Austin, TX · $485,000</p>
            </div>

            <div className="flex-shrink-0 px-2.5 pt-2 space-y-1.5">
              {METRICS.map(m => (
                <div key={m.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <span className="text-[10px] text-gray-500 font-medium">{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-gray-900 tabular-nums">{m.value}</span>
                    {m.status === 'good' && <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 text-[9px] font-black flex items-center justify-center">✓</span>}
                    {m.status === 'warn' && <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black flex items-center justify-center">~</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Verdict */}
            <div className="mx-2.5 mt-2.5 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
              <div className="flex items-center justify-between px-2.5 pt-2.5 pb-1.5">
                <div className="flex items-center gap-1">
                  <Sparkles size={10} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-700">AI Verdict</span>
                </div>
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full">
                  BUY &amp; HOLD ✓
                </span>
              </div>
              <div className="px-2.5 pb-2.5 space-y-1">
                {AI_BULLETS.map((bullet, i) => (
                  <div key={i} className="flex items-start gap-1">
                    <span className="text-blue-400 flex-shrink-0 text-[9px] mt-0.5">›</span>
                    <p className="text-[9px] text-blue-800 font-medium leading-snug">{bullet}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-2.5 mt-2.5 pb-2">
              <button className="w-full py-2 text-white text-xs font-bold rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                Save Deal →
              </button>
            </div>

            <div className="px-2.5 pb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <Bot size={9} className="text-blue-300 flex-shrink-0" />
                <span className="text-[9px] text-gray-300 flex-1">Ask AI Co-Pilot...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Angled divider line ── */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-10"
        style={{
          left: `${splitPct}%`,
          width: '2px',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(255,255,255,0.95) 20%, rgba(255,255,255,0.95) 80%, rgba(255,255,255,0.05))',
          boxShadow: '0 0 18px 6px rgba(255,255,255,0.55)',
          transform: `translateX(-50%) rotate(-${lineAngle}deg)`,
          transformOrigin: 'center center',
        }}
      />

      {/* ── Drag handle ── */}
      <div
        className={`absolute z-20 ${isDragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
        style={{ left: `${splitPct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        onMouseDown={e => { e.preventDefault(); setIsDragging(true) }}
      >
        <div className="w-11 h-11 rounded-full bg-gray-900 border-2 border-white shadow-2xl flex items-center justify-center ring-4 ring-white/20 hover:ring-white/40 transition-all">
          <span className="text-white text-[9px] font-black tracking-tight">VS</span>
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

function HomeIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
