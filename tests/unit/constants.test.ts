import { describe, it, expect } from 'vite-plus/test'
import { DEFAULT_UNITS, AMOUNT_STEPS } from '@/lib/constants'
import { ConsumptionTypeSchema } from '@/lib/schemas'

const TYPES = ConsumptionTypeSchema.options

describe('consumption-type constants', () => {
  it('doses tincture in mg (was drops)', () => {
    expect(DEFAULT_UNITS.tincture).toBe('mg')
  })

  it('keeps edible in mg', () => {
    expect(DEFAULT_UNITS.edible).toBe('mg')
  })

  it('half-steps edible and tincture; whole-steps the rest', () => {
    expect(AMOUNT_STEPS.edible).toBe(0.5)
    expect(AMOUNT_STEPS.tincture).toBe(0.5)
    expect(AMOUNT_STEPS.flower).toBe(1)
    expect(AMOUNT_STEPS.vape).toBe(1)
    expect(AMOUNT_STEPS.concentrate).toBe(1)
    expect(AMOUNT_STEPS.topical).toBe(1)
  })

  it('defines a unit and a step for every consumption type (no gaps)', () => {
    for (const type of TYPES) {
      expect(typeof DEFAULT_UNITS[type]).toBe('string')
      expect(DEFAULT_UNITS[type].length).toBeGreaterThan(0)
      expect(typeof AMOUNT_STEPS[type]).toBe('number')
      expect(AMOUNT_STEPS[type]).toBeGreaterThan(0)
    }
  })
})
