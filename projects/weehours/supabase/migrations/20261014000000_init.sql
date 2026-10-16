-- Household event log. Append-only: clients insert events and never update or delete them;
-- edits, undos and duplicate resolutions are events themselves (see spec/event-types.json).

create extension if not exists pgcrypto;

create table public.households (
  id uuid primary key,
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.babies (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  birth_date date,
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'parent' check (role in ('parent', 'caregiver')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index members_one_household on public.members(user_id);

create table public.invites (
  code text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create table public.events (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
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
create index events_household_seq on public.events(household_id, seq);
create index events_household_occurred on public.events(household_id, occurred_at);

-- Voice entries waiting for a phone (glasses upload audio here; any household phone processes).
create table public.captures (
  id uuid primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  surface text not null,
  captured_at timestamptz not null,
  logged_by uuid not null,
  audio_path text,
  transcript text,
  attach_to uuid,
  status text not null default 'pending' check (status in ('pending', 'needs_review', 'done', 'dismissed', 'failed')),
  interpretation jsonb,
  processed_by uuid,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index captures_open on public.captures(household_id, status);

create table public.entitlements (
  household_id uuid primary key references public.households(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  plan text check (plan in ('monthly', 'yearly', 'lifetime')),
  expires_at timestamptz,
  source text not null default 'storekit-sandbox',
  updated_at timestamptz not null default now()
);

-- Personal access tokens for MCP agents that cannot do OAuth. Only a hash is stored.
create table public.access_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('read', 'write')),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- ---------------------------------------------------------------- access rules

create or replace function public.my_household_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select household_id from public.members where user_id = auth.uid() limit 1
$$;

alter table public.households enable row level security;
alter table public.babies enable row level security;
alter table public.members enable row level security;
alter table public.invites enable row level security;
alter table public.events enable row level security;
alter table public.captures enable row level security;
alter table public.entitlements enable row level security;
alter table public.access_tokens enable row level security;

create policy "members read household" on public.households for select using (id = public.my_household_id());
create policy "members read babies" on public.babies for select using (household_id = public.my_household_id());
create policy "members read members" on public.members for select using (household_id = public.my_household_id());
create policy "members read entitlement" on public.entitlements for select using (household_id = public.my_household_id());

create policy "members read events" on public.events for select using (household_id = public.my_household_id());
create policy "members append events" on public.events for insert
  with check (household_id = public.my_household_id());
-- no update / delete policies: the log is append-only for clients

create policy "members read captures" on public.captures for select using (household_id = public.my_household_id());
create policy "members add captures" on public.captures for insert with check (household_id = public.my_household_id());
create policy "members process captures" on public.captures for update
  using (household_id = public.my_household_id()) with check (household_id = public.my_household_id());

create policy "own tokens" on public.access_tokens for select using (user_id = auth.uid());

-- ---------------------------------------------------------------- household rpc

create or replace function public.create_household(
  p_id uuid, p_name text, p_baby_id uuid, p_baby_name text, p_birth_date date, p_settings jsonb, p_display_name text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
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

create or replace function public.update_household(
  p_id uuid, p_name text, p_baby_name text, p_birth_date date, p_settings jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_id is distinct from my_household_id() then raise exception 'not a member'; end if;
  update households set name = p_name, settings = p_settings where id = p_id;
  update babies set name = p_baby_name, birth_date = p_birth_date where household_id = p_id;
end $$;

-- The household as the app's `Household` JSON: saved settings plus live members and baby.
create or replace function public.my_household() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select h.settings
    || jsonb_build_object(
      'id', h.id, 'name', h.name,
      'baby_id', b.id, 'baby_name', b.name, 'birth_date', b.birth_date,
      'caregivers', coalesce((
        select jsonb_agg(
          coalesce((select c from jsonb_array_elements(h.settings->'caregivers') c where c->>'id' = m.user_id::text), '{}'::jsonb)
          || jsonb_build_object('id', m.user_id, 'name', m.display_name)
        ) from members m where m.household_id = h.id), '[]'::jsonb))
  from households h join babies b on b.household_id = h.id
  where h.id = my_household_id()
  limit 1
$$;

create or replace function public.create_invite() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into invites (code, household_id, created_by) values (v_code, my_household_id(), auth.uid());
  return v_code;
end $$;

create or replace function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_household uuid;
begin
  select household_id into v_household from invites where code = upper(p_code) and expires_at > now();
  if v_household is null then raise exception 'invalid or expired invite'; end if;
  delete from members where user_id = auth.uid();
  insert into members (household_id, user_id, display_name) values (v_household, auth.uid(), p_display_name);
  return v_household;
end $$;

-- One-tap delete of the whole household's data (cascades to events, captures, tokens).
create or replace function public.delete_household() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_household uuid := my_household_id();
begin
  if v_household is null then return; end if;
  delete from storage.objects where bucket_id = 'captures' and name like v_household::text || '/%';
  delete from households where id = v_household;
end $$;

-- ---------------------------------------------------------------- billing (dummy store)

create or replace function public.my_entitlement() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(e) - 'household_id' - 'source' - 'updated_at' from entitlements e where household_id = my_household_id()
$$;

-- Development stand-in for App Store server notifications: the client reports a StoreKit
-- sandbox purchase. Production replaces this with signed-transaction verification.
create or replace function public.record_purchase(p_plan text, p_expires_at timestamptz) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  insert into entitlements (household_id, plan, expires_at, updated_at)
  values (my_household_id(), p_plan, case when p_plan = 'lifetime' then null else p_expires_at end, now())
  on conflict (household_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();
end $$;

-- ---------------------------------------------------------------- access tokens

create or replace function public.create_access_token(p_name text, p_scope text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_token := 'wh_' || encode(gen_random_bytes(24), 'hex');
  insert into access_tokens (user_id, household_id, name, scope, token_hash)
  values (auth.uid(), my_household_id(), p_name, p_scope, encode(digest(v_token, 'sha256'), 'hex'));
  return v_token;   -- shown once
end $$;

create or replace function public.revoke_access_token(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update access_tokens set revoked_at = now() where id = p_id and user_id = auth.uid()
$$;

-- Used by the MCP edge function (service role) to resolve a bearer token.
create or replace function public.resolve_access_token(p_token text) returns table (user_id uuid, household_id uuid, scope text)
language plpgsql security definer set search_path = public, extensions as $$
begin
  return query
    update access_tokens t set last_used_at = now()
    where t.token_hash = encode(digest(p_token, 'sha256'), 'hex') and t.revoked_at is null
    returning t.user_id, t.household_id, t.scope;
end $$;
revoke execute on function public.resolve_access_token(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- storage for capture audio

insert into storage.buckets (id, name, public) values ('captures', 'captures', false) on conflict do nothing;

create policy "household audio read" on storage.objects for select
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = public.my_household_id()::text);
create policy "household audio write" on storage.objects for insert
  with check (bucket_id = 'captures' and (storage.foldername(name))[1] = public.my_household_id()::text);
create policy "household audio delete" on storage.objects for delete
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = public.my_household_id()::text);

-- realtime: phones and glasses subscribe to new events and captures
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.captures;
