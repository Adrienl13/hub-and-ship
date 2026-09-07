-- 36. Complétion des 12 fiches créées avec le nom provisoire « A faire »
-- (chaises bistrot, un piètement, cinq plateaux). Noms, descriptions,
-- caractéristiques et formes rédigés à partir des photos ; les poids,
-- volumes et dimensions marqués « estimé » dans la description interne
-- ci-dessous restent à confirmer par Adrien depuis l'admin.
--
-- Estimations à vérifier : poids de toutes les fiches ; dimensions de
-- SKU-698 (48x56x88) et du piètement SKU-489 (45x45x72) ; prix public de
-- référence du plateau rond SKU-804 (89 €).

-- 1. Fauteuil rotin naturel (id conservé, SKU provisoire « A faire » → BIS-070)
update public.products set
  sku = 'BIS-070',
  category = 'armchair',
  name = 'Fauteuil de bistrot ARCACHON - rotin naturel tressé',
  description = 'Fauteuil de bistrot ARCACHON - rotin naturel tressé pour terrasse de restaurant, café, hôtel, brasserie et espace CHR. Dossier arrondi en cannage tressé, accoudoirs enveloppants et assise tressée sur structure aluminium finition rotin, entretoise croisée sous l''assise, dimensions 56x63x93 cm, poids 4 kg. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Fauteuil bistrot avec accoudoirs','Structure aluminium finition rotin','Cannage et tressage PE outdoor','Dossier arrondi, assise tressée','Coloris naturel','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  updated_at = now()
where id = 'a-faire' and name = 'A faire';

-- 2. Chaise dossier ovale à croisillons (naturel / noir)
update public.products set
  name = 'Chaise de bistrot TROUVILLE - dossier ovale tressé',
  description = 'Chaise de bistrot TROUVILLE - dossier ovale tressé pour restaurant, café, hôtel, brasserie et terrasse CHR. Dossier ovale ajouré à croisillons et assise tressée serrée sur structure aluminium finition rotin, dimensions 55x56x82 cm, poids 3.5 kg. Disponible en tressage naturel taupe ou noir. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot sans accoudoirs','Structure aluminium finition rotin','Tressage PE outdoor','Dossier ovale à croisillons','Coloris naturel taupe ou noir','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  updated_at = now()
where id = 'sk-456' and name = 'A faire';

-- 3. Chaise dossier arrondi à barreaux (fiche inactive conservée inactive)
update public.products set
  name = 'Chaise de bistrot HOSSEGOR - dossier arrondi à barreaux',
  description = 'Chaise de bistrot HOSSEGOR - dossier arrondi à barreaux pour restaurant, café, hôtel, brasserie et terrasse CHR. Dossier enveloppant arrondi à barreaux verticaux, assise tressée à motif damier sur structure aluminium finition bambou, dimensions 56x59x78 cm, poids 4 kg. Assise noir / blanc / doré ou vert pâle / noir / blanc. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot dossier enveloppant','Structure aluminium finition bambou','Tressage PE outdoor','Dossier arrondi à barreaux','Assise motif damier','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  updated_at = now()
where id = 'sku-569' and name = 'A faire';

-- 4. Chaise parisienne tressage chevrons (beige / vert / noir)
update public.products set
  name = 'Chaise de bistrot CABOURG - tressage chevrons',
  description = 'Chaise de bistrot CABOURG - tressage chevrons pour restaurant, café, hôtel, brasserie et terrasse CHR. Chaise parisienne classique à dossier et assise tressés motif chevrons sur structure aluminium finition bambou, empilable, dimensions 48x56x85 cm, poids 4 kg (estimé). Tressage beige / blanc, vert / blanc ou noir / blanc. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot parisienne','Structure aluminium finition bambou','Tressage PE outdoor','Motif chevrons','Coloris beige, vert ou noir','Empilable','Personnalisation gros projet','MOQ 50 unités'],
  weight_kg = 4.0,
  updated_at = now()
where id = 'sku-659' and name = 'A faire';

