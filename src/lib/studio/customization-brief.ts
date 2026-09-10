import {
  evaluateCustomization,
  projectTargets,
  selectionLabel,
  type CustomizationDraft,
  type CapabilityData,
  seatKey,
  tableKey,
  lineTargets,
} from './customization'
import type { StudioProduct, StudioProjectItem } from './types'
import type { TableConfiguration } from './table-project'
/** Plain text only. Statuses are informative client observations, never a quote. */
export function customizationBrief(
  items: ReadonlyArray<StudioProjectItem>,
  tables: ReadonlyArray<TableConfiguration>,
  products: ReadonlyMap<string, StudioProduct>,
  draft: CustomizationDraft,
  capabilities: CapabilityData,
): string {
  const describe = (targets: ReturnType<typeof lineTargets>) =>
    evaluateCustomization(targets, draft, capabilities)
      .selections.map(selectionLabel)
      .join('\n')
  return [
    'Projet Studio — demande sans engagement. Prix, faisabilité et délais à confirmer.',
    ...items.map(
      (i) =>
        `ASSISE ${products.get(i.productId)?.name ?? i.productId} [${i.productId}/${i.variantId}] — quantité ${i.requestedQuantity}\n${describe(lineTargets(seatKey(i), i.requestedQuantity, { seat: i.productId }))}`,
    ),
    ...tables.map(
      (t) =>
        `TABLE ${t.id} — quantité ${t.quantity}\nPlateau : ${t.top ? `${products.get(t.top.productId)?.name ?? t.top.productId} [${t.top.productId}/${t.top.variantId}]` : JSON.stringify(t.custom)}\nPiètement : ${t.base ? `${products.get(t.base.productId)?.name ?? t.base.productId} [${t.base.productId}/${t.base.variantId}]` : 'À confirmer'}\n${describe(lineTargets(tableKey(t), t.quantity, { ...(t.top ? { tabletop: t.top.productId } : {}), ...(t.base ? { base: t.base.productId } : {}) }))}`,
    ),
    'BESOINS PROJET',
    describe(
      projectTargets(items, tables).filter((t) => t.scope === 'project'),
    ),
  ].join('\n\n')
}
