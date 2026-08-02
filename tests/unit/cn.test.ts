import { describe, it, expect } from 'vite-plus/test'
import { cn } from '@/lib/utils'

// cn() sits on the clsx + tailwind-merge seam: every component's className
// flows through it, so a behavior change in either dependency shows up here.

describe('cn (clsx + tailwind-merge)', () => {
  it('joins conditional inputs the clsx way', () => {
    expect(cn('a', undefined, ['c', { d: true, e: false }])).toBe('a c d')
  })

  it('resolves Tailwind conflicts in favor of the last class', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
    expect(cn('text-muted-foreground', 'text-primary')).toBe('text-primary')
  })

  it('keeps non-conflicting utilities intact and ordered', () => {
    expect(cn('flex flex-col', 'gap-2')).toBe('flex flex-col gap-2')
  })

  it('merges across variant-style groups the app relies on', () => {
    // BottomNav swaps text color by active state through exactly this pattern.
    expect(cn('text-muted-foreground hover:text-foreground', { 'text-primary': true })).toBe(
      'hover:text-foreground text-primary'
    )
  })
})
