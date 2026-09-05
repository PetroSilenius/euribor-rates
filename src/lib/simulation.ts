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

export const RATE_PATH_SCENARIOS = [
  'flat',
  'rise12',
  'rise24',
  'fall12',
  'fall24',
] as const;

export const HYPOTHETICAL_SCENARIOS = [
  'iranEscalation',
  'equityCrash',
  'energyShock',
  'tradeWar',
  'aiBoom',
  'sovereignStress',
] as const;

export type RatePathScenario = (typeof RATE_PATH_SCENARIOS)[number];
export type HypotheticalScenario = (typeof HYPOTHETICAL_SCENARIOS)[number];
export type Scenario = RatePathScenario | HypotheticalScenario;

export function isHypotheticalScenario(
  scenario: Scenario,
): scenario is HypotheticalScenario {
  return (HYPOTHETICAL_SCENARIOS as readonly string[]).includes(scenario);
}

/** AI-generated narrative scenarios. The rate paths are illustrative guesses at
 *  how each story might transmit into Euribor — not forecasts, and not sourced
 *  from any economic model. */
export interface HypotheticalCase {
  id: HypotheticalScenario;
  label: string; // short tab label
  headline: string; // the event itself
  transmission: string; // why Euribor moves the way it does
}

export const HYPOTHETICAL_CASES: Record<
  HypotheticalScenario,
  HypotheticalCase
> = {
  iranEscalation: {
    id: 'iranEscalation',
    label: 'US–Iran war drags on',
    headline:
      'The US campaign against Iran grinds into a second year, with Hormuz shipping disrupted on and off.',
    transmission:
      'Oil and freight costs stay elevated, headline inflation reaccelerates, and the ECB keeps policy restrictive well past the point markets had priced in. Euribor drifts up ~0.85pp before easing back as the shock fades.',
  },
  equityCrash: {
    id: 'equityCrash',
    label: 'Stock markets crash',
    headline:
      'A disorderly repricing wipes ~35% off global equities over a single quarter.',
    transmission:
      'A brief interbank funding squeeze nudges rates up, then a growth and credit shock forces the ECB into rapid, deep cuts. Euribor ends ~1.1pp lower.',
  },
  energyShock: {
    id: 'energyShock',
    label: 'Energy shock',
    headline:
      'Remaining Russian gas flows stop and an LNG outage hits during a cold winter.',
    transmission:
      'A 2022-style cost-push spike pushes euro-area inflation back above target, and the ECB hikes hard to keep expectations anchored. Euribor peaks ~1.6pp higher around month 14.',
  },
  tradeWar: {
    id: 'tradeWar',
    label: 'Tariff spiral',
    headline:
      'Tit-for-tat tariffs between the US, EU and China escalate across most goods categories.',
    transmission:
      'Classic stagflation bind: import prices lift inflation first, so the ECB holds, then collapsing export demand dominates and cuts follow. Euribor rises modestly, then ends ~0.55pp lower.',
  },
  aiBoom: {
    id: 'aiBoom',
    label: 'AI productivity boom',
    headline:
      'AI adoption lifts euro-area productivity growth by roughly a percentage point a year.',
    transmission:
      'Disinflationary on the price side, but stronger growth and heavy capex raise the neutral rate. The ECB normalises gently upward — a slow, steady ~0.6pp climb.',
  },
  sovereignStress: {
    id: 'sovereignStress',
    label: 'Eurozone debt stress',
    headline:
      'A budget crisis in a large member state blows out sovereign spreads and revives fragmentation fears.',
    transmission:
      'Bank funding costs and interbank risk premia jump, lifting Euribor above policy rates. An ECB backstop eventually restores calm and most of the spike unwinds.',
  },
};

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

/** [month, Euribor delta in decimal] — linearly interpolated between frames,
 *  clamped to the first/last frame outside the covered range. */
type Keyframe = readonly [month: number, delta: number];

const SCENARIO_KEYFRAMES: Record<Scenario, readonly Keyframe[]> = {
  // Existing rate paths, expressed as keyframes (behaviour unchanged).
  flat: [[0, 0]],
  rise12: [
    [0, 0],
    [11, 0.01],
  ],
  rise24: [
    [0, 0],
    [23, 0.01],
  ],
  fall12: [
    [0, 0],
    [11, -0.005],
  ],
  fall24: [
    [0, 0],
    [23, -0.005],
  ],

  // Hypothetical cases — illustrative rate paths, see HYPOTHETICAL_CASES below.
  iranEscalation: [
    [0, 0],
    [3, 0.002],
    [9, 0.0075],
    [15, 0.0085],
    [23, 0.0055],
  ],
  equityCrash: [
    [0, 0],
    [1, 0.0015],
    [4, -0.0025],
    [10, -0.009],
    [17, -0.0125],
    [23, -0.011],
  ],
  energyShock: [
    [0, 0],
    [2, 0.0035],
    [8, 0.013],
    [14, 0.016],
    [23, 0.0115],
  ],
  tradeWar: [
    [0, 0],
    [5, 0.0035],
    [11, 0.0025],
    [18, -0.003],
    [23, -0.0055],
  ],
  aiBoom: [
    [0, 0],
    [6, 0.002],
    [14, 0.0045],
    [23, 0.006],
  ],
  sovereignStress: [
    [0, 0],
    [3, 0.0045],
    [7, 0.009],
    [12, 0.006],
    [23, 0.003],
  ],
};

function euriborDelta(scenario: Scenario, month: number): number {
  const frames = SCENARIO_KEYFRAMES[scenario] ?? SCENARIO_KEYFRAMES.flat;
  const first = frames[0];
  if (month <= first[0]) return first[1];

  for (let i = 1; i < frames.length; i++) {
    const [frameMonth, delta] = frames[i];
    if (month <= frameMonth) {
      const [prevMonth, prevDelta] = frames[i - 1];
      const span = frameMonth - prevMonth;
      if (span === 0) return delta;
      return prevDelta + ((month - prevMonth) / span) * (delta - prevDelta);
    }
  }

  return frames[frames.length - 1][1];
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
      rate12m: (rates[12] + euriborDelta(scenario, t) + rateNoise(t, 12)) * 100,
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
