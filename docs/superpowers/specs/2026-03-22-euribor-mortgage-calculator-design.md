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

One React island (`MortgageCalculator.tsx`) mounts on the Astro page via `<MortgageCalculator client:load />` with no props — all defaults are internal. It owns all application state:

```
State (in MortgageCalculator.tsx):
  loanAmount       number     € (default 200_000)
  termYears        number     years remaining (default 20)
  margin           number     user-facing %, e.g. 0.55 (default 0.55)
  currentTenor     3|6|12     which tenor the user currently has (default 12)
  selectedScenario Scenario   (default 'flat')
  switchingFee     number     € (default 100)
```

Before calling any simulation function, `MortgageCalculator` converts state into `SimulationInputs`:
- `termMonths = termYears * 12`
- `marginDecimal = margin / 100`

These are the only two inline computations allowed in the island root. All other math is delegated to `lib/simulation.ts`.

The Astro shell (`pages/index.astro`) is static HTML — sets title, meta, disclaimer footer. No routing.

### Computation Layer (`lib/simulation.ts`)

All math lives here as pure, independently testable functions. None import React.

```typescript
computePayments(inputs: SimulationInputs): PaymentRow[]
computeScenario(inputs: SimulationInputs, scenario: Scenario): MonthlyPoint[]
computeBreakeven(inputs: SimulationInputs, switchingFee: number): BreakevenResult[]
computeRecommendation(payments: PaymentRow[], currentTenor: 3 | 6 | 12, scenario: Scenario): Recommendation
```

Note: `computeRecommendation` receives pre-computed `PaymentRow[]` (from `computePayments`) plus `currentTenor` explicitly, to avoid redundant computation and reliably identify the current-tenor row even when multiple rows happen to have the same payment.

Monetary formatting (Finnish locale `fi-FI`, e.g. `€1 234,50`) lives in `lib/format.ts`.

---

## Types

```typescript
interface SimulationInputs {
  loanAmount: number        // €
  termMonths: number        // e.g. 240 for 20 years
  marginDecimal: number     // e.g. 0.0055 for 0.55%
  currentTenor: 3 | 6 | 12
}

interface PaymentRow {
  tenor: 3 | 6 | 12
  rate: number              // euriborRate + marginDecimal (decimal)
  monthlyPayment: number    // €
  annualCost: number        // monthlyPayment * 12
  diffMonthly: number       // this tenor's payment minus currentTenor's payment
                            // negative = this tenor is cheaper than current
  diffAnnual: number        // diffMonthly * 12
}

type Scenario = 'flat' | 'rise' | 'fall'

interface MonthlyPoint {
  month: number             // 0–23
  payment3m: number         // € stepped payment for 3m tenor at this month
  payment6m: number         // € stepped payment for 6m tenor at this month
  payment12m: number        // € stepped payment for 12m tenor at this month
}

interface BreakevenResult {
  fromTenor: 3 | 6 | 12    // always currentTenor
  toTenor: 3 | 6 | 12      // the alternative being compared
  monthlySavings: number    // currentTenor payment minus toTenor payment
                            // positive = toTenor is cheaper, switching saves money
                            // negative or zero = switching costs more or breaks even
  monthsToBreakeven: number | null
  // null when monthlySavings <= 0 (switching never pays off)
  // otherwise: Math.ceil(switchingFee / monthlySavings)
  switchingFee: number      // € fee echoed from input
}

interface Recommendation {
  verdict: 'stay' | 'marginal' | 'switch'
  reason: string            // human-readable, e.g. "3m is 0.37% cheaper but rates are rising"
}
```

---

## Simulation Logic

### Hardcoded Euribor Rates (as of March 2026)
```
EURIBOR_RATES = { 3: 0.0215, 6: 0.0233, 12: 0.0252 }
```

### Annuity Formula
```
monthlyPayment(P, annualRate, n) =
  P * [r(1+r)^n] / [(1+r)^n - 1]
  where r = annualRate / 12, n = remaining months
```

