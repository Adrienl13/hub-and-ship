import { useEffect, useState } from 'react'
import {
  loadVisualLibrary,
  type VisualLibraryData,
} from '@/lib/studio/visual-library-repository'
export function useStudioVisualLibrary() {
  const [data, setData] = useState<VisualLibraryData>({
    items: [],
    associations: [],
    source: 'unavailable',
  })
  useEffect(() => {
    let done = false
    void loadVisualLibrary().then((d) => {
      if (!done) setData(d)
    })
    return () => {
      done = true
    }
  }, [])
  return data
}
