import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Download, Loader2, LogOut, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { MfaEnrollment } from '@/components/MfaEnrollment'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { buildSeoHead } from '@/lib/seo'
import {
  loadMyProfile,
  toAccountProfilePatch,
  updateMyProfile,
  type AccountProfile,
  type ProfileClient,
} from '@/lib/account/profile'
import {
  deleteMyAccount,
  downloadJson,
  exportMyAccountData,
  type RgpdClient,
} from '@/lib/account/rgpd'

export const Route = createFileRoute('/account/parametres')({
  component: AccountSettings,
  head: () =>
    buildSeoHead({
      title: 'Paramètres du compte',
      description: 'Gérez votre profil Pros Import — Container Club.',
      path: '/account/parametres',
      noindex: true,
    }),
})

function AccountSettings() {
  const { status, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<AccountProfile>({
    firstName: '',
    lastName: '',
    phone: '',
    marketingConsent: false,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return

    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as ProfileClient
        const profile = await loadMyProfile(client, user.id)
        if (cancelled) return
        setForm(profile)
      } catch (err) {
        if (cancelled) return
        toast.error(
          'Profil indisponible : ' +
            (err instanceof Error ? err.message : 'erreur inconnue'),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, user])

  async function handleSave(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!user) return
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      toast.error('Supabase non configuré.')
      return
    }
    setSaving(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ProfileClient
      await updateMyProfile(
        client,
        user.id,
        toAccountProfilePatch(form, new Date().toISOString()),
      )
      toast.success('Profil mis à jour.')
    } catch (err) {
      toast.error(
        "Échec de l'enregistrement : " +
          (err instanceof Error ? err.message : 'erreur inconnue'),
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleExport(): Promise<void> {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setExporting(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as RgpdClient
      const data = await exportMyAccountData(client)
      downloadJson(data, 'mes-donnees-prosimport.json')
      toast.success('Export téléchargé.')
    } catch (err) {
      toast.error(
        'Export indisponible : ' +
          (err instanceof Error ? err.message : 'erreur inconnue'),
      )
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setDeleting(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as RgpdClient
      await deleteMyAccount(client)
      // Drop any local checkout history for this device too.
      try {
        window.localStorage.clear()
      } catch {
        // ignore
      }
      await signOut()
      toast.success('Votre compte a été supprimé.')
      await navigate({ to: '/' })
    } catch (err) {
      toast.error(
        'Suppression impossible : ' +
          (err instanceof Error ? err.message : 'erreur inconnue'),
      )
      setDeleting(false)
    }
  }

  async function handleSignOut(): Promise<void> {
    setSigningOut(true)
    try {
      await signOut()
      toast.success('Vous êtes déconnecté.')
      await navigate({ to: '/' })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main id="contenu" className="mx-auto max-w-2xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Mon espace</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Paramètres du compte
        </h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Vos informations de contact et préférences.{' '}
          <Link
            to="/account"
            className="text-foreground underline underline-offset-4"
          >
            Retour au tableau de bord
          </Link>
        </p>

        {status === 'unconfigured' ? (
          <p className="mt-8 text-sm text-muted-foreground">
            Authentification non configurée sur cet environnement.
          </p>
        ) : status !== 'authenticated' ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 p-4 text-sm">
            <span>Connectez-vous pour gérer votre profil.</span>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link to="/auth/login" search={{ returnTo: '/account/parametres' }}>
                Se connecter
              </Link>
            </Button>
          </div>
        ) : loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de votre profil…
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
            <section className="space-y-4 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Email (identifiant de connexion)
                </Label>
                <Input value={user?.email ?? ''} disabled readOnly />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prénom</Label>
                  <Input
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nom</Label>
                  <Input
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Téléphone
                </Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.marketingConsent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      marketingConsent: e.target.checked,
                    }))
                  }
                />
                <span className="text-muted-foreground">
                  J'accepte de recevoir les ouvertures de container et offres par
                  email.
                </span>
              </label>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </section>

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5">
              <div>
                <div className="font-display text-sm font-semibold">
                  Déconnexion
                </div>
                <p className="text-xs text-muted-foreground">
                  Termine votre session sur cet appareil.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                <LogOut className="h-3.5 w-3.5" />
                {signingOut ? 'Déconnexion…' : 'Se déconnecter'}
              </Button>
            </section>
            </form>

            <MfaEnrollment />

            <section className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
              <h2 className="font-display text-sm font-semibold">
                Mes données (RGPD)
              </h2>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Téléchargez l'ensemble de vos données personnelles au format
                  JSON.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  disabled={exporting}
                  onClick={() => void handleExport()}
                >
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? 'Préparation…' : 'Exporter mes données'}
                </Button>
              </div>
            </section>

            <section className="space-y-3 rounded-md border border-red-300 bg-red-50 p-5">
              <h2 className="font-display text-sm font-semibold text-red-900">
                Supprimer mon compte
              </h2>
              <p className="text-sm text-red-900/80">
                Suppression définitive de votre identité et anonymisation de vos
                données. Les factures déjà émises sont conservées (obligation
                légale comptable). Cette action est irréversible.
              </p>
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-red-900">
                    Confirmer la suppression définitive ?
                  </span>
                  <Button
                    type="button"
                    className="gap-1.5 bg-red-600 text-white hover:bg-red-700"
                    disabled={deleting}
                    onClick={() => void handleDelete()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting ? 'Suppression…' : 'Oui, supprimer'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Annuler
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-red-300 text-red-900 hover:bg-red-100"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer mon compte
                </Button>
              )}
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
