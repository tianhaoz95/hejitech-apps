SET local check_function_bodies = off;

CREATE SCHEMA "fitloop";

CREATE TABLE "fitloop"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "fitloop"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."checkins" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "date"         date                     NOT NULL,
  "ref"          text                     NOT NULL,
  "kind"         text                     NOT NULL,
  "status"       text                     NOT NULL,
  "plan_version" integer                  NOT NULL,
  "data"         jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "note"         text,
  "source"       text                     NOT NULL DEFAULT 'phone'::text,
  "at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "checkins_kind_check" CHECK ((kind = ANY (ARRAY['set'::text, 'exercise'::text, 'workout'::text, 'meal'::text]))),
  CONSTRAINT "checkins_pkey" PRIMARY KEY (id),
  CONSTRAINT "checkins_status_check" CHECK ((status = ANY (ARRAY['done'::text, 'partial'::text, 'skipped'::text, 'swapped'::text])))
);

ALTER TABLE "fitloop"."checkins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."device_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "label"        text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "device_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "fitloop"."device_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."feedback" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "date"         date,
  "ref"          text,
  "plan_version" integer,
  "text"         text                     NOT NULL DEFAULT ''::text,
  "tags"         text[]                   NOT NULL DEFAULT '{}'::text[],
  "status"       text                     NOT NULL DEFAULT 'open'::text,
  "agent_reply"  text,
  "source"       text                     NOT NULL DEFAULT 'phone'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "addressed_at" timestamp with time zone,
  CONSTRAINT "feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "feedback_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'addressed'::text])))
);

ALTER TABLE "fitloop"."feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."live" (
  "user_id"     uuid                     NOT NULL,
  "hr"          integer,
  "workout_ref" text,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "live_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "fitloop"."live"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."pairing_codes" (
  "code_hash"  text                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at"    timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pairing_codes_pkey" PRIMARY KEY (code_hash)
);

ALTER TABLE "fitloop"."pairing_codes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."photos" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "taken_on"   date                     NOT NULL,
  "path"       text                     NOT NULL,
  "note"       text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "photos_pkey" PRIMARY KEY (id)
);

ALTER TABLE "fitloop"."photos"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."plans" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "version"      integer                  NOT NULL,
  "plan"         jsonb                    NOT NULL,
  "change_note"  text                     NOT NULL DEFAULT ''::text,
  "starts_on"    date                     NOT NULL,
  "published_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_by" text                     NOT NULL DEFAULT 'agent'::text,
  CONSTRAINT "plans_pkey" PRIMARY KEY (id),
  CONSTRAINT "plans_user_id_version_key" UNIQUE (user_id, VERSION),
  CONSTRAINT "plans_version_check" CHECK ((version > 0))
);

