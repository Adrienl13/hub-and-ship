-- Migration 32 — advisor Supabase « security_definer_view » (niveau ERROR).
--
-- La vue product_pricing_readiness (migration 20260706110000) expose
-- ppi.fob_usd (coût usine) avec les droits de son propriétaire : tout compte
-- `authenticated` — donc n'importe quel client connecté — pouvait la lire
-- malgré la RLS admin-only de product_pricing_inputs. Elle n'est utilisée par
-- aucun écran (outil SQL admin) : on la passe en security_invoker, la RLS des
-- tables sous-jacentes s'applique et seul l'admin voit des lignes.

alter view public.product_pricing_readiness set (security_invoker = true);
