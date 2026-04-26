import { useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { httpsCallable } from "firebase/functions"
import { Crown, Check, AlertTriangle, Tag } from "lucide-react"
import { functions } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { 
  CreateCheckoutSessionResponse, 
  SubscriptionTier, 
  ValidatePromoCodeResponse 
} from "@icecap/types"

const PLANS = [
  {
    id: "pro" as SubscriptionTier,
    name: "Pro",
    price: "$19",
    period: "/month",
    trial: "30-day free trial",
    features: [
      "Full extension on Redfin, Zillow & Realtor.com",
      "Unlimited property saves & sync",
      "Advanced Rental, Flip & BRRRR calculators",
      "50 AI Deal Summaries per month",
      "CSV export",
    ],
  },
  {
    id: "pro_max" as SubscriptionTier,
    name: "Pro Max",
    price: "$49",
    period: "/month",
    trial: null,
    features: [
      "Everything in Pro",
      "Unlimited AI Deal Summaries",
      "Priority support & feature requests",
      "Early access to new AI models",
      "Shared workspaces (coming soon)",
    ],
    highlighted: true,
  },
]

export function SubscribePage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [promoCode, setPromoCode] = useState("")
  const [loadingTier, setLoadingTier] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [isValidatingPromo, setIsValidatingPromo] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<ValidatePromoCodeResponse | null>(null)

  const reason = searchParams.get("reason")

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return
    
    setIsValidatingPromo(true)
    setError("")
    setAppliedPromo(null)
    
    try {
      const fn = httpsCallable<{ code: string }, ValidatePromoCodeResponse>(functions, "validatePromoCode")
      const result = await fn({ code: promoCode.trim() })
      
      if (result.data.valid) {
        setAppliedPromo(result.data)
      } else {
        setError("Invalid or expired promo code.")
      }
    } catch (e) {
      setError("Failed to validate promo code. Please try again.")
    } finally {
      setIsValidatingPromo(false)
    }
  }

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      navigate("/login")
      return
    }

    setLoadingTier(tier)
    setError("")
    try {
      const fn = httpsCallable<unknown, CreateCheckoutSessionResponse>(functions, "createCheckoutSession")
      const result = await fn({
        tier,
        promoCode: promoCode.trim() || undefined,
        successUrl: `${window.location.origin}/subscribe/success`,
        cancelUrl: `${window.location.origin}/subscribe/cancel`,
      })
      if (result.data.url) {
        window.location.href = result.data.url
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start checkout. Please try again.")
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        {reason === "past_due" && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl mb-8 text-red-700">
            <AlertTriangle size={20} />
            <p className="font-semibold">Your subscription is past due. Please update your billing to continue.</p>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-full text-blue-700 font-semibold text-sm mb-4">
            <Crown size={16} className="text-yellow-500" />
            Choose your plan
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-3">Invest smarter with Icecap</h1>
          <p className="text-gray-500 text-lg">Start free. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-3xl p-8 border-2 transition-all ${
                plan.highlighted ? "border-blue-600 shadow-xl shadow-blue-100" : "border-gray-100 shadow-sm"
              }`}
            >
              {plan.highlighted && (
                <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full mb-4">
                  Most Popular
                </div>
              )}
              <h2 className="text-2xl font-black text-gray-900 mb-1">{plan.name}</h2>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-black text-gray-900">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
              {plan.trial && (
                <p className="text-sm text-green-600 font-semibold mb-6">{plan.trial} included</p>
              )}
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <Check size={16} className="text-green-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingTier !== null}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all disabled:opacity-60 ${
                  plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
                    : "bg-gray-900 text-white hover:bg-gray-800"
                }`}
                data-testid={`subscribe-${plan.id}`}
              >
                {loadingTier === plan.id ? "Loading…" : plan.trial ? `Start Free Trial` : `Subscribe`}
              </button>
            </div>
          ))}
        </div>

        {/* Promo code */}
        <div className="max-w-sm mx-auto">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Have a promo code?</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase())
                if (error) setError("")
                if (appliedPromo) setAppliedPromo(null)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApplyPromo()
                }
              }}
              placeholder="PROMO CODE"
              disabled={isValidatingPromo}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl font-mono font-bold tracking-wider text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={handleApplyPromo}
              disabled={isValidatingPromo || !promoCode.trim()}
              className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {isValidatingPromo ? "..." : "Apply"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          {appliedPromo && (
            <div className="flex items-center gap-2 mt-2 text-green-600 font-semibold text-sm">
              <Tag size={14} />
              <span>{appliedPromo.discountDescription || "Promo code applied!"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
