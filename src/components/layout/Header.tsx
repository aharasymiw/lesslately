import { Link, useLocation } from 'react-router-dom'
import { Settings, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Log',
  '/journal': 'Journal',
  '/insights': 'Insights',
  '/goals': 'Goals',
  '/settings': 'Settings',
}

export function Header() {
  const location = useLocation()
  const { lock, vaultState } = useAuth()
  const title = PAGE_TITLES[location.pathname] ?? 'Less Lately'

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <h1 className="font-serif text-xl font-medium">{title}</h1>
      <div className="flex items-center gap-1">
        {vaultState === 'unlocked' && (
          <Button variant="ghost" size="icon" onClick={lock} aria-label="Lock vault">
            <Lock size={18} />
          </Button>
        )}
        {/* Navigation, so it stays a link and keeps the link role — Base UI's
            Button would either assume a native <button> or stamp role="button"
            on the anchor. Borrow the styling only. */}
        <Link
          to="/settings"
          aria-label="Settings"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
        >
          <Settings size={20} />
        </Link>
      </div>
    </header>
  )
}
