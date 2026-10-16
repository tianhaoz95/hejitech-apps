-- Wee Hours: generated from supabase/schemas/weehours by scripts/db_migration.sh, plus the data
-- statements at the end (storage bucket and its policies), which are hand-written.

SET local check_function_bodies = off;

CREATE SCHEMA "weehours";

CREATE TABLE "weehours"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "scope"        text                     NOT NULL,
  "token_hash"   text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_scope_check" CHECK ((scope = ANY (ARRAY['read'::text, 'write'::text]))),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "weehours"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."babies" (
  "id"           uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "birth_date"   date,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "babies_pkey" PRIMARY KEY (id)
);

ALTER TABLE "weehours"."babies"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."captures" (
  "id"             uuid                     NOT NULL,
  "household_id"   uuid                     NOT NULL,
  "surface"        text                     NOT NULL,
  "captured_at"    timestamp with time zone NOT NULL,
  "logged_by"      uuid                     NOT NULL,
  "audio_path"     text,
  "transcript"     text,
  "attach_to"      uuid,
  "status"         text                     NOT NULL DEFAULT 'pending'::text,
  "interpretation" jsonb,
  "processed_by"   uuid,
  "processed_at"   timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "captures_pkey" PRIMARY KEY (id),
  CONSTRAINT "captures_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'needs_review'::text, 'done'::text, 'dismissed'::text, 'failed'::text])))
);

ALTER TABLE "weehours"."captures"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."entitlements" (
  "household_id"     uuid                     NOT NULL,
  "trial_started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "plan"             text,
  "expires_at"       timestamp with time zone,
  "source"           text                     NOT NULL DEFAULT 'storekit-sandbox'::text,
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "entitlements_pkey" PRIMARY KEY (household_id),
  CONSTRAINT "entitlements_plan_check" CHECK ((plan = ANY (ARRAY['monthly'::text, 'yearly'::text, 'lifetime'::text])))
);

ALTER TABLE "weehours"."entitlements"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."events" (
  "id"           uuid                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "baby_id"      uuid                     NOT NULL,
  "type"         text                     NOT NULL,
  "fields"       jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "occurred_at"  timestamp with time zone NOT NULL,
  "logged_at"    timestamp with time zone NOT NULL,
  "logged_by"    uuid                     NOT NULL,
  "provenance"   jsonb                    NOT NULL,
  "supersedes"   uuid,
  "session_id"   uuid,
  "seq"          bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "received_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "events_pkey" PRIMARY KEY (id),
  CONSTRAINT "events_seq_key" UNIQUE (seq),
  CONSTRAINT "provenance_complete" CHECK (((provenance ? 'surface'::text) AND (provenance ? 'input'::text)))
);

ALTER TABLE "weehours"."events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."households" (
  "id"         uuid                     NOT NULL,
  "name"       text                     NOT NULL,
  "settings"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "households_pkey" PRIMARY KEY (id)
);

ALTER TABLE "weehours"."households"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."invites" (
  "code"         text                     NOT NULL,
  "household_id" uuid                     NOT NULL,
  "created_by"   uuid                     NOT NULL,
  "expires_at"   timestamp with time zone NOT NULL DEFAULT (now() + '7 days'::interval),
  CONSTRAINT "invites_pkey" PRIMARY KEY (code)
);

ALTER TABLE "weehours"."invites"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."members" (
  "household_id" uuid                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "display_name" text                     NOT NULL,
  "role"         text                     NOT NULL DEFAULT 'parent'::text,
  "joined_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "members_pkey" PRIMARY KEY (household_id, user_id),
  CONSTRAINT "members_role_check" CHECK ((role = ANY (ARRAY['parent'::text, 'caregiver'::text])))
);

