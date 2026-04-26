import { useEffect, useState, useCallback } from "react"
import {
  Search, Save, Download, LogOut, LogIn, LayoutPanelTop,
  User, Zap, AlertTriangle, Crown, RefreshCw, Home, TrendingUp, Sparkles,
} from "lucide-react"
import {
  onAuthStateChanged, signOut, GoogleAuthProvider, signInWithCredential, type User as FBUser,
  signInWithEmailAndPassword,
} from "firebase/auth/web-extension"
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { auth, db, functions, useEmulator, signInWithGoogle } from "./core/firebase"
import { IS_DEV, HUB_URL } from "./core/constants"
import { usePropertyStore, type AnalysisMode } from "./core/store"
import { Logo } from "./core/components/Logo"
import "./style.css"

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

interface Subscription {
  tier: string | null
  status: string
  aiUsageCurrentMonth: number
  aiQuotaLimit: number
}

// ── Shared sub-components ──────────────────────────────────────────────────

function StrategyToggle({ value, onChange }: { value: AnalysisMode; onChange: (m: AnalysisMode) => void }) {
  const modes: { id: AnalysisMode; label: string; Icon: typeof Home }[] = [
    { id: "rental", label: "Rental", Icon: Home },
    { id: "flip", label: "Flip", Icon: TrendingUp },
    { id: "brrrr", label: "BRRRR", Icon: RefreshCw },
  ]
  return (
    <div className="flex p-1 bg-gray-200 rounded-xl">
      {modes.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === id ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}

function Slider({
  label, value, min, max, step = 1, formatValue = (v: number) => `${v}%`, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  formatValue?: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="font-bold text-gray-800">{formatValue(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  )
}

function NumInput({
  label, value, onChange, rightAction,
}: {
  label: string; value: number; onChange: (v: number) => void;
  rightAction?: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
        {rightAction}
      </div>
      <input
        type="number" value={value || ""} placeholder="0"
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full font-semibold border-b-2 border-gray-200 focus:border-blue-600 outline-none py-0.5 bg-transparent text-sm"
      />
    </div>
  )
}

function MetricBox({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div>
      <p className="text-xs opacity-80">{label}</p>
      <p className={`font-bold ${large ? "text-2xl" : "text-xl"}`}>{value}</p>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────────────────

export default function SidePanel() {
  const store = usePropertyStore()
  const metrics = store.getMetrics()

  useEffect(() => {
    if (useEmulator) {
      (window as any).store = store
      ;(window as any).signInWithEmailAndPassword = signInWithEmailAndPassword
    }
  }, [store])

  const [user, setUser] = useState<FBUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [subLoading, setSubLoading] = useState(false)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingRent, setIsFetchingRent] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")

  const handleOpenHub = useCallback(() => {
    chrome.tabs.create({ url: HUB_URL })
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
      if (!u) setSubscription(null)
    })
  }, [])

  useEffect(() => {
    if (!user) {
      setSubLoading(false)
      return
    }
    setSubLoading(true)
    const ref = doc(db, "subscriptions", user.uid)
    console.log(`[Extension] Logged in as: ${user.email}, UID: ${user.uid}, Project ID: ${db.app.options.projectId}`)
    return onSnapshot(ref, (snap) => {
      console.log(`[Extension] Subscription update received:`, snap.exists() ? snap.data() : "No document")
      setSubscription(snap.exists() ? (snap.data() as Subscription) : null)
      setSubLoading(false)
    }, (err) => {
      console.error("[Extension] Subscription listener failed:", err)
      setSubLoading(false)
    })
  }, [user])

  const isSubscribed = subscription?.status === "active" || subscription?.status === "trialling"
  const isPastDue = subscription?.status === "past_due" || subscription?.status === "unpaid"

  const checkConnection = useCallback(async () => {
    if (!useEmulator) return true
    try {
      await fetch("http://127.0.0.1:9099/", { mode: "no-cors" })
      return true
    } catch (e) {
      return false
    }
  }, [])

  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      if (useEmulator) {
        const credential = GoogleAuthProvider.credential(
          JSON.stringify({ sub: "google-raw-id-icecap-main-user-2026", email: "hi@icecap.com", email_verified: true }),
          "mock-google-token"
        )
        await signInWithCredential(auth, credential)
      } else {
        await signInWithGoogle()
      }
    } catch (e: any) {
      console.error("Google Sign-In failed", e)
      setLoginError(e.message ?? "Sign-in failed. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }, [isLoggingIn])

  const handleLogout = useCallback(async () => {
    try { await signOut(auth) } catch (e) { console.error(e) }
  }, [])

  const handleMockSubscribe = useCallback(async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const fn = httpsCallable(functions, "debugCreateSubscription")
      await fn({ tier: "pro_max" })
      // Local snapshot will update automatically
    } catch (e) {
      console.error("Mock subscribe failed", e)
    } finally {
      setIsSaving(false)
    }
  }, [user])

  const handleScrape = useCallback(async () => {
    setIsScraping(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return
      chrome.tabs.sendMessage(tab.id, { action: "scrape" }, (response) => {
        if (response) store.loadFromScrape(response)
        setIsScraping(false)
      })
    } catch (e) {
      console.error("Scrape failed", e)
      setIsScraping(false)
    }
  }, [store])

  const handleSave = useCallback(async () => {
    if (!user || !store.address || !isSubscribed) return
    setIsSaving(true)
    try {
      const input = store.getPropertyInput()
      await addDoc(collection(db, "users", user.uid, "properties"), {
        mode: store.mode,
        price: input.price,
        address: store.address,
        url: store.url,
        taxes: input.taxes,
        hoa: input.hoa,
        estimatedRent: input.estimatedRent,
        rehabCost: input.rehabCost,
        arv: input.arv,
        holdingCosts: input.holdingCosts,
        userId: user.uid,
        rentalMetrics: metrics.rental,
        flipMetrics: metrics.flip,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch (e) {
      console.error("Save failed", e)
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } finally {
      setIsSaving(false)
    }
  }, [user, store, isSubscribed, metrics])

  const handleExport = useCallback(() => {
    const rows = [
      ["Address", store.address],
      ["Price", store.price],
      ["Mode", store.mode],
      ...(store.mode !== "flip"
        ? [
            ["Monthly Cash Flow", metrics.rental.monthlyCashFlow],
            ["Cap Rate %", metrics.rental.capRate],
            ["CoC Return %", metrics.rental.cocReturn],
          ]
        : [
            ["Flip Profit", metrics.flip.flipProfit],
            ["Flip ROI %", metrics.flip.flipROI],
            ["MAO", metrics.flip.mao],
          ]),
    ]
    const csv = rows.map(([k, v]) => `${k},${v}`).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    a.download = `icecap-${(store.address || "analysis").replace(/\s+/g, "-")}.csv`
    a.click()
  }, [store, metrics])

  const handleFetchRent = useCallback(async () => {
    if (!store.price) return
    setIsFetchingRent(true)
    try {
      const fn = httpsCallable(functions, "getRentEstimate")
      const result = await fn({ price: store.price, address: store.address })
      const data = result.data as { estimate: number }
      if (data.estimate) store.setEstimatedRent(data.estimate)
    } catch (e) {
      console.error("Rent fetch failed", e)
    } finally {
      setIsFetchingRent(false)
    }
  }, [store])

  const handleAnalyze = useCallback(async () => {
    if (!user || !store.description || !isSubscribed) return
    setIsAnalyzing(true)
    try {
      const fn = httpsCallable(functions, "analyzeProperty")
      const result = await fn({ propertyData: store.getPropertyInput(), listingDescription: store.description })
      const data = result.data as { summary: string; redFlags: string[]; recommendation: string }
      setAiSummary(`${data.summary}\n\n🚩 Red Flags:\n${data.redFlags.map((f) => `• ${f}`).join("\n")}\n\n💡 ${data.recommendation}`)
    } catch (e) {
      console.error("AI failed", e)
      setAiSummary("AI analysis unavailable. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }, [user, store, isSubscribed])

  const aiQuotaRemaining =
    subscription?.tier === "pro_max"
      ? null
      : subscription
        ? Math.max(0, (subscription.aiQuotaLimit ?? 50) - (subscription.aiUsageCurrentMonth ?? 0))
        : 0

  if (authLoading || subLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <RefreshCw className="text-blue-600 animate-spin mb-4" size={32} />
        <p className="text-gray-500 font-medium">
          {authLoading ? "Initializing Icecap..." : "Verifying Subscription..."}
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 text-center">
        <div className="mb-6">
          <Logo size={64} elevation />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Welcome to Icecap</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Sign in to your account to start analyzing properties on Redfin and Zillow.
        </p>
        
        <div className="space-y-4 w-full">
          {loginError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 text-left">
              {loginError}
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border-2 border-gray-100 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingIn ? (
              <RefreshCw size={20} className="animate-spin text-blue-600" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
              </svg>
            )}
            {isLoggingIn ? "Signing in..." : "Sign in with Google"}
          </button>
          
          <div className="pt-4 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mb-2">New to Icecap?</p>
            <a 
              href={HUB_URL} 
              target="_blank" 
              rel="noreferrer"
              className="text-sm text-blue-600 font-bold hover:underline"
            >
              Create an account on the web →
            </a>
          </div>
        </div>
        <footer className="mt-12 text-[10px] text-gray-400 uppercase tracking-widest">
          Icecap Platform v0.1
        </footer>
      </div>
    )
  }

  if (!isSubscribed && !isPastDue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
        <div className="bg-purple-600 p-3 rounded-2xl text-white mb-6 shadow-lg shadow-purple-200">
          <Crown size={48} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription Required</h1>
        <p className="text-gray-500 mb-8">
          You need an active subscription or a free trial to use the Icecap extension.
        </p>
        <div className="space-y-3 w-full">
          <button
            onClick={handleOpenHub}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all"
          >
            Start Free Trial in Hub
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl border border-gray-200 shadow-sm transition-all"
          >
            <RefreshCw size={16} />
            Refresh Status
          </button>
          
          {IS_DEV && (
            <div className="pt-4 border-t border-dashed border-gray-200">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-400 font-mono truncate">UID: {user?.uid}</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(user?.uid || "")
                    alert("UID copied to clipboard")
                  }}
                  className="text-[10px] text-blue-600 font-bold hover:underline shrink-0"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full text-gray-500 hover:text-gray-700 text-sm font-medium py-2"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 text-sm">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Calculator className="text-blue-600" size={18} />
          <span className="text-lg font-bold">Icecap</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleOpenHub}
            title="Open Hub" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
          >
            <LayoutPanelTop size={17} />
          </button>
          {user ? (
            <button onClick={handleLogout} title="Sign out" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <LogOut size={17} />
            </button>
          ) : (
            <button onClick={handleLogin} title="Sign in" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <LogIn size={17} />
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving || !store.address || !user || !isSubscribed}
            title="Save"
            className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${
              saveStatus === "saved" ? "text-green-600 bg-green-50"
              : saveStatus === "error" ? "text-red-600 bg-red-50"
              : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Save size={17} />
          </button>
          <button
            onClick={handleExport}
            disabled={!store.address}
            title="Export CSV"
            className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 disabled:opacity-30"
          >
            <Download size={17} />
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600">
            <User size={11} />
            <span className="truncate flex-1">{user.email ?? "Signed in"}</span>
            {subscription && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                isSubscribed ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                {subscription.status === "trialling" ? "Trial" : subscription.status}
              </span>
            )}
          </div>
        )}

        {isPastDue && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
            <AlertTriangle size={13} />
            Subscription past due. Update billing in Hub.
          </div>
        )}

        {user && !isSubscribed && !isPastDue && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
            <Crown size={13} />
            Start free trial to save &amp; sync analyses.
          </div>
        )}

        <StrategyToggle value={store.mode} onChange={store.setMode} />

        {store.address && (
          <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Active Listing</p>
            <p className="text-xs font-medium line-clamp-2">{store.address}</p>
          </div>
        )}

        <button
          onClick={handleScrape}
          disabled={isScraping}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
          data-testid="scrape-btn"
        >
          {isScraping ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
          {isScraping ? "Scraping…" : "Analyze Active Listing"}
        </button>

        {/* Property inputs */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Property Data</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Price" value={store.price} onChange={store.setPrice} />
            {store.mode === "flip" ? (
              <NumInput label="ARV" value={store.arv} onChange={store.setArv} />
            ) : (
              <NumInput
                label="Rent/mo"
                value={store.estimatedRent}
                onChange={store.setEstimatedRent}
                rightAction={
                  <button
                    onClick={handleFetchRent}
                    disabled={isFetchingRent || !store.price}
                    className="text-[10px] text-blue-600 flex items-center gap-0.5 disabled:opacity-30"
                  >
                    <Zap size={9} fill="currentColor" />
                    {isFetchingRent ? "…" : "Fetch"}
                  </button>
                }
              />
            )}
            <NumInput label="Taxes/yr" value={store.taxes} onChange={store.setTaxes} />
            <NumInput label="HOA/mo" value={store.hoa} onChange={store.setHoa} />
            <NumInput label="Rehab Cost" value={store.rehabCost} onChange={store.setRehabCost} />
            {store.mode === "flip" && (
              <NumInput label="Holding Costs" value={store.holdingCosts} onChange={store.setHoldingCosts} />
            )}
          </div>
        </section>

        {/* Assumptions */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Assumptions</p>
          <Slider
            label="Down Payment"
            value={store.assumptions.downPaymentPercent}
            min={0} max={100} step={5}
            onChange={(v) => store.setAssumption("downPaymentPercent", v)}
          />
          <Slider
            label="Interest Rate"
            value={store.assumptions.interestRate}
            min={1} max={15} step={0.25}
            formatValue={(v) => `${v.toFixed(2)}%`}
            onChange={(v) => store.setAssumption("interestRate", v)}
          />
          <Slider
            label="Vacancy Rate"
            value={store.assumptions.vacancyRate}
            min={0} max={20}
            onChange={(v) => store.setAssumption("vacancyRate", v)}
          />
          <Slider
            label="Mgmt Fee"
            value={store.assumptions.managementFeeRate}
            min={0} max={20}
            onChange={(v) => store.setAssumption("managementFeeRate", v)}
          />
        </section>

        {/* Results */}
        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg" data-testid="result-card">
          <h3 className="text-xs font-semibold opacity-80 uppercase mb-4">
            {store.mode === "rental" ? "Rental Metrics" : store.mode === "flip" ? "Flip Metrics" : "BRRRR Metrics"}
          </h3>
          {store.mode !== "flip" ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <MetricBox label="Monthly Cash Flow" value={fmt(metrics.rental.monthlyCashFlow)} large />
              <MetricBox label="CoC Return" value={fmtPct(metrics.rental.cocReturn)} large />
              <MetricBox label="Cap Rate" value={fmtPct(metrics.rental.capRate)} />
              <MetricBox label="1% Rule" value={fmtPct(metrics.rental.onePercentRule)} />
              <MetricBox label="GRM" value={metrics.rental.grm.toFixed(1)} />
              <MetricBox label="Cash to Close" value={fmt(metrics.rental.totalCashToClose)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <MetricBox label="Profit" value={fmt(metrics.flip.flipProfit)} large />
              <MetricBox label="ROI" value={fmtPct(metrics.flip.flipROI)} large />
              <div className="col-span-2">
                <div className="p-3 bg-white/10 rounded-xl">
                  <p className="text-xs opacity-80 mb-1">70% Rule MAO</p>
                  <p className="text-2xl font-bold text-yellow-300">{fmt(metrics.flip.mao)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Insight */}
        {user && isSubscribed && (
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-600" size={15} />
                <span className="text-sm font-semibold text-purple-900">AI Deal Summary</span>
              </div>
              <div className="flex items-center gap-2">
                {aiQuotaRemaining !== null && (
                  <span className="text-[10px] text-purple-400">{aiQuotaRemaining} left</span>
                )}
                <button
                  onClick={handleAnalyze}
                  disabled={!store.description || isAnalyzing}
                  className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
                >
                  {isAnalyzing ? "Analyzing…" : aiSummary ? "Regenerate" : "Analyze"}
                </button>
              </div>
            </div>
            {isAnalyzing ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-3 bg-purple-200 rounded animate-pulse`} style={{ width: `${100 - i * 15}%` }} />
                ))}
              </div>
            ) : aiSummary ? (
              <div className="text-xs text-purple-800 whitespace-pre-line bg-white/50 p-2 rounded-lg">{aiSummary}</div>
            ) : (
              <p className="text-xs text-purple-400 italic">
                {store.description ? "Click Analyze for AI red flag detection." : "Scrape a listing first to enable AI analysis."}
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="py-2 text-center text-[10px] text-gray-300">Icecap v0.1</footer>
    </div>
  )
}
