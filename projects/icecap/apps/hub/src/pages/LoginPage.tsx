import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithPopup, signInWithCredential } from "firebase/auth"
import { PieChart, LogIn, Beaker } from "lucide-react"
import { auth, googleProvider, useEmulator } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"

export function LoginPage() {
  const { user, loadingAuth } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!loadingAuth && user) navigate("/", { replace: true })
  }, [user, loadingAuth, navigate])

  const handleLogin = async () => {
    if (useEmulator) {
      setLoading(true)
      try {
        console.log("Emulator detected: Performing deterministic Google login...")
        const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth")
        const credential = GoogleAuthProvider.credential(
          JSON.stringify({
            sub: "google-raw-id-icecap-main-user-2026",
            email: "hi@icecap.com",
            email_verified: true
          }),
          "mock-google-token"
        )
        await signInWithCredential(auth, credential)
        return
      } catch (e) {
        console.error("Local mock login failed", e)
      } finally {
        setLoading(false)
      }
    }
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
        
        <div className="space-y-3">
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border-2 border-gray-100 py-4 rounded-2xl font-bold hover:bg-gray-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            data-testid="google-signin-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
            </svg>
            Sign in with Google
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400">Secure auth via Firebase</p>
      </div>
    </div>
  )
}
