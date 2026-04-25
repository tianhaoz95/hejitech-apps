import { useState, useEffect } from "react"
import { collection, getDocs, orderBy, query } from "firebase/firestore"
import { BarChart2, AlertTriangle } from "lucide-react"
import { db } from "../core/firebase"
import type { ScraperReport } from "@icecap/types"

export function ScraperHealthPage() {
  const [reports, setReports] = useState<ScraperReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "scraper_reports"), orderBy("createdAt", "desc"))
        )
        setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScraperReport)))
      } catch {
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const bySite = reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.site] = (acc[r.site] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">Scraper Health</h1>
      <p className="text-gray-500 mb-8">User-reported scraper issues and site breakdown.</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {(["redfin", "zillow", "realtor"] as const).map((site) => (
          <div key={site} className="bg-white rounded-2xl p-5 border border-gray-100">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1 capitalize">
              {site}
            </p>
            <p className={`text-3xl font-black ${(bySite[site] || 0) > 0 ? "text-yellow-600" : "text-green-600"}`}>
              {bySite[site] ?? 0}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">reports</p>
          </div>
        ))}
      </div>

      {/* Reports table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-600" />
          <h2 className="font-bold text-gray-900">Recent Reports</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
            <p>No scraper reports yet — that's a good sign!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs font-bold uppercase">
                <th className="text-left p-4">Site</th>
                <th className="text-left p-4">Issue</th>
                <th className="text-left p-4">URL</th>
                <th className="text-left p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.slice(0, 50).map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 capitalize font-semibold text-gray-900">{r.site}</td>
                  <td className="p-4 text-gray-600">{r.issue}</td>
                  <td className="p-4">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate block max-w-xs">
                      {r.url}
                    </a>
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
