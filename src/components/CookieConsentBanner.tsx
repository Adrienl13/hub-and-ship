import { useEffect, useState } from 'react'

import {
  applyConsent,
  readStoredConsent,
  writeStoredConsent,
} from '@/lib/analytics/consent'

// Bandeau de consentement pour la mesure d'audience (Google Analytics via
// Tag Manager). N'apparaît que si un conteneur GTM est configuré et qu'aucune
// décision valide n'est mémorisée. « Gérer mes cookies » (pied de page) le
// rouvre via un événement DOM.

export const OPEN_COOKIE_SETTINGS_EVENT = 'terrassea:cookie-settings'

const GTM_CONFIGURED = Boolean(import.meta.env.VITE_GTM_ID)

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}

export function CookieConsentBanner() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!GTM_CONFIGURED) return
    try {
      setOpen(readStoredConsent(window.localStorage, Date.now()) === null)
    } catch {
      setOpen(false)
    }
    const reopen = () => setOpen(true)
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, reopen)
  }, [])

  if (!open) return null

  const decide = (analytics: boolean) => {
    try {
      writeStoredConsent(window.localStorage, analytics, Date.now())
    } catch {
      // stockage indisponible (navigation privée) : la décision vaut pour la page
    }
    applyConsent(analytics)
    setOpen(false)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookies de mesure d'audience"
      className="shadow-paper fixed bottom-4 left-4 z-[60] max-w-sm rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm text-foreground"
    >
      <div className="font-display text-base font-semibold">
        Mesure d&apos;audience
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Nous utilisons Google Analytics pour comprendre comment le site est
        utilisé et améliorer le catalogue. Aucun cookie publicitaire. Vous
        pouvez refuser sans conséquence sur votre réservation.{' '}
        <a href="/legal/cookies" className="underline underline-offset-2">
          Politique cookies
        </a>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide(true)}
          className="hover:bg-foreground/90 inline-flex h-10 flex-1 items-center justify-center rounded-sm bg-foreground px-3 text-xs font-medium text-background"
        >
          Accepter
        </button>
        <button
          type="button"
          onClick={() => decide(false)}
          className="hover:border-foreground/40 inline-flex h-10 flex-1 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] px-3 text-xs font-medium"
        >
          Refuser
        </button>
      </div>
    </div>
  )
}
