import { describe, it, expect, afterEach, vi } from 'vite-plus/test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { AmountStepper } from '@/components/log/AmountStepper'

// The stepper renders three buttons in DOM order: [decrease, value, increase].
function buttons() {
  return screen.getAllByRole('button')
}
const decrease = () => buttons()[0]
const increase = () => buttons()[2]

afterEach(cleanup)

describe('AmountStepper step', () => {
  it('increments and decrements by a 0.5 step (edible/tincture mg)', () => {
    const onChange = vi.fn()
    render(<AmountStepper value={1} unit="mg" step={0.5} onChange={onChange} />)
    fireEvent.click(increase())
    expect(onChange).toHaveBeenLastCalledWith(1.5)
    fireEvent.click(decrease())
    expect(onChange).toHaveBeenLastCalledWith(0.5)
  })

  it('keeps a whole-unit step for other types', () => {
    const onChange = vi.fn()
    render(<AmountStepper value={1} unit="hits" step={1} onChange={onChange} />)
    fireEvent.click(increase())
    expect(onChange).toHaveBeenLastCalledWith(2)
  })

  it('renders the value with its unit', () => {
    render(<AmountStepper value={1.5} unit="mg" step={0.5} onChange={() => {}} />)
    expect(screen.getByText('1.5')).toBeInTheDocument()
    expect(screen.getByText('mg')).toBeInTheDocument()
  })
})
