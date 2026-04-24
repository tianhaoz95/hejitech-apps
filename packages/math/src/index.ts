import type {
  PropertyData,
  PropertyAssumptions,
  RentalMetrics,
  FlipMetrics,
  BrrrrMetrics,
} from "@icecap/types"

export const DEFAULT_ASSUMPTIONS: PropertyAssumptions = {
  downPaymentPercent: 20,
  interestRate: 7,
  loanTermYears: 30,
  vacancyRate: 5,
  maintenanceRate: 5,
  managementFeeRate: 8,
  closingCostsPercent: 3,
  sellingCostsPercent: 6,
}

// ─── Core Primitives ──────────────────────────────────────────────────────────

export function calcMonthlyMortgage(
  loanAmount: number,
  annualInterestRate: number,
  loanTermYears: number
): number {
  if (loanAmount <= 0) return 0
  if (annualInterestRate <= 0) return loanAmount / (loanTermYears * 12)

  const monthlyRate = annualInterestRate / 100 / 12
  const n = loanTermYears * 12
  return (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1)
}

export function calcDownPayment(price: number, downPaymentPercent: number): number {
  return price * (downPaymentPercent / 100)
}

export function calcLoanAmount(price: number, downPaymentPercent: number): number {
  return price - calcDownPayment(price, downPaymentPercent)
}

// ─── Rental Metrics ───────────────────────────────────────────────────────────

export function calcRentalMetrics(data: PropertyData): RentalMetrics {
  const { price, taxes, hoa, estimatedRent, rehabCost, assumptions } = data
  const {
    downPaymentPercent,
    interestRate,
    loanTermYears,
    vacancyRate,
    maintenanceRate,
    managementFeeRate,
    closingCostsPercent,
  } = assumptions

  if (price <= 0) {
    return zeroRentalMetrics()
  }

  const downPayment = calcDownPayment(price, downPaymentPercent)
  const loanAmount = calcLoanAmount(price, downPaymentPercent)
  const monthlyMortgage = calcMonthlyMortgage(loanAmount, interestRate, loanTermYears)

  const monthlyTaxes = taxes / 12
  const monthlyVacancy = (vacancyRate / 100) * estimatedRent
  const monthlyMaintenance = (maintenanceRate / 100) * estimatedRent
  const monthlyManagement = (managementFeeRate / 100) * estimatedRent
  const monthlyExpenses = monthlyTaxes + hoa + monthlyVacancy + monthlyMaintenance + monthlyManagement

  const noi = (estimatedRent - monthlyExpenses) * 12
  const monthlyCashFlow = estimatedRent - monthlyMortgage - monthlyExpenses
  const annualCashFlow = monthlyCashFlow * 12

  const capRate = price > 0 ? (noi / price) * 100 : 0
  const totalCashToClose = downPayment + (rehabCost ?? 0) + price * (closingCostsPercent / 100)
  const cocReturn = totalCashToClose > 0 ? (annualCashFlow / totalCashToClose) * 100 : 0
  const grm = estimatedRent > 0 ? price / (estimatedRent * 12) : 0
  const onePercentRule = price > 0 ? (estimatedRent / price) * 100 : 0

  return {
    monthlyMortgage: round2(monthlyMortgage),
    monthlyExpenses: round2(monthlyExpenses),
    monthlyCashFlow: round2(monthlyCashFlow),
    annualCashFlow: round2(annualCashFlow),
    capRate: round2(capRate),
    cocReturn: round2(cocReturn),
    grm: round2(grm),
    onePercentRule: round2(onePercentRule),
    totalCashToClose: round2(totalCashToClose),
    noi: round2(noi),
  }
}

// ─── Flip Metrics ─────────────────────────────────────────────────────────────

