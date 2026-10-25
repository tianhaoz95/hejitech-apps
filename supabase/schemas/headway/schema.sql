-- Headway, declarative (supabase/README.md): everything lives in the `headway` schema.
-- Generate migrations with scripts/db_migration.sh headway <what>.
--
-- Clients only read their own rows (RLS below). Every write goes through the site's Worker with the
-- service key, after the shared checks in @headway/core: settings (session), pairing (code), glasses
-- and agent tokens (only hashes are stored), push devices, tracked trains, and the cron's realtime
-- snapshot and sent-notification log.

create schema headway;
-- A non-public schema gets no Data API privileges by default; RLS below decides what rows clients see.
grant usage on schema headway to anon, authenticated, service_role;

-- A user's commute (morning/evening legs), alert choices and days. Created on first use (users are
-- shared by every app in the project: no trigger on auth.users). `settings` is checked by
-- checkSettings() in @headway/core before every write.
create table headway.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Short-lived single-use 6-digit codes shown in the iPhone app or on the web; the glasses plugin
-- trades one for a device token.
create table headway.pairing_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index pairing_codes_user on headway.pairing_codes(user_id);

-- Paired glasses (read the user's board, track a train). Revoking deletes the row.
create table headway.device_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index device_tokens_user on headway.device_tokens(user_id);

-- Personal access tokens for assistants that can't do OAuth (MCP). Only a hash is stored.
create table headway.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on headway.access_tokens(user_id);

-- iPhones that get alerts (APNs device tokens). `environment` is the APNs host the build talks to.
create table headway.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apns_token text not null unique,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  label text not null default 'iPhone',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_devices_user on headway.push_devices(user_id);

-- The train a user is riding (one at a time): the track view and the arrival alert.
create table headway.tracked_trips (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trip_id text not null,
  service_date text not null check (service_date ~ '^\d{8}$'),
  from_station text not null,
  to_station text not null,
  created_at timestamptz not null default now()
);

-- Notifications already sent (dedupe keys from the alert engine); the cron prunes old rows.
create table headway.sent_notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index sent_notifications_sent_at on headway.sent_notifications(sent_at);

-- The latest Caltrain realtime snapshot (511.org TripUpdates + ServiceAlerts), one row, written by
-- the Worker's cron and read by every board. Not visible to clients.
create table headway.realtime (
  id smallint primary key default 1 check (id = 1),
  fetched_at timestamptz not null,
  snapshot jsonb not null,
  error text
);

-- ---------------------------------------------------------------- access rules

alter table headway.profiles enable row level security;
alter table headway.pairing_codes enable row level security;
alter table headway.device_tokens enable row level security;
alter table headway.access_tokens enable row level security;
alter table headway.push_devices enable row level security;
alter table headway.tracked_trips enable row level security;
alter table headway.sent_notifications enable row level security;
alter table headway.realtime enable row level security;

create policy "own profile" on headway.profiles for select using (user_id = auth.uid());
create policy "own devices" on headway.device_tokens for select using (user_id = auth.uid());
create policy "own access tokens" on headway.access_tokens for select using (user_id = auth.uid());
create policy "own push devices" on headway.push_devices for select using (user_id = auth.uid());
create policy "own tracked trip" on headway.tracked_trips for select using (user_id = auth.uid());
-- pairing_codes, sent_notifications, realtime: no client access at all (the Worker owns them).

grant select on headway.profiles, headway.device_tokens, headway.access_tokens, headway.push_devices, headway.tracked_trips to authenticated;
grant select, insert, update, delete on all tables in schema headway to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

-- Redeems a pairing code (hash) for a new device token (hash) in one statement: single use, unexpired.
create or replace function headway.redeem_pairing_code(p_code_hash text, p_token_hash text, p_label text)
returns table (device_id uuid, user_id uuid)
language plpgsql security definer set search_path = headway, extensions as $$
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

-- Resolves a glasses token (hash) to its user, recording use. Unknown: no row.
create or replace function headway.resolve_device_token(p_token_hash text)
returns table (device_id uuid, user_id uuid)
language sql security definer set search_path = headway, extensions as $$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, device_tokens.user_id
$$;

create or replace function headway.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = headway, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$$;

revoke all on function headway.redeem_pairing_code(text, text, text) from public, anon, authenticated;
revoke all on function headway.resolve_device_token(text) from public, anon, authenticated;
revoke all on function headway.resolve_access_token(text) from public, anon, authenticated;
grant execute on function headway.redeem_pairing_code(text, text, text) to service_role;
grant execute on function headway.resolve_device_token(text) to service_role;
grant execute on function headway.resolve_access_token(text) to service_role;
