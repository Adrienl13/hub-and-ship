import type { HTMLInputTypeAttribute, InputHTMLAttributes } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ValidatedInputProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly type?: HTMLInputTypeAttribute
  readonly error?: string
  readonly success?: string
  readonly hint?: string
  readonly placeholder?: string
  readonly autoComplete?: string
  readonly inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  readonly required?: boolean
  readonly className?: string
}

export function ValidatedInput({
  id,
  label,
  value,
  onValueChange,
  type = 'text',
  error,
  success,
  hint,
  placeholder,
  autoComplete,
  inputMode,
  required,
  className,
}: ValidatedInputProps) {
  const messageId = `${id}-message`
  const describedBy = error || success || hint ? messageId : undefined

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onValueChange(event.target.value)}
        className={
          className ??
          'h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0'
        }
      />
      {error && (
        <p id={messageId} className="text-[10px] leading-4 text-destructive">
          {error}
        </p>
      )}
      {!error && success && (
        <p
          id={messageId}
          className="text-[10px] leading-4 text-[color:var(--forest)]"
        >
          {success}
        </p>
      )}
      {!error && !success && hint && (
        <p
          id={messageId}
          className="text-[10px] leading-4 text-muted-foreground"
        >
          {hint}
        </p>
      )}
    </div>
  )
}
