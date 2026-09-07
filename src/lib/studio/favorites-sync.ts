// Une file par compte et produit : la dernière intention locale est exécutée
// après les précédentes. Les autres produits restent indépendants. La file
// vit hors du hook pour survivre à son remontage pendant une requête.
export function createStudioFavoritesQueue() {
  const pending = new Map<string, Promise<void>>()
  return (userId: string, productId: string, write: () => Promise<unknown>): Promise<void> => {
    const key = JSON.stringify([userId, productId])
    const work = (pending.get(key) ?? Promise.resolve()).then(write).then(
      () => undefined,
      () => undefined, // Un échec ne bloque ni l'UX ni l'intention suivante.
    )
    pending.set(key, work)
    void work.then(() => {
      if (pending.get(key) === work) pending.delete(key)
    })
    return work
  }
}

export const enqueueStudioFavorite = createStudioFavoritesQueue()
