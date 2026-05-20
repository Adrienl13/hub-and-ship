// ============================================================
// Container Club — hooks data catalogue + container courant
// ----------------------------------------------------------------
// Source de vérité Supabase via TanStack Query. Fallback mocks
// (`products-mock.ts`) quand les env vars `VITE_SUPABASE_*` ne
// sont pas définies — la home reste utilisable sans backend.
// ============================================================

import { useQuery } from "@tanstack/react-query";

import {
  mapContainerRow,
  mapProductRow,
  type CommitmentsByVariant,
  type CurrentContainer,
} from "@/lib/catalog-mappers";
import type { Product } from "@/lib/products";
import { CURRENT_CONTAINER_MOCK, PRODUCTS_MOCK } from "@/lib/products-mock";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Retourne le container "ouvert" courant. Premier container avec
 * `status = 'open'` (créé le plus récemment).
 *
 * Fallback : `CURRENT_CONTAINER_MOCK` quand Supabase n'est pas
 * configuré.
 */
export function useCurrentContainer() {
  return useQuery<CurrentContainer>({
    queryKey: ["current-container"],
    staleTime: FIVE_MINUTES,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return CURRENT_CONTAINER_MOCK;
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("containers")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        // Pas de container ouvert en base — on retombe sur le mock
        // pour ne pas casser l'expérience découverte.
        return CURRENT_CONTAINER_MOCK;
      }

      return mapContainerRow(data);
    },
  });
}

/**
 * Retourne le catalogue (produits actifs + variantes triées) enrichi
 * des commitments du container passé en paramètre.
 *
 * Fallback : `PRODUCTS_MOCK` quand Supabase n'est pas configuré.
 */
export function useCatalog(containerId: string | undefined) {
  return useQuery<Product[]>({
    queryKey: ["catalog", containerId ?? null],
    staleTime: FIVE_MINUTES,
    enabled: containerId !== undefined,
    queryFn: async () => {
      if (!isSupabaseConfigured()) {
        return PRODUCTS_MOCK;
      }

      const supabase = getSupabaseClient();

      const [productsRes, variantsRes, commitmentsRes] = await Promise.all([
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase.from("product_variants").select("*").order("sort_order", { ascending: true }),
        containerId
          ? supabase
              .from("container_seed_commitments")
              .select("variant_id, units_committed")
              .eq("container_id", containerId)
          : Promise.resolve({
              data: [] as Array<{ variant_id: string; units_committed: number }>,
              error: null,
            }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (commitmentsRes.error) throw commitmentsRes.error;

      const commitmentsByVariant: CommitmentsByVariant = {};
      for (const row of commitmentsRes.data ?? []) {
        commitmentsByVariant[row.variant_id] = row.units_committed;
      }

      const variants = variantsRes.data ?? [];
      return (productsRes.data ?? []).map((p) => mapProductRow(p, variants, commitmentsByVariant));
    },
  });
}
