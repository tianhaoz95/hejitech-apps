import { useEffect, useState, useCallback } from "react"
import {
  Calculator, Search, Save, Download, LogOut, LogIn, LayoutPanelTop,
  User, Zap, AlertTriangle, Crown, RefreshCw, Home, TrendingUp, Sparkles,
} from "lucide-react"
import {
  onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, type User as FBUser,
} from "firebase/auth"
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { auth, db, functions } from "./core/firebase"
import { usePropertyStore, type AnalysisMode } from "./core/store"
import "./style.css"

const googleProvider = new GoogleAuthProvider()

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

  const [user, setUser] = useState<FBUser | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingRent, setIsFetchingRent] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [aiSummary, setAiSummary] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u) setSubscription(null)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const ref = doc(db, "subscriptions", user.uid)
    return onSnapshot(ref, (snap) => {
      setSubscription(snap.exists() ? (snap.data() as Subscription) : null)
    })
  }, [user])

  const isSubscribed = subscription?.status === "active" || subscription?.status === "trialling"
  const isPastDue = subscription?.status === "past_due" || subscription?.status === "unpaid"

  const handleLogin = useCallback(async () => {
    try { await signInWithPopup(auth, googleProvider) } catch (e) { console.error(e) }
  }, [])

  const handleLogout = useCallback(async () => {
    try { await signOut(auth) } catch (e) { console.error(e) }
  }, [])

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
            onClick={() => chrome.runtime.openOptionsPage()}
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
