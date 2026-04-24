import { useNavigate } from "react-router-dom"
import { XCircle } from "lucide-react"

export function SubscribeCancelPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={36} className="text-gray-400" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Checkout cancelled</h1>
        <p className="text-gray-500 mb-6">No worries! You can subscribe whenever you're ready.</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/subscribe")}
            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
