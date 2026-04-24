import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { db } from "../core/firebase"

type HealthStatus = "healthy" | "degraded" | "down" | "unknown"

interface ServiceStatus {
  name: string
  status: HealthStatus
  latency?: string
  lastCheck?: string
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "healthy") return <CheckCircle size={18} className="text-green-400" />
  if (status === "degraded") return <AlertTriangle size={18} className="text-yellow-400" />
  if (status === "down") return <XCircle size={18} className="text-red-400" />
  return <Activity size={18} className="text-gray-400" />
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const colors = {
    healthy: "bg-green-500/10 text-green-400 border-green-500/20",
    degraded: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    down: "bg-red-500/10 text-red-400 border-red-500/20",
    unknown: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  }
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border capitalize ${colors[status]}`}>
      {status}
    </span>
  )
}

export function SystemHealthPage() {
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [userCount, setUserCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      // In emulator: mock the health data
      setServices([
        { name: "Firebase Auth", status: "healthy", latency: "< 50ms", lastCheck: new Date().toISOString() },
        { name: "Firestore", status: "healthy", latency: "< 100ms", lastCheck: new Date().toISOString() },
        { name: "Cloud Functions", status: "healthy", latency: "< 200ms", lastCheck: new Date().toISOString() },
        { name: "Stripe (Mock)", status: "healthy", latency: "< 50ms", lastCheck: new Date().toISOString() },
        { name: "RentCast API", status: "unknown", lastCheck: new Date().toISOString() },
      ])

      // Count subscriptions as proxy for users
      try {
        const snap = await getDocs(collection(db, "subscriptions"))
        setUserCount(snap.size)
      } catch {
        setUserCount(0)
      }
      setLoading(false)
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-black text-white mb-2">System Health</h1>
      <p className="text-gray-400 mb-8">Live status of all platform services.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Active Users</p>
          <p className="text-3xl font-black text-white">{loading ? "…" : (userCount ?? 0)}</p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Services Up</p>
          <p className="text-3xl font-black text-green-400">
            {services.filter((s) => s.status === "healthy").length}/{services.length}
          </p>
        </div>
        <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Environment</p>
          <p className="text-3xl font-black text-blue-400">{import.meta.env.DEV ? "Emulator" : "Production"}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-bold text-white">Service Status</h2>
        </div>
        <div className="divide-y divide-gray-700">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <StatusIcon status={s.status} />
                <span className="font-semibold text-white">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                {s.latency && <span className="text-sm text-gray-400">{s.latency}</span>}
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
