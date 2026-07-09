import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronDown,
  Handshake,
  Menu,
  ShieldCheck,
  User,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsPartner } from '@/hooks/useIsPartner'

const PRIMARY_NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Catalogue', '/catalogue'],
  ['Stock 24h', '/stock-24h'],
  ['Partenaires', '/partenaires'],
]

const RESOURCE_NAV_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['Comment ça marche', '/#comment'],
  ['Containers livrés', '/livres'],
  ['Avis', '/avis'],
  ['Qualité & Tests', '/qualite'],
  ['FAQ', '/faq'],
]

export function Header({ onReserve }: { onReserve?: () => void }) {
  const { isAdmin } = useIsAdmin()
  const { isPartner } = useIsPartner()

  return (
    <>
      <a href="#contenu" className="skip-link">
        Aller au contenu
      </a>
      <header className="bg-[color:var(--sand)]/85 sticky top-0 z-40 h-16 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--foreground)] font-display text-base font-semibold text-[color:var(--background)]">
              C
            </span>
            <span className="font-display text-base font-semibold tracking-tight">
              Container Club
            </span>
          </a>

          {/* Nav */}
          <nav
            className="hidden items-center gap-1 lg:flex"
            aria-label="Navigation principale"
          >
            {PRIMARY_NAV_LINKS.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-sm px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-[color:var(--sand-soft)] hover:text-foreground"
              >
                {label}
              </a>
            ))}
            <ResourcesMenu />
          </nav>

          <div className="flex items-center gap-2">
            <MobileNavigation
              isAdmin={isAdmin}
              isPartner={isPartner}
              onReserve={onReserve}
            />
            {isAdmin && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 rounded-sm text-foreground/75 hover:bg-[color:var(--sand-soft)] md:inline-flex"
              >
                <Link to="/admin" aria-label="Admin">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            {isPartner && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="hidden h-9 w-9 rounded-sm text-foreground/75 hover:bg-[color:var(--sand-soft)] md:inline-flex"
              >
                <Link to="/partner" aria-label="Espace partenaire">
                  <Handshake className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
            <Button
                asChild
                variant="ghost"
              size="icon"
              className="hidden h-9 w-9 rounded-sm text-foreground/75 hover:bg-[color:var(--sand-soft)] sm:inline-flex"
            >
              <Link to="/account" aria-label="Mon compte">
                <User className="h-3.5 w-3.5" />
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
    </>
  )
}

function ResourcesMenu() {
  return (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-sm px-3 py-2 text-sm font-medium text-foreground/75 transition-colors hover:bg-[color:var(--sand-soft)] hover:text-foreground [&::-webkit-details-marker]:hidden">
          Ressources
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-52 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-1 shadow-lg">
          {RESOURCE_NAV_LINKS.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="block rounded-sm px-3 py-2 text-sm font-medium text-foreground/75 hover:bg-[color:var(--sand)] hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
      </details>
    </div>
  )
}

function MobileNavigation({
  isAdmin,
  isPartner,
  onReserve,
}: {
  readonly isAdmin: boolean
  readonly isPartner: boolean
  readonly onReserve?: () => void
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-sm md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[min(22rem,calc(100vw-2rem))] bg-[color:var(--sand-soft)]"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="font-display">Container Club</SheetTitle>
          <SheetDescription>
            Navigation principale et accès rapides.
          </SheetDescription>
        </SheetHeader>

        <nav className="mt-6 grid gap-1" aria-label="Navigation mobile">
          {PRIMARY_NAV_LINKS.map(([label, href]) => (
            <SheetClose key={href} asChild>
              <a
                href={href}
                className="rounded-sm px-2 py-2 text-sm font-medium text-foreground/80 hover:bg-[color:var(--sand)] hover:text-foreground"
              >
                {label}
              </a>
            </SheetClose>
          ))}
          <div className="my-2 border-t border-[color:var(--sand-deep)]" />
          {RESOURCE_NAV_LINKS.map(([label, href]) => (
            <SheetClose key={href} asChild>
              <a
                href={href}
                className="rounded-sm px-2 py-2 text-sm font-medium text-foreground/70 hover:bg-[color:var(--sand)] hover:text-foreground"
              >
                {label}
              </a>
            </SheetClose>
          ))}
        </nav>

        <div className="mt-6 grid gap-2 border-t border-[color:var(--sand-deep)] pt-4">
          <SheetClose asChild>
            <Link
              to="/account"
              className="inline-flex h-10 items-center gap-2 rounded-sm px-2 text-sm font-medium text-foreground/80 hover:bg-[color:var(--sand)] hover:text-foreground"
            >
              <User className="h-4 w-4" />
              Mon compte
            </Link>
          </SheetClose>
          {isPartner && (
            <SheetClose asChild>
              <Link
                to="/partner"
                className="inline-flex h-10 items-center gap-2 rounded-sm px-2 text-sm font-medium text-foreground/80 hover:bg-[color:var(--sand)] hover:text-foreground"
              >
                <Handshake className="h-4 w-4" />
                Espace partenaire
              </Link>
            </SheetClose>
          )}
          {isAdmin && (
            <SheetClose asChild>
              <Link
                to="/admin"
                className="inline-flex h-10 items-center gap-2 rounded-sm px-2 text-sm font-medium text-foreground/80 hover:bg-[color:var(--sand)] hover:text-foreground"
              >
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Link>
            </SheetClose>
          )}
          <SheetClose asChild>
            {onReserve ? (
              <button
                type="button"
                onClick={onReserve}
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-foreground px-4 text-sm font-medium text-background hover:bg-[color:var(--ink-soft)]"
              >
                Réserver
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to="/catalogue"
                className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-foreground px-4 text-sm font-medium text-background hover:bg-[color:var(--ink-soft)]"
              >
                Réserver
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  )
}
