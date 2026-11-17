import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Crown, Check, CreditCard, ExternalLink, Zap, Shield, Sparkles, CheckCircle } from "lucide-react"
import { icecap } from "../../lib/icecap"
import { useAuth } from "../hooks/useAuth"

const FEATURES = [
  { icon: Zap, text: "Full extension on Redfin, Zillow & Realtor.com" },
  { icon: Shield, text: "Unlimited property saves & real-time sync" },
  { icon: Sparkles, text: "AI deal summaries & red flags, run on your own device" },
  { icon: Check, text: "Advanced Rental, Flip & BRRRR calculators" },
]

const SOURCE: Record<string, string> = { stripe: "Billed by Stripe", grant: "Given to your account" }

export function BillingPage() {
  const { pro, isPro, refreshPro } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [loadingPortal, setLoadingPortal] = useState(false)
  const result = params.get("pro")

  // Stripe's webhook can land a moment after the redirect back.
  useEffect(() => {
    if (result !== "success" || isPro) return
    const t = setInterval(refreshPro, 2500)
    return () => clearInterval(t)
  }, [result, isPro, refreshPro])

  const manage = async () => {
    setLoadingPortal(true)
    try {
      location.href = await icecap.pro.portal()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't open the billing portal.")
      setLoadingPortal(false)
    }
  }

  const plan = pro?.plan === "lifetime" ? "Lifetime" : pro?.plan === "annual" ? "Yearly" : null

  return (
    <div className="p-10 max-w-4xl">
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900">Subscription & Billing</h2>
        <p className="text-gray-400 font-medium mt-1">Manage your plan and billing details.</p>
      </div>
      {result === "success" && (
        <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-2xl mb-8 text-green-700">
          <CheckCircle size={20} />
          <p className="font-semibold">{isPro ? "You're all set: Icecap Pro is active." : "Payment received. Activating Icecap Pro…"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 bg-white rounded-4xl border border-gray-100 shadow-xs p-8 h-fit">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current plan</p>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black text-gray-900">{isPro ? `Icecap Pro${plan ? ` · ${plan}` : ""}` : "No plan"}</h3>
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${isPro ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {isPro ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Crown size={24} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Source</p>
              <p className="font-bold text-gray-900">{pro?.source ? SOURCE[pro.source] : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{pro?.plan === "annual" && pro.source === "stripe" ? "Renews" : "Until"}</p>
              <p className="font-bold text-gray-900">{isPro ? (pro?.until ? new Date(pro.until).toLocaleDateString() : "For good") : "—"}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {!isPro && (
              <button onClick={() => navigate("/subscribe")} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700">
                <ExternalLink size={16} />
                Get Icecap Pro
              </button>
            )}
            {pro?.manage === "stripe" && (
              <button onClick={manage} disabled={loadingPortal} className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50">
                <CreditCard size={16} />
                {loadingPortal ? "Loading…" : "Manage billing"}
              </button>
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-4xl p-8 text-white shadow-xl shadow-gray-200 h-fit">
          <h3 className="text-lg font-black mb-6">What Pro includes</h3>
          <ul className="space-y-6">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex gap-4">
                <f.icon size={18} className="text-blue-400 mt-1" />
                <p className="text-sm text-gray-300 font-medium leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
