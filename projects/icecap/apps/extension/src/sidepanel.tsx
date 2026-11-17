import { useEffect, useState, useCallback, useRef } from "react"
import {
  Search, Heart, LogOut, LogIn, LayoutPanelTop,
  User, Zap, AlertTriangle, Crown, RefreshCw, Home, TrendingUp, Sparkles, Calculator, ChevronDown,
  Bot, Send, Bug, MapPin,
} from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import ReactMarkdown from "react-markdown"
import { ask, CHAT_ASSISTANT, DEAL_SUMMARY, fill, historyBlock, onDeviceStatus, type OnDeviceStatus } from "@icecap/ai"
import { estimateRent } from "@icecap/math"
import type { ProStatus } from "@icecap/types"
import { icecap, IS_DEV, HUB_URL, signInAsTestUser, signInWithGoogle, signOut } from "./core/icecap"
import { usePropertyStore, type AnalysisMode } from "./core/store"
import { compareRentalStrategies } from "./core/math"
import { Logo } from "./core/components/Logo"
import logoUrl from "../assets/logo.svg"
import "./style.css"

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)

const fmtPct = (n: number) => `${n.toFixed(1)}%`

// ── Shared sub-components ──────────────────────────────────────────────────

type ViewMode = AnalysisMode | "ai"

