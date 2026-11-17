import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore"
import { Home, TrendingUp, ExternalLink, Trash2, Crown } from "lucide-react"
import { db } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { SavedProperty } from "@icecap/types"

export function PortfolioPage() {
  const { user, isSubscribed } = useAuth()
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, "users", user.uid, "properties"),
      orderBy("createdAt", "desc")
    )
    return onSnapshot(q, (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedProperty)))
      setLoading(false)
    })
  }, [user])

  const handleDelete = async (id: string) => {
    if (!user || !confirm("Delete this analysis?")) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, "users", user.uid, "properties", id))
    } finally {
      setDeleting(null)
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-10">
      {!isSubscribed && (
        <div className="mb-10 p-6 bg-linear-to-r from-blue-600 to-purple-600 rounded-4xl text-white shadow-xl shadow-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
              <Crown size={32} />
            </div>
            <div>
              <h3 className="text-xl font-black">Unlock Icecap Pro</h3>
              <p className="opacity-80 text-sm font-medium">Unlock full Redfin/Zillow scraping, AI Deal Summaries, and unlimited property saves.</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = "/subscribe"}
            className="px-8 py-3 bg-white text-blue-600 rounded-2xl font-black shadow-lg hover:bg-gray-50 transition-all active:scale-95"
          >
            Upgrade Now
          </button>
        </div>
      )}

      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Portfolio</h2>
      <p className="text-gray-400 mb-8">{properties.length} saved deal{properties.length !== 1 ? "s" : ""}</p>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-100 rounded-[40px] py-24 text-center">
          <div className="bg-gray-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Home className="text-gray-300" size={32} />
          </div>
          <p className="text-gray-600 text-lg font-bold">No deals saved yet</p>
          <p className="text-gray-400 max-w-xs mx-auto mt-2">
            Use the Chrome extension on listing pages to save analyses here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {properties.map((p) => {
            const cashFlow = p.rentalMetrics?.monthlyCashFlow ?? 0
            return (
              <div
                key={p.id}
                className="bg-white p-6 rounded-4xl border border-gray-50 shadow-xs flex items-center justify-between hover:shadow-lg hover:border-blue-100 transition-all group"
                data-testid="property-card"
              >
                <Link to={`/property/${p.id}`} className="flex items-center gap-6 flex-1">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      p.mode === "rental" ? "bg-blue-600 shadow-blue-100" : "bg-orange-500 shadow-orange-100"
                    }`}
                  >
                    {p.mode === "rental" ? <Home size={28} /> : <TrendingUp size={28} />}
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                      {p.address || "Unknown Address"}
                    </p>
                    <div className="flex items-center gap-4 text-sm mt-1">
                      <span className="text-gray-400">
                        Price: <b className="text-gray-700">{fmt(p.price)}</b>
                      </span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase text-gray-500">
                        {p.mode}
                      </span>
                    </div>
                  </div>
                </Link>

                <div className="flex items-center gap-10">
                  <Link to={`/property/${p.id}`} className="flex items-center gap-10">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-1">Cash Flow</p>
                      <p className={`text-xl font-black ${cashFlow >= 0 ? "text-green-500" : "text-red-400"}`}>
                        {fmt(cashFlow)}<span className="text-xs font-bold opacity-50 ml-1">/mo</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest mb-1">CoC Return</p>
                      <p className="text-xl font-black text-blue-600">
                        {(p.rentalMetrics?.cocReturn ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 border-l border-gray-100 pl-8">
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                        title="View listing"
                      >
                        <ExternalLink size={22} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all disabled:opacity-50"
                      title="Delete"
                      data-testid="delete-btn"
                    >
                      <Trash2 size={22} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
