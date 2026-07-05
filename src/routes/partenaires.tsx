import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { PartnerForm, type PartnerFormPrefill } from '@/components/partenaires/PartnerForm'
import { PartnerSelector } from '@/components/partenaires/PartnerSelector'
import { PartnerStatusCards } from '@/components/partenaires/PartnerStatusCards'
import {
  PartnerBrasseurs,
  PartnerComparison,
  PartnerFaqSection,
  PartnerHero,
  PartnerSteps,
} from '@/components/partenaires/sections'
import { SELECTOR_RECO } from '@/components/partenaires/data'
import type {
  PartnerActivityProfile,
  PartnerTargetStatus,
} from '@/lib/partner-applications'
import { breadcrumbJsonLd, buildSeoHead, jsonLdScript } from '@/lib/seo'

export const Route = createFileRoute('/partenaires')({
  head: () => ({
    ...buildSeoHead({
      title: 'Programme partenaires — apporteurs, revendeurs, distributeurs',
      description:
        'Devenez partenaire Container Club : apporteur d’affaires (8% de commission sur CA encaissé), revendeur agréé, grand compte ou distributeur exclusif. Candidature en 2 minutes, réponse sous 48 h.',
      path: '/partenaires',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Programme partenaires', path: '/partenaires' },
        ]),
      ),
    ],
  }),
  component: PartenairesPage,
})

function scrollToForm() {
  if (typeof document === 'undefined') return
  document
    .getElementById('candidature')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function PartenairesPage() {
  const navigate = useNavigate()
  const [activeProfile, setActiveProfile] =
    useState<PartnerActivityProfile | null>(null)
  const [prefill, setPrefill] = useState<PartnerFormPrefill>({
    profile: '',
    status: '',
    nonce: 0,
  })

  const recommended = activeProfile ? SELECTOR_RECO[activeProfile].targets : []

  const handleSelectProfile = (profile: PartnerActivityProfile) => {
    setActiveProfile(profile)
    const targets = SELECTOR_RECO[profile].targets
    setPrefill((previous) => ({
      profile,
      status: targets.length === 1 ? (targets[0] ?? '') : '',
      nonce: previous.nonce + 1,
    }))
  }

  const handlePickStatus = (status: PartnerTargetStatus) => {
    setPrefill((previous) => ({
      profile: previous.profile,
      status,
      nonce: previous.nonce + 1,
    }))
    scrollToForm()
  }

  return (
    <div className="min-h-screen bg-[color:var(--sand)] text-foreground">
      <Header onReserve={() => void navigate({ to: '/catalogue' })} />

      <main>
        <PartnerHero />
        <PartnerSelector
          activeProfile={activeProfile}
          onSelect={handleSelectProfile}
        />
        <PartnerStatusCards
          recommended={recommended}
          onPickStatus={handlePickStatus}
        />
        <PartnerBrasseurs onApply={scrollToForm} />
        <PartnerComparison />
        <PartnerSteps />
        <PartnerForm prefill={prefill} />
        <PartnerFaqSection />
      </main>

      <Footer />
    </div>
  )
}
