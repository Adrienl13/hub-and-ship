import { Link } from '@tanstack/react-router'
import { ArrowRight, Handshake, ShieldCheck, Tag, User } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useChannel } from '@/hooks/useChannel'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsPartner } from '@/hooks/useIsPartner'
import { SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'

export function Header({ onReserve }: { onReserve?: () => void }) {
  const { isAdmin } = useIsAdmin()
  const { isPartner } = useIsPartner()
  const { channel } = useChannel()

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
        <nav className="hidden items-center gap-5 md:flex">
          {[
            ['Catalogue', '/catalogue'],
            ['Stock 24h', '/stock-24h'],
            ['Partenaires', '/partenaires'],
            ['Comment ça marche', '/#comment'],
            ['Containers livrés', '/livres'],
            ['Avis', '/avis'],
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
          {channel !== 'direct' && (
            <span
              className="mono hidden items-center gap-1 rounded-sm border border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--ember)] sm:inline-flex"
              title="Vos prix reflètent votre canal partenaire."
            >
              <Tag className="h-3 w-3" />
              Tarif {SALES_CHANNEL_LABEL[channel]} actif
            </span>
          )}
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
          {isPartner && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] md:inline-flex"
            >
              <Link to="/partner">
                <Handshake className="h-3.5 w-3.5" />
                Espace partenaire
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] sm:inline-flex"
          >
            <Link to="/account">
              <User className="h-3.5 w-3.5" />
              Mon compte
            </Link>
          </Button>
          {onReserve ? (
            <Button
              size="sm"
              onClick={onReserve}
              className="h-9 rounded-sm bg-[color:var(--foreground)] px-4 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              Réserver
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-[color:var(--foreground)] px-4 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <Link to="/catalogue">
                Réserver
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
