import { useState, useRef, useEffect } from "react"
import { Chrome, BarChart2, Sparkles, Check, ArrowRight, Shield, Zap, ChevronDown, Globe, Compass, Flame, Download } from "lucide-react"

const HUB_URL = "http://localhost:5173"
const CHROME_STORE_URL = "#"
const FIREFOX_URL = "#"
const SAFARI_URL = "#"
const EDGE_URL = "#"
const SIDELOAD_URL = "https://storage.googleapis.com/icecap-platform.firebasestorage.app/extension/download/icecap-extension.zip"
const LEGAL_URL = "http://localhost:5176"

const BROWSERS = [
  { name: "Chrome", icon: Chrome, url: CHROME_STORE_URL },
  { name: "Firefox", icon: Flame, url: FIREFOX_URL },
  { name: "Safari", icon: Compass, url: SAFARI_URL },
  { name: "Edge", icon: Globe, url: EDGE_URL },
  { name: "Sideload (.zip)", icon: Download, url: SIDELOAD_URL },
]

export default function App() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo-color.svg" alt="Icecap" className="h-9" />
          </div>
          <div className="flex items-center gap-6 text-sm font-semibold text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Pricing</a>
            <a href={LEGAL_URL} className="hover:text-gray-900 transition-colors">Legal</a>
            <a
              href={HUB_URL}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
            >
              Sign In
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-4 py-2 rounded-full text-blue-700 text-sm font-semibold mb-8">
            <Zap size={14} fill="currentColor" />
            Analyze 50 deals in 5 minutes
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-[1.05] mb-6">
            Real estate math,<br />
            <span className="text-blue-600">at the speed of browsing.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Icecap is a Chrome extension that overlays live investment metrics directly from your favorite listing
            source — Redfin, Zillow, Realtor.com, and more — no spreadsheets required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <div className="flex items-stretch shadow-xl shadow-blue-100/50 rounded-2xl transform hover:scale-[1.01] transition-all active:scale-[0.99]" ref={dropdownRef}>
              <a
                href={CHROME_STORE_URL}
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 text-lg font-bold hover:bg-blue-700 transition-colors border-r border-blue-500/30 rounded-l-2xl"
              >
                <Chrome size={22} />
                Add to Chrome — Free
              </a>
              <div className="relative flex">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-blue-600 text-white px-4 hover:bg-blue-700 transition-colors flex items-center justify-center rounded-r-2xl"
                  aria-label="Other browsers"
                >
                  <ChevronDown size={20} className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <p className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">Available Browsers</p>
                    {BROWSERS.map((b) => (
                      <a
                        key={b.name}
                        href={b.url}
                        download={b.name.includes("Sideload") ? "icecap-extension.zip" : undefined}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors text-left"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <b.icon size={18} className="text-gray-400" />
                        {b.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <a
              href={HUB_URL}
              className="flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-gray-800 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
            >
              Open Hub Dashboard
              <ArrowRight size={18} />
            </a>
          </div>

          <p className="mt-4 text-sm text-gray-400">Join 1,000+ real estate investors on Icecap</p>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-black text-gray-900 mb-4">The old way is broken.</h2>
              <div className="space-y-4 text-gray-500">
                {[
                  "Browse listing on Redfin",
                  "Copy price to Excel spreadsheet",
                  "Search Zillow Zestimate for rent",
                  "Manually calculate cap rate, cash flow",
                  "Repeat 50 times. Miss a deal.",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-red-500 text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className={i === 4 ? "font-bold text-red-500" : ""}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-black text-gray-900 mb-4">The Icecap way.</h2>
              <div className="space-y-4 text-gray-500">
                {[
                  "Browse Redfin — metrics appear automatically",
                  "Click Analyze for full financial breakdown",
                  "Adjust sliders to model different scenarios",
                  "Save to Hub with one click",
                  "Close 3 deals this month.",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 text-xs font-black flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className={i === 4 ? "font-bold text-green-600" : ""}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 mb-3">Everything you need</h2>
            <p className="text-xl text-gray-500">Built for serious investors, accessible to beginners.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                Icon: Chrome,
                title: "The Extension",
                color: "bg-blue-100 text-blue-600",
                features: [
                  "Auto-scrape price, taxes, HOA",
                  "Rental & Flip calculators",
                  "Map badge overlays",
                  "AI deal summaries (on demand)",
                  "Redfin, Zillow & Realtor.com",
                ],
              },
              {
                Icon: BarChart2,
                title: "The Hub",
                color: "bg-green-100 text-green-600",
                features: [
                  "Portfolio dashboard",
                  "Side-by-side deal comparison",
                  "Real-time sync from extension",
                  "CSV export",
                  "Mobile-first design",
                ],
              },
              {
                Icon: Sparkles,
                title: "AI Co-Pilot",
                color: "bg-purple-100 text-purple-600",
                features: [
                  "Red flag detection",
                  "Rehab cost estimation",
                  "Market context (Gemini)",
                  "On-demand only (no auto-billing)",
                  "Quota usage display",
                ],
              },
            ].map(({ Icon, title, color, features }) => (
              <div key={title} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center mb-6`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-4">{title}</h3>
                <ul className="space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-gray-900 mb-3">Simple pricing</h2>
          <p className="text-xl text-gray-500 mb-16">Start free. Upgrade when you're ready.</p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                name: "Pro",
                price: "$19",
                period: "/month",
                trial: null,
                cta: "Get Started Now",
                features: [
                  "All 3 listing sites",
                  "Unlimited property saves",
                  "Rental, Flip & BRRRR calculators",
                  "50 AI analyses/month",
                  "CSV export",
                ],
              },
              {
                name: "Pro Max",
                price: "$49",
                period: "/month",
                trial: null,
                cta: "Subscribe",
                highlighted: true,
                features: [
                  "Everything in Pro",
                  "Unlimited AI analyses",
                  "Priority support",
                  "Early access to new features",
                  "Shared workspaces (coming soon)",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-3xl border-2 text-left ${
                  plan.highlighted ? "border-blue-600 shadow-xl shadow-blue-50" : "border-gray-100"
                }`}
              >
                <h3 className="text-2xl font-black text-gray-900 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-gray-400">{plan.period}</span>
                </div>
                {plan.trial && (
                  <p className="text-green-600 text-sm font-semibold mb-6">{plan.trial} included</p>
                )}
                <ul className="space-y-2 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check size={14} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`${HUB_URL}/subscribe`}
                  className={`block w-full text-center py-3.5 rounded-2xl font-bold text-sm transition-all ${
                    plan.highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img src="/logo-color.svg" alt="Icecap" className="h-7" />
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href={`${HUB_URL}`} className="hover:text-gray-900 transition-colors">Hub Dashboard</a>
            <a href={`${LEGAL_URL}/privacy`} className="hover:text-gray-900 transition-colors">Privacy Policy</a>
            <a href={`${LEGAL_URL}/terms`} className="hover:text-gray-900 transition-colors">Terms of Service</a>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Shield size={14} />
            <span>Data secured by Firebase</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
