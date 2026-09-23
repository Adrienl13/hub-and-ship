import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronDown,
  Handshake,
  LogIn,
  Menu,
  ShieldCheck,
  Tag,
  User,
  X,
} from 'lucide-react'

import { CartSheet } from '@/components/CartSheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useChannel } from '@/hooks/useChannel'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsPartner } from '@/hooks/useIsPartner'
import { DEFAULT_RETURN_TO } from '@/lib/auth/return-to'
import { SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'
import { isStudioEnabled } from '@/lib/studio/flags'

// Navigation primaire : les 4 destinations business. Tout l'éditorial vit
// dans « Ressources » pour garder un header respirable (et scannable par
// un nouveau visiteur en une seconde).
// « Studio » n'apparaît que sous le flag public de build VITE_STUDIO_ENABLED :
// une session preview accède au Studio par son URL, jamais par ce lien.
// MÊME liste, MÊMES libellés et MÊME ordre que la barre de l'accueil
// (public-design) et que celle des pages expérience : le site appelait la
// même page « Catalogue » ici et « Le mobilier » ailleurs, et rangeait
// « Conteneurs livrés » avant ou après « Près de chez vous » selon la page.
const PRIMARY_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Le mobilier', '/catalogue'],
  ...(isStudioEnabled() ? ([['Le Studio', '/studio']] as const) : []),
  ['Partenaires', '/partenaires'],
  ['Le prix prouvé', '/prix'],
  ['Près de chez vous', '/lieux'],
  ['Conteneurs livrés', '/livres'],
  ['Contact', '/contact'],
]

const RESOURCE_LINKS: ReadonlyArray<readonly [string, string]> = [
  // L'accueil ne porte plus de section « Comment ça marche » : le déroulé
  // complet (étapes, contrôles, paiement) vit désormais sur /prix.
  ['Comment ça marche', '/prix#trajet'],
  // « Stock » quitte la barre principale pour que les sept entrées soient
  // identiques partout ; la page reste à un clic.
  ['Stock sous 24 h', '/stock-24h'],
  ['Avis clients', '/avis'],
  ['Qualité & Tests', '/qualite'],
  ['Guides d’achat', '/guides'],
  ['FAQ', '/faq'],
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
  const { status: authStatus } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Un visiteur sans session voit « Connexion », pas « Mon compte » : le
  // bouton dit ce qu'il fait. Pendant la vérification de session (et sans
  // Supabase), on garde « Mon compte » pour ne rien faire sauter.
  const anonymous = authStatus === 'anonymous'
  // Revenir sur la page courante après connexion. Lu dans un effet : au
  // rendu serveur il n'y a pas de `window`, le tableau de bord fait défaut.
  const [returnTo, setReturnTo] = useState(DEFAULT_RETURN_TO)
  useEffect(() => {
    const { pathname, search } = window.location
    if (pathname && pathname !== '/') setReturnTo(`${pathname}${search}`)
  }, [])

  // Le panneau mobile ne doit jamais rester ouvert après une navigation.
  const closeMobile = () => setMobileOpen(false)

  return (
    <header className="bg-[color:var(--sand)]/85 sticky top-0 z-40 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
      <div className="flex h-[76px] items-center gap-[clamp(14px,2vw,30px)] px-[clamp(20px,5vw,72px)]">
        {/* Logo — plaque laiton officielle (public/brand/terrassea-logo.svg) */}
        <a href="/#top" className="mr-auto flex shrink-0 items-center">
          <img
            src="/brand/terrassea-logo.svg"
            alt="Terrassea"
            className="h-10 w-auto"
          />
        </a>

        {/* Nav desktop */}
        <nav className="hidden min-w-0 items-center gap-[clamp(14px,1.6vw,26px)] min-[1150px]:flex">
          {PRIMARY_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-foreground/75 whitespace-nowrap text-sm transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <ResourcesDropdown />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {channel !== 'direct' && (
            <span
              className="mono border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[color:var(--ember)] 2xl:inline-flex"
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
              className="text-foreground/75 hidden h-9 gap-1.5 whitespace-nowrap hover:bg-[color:var(--sand-soft)] min-[1150px]:inline-flex"
            >
              <Link to="/admin" aria-label="Espace admin">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="hidden 2xl:inline">Admin</span>
              </Link>
            </Button>
          )}
          {isPartner && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-foreground/75 hidden h-9 gap-1.5 whitespace-nowrap hover:bg-[color:var(--sand-soft)] min-[1150px]:inline-flex"
            >
              <Link to="/partner" aria-label="Espace partenaire">
                <Handshake className="h-3.5 w-3.5" />
                <span className="hidden 2xl:inline">Espace partenaire</span>
              </Link>
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-foreground/75 hidden h-9 gap-1.5 whitespace-nowrap font-semibold hover:bg-[color:var(--sand-soft)] sm:inline-flex"
          >
            {anonymous ? (
              <Link
                to="/auth/login"
                search={{ returnTo }}
                aria-label="Connexion"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Connexion</span>
              </Link>
            ) : (
              <Link to="/account" aria-label="Mon compte">
                <User className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">Mon compte</span>
              </Link>
            )}
          </Button>
          {/* Panier global : la commande est consultable et modifiable
              depuis toutes les pages, pas seulement le catalogue. */}
          <CartSheet />
          {onReserve ? (
            <Button
              size="sm"
              onClick={onReserve}
              className="h-9 shrink-0 whitespace-nowrap rounded-sm px-4"
            >
              Réserver
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              asChild
              size="sm"
              className="h-9 shrink-0 whitespace-nowrap rounded-sm px-4"
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
            className="text-foreground/80 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] transition-colors hover:bg-[color:var(--sand-soft)] min-[1150px]:hidden"
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
        <nav className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand)] px-[clamp(20px,5vw,72px)] py-4 min-[1150px]:hidden">
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
            {anonymous ? (
              <Link
                to="/auth/login"
                search={{ returnTo }}
                onClick={closeMobile}
                className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm"
              >
                <LogIn className="h-3.5 w-3.5" />
                Connexion
              </Link>
            ) : (
              <Link
                to="/account"
                onClick={closeMobile}
                className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm"
              >
                <User className="h-3.5 w-3.5" />
                Mon compte
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
