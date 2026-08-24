import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { normalizePackshotFile } from '@/lib/images/normalize-packshot'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Normalisation RÉTROACTIVE des packshots : les photos uploadées avant la
// mise en place de la normalisation automatique (S13) ont des cadres blancs
// inégaux. Ce bouton repasse toutes les photos produits/designs déjà en
// storage dans la même moulinette (recadrage + canevas carré blanc, marge
// constante) et remplace les URLs en base. Les photos d'ambiance (coins non
// blancs) et les images hors storage (repo, externes) sont ignorées.

const BUCKET = 'catalogue-images'
const STORAGE_MARKER = `/storage/v1/object/public/${BUCKET}/`

interface NormalizeReport {
  scanned: number
  normalized: number
  skipped: number
  failed: number
}

function isOwnStorageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.includes(STORAGE_MARKER)
}

async function normalizeStoredImage(
  client: ReturnType<typeof createSupabaseBrowserClient>,
  url: string,
  folder: string,
): Promise<{ status: 'normalized'; url: string } | { status: 'skipped' | 'failed' }> {
  try {
    const response = await fetch(url)
    if (!response.ok) return { status: 'failed' }
    const blob = await response.blob()
    const name = url.slice(url.lastIndexOf('/') + 1) || 'photo.jpg'
    const original = new File([blob], name, {
      type: blob.type || 'image/jpeg',
    })
    const normalized = await normalizePackshotFile(original)
    // Identité stricte = pass-through (photo d'ambiance ou échec silencieux).
    if (normalized === original) return { status: 'skipped' }

    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
    const { error } = await client.storage
      .from(BUCKET)
      .upload(path, normalized, { contentType: normalized.type, upsert: false })
    if (error) return { status: 'failed' }
    const { data } = client.storage.from(BUCKET).getPublicUrl(path)
    return { status: 'normalized', url: data.publicUrl }
  } catch {
    return { status: 'failed' }
  }
}

async function runBatch(
  onProgress: (message: string) => void,
): Promise<NormalizeReport> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) throw new Error('Supabase non configuré.')
  const client = createSupabaseBrowserClient(config)

  const report: NormalizeReport = {
    scanned: 0,
    normalized: 0,
    skipped: 0,
    failed: 0,
  }

  // 1. Photos principales + galeries produits.
  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, main_image_url, gallery_urls')
  if (productsError) throw new Error(productsError.message)

  // 2. Photos + galeries des designs.
  const { data: variants, error: variantsError } = await client
    .from('product_variants')
    .select('id, image_url, gallery_urls')
  if (variantsError) throw new Error(variantsError.message)

  type ProductRow = {
    id: string
    main_image_url: string | null
    gallery_urls: string[] | null
  }
  type VariantRow = {
    id: string
    image_url: string | null
    gallery_urls: string[] | null
  }

  const productRows = (products ?? []) as ProductRow[]
  const variantRows = (variants ?? []) as VariantRow[]
  const total =
    productRows.filter((row) => isOwnStorageUrl(row.main_image_url)).length +
    variantRows.filter((row) => isOwnStorageUrl(row.image_url)).length

  let done = 0
  const step = () => {
    done += 1
    onProgress(`Photo ${done}/${total}…`)
  }

  for (const row of productRows) {
    if (isOwnStorageUrl(row.main_image_url)) {
      report.scanned += 1
      step()
      const result = await normalizeStoredImage(
        client,
        row.main_image_url,
        'products',
      )
      if (result.status === 'normalized') {
        const { error } = await client
          .from('products')
          .update({ main_image_url: result.url } as never)
          .eq('id', row.id)
        if (error) report.failed += 1
        else report.normalized += 1
      } else if (result.status === 'skipped') report.skipped += 1
      else report.failed += 1
    }
  }

  for (const row of variantRows) {
    if (isOwnStorageUrl(row.image_url)) {
      report.scanned += 1
      step()
      const result = await normalizeStoredImage(
        client,
        row.image_url,
        'designs',
      )
      if (result.status === 'normalized') {
        const { error } = await client
          .from('product_variants')
          .update({ image_url: result.url } as never)
          .eq('id', row.id)
        if (error) report.failed += 1
        else report.normalized += 1
      } else if (result.status === 'skipped') report.skipped += 1
      else report.failed += 1
    }
  }

  return report
}

export function AdminPackshotBatchNormalizer({
  onDone,
}: {
  readonly onDone?: () => void | Promise<void>
}) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')

  async function handleClick(): Promise<void> {
    const confirmed = window.confirm(
      'Normaliser toutes les photos produits et designs déjà en ligne ?\n\n' +
        'Chaque packshot fond blanc est recadré puis recentré sur un canevas ' +
        'carré blanc uniforme. Les photos d’ambiance ne sont pas touchées. ' +
        'L’opération peut prendre quelques minutes.',
    )
    if (!confirmed) return
    setRunning(true)
    setProgress('Analyse du catalogue…')
    try {
      const report = await runBatch(setProgress)
      toast.success('Normalisation terminée', {
        description: `${report.normalized} photo(s) normalisée(s), ${report.skipped} déjà propre(s)/ambiance, ${report.failed} échec(s).`,
      })
      await onDone?.()
    } catch (error) {
      toast.error('Normalisation interrompue', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      })
    }
    setRunning(false)
    setProgress('')
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 gap-1.5 rounded-sm"
      disabled={running}
      onClick={() => void handleClick()}
      title="Recadre et uniformise le fond blanc de toutes les photos produits/designs déjà uploadées"
    >
      <Wand2 className="h-3.5 w-3.5" />
      {running ? progress || 'Normalisation…' : 'Normaliser les photos'}
    </Button>
  )
}
