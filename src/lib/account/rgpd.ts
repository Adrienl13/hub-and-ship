// Narrow client surface for the RGPD self-service RPCs (export / erasure).
// The browser Supabase client is not generic-typed here (see
// reservations/repository.ts), so we type just what we call and cast.

interface RpcResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface RgpdClient {
  rpc: {
    (fn: 'export_my_account_data'): PromiseLike<RpcResult<unknown>>
    (fn: 'delete_my_account'): PromiseLike<RpcResult<unknown>>
  }
}

export async function exportMyAccountData(
  client: RgpdClient,
): Promise<unknown> {
  const { data, error } = await client.rpc('export_my_account_data')
  if (error) throw new Error(error.message)
  return data
}

export async function deleteMyAccount(client: RgpdClient): Promise<void> {
  const { error } = await client.rpc('delete_my_account')
  if (error) throw new Error(error.message)
}

/** Triggers a browser download of `data` as a pretty-printed JSON file. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
