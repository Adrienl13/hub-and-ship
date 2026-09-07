// Contrôle d'accès aux routes Studio (lot 1).
//
// Deux portes, et deux seulement :
// 1. le flag public de build VITE_STUDIO_ENABLED (vérifié côté client et
//    serveur, sans appel réseau) ;
// 2. sinon, un cookie de preview signé, vérifié UNIQUEMENT côté serveur
//    (le secret ne quitte jamais process.env). Le navigateur ne peut pas
//    lire ce cookie (HttpOnly) et ne peut pas le forger sans le secret.
// Aucune de ces portes ne touche à l'auth Supabase ni aux gardes admin.

import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { isStudioEnabled } from './flags'
import {
  readStudioPreviewSecret,
  requestHasValidStudioPreview,
} from './preview-server'

export type StudioAccessSource = 'flag' | 'preview' | 'none'

export interface StudioAccessResult {
  readonly allowed: boolean
  readonly source: StudioAccessSource
}

export const checkStudioPreviewAccess = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StudioAccessResult> => {
    if (isStudioEnabled()) return { allowed: true, source: 'flag' }
    const request = getRequest()
    const allowed = await requestHasValidStudioPreview(
      request,
      readStudioPreviewSecret(),
      Math.floor(Date.now() / 1000),
    )
    return { allowed, source: allowed ? 'preview' : 'none' }
  },
)

/** Décision d'accès utilisée par le `beforeLoad` du layout /studio. */
export async function resolveStudioAccess(): Promise<StudioAccessResult> {
  if (isStudioEnabled()) return { allowed: true, source: 'flag' }
  try {
    return await checkStudioPreviewAccess()
  } catch {
    return { allowed: false, source: 'none' }
  }
}