ALTER TABLE "weehours"."members"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION weehours.create_access_token (
  p_name  text,
  p_scope text
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
declare v_token text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_token := 'wh_' || encode(gen_random_bytes(24), 'hex');
  insert into access_tokens (user_id, household_id, name, scope, token_hash)
  values (auth.uid(), my_household_id(), p_name, p_scope, encode(digest(v_token, 'sha256'), 'hex'));
  return v_token;   -- shown once
end $function$;

CREATE OR REPLACE FUNCTION weehours.create_household (
  p_id           uuid,
  p_name         text,
  p_baby_id      uuid,
  p_baby_name    text,
  p_birth_date   date,
  p_settings     jsonb,
  p_display_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION weehours.create_invite()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
declare v_code text;
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into invites (code, household_id, created_by) values (v_code, my_household_id(), auth.uid());
  return v_code;
end $function$;

CREATE OR REPLACE FUNCTION weehours.delete_household()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
declare v_household uuid := my_household_id();
begin
  if v_household is null then return; end if;
  delete from households where id = v_household;
end $function$;

CREATE OR REPLACE FUNCTION weehours.join_household (
  p_code         text,
  p_display_name text
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
declare v_household uuid;
begin
  select household_id into v_household from invites where code = upper(p_code) and expires_at > now();
  if v_household is null then raise exception 'invalid or expired invite'; end if;
  delete from members where user_id = auth.uid();
  insert into members (household_id, user_id, display_name) values (v_household, auth.uid(), p_display_name);
  return v_household;
end $function$;

CREATE OR REPLACE FUNCTION weehours.my_entitlement()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  select to_jsonb(e) - 'household_id' - 'source' - 'updated_at' from entitlements e where household_id = my_household_id()
$function$;

CREATE OR REPLACE FUNCTION weehours.my_household()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION weehours.my_household_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  select household_id from weehours.members where user_id = auth.uid() limit 1
$function$;

CREATE OR REPLACE FUNCTION weehours.record_purchase (
  p_plan       text,
  p_expires_at timestamp with time zone
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
begin
  if my_household_id() is null then raise exception 'no household'; end if;
  insert into entitlements (household_id, plan, expires_at, updated_at)
  values (my_household_id(), p_plan, case when p_plan = 'lifetime' then null else p_expires_at end, now())
  on conflict (household_id) do update set plan = excluded.plan, expires_at = excluded.expires_at, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION weehours.resolve_access_token (
  p_token text
)
  RETURNS TABLE (
    user_id      uuid,
    household_id uuid,
    scope        text
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
begin
  return query
    update access_tokens t set last_used_at = now()
    where t.token_hash = encode(digest(p_token, 'sha256'), 'hex') and t.revoked_at is null
    returning t.user_id, t.household_id, t.scope;
end $function$;

CREATE OR REPLACE FUNCTION weehours.revoke_access_token (
  p_id uuid
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  update access_tokens set revoked_at = now() where id = p_id and user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION weehours.update_household (
  p_id         uuid,
  p_name       text,
  p_baby_name  text,
  p_birth_date date,
  p_settings   jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
begin
  if p_id is distinct from my_household_id() then raise exception 'not a member'; end if;
  update households set name = p_name, settings = p_settings where id = p_id;
  update babies set name = p_baby_name, birth_date = p_birth_date where household_id = p_id;
end $function$;

ALTER TABLE "weehours"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."access_tokens"
  ADD CONSTRAINT "access_tokens_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."babies"
  ADD CONSTRAINT "babies_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."captures"
  ADD CONSTRAINT "captures_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."entitlements"
  ADD CONSTRAINT "entitlements_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."events"
  ADD CONSTRAINT "events_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."invites"
  ADD CONSTRAINT "invites_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."invites"
  ADD CONSTRAINT "invites_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."members"
  ADD CONSTRAINT "members_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

ALTER TABLE "weehours"."members"
  ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX captures_open ON weehours.captures USING btree (household_id, status);

CREATE INDEX events_household_occurred ON weehours.events USING btree (household_id, occurred_at);

CREATE INDEX events_household_seq ON weehours.events USING btree (household_id, seq);

CREATE UNIQUE INDEX members_one_household ON weehours.members USING btree (user_id);

CREATE POLICY "own tokens" ON "weehours"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "members read babies" ON "weehours"."babies"
  FOR SELECT
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()));

CREATE POLICY "members add captures" ON "weehours"."captures"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((household_id = weehours.my_household_id()));

CREATE POLICY "members process captures" ON "weehours"."captures"
  FOR UPDATE
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()))
  WITH CHECK ((household_id = weehours.my_household_id()));

CREATE POLICY "members read captures" ON "weehours"."captures"
  FOR SELECT
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()));

CREATE POLICY "members read entitlement" ON "weehours"."entitlements"
  FOR SELECT
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()));

CREATE POLICY "members append events" ON "weehours"."events"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((household_id = weehours.my_household_id()));

CREATE POLICY "members read events" ON "weehours"."events"
  FOR SELECT
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()));

CREATE POLICY "members read household" ON "weehours"."households"
  FOR SELECT
  TO PUBLIC
  USING ((id = weehours.my_household_id()));

CREATE POLICY "members read members" ON "weehours"."members"
  FOR SELECT
  TO PUBLIC
  USING ((household_id = weehours.my_household_id()));

GRANT EXECUTE ON FUNCTION "weehours"."create_access_token"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."create_household"(uuid, text, uuid, text, date, jsonb, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."create_invite"() TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."delete_household"() TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."join_household"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."my_entitlement"() TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."my_household"() TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."my_household_id"() TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."record_purchase"(text, timestamp WITH time zone) TO "postgres";

REVOKE ALL ON FUNCTION "weehours"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "weehours"."resolve_access_token"(text) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "weehours"."revoke_access_token"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."update_household"(uuid, text, text, date, jsonb) TO "postgres";

GRANT USAGE ON SCHEMA "weehours" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "weehours" TO "postgres";

GRANT USAGE ON SCHEMA "weehours" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."access_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."access_tokens" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."babies" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."babies" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."babies" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."captures" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."captures" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."captures" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."entitlements" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."entitlements" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."entitlements" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."events" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."events" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."events" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."households" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."households" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."households" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."invites" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."invites" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."invites" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."members" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "weehours"."members" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."members" TO "service_role";

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table weehours.events;
alter publication supabase_realtime add table weehours.captures;

-- ---------------------------------------------------------------- hand-written: storage

-- Capture audio from the glasses, under <household id>/<capture id>.wav, until a household phone
-- processes it. Policy names carry the project: storage.objects policies are shared by every project.
insert into storage.buckets (id, name, public) values ('weehours', 'weehours', false) on conflict do nothing;

create policy "weehours: household audio read" on storage.objects for select
  using (bucket_id = 'weehours' and (storage.foldername(name))[1] = weehours.my_household_id()::text);
create policy "weehours: household audio write" on storage.objects for insert
  with check (bucket_id = 'weehours' and (storage.foldername(name))[1] = weehours.my_household_id()::text);
create policy "weehours: household audio delete" on storage.objects for delete
  using (bucket_id = 'weehours' and (storage.foldername(name))[1] = weehours.my_household_id()::text);

