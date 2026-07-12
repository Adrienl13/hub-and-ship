// Marque Container Club (D6) : carré container — nervures verticales en
// haut/bas comme la tôle ondulée d'un container — et « C » géométrique tracé
// en arc, déclinable sur fond encre (défaut) ou fond sable (`inverse`).
// La même géométrie est dupliquée en dur dans public/favicon.svg : toute
// évolution du dessin doit être reportée aux deux endroits.

export function BrandMark({
  className,
  inverse = false,
}: {
  readonly className?: string
  readonly inverse?: boolean
}) {
  const plate = inverse ? 'var(--sand)' : 'var(--foreground)'
  const glyph = inverse ? 'var(--foreground)' : 'var(--sand)'
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Container Club"
    >
      <rect width="32" height="32" rx="7" fill={plate} />
      <g stroke={glyph} strokeOpacity="0.28" strokeWidth="1.6">
        <line x1="9" y1="3.5" x2="9" y2="7" />
        <line x1="16" y1="3.5" x2="16" y2="7" />
        <line x1="23" y1="3.5" x2="23" y2="7" />
        <line x1="9" y1="25" x2="9" y2="28.5" />
        <line x1="16" y1="25" x2="16" y2="28.5" />
        <line x1="23" y1="25" x2="23" y2="28.5" />
      </g>
      <path
        d="M 20.82 11.25 A 7.5 7.5 0 1 0 20.82 20.75"
        fill="none"
        stroke={glyph}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
