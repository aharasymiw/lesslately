import { TypeSelector } from '@/components/log/TypeSelector'
import { useData } from '@/hooks/useData'
import type { ConsumptionType } from '@/types'

const LABELS: Record<ConsumptionType, string> = {
  flower: 'Flower',
  vape: 'Vape',
  edible: 'Edible',
  concentrate: 'Concentrate',
  tincture: 'Tincture',
  topical: 'Topical',
}

export function DefaultTypeSetting() {
  const { settings, saveSettings, settingsReady } = useData()
  const value = settings.defaultEntryType

  // Gate the writable control on settingsReady. saveSettings merges onto the
  // in-closure `settings`, which is DEFAULT_SETTINGS until loadAll resolves; a
  // tap before then would persist defaultEntryType on top of the defaults,
  // silently wiping the user's saved theme/auto-lock. While loading, render a
  // non-interactive placeholder so no tap can fire.
  if (!settingsReady) {
    return (
      <div aria-busy="true" className="space-y-2">
        <p role="status" className="sr-only">
          Loading default type…
        </p>
        <div className="grid grid-cols-3 gap-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[72px] animate-pulse rounded-xl border border-border bg-card opacity-50"
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const handlePick = (type: ConsumptionType) => {
    // A tile tap is always a concrete pick; we never persist `undefined` (the
    // unset display is presentation-only), so the saved shape stays unambiguous.
    void saveSettings({ defaultEntryType: type })
  }

  return (
    <div className="space-y-2">
      <TypeSelector value={value} onChange={handlePick} />
      <p role="status" className="text-xs text-muted-foreground">
        {value
          ? `Default: ${LABELS[value]} — pre-selected when you open Log.`
          : 'No default set — Log opens on Flower. Pick one to set your default.'}
      </p>
    </div>
  )
}
