import { describe, it, expect } from 'vite-plus/test'
import { v4 as uuidv4 } from 'uuid'
import { LogEntrySchema, GoalSchema } from '@/lib/schemas'

// DataContext stamps every new entry/goal with uuidv4() and immediately
// validates it with zod. The two libraries version independently, so this
// pins the seam: generated ids must keep satisfying the schemas' id rules.

describe('uuid generation', () => {
  it('produces RFC 4122 version-4 ids', () => {
    const id = uuidv4()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('does not collide across many generations', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv4()))
    expect(ids.size).toBe(1000)
  })
})

describe('uuid × zod id validation', () => {
  const now = new Date()

  it('a generated id passes LogEntrySchema', () => {
    const entry = {
      id: uuidv4(),
      type: 'flower',
      amount: 1,
      unit: 'hits',
      socialContext: 'solo',
      timestamp: now,
      createdAt: now,
      updatedAt: now,
    }
    expect(() => LogEntrySchema.parse(entry)).not.toThrow()
  })

  it('a generated id passes GoalSchema', () => {
    const goal = {
      id: uuidv4(),
      type: 'daily',
      maxAmount: 3,
      unit: 'hits',
      reductionMode: false,
      startDate: now,
      createdAt: now,
      updatedAt: now,
    }
    expect(() => GoalSchema.parse(goal)).not.toThrow()
  })
})
