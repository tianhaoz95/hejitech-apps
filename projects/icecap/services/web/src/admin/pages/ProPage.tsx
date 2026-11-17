import { useEffect, useState } from "react"
import { Crown, Plus, Trash2 } from "lucide-react"
import type { AdminProAccount } from "@icecap/types"
import { icecap } from "../../lib/icecap"

// Paid Pro (Stripe) and Pro given by email (the same list scripts/grant_pro.sh edits).
export function ProPage() {
  const [rows, setRows] = useState<AdminProAccount[] | null>(null)
  const [email, setEmail] = useState("")
  const [until, setUntil] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const load = () => icecap.api<{ accounts: AdminProAccount[] }>("/api/admin/pro").then((r) => setRows(r.accounts), (e: Error) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  const grant = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      await icecap.api("/api/admin/grants", { body: { email, until: until || null, note: note || null } })
      setEmail("")
      setUntil("")
      setNote("")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const revoke = async (email: string) => {
    if (!confirm(`Take Pro away from ${email}?`)) return
    await icecap.api("/api/admin/grants", { method: "DELETE", body: { email } }).catch((e: Error) => setError(e.message))
    load()
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-1">Pro accounts</h1>
      <p className="text-gray-500 mb-8">Paid through Stripe, or given by email (testers, early adopters).</p>

      <form onSubmit={grant} className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-gray-500">
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm w-64" />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Until (empty = for good)
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </label>
        <label className="text-xs font-semibold text-gray-500">
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm w-48" />
        </label>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
          <Plus size={14} /> Give Pro
        </button>
      </form>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-400">
            <tr>
              <th className="p-3">Account</th>
              <th className="p-3">Source</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Until</th>
              <th className="p-3">Note</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">No Pro accounts yet.</td>
              </tr>
            )}
            {rows?.map((r, i) => (
              <tr key={i} className="border-t border-gray-50">
                <td className="p-3 font-medium">{r.email ?? r.user_id}</td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-1 text-xs font-bold">
                    <Crown size={12} className={r.source === "stripe" ? "text-yellow-500" : "text-blue-500"} />
                    {r.source === "stripe" ? `Stripe${r.environment === "sandbox" ? " (test)" : ""}` : "Given"}
                  </span>
                </td>
                <td className="p-3 capitalize">{r.plan}</td>
                <td className="p-3">{r.until ? new Date(r.until).toLocaleDateString() : "For good"}</td>
                <td className="p-3 text-gray-500">{r.note ?? ""}</td>
                <td className="p-3 text-right">
                  {r.source === "grant" && r.email && (
                    <button onClick={() => revoke(r.email!)} className="text-red-500" title="Take Pro away">
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
