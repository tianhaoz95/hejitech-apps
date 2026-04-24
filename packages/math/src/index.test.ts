import { describe, it, expect } from "vitest"
import {
  calcRentalMetrics,
  calcFlipMetrics,
  calcBrrrrMetrics,
  calcMonthlyMortgage,
  quickCashFlowEstimate,
  validatePropertyData,
  DEFAULT_ASSUMPTIONS,
} from "./index"
import type { PropertyData } from "@icecap/types"

const baseRentalProperty: PropertyData = {
  mode: "rental",
  price: 300000,
  address: "123 Test St, Austin TX 78701",
  url: "https://redfin.com/test",
  taxes: 6000,
  hoa: 100,
  estimatedRent: 2000,
  rehabCost: 10000,
  arv: 330000,
  holdingCosts: 0,
  assumptions: { ...DEFAULT_ASSUMPTIONS },
}

const baseFlipProperty: PropertyData = {
  mode: "flip",
  price: 200000,
  address: "456 Flip Ave",
  url: "https://zillow.com/flip",
  taxes: 4000,
  hoa: 0,
  estimatedRent: 0,
  rehabCost: 30000,
  arv: 300000,
  holdingCosts: 5000,
  assumptions: { ...DEFAULT_ASSUMPTIONS },
}

describe("calcMonthlyMortgage", () => {
  it("returns 0 for zero loan amount", () => {
    expect(calcMonthlyMortgage(0, 7, 30)).toBe(0)
  })

  it("calculates correctly for standard 30yr fixed", () => {
    // $240k loan at 7% for 30yr ≈ $1596.73/mo (standard amortization formula)
    const result = calcMonthlyMortgage(240000, 7, 30)
    expect(result).toBeCloseTo(1596.73, 0)
  })

  it("handles zero interest rate", () => {
    // Zero interest = principal / months
    expect(calcMonthlyMortgage(120000, 0, 10)).toBeCloseTo(1000, 0)
  })
})

describe("calcRentalMetrics", () => {
  it("returns zero metrics for zero price", () => {
    const data: PropertyData = { ...baseRentalProperty, price: 0 }
    const m = calcRentalMetrics(data)
    expect(m.monthlyCashFlow).toBe(0)
    expect(m.capRate).toBe(0)
  })

  it("calculates monthly mortgage component", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // 20% down = $240k loan at 7% for 30yr ≈ $1597/mo
    expect(m.monthlyMortgage).toBeCloseTo(1597, 0)
  })

  it("includes all monthly expense components", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // taxes: 6000/12=500, hoa:100, vacancy:5%*2000=100, maintenance:5%*2000=100, mgmt:8%*2000=160
    expect(m.monthlyExpenses).toBeCloseTo(960, 0)
  })

  it("computes cash flow = rent - mortgage - expenses", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    expect(m.monthlyCashFlow).toBeCloseTo(m.monthlyMortgage * -1 + 2000 - m.monthlyExpenses, 0)
  })

  it("computes cap rate correctly", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // NOI = (rent - monthly_expenses) * 12, Cap Rate = NOI / price
    const noi = (2000 - 960) * 12
    const expectedCapRate = (noi / 300000) * 100
    expect(m.capRate).toBeCloseTo(expectedCapRate, 1)
  })

  it("computes 1% rule", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // 2000 / 300000 = 0.667%
    expect(m.onePercentRule).toBeCloseTo(0.67, 1)
  })

  it("computes GRM", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // 300000 / (2000 * 12) = 12.5
    expect(m.grm).toBeCloseTo(12.5, 1)
  })

  it("computes totalCashToClose including closing costs and rehab", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    // down: 60000, rehab: 10000, closing: 3% * 300000 = 9000 → total = 79000
    expect(m.totalCashToClose).toBeCloseTo(79000, 0)
  })

  it("computes CoC return", () => {
    const m = calcRentalMetrics(baseRentalProperty)
    expect(m.cocReturn).toBeCloseTo((m.annualCashFlow / 79000) * 100, 1)
  })
})

