-- Polymath, declarative (supabase/README.md): everything lives in the `polymath` schema.
-- Generate migrations with scripts/db_migration.sh polymath <what>.
--
-- User preferences and profile sync only: theme, editor font size, and local course metadata.
-- Course contents and exercises live strictly local-first on the user's filesystem.

create schema polymath;
grant usage on schema polymath to anon, authenticated, service_role;

-- A user's profile and desktop app preferences. Created lazily on first use.
create table polymath.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferences jsonb not null default '{"theme": "dark", "fontSize": 14, "autoRunTests": true}'::jsonb,
  recent_courses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personal access tokens for coding assistants that can't do OAuth (MCP). Only SHA-256 hash is stored.
create table polymath.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on polymath.access_tokens(user_id);

-- ---------------------------------------------------------------- access rules

alter table polymath.profiles enable row level security;
alter table polymath.access_tokens enable row level security;

create policy "own profile" on polymath.profiles for select using (user_id = auth.uid());
create policy "own access tokens" on polymath.access_tokens for select using (user_id = auth.uid());

grant select, update on polymath.profiles to authenticated;
grant select on polymath.access_tokens to authenticated;
grant select, insert, update, delete on all tables in schema polymath to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

create or replace function polymath.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = polymath, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$$;

revoke all on function polymath.resolve_access_token(text) from public, anon, authenticated;
grant execute on function polymath.resolve_access_token(text) to service_role;
