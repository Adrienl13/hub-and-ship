import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '@/components/public-design/PublicPage'
import { buildSeoHead } from '@/lib/seo'
export const Route = createFileRoute('/livres/')({
  head: () =>
    buildSeoHead({
      title: 'Containers livrés — Terrassea',
      description:
        'Consultez le registre public des containers livrés ou en transit, les photos et les chiffres documentés.',
      // Sans slash final : c'est l'URL déclarée dans sitemap.xml. Une
      // canonique différente de l'URL du sitemap fait choisir à Google une
      // « autre URL canonique » et retarde l'indexation.
      path: '/livres',
    }),
  component: Page,
})
function Page() {
  return <PublicPage kind="livres" />
}
