import { createClient } from '@supabase/supabase-js'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveredContainerCard } from '../../src/components/DeliveredContainerCard'
import { listPublishedRegistryContainers } from '../../src/lib/delivered-containers/repository'
import type { Database } from '../../src/lib/supabase/types'
export async function readRegistry() {
  const url = process.env.VITE_SUPABASE_URL,
    key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Public configuration missing')
  const client = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  const containers = await listPublishedRegistryContainers(client)
  const { data: reports, error } = await client
    .from('quality_reports')
    .select('container_id')
    .eq('organization', 'sgs')
    .eq('report_type', 'pre_shipment_inspection')
    .eq('is_active', true)
    .not('published_at', 'is', null)
    .not('file_path', 'is', null)
  const sgsIds = error ? [] : (reports || []).map((r) => r.container_id)
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
