import { createFileRoute } from '@tanstack/react-router'
import { readRegistry } from '@/components/public-design/livres/read'
export const Route = createFileRoute('/api/public-registry')({
  server: {
    handlers: {
      GET: async () => {
        try {
          return Response.json(await readRegistry(), {
            headers: { 'Cache-Control': 'public, max-age=60' },
          })
        } catch {
          return Response.json(
            { error: 'Registre indisponible' },
            { status: 503 },
          )
        }
      },
    },
  },
})
