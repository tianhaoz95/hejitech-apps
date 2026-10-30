-- Trading Plan Board, declarative (supabase/README.md): everything lives in the `tradeboard` schema.
-- Generate migrations with scripts/db_migration.sh tradeboard <what>.
--
-- Anyone can sign up; each user has their own private board: plans, policy, agents, executors,
-- receipts and audit log all carry user_id, and every function checks it. No client ever reads
-- these tables (no grants to anon or authenticated): the portal, the Board MCP and the executor API
-- all go through the Worker with the service key, so a user's portal and their agents read the same
-- rows (PRD §5.2.1). Every state change runs in a function below, in one transaction with its row
-- locks, so concurrent agents, the user and executors can't race past a rule. Audit events,
-- versions and receipts are append-only (triggers), except when a user deletes their account.

create schema tradeboard;
grant usage on schema tradeboard to service_role;

-- ---------------------------------------------------------------- accounts and credentials

-- One row per user of the board (created on first sign-in; users are shared by every HEJI app, so
-- no trigger on auth.users). The TOTP secret is encrypted by the Worker (AES-GCM, key in a Worker
-- secret) before it gets here.
create table tradeboard.accounts (
  user_id uuid primary key,
  email text not null,
  totp_secret_enc text,
  totp_pending_enc text,
  totp_enrolled_at timestamptz,
  totp_last_step bigint,
  created_at timestamptz not null default now()
);

-- Portal sessions (HttpOnly cookie). Only a hash of the cookie value is stored.
create table tradeboard.sessions (
  token_hash text primary key,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  user_agent text,
  revoked_at timestamptz
);
create index sessions_user on tradeboard.sessions(user_id);

-- Discussion agents (§3): first-class identities, per user. Revoking one cuts off its tokens and OAuth grants.
create table tradeboard.agents (
  user_id uuid not null,
  agent_id text not null check (agent_id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  display_name text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, agent_id)
);

-- Per-agent bearer tokens `tba_…` (§7). Hashes only.
create table tradeboard.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null,
  agent_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  foreign key (user_id, agent_id) references tradeboard.agents(user_id, agent_id)
);
create index agent_tokens_user on tradeboard.agent_tokens(user_id);

-- Executor credentials `tbx_…` (§7.2): a separate kind from agent tokens and the user's session.
create table tradeboard.executor_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null,
  executor_id text not null check (executor_id ~ '^[a-z0-9][a-z0-9._-]{0,47}$'),
  label text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index executor_tokens_user on tradeboard.executor_tokens(user_id);

-- ---------------------------------------------------------------- plans

create table tradeboard.plans (
  plan_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'debated', 'ready', 'approved', 'validated', 'executing', 'executed', 'failed', 'rejected', 'cancelled', 'stale', 'expired')),
  ticker text not null check (ticker ~ '^[A-Z]{1,5}(\.[A-Z]{1,2})?$'),
  side text not null default 'buy' check (side = 'buy'),
  order_ticket jsonb not null,
  thesis text not null,
  evidence text not null default '',
  risks_and_dissent text not null default '',
  invalidation text not null default '',
  created_at timestamptz not null default now(),
  -- The last material edit (a new version). Age and staleness count from here (§6.5.4).
  updated_at timestamptz not null default now(),
  -- Any activity (comments too), for "recent" sorting in the portal.
  last_activity_at timestamptz not null default now(),
  created_by_type text not null check (created_by_type in ('human', 'agent')),
  created_by_id text not null,
  create_idempotency_key text,
  valid_from timestamptz,
  valid_until timestamptz not null,
  quote_at timestamptz,
  quote_price numeric,
  quote_source text,
  current_version integer not null default 1,
  approval_id uuid,
  executor_claim_id uuid,
  claim_executor_id text,
  claim_idempotency_key text,
  claim_expires_at timestamptz,
  attempt_started_at timestamptz,
  -- Mode B (§10): the order went to the Robinhood app as a proposal; the user places it there.
  awaiting_manual boolean not null default false,
  reason_code text,
  reason_text text,
  is_demo boolean not null default false,
  unique (user_id, created_by_id, create_idempotency_key),
  check (valid_from is null or valid_from < valid_until)
);
create index plans_user_status on tradeboard.plans(user_id, status, updated_at desc);
create index plans_status on tradeboard.plans(status);

-- Every version's full snapshot, immutable (§6.4).
create table tradeboard.plan_versions (
  plan_id uuid not null references tradeboard.plans(plan_id),
  version integer not null,
  edited_by_type text not null,
  edited_by_id text not null,
  edited_at timestamptz not null default now(),
  diff_summary text not null,
  snapshot jsonb not null,
  primary key (plan_id, version)
);

create table tradeboard.comments (
  comment_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references tradeboard.plans(plan_id),
  version integer not null,
  author_type text not null check (author_type in ('human', 'agent', 'executor', 'system')),
  author_id text not null,
  body text not null check (length(body) between 1 and 10000),
  anchor text not null default 'general' check (anchor in ('thesis', 'evidence', 'risks_and_dissent', 'invalidation', 'order', 'general')),
  parent_comment_id uuid references tradeboard.comments(comment_id),
  mentioned_agent_id text,
  is_question boolean not null default false,
  question_status text check (question_status in ('open', 'resolved')),
  resolved_by text,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (is_question = (question_status is not null))
);
create index comments_plan on tradeboard.comments(plan_id, created_at);
create index comments_open on tradeboard.comments(plan_id) where question_status = 'open';

