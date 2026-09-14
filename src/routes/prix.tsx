import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '@/components/public-design/PublicPage'
import { buildSeoHead } from '@/lib/seo'
export const Route = createFileRoute('/prix')({
  head: () =>
    buildSeoHead({
      title: 'Le prix prouvé — Terrassea',
      description:
        'Comprenez notre circuit direct usine, les paliers de volume et les étapes de votre commande de mobilier professionnel.',
      path: '/prix',
    }),
  component: Page,
})
function Page() {
  return <PublicPage kind="prix" />
}