-- 5. Chaise parisienne tressage bicolore (bleu / marron / terracotta / orange)
update public.products set
  name = 'Chaise de bistrot SAINT-MALO - tressage bicolore',
  description = 'Chaise de bistrot SAINT-MALO - tressage bicolore pour restaurant, café, hôtel, brasserie et terrasse CHR. Chaise parisienne classique à dossier arrondi et assise tressés motif quadrillé bicolore sur structure aluminium finition bambou, empilable, dimensions 48x56x88 cm et poids 4 kg (estimés). Tressage bleu / blanc, marron / blanc, terracotta / blanc ou orange / blanc. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot parisienne','Structure aluminium finition bambou','Tressage PE outdoor','Motif quadrillé bicolore','Coloris bleu, marron, terracotta ou orange','Empilable','Personnalisation gros projet','MOQ 50 unités'],
  dim_length_cm = 48, dim_width_cm = 56, dim_height_cm = 88,
  weight_kg = 4.0,
  updated_at = now()
where id = 'sku-698' and name = 'A faire';

-- 6. Chaise dossier arceau à tiges (assise damier / vert pâle)
update public.products set
  name = 'Chaise de bistrot QUIBERON - dossier arceau',
  description = 'Chaise de bistrot QUIBERON - dossier arceau pour restaurant, café, hôtel, brasserie et terrasse CHR. Dossier en arceau à tiges verticales et assise tressée motif damier sur structure aluminium finition bambou, dimensions 46x60x88 cm, poids 3.8 kg (estimé). Assise noir / blanc / doré ou vert pâle / noir / bleu. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot dossier arceau','Structure aluminium finition bambou','Tressage PE outdoor','Assise motif damier','Coloris damier doré ou vert pâle','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  weight_kg = 3.8,
  updated_at = now()
where id = 'sku-785' and name = 'A faire';

-- 7. Piètement colonne style fonte
update public.products set
  name = 'Piètement de table MARAIS - colonne style fonte',
  description = 'Piètement de table MARAIS - colonne style fonte pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Piètement central à colonne tournée et base quatre branches, esprit bistrot parisien, finition noir mat, dimensions 45x45x72 cm et poids 12 kg (estimés, à confirmer). MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Accepte les plateaux ronds et carrés du catalogue ; plateau à sélectionner séparément.',
  features = array['Piètement central de table','Colonne tournée style fonte','Base quatre branches','Finition noir mat','Compatible plateaux ronds et carrés','Plateau à sélectionner séparément','MOQ 50 unités'],
  dim_length_cm = 45, dim_width_cm = 45, dim_height_cm = 72,
  weight_kg = 12.0,
  cbm_per_unit = 0.03,
  compatible_top_shapes = '{}'::text[],
  updated_at = now()
where id = 'sku-489' and name = 'A faire';

-- 8. Plateau carré 60x60 compact HPL
update public.products set
  name = 'Plateau de table ARLES - carré 60x60 compact HPL',
  description = 'Plateau de table ARLES - carré 60x60 compact HPL pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau stratifié compact haute pression 12 mm, chant noir, résistant aux rayures, aux chocs et aux intempéries, dimensions 60x60 cm, poids 5.5 kg (estimé). Décors marbre blanc, marbre noir, bois ou bois clair. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Autres dimensions découpées à la demande grâce au direct usine.',
  features = array['Plateau compact HPL 12 mm','Carré 60x60 cm','Chant noir','Résistant rayures, chocs et UV','Décors marbre blanc, marbre noir, bois, bois clair','Compatible piètements centraux','Découpe sur mesure possible','MOQ 50 unités'],
  table_shape = 'rectangular',
  weight_kg = 5.5,
  cbm_per_unit = 0.008,
  updated_at = now()
where id = 'sku-009' and name = 'A faire';

-- 9. Plateau rond Ø60 laqué liseré doré (minimum 70 par coloris déjà saisi)
update public.products set
  name = 'Plateau de table LOUVRE - rond Ø60 laqué liseré doré',
  description = 'Plateau de table LOUVRE - rond Ø60 laqué liseré doré pour terrasse de café, brasserie, bar, hôtel et espace CHR. Plateau rond en métal laqué, cerclage liseré doré esprit bistrot parisien, diamètre 60 cm, épaisseur 2 cm, poids 4 kg (estimé). Coloris sable, gris, bleu ou vert ; chaque coloris se commande par 70 pièces minimum. Achat groupé par container avec prix HT visible, photos produit et volume logistique.',
  features = array['Plateau rond métal laqué','Diamètre 60 cm','Liseré doré','Coloris sable, gris, bleu, vert','Minimum 70 pièces par coloris','Compatible piètements centraux','MOQ 70 unités'],
  table_shape = 'round',
  dim_height_cm = 2,
  weight_kg = 4.0,
  cbm_per_unit = 0.008,
  updated_at = now()
