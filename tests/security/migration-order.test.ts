import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrations = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .filter((file) => file.endsWith('.sql'))
  .sort()

function indexOfMigration(file: string): number {
  const index = migrations.indexOf(file)
  expect(index, `${file} should exist`).toBeGreaterThanOrEqual(0)
  return index
}

describe('migration ordering', () => {
  it('creates catalogue/container foundations before policies and dependants', () => {
    const foundation = indexOfMigration(
      '20260518120000_catalogue_container_foundation.sql',
    )
    expect(foundation).toBeLessThan(
      indexOfMigration('20260522082730_quality_reports.sql'),
    )
    expect(foundation).toBeLessThan(
      indexOfMigration(
        '20260530120000_versioned_admin_policies_and_container_publication_gate.sql',
      ),
    )
    expect(foundation).toBeLessThan(
      indexOfMigration('20260530160000_admin_save_product_full_rpc.sql'),
    )
    expect(foundation).toBeLessThan(
      indexOfMigration('20260615150000_product_favorites.sql'),
    )
  })

  it('creates referral tables/settings before checkout guards and rate limits', () => {
    const program = indexOfMigration('20260613100000_referral_program.sql')
    const settings = indexOfMigration('20260613110000_referral_settings.sql')
    expect(program).toBeLessThan(
      indexOfMigration('20260615152000_referral_checkout_guards.sql'),
    )
    expect(settings).toBeLessThan(
      indexOfMigration('20260615152000_referral_checkout_guards.sql'),
    )
    expect(settings).toBeLessThan(
      indexOfMigration('20260615153000_public_action_rate_limits.sql'),
    )
  })

  it('creates reservation foundation before quote storage and referral guards', () => {
    const reservations = indexOfMigration(
      '20260518162000_reservation_foundation.sql',
    )
    expect(reservations).toBeLessThan(
      indexOfMigration('20260615151000_reservation_quotes_storage.sql'),
    )
    expect(reservations).toBeLessThan(
      indexOfMigration('20260615152000_referral_checkout_guards.sql'),
    )
  })

  it('creates partner net prices after admin RPC and partner access helpers', () => {
    const partnerNetPrices = indexOfMigration(
      '20260623120000_partner_net_product_prices.sql',
    )
    expect(indexOfMigration('20260530160000_admin_save_product_full_rpc.sql')).toBeLessThan(
      partnerNetPrices,
    )
    expect(indexOfMigration('20260607160000_partner_portal_access.sql')).toBeLessThan(
      partnerNetPrices,
    )
  })

  it('creates pricing engine foundations after catalogue, reservations and partner net prices', () => {
    const pricingEngine = indexOfMigration(
      '20260701110000_pricing_engine_phase1.sql',
    )
    expect(
      indexOfMigration('20260518120000_catalogue_container_foundation.sql'),
    ).toBeLessThan(pricingEngine)
    expect(
      indexOfMigration('20260518162000_reservation_foundation.sql'),
    ).toBeLessThan(pricingEngine)
    expect(
      indexOfMigration('20260623120000_partner_net_product_prices.sql'),
    ).toBeLessThan(pricingEngine)
  })

  it('updates admin product RPC after pricing engine fields exist', () => {
    expect(
      indexOfMigration('20260701110000_pricing_engine_phase1.sql'),
    ).toBeLessThan(
      indexOfMigration('20260701113000_admin_product_pricing_fields.sql'),
    )
  })

  it('moves product cost inputs private after admin pricing fields exist', () => {
    expect(
      indexOfMigration('20260701113000_admin_product_pricing_fields.sql'),
    ).toBeLessThan(
      indexOfMigration('20260702102000_private_product_pricing_inputs.sql'),
    )
  })

  it('snapshots reservation pricing after private product inputs exist', () => {
    expect(
      indexOfMigration('20260702102000_private_product_pricing_inputs.sql'),
    ).toBeLessThan(
      indexOfMigration('20260702110000_reservation_pricing_engine_snapshots.sql'),
    )
  })

  it('exposes public commercial prices only after reservation pricing is secured', () => {
    expect(
      indexOfMigration('20260702110000_reservation_pricing_engine_snapshots.sql'),
    ).toBeLessThan(
      indexOfMigration('20260702113000_public_direct_product_prices.sql'),
    )
  })

  it('adds cart line pricing after public product price projection', () => {
    expect(
      indexOfMigration('20260702113000_public_direct_product_prices.sql'),
    ).toBeLessThan(
      indexOfMigration('20260702120000_public_cart_line_prices.sql'),
    )
  })
})
