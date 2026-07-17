-- Page « Le prix prouvé » (handoff design 07/2026) : nouveaux emplacements
-- de photos administrables.
--   - 'prix-hero'  : fond du hero sombre (fort voile brun par-dessus)
--   - 'trajet-1..4': frise « le trajet du container » (SGS, chargement,
--                    port, terrasse). Tant qu'un slot trajet est vide, le
--                    site affiche un emplacement « photos à venir » honnête
--                    (jamais de visuel de substitution).

alter table public.site_media
  drop constraint if exists site_media_slot_check;

alter table public.site_media
  add constraint site_media_slot_check
  check (
    slot in (
      'hero',
      'collections',
      'clientele-band',
      'prix-hero',
      'trajet-1',
      'trajet-2',
      'trajet-3',
      'trajet-4'
    )
  );