export function calcFlipMetrics(data: PropertyData): FlipMetrics {
  const { price, rehabCost, arv, holdingCosts, assumptions } = data
  const { downPaymentPercent, sellingCostsPercent } = assumptions

  if (price <= 0 || arv <= 0) {
    return zeroFlipMetrics()
  }

  const sellingCosts = (sellingCostsPercent / 100) * arv
  const totalBasis = price + rehabCost + holdingCosts + sellingCosts
  const flipProfit = arv - totalBasis

  const cashInvested = calcDownPayment(price, downPaymentPercent) + rehabCost + holdingCosts
  const flipROI = cashInvested > 0 ? (flipProfit / cashInvested) * 100 : 0

  const mao = arv * 0.7 - rehabCost

  return {
    totalBasis: round2(totalBasis),
    flipProfit: round2(flipProfit),
    flipROI: round2(flipROI),
    mao: round2(mao),
    sellingCosts: round2(sellingCosts),
  }
}

// ─── BRRRR Metrics ────────────────────────────────────────────────────────────

export function calcBrrrrMetrics(data: PropertyData): BrrrrMetrics {
  const rental = calcRentalMetrics(data)
  const { arv, rehabCost, assumptions } = data

  // After refi: typically 75% LTV of ARV
  const refiLTV = 0.75
  const refiLoanAmount = arv * refiLTV
  const totalInvested =
    calcDownPayment(data.price, assumptions.downPaymentPercent) +
    rehabCost +
    data.price * (assumptions.closingCostsPercent / 100)

  const cashPulledOut = refiLoanAmount - calcLoanAmount(data.price, assumptions.downPaymentPercent)
  const cashLeftIn = Math.max(0, totalInvested - cashPulledOut)
  const afterRefiEquity = arv - refiLoanAmount

  const infiniteReturn = cashLeftIn <= 0

  return {
    ...rental,
    afterRefiEquity: round2(afterRefiEquity),
    cashLeftIn: round2(cashLeftIn),
    infiniteReturn,
  }
}

// ─── Wholesaler MAO ───────────────────────────────────────────────────────────

export function calcMAO(arv: number, rehabCost: number, wholesaleFee = 0): number {
  return round2(arv * 0.7 - rehabCost - wholesaleFee)
}

// ─── Quick estimate (for map badges, no mortgage) ─────────────────────────────

export function quickCashFlowEstimate(price: number): number {
  const estimatedRent = price * 0.007
  const loanAmount = price * 0.8
  const monthlyRate = 0.07 / 12
  const n = 360
  const mortgage = (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, n))) / (Math.pow(1 + monthlyRate, n) - 1)
  const expenses = estimatedRent * 0.35
  return Math.round(estimatedRent - mortgage - expenses)
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validatePropertyData(data: Partial<PropertyData>): string[] {
  const errors: string[] = []
  if (!data.price || data.price <= 0) errors.push("Price must be greater than 0")
  if (data.mode === "rental" && (!data.estimatedRent || data.estimatedRent <= 0))
    errors.push("Estimated rent must be greater than 0 for rental analysis")
  if (data.mode === "flip" && (!data.arv || data.arv <= 0))
    errors.push("ARV must be greater than 0 for flip analysis")
  if (data.assumptions?.downPaymentPercent !== undefined) {
    if (data.assumptions.downPaymentPercent < 0 || data.assumptions.downPaymentPercent > 100)
      errors.push("Down payment must be between 0% and 100%")
  }
  if (data.assumptions?.interestRate !== undefined) {
    if (data.assumptions.interestRate < 0 || data.assumptions.interestRate > 30)
      errors.push("Interest rate must be between 0% and 30%")
  }
  return errors
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round2(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0
  return Math.round(n * 100) / 100
}

function zeroRentalMetrics(): RentalMetrics {
  return {
    monthlyMortgage: 0,
    monthlyExpenses: 0,
    monthlyCashFlow: 0,
    annualCashFlow: 0,
    capRate: 0,
    cocReturn: 0,
    grm: 0,
    onePercentRule: 0,
    totalCashToClose: 0,
    noi: 0,
  }
}

function zeroFlipMetrics(): FlipMetrics {
  return {
    totalBasis: 0,
    flipProfit: 0,
    flipROI: 0,
    mao: 0,
    sellingCosts: 0,
  }
}

export type { PropertyData, PropertyAssumptions, RentalMetrics, FlipMetrics, BrrrrMetrics }
