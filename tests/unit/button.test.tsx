import { describe, it, expect, afterEach } from 'vite-plus/test'
import { render, screen, cleanup } from '@testing-library/react'
import { Button } from '@/components/ui/button'

// Button sits on the @base-ui/react + class-variance-authority seam. The
// render-prop form is what Header uses to make a Button navigate as a Link,
// so a base-ui regression there would break app navigation.

afterEach(cleanup)

describe('Button (base-ui + cva)', () => {
  it('renders a real button with variant and size classes applied', () => {
    render(
      <Button size="icon" aria-label="Lock vault">
        x
      </Button>
    )
    const btn = screen.getByRole('button', { name: 'Lock vault' })
    expect(btn.classList.contains('bg-primary')).toBe(true)
    expect(btn.classList.contains('size-8')).toBe(true)
  })

  it('lets a custom className win over the variant default (tailwind-merge)', () => {
    render(<Button className="bg-secondary">Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.classList.contains('bg-secondary')).toBe(true)
    expect(btn.classList.contains('bg-primary')).toBe(false)
  })

  it('renders as the element given via the render prop, keeping button styling', () => {
    render(<Button render={<a href="/settings" />}>Settings</Button>)
    const link = screen.getByRole('link', { name: 'Settings' })
    expect(link).toHaveAttribute('href', '/settings')
    expect(link.className).toContain('inline-flex')
  })

  it('applies the ghost variant without the default background', () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button', { name: 'Ghost' }).classList.contains('bg-primary')).toBe(
      false
    )
  })
})
