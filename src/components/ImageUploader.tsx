// Image upload helpers for the admin editors.
//
// The catalogue bucket (`catalogue-images`) is public-read and admin-write
// (cf. migration 20260530180000). We upload the file directly from the
// browser using the authenticated session — RLS gates the write — and
// then store the *public URL* in the DB (no per-render signed URL needed,
// since `/catalogue` and `/livres` are served to anonymous visitors).
//
// Two variants:
//   - <ImageUploader value onChange />        single image
//   - <ImageGalleryUploader values onChange /> N images, drag-free reorder
//     via add/remove (kept simple to match the rest of the admin UI).

import { ImageOff, Plus, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const BUCKET = 'catalogue-images'
const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function extensionFor(file: File): string {
  // Trust the mime type rather than the filename (admins often paste
  // screenshots with weird extensions). Fall back to "bin" so the upload
  // still succeeds even if Supabase rejects an unknown type.
  switch (file.type) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/avif':
      return 'avif'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

function buildObjectPath(folder: string, file: File): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  return `${folder}/${ts}-${rand}.${extensionFor(file)}`
}

async function uploadImage(
  folder: string,
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ACCEPT_MIME.includes(file.type)) {
    return {
      ok: false,
      error: 'Format non supporté (jpg, png, webp, avif, gif).',
    }
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Fichier trop volumineux (${formatBytes(file.size)} > 5 MB).`,
    }
  }
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) {
    return { ok: false, error: 'Supabase non configuré.' }
  }
  const client = createSupabaseBrowserClient(config)
  const path = buildObjectPath(folder, file)
  const { error } = await client.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return { ok: false, error: error.message }
  const { data } = client.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

async function deleteByPublicUrl(url: string): Promise<void> {
  // Best-effort: only attempt removal if the URL belongs to our bucket;
  // anything else (e.g. an Unsplash placeholder URL from the old fixtures)
  // is left untouched.
  const marker = `/storage/v1/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = url.slice(idx + marker.length)
  if (!path) return
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return
  const client = createSupabaseBrowserClient(config)
  await client.storage.from(BUCKET).remove([path])
}

export interface ImageUploaderProps {
  /** Current image URL (may be empty in create mode). */
  readonly value: string
  /** Receives the new URL after a successful upload, or '' on remove. */
  readonly onChange: (url: string) => void
  /** Folder inside the bucket, e.g. "products" or "containers". */
  readonly folder: string
  /** Optional helper text under the field. */
  readonly hint?: string
}

export function ImageUploader({
  value,
  onChange,
  folder,
  hint,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePick(file: File): Promise<void> {
    setError(null)
    setUploading(true)
    const previous = value
    try {
      const result = await uploadImage(folder, file)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onChange(result.url)
      if (previous && previous !== result.url) {
        void deleteByPublicUrl(previous)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'erreur inconnue')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(): Promise<void> {
    const previous = value
    onChange('')
    if (previous) {
      await deleteByPublicUrl(previous)
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt=""
            className="ring-foreground/15 h-20 w-20 rounded-sm object-cover ring-1"
          />
          <div className="flex flex-1 flex-col gap-2">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-sm"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Upload…' : 'Remplacer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-sm text-red-700 hover:bg-red-50"
                disabled={uploading}
                onClick={() => void handleRemove()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Retirer
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2 border-dashed"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Upload en cours…' : 'Choisir une image'}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_MIME.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (e.target) e.target.value = ''
          if (file) void handlePick(file)
        }}
      />
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      {hint && !error && (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

export interface ImageGalleryUploaderProps {
  readonly values: ReadonlyArray<string>
  readonly onChange: (next: string[]) => void
  readonly folder: string
}

export function ImageGalleryUploader({
  values,
  onChange,
  folder,
}: ImageGalleryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(files: File[]): Promise<void> {
    setError(null)
    setUploading(true)
    const next = [...values]
    const failures: string[] = []
    try {
      for (const file of files) {
        try {
          const result = await uploadImage(folder, file)
          if (result.ok) {
            next.push(result.url)
          } else {
            failures.push(`${file.name}: ${result.error}`)
          }
        } catch (err) {
          failures.push(
            `${file.name}: ${err instanceof Error ? err.message : 'erreur inconnue'}`,
          )
        }
      }
      if (next.length !== values.length) {
        onChange(next)
      }
      if (failures.length > 0) {
        setError(failures.join(' · '))
      }
    } finally {
      // Never leave `uploading` stuck: an exception here would freeze the
      // "+" button until the page is reloaded.
      setUploading(false)
    }
  }

  async function handleRemove(index: number): Promise<void> {
    const url = values[index]
    const next = values.filter((_, i) => i !== index)
    onChange([...next])
    if (url) await deleteByPublicUrl(url)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {values.map((url, i) => (
          <div
            key={`${url}-${i}`}
            className="ring-foreground/15 group relative aspect-square overflow-hidden rounded-sm ring-1"
          >
            {url ? (
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[color:var(--sand-soft)]">
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleRemove(i)}
              aria-label="Retirer cette image"
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/75 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="ring-foreground/10 hover:bg-[color:var(--sand-deep)]/40 flex aspect-square items-center justify-center rounded-sm border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_MIME.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          // Snapshot the File objects into a plain array *before* resetting
          // the input. `e.target.files` is a live FileList tied to the input,
          // so clearing `value` first would empty it and handleAdd would
          // receive zero files (cf. the single-file picker, which extracts
          // the File up-front for the same reason).
          const files = e.target.files ? Array.from(e.target.files) : []
          if (e.target) e.target.value = ''
          if (files.length > 0) void handleAdd(files)
        }}
      />
      {error && <p className="text-[11px] text-red-700">{error}</p>}
      <p className="text-[10px] text-muted-foreground">
        {uploading
          ? 'Upload en cours…'
          : `${values.length} image${values.length > 1 ? 's' : ''} · jpg / png / webp / avif / gif, 5 MB max`}
      </p>
    </div>
  )
}
