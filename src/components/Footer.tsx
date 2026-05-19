import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-[color:var(--sand-deep)] bg-foreground text-[color:var(--sand)]">
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
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-[color:var(--sand)]/65">
              Le club d'achat groupé des pros de la terrasse. Mobilier outdoor direct usine,
              importation officielle France.
            </p>
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">Légal</div>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <Link
                  to="/mentions-legales"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link
                  to="/cgv"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Conditions générales de vente
                </Link>
              </li>
              <li>
                <Link
                  to="/cgu"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Conditions générales d'utilisation
                </Link>
              </li>
              <li>
                <Link
                  to="/politique-confidentialite"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Politique de confidentialité
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--sand)]/55">Contact</div>
            <ul className="mt-4 space-y-2 text-xs">
              <li>
                <Link
                  to="/contact"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  Formulaire de contact
                </Link>
              </li>
              <li>
                <a
                  href="mailto:contact@container-club.fr"
                  className="text-[color:var(--sand)]/80 hover:text-[color:var(--sand)]"
                >
                  contact@container-club.fr
                </a>
              </li>
              <li className="text-[color:var(--sand)]/65">Lun – Ven · 9h – 18h</li>
              <li>
                <Link
                  to="/compte"
                  className="text-[color:var(--ember-soft)] hover:text-[color:var(--sand)]"
                >
                  Espace pro →
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[color:var(--sand)]/15 pt-6 text-[11px] text-[color:var(--sand)]/55 sm:flex-row sm:justify-between">
          <span>© 2026 [Raison sociale] · RCS [ville] [n°] · SIRET [n°]</span>
          <span>EORI [n°] · TVA [n°]</span>
        </div>
      </div>
    </footer>
  );
}
