// GET /studio/preview?key=<STUDIO_PREVIEW_KEY> — pose le cookie de preview
// Studio (route NON imbriquée : le layout /studio ne doit pas la 404).
// GET /studio/preview?clear=1 — retire le cookie.
// Toute autre situation (secret absent, clé fausse, méthode) : 404.

import { createFileRoute } from '@tanstack/react-router'

import {
  handleStudioPreviewRequest,
  isSecureRequest,
  readStudioPreviewSecret,
} from '@/lib/studio/preview-server'

export async function handleStudioPreview(request: Request): Promise<Response> {
  return handleStudioPreviewRequest(request, {
    secret: readStudioPreviewSecret(),
    nowSeconds: Math.floor(Date.now() / 1000),
    secure: isSecureRequest(request, import.meta.env.PROD),
  })
}

export const Route = createFileRoute('/studio_/preview')({
  server: {
    handlers: {
      GET: async ({ request }) => handleStudioPreview(request),
      POST: async ({ request }) => handleStudioPreview(request),
    },
  },
})