### `computePayments(inputs)`
For each tenor in [3, 6, 12]:
1. `rate = EURIBOR_RATES[tenor] + inputs.marginDecimal`
2. `monthlyPayment` = annuity formula with `P = inputs.loanAmount`, `n = inputs.termMonths`
3. `annualCost = monthlyPayment * 12`
4. `diffMonthly = monthlyPayment - currentTenorPayment` (requires computing currentTenor first)
5. `diffAnnual = diffMonthly * 12`

Returns 3 rows ordered [3m, 6m, 12m]. The row where `tenor === currentTenor` will have `diffMonthly = 0`.

### `computeScenario(inputs, scenario)`

**Rate path** — linear interpolation for each tenor over months 0–23:
```
flat: euriborDelta(month) = 0
rise: euriborDelta(month) = min(month, 11) / 11 * 0.01   (months 0–11 ramp, 12–23 hold at +1%)
fall: euriborDelta(month) = min(month, 11) / 11 * -0.005 (months 0–11 ramp, 12–23 hold at -0.5%)
```
At any given month, `tenorRate(tenor, month) = EURIBOR_RATES[tenor] + euriborDelta(month) + inputs.marginDecimal`

**Stepped payments with running balance** — for each tenor independently:

```
balance = inputs.loanAmount
payment = annuity(balance, tenorRate(tenor, 0), inputs.termMonths)
remainingMonths = inputs.termMonths

For month in 0..23:
  if month is a reset point for this tenor (see schedule below):
    payment = annuity(balance, tenorRate(tenor, month), remainingMonths)
  record payment as this month's value
  // advance balance one month:
  interest = balance * (tenorRate(tenor, month) / 12)
  principal = payment - interest
  balance -= principal
  remainingMonths -= 1
```

Reset schedules:
- 3m: months 0, 3, 6, 9, 12, 15, 18, 21
- 6m: months 0, 6, 12, 18
- 12m: months 0, 12

At a reset point, `payment` is recalculated using the **current balance** (not original loan) and **remaining months** (not original term). This correctly models amortization between resets.

**Edge case — short loan terms:** `termMonths` can be as low as 12 (1 year). If `remainingMonths` reaches 0 before month 23, set `payment = 0` and `balance = 0` for all subsequent months. The chart will show a flat zero line after payoff.

Returns exactly 24 `MonthlyPoint` objects (month 0 through 23).

**Note:** `computeBreakeven` always uses flat (hardcoded) `EURIBOR_RATES` regardless of selected scenario. It reflects the cost comparison at today's rates, not projected rates.

### `computeBreakeven(inputs, switchingFee)`

Returns an array of exactly **two** `BreakevenResult` objects, always in this order:
1. `currentTenor → alternativeA` where alternativeA is the next-shorter tenor, or next-longer if no shorter exists
2. `currentTenor → alternativeB` where alternativeB is the remaining tenor

Concretely:
```
currentTenor=3:  [3→6, 3→12]
currentTenor=6:  [6→3, 6→12]
currentTenor=12: [12→6, 12→3]
```

For each result, using flat `EURIBOR_RATES` (not scenario-adjusted):
1. Compute `fromPayment` = annuity(`loanAmount`, `EURIBOR_RATES[fromTenor] + marginDecimal`, `termMonths`)
2. Compute `toPayment` = annuity(`loanAmount`, `EURIBOR_RATES[toTenor] + marginDecimal`, `termMonths`)
3. `monthlySavings = fromPayment - toPayment`
   — positive means `toTenor` is cheaper (switching saves money)
   — **Note: opposite sign convention from `PaymentRow.diffMonthly`**, which is `thisTenor - currentTenor`
4. `monthsToBreakeven = monthlySavings <= 0 ? null : Math.ceil(switchingFee / monthlySavings)`

### `computeRecommendation(payments, currentTenor, scenario)`

`payments` is the result of `computePayments`. Identify the current-tenor row by `row.tenor === currentTenor`.

Find the cheapest alternative: the row where `tenor !== currentTenor` with the lowest `monthlyPayment`.

