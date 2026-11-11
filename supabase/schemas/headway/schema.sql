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

-- Phones that get alerts: an iPhone's APNs device token or an Android phone's FCM registration token
-- (exactly one of the two). `environment` is the APNs host the build talks to (unused for Android).
create table headway.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apns_token text unique,
  fcm_token text unique,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  label text not null default 'iPhone',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_devices_one_token check ((apns_token is null) <> (fcm_token is null))
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

-- Public shareable live ETA links for tracked trips.
create table headway.eta_shares (
  token_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id text not null,
  service_date text not null check (service_date ~ '^\d{8}$'),
  from_station text not null,
  to_station text not null,
  name text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index eta_shares_user on headway.eta_shares(user_id);

-- ActivityKit push tokens for Live Activities (start tokens and update tokens).
create table headway.activity_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('start', 'update')),
  token text not null,
  trip_id text,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, token)
);
create index activity_tokens_user on headway.activity_tokens(user_id);

-- ---------------------------------------------------------------- family groups
-- One group per account (family_members.user_id is the primary key), at most 8 people counting pending
-- invites (the Worker checks). Everything a member shares is off until they turn it on and pick who
-- sees it (`shares`: kind -> viewer user ids); each viewer picks what to be told about (`follows`:
-- sharer id -> { notify: kinds, live }). Only the current state is kept: a ride is read from
-- tracked_trips or the on-train KV session when asked, and leaving deletes the row, so what you
-- shared disappears at once. The owner leaving deletes the group (cascade).
create table headway.family_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table headway.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  group_id uuid not null references headway.family_groups(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  display_name text not null check (char_length(display_name) between 1 and 20),
  shares jsonb not null default '{}'::jsonb,
  follows jsonb not null default '{}'::jsonb,
  -- A manual status ({ code, set_at, until }, epoch ms), shown until `until`.
  status jsonb,
  joined_at timestamptz not null default now()
);
create index family_members_group on headway.family_members(group_id);

-- Invites by email, accepted in the app by whoever signs in with that address. An address that isn't
-- a Headway user just waits (the owner sees "Pending") until it expires.
create table headway.family_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references headway.family_groups(id) on delete cascade,
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (group_id, email)
);
create index family_invites_email on headway.family_invites(email);

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
alter table headway.eta_shares enable row level security;
alter table headway.activity_tokens enable row level security;
alter table headway.realtime enable row level security;
alter table headway.family_groups enable row level security;
alter table headway.family_members enable row level security;
alter table headway.family_invites enable row level security;

create policy "own profile" on headway.profiles for select using (user_id = auth.uid());
create policy "own devices" on headway.device_tokens for select using (user_id = auth.uid());
create policy "own access tokens" on headway.access_tokens for select using (user_id = auth.uid());
create policy "own push devices" on headway.push_devices for select using (user_id = auth.uid());
create policy "own tracked trip" on headway.tracked_trips for select using (user_id = auth.uid());
create policy "own eta shares" on headway.eta_shares for select using (user_id = auth.uid());
create policy "own activity tokens" on headway.activity_tokens for select using (user_id = auth.uid());
create policy "own family membership" on headway.family_members for select using (user_id = auth.uid());
-- pairing_codes, sent_notifications, realtime, family_groups, family_invites: no client access at all (the
-- Worker owns them; a member's view of the others is computed by the Worker from what each one shares).

grant select on headway.profiles, headway.device_tokens, headway.access_tokens, headway.push_devices, headway.tracked_trips, headway.eta_shares, headway.activity_tokens, headway.family_members to authenticated;
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

-- Headway users signed in with this email who have an iPhone registered for alerts: an invite's push.
-- Only Headway's own rows decide (the shared auth pool also holds every other HEJI app's users).
create or replace function headway.push_users_by_email(p_email text)
returns table (user_id uuid)
language sql stable security definer set search_path = headway, extensions as $$
  select u.id from auth.users u
  where lower(u.email) = lower(p_email)
    and exists (select 1 from headway.push_devices d where d.user_id = u.id)
$$;
revoke all on function headway.push_users_by_email(text) from public, anon, authenticated;
grant execute on function headway.push_users_by_email(text) to service_role;
