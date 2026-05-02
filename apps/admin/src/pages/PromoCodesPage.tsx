import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"
import { Tag, Plus, CheckCircle, XCircle, Trash2, Wand2 } from "lucide-react"
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
  const [actionId, setActionId] = useState<string | null>(null)
  const [form, setForm] = useState({ code: "", type: "internal_free" as PromoCode["type"], usageLimit: "" })
  const user = useAdminAuth()

  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No O, 0, I, 1 to avoid confusion
    const result = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    setForm({ ...form, code: result })
  }

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
    setActionId(id)
    try {
      await updateDoc(doc(db, "promo_codes", id), { isActive: !isActive })
      await fetchPromos()
    } finally {
      setActionId(null)
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete the promo code "${code}"?`)) return
    setActionId(id)
    try {
      await deleteDoc(doc(db, "promo_codes", id))
      await fetchPromos()
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">Promo Codes</h1>
      <p className="text-gray-500 mb-8">Create and manage promotional codes.</p>

      {/* Create form */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-8">
        <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-blue-600" />
          Create New Code
        </h2>
        <form onSubmit={handleCreate} className="flex gap-3 flex-wrap items-center">
          <div className="relative group">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="PROMO CODE"
              required
              className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 font-mono font-bold text-sm w-56 pr-12 focus:outline-none focus:border-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={generateRandomCode}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
              title="Generate random code"
            >
              <Wand2 size={16} />
            </button>
          </div>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as PromoCode["type"] })}
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="internal_free">Internal Free ($0/mo)</option>
            <option value="stripe_linked">Stripe Linked Coupon</option>
          </select>
          <input
            type="number"
            value={form.usageLimit}
            onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
            placeholder="Usage limit (blank = unlimited)"
            className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm w-56 focus:outline-none focus:border-blue-500"
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
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-gray-500 text-xs font-bold uppercase">
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Type</th>
              <th className="text-left p-4">Usage</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-mono font-bold text-gray-900">{p.code}</td>
                  <td className="p-4 text-gray-600 capitalize text-xs">{p.type.replace("_", " ")}</td>
                  <td className="p-4 text-gray-600">
                    {p.usageCount}/{p.usageLimit === null ? "∞" : p.usageLimit}
                  </td>
                  <td className="p-4">
                    {p.isActive ? (
                      <span className="flex items-center gap-1 text-green-700 text-xs font-bold">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 text-xs font-bold">
                        <XCircle size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleActive(p.id, p.isActive)}
                        disabled={actionId === p.id}
                        className="px-3 py-1 bg-gray-100 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        {p.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.code)}
                        disabled={actionId === p.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Promo"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
