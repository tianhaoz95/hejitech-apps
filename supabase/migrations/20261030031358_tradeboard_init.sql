SET local check_function_bodies = off;

CREATE SCHEMA "tradeboard";

CREATE TABLE "tradeboard"."agent_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "agent_id"     text                     NOT NULL,
  "label"        text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "agent_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "agent_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "tradeboard"."agent_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."agents" (
  "agent_id"     text                     NOT NULL,
  "display_name" text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "agents_agent_id_check" CHECK ((agent_id ~ '^[a-z][a-z0-9_-]{1,31}$'::text)),
  CONSTRAINT "agents_pkey" PRIMARY KEY (agent_id)
);

ALTER TABLE "tradeboard"."agents"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."approvals" (
  "approval_id" uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"     uuid                     NOT NULL,
  "version"     integer                  NOT NULL,
  "approved_by" text                     NOT NULL DEFAULT 'human'::text,
  "approved_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"  timestamp with time zone NOT NULL,
  "note"        text                     NOT NULL DEFAULT ''::text,
  "voided_at"   timestamp with time zone,
  "void_reason" text,
  CONSTRAINT "approvals_approved_by_check" CHECK ((approved_by = 'human'::text)),
  CONSTRAINT "approvals_pkey" PRIMARY KEY (approval_id)
);

ALTER TABLE "tradeboard"."approvals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."audit_log" (
  "event_id"     bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "actor_type"   text                     NOT NULL,
  "actor_id"     text                     NOT NULL,
  "action"       text                     NOT NULL,
  "plan_id"      uuid,
  "details_json" jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "audit_log_pkey" PRIMARY KEY (event_id)
);

ALTER TABLE "tradeboard"."audit_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."comments" (
  "comment_id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"            uuid                     NOT NULL,
  "version"            integer                  NOT NULL,
  "author_type"        text                     NOT NULL,
  "author_id"          text                     NOT NULL,
  "body"               text                     NOT NULL,
  "anchor"             text                     NOT NULL DEFAULT 'general'::text,
  "parent_comment_id"  uuid,
  "mentioned_agent_id" text,
  "is_question"        boolean                  NOT NULL DEFAULT false,
  "question_status"    text,
  "resolved_by"        text,
  "resolved_at"        timestamp with time zone,
  "resolution_note"    text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "comments_anchor_check"
    CHECK ((anchor = ANY (ARRAY['thesis'::text, 'evidence'::text, 'risks_and_dissent'::text, 'invalidation'::text, 'order'::text, 'general'::text]))),
  CONSTRAINT "comments_author_type_check" CHECK ((author_type = ANY (ARRAY['human'::text, 'agent'::text, 'executor'::text, 'system'::text]))),
  CONSTRAINT "comments_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 10000))),
  CONSTRAINT "comments_check" CHECK ((is_question = (question_status IS NOT NULL))),
  CONSTRAINT "comments_pkey" PRIMARY KEY (comment_id),
  CONSTRAINT "comments_question_status_check" CHECK ((question_status = ANY (ARRAY['open'::text, 'resolved'::text])))
);

ALTER TABLE "tradeboard"."comments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."control" (
  "id"                     boolean                  NOT NULL DEFAULT true,
  "paused"                 boolean                  NOT NULL DEFAULT false,
  "killed"                 boolean                  NOT NULL DEFAULT false,
  "dry_run"                boolean                  NOT NULL DEFAULT true,
  "approvals_mode"         text,
  "confirmed_account_mask" text,
  "funding_usd"            numeric,
  "gate_policy_version"    integer,
  "gate_confirmed_at"      timestamp with time zone,
  "live_trial_pending"     boolean                  NOT NULL DEFAULT true,
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "control_approvals_mode_check" CHECK ((approvals_mode = ANY (ARRAY['A'::text, 'B'::text]))),
  CONSTRAINT "control_id_check" CHECK (id),
  CONSTRAINT "control_pkey" PRIMARY KEY (id)
);

ALTER TABLE "tradeboard"."control"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."executor_status" (
  "executor_id"         text                     NOT NULL,
  "last_heartbeat_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "mode"                text                     NOT NULL DEFAULT 'dry_run'::text,
  "paused"              boolean                  NOT NULL DEFAULT false,
  "dry_run"             boolean                  NOT NULL DEFAULT true,
  "policy_version"      integer,
  "local_model_id"      text,
  "model_check_enabled" boolean                  NOT NULL DEFAULT true,
  "local_live_allowed"  boolean                  NOT NULL DEFAULT false,
  "robinhood_connected" boolean                  NOT NULL DEFAULT false,
  "trade_approvals"     text                     NOT NULL DEFAULT 'unknown'::text,
  "account_mask"        text,
  "account_matches"     boolean,
  "last_error"          text,
  "version"             text,
  CONSTRAINT "executor_status_mode_check" CHECK ((mode = ANY (ARRAY['dry_run'::text, 'live'::text]))),
  CONSTRAINT "executor_status_pkey" PRIMARY KEY (executor_id),
  CONSTRAINT "executor_status_trade_approvals_check" CHECK ((trade_approvals = ANY (ARRAY['on'::text, 'off'::text, 'unknown'::text])))
);

