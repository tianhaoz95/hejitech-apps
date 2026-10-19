-- Wee Hours, declarative (supabase/README.md): everything lives in the `weehours` schema.
-- Generate migrations with scripts/db_migration.sh weehours <what>; the storage bucket and its
-- policies are data statements added to the migration by hand (see the init migration).
--
-- Household event log. Append-only: clients insert events and never update or delete them;
-- edits, undos and duplicate resolutions are events themselves (see projects/weehours/spec/event-types.json).

create schema weehours;
-- A non-public schema gets no Data API privileges by default; RLS below decides what rows clients see.
grant usage on schema weehours to anon, authenticated, service_role;

create table weehours.households (
  id uuid primary key,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- A household's children. `settings` holds per-child overrides (color, bottle_ml, default_feed);
-- archived children keep their log but leave the apps' child pickers.
create table weehours.babies (
  id uuid primary key,
  household_id uuid not null references weehours.households(id) on delete cascade,
  name text not null,
  birth_date date,
  settings jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table weehours.members (
  household_id uuid not null references weehours.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'parent' check (role in ('parent', 'caregiver')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index members_one_household on weehours.members(user_id);

create table weehours.invites (
  code text primary key,
  household_id uuid not null references weehours.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create table weehours.events (
  id uuid primary key,
  household_id uuid not null references weehours.households(id) on delete cascade,
  baby_id uuid not null,
  type text not null,
  fields jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  logged_at timestamptz not null,
  logged_by uuid not null,
  provenance jsonb not null,
  supersedes uuid,
  session_id uuid,
  seq bigint generated always as identity unique,
  received_at timestamptz not null default now(),
  constraint provenance_complete check (provenance ? 'surface' and provenance ? 'input')
);
create index events_household_seq on weehours.events(household_id, seq);
create index events_household_occurred on weehours.events(household_id, occurred_at);

-- Voice entries waiting for a phone (glasses upload audio here; any household phone processes).
create table weehours.captures (
  id uuid primary key,
  household_id uuid not null references weehours.households(id) on delete cascade,
  surface text not null,
  captured_at timestamptz not null,
  logged_by uuid not null,
  audio_path text,
  transcript text,
  attach_to uuid,
  baby_id uuid,                  -- the child the device was set to; a name in the transcript wins
  status text not null default 'pending' check (status in ('pending', 'needs_review', 'done', 'dismissed', 'failed')),
  interpretation jsonb,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index captures_open on weehours.captures(household_id, status);

create table weehours.entitlements (
  household_id uuid primary key references weehours.households(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  plan text check (plan in ('monthly', 'yearly', 'lifetime')),
  expires_at timestamptz,
  source text not null default 'storekit-sandbox',
  updated_at timestamptz not null default now()
);

-- Personal access tokens for MCP agents that cannot do OAuth. Only a hash is stored.
create table weehours.access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references weehours.households(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('read', 'write')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------- access rules

create or replace function weehours.my_household_id() returns uuid
language sql stable security definer set search_path = weehours, extensions as $$
  select household_id from weehours.members where user_id = auth.uid() limit 1
$$;

alter table weehours.households enable row level security;
alter table weehours.babies enable row level security;
alter table weehours.members enable row level security;
alter table weehours.invites enable row level security;
alter table weehours.events enable row level security;
alter table weehours.captures enable row level security;
alter table weehours.entitlements enable row level security;
alter table weehours.access_tokens enable row level security;

create policy "members read household" on weehours.households for select using (id = weehours.my_household_id());
create policy "members read babies" on weehours.babies for select using (household_id = weehours.my_household_id());
create policy "members read members" on weehours.members for select using (household_id = weehours.my_household_id());
create policy "members read entitlement" on weehours.entitlements for select using (household_id = weehours.my_household_id());

create policy "members read events" on weehours.events for select using (household_id = weehours.my_household_id());
create policy "members append events" on weehours.events for insert
  with check (household_id = weehours.my_household_id());
-- no update / delete policies: the log is append-only for clients

create policy "members read captures" on weehours.captures for select using (household_id = weehours.my_household_id());
create policy "members add captures" on weehours.captures for insert with check (household_id = weehours.my_household_id());
create policy "members process captures" on weehours.captures for update
  using (household_id = weehours.my_household_id()) with check (household_id = weehours.my_household_id());

create policy "own tokens" on weehours.access_tokens for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- household rpc

create or replace function weehours.create_household(
  p_id uuid, p_name text, p_baby_id uuid, p_baby_name text, p_birth_date date, p_settings jsonb, p_display_name text
) returns uuid
language plpgsql security definer set search_path = weehours, extensions as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then
    raise exception 'already in a household';
  end if;
  insert into households (id, name, settings) values (p_id, p_name, coalesce(p_settings, '{}'::jsonb));
  insert into babies (id, household_id, name, birth_date) values (p_baby_id, p_id, p_baby_name, p_birth_date);
  insert into members (household_id, user_id, display_name) values (p_id, auth.uid(), p_display_name);
  insert into entitlements (household_id) values (p_id);
  return p_id;
end $$;

-- The first active child: what single-child app builds read and rename.
create or replace function weehours.first_baby(p_household uuid) returns uuid
language sql stable security definer set search_path = weehours, extensions as $$
  select id from babies where household_id = p_household
  order by archived_at is not null, position, created_at limit 1
$$;

-- Builds from before several children rename "the" baby: only the first child now.
create or replace function weehours.update_household(
  p_id uuid, p_name text, p_baby_name text, p_birth_date date, p_settings jsonb
) returns void
language plpgsql security definer set search_path = weehours, extensions as $$
begin
  if p_id is distinct from my_household_id() then raise exception 'not a member'; end if;
  update households set name = p_name, settings = p_settings - 'babies' where id = p_id;
  update babies set name = p_baby_name, birth_date = p_birth_date where id = first_baby(p_id);
end $$;

-- Adds or updates the household's children (the app's `Baby` JSON: id, name, birth_date, position,
-- archived, plus per-child settings). Children left out are kept; they are archived, never deleted.
create or replace function weehours.save_babies(p_babies jsonb) returns void
language plpgsql security definer set search_path = weehours, extensions as $$
declare v_household uuid := my_household_id(); b jsonb;
begin
  if v_household is null then raise exception 'no household'; end if;
  for b in select * from jsonb_array_elements(p_babies) loop
    insert into babies as x (id, household_id, name, birth_date, settings, position, archived_at)
    values ((b->>'id')::uuid, v_household, coalesce(nullif(trim(b->>'name'), ''), 'Baby'), (b->>'birth_date')::date,
            b - 'id' - 'name' - 'birth_date' - 'position' - 'archived', coalesce((b->>'position')::int, 0),
            case when (b->>'archived')::boolean then now() end)
    on conflict (id) do update set
      name = excluded.name, birth_date = excluded.birth_date, settings = excluded.settings, position = excluded.position,
      archived_at = case when excluded.archived_at is null then null else coalesce(x.archived_at, excluded.archived_at) end
    where x.household_id = v_household;
  end loop;
end $$;

-- The household as the app's `Household` JSON: saved settings plus live members and children.
-- `baby_id`, `baby_name` and `birth_date` are the first active child, for single-child builds.
create or replace function weehours.my_household() returns jsonb
language sql stable security definer set search_path = weehours, extensions as $$
  select (h.settings - 'babies')
    || jsonb_build_object(
      'id', h.id, 'name', h.name,
      'baby_id', b.id, 'baby_name', b.name, 'birth_date', b.birth_date,
      'babies', (
        select jsonb_agg(c.settings || jsonb_build_object('id', c.id, 'name', c.name, 'birth_date', c.birth_date,
                                                          'position', c.position, 'archived', c.archived_at is not null)
                         order by c.position, c.created_at)
        from babies c where c.household_id = h.id),
      'caregivers', coalesce((
        select jsonb_agg(
          coalesce((select c from jsonb_array_elements(h.settings->'caregivers') c where c->>'id' = m.user_id::text), '{}'::jsonb)
          || jsonb_build_object('id', m.user_id, 'name', m.display_name)
        ) from members m where m.household_id = h.id), '[]'::jsonb))
  from households h join babies b on b.id = weehours.first_baby(h.id)
  where h.id = my_household_id()
  limit 1
$$;

create or replace function weehours.create_invite() returns text
language plpgsql security definer set search_path = weehours, extensions as $$
declare v_code text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into invites (code, household_id, created_by) values (v_code, my_household_id(), auth.uid());
  return v_code;
end $$;

-- Your name as your household sees it (Settings → Household → you).
create or replace function weehours.set_display_name(p_name text) returns void
language plpgsql security definer set search_path = weehours, extensions as $$
begin
  if nullif(trim(p_name), '') is null then raise exception 'empty name'; end if;
  update members set display_name = trim(p_name) where user_id = auth.uid() and household_id = my_household_id();
end $$;

create or replace function weehours.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = weehours, extensions as $$
declare v_household uuid;
begin
  select household_id into v_household from invites where code = upper(p_code) and expires_at > now();
  if v_household is null then raise exception 'invalid or expired invite'; end if;
  delete from members where user_id = auth.uid();
  insert into members (household_id, user_id, display_name) values (v_household, auth.uid(), p_display_name);
  return v_household;
end $$;

-- One-tap delete of the whole household's data (cascades to events, captures, tokens). Storage
-- refuses direct deletes from storage.objects, so clients remove the household's capture audio
-- through the Storage API first (members may delete under their household's folder).
create or replace function weehours.delete_household() returns void
language plpgsql security definer set search_path = weehours, extensions as $$
declare v_household uuid := my_household_id();
begin
  if v_household is null then return; end if;
  delete from households where id = v_household;
end $$;

-- ---------------------------------------------------------------- billing (dummy store)

create or replace function weehours.my_entitlement() returns jsonb
language sql stable security definer set search_path = weehours, extensions as $$
  select to_jsonb(e) - 'household_id' - 'source' - 'updated_at' from entitlements e where household_id = my_household_id()
$$;

-- Development stand-in for App Store server notifications: the client reports a StoreKit
-- sandbox purchase. Production replaces this with signed-transaction verification.
create or replace function weehours.record_purchase(p_plan text, p_expires_at timestamptz) returns void
language plpgsql security definer set search_path = weehours, extensions as $$
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  insert into entitlements (household_id, plan, expires_at, updated_at)
  values (my_household_id(), p_plan, case when p_plan = 'lifetime' then null else p_expires_at end, now())
  on conflict (household_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();
end $$;

-- ---------------------------------------------------------------- access tokens

create or replace function weehours.create_access_token(p_name text, p_scope text) returns text
language plpgsql security definer set search_path = weehours, extensions as $$
declare v_token text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_token := 'wh_' || encode(gen_random_bytes(24), 'hex');
  insert into access_tokens (user_id, household_id, name, scope, token_hash)
  values (auth.uid(), my_household_id(), p_name, p_scope, encode(digest(v_token, 'sha256'), 'hex'));
  return v_token;   -- shown once
end $$;

create or replace function weehours.revoke_access_token(p_id uuid) returns void
language sql security definer set search_path = weehours, extensions as $$
  update access_tokens set revoked_at = now() where id = p_id and user_id = auth.uid()
$$;

-- Deletes one of your revoked tokens; a live one has to be revoked first.
create or replace function weehours.delete_access_token(p_id uuid) returns void
language sql security definer set search_path = weehours, extensions as $$
  delete from access_tokens where id = p_id and user_id = auth.uid() and revoked_at is not null
$$;

-- Used by the MCP edge function (service role) to resolve a bearer token.
create or replace function weehours.resolve_access_token(p_token text) returns table (user_id uuid, household_id uuid, scope text)
language plpgsql security definer set search_path = weehours, extensions as $$
begin
  return query
    update access_tokens t set last_used_at = now()
    where t.token_hash = encode(digest(p_token, 'sha256'), 'hex') and t.revoked_at is null
    returning t.user_id, t.household_id, t.scope;
end $$;
revoke execute on function weehours.resolve_access_token(text) from public, anon, authenticated;
-- Functions in a new schema have no Supabase default grants: only service_role (the Worker) may call this.
grant execute on function weehours.resolve_access_token(text) to service_role;

-- ---------------------------------------------------------------- privileges
grant select, insert, update, delete on all tables in schema weehours to authenticated, service_role;

-- ---------------------------------------------------------------- realtime
-- Phones and glasses subscribe to new events and captures. (Declared here, not hand-written in the
-- migration: the diff tool tracks publications and would otherwise generate drops.)
alter publication supabase_realtime add table weehours.events;
alter publication supabase_realtime add table weehours.captures;
