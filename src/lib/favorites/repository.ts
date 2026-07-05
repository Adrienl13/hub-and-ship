// Per-user product favourites (wishlist). Users manage their own rows directly
// under RLS. The browser client isn't generic-typed here, so we describe the
// narrow surface we use and cast at the call site.

interface QResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface FavoritesClient {
  from: (table: 'product_favorites') => {
    select: (columns: 'product_id') => {
      eq: (
        column: 'user_id',
        value: string,
      ) => PromiseLike<QResult<ReadonlyArray<{ product_id: string }> | null>>
    }
    insert: (values: {
      user_id: string
      product_id: string
    }) => PromiseLike<{ error: { message: string } | null }>
    delete: () => {
      eq: (
        column: 'user_id',
        value: string,
      ) => {
        eq: (
          column: 'product_id',
          value: string,
        ) => PromiseLike<{ error: { message: string } | null }>
      }
    }
  }
}

export async function fetchMyFavoriteIds(
  client: FavoritesClient,
  userId: string,
): Promise<ReadonlyArray<string>> {
  const { data, error } = await client
    .from('product_favorites')
    .select('product_id')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.product_id)
}

export async function addFavorite(
  client: FavoritesClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from('product_favorites')
    .insert({ user_id: userId, product_id: productId })
  if (error) throw new Error(error.message)
}

export async function removeFavorite(
  client: FavoritesClient,
  userId: string,
  productId: string,
): Promise<void> {
  const { error } = await client
    .from('product_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId)
  if (error) throw new Error(error.message)
}