ALTER TABLE "tradeboard"."executor_status"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."executor_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "executor_id"  text                     NOT NULL,
  "label"        text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "executor_tokens_executor_id_check" CHECK ((executor_id ~ '^[a-z0-9][a-z0-9._-]{0,47}$'::text)),
  CONSTRAINT "executor_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "executor_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "tradeboard"."executor_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."owner" (
  "id"               boolean                  NOT NULL DEFAULT true,
  "user_id"          uuid                     NOT NULL,
  "email"            text                     NOT NULL,
  "totp_secret_enc"  text,
  "totp_pending_enc" text,
  "totp_enrolled_at" timestamp with time zone,
  "totp_last_step"   bigint,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "owner_id_check" CHECK (id),
  CONSTRAINT "owner_pkey" PRIMARY KEY (id)
);

ALTER TABLE "tradeboard"."owner"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."plan_versions" (
  "plan_id"        uuid                     NOT NULL,
  "version"        integer                  NOT NULL,
  "edited_by_type" text                     NOT NULL,
  "edited_by_id"   text                     NOT NULL,
  "edited_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "diff_summary"   text                     NOT NULL,
  "snapshot"       jsonb                    NOT NULL,
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY (plan_id, VERSION)
);

ALTER TABLE "tradeboard"."plan_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."plans" (
  "plan_id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "title"                  text                     NOT NULL,
  "status"                 text                     NOT NULL DEFAULT 'draft'::text,
  "ticker"                 text                     NOT NULL,
  "side"                   text                     NOT NULL DEFAULT 'buy'::text,
  "order_ticket"           jsonb                    NOT NULL,
  "thesis"                 text                     NOT NULL,
  "evidence"               text                     NOT NULL DEFAULT ''::text,
  "risks_and_dissent"      text                     NOT NULL DEFAULT ''::text,
  "invalidation"           text                     NOT NULL DEFAULT ''::text,
  "created_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "last_activity_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "created_by_type"        text                     NOT NULL,
  "created_by_id"          text                     NOT NULL,
  "create_idempotency_key" text,
  "valid_from"             timestamp with time zone,
  "valid_until"            timestamp with time zone NOT NULL,
  "quote_at"               timestamp with time zone,
  "quote_price"            numeric,
  "quote_source"           text,
  "current_version"        integer                  NOT NULL DEFAULT 1,
  "approval_id"            uuid,
  "executor_claim_id"      uuid,
  "claim_executor_id"      text,
  "claim_idempotency_key"  text,
  "claim_expires_at"       timestamp with time zone,
  "attempt_started_at"     timestamp with time zone,
  "awaiting_manual"        boolean                  NOT NULL DEFAULT false,
  "reason_code"            text,
  "reason_text"            text,
  "is_demo"                boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "plans_check" CHECK (((valid_from IS NULL) OR (valid_from < valid_until))),
  CONSTRAINT "plans_created_by_id_create_idempotency_key_key" UNIQUE (created_by_id, create_idempotency_key),
  CONSTRAINT "plans_created_by_type_check" CHECK ((created_by_type = ANY (ARRAY['human'::text, 'agent'::text]))),
  CONSTRAINT "plans_pkey" PRIMARY KEY (plan_id),
  CONSTRAINT "plans_side_check" CHECK ((side = 'buy'::text)),
  CONSTRAINT "plans_status_check"
    CHECK
    ((status = ANY (ARRAY['draft'::text, 'debated'::text, 'ready'::text, 'approved'::text, 'validated'::text, 'executing'::text, 'executed'::text, 'failed'::text, 'rejected'::text,
    'cancelled'::text, 'stale'::text, 'expired'::text]))),
  CONSTRAINT "plans_ticker_check" CHECK ((ticker ~ '^[A-Z]{1,5}(\.[A-Z]{1,2})?$'::text))
);

ALTER TABLE "tradeboard"."plans"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."policy_versions" (
  "policy_version" integer                  NOT NULL,
  "policy"         jsonb                    NOT NULL,
  "created_by"     text                     NOT NULL DEFAULT 'human'::text,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "note"           text                     NOT NULL DEFAULT ''::text,
  CONSTRAINT "policy_versions_created_by_check" CHECK ((created_by = ANY (ARRAY['human'::text, 'system'::text]))),
  CONSTRAINT "policy_versions_pkey" PRIMARY KEY (policy_version)
);

