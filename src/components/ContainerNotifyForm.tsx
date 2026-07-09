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
 */
export function ContainerNotifyForm({ source = 'site' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const inputId = `container-notify-email-${source}`

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

  if (done) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-[color:var(--sand)]/80">
        <Check className="h-4 w-4 text-[color:var(--ember)]" />
        Inscription confirmée — à bientôt.
      </p>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm">
      <label
        htmlFor={inputId}
        className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--sand)]"
      >
        <BellRing className="h-4 w-4 text-[color:var(--ember)]" />
        Prévenez-moi du prochain container
      </label>
      <p
        id={`${inputId}-hint`}
        className="mb-2 text-xs text-[color:var(--sand)]/60"
      >
        Recevez un email à l’ouverture d’un nouveau départ. Pas de spam.
      </p>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@etablissement.fr"
          aria-describedby={`${inputId}-hint`}
          className="min-w-0 flex-1 rounded-sm border border-[color:var(--sand)]/35 bg-[color:var(--foreground)] px-3 py-2 text-sm text-[color:var(--sand-soft)] placeholder:text-[color:var(--sand-deep)] focus:border-[color:var(--ember-soft)] focus:outline-none"
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
