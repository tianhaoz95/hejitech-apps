import { Snowflake, Sparkles, Bot } from 'lucide-react'
import { PROPERTY, METRICS, AI_BULLETS } from './data'

const SPREADSHEET_ROWS = [
  { row: '1', cells: ['Field', 'Value', 'Notes'], header: true },
  { row: '2', cells: ['Purchase Price', '$485,000', 'From Redfin'], formula: false },
  { row: '3', cells: ['Down Payment (20%)', '=B2*0.2', ''], formula: true },
  { row: '4', cells: ['Monthly Rent', '$2,950', 'Estimate ❓'], formula: false },
  { row: '5', cells: ['Vacancy Rate', '5%', 'Assumed ❓'], formula: false },
  { row: '6', cells: ['Operating Expenses', '35%', 'Rule of thumb ❓'], formula: false },
  { row: '7', cells: ['Annual NOI', '=B4*(1–B5)*(1–B6)*12', ''], formula: true },
  { row: '8', cells: ['Cap Rate', '=B7/B2', ''], formula: true },
  { row: '9', cells: ['Cash-on-Cash', '???', 'Need mortgage calc'], formula: false, warning: true },
  { row: '10', cells: ['GRM', '=B2/(B4*12)', ''], formula: true },
  { row: '', cells: ['', '', ''], header: false },
  { row: '12', cells: ['⚠️ Still need to verify:', '', ''], warning: true },
  { row: '13', cells: ['  › Confirm rent estimate', '', ''], sub: true },
  { row: '14', cells: ['  › Add mortgage details', '', ''], sub: true },
  { row: '15', cells: ['  › Check comparable sales', '', ''], sub: true },
]

export function SplitImage() {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-950 select-none">

      {/* ── BEFORE ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Label bar */}
        <div className="flex-shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-3">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="text-xs font-black text-red-400 uppercase tracking-widest">Before</span>
          <span className="text-xs text-gray-600 font-medium">Manual spreadsheet analysis</span>
        </div>

        {/* Sheets UI */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {/* Sheets top bar */}
          <div className="flex-shrink-0 h-8 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-green-500 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-sm" />
              </div>
              <span className="text-xs font-semibold text-gray-600 truncate">Deal Analysis — Maplewood Dr</span>
            </div>
          </div>
          {/* Column headers */}
          <div className="flex-shrink-0 flex bg-gray-50 border-b border-gray-200 text-xs text-gray-400 font-medium">
            <div className="w-8 border-r border-gray-200 flex-shrink-0" />
            {['A', 'B', 'C'].map(c => (
              <div key={c} className="flex-1 border-r border-gray-200 text-center py-1.5">{c}</div>
            ))}
          </div>
          {/* Rows */}
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
          {/* Sheets tab bar */}
          <div className="flex-shrink-0 h-7 bg-gray-50 border-t border-gray-200 flex items-center px-2">
            <div className="bg-white border border-gray-200 text-[10px] font-semibold text-gray-600 px-3 py-0.5 rounded-sm shadow-sm">Sheet1</div>
            <span className="text-gray-300 text-lg ml-2">+</span>
          </div>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className="w-px bg-gray-800 flex-shrink-0 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center shadow-xl">
            <span className="text-gray-300 text-[9px] font-black">VS</span>
          </div>
        </div>
      </div>

      {/* ── AFTER ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Label bar */}
        <div className="flex-shrink-0 h-11 bg-gray-900 border-b border-gray-800 flex items-center px-5 gap-3">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-black text-green-400 uppercase tracking-widest">After</span>
          <span className="text-xs text-gray-600 font-medium">Icecap — instant analysis</span>
        </div>

        {/* Listing + Icecap panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Listing content */}
          <div className="flex-1 bg-white overflow-y-auto">
            {/* Redfin nav */}
            <div className="h-10 flex items-center px-4 gap-4 flex-shrink-0" style={{ backgroundColor: '#cc1818' }}>
              <Home size={14} className="text-white" />
              <span className="text-white text-sm font-black">redfin</span>
              <div className="flex gap-3">
                {['Buy', 'Rent', 'Sell'].map(t => <span key={t} className="text-white/60 text-xs">{t}</span>)}
              </div>
            </div>
            {/* Photo */}
            <div className="relative">
              <img src={PROPERTY.photo} alt="Property" className="w-full object-cover" style={{ height: 160 }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            {/* Details */}
            <div className="p-4">
              <p className="text-2xl font-black text-gray-900">{PROPERTY.price}</p>
              <p className="text-sm font-semibold text-gray-700 mt-0.5">{PROPERTY.address}</p>
              <p className="text-xs text-gray-400">{PROPERTY.city}</p>
              <div className="flex gap-3 mt-3 py-3 border-y border-gray-100 text-xs">
                <span className="font-bold text-gray-900">{PROPERTY.beds} bed</span>
                <span className="font-bold text-gray-900">{PROPERTY.baths} bath</span>
                <span className="font-bold text-gray-900">{PROPERTY.sqft} sqft</span>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Est. Monthly Rent</p>
                <p className="text-base font-black text-gray-900 mt-0.5">{PROPERTY.rent}</p>
              </div>
            </div>
          </div>

          {/* Icecap panel — always triggered in split view */}
          <div className="w-60 flex-shrink-0 border-l border-gray-100 flex flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3.5" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Snowflake size={13} className="text-blue-200" />
                <span className="text-white font-black text-xs tracking-tight">icecap</span>
              </div>
              <p className="text-blue-300 text-[10px] font-medium">Investment Analysis</p>
            </div>

            {/* Property summary */}
            <div className="mx-2.5 mt-2.5 p-2.5 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-[10px] font-bold text-gray-900 truncate">2847 Maplewood Drive</p>
              <p className="text-[10px] text-gray-500 mt-0.5">Austin, TX · $485,000</p>
            </div>

            {/* Metrics */}
            <div className="flex-1 px-2.5 pt-2 pb-2 space-y-1.5 overflow-auto">
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
            <div className="mx-2.5 mb-2.5 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
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

            <div className="px-2.5 pb-2">
              <button className="w-full py-2 text-white text-xs font-bold rounded-xl" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                Save Deal →
              </button>
            </div>

            {/* Ask AI hint */}
            <div className="px-2.5 pb-3">
              <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <Bot size={9} className="text-blue-300 flex-shrink-0" />
                <span className="text-[9px] text-gray-300 flex-1">Ask AI Co-Pilot...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Home({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
