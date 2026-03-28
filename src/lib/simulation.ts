// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimulationInputs {
  loanAmount: number; // €
  termMonths: number; // e.g. 240 for 20 years
  marginDecimal: number; // e.g. 0.0055 for 0.55%
  currentTenor: 3 | 6 | 12;
  euriborRates?: Record<3 | 6 | 12, number>; // live rates; falls back to EURIBOR_RATES
}

export interface PaymentRow {
  tenor: 3 | 6 | 12;
  rate: number; // euriborRate + marginDecimal
  monthlyPayment: number; // €
  annualCost: number; // monthlyPayment * 12
  diffMonthly: number; // this tenor - currentTenor payment (negative = cheaper)
  diffAnnual: number; // diffMonthly * 12
}

export type Scenario = 'flat' | 'rise12' | 'rise24' | 'fall12' | 'fall24';

export interface MonthlyPoint {
  month: number; // 0–23
  payment3m: number;
  payment6m: number;
  payment12m: number;
}

export interface BreakevenResult {
  fromTenor: 3 | 6 | 12;
  toTenor: 3 | 6 | 12;
  monthlySavings: number; // fromPayment - toPayment; positive = toTenor cheaper
  monthsToBreakeven: number | null; // null when monthlySavings <= 0
  switchingFee: number;
}

export interface Recommendation {
  verdict: 'stay' | 'marginal' | 'switch';
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const EURIBOR_RATES: Record<3 | 6 | 12, number> = {
  3: 0.0215,
  6: 0.0233,
  12: 0.0252,
};

const TENOR_ORDER: (3 | 6 | 12)[] = [3, 6, 12];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Standard annuity formula. Returns 0 if loanAmount is 0. */
export function annuity(P: number, annualRate: number, n: number): number {
  if (P === 0 || n === 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return P / n;
  return (P * r * (1 + r) ** n) / ((1 + r) ** n - 1);
}

export function computePayments(inputs: SimulationInputs): PaymentRow[] {
  const rates = inputs.euriborRates ?? EURIBOR_RATES;
  const currentPayment = annuity(
    inputs.loanAmount,
    rates[inputs.currentTenor] + inputs.marginDecimal,
    inputs.termMonths,
  );

  return TENOR_ORDER.map((tenor) => {
    const rate = rates[tenor] + inputs.marginDecimal;
    const monthlyPayment = annuity(inputs.loanAmount, rate, inputs.termMonths);
    const annualCost = monthlyPayment * 12;
    const diffMonthly =
      tenor === inputs.currentTenor ? 0 : monthlyPayment - currentPayment;
    return {
      tenor,
      rate,
      monthlyPayment,
      annualCost,
      diffMonthly,
      diffAnnual: diffMonthly * 12,
    };
  });
}

const RESET_SCHEDULES: Record<3 | 6 | 12, number[]> = {
  3: [0, 3, 6, 9, 12, 15, 18, 21],
  6: [0, 6, 12, 18],
  12: [0, 12],
};

function euriborDelta(scenario: Scenario, month: number): number {
  if (scenario === 'flat') return 0;
  if (scenario === 'rise12') return (Math.min(month, 11) / 11) * 0.01;
  if (scenario === 'rise24') return (month / 23) * 0.01;
  if (scenario === 'fall12') return (Math.min(month, 11) / 11) * -0.005;
  if (scenario === 'fall24') return (month / 23) * -0.005;
  return 0;
}

function tenorRate(
  tenor: 3 | 6 | 12,
  month: number,
  scenario: Scenario,
  marginDecimal: number,
  rates: Record<3 | 6 | 12, number>,
): number {
  return rates[tenor] + euriborDelta(scenario, month) + marginDecimal;
}

function computeTenorPoints(
  tenor: 3 | 6 | 12,
  inputs: SimulationInputs,
  scenario: Scenario,
): number[] {
  const rates = inputs.euriborRates ?? EURIBOR_RATES;
  const resets = new Set(RESET_SCHEDULES[tenor]);
  let balance = inputs.loanAmount;
  let remainingMonths = inputs.termMonths;
  let payment = 0;
  const payments: number[] = [];

  for (let month = 0; month < 24; month++) {
    if (remainingMonths <= 0) {
      payments.push(0);
      continue;
    }
    if (resets.has(month)) {
      payment = annuity(
        balance,
        tenorRate(tenor, month, scenario, inputs.marginDecimal, rates),
        remainingMonths,
      );
    }
    payments.push(payment);
    const rate = tenorRate(tenor, month, scenario, inputs.marginDecimal, rates);
    const interest = balance * (rate / 12);
    const principal = payment - interest;
    balance -= principal;
    remainingMonths -= 1;
  }

  return payments;
}

export interface RatePoint {
  t: number; // fractional month index 0…23.x
  rate3m: number;
  rate6m: number;
  rate12m: number;
}

/** Superposition of incommensurate sine waves → smooth quasi-random noise.
 *  tenorSeed shifts the phase so each tenor wiggles independently. */
function rateNoise(t: number, tenorSeed: number): number {
  return (
    Math.sin(t * 2.3999 + tenorSeed * 1.1) * 0.00018 +
    Math.sin(t * 5.1667 + tenorSeed * 2.3) * 0.00024 +
    Math.sin(t * 11.333 + tenorSeed * 0.7) * 0.00015 +
    Math.sin(t * 18.0 + tenorSeed * 3.1) * 0.0001
  ); // total amplitude ≈ ±0.067 percentage points
}

/** Returns ~10 data points per simulation month with small realistic noise
 *  layered on top of the step-locked Euribor rates. */
export function computeSimulatedRates(
  inputs: SimulationInputs,
  scenario: Scenario,
): RatePoint[] {
  const rates = inputs.euriborRates ?? EURIBOR_RATES;
  const PTS_PER_MONTH = 10;
  return Array.from({ length: 24 * PTS_PER_MONTH }, (_, i) => {
    const t = i / PTS_PER_MONTH;
    return {
      t,
      rate3m: (rates[3] + euriborDelta(scenario, t) + rateNoise(t, 3)) * 100,
      rate6m: (rates[6] + euriborDelta(scenario, t) + rateNoise(t, 6)) * 100,
      rate12m:
        (rates[12] + euriborDelta(scenario, t) + rateNoise(t, 12)) * 100,
    };
  });
}

export function computeScenario(
  inputs: SimulationInputs,
  scenario: Scenario,
): MonthlyPoint[] {
  const points3m = computeTenorPoints(3, inputs, scenario);
  const points6m = computeTenorPoints(6, inputs, scenario);
  const points12m = computeTenorPoints(12, inputs, scenario);

  return Array.from({ length: 24 }, (_, month) => ({
    month,
    payment3m: points3m[month],
    payment6m: points6m[month],
    payment12m: points12m[month],
  }));
}
