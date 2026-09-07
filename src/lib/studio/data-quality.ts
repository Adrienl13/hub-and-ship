// Qualité de données granulaire : lecture tolérante du JSON stocké et règle
// absolue « une heuristique ne produit jamais verified ».

import {
  DATA_QUALITY_FIELDS,
  DATA_QUALITY_SOURCES,
  DATA_QUALITY_STATUSES,
  HEURISTIC_SOURCES,
  type DataQuality,
  type DataQualityEntry,
  type DataQualityField,
  type DataQualitySource,
  type DataQualityStatus,
} from './types'

const PENDING: DataQualityEntry = { status: 'pending', source: 'none' }

function isStatus(value: unknown): value is DataQualityStatus {
  return (
    typeof value === 'string' &&
    (DATA_QUALITY_STATUSES as ReadonlyArray<string>).includes(value)
  )
}

function isSource(value: unknown): value is DataQualitySource {
  return (
    typeof value === 'string' &&
    (DATA_QUALITY_SOURCES as ReadonlyArray<string>).includes(value)
  )
}

/**
 * Normalise une entrée : statut/provenance inconnus → pending/none ; une
 * provenance heuristique (préfixe SKU, nom, valeur modale, catégorie,
 * pipeline) est plafonnée à `estimated` même si le JSON dit `verified`.
 */
export function normalizeDataQualityEntry(raw: unknown): DataQualityEntry {
  if (!raw || typeof raw !== 'object') return PENDING
  const record = raw as Record<string, unknown>
  const source = isSource(record.source) ? record.source : 'none'
  let status = isStatus(record.status) ? record.status : 'pending'
  if (status === 'verified' && HEURISTIC_SOURCES.has(source)) {
    status = 'estimated'
  }
  if (status === 'verified' && source === 'none') {
    status = 'pending'
  }
  return {
    status,
    source,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
    by: typeof record.by === 'string' ? record.by : null,
    note: typeof record.note === 'string' ? record.note : null,
  }
}

/** Lit le JSON `data_quality` de la base (clés snake_case ou camelCase). */
export function parseDataQuality(raw: unknown): DataQuality {
  const result: Partial<Record<DataQualityField, DataQualityEntry>> = {}
  if (!raw || typeof raw !== 'object') return result
  const record = raw as Record<string, unknown>
  for (const field of DATA_QUALITY_FIELDS) {
    const entry = record[field]
    if (entry !== undefined) result[field] = normalizeDataQualityEntry(entry)
  }
  return result
}

export function qualityOf(
  quality: DataQuality,
  field: DataQualityField,
): DataQualityEntry {
  return quality[field] ?? PENDING
}

/** Vrai si la valeur a été confirmée par une provenance non heuristique. */
export function isVerified(quality: DataQuality, field: DataQualityField): boolean {
  return qualityOf(quality, field).status === 'verified'
}
