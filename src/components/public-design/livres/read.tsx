import { createSupabaseServerClient } from '@/lib/supabase/server'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveredContainerCard } from '@/components/DeliveredContainerCard'
import { listPublishedRegistryContainers } from '@/lib/delivered-containers/repository'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
export async function readRegistry() {
  const { url, anonKey: key } = getSupabasePublicConfig()
  if (!url || !key) throw new Error('Public configuration missing')
  const client = createSupabaseServerClient({ cookies: { getAll: () => [] } })
  const containers = await listPublishedRegistryContainers(client)
  const { data: reports, error } = await client
    .from('quality_reports')
    .select('container_id')
    .eq('organization', 'sgs')
    .eq('report_type', 'pre_shipment_inspection')
    .eq('is_active', true)
    .not('published_at', 'is', null)
    .not('file_path', 'is', null)
  const sgsIds = error
    ? []
    : ((reports || []) as ReadonlyArray<{ container_id: string | null }>).map(
        (r) => r.container_id,
      )
  const latest = containers.find((c) => c.status === 'delivered')?.id
  return {
    containers,
    sgsIds,
    cards: containers.map((container, i) => ({
      id: container.id,
      html: renderToStaticMarkup(
        <DeliveredContainerCard
          container={container}
          registry={{
            hasSgs: sgsIds.includes(container.id),
            latestDelivered: container.id === latest,
            sequence: containers.length - i,
          }}
        />,
      ),
    })),
  }
}
