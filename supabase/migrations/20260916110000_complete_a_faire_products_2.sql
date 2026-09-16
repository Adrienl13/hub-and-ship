-- 41. Complétion des 11 fiches restantes créées avec le nom provisoire
-- « A faire » (une chaise bistrot, deux fauteuils cordage, trois plateaux
-- marbre liseré doré, un lit de repos et quatre salons cordage). Noms,
-- descriptions, caractéristiques, formes et noms de design rédigés à partir
-- des photos de chaque fiche ; les valeurs marquées « estimé » restent à
-- confirmer par Adrien depuis l'admin. Aucune fiche n'est créée ni
-- désactivée, aucun prix d'achat ni fournisseur n'est touché.
--
-- Estimations à vérifier :
-- - dimensions et poids : SKU-283 (46x56x88, 4 kg), SKU-500 (58x60x82,
--   6.5 kg), SKU-503 (poids 7 kg, dimensions 62x60x82 déjà saisies),
--   SKU-548 (épaisseur 3 cm, 13 kg), SKU-566 (7 kg), SKU-854 (5.5 kg),
--   SKU-501 (longueur 200 cm à la place de 20 cm saisi, poids 36 kg
--   conservé), SKU-505 (poids 32 kg, dimensions du canapé 197x78x79
--   relevées sur la fiche technique), SKU-508 (200x85x80, 34 kg),
--   SKU-511 (poids 28 kg, dimensions du canapé 193x73x72 relevées sur la
--   fiche technique), SKU-529 (180x78x78, 26 kg) ;
-- - prix publics de référence, saisis seulement si la fiche est encore à 0
--   (le catalogue affiche « -Infinity % » sinon) : SKU-503 349 €,
--   SKU-505 2099 €, SKU-508 2799 €, SKU-511 1799 €, SKU-529 2099 €
--   (ratio 1.25 à 1.30 sur le prix HT, aligné sur les six fiches de ce
--   même lot déjà tarifées ; la médiane du catalogue est plus haute,
--   1.6 à 1.7, donc ces valeurs sont volontairement prudentes) ;
-- - composition des salons (canapé, fauteuils, tables) et volume : les
--   photos présentent des ensembles ; les dimensions saisies sont celles du
--   canapé, comme sur les fiches ROP existantes ;
-- - catégorie : SKU-500 et SKU-503 sont des fauteuils (accoudoirs) et
--   passent de « chair » à « armchair », comme BIS-070 lors de la migration
--   précédente.

-- 1. Chaise bistrot parisienne, tressage pointillé (rouge, gris, vert, bleu)
update public.products set
  name = 'Chaise de bistrot ODEON - tressage pointillé rouge / écru',
  description = 'Chaise de bistrot ODEON - tressage pointillé rouge / écru pour restaurant, café, hôtel, brasserie et terrasse CHR. Chaise parisienne classique à dossier arrondi en arceau, assise et dossier tressés motif pointillé sur structure aluminium finition bambou, entretoise croisée sous l''assise, empilable, dimensions 46x56x88 cm et poids 4 kg (estimés). Tressage rouge / écru, gris / écru, vert / écru ou bleu ciel / écru. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot parisienne','Structure aluminium finition bambou','Tressage PE outdoor','Motif pointillé','Coloris rouge, gris, vert ou bleu ciel','Empilable','Personnalisation gros projet','MOQ 50 unités'],
  dim_length_cm = 46, dim_width_cm = 56, dim_height_cm = 88,
  weight_kg = 4.0,
  updated_at = now()
where id = 'sku-283' and name = 'A faire';

