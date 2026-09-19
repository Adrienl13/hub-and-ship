-- 56. Troisième lot de fiches créées sous le nom provisoire « A faire ».
--
-- Quatre fiches sur cinq, rédigées à partir des photos fournies par Adrien
-- le 19/09 : deux chaises de bistrot, un tabouret et un lit de repos. La
-- cinquième, SKU-936, attend sa photo.
--
-- Trois d'entre elles étaient ACTIVES et PUBLIQUES sous le nom « A faire »,
-- description vide, servies au catalogue (SKU-414, SKU-596, SKU-896).
-- SKU-257 est désactivée et le reste : cette migration ne l'active pas.
--
-- Aucune fiche n'est créée, désactivée ni supprimée. Aucun prix, aucun MOQ,
-- aucun coût fournisseur n'est touché. Les dimensions et poids déjà saisis
-- sont repris tels quels dans les descriptions, jamais réécrits.
--
-- NON RENSEIGNÉ VOLONTAIREMENT, à compléter par Adrien depuis l'admin :
--   - SKU-257 : dimensions (0x0x0), poids (0 kg), prix public de référence
--     (0 €) et surtout `cbm_per_unit`, resté à la valeur par défaut de
--     0,05 m³ pour un lit de repos à 1 844 € — un ensemble de ce gabarit
--     fait plutôt 1 à 2 m³. Le chargement conteneur serait faux d'un
--     facteur ~30 le jour où la fiche est activée. Ces valeurs ne se
--     devinent pas depuis une photo : les inventer rendrait la fiche plus
--     trompeuse que vide.
--
-- SKU-896 est un TABOURET. L'énumération `product_category` ne propose pas
-- de catégorie tabouret (chair, armchair, table, bench, table_base,
-- table_top, lounge) : elle reste donc `chair`, la plus proche, et c'est le
-- NOM qui porte l'information. Créer une catégorie touche au filtre du
-- catalogue, aux libellés et aux familles de remise : c'est un chantier à
-- part, pas un effet de bord de cette migration.

-- 1. Chaise bistrot parisienne, tressage pointillé — 4 coloris
update public.products set
  name = 'Chaise de bistrot VAVIN - tressage pointillé turquoise / blanc',
  description = 'Chaise de bistrot VAVIN - tressage pointillé turquoise / blanc pour restaurant, café, hôtel, brasserie, camping et terrasse CHR. Chaise parisienne à dossier médaillon arrondi, assise et dossier tressés motif pointillé sur structure aluminium finition bambou, entretoise de renfort sous l''assise, dimensions 57x46x87 cm et poids 4 kg. Disponible en 4 coloris : turquoise / blanc, vert / blanc / noir, orange / jaune et vert / blanc. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot parisienne','Structure aluminium finition bambou','Tressage PE outdoor','Motif pointillé','4 coloris disponibles','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  updated_at = now()
where id = 'sku-414' and name = 'A faire';

-- Le design par défaut s'appelait « Standard » alors que les trois autres
-- portent leur coloris : l'acheteur lisait « Standard » sans savoir lequel.
update public.product_variants set name = 'Turquoise Blanc'
where id = 'new-v-3kt6p5' and name = 'Standard';

-- 2. Chaise bistrot parisienne, tressage diagonal bordeaux
update public.products set
  name = 'Chaise de bistrot RASPAIL - tressage diagonal bordeaux / gris / blanc',
  description = 'Chaise de bistrot RASPAIL - tressage diagonal bordeaux / gris / blanc pour restaurant, café, hôtel, brasserie, camping et terrasse CHR. Chaise parisienne à dossier médaillon ovale, assise et dossier tressés en bandes diagonales sur structure aluminium finition bambou, entretoise de renfort sous l''assise, dimensions 56x42x89 cm et poids 4 kg. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Chaise bistrot parisienne','Structure aluminium finition bambou','Tressage PE outdoor','Motif diagonal bordeaux / gris / blanc','Dossier médaillon ovale','Résistant UV et intempéries','Personnalisation gros projet','MOQ 50 unités'],
  updated_at = now()
