import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { isStudioEnabled } from '@/lib/studio/flags'

export function ExperienceHeader({ inStudio = false }: { inStudio?: boolean }) {
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const studio = inStudio || isStudioEnabled()
  return (
    <header
      className="pi-header"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false)
          menuButton.current?.focus()
        }
      }}
    >
      <a href="/" className="pi-wordmark" aria-label="Pros Import — accueil">
        <img
          className="pi-original-logo"
          src="/brand/terrassea-logo.svg"
          alt="Terrassea — plaque dorée"
          width="192"
          height="90"
        />
      </a>
      <nav className="pi-desktop-nav" aria-label="Navigation principale">
        {studio && (
          <a href="/studio" aria-current={inStudio ? 'page' : undefined}>
            Le Studio
          </a>
        )}
        <a href="/catalogue">Le mobilier</a>
        <a href="/contact">Parlons de votre lieu</a>
      </nav>
      <a
        className="pi-button pi-button-ink pi-header-cta"
        href={studio ? '/studio' : '/contact'}
      >
        {inStudio ? 'Mon projet' : 'Commencer un projet'}
        <ArrowUpRight size={16} aria-hidden />
      </a>
      <button
        ref={menuButton}
        className="pi-icon-button pi-menu-toggle"
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        aria-controls="pi-mobile-menu"
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <nav
          id="pi-mobile-menu"
          className="pi-mobile-menu"
          aria-label="Navigation mobile"
        >
          {studio && (
            <a href="/studio" onClick={() => setOpen(false)}>
              Le Studio <ArrowUpRight />
            </a>
          )}
          <a href="/catalogue" onClick={() => setOpen(false)}>
            Le mobilier <ArrowUpRight />
          </a>
          <a href="/contact" onClick={() => setOpen(false)}>
            Parlons de votre lieu <ArrowUpRight />
          </a>
        </nav>
      )}
    </header>
  )
}
export function ExperienceFooter() {
  return (
    <footer className="pi-footer">
      <div className="pi-footer-top">
        <p>
          Un lieu singulier.
          <br />
          Un projet à construire ensemble.
        </p>
        <a href="/contact" className="pi-button pi-button-white">
          Parlons de votre projet <ArrowUpRight size={18} />
        </a>
      </div>
      <div className="pi-footer-bottom">
        <img
          className="pi-original-logo"
          src="/brand/terrassea-logo.svg"
          alt="Terrassea"
          width="192"
          height="90"
        />
        <nav aria-label="Informations">
          <a href="/catalogue">Catalogue</a>
          <a href="/account">Mon compte</a>
          <a href="/legal/confidentialite">Confidentialité</a>
          <a href="/legal/mentions-legales">Mentions légales</a>
        </nav>
        <small>Mobilier professionnel · Personnalisation</small>
      </div>
    </footer>
  )
}
