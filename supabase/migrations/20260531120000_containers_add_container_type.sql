-- Add an explicit ISO container type column to `public.containers`.
--
-- The 3D viewer was hardcoded to a 20' High Cube shell, which is fine
-- for the regular pre-order container but doesn't fit large-volume
-- demand orders that ship in a 40' General Purpose container. Storing
-- the type on the row lets the admin pick the right shell per
-- container, and the front-end renders the correct geometry.
--
-- Values:
--   20_dv : 20' Dry Van standard       (5.898 × 2.352 × 2.395 ≈ 33 m³)
--   20_hc : 20' High Cube              (5.898 × 2.352 × 2.700 ≈ 37 m³)
--   40_gp : 40' General Purpose         (12.032 × 2.352 × 2.395 ≈ 68 m³)
--   40_hc : 40' High Cube              (12.032 × 2.352 × 2.700 ≈ 76 m³)
--
-- Default '20_hc' so existing rows match what the front-end already
-- renders today.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'container_type') then
    create type public.container_type as enum (
      '20_dv',
      '20_hc',
      '40_gp',
      '40_hc'
    );
  end if;
end$$;

alter table public.containers
  add column if not exists container_type public.container_type not null
    default '20_hc';

comment on column public.containers.container_type is
  'ISO container format. Drives both the 3D shell dimensions in the front-end '
  'and the human-readable label shown on the sidebar.';
