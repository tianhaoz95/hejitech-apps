# Design Document: Dual-Strategy Rental Analysis (STR vs. LTR)

## 1. Overview
This feature enables investors to evaluate a property's performance as both a Long-Term Rental (LTR) and a Short-Term Rental (STR). By providing a side-by-side comparison, Icecap helps users decide on the best strategy for a property, including alternating strategies (e.g., STR during peak seasons, LTR for stability).

## 2. Research & Metrics Comparison

### 2.1 Short-Term Rental (STR) Metrics
Based on industry standards (AirDNA, Rabbu), the following metrics are essential for STR analysis:
- **ADR (Average Daily Rate):** The average price per night booked.
- **Occupancy Rate:** The percentage of available nights that are booked.
- **RevPAR (Revenue Per Available Night):** `ADR * Occupancy Rate`. This is the "effective" daily rate considering vacancy.
- **Platform Fees:** Fees paid to booking sites (Airbnb, VRBO, etc.), typically 3-15%.
- **Cleaning Fees:** Income from guests vs. expense to cleaners. (Often a wash, but affects cash flow timing).
- **Operating Expenses:** Higher for STRs (utilities, wifi, consumables, frequent turn-over maintenance).
- **Management Fees:** Higher for STRs (15-30%) compared to LTRs (8-10%).

### 2.2 Side-by-Side Comparison

| Metric | Long Term Rental (LTR) | Short Term Rental (STR) |
| :--- | :--- | :--- |
| **Gross Income** | Monthly Rent | `ADR * 365 * (Occupancy / 100)` |
| **Vacancy/Efficiency** | Vacancy Rate (e.g. 5%) | Occupancy Rate (e.g. 65%) |
| **Management Fee** | 8-10% | 15-30% |
| **Utilities** | Usually paid by tenant | Always paid by owner |
| **Maintenance** | Lower turnover costs | Higher wear and tear + cleaning |
| **Yield (Cap Rate)** | Generally 4-7% | Generally 8-15% (Higher risk/effort) |

---

## 3. Detailed Design

### 3.1 Data Model Extensions (`@icecap/types`)

#### New Assumptions
```typescript
export interface StrAssumptions {
  adr: number;
  occupancyRate: number; // 0-100
  platformFeeRate: number; // 3-15%
  cleaningFeeIncome: number; // Per booking
  cleaningFeeExpense: number; // Per booking
  avgStayLength: number; // Days (needed for cleaning fee calc)
  monthlyUtilities: number;
}
```

#### Updated PropertyData
```typescript
export interface PropertyData {
  // ... existing fields
  strAssumptions?: StrAssumptions;
}
```

#### New Metrics
```typescript
export interface StrMetrics extends RentalMetrics {
  adr: number;
  revPar: number;
  occupancyRate: number;
  annualPlatformFees: number;
  annualCleaningFees: number; // (Income - Expense) * Bookings
}
```

### 3.2 Calculation Logic (`@icecap/math`)

#### STR Gross Income
`Annual STR Revenue = adr * 365 * (occupancyRate / 100)`
`Monthly STR Revenue = Annual STR Revenue / 12`

#### STR Expenses
`Monthly Management = (managementFeeRate / 100) * Monthly STR Revenue`
`Monthly Platform Fees = (platformFeeRate / 100) * Monthly STR Revenue`
`Number of Bookings (Annual) = (365 * occupancyRate / 100) / avgStayLength`
`Monthly Cleaning Net = (cleaningFeeIncome - cleaningFeeExpense) * (Bookings / 12)`
`Total Monthly STR Expenses = monthlyTaxes + hoa + monthlyMaintenance + monthlyManagement + monthlyPlatformFees + monthlyUtilities - monthlyCleaningNet`

#### Hybrid Logic: "The Breakeven"
`Breakeven Occupancy = (LTR_Net_Cashflow + STR_Fixed_Expenses) / (ADR * (1 - Management_Rate - Platform_Rate))`
*This tells the user the minimum occupancy needed for STR to be more profitable than LTR.*

---

## 4. UI/UX Presentation

### 4.1 Extension Sidepanel
- **Strategy Toggle:** A segmented control: [LTR | STR | Both].
- **"Both" View:** A vertical split or side-by-side card comparing:
  - Cash Flow (LTR vs STR)
  - CoC Return (LTR vs STR)
  - Cap Rate (LTR vs STR)
- **Visual Indicator:** A "Winner" badge on the strategy with higher Net Cash Flow.

### 4.2 Hub Dashboard
- **Comparison Chart:** A bar chart showing "Monthly Cash Flow: LTR vs STR".
- **Sensitivity Analysis:** A slider for "STR Occupancy" that shows how it affects the comparison in real-time.

---

## 5. Implementation Plan

### Phase 1: Core Logic (packages/types & packages/math)
- [ ] **Task 1.1:** Add `StrAssumptions` and `StrMetrics` to `@icecap/types`.
- [ ] **Task 1.2:** Implement `calcStrMetrics` in `@icecap/math`.
- [ ] **Task 1.3:** Add unit tests for STR calculations, ensuring edge cases (0% occupancy, high fees) are handled.
- [ ] **Task 1.4:** Add hybrid comparison function `compareRentalStrategies(ltr, str)`.

### Phase 2: Extension Integration (apps/extension)
- [ ] **Task 2.1:** Update Zustand store to handle `strAssumptions`.
- [ ] **Task 2.2:** Add STR input fields to the "Edit Assumptions" UI.
- [ ] **Task 2.3:** Create a new `StrategyComparisonCard` component.
- [ ] **Task 2.4:** Implement the "Strategy Toggle" logic.

### Phase 3: Hub Integration (apps/hub)
- [ ] **Task 3.1:** Update the property details page to show the comparison.
- [ ] **Task 3.2:** Add the "Breakeven Occupancy" calculator widget.

### Phase 4: Validation
- [ ] **Verification:** Manual check of math against Excel/AirDNA examples.
- [ ] **E2E Test:** Add a Playwright test that saves a property, toggles STR, and verifies the metrics update correctly.

---

## 6. Alternating/Transition Strategy Analysis
To help users understand "convert to LTR later" or "seasonal STR":
- **Weighted Cash Flow:** `(Peak_STR_Revenue * Months_Peak) + (LTR_Revenue * Months_Offpeak)`.
- **Conversion Cost:** One-time cost (furniture for STR, or de-furnishing/repainting for LTR).
- **Pro/Con Summary:**
  - **STR Pro:** Higher yield, personal use potential, flexibility.
  - **STR Con:** Regulation risk, high effort, high expense volatility.
  - **LTR Pro:** Stability, passive, lower management costs.
  - **LTR Con:** Lower yield, "bad tenant" risk, inflexible leases.
