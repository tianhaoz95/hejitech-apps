import { useEffect, useState } from "react"
import { usePropertyStore } from "./core/store"
import { db, auth } from "./core/firebase"
import { collection, query, onSnapshot, orderBy } from "firebase/firestore"
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth"
import { LayoutDashboard, Home, TrendingUp, ExternalLink, Trash2, PieChart, Map as MapIcon, Plus } from "lucide-react"
import "./style.css"

export default function OptionsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })
    return () => unsubscribeAuth()
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
