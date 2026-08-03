import { describe, it, expect, afterEach } from 'vite-plus/test'
import { render, screen, cleanup } from '@testing-library/react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

// Button sits on the @base-ui/react + class-variance-authority seam. Header
// styles a router Link with buttonVariants rather than handing the Link to
// Button's render prop, so a cva regression would break app navigation
// styling — and base-ui would no longer be able to relabel the link a button.

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

  it('styles a plain anchor through buttonVariants without making it a button', () => {
    render(
      <a href="/settings" aria-label="Settings" className={buttonVariants({ size: 'icon' })}>
        x
      </a>
    )
    const link = screen.getByRole('link', { name: 'Settings' })
    expect(link).toHaveAttribute('href', '/settings')
    expect(link.classList.contains('inline-flex')).toBe(true)
    expect(link.classList.contains('size-8')).toBe(true)
    // Navigation must keep the link role — never role="button".
    expect(link.getAttribute('role')).toBeNull()
  })

  it('applies the ghost variant without the default background', () => {
    render(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button', { name: 'Ghost' }).classList.contains('bg-primary')).toBe(
      false
    )
  })
})
