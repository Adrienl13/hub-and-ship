import { createFileRoute } from '@tanstack/react-router'
import { ProjectHome } from '@/components/experience/ProjectHome'
import { buildSeoHead, jsonLdScript, SITE_URL } from '@/lib/seo'
export const Route = createFileRoute('/')({
  head: () => ({
    ...buildSeoHead({
      title: 'Mobilier professionnel : construisez votre projet',
      description:
        'Pros Import : explorez les formes, matières et couleurs pour votre mobilier professionnel. Composez votre projet avec le Studio, puis vérifiez sa faisabilité avec notre équipe.',
      path: '/',
    }),
    scripts: [
      jsonLdScript({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Pros Import',
        url: SITE_URL,
      }),
    ],
  }),
  component: ProjectHome,
})
