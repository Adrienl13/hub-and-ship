-- ============================================================
-- Container Club / Hub & Ship — Seed catalogue + containers
-- Reprend les 6 produits, variantes, container courant et historique
-- définis dans src/lib/products.ts
-- ============================================================

-- ----------------------------------------------------------------
-- products
-- ----------------------------------------------------------------
insert into products
  (id, sku, category, name, description,
   dim_length_cm, dim_width_cm, dim_height_cm,
   cbm_per_unit, weight_kg, moq_units,
   base_price_ht, retail_price_ref, eco_contribution,
   main_image_url, gallery_urls, features, fire_rating, sort_order)
values
  ('p1', 'CHA-CAN-001', 'chair',
   'Chaise Cannes Empilable',
   'Chaise outdoor en rotin synthétique S-PE tressé sur structure aluminium thermolaqué. Empilable jusqu''à 8 unités.',
   55, 58, 85, 0.08, 4.2, 50, 89.00, 149.00, 0.30,
   'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80',
   array[
     'https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&fit=crop&w=900&q=80',
     'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80'
   ],
   array['Empilable x8','Rotin synthétique S-PE','Aluminium thermolaqué','Résistant UV 5 ans','Anti-corrosion marine'],
   'M2', 1),

  ('p2', 'FAU-MAL-002', 'armchair',
   'Fauteuil Malibu Lounge',
   'Fauteuil large outdoor avec coussins déperlants inclus. Structure aluminium et tressage rotin synthétique haute densité.',
   78, 82, 78, 0.35, 11.5, 50, 245.00, 429.00, 1.00,
   'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80',
   '{}',
   array['Coussins inclus','Tissu déperlant','Rotin synthétique HD','Structure renforcée','Charge max 150 kg'],
   'M1', 2),

  ('p3', 'TAB-LYO-003', 'table',
   'Table Lyon Pied Central',
   'Table outdoor ronde 80 cm, plateau HPL résistant et pied central aluminium. Idéale brasseries et terrasses.',
   80, 80, 73, 0.25, 18.0, 20, 189.00, 320.00, 2.00,
   'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=900&q=80',
   '{}',
   array['Plateau HPL 12 mm','Anti-UV','Anti-rayures','Pied alu thermolaqué','Empilable démontée'],
   'M1', 3),

  ('p4', 'CHA-MON-004', 'chair',
   'Chaise Monaco Textilène',
   'Chaise outdoor textilène haute densité sur structure aluminium. Confort et légèreté pour le secteur hôtelier.',
   52, 58, 88, 0.07, 3.5, 50, 72.00, 119.00, 0.30,
   'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=900&q=80',
   '{}',
   array['Textilène TS 8001','Aluminium 6063','Empilable x10','Légère 3,5 kg','Pieds anti-trace'],
   'M2', 4),

  ('p5', 'BAN-PRO-005', 'bench',
   'Banc Provence 180 cm',
   'Banc outdoor 3 places en rotin synthétique sur structure aluminium. Parfait pour entrées d''hôtels et halls.',
   180, 55, 82, 0.45, 14.0, 50, 219.00, 379.00, 1.50,
   'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
   '{}',
   array['3 places confort','Rotin synthétique S-PE','Structure renforcée','Pieds anti-glisse'],
   null, 5),

  ('p6', 'TAB-MAR-006', 'table',
   'Table Marseille Rectangulaire',
   'Table outdoor rectangulaire 160×80 cm pour 6 personnes. Plateau HPL et structure aluminium.',
   160, 80, 73, 0.45, 28.0, 20, 349.00, 590.00, 5.00,
   'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=900&q=80',
   '{}',
   array['6 couverts','Plateau HPL 12 mm','Pieds renforcés','Démontable transport'],
   'M1', 6);

-- ----------------------------------------------------------------
-- product_variants (couleurs / finitions)
-- ----------------------------------------------------------------
insert into product_variants (id, product_id, name, hex, sort_order) values
  ('v1a', 'p1', 'Noir charbon',     '#1f1f1f', 1),
  ('v1b', 'p1', 'Gris ardoise',     '#5e5e5e', 2),
  ('v1c', 'p1', 'Beige sable',      '#c9b88a', 3),
  ('v1d', 'p1', 'Brun expresso',    '#3d2817', 4),
  ('v1e', 'p1', 'Blanc craie',      '#e8e0d0', 5),
  ('v1f', 'p1', 'Vert olive',       '#5a6b3a', 6),

  ('v2a', 'p2', 'Noir / coussin écru',          '#1f1f1f', 1),
  ('v2b', 'p2', 'Gris / coussin anthracite',    '#5e5e5e', 2),
  ('v2c', 'p2', 'Naturel / coussin lin',        '#c9b88a', 3),

  ('v3a', 'p3', 'Plateau Teck',         '#a87344', 1),
  ('v3b', 'p3', 'Plateau Ardoise',      '#3a3a3e', 2),
  ('v3c', 'p3', 'Plateau Marbre blanc', '#e8e4dc', 3),
  ('v3d', 'p3', 'Plateau Béton',        '#8a8580', 4),

  ('v4a', 'p4', 'Textilène Noir',        '#1f1f1f', 1),
  ('v4b', 'p4', 'Textilène Anthracite',  '#3a3a3e', 2),
  ('v4c', 'p4', 'Textilène Taupe',       '#9a8a7a', 3),
  ('v4d', 'p4', 'Textilène Écru',        '#d8cdb8', 4),

  ('v5a', 'p5', 'Noir charbon',  '#1f1f1f', 1),
  ('v5b', 'p5', 'Beige sable',   '#c9b88a', 2),

  ('v6a', 'p6', 'Plateau Teck',     '#a87344', 1),
  ('v6b', 'p6', 'Plateau Ardoise',  '#3a3a3e', 2),
  ('v6c', 'p6', 'Plateau Béton',    '#8a8580', 3);

