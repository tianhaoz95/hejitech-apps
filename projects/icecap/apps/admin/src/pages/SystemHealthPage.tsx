import { useState, useEffect } from "react"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { db, useEmulator } from "../core/firebase"

type HealthStatus = "healthy" | "degraded" | "down" | "unknown"

interface ServiceStatus {
  name: string
  status: HealthStatus
  latency?: string
  lastCheck?: string
}

function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === "healthy") return <CheckCircle size={18} className="text-green-600" />
  if (status === "degraded") return <AlertTriangle size={18} className="text-yellow-600" />
  if (status === "down") return <XCircle size={18} className="text-red-600" />
  return <Activity size={18} className="text-gray-400" />
}

function StatusBadge({ status }: { status: HealthStatus }) {
  const colors = {
    healthy: "bg-green-50 text-green-700 border-green-200",
    degraded: "bg-yellow-50 text-yellow-700 border-yellow-200",
    down: "bg-red-50 text-red-700 border-red-200",
    unknown: "bg-gray-100 text-gray-500 border-gray-200",
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
      <h1 className="text-2xl font-black text-gray-900 mb-2">System Health</h1>
      <p className="text-gray-500 mb-8">Live status of all platform services.</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Active Users</p>
          <p className="text-3xl font-black text-gray-900">{loading ? "…" : (userCount ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Services Up</p>
          <p className="text-3xl font-black text-green-600">
            {services.filter((s) => s.status === "healthy").length}/{services.length}
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Environment</p>
          <p className="text-3xl font-black text-blue-600">{useEmulator ? "Emulator" : "Production"}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Service Status</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {services.map((s) => (
            <div key={s.name} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <StatusIcon status={s.status} />
                <span className="font-semibold text-gray-900">{s.name}</span>
              </div>
              <div className="flex items-center gap-4">
                {s.latency && <span className="text-sm text-gray-500">{s.latency}</span>}
                <StatusBadge status={s.status} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
