-- 27 — livraison « jusqu'à votre terrasse » (option prioritaire).
--
-- Décision Adrien 26/08/2026 : les acheteurs veulent du direct et simple —
-- Terrassea propose désormais de se charger du transport de la zone de
-- stockage jusqu'à l'établissement (option mise en avant par défaut).
-- L'enlèvement, lui, ne se fait pas « au port » mais dans la zone de
-- stockage : Fos-sur-Mer en priorité, Le Havre / Paris à venir selon la
-- demande. Le libellé côté UI change ; la valeur pickup_at_port est
-- conservée telle quelle en base (renommer un enum ne vaut pas le risque).
alter type public.delivery_mode add value if not exists 'door_delivery';
