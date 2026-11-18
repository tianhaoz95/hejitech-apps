SET local check_function_bodies = off;

CREATE SCHEMA "folio";

CREATE TABLE "folio"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "folio"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."artifacts" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "slug"                text                     NOT NULL,
  "owner_id"            uuid                     NOT NULL,
  "title"               text                     NOT NULL,
  "description"         text                     NOT NULL DEFAULT ''::text,
  "visibility"          text                     NOT NULL DEFAULT 'private'::text,
  "head_version"        integer                  NOT NULL DEFAULT 0,
  "forked_from"         uuid,
  "forked_from_version" integer,
  "next_suggestion"     integer                  NOT NULL DEFAULT 1,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "artifacts_pkey" PRIMARY KEY (id),
  CONSTRAINT "artifacts_slug_key" UNIQUE (slug),
  CONSTRAINT "artifacts_visibility_check" CHECK ((visibility = ANY (ARRAY['private'::text, 'link'::text])))
);

ALTER TABLE "folio"."artifacts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."blobs" (
  "artifact_id" uuid                     NOT NULL,
  "hash"        text                     NOT NULL,
  "size"        integer                  NOT NULL,
  "text"        text,
  "in_storage"  boolean                  NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "blobs_pkey" PRIMARY KEY (artifact_id, hash)
);

ALTER TABLE "folio"."blobs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."comments" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id"   uuid                     NOT NULL,
  "version"       integer,
  "suggestion_id" uuid,
  "parent_id"     uuid,
  "path"          text,
  "anchor"        jsonb,
  "body"          text                     NOT NULL,
  "author_id"     uuid,
  "agent"         text                     NOT NULL,
  "model"         text,
  "via"           text                     NOT NULL,
  "resolved"      boolean                  NOT NULL DEFAULT false,
  "resolved_by"   uuid,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "comments_pkey" PRIMARY KEY (id),
  CONSTRAINT "comments_via_check" CHECK ((via = ANY (ARRAY['web'::text, 'mcp'::text, 'api'::text])))
);

ALTER TABLE "folio"."comments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."events" (
  "id"                bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "artifact_id"       uuid                     NOT NULL,
  "kind"              text                     NOT NULL,
  "version"           integer,
  "suggestion_number" integer,
  "comment_id"        uuid,
  "actor_id"          uuid,
  "agent"             text                     NOT NULL,
  "via"               text                     NOT NULL,
  "summary"           text                     NOT NULL,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "folio"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."invites" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"  text                     NOT NULL,
  "artifact_id" uuid                     NOT NULL,
  "role"        text                     NOT NULL,
  "created_by"  uuid                     NOT NULL,
  "uses"        integer                  NOT NULL DEFAULT 0,
  "expires_at"  timestamp with time zone,
  "revoked"     boolean                  NOT NULL DEFAULT false,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "invites_pkey" PRIMARY KEY (id),
  CONSTRAINT "invites_role_check" CHECK ((role = ANY (ARRAY['editor'::text, 'viewer'::text]))),
  CONSTRAINT "invites_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "folio"."invites"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."members" (
  "artifact_id" uuid                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "role"        text                     NOT NULL,
  "invited_by"  uuid,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "members_pkey" PRIMARY KEY (artifact_id, user_id),
  CONSTRAINT "members_role_check" CHECK ((role = ANY (ARRAY['editor'::text, 'viewer'::text])))
);

ALTER TABLE "folio"."members"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."suggestions" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "artifact_id"     uuid                     NOT NULL,
  "number"          integer                  NOT NULL,
  "base_version"    integer                  NOT NULL,
  "title"           text                     NOT NULL,
  "rationale"       text                     NOT NULL DEFAULT ''::text,
  "ops"             jsonb                    NOT NULL,
  "status"          text                     NOT NULL DEFAULT 'open'::text,
  "author_id"       uuid,
  "agent"           text                     NOT NULL,
  "model"           text,
  "via"             text                     NOT NULL,
  "resolved_by"     uuid,
  "resolved_agent"  text,
  "resolution_note" text,
  "result_version"  integer,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at"     timestamp with time zone,
  CONSTRAINT "suggestions_artifact_id_number_key" UNIQUE (artifact_id, number),
  CONSTRAINT "suggestions_pkey" PRIMARY KEY (id),
  CONSTRAINT "suggestions_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text]))),
  CONSTRAINT "suggestions_via_check" CHECK ((via = ANY (ARRAY['web'::text, 'mcp'::text, 'api'::text])))
);

ALTER TABLE "folio"."suggestions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."versions" (
  "artifact_id"   uuid                     NOT NULL,
  "number"        integer                  NOT NULL,
  "parent"        integer,
  "manifest"      jsonb                    NOT NULL,
  "message"       text                     NOT NULL DEFAULT ''::text,
  "author_id"     uuid,
  "agent"         text                     NOT NULL,
  "model"         text,
  "via"           text                     NOT NULL,
  "kind"          text                     NOT NULL DEFAULT 'edit'::text,
  "suggestion_id" uuid,
  "restored_from" integer,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "versions_kind_check" CHECK ((kind = ANY (ARRAY['create'::text, 'edit'::text, 'suggestion'::text, 'restore'::text, 'fork'::text]))),
  CONSTRAINT "versions_pkey" PRIMARY KEY (artifact_id, number),
  CONSTRAINT "versions_via_check" CHECK ((via = ANY (ARRAY['web'::text, 'mcp'::text, 'api'::text])))
);

