import { Link } from '@tanstack/react-router'
import { ArrowRight, Handshake, PackageCheck, Truck } from 'lucide-react'

import { Reveal } from '@/components/motion-helpers'

// Ordre = priorité commerciale : la livraison clé en main d'abord — les
// pros veulent du direct et simple. L'enlèvement se fait en ZONE DE
// STOCKAGE (Fos-sur-Mer en priorité), jamais « au port » (décision 08/2026).
const OPTIONS = [
  {
    Icon: Truck,
    title: "Livraison jusqu'à votre terrasse",
    recommended: true,
    description:
      'On s’occupe de tout : transport organisé par Terrassea jusqu’à votre établissement. Tarif confirmé sous 24 h selon votre ville.',
  },
  {
    Icon: PackageCheck,
    title: 'Enlèvement en zone de stockage',
    recommended: false,
    description:
      'Gratuit, à Fos-sur-Mer — Le Havre et Paris ouvriront selon la demande. Votre transporteur habituel y est le bienvenu.',
  },
  {
    Icon: Handshake,
    title: 'Transporteur recommandé',
    recommended: false,
    description:
      'Nous fournissons une liste de transporteurs présélectionnés à contacter directement.',
  },
] as const

function DeliveryOptions({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-4'}>
      {OPTIONS.map(({ Icon, title, description, recommended }) => (
        <div
          key={title}
          className={
            compact
              ? 'flex gap-2.5 rounded-sm bg-[color:var(--sand-soft)] p-2.5'
              : 'flex gap-3 border-b border-[color:var(--sand-deep)] pb-4 last:border-b-0 last:pb-0'
          }
        >
          <Icon
            className={`text-foreground/65 mt-0.5 shrink-0 ${
              compact ? 'h-4 w-4' : 'h-5 w-5'
            }`}
          />
          <div>
            <h3
              className={`flex flex-wrap items-center gap-1.5 ${
                compact
                  ? 'text-xs font-medium'
                  : 'font-display text-base font-semibold tracking-tight'
              }`}
            >
              {title}
              {recommended && (
                <span className="rounded-sm bg-[color:var(--forest-bg)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--forest)]">
                  Recommandé
                </span>
              )}
            </h3>
            <p
              className={
                compact
                  ? 'mt-0.5 text-[11px] leading-4 text-muted-foreground'
                  : 'mt-1 text-sm leading-relaxed text-[color:var(--ink-soft)]'
              }
            >
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DeliveryInfoBox({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
        <div className="mb-3 flex items-start gap-2">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ember)]" />
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Et pour la livraison ?
            </div>
            <p className="mt-1 leading-5 text-muted-foreground">
              On peut livrer jusqu'à votre terrasse — ou vous venez enlever en
              zone de stockage. Le transport ne bloque jamais votre
              réservation.
            </p>
          </div>
        </div>

        <DeliveryOptions compact />

        <Link
          to="/transport-partenaires"
          className="hover:border-foreground/40 mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-1.5 text-[11px] font-medium transition-colors"
        >
          Transporteurs recommandés
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="shadow-paper grid gap-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 md:grid-cols-[0.9fr_1.1fr] md:p-7">
          <div>
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-sm bg-[color:var(--ember-soft)] text-[color:var(--ember)]">
              <Truck className="h-5 w-5" />
            </div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Comment la livraison fonctionne
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              Jusqu'à votre terrasse, si vous voulez.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Le prix affiché couvre le mobilier rendu en zone de stockage
              (Fos-sur-Mer). Pour la suite, le plus simple : on s'occupe du
              transport jusqu'à votre établissement, au tarif confirmé sous
              24 h — sans marge cachée, et sans jamais bloquer votre
              réservation.
            </p>
          </div>

          <div>
            <DeliveryOptions />

            <Link
              to="/transport-partenaires"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-sm border border-[color:var(--foreground)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Voir les transporteurs recommandés
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
