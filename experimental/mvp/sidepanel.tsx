import { useEffect, useState } from "react"
import { usePropertyStore } from "./core/store"
import { Building2, Calculator, Info, Search, Sparkles, Save, Download, Zap, User, LogOut, LogIn, TrendingUp, Home, LayoutPanelTop } from "lucide-react"
import { db, geminiModel, functions, auth } from "./core/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser, GoogleAuthProvider } from "firebase/auth"
import "./style.css"

export default function SidePanel() {
  const store = usePropertyStore()
  const metrics = store.calculateMetrics()
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [isScraping, setIsScraping] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFetchingRent, setIsFetchingRent] = useState(false)
  const [description, setDescription] = useState("")
  const [aiSummary, setAiSummary] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })
    return () => unsubscribe()
  }, [])

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error("Login failed", error)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Logout failed", error)
    }
  }

  const handleScrape = async () => {
    setIsScraping(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: "scrape" }, (response) => {
          if (response) {
            if (response.price) store.setPrice(response.price)
            if (response.taxes) store.setTaxes(response.taxes)
            if (response.hoa) store.setHoa(response.hoa)
            if (response.address) store.setAddress(response.address)
            if (response.url) store.setUrl(response.url)
            if (response.description) setDescription(response.description)
          }
          setIsScraping(false)
        })
      }
    } catch (error) {
      console.error("Scraping failed", error)
      setIsScraping(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const propertyData = {
        mode: store.mode,
        price: store.price,
        address: store.address,
        url: store.url,
        estimatedRent: store.estimatedRent,
        metrics,
        assumptions: {
          downPaymentPercent: store.downPaymentPercent,
          interestRate: store.interestRate,
          rehabCost: store.rehabCost,
          arv: store.arv,
          holdingCosts: store.holdingCosts,
          sellingCostsPercent: store.sellingCostsPercent
        },
        createdAt: serverTimestamp()
      }

      if (user) {
        await addDoc(collection(db, "users", user.uid, "properties"), propertyData)
      } else {
        await addDoc(collection(db, "properties"), propertyData)
      }
      alert("Property saved!")
    } catch (error) {
      console.error("Save failed", error)
      alert("Failed to save property.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = () => {
    const data: any = {
      Address: store.address,
      Price: store.price,
      URL: store.url,
      Mode: store.mode
    }
    
    if (store.mode === "rental") {
      data.Rent = store.estimatedRent
      data["Monthly Cash Flow"] = metrics.monthlyCashFlow
      data["Cap Rate"] = metrics.capRate
      data["CoC Return"] = metrics.cocReturn
    } else {
      data.ARV = store.arv
      data["Flip Profit"] = metrics.flipProfit
      data["Flip ROI"] = metrics.flipROI
      data.MAO = metrics.mao
    }
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + Object.keys(data).join(",") + "\n"
      + Object.values(data).join(",")
    
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `icecap-analysis-${store.address.replace(/\s+/g, '-')}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFetchRent = async () => {
    if (!store.price) return
    setIsFetchingRent(true)
    try {
      const getRentEstimate = httpsCallable(functions, "getRentEstimate")
      const result = await getRentEstimate({ price: store.price })
      const estimate = (result.data as any).estimate
      if (estimate) store.setEstimatedRent(estimate)
    } catch (error) {
      console.error("Rent fetch failed", error)
    } finally {
      setIsFetchingRent(false)
    }
  }

  const handleAiAnalyze = async () => {
    if (!description) return
    setIsAnalyzing(true)
    try {
      const prompt = `Acting as a professional real estate investor, analyze this listing for a ${store.mode} strategy. 
      Property context:
      - Address: ${store.address}
      - Asking Price: $${store.price}
      - Estimated Rent: $${store.estimatedRent}
      - Taxes: $${store.taxes}/yr
      - HOA: $${store.hoa}/mo
      
      Identify 3 potential red flags from the listing description and estimate the rehab level needed (Low/Med/High). 
      Format as a concise summary.
      Description: ${description}`
      
      const result = await geminiModel.generateContent(prompt)
      setAiSummary(result.response.text())
    } catch (error) {
      console.error("AI Analysis failed", error)
      setAiSummary("AI analysis failed. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleOpenDashboard = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-900 p-4 overflow-y-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calculator className="text-blue-600" />
          <h1 className="text-xl font-bold">Icecap</h1>
        </div>
        <div className="flex gap-1 items-center">
          <button onClick={handleOpenDashboard} title="Open Portfolio Hub" className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
            <LayoutPanelTop size={20} />
          </button>
          {user ? (
            <button onClick={handleLogout} title="Logout" className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
              <LogOut size={20} />
            </button>
          ) : (
            <button onClick={handleLogin} title="Login Anonymously" className="p-2 hover:bg-gray-200 rounded-lg text-gray-600">
              <LogIn size={20} />
            </button>
          )}
          <button onClick={handleSave} disabled={isSaving || !store.address} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 disabled:opacity-30">
            <Save size={20} />
          </button>
          <button onClick={handleExport} disabled={!store.address} className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 disabled:opacity-30">
            <Download size={20} />
          </button>
        </div>
      </header>

      <div className="flex p-1 bg-gray-200 rounded-xl mb-6">
        <button 
          onClick={() => store.setMode("rental")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${store.mode === "rental" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          <Home size={16} />
          Rental
        </button>
        <button 
          onClick={() => store.setMode("flip")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${store.mode === "flip" ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
        >
          <TrendingUp size={16} />
          Flip
        </button>
      </div>

      {user && (
        <div className="flex items-center gap-2 mb-4 px-2 py-1 bg-green-50 rounded text-[10px] text-green-700 font-medium border border-green-100">
          <User size={12} />
          <span>Logged in as {user.isAnonymous ? "Guest" : user.email}</span>
        </div>
      )}

      {store.address && (
        <div className="mb-4 p-3 bg-white rounded-lg shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Active Listing</p>
          <p className="text-sm font-medium line-clamp-2">{store.address}</p>
        </div>
      )}

      <button 
        onClick={handleScrape}
        disabled={isScraping}
        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all mb-6 disabled:opacity-50"
      >
        <Search size={18} />
        {isScraping ? "Scraping..." : "Analyze Active Listing"}
      </button>

      <section className="space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Property Data</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400">Price</label>
              <input 
                type="number" 
                value={store.price} 
                onChange={(e) => store.setPrice(Number(e.target.value))}
                className="w-full font-medium border-b border-gray-200 focus:border-blue-500 outline-none"
              />
            </div>
            {store.mode === "rental" ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-gray-400">Rent</label>
                  <button 
                    onClick={handleFetchRent} 
                    disabled={isFetchingRent || !store.price}
                    className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5 disabled:opacity-30"
                  >
                    <Zap size={10} fill="currentColor" />
                    {isFetchingRent ? "..." : "Fetch"}
                  </button>
                </div>
                <input 
                  type="number" 
                  value={store.estimatedRent} 
                  onChange={(e) => store.setEstimatedRent(Number(e.target.value))}
                  className="w-full font-medium border-b border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs text-gray-400">ARV</label>
                <input 
                  type="number" 
                  value={store.arv} 
                  onChange={(e) => store.setArv(Number(e.target.value))}
                  className="w-full font-medium border-b border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-400">Rehab Cost</label>
              <input 
                type="number" 
                value={store.rehabCost} 
                onChange={(e) => store.setRehabCost(Number(e.target.value))}
                className="w-full font-medium border-b border-gray-200 focus:border-blue-500 outline-none"
              />
            </div>
            {store.mode === "flip" && (
              <div>
                <label className="block text-xs text-gray-400">Holding Costs</label>
                <input 
                  type="number" 
                  value={store.holdingCosts} 
                  onChange={(e) => store.setHoldingCosts(Number(e.target.value))}
                  className="w-full font-medium border-b border-gray-200 focus:border-blue-500 outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Assumptions</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Down Payment</span>
                <span className="font-bold">{store.downPaymentPercent}%</span>
              </div>
              <input 
                type="range" min="0" max="100" step="5"
                value={store.downPaymentPercent} 
                onChange={(e) => store.setDownPaymentPercent(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Interest Rate</span>
                <span className="font-bold">{store.interestRate}%</span>
              </div>
              <input 
                type="range" min="1" max="15" step="0.1"
                value={store.interestRate} 
                onChange={(e) => store.setInterestRate(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>

        <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg">
          <h2 className="text-xs font-semibold opacity-80 uppercase mb-4">
            {store.mode === "rental" ? "Rental Metrics" : "Flip Metrics"}
          </h2>
          {store.mode === "rental" ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <p className="text-xs opacity-80">Monthly Cash Flow</p>
                <p className="text-2xl font-bold">${Math.round(metrics.monthlyCashFlow)}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">CoC Return</p>
                <p className="text-2xl font-bold">{metrics.cocReturn.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs opacity-80">Cap Rate</p>
                <p className="text-xl font-bold">{metrics.capRate.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs opacity-80">1% Rule</p>
                <p className="text-xl font-bold">{metrics.onePercentRule.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs opacity-80">GRM</p>
                <p className="text-xl font-bold">{metrics.grm.toFixed(1)}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-y-4 gap-x-4">
              <div>
                <p className="text-xs opacity-80">Estimated Profit</p>
                <p className="text-2xl font-bold">${Math.round(metrics.flipProfit).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs opacity-80">ROI</p>
                <p className="text-2xl font-bold">{metrics.flipROI.toFixed(1)}%</p>
              </div>
              <div className="col-span-2">
                <div className="p-3 bg-white/10 rounded-lg">
                  <p className="text-xs opacity-80 mb-1">70% Rule MAO (Max Allowable Offer)</p>
                  <p className="text-2xl font-bold text-yellow-300">${Math.round(metrics.mao).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-600" size={16} />
              <h2 className="text-sm font-semibold text-purple-900">AI Deal Summary</h2>
            </div>
            <button 
              onClick={handleAiAnalyze}
              disabled={!description || isAnalyzing}
              className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-30"
            >
              {isAnalyzing ? "Analyzing..." : "Regenerate"}
            </button>
          </div>
          {aiSummary ? (
            <div className="text-xs text-purple-800 whitespace-pre-line bg-white/50 p-2 rounded">
              {aiSummary}
            </div>
          ) : (
            <p className="text-xs text-purple-400 italic">Click analyze to get AI insights from listing description.</p>
          )}
        </div>
      </section>

      <footer className="mt-auto pt-6 text-center text-xs text-gray-400">
        <p>Built with ❤️ for Real Estate Investors</p>
      </footer>
    </div>
  )
}