Let `rateGap` = cheapest alternative's `PaymentRow.rate` minus current tenor's `PaymentRow.rate`.
- Negative means the alternative is cheaper (margin cancels, so this reflects only the euribor difference)
- Positive means the current tenor is already cheapest

Rules evaluated in strict priority order — first match wins:
1. **stay**: current tenor is already cheapest (`rateGap >= 0`), OR (`rateGap < 0` AND `scenario === 'rise'`)
2. **switch**: `rateGap < -0.002` (alternative rate is >0.2 percentage points cheaper) AND `scenario` is `'flat'` or `'fall'`
3. **marginal**: all remaining cases

**`reason` string format** — use this template, substituting values:
- stay (cheapest): `"Xm Euribor is already your cheapest option at current rates."`
- stay (rising): `"Xm could save €Y/month but rates are rising — your 12m lock looks sensible."`
- switch: `"Xm is Z% cheaper than your current tenor. At flat/falling rates, switching makes sense."`
- marginal: `"Xm is marginally cheaper (Z%), but the saving is small — depends on your risk tolerance."`

Where `X` = cheapest tenor, `Y` = monthly saving rounded to nearest euro, `Z` = `|rateGap * 100|` formatted to 2 decimal places (e.g. `"0.37%"`).

---

## Component Props

### `LoanInputPanel`
```typescript
interface LoanInputPanelProps {
  loanAmount: number               // € current value
  termYears: number                // current value
  margin: number                   // user-facing %, e.g. 0.55
  currentTenor: 3 | 6 | 12
  onLoanAmountChange: (v: number) => void
  onTermYearsChange: (v: number) => void
  onMarginChange: (v: number) => void    // receives user-facing %, e.g. 0.55
  onCurrentTenorChange: (v: 3 | 6 | 12) => void
}
```

Slider ranges and steps:
- Loan amount: min 10_000, max 600_000, step 5_000; displayed as `€200 000`
- Term: min 1, max 30, step 1; displayed as `20 years`
- Margin: min 0.1, max 3.0, step 0.05; displayed as `0.55%`
- Current tenor: radio-style Tabs (3m / 6m / 12m), not a slider

Each field has both a Slider and a number Input — they stay in sync. The Input accepts the user-facing value (not decimal). Input values are clamped to the same min/max as the slider on blur; values outside range snap to the nearest bound.

### `RateDisplay`
```typescript
// No props — pure static component. Reads EURIBOR_RATES constant directly.
// Renders three shadcn Badges: "3m: 2.15%", "6m: 2.33%", "12m: 2.52%"
// with a label "as of March 2026".
```

### `ScenarioChart`
```typescript
interface ScenarioChartProps {
  data: MonthlyPoint[]
  selectedScenario: Scenario          // controlled: active tab visually mirrors this prop
  onScenarioChange: (scenario: Scenario) => void
}
```
The tab component is **controlled** — the active tab always reflects the `selectedScenario` prop, it does not maintain its own active state.

### `BreakevenCard`
```typescript
interface BreakevenCardProps {
  results: BreakevenResult[]        // always length 2, order as specified above
  switchingFee: number
  onSwitchingFeeChange: (fee: number) => void
}
```

Column order matches `results` array order: `results[0]` → left column, `results[1]` → right column.

### `PaymentTable`
```typescript
interface PaymentTableProps {
  rows: PaymentRow[]               // always length 3, order [3m, 6m, 12m]
  currentTenor: 3 | 6 | 12
}
```

### `RecommendationBanner`
```typescript
interface RecommendationBannerProps {
  recommendation: Recommendation
}
```

---

## UI Layout

Single scrollable page, `max-w-3xl` centered, `px-4` mobile padding:

```
Header: site title + RateDisplay badges ("as of March 2026")
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
- PaymentTable: current tenor row highlighted with teal left border; `diffMonthly < 0` (cheaper) in `green-600`, `> 0` (costlier) in `red-500`
- RecommendationBanner: colored left border — `stay` = green, `marginal` = yellow, `switch` = red

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
- `<MortgageCalculator client:load />` in `index.astro` passes no props; all defaults are internal to the component
