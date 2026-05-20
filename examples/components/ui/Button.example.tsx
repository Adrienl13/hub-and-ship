/**
 * EXAMPLE DE RÉFÉRENCE — Composant React de qualité
 *
 * Ce composant illustre :
 * - TypeScript strict avec props typées
 * - forwardRef pour accessibilité
 * - Variants via class-variance-authority (CVA)
 * - className composable via tailwind-merge
 * - Touch target ≥44px (mobile-first)
 * - Accessibilité WCAG AA (aria-* appropriés)
 * - Documentation JSDoc
 *
 * À adapter pour src/components/ui/Button.tsx
 */

import { forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// ============================================
// HELPER cn (à mettre dans src/lib/utils.ts)
// ============================================

function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// ============================================
// VARIANTS
// ============================================

const buttonVariants = cva(
  // Base : touch target 44px+ minimum, transitions fluides, accessibilité
  [
    'inline-flex items-center justify-center gap-2',
    'rounded font-medium',
    'transition-all duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'min-h-touch', // 44px minimum hauteur
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-cta text-cta-text hover:bg-cta-hover',
        secondary:
          'bg-bg-elevated text-text-primary border border-border hover:border-border-strong',
        accent: 'bg-accent text-white hover:bg-accent-hover',
        ghost: 'text-text-primary hover:bg-bg-alt',
        danger: 'bg-danger text-white hover:bg-danger/90',
        link: 'text-accent underline-offset-4 hover:underline min-h-fit',
      },
      size: {
        sm: 'px-3 py-1.5 text-sm min-h-[36px]', // exception: bouton secondaire petit
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
        icon: 'h-touch w-touch p-0', // bouton carré 44x44
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  },
)

// ============================================
// TYPES
// ============================================

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * État loading (affiche un spinner et désactive le bouton)
   */
  loading?: boolean

  /**
   * Icône à afficher avant le texte
   */
  iconLeft?: React.ReactNode

  /**
   * Icône à afficher après le texte
   */
  iconRight?: React.ReactNode
}

// ============================================
// COMPONENT
// ============================================

/**
 * Bouton principal de l'application Container Club.
 *
 * Conformité :
 * - Touch target ≥44px (mobile-first)
 * - WCAG AA (focus visible, état disabled clair)
 * - Variants couvrant tous les cas d'usage UI
 *
 * @example
 * <Button variant="primary" size="lg">Réserver mon container</Button>
 * <Button variant="secondary" loading>Chargement...</Button>
 * <Button variant="ghost" iconLeft={<XIcon />}>Annuler</Button>
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      disabled,
      iconLeft,
      iconRight,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        {...props}
      >
        {loading ? (
          <Spinner aria-label="Chargement en cours" />
        ) : (
          iconLeft && <span aria-hidden="true">{iconLeft}</span>
        )}
        {children && <span>{children}</span>}
        {!loading && iconRight && <span aria-hidden="true">{iconRight}</span>}
      </button>
    )
  },
)

Button.displayName = 'Button'

// ============================================
// SPINNER INTERNE
// ============================================

function Spinner({ 'aria-label': ariaLabel }: { 'aria-label': string }) {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={ariaLabel}
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
