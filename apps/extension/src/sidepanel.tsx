import { useEffect, useState, useCallback, useRef } from "react"
import {
  Search, Heart, LogOut, LogIn, LayoutPanelTop,
  User, Zap, AlertTriangle, Crown, RefreshCw, Home, TrendingUp, Sparkles, Calculator, ChevronDown,
  Bot, Send,
} from "lucide-react"
import {
  onAuthStateChanged, signOut, GoogleAuthProvider, signInWithCredential, type User as FBUser,
  signInWithEmailAndPassword,
} from "firebase/auth/web-extension"
import { collection, addDoc, serverTimestamp, doc, onSnapshot, getDoc } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { auth, db, functions, useEmulator, signInWithGoogle } from "./core/firebase"
import { IS_DEV, HUB_URL } from "./core/constants"
import { usePropertyStore, type AnalysisMode } from "./core/store"
import { Logo } from "./core/components/Logo"
import logoUrl from "url:~assets/logo.svg"
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
  status?: string
  aiUsageCurrentMonth: number
  aiQuotaLimit: number
}

// ── Shared sub-components ──────────────────────────────────────────────────

type ViewMode = AnalysisMode | "ai"

function StrategyToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { id: ViewMode; label: string; Icon: typeof Home }[] = [
    { id: "rental", label: "Rental", Icon: Home },
    { id: "flip", label: "Flip", Icon: TrendingUp },
    { id: "brrrr", label: "BRRRR", Icon: RefreshCw },
    { id: "ai", label: "AI", Icon: Bot },
  ]
  return (
    <div className="flex p-1 bg-gray-200 rounded-xl">
      {modes.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            value === id
              ? id === "ai"
                ? "bg-white shadow-sm text-purple-600"
                : "bg-white shadow-sm text-blue-600"
              : "text-gray-500 hover:text-gray-700"
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

function CalcRow({
  label, formula, value, sign,
}: {
  label: string; formula?: string; value: string; sign?: "positive" | "negative"
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-gray-700">{label}</span>
        {formula && <p className="text-[10px] text-gray-400 font-mono mt-0.5 leading-tight">{formula}</p>}
      </div>
      <span className={`text-xs font-semibold shrink-0 tabular-nums ${
        sign === "positive" ? "text-green-600" : sign === "negative" ? "text-red-500" : "text-gray-900"
      }`}>
        {value}
      </span>
    </div>
  )
}

function CalcGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest mb-0.5">{title}</p>
      {children}
    </div>
  )
}

