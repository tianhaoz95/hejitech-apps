import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, updateDoc, doc } from "firebase/firestore"
import { Tag, Plus, CheckCircle, XCircle } from "lucide-react"
import { db } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { PromoCode } from "@icecap/types"

function useAdminAuth() {
  const [user, setUser] = useState<{ uid: string; email: string | null } | null>(null)
  useEffect(() => {
    import("firebase/auth").then(({ getAuth, onAuthStateChanged }) => {
      return onAuthStateChanged(getAuth(), (u) => setUser(u ? { uid: u.uid, email: u.email } : null))
    })
  }, [])
  return user
}

export function PromoCodesPage() {
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ code: "", type: "internal_free" as PromoCode["type"], usageLimit: "" })
  const user = useAdminAuth()

  const fetchPromos = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, "promo_codes"))
      setPromos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PromoCode)))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPromos() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !user) return
    setCreating(true)
    try {
      await addDoc(collection(db, "promo_codes"), {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
        usageCount: 0,
        isActive: true,
        createdBy: user.uid,
        createdAt: Date.now(),
      })
      setForm({ code: "", type: "internal_free", usageLimit: "" })
      await fetchPromos()
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (id: string, isActive: boolean) => {
    await updateDoc(doc(db, "promo_codes", id), { isActive: !isActive })
    await fetchPromos()
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">Promo Codes</h1>
      <p className="text-gray-400 mb-8">Create and manage promotional codes.</p>

      {/* Create form */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-8">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2">
          <Plus size={16} className="text-blue-400" />
          Create New Code
        </h2>
        <form onSubmit={handleCreate} className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="PROMO CODE"
            required
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white font-mono font-bold text-sm w-48 focus:outline-none focus:border-blue-500"
          />
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PromoCode["type"] })}
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="internal_free">Internal Free ($0/mo)</option>
            <option value="stripe_linked">Stripe Linked Coupon</option>
          </select>
          <input
            type="number"
            value={form.usageLimit}
            onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
            placeholder="Usage limit (blank = unlimited)"
            className="px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm w-56 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      </div>

      {/* Promo codes table */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs font-bold uppercase">
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Usage</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">Loading…</td></tr>
            ) : promos.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">
                  <Tag size={32} className="mx-auto mb-2 opacity-30" />
                  No promo codes yet.
                </td>
              </tr>
            ) : (
              promos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-white">{p.code}</td>
                  <td className="p-4 text-gray-300 capitalize text-xs">{p.type.replace("_", " ")}</td>
                  <td className="p-4 text-gray-300">
                    {p.usageCount}/{p.usageLimit === null ? "∞" : p.usageLimit}
                  </td>
                  <td className="p-4">
                    {p.isActive ? (
                      <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-400 text-xs font-bold">
                        <XCircle size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleActive(p.id, p.isActive)}
                      className="px-3 py-1 bg-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
                    >
                      {p.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
