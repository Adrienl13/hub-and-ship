# Supabase — Container Club

## Configuration

Le projet Supabase est référencé dans `.mcp.json` (à la racine). Le `project_ref`
est `mkfztwibolswqcggukeq`.

Variables d'environnement attendues côté front (cf. `.env.example`) :

```
VITE_SUPABASE_URL=https://mkfztwibolswqcggukeq.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

## Appliquer les migrations

### Option A — SQL Editor du dashboard (le plus simple)

1. Ouvrir https://supabase.com/dashboard/project/mkfztwibolswqcggukeq/sql
2. Exécuter dans l'ordre :
   - `migrations/0001_init_schema.sql`
   - `migrations/0002_rls_policies.sql`
   - `migrations/0003_seed_catalog.sql`

### Option B — Supabase CLI (local)

```bash
npx supabase link --project-ref mkfztwibolswqcggukeq
npx supabase db push
```

### Option C — MCP (depuis Claude Code local avec la bonne session OAuth)

Une fois la session Claude Code relancée et OAuth fait sur le bon compte
Supabase, les outils `mcp__supabase__apply_migration` pourront pousser
les fichiers automatiquement.

## Vérifier le seed

```sql
select count(*) from products;          -- 6
select count(*) from product_variants;  -- 22
select count(*) from containers;        -- 4 (1 open + 3 delivered)
select * from container_variant_commitments;
```

## Schéma — vue d'ensemble

- `professionals` : profil pro (SIRET, raison sociale…) lié 1-1 à `auth.users`
- `products` + `product_variants` : catalogue (lecture publique via RLS)
- `containers` : containers en cours et passés (lecture publique)
- `container_reservations` + `container_reservation_items` : engagements
  d'un pro sur un container (prix figés au moment de la résa)
- `container_seed_commitments` : compteurs d'amorçage "social proof"
- `container_variant_commitments` (vue) : somme seeds + vraies résas, lue
  par le front pour la jauge MOQ par variante
