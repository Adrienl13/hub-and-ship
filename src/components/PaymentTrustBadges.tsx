/**
 * Reassurance row shown next to the reservation-fee payment CTA.
 * Two CSS-only wordmarks (no external assets) — Stripe in its blurple,
 * Qonto in its navy — covering "paiement traité par tiers certifié"
 * and "compte bancaire pro vérifié". Replace with the official SVG
 * press kits later by dropping `public/logos/stripe.svg` and
 * `public/logos/qonto.svg` and swapping the spans for <img>.
 */

interface PaymentTrustBadgesProps {
  /** Show the smaller "compact" variant suitable for sidebars. */
  readonly compact?: boolean
}

export function PaymentTrustBadges({
  compact = false,
}: PaymentTrustBadgesProps) {
  return (
    <div
      className={
        compact
          ? 'flex flex-wrap items-center gap-2 text-[11px]'
          : 'flex flex-wrap items-center gap-3 text-xs'
      }
    >
      <StripeBadge />
      <QontoBadge />
      <ComplianceTag />
    </div>
  )
}

function StripeBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#635BFF]/20 bg-[#635BFF]/[0.06] px-2.5 py-1.5">
      <span className="text-foreground/55">Paiement</span>
      <span className="font-semibold tracking-tight text-[#635BFF] [font-feature-settings:'cv11']">
        stripe
      </span>
    </span>
  )
}

function QontoBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#1D2A4A]/15 bg-[#1D2A4A]/[0.05] px-2.5 py-1.5">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-[#FF614C]" />
      <span className="text-foreground/55">Compte pro</span>
      <span className="font-semibold tracking-tight text-[#1D2A4A]">Qonto</span>
    </span>
  )
}

function ComplianceTag() {
  return (
    <span className="text-foreground/70 inline-flex items-center gap-1.5 rounded-md border border-[color:var(--sand-deep)] bg-card px-2.5 py-1.5">
      <span className="font-medium">PCI DSS</span>
      <span className="text-foreground/40">·</span>
      <span className="font-medium">3D Secure</span>
    </span>
  )
}
