import { Link } from "@tanstack/react-router";

const LEGAL_LINKS: Array<{ label: string; to: "/legal/$slug"; slug: string }> = [
  { label: "Mentions légales", to: "/legal/$slug", slug: "mentions-legales" },
  { label: "Conditions générales de vente", to: "/legal/$slug", slug: "cgv" },
  { label: "Politique de remboursement", to: "/legal/$slug", slug: "remboursement" },
  { label: "Politique de confidentialité", to: "/legal/$slug", slug: "confidentialite" },
  { label: "Politique cookies", to: "/legal/$slug", slug: "cookies" },
];

const PRODUCT_LINKS: Array<{ label: string; href: string }> = [
  { label: "Container en cours", href: "/#catalogue" },
  { label: "Comment ça marche", href: "/#comment" },
  { label: "Containers livrés", href: "/livres" },
  { label: "FAQ", href: "/#faq" },
];

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--sand-deep)] bg-foreground text-[color:var(--sand)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--sand)] font-display text-base font-semibold text-foreground">
                C
              </span>
              <span className="font-display text-base font-semibold tracking-tight">
                Container Club
              </span>
            </div>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-[color:var(--sand)]/65">
              Le club d'achat groupé des pros de la terrasse. Mobilier outdoor direct usine,
              importation officielle France, contrôle qualité SGS indépendant.
            </p>
            <div className="mt-6">
              <div className="label-eyebrow text-[color:var(--sand)]/55">Contact</div>
              <ul className="mt-3 space-y-1.5 text-xs">
                <li>
                  <a
                    href="mailto:hello@terrassea.fr"
                    className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                  >
                    hello@terrassea.fr
                  </a>
                </li>
                <li className="text-[color:var(--sand)]/65">+33 (0)4 91 00 00 00</li>
                <li className="text-[color:var(--sand)]/65">Lun – Ven · 9h – 18h</li>
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

          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">Le club</div>
            <ul className="mt-4 space-y-2 text-xs">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">Légal</div>
            <ul className="mt-4 space-y-2 text-xs">
              {LEGAL_LINKS.map((l) => (
                <li key={l.slug}>
                  <Link
                    to={l.to}
                    params={{ slug: l.slug }}
                    className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  to="/legal"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Tous les documents →
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--sand)]/15 pt-6 text-[11px] text-[color:var(--sand)]/55 sm:flex-row sm:justify-between">
          <span>
            © 2026 Terrassea SAS · RCS Marseille 902 345 678 · SIRET 902 345 678 00012
          </span>
          <span>EORI FR902345678 · TVA FR50902345678</span>
        </div>
      </div>
    </footer>
  );
}
