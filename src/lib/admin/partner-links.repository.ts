// Admin management of partner_users links (which auth user is attached to which
// approved partner application). RLS ("Admins manage partner links") restricts
// these to admins. partner_users is not in the generated Database types, so we
// use a narrow typed view of the browser client.

interface Result<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface PartnerUserRaw {
  readonly user_id: string
  readonly partner_application_id: string
  readonly role: string
  readonly partner_applications?:
    | { readonly company_name?: string }
    | Array<{ readonly company_name?: string }>
    | null
}

interface ApplicationRaw {
  readonly id: string
  readonly company_name: string
  readonly status: string
}

export interface PartnerLink {
  readonly userId: string
  readonly applicationId: string
  readonly role: string
  readonly companyName: string
}

export interface LinkableApplication {
  readonly id: string
  readonly companyName: string
}

export interface PartnerLinksClient {
  from: {
    (table: 'partner_users'): {
      select: (columns: string) => PromiseLike<Result<ReadonlyArray<PartnerUserRaw>>>
      insert: (payload: unknown) => PromiseLike<Result<null>>
      delete: () => {
        eq: (
          column: 'user_id',
          value: string,
        ) => {
          eq: (
            column: 'partner_application_id',
            value: string,
          ) => PromiseLike<Result<null>>
        }
      }
    }
    (table: 'partner_applications'): {
      select: (columns: string) => {
        in: (
          column: 'status',
          values: ReadonlyArray<string>,
        ) => {
          order: (
            column: 'company_name',
            options: { readonly ascending: boolean },
          ) => PromiseLike<Result<ReadonlyArray<ApplicationRaw>>>
        }
      }
    }
  }
}

function companyName(row: PartnerUserRaw): string {
  const rel = row.partner_applications
  const obj = Array.isArray(rel) ? rel[0] : rel
  return obj?.company_name ?? '—'
}

export async function listPartnerLinks(
  client: PartnerLinksClient,
): Promise<ReadonlyArray<PartnerLink>> {
  const { data, error } = await client
    .from('partner_users')
    .select('user_id, partner_application_id, role, partner_applications(company_name)')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    applicationId: row.partner_application_id,
    role: row.role,
    companyName: companyName(row),
  }))
}

export async function listLinkableApplications(
  client: PartnerLinksClient,
): Promise<ReadonlyArray<LinkableApplication>> {
  const { data, error } = await client
    .from('partner_applications')
    .select('id, company_name, status')
    .in('status', ['qualified', 'approved'])
    .order('company_name', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    companyName: row.company_name,
  }))
}

export async function linkUserToPartner(
  client: PartnerLinksClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  const { error } = await client.from('partner_users').insert({
    user_id: userId,
    partner_application_id: applicationId,
    role: 'owner',
  })
  if (error) throw new Error(error.message)
}

export async function unlinkUserFromPartner(
  client: PartnerLinksClient,
  userId: string,
  applicationId: string,
): Promise<void> {
  const { error } = await client
    .from('partner_users')
    .delete()
    .eq('user_id', userId)
    .eq('partner_application_id', applicationId)
  if (error) throw new Error(error.message)
}
