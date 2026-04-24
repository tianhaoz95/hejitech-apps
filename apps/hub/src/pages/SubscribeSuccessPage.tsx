import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle } from "lucide-react"

export function SubscribeSuccessPage() {
  const navigate = useNavigate()
  useEffect(() => {
    const t = setTimeout(() => navigate("/"), 5000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-green-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={36} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">You're all set!</h1>
        <p className="text-gray-500 mb-6">Your subscription is now active. Welcome to Icecap Pro.</p>
        <p className="text-sm text-gray-400">Redirecting to your dashboard in 5 seconds…</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 w-full py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors"
          data-testid="go-to-dashboard"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}
