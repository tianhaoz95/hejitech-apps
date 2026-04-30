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

export interface StrAssumptions {
  adr: number
  occupancyRate: number // 0-100
  platformFeeRate: number // 3-15%
  cleaningFeeIncome: number // Per booking
  cleaningFeeExpense: number // Per booking
  avgStayLength: number // Days (needed for cleaning fee calc)
  monthlyUtilities: number
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

export const DEFAULT_STR_ASSUMPTIONS: StrAssumptions = {
  adr: 200,
  occupancyRate: 60,
  platformFeeRate: 10,
  cleaningFeeIncome: 150,
  cleaningFeeExpense: 150,
  avgStayLength: 3,
  monthlyUtilities: 300,
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

export interface PropertyInput {
  price: number
  taxes: number
  hoa: number
  estimatedRent: number
  rehabCost: number
  arv: number
  holdingCosts: number
  assumptions: PropertyAssumptions
  strAssumptions?: StrAssumptions
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

export function calcStrMetrics(data: PropertyInput): StrMetrics {
  const { price, taxes, hoa, rehabCost, assumptions, strAssumptions } = data
  const { downPaymentPercent, interestRate, loanTermYears, maintenanceRate, managementFeeRate, closingCostsPercent } =
    assumptions

  if (price <= 0 || !strAssumptions) return zeroStr()

  const { adr, occupancyRate, platformFeeRate, cleaningFeeIncome, cleaningFeeExpense, avgStayLength, monthlyUtilities } =
    strAssumptions

  const down = price * (downPaymentPercent / 100)
  const loan = price - down
  const mortgage = monthlyMortgage(loan, interestRate, loanTermYears)

  // Gross Income
  const annualGrossRevenue = adr * 365 * (occupancyRate / 100)
  const monthlyGrossRevenue = annualGrossRevenue / 12
  const revPar = adr * (occupancyRate / 100)

  // Expenses
  const monthlyTaxes = taxes / 12
  const monthlyMaintenance = (maintenanceRate / 100) * monthlyGrossRevenue
  const monthlyManagement = (managementFeeRate / 100) * monthlyGrossRevenue
  const monthlyPlatformFees = (platformFeeRate / 100) * monthlyGrossRevenue

  const annualBookings = (365 * (occupancyRate / 100)) / avgStayLength
  const annualCleaningIncome = cleaningFeeIncome * annualBookings
  const annualCleaningExpense = cleaningFeeExpense * annualBookings
  const monthlyCleaningNet = (annualCleaningIncome - annualCleaningExpense) / 12

  const monthlyExpenses =
    monthlyTaxes +
    hoa +
    monthlyMaintenance +
    monthlyManagement +
    monthlyPlatformFees +
    monthlyUtilities -
    monthlyCleaningNet

  const monthlyCashFlow = monthlyGrossRevenue - mortgage - monthlyExpenses
  const annualCashFlow = monthlyCashFlow * 12
  const noi = (monthlyGrossRevenue - monthlyExpenses) * 12

  const capRate = price > 0 ? (noi / price) * 100 : 0
  const cashToClose = down + (rehabCost ?? 0) + price * (closingCostsPercent / 100)
  const coc = cashToClose > 0 ? (annualCashFlow / cashToClose) * 100 : 0
  const grm = monthlyGrossRevenue > 0 ? price / (monthlyGrossRevenue * 12) : 0
  const onePercent = price > 0 ? (monthlyGrossRevenue / price) * 100 : 0

  return {
    monthlyMortgage: r2(mortgage),
    monthlyExpenses: r2(monthlyExpenses),
    monthlyCashFlow: r2(monthlyCashFlow),
    annualCashFlow: r2(annualCashFlow),
    capRate: r2(capRate),
    cocReturn: r2(coc),
    grm: r2(grm),
    onePercentRule: r2(onePercent),
    totalCashToClose: r2(cashToClose),
    noi: r2(noi),
    adr: r2(adr),
    revPar: r2(revPar),
    occupancyRate: r2(occupancyRate),
    annualPlatformFees: r2(monthlyPlatformFees * 12),
    annualCleaningFees: r2(annualCleaningExpense),
  }
}

export interface StrategyComparison {
  bestStrategy: "ltr" | "str"
  breakevenOccupancy: number
  monthlyDifference: number
}

export function compareRentalStrategies(data: PropertyInput): StrategyComparison {
  const ltr = calcRentalMetrics(data)
  const str = calcStrMetrics(data)

  const monthlyDifference = str.monthlyCashFlow - ltr.monthlyCashFlow
  const bestStrategy = str.monthlyCashFlow > ltr.monthlyCashFlow ? "str" : "ltr"

  const { assumptions, strAssumptions, taxes, hoa, price } = data
  if (!strAssumptions) {
    return { bestStrategy: "ltr", breakevenOccupancy: 0, monthlyDifference: 0 }
  }

  const down = price * (assumptions.downPaymentPercent / 100)
  const loan = price - down
  const monthlyFixedStrExpenses =
    taxes / 12 + hoa + strAssumptions.monthlyUtilities + monthlyMortgage(loan, assumptions.interestRate, assumptions.loanTermYears)

  const variableRate = (assumptions.managementFeeRate + strAssumptions.platformFeeRate + assumptions.maintenanceRate) / 100
  const annualBookings = (365 * (strAssumptions.occupancyRate / 100)) / strAssumptions.avgStayLength
  const monthlyCleaningNet = ((strAssumptions.cleaningFeeIncome - strAssumptions.cleaningFeeExpense) * annualBookings) / 12

  const targetMonthlyRevenue = (ltr.monthlyCashFlow + monthlyFixedStrExpenses - monthlyCleaningNet) / (1 - variableRate)
  const breakevenOccupancy = (targetMonthlyRevenue / (strAssumptions.adr * 30.416)) * 100

  return {
    bestStrategy,
    breakevenOccupancy: r2(breakevenOccupancy),
    monthlyDifference: r2(monthlyDifference),
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

export function quickEstimateStr(price: number, assumptions: PropertyAssumptions, strAssumptions: StrAssumptions): number {
  const { adr, occupancyRate, platformFeeRate, monthlyUtilities, avgStayLength, cleaningFeeIncome, cleaningFeeExpense } = strAssumptions
  const annualGrossRevenue = adr * 365 * (occupancyRate / 100)
  const monthlyGrossRevenue = annualGrossRevenue / 12
  
  const loan = price * (1 - assumptions.downPaymentPercent / 100)
  const mr = assumptions.interestRate / 100 / 12
  const n = assumptions.loanTermYears * 12
  const mort = mr > 0
    ? (loan * (mr * Math.pow(1 + mr, n))) / (Math.pow(1 + mr, n) - 1)
    : loan / n

  const variableRate = (assumptions.managementFeeRate + platformFeeRate + assumptions.maintenanceRate) / 100
  const annualBookings = (365 * (occupancyRate / 100)) / avgStayLength
  const monthlyCleaningNet = ((cleaningFeeIncome - cleaningFeeExpense) * annualBookings) / 12
  
  const monthlyExpenses = (monthlyGrossRevenue * variableRate) + monthlyUtilities - monthlyCleaningNet
  return Math.round(monthlyGrossRevenue - mort - monthlyExpenses)
}

export function quickEstimateBest(
  price: number, 
  assumptions: PropertyAssumptions, 
  strAssumptions: StrAssumptions,
  metric: "ltr" | "str" | "best"
): number {
  if (metric === "ltr") return quickEstimate(price, assumptions)
  if (metric === "str") return quickEstimateStr(price, assumptions, strAssumptions)
  
  const ltr = quickEstimate(price, assumptions)
  const str = quickEstimateStr(price, assumptions, strAssumptions)
  return Math.max(ltr, str)
}

function zeroRental(): RentalMetrics {
  return { monthlyMortgage: 0, monthlyExpenses: 0, monthlyCashFlow: 0, annualCashFlow: 0, capRate: 0, cocReturn: 0, grm: 0, onePercentRule: 0, totalCashToClose: 0, noi: 0 }
}

function zeroStr(): StrMetrics {
  return { ...zeroRental(), adr: 0, revPar: 0, occupancyRate: 0, annualPlatformFees: 0, annualCleaningFees: 0 }
}

function zeroFlip(): FlipMetrics {
  return { totalBasis: 0, flipProfit: 0, flipROI: 0, mao: 0, sellingCosts: 0 }
}
