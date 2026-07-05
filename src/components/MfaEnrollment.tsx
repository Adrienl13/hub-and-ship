import { useCallback, useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

/**
 * Self-service TOTP (authenticator app) enrolment. Opt-in only — there is no
 * AAL2 enforcement, so enabling/disabling 2FA here never locks anyone out. A
 * future migration can require AAL2 for admin operations once factors exist.
 */
export function MfaEnrollment() {
  const [client] = useState(() => {
    const config = getSupabasePublicConfig()
    return config.isConfigured ? createSupabaseBrowserClient(config) : null
  })
  const [loading, setLoading] = useState(true)
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null)
  const [enroll, setEnroll] = useState<{
    factorId: string
    qr: string
  } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!client) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await client.auth.mfa.listFactors()
    if (!error) {
      const verified = (data?.totp ?? []).find((f) => f.status === 'verified')
      setVerifiedFactorId(verified?.id ?? null)
    }
    setLoading(false)
  }, [client])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function startEnroll(): Promise<void> {
    if (!client) return
    setBusy(true)
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
      })
      if (error || !data) {
        toast.error(error?.message ?? "Échec de l'activation.")
        return
      }
      setEnroll({ factorId: data.id, qr: data.totp.qr_code })
    } finally {
      setBusy(false)
    }
  }

  async function confirmEnroll(): Promise<void> {
    if (!client || !enroll) return
    setBusy(true)
    try {
      const challenge = await client.auth.mfa.challenge({
        factorId: enroll.factorId,
      })
      if (challenge.error || !challenge.data) {
        toast.error(challenge.error?.message ?? 'Échec.')
        return
      }
      const verify = await client.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      })
      if (verify.error) {
        toast.error('Code invalide : ' + verify.error.message)
        return
      }
      toast.success('Authentification à deux facteurs activée.')
      setEnroll(null)
      setCode('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function cancelEnroll(): Promise<void> {
    if (client && enroll) {
      await client.auth.mfa.unenroll({ factorId: enroll.factorId })
    }
    setEnroll(null)
    setCode('')
  }

  async function disable(): Promise<void> {
    if (!client || !verifiedFactorId) return
    setBusy(true)
    try {
      const { error } = await client.auth.mfa.unenroll({
        factorId: verifiedFactorId,
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Authentification à deux facteurs désactivée.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!client) return null

  return (
    <section className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[color:var(--ember)]" />
        <h2 className="font-display text-sm font-semibold">
          Sécurité — Double authentification (2FA)
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      ) : enroll ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Scannez ce QR code avec votre application d'authentification (Google
            Authenticator, Authy…) puis saisissez le code à 6 chiffres.
          </p>
          {/* qr_code is an inline SVG data URI returned by Supabase */}
          <img
            src={enroll.qr}
            alt="QR code 2FA"
            className="h-44 w-44 rounded-md border border-[color:var(--sand-deep)] bg-white p-2"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Code de vérification
            </Label>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="max-w-[160px] tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy || code.trim().length < 6}
              onClick={() => void confirmEnroll()}
            >
              {busy ? 'Vérification…' : 'Activer la 2FA'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void cancelEnroll()}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : verifiedFactorId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[color:var(--forest)]">
            ✓ La double authentification est active sur votre compte.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void disable()}
          >
            Désactiver
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Ajoutez une couche de sécurité avec une application
            d'authentification.
          </p>
          <Button type="button" disabled={busy} onClick={() => void startEnroll()}>
            Activer la 2FA
          </Button>
        </div>
      )}
    </section>
  )
}
