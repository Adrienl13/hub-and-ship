import { AdminStudioCompatibility } from './AdminStudioCompatibility'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  fetchStudioCatalog,
  type StudioDbClient,
} from '@/lib/studio/repository'
import { isDiscoverySeat } from '@/lib/studio/discovery'
import { V1_MODEL_VERSION } from '@/lib/studio/engine/versions'

type Row = Record<string, unknown>
type Result = { data: Row[]; error: { message: string } | null }
interface Query extends PromiseLike<Result> {
  range(from: number, to: number): Query
  eq(column: string, value: string): Query
}
export interface AdminClient {
  auth: ReturnType<typeof createSupabaseBrowserClient>['auth']
  from(table: string): {
    select(columns: string): Query
    update(values: Row): Query
    insert(values: Row): Query
  }
  rpc(name: string, args: Row): PromiseLike<Result>
}
const button = 'min-h-[44px] rounded border px-3 disabled:opacity-40'
const fields = {
  products:
    'id,name,main_image_url,is_active,sku,dim_length_cm,dim_width_cm,dim_height_cm,weight_kg,base_price_ht',
  studio_product_profiles:
    'product_id,studio_role,material,seat_kind,visual_traits,data_quality',
  studio_product_media:
    'id,product_id,role,url,source_url,source_hash,quality_score,status,pipeline_version,validated_at',
  studio_product_visual_features: 'product_id,model_version,source_media_id',
  studio_product_neighbors: 'product_id,rank,model_version',
  studio_model_family_candidates:
    'id,product_a_id,product_b_id,similarity,evidence,status',
  studio_visual_jobs: 'id,product_id,status,error,created_at',
} as const

/** Existing AdminGuard + database RLS authorize every action. No service key,
 * inference or bulk publishing in the browser. Explicit human validation only. */
