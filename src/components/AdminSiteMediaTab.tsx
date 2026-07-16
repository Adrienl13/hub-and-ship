import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DEFAULT_SITE_MEDIA, type SiteMediaSlot } from '@/lib/site-media'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Onglet « Médias » : photos administrables de la page d'accueil (handoff
// design 07/2026). Upload dans le bucket public `catalogue-images` (préfixe
// site/), métadonnées dans public.site_media. Tant qu'un slot est vide, le
// site affiche les visuels par défaut embarqués — indiqué à l'admin.

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const SLOTS: ReadonlyArray<{
  readonly slot: SiteMediaSlot
  readonly label: string
  readonly hint: string
  readonly multi: boolean
}> = [
  {
    slot: 'hero',
    label: 'Slides du hero (carrousel)',
    hint: '~1600×1400, cadrage cover. Le carrousel s’adapte au nombre de slides (ordre modifiable).',
    multi: true,
  },
  {
    slot: 'collections',
    label: 'Section gammes (grande photo)',
    hint: '~1200×1000, cadrage cover. Illustre la gamme Cordage & tressage.',
    multi: false,
  },
  {
    slot: 'clientele-band',
    label: 'Bandeau clientèle (pleine largeur)',
    hint: '≥2400 px de large, cadrage cover.',
    multi: false,
  },
]

interface MediaRow {
  readonly id: string
  readonly slot: string
  readonly url: string
  readonly alt: string
  readonly sort_order: number
}