function StrategyToggle({ value, onChange }: { value: ViewMode; onChange: (m: ViewMode) => void }) {
  const modes: { id: ViewMode; label: string; Icon: typeof Home }[] = [
    { id: "rental", label: "LTR", Icon: Home },
    { id: "str", label: "STR", Icon: Zap },
    { id: "both", label: "Both", Icon: LayoutPanelTop },
    { id: "flip", label: "Flip", Icon: TrendingUp },
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
                ? "bg-white shadow-xs text-purple-600"
                : "bg-white shadow-xs text-blue-600"
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
        className="w-full font-semibold border-b-2 border-gray-200 focus:border-blue-600 outline-hidden py-0.5 bg-transparent text-sm"
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

function StrBreakdown({
  price, taxes, hoa, rehabCost, assumptions, strAssumptions, metrics,
}: {
  price: number; taxes: number; hoa: number; rehabCost: number;
  assumptions: import("./core/math").PropertyAssumptions;
  strAssumptions: import("./core/math").StrAssumptions;
  metrics: import("./core/math").StrMetrics;
}) {
  const { downPaymentPercent, interestRate, loanTermYears, maintenanceRate, managementFeeRate, closingCostsPercent } = assumptions
  const { adr, occupancyRate, platformFeeRate, cleaningFeeIncome, cleaningFeeExpense, avgStayLength, monthlyUtilities } = strAssumptions

  const down = price * (downPaymentPercent / 100)
  const monthlyGross = (adr * 365 * (occupancyRate / 100)) / 12
  const monthlyMaint = (maintenanceRate / 100) * monthlyGross
  const monthlyMgmt = (managementFeeRate / 100) * monthlyGross
  const monthlyPlat = (platformFeeRate / 100) * monthlyGross

  const cashFlowSign = metrics.monthlyCashFlow >= 0 ? "positive" : "negative"

  return (
    <div>
      <CalcGroup title="Gross Income">
        <CalcRow label="ADR" value={fmt(adr)} />
        <CalcRow label="Occupancy" value={fmtPct(occupancyRate)} />
        <CalcRow
          label="Monthly Gross Revenue"
          formula={`${fmt(adr)} × 365 × ${occupancyRate}% ÷ 12`}
          value={`${fmt(monthlyGross)}/mo`}
        />
        <CalcRow label="RevPAR" value={fmt(metrics.revPar)} />
      </CalcGroup>

      <CalcGroup title="Monthly Expenses">
        <CalcRow label="Taxes & HOA" value={`${fmt(taxes / 12 + hoa)}/mo`} />
        <CalcRow label="Utilities" value={`${fmt(monthlyUtilities)}/mo`} />
        <CalcRow
          label="Maintenance"
          formula={`${maintenanceRate}% of Revenue`}
          value={`${fmt(monthlyMaint)}/mo`}
        />
        <CalcRow
          label="Management"
          formula={`${managementFeeRate}% of Revenue`}
          value={`${fmt(monthlyMgmt)}/mo`}
        />
        <CalcRow
          label="Platform Fees"
          formula={`${platformFeeRate}% of Revenue`}
          value={`${fmt(monthlyPlat)}/mo`}
        />
        <CalcRow label="Total Expenses" value={`${fmt(metrics.monthlyExpenses)}/mo`} />
      </CalcGroup>

      <CalcGroup title="Cash Flow">
        <CalcRow label="Monthly Cash Flow" value={`${fmt(metrics.monthlyCashFlow)}/mo`} sign={cashFlowSign} />
        <CalcRow label="Annual Cash Flow" value={fmt(metrics.annualCashFlow)} sign={cashFlowSign} />
      </CalcGroup>

      <CalcGroup title="Returns">
        <CalcRow label="Cap Rate" value={fmtPct(metrics.capRate)} />
        <CalcRow label="CoC Return" value={fmtPct(metrics.cocReturn)} sign={cashFlowSign} />
      </CalcGroup>
    </div>
  )
}

function StrategyComparisonCard({
  ltr, str, comparison
}: {
  ltr: import("./core/math").RentalMetrics;
  str: import("./core/math").StrMetrics;
  comparison: import("./core/math").StrategyComparison;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden mb-4">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Strategy Comparison</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
          comparison.bestStrategy === "str" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
        }`}>
          {comparison.bestStrategy === "str" ? "STR Wins" : "LTR Wins"}
        </span>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <div className={`p-3 rounded-xl border-2 ${comparison.bestStrategy === "ltr" ? "border-blue-500 bg-blue-50/30" : "border-gray-50"}`}>
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">LTR Strategy</p>
          <p className="text-lg font-bold text-gray-900">{fmt(ltr.monthlyCashFlow)}/mo</p>
          <p className="text-[10px] text-gray-500">{fmtPct(ltr.cocReturn)} CoC</p>
        </div>
        <div className={`p-3 rounded-xl border-2 ${comparison.bestStrategy === "str" ? "border-purple-500 bg-purple-50/30" : "border-gray-50"}`}>
          <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">STR Strategy</p>
          <p className="text-lg font-bold text-gray-900">{fmt(str.monthlyCashFlow)}/mo</p>
          <p className="text-[10px] text-gray-500">{fmtPct(str.cocReturn)} CoC</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-amber-500" />
            <span className="text-[10px] font-bold text-gray-600 uppercase">Breakeven Analysis</span>
          </div>
          <p className="text-xs text-gray-600">
            STR becomes more profitable than LTR at <span className="font-bold text-gray-900">{comparison.breakevenOccupancy}%</span> occupancy.
          </p>
        </div>
      </div>
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
    if (IS_DEV) (window as any).store = store
  }, [store])

  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [subLoading, setSubLoading] = useState(false)
  const [pro, setPro] = useState<ProStatus | null>(null)
  const [model, setModel] = useState<OnDeviceStatus | null>(null)
  const [download, setDownload] = useState<number | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isManual, setIsManual] = useState(false)
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
      console.log("[Icecap] writing config to storage", {
        assumptions: store.assumptions,
        strAssumptions: store.strAssumptions,
        mapPinMetric: store.mapPinMetric,
      })
      chrome.storage.local.set({
        "icecap-assumptions": store.assumptions,
        "icecap-str-assumptions": store.strAssumptions,
        "icecap-map-pin-metric": store.mapPinMetric,
      })
    }, 100)
    return () => clearTimeout(t)
  }, [store.assumptions, store.strAssumptions, store.mapPinMetric])

  const handleOpenHub = useCallback(() => {
    chrome.tabs.create({ url: HUB_URL })
  }, [])

  const handleCopyDebugInfo = useCallback(() => {
    const debugInfo = {
      input: store.getPropertyInput(),
      metrics,
      state: {
        price: store.price,
        address: store.address,
        url: store.url,
        taxes: store.taxes,
        hoa: store.hoa,
        description: store.description,
      }
    }
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
    alert("Debug info copied to clipboard!")
  }, [store, metrics])

  useEffect(() => {
    const handler = (msg: { action: string; data?: any }) => {
      if (msg.action === "propertyDetected" && msg.data) {
        usePropertyStore.getState().loadFromScrape(msg.data)
        setIsManual(false)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  useEffect(() => {
    onDeviceStatus().then(setModel)
    icecap.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })
    const { data } = icecap.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null)
      if (!s) setPro(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadPro = useCallback(async () => {
    try {
      setPro(await icecap.pro.status())
    } catch (e) {
      console.error("[Icecap] Pro status failed", e)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      setSubLoading(false)
      return
    }
    setSubLoading(true)
    loadPro().finally(() => setSubLoading(false))
  }, [user?.id, loadPro])

  const isSubscribed = !!pro?.pro

  const handleLogin = useCallback(async () => {
    if (isLoggingIn) return
    setIsLoggingIn(true)
    setLoginError(null)
    try {
      await signInWithGoogle()
    } catch (e: any) {
      console.error("Google Sign-In failed", e)
      setLoginError(e.message ?? "Sign-in failed. Please try again.")
    } finally {
      setIsLoggingIn(false)
    }
  }, [isLoggingIn])

  const handleLogout = useCallback(async () => {
    try { await signOut() } catch (e) { console.error(e) }
  }, [])

  const handleRefreshStatus = useCallback(async () => {
    if (!user || isRefreshing) return
    setIsRefreshing(true)
    try {
      await loadPro()
    } catch (e) {
      console.error("[Extension] Refresh Pro failed:", e)
    } finally {
      setIsRefreshing(false)
    }
  }, [user, isRefreshing, loadPro])

  const handleTestLogin = useCallback(async () => {
    setLoginError(null)
    try { await signInAsTestUser() } catch (e: any) { setLoginError(e.message) }
  }, [])

  const handleScrape = useCallback(async () => {
    setIsScraping(true)
    setIsManual(false)
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
      await icecap.properties.add({
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
        description: store.description || undefined,
        assumptions: input.assumptions,
        rentalMetrics: metrics.rental,
        strMetrics: metrics.str,
        flipMetrics: metrics.flip,
        strAssumptions: input.strAssumptions,
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
      const { estimate } = estimateRent(store.price)
      if (estimate) store.setEstimatedRent(estimate)
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
      const text = await ask(fill(DEAL_SUMMARY, {
        address: store.address,
        price: store.price,
        estimatedRent: store.estimatedRent,
        description: store.description,
      }), { temperature: 0.5, onDownload: (f) => setDownload(f < 1 ? f : null) })
      setDownload(null)

      setAiSummary(text)
    } catch (e) {
      console.error("AI failed", e)
      setDownload(null)
      setAiSummary(e instanceof Error && e.message.startsWith("On-device AI") ? e.message : "AI analysis unavailable. Please try again.")
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
      const reply = await ask(fill(CHAT_ASSISTANT, {
        address: store.address || "Unknown",
        price: store.price,
        estimatedRent: store.estimatedRent,
        taxes: store.taxes,
        hoa: store.hoa,
        strategy: store.mode,
        monthlyCashFlow: metrics.rental.monthlyCashFlow,
        capRate: metrics.rental.capRate,
        cocReturn: metrics.rental.cocReturn,
        history: historyBlock(chatMessages),
        question: msg,
      }), { temperature: 0.7, onDownload: (f) => setDownload(f < 1 ? f : null) })
      setDownload(null)

      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }])
    } catch (e) {
      console.error("Chat failed", e)
      setDownload(null)
      const content = e instanceof Error && e.message.startsWith("On-device AI") ? e.message : "Sorry, I couldn't process that. Please try again."
      setChatMessages((prev) => [...prev, { role: "assistant", content }])
    } finally {
      setIsChatLoading(false)
    }
  }, [chatInput, isChatLoading, store, metrics, chatMessages])

  const aiStatus =
    download !== null ? `Downloading model… ${Math.round(download * 100)}%`
    : model === "unavailable" ? "Needs Chrome's on-device model"
    : model === "downloadable" ? "One-time model download"
    : "On your device"

  if (authLoading || subLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
        <RefreshCw className="text-blue-600 animate-spin mb-4" size={32} />
        <p className="text-gray-500 font-medium">
          {authLoading ? "Initializing Icecap..." : "Checking Icecap Pro..."}
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
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-700 border-2 border-gray-100 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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

          {IS_DEV && (
            <div className="pt-4 border-t border-dashed border-gray-100 space-y-2">
              <button onClick={handleTestLogin} className="block w-full text-[11px] text-blue-600 font-bold hover:underline">
                Sign in as the local test user
              </button>
              <button 
                onClick={handleCopyDebugInfo}
                className="text-[10px] text-amber-600 font-bold hover:underline"
              >
                Copy Debug Info (Store)
              </button>
            </div>
          )}
        </div>
        <footer className="mt-12 text-[10px] text-gray-400 uppercase tracking-widest">
          Icecap Platform v0.1
        </footer>
      </div>
    )
  }

  if (!isSubscribed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
        <div className="bg-purple-600 p-3 rounded-2xl text-white mb-6 shadow-lg shadow-purple-200">
          <Crown size={48} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Icecap Pro Required</h1>
        <p className="text-gray-500 mb-8">
          The extension is part of Icecap Pro. Start your free week on the web, then come back here.
        </p>
        <div className="space-y-3 w-full">
          <button
            onClick={() => chrome.tabs.create({ url: `${HUB_URL}subscribe` })}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl shadow-md transition-all"
          >
            Get Icecap Pro
          </button>
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshing}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl border border-gray-200 shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Checking..." : "Refresh Status"}
          </button>
          
          {IS_DEV && (
            <div className="pt-4 border-t border-dashed border-gray-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-gray-400 font-mono truncate">UID: {user?.id}</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(user?.id || "")
                    alert("UID copied to clipboard")
                  }}
                  className="text-[10px] text-blue-600 font-bold hover:underline shrink-0"
                >
                  Copy
                </button>
              </div>
              <button 
                onClick={handleCopyDebugInfo}
                className="w-full text-[10px] text-amber-600 font-bold hover:underline text-left"
              >
                Copy Debug Info (Store)
              </button>
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
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-xs">
        <div className="flex items-center gap-2">
          <img src={logoUrl} alt="Icecap" className="h-6 w-auto" />
        </div>
        <div className="flex items-center gap-0.5">
          {IS_DEV && (
            <button
              onClick={handleCopyDebugInfo}
              title="Copy Debug Info"
              className="p-2 hover:bg-gray-100 rounded-lg text-amber-600"
            >
              <Bug size={17} />
            </button>
          )}
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
        {/* Global Config */}
        <div className="p-3 bg-blue-600 rounded-xl shadow-md text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="opacity-80" />
              <label className="text-[10px] uppercase font-black tracking-wider">Map Pin Display</label>
            </div>
            <select
              value={store.mapPinMetric}
              onChange={(e) => store.setMapPinMetric(e.target.value as any)}
              className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[11px] font-bold outline-hidden focus:bg-white/20 transition-all cursor-pointer text-white"
            >
              <option value="ltr" className="text-gray-900">LTR Cash Flow</option>
              <option value="str" className="text-gray-900">STR Cash Flow</option>
              <option value="best" className="text-gray-900">Best Strategy</option>
            </select>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-100 rounded-lg text-xs text-gray-600">
            <User size={11} />
            <span className="truncate flex-1">{user.email ?? "Signed in"}</span>
            {isSubscribed && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700">
                Pro{pro?.plan === "lifetime" ? " · Lifetime" : ""}
              </span>
            )}
          </div>
        )}

        {user && !isSubscribed && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
            <Crown size={13} />
            Upgrade to Pro to save &amp; sync analyses.
          </div>
        )}

        <StrategyToggle value={activeView} onChange={handleViewChange} />

        {store.address && activeView !== "ai" && (
          <div className="p-3 bg-white rounded-xl border border-gray-100 shadow-xs">
            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Active Listing</p>
            <p className="text-xs font-medium line-clamp-2">{store.address}</p>
          </div>
        )}

        {activeView !== "ai" && (
          <div className="space-y-2">
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
              data-testid="scrape-btn"
            >
              {isScraping ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
              {isScraping ? "Scraping…" : "Analyze Active Listing"}
            </button>
            {!store.price && !store.address && !isManual && (
              <button
                onClick={() => setIsManual(true)}
                className="w-full py-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-blue-600 transition-colors"
              >
                — or enter manual data —
              </button>
            )}
          </div>
        )}

        {activeView === "ai" ? (
          <div className="flex flex-col gap-2">
            <div
              className="bg-white rounded-xl border border-gray-100 shadow-xs p-3 flex flex-col gap-2 overflow-y-auto"
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
              {chatMessages.length > 0 && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={() => {
                      if (confirm("Reset chat and start fresh?")) {
                        setChatMessages([])
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider rounded-full border border-gray-100 hover:bg-gray-100 hover:text-gray-600 transition-all"
                  >
                    <RefreshCw size={10} />
                    Reset Conversation
                  </button>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}>
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <div className="markdown-content">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
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
                className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-hidden focus:border-purple-400 bg-white"
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
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-3">
          <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wide">
            {activeView === "str" ? "STR Assumptions" : "General Assumptions"}
          </p>
          
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

          {activeView === "str" ? (
            <>
              <Slider
                label="ADR"
                value={store.strAssumptions.adr}
                min={50} max={1000} step={10}
                formatValue={(v) => fmt(v)}
                onChange={(v) => store.setStrAssumption("adr", v)}
              />
              <Slider
                label="Occupancy Rate"
                value={store.strAssumptions.occupancyRate}
                min={0} max={100}
                onChange={(v) => store.setStrAssumption("occupancyRate", v)}
              />
              <Slider
                label="Mgmt Fee"
                value={store.assumptions.managementFeeRate}
                min={0} max={30}
                onChange={(v) => store.setAssumption("managementFeeRate", v)}
              />
              <Slider
                label="Platform Fee"
                value={store.strAssumptions.platformFeeRate}
                min={0} max={20}
                onChange={(v) => store.setStrAssumption("platformFeeRate", v)}
              />
            </>
          ) : (activeView === "rental" || activeView === "brrrr") ? (
            <>
              <Slider
                label="Rent Estimate"
                value={store.assumptions.rentRatioPercent}
                min={0.3} max={2} step={0.05}
                formatValue={(v) => `${v.toFixed(2)}% of price`}
                onChange={(v) => store.setAssumption("rentRatioPercent", v)}
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
            </>
          ) : null}
        </section>

        {/* Comparison View */}
        {activeView === "both" && store.price > 0 && (
          <StrategyComparisonCard 
            ltr={metrics.rental} 
            str={metrics.str} 
            comparison={compareRentalStrategies(store.getPropertyInput())} 
          />
        )}

        {/* Results */}
        {store.price > 0 && activeView !== "both" && <div className={`p-4 rounded-2xl shadow-lg text-white ${
          activeView === "str" ? "bg-purple-600" : "bg-blue-600"
        }`} data-testid="result-card">
          <h3 className="text-xs font-semibold opacity-80 uppercase mb-4">
            {activeView === "rental" ? "LTR Metrics" : activeView === "str" ? "STR Metrics" : activeView === "flip" ? "Flip Metrics" : "BRRRR Metrics"}
          </h3>
          {activeView === "rental" || activeView === "brrrr" || activeView === "str" ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <MetricBox 
                label="Monthly Cash Flow" 
                value={activeView === "str" ? fmt(metrics.str.monthlyCashFlow) : fmt(metrics.rental.monthlyCashFlow)} 
                large 
              />
              <MetricBox 
                label="CoC Return" 
                value={activeView === "str" ? fmtPct(metrics.str.cocReturn) : fmtPct(metrics.rental.cocReturn)} 
                large 
              />
              <MetricBox 
                label="Cap Rate" 
                value={activeView === "str" ? fmtPct(metrics.str.capRate) : fmtPct(metrics.rental.capRate)} 
              />
              {activeView === "str" ? (
                <MetricBox label="RevPAR" value={fmt(metrics.str.revPar)} />
              ) : (
                <MetricBox label="1% Rule" value={fmtPct(metrics.rental.onePercentRule)} />
              )}
              {activeView === "str" ? (
                <MetricBox label="Occupancy" value={fmtPct(metrics.str.occupancyRate)} />
              ) : (
                <MetricBox label="GRM" value={metrics.rental.grm.toFixed(1)} />
              )}
              <MetricBox 
                label="Cash to Close" 
                value={activeView === "str" ? fmt(metrics.str.totalCashToClose) : fmt(metrics.rental.totalCashToClose)} 
              />
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
        {store.price > 0 && activeView !== "both" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
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
                {activeView === "rental" || activeView === "brrrr" ? (
                  <RentalBreakdown
                    price={store.price}
                    taxes={store.taxes}
                    hoa={store.hoa}
                    estimatedRent={store.estimatedRent}
                    rehabCost={store.rehabCost}
                    assumptions={store.assumptions}
                    metrics={metrics.rental}
                  />
                ) : activeView === "str" ? (
                  <StrBreakdown
                    price={store.price}
                    taxes={store.taxes}
                    hoa={store.hoa}
                    rehabCost={store.rehabCost}
                    assumptions={store.assumptions}
                    strAssumptions={store.strAssumptions}
                    metrics={metrics.str}
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
        {(store.price > 0 || store.address || isManual) && (
          <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs space-y-3">
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
                        <div className="relative group">
                          <button
                            onClick={handleFetchRent}
                            disabled={isFetchingRent || !store.price}
                            className="text-[10px] text-blue-600 flex items-center gap-0.5 disabled:opacity-30"
                          >
                            <Zap size={9} fill="currentColor" />
                            {isFetchingRent ? "…" : "Fetch"}
                          </button>
                          <div className="absolute bottom-full right-0 mb-1.5 w-44 bg-gray-800 text-white text-[10px] rounded-sm px-2 py-1.5 leading-snug pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                            AI-estimates the monthly rent for this property based on its price and address.
                          </div>
                        </div>
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
        )}

        {/* AI Insight */}
        {store.price > 0 && user && isSubscribed && (
          <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-purple-600" size={15} />
                <span className="text-sm font-semibold text-purple-900">AI Deal Summary</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-purple-400">{aiStatus}</span>
                <button
                  onClick={handleAnalyze}
                  disabled={!store.description || isAnalyzing || model === "unavailable"}
                  className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
                >
                  {isAnalyzing ? "Analyzing…" : aiSummary ? "Regenerate" : "Analyze"}
                </button>
              </div>
            </div>
            {isAnalyzing ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`h-3 bg-purple-200 rounded-sm animate-pulse`} style={{ width: `${100 - i * 15}%` }} />
                ))}
              </div>
            ) : aiSummary ? (
              <div className="text-xs text-purple-800 bg-white/50 p-2 rounded-lg markdown-content">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
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
