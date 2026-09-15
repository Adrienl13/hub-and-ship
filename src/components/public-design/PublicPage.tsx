import { isStudioEnabled } from '@/lib/studio/flags'
import { studioEntryMarkup } from './studio-entry'
import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Footer } from '@/components/Footer'
import { ContactForm } from '@/components/ContactForm'
import { PartnerForm } from '@/components/partenaires/PartnerForm'
import { ContainerNotifyForm } from '@/components/ContainerNotifyForm'
import { boundStudioBrief } from '@/lib/studio/studio-brief-limit'
import type { ProjectSelection, PartnerPrefill } from './start'
import home from './accueil-v3/template.html?raw'
import catalogue from './catalogue/template.html?raw'
import prix from './prix/template.html?raw'
import partenaires from './partenaires/template.html?raw'
import livres from './livres/template.html?raw'
import homeStyles from './accueil-v3/styles.css?inline'
import catalogueStyles from './catalogue/styles.css?inline'
import prixStyles from './prix/styles.css?inline'
import partenairesStyles from './partenaires/styles.css?inline'
import livresStyles from './livres/styles.css?inline'
import './shell.css'
const pages = { home, catalogue, prix, partenaires, livres }
const styles = {
  home: '',
  catalogue: catalogueStyles,
  prix: prixStyles,
  partenaires: partenairesStyles,
  livres: livresStyles,
}
export type PublicPageKind = keyof typeof pages
export function PublicPage({ kind }: { readonly kind: PublicPageKind }) {
  const root = useRef<HTMLDivElement>(null)
  const [slots, setSlots] = useState<HTMLElement[]>([])
  const [partnerPrefill, setPartnerPrefill] = useState<PartnerPrefill>({
    profile: '',
    status: '',
    nonce: 0,
  })
  const [selection, setSelection] = useState<ProjectSelection>()
  const markup = useMemo(
    () => ({ __html: studioEntryMarkup(pages[kind], isStudioEnabled()) }),
    [kind],
  )
  useEffect(() => {
    let cancelled = false
    let cleanup: (() => void) | undefined
    const el = root.current
    if (!el) return
    setSlots([...el.querySelectorAll<HTMLElement>('[data-form-slot]')])
    void import('./start').then(({ startPage }) => {
      if (!cancelled) {
        const main = el.querySelector('main')
        if (main)
          cleanup = startPage(kind, main, setSelection, setPartnerPrefill)
      }
    })
    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [kind])
  const brief = selection
    ? boundStudioBrief(
        selection.lines
          .map((r) => `${r.ref} · ${r.design} · ${r.qty} pièces`)
          .join('\n') +
          '\nRéception : ' +
          selection.delivery,
      )
    : undefined
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap"
      />
      <style>{homeStyles + '\n' + styles[kind]}</style>
      <div
        className="public-design"
        ref={root}
        dangerouslySetInnerHTML={markup}
      />
      {slots.map((slot, i) =>
        createPortal(
          slot.dataset.formSlot === 'contact' ? (
            <ContactForm initialTopic="produit" studioBrief={brief} />
          ) : slot.dataset.formSlot === 'partner' ? (
            <PartnerForm prefill={partnerPrefill} embedded />
          ) : (
            <ContainerNotifyForm source={kind} tone="light" />
          ),
          slot,
          String(i),
        ),
      )}
      <Footer />
    </>
  )
}