ALTER TABLE "tradeboard"."policy_versions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."receipts" (
  "receipt_id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "plan_id"            uuid                     NOT NULL,
  "version"            integer                  NOT NULL,
  "claim_id"           uuid,
  "executor_id"        text                     NOT NULL,
  "attempted_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "mode"               text                     NOT NULL,
  "outcome"            text                     NOT NULL,
  "reason_code"        text,
  "reason_text"        text                     NOT NULL DEFAULT ''::text,
  "robinhood_order_id" text,
  "filled_quantity"    numeric,
  "filled_price"       numeric,
  "policy_snapshot_id" integer,
  "details"            jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "receipts_claim_id_key" UNIQUE (claim_id),
  CONSTRAINT "receipts_mode_check" CHECK ((mode = ANY (ARRAY['dry_run'::text, 'live'::text, 'manual'::text]))),
  CONSTRAINT "receipts_outcome_check" CHECK ((outcome = ANY (ARRAY['executed'::text, 'simulated'::text, 'rejected'::text, 'failed'::text, 'proposed'::text]))),
  CONSTRAINT "receipts_pkey" PRIMARY KEY (receipt_id)
);

ALTER TABLE "tradeboard"."receipts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."sessions" (
  "token_hash"   text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"   timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_agent"   text,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "sessions_pkey" PRIMARY KEY (token_hash)
);

