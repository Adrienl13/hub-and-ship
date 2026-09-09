import { seat } from './fixtures.test-helpers'
import type {
  TableCompatibilityData,
  TableCompatibilityRule,
} from './compatibility'
export const top = seat('top', {
  category: 'table_top',
  tableShape: 'rectangular',
  dimensions: { l: 70, w: 70, h: 2 },
  studio: { ...seat('s').studio, studioRole: 'tabletop' },
})
export const base = seat('base', {
  category: 'table_base',
  compatibleTopShapes: [],
  studio: { ...seat('s').studio, studioRole: 'base' },
})
export const pair: TableCompatibilityRule = {
  id: 'pair',
  base_id: base.id,
  tabletop_id: top.id,
  base_type_id: null,
  shape: null,
  max_length_cm: null,
  max_width_cm: null,
  verdict: 'allowed',
}
export const data: TableCompatibilityData = {
  rules: [pair],
  baseProfiles: [],
  available: true,
}
