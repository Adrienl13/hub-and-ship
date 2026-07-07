-- Relances automatiques des réservations impayées (stratégie IA 2026, D1a).
--
-- Deux relances max par réservation (J+1 puis J+3 après création), envoyées
-- par l'endpoint sécurisé /api/cron/payment-reminders. Le compteur + horodatage
-- rendent l'envoi idempotent : un update conditionné sur l'ancien compteur
-- empêche tout double envoi si deux exécutions du cron se chevauchent.

alter table public.reservations
  add column if not exists payment_reminder_count int not null default 0,
  add column if not exists payment_reminder_last_at timestamptz;

-- Le cron ne balaye que les impayés relançables — index partiel étroit.
create index if not exists idx_reservations_pending_fee_reminders
  on public.reservations (created_at)
  where status = 'pending_reservation_fee' and payment_reminder_count < 2;

comment on column public.reservations.payment_reminder_count is
  'Nombre de relances de paiement envoyées (max 2 : J+1 et J+3). Incrémenté de façon conditionnelle pour rester idempotent.';
