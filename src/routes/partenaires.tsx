import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '@/components/public-design/PublicPage'
import { buildSeoHead } from '@/lib/seo'
export const Route = createFileRoute('/partenaires')({
  head: () =>
    buildSeoHead({
      title: 'Devenir partenaire Terrassea',
      description:
        'Découvrez le programme partenaires Terrassea et déposez votre candidature.',
      path: '/partenaires',
    }),
  component: Page,
})
function Page() {
  return <PublicPage kind="partenaires" />
}
