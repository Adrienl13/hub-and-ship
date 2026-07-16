import { useEffect, useState } from 'react'

import {
  DEFAULT_SITE_MEDIA,
  loadSiteMedia,
  type SiteMediaSet,
} from '@/lib/site-media'

/**
 * Médias de la home : rend immédiatement les visuels par défaut, puis les
 * remplace par ceux définis en admin dès qu'ils sont chargés (aucun flash
 * si l'admin n'a rien défini — les défauts restent).
 */
export function useSiteMedia(): SiteMediaSet {
  const [media, setMedia] = useState<SiteMediaSet>(DEFAULT_SITE_MEDIA)

  useEffect(() => {
    let cancelled = false
    void loadSiteMedia().then((loaded) => {
      if (!cancelled) setMedia(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return media
}
