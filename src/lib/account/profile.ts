// Lightweight typed access to the signed-in user's own profile row. The
// browser Supabase client is not generic-typed in this codebase (see
// reservations/repository.ts), so we describe the narrow surface we use and
// cast at the call site.

export interface AccountProfile {
  readonly firstName: string
  readonly lastName: string
  readonly phone: string
  readonly marketingConsent: boolean
}

export interface AccountProfilePatch {
  readonly first_name: string | null
  readonly last_name: string | null
  readonly phone: string | null
  readonly email_marketing_consent: boolean
  readonly email_marketing_consent_at: string | null
}

interface ProfileRow {
  readonly first_name: string | null
  readonly last_name: string | null
  readonly phone: string | null
  readonly email_marketing_consent: boolean | null
}

interface QueryResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface ProfileClient {
  from: (table: 'users_profile') => {
    select: (columns: string) => {
      eq: (
        column: 'id',
        value: string,
      ) => {
        maybeSingle: () => PromiseLike<QueryResult<ProfileRow | null>>
      }
    }
    update: (values: AccountProfilePatch) => {
      eq: (column: 'id', value: string) => PromiseLike<QueryResult<null>>
    }
  }
}

export function emptyAccountProfile(): AccountProfile {
  return { firstName: '', lastName: '', phone: '', marketingConsent: false }
}

export function accountProfileFromRow(row: ProfileRow | null): AccountProfile {
  return {
    firstName: row?.first_name ?? '',
    lastName: row?.last_name ?? '',
    phone: row?.phone ?? '',
    marketingConsent: row?.email_marketing_consent ?? false,
  }
}

export function toAccountProfilePatch(
  form: AccountProfile,
  nowIso: string,
): AccountProfilePatch {
  return {
    first_name: form.firstName.trim() || null,
    last_name: form.lastName.trim() || null,
    phone: form.phone.trim() || null,
    email_marketing_consent: form.marketingConsent,
    email_marketing_consent_at: form.marketingConsent ? nowIso : null,
  }
}

export async function loadMyProfile(
  client: ProfileClient,
  userId: string,
): Promise<AccountProfile> {
  const { data, error } = await client
    .from('users_profile')
    .select('first_name, last_name, phone, email_marketing_consent')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return accountProfileFromRow(data)
}

export async function updateMyProfile(
  client: ProfileClient,
  userId: string,
  patch: AccountProfilePatch,
): Promise<void> {
  const { error } = await client
    .from('users_profile')
    .update(patch)
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
