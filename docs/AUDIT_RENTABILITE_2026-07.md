# Audit rentabilité — juillet 2026

> Objectif : garantir qu'AUCUN chemin de prix (remise volume, prix net
> partenaire, commission apporteur, RFA, produit d'appel) ne peut produire une
> vente à perte, et donner la vision « bénéfice par container » 20' GP vs
> 40' GP/HC pour le plan opérationnel (un 20' GP par mois, consolidation en
> 40' ensuite).

## 1. Architecture vérifiée (verdict : saine)

Chaîne de prix réelle, de la fiche produit à la réservation :

```
FOB USD × taux USD→EUR × (1 + douane + assurance) + fret 40HC / qté container + frais fixes
  = coût rendu HT (calculate_product_landed_cost_ht)

Plancher = coût rendu × (1 + min_margin_floor 15 %)

Direct        : coût × (1 + 90 %)  → paliers volume −6 % (≥100 u) / −10 % (≥150 u)
Revendeur     : coût × (1 + 40 %)  (pas de remise volume — RFA en remplacement)
Distributeur  : coût × (1 + 28 %)
Grand compte  : pire prix direct (−10 %) d'office
Produit d'appel (loss leader) : vendu AU plancher, direct uniquement,
                lot minimum 16, max 5 produits

Tout prix calculé = greatest(prix formule, plancher)   ← jamais sous le plancher
```

Garde-fous SQL déjà en place et vérifiés :

| Garde-fou | Où | Effet |
|---|---|---|
| Plancher sur prix nets partenaires | trigger M9 (migration 14) | Écriture rejetée si prix < coût × 1,15 |
| Règle d'or | trigger overrides + `get_price` | Aucun prix revendeur/distributeur ≥ pire prix direct |
| Purge des overrides invalides | trigger M1 | Un changement de prix public re-valide les prix nets |
| Bornes paramètres | CHECK M2 | Typo admin (remise > 100 %, tier3 ≤ tier2…) impossible |
| Revalidation réservation | `create_reservation_with_items` | Chaque ligne re-tarifée serveur, tolérance 0,05 € |
| Témoin de dérive | `check_pricing_control` | Alerte si la formule dévie du SKU témoin |

Les remises volume **ne se cumulent jamais** entre elles (un seul palier
actif), et le palier s'applique AVANT le `greatest(…, plancher)` — testé.

## 2. Empilement des avantages — chiffres exacts

Paramètres actifs par défaut : plancher +15 %, commission apporteur 8 % du CA
encaissé (12 mois), coût rendu noté `c`.

| Chemin | Prix | − commission 8 % | Marge nette / coût | Verdict |
|---|---|---|---|---|
| Direct plein tarif | 1,90 c | 1,748 c | **+74,8 %** | ✅ |
| Direct −10 % (≥150 u) | 1,71 c | 1,573 c | **+57,3 %** | ✅ |
| Produit d'appel (au plancher) | 1,15 c | 1,058 c | **+5,8 %** | ✅ mais mince |
| Grand compte (−10 % d'office) | 1,71 c | 1,573 c | **+57,3 %** | ✅ |
| Revendeur (formule +40 %) | 1,40 c | 1,288 c | **+28,8 %** | ✅ |
| Revendeur + RFA 5 % | 1,40 c | 1,218 c | **+21,8 %** | ✅ |
| Distributeur (formule +28 %) | 1,28 c | 1,178 c | **+17,8 %** | ✅ |
| Distributeur + RFA 5 % | 1,28 c | 1,114 c | **+11,4 %** | ✅ |
| **Prix net AU plancher + commission + RFA 7 %** | 1,15 c | 0,978 c | **−2,2 %** | 🔴 PERTE |

### ⚠️ Règle RFA à contractualiser (seul vrai risque d'empilement)

La RFA n'existe **pas dans le code** (c'est un engagement commercial). Le
plancher SQL protège le PRIX, pas les remises hors-facture. La formule du
plafond sûr :

**RFA max = 1 − commission − 1/(1 + plancher)** → avec 15 % et 8 % : **≈ 5,0 %
du CA**. Au-delà, tout prix proche du plancher devient une vente à perte.

→ Le simulateur admin affiche ce plafond automatiquement (recalculé si tu
changes le plancher ou la commission). À reprendre tel quel dans les contrats
revendeur/distributeur : « RFA plafonnée à 5 % du CA annuel ».

## 3. Trouvailles corrigées par ce sprint

