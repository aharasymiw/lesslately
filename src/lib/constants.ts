import type { ConsumptionType } from '@/types'

export const DEFAULT_UNITS: Record<ConsumptionType, string> = {
  flower: 'hits',
  vape: 'puffs',
  edible: 'mg',
  concentrate: 'dabs',
  tincture: 'mg',
  topical: 'applications',
}

// Per-type amount step for the stepper. Edible and tincture are dosed in mg and
// support half-milligram precision; the others step in whole units.
export const AMOUNT_STEPS: Record<ConsumptionType, number> = {
  flower: 1,
  vape: 1,
  edible: 0.5,
  concentrate: 1,
  tincture: 0.5,
  topical: 1,
}
