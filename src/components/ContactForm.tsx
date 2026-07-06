import { useState } from 'react'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AnalyticsEvent, track } from '@/lib/analytics'
import {
  buildContactMessageDraft,
  CONTACT_TOPIC_LABEL,
  CONTACT_TOPICS,
} from '@/lib/contact'

interface FormState {
  name: string
  email: string
  company: string
  phone: string
  topic: string
  message: string
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  company: '',
  phone: '',
  topic: '',
  message: '',
}

const inputClass =
  'h-10 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'

export function ContactForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const update = (key: keyof FormState) => (value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }))

  const submit = async () => {
    const draftResult = buildContactMessageDraft({
      name: form.name,
      email: form.email,
      company: form.company,
      phone: form.phone,
      topic: form.topic || undefined,
      message: form.message,
    })
    if (!draftResult.ok) {
      toast.error('Message à compléter', { description: draftResult.error })
      return
    }

    setSubmitting(true)
    let sent = false
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          phone: form.phone,
          topic: form.topic || undefined,
          message: form.message,
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null
      sent = response.ok && payload?.ok === true
      if (!sent) {
        toast.error('Message non envoyé', {
          description:
            payload?.error ??
            'Réessayez dans un instant, ou écrivez-nous à contact@prosimport.com.',
        })
      }
    } catch {
      toast.error('Message non envoyé', {
        description:
          'Connexion impossible. Écrivez-nous à contact@prosimport.com.',
      })
    }
    setSubmitting(false)
    if (!sent) return

    track(AnalyticsEvent.ContactSubmit, {
      topic: form.topic || 'autre',
    })
    toast.success('Message envoyé', {
      description: 'Notre équipe vous répond sous 24 h ouvrées.',
    })
    setForm(EMPTY_FORM)
  }

  return (
    <section className="mt-6 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <h2 className="font-display text-lg font-semibold">
        Écrivez-nous directement
      </h2>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">
        Réponse sous 24 h ouvrées, directement dans votre boîte mail.
      </p>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className={inputClass}
            value={form.name}
            placeholder="Votre nom *"
            autoComplete="name"
            onChange={(e) => update('name')(e.target.value)}
          />
          <Input
            className={inputClass}
            type="email"
            value={form.email}
            placeholder="Email professionnel *"
            autoComplete="email"
            onChange={(e) => update('email')(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            className={inputClass}
            value={form.company}
            placeholder="Société (optionnel)"
            autoComplete="organization"
            onChange={(e) => update('company')(e.target.value)}
          />
          <Input
            className={inputClass}
            type="tel"
            value={form.phone}
            placeholder="Téléphone (optionnel)"
            autoComplete="tel"
            onChange={(e) => update('phone')(e.target.value)}
          />
        </div>
        <select
          className="h-10 w-full rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          value={form.topic}
          onChange={(e) => update('topic')(e.target.value)}
        >
          <option value="">Sujet…</option>
          {CONTACT_TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {CONTACT_TOPIC_LABEL[topic]}
            </option>
          ))}
        </select>
        <textarea
          className="min-h-[110px] w-full resize-y rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground"
          value={form.message}
          placeholder="Votre message * (produit, quantités, ville de livraison…)"
          onChange={(e) => update('message')(e.target.value)}
        />
        <Button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="h-11 w-full gap-2 rounded-sm bg-foreground text-background sm:w-auto sm:px-6"
        >
          <Send className="h-4 w-4" />
          {submitting ? 'Envoi…' : 'Envoyer le message'}
        </Button>
      </div>
    </section>
  )
}
