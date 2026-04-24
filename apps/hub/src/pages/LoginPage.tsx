import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithPopup, signOut } from "firebase/auth"
import { PieChart, LogIn } from "lucide-react"
import { auth, googleProvider } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"

export function LoginPage() {
  const { user, loadingAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loadingAuth && user) navigate("/", { replace: true })
  }, [user, loadingAuth, navigate])

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      console.error("Login failed", e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-blue-50 max-w-md w-full text-center">
        <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-200">
          <PieChart size={32} />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Icecap Hub</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The ultimate command center for real estate investors. Sync analyses from Redfin & Zillow
          in real time.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          data-testid="google-signin-btn"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>
        <p className="mt-6 text-xs text-gray-400">Secure auth via Firebase</p>
      </div>
    </div>
  )
}
