import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { httpsCallable } from "firebase/functions"
import { CheckCircle, CreditCard, ArrowRight } from "lucide-react"
import { functions } from "../core/firebase"

export function SubscribeSuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loadingPortal, setLoadingPortal] = useState(false)
  
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    // Only auto-redirect if there's no session_id (which might mean they want to manage billing)
    if (!sessionId) {
      const t = setTimeout(() => navigate("/"), 5000)
      return () => clearTimeout(t)
    }
  }, [navigate, sessionId])

  const handleManageBilling = async () => {
    setLoadingPortal(true)
    try {
      const fn = httpsCallable<{ returnUrl: string; sessionId?: string }, { url: string }>(functions, "createPortalSession")
      const result = await fn({ 
        returnUrl: window.location.origin + "/billing",
        sessionId: sessionId || undefined
      })
      if (result.data.url) {
        window.location.href = result.data.url
      }
    } catch (e) {
      console.error("Failed to open billing portal", e)
      alert("Failed to open billing portal. You can try again from the Billing page.")
    } finally {
      setLoadingPortal(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-green-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={36} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">You're all set!</h1>
        <p className="text-gray-500 mb-8">Your subscription is now active. Welcome to the Icecap community.</p>
        
        <div className="space-y-3">
          <button
            onClick={() => navigate("/")}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
          >
            Go to Dashboard
            <ArrowRight size={18} />
          </button>
          
          <button
            onClick={handleManageBilling}
            disabled={loadingPortal}
            className="w-full py-4 bg-white border-2 border-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
          >
            <CreditCard size={18} />
            {loadingPortal ? "Loading Portal…" : "Manage Billing"}
          </button>
        </div>

        {!sessionId && (
          <p className="mt-8 text-xs text-gray-400">Redirecting to your dashboard in 5 seconds…</p>
        )}
      </div>
    </div>
  )
}