ALTER TABLE "tradeboard"."sessions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION tradeboard.add_comment (
  p_plan_id     uuid,
  p_actor_type  text,
  p_actor_id    text,
  p_body        text,
  p_anchor      text,
  p_parent      uuid,
  p_is_question boolean,
  p_mentioned   text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; c comments; v_voided boolean := false;
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if p_parent is not null and not exists (select 1 from comments where comment_id = p_parent and plan_id = p_plan_id) then
    return fail('bad_parent', 'parent_comment_id isn''t a comment on this plan');
  end if;
  if p_mentioned is not null and not exists (select 1 from agents where agent_id = p_mentioned and revoked_at is null) then
    return fail('unknown_agent', format('no agent named %s', p_mentioned));
  end if;
  insert into comments (plan_id, version, author_type, author_id, body, anchor, parent_comment_id, mentioned_agent_id, is_question, question_status)
  values (p_plan_id, p.current_version, p_actor_type, p_actor_id, p_body, coalesce(p_anchor, 'general'), p_parent, p_mentioned, coalesce(p_is_question, false),
          case when p_is_question then 'open' end)
  returning * into c;
  if p.status = 'draft' then
    update plans set status = 'debated' where plan_id = p_plan_id;
    perform audit('system', 'board', 'plan.status', p_plan_id, jsonb_build_object('from', 'draft', 'to', 'debated', 'why', 'first comment'));
  end if;
  if c.is_question and p_actor_type = 'human' and p.status in ('ready', 'approved', 'validated') then
    v_voided := void_approval(p_plan_id, 'new human question', p_actor_type, p_actor_id);
    update plans set status = 'debated', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = p_plan_id;
    perform audit('system', 'board', 'plan.status', p_plan_id, jsonb_build_object('from', p.status, 'to', 'debated', 'why', 'new human question'));
  end if;
  update plans set last_activity_at = now() where plan_id = p_plan_id;
  perform audit(p_actor_type, p_actor_id, case when c.is_question then 'question.asked' else 'comment.added' end, p_plan_id,
                jsonb_build_object('comment_id', c.comment_id, 'anchor', c.anchor, 'mentioned', p_mentioned, 'parent', p_parent));
  return jsonb_build_object('ok', true, 'comment_id', c.comment_id, 'version', c.version, 'created_at', c.created_at, 'approval_voided', v_voided,
                            'status', (select status from plans where plan_id = p_plan_id));
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.approve_plan (
  p_plan_id       uuid,
  p_version       integer,
  p_note          text,
  p_expires_at    timestamp with time zone,
  p_max_age_hours numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; a approvals; v_fail jsonb;
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
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
  perform audit('human', 'owner', 'plan.approved', p_plan_id, jsonb_build_object('approval_id', a.approval_id, 'version', a.version, 'expires_at', a.expires_at, 'note', a.note));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', 'approved', 'version', a.version, 'approval_id', a.approval_id, 'approved_at', a.approved_at, 'expires_at', a.expires_at);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.audit (
  p_actor_type text,
  p_actor_id   text,
  p_action     text,
  p_plan_id    uuid,
  p_details    jsonb DEFAULT '{}'::jsonb
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO 'tradeboard'
  AS $function$
  insert into audit_log (actor_type, actor_id, action, plan_id, details_json) values (p_actor_type, p_actor_id, p_action, p_plan_id, coalesce(p_details, '{}'::jsonb));
$function$;

CREATE OR REPLACE FUNCTION tradeboard.check_fresh (
  p               tradeboard.plans,
  p_max_age_hours numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path TO 'tradeboard'
  AS $function$
begin
  if p.valid_until <= now() then
    update plans set status = 'expired', reason_code = 'approval_expired', reason_text = 'valid_until passed' where plan_id = p.plan_id;
    perform void_approval(p.plan_id, 'plan expired', 'system', 'board');
    perform audit('system', 'board', 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', 'expired'));
    return fail('expired', 'valid_until has passed: edit the plan with a new window');
  end if;
  if now() - p.updated_at > make_interval(secs => p_max_age_hours * 3600) then
    update plans set status = 'stale', reason_code = 'stale_plan', reason_text = format('not edited for over %s h', p_max_age_hours) where plan_id = p.plan_id;
    perform void_approval(p.plan_id, 'plan stale', 'system', 'board');
    perform audit('system', 'board', 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', 'stale'));
    return fail('stale', format('the plan hasn''t been edited for over %s h: revalidate it with an edit', p_max_age_hours));
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.claim_plan (
  p_plan_id         uuid,
  p_executor_id     text,
  p_idempotency_key text,
  p_ttl_seconds     integer,
  p_recovery        boolean DEFAULT false
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; v_fail jsonb; v_claim uuid := gen_random_uuid();
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if p_recovery then
    if p.status <> 'executing' or p.awaiting_manual then return fail('bad_status', 'nothing to recover'); end if;
    if p.claim_expires_at > now() and p.claim_executor_id <> p_executor_id then return fail('already_claimed', 'another executor holds this plan'); end if;
    update plans set executor_claim_id = v_claim, claim_executor_id = p_executor_id, claim_expires_at = now() + make_interval(secs => p_ttl_seconds) where plan_id = p_plan_id;
    perform audit('executor', p_executor_id, 'executor.recovery_claimed', p_plan_id, jsonb_build_object('claim_id', v_claim, 'idempotency_key', p.claim_idempotency_key));
    return jsonb_build_object('ok', true, 'claim_id', v_claim, 'expires_at', now() + make_interval(secs => p_ttl_seconds), 'idempotency_key', p.claim_idempotency_key);
  end if;
  if p.executor_claim_id is not null and p.claim_expires_at > now() then
    if p.claim_executor_id = p_executor_id and p.claim_idempotency_key = p_idempotency_key and p.status in ('approved', 'validated') then
      return jsonb_build_object('ok', true, 'claim_id', p.executor_claim_id, 'expires_at', p.claim_expires_at, 'idempotency_key', p.claim_idempotency_key, 'resumed', true);
    end if;
    return fail('already_claimed', 'another claim holds this plan');
  end if;
  if p.status <> 'approved' then return fail('bad_status', format('only an approved plan can be claimed (this one is %s)', p.status)); end if;
  if p.is_demo and not (select dry_run from control where id) then return fail('demo_plan', 'the DEMO plan only runs in dry-run'); end if;
  v_fail := gate(p);
  if v_fail is not null then return v_fail; end if;
  update plans set executor_claim_id = v_claim, claim_executor_id = p_executor_id, claim_idempotency_key = p_idempotency_key,
    claim_expires_at = now() + make_interval(secs => p_ttl_seconds) where plan_id = p_plan_id;
  perform audit('executor', p_executor_id, 'executor.claimed', p_plan_id, jsonb_build_object('claim_id', v_claim, 'version', p.current_version, 'idempotency_key', p_idempotency_key));
  return jsonb_build_object('ok', true, 'claim_id', v_claim, 'expires_at', now() + make_interval(secs => p_ttl_seconds), 'idempotency_key', p_idempotency_key);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.close_plan (
  p_plan_id uuid,
  p_to      text,
  p_reason  text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans;
begin
  if p_to not in ('rejected', 'cancelled') then return fail('bad_request', 'rejected or cancelled'); end if;
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if p.status in ('executed', 'failed', 'cancelled') then return fail('bad_status', format('this plan is already %s', p.status)); end if;
  if p.status = 'executing' and not p.awaiting_manual then return fail('bad_status', 'the executor is placing this order right now: pause or kill the executor first'); end if;
  if p_to = 'rejected' and p.status = 'rejected' then return fail('bad_status', 'already rejected'); end if;
  perform void_approval(p_plan_id, 'plan ' || p_to, 'human', 'owner');
  update plans set status = p_to, reason_code = case when p_to = 'rejected' then 'human_rejected' else null end, reason_text = coalesce(p_reason, ''),
    awaiting_manual = false, executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null, last_activity_at = now()
  where plan_id = p_plan_id;
  perform audit('human', 'owner', 'plan.' || p_to, p_plan_id, jsonb_build_object('from', p.status, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', p_to);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.create_plan (
  p_fields          jsonb,
  p_actor_type      text,
  p_actor_id        text,
  p_idempotency_key text,
  p_is_demo         boolean DEFAULT false
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans;
begin
  if p_idempotency_key is not null then
    select * into p from plans where created_by_id = p_actor_id and create_idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status, 'duplicate', true); end if;
  end if;
  insert into plans (title, ticker, order_ticket, thesis, evidence, risks_and_dissent, invalidation, valid_from, valid_until, quote_at, quote_price, quote_source,
                     created_by_type, created_by_id, create_idempotency_key, is_demo)
  values (p_fields->>'title', p_fields->>'ticker', p_fields->'order', p_fields->>'thesis', coalesce(p_fields->>'evidence', ''), coalesce(p_fields->>'risks_and_dissent', ''),
          coalesce(p_fields->>'invalidation', ''), (p_fields->>'valid_from')::timestamptz, (p_fields->>'valid_until')::timestamptz, (p_fields->>'quote_at')::timestamptz,
          (p_fields->>'quote_price')::numeric, p_fields->>'quote_source', p_actor_type, p_actor_id, p_idempotency_key, coalesce(p_is_demo, false))
  returning * into p;
  insert into plan_versions (plan_id, version, edited_by_type, edited_by_id, diff_summary, snapshot) values (p.plan_id, 1, p_actor_type, p_actor_id, 'created', snapshot(p));
  perform audit(p_actor_type, p_actor_id, 'plan.created', p.plan_id, jsonb_build_object('version', 1, 'ticker', p.ticker, 'demo', p.is_demo));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', 1, 'status', p.status, 'duplicate', false);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.executor_step (
  p_claim_id    uuid,
  p_to          text,
  p_ttl_seconds integer
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; v_fail jsonb;
begin
  select * into p from plans where executor_claim_id = p_claim_id for update;
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
  perform audit('executor', p.claim_executor_id, 'plan.status', p.plan_id, jsonb_build_object('from', p.status, 'to', p_to, 'claim_id', p_claim_id));
  return jsonb_build_object('ok', true, 'status', p_to);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.fail (
  p_code    text,
  p_message text,
  p_extra   jsonb DEFAULT '{}'::jsonb
)
  RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE
  AS $function$
  select jsonb_build_object('ok', false, 'error_code', p_code, 'message', p_message) || coalesce(p_extra, '{}'::jsonb);
$function$;

CREATE OR REPLACE FUNCTION tradeboard.forbid_change()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'tradeboard'
  AS $function$
begin
  raise exception '% is append-only: % refused', tg_table_name, tg_op;
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.gate (
  p tradeboard.plans
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SET search_path TO 'tradeboard'
  AS $function$
declare a approvals; c control;
begin
  select * into c from control where id;
  if c.killed then return fail('killed', 'the executor is killed'); end if;
  if c.paused then return fail('paused', 'the executor is paused'); end if;
  select * into a from approvals where approval_id = p.approval_id and voided_at is null;
  if not found then return fail('approval_missing', 'the plan has no valid approval'); end if;
  if a.expires_at <= now() then return fail('approval_expired', 'the approval expired'); end if;
  if a.version <> p.current_version then return fail('plan_changed', 'the plan changed since it was approved'); end if;
  if now() < coalesce(p.valid_from, '-infinity') or now() > p.valid_until then return fail('outside_window', 'now is outside the plan''s validity window'); end if;
  if open_human_questions(p.plan_id) > 0 then return fail('open_questions', 'the owner has open questions'); end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.mark_ready (
  p_plan_id       uuid,
  p_actor_type    text,
  p_actor_id      text,
  p_max_age_hours numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; v_fail jsonb;
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if p.status <> 'debated' then return fail('bad_status', format('only a debated plan can be marked ready (this one is %s)', p.status), jsonb_build_object('status', p.status)); end if;
  if open_human_questions(p_plan_id) > 0 then
    return fail('open_questions', 'the owner has open questions on this plan', jsonb_build_object('open_questions', open_question_list(p_plan_id)));
  end if;
  v_fail := check_fresh(p, p_max_age_hours);
  if v_fail is not null then return v_fail; end if;
  update plans set status = 'ready', last_activity_at = now() where plan_id = p_plan_id;
  perform audit(p_actor_type, p_actor_id, 'plan.ready', p_plan_id, jsonb_build_object('version', p.current_version));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'version', p.current_version, 'status', 'ready');
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.open_human_questions (
  p_plan_id uuid
)
  RETURNS integer
  LANGUAGE sql
  STABLE
  SET search_path TO 'tradeboard'
  AS $function$
  select count(*)::integer from comments where plan_id = p_plan_id and is_question and question_status = 'open' and author_type = 'human';
$function$;

CREATE OR REPLACE FUNCTION tradeboard.open_question_list (
  p_plan_id uuid
)
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SET search_path TO 'tradeboard'
  AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('question_id', comment_id, 'body', left(body, 200), 'asked_by', author_id, 'asked_at', created_at) order by created_at), '[]'::jsonb)
  from comments where plan_id = p_plan_id and is_question and question_status = 'open' and author_type = 'human';
$function$;

CREATE OR REPLACE FUNCTION tradeboard.post_receipt (
  p jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare pl plans; r receipts; v_to text; v_claim uuid := (p->>'claim_id')::uuid; c control;
begin
  -- Lock the plan first, then look for an earlier receipt of this claim: two posts at once serialise here.
  select * into pl from plans where plan_id = (p->>'plan_id')::uuid for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if v_claim is not null then
    select * into r from receipts where claim_id = v_claim;
    if found then return jsonb_build_object('ok', true, 'receipt_id', r.receipt_id, 'duplicate', true, 'status', pl.status); end if;
  end if;
  insert into receipts (plan_id, version, claim_id, executor_id, mode, outcome, reason_code, reason_text, robinhood_order_id, filled_quantity, filled_price, policy_snapshot_id, details)
  values (pl.plan_id, (p->>'version')::integer, v_claim, p->>'executor_id', p->>'mode', p->>'outcome', p->>'reason_code', coalesce(p->>'reason_text', ''),
          p->>'robinhood_order_id', (p->>'filled_quantity')::numeric, (p->>'filled_price')::numeric, (p->>'policy_snapshot_id')::integer, coalesce(p->'details', '{}'::jsonb))
  returning * into r;
  perform audit(case when r.mode = 'manual' then 'human' else 'executor' end, case when r.mode = 'manual' then 'owner' else r.executor_id end, 'receipt.posted', pl.plan_id,
                jsonb_build_object('receipt_id', r.receipt_id, 'mode', r.mode, 'outcome', r.outcome, 'reason_code', r.reason_code, 'version', r.version));
  if r.mode = 'live' then
    select * into c from control where id for update;
    if r.outcome = 'executed' and c.live_trial_pending then
      update control set live_trial_pending = false, updated_at = now() where id;
      perform audit('system', 'board', 'live.trial_passed', pl.plan_id, jsonb_build_object('receipt_id', r.receipt_id));
    elsif r.outcome = 'failed' and c.live_trial_pending then
      update control set dry_run = true, updated_at = now() where id;
      perform audit('system', 'board', 'live.trial_failed', pl.plan_id, jsonb_build_object('receipt_id', r.receipt_id, 'note', 'back to dry-run until the owner re-enables live'));
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
  perform audit('system', 'board', 'plan.status', pl.plan_id, jsonb_build_object('from', pl.status, 'to', v_to, 'receipt_id', r.receipt_id));
  return jsonb_build_object('ok', true, 'receipt_id', r.receipt_id, 'status', v_to);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.release_claim (
  p_claim_id uuid,
  p_note     text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans;
begin
  select * into p from plans where executor_claim_id = p_claim_id for update;
  if not found then return fail('claim_lost', 'this claim is no longer held'); end if;
  if p.status not in ('approved', 'validated') then return fail('bad_status', format('a %s plan can''t be released', p.status)); end if;
  update plans set status = 'approved', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = p.plan_id;
  perform audit('executor', p.claim_executor_id, 'executor.released', p.plan_id, jsonb_build_object('claim_id', p_claim_id, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', 'approved');
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.request_changes (
  p_plan_id    uuid,
  p_actor_type text,
  p_actor_id   text,
  p_body       text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans; r jsonb;
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
  if p.status not in ('ready', 'approved') then return fail('bad_status', format('changes can be requested on a ready or approved plan (this one is %s)', p.status)); end if;
  perform void_approval(p_plan_id, 'changes requested', p_actor_type, p_actor_id);
  update plans set status = 'debated' where plan_id = p_plan_id;
  r := add_comment(p_plan_id, p_actor_type, p_actor_id, 'Changes requested: ' || p_body, 'general', null, false, null);
  perform audit(p_actor_type, p_actor_id, 'plan.changes_requested', p_plan_id, jsonb_build_object('from', p.status));
  return jsonb_build_object('ok', true, 'plan_id', p_plan_id, 'status', 'debated', 'comment_id', r->'comment_id');
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.resolve_agent_token (
  p_token_hash text
)
  RETURNS TABLE (
    agent_id text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
  update agent_tokens t set last_used_at = now()
  from agents a
  where t.token_hash = p_token_hash and t.revoked_at is null and a.agent_id = t.agent_id and a.revoked_at is null
  returning t.agent_id
$function$;

CREATE OR REPLACE FUNCTION tradeboard.resolve_executor_token (
  p_token_hash text
)
  RETURNS TABLE (
    executor_id text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
  update executor_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning executor_id
$function$;

CREATE OR REPLACE FUNCTION tradeboard.set_question (
  p_comment_id uuid,
  p_resolve    boolean,
  p_note       text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare c comments; p plans;
begin
  select * into c from comments where comment_id = p_comment_id and is_question;
  if not found then return fail('not_found', 'no such question'); end if;
  select * into p from plans where plan_id = c.plan_id for update;
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
  perform audit('human', 'owner', case when p_resolve then 'question.resolved' else 'question.reopened' end, p.plan_id, jsonb_build_object('question_id', p_comment_id, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', (select status from plans where plan_id = p.plan_id), 'open_human_questions', open_human_questions(p.plan_id));
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.snapshot (
  p tradeboard.plans
)
  RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO 'tradeboard'
  AS $function$
  select jsonb_build_object(
    'title', p.title, 'ticker', p.ticker, 'side', p.side, 'order', p.order_ticket, 'thesis', p.thesis, 'evidence', p.evidence,
    'risks_and_dissent', p.risks_and_dissent, 'invalidation', p.invalidation, 'valid_from', p.valid_from, 'valid_until', p.valid_until,
    'quote_at', p.quote_at, 'quote_price', p.quote_price, 'quote_source', p.quote_source, 'version', p.current_version, 'is_demo', p.is_demo);
$function$;

CREATE OR REPLACE FUNCTION tradeboard.sweep (
  p_max_age_hours numeric
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare r record; n_exp int := 0; n_app int := 0; n_claim int := 0; n_stale int := 0;
begin
  -- Claims that ran out before `executing`: back to approved for a later loop (§9.1 step 9).
  for r in select * from plans where status in ('approved', 'validated') and claim_expires_at <= now() for update skip locked loop
    update plans set status = 'approved', executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null where plan_id = r.plan_id;
    perform audit('system', 'board', 'claim.expired', r.plan_id, jsonb_build_object('executor_id', r.claim_executor_id, 'note', 'a prior attempt expired; the plan is approved again'));
    n_claim := n_claim + 1;
  end loop;
  -- Plans past valid_until (nothing in flight).
  for r in select * from plans where status in ('draft', 'debated', 'ready', 'approved') and valid_until <= now() for update skip locked loop
    perform void_approval(r.plan_id, 'plan expired', 'system', 'board');
    update plans set status = 'expired', reason_code = 'approval_expired', reason_text = 'valid_until passed' where plan_id = r.plan_id;
    perform audit('system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', r.status, 'to', 'expired'));
    n_exp := n_exp + 1;
  end loop;
  -- Approvals past their expiry: back to debated (§6.5.2).
  for r in select p.* from plans p join approvals a on a.approval_id = p.approval_id
           where p.status = 'approved' and a.voided_at is null and a.expires_at <= now() for update of p skip locked loop
    perform void_approval(r.plan_id, 'approval expired', 'system', 'board');
    update plans set status = 'debated', reason_code = 'approval_expired', reason_text = 'the approval expired' where plan_id = r.plan_id;
    perform audit('system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', 'approved', 'to', 'debated', 'why', 'approval expired'));
    n_app := n_app + 1;
  end loop;
  -- Plans unedited for too long on their way to execution (§6.5.4).
  for r in select * from plans where status in ('ready', 'approved') and now() - updated_at > make_interval(secs => p_max_age_hours * 3600) for update skip locked loop
    perform void_approval(r.plan_id, 'plan stale', 'system', 'board');
    update plans set status = 'stale', reason_code = 'stale_plan', reason_text = format('not edited for over %s h', p_max_age_hours) where plan_id = r.plan_id;
    perform audit('system', 'board', 'plan.status', r.plan_id, jsonb_build_object('from', r.status, 'to', 'stale'));
    n_stale := n_stale + 1;
  end loop;
  return jsonb_build_object('expired', n_exp, 'approvals_expired', n_app, 'claims_expired', n_claim, 'stale', n_stale);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.update_plan (
  p_plan_id          uuid,
  p_expected_version integer,
  p_fields           jsonb,
  p_diff             text,
  p_actor_type       text,
  p_actor_id         text
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
declare p plans;
begin
  select * into p from plans where plan_id = p_plan_id for update;
  if not found then return fail('not_found', 'no such plan'); end if;
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
  perform audit(p_actor_type, p_actor_id, 'plan.edited', p.plan_id, jsonb_build_object('version', p.current_version, 'diff', p_diff));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.void_approval (
  p_plan_id    uuid,
  p_reason     text,
  p_actor_type text,
  p_actor_id   text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SET search_path TO 'tradeboard'
  AS $function$
declare v_id uuid;
begin
  update approvals set voided_at = now(), void_reason = p_reason
  where plan_id = p_plan_id and voided_at is null returning approval_id into v_id;
  if v_id is null then return false; end if;
  update plans set approval_id = null where plan_id = p_plan_id;
  perform audit(p_actor_type, p_actor_id, 'approval.voided', p_plan_id, jsonb_build_object('approval_id', v_id, 'reason', p_reason));
  return true;
end $function$;

ALTER TABLE "tradeboard"."agent_tokens"
  ADD CONSTRAINT "agent_tokens_agent_id_fkey" FOREIGN KEY (agent_id) REFERENCES tradeboard.agents(agent_id);

ALTER TABLE "tradeboard"."comments"
  ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY (parent_comment_id) REFERENCES tradeboard.comments(comment_id);

ALTER TABLE "tradeboard"."approvals"
  ADD CONSTRAINT "approvals_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES tradeboard.plans(plan_id);

ALTER TABLE "tradeboard"."comments"
  ADD CONSTRAINT "comments_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES tradeboard.plans(plan_id);

ALTER TABLE "tradeboard"."plan_versions"
  ADD CONSTRAINT "plan_versions_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES tradeboard.plans(plan_id);

ALTER TABLE "tradeboard"."receipts"
  ADD CONSTRAINT "receipts_plan_id_fkey" FOREIGN KEY (plan_id) REFERENCES tradeboard.plans(plan_id);

CREATE INDEX agent_tokens_agent ON tradeboard.agent_tokens USING btree (agent_id);

CREATE INDEX approvals_plan ON tradeboard.approvals USING btree (plan_id);

CREATE INDEX audit_plan ON tradeboard.audit_log USING btree (plan_id, event_id);

CREATE INDEX comments_open ON tradeboard.comments USING btree (plan_id)
  WHERE (question_status = 'open'::text);

CREATE INDEX comments_plan ON tradeboard.comments USING btree (plan_id, created_at);

CREATE INDEX plans_status ON tradeboard.plans USING btree (status, updated_at DESC);

CREATE INDEX plans_ticker ON tradeboard.plans USING btree (ticker);

CREATE INDEX receipts_plan ON tradeboard.receipts USING btree (plan_id);

CREATE INDEX receipts_time ON tradeboard.receipts USING btree (attempted_at DESC);

CREATE TRIGGER approvals_no_delete
  BEFORE DELETE ON tradeboard.approvals
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

CREATE TRIGGER audit_append_only
  BEFORE DELETE OR UPDATE ON tradeboard.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

CREATE TRIGGER comments_no_delete
  BEFORE DELETE ON tradeboard.comments
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

CREATE TRIGGER versions_append_only
  BEFORE DELETE OR UPDATE ON tradeboard.plan_versions
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

CREATE TRIGGER plans_no_delete
  BEFORE DELETE ON tradeboard.plans
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

CREATE TRIGGER receipts_append_only
  BEFORE DELETE OR UPDATE ON tradeboard.receipts
  FOR EACH ROW
  EXECUTE FUNCTION tradeboard.forbid_change();

REVOKE ALL ON FUNCTION "tradeboard"."add_comment"(uuid, text, text, text, text, uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."add_comment"(uuid, text, text, text, text, uuid, boolean, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."approve_plan"(uuid, integer, text, timestamp WITH time zone, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."approve_plan"(uuid, integer, text, timestamp WITH time zone, numeric) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."audit"(text, text, text, uuid, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."audit"(text, text, text, uuid, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."check_fresh"(tradeboard.plans, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."check_fresh"(tradeboard.plans, numeric) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."claim_plan"(uuid, text, text, integer, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."claim_plan"(uuid, text, text, integer, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."close_plan"(uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."close_plan"(uuid, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."create_plan"(jsonb, text, text, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."create_plan"(jsonb, text, text, text, boolean) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."executor_step"(uuid, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."executor_step"(uuid, text, integer) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."fail"(text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."fail"(text, text, jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."forbid_change"() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."forbid_change"() TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."gate"(tradeboard.plans) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."gate"(tradeboard.plans) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."mark_ready"(uuid, text, text, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."mark_ready"(uuid, text, text, numeric) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."open_human_questions"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."open_human_questions"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."open_question_list"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."open_question_list"(uuid) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."post_receipt"(jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."post_receipt"(jsonb) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."release_claim"(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."release_claim"(uuid, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."request_changes"(uuid, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."request_changes"(uuid, text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."resolve_agent_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."resolve_agent_token"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."resolve_executor_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."resolve_executor_token"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."set_question"(uuid, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."set_question"(uuid, boolean, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."snapshot"(tradeboard.plans) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."snapshot"(tradeboard.plans) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."sweep"(numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."sweep"(numeric) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."update_plan"(uuid, integer, jsonb, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."update_plan"(uuid, integer, jsonb, text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "tradeboard"."void_approval"(uuid, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tradeboard"."void_approval"(uuid, text, text, text) TO "postgres", "service_role";

GRANT CREATE, USAGE ON SCHEMA "tradeboard" TO "postgres";

GRANT USAGE ON SCHEMA "tradeboard" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."agent_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."agent_tokens" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."agents" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."agents" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."approvals" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."approvals" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."audit_log" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."audit_log" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."comments" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."comments" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."control" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."control" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."executor_status" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."executor_status" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."executor_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."executor_tokens" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."owner" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."owner" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."plan_versions" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."plan_versions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."plans" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."plans" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."policy_versions" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."policy_versions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."receipts" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."receipts" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."sessions" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."sessions" TO "service_role";
