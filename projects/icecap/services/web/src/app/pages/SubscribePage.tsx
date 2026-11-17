import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Crown, Check } from "lucide-react"
import type { ProOffer } from "@icecap/types"
import { icecap } from "../../lib/icecap"
import { useAuth } from "../hooks/useAuth"

const FEATURES = [
  "The extension on Redfin, Zillow & Realtor.com",
  "Unlimited saved deals, synced to this dashboard",
  "Rental, short-term rental, flip & BRRRR calculators",
  "AI deal summaries and the portfolio co-pilot, on your device",
]

const PLAN_COPY: Record<ProOffer["plan"], { name: string; period: string; note: (o: ProOffer) => string | null }> = {
  annual: { name: "Yearly", period: "/year", note: (o) => (o.trial_days ? `${o.trial_days}-day free trial on your first year` : null) },
  lifetime: { name: "Lifetime", period: " once", note: () => "Pay once, keep Pro for good" },
}

export function SubscribePage() {
  const { user, pro, loadingAuth } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const offers = pro?.offers ?? []

  const buy = async (plan: ProOffer["plan"]) => {
    if (!user) return navigate("/login")
    setBusy(plan)
    setError("")
    try {
      location.href = await icecap.pro.checkout(plan)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout. Please try again.")
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 font-semibold text-sm mb-4">
            <Crown size={16} className="text-yellow-500" />
            Icecap Pro
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">Invest smarter with Icecap</h1>
          <p className="text-gray-500 text-lg">One plan, everything included. Cancel anytime.</p>
        </div>

        {pro?.pro ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-green-100 text-center">
            <p className="font-bold text-gray-900 mb-4">You already have Icecap Pro.</p>
            <button onClick={() => navigate("/billing")} className="px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm">Go to Billing</button>
          </div>
        ) : !loadingAuth && user && !offers.length ? (
          <p className="text-center text-gray-500">Plans couldn't be loaded. Please try again in a moment.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {(offers.length ? offers : [{ plan: "annual", price: "", interval: "year", trial_days: 7 }, { plan: "lifetime", price: "", interval: null, trial_days: 0 }] as ProOffer[]).map((o) => {
              const copy = PLAN_COPY[o.plan]
              const highlighted = o.plan === "annual"
              return (
                <div key={o.plan} className={`bg-white rounded-3xl p-8 border-2 ${highlighted ? "border-blue-600 shadow-xl shadow-blue-100" : "border-gray-100 shadow-xs"}`}>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">{copy.name}</h2>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-black text-gray-900">{o.price || "—"}</span>
                    <span className="text-gray-400">{copy.period}</span>
                  </div>
                  {copy.note(o) && <p className="text-sm text-green-600 font-semibold mb-6">{copy.note(o)}</p>}
                  <ul className="space-y-3 mb-8">
                    {FEATURES.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                        <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => buy(o.plan)}
                    disabled={busy !== null || (!!user && !o.price)}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-60 ${highlighted ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-900 text-white hover:bg-gray-800"}`}
                    data-testid={`subscribe-${o.plan}`}
                  >
                    {busy === o.plan ? "Loading…" : !user ? "Sign in to subscribe" : o.plan === "annual" && o.trial_days && !pro?.had_purchase ? "Start free trial" : "Subscribe"}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <p className="text-center text-xs text-gray-400 mt-6">
          Payments by Stripe. Promotion codes can be entered at checkout. <a className="underline" href="/terms/">Terms</a> · <a className="underline" href="/privacy/">Privacy</a>
        </p>
      </div>
    </div>
  )
}
