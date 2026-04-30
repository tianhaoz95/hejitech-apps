import { create } from "zustand"
import { persist } from "zustand/middleware"
import {
  calcRentalMetrics,
  calcStrMetrics,
  calcFlipMetrics,
  DEFAULT_ASSUMPTIONS,
  DEFAULT_STR_ASSUMPTIONS,
  type PropertyAssumptions,
  type StrAssumptions,
  type RentalMetrics,
  type StrMetrics,
  type FlipMetrics,
  type PropertyInput,
} from "./math"

export type AnalysisMode = "rental" | "str" | "both" | "flip" | "brrrr"
export type MapPinMetric = "ltr" | "str" | "best"

interface PropertyState {
  mode: AnalysisMode
  mapPinMetric: MapPinMetric
  price: number
  address: string
  url: string
  taxes: number
  hoa: number
  estimatedRent: number
  rehabCost: number
  arv: number
  holdingCosts: number
  description: string
  assumptions: PropertyAssumptions
  strAssumptions: StrAssumptions

  setMode: (v: AnalysisMode) => void
  setMapPinMetric: (v: MapPinMetric) => void
  setPrice: (v: number) => void
  setAddress: (v: string) => void
  setUrl: (v: string) => void
  setTaxes: (v: number) => void
  setHoa: (v: number) => void
  setEstimatedRent: (v: number) => void
  setRehabCost: (v: number) => void
  setArv: (v: number) => void
  setHoldingCosts: (v: number) => void
  setDescription: (v: string) => void
  setAssumption: <K extends keyof PropertyAssumptions>(key: K, value: PropertyAssumptions[K]) => void
  setStrAssumption: <K extends keyof StrAssumptions>(key: K, value: StrAssumptions[K]) => void
  loadFromScrape: (data: Partial<ScrapedData>) => void
  reset: () => void
  getPropertyInput: () => PropertyInput
  getMetrics: () => { rental: RentalMetrics; str: StrMetrics; flip: FlipMetrics }
}

export interface ScrapedData {
  price: number
  address: string
  url: string
  taxes: number
  hoa: number
  description: string
}

const initialState = {
  mode: "rental" as AnalysisMode,
  mapPinMetric: "ltr" as MapPinMetric,
  price: 0,
  address: "",
  url: "",
  taxes: 0,
  hoa: 0,
  estimatedRent: 0,
  rehabCost: 0,
  arv: 0,
  holdingCosts: 0,
  description: "",
  assumptions: { ...DEFAULT_ASSUMPTIONS },
  strAssumptions: { ...DEFAULT_STR_ASSUMPTIONS },
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setMode: (mode) => set({ mode }),
      setMapPinMetric: (mapPinMetric) => set({ mapPinMetric }),
      setPrice: (price) => set({ price, arv: price > 0 ? price * 1.2 : 0 }),
      setAddress: (address) => set({ address }),
      setUrl: (url) => set({ url }),
      setTaxes: (taxes) => set({ taxes }),
      setHoa: (hoa) => set({ hoa }),
      setEstimatedRent: (estimatedRent) => set({ estimatedRent }),
      setRehabCost: (rehabCost) => set({ rehabCost }),
      setArv: (arv) => set({ arv }),
      setHoldingCosts: (holdingCosts) => set({ holdingCosts }),
      setDescription: (description) => set({ description }),
      setAssumption: (key, value) =>
        set((s) => ({ assumptions: { ...s.assumptions, [key]: value } })),
      setStrAssumption: (key, value) =>
        set((s) => ({ strAssumptions: { ...s.strAssumptions, [key]: value } })),
      loadFromScrape: (data) =>
        set((s) => ({
          price: data.price ?? s.price,
          address: data.address ?? s.address,
          url: data.url ?? s.url,
          taxes: data.taxes ?? s.taxes,
          hoa: data.hoa ?? s.hoa,
          description: data.description ?? s.description,
          arv: data.price ? data.price * 1.2 : s.arv,
          estimatedRent: data.price ? Math.round(data.price * (s.assumptions.rentRatioPercent / 100)) : s.estimatedRent,
        })),
      reset: () => set({ ...initialState }),
      getPropertyInput: (): PropertyInput => {
        const s = get()
        return {
          price: s.price,
          taxes: s.taxes,
          hoa: s.hoa,
          estimatedRent: s.estimatedRent,
          rehabCost: s.rehabCost,
          arv: s.arv,
          holdingCosts: s.holdingCosts,
          assumptions: s.assumptions,
          strAssumptions: s.strAssumptions,
        }
      },
      getMetrics: () => {
        const input = get().getPropertyInput()
        return {
          rental: calcRentalMetrics(input),
          str: calcStrMetrics(input),
          flip: calcFlipMetrics(input),
        }
      },
    }),
    {
      name: "icecap-property",
      partialize: (state) => ({
        assumptions: state.assumptions,
        strAssumptions: state.strAssumptions,
        mapPinMetric: state.mapPinMetric,
      }),
      merge: (persisted: any, current) => ({
        ...current,
        assumptions: { ...DEFAULT_ASSUMPTIONS, ...(persisted?.assumptions ?? {}) },
        strAssumptions: { ...DEFAULT_STR_ASSUMPTIONS, ...(persisted?.strAssumptions ?? {}) },
        mapPinMetric: persisted?.mapPinMetric ?? "ltr",
      }),
    }
  )
)
