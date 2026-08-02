import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
import { render, screen, cleanup } from '@testing-library/react'
import { startOfDay, subDays } from 'date-fns'
import { DayGroup } from '@/components/journal/DayGroup'
import type { LogEntry } from '@/types'

// DayGroup's header labels come straight from date-fns (isToday, isYesterday,
// format). A behavior or locale-data change there would silently mislabel the
// journal, so the expected strings are pinned here.

function entry(timestamp: Date, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    type: 'flower',
    amount: 1,
    unit: 'hits',
    socialContext: 'solo',
    timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

const noop = { onDelete: vi.fn(), onEdit: vi.fn() }

afterEach(cleanup)

describe('DayGroup (date-fns rendering)', () => {
  it("labels today's group 'Today' with a singular count", () => {
    const today = startOfDay(new Date())
    render(<DayGroup date={today} entries={[entry(new Date())]} {...noop} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('1 entry')).toBeInTheDocument()
  })

  it("labels yesterday's group 'Yesterday'", () => {
    const yesterday = startOfDay(subDays(new Date(), 1))
    render(<DayGroup date={yesterday} entries={[entry(yesterday)]} {...noop} />)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('formats older days as weekday + short month + day, with a plural count', () => {
    const day = new Date(2024, 0, 15, 10, 30) // a Monday
    render(
      <DayGroup
        date={startOfDay(day)}
        entries={[
          entry(day),
          entry(new Date(2024, 0, 15, 21, 5), { id: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' }),
        ]}
        {...noop}
      />
    )
    expect(screen.getByText('Monday, Jan 15')).toBeInTheDocument()
    expect(screen.getByText('2 entries')).toBeInTheDocument()
    // EntryCard's time-of-day format ('h:mm a') is part of the same seam.
    expect(screen.getByText('10:30 AM')).toBeInTheDocument()
    expect(screen.getByText('9:05 PM')).toBeInTheDocument()
  })
})
