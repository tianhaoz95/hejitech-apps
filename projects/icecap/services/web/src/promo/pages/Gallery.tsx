import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { ExternalLink, ArrowRight, LogOut } from 'lucide-react'
import { auth } from '../core/firebase'

const LISTING_NAV_COLORS = {
  redfin: '#cc1818',
  zillow: '#1277e1',
  realtor: '#d0021b',
}

function BrowserChrome() {
  return (
    <div className="h-6 bg-gray-100 border-b border-gray-200 flex items-center px-2.5 gap-1.5 shrink-0">
      <div className="w-2 h-2 rounded-full bg-red-300" />
      <div className="w-2 h-2 rounded-full bg-yellow-300" />
      <div className="w-2 h-2 rounded-full bg-green-300" />
      <div className="flex-1 mx-2 h-3 bg-white rounded-xs border border-gray-200" />
    </div>
  )
}

function ListingPreview({ navColor }: { navColor: string }) {
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden">
      <BrowserChrome />
      <div className="h-6 shrink-0 flex items-center px-3 gap-4" style={{ backgroundColor: navColor }}>
        <div className="h-2.5 w-10 bg-white/40 rounded-full" />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-2 w-6 bg-white/20 rounded-full" />)}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 min-w-0">
          <div className="h-16 bg-linear-to-br from-gray-300 to-gray-200 shrink-0" />
          <div className="p-2 space-y-1.5">
            <div className="h-3 bg-gray-800 rounded-sm w-1/3" />
            <div className="h-2 bg-gray-300 rounded-sm w-1/2" />
            <div className="flex gap-1 mt-2">
              {[1, 2, 3].map(i => <div key={i} className="h-3 flex-1 bg-gray-100 rounded-sm border border-gray-200" />)}
            </div>
          </div>
        </div>
        <div className="w-16 border-l border-gray-100 shrink-0 flex flex-col">
          <div className="h-7 shrink-0" style={{ backgroundColor: '#2563eb' }} />
          <div className="flex-1 bg-white p-1.5 space-y-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-3.5 bg-gray-50 rounded-sm border border-gray-100 flex items-center justify-end pr-1">
                <div className={`w-2 h-2 rounded-full ${i <= 2 ? 'bg-green-300' : 'bg-yellow-200'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function HubPreview() {
  return (
    <div className="w-full h-full bg-gray-50 flex flex-col overflow-hidden">
      <BrowserChrome />
      <div className="h-7 bg-white border-b border-gray-100 flex items-center px-3 gap-3 shrink-0">
        <div className="w-4 h-4 bg-blue-600 rounded-sm" />
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="h-2 w-8 bg-gray-100 rounded-sm" />)}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 bg-white border-r border-gray-100 shrink-0 p-1.5 space-y-1">
          {[1, 2, 3, 4].map(i => <div key={i} className={`h-3 rounded-sm ${i === 1 ? 'bg-blue-100' : 'bg-gray-100'}`} />)}
        </div>
        <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-white rounded-lg border border-gray-100 flex items-center px-1.5 gap-1.5">
              <div className="w-7 h-5 bg-gray-200 rounded-sm shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 bg-gray-200 rounded-sm w-3/4" />
                <div className="h-1 bg-gray-100 rounded-sm w-1/2" />
              </div>
              <div className="flex gap-1">
                <div className="h-2 w-5 bg-green-100 rounded-full" />
                <div className="h-2 w-5 bg-green-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SplitPreview() {
  return (
    <div className="w-full h-full bg-gray-900 flex overflow-hidden">
      <div className="flex-1 flex flex-col">
        <div className="h-5 bg-gray-800 flex items-center px-2 shrink-0">
          <span className="text-[7px] text-red-400 font-bold uppercase tracking-widest">Before</span>
        </div>
        <div className="flex-1 bg-white p-1.5 space-y-1 overflow-hidden">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex gap-0.5 h-2.5">
              <div className="w-4 bg-gray-50 rounded-xs border border-gray-100 shrink-0" />
              <div className="flex-1 bg-gray-50 rounded-xs border border-gray-100" />
              <div className="flex-1 bg-gray-50 rounded-xs border border-gray-100" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-px bg-gray-600 shrink-0" />
      <div className="flex-1 flex flex-col">
        <div className="h-5 bg-gray-800 flex items-center px-2 shrink-0">
          <span className="text-[7px] text-green-400 font-bold uppercase tracking-widest">After</span>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 bg-white p-1.5">
            <div className="h-10 bg-linear-to-br from-gray-300 to-gray-200 rounded-sm mb-1.5" />
            <div className="h-2 bg-gray-200 rounded-sm w-2/3 mb-1" />
            <div className="h-1.5 bg-gray-100 rounded-sm w-1/2" />
          </div>
          <div className="w-12 bg-white border-l border-gray-100 flex flex-col shrink-0">
            <div className="h-5 bg-blue-600 shrink-0" />
            <div className="flex-1 p-1 space-y-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-3 bg-gray-50 rounded-sm border border-gray-100 flex items-center justify-end pr-0.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${i <= 2 ? 'bg-green-300' : 'bg-yellow-200'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ASSETS = [
  {
    id: 'mockup/redfin',
    title: 'Redfin Listing',
    category: 'Mockup',
    description: 'Full listing page with animated Icecap overlay. Press Space to trigger.',
    screenshotPath: '/mockup/redfin?screenshot=1',
    preview: <ListingPreview navColor={LISTING_NAV_COLORS.redfin} />,
  },
  {
    id: 'mockup/zillow',
    title: 'Zillow Listing',
    category: 'Mockup',
    description: 'Zillow-branded listing with animated Icecap overlay. Press Space to trigger.',
    screenshotPath: '/mockup/zillow?screenshot=1',
    preview: <ListingPreview navColor={LISTING_NAV_COLORS.zillow} />,
  },
  {
    id: 'mockup/realtor',
    title: 'Realtor.com Listing',
    category: 'Mockup',
    description: 'Realtor.com listing with animated Icecap overlay. Press Space to trigger.',
    screenshotPath: '/mockup/realtor?screenshot=1',
    preview: <ListingPreview navColor={LISTING_NAV_COLORS.realtor} />,
  },
  {
    id: 'mockup/hub',
    title: 'Hub Dashboard',
    category: 'Mockup',
    description: 'Portfolio + AI deal summary with typewriter animation.',
    screenshotPath: '/mockup/hub?screenshot=1',
    preview: <HubPreview />,
  },
  {
    id: 'split',
    title: 'Before / After',
    category: 'Ad Asset',
    description: 'Side-by-side split: manual spreadsheet vs Icecap instant analysis.',
    screenshotPath: '/split',
    preview: <SplitPreview />,
  },
]

const categories = ['Mockup', 'Ad Asset']

export function Gallery({ user }: { user: User }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <img src="/logo-color.svg" alt="Icecap" className="h-8" />
          <div className="h-5 w-px bg-gray-200" />
          <div>
            <h1 className="text-sm font-black text-gray-900 leading-none">Promo Studio</h1>
            <p className="text-xs text-gray-400 mt-0.5">Marketing mockups &amp; ad assets</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-1.5 text-gray-400 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title={user.email || ''}
            >
              <LogOut size={12} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {categories.map(cat => (
          <div key={cat} className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{cat}</h2>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {ASSETS.filter(a => a.category === cat).map(asset => (
                <div
                  key={asset.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-gray-200 transition-all duration-200 group"
                >
                  {/* Mini preview */}
                  <div className="h-44 overflow-hidden border-b border-gray-100 bg-gray-50">
                    {asset.preview}
                  </div>

                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1.5">
                      <h3 className="font-bold text-gray-900 text-sm">{asset.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 shrink-0 ml-2">
                        {asset.category}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 leading-relaxed">{asset.description}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/${asset.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors"
                      >
                        Open
                        <ArrowRight size={12} />
                      </button>
                      <a
                        href={`#/${asset.screenshotPath}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-500 text-xs font-semibold rounded-xl transition-colors"
                        title="Open in new tab (screenshot mode)"
                      >
                        <ExternalLink size={12} />
                        Screenshot
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-center text-xs text-gray-300 mt-4">
          Add new assets in <code className="font-mono bg-gray-100 px-1.5 py-0.5 rounded-sm text-gray-400">apps/promo/src/</code>
        </p>
      </div>
    </div>
  )
}
