import { create } from "zustand"

interface PropertyStore {
  mode: "rental" | "flip"
  price: number
  address: string
  url: string
  downPaymentPercent: number
  interestRate: number
  taxes: number
  hoa: number
  estimatedRent: number
  rehabCost: number
  arv: number
  holdingCosts: number
  sellingCostsPercent: number
  vacancyRate: number
  maintenanceRate: number
  managementFeeRate: number
  
  setMode: (v: "rental" | "flip") => void
  setPrice: (v: number) => void
  setAddress: (v: string) => void
  setUrl: (v: string) => void
  setDownPaymentPercent: (v: number) => void
  setInterestRate: (v: number) => void
  setTaxes: (v: number) => void
  setHoa: (v: number) => void
  setEstimatedRent: (v: number) => void
  setRehabCost: (v: number) => void
  setArv: (v: number) => void
  setHoldingCosts: (v: number) => void
  setSellingCostsPercent: (v: number) => void
  setVacancyRate: (v: number) => void
  setMaintenanceRate: (v: number) => void
  setManagementFeeRate: (v: number) => void
  
  calculateMetrics: () => {
    monthlyMortgage: number
    monthlyExpenses: number
    monthlyCashFlow: number
    capRate: number
    cocReturn: number
    grm: number
    onePercentRule: number
    flipProfit: number
    flipROI: number
    mao: number
  }
}

export const usePropertyStore = create<PropertyStore>((set, get) => ({
  mode: "rental",
  price: 0,
  address: "",
  url: "",
  downPaymentPercent: 20,
  interestRate: 7,
  taxes: 0,
  hoa: 0,
  estimatedRent: 2000,
  rehabCost: 0,
  arv: 0,
  holdingCosts: 0,
  sellingCostsPercent: 6,
  vacancyRate: 5,
  maintenanceRate: 5,
  managementFeeRate: 8,

  setMode: (mode) => set({ mode }),
  setPrice: (price) => set({ price, arv: price * 1.3 }), // Default ARV guess
  setAddress: (address) => set({ address }),
  setUrl: (url) => set({ url }),
  setDownPaymentPercent: (downPaymentPercent) => set({ downPaymentPercent }),
  setInterestRate: (interestRate) => set({ interestRate }),
  setTaxes: (taxes) => set({ taxes }),
  setHoa: (hoa) => set({ hoa }),
  setEstimatedRent: (estimatedRent) => set({ estimatedRent }),
  setRehabCost: (rehabCost) => set({ rehabCost }),
  setArv: (arv) => set({ arv }),
  setHoldingCosts: (holdingCosts) => set({ holdingCosts }),
  setSellingCostsPercent: (sellingCostsPercent) => set({ sellingCostsPercent }),
  setVacancyRate: (vacancyRate) => set({ vacancyRate }),
  setMaintenanceRate: (maintenanceRate) => set({ maintenanceRate }),
  setManagementFeeRate: (managementFeeRate) => set({ managementFeeRate }),

  calculateMetrics: () => {
    const { 
      price, downPaymentPercent, interestRate, taxes, hoa, 
      estimatedRent, vacancyRate, maintenanceRate, managementFeeRate, rehabCost,
      arv, holdingCosts, sellingCostsPercent
    } = get()
    
    if (price === 0) {
      return {
        monthlyMortgage: 0, monthlyExpenses: 0, monthlyCashFlow: 0,
        capRate: 0, cocReturn: 0, grm: 0, onePercentRule: 0,
        flipProfit: 0, flipROI: 0, mao: 0
      }
    }

    // Rental Metrics
    const downPayment = (downPaymentPercent / 100) * price
    const loanAmount = price - downPayment
    const monthlyRate = interestRate / 100 / 12
    const numPayments = 30 * 12
    
    const monthlyMortgage = 
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1)
    
    const monthlyTaxes = taxes / 12
    const monthlyVacancy = (vacancyRate / 100) * estimatedRent
    const monthlyMaintenance = (maintenanceRate / 100) * estimatedRent
    const monthlyManagement = (managementFeeRate / 100) * estimatedRent
    
    const monthlyExpenses = monthlyTaxes + hoa + monthlyVacancy + monthlyMaintenance + monthlyManagement
    const monthlyCashFlow = estimatedRent - (monthlyMortgage || 0) - monthlyExpenses
    
    const annualNOI = (estimatedRent - monthlyExpenses) * 12
    const capRate = (annualNOI / price) * 100
    
    const totalCashInvested = downPayment + (rehabCost || 0) + (price * 0.03)
    const cocReturn = (monthlyCashFlow * 12 / totalCashInvested) * 100
    const grm = price / (estimatedRent * 12)
    const onePercentRule = (estimatedRent / price) * 100
    
    // Flip Metrics
    const sellingCosts = (sellingCostsPercent / 100) * arv
    const totalBasis = price + rehabCost + holdingCosts + sellingCosts
    const flipProfit = arv - totalBasis
    const flipROI = (flipProfit / (price * (downPaymentPercent / 100) + rehabCost + holdingCosts)) * 100
    
    // Maximum Allowable Offer (70% Rule: MAO = ARV * 0.7 - Rehab)
    const mao = (arv * 0.7) - rehabCost

    return {
      monthlyMortgage: isNaN(monthlyMortgage) ? 0 : monthlyMortgage,
      monthlyExpenses,
      monthlyCashFlow,
      capRate: isNaN(capRate) ? 0 : capRate,
      cocReturn: isNaN(cocReturn) ? 0 : cocReturn,
      grm: isNaN(grm) ? 0 : grm,
      onePercentRule: isNaN(onePercentRule) ? 0 : onePercentRule,
      flipProfit,
      flipROI: isNaN(flipROI) ? 0 : flipROI,
      mao
    }
  }
}))
