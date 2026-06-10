import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeEuro,
  FileText,
  Handshake,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Store,
  UsersRound,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import { motion } from 'framer-motion'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { RevealItem, RevealStagger } from '@/components/motion-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCatalog } from '@/hooks/useCatalog'
import { PARTNER_KIND_LABEL, type PartnerKind } from '@/lib/partners/types'
import {
  buildPartnerSubmissionDraft,
  savePartnerSubmissionToLocalHistory,
  type PartnerSubmissionInput,
} from '@/lib/partners/submission'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
} from '@/lib/seo'
import { useCart } from '@/stores/cart.store'

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

const PARTNER_FAQ = [
  {
    q: 'Un client que je partage peut-il commander en direct ensuite ?',
    a: 'Le chantier cible prévoit une protection par SIRET, email domaine et lien co-brandé. Un prospect apporté reste attribué au partenaire pendant la durée de protection définie, même s’il revient ensuite sur le site.',
  },
  {
    q: 'Les prix nets partenaires seront-ils visibles publiquement ?',
    a: 'Non. Le site public affiche les prix directs pros. Les conditions nettes partenaires doivent rester derrière un compte validé manuellement.',
  },
  {
    q: 'Puis-je appliquer ma propre marge ?',
    a: 'Oui. Pros Import fournit un prix net et des supports. Le partenaire reste libre de son prix final, de son conseil, de sa livraison, de sa pose et de son service.',
  },
  {
    q: 'Est-ce réservé aux gros revendeurs ?',
    a: 'Non. Le modèle peut accueillir des apporteurs, agenceurs, installateurs et revendeurs CHR, avec des droits différents selon le niveau de relation et de volume.',
  },
] as const

export const Route = createFileRoute('/partenaires')({
  component: PartenairesPage,
  head: () => ({
    ...buildSeoHead({
      title: 'Partenaires revendeurs mobilier CHR',
      description:
        'Programme partenaires Pros Import pour revendeurs CHR, agenceurs et apporteurs : prix nets protégés, client attribué, devis co-brandé et import mobilier par container.',
      path: '/partenaires',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Partenaires', path: '/partenaires' },
        ]),
      ),
      jsonLdScript(faqJsonLd(PARTNER_FAQ)),
    ],
  }),
})

function PartenairesPage() {
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [reserveOpen, setReserveOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <PartnerHero />
        <PartnerPromise />
        <PartnerOperatingModel />
        <PartnerTools />
        <PartnerRequestSection />
        <PartnerFaq />
        <PartnerCta />
      </main>

      <Footer />

      <Suspense fallback={null}>
        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
            container={currentContainer}
          />
        )}
      </Suspense>
    </div>
  )
}

