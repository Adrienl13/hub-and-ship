import { createFileRoute } from '@tanstack/react-router'
import { PublicPage } from '@/components/public-design/PublicPage'
import { buildSeoHead } from '@/lib/seo'
export const Route = createFileRoute('/livres/')({
  head: () =>
    buildSeoHead({
      title: 'Containers livrés — Terrassea',
      description:
        'Consultez le registre public des containers livrés ou en transit, les photos et les chiffres documentés.',
      path: '/livres/',
    }),
  component: Page,
})
function Page() {
  return <PublicPage kind="livres" />
}
