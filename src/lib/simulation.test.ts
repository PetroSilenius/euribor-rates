import { describe, it, expect } from 'vitest'
import { annuity, EURIBOR_RATES, computePayments, type SimulationInputs } from './simulation'

describe('EURIBOR_RATES', () => {
  it('has rates for 3m, 6m, 12m', () => {
    expect(EURIBOR_RATES[3]).toBeCloseTo(0.0215)
    expect(EURIBOR_RATES[6]).toBeCloseTo(0.0233)
    expect(EURIBOR_RATES[12]).toBeCloseTo(0.0252)
  })
})

describe('annuity', () => {
  it('calculates monthly payment for a 200k loan at 3% over 240 months', () => {
    // Known: P=200000, annual=0.03, n=240 → monthly ≈ €1 109.20
    const payment = annuity(200_000, 0.03, 240)
    expect(payment).toBeCloseTo(1109.20, 0)
  })

  it('returns 0 when loanAmount is 0', () => {
    expect(annuity(0, 0.03, 240)).toBe(0)
  })

  it('returns full principal when n=1', () => {
    // One payment: all principal + one month interest
    const payment = annuity(1000, 0.12, 1)
    expect(payment).toBeCloseTo(1010, 0)
  })
})

describe('computePayments', () => {
  const inputs: SimulationInputs = {
    loanAmount: 200_000,
    termMonths: 240,
    marginDecimal: 0.005,  // 0.5%
    currentTenor: 12,
  }

  it('returns 3 rows in order [3, 6, 12]', () => {
    const rows = computePayments(inputs)
    expect(rows.map(r => r.tenor)).toEqual([3, 6, 12])
  })

  it('rate = euribor + margin for each tenor', () => {
    const rows = computePayments(inputs)
    expect(rows[0].rate).toBeCloseTo(0.0215 + 0.005) // 3m
    expect(rows[1].rate).toBeCloseTo(0.0233 + 0.005) // 6m
    expect(rows[2].rate).toBeCloseTo(0.0252 + 0.005) // 12m
  })

  it('current tenor row has diffMonthly === 0', () => {
    const rows = computePayments(inputs)
    const currentRow = rows.find(r => r.tenor === 12)!
    expect(currentRow.diffMonthly).toBe(0)
  })

  it('cheaper tenor has negative diffMonthly', () => {
    const rows = computePayments(inputs)
    const row3m = rows.find(r => r.tenor === 3)!
    // 3m euribor (2.15%) < 12m euribor (2.52%), so 3m is cheaper
    expect(row3m.diffMonthly).toBeLessThan(0)
  })

  it('annualCost = monthlyPayment * 12', () => {
    const rows = computePayments(inputs)
    rows.forEach(row => {
      expect(row.annualCost).toBeCloseTo(row.monthlyPayment * 12, 5)
    })
  })

  it('diffAnnual = diffMonthly * 12', () => {
    const rows = computePayments(inputs)
    rows.forEach(row => {
      expect(row.diffAnnual).toBeCloseTo(row.diffMonthly * 12, 5)
    })
  })
})