create table tradeboard.approvals (
  approval_id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references tradeboard.plans(plan_id),
  version integer not null,
  approved_by text not null default 'human' check (approved_by = 'human'),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  note text not null default '',
  voided_at timestamptz,
  void_reason text
);
create index approvals_plan on tradeboard.approvals(plan_id);

-- ---------------------------------------------------------------- policy, executor, receipts

create table tradeboard.policy_versions (
  user_id uuid not null,
  policy_version integer not null,
  policy jsonb not null,
  created_by text not null default 'human' check (created_by in ('human', 'system')),
  created_at timestamptz not null default now(),
  note text not null default '',
  primary key (user_id, policy_version)
);

-- Each user's switches for their executors (one row per user). Dry-run is on until the user passes
-- the live gate (§12.2) and turns it off; the first live order stays a small limit order until one
-- is verified.
create table tradeboard.control (
  user_id uuid primary key,
  paused boolean not null default false,
  killed boolean not null default false,
  dry_run boolean not null default true,
  approvals_mode text check (approvals_mode in ('A', 'B')),
  confirmed_account_mask text,
  funding_usd numeric,
  gate_policy_version integer,
  gate_confirmed_at timestamptz,
  live_trial_pending boolean not null default true,
  updated_at timestamptz not null default now()
);

create table tradeboard.executor_status (
  user_id uuid not null,
  executor_id text not null,
  last_heartbeat_at timestamptz not null default now(),
  mode text not null default 'dry_run' check (mode in ('dry_run', 'live')),
  paused boolean not null default false,
  dry_run boolean not null default true,
  policy_version integer,
  local_model_id text,
  model_check_enabled boolean not null default true,
  local_live_allowed boolean not null default false,
  robinhood_connected boolean not null default false,
  trade_approvals text not null default 'unknown' check (trade_approvals in ('on', 'off', 'unknown')),
  account_mask text,
  account_matches boolean,
  last_error text,
  version text,
  primary key (user_id, executor_id)
);

create table tradeboard.receipts (
  receipt_id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references tradeboard.plans(plan_id),
  version integer not null,
  claim_id uuid unique,
  executor_id text not null,
  attempted_at timestamptz not null default now(),
  mode text not null check (mode in ('dry_run', 'live', 'manual')),
  outcome text not null check (outcome in ('executed', 'simulated', 'rejected', 'failed', 'proposed')),
  reason_code text,
  reason_text text not null default '',
  robinhood_order_id text,
  filled_quantity numeric,
  filled_price numeric,
  policy_snapshot_id integer,
  details jsonb not null default '{}'::jsonb
);
create index receipts_plan on tradeboard.receipts(plan_id);
create index receipts_user_time on tradeboard.receipts(user_id, attempted_at desc);

