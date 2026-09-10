// Test/staging only: a vulnerable target could actually insert these rows.
// A SQL validation failure is NEVER proof that permissions denied a write.
export function studioWriteDenied(status, body) {
  return status >= 400 && body?.code === '42501'
}
export function studioWriteProbe(table, productIds, nonce) {
  const [a, b] = [...productIds].sort()
  const id = `security-${nonce}`
  if (table === 'studio_model_families')
    return {
      payload: {
        id,
        label: 'Security probe',
        status: 'candidate',
        source: 'manual',
      },
    }
  if (table === 'studio_sessions')
    return { payload: { id, algorithm_version: 'v0.1', entry: 'seats' } }
  if (table === 'studio_curation_sets')
    return {
      payload: {
        id,
        label: 'Security probe',
        product_ids: [],
        criteria: {},
        status: 'draft',
      },
    }
  if (table === 'studio_algorithm_versions')
    return {
      payload: {
        version: `v${nonce.replace(/\D/g, '').slice(0, 12) || '999999'}.0`,
        engine: 'v0',
        status: 'disabled',
        is_default: false,
      },
    }
  if (table === 'studio_table_base_types')
    return { payload: { label: 'Security probe', id: '99999999-0000-0000-0000-000000000001' } }
  const unavailable = {
    studio_customization_capabilities: 'portée globale unique susceptible d’exister déjà',
    studio_table_base_profiles: 'type interne et rôle piètement nécessaires',
    studio_tabletop_base_rules: 'type interne ou couple plateau/piètement qualifié nécessaire',
    studio_events: 'session_id interne inaccessible au rôle public',
    studio_product_visual_features:
      'source_media_id interne et relation produit/image non accessibles',
    studio_product_neighbors:
      'deux features internes du même modèle nécessaires',
  }
  if (unavailable[table])
    return {
      limitation: `${unavailable[table]} ; INSERT valide vérifié en PostgreSQL local, SELECT/ACL contrôlé ici`,
    }
  if (!a)
    return {
      limitation:
        'Aucun produit public pour construire la relation ; couverture SQL locale requise',
    }
  if (table === 'studio_product_profiles')
    return {
      payload: { product_id: a, studio_role: 'catalog_only', data_quality: {} },
    }
  if (table === 'studio_fulfillment_options')
    return {
      payload: {
        product_id: a,
        mode: 'standard_production',
        source: 'admin',
        price_basis: 'container',
        is_active: false,
      },
    }
  if (table === 'studio_product_media')
    return {
      payload: {
        product_id: a,
        role: 'decision',
        url: 'https://example.test/security.webp',
        storage_path: `studio/${id}.webp`,
        source_url: 'https://example.test/source.webp',
        source_hash: id,
        quality_score: 0,
        pipeline_version: 'security-probe',
        status: 'pending',
      },
    }
  if (table === 'studio_visual_jobs')
    return { payload: { product_id: a, status: 'pending' } }
  if (
    table === 'studio_diagnostic_pairs' ||
    table === 'studio_model_family_candidates'
  ) {
    if (!b)
      return {
        limitation:
          'Deux produits publics distincts nécessaires ; couverture SQL locale requise',
      }
    return {
      payload:
        table === 'studio_diagnostic_pairs'
          ? {
              product_a_id: a,
              product_b_id: b,
              axis: 'security-probe',
              source: 'manual',
              status: 'candidate',
            }
          : {
              product_a_id: a,
              product_b_id: b,
              model_version: id,
              similarity: 0,
              evidence: {},
              status: 'candidate',
            },
    }
  }
  throw new Error(`Missing write probe for ${table}`)
}