function RentalBreakdown({
  price, taxes, hoa, estimatedRent, rehabCost, assumptions, metrics,
}: {
  price: number; taxes: number; hoa: number; estimatedRent: number; rehabCost: number;
  assumptions: import("./core/math").PropertyAssumptions;
  metrics: import("./core/math").RentalMetrics;
}) {
  const { downPaymentPercent, interestRate, loanTermYears, vacancyRate, maintenanceRate, managementFeeRate, closingCostsPercent } = assumptions
  const down = price * (downPaymentPercent / 100)
  const loan = price - down
  const monthlyTaxes = taxes / 12
  const vacancy = (vacancyRate / 100) * estimatedRent
  const maintenance = (maintenanceRate / 100) * estimatedRent
  const management = (managementFeeRate / 100) * estimatedRent
  const cashFlowSign = metrics.monthlyCashFlow >= 0 ? "positive" : "negative"

  return (
    <div>
      <CalcGroup title="Income">
        <CalcRow label="Monthly Rent" value={`${fmt(estimatedRent)}/mo`} />
      </CalcGroup>

      <CalcGroup title="Financing">
        <CalcRow
          label="Down Payment"
          formula={`${downPaymentPercent}% × ${fmt(price)}`}
          value={fmt(down)}
        />
        <CalcRow
          label="Loan Amount"
          formula={`${fmt(price)} − ${fmt(down)}`}
          value={fmt(loan)}
        />
        <CalcRow
          label="Monthly Mortgage"
          formula={`${fmt(loan)} at ${interestRate}% / ${loanTermYears}yr`}
          value={`${fmt(metrics.monthlyMortgage)}/mo`}
        />
      </CalcGroup>

      <CalcGroup title="Monthly Expenses">
        <CalcRow
          label="Property Taxes"
          formula={`${fmt(taxes)}/yr ÷ 12`}
          value={`${fmt(monthlyTaxes)}/mo`}
        />
        {hoa > 0 && <CalcRow label="HOA" value={`${fmt(hoa)}/mo`} />}
        <CalcRow
          label="Vacancy"
          formula={`${vacancyRate}% × ${fmt(estimatedRent)}`}
          value={`${fmt(vacancy)}/mo`}
        />
        <CalcRow
          label="Maintenance"
          formula={`${maintenanceRate}% × ${fmt(estimatedRent)}`}
          value={`${fmt(maintenance)}/mo`}
        />
        <CalcRow
          label="Management"
          formula={`${managementFeeRate}% × ${fmt(estimatedRent)}`}
          value={`${fmt(management)}/mo`}
        />
        <CalcRow label="Total Expenses" value={`${fmt(metrics.monthlyExpenses)}/mo`} />
      </CalcGroup>

      <CalcGroup title="Cash Flow">
        <CalcRow
          label="Monthly Cash Flow"
          formula={`${fmt(estimatedRent)} − ${fmt(metrics.monthlyMortgage)} − ${fmt(metrics.monthlyExpenses)}`}
          value={`${fmt(metrics.monthlyCashFlow)}/mo`}
          sign={cashFlowSign}
        />
        <CalcRow
          label="Annual Cash Flow"
          formula={`${fmt(metrics.monthlyCashFlow)}/mo × 12`}
          value={fmt(metrics.annualCashFlow)}
          sign={cashFlowSign}
        />
      </CalcGroup>

      <CalcGroup title="Returns">
        <CalcRow
          label="NOI"
          formula={`(${fmt(estimatedRent)} − ${fmt(metrics.monthlyExpenses)}) × 12`}
          value={fmt(metrics.noi)}
        />
        <CalcRow
          label="Cap Rate"
          formula={`${fmt(metrics.noi)} ÷ ${fmt(price)}`}
          value={fmtPct(metrics.capRate)}
        />
        <CalcRow
          label="Cash to Close"
          formula={`${fmt(down)} down + ${fmt(rehabCost)} rehab + ${closingCostsPercent}% closing`}
          value={fmt(metrics.totalCashToClose)}
        />
        <CalcRow
          label="Cash-on-Cash Return"
          formula={`${fmt(metrics.annualCashFlow)} ÷ ${fmt(metrics.totalCashToClose)}`}
          value={fmtPct(metrics.cocReturn)}
          sign={cashFlowSign}
        />
        <CalcRow
          label="GRM"
          formula={`${fmt(price)} ÷ (${fmt(estimatedRent)} × 12)`}
          value={metrics.grm.toFixed(1)}
        />
        <CalcRow
          label="1% Rule"
          formula={`${fmt(estimatedRent)} ÷ ${fmt(price)}`}
          value={fmtPct(metrics.onePercentRule)}
        />
      </CalcGroup>
    </div>
  )
}

