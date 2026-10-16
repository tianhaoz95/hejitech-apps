-- Waypack moves out of `public` into its own schema (step 2 of 2; step 1 created it empty).
-- `set schema` moves each object in place: rows, grants, RLS policies, indexes, constraints,
-- foreign keys and triggers come along, and views/policies follow because Postgres links objects
-- by id. Function bodies are text, so the two that named `public` are recreated below.
-- Afterwards nothing of Waypack's is left in `public` (supabase/schemas/waypack is the source).

alter table public.profiles set schema waypack;
alter table public.trips set schema waypack;
alter table public.trip_versions set schema waypack;
alter table public.map_extracts set schema waypack;
alter table public.entitlements set schema waypack;
alter table public.api_tokens set schema waypack;
alter table public.uploads set schema waypack;
alter table public.billing_events set schema waypack;
alter table public.trip_previews set schema waypack;
alter table public.trip_shares set schema waypack;
alter table public.trip_members set schema waypack;
alter table public.trip_invites set schema waypack;
alter table public.trip_templates set schema waypack;
alter table public.place_bookings set schema waypack;
alter table public.place_price_snapshots set schema waypack;

alter view public.trip_summaries set schema waypack;

alter function public.touch_updated_at() set schema waypack;
alter function public.storage_list(text, text, text, integer) set schema waypack;
alter function public.increment_remix(text) set schema waypack;
alter function public.increment_template_remix(text) set schema waypack;

create or replace function waypack.increment_remix(share_token text) returns void
language sql security definer set search_path = waypack as $$
  update waypack.trip_shares set remix_count = remix_count + 1 where token = share_token and revoked_at is null;
$$;

create or replace function waypack.increment_template_remix(template_slug text) returns void
language sql security definer set search_path = waypack as $$
  update waypack.trip_templates set remix_count = remix_count + 1 where slug = template_slug and status = 'published';
$$;