ALTER TABLE "folio"."versions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION folio.commit_version (
  p_artifact      uuid,
  p_base          integer,
  p_manifest      jsonb,
  p_message       text,
  p_author        uuid,
  p_agent         text,
  p_model         text,
  p_via           text,
  p_kind          text,
  p_suggestion    uuid    DEFAULT NULL::uuid,
  p_restored_from integer DEFAULT NULL::integer
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'folio'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION folio.is_member (
  p_artifact uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'folio'
  AS $function$
  select exists (select 1 from artifacts a where a.id = p_artifact and a.owner_id = auth.uid())
      or exists (select 1 from members m where m.artifact_id = p_artifact and m.user_id = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION folio.next_suggestion_number (
  p_artifact uuid
)
  RETURNS integer
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'folio'
  AS $function$
  update artifacts set next_suggestion = next_suggestion + 1 where id = p_artifact
  returning next_suggestion - 1
$function$;

CREATE OR REPLACE FUNCTION folio.resolve_access_token (
  p_token_hash text
)
  RETURNS TABLE (
    token_id uuid,
    user_id  uuid,
    name     text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'folio', 'extensions'
  AS $function$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id, access_tokens.name
$function$;

ALTER TABLE "folio"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."artifacts"
  ADD CONSTRAINT "artifacts_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."artifacts"
  ADD CONSTRAINT "artifacts_forked_from_fkey" FOREIGN KEY (forked_from) REFERENCES folio.artifacts(id) ON DELETE SET NULL;

ALTER TABLE "folio"."blobs"
  ADD CONSTRAINT "blobs_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."comments"
  ADD CONSTRAINT "comments_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."comments"
  ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."comments"
  ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES folio.comments(id) ON DELETE CASCADE;

ALTER TABLE "folio"."comments"
  ADD CONSTRAINT "comments_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."events"
  ADD CONSTRAINT "events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."events"
  ADD CONSTRAINT "events_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."invites"
  ADD CONSTRAINT "invites_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."invites"
  ADD CONSTRAINT "invites_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."members"
  ADD CONSTRAINT "members_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."members"
  ADD CONSTRAINT "members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."members"
  ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."suggestions"
  ADD CONSTRAINT "suggestions_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."suggestions"
  ADD CONSTRAINT "suggestions_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."comments"
  ADD CONSTRAINT "comments_suggestion_id_fkey" FOREIGN KEY (suggestion_id) REFERENCES folio.suggestions(id) ON DELETE CASCADE;

ALTER TABLE "folio"."suggestions"
  ADD CONSTRAINT "suggestions_resolved_by_fkey" FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "folio"."versions"
  ADD CONSTRAINT "versions_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."versions"
  ADD CONSTRAINT "versions_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX access_tokens_user ON folio.access_tokens USING btree (user_id);

CREATE INDEX artifacts_owner ON folio.artifacts USING btree (owner_id, updated_at DESC);

CREATE INDEX comments_artifact ON folio.comments USING btree (artifact_id, created_at);

CREATE INDEX events_artifact ON folio.events USING btree (artifact_id, id);

CREATE INDEX invites_artifact ON folio.invites USING btree (artifact_id);

CREATE INDEX members_user ON folio.members USING btree (user_id);

CREATE INDEX suggestions_open ON folio.suggestions USING btree (artifact_id, status);

CREATE POLICY "own access tokens" ON "folio"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "members read artifacts" ON "folio"."artifacts"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(id));

CREATE POLICY "members read blobs" ON "folio"."blobs"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

CREATE POLICY "members read comments" ON "folio"."comments"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

CREATE POLICY "members read events" ON "folio"."events"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

CREATE POLICY "members read members" ON "folio"."members"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

CREATE POLICY "members read suggestions" ON "folio"."suggestions"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

CREATE POLICY "members read versions" ON "folio"."versions"
  FOR SELECT
  TO PUBLIC
  USING (folio.is_member(artifact_id));

REVOKE ALL ON FUNCTION "folio"."commit_version"(uuid, integer, jsonb, text, uuid, text, text, text, text, uuid, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "folio"."commit_version"(uuid, integer, jsonb, text, uuid, text, text, text, text, uuid, integer) TO "service_role";

REVOKE ALL ON FUNCTION "folio"."is_member"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "folio"."is_member"(uuid) TO "authenticated", "service_role";

REVOKE ALL ON FUNCTION "folio"."next_suggestion_number"(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "folio"."next_suggestion_number"(uuid) TO "service_role";

REVOKE ALL ON FUNCTION "folio"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "folio"."resolve_access_token"(text) TO "service_role";

GRANT USAGE ON SCHEMA "folio" TO "anon", "authenticated", "service_role";

GRANT SELECT ON TABLE "folio"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."access_tokens" TO "service_role";

GRANT SELECT ON TABLE "folio"."artifacts" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."artifacts" TO "service_role";

GRANT SELECT ON TABLE "folio"."blobs" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."blobs" TO "service_role";

GRANT SELECT ON TABLE "folio"."comments" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."comments" TO "service_role";

GRANT SELECT ON TABLE "folio"."events" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."events" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."invites" TO "service_role";

GRANT SELECT ON TABLE "folio"."members" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."members" TO "service_role";

GRANT SELECT ON TABLE "folio"."suggestions" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."suggestions" TO "service_role";

GRANT SELECT ON TABLE "folio"."versions" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."versions" TO "service_role";

-- ---------------------------------------------------------------- storage (added by hand)
-- Binary files (images, fonts, …) live at <artifact id>/<sha256>. Private: only the Worker (service
-- role) reads and writes them, after checking the caller's role; no storage policies needed.
insert into storage.buckets (id, name, public) values ('folio', 'folio', false) on conflict do nothing;
