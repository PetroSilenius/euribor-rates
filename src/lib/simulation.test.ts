import { describe, expect, it } from 'vitest';
import {
  annuity,
  computePayments,
  computeScenario,
  computeSimulatedRates,
  EURIBOR_RATES,
  type SimulationInputs,
} from './simulation';

describe('EURIBOR_RATES', () => {
  it('has rates for 3m, 6m, 12m', () => {
    expect(EURIBOR_RATES[3]).toBeCloseTo(0.0215);
    expect(EURIBOR_RATES[6]).toBeCloseTo(0.0233);
    expect(EURIBOR_RATES[12]).toBeCloseTo(0.0252);
  });
});

describe('annuity', () => {
  it('calculates monthly payment for a 200k loan at 3% over 240 months', () => {
    // Known: P=200000, annual=0.03, n=240 → monthly ≈ €1 109.20
    const payment = annuity(200_000, 0.03, 240);
    expect(payment).toBeCloseTo(1109.2, 0);
  });

  it('returns 0 when loanAmount is 0', () => {
    expect(annuity(0, 0.03, 240)).toBe(0);
  });

  it('returns 0 when n is 0', () => {
    expect(annuity(100_000, 0.03, 0)).toBe(0);
  });

  it('returns full principal when n=1', () => {
    // One payment: all principal + one month interest
    const payment = annuity(1000, 0.12, 1);
    expect(payment).toBeCloseTo(1010, 0);
  });

  it('handles zero interest rate (P / n)', () => {
    expect(annuity(12_000, 0, 12)).toBeCloseTo(1000, 5);
  });
});

describe('computePayments', () => {
  const inputs: SimulationInputs = {
    loanAmount: 200_000,
    termMonths: 240,
    marginDecimal: 0.005, // 0.5%
    currentTenor: 12,
  };

  it('returns 3 rows in order [3, 6, 12]', () => {
    const rows = computePayments(inputs);
    expect(rows.map((r) => r.tenor)).toEqual([3, 6, 12]);
  });

  it('rate = euribor + margin for each tenor', () => {
    const rows = computePayments(inputs);
    expect(rows[0].rate).toBeCloseTo(0.0215 + 0.005); // 3m
    expect(rows[1].rate).toBeCloseTo(0.0233 + 0.005); // 6m
    expect(rows[2].rate).toBeCloseTo(0.0252 + 0.005); // 12m
  });

  it('current tenor row has diffMonthly === 0', () => {
    const rows = computePayments(inputs);
    const currentRow = rows.find((r) => r.tenor === 12)!;
    expect(currentRow.diffMonthly).toBe(0);
  });

  it('cheaper tenor has negative diffMonthly', () => {
    const rows = computePayments(inputs);
    const row3m = rows.find((r) => r.tenor === 3)!;
    // 3m euribor (2.15%) < 12m euribor (2.52%), so 3m is cheaper
    expect(row3m.diffMonthly).toBeLessThan(0);
  });

  it('annualCost = monthlyPayment * 12', () => {
    const rows = computePayments(inputs);
    rows.forEach((row) => {
      expect(row.annualCost).toBeCloseTo(row.monthlyPayment * 12, 5);
    });
  });

  it('diffAnnual = diffMonthly * 12', () => {
    const rows = computePayments(inputs);
    rows.forEach((row) => {
      expect(row.diffAnnual).toBeCloseTo(row.diffMonthly * 12, 5);
    });
  });

  it('uses custom euriborRates when provided', () => {
    const customRates = { 3: 0.04, 6: 0.04, 12: 0.04 };
    const rows = computePayments({ ...inputs, euriborRates: customRates });
    rows.forEach((row) => {
      expect(row.rate).toBeCloseTo(0.04 + inputs.marginDecimal, 5);
    });
  });

  it('all payments are 0 when loanAmount is 0', () => {
    const rows = computePayments({ ...inputs, loanAmount: 0 });
    rows.forEach((row) => {
      expect(row.monthlyPayment).toBe(0);
    });
  });
});

