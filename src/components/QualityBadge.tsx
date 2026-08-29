import { ArrowRight, ShieldCheck } from 'lucide-react'
import { Link } from '@tanstack/react-router'

// Badge de réassurance qualité, réutilisable sur toutes les pages : il ne
// met en avant QUE ce que les rapports du coffre documentaire couvrent
// (essais SGS EN 581 / EN 1022, conformité REACH — voir /qualite). Un seul
// composant pour garder le message identique partout.

// NB : pas de variante « pastille sur carte produit » — tous les produits
// étant testés, la répéter sur chaque photo gâchait le visuel (retiré à la
// demande d'Adrien, 08/2026).

/** Lien-pastille cliquable vers la page Qualité — pour hero, landings… */
export function QualityBadgeLink({ className }: { className?: string }) {
  return (
    <Link
      to="/qualite"
      title="Essais SGS EN 581 / EN 1022, conformité REACH — voir les rapports"
      className={`inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--forest)]/40 bg-[color:var(--forest-bg)] px-3.5 py-2 text-[12.5px] font-semibold text-[color:var(--forest)] transition-colors hover:border-[color:var(--forest)] ${className ?? ''}`}
    >
      <ShieldCheck className="h-4 w-4" />
      Testé SGS · EN 581
    </Link>
  )
}

/** Bloc détaillé — fiches produit : les référentiels en toutes lettres et
 *  le chemin vers les rapports. */
export function QualityBadgeDetail({ className }: { className?: string }) {
  return (
    <Link
      to="/qualite"
      className={`block rounded-md border border-[color:var(--forest)]/30 bg-[color:var(--forest-bg)] p-3 transition-colors hover:border-[color:var(--forest)]/60 ${className ?? ''}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--forest)]">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Testé en laboratoire SGS
      </div>
      <p className="mt-1 text-xs leading-5 text-[color:var(--forest)]/90">
        EN 581 (usage collectivités) · EN 1022 (stabilité) · matériaux
        conformes REACH — campagnes d&apos;essais 2022-2026.
      </p>
      <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--forest)] underline-offset-2 hover:underline">
        Voir les rapports
        <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}
