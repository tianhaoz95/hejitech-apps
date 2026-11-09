SET local check_function_bodies = off;

CREATE SCHEMA "hq";

CREATE TABLE "hq"."attachments" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "card_id"      text                     NOT NULL,
  "phase"        text                     NOT NULL,
  "evidence"     jsonb                    NOT NULL,
  "file_key"     text,
  "by"           text                     NOT NULL,
  "at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attachments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."attachments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."audit" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "at"           timestamp with time zone NOT NULL DEFAULT now(),
  "actor"        text                     NOT NULL,
  "action"       text                     NOT NULL,
  "target"       text,
  "detail"       jsonb,
  CONSTRAINT "audit_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."audit"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."cards" (
  "id"           text                     NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "repo"         text                     NOT NULL,
  "project"      text                     NOT NULL,
  "kind"         text                     NOT NULL,
  "title"        text                     NOT NULL,
  "why"          text                     NOT NULL,
  "evidence"     jsonb                    NOT NULL,
  "plan"         text                     NOT NULL,
  "verify"       text                     NOT NULL,
  "tier"         text                     NOT NULL,
  "effort"       text                     NOT NULL,
  "risk"         text                     NOT NULL,
  "risk_reason"  text,
  "verbs"        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "source"       jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "dedupe_key"   text,
  "status"       text                     NOT NULL,
  "priority"     integer                  NOT NULL DEFAULT 0,
  "decided_by"   text,
  "branch"       text,
  "pr_url"       text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cards_pkey" PRIMARY KEY (id),
  CONSTRAINT "cards_tier_check" CHECK ((tier = ANY (ARRAY['L0'::text, 'L1'::text, 'L2'::text, 'L3'::text])))
);

ALTER TABLE "hq"."cards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."comments" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "card_id"      text                     NOT NULL,
  "author"       text                     NOT NULL,
  "body"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "comments_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."comments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."decisions" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "card_id"      text                     NOT NULL,
  "decision"     text                     NOT NULL,
  "reason"       text,
  "by"           text                     NOT NULL,
  "at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "decisions_decision_check" CHECK ((decision = ANY (ARRAY['approved'::text, 'rejected'::text]))),
  CONSTRAINT "decisions_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."decisions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."health" (
  "workspace_id" uuid                     NOT NULL,
  "project"      text                     NOT NULL,
  "data"         jsonb                    NOT NULL,
  "ok"           boolean                  NOT NULL,
  "at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "health_pkey" PRIMARY KEY (workspace_id, project)
);

ALTER TABLE "hq"."health"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."invites" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" uuid                     NOT NULL,
  "code_hash"    text                     NOT NULL,
  "role"         text                     NOT NULL,
  "created_by"   uuid,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"   timestamp with time zone NOT NULL,
  "used_by"      uuid,
  "used_at"      timestamp with time zone,
  CONSTRAINT "invites_code_hash_key" UNIQUE (code_hash),
  CONSTRAINT "invites_pkey" PRIMARY KEY (id),
  CONSTRAINT "invites_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'approver'::text, 'viewer'::text])))
);

ALTER TABLE "hq"."invites"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."members" (
  "workspace_id" uuid                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "role"         text                     NOT NULL,
  "email"        text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "members_pkey" PRIMARY KEY (workspace_id, user_id),
  CONSTRAINT "members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'approver'::text, 'viewer'::text])))
);

