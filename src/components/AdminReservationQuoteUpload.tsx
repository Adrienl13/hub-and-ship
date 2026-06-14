import { useRef, useState } from 'react'
import { Check, FileUp } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

interface QuoteUploadClient {
  storage: {
    from: (bucket: 'reservation-quotes') => {
      upload: (
        path: string,
        file: File,
        options: { upsert: boolean; contentType: string },
      ) => PromiseLike<{ error: { message: string } | null }>
    }
  }
  from: (table: 'reservations') => {
    update: (values: { quote_pdf_path: string }) => {
      eq: (
        column: 'id',
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

const MAX_BYTES = 10 * 1024 * 1024

/**
 * Admin-only control to attach the official quote PDF (Qonto + CGV) to a
 * reservation. Uploads to the private `reservation-quotes` bucket and records
 * the path; the client then downloads it via a signed URL (quote-access.ts).
 */
export function AdminReservationQuoteUpload({
  reservationId,
  hasQuote = false,
}: {
  readonly reservationId: string
  readonly hasQuote?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(hasQuote)

  async function handleFile(file: File): Promise<void> {
    if (file.type !== 'application/pdf') {
      toast.error('Le devis doit être un fichier PDF.')
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error('PDF trop lourd (max 10 Mo).')
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setBusy(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as QuoteUploadClient
      const path = `quotes/${reservationId}.pdf`
      const upload = await client.storage
        .from('reservation-quotes')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (upload.error) {
        toast.error('Upload échoué : ' + upload.error.message)
        return
      }
      const update = await client
        .from('reservations')
        .update({ quote_pdf_path: path })
        .eq('id', reservationId)
      if (update.error) {
        toast.error('Enregistrement échoué : ' + update.error.message)
        return
      }
      setDone(true)
      toast.success('Devis officiel déposé.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="h-7 gap-1 rounded-sm px-2 text-[11px]"
      >
        {done ? (
          <Check className="h-3 w-3 text-[color:var(--forest)]" />
        ) : (
          <FileUp className="h-3 w-3" />
        )}
        {busy ? '…' : done ? 'Devis ✓' : 'Devis'}
      </Button>
    </>
  )
}
