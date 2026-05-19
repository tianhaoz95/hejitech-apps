import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IcecapPanel } from './IcecapPanel'
import { PROPERTY } from './data'

interface SiteTheme {
  name: string
  navBg: string
  navText: string
  accentBg: string
  accentText: string
  logo: string
}

interface Props {
  theme: SiteTheme
}

export function ListingMockup({ theme }: Props) {
  const [searchParams] = useSearchParams()
  const screenshotMode = searchParams.get('screenshot') === '1'
  const [triggered, setTriggered] = useState(screenshotMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        setTriggered(t => !t)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white select-none">
      {/* Site Nav */}
      <nav className="flex-shrink-0 h-14 flex items-center px-6 gap-8" style={{ backgroundColor: theme.navBg }}>
        <span className="text-lg font-black tracking-tight" style={{ color: theme.navText }}>
          {theme.logo}
        </span>
        <div className="flex items-center gap-6 text-sm font-medium" style={{ color: `${theme.navText}99` }}>
          <span>Buy</span>
          <span>Rent</span>
          <span>Sell</span>
          <span>Mortgage</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button className="text-sm font-semibold px-4 py-1.5 rounded-full border" style={{ borderColor: `${theme.navText}40`, color: theme.navText }}>
            Sign In
          </button>
          <button className="text-sm font-semibold px-4 py-1.5 rounded-full text-white" style={{ backgroundColor: theme.accentBg }}>
            Join
          </button>
        </div>
      </nav>

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Listing */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero photo */}
          <div className="relative h-72 bg-gray-200 overflow-hidden">
            <img
              src={PROPERTY.photo}
              alt="Property"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          {/* Listing details */}
          <div className="px-8 py-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-black text-gray-900">{PROPERTY.price}</h1>
                <p className="text-lg text-gray-700 font-medium mt-1">{PROPERTY.address}</p>
                <p className="text-gray-500">{PROPERTY.city}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: theme.accentBg }}>
                  For Sale
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 py-4 border-y border-gray-100 mb-6">
              {[
                { label: 'Beds', value: PROPERTY.beds },
                { label: 'Baths', value: PROPERTY.baths },
                { label: 'Sq Ft', value: PROPERTY.sqft },
                { label: 'Year Built', value: PROPERTY.yearBuilt },
                { label: 'Lot Size', value: PROPERTY.lotSize },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-lg font-black text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Description placeholder */}
            <div className="space-y-2">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
              <div className="h-3 bg-gray-100 rounded w-4/6" />
              <div className="mt-4 h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>

            {/* Est. rent */}
            <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">Est. Monthly Rent</p>
              <p className="text-xl font-black text-gray-900">{PROPERTY.rent}</p>
              <p className="text-xs text-gray-400 mt-0.5">Zestimate® Rent</p>
            </div>
          </div>
        </div>

        {/* Icecap Panel */}
        <IcecapPanel triggered={triggered} />
      </div>

      {/* Trigger control — hidden in screenshot mode */}
      {!screenshotMode && (
        <button
          onClick={() => setTriggered(t => !t)}
          className="fixed bottom-4 left-4 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-2 rounded-full backdrop-blur transition-colors z-50"
        >
          {triggered ? '↺ Reset' : '▶ Trigger'}
        </button>
      )}
    </div>
  )
}
