import { useEffect, useState } from 'react'
import { EMPTY_CAPABILITIES } from '@/lib/studio/customization'
import { loadCustomizationCapabilities } from '@/lib/studio/customization-repository'
export function useStudioCustomization() {
  const [data, setData] = useState(EMPTY_CAPABILITIES)
  useEffect(() => {
    let cancelled = false
    void loadCustomizationCapabilities().then((value) => {
      if (!cancelled) setData(value)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return data
}
