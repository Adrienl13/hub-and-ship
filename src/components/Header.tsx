import { Link } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export function Header({ onReserve }: { onReserve: () => void }) {
  const { isAdmin } = useIsAdmin()

  return (
    <header className="bg-[color:var(--sand)]/85 sticky top-0 z-40 h-16 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <a href="/#top" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--foreground)] font-display text-base font-semibold text-[color:var(--background)]">
            C
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </a>

        {/* Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {[
            ['Catalogue', '/catalogue'],
            ['Stock 24h', '/stock-24h'],
            ['Comment ça marche', '/#comment'],
            ['Containers livrés', '/livres'],
            ['Qualité & Tests', '/qualite'],
            ['Devenir partenaire', '/partenaires'],
            ['FAQ', '/faq'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-foreground/75 text-sm transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] md:inline-flex"
            >
              <Link to="/admin">
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] sm:inline-flex"
          >
            <Link to="/account/reservations">
              <User className="h-3.5 w-3.5" />
              Mon compte
            </Link>
          </Button>
          <Button
            size="sm"
            onClick={onReserve}
            className="h-9 rounded-sm bg-[color:var(--foreground)] px-4 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            Réserver
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
