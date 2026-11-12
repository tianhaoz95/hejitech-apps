-- HQ, declarative (supabase/README.md): everything lives in the `hq` schema.
-- Generate migrations with scripts/db_migration.sh hq <what>.
--
-- A workspace is one repository and the people who work on it (PRD §10). Every row carries its
-- workspace_id. Members read their workspaces' rows (RLS below); every write goes through HQ's
-- Worker with the service key, after it checks the caller's role (projects/hq/services/web).

create schema hq;
grant usage on schema hq to anon, authenticated, service_role;

create table hq.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  -- owner/name on GitHub; the synced .hq/ policy must name the same repo.
  repo text not null check (repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  policy jsonb,
  commit_sha text,
  synced_at timestamptz,
  paused boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table hq.members (
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'approver', 'viewer')),
  email text,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index members_user on hq.members(user_id);

-- Invite links: only a SHA-256 hash of the code is stored. Single use, expiring.
create table hq.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  code_hash text not null unique,
  role text not null check (role in ('admin', 'approver', 'viewer')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
create index invites_workspace on hq.invites(workspace_id);

-- On-demand requests: what a person asked HQ for (projects/hq/packages/core/src/request.ts). An
-- agent claims one (a lease), files cards that carry its id, and answers in the thread.
create table hq.requests (
  id text primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  project text,
  body text not null,
  status text not null check (status in ('open', 'claimed', 'answered', 'closed')),
  outcome text check (outcome in ('proposed', 'question', 'declined', 'note')),
  requested_by text not null,
  claimed_by text,
  claimed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index requests_workspace_status on hq.requests(workspace_id, status, created_at desc);

create table hq.request_messages (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  request_id text not null references hq.requests(id) on delete cascade,
  author text not null,
  kind text not null check (kind in ('reply', 'answer', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index request_messages_request on hq.request_messages(request_id, id);

-- Proposal cards (projects/hq/packages/core/src/card.ts).
create table hq.cards (
  id text primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  repo text not null,
  project text not null,
  kind text not null,
  title text not null,
  why text not null,
  evidence jsonb not null,
  plan text not null,
  verify text not null,
  tier text not null check (tier in ('L0', 'L1', 'L2', 'L3')),
  effort text not null,
  risk text not null,
  risk_reason text,
  verbs jsonb not null default '[]',
  source jsonb not null default '{}',
  dedupe_key text,
  -- Drawings shown in a sandboxed frame: [{ id, title, html, height }].
  figures jsonb not null default '[]',
  -- The request this card answers, if a person asked for it.
  request_id text references hq.requests(id) on delete set null,
  status text not null,
  priority integer not null default 0,
  decided_by text,
  branch text,
  pr_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_workspace_status on hq.cards(workspace_id, status, priority desc);
create index cards_workspace_dedupe on hq.cards(workspace_id, dedupe_key);
create index cards_request on hq.cards(request_id) where request_id is not null;

create table hq.comments (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  card_id text not null references hq.cards(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index comments_card on hq.comments(card_id, id);

create table hq.decisions (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  card_id text not null references hq.cards(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  reason text,
  by text not null,
  at timestamptz not null default now()
);
create index decisions_workspace on hq.decisions(workspace_id, at desc);

-- Evidence added after the proposal: build results, screenshots, the reviewer's verdict.
create table hq.attachments (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  card_id text not null references hq.cards(id) on delete cascade,
  phase text not null,
  evidence jsonb not null,
  file_key text,
  by text not null,
  at timestamptz not null default now()
);
create index attachments_card on hq.attachments(card_id, id);

-- Work for runners: scout, ceo, build, review, reply, request, verb, health.
create table hq.runs (
  id text primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  kind text not null,
  project text,
  scout text,
  card_id text references hq.cards(id) on delete cascade,
  request_id text references hq.requests(id) on delete cascade,
  verb text,
  args jsonb not null default '{}',
  runs_on text not null default 'any',
  agent text,
  status text not null,
  requested_by text not null,
  runner text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  summary text,
  output text,
  cost_usd numeric not null default 0,
  session text
);
create index runs_workspace_status on hq.runs(workspace_id, status, created_at);

create table hq.health (
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  project text not null,
  data jsonb not null,
  ok boolean not null,
  at timestamptz not null default now(),
  primary key (workspace_id, project)
);

-- Runner and agent tokens (hq_run_…, hq_agt_…): only a SHA-256 hash is stored.
create table hq.tokens (
  id text primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  name text not null,
  role text not null check (role in ('runner', 'agent')),
  hash text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index tokens_workspace on hq.tokens(workspace_id);

create table hq.audit (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references hq.workspaces(id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  target text,
  detail jsonb
);
create index audit_workspace on hq.audit(workspace_id, id desc);

-- ---------------------------------------------------------------- access rules

-- Is the signed-in user a member of this workspace (with one of these roles)? Security definer so
-- policies can read hq.members without granting it.
create or replace function hq.has_role(p_workspace uuid, p_roles text[] default array['admin', 'approver', 'viewer'])
returns boolean
language sql stable security definer set search_path = hq as $$
  select exists (
    select 1 from members
    where workspace_id = p_workspace and user_id = auth.uid() and role = any (p_roles)
  )
$$;
revoke all on function hq.has_role(uuid, text[]) from public, anon;
grant execute on function hq.has_role(uuid, text[]) to authenticated, service_role;

alter table hq.workspaces enable row level security;
alter table hq.members enable row level security;
alter table hq.invites enable row level security;
alter table hq.requests enable row level security;
alter table hq.request_messages enable row level security;
alter table hq.cards enable row level security;
alter table hq.comments enable row level security;
alter table hq.decisions enable row level security;
alter table hq.attachments enable row level security;
alter table hq.runs enable row level security;
alter table hq.health enable row level security;
alter table hq.tokens enable row level security;
alter table hq.audit enable row level security;

create policy "members read their workspaces" on hq.workspaces for select using (hq.has_role(id));
create policy "members read members" on hq.members for select using (hq.has_role(workspace_id));
create policy "admins read invites" on hq.invites for select using (hq.has_role(workspace_id, array['admin']));
create policy "members read requests" on hq.requests for select using (hq.has_role(workspace_id));
create policy "members read request messages" on hq.request_messages for select using (hq.has_role(workspace_id));
create policy "members read cards" on hq.cards for select using (hq.has_role(workspace_id));
create policy "members read comments" on hq.comments for select using (hq.has_role(workspace_id));
create policy "members read decisions" on hq.decisions for select using (hq.has_role(workspace_id));
create policy "members read attachments" on hq.attachments for select using (hq.has_role(workspace_id));
create policy "members read runs" on hq.runs for select using (hq.has_role(workspace_id));
create policy "members read health" on hq.health for select using (hq.has_role(workspace_id));
create policy "admins read tokens" on hq.tokens for select using (hq.has_role(workspace_id, array['admin']));
create policy "admins read audit" on hq.audit for select using (hq.has_role(workspace_id, array['admin']));

grant select on all tables in schema hq to authenticated;
grant select, insert, update, delete on all tables in schema hq to service_role;
