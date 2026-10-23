-- G2 Digest, declarative (supabase/README.md): everything lives in the `g2digest` schema.
-- Generate migrations with scripts/db_migration.sh g2digest <what>; the storage bucket and its
-- policies are data statements added to the migration by hand (see the init migration).
--
-- Clients only read their own rows (RLS below). Every write goes through the site's Worker with the
-- service key, after the shared checks in @g2digest/core: brief edits (session), pairing (code),
-- device and agent tokens (only hashes are stored), and publishing editions (MCP).

create schema g2digest;
-- A non-public schema gets no Data API privileges by default; RLS below decides what rows clients see.
grant usage on schema g2digest to anon, authenticated, service_role;

-- Rendering parameters per user (PRD §11): language, units, glossary, delivery. Created on first
-- use (users are shared by every app in the project: no trigger on auth.users).
create table g2digest.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'en',
  units jsonb not null default '{"temperature": "C", "distance": "km"}'::jsonb,
  glossary jsonb not null default '[]'::jsonb,
  no_gloss jsonb not null default '[]'::jsonb,
  delivery jsonb not null default '{"time": "07:00", "timezone": "America/Los_Angeles", "days": ["mon", "tue", "wed", "thu", "fri"]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The brief's content (sections, TL;DR, budgets): one active row per user. Any edit of the brief or
-- the profile bumps brief_version, which every bundle records.
create table g2digest.briefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  brief_version integer not null default 1 check (brief_version > 0),
  config jsonb not null,
  updated_at timestamptz not null default now()
);

-- Short-lived single-use 6-digit codes shown in the web app; the plugin trades one for a device token.
create table g2digest.pairing_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index pairing_codes_user on g2digest.pairing_codes(user_id);

-- Long-lived read-only credentials: paired glasses and private podcast feeds. Revoking deletes the row.
create table g2digest.device_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'glasses' check (kind in ('glasses', 'feed')),
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index device_tokens_user on g2digest.device_tokens(user_id);

-- Personal access tokens for build agents that can't do OAuth (MCP). Only a hash is stored.
create table g2digest.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index access_tokens_user on g2digest.access_tokens(user_id);

-- One published edition per user and date; publishing the same date again replaces it.
create table g2digest.editions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  guide_version text not null,
  brief_version integer not null,
  title text not null,
  total_cards integer not null,
  total_audio_sec numeric not null,
  -- The whole validated bundle (full edition + cards + audio refs): what the plugin and preview render.
  bundle jsonb not null,
  cut jsonb not null default '[]'::jsonb,
  preview_hash text not null,
  -- The ASCII preview snapshot from validate_cards (the run log keeps the same one).
  preview_snapshot text not null,
  published_at timestamptz not null default now(),
  unique (user_id, date)
);

-- The cards of an edition, one row each (id = date + slug, so a rebuild upserts, never duplicates).
create table g2digest.cards (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  edition_id uuid not null references g2digest.editions(id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('cover', 'tldr', 'section', 'end')),
  section_id text,
  template text,
  lines jsonb not null,
  key_number text,
  method_keyword text,
  alert boolean not null default false,
  glance_script text,
  glance_audio_path text,
  glance_duration_sec numeric,
  deep_dive_script text,
  deep_dive_audio_path text,
  deep_dive_duration_sec numeric,
  source_url text,
  primary key (user_id, id)
);
create index cards_edition on g2digest.cards(edition_id, position);

-- ---------------------------------------------------------------- access rules

alter table g2digest.profiles enable row level security;
alter table g2digest.briefs enable row level security;
alter table g2digest.pairing_codes enable row level security;
alter table g2digest.device_tokens enable row level security;
alter table g2digest.access_tokens enable row level security;
alter table g2digest.editions enable row level security;
alter table g2digest.cards enable row level security;

create policy "own profile" on g2digest.profiles for select using (user_id = auth.uid());
create policy "own brief" on g2digest.briefs for select using (user_id = auth.uid());
create policy "own devices" on g2digest.device_tokens for select using (user_id = auth.uid());
create policy "own access tokens" on g2digest.access_tokens for select using (user_id = auth.uid());
create policy "own editions" on g2digest.editions for select using (user_id = auth.uid());
create policy "own cards" on g2digest.cards for select using (user_id = auth.uid());
-- pairing_codes: no client access at all (the Worker issues and redeems them).

grant select on all tables in schema g2digest to authenticated;
revoke select on g2digest.pairing_codes from authenticated;
grant select, insert, update, delete on all tables in schema g2digest to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

-- Redeems a pairing code (hash) for a new device token (hash) in one statement: single use, unexpired.
create or replace function g2digest.redeem_pairing_code(p_code_hash text, p_token_hash text, p_label text)
returns table (device_id uuid, user_id uuid)
language plpgsql security definer set search_path = g2digest, extensions as $$
declare v_user uuid;
begin
  update pairing_codes set used_at = now()
  where code_hash = p_code_hash and used_at is null and expires_at > now()
  returning pairing_codes.user_id into v_user;
  if v_user is null then return; end if;
  return query
    insert into device_tokens (token_hash, user_id, kind, label)
    values (p_token_hash, v_user, 'glasses', left(coalesce(nullif(trim(p_label), ''), 'Even G2'), 60))
    returning device_tokens.id, device_tokens.user_id;
end $$;

-- Resolves a device or feed token (hash) to its user, recording use. Revoked or unknown: no row.
create or replace function g2digest.resolve_device_token(p_token_hash text)
returns table (device_id uuid, user_id uuid, kind text)
language sql security definer set search_path = g2digest, extensions as $$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning id, device_tokens.user_id, device_tokens.kind
$$;

create or replace function g2digest.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = g2digest, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning id, access_tokens.user_id
$$;

revoke all on function g2digest.redeem_pairing_code(text, text, text) from public, anon, authenticated;
revoke all on function g2digest.resolve_device_token(text) from public, anon, authenticated;
revoke all on function g2digest.resolve_access_token(text) from public, anon, authenticated;
grant execute on function g2digest.redeem_pairing_code(text, text, text) to service_role;
grant execute on function g2digest.resolve_device_token(text) to service_role;
grant execute on function g2digest.resolve_access_token(text) to service_role;
