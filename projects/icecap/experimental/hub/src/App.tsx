import { useEffect, useState } from "react"
import { db, auth, googleProvider } from "./core/firebase"
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore"
import { onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser } from "firebase/auth"
import { LayoutDashboard, Home, TrendingUp, ExternalLink, Trash2, PieChart, Map as MapIcon, Plus, LogOut, LogIn, User } from "lucide-react"
import "./index.css"

export default function App() {
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
    }, (error) => {
      console.error("Firestore error:", error)
      setLoading(false)
    })

    return () => unsubscribeData()
  }, [user])

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error("Login failed", error)
    }
  }

  const handleLogout = () => signOut(auth)

  const handleDelete = async (id: string) => {
    if (!user) return
    if (confirm("Delete this analysis?")) {
      await deleteDoc(doc(db, "users", user.uid, "properties", id))
    }
  }

  const stats = {
    totalValue: properties.reduce((acc, p) => acc + (p.price || 0), 0),
    avgCapRate: properties.length ? properties.reduce((acc, p) => acc + (p.metrics?.capRate || 0), 0) / properties.length : 0,
    monthlyCashFlow: properties.reduce((acc, p) => acc + (p.metrics?.monthlyCashFlow || 0), 0)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl shadow-blue-100 border border-blue-50 max-w-md w-full text-center">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-blue-200">
            <PieChart size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Icecap Hub</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">The ultimate dashboard for residential real estate investors. Sync your Redfin & Zillow analyses in real-time.</p>
          <button 
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>
          <p className="mt-6 text-xs text-gray-400">Secure access via Firebase Auth</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 p-6 flex flex-col fixed h-full">
        <div className="flex items-center gap-2 mb-10">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <PieChart size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Icecap Hub</h1>
        </div>

        <nav className="space-y-1 flex-1">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-blue-600 bg-blue-50 rounded-xl font-bold">
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition-colors">
            <Home size={20} />
            Portfolio
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl font-medium transition-colors">
            <MapIcon size={20} />
            Market Map
          </button>
        </nav>

        <div className="mt-auto space-y-4">
          <div className="p-3 bg-gray-50 rounded-2xl flex items-center gap-3 border border-gray-100">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{user.displayName || user.email}</p>
              <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold hover:underline">Sign Out</button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-10 overflow-y-auto">
        <header className="flex justify-between items-start mb-10">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">Portfolio Health</h2>
            <p className="text-gray-400 font-medium mt-1">Real-time aggregate data from your {properties.length} analyzed deals.</p>
          </div>
          <div className="flex gap-3">
             <button className="flex items-center gap-2 bg-white text-gray-900 border border-gray-200 px-5 py-2.5 rounded-2xl font-bold hover:bg-gray-50 transition-all">
              Export CSV
            </button>
            <button className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all transform hover:scale-[1.02]">
              <Plus size={20} />
              Manual Add
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <TrendingUp size={80} />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Total Value</p>
            <p className="text-4xl font-black text-gray-900 tracking-tight">${stats.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <TrendingUp size={80} />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Monthly Cashflow</p>
            <p className="text-4xl font-black text-green-500 tracking-tight">+${Math.round(stats.monthlyCashFlow).toLocaleString()}</p>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all duration-300">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <TrendingUp size={80} />
            </div>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-2">Avg. Cap Rate</p>
            <p className="text-4xl font-black text-blue-600 tracking-tight">{stats.avgCapRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Properties Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-gray-900">Saved Deals</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : properties.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] py-24 text-center">
              <div className="bg-gray-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Home className="text-gray-300" size={32} />
              </div>
              <p className="text-gray-600 text-lg font-bold">No deals analyzed yet</p>
              <p className="text-gray-400 max-w-xs mx-auto mt-2">Open the Icecap extension on Redfin or Zillow to start building your portfolio.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {properties.map((prop) => (
                <div key={prop.id} className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm flex items-center justify-between hover:shadow-lg hover:border-blue-100 transition-all group">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${prop.mode === 'rental' ? 'bg-blue-600 shadow-blue-100' : 'bg-orange-500 shadow-orange-100'}`}>
                      {prop.mode === 'rental' ? <Home size={28} /> : <TrendingUp size={28} />}
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">{prop.address || 'Unknown Address'}</p>
                      <div className="flex items-center gap-4 text-sm mt-1">
                        <span className="text-gray-400 font-medium">Price: <b className="text-gray-700">${prop.price?.toLocaleString()}</b></span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-gray-500">{prop.mode}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-1">Cash Flow</p>
                      <p className={`text-xl font-black ${prop.metrics?.monthlyCashFlow >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                        ${Math.round(prop.metrics?.monthlyCashFlow || 0)}<span className="text-xs font-bold opacity-50 ml-1">/mo</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-1">CoC Return</p>
                      <p className="text-xl font-black text-blue-600">{prop.metrics?.cocReturn?.toFixed(1)}%</p>
                    </div>
                    <div className="flex items-center gap-3 border-l border-gray-100 pl-8 ml-4">
                      <a 
                        href={prop.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-3 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                        title="View on Site"
                      >
                        <ExternalLink size={24} />
                      </a>
                      <button 
                        onClick={() => handleDelete(prop.id)}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        title="Delete"
                      >
                        <Trash2 size={24} />
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
