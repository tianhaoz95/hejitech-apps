-- Folio, declarative (supabase/README.md): everything lives in the `folio` schema.
-- Generate migrations with scripts/db_migration.sh folio <what>.
--
-- Artifacts that any agent can create, read, edit and review over MCP. An artifact is a tiny
-- repository: immutable versions (a manifest of path -> blob hash), blobs stored once per artifact
-- (text in `blobs.text`, bytes in the `folio` Storage bucket), suggestions (proposed edit ops against
-- a base version), comments and an activity feed. Every write goes through the site's Worker with
-- the service key (it checks roles); clients only ever read through the Worker too, so RLS here is a
-- backstop: signed-in users can read the rows of artifacts they belong to.

create schema folio;
grant usage on schema folio to anon, authenticated, service_role;

create table folio.artifacts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'link')),
  head_version integer not null default 0,
  forked_from uuid references folio.artifacts(id) on delete set null,
  forked_from_version integer,
  -- Counters for per-artifact numbers (suggestion #1, #2, …).
  next_suggestion integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index artifacts_owner on folio.artifacts(owner_id, updated_at desc);

-- People besides the owner who can open an artifact.
create table folio.members (
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (artifact_id, user_id)
);
create index members_user on folio.members(user_id);

-- Share links: whoever opens one while signed in becomes a member with its role.
create table folio.invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references auth.users(id) on delete cascade,
  uses integer not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index invites_artifact on folio.invites(artifact_id);

-- File contents, once per artifact and hash. Text inline; bytes in Storage at <artifact>/<hash>.
create table folio.blobs (
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  hash text not null,
  size integer not null,
  text text,
  in_storage boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (artifact_id, hash)
);

create table folio.versions (
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  number integer not null,
  parent integer,
  manifest jsonb not null,
  message text not null default '',
  author_id uuid references auth.users(id) on delete set null,
  -- Who did it: the agent's name (or "Web" for the site) and how it connected.
  agent text not null,
  model text,
  via text not null check (via in ('web', 'mcp', 'api')),
  kind text not null default 'edit' check (kind in ('create', 'edit', 'suggestion', 'restore', 'fork')),
  suggestion_id uuid,
  restored_from integer,
  created_at timestamptz not null default now(),
  primary key (artifact_id, number)
);

create table folio.suggestions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  number integer not null,
  base_version integer not null,
  title text not null,
  rationale text not null default '',
  ops jsonb not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'withdrawn')),
  author_id uuid references auth.users(id) on delete set null,
  agent text not null,
  model text,
  via text not null check (via in ('web', 'mcp', 'api')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_agent text,
  resolution_note text,
  result_version integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (artifact_id, number)
);
create index suggestions_open on folio.suggestions(artifact_id, status);

