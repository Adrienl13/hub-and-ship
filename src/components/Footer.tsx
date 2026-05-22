export function Footer() {
  return (
    <footer className="border-t border-[color:var(--sand-deep)] bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
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
              Contact
            </div>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <a
                  href="mailto:hello@terrassea.fr"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  hello@terrassea.fr
                </a>
              </li>
              <li className="text-[color:var(--sand)]/65">
                +33 (0)4 91 00 00 00
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
            © 2026 Terrassea SAS · RCS Marseille 902 345 678 · SIRET 902 345 678
            00012
          </span>
          <span>EORI FR902345678 · TVA FR50902345678</span>
        </div>
      </div>
    </footer>
  )
}