-- ----------------------------------------------------------------
-- containers : courant + historique
-- ----------------------------------------------------------------
insert into containers
  (id, reference, port, capacity_cbm, threshold_percent, min_series_required,
   expected_close_at, status, delivered_at, planned_days, actual_days,
   photo_url, testimonial_quote, testimonial_author, testimonial_location, testimonial_rating)
values
  ('00000000-0000-0000-0000-000000000001',
   'CC-2026-001', 'Marseille-Fos', 28.00, 80, 3,
   date '2026-03-14', 'open', null, null, null,
   null, null, null, null, null),

  ('00000000-0000-0000-0000-000000000002',
   'CC-2025-014', 'Marseille-Fos', 28.00, 80, 3,
   null, 'delivered', date '2025-12-12', 75, 78,
   'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=900&q=80',
   'Qualité au rendez-vous, délais tenus, on recommence sur le prochain.',
   'Hôtel Le Lavandou', 'Var', 5),

  ('00000000-0000-0000-0000-000000000003',
   'CC-2025-013', 'Le Havre', 28.00, 80, 3,
   null, 'delivered', date '2025-11-28', 75, 71,
   'https://images.unsplash.com/photo-1605283176568-9b41fde3a09c?auto=format&fit=crop&w=900&q=80',
   'Économies réelles vs nos fournisseurs habituels. Process clair et rassurant.',
   'Camping Les Pins Bleus', 'Landes', 5),

  ('00000000-0000-0000-0000-000000000004',
   'CC-2025-012', 'Marseille-Fos', 28.00, 80, 3,
   null, 'delivered', date '2025-10-15', 75, 82,
   'https://images.unsplash.com/photo-1516571748831-5d81767b788d?auto=format&fit=crop&w=900&q=80',
   'Petit retard de 7 jours communiqué en transparence. Mobilier au top, prix imbattable.',
   'Restaurant La Marina', 'Cap d''Agde', 4);

-- ----------------------------------------------------------------
-- container_seed_commitments : compteurs de "social proof" pour CC-2026-001
-- Reprend les unitsCommitted historiques des variantes du mock
-- (à vider quand de vrais pros s'engagent)
-- ----------------------------------------------------------------
insert into container_seed_commitments (container_id, variant_id, units_committed) values
  ('00000000-0000-0000-0000-000000000001', 'v1a', 38),
  ('00000000-0000-0000-0000-000000000001', 'v1b', 22),
  ('00000000-0000-0000-0000-000000000001', 'v1c', 52),
  ('00000000-0000-0000-0000-000000000001', 'v1d', 12),
  ('00000000-0000-0000-0000-000000000001', 'v1e',  0),
  ('00000000-0000-0000-0000-000000000001', 'v1f',  8),

  ('00000000-0000-0000-0000-000000000001', 'v2a', 28),
  ('00000000-0000-0000-0000-000000000001', 'v2b', 18),
  ('00000000-0000-0000-0000-000000000001', 'v2c', 50),

  ('00000000-0000-0000-0000-000000000001', 'v3a', 14),
  ('00000000-0000-0000-0000-000000000001', 'v3b',  8),
  ('00000000-0000-0000-0000-000000000001', 'v3c', 22),
  ('00000000-0000-0000-0000-000000000001', 'v3d',  6),

  ('00000000-0000-0000-0000-000000000001', 'v4a', 55),
  ('00000000-0000-0000-0000-000000000001', 'v4b', 32),
  ('00000000-0000-0000-0000-000000000001', 'v4c', 18),
  ('00000000-0000-0000-0000-000000000001', 'v4d',  8),

  ('00000000-0000-0000-0000-000000000001', 'v5a', 22),
  ('00000000-0000-0000-0000-000000000001', 'v5b', 14),

  ('00000000-0000-0000-0000-000000000001', 'v6a', 18),
  ('00000000-0000-0000-0000-000000000001', 'v6b', 12),
  ('00000000-0000-0000-0000-000000000001', 'v6c',  4);