ALTER TABLE "hq"."members"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."runs" (
  "id"           text                     NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "kind"         text                     NOT NULL,
  "project"      text,
  "scout"        text,
  "card_id"      text,
  "verb"         text,
  "args"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "runs_on"      text                     NOT NULL DEFAULT 'any'::text,
  "agent"        text,
  "status"       text                     NOT NULL,
  "requested_by" text                     NOT NULL,
  "runner"       text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "started_at"   timestamp with time zone,
  "finished_at"  timestamp with time zone,
  "summary"      text,
  "output"       text,
  "cost_usd"     numeric                  NOT NULL DEFAULT 0,
  "session"      text,
  CONSTRAINT "runs_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."runs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."tokens" (
  "id"           text                     NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "role"         text                     NOT NULL,
  "hash"         text                     NOT NULL,
  "created_by"   uuid,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "tokens_hash_key" UNIQUE (hash),
  CONSTRAINT "tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "tokens_role_check" CHECK ((role = ANY (ARRAY['runner'::text, 'agent'::text])))
);

ALTER TABLE "hq"."tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."workspaces" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "repo"       text                     NOT NULL,
  "policy"     jsonb,
  "commit_sha" text,
  "synced_at"  timestamp with time zone,
  "paused"     boolean                  NOT NULL DEFAULT false,
  "created_by" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workspaces_name_check" CHECK (((length(name) >= 1) AND (length(name) <= 80))),
  CONSTRAINT "workspaces_pkey" PRIMARY KEY (id),
  CONSTRAINT "workspaces_repo_check" CHECK ((repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'::text))
);

ALTER TABLE "hq"."workspaces"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION hq.has_role (
  p_workspace uuid,
  p_roles     text[] DEFAULT ARRAY['admin'::text,
  'approver'::text,
  'viewer'::text]
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'hq'
  AS $function$
  select exists (
    select 1 from members
    where workspace_id = p_workspace and user_id = auth.uid() and role = any (p_roles)
  )
$function$;

ALTER TABLE "hq"."attachments"
  ADD CONSTRAINT "attachments_card_id_fkey" FOREIGN KEY (card_id) REFERENCES hq.cards(id) ON DELETE CASCADE;

ALTER TABLE "hq"."comments"
  ADD CONSTRAINT "comments_card_id_fkey" FOREIGN KEY (card_id) REFERENCES hq.cards(id) ON DELETE CASCADE;

ALTER TABLE "hq"."decisions"
  ADD CONSTRAINT "decisions_card_id_fkey" FOREIGN KEY (card_id) REFERENCES hq.cards(id) ON DELETE CASCADE;

ALTER TABLE "hq"."invites"
  ADD CONSTRAINT "invites_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "hq"."invites"
  ADD CONSTRAINT "invites_used_by_fkey" FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "hq"."members"
  ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "hq"."runs"
  ADD CONSTRAINT "runs_card_id_fkey" FOREIGN KEY (card_id) REFERENCES hq.cards(id) ON DELETE CASCADE;

ALTER TABLE "hq"."tokens"
  ADD CONSTRAINT "tokens_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "hq"."workspaces"
  ADD CONSTRAINT "workspaces_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "hq"."attachments"
  ADD CONSTRAINT "attachments_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."audit"
  ADD CONSTRAINT "audit_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."cards"
  ADD CONSTRAINT "cards_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."comments"
  ADD CONSTRAINT "comments_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."decisions"
  ADD CONSTRAINT "decisions_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."health"
  ADD CONSTRAINT "health_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."invites"
  ADD CONSTRAINT "invites_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."members"
  ADD CONSTRAINT "members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."runs"
  ADD CONSTRAINT "runs_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."tokens"
  ADD CONSTRAINT "tokens_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

CREATE INDEX attachments_card ON hq.attachments USING btree (card_id, id);

CREATE INDEX audit_workspace ON hq.audit USING btree (workspace_id, id DESC);

CREATE INDEX cards_workspace_dedupe ON hq.cards USING btree (workspace_id, dedupe_key);

CREATE INDEX cards_workspace_status ON hq.cards USING btree (workspace_id, status, priority DESC);

CREATE INDEX comments_card ON hq.comments USING btree (card_id, id);

CREATE INDEX decisions_workspace ON hq.decisions USING btree (workspace_id, at DESC);

CREATE INDEX invites_workspace ON hq.invites USING btree (workspace_id);

CREATE INDEX members_user ON hq.members USING btree (user_id);

CREATE INDEX runs_workspace_status ON hq.runs USING btree (workspace_id, status, created_at);

CREATE INDEX tokens_workspace ON hq.tokens USING btree (workspace_id);

CREATE POLICY "members read attachments" ON "hq"."attachments"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "admins read audit" ON "hq"."audit"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id, ARRAY['admin'::text]));

CREATE POLICY "members read cards" ON "hq"."cards"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "members read comments" ON "hq"."comments"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "members read decisions" ON "hq"."decisions"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "members read health" ON "hq"."health"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "admins read invites" ON "hq"."invites"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id, ARRAY['admin'::text]));

CREATE POLICY "members read members" ON "hq"."members"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "members read runs" ON "hq"."runs"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "admins read tokens" ON "hq"."tokens"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id, ARRAY['admin'::text]));

CREATE POLICY "members read their workspaces" ON "hq"."workspaces"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(id));

REVOKE ALL ON FUNCTION "hq"."has_role"(uuid, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "hq"."has_role"(uuid, text[]) TO "authenticated", "service_role";

GRANT USAGE ON SCHEMA "hq" TO "anon", "authenticated", "service_role";

GRANT SELECT ON TABLE "hq"."attachments" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."attachments" TO "service_role";

GRANT SELECT ON TABLE "hq"."audit" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."audit" TO "service_role";

GRANT SELECT ON TABLE "hq"."cards" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."cards" TO "service_role";

GRANT SELECT ON TABLE "hq"."comments" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."comments" TO "service_role";

GRANT SELECT ON TABLE "hq"."decisions" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."decisions" TO "service_role";

GRANT SELECT ON TABLE "hq"."health" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."health" TO "service_role";

GRANT SELECT ON TABLE "hq"."invites" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."invites" TO "service_role";

GRANT SELECT ON TABLE "hq"."members" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."members" TO "service_role";

GRANT SELECT ON TABLE "hq"."runs" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."runs" TO "service_role";

GRANT SELECT ON TABLE "hq"."tokens" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."tokens" TO "service_role";

GRANT SELECT ON TABLE "hq"."workspaces" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."workspaces" TO "service_role";

-- HQ's Storage bucket (private; the Worker reads and writes it with the service key). Files live
-- under <workspace_id>/cards/<card>/….
insert into storage.buckets (id, name, public) values ('hq', 'hq', false) on conflict (id) do nothing;