where id = 'sku-596' and name = 'A faire';

update public.product_variants set name = 'Bordeaux Gris Blanc'
where id = 'new-v-awfrnn' and name = 'Standard';

-- 3. Tabouret rond de comptoir, assise tressée rose / crème
--    42x42x66 : ce n'est pas le gabarit d'une chaise de repas (86-89 cm de
--    haut au catalogue). 66 cm, c'est une hauteur d'assise de comptoir.
update public.products set
  name = 'Tabouret de bistrot PIGALLE - tressage rose / crème',
  description = 'Tabouret de bistrot PIGALLE - tressage rose / crème pour restaurant, café, hôtel, brasserie et terrasse CHR. Tabouret rond à assise tressée PE outdoor sur structure aluminium finition bambou, repose-pieds circulaire et liens de finition rose, hauteur 66 cm adaptée aux comptoirs et mange-debout bas, dimensions 42x42x66 cm et poids 4 kg. MOQ 50 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Tabouret de comptoir','Structure aluminium finition bambou','Tressage PE outdoor','Assise ronde tressée rose / crème','Repose-pieds circulaire','Hauteur 66 cm','Résistant UV et intempéries','MOQ 50 unités'],
  updated_at = now()
where id = 'sku-896' and name = 'A faire';

update public.product_variants set name = 'Rose Crème'
where id = 'new-v-6q9w3a' and name = 'Standard';

-- 4. Lit de repos rond, cordage et coussins crème (fiche DÉSACTIVÉE,
--    non réactivée ici — voir l'en-tête pour ce qui reste à saisir)
update public.products set
  name = 'Lit de repos de terrasse cordage PAMPELONNE - cordage gris clair, coussins crème',
  description = 'Lit de repos de terrasse cordage PAMPELONNE - cordage gris clair, coussins crème pour terrasse de restaurant, hôtel, rooftop, piscine et espace CHR premium. Lit de repos rond deux places à dossier enveloppant en cordage outdoor tressé sur structure aluminium, piètement effet bois, coussin d''assise épais et coussins de dossier déhoussables. MOQ 5 unités, achat groupé par container avec prix HT visible, photos produit et volume logistique. Coloris et finitions personnalisables sur projet en volume.',
  features = array['Lit de repos rond deux places','Dossier enveloppant en cordage outdoor','Structure aluminium, piètement effet bois','Coussins d''assise et de dossier déhoussables','Coloris cordage gris clair, coussins crème','Résistant UV et intempéries','Personnalisation gros projet','MOQ 5 unités'],
  updated_at = now()
where id = 'sku-257' and name = 'A faire';

update public.product_variants set name = 'Gris clair / crème'
where id = 'new-v-elp2b1' and name = 'Standard';

-- Garde-fou : les quatre fiches sont rédigées, et rien d'autre n'a bougé.
do $check$
declare
  v_reste int;
  v_vides int;
begin
  select count(*) into v_reste
  from public.products
  where id in ('sku-257', 'sku-414', 'sku-596', 'sku-896')
    and name = 'A faire';
  if v_reste > 0 then
    raise exception '% fiche(s) portent encore le nom provisoire', v_reste;
  end if;

  select count(*) into v_vides
  from public.products
  where id in ('sku-257', 'sku-414', 'sku-596', 'sku-896')
    and coalesce(trim(description), '') = '';
  if v_vides > 0 then
    raise exception '% fiche(s) sans description', v_vides;
  end if;

  -- SKU-257 ne doit pas avoir été activée au passage.
  if (select is_active from public.products where id = 'sku-257') then
    raise exception 'SKU-257 a été activée : elle n''a ni cotes, ni poids, ni volume réel';
  end if;
end $check$;
