import { useStudioCustomization } from './useStudioCustomization'
import { useMemo } from 'react'
import type { StudioCatalog } from '@/lib/studio/repository'
import { useStudioStore } from '@/stores/studio.store'
import { useStudioCompatibility } from './useStudioCompatibility'
/** Shared by entry, tables and seating: identical current-data evaluation. */
export function useStudioProjectSummary(catalog: StudioCatalog | null) {
  const project = useStudioStore((s) => s.project)
  const compatibility = useStudioCompatibility()
  const capabilities = useStudioCustomization()
  const productsById = useMemo(
    () => new Map(catalog?.products.map((p) => [p.id, p]) ?? []),
    [catalog],
  )
  return {
    customization: project.customization,
    capabilities,
    entry: project.entry,
    items: project.items,
    tables: project.tables ?? [],
    compatibility: compatibility.data,
    productsById,
    context: catalog?.context ?? { stock: [], options: [] },
    onQuantityChange: (
      item: (typeof project.items)[number],
      quantity: number,
    ) =>
      useStudioStore
        .getState()
        .setItemQuantity(item.productId, item.variantId, quantity),
    onRemove: (item: (typeof project.items)[number]) =>
      useStudioStore.getState().removeItem(item.productId, item.variantId),
    onTableQuantityChange: (id: string, quantity: number) => {
      const table = useStudioStore
        .getState()
        .project.tables?.find((t) => t.id === id)
      if (table)
        useStudioStore
          .getState()
          .saveTable(
            { ...table, quantity, quantityEdited: true },
            catalog?.products ?? [],
            compatibility.data,
          )
    },
    onRemoveTable: (id: string) => useStudioStore.getState().removeTable(id),
  }
}
