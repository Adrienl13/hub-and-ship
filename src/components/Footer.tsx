export function Footer() {
  return (
    <footer className="border-t border-[color:var(--sand-deep)] bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
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
                  ['Chaises restaurant', '/catalogue/chaises-restaurant'],
                  ['Tables restaurant', '/catalogue/tables-restaurant'],
                  ['Stock terrasse 24h', '/stock-mobilier-terrasse-24h'],
                  ['Catalogue complet', '/catalogue'],
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
                  href="mailto:adrienlaniez1@gmail.com"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  adrienlaniez1@gmail.com
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
          <span>EORI FR98826998100011 · TVA FR08988269981</span>
        </div>
      </div>
    </footer>
  )
}