describe('computeScenario', () => {
  const inputs: SimulationInputs = {
    loanAmount: 200_000,
    termMonths: 240,
    marginDecimal: 0.005,
    currentTenor: 12,
  };

  it('returns exactly 24 MonthlyPoints', () => {
    const points = computeScenario(inputs, 'flat');
    expect(points).toHaveLength(24);
  });

  it('month indices run 0–23', () => {
    const points = computeScenario(inputs, 'flat');
    points.forEach((p, i) => expect(p.month).toBe(i));
  });

  it('flat scenario: 3m payment same at month 0 and month 3', () => {
    const points = computeScenario(inputs, 'flat');
    expect(points[0].payment3m).toBeCloseTo(points[3].payment3m, 1);
  });

  it('flat scenario: 12m payment same at month 0 and month 11', () => {
    const points = computeScenario(inputs, 'flat');
    expect(points[0].payment12m).toBeCloseTo(points[11].payment12m, 1);
  });

  it('rise12 scenario: 3m payment at month 3 > month 0 (reset with higher rate)', () => {
    const points = computeScenario(inputs, 'rise12');
    expect(points[3].payment3m).toBeGreaterThan(points[0].payment3m);
  });

  it('fall12 scenario: 3m payment at month 3 < month 0', () => {
    const points = computeScenario(inputs, 'fall12');
    expect(points[3].payment3m).toBeLessThan(points[0].payment3m);
  });

  it('short term (12 months): payments after month 11 are 0', () => {
    const shortInputs = { ...inputs, termMonths: 12 };
    const points = computeScenario(shortInputs, 'flat');
    expect(points[12].payment3m).toBe(0);
    expect(points[23].payment3m).toBe(0);
  });

  it('rise24 scenario: 12m payment at month 12 > month 0', () => {
    // 12m resets at month 12 with the full linear increase applied
    const points = computeScenario(inputs, 'rise24');
    expect(points[12].payment12m).toBeGreaterThan(points[0].payment12m);
  });

  it('fall24 scenario: 12m payment at month 12 < month 0', () => {
    const points = computeScenario(inputs, 'fall24');
    expect(points[12].payment12m).toBeLessThan(points[0].payment12m);
  });

  it('rise12 scenario: 3m payment plateaus after month 11', () => {
    // euriborDelta caps at month 11, so month 12 and month 15 resets use same delta
    const points = computeScenario(inputs, 'rise12');
    expect(points[12].payment3m).toBeCloseTo(points[15].payment3m, 0);
  });

  it('rise12 scenario: 6m payment at month 6 > month 0', () => {
    const points = computeScenario(inputs, 'rise12');
    expect(points[6].payment6m).toBeGreaterThan(points[0].payment6m);
  });

  it('flat scenario: all payments are positive', () => {
    const points = computeScenario(inputs, 'flat');
    points.forEach((p) => {
      expect(p.payment3m).toBeGreaterThan(0);
      expect(p.payment6m).toBeGreaterThan(0);
      expect(p.payment12m).toBeGreaterThan(0);
    });
  });

  it('flat scenario: 3m total payments < 12m total payments (3m is cheaper)', () => {
    const points = computeScenario(inputs, 'flat');
    const total3m = points.reduce((s, p) => s + p.payment3m, 0);
    const total12m = points.reduce((s, p) => s + p.payment12m, 0);
    expect(total3m).toBeLessThan(total12m);
  });
});

describe('computeSimulatedRates', () => {
  const inputs: SimulationInputs = {
    loanAmount: 200_000,
    termMonths: 240,
    marginDecimal: 0.005,
    currentTenor: 12,
  };

  it('returns exactly 240 data points (24 months × 10 per month)', () => {
    const pts = computeSimulatedRates(inputs, 'flat');
    expect(pts).toHaveLength(240);
  });

  it('t of first point is 0 and last is 23.9', () => {
    const pts = computeSimulatedRates(inputs, 'flat');
    expect(pts[0].t).toBe(0);
    expect(pts[239].t).toBeCloseTo(23.9, 5);
  });

  it('flat scenario: rates are in percentage format (~2–3% range)', () => {
    const pts = computeSimulatedRates(inputs, 'flat');
    pts.forEach((p) => {
      expect(p.rate3m).toBeGreaterThan(1);
      expect(p.rate3m).toBeLessThan(5);
      expect(p.rate6m).toBeGreaterThan(1);
      expect(p.rate12m).toBeGreaterThan(1);
    });
  });

  it('flat scenario: average rate3m close to EURIBOR_RATES[3] * 100', () => {
    const pts = computeSimulatedRates(inputs, 'flat');
    const avg = pts.reduce((s, p) => s + p.rate3m, 0) / pts.length;
    expect(avg).toBeCloseTo(EURIBOR_RATES[3] * 100, 1);
  });

  it('rise12 scenario: rate3m near end of month 11 > rate3m at start', () => {
    // At t=11 (last reset window for 3m inside rise12 cap) rate should be higher
    const pts = computeSimulatedRates(inputs, 'rise12');
    const atStart = pts[0].rate3m;
    const atMonth11 = pts[110].rate3m; // t ≈ 11.0
    expect(atMonth11).toBeGreaterThan(atStart);
  });

  it('fall12 scenario: rate3m at month 3 < rate3m at month 0', () => {
    const pts = computeSimulatedRates(inputs, 'fall12');
    expect(pts[30].rate3m).toBeLessThan(pts[0].rate3m);
  });

  it('uses custom euriborRates when provided', () => {
    const customRates = { 3: 0.05, 6: 0.05, 12: 0.05 };
    const pts = computeSimulatedRates(
      { ...inputs, euriborRates: customRates },
      'flat',
    );
    // All rates should be near 5% (0.05 * 100), well above default ~2%
    pts.forEach((p) => {
      expect(p.rate3m).toBeGreaterThan(4);
      expect(p.rate6m).toBeGreaterThan(4);
      expect(p.rate12m).toBeGreaterThan(4);
    });
  });
});
