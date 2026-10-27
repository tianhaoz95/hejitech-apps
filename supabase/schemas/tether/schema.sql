-- Tether, declarative (supabase/README.md): everything lives in the `tether` schema.
-- Generate migrations with scripts/db_migration.sh tether <what>.
--
-- Non-secret workspace sync only (PRD §6, §14): saved SSH host metadata (hostname, port, username,
-- auth type — never passwords, passphrases, or private keys), tiling pane layouts, and bookmarks.
-- Clients read their own rows (RLS below). Every write goes through the site's Worker with the
-- service key after validation in @tether/core.

create schema tether;
grant usage on schema tether to anon, authenticated, service_role;

-- A user's workspace settings (terminal font size, landscape lock, search engine) and active pane
-- tree layout JSON. Created lazily on first use (no trigger on auth.users).
create table tether.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tree jsonb not null,
  settings jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Saved SSH host metadata (PRD §6.4). Passwords, passphrases, and private keys NEVER leave the
-- device's Keychain / Keystore (PRD §14) and are rejected by @tether/core's validateSshHost().
create table tether.hosts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  label text,
  host text not null,
  port integer not null default 22 check (port >= 1 and port <= 65535),
  username text not null,
  auth text not null check (auth in ('key', 'password', 'keyAndPassword')),
  key_id text,
  remember_password boolean not null default false,
  auto_reconnect_on_display_reconnect boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index hosts_user on tether.hosts(user_id);

-- Saved browser bookmarks (PRD §9.4).
create table tether.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  url text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index bookmarks_user on tether.bookmarks(user_id);

-- Personal access tokens for assistants that can't do OAuth (MCP). Only a SHA-256 hash is stored.
create table tether.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on tether.access_tokens(user_id);

-- ---------------------------------------------------------------- access rules

alter table tether.workspaces enable row level security;
alter table tether.hosts enable row level security;
alter table tether.bookmarks enable row level security;
alter table tether.access_tokens enable row level security;

create policy "own workspace" on tether.workspaces for select using (user_id = auth.uid());
create policy "own hosts" on tether.hosts for select using (user_id = auth.uid());
create policy "own bookmarks" on tether.bookmarks for select using (user_id = auth.uid());
create policy "own access tokens" on tether.access_tokens for select using (user_id = auth.uid());

grant select on tether.workspaces, tether.hosts, tether.bookmarks, tether.access_tokens to authenticated;
grant select, insert, update, delete on all tables in schema tether to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

create or replace function tether.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = tether, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$$;

revoke all on function tether.resolve_access_token(text) from public, anon, authenticated;
grant execute on function tether.resolve_access_token(text) to service_role;