describe("calcFlipMetrics", () => {
  it("returns zeros for zero price", () => {
    const data: PropertyData = { ...baseFlipProperty, price: 0 }
    const m = calcFlipMetrics(data)
    expect(m.flipProfit).toBe(0)
    expect(m.mao).toBe(0)
  })

  it("calculates flip profit correctly", () => {
    const m = calcFlipMetrics(baseFlipProperty)
    // sellingCosts = 6% * 300000 = 18000
    // totalBasis = 200000 + 30000 + 5000 + 18000 = 253000
    // profit = 300000 - 253000 = 47000
    expect(m.flipProfit).toBeCloseTo(47000, 0)
    expect(m.totalBasis).toBeCloseTo(253000, 0)
  })

  it("calculates MAO (70% rule)", () => {
    const m = calcFlipMetrics(baseFlipProperty)
    // MAO = 300000 * 0.7 - 30000 = 210000 - 30000 = 180000
    expect(m.mao).toBeCloseTo(180000, 0)
  })

  it("calculates flip ROI", () => {
    const m = calcFlipMetrics(baseFlipProperty)
    // cashInvested = 20% * 200000 + 30000 + 5000 = 40000 + 35000 = 75000
    // ROI = 47000 / 75000 * 100 ≈ 62.67%
    expect(m.flipROI).toBeCloseTo(62.67, 1)
  })
})

describe("calcBrrrrMetrics", () => {
  it("includes rental metrics", () => {
    const m = calcBrrrrMetrics(baseRentalProperty)
    expect(m.monthlyCashFlow).toBeDefined()
    expect(m.capRate).toBeDefined()
  })

  it("calculates after-refi equity at 75% LTV", () => {
    const m = calcBrrrrMetrics(baseRentalProperty)
    // ARV = 330000, refi 75% LTV = 247500 loan
    // equity = 330000 - 247500 = 82500
    expect(m.afterRefiEquity).toBeCloseTo(82500, 0)
  })

  it("calculates post-refi cash flow", () => {
    const m = calcBrrrrMetrics(baseRentalProperty)
    // refi loan = 247500 at 7% for 30yr ≈ 1646.61/mo
    // rent = 2000, expenses = 960
    // post-refi cf = 2000 - 1646.61 - 960 = -606.61
    expect(m.postRefiCashFlow).toBeCloseTo(-606.61, 0)
  })

  it("marks infinite return when all cash pulled out", () => {
    const data: PropertyData = {
      ...baseRentalProperty,
      price: 100000,
      arv: 200000,
      rehabCost: 20000,
      assumptions: { ...DEFAULT_ASSUMPTIONS, downPaymentPercent: 10, closingCostsPercent: 2 },
    }
    const m = calcBrrrrMetrics(data)
    // total invested = 10k (down) + 20k (rehab) + 2k (closing) = 30k
    // refi loan = 75% * 200k = 150k
    // original loan = 90k
    // cash pulled out = 150k - 90k = 60k
    // 60k > 30k invested → infinite return
    expect(m.infiniteReturn).toBe(true)
    expect(m.cashLeftIn).toBe(0)
    expect(m.postRefiCocReturn).toBe(100)
  })
})

describe("quickCashFlowEstimate", () => {
  it("returns a reasonable estimate for $300k house", () => {
    const cf = quickCashFlowEstimate(300000)
    // Should be a negative number (most US markets don't cash flow at 0.7% rent factor)
    expect(typeof cf).toBe("number")
    expect(cf).toBeLessThan(500) // sanity check upper bound
  })
})

describe("validatePropertyData", () => {
  it("returns error for missing price", () => {
    const errors = validatePropertyData({ mode: "rental", price: 0 })
    expect(errors).toContain("Price must be greater than 0")
  })

  it("returns error for rental without rent", () => {
    const errors = validatePropertyData({ mode: "rental", price: 200000, estimatedRent: 0 })
    expect(errors).toContain("Estimated rent must be greater than 0 for rental analysis")
  })

  it("returns no errors for valid rental property", () => {
    const errors = validatePropertyData({
      mode: "rental",
      price: 300000,
      estimatedRent: 2000,
      assumptions: DEFAULT_ASSUMPTIONS,
    })
    expect(errors).toHaveLength(0)
  })

  it("returns error for invalid interest rate", () => {
    const errors = validatePropertyData({
      mode: "rental",
      price: 300000,
      estimatedRent: 2000,
      assumptions: { ...DEFAULT_ASSUMPTIONS, interestRate: 50 },
    })
    expect(errors).toContain("Interest rate must be between 0% and 30%")
  })
})
