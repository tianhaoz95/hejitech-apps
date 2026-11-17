import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { httpsCallable } from "firebase/functions"
import { Crown, Check, CreditCard, ExternalLink, Zap, Shield, Sparkles } from "lucide-react"
import { functions } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"

const FEATURES = [
  { icon: Zap, text: "Full extension on Redfin, Zillow & Realtor.com" },
  { icon: Shield, text: "Unlimited property saves & real-time sync" },
  { icon: Sparkles, text: "AI-powered deal summaries & red flag detection" },
  { icon: Check, text: "Advanced Rental, Flip & BRRRR calculators" },
]

export function BillingPage() {
  const { user, subscription, isSubscribed } = useAuth()
  const navigate = useNavigate()
  const [loadingPortal, setLoadingPortal] = useState(false)

  const handleManageBilling = async () => {
    setLoadingPortal(true)
    try {
      const fn = httpsCallable<unknown, { url: string }>(functions, "createPortalSession")
      const result = await fn({ returnUrl: window.location.href })
      if (result.data.url) {
        window.location.href = result.data.url
      }
    } catch (e) {
      console.error("Failed to open billing portal", e)
      alert("Failed to open billing portal. If you haven't subscribed yet, please upgrade first.")
    } finally {
      setLoadingPortal(false)
    }
  }

  return (
    <div className="p-10 max-w-4xl">
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold text-gray-900">Subscription & Billing</h2>
        <p className="text-gray-400 font-medium mt-1">Manage your plan and billing details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Current Plan Card */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-4xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Status</p>
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-black text-gray-900 capitalize">
                      {subscription?.tier?.replace("_", " ") ?? "Free"} Plan
                    </h3>
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                      isSubscribed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {subscription?.status ?? "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Crown size={24} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Billing Cycle</p>
                  <p className="font-bold text-gray-900">Monthly</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Next Payment</p>
                  <p className="font-bold text-gray-900">
                    {subscription?.currentPeriodEnd 
                      ? new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate("/subscribe")}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
                >
                  <ExternalLink size={16} />
                  {isSubscribed ? "Change Plan" : "Upgrade Now"}
                </button>
                {subscription?.stripeCustomerId && (
                  <button
                    onClick={handleManageBilling}
                    disabled={loadingPortal}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all"
                  >
                    <CreditCard size={16} />
                    {loadingPortal ? "Loading…" : "Manage Billing"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AI Usage Card */}
          <div className="bg-white rounded-4xl border border-gray-100 shadow-xs p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Sparkles size={20} className="text-purple-600" />
                AI Quota Usage
              </h3>
              <span className="text-sm font-bold text-gray-400">
                {subscription?.aiUsageCurrentMonth ?? 0} / {subscription?.aiQuotaLimit === Infinity ? "∞" : subscription?.aiQuotaLimit ?? 0}
              </span>
            </div>
            
            <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-4">
              <div 
                className="bg-purple-600 h-full transition-all duration-500"
                style={{ 
                  width: `${subscription?.aiQuotaLimit === Infinity 
                    ? 100 
                    : Math.min(100, ((subscription?.aiUsageCurrentMonth ?? 0) / (subscription?.aiQuotaLimit ?? 1)) * 100)}%` 
                }}
              />
            </div>
            
            <p className="text-sm text-gray-500">
              {subscription?.tier === "pro_max" 
                ? "You have unlimited AI Deal Summaries included in your Pro Max plan."
                : "Your AI quota resets at the start of your next billing cycle."}
            </p>
          </div>
        </div>

        {/* Features list */}
        <div className="bg-gray-900 rounded-4xl p-8 text-white shadow-xl shadow-gray-200 h-fit">
          <h3 className="text-lg font-black mb-6">Premium Features</h3>
          <ul className="space-y-6">
            {FEATURES.map((f, i) => (
              <li key={i} className="flex gap-4">
                <div className="mt-1">
                  <f.icon size={18} className="text-blue-400" />
                </div>
                <p className="text-sm text-gray-300 font-medium leading-relaxed">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
