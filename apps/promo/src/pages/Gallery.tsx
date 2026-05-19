import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

const ASSETS = [
  {
    id: 'mockup/redfin',
    title: 'Redfin Listing',
    category: 'Mockup',
    description: 'Full listing page with Icecap overlay. Press Space to trigger animation.',
    color: '#cc1818',
    screenshotPath: '/mockup/redfin?screenshot=1',
  },
  {
    id: 'mockup/zillow',
    title: 'Zillow Listing',
    category: 'Mockup',
    description: 'Zillow-branded listing with Icecap overlay. Press Space to trigger animation.',
    color: '#1277e1',
    screenshotPath: '/mockup/zillow?screenshot=1',
  },
  {
    id: 'mockup/realtor',
    title: 'Realtor.com Listing',
    category: 'Mockup',
    description: 'Realtor.com listing with Icecap overlay. Press Space to trigger animation.',
    color: '#d0021b',
    screenshotPath: '/mockup/realtor?screenshot=1',
  },
  {
    id: 'mockup/hub',
    title: 'Hub Dashboard',
    category: 'Mockup',
    description: 'Portfolio view and AI deal summary with typewriter animation.',
    color: '#2563eb',
    screenshotPath: '/mockup/hub?screenshot=1',
  },
  {
    id: 'split',
    title: 'Before / After',
    category: 'Ad Asset',
    description: 'Side-by-side split: manual spreadsheet vs Icecap instant analysis.',
    color: '#374151',
    screenshotPath: '/split',
  },
]

export function Gallery() {
  const navigate = useNavigate()

  const categories = Array.from(new Set(ASSETS.map(a => a.category)))

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-gray-900">Promo Studio</h1>
          <p className="text-gray-500 mt-1">Mockups and ad assets for Icecap marketing. All pages are screenshot-ready.</p>
        </div>

        {categories.map(cat => (
          <div key={cat} className="mb-10">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{cat}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ASSETS.filter(a => a.category === cat).map(asset => (
                <div key={asset.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all">
                  {/* Color swatch */}
                  <div className="h-24 flex items-center justify-center" style={{ backgroundColor: `${asset.color}15` }}>
                    <div className="w-12 h-12 rounded-xl" style={{ backgroundColor: asset.color }} />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-gray-900">{asset.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{asset.category}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">{asset.description}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/${asset.id}`)}
                        className="flex-1 py-2 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-colors"
                      >
                        Open
                      </button>
                      <a
                        href={asset.screenshotPath}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 hover:border-gray-300 text-gray-600 text-sm font-semibold rounded-xl transition-colors"
                        title="Open in new tab (screenshot mode)"
                      >
                        <ExternalLink size={14} />
                        Screenshot
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
