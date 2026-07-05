// Typed access to the "notify me about the next container" lead capture RPCs.

interface RpcResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface NotifyLead {
  readonly id: string
  readonly email: string
  readonly source: string | null
  readonly createdAt: string
}

export interface NotifySubscribeClient {
  rpc: (
    fn: 'subscribe_container_notification',
    args: { p_email: string; p_source: string },
  ) => PromiseLike<RpcResult<unknown>>
}

export interface NotifyAdminClient {
  rpc: (fn: 'admin_list_notify_leads') => PromiseLike<RpcResult<unknown>>
}

export async function subscribeContainerNotification(
  client: NotifySubscribeClient,
  email: string,
  source: string,
): Promise<void> {
  const { error } = await client.rpc('subscribe_container_notification', {
    p_email: email,
    p_source: source,
  })
  if (error) throw new Error(error.message)
}

function leadFromRow(value: unknown): NotifyLead {
  const row =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {}
  return {
    id: String(row.id ?? ''),
    email: String(row.email ?? ''),
    source: typeof row.source === 'string' ? row.source : null,
    createdAt: String(row.created_at ?? ''),
  }
}

export async function adminListNotifyLeads(
  client: NotifyAdminClient,
): Promise<ReadonlyArray<NotifyLead>> {
  const { data, error } = await client.rpc('admin_list_notify_leads')
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data.map(leadFromRow) : []
}