-- 2. Fauteuil repas cordage vertical gris perle, structure blanc crème
update public.products set
  category = 'armchair',
  name = 'Fauteuil de terrasse SANARY - cordage vertical gris perle',
  description = 'Fauteuil de terrasse SANARY - cordage vertical gris perle pour terrasse de restaurant, café, hôtel, rooftop et espace CHR premium. Fauteuil de repas à dossier enveloppant en cordage outdoor tendu verticalement sur structure aluminium thermolaqué blanc crème, accoudoirs intégrés, coussin d''assise gris chiné déhoussable, dimensions 58x60x82 cm et poids 6.5 kg (estimés). MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Fauteuil cordage avec accoudoirs','Structure aluminium thermolaqué blanc crème','Cordage outdoor vertical','Coussin d''assise gris chiné','Coloris gris perle','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  dim_length_cm = 58, dim_width_cm = 60, dim_height_cm = 82,
  weight_kg = 6.5,
  updated_at = now()
where id = 'sku-500' and name = 'A faire';

-- 3. Fauteuil repas cordage bordeaux, coussins rose poudré (prix public estimé)
update public.products set
  category = 'armchair',
  name = 'Fauteuil de terrasse BANDOL - cordage bordeaux, coussins rose poudré',
  description = 'Fauteuil de terrasse BANDOL - cordage bordeaux, coussins rose poudré pour terrasse de restaurant, café, hôtel, rooftop et espace CHR premium. Fauteuil de repas à dossier enveloppant en cordage outdoor tressé serré sur structure aluminium thermolaqué vieux rose, coussin de dossier capitonné à plis verticaux et coussin d''assise déhoussables, dimensions 62x60x82 cm, poids 7 kg (estimé). MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Fauteuil cordage avec accoudoirs','Structure aluminium thermolaqué vieux rose','Cordage outdoor tressé','Coussins dossier et assise rose poudré','Coloris bordeaux','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  weight_kg = 7.0,
  retail_price_ref = case when retail_price_ref <= 0 then 349 else retail_price_ref end,
  updated_at = now()
where id = 'sku-503' and name = 'A faire';

-- 4. Plateau rectangulaire 110x70 marbre blanc, liseré doré
update public.products set
  name = 'Plateau de table ORANGE - rectangulaire 110x70 marbre blanc liseré doré',
  description = 'Plateau de table ORANGE - rectangulaire 110x70 marbre blanc liseré doré pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau décor marbre blanc veiné gris, coins arrondis, cerclage périphérique finition doré brossé esprit bistrot chic, dimensions 110x70 cm, épaisseur 3 cm et poids 13 kg (estimés). MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Plateau décor marbre blanc','Rectangulaire 110x70 cm','Coins arrondis','Liseré doré brossé','Résistant UV et intempéries','Compatible piètements doubles','Personnalisation gros projet','MOQ 50 unités'],
  table_shape = 'rectangular',
  dim_height_cm = 3,
  weight_kg = 13.0,
  updated_at = now()
where id = 'sku-548' and name = 'A faire';

-- 5. Plateau carré 60x60 marbre blanc, liseré doré
update public.products set
  name = 'Plateau de table GORDES - carré 60x60 marbre blanc liseré doré',
  description = 'Plateau de table GORDES - carré 60x60 marbre blanc liseré doré pour terrasse de restaurant, brasserie, café, hôtel et espace CHR. Plateau décor marbre blanc veiné gris, coins arrondis, cerclage périphérique finition doré brossé esprit bistrot chic, dimensions 60x60 cm, épaisseur 3 cm, poids 7 kg (estimé). MOQ 15 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Plateau décor marbre blanc','Carré 60x60 cm','Coins arrondis','Liseré doré brossé','Résistant UV et intempéries','Compatible piètements centraux','Personnalisation gros projet','MOQ 15 unités'],
  table_shape = 'rectangular',
  weight_kg = 7.0,
  updated_at = now()
where id = 'sku-566' and name = 'A faire';

