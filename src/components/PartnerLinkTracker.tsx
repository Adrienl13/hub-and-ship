import { useEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'

import { capturePartnerLinkContextFromUrl } from '@/lib/partners/link'

export function PartnerLinkTracker() {
  const href = useRouterState({
    select: (state) =>
      `${state.location.pathname}${state.location.searchStr}${state.location.hash}`,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    capturePartnerLinkContextFromUrl({
      storage: window.localStorage,
      url: new URL(window.location.href),
    })
  }, [href])

  return null
}
