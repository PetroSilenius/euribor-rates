# Euribor Mortgage Rate Comparison Tool — Design Spec
_Date: 2026-03-22_

## Overview

A single-page static Astro website with React islands that helps Finnish homeowners decide whether to switch their mortgage's Euribor reference rate (3m, 6m, or 12m). No backend, no API calls — purely client-side calculation.

---

## Tech Stack

- **Astro** (static output, `output: static`)
- **React** islands via `@astrojs/react` (`client:load`)
- **shadcn/ui** (manually installed, Astro-compatible)
- **Tailwind CSS** via `@astrojs/tailwind`
- **TypeScript**
- **recharts** (via shadcn Chart component)

---

## Architecture

### Data Flow

One React island (`MortgageCalculator.tsx`) mounts on the Astro page and owns all application state:

```
State (in MortgageCalculator.tsx):
  loanAmount       number     € (default 200 000)
  termYears        number     years remaining (default 20)
  margin           number     e.g. 0.0055 (default 0.55%)
  currentTenor     3|6|12     which tenor the user currently has
  selectedScenario 'flat'|'rise'|'fall'
  switchingFee     number     € (default 100)
```

On every state change, `MortgageCalculator` calls pure functions from `lib/simulation.ts` synchronously and passes computed results down as props. No `useEffect`, no async.

The Astro shell (`pages/index.astro`) is static HTML — sets title, meta, disclaimer footer. No routing.

### Computation Layer (`lib/simulation.ts`)

All math lives here as pure, independently testable functions:

```typescript
computePayments(inputs): PaymentRow[]
computeScenario(inputs, scenario): MonthlyPoint[]
computeBreakeven(inputs, switchingFee): BreakevenResult[]
computeRecommendation(inputs, scenario): Recommendation
```

Monetary formatting (Finnish locale `fi-FI`, e.g. `€1 234,50`) lives in `lib/format.ts`.

---

## Types

```typescript
interface SimulationInputs {
  loanAmount: number        // €
  termMonths: number        // converted from termYears
  margin: number            // decimal, e.g. 0.0055
  currentTenor: 3 | 6 | 12
}

interface PaymentRow {
  tenor: 3 | 6 | 12
  rate: number              // euribor + margin (decimal)
  monthlyPayment: number    // €
  annualCost: number        // €
  diffMonthly: number       // vs currentTenor (negative = savings)
  diffAnnual: number
}

type Scenario = 'flat' | 'rise' | 'fall'

interface MonthlyPoint {
  month: number             // 0–23
  payment3m: number         // €
  payment6m: number         // €
  payment12m: number        // €
}

interface BreakevenResult {
  fromTenor: 3 | 6 | 12
  toTenor: 3 | 6 | 12
  monthlySavings: number    // negative = switching costs more
  monthsToBreakeven: number | null  // null = never
  switchingFee: number
}

interface Recommendation {
  verdict: 'stay' | 'marginal' | 'switch'
  reason: string
}
```

---

## Simulation Logic

### Annuity Formula
```
monthlyPayment = P * [r(1+r)^n] / [(1+r)^n - 1]
  P = principal (loanAmount)
  r = monthly rate (annualRate / 12)
  n = months remaining
```

### Hardcoded Euribor Rates (as of March 2026)
```
3m:  2.15%
6m:  2.33%
12m: 2.52%
```

### Scenario Rate Paths
- **flat**: all tenors hold current rates for all 24 months
- **rise**: rates increase linearly by +1% over months 0–11, then hold flat months 12–23
- **fall**: rates decrease linearly by -0.5% over months 0–11, then hold flat months 12–23

### Stepped Payments (Chart Realism)
Each tenor's monthly payment only updates at its reset interval:
- 3m: recalculates at months 0, 3, 6, 9, 12, 15, 18, 21
- 6m: recalculates at months 0, 6, 12, 18
- 12m: recalculates at months 0, 12

Between resets, the payment for that tenor stays constant. This produces a step-function visual showing the volatility difference between tenors.

### Recommendation Logic
Uses `selectedScenario` + `PaymentRow[]`:
- **stay**: 12m is cheapest, OR (shorter tenor is cheaper but `scenario = 'rise'`)
- **switch**: shortest cheaper tenor is >0.2% cheaper AND `scenario` is `'flat'` or `'fall'`
- **marginal**: all other cases

---

## Component Structure

```
pages/index.astro
  └── MortgageCalculator.tsx  (client:load)
        ├── RateDisplay.tsx
        ├── LoanInputPanel.tsx
        ├── RecommendationBanner.tsx
        ├── PaymentTable.tsx
        ├── ScenarioChart.tsx
        └── BreakevenCard.tsx
```

### Component Responsibilities

**`MortgageCalculator.tsx`** — Island root. Owns all state. Calls simulation functions. Passes results as props. Never computes inline.

**`RateDisplay.tsx`** — Static shadcn Badges showing hardcoded Euribor rates labeled "as of March 2026". Pure presentational.

**`LoanInputPanel.tsx`** — shadcn Slider + Input for each loan parameter. Fires `onChange` callbacks up to parent. No internal state.

**`RecommendationBanner.tsx`** — Receives `Recommendation`. Renders colored Card (green/yellow/red left border) with verdict + reason. Updates when `selectedScenario` changes.

**`PaymentTable.tsx`** — Receives `PaymentRow[]` + `currentTenor`. Renders shadcn Card with table. Highlights current tenor row with teal left border. Savings in `green-600`, extra cost in `red-500`.

**`ScenarioChart.tsx`** — Receives `MonthlyPoint[]` + `selectedScenario` + `onScenarioChange`. shadcn Tabs (flat/rise/fall) fire `onScenarioChange` up. Renders recharts AreaChart with 3 area series (one per tenor). x-axis = month, y-axis = monthly payment €.

**`BreakevenCard.tsx`** — Receives `BreakevenResult[]` (two items) + `switchingFee` + `onSwitchingFeeChange`. Shows two columns (current tenor vs each alternative). Includes editable `<Input>` for switching fee with `€` prefix. `null` breakeven shows "Switching costs more at current rates."

---

## UI Layout

Single scrollable page, `max-w-3xl` centered, `px-4` mobile padding:

```
Header: site title + RateDisplay badges
LoanInputPanel
RecommendationBanner
PaymentTable
ScenarioChart (tabs + chart)
BreakevenCard
Footer disclaimer
```

### Design Rules
- Accent color: teal (`teal-600` / `teal-500`)
- Section spacing: `space-y-8`
- Each section: `<h2>` heading + one-line `<p>` subtitle in `text-muted-foreground`
- Mobile responsive; BreakevenCard two-column on desktop, stacked on mobile
- Finnish locale formatting throughout (`fi-FI`)

---

## File Structure

```
src/
  pages/
    index.astro
  components/
    MortgageCalculator.tsx
    RateDisplay.tsx
    LoanInputPanel.tsx
    PaymentTable.tsx
    ScenarioChart.tsx
    BreakevenCard.tsx
    RecommendationBanner.tsx
  lib/
    simulation.ts
    format.ts
docs/
  superpowers/
    specs/
      2026-03-22-euribor-mortgage-calculator-design.md
```

---

## Notes

- Switching fee defaults to €100 (Danske Bank post-2020 public pricing) but is editable
- Footer disclaimer: "Not financial advice. Rates as of March 2026. Consult your bank before making changes."
- No routing, no backend, no API calls
- `lib/simulation.ts` has no React imports — pure TypeScript, testable in isolation
