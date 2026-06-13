import type { ReferralApplicationStatus } from '@/lib/pricing/referral'

// Typed access to the referral RPCs. The browser Supabase client is not
// generic-typed here, so we describe the narrow surfaces and cast at call site.

interface RpcResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface MyReferralSummary {
  readonly code: string
  readonly totalUses: number
  readonly pendingReward: number
}

export interface ReferralPreviewResult {
  readonly status: ReferralApplicationStatus
  readonly referrerLabel?: string
}

export interface ReferralRedemption {
  readonly id: string
  readonly createdAt: string
  readonly referredEmail: string | null
  readonly referrerReward: number
  readonly rewardStatus: 'pending' | 'honored' | 'cancelled'
  readonly referrerLabel: string | null
  readonly code: string
  readonly reservationRef: string | null
}

export interface ReferralCodeClient {
  rpc: (fn: 'get_or_create_my_referral_code') => PromiseLike<RpcResult<unknown>>
}

export interface ReferralPreviewClient {
  rpc: (
    fn: 'preview_referral_code',
    args: { p_code: string; p_email: string; p_siret: string },
  ) => PromiseLike<RpcResult<unknown>>
}

export interface ReferralAdminClient {
  rpc: (
    fn: 'admin_list_referral_redemptions',
  ) => PromiseLike<RpcResult<unknown>>
  from: (table: 'referral_redemptions') => {
    update: (values: { reward_status: 'pending' | 'honored' | 'cancelled' }) => {
      eq: (
        column: 'id',
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export async function getOrCreateMyReferralCode(
  client: ReferralCodeClient,
): Promise<MyReferralSummary> {
  const { data, error } = await client.rpc('get_or_create_my_referral_code')
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  return {
    code: typeof row.code === 'string' ? row.code : '',
    totalUses: typeof row.total_uses === 'number' ? row.total_uses : 0,
    pendingReward:
      typeof row.pending_reward === 'number' ? row.pending_reward : 0,
  }
}

export async function previewReferralCode(
  client: ReferralPreviewClient,
  code: string,
  email: string,
  siret: string,
): Promise<ReferralPreviewResult> {
  const { data, error } = await client.rpc('preview_referral_code', {
    p_code: code,
    p_email: email,
    p_siret: siret,
  })
  if (error) throw new Error(error.message)
  const row = asRecord(data)
  return {
    status: (row.status as ReferralApplicationStatus) ?? 'unknown',
    referrerLabel:
      typeof row.referrer_label === 'string' ? row.referrer_label : undefined,
  }
}

function redemptionFromRow(value: unknown): ReferralRedemption {
  const row = asRecord(value)
  return {
    id: String(row.id ?? ''),
    createdAt: String(row.created_at ?? ''),
    referredEmail:
      typeof row.referred_email === 'string' ? row.referred_email : null,
    referrerReward:
      typeof row.referrer_reward === 'number' ? row.referrer_reward : 0,
    rewardStatus:
      (row.reward_status as ReferralRedemption['rewardStatus']) ?? 'pending',
    referrerLabel:
      typeof row.referrer_label === 'string' ? row.referrer_label : null,
    code: String(row.code ?? ''),
    reservationRef:
      typeof row.reservation_ref === 'string' ? row.reservation_ref : null,
  }
}

export async function adminListReferralRedemptions(
  client: ReferralAdminClient,
): Promise<ReadonlyArray<ReferralRedemption>> {
  const { data, error } = await client.rpc('admin_list_referral_redemptions')
  if (error) throw new Error(error.message)
  return Array.isArray(data) ? data.map(redemptionFromRow) : []
}

export async function setRedemptionStatus(
  client: ReferralAdminClient,
  id: string,
  status: 'pending' | 'honored' | 'cancelled',
): Promise<void> {
  const { error } = await client
    .from('referral_redemptions')
    .update({ reward_status: status })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
