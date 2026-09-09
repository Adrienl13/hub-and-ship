import type { ReactNode } from 'react'
import { SafeImage } from '@/components/SafeImage'
export const studioButton =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-[color:var(--sand-deep)] px-4 py-2 text-sm font-medium hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 disabled:opacity-40'
export function StudioSectionHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="mb-7 max-w-2xl">
      <p className="label-eyebrow text-[color:var(--ember)]">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {children && (
        <div className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">
          {children}
        </div>
      )}
    </header>
  )
}
export function StudioChoiceCard({
  image,
  title,
  detail,
  selected,
  onSelect,
  disabled = false,
  children,
}: {
  image?: string | null
  title: string
  detail?: string
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`group min-h-[44px] min-w-0 overflow-hidden rounded-lg border bg-[color:var(--paper)] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 disabled:opacity-50 motion-reduce:transition-none ${selected ? 'border-[color:var(--ink)] ring-1 ring-[color:var(--ink)]' : 'border-[color:var(--sand-deep)] hover:border-[color:var(--ink-soft)]'}`}
    >
      <SafeImage
        src={image}
        alt={title}
        imgClassName="aspect-square w-full object-contain p-4 sm:p-6"
        className="aspect-square w-full"
      />
      <div className="space-y-1 p-4">
        <div className="font-display text-base font-semibold">{title}</div>
        {detail && (
          <p className="text-xs text-[color:var(--ink-soft)]">{detail}</p>
        )}
        {children}
      </div>
    </button>
  )
}
