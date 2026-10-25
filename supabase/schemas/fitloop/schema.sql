-- FitLoop, declarative (supabase/README.md): everything lives in the `fitloop` schema.
-- Generate migrations with scripts/db_migration.sh fitloop <what>; the storage bucket is a data
-- statement added to the init migration by hand.
--
-- Clients only read their own rows (RLS below). Every write goes through the site's Worker with the
-- service key, after the shared checks in @fitloop/core: settings, check-ins, feedback and vitals
-- (session or glasses token), plans and feedback replies (the user's agent over MCP), pairing,
-- glasses and agent tokens (only hashes are stored), progress photos (Storage, bucket `fitloop`).

create schema fitloop;
grant usage on schema fitloop to anon, authenticated, service_role;

-- Settings (vitals and agent-access switches, reminders, glasses) and the "about me" every agent
-- reads. Created on first use (users are shared by every app: no trigger on auth.users).
create table fitloop.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Plan versions the agent published; the newest is current from its starts_on.
create table fitloop.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  plan jsonb not null,
  change_note text not null default '',
  starts_on date not null,
  published_at timestamptz not null default now(),
  published_by text not null default 'agent',
  unique (user_id, version)
);

-- What the user did: append-only (the latest per ref and date wins).
create table fitloop.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  ref text not null,
  kind text not null check (kind in ('set', 'exercise', 'workout', 'meal')),
  status text not null check (status in ('done', 'partial', 'skipped', 'swapped')),
  plan_version integer not null,
  data jsonb not null default '{}'::jsonb,
  note text,
  source text not null default 'phone',
  at timestamptz not null default now()
);
create index checkins_user_date on fitloop.checkins(user_id, date);

-- Notes for the agent, left in the moment; the agent replies and marks them addressed.
create table fitloop.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date,
  ref text,
  plan_version integer,
  text text not null default '',
  tags text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'addressed')),
  agent_reply text,
  source text not null default 'phone',
  created_at timestamptz not null default now(),
  addressed_at timestamptz
);
create index feedback_user on fitloop.feedback(user_id, created_at desc);

-- One value per day, metric and source (Apple Health daily summary, the Watch, typed in).
create table fitloop.vitals (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  metric text not null,
  value numeric not null,
  source text not null check (source in ('health', 'manual', 'watch')),
  updated_at timestamptz not null default now(),
  primary key (user_id, date, metric, source)
);

-- Progress photos: files in the `fitloop` bucket at <user_id>/photos/<id>.jpg.
create table fitloop.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  path text not null,
  note text,
  created_at timestamptz not null default now()
);
create index photos_user on fitloop.photos(user_id, taken_on desc);

-- The live workout: heart rate from the Watch (through the iPhone) for the glasses, a few seconds old at most.
create table fitloop.live (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hr integer,
  workout_ref text,
  updated_at timestamptz not null default now()
);

create table fitloop.pairing_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index pairing_codes_user on fitloop.pairing_codes(user_id);

create table fitloop.device_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index device_tokens_user on fitloop.device_tokens(user_id);

create table fitloop.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on fitloop.access_tokens(user_id);

-- ---------------------------------------------------------------- access rules

alter table fitloop.profiles enable row level security;
alter table fitloop.plans enable row level security;
alter table fitloop.checkins enable row level security;
alter table fitloop.feedback enable row level security;
alter table fitloop.vitals enable row level security;
alter table fitloop.photos enable row level security;
alter table fitloop.live enable row level security;
alter table fitloop.pairing_codes enable row level security;
alter table fitloop.device_tokens enable row level security;
alter table fitloop.access_tokens enable row level security;

create policy "own profile" on fitloop.profiles for select using (user_id = auth.uid());
create policy "own plans" on fitloop.plans for select using (user_id = auth.uid());
create policy "own checkins" on fitloop.checkins for select using (user_id = auth.uid());
create policy "own feedback" on fitloop.feedback for select using (user_id = auth.uid());
create policy "own vitals" on fitloop.vitals for select using (user_id = auth.uid());
create policy "own photos" on fitloop.photos for select using (user_id = auth.uid());
create policy "own live" on fitloop.live for select using (user_id = auth.uid());
create policy "own devices" on fitloop.device_tokens for select using (user_id = auth.uid());
create policy "own access tokens" on fitloop.access_tokens for select using (user_id = auth.uid());
-- pairing_codes: no client access (the Worker issues and redeems them).

grant select on fitloop.profiles, fitloop.plans, fitloop.checkins, fitloop.feedback, fitloop.vitals, fitloop.photos,
  fitloop.live, fitloop.device_tokens, fitloop.access_tokens to authenticated;
grant select, insert, update, delete on all tables in schema fitloop to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

create or replace function fitloop.redeem_pairing_code(p_code_hash text, p_token_hash text, p_label text)
returns table (device_id uuid, user_id uuid)
language plpgsql security definer set search_path = fitloop, extensions as $$
declare v_user uuid;
begin
  update pairing_codes set used_at = now()
  where code_hash = p_code_hash and used_at is null and expires_at > now()
  returning pairing_codes.user_id into v_user;
  if v_user is null then return; end if;
  return query
    insert into device_tokens (token_hash, user_id, label)
    values (p_token_hash, v_user, left(coalesce(nullif(trim(p_label), ''), 'Even G2'), 60))
    returning device_tokens.id, device_tokens.user_id;
end $$;

create or replace function fitloop.resolve_device_token(p_token_hash text)
returns table (device_id uuid, user_id uuid)
language sql security definer set search_path = fitloop, extensions as $$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, device_tokens.user_id
$$;

create or replace function fitloop.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = fitloop, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$$;

-- The next plan version for a user, published atomically (no two publishes get the same number).
create or replace function fitloop.publish_plan(p_user uuid, p_plan jsonb, p_change_note text, p_starts_on date, p_by text)
returns integer
language plpgsql security definer set search_path = fitloop, extensions as $$
declare v_version integer;
begin
  perform pg_advisory_xact_lock(hashtext('fitloop.plans:' || p_user::text));
  select coalesce(max(version), 0) + 1 into v_version from plans where user_id = p_user;
  insert into plans (user_id, version, plan, change_note, starts_on, published_by)
  values (p_user, v_version, p_plan, coalesce(p_change_note, ''), p_starts_on, coalesce(p_by, 'agent'));
  return v_version;
end $$;

revoke all on function fitloop.redeem_pairing_code(text, text, text) from public, anon, authenticated;
revoke all on function fitloop.resolve_device_token(text) from public, anon, authenticated;
revoke all on function fitloop.resolve_access_token(text) from public, anon, authenticated;
revoke all on function fitloop.publish_plan(uuid, jsonb, text, date, text) from public, anon, authenticated;
grant execute on function fitloop.redeem_pairing_code(text, text, text) to service_role;
grant execute on function fitloop.resolve_device_token(text) to service_role;
grant execute on function fitloop.resolve_access_token(text) to service_role;
grant execute on function fitloop.publish_plan(uuid, jsonb, text, date, text) to service_role;
