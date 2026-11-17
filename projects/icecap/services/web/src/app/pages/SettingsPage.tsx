import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Settings, Save, Crown, ExternalLink } from "lucide-react"
import { icecap } from "../../lib/icecap"
import { useAuth } from "../hooks/useAuth"
import { DEFAULT_ASSUMPTIONS } from "@icecap/math"
import type { PropertyAssumptions } from "@icecap/types"

export function SettingsPage() {
  const { user, pro, isPro: isSubscribed } = useAuth()
  const navigate = useNavigate()
  const [assumptions, setAssumptions] = useState<PropertyAssumptions>({ ...DEFAULT_ASSUMPTIONS })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    icecap.settings.get().then((s) => {
      if (s) setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...s.defaultAssumptions })
    })
  }, [user])

  const deleteData = async () => {
    if (!confirm("Delete all of your saved deals and settings? This can't be undone.")) return
    try {
      await icecap.api("/api/account", { method: "DELETE" })
      setAssumptions({ ...DEFAULT_ASSUMPTIONS })
      alert("Your Icecap data was deleted.")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't delete your data.")
    }
  }

  const update = <K extends keyof PropertyAssumptions>(key: K, value: PropertyAssumptions[K]) => {
    setAssumptions((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      await icecap.settings.save(assumptions)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const InputRow = ({
    label,
    field,
    min,
    max,
    step = 0.5,
    suffix = "%",
  }: {
    label: string
    field: keyof PropertyAssumptions
    min: number
    max: number
    step?: number
    suffix?: string
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={assumptions[field] as number}
          onChange={(e) => update(field, Number(e.target.value) as PropertyAssumptions[typeof field])}
          className="w-20 text-right font-bold border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-hidden focus:border-blue-500"
        />
        <span className="text-gray-400 text-sm w-4">{suffix}</span>
      </div>
    </div>
  )

  return (
    <div className="p-10">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Settings</h2>
      <p className="text-gray-400 mb-8">Default assumptions applied to all new analyses.</p>

      <div className="max-w-xl bg-white rounded-4xl border border-gray-100 shadow-xs p-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings size={20} className="text-blue-600" />
          <h3 className="text-lg font-black text-gray-900">Default Loan Assumptions</h3>
        </div>

        <div className="divide-y divide-gray-50">
          <InputRow label="Down Payment" field="downPaymentPercent" min={0} max={100} step={5} />
          <InputRow label="Interest Rate" field="interestRate" min={1} max={20} step={0.25} />
          <InputRow label="Loan Term (years)" field="loanTermYears" min={10} max={30} step={5} suffix="yr" />
          <InputRow label="Vacancy Rate" field="vacancyRate" min={0} max={25} />
          <InputRow label="Maintenance Rate" field="maintenanceRate" min={0} max={20} />
          <InputRow label="Management Fee" field="managementFeeRate" min={0} max={20} />
          <InputRow label="Closing Costs" field="closingCostsPercent" min={0} max={10} step={0.5} />
          <InputRow label="Selling Costs" field="sellingCostsPercent" min={0} max={15} step={0.5} />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
              saved
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
            }`}
          >
            <Save size={16} />
            {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="max-w-xl bg-white rounded-4xl border border-gray-100 shadow-xs p-8 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-blue-600" />
            <h3 className="text-lg font-black text-gray-900">Subscription & Billing</h3>
          </div>
          <button
            onClick={() => navigate("/billing")}
            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
          >
            View Details
            <ExternalLink size={12} />
          </button>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Current Plan</p>
            <h4 className="text-xl font-black text-gray-900 capitalize">
              {isSubscribed ? "Icecap Pro" : "No plan"}
            </h4>
            <p className="text-sm text-gray-500 mt-1 text-balance">
              {isSubscribed 
                ? (pro?.until ? `Active until ${new Date(pro.until).toLocaleDateString()}.` : "Active for good.")
                : "Unlock full features with a pro plan."}
            </p>
          </div>
          <button
            onClick={() => navigate("/billing")}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-xs"
          >
            {isSubscribed ? "Manage" : "Upgrade"}
          </button>
        </div>

        <div className="mt-6 rounded-2xl p-6 border border-red-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Your data</p>
            <p className="text-sm text-gray-500 text-balance">
              Delete every deal and setting Icecap keeps for this account. Your plan and your HEJI TECH sign-in stay.
            </p>
          </div>
          <button
            onClick={deleteData}
            className="px-5 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-all shrink-0"
            data-testid="delete-data"
          >
            Delete my data
          </button>
        </div>
      </div>
    </div>
  )
}

