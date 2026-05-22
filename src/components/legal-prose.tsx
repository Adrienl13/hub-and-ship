export function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed">{children}</p>
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 marker:text-muted-foreground">
      {children}
    </ul>
  )
}

export function LI({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>
}
