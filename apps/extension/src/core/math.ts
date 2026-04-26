// Self-contained math engine for the extension (mirrors packages/math)

export interface PropertyAssumptions {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  vacancyRate: number
  maintenanceRate: number
  managementFeeRate: number
  closingCostsPercent: number
  sellingCostsPercent: number
  rentRatioPercent: number
}

export const DEFAULT_ASSUMPTIONS: PropertyAssumptions = {
  downPaymentPercent: 20,
  interestRate: 7,
  loanTermYears: 30,
  vacancyRate: 5,
  maintenanceRate: 5,
  managementFeeRate: 8,
  closingCostsPercent: 3,
  sellingCostsPercent: 6,
  rentRatioPercent: 0.7,
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

export interface PropertyInput {
  price: number
  taxes: number
  hoa: number
  estimatedRent: number
  rehabCost: number
  arv: number
  holdingCosts: number
  assumptions: PropertyAssumptions
}

function r2(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0
  return Math.round(n * 100) / 100
}

function monthlyMortgage(loanAmount: number, annualRate: number, termYears: number): number {
  if (loanAmount <= 0) return 0
  if (annualRate <= 0) return loanAmount / (termYears * 12)
  const mr = annualRate / 100 / 12
  const n = termYears * 12
  return (loanAmount * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1)
}

export function calcRentalMetrics(data: PropertyInput): RentalMetrics {
  const { price, taxes, hoa, estimatedRent, rehabCost, assumptions } = data
  const { downPaymentPercent, interestRate, loanTermYears, vacancyRate, maintenanceRate, managementFeeRate, closingCostsPercent } = assumptions

  if (price <= 0) return zeroRental()

  const down = price * (downPaymentPercent / 100)
  const loan = price - down
  const mortgage = monthlyMortgage(loan, interestRate, loanTermYears)

  const monthlyTaxes = taxes / 12
  const vacancy = (vacancyRate / 100) * estimatedRent
  const maintenance = (maintenanceRate / 100) * estimatedRent
  const management = (managementFeeRate / 100) * estimatedRent
  const expenses = monthlyTaxes + hoa + vacancy + maintenance + management

  const noi = (estimatedRent - expenses) * 12
  const cashFlow = estimatedRent - mortgage - expenses
  const annual = cashFlow * 12
  const capRate = price > 0 ? (noi / price) * 100 : 0
  const cashToClose = down + (rehabCost ?? 0) + price * (closingCostsPercent / 100)
  const coc = cashToClose > 0 ? (annual / cashToClose) * 100 : 0
  const grm = estimatedRent > 0 ? price / (estimatedRent * 12) : 0
  const onePercent = price > 0 ? (estimatedRent / price) * 100 : 0

  return {
    monthlyMortgage: r2(mortgage),
    monthlyExpenses: r2(expenses),
    monthlyCashFlow: r2(cashFlow),
    annualCashFlow: r2(annual),
    capRate: r2(capRate),
    cocReturn: r2(coc),
    grm: r2(grm),
    onePercentRule: r2(onePercent),
    totalCashToClose: r2(cashToClose),
    noi: r2(noi),
  }
}

export function calcFlipMetrics(data: PropertyInput): FlipMetrics {
  const { price, rehabCost, arv, holdingCosts, assumptions } = data
  const { downPaymentPercent, sellingCostsPercent } = assumptions

  if (price <= 0 || arv <= 0) return zeroFlip()

  const sellingCosts = (sellingCostsPercent / 100) * arv
  const totalBasis = price + rehabCost + holdingCosts + sellingCosts
  const profit = arv - totalBasis
  const cashIn = price * (downPaymentPercent / 100) + rehabCost + holdingCosts
  const roi = cashIn > 0 ? (profit / cashIn) * 100 : 0
  const mao = arv * 0.7 - rehabCost

  return {
    totalBasis: r2(totalBasis),
    flipProfit: r2(profit),
    flipROI: r2(roi),
    mao: r2(mao),
    sellingCosts: r2(sellingCosts),
  }
}

export function quickEstimate(price: number, assumptions: PropertyAssumptions = DEFAULT_ASSUMPTIONS): number {
  const rent = price * (assumptions.rentRatioPercent / 100)
  const loan = price * (1 - assumptions.downPaymentPercent / 100)
  const mr = assumptions.interestRate / 100 / 12
  const n = assumptions.loanTermYears * 12
  const mort = mr > 0
    ? (loan * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1)
    : loan / n
  const expenseRate = (assumptions.vacancyRate + assumptions.maintenanceRate + assumptions.managementFeeRate) / 100
  return Math.round(rent - mort - rent * expenseRate)
}

function zeroRental(): RentalMetrics {
  return { monthlyMortgage: 0, monthlyExpenses: 0, monthlyCashFlow: 0, annualCashFlow: 0, capRate: 0, cocReturn: 0, grm: 0, onePercentRule: 0, totalCashToClose: 0, noi: 0 }
}

function zeroFlip(): FlipMetrics {
  return { totalBasis: 0, flipProfit: 0, flipROI: 0, mao: 0, sellingCosts: 0 }
}