interface SiteMediaClient {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: { upsert: boolean; contentType: string },
      ) => Promise<{ error: { message: string } | null }>
      getPublicUrl: (path: string) => {
        data: { publicUrl: string }
      }
    }
  }
  from: (table: 'site_media') => {
    select: (columns: '*') => {
      order: (
        column: 'sort_order',
        options: { ascending: boolean },
      ) => PromiseLike<{
        data: MediaRow[] | null
        error: { message: string } | null
      }>
    }
    insert: (payload: {
      slot: string
      url: string
      alt: string
      sort_order: number
    }) => PromiseLike<{ error: { message: string } | null }>
    update: (payload: Partial<Pick<MediaRow, 'alt' | 'sort_order'>>) => {
      eq: (
        column: 'id',
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>
    }
    delete: () => {
      eq: (
        column: 'id',
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

function getClient(): SiteMediaClient | null {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return null
  return createSupabaseBrowserClient(config) as unknown as SiteMediaClient
}

export function AdminSiteMediaTab() {
  const [rows, setRows] = useState<MediaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busySlot, setBusySlot] = useState<SiteMediaSlot | null>(null)
  const inputRefs = useRef<Partial<Record<SiteMediaSlot, HTMLInputElement>>>(
    {},
  )

  const refresh = async () => {
    const client = getClient()
    if (!client) {
      setLoading(false)
      return
    }
    const { data, error } = await client
      .from('site_media')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) toast.error('Chargement des médias échoué : ' + error.message)
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleUpload(slot: SiteMediaSlot, file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Format non accepté (JPEG, PNG, WebP ou AVIF).')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('Image trop lourde (max 5 Mo).')
      return
    }
    const client = getClient()
    if (!client) return
    setBusySlot(slot)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'webp'
      const path = `site/${slot}-${crypto.randomUUID()}.${extension}`
      const upload = await client.storage
        .from('catalogue-images')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upload.error) {
        toast.error('Upload échoué : ' + upload.error.message)
        return
      }
      const { publicUrl } = client.storage
        .from('catalogue-images')
        .getPublicUrl(path).data

      const slotRows = rows.filter((r) => r.slot === slot)
      // Slots simples : remplacer = supprimer l'existant d'abord.
      const isMulti = SLOTS.find((s) => s.slot === slot)?.multi ?? false
      if (!isMulti) {
        for (const row of slotRows) {
          await client.from('site_media').delete().eq('id', row.id)
        }
      }
      const nextOrder = isMulti
        ? Math.max(0, ...slotRows.map((r) => r.sort_order + 1))
        : 0
      const insert = await client.from('site_media').insert({
        slot,
        url: publicUrl,
        alt: '',
        sort_order: nextOrder,
      })
      if (insert.error) {
        toast.error('Enregistrement échoué : ' + insert.error.message)
        return
      }
      toast.success('Image en ligne — la home l’affiche immédiatement.')
      await refresh()
    } finally {
      setBusySlot(null)
      const input = inputRefs.current[slot]
      if (input) input.value = ''
    }
  }

  async function handleDelete(row: MediaRow) {
    const client = getClient()
    if (!client) return
    const { error } = await client.from('site_media').delete().eq('id', row.id)
    if (error) {
      toast.error('Suppression échouée : ' + error.message)
      return
    }
    toast.success('Image retirée — retour au visuel par défaut si slot vide.')
    await refresh()
  }

  async function handleAlt(row: MediaRow, alt: string) {
    const client = getClient()
    if (!client) return
    const { error } = await client
      .from('site_media')
      .update({ alt })
      .eq('id', row.id)
    if (error) toast.error('Alt non enregistré : ' + error.message)
  }

  async function handleMove(row: MediaRow, direction: -1 | 1) {
    const client = getClient()
    if (!client) return
    const siblings = rows
      .filter((r) => r.slot === row.slot)
      .sort((a, b) => a.sort_order - b.sort_order)
    const index = siblings.findIndex((r) => r.id === row.id)
    const swapWith = siblings[index + direction]
    if (!swapWith) return
    await client
      .from('site_media')
      .update({ sort_order: swapWith.sort_order })
      .eq('id', row.id)
    await client
      .from('site_media')
      .update({ sort_order: row.sort_order })
      .eq('id', swapWith.id)
    await refresh()
  }

  if (loading) {
    return (
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
        Chargement des médias…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
        <h2 className="font-display text-lg font-semibold">
          Photos de la page d&apos;accueil
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Chaque emplacement vide affiche le visuel par défaut livré avec le
          design. Les images uploadées sont publiques (bucket
          catalogue-images/site).
        </p>
      </div>

      {SLOTS.map(({ slot, label, hint, multi }) => {
        const slotRows = rows
          .filter((r) => r.slot === slot)
          .sort((a, b) => a.sort_order - b.sort_order)
        const usingDefaults = slotRows.length === 0
        const defaults =
          slot === 'hero'
            ? DEFAULT_SITE_MEDIA.hero
            : slot === 'collections'
              ? [DEFAULT_SITE_MEDIA.collections]
              : [DEFAULT_SITE_MEDIA.clienteleBand]

        return (
          <section
            key={slot}
            className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  {label}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
              </div>
              <div>
                <input
                  ref={(el) => {
                    if (el) inputRefs.current[slot] = el
                  }}
                  type="file"
                  accept={ACCEPTED.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void handleUpload(slot, file)
                  }}
                />
                <Button
                  size="sm"
                  disabled={busySlot === slot}
                  onClick={() => inputRefs.current[slot]?.click()}
                  className="gap-1.5 rounded-sm"
                >
                  <ImagePlus className="h-4 w-4" />
                  {busySlot === slot
                    ? 'Envoi…'
                    : multi
                      ? 'Ajouter une slide'
                      : slotRows.length > 0
                        ? 'Remplacer'
                        : 'Uploader'}
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {(usingDefaults ? defaults : slotRows).map((item, index) => {
                const isDefault = usingDefaults
                const url = 'url' in item ? item.url : ''
                return (
                  <div
                    key={isDefault ? `d-${index}` : (item as MediaRow).id}
                    className="overflow-hidden rounded-md border border-[color:var(--sand-deep)]"
                  >
                    <div className="relative h-28 bg-[color:var(--sand-soft)]">
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      {isDefault && (
                        <span className="absolute left-1.5 top-1.5 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Par défaut
                        </span>
                      )}
                    </div>
                    {!isDefault && (
                      <div className="space-y-1.5 p-2">
                        <input
                          type="text"
                          defaultValue={(item as MediaRow).alt}
                          placeholder="Texte alternatif (accessibilité)"
                          onBlur={(e) =>
                            void handleAlt(item as MediaRow, e.target.value)
                          }
                          className="h-8 w-full rounded-sm border border-[color:var(--sand-deep)] bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
                        />
                        <div className="flex items-center justify-between">
                          {multi ? (
                            <div className="flex gap-1">
                              <button
                                type="button"
                                aria-label="Monter"
                                onClick={() =>
                                  void handleMove(item as MediaRow, -1)
                                }
                                className="rounded-sm border border-[color:var(--sand-deep)] p-1 hover:bg-[color:var(--sand-soft)]"
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Descendre"
                                onClick={() =>
                                  void handleMove(item as MediaRow, 1)
                                }
                                className="rounded-sm border border-[color:var(--sand-deep)] p-1 hover:bg-[color:var(--sand-soft)]"
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            aria-label="Supprimer"
                            onClick={() => void handleDelete(item as MediaRow)}
                            className="rounded-sm border border-[color:var(--sand-deep)] p-1 text-[color:var(--destructive)] hover:bg-[color:var(--sand-soft)]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