function PartnerHero() {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Partenaires revendeurs CHR
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-4xl tracking-tight sm:text-5xl">
            Votre client reste votre client. Pros Import devient votre
            back-office d'import.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--ink-soft)]">
            Accédez à des prix nets sur du mobilier professionnel importé en
            volume, préparez vos sélections, protégez vos opportunités et
            revendez avec votre propre marge, votre conseil et votre relation
            terrain.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              asChild
              className="min-h-11 rounded-sm bg-[color:var(--foreground)] px-5 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <a href="#demande-partenaire">
                Devenir partenaire
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Link
              to="/catalogue"
              className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-5 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Voir le catalogue
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
          <div className="label-eyebrow text-muted-foreground">
            Ce que le partenaire garde
          </div>
          <div className="mt-5 space-y-4">
            {[
              ['La relation client', 'Attribution par SIRET, email et lien.'],
              ['Sa marge finale', 'Prix conseillé possible, jamais imposé.'],
              ['Son service', 'Conseil, livraison, pose, SAV terrain.'],
              ['Son image', 'Sélections et devis co-brandés à construire.'],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="border-b border-[color:var(--sand-deep)] pb-4 last:border-b-0 last:pb-0"
              >
                <div className="font-display text-lg font-semibold">
                  {title}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PartnerPromise() {
  const items = [
    {
      Icon: LockKeyhole,
      title: 'Protection des opportunités',
      desc: 'Le chantier cible enregistre les prospects par SIRET, email domaine et lien co-brandé pour éviter le court-circuit.',
    },
    {
      Icon: BadgeEuro,
      title: 'Prix nets réservés',
      desc: 'Les conditions partenaires restent derrière un compte validé. Le site public conserve ses prix directs pros.',
    },
    {
      Icon: FileText,
      title: 'Devis co-brandés',
      desc: 'Le partenaire doit pouvoir envoyer une sélection propre avec son nom, ses coordonnées et son offre commerciale.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <RevealStagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map(({ Icon, title, desc }, i) => (
            <RevealItem key={title}>
              <div className="group h-full rounded-md border border-[color:var(--sand-deep)] bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--ember)]/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
                <motion.div
                  className="flex h-12 w-12 items-center justify-center rounded-md bg-[length:200%_auto] text-white shadow-sm"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, var(--ember), #efb15a 45%, var(--ember))',
                  }}
                  animate={{
                    y: [0, -9, 0],
                    scale: [1, 1.08, 1],
                    backgroundPosition: ['0% 50%', '200% 50%'],
                  }}
                  transition={{
                    y: {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.3,
                    },
                    scale: {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.3,
                    },
                    backgroundPosition: {
                      duration: 4,
                      repeat: Infinity,
                      ease: 'linear',
                    },
                  }}
                >
                  <Icon
                    className="h-5 w-5 transition-transform duration-500 group-hover:rotate-[12deg]"
                    strokeWidth={1.8}
                  />
                </motion.div>
                <h2 className="mt-6 font-display text-lg font-semibold">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                  {desc}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}

function PartnerOperatingModel() {
  const rows = [
    [
      'Apporteur',
      'Apporte un projet qualifié',
      'Attribution ou commission à cadrer',
    ],
    [
      'Revendeur validé',
      'Achète à prix net partenaire',
      'Marge libre et devis co-brandé',
    ],
    [
      'Direct pro',
      'Commande pour son établissement',
      'Prix public direct, conditions standard',
    ],
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Modèle de canal
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Deux canaux, une règle simple : ne pas manger le terrain du
            partenaire.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
            Pros Import garde la vente directe aux pros, mais les opportunités
            apportées par un partenaire doivent être protégées et traitées comme
            telles.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto border-y border-[color:var(--sand-deep)]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Profil
                </th>
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Rôle
                </th>
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Ce que la plateforme doit garantir
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--sand-deep)]">
              {rows.map(([profile, role, guarantee]) => (
                <tr key={profile}>
                  <th className="px-4 py-4 text-left font-display text-base font-semibold">
                    {profile}
                  </th>
                  <td className="text-foreground/75 px-4 py-4">{role}</td>
                  <td className="text-foreground/75 px-4 py-4">{guarantee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function PartnerTools() {
  const tools = [
    {
      Icon: Store,
      title: 'Compte partenaire validé',
      desc: 'Accès aux conditions nettes, documents, sélections et opportunités protégées.',
    },
    {
      Icon: ShieldCheck,
      title: 'Deal registration',
      desc: 'Protection temporaire par client final, projet et source d’acquisition.',
    },
    {
      Icon: PackageCheck,
      title: 'Import mutualisé',
      desc: 'Produits, quantités, container, qualité et documents suivis dans un seul cockpit.',
    },
    {
      Icon: UsersRound,
      title: 'Assets de vente',
      desc: 'Photos, arguments, fiches et devis prêts à adapter pour son réseau.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Chantiers plateforme
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Les outils qui doivent rendre le partage du site naturel.
            </h2>
          </div>
          <Link
            to="/qualite"
            className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-4 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
          >
            Voir la méthode qualité
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tools.map(({ Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

type PartnerRequestMode = 'application' | 'deal'

interface PartnerFormState {
  readonly mode: PartnerRequestMode
  readonly partnerKind: PartnerKind
  readonly companyName: string
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly siret: string
  readonly website: string
  readonly territory: string
  readonly networkDescription: string
  readonly expectedMonthlyVolume: string
  readonly message: string
  readonly clientCompanyName: string
  readonly clientSiret: string
  readonly clientEmail: string
  readonly projectCity: string
  readonly projectType: string
  readonly expectedBudgetHt: string
  readonly expectedPurchaseWindow: string
  readonly productInterest: string
}

const INITIAL_PARTNER_FORM: PartnerFormState = {
  mode: 'application',
  partnerKind: 'reseller',
  companyName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  siret: '',
  website: '',
  territory: '',
  networkDescription: '',
  expectedMonthlyVolume: '',
  message: '',
  clientCompanyName: '',
  clientSiret: '',
  clientEmail: '',
  projectCity: '',
  projectType: '',
  expectedBudgetHt: '',
  expectedPurchaseWindow: '',
  productInterest: '',
}

function toPartnerSubmissionInput(
  form: PartnerFormState,
): PartnerSubmissionInput {
  const budget = Number.parseFloat(form.expectedBudgetHt.replace(',', '.'))
  return {
    mode: form.mode,
    partnerKind: form.partnerKind,
    companyName: form.companyName,
    contactName: form.contactName,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    siret: form.siret,
    website: form.website,
    territory: form.territory,
    networkDescription: form.networkDescription,
    expectedMonthlyVolume: form.expectedMonthlyVolume,
    message: form.message,
    clientCompanyName: form.clientCompanyName,
    clientSiret: form.clientSiret,
    clientEmail: form.clientEmail,
    projectCity: form.projectCity,
    projectType: form.projectType,
    expectedBudgetHt: Number.isFinite(budget) ? budget : null,
    expectedPurchaseWindow: form.expectedPurchaseWindow,
    productInterest: form.productInterest,
    protectionDays: 120,
  }
}

function PartnerRequestSection() {
  const [form, setForm] = useState<PartnerFormState>(INITIAL_PARTNER_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<{
    readonly kind: 'success' | 'warning' | 'error'
    readonly message: string
  } | null>(null)

  function update<K extends keyof PartnerFormState>(
    key: K,
    value: PartnerFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setNotice(null)

    const input = toPartnerSubmissionInput(form)
    const draftResult = buildPartnerSubmissionDraft(input)
    if (!draftResult.ok) {
      setNotice({ kind: 'error', message: draftResult.error })
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/partner-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = (await response.json()) as
        | { readonly ok: true }
        | { readonly ok: false; readonly error?: string }

      if (response.ok && body.ok) {
        setNotice({
          kind: 'success',
          message:
            form.mode === 'deal'
              ? 'Opportunité transmise. Elle est prête à être qualifiée en admin.'
              : 'Demande partenaire transmise. Elle est prête à être qualifiée en admin.',
        })
        setForm({ ...INITIAL_PARTNER_FORM, mode: form.mode })
        return
      }

      throw new Error(body.ok ? 'Erreur inconnue' : body.error)
    } catch {
      savePartnerSubmissionToLocalHistory({
        storage: window.localStorage,
        draft: draftResult.draft,
      })
      setNotice({
        kind: 'warning',
        message:
          'Serveur indisponible : demande sauvegardée localement sur cet appareil pour éviter de perdre le lead.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      id="demande-partenaire"
      className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Qualification partenaire
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Capturer les bons partenaires et les bons deals dès maintenant.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
            Ce formulaire alimente le back-office : demande d'accès partenaire,
            protection d'opportunité, SIRET client, zone et potentiel volume. Le
            but est de ne plus perdre les signaux chauds dans des messages
            éparpillés.
          </p>
          <div className="mt-6 rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-xs leading-5 text-muted-foreground">
            Hypothèse actuelle : protection par défaut 120 jours après
            qualification admin. Le prix net partenaire reste réservé aux
            comptes validés.
          </div>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['application', 'Demande partenaire'],
                ['deal', 'Protéger une opportunité'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => update('mode', mode)}
                className={`min-h-11 rounded-sm border px-3 text-sm font-medium transition-colors ${
                  form.mode === mode
                    ? 'border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]'
                    : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Société partenaire">
              <Input
                required
                value={form.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="CHR Conseil"
              />
            </Field>
            <Field label="Profil">
              <select
                value={form.partnerKind}
                onChange={(e) =>
                  update('partnerKind', e.target.value as PartnerKind)
                }
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {(Object.keys(PARTNER_KIND_LABEL) as PartnerKind[]).map(
                  (kind) => (
                    <option key={kind} value={kind}>
                      {PARTNER_KIND_LABEL[kind]}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Contact">
              <Input
                required
                value={form.contactName}
                onChange={(e) => update('contactName', e.target.value)}
                placeholder="Nom complet"
              />
            </Field>
            <Field label="Email pro">
              <Input
                required
                type="email"
                value={form.contactEmail}
                onChange={(e) => update('contactEmail', e.target.value)}
                placeholder="contact@revendeur.fr"
              />
            </Field>
            <Field label="Téléphone">
              <Input
                required
                value={form.contactPhone}
                onChange={(e) => update('contactPhone', e.target.value)}
                placeholder="+33 6 00 00 00 00"
              />
            </Field>
            <Field label="SIRET partenaire">
              <Input
                value={form.siret}
                onChange={(e) => update('siret', e.target.value)}
                placeholder="Optionnel au premier contact"
              />
            </Field>
            <Field label="Site web partenaire">
              <Input
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Zone couverte">
              <Input
                value={form.territory}
                onChange={(e) => update('territory', e.target.value)}
                placeholder="Bretagne, PACA, France..."
              />
            </Field>
            <Field label="Volume estimé">
              <Input
                value={form.expectedMonthlyVolume}
                onChange={(e) =>
                  update('expectedMonthlyVolume', e.target.value)
                }
                placeholder="Ex. 1 container / trimestre"
              />
            </Field>
          </div>

          {form.mode === 'deal' && (
            <div className="mt-5 border-t border-[color:var(--sand-deep)] pt-5">
              <div className="label-eyebrow text-muted-foreground">
                Opportunité à protéger
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Société client">
                  <Input
                    required
                    value={form.clientCompanyName}
                    onChange={(e) =>
                      update('clientCompanyName', e.target.value)
                    }
                    placeholder="Restaurant Atlantique"
                  />
                </Field>
                <Field label="SIRET client">
                  <Input
                    value={form.clientSiret}
                    onChange={(e) => update('clientSiret', e.target.value)}
                    placeholder="SIRET ou email requis"
                  />
                </Field>
                <Field label="Email client">
                  <Input
                    type="email"
                    value={form.clientEmail}
                    onChange={(e) => update('clientEmail', e.target.value)}
                    placeholder="direction@client.fr"
                  />
                </Field>
                <Field label="Ville projet">
                  <Input
                    value={form.projectCity}
                    onChange={(e) => update('projectCity', e.target.value)}
                    placeholder="Nantes"
                  />
                </Field>
                <Field label="Type de projet">
                  <Input
                    required
                    value={form.projectType}
                    onChange={(e) => update('projectType', e.target.value)}
                    placeholder="Terrasse 120 places"
                  />
                </Field>
                <Field label="Budget HT estimé">
                  <Input
                    inputMode="decimal"
                    value={form.expectedBudgetHt}
                    onChange={(e) => update('expectedBudgetHt', e.target.value)}
                    placeholder="18000"
                  />
                </Field>
                <Field label="Fenêtre achat">
                  <Input
                    value={form.expectedPurchaseWindow}
                    onChange={(e) =>
                      update('expectedPurchaseWindow', e.target.value)
                    }
                    placeholder="Juillet, avant ouverture..."
                  />
                </Field>
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 gap-3">
            <Field label="Réseau / produits recherchés">
              <Textarea
                rows={3}
                value={
                  form.mode === 'deal'
                    ? form.productInterest
                    : form.networkDescription
                }
                onChange={(e) =>
                  form.mode === 'deal'
                    ? update('productInterest', e.target.value)
                    : update('networkDescription', e.target.value)
                }
                placeholder={
                  form.mode === 'deal'
                    ? 'Chaises empilables, tables compactes, coloris...'
                    : 'Typologie de clients, zones, canaux de vente...'
                }
              />
            </Field>
            <Field label="Message">
              <Textarea
                rows={3}
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                placeholder="Contexte, urgence, prochain échange souhaité..."
              />
            </Field>
          </div>

          {notice && (
            <div
              className={`mt-4 rounded-md border p-3 text-xs leading-5 ${
                notice.kind === 'success'
                  ? 'border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 text-[color:var(--forest)]'
                  : notice.kind === 'warning'
                    ? 'border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 text-foreground'
                    : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {notice.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="mt-5 min-h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            {submitting
              ? 'Envoi en cours...'
              : form.mode === 'deal'
                ? "Envoyer l'opportunité"
                : 'Envoyer la demande partenaire'}
          </Button>
        </form>
      </div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function PartnerFaq() {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Questions sensibles
        </div>
        <h2 className="mt-2 font-display text-3xl tracking-tight">
          La confiance partenaire se construit avec des règles explicites.
        </h2>
        <div className="mt-8 divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
          {PARTNER_FAQ.map((item) => (
            <article key={item.q} className="py-5">
              <h3 className="font-display text-lg font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                {item.a}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function PartnerCta() {
  return (
    <section className="bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="label-eyebrow text-[color:var(--sand)]/60">
            Beta partenaires
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight">
            On construit le réseau avec peu de partenaires, mais les bons.
          </h2>
          <p className="text-[color:var(--sand)]/70 mt-3 text-sm leading-6">
            L’objectif n’est pas d’ouvrir les prix nets à tout le monde. Il faut
            d’abord valider quelques partenaires qui apportent de vrais projets
            et veulent utiliser Pros Import comme levier d’import.
          </p>
        </div>
        <a
          href="#demande-partenaire"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-[color:var(--sand)] px-5 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-white"
        >
          Demander un accès partenaire
          <Handshake className="ml-2 h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
