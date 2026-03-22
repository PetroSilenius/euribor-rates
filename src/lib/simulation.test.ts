import { describe, it, expect } from 'vitest'
import { annuity, EURIBOR_RATES } from './simulation'

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