export function AdminStudioTab() {
  const client = useMemo(
    () =>
      createSupabaseBrowserClient(
        getSupabasePublicConfig(),
      ) as unknown as AdminClient,
    [],
  )
  const [data, setData] = useState<Record<string, Row[]>>({})
  const [readyIds, setReadyIds] = useState<ReadonlySet<unknown>>(new Set())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [labels, setLabels] = useState<Record<string, string>>({})
  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(fields).map(async ([table, select]) => {
        const all: Row[] = []
        for (let offset = 0; ; offset += 500) {
          const result = await client
            .from(table)
            .select(select)
            .range(offset, offset + 499)
          if (result.error) throw new Error(result.error.message)
          all.push(...(result.data as unknown as Row[]))
          if (result.data.length < 500) break
        }
        return [table, all] as const
      }),
    )
    const catalog = await fetchStudioCatalog(
      client as unknown as StudioDbClient,
    )
    setReadyIds(
      new Set(catalog.products.filter(isDiscoverySeat).map((p) => p.id)),
    )
    setData(Object.fromEntries(entries))
  }, [client])
  useEffect(() => {
    void refresh().catch((e: Error) => setError(e.message))
  }, [refresh])
  async function act(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      if (result.error) throw new Error(result.error.message)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }
  const products = data.products ?? []
  const profiles = data.studio_product_profiles ?? []
  const media = data.studio_product_media ?? []
  const features = (data.studio_product_visual_features ?? []).filter(
    (f) => f.model_version === V1_MODEL_VERSION,
  )
  const name = (id: unknown) =>
    String(products.find((p) => p.id === id)?.name ?? id)
  const photo = (id: unknown) =>
    String(products.find((p) => p.id === id)?.main_image_url ?? '')
  function exportManifest() {
    const manifest = {
      products: products.map((p) => {
        const profile = profiles.find((r) => r.product_id === p.id)
        const image = [...media]
          .sort(
            (a, b) =>
              String(b.validated_at).localeCompare(String(a.validated_at)) ||
              String(a.id).localeCompare(String(b.id)),
          )
          .find(
            (m) =>
              m.product_id === p.id &&
              m.role === 'decision' &&
              m.status === 'validated',
          )
        return {
          product_id: p.id,
          is_active: p.is_active,
          discovery_ready: readyIds.has(p.id),
          material: profile?.material,
          seat_kind: profile?.seat_kind,
          visual_traits:
            (profile?.visual_traits as Row | null)?.source_hash ===
              image?.source_hash &&
            (profile?.visual_traits as Row | null)?.version ===
              image?.pipeline_version
              ? profile?.visual_traits
              : {},
          media_id: image?.id,
          media_status: image?.status,
          media_url: image?.url,
          quality_score: image?.quality_score,
          dimensions: {
            l: p.dim_length_cm,
            w: p.dim_width_cm,
            h: p.dim_height_cm,
          },
          weightKg: p.weight_kg,
          basePriceHt: p.base_price_ht,
          sku: p.sku,
        }
      }),
    }
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(manifest, null, 2)], {
        type: 'application/json',
      }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'studio-offline-manifest.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Studio — données visuelles</h2>
      <p>
        Les images et familles restent en attente jusqu’à votre validation. Les
        relances sont traitées par le pipeline local.
      </p>
      {error && <p role="alert">{error}</p>}
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Object.entries({
          'Assises qualifiées (profils)': readyIds.size,
          'Decision Images': new Set(
            media.filter((m) => m.role === 'decision').map((m) => m.product_id),
          ).size,
          'Images validées': new Set(
            media
              .filter((m) => m.role === 'decision' && m.status === 'validated')
              .map((m) => m.product_id),
          ).size,
          'Traits calculés': profiles.filter(
            (p) =>
              p.visual_traits && Object.keys(p.visual_traits as Row).length > 0,
          ).length,
          'Embeddings V1': features.length,
          '12 voisins V1': (data.studio_product_neighbors ?? []).filter(
            (n) => n.rank === 12 && n.model_version === V1_MODEL_VERSION,
          ).length,
          'Erreurs pipeline': (data.studio_visual_jobs ?? []).filter(
            (j) => j.status === 'error',
          ).length,
        }).map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="font-semibold">{count}</dd>
          </div>
        ))}
      </dl>
      <button className={button} onClick={exportManifest}>
        Exporter le manifeste hors ligne
      </button>
      <section aria-label="Decision Images" className="space-y-4">
        <h3 className="font-semibold">Decision Images</h3>
        {media
          .filter((m) => m.role === 'decision')
          .map((m) => (
            <article key={String(m.id)} className="rounded border p-4">
              <h4>
                {name(m.product_id)} — {String(m.status)}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <img
                  className="aspect-square w-full object-contain"
                  src={String(m.source_url)}
                  alt="Source"
                  loading="lazy"
                />
                <img
                  className="aspect-square w-full object-contain"
                  src={String(m.url)}
                  alt="Decision Image normalisée"
                  loading="lazy"
                />
              </div>
              <p>
                Qualité technique : {Number(m.quality_score).toFixed(2)} —{' '}
                {String(m.pipeline_version)}
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy || m.status === 'validated'}
                  onClick={() =>
                    void act(async () => {
                      const { data: auth } = await client.auth.getUser()
                      if (!auth.user) throw new Error('Connexion admin requise')
                      return client
                        .from('studio_product_media')
                        .update({
                          status: 'validated',
                          validated_by: auth.user.id,
                          validated_at: new Date().toISOString(),
                          rejected_reason: null,
                        })
                        .eq('product_id', m.product_id as string)
                        .eq('source_hash', m.source_hash as string)
                        .eq('pipeline_version', m.pipeline_version as string)
                    })
                  }
                >
                  Valider l’image et sa vignette
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      client
                        .from('studio_product_media')
                        .update({
                          status: 'rejected',
                          validated_by: null,
                          validated_at: null,
                          rejected_reason: 'Rejet après revue visuelle admin',
                        })
                        .eq('product_id', m.product_id as string)
                        .eq('source_hash', m.source_hash as string)
                        .eq('pipeline_version', m.pipeline_version as string),
                    )
                  }
                >
                  Rejeter
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      client
                        .from('studio_visual_jobs')
                        .insert({ product_id: m.product_id }),
                    )
                  }
                >
                  Relancer hors ligne
                </button>
              </div>
            </article>
          ))}
        {!media.length && (
          <p>
            Aucune image préparée. Produire les fichiers avec le mode --role
            decision puis importer le manifeste local après revue.
          </p>
        )}
      </section>
      <section aria-label="Familles candidates" className="space-y-4">
        <h3 className="font-semibold">Familles candidates</h3>
        {(data.studio_model_family_candidates ?? [])
          .filter((c) => c.status === 'candidate')
          .map((c) => (
            <article key={String(c.id)} className="rounded border p-4">
              <div className="grid grid-cols-2 gap-3">
                {[c.product_a_id, c.product_b_id].map((id) => (
                  <figure key={String(id)}>
                    <img
                      className="aspect-square w-full object-contain"
                      src={photo(id)}
                      alt={name(id)}
                      loading="lazy"
                    />
                    <figcaption>{name(id)}</figcaption>
                  </figure>
                ))}
              </div>
              <p>
                Similarité pipeline : {Number(c.similarity).toFixed(3)}. La
                proximité visuelle ne prouve pas l’identité commerciale.
              </p>
              <pre className="max-w-full overflow-auto text-xs">
                {JSON.stringify(c.evidence, null, 2)}
              </pre>
              <label className="block">
                Libellé de famille vérifié
                <input
                  className="block min-h-[44px] w-full rounded border px-3"
                  maxLength={120}
                  value={labels[String(c.id)] ?? ''}
                  onChange={(e) =>
                    setLabels({ ...labels, [String(c.id)]: e.target.value })
                  }
                />
              </label>
              <div className="mt-3 flex gap-3">
                <button
                  className={button}
                  disabled={busy || !labels[String(c.id)]?.trim()}
                  onClick={() =>
                    void act(() =>
                      client.rpc('studio_review_family', {
                        candidate_id: c.id,
                        accept: true,
                        family_label: labels[String(c.id)],
                      }),
                    )
                  }
                >
                  Accepter et vérifier
                </button>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void act(() =>
                      client.rpc('studio_review_family', {
                        candidate_id: c.id,
                        accept: false,
                      }),
                    )
                  }
                >
                  Refuser
                </button>
              </div>
            </article>
          ))}
      </section>
      <section aria-label="Travaux hors ligne">
        <h3 className="font-semibold">Travaux hors ligne</h3>
        {(data.studio_visual_jobs ?? []).map((j) => (
          <p key={String(j.id)}>
            {name(j.product_id)} : {String(j.status)} {String(j.error ?? '')}
          </p>
        ))}
      </section>
      <AdminStudioCompatibility client={client} />
    </div>
  )
}
