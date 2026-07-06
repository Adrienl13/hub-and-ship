import { useState } from 'react'
import { BellRing, Check } from 'lucide-react'
import { toast } from 'sonner'

import { AnalyticsEvent, track } from '@/lib/analytics'
import {
  subscribeContainerNotification,
  type NotifySubscribeClient,
} from '@/lib/leads/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

/**
 * "Notify me about the next container" email capture. Drop it on editorial /
 * SEO surfaces (and the footer) to convert cold traffic into a lead list.
 * `tone` adapts the styling: 'dark' for the footer, 'light' for page bodies.
 */
export function ContainerNotifyForm({
  source = 'site',
  tone = 'dark',
}: {
  source?: string
  tone?: 'dark' | 'light'
}) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!email.includes('@') || email.trim().length < 5) {
      toast.error('Entrez un email valide.')
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      toast.error('Inscription indisponible pour le moment.')
      return
    }
    setSubmitting(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as NotifySubscribeClient
      await subscribeContainerNotification(client, email.trim(), source)
      track(AnalyticsEvent.NotifySignup, { source })
      setDone(true)
      toast.success('C’est noté ! Vous serez prévenu à la prochaine ouverture.')
    } catch (err) {
      toast.error(
        'Inscription impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const styles =
    tone === 'dark'
      ? {
          done: 'text-[color:var(--sand)]/80',
          title: 'text-[color:var(--sand)]',
          hint: 'text-[color:var(--sand)]/60',
          input:
            'border-[color:var(--sand)]/25 bg-[color:var(--sand)]/10 text-[color:var(--sand)] placeholder:text-[color:var(--sand)]/40',
        }
      : {
          done: 'text-muted-foreground',
          title: 'text-foreground',
          hint: 'text-muted-foreground',
          input:
            'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground placeholder:text-muted-foreground',
        }

  if (done) {
    return (
      <p
        className={`inline-flex items-center gap-1.5 text-sm ${styles.done}`}
      >
        <Check className="h-4 w-4 text-[color:var(--ember)]" />
        Inscription confirmée — à bientôt.
      </p>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
      <div
        className={`mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium ${styles.title}`}
      >
        <BellRing className="h-4 w-4 text-[color:var(--ember)]" />
        Prévenez-moi du prochain container
      </div>
      <p className={`mb-2 text-xs ${styles.hint}`}>
        Recevez un email à l’ouverture d’un nouveau départ. Pas de spam.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@etablissement.fr"
          className={`min-w-0 flex-1 rounded-sm border px-3 py-2 text-sm focus:border-[color:var(--ember)] focus:outline-none ${styles.input}`}
        />
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 rounded-sm bg-[color:var(--ember)] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? '…' : 'M’avertir'}
        </button>
      </div>
    </form>
  )
}

/**
 * Light card wrapper for page bodies (/prix, /faq, guides…) — the footer-only
 * placement was leaving SEO traffic uncaptured.
 */
export function ContainerNotifySection({ source }: { source: string }) {
  return (
    <section className="mt-10 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <ContainerNotifyForm source={source} tone="light" />
    </section>
  )
}
