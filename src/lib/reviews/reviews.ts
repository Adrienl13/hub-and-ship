// Verified-purchase product reviews — typed access for public display,
// customer submission and admin moderation. The browser Supabase client is not
// generic-typed here, so we describe the narrow surfaces we use and cast.

export type ReviewStatus = 'pending' | 'published' | 'rejected'

export interface ProductReviewRow {
  readonly id: string
  readonly product_id: string
  readonly author_name: string
  readonly company_name: string | null
  readonly rating: number
  readonly title: string | null
  readonly body: string
  readonly verified_purchase: boolean
  readonly status: ReviewStatus
  readonly created_at: string
  readonly published_at: string | null
}

export interface ProductReview {
  readonly id: string
  readonly productId: string
  readonly authorName: string
  readonly companyName: string | null
  readonly rating: number
  readonly title: string | null
  readonly body: string
  readonly verifiedPurchase: boolean
  readonly status: ReviewStatus
  readonly createdAt: string
  readonly publishedAt: string | null
}

export interface ReviewStats {
  readonly count: number
  readonly average: number
}

export function reviewFromRow(row: ProductReviewRow): ProductReview {
  return {
    id: row.id,
    productId: row.product_id,
    authorName: row.author_name,
    companyName: row.company_name,
    rating: row.rating,
    title: row.title,
    body: row.body,
    verifiedPurchase: row.verified_purchase,
    status: row.status,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  }
}

export function aggregateReviews(
  reviews: ReadonlyArray<{ readonly rating: number }>,
): ReviewStats {
  if (reviews.length === 0) return { count: 0, average: 0 }
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return {
    count: reviews.length,
    average: Math.round((sum / reviews.length) * 10) / 10,
  }
}

// ---- client surfaces -------------------------------------------------------

interface QueryResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

interface Filterable {
  eq: (column: string, value: string) => Filterable
  order: (
    column: string,
    options: { ascending: boolean },
  ) => PromiseLike<QueryResult<ReadonlyArray<ProductReviewRow> | null>>
}

export interface ReviewsReadClient {
  from: (table: 'product_reviews') => {
    select: (columns: '*') => Filterable
  }
}

export interface ReviewSubmitClient {
  rpc: (
    fn: 'submit_product_review',
    args: {
      p_product_id: string
      p_rating: number
      p_title: string
      p_body: string
      p_author_name: string
      p_company_name: string
    },
  ) => PromiseLike<QueryResult<string | null>>
}

export interface ReviewAdminClient {
  from: (table: 'product_reviews') => {
    update: (values: { status: ReviewStatus }) => {
      eq: (column: 'id', value: string) => PromiseLike<QueryResult<null>>
    }
  }
}

export interface ReviewSubmitInput {
  readonly productId: string
  readonly rating: number
  readonly title: string
  readonly body: string
  readonly authorName: string
  readonly companyName: string
}

/** Published reviews for one product (or all when productId is omitted). */
export async function fetchPublishedReviews(
  client: ReviewsReadClient,
  productId?: string,
): Promise<ReadonlyArray<ProductReview>> {
  let query = client.from('product_reviews').select('*').eq('status', 'published')
  if (productId) query = query.eq('product_id', productId)
  const { data, error } = await query.order('published_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(reviewFromRow)
}

export async function submitProductReview(
  client: ReviewSubmitClient,
  input: ReviewSubmitInput,
): Promise<string> {
  const { data, error } = await client.rpc('submit_product_review', {
    p_product_id: input.productId,
    p_rating: input.rating,
    p_title: input.title,
    p_body: input.body,
    p_author_name: input.authorName,
    p_company_name: input.companyName,
  })
  if (error) throw new Error(error.message)
  return data ?? ''
}

/** Admin moderation: fetch every review regardless of status (RLS: admin). */
export async function fetchAllReviewsForAdmin(
  client: ReviewsReadClient,
): Promise<ReadonlyArray<ProductReview>> {
  const { data, error } = await client
    .from('product_reviews')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(reviewFromRow)
}

export async function setReviewStatus(
  client: ReviewAdminClient,
  id: string,
  status: ReviewStatus,
): Promise<void> {
  const { error } = await client
    .from('product_reviews')
    .update({ status })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
