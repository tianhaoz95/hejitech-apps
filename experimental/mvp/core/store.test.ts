import { describe, it, expect, beforeEach } from 'vitest'
import { usePropertyStore } from './store'

describe('PropertyStore', () => {
  beforeEach(() => {
    usePropertyStore.setState({
      price: 0,
      downPaymentPercent: 20,
      interestRate: 7,
      taxes: 0,
      hoa: 0,
      estimatedRent: 2000,
      rehabCost: 0,
      vacancyRate: 5,
      maintenanceRate: 5,
      managementFeeRate: 8,
    })
  })

  it('calculates metrics correctly for a typical property', () => {
    const store = usePropertyStore.getState()
    store.setPrice(500000)
    store.setEstimatedRent(3500)
    store.setTaxes(6000) // $500/mo
    store.setHoa(200)

    const metrics = usePropertyStore.getState().calculateMetrics()

    // Price: 500k
    // Down payment: 20% = 100k
    // Loan: 400k
    // Interest: 7%
    // Monthly mortgage: ~2661
    // Taxes: 500
    // HOA: 200
    // Vacancy (5%): 175
    // Maintenance (5%): 175
    // Management (8%): 280
    // Total expenses (excl. mortgage): 500 + 200 + 175 + 175 + 280 = 1330
    // Cash flow: 3500 - 2661 - 1330 = -491
    
    expect(metrics.monthlyMortgage).toBeCloseTo(2661, 0)
    expect(metrics.monthlyExpenses).toBe(1330)
    expect(metrics.monthlyCashFlow).toBeCloseTo(-491, 0)
    
    // Cap Rate: (3500 - 1330) * 12 / 500000 = 2170 * 12 / 500000 = 26040 / 500000 = 5.2%
    expect(metrics.capRate).toBeCloseTo(5.2, 1)
    
    // GRM: 500000 / (3500 * 12) = 500000 / 42000 = 11.9
    expect(metrics.grm).toBeCloseTo(11.9, 1)
    
    // 1% Rule: 3500 / 500000 = 0.7%
    expect(metrics.onePercentRule).toBeCloseTo(0.7, 1)
  })

  it('handles zero price correctly', () => {
    const metrics = usePropertyStore.getState().calculateMetrics()
    expect(metrics.capRate).toBe(0)
    expect(metrics.grm).toBe(0)
    expect(metrics.onePercentRule).toBe(0)
  })
})
