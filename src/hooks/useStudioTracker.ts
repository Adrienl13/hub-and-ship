// Traqueur d'événements Studio lié à la session du store (lot 2). Un seul
// traqueur par session ; vidé à la fermeture de page (keepalive). Jamais
// bloquant, jamais d'erreur remontée à l'interface.

import { useEffect, useMemo } from 'react'

import { AnalyticsEvent, track } from '@/lib/analytics'
import {
  createStudioEventTracker,
  type StudioEventTracker,
} from '@/lib/studio/events-client'
import { useStudioStore, type StudioEntry } from '@/stores/studio.store'

const trackers = new Map<string, StudioEventTracker>()
const startedSessions = new Set<string>()
const STARTED_STORAGE_PREFIX = 'studio_started:'

function alreadyStarted(sessionId: string): boolean {
  if (startedSessions.has(sessionId)) return true
  try {
    return (
      sessionStorage.getItem(`${STARTED_STORAGE_PREFIX}${sessionId}`) === '1'
    )
  } catch {
    return false
  }
}

function rememberStarted(sessionId: string): void {
  startedSessions.add(sessionId)
  try {
    sessionStorage.setItem(`${STARTED_STORAGE_PREFIX}${sessionId}`, '1')
  } catch {
    // stockage indisponible : la mémoire du module suffit pour cette page
  }
}

/** Émet studio_started une fois par session (mémoire + sessionStorage, donc
 *  pas de doublon au rechargement) : mesure serveur + miroir marketing
 *  minimal (soumis au consentement existant via track()). */
export function markStudioStarted(sessionId: string, entry: StudioEntry): void {
  if (alreadyStarted(sessionId)) return
  rememberStarted(sessionId)
  getStudioTracker(sessionId, entry).track('studio_started', {
    payload: { entry },
  })
  track(AnalyticsEvent.StudioStarted, { entry })
}

export function getStudioTracker(
  sessionId: string,
  entry: StudioEntry | null,
  algorithmVersion = useStudioStore.getState().algorithmVersion ?? 'v0.1',
): StudioEventTracker {
  const key = `${sessionId}:${algorithmVersion}:${entry ?? ''}`
  let tracker = trackers.get(key)
  if (!tracker) {
    tracker = createStudioEventTracker({
      sessionId,
      algorithmVersion,
      ...(entry ? { entry } : {}),
    })
    trackers.set(key, tracker)
  }
  return tracker
}

export function useStudioTracker(): StudioEventTracker {
  const sessionId = useStudioStore((state) => state.sessionId)
  const entry = useStudioStore((state) => state.project.entry)
  const version = useStudioStore((state) => state.algorithmVersion)
  const tracker = useMemo(
    () => getStudioTracker(sessionId, entry, version ?? 'v0.1'),
    [sessionId, entry, version],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    // À la fermeture de page, keepalive pour que le dernier lot survive au
    // déchargement ; sinon un fetch ordinaire.
    const onPageHide = () => {
      void tracker.flush({ keepalive: true })
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      void tracker.flush()
    }
  }, [tracker])

  return tracker
}