-- 6. Plateau rond Ø60 marbre blanc, liseré doré
update public.products set
  name = 'Plateau de table LOURMARIN - rond Ø60 marbre blanc liseré doré',
  description = 'Plateau de table LOURMARIN - rond Ø60 marbre blanc liseré doré pour terrasse de café, brasserie, bar, hôtel et espace CHR. Plateau rond décor marbre blanc veiné gris, cerclage périphérique finition doré brossé esprit bistrot chic, diamètre 60 cm, épaisseur 3 cm, poids 5.5 kg (estimé). MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Plateau rond décor marbre blanc','Diamètre 60 cm','Liseré doré brossé','Résistant UV et intempéries','Compatible piètements centraux','Personnalisation gros projet','MOQ 50 unités'],
  table_shape = 'round',
  weight_kg = 5.5,
  updated_at = now()
where id = 'sku-854' and name = 'A faire';

-- 7. Lit de repos cordage sable, structure effet bois (longueur 20 → 200 cm)
update public.products set
  name = 'Lit de repos de terrasse cordage FORMENTERA - cordage sable, structure effet bois',
  description = 'Lit de repos de terrasse cordage FORMENTERA - cordage sable, structure effet bois pour zone lounge, piscine, rooftop, hôtel et terrasse CHR. Daybed ovale deux places à dossier enveloppant en cordage outdoor vertical sur structure aluminium finition bois clair, matelas épais écru chiné et deux coussins de dossier déhoussables, dimensions 200x157x79 cm (longueur estimée), poids 36 kg. MOQ 10 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Lit de repos deux places','Structure aluminium finition bois clair','Cordage outdoor vertical','Matelas et coussins écru chiné','Coloris sable','Résistant UV et intempéries','Personnalisation gros projet','MOQ 10 unités'],
  dim_length_cm = 200,
  updated_at = now()
where id = 'sku-501' and name = 'A faire';

-- 8. Salon cordage tressé large sable, dossiers coquille (prix public estimé)
update public.products set
  name = 'Salon de terrasse cordage MAJORQUE - tressage large sable, dossier coquille',
  description = 'Salon de terrasse cordage MAJORQUE - tressage large sable, dossier coquille pour zone lounge, piscine, rooftop, hôtel et terrasse CHR. Canapé à dossier coquille capitonné à plis verticaux, flancs en cordage outdoor large tressé sable sur structure aluminium blanc crème et pieds finition bois clair, coussins écru chiné déhoussables, dimensions du canapé 197x78x79 cm, poids 32 kg (estimé). Photos présentant le canapé avec le fauteuil (78x81x79 cm) et la table basse (110x70x30 cm) assortis de la collection. MOQ 10 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Salon cordage','Structure aluminium blanc crème, pieds effet bois','Cordage outdoor large tressé','Dossier coquille capitonné','Coloris sable / écru chiné','Photos groupées par fiche produit','Personnalisation gros projet','MOQ 10 unités'],
  dim_length_cm = 197, dim_width_cm = 78, dim_height_cm = 79,
  weight_kg = 32.0,
  retail_price_ref = case when retail_price_ref <= 0 then 2099 else retail_price_ref end,
  updated_at = now()
where id = 'sku-505' and name = 'A faire';

-- 9. Salon cordage bordeaux, coussins rose poudré (prix public estimé)
update public.products set
  name = 'Salon de terrasse cordage MENERBES - cordage bordeaux, coussins rose poudré',
  description = 'Salon de terrasse cordage MENERBES - cordage bordeaux, coussins rose poudré pour zone lounge, piscine, rooftop, hôtel et terrasse CHR. Canapé trois places à dossier enveloppant capitonné à plis verticaux, flancs en cordage outdoor tressé serré sur structure aluminium thermolaqué vieux rose, coussins rose poudré déhoussables, dimensions du canapé 200x85x80 cm et poids 34 kg (estimés). Photos présentant le canapé avec les fauteuils, la table basse ovale et la table d''appoint ronde assortis de la collection. MOQ 10 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Salon cordage','Structure aluminium thermolaqué vieux rose','Cordage outdoor tressé','Dossier enveloppant capitonné','Coloris bordeaux / rose poudré','Photos groupées par fiche produit','Personnalisation gros projet','MOQ 10 unités'],
  dim_length_cm = 200, dim_width_cm = 85, dim_height_cm = 80,
  weight_kg = 34.0,
  retail_price_ref = case when retail_price_ref <= 0 then 2799 else retail_price_ref end,
  updated_at = now()