where id = 'sku-801' and name = 'A faire';

-- 10. Plateau rectangulaire 120x80 compact HPL
update public.products set
  name = 'Plateau de table NIMES - rectangulaire 120x80 compact HPL',
  description = 'Plateau de table NIMES - rectangulaire 120x80 compact HPL pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau stratifié compact haute pression 12 mm, chant noir, résistant aux rayures, aux chocs et aux intempéries, dimensions 120x80 cm, poids 14.5 kg (estimé). Décors marbre blanc, marbre noir, bois ou bois clair. MOQ 15 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Autres dimensions découpées à la demande grâce au direct usine.',
  features = array['Plateau compact HPL 12 mm','Rectangulaire 120x80 cm','Chant noir','Résistant rayures, chocs et UV','Décors marbre blanc, marbre noir, bois, bois clair','Compatible piètements doubles','Découpe sur mesure possible','MOQ 15 unités'],
  table_shape = 'rectangular',
  dim_length_cm = 120, dim_width_cm = 80, dim_height_cm = 1,
  weight_kg = 14.5,
  cbm_per_unit = 0.02,
  updated_at = now()
where id = 'sku-802' and name = 'A faire';

-- 11. Plateau carré 70x70 compact HPL
update public.products set
  name = 'Plateau de table AVIGNON - carré 70x70 compact HPL',
  description = 'Plateau de table AVIGNON - carré 70x70 compact HPL pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau stratifié compact haute pression 12 mm, chant noir, résistant aux rayures, aux chocs et aux intempéries, dimensions 70x70 cm, poids 7.5 kg (estimé). Décors marbre blanc, marbre noir, bois ou bois clair. MOQ 15 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Autres dimensions découpées à la demande grâce au direct usine.',
  features = array['Plateau compact HPL 12 mm','Carré 70x70 cm','Chant noir','Résistant rayures, chocs et UV','Décors marbre blanc, marbre noir, bois, bois clair','Compatible piètements centraux','Découpe sur mesure possible','MOQ 15 unités'],
  table_shape = 'rectangular',
  dim_height_cm = 1,
  weight_kg = 7.5,
  cbm_per_unit = 0.01,
  updated_at = now()
where id = 'sku-803' and name = 'A faire';

-- 12. Plateau rond Ø70 compact HPL (prix public de référence estimé)
update public.products set
  name = 'Plateau de table UZES - rond Ø70 compact HPL',
  description = 'Plateau de table UZES - rond Ø70 compact HPL pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau stratifié compact haute pression 12 mm, chant noir, résistant aux rayures, aux chocs et aux intempéries, diamètre 70 cm, poids 6 kg (estimé). Décors marbre blanc, marbre noir, bois ou bois clair. MOQ 15 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Autres dimensions découpées à la demande grâce au direct usine.',
  features = array['Plateau compact HPL 12 mm','Rond diamètre 70 cm','Chant noir','Résistant rayures, chocs et UV','Décors marbre blanc, marbre noir, bois, bois clair','Compatible piètements centraux','Découpe sur mesure possible','MOQ 15 unités'],
  table_shape = 'round',
  dim_height_cm = 1,
  weight_kg = 6.0,
  cbm_per_unit = 0.01,
  retail_price_ref = case when retail_price_ref <= 0 then 89 else retail_price_ref end,
  updated_at = now()
where id = 'sku-804' and name = 'A faire';

-- Variantes « Standard » des plateaux : nommer le décor réel.
update public.product_variants set name = 'Marbre blanc' where product_id in ('sku-009','sku-802','sku-803','sku-804') and name = 'Standard';
update public.product_variants set name = 'Sable' where product_id = 'sku-801' and name = 'Standard';
update public.product_variants set name = 'Naturel taupe' where product_id = 'sk-456' and name = 'Standard';
update public.product_variants set name = 'Naturel' where product_id = 'a-faire' and name = 'Standard';
update public.product_variants set name = 'Beige' where product_id = 'sku-659' and name = 'Standard';
update public.product_variants set name = 'Bleu' where product_id = 'sku-698' and name = 'Standard';
update public.product_variants set name = 'Damier doré' where product_id in ('sku-569','sku-785') and name = 'Standard';
