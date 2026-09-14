import { createFileRoute } from '@tanstack/react-router'
import { readCatalogue } from '@/components/public-design/catalogue/read'
export const Route = createFileRoute('/api/public-catalogue')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await readCatalogue(), {
            headers: { 'Cache-Control': 'public, max-age=60' },
          })
        } catch {
          return Response.json(
            { error: 'Catalogue indisponible' },
            { status: 503 },
          )
        }
      },
    },
  },
})
