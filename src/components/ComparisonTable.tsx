import { CheckCircle2, CircleHelp, MinusCircle } from 'lucide-react'

import { Reveal } from '@/components/motion-helpers'

const ROWS = [
  ['Prix HT/unité', '€€', '€€', '€€€'],
  ['Rotin garanti UV 5 ans', 'yes', 'unknown', 'Variable'],
  ['Certification M1/M2', 'yes', 'no', 'Variable'],
  ['Rapport SGS disponible', 'yes', 'no', 'Variable'],
  ['Garantie', '2 ans FR', '1 an', 'Variable'],
  ['Origine transparente', 'yes', 'no', 'Variable'],
  ['SAV France', 'yes', 'Partiel', 'yes'],
  ['Conformité REACH', 'yes', 'unknown', 'Variable'],
] as const

function CellValue({ value }: { value: (typeof ROWS)[number][number] }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1 text-[color:var(--forest)]">
        <CheckCircle2 className="h-4 w-4" />
        Oui
      </span>
    )
  }

  if (value === 'no') {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <MinusCircle className="h-4 w-4" />
        Non
      </span>
    )
  }

  if (value === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1 text-[color:var(--ochre)]">
        <CircleHelp className="h-4 w-4" />
        Variable
      </span>
    )
  }

  return <span>{value}</span>
}

export function ComparisonTable() {
  return (
    <section className="border-t border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="mb-10 max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Comparatif
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Pourquoi acheter en club plutôt qu'en circuit classique.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Le modèle assume moins de stock immédiat, mais plus de transparence
            sur le prix, la conformité et l'origine.
          </p>
        </Reveal>

        <Reveal className="overflow-x-auto border-y border-[color:var(--sand-deep)]">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="w-[34%] px-4 py-4 font-medium text-muted-foreground">
                  Critère
                </th>
                <th className="w-[22%] bg-[color:var(--foreground)] px-4 py-4 font-medium text-[color:var(--background)]">
                  Container Club
                </th>
                <th className="w-[22%] px-4 py-4 font-medium text-muted-foreground">
                  Grossistes pro
                </th>
                <th className="w-[22%] px-4 py-4 font-medium text-muted-foreground">
                  Revendeurs spécialisés
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--sand-deep)]">
              {ROWS.map(([label, containerClub, wholesalers, retailers]) => (
                <tr key={label}>
                  <th className="px-4 py-3 text-left font-medium text-foreground">
                    {label}
                  </th>
                  <td className="bg-[color:var(--foreground)] px-4 py-3 font-medium text-[color:var(--background)] [&_span]:text-[color:var(--background)] [&_svg]:text-[color:var(--background)]">
                    <CellValue value={containerClub} />
                  </td>
                  <td className="text-foreground/75 px-4 py-3">
                    <CellValue value={wholesalers} />
                  </td>
                  <td className="text-foreground/75 px-4 py-3">
                    <CellValue value={retailers} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  )
}
