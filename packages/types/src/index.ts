// ─── Analysis ────────────────────────────────────────────────────────────────

export type AnalysisMode = "rental" | "flip" | "brrrr"

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
}

export interface SavedProperty extends PropertyData {
  id: string
  userId: string
  rentalMetrics?: RentalMetrics
  flipMetrics?: FlipMetrics
  createdAt: number
  updatedAt: number
}

// ─── Users & Auth ─────────────────────────────────────────────────────────────

export type SubscriptionTier = "pro" | "pro_max"
export type SubscriptionStatus =
  | "trialling"
  | "active"
  | "past_due"
  | "unpaid"
  | "cancelled"
  | "none"

export interface Subscription {
  uid: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  tier: SubscriptionTier | null
  status: SubscriptionStatus
  currentPeriodEnd?: number
  aiUsageCurrentMonth: number
  aiQuotaLimit: number
  trialEnd?: number
  createdAt: number
  updatedAt: number
}

export interface UserSettings {
  uid: string
  defaultAssumptions: PropertyAssumptions
  updatedAt: number
}

export interface UserProfile {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  role: "user" | "admin"
  createdAt: number
}

// ─── Promo Codes ──────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string
  code: string
  type: "stripe_linked" | "internal_free"
  stripeCouponId?: string
  usageLimit: number | null
  usageCount: number
  isActive: boolean
  createdBy: string
  createdAt: number
}

export interface PromoCodeRedemption {
  id: string
  promoCodeId: string
  uid: string
  redeemedAt: number
}

// ─── API Contracts ────────────────────────────────────────────────────────────

export interface RentEstimateRequest {
  address?: string
  zipCode?: string
  bedrooms?: number
  bathrooms?: number
  sqft?: number
  price: number
}

export interface RentEstimateResponse {
  estimate: number
  source: "rentcast" | "heuristic"
  confidence: "high" | "medium" | "low"
}

export interface CreateCheckoutSessionRequest {
  tier: SubscriptionTier
  promoCode?: string
  successUrl: string
  cancelUrl: string
}

export interface CreateCheckoutSessionResponse {
  sessionId: string
  url: string
}

export interface ValidatePromoCodeRequest {
  code: string
}

export interface ValidatePromoCodeResponse {
  valid: boolean
  type?: "stripe_linked" | "internal_free"
  stripeCouponId?: string
  discountDescription?: string
}

export interface AnalyzePropertyRequest {
  propertyData: PropertyData
  listingDescription: string
}

export interface AnalyzePropertyResponse {
  summary: string
  redFlags: string[]
  rehabEstimate: "low" | "medium" | "high"
  recommendation: string
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface ScraperReport {
  id: string
  site: "redfin" | "zillow" | "realtor"
  url: string
  issue: string
  uid: string
  createdAt: number
}

export interface SystemHealth {
  functions: "healthy" | "degraded" | "down"
  firestore: "healthy" | "degraded" | "down"
  stripe: "healthy" | "degraded" | "down"
  rentcast: "healthy" | "degraded" | "down"
  lastChecked: number
}
