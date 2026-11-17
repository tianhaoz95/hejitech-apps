-- Icecap, declarative (supabase/README.md): everything lives in the `icecap` schema.
-- Generate migrations with scripts/db_migration.sh icecap <what>.
--
-- Clients (the Chrome extension and the web app) read and write their own saved deals and settings
-- directly (RLS below). The waitlist, admin pages and Pro go through the Worker with the service key.

create schema icecap;
-- A non-public schema gets no Data API privileges by default; RLS below decides what rows clients see.
grant usage on schema icecap to anon, authenticated, service_role;

-- A saved deal: the listing's numbers, the assumptions and the computed metrics, as the extension
-- and the web app's @icecap/types `SavedProperty` (minus id, user and timestamps) in `data`.
create table icecap.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_user_created on icecap.properties (user_id, created_at desc);
alter table icecap.properties enable row level security;
create policy "own properties" on icecap.properties
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on table icecap.properties to authenticated, service_role;
-- The web app's portfolio updates live when the extension saves a deal.
alter publication supabase_realtime add table icecap.properties;

-- Default assumptions for new analyses (one row per user, created on first save: users are shared
-- by every HEJI app, so there's no trigger on auth.users).
create table icecap.settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  default_assumptions jsonb not null check (jsonb_typeof(default_assumptions) = 'object'),
  updated_at timestamptz not null default now()
);
alter table icecap.settings enable row level security;
create policy "own settings" on icecap.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on table icecap.settings to authenticated, service_role;

-- Early-access sign-ups from the home page. Written by the Worker (POST /api/waitlist), read by the
-- admin pages through it; one row per address.
create table icecap.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and length(email) between 6 and 255),
  name text check (length(name) <= 200),
  source text check (length(source) <= 100),
  created_at timestamptz not null default now()
);
create unique index waitlist_email on icecap.waitlist (email);
alter table icecap.waitlist enable row level security;
grant select, insert, update, delete on table icecap.waitlist to service_role;

-- Who may open /admin/ (scripts/make_admin.sh). Only the Worker reads it.
create table icecap.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table icecap.admins enable row level security;
grant select, insert, update, delete on table icecap.admins to service_role;

-- Pro given by email (scripts/grant_pro.sh: testers, early adopters, the owner). Keyed by the
-- lower-case email so a grant works before the person first signs in; `until` null = for good.
-- Only the Worker reads it (service key); clients ask the Worker, so there are no policies.
create table icecap.pro_grants (
  email text primary key check (email = lower(email)),
  until timestamptz,
  note text,
  granted_at timestamptz not null default now()
);
alter table icecap.pro_grants enable row level security;
grant select, insert, update, delete on table icecap.pro_grants to service_role;
