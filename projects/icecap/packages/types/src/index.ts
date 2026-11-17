// ─── Analysis ────────────────────────────────────────────────────────────────

export type AnalysisMode = "rental" | "str" | "both" | "flip" | "brrrr"

export interface PropertyAssumptions {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  vacancyRate: number
  maintenanceRate: number
  managementFeeRate: number
  closingCostsPercent: number
  sellingCostsPercent: number
}

export interface StrAssumptions {
  adr: number
  occupancyRate: number // 0-100
  platformFeeRate: number // 3-15%
  cleaningFeeIncome: number // Per booking
  cleaningFeeExpense: number // Per booking
  avgStayLength: number // Days (needed for cleaning fee calc)
  monthlyUtilities: number
}

export interface PropertyData {
  mode: AnalysisMode
  price: number
  address: string
  url: string
  taxes: number
  hoa: number
  estimatedRent: number
  rehabCost: number
  arv: number
  holdingCosts: number
  description?: string
  assumptions: PropertyAssumptions
  strAssumptions?: StrAssumptions
}

export interface RentalMetrics {
  monthlyMortgage: number
  monthlyExpenses: number
  monthlyCashFlow: number
  annualCashFlow: number
  capRate: number
  cocReturn: number
  grm: number
  onePercentRule: number
  totalCashToClose: number
  noi: number
}

export interface StrMetrics extends RentalMetrics {
  adr: number
  revPar: number
  occupancyRate: number
  annualPlatformFees: number
  annualCleaningFees: number // (Income - Expense) * Bookings
}

export interface FlipMetrics {
  totalBasis: number
  flipProfit: number
  flipROI: number
  mao: number
  sellingCosts: number
}

export interface BrrrrMetrics extends RentalMetrics {
  afterRefiEquity: number
  cashLeftIn: number
  infiniteReturn: boolean
  postRefiCashFlow: number
  postRefiCocReturn: number
}

export interface SavedProperty extends PropertyData {
  id: string
  userId: string
  rentalMetrics?: RentalMetrics
  strMetrics?: StrMetrics
  flipMetrics?: FlipMetrics
  createdAt: number
  updatedAt: number
}

// ─── Pro ─────────────────────────────────────────────────────────────────────
// Icecap Pro is sold on the web through the shared HEJI Stripe account (a yearly plan with a free week,
// or lifetime) or given by email; the Worker answers GET /api/pro for every surface.

export type ProPlan = "annual" | "lifetime"

export interface ProOffer {
  plan: ProPlan
  /** Formatted, e.g. "$49.99". */
  price: string
  interval: "year" | null
  trial_days: number
}

export interface ProStatus {
  pro: boolean
  /** Where Pro comes from; null without it. */
  source: "stripe" | "grant" | null
  plan: ProPlan | null
  /** When it renews or ends; null for lifetime (and without Pro). */
  until: string | null
  /** "stripe" when the plan is managed in Stripe's billing portal. */
  manage: "stripe" | null
  /** Whether the account ever bought or tried Pro (no second free week). */
  had_purchase: boolean
  email: string | null
  /** Plans on sale, with prices from Stripe. */
  offers: ProOffer[]
}

export interface UserSettings {
  defaultAssumptions: PropertyAssumptions
  updatedAt: number
}

// ─── API Contracts ────────────────────────────────────────────────────────────

export interface RentEstimate {
  estimate: number
  source: "heuristic"
  confidence: "low"
}
// ─── AI Co-Pilot ─────────────────────────────────────────────────────────────

export type AdjustableField =
  | "interestRate"
  | "downPaymentPercent"
  | "vacancyRate"
  | "managementFeeRate"
  | "maintenanceRate"
  | "closingCostsPercent"
  | "loanTermYears"
  | "estimatedRent"
  | "rehabCost"
  | "arv"
  | "price"
  | "holdingCosts"

export interface CopilotActionProposal {
  toolName: "proposePropertyAdjustment"
  propertyId: string
  propertyAddress: string
  field: AdjustableField
  newValue: number
  displayText: string
  explanation: string
}

export interface CopilotMessage {
  id: string
  role: "user" | "assistant"
  content: string
  actionProposal?: CopilotActionProposal
  actionStatus?: "pending" | "confirmed" | "cancelled"
  timestamp: number
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface AdminStats {
  accounts: number
  properties: number
  waitlist: number
  pro: { stripe: number; grants: number }
}

export interface AdminProAccount {
  email: string | null
  user_id: string | null
  source: "stripe" | "grant"
  plan: ProPlan
  until: string | null
  environment: string | null
  note: string | null
}

export interface WaitlistEntry {
  id: string
  email: string
  name: string | null
  source: string | null
  created_at: string
}
