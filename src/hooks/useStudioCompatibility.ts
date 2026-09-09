import { useEffect, useState } from 'react'
import { EMPTY_COMPATIBILITY } from '@/lib/studio/compatibility'
import { loadTableCompatibility } from '@/lib/studio/table-repository'
export function useStudioCompatibility() {
  const [state, setState] = useState({
    loading: true,
    data: EMPTY_COMPATIBILITY,
  })
  useEffect(() => {
    let cancelled = false
    void loadTableCompatibility().then((data) => {
      if (!cancelled) setState({ loading: false, data })
    })
    return () => {
      cancelled = true
    }
  }, [])
  return state
}
