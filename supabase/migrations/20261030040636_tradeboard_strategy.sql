SET local check_function_bodies = off;

ALTER TABLE "tradeboard"."comments"
  DROP CONSTRAINT "comments_anchor_check";

CREATE TABLE "tradeboard"."strategy_proposals" (
  "proposal_id"      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          uuid                     NOT NULL,
  "agent_id"         text                     NOT NULL,
  "body"             text                     NOT NULL,
  "summary"          text                     NOT NULL DEFAULT ''::text,
  "based_on_version" integer,
  "status"           text                     NOT NULL DEFAULT 'open'::text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "decided_at"       timestamp with time zone,
  CONSTRAINT "strategy_proposals_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 20000))),
  CONSTRAINT "strategy_proposals_pkey" PRIMARY KEY (proposal_id),
  CONSTRAINT "strategy_proposals_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'adopted'::text, 'dismissed'::text])))
);

ALTER TABLE "tradeboard"."strategy_proposals"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tradeboard"."strategy_versions" (
  "user_id"       uuid                     NOT NULL,
  "version"       integer                  NOT NULL,
  "body"          text                     NOT NULL,
  "note"          text                     NOT NULL DEFAULT ''::text,
  "from_proposal" uuid,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "strategy_versions_body_check" CHECK (((length(body) >= 1) AND (length(body) <= 20000))),
  CONSTRAINT "strategy_versions_pkey" PRIMARY KEY (user_id, VERSION)
);

ALTER TABLE "tradeboard"."strategy_versions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "tradeboard"."plans"
  ADD COLUMN "fit_with_strategy" text NOT NULL DEFAULT ''::text;

ALTER TABLE "tradeboard"."plans"
  ADD COLUMN "strategy_version" integer;

CREATE OR REPLACE FUNCTION tradeboard.create_plan (
  p_user_id         uuid,
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
    select * into p from plans where user_id = p_user_id and created_by_id = p_actor_id and create_idempotency_key = p_idempotency_key;
    if found then return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status, 'duplicate', true); end if;
  end if;
  insert into plans (user_id, title, ticker, order_ticket, thesis, evidence, risks_and_dissent, invalidation, fit_with_strategy, strategy_version, valid_from, valid_until, quote_at, quote_price, quote_source,
                     created_by_type, created_by_id, create_idempotency_key, is_demo)
  values (p_user_id, p_fields->>'title', p_fields->>'ticker', p_fields->'order', p_fields->>'thesis', coalesce(p_fields->>'evidence', ''), coalesce(p_fields->>'risks_and_dissent', ''),
          coalesce(p_fields->>'invalidation', ''), coalesce(p_fields->>'fit_with_strategy', ''), (p_fields->>'strategy_version')::integer, (p_fields->>'valid_from')::timestamptz, (p_fields->>'valid_until')::timestamptz, (p_fields->>'quote_at')::timestamptz,
          (p_fields->>'quote_price')::numeric, p_fields->>'quote_source', p_actor_type, p_actor_id, p_idempotency_key, coalesce(p_is_demo, false))
  returning * into p;
  insert into plan_versions (plan_id, version, edited_by_type, edited_by_id, diff_summary, snapshot) values (p.plan_id, 1, p_actor_type, p_actor_id, 'created', snapshot(p));
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.created', p.plan_id, jsonb_build_object('version', 1, 'ticker', p.ticker, 'demo', p.is_demo));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', 1, 'status', p.status, 'duplicate', false);
end $function$;

CREATE OR REPLACE FUNCTION tradeboard.delete_account (
  p_user_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'tradeboard', 'extensions'
  AS $function$
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
  delete from strategy_versions where user_id = p_user_id;
  delete from strategy_proposals where user_id = p_user_id;
  delete from control where user_id = p_user_id;
  delete from executor_status where user_id = p_user_id;
  delete from executor_tokens where user_id = p_user_id;
  delete from agent_tokens where user_id = p_user_id;
  delete from agents where user_id = p_user_id;
  delete from sessions where user_id = p_user_id;
  delete from accounts where user_id = p_user_id;
  perform set_config('tradeboard.deleting_account', 'off', true);
  return jsonb_build_object('ok', true, 'plans_deleted', n);
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
    'risks_and_dissent', p.risks_and_dissent, 'invalidation', p.invalidation, 'fit_with_strategy', p.fit_with_strategy, 'strategy_version', p.strategy_version,
    'valid_from', p.valid_from, 'valid_until', p.valid_until,
    'quote_at', p.quote_at, 'quote_price', p.quote_price, 'quote_source', p.quote_source, 'version', p.current_version, 'is_demo', p.is_demo);
$function$;

CREATE OR REPLACE FUNCTION tradeboard.update_plan (
  p_user_id          uuid,
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
    fit_with_strategy = coalesce(p_fields->>'fit_with_strategy', ''), strategy_version = (p_fields->>'strategy_version')::integer,
    valid_from = (p_fields->>'valid_from')::timestamptz, valid_until = (p_fields->>'valid_until')::timestamptz, quote_at = (p_fields->>'quote_at')::timestamptz,
    quote_price = (p_fields->>'quote_price')::numeric, quote_source = p_fields->>'quote_source',
    current_version = current_version + 1, status = 'debated', updated_at = now(), last_activity_at = now(), reason_code = null, reason_text = null,
    executor_claim_id = null, claim_executor_id = null, claim_idempotency_key = null, claim_expires_at = null
  where plan_id = p_plan_id returning * into p;
  insert into plan_versions (plan_id, version, edited_by_type, edited_by_id, diff_summary, snapshot) values (p.plan_id, p.current_version, p_actor_type, p_actor_id, p_diff, snapshot(p));
  perform audit(p_user_id, p_actor_type, p_actor_id, 'plan.edited', p.plan_id, jsonb_build_object('version', p.current_version, 'diff', p_diff));
  return jsonb_build_object('ok', true, 'plan_id', p.plan_id, 'version', p.current_version, 'status', p.status);
end $function$;

ALTER TABLE "tradeboard"."comments"
  ADD CONSTRAINT "comments_anchor_check"
    CHECK ((anchor = ANY (ARRAY['thesis'::text, 'evidence'::text, 'risks_and_dissent'::text, 'invalidation'::text, 'fit_with_strategy'::text, 'order'::text, 'general'::text])));

CREATE INDEX strategy_proposals_user ON tradeboard.strategy_proposals USING btree (user_id, created_at DESC);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."strategy_proposals" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."strategy_proposals" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tradeboard"."strategy_versions" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tradeboard"."strategy_versions" TO "service_role";