ALTER TABLE "fitloop"."plans"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."profiles" (
  "user_id"    uuid                     NOT NULL,
  "settings"   jsonb                    NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "fitloop"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "fitloop"."vitals" (
  "user_id"    uuid                     NOT NULL,
  "date"       date                     NOT NULL,
  "metric"     text                     NOT NULL,
  "value"      numeric                  NOT NULL,
  "source"     text                     NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "vitals_pkey" PRIMARY KEY (user_id, date, metric, source),
  CONSTRAINT "vitals_source_check" CHECK ((source = ANY (ARRAY['health'::text, 'manual'::text, 'watch'::text])))
);

ALTER TABLE "fitloop"."vitals"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION fitloop.publish_plan (
  p_user        uuid,
  p_plan        jsonb,
  p_change_note text,
  p_starts_on   date,
  p_by          text
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'fitloop', 'extensions'
  AS $function$
declare v_version integer;
begin
  perform pg_advisory_xact_lock(hashtext('fitloop.plans:' || p_user::text));
  select coalesce(max(version), 0) + 1 into v_version from plans where user_id = p_user;
  insert into plans (user_id, version, plan, change_note, starts_on, published_by)
  values (p_user, v_version, p_plan, coalesce(p_change_note, ''), p_starts_on, coalesce(p_by, 'agent'));
  return v_version;
end $function$;

CREATE OR REPLACE FUNCTION fitloop.redeem_pairing_code (
  p_code_hash  text,
  p_token_hash text,
  p_label      text
)
  RETURNS TABLE (
    device_id uuid,
    user_id   uuid
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'fitloop', 'extensions'
  AS $function$
declare v_user uuid;
begin
  update pairing_codes set used_at = now()
  where code_hash = p_code_hash and used_at is null and expires_at > now()
  returning pairing_codes.user_id into v_user;
  if v_user is null then return; end if;
  return query
    insert into device_tokens (token_hash, user_id, label)
    values (p_token_hash, v_user, left(coalesce(nullif(trim(p_label), ''), 'Even G2'), 60))
    returning device_tokens.id, device_tokens.user_id;
end $function$;

CREATE OR REPLACE FUNCTION fitloop.resolve_access_token (
  p_token_hash text
)
  RETURNS TABLE (
    token_id uuid,
    user_id  uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'fitloop', 'extensions'
  AS $function$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$function$;

CREATE OR REPLACE FUNCTION fitloop.resolve_device_token (
  p_token_hash text
)
  RETURNS TABLE (
    device_id uuid,
    user_id   uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'fitloop', 'extensions'
  AS $function$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, device_tokens.user_id
$function$;

ALTER TABLE "fitloop"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."checkins"
  ADD CONSTRAINT "checkins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."device_tokens"
  ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."feedback"
  ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."live"
  ADD CONSTRAINT "live_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."pairing_codes"
  ADD CONSTRAINT "pairing_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."photos"
  ADD CONSTRAINT "photos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."plans"
  ADD CONSTRAINT "plans_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."profiles"
  ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "fitloop"."vitals"
  ADD CONSTRAINT "vitals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX access_tokens_user ON fitloop.access_tokens USING btree (user_id);

CREATE INDEX checkins_user_date ON fitloop.checkins USING btree (user_id, date);

CREATE INDEX device_tokens_user ON fitloop.device_tokens USING btree (user_id);

CREATE INDEX feedback_user ON fitloop.feedback USING btree (user_id, created_at DESC);

CREATE INDEX pairing_codes_user ON fitloop.pairing_codes USING btree (user_id);

CREATE INDEX photos_user ON fitloop.photos USING btree (user_id, taken_on DESC);

CREATE POLICY "own access tokens" ON "fitloop"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own checkins" ON "fitloop"."checkins"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own devices" ON "fitloop"."device_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own feedback" ON "fitloop"."feedback"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own live" ON "fitloop"."live"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own photos" ON "fitloop"."photos"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own plans" ON "fitloop"."plans"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own profile" ON "fitloop"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own vitals" ON "fitloop"."vitals"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

REVOKE ALL ON FUNCTION "fitloop"."publish_plan"(uuid, jsonb, text, date, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "fitloop"."publish_plan"(uuid, jsonb, text, date, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "fitloop"."redeem_pairing_code"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "fitloop"."redeem_pairing_code"(text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "fitloop"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "fitloop"."resolve_access_token"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "fitloop"."resolve_device_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "fitloop"."resolve_device_token"(text) TO "postgres", "service_role";

GRANT USAGE ON SCHEMA "fitloop" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "fitloop" TO "postgres";

GRANT USAGE ON SCHEMA "fitloop" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."access_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."access_tokens" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."checkins" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."checkins" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."checkins" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."device_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."device_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."device_tokens" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."feedback" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."feedback" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."feedback" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."live" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."live" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."live" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."pairing_codes" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."pairing_codes" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."photos" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."photos" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."photos" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."plans" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."plans" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."plans" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."profiles" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."profiles" TO "service_role";

GRANT SELECT ON TABLE "fitloop"."vitals" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "fitloop"."vitals" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "fitloop"."vitals" TO "service_role";

-- ---------------------------------------------------------------- storage (added by hand: data statements)
-- Progress photos: <user_id>/photos/<id>.jpg. Private bucket: the Worker uploads with the service
-- key and hands out short-lived signed URLs (to the owner, and to their agent only when the owner
-- turned on agent_access.photos). Owners may read their own files directly too.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fitloop', 'fitloop', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict do nothing;

create policy "fitloop: own photos read" on storage.objects for select
  using (bucket_id = 'fitloop' and (storage.foldername(name))[1] = auth.uid()::text);
