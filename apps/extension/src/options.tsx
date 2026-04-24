import { useEffect, useState, useCallback, useMemo } from "react"
import { auth, googleProvider } from "./core/firebase"
import { HUB_URL, IS_DEV } from "./core/constants"
import { onAuthStateChanged, type User as FirebaseUser, signInWithPopup, signOut, signInWithEmailAndPassword } from "firebase/auth"
import { ExternalLink, LogOut, Calculator, RefreshCw, AlertCircle, LayoutDashboard } from "lucide-react"
import "./style.css"

export default function OptionsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const isLoginView = useMemo(() => {
    return new URLSearchParams(window.location.search).get("view") === "login"
  }, [])

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
      
      if (u && isLoginView) {
        window.close()
      }
    })
    return () => unsubscribeAuth()
  }, [isLoginView])

  const checkConnection = useCallback(async () => {
    if (!IS_DEV) return true
    try {
      await fetch("http://127.0.0.1:9099/", { mode: "no-cors" })
      return true
    } catch (e) {
      return false
    }
  }, [])

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true)
    setLoginError(null)
    const reachable = await checkConnection()
    if (!reachable) {
      setLoginError("Cannot reach Firebase Emulator at 127.0.0.1:9099. Ensure it is running.")
      setIsLoggingIn(false)
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e: any) {
      console.error("Login failed", e)
      setLoginError(e.message || "Authentication failed. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }, [checkConnection])

  const handleTestLogin = useCallback(async () => {
    if (!IS_DEV) return
    setIsLoggingIn(true)
    setLoginError(null)
    const email = "pro-user@icecap-test.com"
    const password = "TestPass123!"

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e: any) {
      if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
        try {
          const { createUserWithEmailAndPassword } = await import("firebase/auth")
          await createUserWithEmailAndPassword(auth, email, password)
        } catch (createErr: any) {
          setLoginError(`Test account creation failed: ${createErr.message}`)
        }
      } else {
        setLoginError(`Test login failed: ${e.message}`)
      }
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (e) {
      console.error("Logout failed", e)
    }
  }, [])

  const handleOpenHub = () => {
    window.open(HUB_URL, "_blank")
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <RefreshCw className="text-blue-600 animate-spin" size={32} />
      </div>
    )
  }

  if (!user || isLoginView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-gray-100">
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-blue-200 rotate-3">
            <Calculator size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Icecap Auth</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">Sign in to sync your analyses across all devices.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm text-left">
              <AlertCircle size={18} className="shrink-0" />
              <p>{loginError}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-8 rounded-2xl border-2 border-gray-100 shadow-sm transition-all disabled:opacity-50"
            >
              {isLoggingIn ? (
                <RefreshCw size={24} className="animate-spin text-blue-600" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
              )}
              {isLoggingIn ? "Signing in..." : "Continue with Google"}
            </button>

            {IS_DEV && (
              <button
                onClick={handleTestLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-2 text-blue-600 font-medium py-3 text-sm hover:underline"
              >
                <RefreshCw size={14} className={isLoggingIn ? "animate-spin" : ""} />
                Local Test Account Fallback
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center border border-gray-100">
        <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-blue-200">
          <LayoutDashboard size={40} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">Icecap Settings</h1>
        <p className="text-gray-500 mb-10 leading-relaxed">Portfolio management and deep analytics have moved to the Hub.</p>
        
        <div className="space-y-3">
          <button
            onClick={handleOpenHub}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            <ExternalLink size={20} />
            Open Icecap Hub
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 font-medium py-3 text-sm transition-colors"
          >
            <LogOut size={16} />
            Sign out of extension
          </button>
        </div>

        <footer className="mt-12 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
          Hub URL: {HUB_URL}
        </footer>
      </div>
    </div>
  )
}