1. **Prix public modifiable sous le plancher** (risque : faute de frappe admin
   → catalogue à perte). Les prix nets partenaires étaient bloqués, mais pas
   `base_price_ht` en édition manuelle. → **Corrigé** : trigger SQL
   `products_enforce_base_price_floor` (migration 20) — blocage avec message
   explicite dès que les coûts réels du produit sont connus.
2. **Le fret n'existait qu'en 40' HC** : ton plan démarre en 20' GP, où le
   fret par m³ est ~50-60 % plus cher (≈3 000 € pour 28 m³ vs 4 500 € pour
   66 m³). Un produit à marge mince calculée « 40HC » peut être perdant dans
   un 20' GP. → **Corrigé** : paramètres `fret 20' GP` / `fret 40' GP`
   (saisis par toi — jamais inventés) + simulateur de rentabilité par format.
3. **Aucune vision « bénéfice par container »** → **Corrigé** : nouveau bloc
   admin « Rentabilité container » (onglet Catalogue, sous les paramètres
   pricing).

## 4. Le simulateur « Rentabilité container »

Dans **Admin → Catalogue**, sous les paramètres pricing :

- Choix du format : **20' GP (28 m³) / 40' GP (58 m³) / 40' HC (66 m³)**.
- Choix du scénario de vente : direct plein tarif, palier 2, palier 3,
  revendeur, distributeur, grand compte.
- Options : commission apporteur 8 %, RFA simulée (avec plafond affiché).
- Mix produits depuis tes **vraies fiches** (prix, FOB, m³) — bouton
  « Remplir » = container mono-produit, ou quantités libres.
- Résultat : CA, coût marchandise, fret du format, bénéfice € et % — vert ou
  rouge, avec alerte si le mix déborde du volume utile.
- Honnêteté des chiffres : un produit **sans FOB** est signalé (« bénéfice
  surestimé ») ; un fret **non renseigné** bloque le calcul au lieu de sortir
  un chiffre faux.

Réponse à la question stratégique : le simulateur permet exactement de
comparer « le même mix » en 20' GP puis en 40' — tu verras que le passage au
40' améliore la marge de fret d'environ un tiers par m³, ce qui justifie la
consolidation dès que deux 20' s'additionnent dans le mois.

## 5. À vérifier sur la prod (SQL à coller dans Supabase)

L'audit du CODE est complet ; la viabilité dépend aussi des DONNÉES saisies.
Trois requêtes de contrôle :

```sql
-- 5a. Produits publiés SANS coûts réels (le plancher ne peut pas les protéger)
select p.id, p.sku, p.name
from products p
left join product_pricing_inputs i on i.product_id = p.id
where p.is_active
  and (i.fob_usd is null or i.qty_per_container is null);

-- 5b. Produits dont le prix public est sous le plancher (à corriger AVANT
--     d'appliquer la migration 20, sinon leurs prochaines éditions seront bloquées)
select p.id, p.sku, p.base_price_ht,
       public.product_hard_margin_floor(p.id) as floor_ht
from products p
where public.product_hard_margin_floor(p.id) is not null
  and p.base_price_ht < public.product_hard_margin_floor(p.id);

-- 5c. Prix nets partenaires collés au plancher (zone dangereuse commission+RFA)
select o.product_id, o.channel, o.unit_price_ht,
       public.product_hard_margin_floor(o.product_id) as floor_ht
from channel_price_overrides o
where public.product_hard_margin_floor(o.product_id) is not null
  and o.unit_price_ht < public.product_hard_margin_floor(o.product_id) * 1.10;
```

Si 5b renvoie des lignes : lance un « Recalcul des prix » (bouton admin) qui
réécrit les prix depuis le moteur, ou corrige les fiches.

## 6. Ce que l'audit N'A PAS pu vérifier depuis cette session

- Les **valeurs réelles** en prod (accès SQL direct refusé à l'agent) — d'où
  les requêtes du §5 à exécuter par toi.
- Les **cotations de fret 20' GP / 40' GP** : à saisir dans les paramètres
  dès que tu as les chiffres transitaire.

## 7. Revenus non comptés (marge de sécurité)

Les frais de réservation (3 % du TTC, min 150 € / max 500 €, non
remboursables) et l'éco-contribution (collectée/reversée, neutre) ne sont pas
comptés dans les marges ci-dessus — le réel est donc légèrement MEILLEUR que
les chiffres de ce rapport.
