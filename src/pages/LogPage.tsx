import { useState, useCallback, useLayoutEffect } from 'react'
import { TypeSelector } from '@/components/log/TypeSelector'
import { DEFAULT_UNITS } from '@/lib/constants'
import { AmountStepper } from '@/components/log/AmountStepper'
import { SocialToggle } from '@/components/log/SocialToggle'
import { TimePicker } from '@/components/log/TimePicker'
import { LogConfirm } from '@/components/log/LogConfirm'
import { Button } from '@/components/ui/button'
import { useEntries } from '@/hooks/useEntries'
import { useData } from '@/hooks/useData'
import type { ConsumptionType, SocialContext } from '@/types'
import { ChevronDown } from 'lucide-react'

interface FormState {
  type: ConsumptionType
  amount: number
  socialContext: SocialContext
  timestamp: Date
  note: string
  noteOpen: boolean
}

function getDefaultState(defaultType: ConsumptionType = 'flower'): FormState {
  return {
    type: defaultType,
    amount: 1,
    socialContext: 'solo',
    timestamp: new Date(),
    note: '',
    noteOpen: false,
  }
}

export default function LogPage() {
  const { addEntry } = useEntries()
  const { settings, settingsReady } = useData()
  const defaultType = settings.defaultEntryType ?? 'flower'

  const [state, setState] = useState<FormState>(() => getDefaultState(defaultType))
  const [touched, setTouched] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fall back defensively: state.type is always an enum value (seeded from the
  // schema-validated default), so this only guards a future widening.
  const unit = DEFAULT_UNITS[state.type] ?? DEFAULT_UNITS.flower

  // Single updater so every field marks the form touched in one place; a missed
  // call site then fails visibly (no state change) instead of silently dropping
  // the touched flag and letting a late-resolving default clobber the entry.
  const update = useCallback((patch: Partial<FormState>) => {
    setTouched(true)
    setState((s) => ({ ...s, ...patch }))
  }, [])

  // While the form is pristine, keep the pre-selected type aligned with the
  // saved default as it resolves asynchronously on unlock (or changes in
  // Settings). Stop once the user touches the form so we never override an
  // in-progress entry. Sync `type` only — amount is reset solely by a real type
  // pick in `update`, never by this async path. useLayoutEffect (not useEffect)
  // applies the correction before paint, so the Type grid — which is gated on
  // settingsReady — never shows a flower→default flash when it first appears.
  useLayoutEffect(() => {
    if (touched || confirming) return
    setState((s) => (s.type === defaultType ? s : { ...s, type: defaultType }))
  }, [defaultType, touched, confirming])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await addEntry({
        type: state.type,
        amount: state.amount,
        unit,
        socialContext: state.socialContext,
        timestamp: state.timestamp,
        note: state.note || undefined,
      })
      setConfirming(true)
    } catch (err) {
      console.error('Failed to log entry:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // Reset directly to the resolved default (Option A) — no transient flower
  // frame after a log. The explicit [defaultType] dep also avoids the stale
  // closure that would otherwise snap back to the first-mount 'flower'.
  const handleDismiss = useCallback(() => {
    setConfirming(false)
    setState(getDefaultState(defaultType))
    setTouched(false)
  }, [defaultType])

  return (
    <>
      {confirming && <LogConfirm onDismiss={handleDismiss} />}

      <div className="flex flex-col gap-5 p-4">
        <section aria-busy={!settingsReady}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Type
          </p>
          {settingsReady ? (
            <TypeSelector value={state.type} onChange={(type) => update({ type, amount: 1 })} />
          ) : (
            <>
              <p role="status" className="sr-only">
                Loading consumption type…
              </p>
              <div className="grid grid-cols-3 gap-2" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[72px] animate-pulse rounded-xl border border-border bg-card opacity-50"
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Amount
          </p>
          <AmountStepper
            value={state.amount}
            unit={unit}
            onChange={(amount) => update({ amount })}
          />
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Context
          </p>
          <SocialToggle
            value={state.socialContext}
            onChange={(socialContext) => update({ socialContext })}
          />
        </section>

        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Time
          </p>
          <TimePicker value={state.timestamp} onChange={(timestamp) => update({ timestamp })} />
        </section>

        <section>
          {state.noteOpen ? (
            <textarea
              placeholder="Add a note… (optional)"
              value={state.note}
              onChange={(e) => update({ note: e.target.value })}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <button
              type="button"
              onClick={() => update({ noteOpen: true })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown size={16} />
              Add note
            </button>
          )}
        </section>

        <Button
          size="lg"
          className="w-full mt-2"
          onClick={handleSubmit}
          disabled={submitting || state.amount <= 0}
        >
          {submitting ? 'Logging…' : 'Log'}
        </Button>
      </div>
    </>
  )
}
