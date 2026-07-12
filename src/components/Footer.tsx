import { ContainerNotifyForm } from '@/components/ContainerNotifyForm'

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--sand-deep)] bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-10 flex flex-col gap-4 border-b border-[color:var(--sand)]/15 pb-10 md:flex-row md:items-center md:justify-between">
          <div className="max-w-md">
            <div className="font-display text-lg font-semibold tracking-tight">
              Ne ratez pas le prochain départ.
            </div>
            <p className="text-[color:var(--sand)]/60 mt-1 text-xs leading-relaxed">
              Les containers partent quand le seuil est atteint. Laissez votre
              email pour être prévenu en priorité à la prochaine ouverture.
            </p>
          </div>
          <ContainerNotifyForm source="footer" />
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--sand)] font-display text-base font-semibold text-foreground">
                C
              </span>
              <span className="font-display text-base font-semibold tracking-tight">
                Container Club
              </span>
            </div>
            <p className="text-[color:var(--sand)]/65 mt-4 max-w-xs text-xs leading-relaxed">
              Le club d'achat groupé des pros de la terrasse. Mobilier outdoor
              direct usine, importation officielle France.
            </p>
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">
              Guides pros
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              {(
                [
                  [
                    'Importer par container',
                    '/guides/import-mobilier-chr-container',
                  ],
                  ['Le prix prouvé', '/prix'],
                  ['Chaises restaurant', '/catalogue/chaises-restaurant'],
                  ['Tables restaurant', '/catalogue/tables-restaurant'],
                  ['Stock terrasse 24h', '/stock-mobilier-terrasse-24h'],
                  ['Partenaires revendeurs', '/partenaires'],
                  ['FAQ achat groupé', '/faq'],
                ] as const
              ).map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                  >
                    {label}
                  </a>
                </li>
              ))}
              <li className="pt-1">
                <a
                  href="/guides"
                  className="text-[color:var(--ember-soft)] hover:text-[color:var(--sand)]"
                >
                  Tous les guides →
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">
              Légal
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              {(
                [
                  ['Mentions légales', '/legal/mentions-legales'],
                  ['Conditions générales de vente', '/legal/cgv'],
                  ['Conditions générales d’utilisation', '/legal/cgu'],
                  ['Politique de remboursement', '/legal/remboursement'],
                  ['Politique de confidentialité', '/legal/confidentialite'],
                  ['Politique cookies', '/legal/cookies'],
                ] as const
              ).map(([label, href]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                  >
                    {label}
                  </a>
                </li>
              ))}
              <li className="pt-1">
                <a
                  href="/legal"
                  className="text-[color:var(--ember-soft)] hover:text-[color:var(--sand)]"
                >
                  Tous les documents légaux →
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">
              Logistique
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <a
                  href="/partenaires"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Devenir partenaire
                </a>
              </li>
              <li>
                <a
                  href="/partner"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Espace partenaire
                </a>
              </li>
              <li>
                <a
                  href="/transport-partenaires"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Transporteurs partenaires
                </a>
              </li>
              <li>
                <a
                  href="/stock-24h"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Espace disponibilité 24h
                </a>
              </li>
              <li>
                <a
                  href="/qualite"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Qualité & rapports SGS
                </a>
              </li>
              <li>
                <a
                  href="/livres"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Containers livrés
                </a>
              </li>
            </ul>
            <div className="label-eyebrow text-[color:var(--sand)]/55 mt-6">
              Contact
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <a
                  href="/a-propos"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  À propos de Pros Import
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@prosimport.com"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  contact@prosimport.com
                </a>
              </li>
              <li className="text-[color:var(--sand)]/65">
                Lun – Ven · 9h – 18h
              </li>
              <li>
                <a
                  href="https://terrassea.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[color:var(--ember-soft)] hover:text-[color:var(--sand)]"
                >
                  terrassea.com →
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-[color:var(--sand)]/15 text-[color:var(--sand)]/55 mt-12 flex flex-col gap-2 border-t pt-6 text-[11px] sm:flex-row sm:justify-between">
          <span>
            © 2026 Pros Import EURL · RCS Paris 988 269 981 · SIRET
            98826998100011
          </span>
          <span>TVA FR08988269981</span>
        </div>
      </div>
    </footer>
  )
}
