#!/usr/bin/env bash
# Bascule finale du domaine : prosimport.com → terrassea.com.
#
# À exécuter LE JOUR J uniquement, quand terrassea.com est ajouté comme
# custom domain du worker dans Cloudflare (et prosimport.com toujours routé :
# c'est lui qui portera les 301). La marque Terrassea est déjà en place —
# ce script ne change QUE les URLs de service.
#
# Usage :   bash scripts/flip-domaine-terrassea.sh
# Ensuite : vérifier le diff, lancer la gate, commit + push + deploy.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Bascule des URLs de service vers terrassea.com…"

# 1. Toutes les URLs complètes (src + public + tests), SAUF seo.ts dont le
#    sameAs doit garder LES DEUX domaines (continuité d'entité Google).
grep -rl "https://prosimport.com" src public tests | grep -v "lib/seo.ts" \
  | xargs -r sed -i 's|https://prosimport\.com|https://terrassea.com|g'

# 2. Domaines nus (labels d'email « sur prosimport.com », tests, canonical).
grep -rl "prosimport\.com" src public tests | grep -v "lib/seo.ts\|start.ts" \
  | xargs -r sed -i 's|prosimport\.com|terrassea.com|g'

# 3. SITE_URL (seo.ts) — ciblé pour préserver le sameAs bi-domaines.
sed -i "s|export const SITE_URL = 'https://prosimport.com'|export const SITE_URL = 'https://terrassea.com'|" src/lib/seo.ts

# 4. Hôte canonique du worker : prosimport.com passe en 301 automatiquement.
sed -i "s|const CANONICAL_HOST: string = 'prosimport.com'|const CANONICAL_HOST: string = 'terrassea.com'|" src/start.ts

echo "→ Contrôles…"
if grep -rn "https://prosimport.com" src public tests | grep -v "lib/seo.ts"; then
  echo "✗ URLs prosimport résiduelles ci-dessus — vérifier à la main." >&2
  exit 1
fi
grep -q "CANONICAL_HOST: string = 'terrassea.com'" src/start.ts
grep -q "SITE_URL = 'https://terrassea.com'" src/lib/seo.ts

echo "✓ Bascule appliquée."
echo "  Reste à faire : bun run typecheck && bun run lint && bun run test && bun run build"
echo "  puis commit + push + deploy, et les étapes infra du"
echo "  docs/RUNBOOK_REBRANDING_TERRASSEA.md (Cloudflare, Supabase Auth,"
echo "  Search Console « Changement d'adresse », Merchant Center)."
