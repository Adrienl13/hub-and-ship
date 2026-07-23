import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronDown,
  Handshake,
  Menu,
  ShieldCheck,
  Tag,
  User,
  X,
} from 'lucide-react'

import { BrandMark } from '@/components/BrandMark'
import { CartSheet } from '@/components/CartSheet'
import { Button } from '@/components/ui/button'
import { useChannel } from '@/hooks/useChannel'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsPartner } from '@/hooks/useIsPartner'
import { SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'

// Navigation primaire : les 4 destinations business. Tout l'éditorial vit
// dans « Ressources » pour garder un header respirable (et scannable par
// un nouveau visiteur en une seconde).
const PRIMARY_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Catalogue', '/catalogue'],
  ['Stock', '/stock-24h'],
  ['Partenaires', '/partenaires'],
  ['Le prix prouvé', '/prix'],
]

const RESOURCE_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Comment ça marche', '/#comment'],
  ['Containers livrés', '/livres'],
  ['Avis clients', '/avis'],
  ['Qualité & Tests', '/qualite'],
  ['Guides d’achat', '/guides'],
  ['FAQ', '/faq'],
  ['Contact', '/contact'],
]

function ResourcesDropdown() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="text-foreground/75 inline-flex items-center gap-1 text-sm transition-colors hover:text-foreground"
      >
        Ressources
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--paper)] py-1.5 shadow-lg"
        >
          {RESOURCE_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-foreground/80 block px-4 py-2 text-sm transition-colors hover:bg-[color:var(--sand-soft)] hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header({ onReserve }: { onReserve?: () => void }) {
  const { isAdmin } = useIsAdmin()
  const { isPartner } = useIsPartner()
  const { channel } = useChannel()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Le panneau mobile ne doit jamais rester ouvert après une navigation.
  const closeMobile = () => setMobileOpen(false)

  return (
    <header className="bg-[color:var(--sand)]/85 sticky top-0 z-40 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <a href="/#top" className="flex items-center gap-2.5">
          <BrandMark className="h-8 w-8" />
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </a>

        {/* Nav desktop */}
        <nav className="hidden items-center gap-5 lg:flex">
          {PRIMARY_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-foreground/75 text-sm transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <ResourcesDropdown />
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
              className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] lg:inline-flex"
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
              className="text-foreground/75 hidden h-9 gap-1.5 hover:bg-[color:var(--sand-soft)] lg:inline-flex"
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
          {/* Panier global : la commande est consultable et modifiable
              depuis toutes les pages, pas seulement le catalogue. */}
          <CartSheet />
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
          {/* Burger mobile — la nav catégorielle n'existait pas sous lg. */}
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMobileOpen((value) => !value)}
            className="text-foreground/80 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] transition-colors hover:bg-[color:var(--sand-soft)] lg:hidden"
          >
            {mobileOpen ? (
              <X className="h-4.5 w-4.5" />
            ) : (
              <Menu className="h-4.5 w-4.5" />
            )}
          </button>
        </div>
      </div>

      {/* Panneau mobile */}
      {mobileOpen && (
        <nav className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand)] px-6 py-4 lg:hidden">
          <div className="grid gap-0.5">
            {PRIMARY_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={closeMobile}
                className="rounded-sm px-2 py-2.5 text-[15px] font-medium transition-colors hover:bg-[color:var(--sand-soft)]"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="mono mt-3 px-2 text-[10.5px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
            Ressources
          </div>
          <div className="mt-1 grid gap-0.5">
            {RESOURCE_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={closeMobile}
                className="text-foreground/80 rounded-sm px-2 py-2 text-sm transition-colors hover:bg-[color:var(--sand-soft)]"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--sand-deep)] pt-3">
            {isAdmin && (
              <Link
                to="/admin"
                onClick={closeMobile}
                className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            {isPartner && (
              <Link
                to="/partner"
                onClick={closeMobile}
                className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm"
              >
                <Handshake className="h-3.5 w-3.5" />
                Espace partenaire
              </Link>
            )}
            <Link
              to="/account"
              onClick={closeMobile}
              className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm"
            >
              <User className="h-3.5 w-3.5" />
              Mon compte
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