where id = 'sku-508' and name = 'A faire';

-- 10. Salon cordage sable, table gigogne pivotante (prix public estimé)
update public.products set
  name = 'Salon de terrasse cordage SAINT-TROPEZ - cordage sable, table gigogne pivotante',
  description = 'Salon de terrasse cordage SAINT-TROPEZ - cordage sable, table gigogne pivotante pour zone lounge, piscine, rooftop, hôtel et terrasse CHR. Canapé trois places à dossier enveloppant en cordage outdoor vertical sable sur structure aluminium thermolaqué blanc cassé, coussins d''assise et trois coussins de dossier gris clair chiné déhoussables, dimensions du canapé 193x73x72 cm, poids 28 kg (estimé). Photos présentant le canapé avec le fauteuil (73x75x72 cm) et la table basse gigogne à plateau pivotant 360° (110x70x73 cm) assortis de la collection. MOQ 10 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Salon cordage','Structure aluminium thermolaqué blanc cassé','Cordage outdoor vertical','Coussins gris clair chiné','Coloris sable','Photos groupées par fiche produit','Personnalisation gros projet','MOQ 10 unités'],
  dim_length_cm = 193, dim_width_cm = 73, dim_height_cm = 72,
  weight_kg = 28.0,
  retail_price_ref = case when retail_price_ref <= 0 then 1799 else retail_price_ref end,
  updated_at = now()
where id = 'sku-511' and name = 'A faire';

-- 11. Salon cordage gris perle, structure effet bois (prix public estimé)
update public.products set
  name = 'Salon de terrasse cordage PORTO-VECCHIO - cordage gris perle, structure effet bois',
  description = 'Salon de terrasse cordage PORTO-VECCHIO - cordage gris perle, structure effet bois pour zone lounge, piscine, rooftop, hôtel et terrasse CHR. Canapé deux places à dossier enveloppant en cordage outdoor vertical gris perle sur structure aluminium finition bois clair, coussins gris clair chiné capitonnés à plis verticaux et déhoussables, dimensions du canapé 180x78x78 cm et poids 26 kg (estimés). Photos présentant le canapé avec les fauteuils et les deux tables d''appoint rondes assortis de la collection. MOQ 10 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Salon cordage','Structure aluminium finition bois clair','Cordage outdoor vertical','Coussins gris clair chiné capitonnés','Coloris gris perle','Photos groupées par fiche produit','Personnalisation gros projet','MOQ 10 unités'],
  dim_length_cm = 180, dim_width_cm = 78, dim_height_cm = 78,
  weight_kg = 26.0,
  retail_price_ref = case when retail_price_ref <= 0 then 2099 else retail_price_ref end,
  updated_at = now()
where id = 'sku-529' and name = 'A faire';

-- Designs « Standard » (et la faute « Standart ») : nommer le coloris réel.
update public.product_variants set name = 'Rouge / écru' where product_id = 'sku-283' and name = 'Standard';
update public.product_variants set name = 'Gris perle' where product_id in ('sku-500', 'sku-529') and name = 'Standard';
update public.product_variants set name = 'Bordeaux' where product_id in ('sku-503', 'sku-508') and name = 'Standard';
update public.product_variants set name = 'Marbre blanc liseré doré' where product_id in ('sku-548', 'sku-566', 'sku-854') and name = 'Standard';
update public.product_variants set name = 'Sable' where product_id in ('sku-501', 'sku-505') and name = 'Standard';
update public.product_variants set name = 'Sable' where product_id = 'sku-511' and name = 'Standart';
