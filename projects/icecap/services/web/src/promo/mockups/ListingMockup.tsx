import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Share2, ChevronDown, Home, Building2, MapPin } from 'lucide-react'
import { IcecapPanel } from './IcecapPanel'
import { PROPERTY } from './data'

const SITE_ICON: Record<string, React.ReactNode> = {
  redfin: <Home size={16} className="text-white" />,
  zillow: <Building2 size={16} className="text-white" />,
  realtor: <MapPin size={16} className="text-white" />,
}

interface SiteTheme {
  id: string
  name: string
  navBg: string
  logo: string
  // Path to a real listing screenshot captured by capture-promo-screenshots.ts.
  // When set, the screenshot is used as the listing background instead of the
  // fake HTML content. Leave undefined to use the fake content.
  screenshotSrc?: string
}

interface Props {
  theme: SiteTheme
}

const FEATURES = ['Single Family', 'Central AC', 'Garage', 'Updated Kitchen', 'Hardwood Floors', 'Large Backyard']
const TAGS = ['Price Reduced', 'Open House Sat', 'Hot Home']

function FakeListing({ theme }: { theme: SiteTheme }) {
  return (
    <div>
      {/* Hero photo */}
      <div className="relative">
        <img src={PROPERTY.photo} alt="Property exterior" className="w-full object-cover" style={{ height: 300 }} />
        <div className="absolute inset-0 bg-linear-to-t from-black/30 via-transparent to-transparent" />
        <button className="absolute bottom-4 right-4 bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-xs">
          1 / 24 photos
        </button>
        <div className="absolute top-4 left-4 flex gap-2">
          <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{TAGS[0]}</span>
          <span className="bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{TAGS[2]}</span>
        </div>
      </div>

      {/* Listing details */}
      <div className="px-8 py-6 max-w-3xl">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-gray-900">{PROPERTY.price}</h1>
            <p className="text-gray-500 text-sm mt-1 font-medium">Est. $2,847/mo · 30yr fixed · Get pre-qualified</p>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button className="p-2.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors">
              <Heart size={18} />
            </button>
            <button className="p-2.5 rounded-full border border-gray-200 hover:bg-gray-50 text-gray-400 transition-colors">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-1">{PROPERTY.address}</h2>
        <p className="text-gray-500 mb-5">{PROPERTY.city}</p>

        <div className="flex items-center gap-px mb-6">
          {[
            { label: 'Beds', value: PROPERTY.beds },
            { label: 'Baths', value: PROPERTY.baths },
            { label: 'Sq Ft', value: PROPERTY.sqft },
            { label: 'Built', value: PROPERTY.yearBuilt },
            { label: 'Lot', value: PROPERTY.lotSize },
          ].map((s, i, arr) => (
            <div key={s.label} className={`flex-1 text-center py-4 ${i < arr.length - 1 ? 'border-r border-gray-100' : ''} bg-gray-50 ${i === 0 ? 'rounded-l-xl' : ''} ${i === arr.length - 1 ? 'rounded-r-xl' : ''}`}>
              <p className="text-xl font-black text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {FEATURES.map(f => (
            <span key={f} className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">{f}</span>
          ))}
        </div>

        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Est. Monthly Rent</p>
              <p className="text-2xl font-black text-gray-900">{PROPERTY.rent}</p>
              <p className="text-xs text-gray-400 mt-0.5">Based on comparable rentals in 78704</p>
            </div>
            <button className="text-sm text-gray-400 flex items-center gap-1">
              Details <ChevronDown size={14} />
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Property Details</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3">
            {[
              ['Property Type', PROPERTY.type],
              ['Year Built', PROPERTY.yearBuilt],
              ['Lot Size', PROPERTY.lotSize],
              ['Parking', '2-car garage'],
              ['HOA', 'None'],
              ['Tax (annual)', '$8,240'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-400">{label}</span>
                <span className="text-sm font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ListingMockup({ theme }: Props) {
  const [searchParams] = useSearchParams()
  const screenshotMode = searchParams.get('screenshot') === '1'
  const [triggered, setTriggered] = useState(screenshotMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setTriggered(t => !t) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white select-none">
      {/* Nav */}
      <nav className="shrink-0 h-13 flex items-center px-5 gap-6" style={{ backgroundColor: theme.navBg, height: 52 }}>
        <div className="flex items-center gap-1.5">
          {SITE_ICON[theme.id]}
          <span className="text-white font-black text-base tracking-tight">{theme.logo}</span>
        </div>
        <div className="flex items-center gap-5 text-sm font-medium text-white/70">
          <span className="hover:text-white cursor-pointer">Buy</span>
          <span className="hover:text-white cursor-pointer">Rent</span>
          <span className="hover:text-white cursor-pointer">Sell</span>
          <span className="hover:text-white cursor-pointer">Mortgage</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button className="text-sm font-semibold text-white/80 hover:text-white px-3 py-1.5">Sign In</button>
          <button className="text-sm font-bold text-white bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors">
            Join
          </button>
        </div>
      </nav>

      {/* Sub-nav breadcrumb */}
      <div className="shrink-0 h-9 bg-gray-50 border-b border-gray-100 flex items-center px-6 gap-1 text-xs text-gray-400">
        <span className="hover:underline cursor-pointer">Austin</span>
        <span>/</span>
        <span className="hover:underline cursor-pointer">78704</span>
        <span>/</span>
        <span className="text-gray-700 font-medium">2847 Maplewood Drive</span>
      </div>

      {/* Main content area — relative so the panel can overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* Listing content — full width, scrollable */}
        <div className="absolute inset-0 overflow-y-auto">
          {theme.screenshotSrc ? (
            /* Real screenshot — populated after running capture:promo */
            <img src={theme.screenshotSrc} alt="Listing screenshot" className="w-full block" />
          ) : (
            /* Fake listing content — fallback when no screenshot exists */
            <FakeListing theme={theme} />
          )}
        </div>

        {/* Icecap Panel — slides in as overlay from the right */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-80 flex flex-col transform transition-transform duration-500 ease-out z-10 ${
            triggered ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <IcecapPanel triggered={triggered} />
        </div>
      </div>

      {/* Trigger control */}
      {!screenshotMode && (
        <button
          onClick={() => setTriggered(t => !t)}
          className="fixed bottom-5 left-5 bg-gray-900/80 hover:bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-full backdrop-blur-xs shadow-lg transition-colors z-50 flex items-center gap-2"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${triggered ? 'bg-green-400' : 'bg-gray-500'}`} />
          {triggered ? 'Reset panel' : 'Trigger Icecap ▶'}
        </button>
      )}
    </div>
  )
}