create table tradeboard.audit_log (
  event_id bigint generated always as identity primary key,
  user_id uuid not null,
  actor_type text not null,
  actor_id text not null,
  action text not null,
  plan_id uuid,
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_plan on tradeboard.audit_log(plan_id, event_id);
create index audit_user on tradeboard.audit_log(user_id, event_id);

-- ---------------------------------------------------------------- append-only (§11.7)

-- Refuses changes to history. The only exception is delete_account() below, which sets a
-- transaction-local flag while it removes one user's rows.
create or replace function tradeboard.forbid_change() returns trigger
language plpgsql set search_path = tradeboard as $$
begin
  if current_setting('tradeboard.deleting_account', true) = 'on' and tg_op = 'DELETE' then return old; end if;
  raise exception '% is append-only: % refused', tg_table_name, tg_op;
end $$;

create trigger audit_append_only before update or delete on tradeboard.audit_log for each row execute function tradeboard.forbid_change();
create trigger versions_append_only before update or delete on tradeboard.plan_versions for each row execute function tradeboard.forbid_change();
create trigger receipts_append_only before update or delete on tradeboard.receipts for each row execute function tradeboard.forbid_change();
create trigger plans_no_delete before delete on tradeboard.plans for each row execute function tradeboard.forbid_change();
create trigger comments_no_delete before delete on tradeboard.comments for each row execute function tradeboard.forbid_change();
create trigger approvals_no_delete before delete on tradeboard.approvals for each row execute function tradeboard.forbid_change();

-- ---------------------------------------------------------------- access

alter table tradeboard.accounts enable row level security;
alter table tradeboard.sessions enable row level security;
alter table tradeboard.agents enable row level security;
alter table tradeboard.agent_tokens enable row level security;
alter table tradeboard.executor_tokens enable row level security;
alter table tradeboard.plans enable row level security;
alter table tradeboard.plan_versions enable row level security;
alter table tradeboard.comments enable row level security;
alter table tradeboard.approvals enable row level security;
alter table tradeboard.policy_versions enable row level security;
alter table tradeboard.control enable row level security;
alter table tradeboard.executor_status enable row level security;
alter table tradeboard.receipts enable row level security;
alter table tradeboard.audit_log enable row level security;
-- No policies: clients (anon, authenticated) get nothing. The Worker uses service_role.
grant select, insert, update, delete on all tables in schema tradeboard to service_role;

-- ---------------------------------------------------------------- helpers

create or replace function tradeboard.audit(p_user_id uuid, p_actor_type text, p_actor_id text, p_action text, p_plan_id uuid, p_details jsonb default '{}'::jsonb)
returns void language sql set search_path = tradeboard as $$
  insert into audit_log (user_id, actor_type, actor_id, action, plan_id, details_json) values (p_user_id, p_actor_type, p_actor_id, p_action, p_plan_id, coalesce(p_details, '{}'::jsonb));
$$;

-- The material fields of a plan, as stored in plan_versions.snapshot.
create or replace function tradeboard.snapshot(p tradeboard.plans) returns jsonb
language sql immutable set search_path = tradeboard as $$
  select jsonb_build_object(
    'title', p.title, 'ticker', p.ticker, 'side', p.side, 'order', p.order_ticket, 'thesis', p.thesis, 'evidence', p.evidence,
    'risks_and_dissent', p.risks_and_dissent, 'invalidation', p.invalidation, 'valid_from', p.valid_from, 'valid_until', p.valid_until,
    'quote_at', p.quote_at, 'quote_price', p.quote_price, 'quote_source', p.quote_source, 'version', p.current_version, 'is_demo', p.is_demo);
$$;

create or replace function tradeboard.open_human_questions(p_plan_id uuid) returns integer
language sql stable set search_path = tradeboard as $$
  select count(*)::integer from comments where plan_id = p_plan_id and is_question and question_status = 'open' and author_type = 'human';
$$;

create or replace function tradeboard.fail(p_code text, p_message text, p_extra jsonb default '{}'::jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object('ok', false, 'error_code', p_code, 'message', p_message) || coalesce(p_extra, '{}'::jsonb);
$$;

create or replace function tradeboard.open_question_list(p_plan_id uuid) returns jsonb
language sql stable set search_path = tradeboard as $$
  select coalesce(jsonb_agg(jsonb_build_object('question_id', comment_id, 'body', left(body, 200), 'asked_by', author_id, 'asked_at', created_at) order by created_at), '[]'::jsonb)
  from comments where plan_id = p_plan_id and is_question and question_status = 'open' and author_type = 'human';
$$;

-- The user's current max_plan_age_hours (policy), 24 before they have one.
create or replace function tradeboard.max_age_hours(p_user_id uuid) returns numeric
language sql stable set search_path = tradeboard as $$
  select coalesce((select (policy->>'max_plan_age_hours')::numeric from policy_versions where user_id = p_user_id order by policy_version desc limit 1), 24);
$$;

-- Voids a plan's current approval (if any). Caller holds the plan's row lock.
create or replace function tradeboard.void_approval(p_plan_id uuid, p_reason text, p_actor_type text, p_actor_id text) returns boolean
language plpgsql set search_path = tradeboard as $$
declare v_id uuid; v_user uuid;
begin
  update approvals set voided_at = now(), void_reason = p_reason
  where plan_id = p_plan_id and voided_at is null returning approval_id into v_id;
  if v_id is null then return false; end if;
  update plans set approval_id = null where plan_id = p_plan_id returning user_id into v_user;
  perform audit(v_user, p_actor_type, p_actor_id, 'approval.voided', p_plan_id, jsonb_build_object('approval_id', v_id, 'reason', p_reason));
  return true;
end $$;

-- The user's plan, locked; null when it isn't theirs.
create or replace function tradeboard.lock_plan(p_user_id uuid, p_plan_id uuid) returns tradeboard.plans
language sql set search_path = tradeboard as $$
  select * from plans where plan_id = p_plan_id and user_id = p_user_id for update;
$$;

-- ---------------------------------------------------------------- plan lifecycle (§6.3)

create or replace function tradeboard.create_plan(p_user_id uuid, p_fields jsonb, p_actor_type text, p_actor_id text, p_idempotency_key text, p_is_demo boolean default false)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans;
begin
  if p_idempotency_key is not null then
    select * into p from plans where user_id = p_user_id and created_by_id = p_actor_id and create_idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status, 'duplicate', true); end if;
  end if;
  insert into plans (user_id, title, ticker, order_ticket, thesis, evidence, risks_and_dissent, invalidation, valid_from, valid_until, quote_at, quote_price, quote_source,
                     created_by_type, created_by_id, create_idempotency_key, is_demo)
  values (p_user_id, p_fields->>'title', p_fields->>'ticker', p_fields->'order', p_fields->>'thesis', coalesce(p_fields->>'evidence', ''), coalesce(p_fields->>'risks_and_dissent', ''),
          coalesce(p_fields->>'invalidation', ''), (p_fields->>'valid_from')::timestamptz, (p_fields->>'valid_until')::timestamptz, (p_fields->>'quote_at')::timestamptz,
          (p_fields->>'quote_price')::numeric, p_fields->>'quote_source', p_actor_type, p_actor_id, p_idempotency_key, coalesce(p_is_demo, false))
  returning * into p;
  insert into plan_versions (plan_id, version, edited_by_type, edited_by_id, diff_summary, snapshot) values (p.plan_id, 1, p_actor_type, p_actor_id, 'created', snapshot(p));
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.created', p.plan_id, jsonb_build_object('version', 1, 'ticker', p.ticker, 'demo', p.is_demo));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', 1, 'status', p.status, 'duplicate', false);
end $$;