function FlipBreakdown({
  price, rehabCost, arv, holdingCosts, assumptions, metrics,
}: {
  price: number; rehabCost: number; arv: number; holdingCosts: number;
  assumptions: import("./core/math").PropertyAssumptions;
  metrics: import("./core/math").FlipMetrics;
}) {
  const { downPaymentPercent, sellingCostsPercent } = assumptions
  const cashIn = price * (downPaymentPercent / 100) + rehabCost + holdingCosts
  const profitSign = metrics.flipProfit >= 0 ? "positive" : "negative"

  return (
    <div>
      <CalcGroup title="Total Basis">
        <CalcRow label="Purchase Price" value={fmt(price)} />
        {rehabCost > 0 && <CalcRow label="Rehab Cost" value={fmt(rehabCost)} />}
        {holdingCosts > 0 && <CalcRow label="Holding Costs" value={fmt(holdingCosts)} />}
        <CalcRow
          label="Selling Costs"
          formula={`${sellingCostsPercent}% × ${fmt(arv)}`}
          value={fmt(metrics.sellingCosts)}
        />
        <CalcRow label="Total Basis" value={fmt(metrics.totalBasis)} />
      </CalcGroup>

      <CalcGroup title="Profit">
        <CalcRow label="After-Repair Value (ARV)" value={fmt(arv)} />
        <CalcRow
          label="Profit"
          formula={`${fmt(arv)} − ${fmt(metrics.totalBasis)}`}
          value={fmt(metrics.flipProfit)}
          sign={profitSign}
        />
      </CalcGroup>

      <CalcGroup title="ROI">
        <CalcRow
          label="Cash Invested"
          formula={`${downPaymentPercent}% × ${fmt(price)} + rehab + holding`}
          value={fmt(cashIn)}
        />
        <CalcRow
          label="Return on Investment"
          formula={`${fmt(metrics.flipProfit)} ÷ ${fmt(cashIn)}`}
          value={fmtPct(metrics.flipROI)}
          sign={profitSign}
        />
      </CalcGroup>

      <CalcGroup title="70% Rule">
        <CalcRow
          label="Max Allowable Offer"
          formula={`${fmt(arv)} × 70% − ${fmt(rehabCost)}`}
          value={fmt(metrics.mao)}
        />
      </CalcGroup>
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
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isScraping, setIsScraping] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingRent, setIsFetchingRent] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [activeView, setActiveView] = useState<ViewMode>(store.mode)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [chatInput, setChatInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  useEffect(() => {
    const t = setTimeout(() => {
      console.log("[Icecap] writing assumptions to storage", store.assumptions)
      chrome.storage.local.set({ "icecap-assumptions": store.assumptions })
    }, 100)
    return () => clearTimeout(t)
  }, [store.assumptions])

  const handleOpenHub = useCallback(() => {
    chrome.tabs.create({ url: HUB_URL })
  }, [])

  useEffect(() => {
    const handler = (msg: { action: string; data?: any }) => {
      if (msg.action === "propertyDetected" && msg.data) {
        usePropertyStore.getState().loadFromScrape(msg.data)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
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

  const isSubscribed =
    subscription?.status === "active" ||
    subscription?.status === "trialling" ||
    (!subscription?.status && !!subscription?.tier)
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

  const handleRefreshStatus = useCallback(async () => {
    if (!user || isRefreshing) return
    setIsRefreshing(true)
    try {
      const ref = doc(db, "subscriptions", user.uid)
      const snap = await getDoc(ref)
      console.log(`[Extension] Refresh: subscription doc`, snap.exists() ? snap.data() : "not found")
      setSubscription(snap.exists() ? (snap.data() as Subscription) : null)
    } catch (e) {
      console.error("[Extension] Refresh subscription failed:", e)
    } finally {
      setIsRefreshing(false)
    }
  }, [user, isRefreshing])

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

  const handleViewChange = useCallback((v: ViewMode) => {
    setActiveView(v)
    if (v !== "ai") store.setMode(v)
  }, [store])

  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim()
    if (!msg || isChatLoading) return
    setChatInput("")
    setChatMessages((prev) => [...prev, { role: "user", content: msg }])
    setIsChatLoading(true)
    try {
      const fn = httpsCallable(functions, "propertyChat")
      const result = await fn({
        message: msg,
        context: {
          price: store.price,
          address: store.address,
          estimatedRent: store.estimatedRent,
          taxes: store.taxes,
          hoa: store.hoa,
          mode: store.mode,
          assumptions: store.assumptions,
          metrics: metrics.rental,
        },
      })
      const data = result.data as { reply: string }
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }])
    } catch (e) {
      console.error("Chat failed", e)
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }])
    } finally {
      setIsChatLoading(false)
    }
  }, [chatInput, isChatLoading, store, metrics])

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
          You need an active subscription to use the Icecap extension.
        </p>
        <div className="space-y-3 w-full">
          <button
            onClick={handleOpenHub}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all"
          >
            Upgrade in Hub
          </button>
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl border border-gray-200 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Checking..." : "Refresh Status"}
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
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Icecap" className="h-6 w-auto" />
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
              saveStatus === "saved" ? "text-red-500 bg-red-50"
              : saveStatus === "error" ? "text-red-600 bg-red-50"
              : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <Heart size={17} className={saveStatus === "saved" ? "fill-current" : ""} />
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
            Upgrade to Pro to save &amp; sync analyses.
          </div>
        )}

        <StrategyToggle value={activeView} onChange={handleViewChange} />

        {store.address && activeView !== "ai" && (
          <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Active Listing</p>
            <p className="text-xs font-medium line-clamp-2">{store.address}</p>
          </div>
        )}

        {activeView !== "ai" && (
          <button
            onClick={handleScrape}
            disabled={isScraping}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
            data-testid="scrape-btn"
          >
            {isScraping ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
            {isScraping ? "Scraping…" : "Analyze Active Listing"}
          </button>
        )}

        {activeView === "ai" ? (
          <div className="flex flex-col gap-2">
            <div
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col gap-2 overflow-y-auto"
              style={{ height: "calc(100vh - 260px)" }}
            >
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="p-3 bg-purple-50 rounded-2xl">
                    <Bot size={24} className="text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 mb-1">AI Property Assistant</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                      Ask anything about this property — cash flow, risks, rent estimates, market context, or strategy.
                    </p>
                  </div>
                  {store.price > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                      {[
                        "Is this a good deal?",
                        "What's the break-even rent?",
                        "What are the biggest risks?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => { setChatInput(q) }}
                          className="text-[10px] px-2 py-1 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend() } }}
                placeholder={store.price > 0 ? "Ask about this property…" : "Scrape a listing first, then ask…"}
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-purple-400 bg-white"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || isChatLoading}
                className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-40 transition-colors shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        ) : (
        <>

        {/* Assumptions */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Assumptions</p>
          <Slider
            label="Rent Estimate"
            value={store.assumptions.rentRatioPercent}
            min={0.3} max={2} step={0.05}
            formatValue={(v) => `${v.toFixed(2)}% of price`}
            onChange={(v) => store.setAssumption("rentRatioPercent", v)}
          />
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
            label="Maintenance"
            value={store.assumptions.maintenanceRate}
            min={0} max={20}
            onChange={(v) => store.setAssumption("maintenanceRate", v)}
          />
          <Slider
            label="Mgmt Fee"
            value={store.assumptions.managementFeeRate}
            min={0} max={20}
            onChange={(v) => store.setAssumption("managementFeeRate", v)}
          />
        </section>

        {/* Results */}
        {store.price > 0 && <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg" data-testid="result-card">
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
        </div>}

        {/* Calculation Breakdown */}
        {store.price > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowBreakdown((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calculator size={13} className="text-gray-400" />
                <span className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">How We Calculated This</span>
              </div>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""}`}
              />
            </button>
            {showBreakdown && (
              <div className="px-4 pb-4 border-t border-gray-50">
                {store.mode !== "flip" ? (
                  <RentalBreakdown
                    price={store.price}
                    taxes={store.taxes}
                    hoa={store.hoa}
                    estimatedRent={store.estimatedRent}
                    rehabCost={store.rehabCost}
                    assumptions={store.assumptions}
                    metrics={metrics.rental}
                  />
                ) : (
                  <FlipBreakdown
                    price={store.price}
                    rehabCost={store.rehabCost}
                    arv={store.arv}
                    holdingCosts={store.holdingCosts}
                    assumptions={store.assumptions}
                    metrics={metrics.flip}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Property inputs */}
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">Property Data</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Price" value={store.price} onChange={store.setPrice} />
            {store.price > 0 && (
              <>
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
              </>
            )}
          </div>
          {store.price === 0 && (
            <p className="text-[10px] text-gray-400 italic">Enter a price or scrape a listing to begin.</p>
          )}
        </section>

        {/* AI Insight */}
        {store.price > 0 && user && isSubscribed && (
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
        </>
        )}
      </div>

      <footer className="py-2 text-center text-[10px] text-gray-300">Icecap v0.1</footer>
    </div>
  )
}
