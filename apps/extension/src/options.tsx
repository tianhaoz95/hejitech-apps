import { useEffect, useState, useCallback, useMemo } from "react"
import { usePropertyStore } from "./core/store"
import { db, auth, googleProvider } from "./core/firebase"
import { collection, query, onSnapshot, orderBy } from "firebase/firestore"
import { onAuthStateChanged, type User as FirebaseUser, signInWithPopup, signOut, signInWithEmailAndPassword } from "firebase/auth"
import { LayoutDashboard, Home, TrendingUp, ExternalLink, Trash2, PieChart, Map as MapIcon, Plus, LogOut, LogIn, Calculator, RefreshCw, AlertCircle } from "lucide-react"
import "./style.css"

export default function OptionsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isCheckingConnection, setIsCheckingConnection] = useState(false)

  const isLoginView = useMemo(() => {
    return new URLSearchParams(window.location.search).get("view") === "login"
  }, [])

  const isEmulator = useMemo(() => {
    return process.env.PLASMO_PUBLIC_USE_EMULATOR === "true" || process.env.NODE_ENV === "development"
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
    setIsCheckingConnection(true)
    try {
      console.log("Checking connection to emulator at http://127.0.0.1:9099...")
      const resp = await fetch("http://127.0.0.1:9099/", { mode: "no-cors" })
      console.log("Connection check response:", resp)
      return true
    } catch (e) {
      console.error("Connection check failed:", e)
      return false
    } finally {
      setIsCheckingConnection(false)
    }
  }, [])

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true)
    setLoginError(null)
    const reachable = await checkConnection()
    if (!reachable) {
      setLoginError("Cannot reach Firebase Emulator at 127.0.0.1:9099. Ensure it is running and accessible.")
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
    if (!isEmulator) return
    setIsLoggingIn(true)
    setLoginError(null)
    const reachable = await checkConnection()
    if (!reachable) {
      setLoginError("Cannot reach Firebase Emulator at 127.0.0.1:9099. Ensure it is running.")
      setIsLoggingIn(false)
      return
    }

    const email = "pro-user@icecap-test.com"
    const password = "TestPass123!"

    console.log(`Attempting test login for ${email}...`)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      console.log("Test login successful!")
    } catch (e: any) {
      if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
        console.log("User not found, attempting to create test account...")
        try {
          const { createUserWithEmailAndPassword } = await import("firebase/auth")
          await createUserWithEmailAndPassword(auth, email, password)
          console.log("Test account created and logged in!")
        } catch (createErr: any) {
          console.error("Failed to auto-create test account:", createErr)
          setLoginError(`Auth failed and auto-creation failed: ${createErr.message}`)
        }
      } else {
        console.error("Test login failed detailed error:", e)
        setLoginError(`Test login failed: ${e.message || "Unknown error"}. Check console for details.`)
      }
    } finally {
      setIsLoggingIn(false)
    }
  }, [isEmulator, checkConnection])

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth)
    } catch (e) {
      console.error("Logout failed", e)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setProperties([])
      setLoading(false)
      return
    }

    const q = query(
      collection(db, "users", user.uid, "properties"),
      orderBy("createdAt", "desc")
    )

    const unsubscribeData = onSnapshot(q, (snapshot) => {
      const props = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setProperties(props)
      setLoading(false)
    })

    return () => unsubscribeData()
  }, [user])

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
          <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-blue-200 rotate-3 transform transition-transform hover:rotate-0">
            <Calculator size={40} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Icecap Hub</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">Sign in to manage your real estate portfolio and sync your analyses across all devices.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm text-left animate-in fade-in slide-in-from-top-1">
              <AlertCircle size={18} className="shrink-0" />
              <p>{loginError}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-gray-700 font-bold py-4 px-8 rounded-2xl border-2 border-gray-100 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] hover:border-blue-100 disabled:opacity-50 disabled:scale-100"
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

            {isEmulator && (
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

          <footer className="mt-12 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
            Powered by Firebase Auth
          </footer>
        </div>
      </div>
    )
  }

  const stats = {
    totalValue: properties.reduce((acc, p) => acc + (p.price || 0), 0),
    avgCapRate: properties.length ? properties.reduce((acc, p) => acc + (p.metrics?.capRate || 0), 0) / properties.length : 0,
    monthlyCashFlow: properties.reduce((acc, p) => acc + (p.metrics?.monthlyCashFlow || 0), 0)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-10">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <PieChart size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Icecap Hub</h1>
        </div>

        <nav className="space-y-1 flex-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-blue-600 bg-blue-50 rounded-lg font-medium">
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">
            <Home size={20} />
            My Portfolio
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">
            <MapIcon size={20} />
            Market Map
          </button>
        </nav>

        <div className="mt-auto p-4 bg-gray-900 rounded-2xl text-white">
          <p className="text-xs opacity-70 mb-2">Pro Plan</p>
          <p className="text-sm font-bold mb-3">Unlock Deep Analytics</p>
          <button className="w-full py-2 bg-blue-600 rounded-lg text-xs font-bold hover:bg-blue-700">Upgrade Now</button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Investment Overview</h2>
            <p className="text-gray-500 text-sm">Welcome back. Here is how your saved deals look.</p>
          </div>
          <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all">
            <Plus size={20} />
            Add Property
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm font-medium mb-1">Total Portfolio Value</p>
            <p className="text-3xl font-bold">${stats.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm font-medium mb-1">Monthly Cash Flow</p>
            <p className="text-3xl font-bold text-green-600">+${Math.round(stats.monthlyCashFlow).toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-400 text-sm font-medium mb-1">Avg. Cap Rate</p>
            <p className="text-3xl font-bold text-blue-600">{stats.avgCapRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Properties Table/Grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Saved Properties ({properties.length})</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl py-20 text-center">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Home className="text-gray-400" />
              </div>
              <p className="text-gray-500 font-medium">No properties saved yet.</p>
              <p className="text-gray-400 text-sm">Start browsing Redfin or Zillow to add deals.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {properties.map((prop) => (
                <div key={prop.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${prop.mode === 'rental' ? 'bg-blue-600' : 'bg-orange-500'}`}>
                      {prop.mode === 'rental' ? <Home size={24} /> : <TrendingUp size={24} />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{prop.address || 'Unknown Address'}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                        <span>Price: <b className="text-gray-700">${prop.price?.toLocaleString()}</b></span>
                        <span>Mode: <b className="text-gray-700 uppercase">{prop.mode}</b></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Cash Flow</p>
                      <p className={`font-bold ${prop.metrics?.monthlyCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ${Math.round(prop.metrics?.monthlyCashFlow || 0)}/mo
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">CoC Return</p>
                      <p className="font-bold text-blue-600">{prop.metrics?.cocReturn?.toFixed(1)}%</p>
                    </div>
                    <div className="flex items-center gap-2 border-l pl-6 ml-2">
                      <a 
                        href={prop.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <ExternalLink size={20} />
                      </a>
                      <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