-- A material edit: new version, approval voided, back to `debated` (§6.3). Rejected, stale and
-- expired plans reopen this way; executed, failed, cancelled and executing ones can't be edited.
create or replace function tradeboard.update_plan(p_user_id uuid, p_plan_id uuid, p_expected_version integer, p_fields jsonb, p_diff text, p_actor_type text, p_actor_id text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans;
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p.status in ('executed', 'failed', 'cancelled') then return fail('not_editable', format('a %s plan can''t be edited: create a new plan', p.status)); end if;
  if p.status = 'executing' then return fail('not_editable', 'the executor is placing this plan''s order right now'); end if;
  if p.current_version <> p_expected_version then
    return fail('version_conflict', format('you edited version %s but the plan is at version %s: reload and edit again', p_expected_version, p.current_version),
                jsonb_build_object('expected_version', p_expected_version, 'actual_version', p.current_version));
  end if;
  perform void_approval(p_plan_id, 'plan edited', p_actor_type, p_actor_id);
  update plans set
    title = p_fields->>'title', ticker = p_fields->>'ticker', order_ticket = p_fields->'order', thesis = p_fields->>'thesis',
    evidence = coalesce(p_fields->>'evidence', ''), risks_and_dissent = coalesce(p_fields->>'risks_and_dissent', ''), invalidation = coalesce(p_fields->>'invalidation', ''),
    valid_from = (p_fields->>'valid_from')::timestamptz, valid_until = (p_fields->>'valid_until')::timestamptz, quote_at = (p_fields->>'quote_at')::timestamptz,
    quote_price = (p_fields->>'quote_price')::numeric, quote_source = p_fields->>'quote_source',
    current_version = current_version + 1, status = 'debated', updated_at = now(), last_activity_at = now(), reason_code = null, reason_text = null,
    executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null
  where plan_id = p_plan_id returning * into p;
  insert into plan_versions (plan_id, version, edited_by_type, edited_by_id, diff_summary, snapshot) values (p.plan_id, p.current_version, p_actor_type, p_actor_id, p_diff, snapshot(p));
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.edited', p.plan_id, jsonb_build_object('version', p.current_version, 'diff', p_diff));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status);
end $$;

-- Comments and questions (§6.4). A new human question voids an approval and sends the plan back to
-- `debated` until the user resolves it.
create or replace function tradeboard.add_comment(p_user_id uuid, p_plan_id uuid, p_actor_type text, p_actor_id text, p_body text, p_anchor text, p_parent uuid, p_is_question boolean, p_mentioned text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; c comments; v_voided boolean := false;
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p_parent is not null and not exists (select 1 from comments where comment_id = p_parent and plan_id = p_plan_id) then
    return fail('bad_parent', 'parent_comment_id isn''t a comment on this plan');
  end if;
  if p_mentioned is not null and not exists (select 1 from agents where user_id = p_user_id and agent_id = p_mentioned and revoked_at is null) then
    return fail('unknown_agent', format('no agent named %s', p_mentioned));
  end if;
  insert into comments (plan_id, version, author_type, author_id, body, anchor, parent_comment_id, mentioned_agent_id, is_question, question_status)
  values (p_plan_id, p.current_version, p_actor_type, p_actor_id, p_body, coalesce(p_anchor, 'general'), p_parent, p_mentioned, coalesce(p_is_question, false),
          case when p_is_question then 'open' end)
  returning * into c;
  if p.status = 'draft' then
    update plans set status = 'debated' where plan_id = p_plan_id;
    perform audit(p_user_id, 'system', 'board', 'plan.status', p_plan_id, jsonb_build_object('from', 'draft', 'to', 'debated', 'why', 'first comment'));
  end if;
  if c.is_question and p_actor_type = 'human' and p.status in ('ready', 'approved', 'validated') then
    v_voided := void_approval(p_plan_id, 'new human question', p_actor_type, p_actor_id);
    update plans set status = 'debated', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = p_plan_id;
    perform audit(p_user_id, 'system', 'board', 'plan.status', p_plan_id, jsonb_build_object('from', p.status, 'to', 'debated', 'why', 'new human question'));
  end if;
  update plans set last_activity_at = now() where plan_id = p_plan_id;
  perform audit(p_user_id, p_actor_type, p_actor_id, case when c.is_question then 'question.asked' else 'comment.added' end, p_plan_id,
                jsonb_build_object('comment_id', c.comment_id, 'anchor', c.anchor, 'mentioned', p_mentioned, 'parent', p_parent));
  return jsonb_build_object('ok', true, 'comment_id', c.comment_id, 'version', c.version, 'created_at', c.created_at, 'approval_voided', v_voided,
                            'status', (select status from plans where plan_id = p_plan_id));
end $$;

-- The user only (the Worker never exposes this to agents): resolve, or reopen, a question.
create or replace function tradeboard.set_question(p_user_id uuid, p_comment_id uuid, p_resolve boolean, p_note text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare c comments; p plans;
begin
  select * into c from comments where comment_id = p_comment_id and is_question;
  if not found then return fail('not_found', 'no such question'); end if;
  p := lock_plan(p_user_id, c.plan_id);
  if p.plan_id is null then return fail('not_found', 'no such question'); end if;
  if p_resolve then
    update comments set question_status = 'resolved', resolved_by = 'human', resolved_at = now(), resolution_note = coalesce(p_note, '') where comment_id = p_comment_id;
  else
    update comments set question_status = 'open', resolved_by = null, resolved_at = null, resolution_note = null where comment_id = p_comment_id;
    if c.author_type = 'human' and p.status in ('ready', 'approved', 'validated') then
      perform void_approval(p.plan_id, 'question reopened', 'human', 'owner');
      update plans set status = 'debated', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = p.plan_id;
    end if;
  end if;
  update plans set last_activity_at = now() where plan_id = p.plan_id;
  perform audit(p_user_id, 'human', 'owner', case when p_resolve then 'question.resolved' else 'question.reopened' end, p.plan_id, jsonb_build_object('question_id', p_comment_id, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', (select status from plans where plan_id = p.plan_id), 'open_human_questions', open_human_questions(p.plan_id));
end $$;

-- Age and validity checks shared by mark_ready and approve. Marks the plan expired/stale and says why.
create or replace function tradeboard.check_fresh(p tradeboard.plans, p_max_age_hours numeric) returns jsonb
language plpgsql set search_path = tradeboard as $$
begin
  if p.valid_until <= now() then
    update plans set status = 'expired', reason_code = 'approval_expired', reason_text = 'valid_until passed' where plan_id = p.plan_id;
    perform void_approval(p.plan_id, 'plan expired', 'system', 'board');
    perform audit(p.user_id, 'system', 'board', 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', 'expired'));
    return fail('expired', 'valid_until has passed: edit the plan with a new window');
  end if;
  if now() - p.updated_at > make_interval(secs => p_max_age_hours * 3600) then
    update plans set status = 'stale', reason_code = 'stale_plan', reason_text = format('not edited for over %s h', p_max_age_hours) where plan_id = p.plan_id;
    perform void_approval(p.plan_id, 'plan stale', 'system', 'board');
    perform audit(p.user_id, 'system', 'board', 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', 'stale'));
    return fail('stale', format('the plan hasn''t been edited for over %s h: revalidate it with an edit', p_max_age_hours));
  end if;
  return null;
end $$;

create or replace function tradeboard.mark_ready(p_user_id uuid, p_plan_id uuid, p_actor_type text, p_actor_id text, p_max_age_hours numeric)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; v_fail jsonb;
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p.status <> 'debated' then return fail('bad_status', format('only a debated plan can be marked ready (this one is %s)', p.status), jsonb_build_object('status', p.status)); end if;
  if open_human_questions(p_plan_id) > 0 then
    return fail('open_questions', 'the user has open questions on this plan', jsonb_build_object('open_questions', open_question_list(p_plan_id)));
  end if;
  v_fail := check_fresh(p, p_max_age_hours);
  if v_fail is not null then return v_fail; end if;
  update plans set status = 'ready', last_activity_at = now() where plan_id = p_plan_id;
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.ready', p_plan_id, jsonb_build_object('version', p.current_version));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'version', p.current_version, 'status', 'ready');
end $$;

create or replace function tradeboard.request_changes(p_user_id uuid, p_plan_id uuid, p_actor_type text, p_actor_id text, p_body text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; r jsonb;
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p.status not in ('ready', 'approved') then return fail('bad_status', format('changes can be requested on a ready or approved plan (this one is %s)', p.status)); end if;
  perform void_approval(p_plan_id, 'changes requested', p_actor_type, p_actor_id);
  update plans set status = 'debated' where plan_id = p_plan_id;
  r := add_comment(p_user_id, p_plan_id, p_actor_type, p_actor_id, 'Changes requested: ' || p_body, 'general', null, false, null);
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.changes_requested', p_plan_id, jsonb_build_object('from', p.status));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', 'debated', 'comment_id', r->'comment_id');
end $$;

-- Human only (§6.3): the Worker calls this from the portal with the user's session, never from MCP.
create or replace function tradeboard.approve_plan(p_user_id uuid, p_plan_id uuid, p_version integer, p_note text, p_expires_at timestamptz, p_max_age_hours numeric)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; a approvals; v_fail jsonb;
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p.status <> 'ready' then return fail('bad_status', format('only a ready plan can be approved (this one is %s)', p.status)); end if;
  if p.current_version <> p_version then
    return fail('version_conflict', format('you reviewed version %s but the plan is at version %s', p_version, p.current_version), jsonb_build_object('expected_version', p_version, 'actual_version', p.current_version));
  end if;
  if open_human_questions(p_plan_id) > 0 then return fail('open_questions', 'resolve your open questions first', jsonb_build_object('open_questions', open_question_list(p_plan_id))); end if;
  v_fail := check_fresh(p, p_max_age_hours);
  if v_fail is not null then return v_fail; end if;
  if p_expires_at <= now() then return fail('approval_expired', 'the approval would already be expired'); end if;
  insert into approvals (plan_id, version, expires_at, note) values (p_plan_id, p.current_version, p_expires_at, coalesce(p_note, '')) returning * into a;
  update plans set status = 'approved', approval_id = a.approval_id, last_activity_at = now(), reason_code = null, reason_text = null where plan_id = p_plan_id;
  perform audit(p_user_id, 'human', 'owner', 'plan.approved', p_plan_id, jsonb_build_object('approval_id', a.approval_id, 'version', a.version, 'expires_at', a.expires_at, 'note', a.note));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', 'approved', 'version', a.version, 'approval_id', a.approval_id, 'approved_at', a.approved_at, 'expires_at', a.expires_at);
end $$;

-- Human only: reject (reason) or cancel (terminal).
create or replace function tradeboard.close_plan(p_user_id uuid, p_plan_id uuid, p_to text, p_reason text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans;
begin
  if p_to not in ('rejected', 'cancelled') then return fail('bad_request', 'rejected or cancelled'); end if;
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p.status in ('executed', 'failed', 'cancelled') then return fail('bad_status', format('this plan is already %s', p.status)); end if;
  if p.status = 'executing' and not p.awaiting_manual then return fail('bad_status', 'the executor is placing this order right now: pause or kill the executor first'); end if;
  if p_to = 'rejected' and p.status = 'rejected' then return fail('bad_status', 'already rejected'); end if;
  perform void_approval(p_plan_id, 'plan ' || p_to, 'human', 'owner');
  update plans set status = p_to, reason_code = case when p_to = 'rejected' then 'human_rejected' else null end, reason_text = coalesce(p_reason, ''),
    awaiting_manual = false, executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null, last_activity_at = now()
  where plan_id = p_plan_id;
  perform audit(p_user_id, 'human', 'owner', 'plan.' || p_to, p_plan_id, jsonb_build_object('from', p.status, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', p_to);
end $$;

-- ---------------------------------------------------------------- executor (§7.2, §9.1)

-- Is this approval good for this plan right now? Null when yes, else a failure.
create or replace function tradeboard.gate(p tradeboard.plans) returns jsonb
language plpgsql stable set search_path = tradeboard as $$
declare a approvals; c control;
begin
  select * into c from control where user_id = p.user_id;
  if c.killed then return fail('killed', 'the executor is killed'); end if;
  if c.paused then return fail('paused', 'the executor is paused'); end if;
  select * into a from approvals where approval_id = p.approval_id and voided_at is null;
  if not found then return fail('approval_missing', 'the plan has no valid approval'); end if;
  if a.expires_at <= now() then return fail('approval_expired', 'the approval expired'); end if;
  if a.version <> p.current_version then return fail('plan_changed', 'the plan changed since it was approved'); end if;
  if now() < coalesce(p.valid_from, '-infinity') or now() > p.valid_until then return fail('outside_window', 'now is outside the plan''s validity window'); end if;
  if open_human_questions(p.plan_id) > 0 then return fail('open_questions', 'the user has open questions'); end if;
  return null;
end $$;

create or replace function tradeboard.claim_plan(p_user_id uuid, p_plan_id uuid, p_executor_id text, p_idempotency_key text, p_ttl_seconds integer, p_recovery boolean default false)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; v_fail jsonb; v_claim uuid := gen_random_uuid();
begin
  p := lock_plan(p_user_id, p_plan_id);
  if p.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if p_recovery then
    if p.status <> 'executing' or p.awaiting_manual then return fail('bad_status', 'nothing to recover'); end if;
    if p.claim_expires_at > now() and p.claim_executor_id <> p_executor_id then return fail('already_claimed', 'another executor holds this plan'); end if;
    update plans set executor_claim_id = v_claim, claim_executor_id = p_executor_id, claim_expires_at = now() + make_interval(secs => p_ttl_seconds) where plan_id = p_plan_id;
    perform audit(p_user_id, 'executor', p_executor_id, 'executor.recovery_claimed', p_plan_id, jsonb_build_object('claim_id', v_claim, 'idempotency_key', p.claim_idempotency_key));
    return jsonb_build_object('ok', true, 'claim_id', v_claim, 'expires_at', now() + make_interval(secs => p_ttl_seconds), 'idempotency_key', p.claim_idempotency_key);
  end if;
  if p.executor_claim_id is not null and p.claim_expires_at > now() then
    if p.claim_executor_id = p_executor_id and p.claim_idempotency_key = p_idempotency_key and p.status in ('approved', 'validated') then
      return jsonb_build_object('ok', true, 'claim_id', p.executor_claim_id, 'expires_at', p.claim_expires_at, 'idempotency_key', p.claim_idempotency_key, 'resumed', true);
    end if;
    return fail('already_claimed', 'another claim holds this plan');
  end if;
  if p.status <> 'approved' then return fail('bad_status', format('only an approved plan can be claimed (this one is %s)', p.status)); end if;
  if p.is_demo and not coalesce((select dry_run from control where user_id = p_user_id), true) then return fail('demo_plan', 'the DEMO plan only runs in dry-run'); end if;
  v_fail := gate(p);
  if v_fail is not null then return v_fail; end if;
  update plans set executor_claim_id = v_claim, claim_executor_id = p_executor_id, claim_idempotency_key = p_idempotency_key,
    claim_expires_at = now() + make_interval(secs => p_ttl_seconds) where plan_id = p_plan_id;
  perform audit(p_user_id, 'executor', p_executor_id, 'executor.claimed', p_plan_id, jsonb_build_object('claim_id', v_claim, 'version', p.current_version, 'idempotency_key', p_idempotency_key));
  return jsonb_build_object('ok', true, 'claim_id', v_claim, 'expires_at', now() + make_interval(secs => p_ttl_seconds), 'idempotency_key', p_idempotency_key);
end $$;

-- approved → validated (checks passed) → executing (about to place). Each step re-checks the gate,
-- so a pause, kill, edit, question or expiry that lands mid-flight stops the order (§11.8).
create or replace function tradeboard.executor_step(p_user_id uuid, p_claim_id uuid, p_to text, p_ttl_seconds integer)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans; v_fail jsonb;
begin
  select * into p from plans where executor_claim_id = p_claim_id and user_id = p_user_id for update;
  if not found or p.claim_expires_at <= now() then return fail('claim_lost', 'this claim is no longer held'); end if;
  v_fail := gate(p);
  if v_fail is not null then return v_fail; end if;
  if p_to = 'validated' and p.status = 'approved' then
    update plans set status = 'validated' where plan_id = p.plan_id;
  elsif p_to = 'executing' and p.status = 'validated' then
    update plans set status = 'executing', attempt_started_at = now(), claim_expires_at = now() + make_interval(secs => p_ttl_seconds) where plan_id = p.plan_id;
  else
    return fail('bad_status', format('can''t go from %s to %s', p.status, p_to));
  end if;
  perform audit(p_user_id, 'executor', p.claim_executor_id, 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', p_to, 'claim_id', p_claim_id));
  return jsonb_build_object('ok', true, 'status', p_to);
end $$;

-- Gives a claimed (not yet executing) plan back: it returns to `approved` for a later loop.
create or replace function tradeboard.release_claim(p_user_id uuid, p_claim_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare p plans;
begin
  select * into p from plans where executor_claim_id = p_claim_id and user_id = p_user_id for update;
  if not found then return fail('claim_lost', 'this claim is no longer held'); end if;
  if p.status not in ('approved', 'validated') then return fail('bad_status', format('a %s plan can''t be released', p.status)); end if;
  update plans set status = 'approved', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = p.plan_id;
  perform audit(p_user_id, 'executor', p.claim_executor_id, 'executor.released', p.plan_id, jsonb_build_object('claim_id', p_claim_id, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', 'approved');
end $$;

-- Records an attempt (always: a receipt for a real order is never dropped) and moves the plan on
-- if the receipt belongs to its current claim. One receipt per claim (§5.2.6).
create or replace function tradeboard.post_receipt(p_user_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare pl plans; r receipts; v_to text; v_claim uuid := (p->>'claim_id')::uuid; c control;
begin
  -- Lock the plan first, then look for an earlier receipt of this claim: two posts at once serialise here.
  pl := lock_plan(p_user_id, (p->>'plan_id')::uuid);
  if pl.plan_id is null then return fail('not_found', 'no such plan'); end if;
  if v_claim is not null then
    select * into r from receipts where claim_id = v_claim;
    if found then return jsonb_build_object('ok', true, 'receipt_id', r.receipt_id, 'duplicate', true, 'status', pl.status); end if;
  end if;
  insert into receipts (user_id, plan_id, version, claim_id, executor_id, mode, outcome, reason_code, reason_text, robinhood_order_id, filled_quantity, filled_price, policy_snapshot_id, details)
  values (p_user_id, pl.plan_id, (p->>'version')::integer, v_claim, p->>'executor_id', p->>'mode', p->>'outcome', p->>'reason_code', coalesce(p->>'reason_text', ''),
          p->>'robinhood_order_id', (p->>'filled_quantity')::numeric, (p->>'filled_price')::numeric, (p->>'policy_snapshot_id')::integer, coalesce(p->'details', '{}'::jsonb))
  returning * into r;
  perform audit(p_user_id, case when r.mode = 'manual' then 'human' else 'executor' end, case when r.mode = 'manual' then 'owner' else r.executor_id end, 'receipt.posted', pl.plan_id,
                jsonb_build_object('receipt_id', r.receipt_id, 'mode', r.mode, 'outcome', r.outcome, 'reason_code', r.reason_code, 'version', r.version));
  if r.mode = 'live' then
    select * into c from control where user_id = p_user_id for update;
    if r.outcome = 'executed' and c.live_trial_pending then
      update control set live_trial_pending = false, updated_at = now() where user_id = p_user_id;
      perform audit(p_user_id, 'system', 'board', 'live.trial_passed', pl.plan_id, jsonb_build_object('receipt_id', r.receipt_id));
    elsif r.outcome = 'failed' and c.live_trial_pending then
      update control set dry_run = true, updated_at = now() where user_id = p_user_id;
      perform audit(p_user_id, 'system', 'board', 'live.trial_failed', pl.plan_id, jsonb_build_object('receipt_id', r.receipt_id, 'note', 'back to dry-run until the user re-enables live'));
    end if;
  end if;
  -- Only the claim that holds the plan moves it (a manual fill has no claim and is checked by the Worker).
  if (v_claim is not null and pl.executor_claim_id is distinct from v_claim) then
    return jsonb_build_object('ok', true, 'receipt_id', r.receipt_id, 'status', pl.status, 'note', 'claim no longer held: plan status unchanged');
  end if;
  v_to := case r.outcome
    when 'executed' then 'executed' when 'simulated' then 'executed' when 'failed' then 'failed' when 'proposed' then 'executing'
    else case when r.reason_code = 'stale_plan' then 'stale' else 'rejected' end end;
  update plans set status = v_to, reason_code = r.reason_code, reason_text = r.reason_text, awaiting_manual = (r.outcome = 'proposed'),
    executor_claim_id = null, claim_executor_id = null, claim_expires_at = null,
    claim_idempotency_key = case when r.outcome = 'proposed' then claim_idempotency_key else null end, last_activity_at = now()
  where plan_id = pl.plan_id;
  if v_to in ('rejected', 'stale', 'failed') then perform void_approval(pl.plan_id, 'executor ' || r.outcome, 'executor', r.executor_id); end if;
  perform audit(p_user_id, 'system', 'board', 'plan.status', pl.plan_id, jsonb_build_object('from', pl.status, 'to', v_to, 'receipt_id', r.receipt_id));
  return jsonb_build_object('ok', true, 'receipt_id', r.receipt_id, 'status', v_to);
end $$;

-- Time-based rules (§6.5) for every user's plans, run by the Worker's cron every minute and before
-- reads. Staleness uses each user's own max_plan_age_hours.
create or replace function tradeboard.sweep()
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare r record; n_exp int := 0; n_app int := 0; n_claim int := 0; n_stale int := 0;
begin
  -- Claims that ran out before `executing`: back to approved for a later loop (§9.1 step 9).
  for r in select * from plans where status in ('approved', 'validated') and claim_expires_at <= now() for update skip locked loop
    update plans set status = 'approved', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = r.plan_id;
    perform audit(r.user_id, 'system', 'board', 'claim.expired', r.plan_id, jsonb_build_object('executor_id', r.claim_executor_id, 'note', 'a prior attempt expired; the plan is approved again'));
    n_claim := n_claim + 1;
  end loop;
  -- Plans past valid_until (nothing in flight).
  for r in select * from plans where status in ('draft', 'debated', 'ready', 'approved') and valid_until <= now() for update skip locked loop
    perform void_approval(r.plan_id, 'plan expired', 'system', 'board');
    update plans set status = 'expired', reason_code = 'approval_expired', reason_text = 'valid_until passed' where plan_id = r.plan_id;
    perform audit(r.user_id, 'system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', r.status, 'to', 'expired'));
    n_exp := n_exp + 1;
  end loop;
  -- Approvals past their expiry: back to debated (§6.5.2).
  for r in select p.* from plans p join approvals a on a.approval_id = p.approval_id
           where p.status = 'approved' and a.voided_at is null and a.expires_at <= now() for update of p skip locked loop
    perform void_approval(r.plan_id, 'approval expired', 'system', 'board');
    update plans set status = 'debated', reason_code = 'approval_expired', reason_text = 'the approval expired' where plan_id = r.plan_id;
    perform audit(r.user_id, 'system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', 'approved', 'to', 'debated', 'why', 'approval expired'));
    n_app := n_app + 1;
  end loop;
  -- Plans unedited for too long on their way to execution (§6.5.4).
  for r in select * from plans where status in ('ready', 'approved') and now() - updated_at > make_interval(secs => max_age_hours(user_id) * 3600) for update skip locked loop
    perform void_approval(r.plan_id, 'plan stale', 'system', 'board');
    update plans set status = 'stale', reason_code = 'stale_plan', reason_text = format('not edited for over %s h', max_age_hours(r.user_id)) where plan_id = r.plan_id;
    perform audit(r.user_id, 'system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', r.status, 'to', 'stale'));
    n_stale := n_stale + 1;
  end loop;
  return jsonb_build_object('expired', n_exp, 'approvals_expired', n_app, 'claims_expired', n_claim, 'stale', n_stale);
end $$;

-- Resolves a token hash to its user and agent (live agents only), recording use.
create or replace function tradeboard.resolve_agent_token(p_token_hash text)
returns table (user_id uuid, agent_id text) language sql security definer set search_path = tradeboard, extensions as $$
  update agent_tokens t set last_used_at = now()
  from agents a
  where t.token_hash = p_token_hash and t.revoked_at is null and a.user_id = t.user_id and a.agent_id = t.agent_id and a.revoked_at is null
  returning t.user_id, t.agent_id
$$;

create or replace function tradeboard.resolve_executor_token(p_token_hash text)
returns table (user_id uuid, executor_id text) language sql security definer set search_path = tradeboard, extensions as $$
  update executor_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning user_id, executor_id
$$;

-- Deletes everything the board holds for one user (their account deletion), history included.
create or replace function tradeboard.delete_account(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = tradeboard, extensions as $$
declare n int;
begin
  perform set_config('tradeboard.deleting_account', 'on', true);
  delete from receipts where user_id = p_user_id;
  delete from approvals where plan_id in (select plan_id from plans where user_id = p_user_id);
  update comments set parent_comment_id = null where plan_id in (select plan_id from plans where user_id = p_user_id);
  delete from comments where plan_id in (select plan_id from plans where user_id = p_user_id);
  delete from plan_versions where plan_id in (select plan_id from plans where user_id = p_user_id);
  delete from plans where user_id = p_user_id;
  get diagnostics n = row_count;
  delete from audit_log where user_id = p_user_id;
  delete from policy_versions where user_id = p_user_id;
  delete from control where user_id = p_user_id;
  delete from executor_status where user_id = p_user_id;
  delete from executor_tokens where user_id = p_user_id;
  delete from agent_tokens where user_id = p_user_id;
  delete from agents where user_id = p_user_id;
  delete from sessions where user_id = p_user_id;
  delete from accounts where user_id = p_user_id;
  perform set_config('tradeboard.deleting_account', 'off', true);
  return jsonb_build_object('ok', true, 'plans_deleted', n);
end $$;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'tradeboard' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
