import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '@/components/public-design/PublicPage'
import { buildSeoHead } from '@/lib/seo'
export const Route = createFileRoute('/')({
  head: () =>
    buildSeoHead({
      title: 'Votre lieu a du caractère. Votre mobilier aussi.',
      description:
        'Mobilier professionnel Terrassea : chaises, fauteuils, tables et lounge. Découvrez les designs catalogue et préparez votre projet personnalisé.',
      path: '/',
    }),
  component: Page,
})
function Page() {
  return <PublicPage kind="home" />
}