create table folio.comments (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  version integer,
  suggestion_id uuid references folio.suggestions(id) on delete cascade,
  parent_id uuid references folio.comments(id) on delete cascade,
  path text,
  -- Where it points: {"selector": "#buy"} | {"text": "quoted words"} | {"line": 12, "end_line": 14}.
  anchor jsonb,
  body text not null,
  author_id uuid references auth.users(id) on delete set null,
  agent text not null,
  model text,
  via text not null check (via in ('web', 'mcp', 'api')),
  resolved boolean not null default false,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index comments_artifact on folio.comments(artifact_id, created_at);

-- Everything that happened to an artifact, newest last (the activity feed agents poll).
create table folio.events (
  id bigint generated always as identity primary key,
  artifact_id uuid not null references folio.artifacts(id) on delete cascade,
  kind text not null,
  version integer,
  suggestion_number integer,
  comment_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  agent text not null,
  via text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index events_artifact on folio.events(artifact_id, id);

-- Personal access tokens for agents that can't do OAuth (MCP). Only a SHA-256 hash is stored.
create table folio.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on folio.access_tokens(user_id);

-- ---------------------------------------------------------------- access rules

alter table folio.artifacts enable row level security;
alter table folio.members enable row level security;
alter table folio.invites enable row level security;
alter table folio.blobs enable row level security;
alter table folio.versions enable row level security;
alter table folio.suggestions enable row level security;
alter table folio.comments enable row level security;
alter table folio.events enable row level security;
alter table folio.access_tokens enable row level security;

create or replace function folio.is_member(p_artifact uuid)
returns boolean
language sql stable security definer set search_path = folio as $$
  select exists (select 1 from artifacts a where a.id = p_artifact and a.owner_id = auth.uid())
      or exists (select 1 from members m where m.artifact_id = p_artifact and m.user_id = auth.uid())
$$;
revoke all on function folio.is_member(uuid) from public, anon;
grant execute on function folio.is_member(uuid) to authenticated, service_role;

create policy "members read artifacts" on folio.artifacts for select using (folio.is_member(id));
create policy "members read members" on folio.members for select using (folio.is_member(artifact_id));
create policy "members read blobs" on folio.blobs for select using (folio.is_member(artifact_id));
create policy "members read versions" on folio.versions for select using (folio.is_member(artifact_id));
create policy "members read suggestions" on folio.suggestions for select using (folio.is_member(artifact_id));
create policy "members read comments" on folio.comments for select using (folio.is_member(artifact_id));
create policy "members read events" on folio.events for select using (folio.is_member(artifact_id));
create policy "own access tokens" on folio.access_tokens for select using (user_id = auth.uid());

grant select on folio.artifacts, folio.members, folio.blobs, folio.versions, folio.suggestions,
  folio.comments, folio.events, folio.access_tokens to authenticated;
grant select, insert, update, delete on all tables in schema folio to service_role;

-- ---------------------------------------------------------------- worker rpc (service role only)

create or replace function folio.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid, name text)
language sql security definer set search_path = folio, extensions as $$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id, access_tokens.name
$$;
revoke all on function folio.resolve_access_token(text) from public, anon, authenticated;
grant execute on function folio.resolve_access_token(text) to service_role;

-- Appends a version if the artifact's head is still p_base (optimistic concurrency): the one
-- place versions are created. Returns the new number, or raises 'stale:<head>' when someone else
-- committed first, so the caller can rebase.
create or replace function folio.commit_version(
  p_artifact uuid,
  p_base integer,
  p_manifest jsonb,
  p_message text,
  p_author uuid,
  p_agent text,
  p_model text,
  p_via text,
  p_kind text,
  p_suggestion uuid default null,
  p_restored_from integer default null
)
returns integer
language plpgsql security definer set search_path = folio as $$
declare
  v_head integer;
  v_next integer;
begin
  select head_version into v_head from artifacts where id = p_artifact for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_head <> p_base then
    raise exception 'stale:%', v_head;
  end if;
  v_next := v_head + 1;
  insert into versions (artifact_id, number, parent, manifest, message, author_id, agent, model, via, kind, suggestion_id, restored_from)
  values (p_artifact, v_next, nullif(v_head, 0), p_manifest, coalesce(p_message, ''), p_author, p_agent, p_model, p_via, p_kind, p_suggestion, p_restored_from);
  update artifacts set head_version = v_next, updated_at = now() where id = p_artifact;
  return v_next;
end;
$$;
revoke all on function folio.commit_version(uuid, integer, jsonb, text, uuid, text, text, text, text, uuid, integer) from public, anon, authenticated;
grant execute on function folio.commit_version(uuid, integer, jsonb, text, uuid, text, text, text, text, uuid, integer) to service_role;

-- Hands out the next suggestion number for an artifact.
create or replace function folio.next_suggestion_number(p_artifact uuid)
returns integer
language sql security definer set search_path = folio as $$
  update artifacts set next_suggestion = next_suggestion + 1 where id = p_artifact
  returning next_suggestion - 1
$$;
revoke all on function folio.next_suggestion_number(uuid) from public, anon, authenticated;
grant execute on function folio.next_suggestion_number(uuid) to service_role;
