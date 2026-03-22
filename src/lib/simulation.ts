// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimulationInputs {
  loanAmount: number      // €
  termMonths: number      // e.g. 240 for 20 years
  marginDecimal: number   // e.g. 0.0055 for 0.55%
  currentTenor: 3 | 6 | 12
}

export interface PaymentRow {
  tenor: 3 | 6 | 12
  rate: number            // euriborRate + marginDecimal
  monthlyPayment: number  // €
  annualCost: number      // monthlyPayment * 12
  diffMonthly: number     // this tenor - currentTenor payment (negative = cheaper)
  diffAnnual: number      // diffMonthly * 12
}

export type Scenario = 'flat' | 'rise' | 'fall'

export interface MonthlyPoint {
  month: number           // 0–23
  payment3m: number
  payment6m: number
  payment12m: number
}

export interface BreakevenResult {
  fromTenor: 3 | 6 | 12
  toTenor: 3 | 6 | 12
  monthlySavings: number  // fromPayment - toPayment; positive = toTenor cheaper
  monthsToBreakeven: number | null  // null when monthlySavings <= 0
  switchingFee: number
}

export interface Recommendation {
  verdict: 'stay' | 'marginal' | 'switch'
  reason: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const EURIBOR_RATES: Record<3 | 6 | 12, number> = {
  3: 0.0215,
  6: 0.0233,
  12: 0.0252,
}

const TENOR_ORDER: (3 | 6 | 12)[] = [3, 6, 12]

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Standard annuity formula. Returns 0 if loanAmount is 0. */
export function annuity(P: number, annualRate: number, n: number): number {
  if (P === 0 || n === 0) return 0
  const r = annualRate / 12
  if (r === 0) return P / n
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}
