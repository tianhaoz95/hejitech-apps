import { PROPERTY, METRICS } from './data'

export function SplitImage() {
  return (
    <div className="h-screen flex overflow-hidden bg-gray-900 select-none">
      {/* Before — Spreadsheet */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 h-10 bg-gray-800 flex items-center px-4 gap-2">
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Before</span>
          <span className="text-xs text-gray-500 ml-2">Manual spreadsheet analysis</span>
        </div>
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          {/* Sheets toolbar */}
          <div className="flex-shrink-0 h-8 bg-gray-50 border-b border-gray-200 flex items-center px-3 gap-4">
            <span className="text-xs text-gray-500 font-medium">Deal Analysis - Maplewood Dr</span>
          </div>
          {/* Column headers */}
          <div className="flex-shrink-0 flex border-b border-gray-200 bg-gray-50">
            <div className="w-10 border-r border-gray-200" />
            {['A', 'B', 'C', 'D'].map(col => (
              <div key={col} className="w-48 border-r border-gray-200 px-2 py-1 text-center text-xs text-gray-500 font-medium">{col}</div>
            ))}
          </div>
          {/* Rows */}
          {[
            ['1', 'Field', 'Value', 'Notes', ''],
            ['2', 'Purchase Price', '$485,000', 'From Redfin', ''],
            ['3', 'Down Payment (20%)', '=B2*0.2', '', ''],
            ['4', 'Monthly Rent', '$2,950', 'Estimate', '❓'],
            ['5', 'Vacancy Rate', '5%', 'Assumed', ''],
            ['6', 'Operating Expenses', '35%', 'Rule of thumb', '❓'],
            ['7', 'NOI', '=B4*(1-B5)*(1-B6)*12', '', ''],
            ['8', 'Cap Rate', '=B7/B2', '', ''],
            ['9', 'Cash-on-Cash', '???', 'Need mortgage calc', '❓'],
            ['10', 'GRM', '=B2/(B4*12)', '', ''],
            ['11', '', '', '', ''],
            ['12', '⚠️ Still need:', '', '', ''],
            ['13', '  - Verify rent estimate', '', '', ''],
            ['14', '  - Add mortgage details', '', '', ''],
            ['15', '  - Check comps', '', '', ''],
          ].map(([row, ...cells]) => (
            <div key={row} className="flex border-b border-gray-100 hover:bg-blue-50/30">
              <div className="w-10 border-r border-gray-200 px-2 py-1.5 text-center text-xs text-gray-400 bg-gray-50 flex-shrink-0">{row}</div>
              {cells.map((cell, i) => (
                <div key={i} className={`w-48 border-r border-gray-100 px-2 py-1.5 text-xs truncate flex-shrink-0 ${
                  cell.startsWith('=') ? 'text-green-700 font-mono' :
                  cell === '❓' ? 'text-orange-400 text-center' :
                  cell.startsWith('⚠️') ? 'text-orange-600 font-bold' :
                  cell.startsWith('  -') ? 'text-gray-400' :
                  i === 0 ? 'text-gray-600 font-medium' : 'text-gray-900'
                }`}>
                  {cell}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-1 bg-gray-700 flex-shrink-0 relative">
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 flex items-center justify-center">
          <div className="bg-gray-600 text-gray-300 text-xs font-bold px-1.5 py-4 rounded-full writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>vs</div>
        </div>
      </div>

      {/* After — Icecap */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 h-10 bg-gray-800 flex items-center px-4 gap-2">
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">After</span>
          <span className="text-xs text-gray-500 ml-2">Icecap — instant analysis</span>
        </div>
        <div className="flex-1 bg-white overflow-hidden flex">
          {/* Mini listing */}
          <div className="flex-1 overflow-y-auto">
            <div className="h-40 bg-gray-200 overflow-hidden">
              <img src={PROPERTY.photo} alt="Property" className="w-full h-full object-cover" />
            </div>
            <div className="p-5">
              <h2 className="text-xl font-black text-gray-900">{PROPERTY.price}</h2>
              <p className="text-gray-600 font-medium">{PROPERTY.address}</p>
              <p className="text-gray-400 text-sm">{PROPERTY.city}</p>
              <div className="flex gap-4 mt-3 py-3 border-y border-gray-100 text-sm">
                <span className="font-bold text-gray-900">{PROPERTY.beds} bed</span>
                <span className="font-bold text-gray-900">{PROPERTY.baths} bath</span>
                <span className="font-bold text-gray-900">{PROPERTY.sqft} sqft</span>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium">Est. Rent</p>
                <p className="text-base font-black text-gray-900">{PROPERTY.rent}</p>
              </div>
            </div>
          </div>

          {/* Icecap panel (always triggered in split view) */}
          <div className="w-64 flex-shrink-0 border-l border-gray-200 flex flex-col bg-white">
            <div className="bg-blue-600 px-4 py-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-5 h-5 bg-white rounded flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-blue-600 rounded-sm" />
                </div>
                <span className="text-white font-black text-sm">Icecap</span>
              </div>
              <p className="text-blue-200 text-xs">Instant Analysis</p>
            </div>
            <div className="flex-1 p-3 space-y-2">
              {METRICS.map(m => (
                <div key={m.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-100 bg-white shadow-sm">
                  <span className="text-xs text-gray-500 font-medium">{m.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-gray-900">{m.value}</span>
                    {m.status === 'good' && <span className="bg-green-100 text-green-700 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">✓</span>}
                    {m.status === 'warn' && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">~</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 pb-4">
              <button className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl">Save Deal →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
