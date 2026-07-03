import { useMemo, useState } from 'react'
import { Check, Copy, Download, QrCode } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/order'
import {
  buildPartnerLink,
  buildQrSvg,
  downloadSvg,
} from '@/lib/partner-space/qr'
import {
  summarizePartnerCommissions,
  type PartnerSpaceData,
} from '@/lib/partner-space/repository'

export function ApporteurDashboard({ data }: { readonly data: PartnerSpaceData }) {
  const summary = useMemo(
    () => summarizePartnerCommissions(data.commissions),
    [data.commissions],
  )
  const primary = data.codes.find((c) => c.active) ?? data.codes[0] ?? null

  return (
    <div className="space-y-6">
      <div>
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
          Espace apporteur
        </span>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
          Vos tournées, vos commissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          8% du CA encaissé de chaque client apporté, pendant 12 mois.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Counter
          label="Réservations attribuées"
          value={String(summary.reservationsAttributed)}
        />
        <Counter
          label="CA encaissé attribué"
          value={formatEUR(summary.caEncaisseHt)}
        />
        <Counter label="Commissions (total)" value={formatEUR(summary.total)} />
      </div>

      {primary ? (
        <CodeCard code={primary.code} />
      ) : (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-4 text-sm text-muted-foreground">
          Aucun code apporteur actif n&apos;est encore rattaché à votre compte.
          Contactez votre référent Container Club.
        </div>
      )}

      <CommissionBreakdown summary={summary} />
      <CommissionsTable data={data} />
    </div>
  )
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="mono text-[10.5px] uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function CodeCard({ code }: { readonly code: string }) {
  const link = useMemo(() => buildPartnerLink(code), [code])
  const svg = useMemo(() => buildQrSvg(link), [link])
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="grid gap-5 rounded-lg border border-[color:var(--sand-deep)] bg-card p-5 sm:grid-cols-[1fr_auto]">
      <div>
        <div className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-[color:var(--ember)]" />
          <span className="text-sm font-medium">Votre code &amp; lien de suivi</span>
        </div>
        <div className="mono mt-3 inline-block rounded-sm bg-[color:var(--ink)] px-3 py-1.5 text-sm tracking-[0.1em] text-[color:var(--sand-soft)]">
          {code}
        </div>
        <div className="mt-3">
          <div className="mono truncate rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-[11px]">
            {link}
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" onClick={copy} className="h-8 gap-1.5 text-xs">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copié' : 'Copier le lien'}
            </Button>
            <Button
              size="sm"
              onClick={() => downloadSvg(`qr-${code}.svg`, svg)}
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger mon QR pour tournées
            </Button>
          </div>
        </div>
      </div>
      <div
        className="mx-auto h-40 w-40 rounded-md bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
        aria-label={`QR code pour ${code}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

function CommissionBreakdown({
  summary,
}: {
  readonly summary: ReturnType<typeof summarizePartnerCommissions>
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <MiniStat label="Accrued" value={summary.accrued} tone="ochre" />
      <MiniStat label="Payable" value={summary.payable} tone="info" />
      <MiniStat label="Payé" value={summary.paid} tone="forest" />
    </div>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'ochre' | 'info' | 'forest'
}) {
  const toneClass = {
    ochre: 'text-[color:var(--ochre)]',
    info: 'text-[color:var(--info)]',
    forest: 'text-[color:var(--forest)]',
  }[tone]
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-center">
      <div className="mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-display text-lg font-semibold tabular-nums ${toneClass}`}>
        {formatEUR(value)}
      </div>
    </div>
  )
}

function CommissionsTable({ data }: { readonly data: PartnerSpaceData }) {
  if (data.commissions.length === 0) {
    return (
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
        Aucune commission pour le moment. Elle apparaîtra ici dès qu&apos;un
        client apporté aura été encaissé.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-[color:var(--sand-deep)]">
      <table className="w-full min-w-[520px] text-xs">
        <thead className="bg-[color:var(--sand-soft)] text-left text-muted-foreground">
          <tr>
            <th className="p-2">Réservation</th>
            <th className="p-2 text-right">Base HT</th>
            <th className="p-2 text-right">Commission</th>
            <th className="p-2">Statut</th>
            <th className="p-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {data.commissions.map((row) => (
            <tr key={row.id} className="border-t border-[color:var(--sand-deep)]">
              <td className="mono p-2 text-[10px]">{row.reservationId}</td>
              <td className="p-2 text-right">{formatEUR(row.baseAmountHt)}</td>
              <td className="p-2 text-right font-semibold">
                {formatEUR(row.amount)}
              </td>
              <td className="p-2">
                {row.status}
                {row.phase === 'reversal' && (
                  <span className="text-[color:var(--stamp)]"> (annulation)</span>
                )}
              </td>
              <td className="p-2">
                {new Date(row.accruedAt).toLocaleDateString('fr-FR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
