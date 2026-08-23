import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AdminProduct,
  AdminProductVariant,
} from '@/lib/catalogue-admin/types'

// Reproduit l'incident admin 07/2026 : « Mettre au stock » sur un produit
// sans design laissait un sélecteur vide que la validation native rendait
// impossible à comprendre — cul-de-sac silencieux. Ces tests verrouillent
// le déblocage : auto-sélection, création « Standard » en un clic, alerte
// produit inactif.

const listVariantsForProduct = vi.fn()
const createDefaultVariant = vi.fn()
const updateProduct = vi.fn()

vi.mock('@/lib/catalogue-admin/repository', () => ({
  listVariantsForProduct: (...args: unknown[]) =>
    listVariantsForProduct(...args),
  createDefaultVariant: (...args: unknown[]) => createDefaultVariant(...args),
  updateProduct: (...args: unknown[]) => updateProduct(...args),
}))

vi.mock('@/lib/supabase/env', () => ({
  getSupabasePublicConfig: () => ({
    isConfigured: true,
    url: 'https://test.supabase.co',
    anonKey: 'test',
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({}),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, status: 'anonymous' }),
}))

vi.mock('@/lib/admin/audit-log', () => ({
  logAdminAction: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/stock-admin/repository', () => ({
  upsertStockLine: vi.fn().mockResolvedValue(undefined),
}))

// L'éditeur produit complet tire tout le graphe pricing — hors sujet ici.
vi.mock('@/components/AdminProductEditor', () => ({
  AdminProductEditor: () => null,
}))

vi.mock('@/components/ImageUploader', () => ({
  ImageUploader: () => null,
  ImageGalleryUploader: () => null,
}))

import { AdminStockEditor } from '@/components/AdminStockEditor'

function makeProduct(overrides: Partial<AdminProduct> = {}): AdminProduct {
  return {
    id: 'cha-cannes-001',
    sku: 'CHA-CAN-001',
    category: 'chair',
    name: 'Chaise de terrasse CANNES',
    description: '',
    dimensions: { l: 50, w: 50, h: 90 },
    tableShape: null,
    cbmPerUnit: 0.2,
    weightKg: 5,
    moqUnits: 50,
    basePriceHt: 60,
    fobUsd: null,
    qtyPerContainer: null,
    isLossLeader: false,
    tablePriceModifierRate: null,
    partnerNetPriceHt: null,
    retailPriceRef: 120,
    ecoContribution: 0,
    mainImageUrl: '',
    galleryUrls: [],
    features: [],
    fireRating: null,
    isActive: true,
    sortOrder: 0,
    variantsCount: 0,
    ...overrides,
  }
}

const VARIANT: AdminProductVariant = {
  id: 'cha-cannes-001-noir',
  productId: 'cha-cannes-001',
  name: 'Noir',
  imageUrl: null,
  galleryUrls: [],
  sortOrder: 0,
}

function renderEditor(product: AdminProduct) {
  return render(
    <AdminStockEditor
      line={null}
      products={[product]}
      containers={[]}
      initialProductId={product.id}
      onProductCreated={() => {}}
      onSaved={() => {}}
      onCancel={() => {}}
    />,
  )
}

describe('AdminStockEditor — sélection produit/design', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('auto-sélectionne le premier design dès le chargement', async () => {
    listVariantsForProduct.mockResolvedValue([VARIANT])
    renderEditor(makeProduct())

    const designSelect = await screen.findByRole('combobox', {
      name: /design/i,
    })
    await waitFor(() => {
      expect((designSelect as HTMLSelectElement).value).toBe(VARIANT.id)
    })
  })

  it('produit sans design : alerte + création « Standard » en un clic', async () => {
    listVariantsForProduct.mockResolvedValue([])
    const standard: AdminProductVariant = {
      ...VARIANT,
      id: 'cha-cannes-001-standard',
      name: 'Standard',
    }
    createDefaultVariant.mockResolvedValue(standard)
    renderEditor(makeProduct())

    // Le cul-de-sac est remplacé par une explication et un déblocage.
    expect(
      await screen.findByText(/n’a aucun design|n'a aucun design/),
    ).toBeTruthy()

    const createButton = screen.getByRole('button', {
      name: /Créer le design/,
    })
    await act(async () => {
      fireEvent.click(createButton)
    })

    expect(createDefaultVariant).toHaveBeenCalledWith({}, 'cha-cannes-001')
    const designSelect = screen.getByRole('combobox', { name: /design/i })
    await waitFor(() => {
      expect((designSelect as HTMLSelectElement).value).toBe(standard.id)
    })
  })

  it('produit inactif : alerte + bouton de réactivation', async () => {
    listVariantsForProduct.mockResolvedValue([VARIANT])
    updateProduct.mockResolvedValue(undefined)
    renderEditor(makeProduct({ isActive: false }))

    expect(await screen.findByText(/inactif/)).toBeTruthy()

    const activateButton = screen.getByRole('button', {
      name: /Réactiver le produit/,
    })
    await act(async () => {
      fireEvent.click(activateButton)
    })

    expect(updateProduct).toHaveBeenCalledWith({}, 'cha-cannes-001', {
      is_active: true,
    })
  })
})
