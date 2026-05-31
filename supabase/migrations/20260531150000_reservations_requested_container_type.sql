-- Capture the container format the buyer asked for on the reservation
-- itself, separate from the container they're currently routed onto.
--
-- Why: the catalogue sidebar lets a distributor switch from the active
-- 20' (group-buy default) to a 40' HC, but until now that choice was
-- swallowed at checkout — the ops team only saw a normal reservation
-- and had no signal that the buyer was actually requesting a larger
-- shipment. Storing the request lets the admin filter / sort by
-- "wants a 40'" and act on it (open a 40' series, contact the buyer
-- with a quote, etc.).
--
-- Nullable so legacy reservations and small-order buyers stay clean —
-- only distributors who explicitly opted in carry a value here.

alter table public.reservations
  add column if not exists requested_container_type public.container_type;

comment on column public.reservations.requested_container_type is
  'ISO format the buyer asked for at checkout. NULL means they accepted the active container default (typically a 20'' HC group-buy).';
