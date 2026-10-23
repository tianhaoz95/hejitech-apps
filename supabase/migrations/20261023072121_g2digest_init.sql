SET local check_function_bodies = off;

CREATE SCHEMA "g2digest";

CREATE TABLE "g2digest"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "g2digest"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."briefs" (
  "user_id"       uuid                     NOT NULL,
  "brief_version" integer                  NOT NULL DEFAULT 1,
  "config"        jsonb                    NOT NULL,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "briefs_brief_version_check" CHECK ((brief_version > 0)),
  CONSTRAINT "briefs_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "g2digest"."briefs"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."cards" (
  "user_id"                uuid    NOT NULL,
  "id"                     text    NOT NULL,
  "edition_id"             uuid    NOT NULL,
  "position"               integer NOT NULL,
  "kind"                   text    NOT NULL,
  "section_id"             text,
  "template"               text,
  "lines"                  jsonb   NOT NULL,
  "key_number"             text,
  "method_keyword"         text,
  "alert"                  boolean NOT NULL DEFAULT false,
  "glance_script"          text,
  "glance_audio_path"      text,
  "glance_duration_sec"    numeric,
  "deep_dive_script"       text,
  "deep_dive_audio_path"   text,
  "deep_dive_duration_sec" numeric,
  "source_url"             text,
  CONSTRAINT "cards_kind_check" CHECK ((kind = ANY (ARRAY['cover'::text, 'tldr'::text, 'section'::text, 'end'::text]))),
  CONSTRAINT "cards_pkey" PRIMARY KEY (user_id, id)
);

ALTER TABLE "g2digest"."cards"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."device_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "kind"         text                     NOT NULL DEFAULT 'glasses'::text,
  "label"        text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "revoked_at"   timestamp with time zone,
  CONSTRAINT "device_tokens_kind_check" CHECK ((kind = ANY (ARRAY['glasses'::text, 'feed'::text]))),
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "device_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "g2digest"."device_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."editions" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          uuid                     NOT NULL,
  "date"             date                     NOT NULL,
  "guide_version"    text                     NOT NULL,
  "brief_version"    integer                  NOT NULL,
  "title"            text                     NOT NULL,
  "total_cards"      integer                  NOT NULL,
  "total_audio_sec"  numeric                  NOT NULL,
  "bundle"           jsonb                    NOT NULL,
  "cut"              jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "preview_hash"     text                     NOT NULL,
  "preview_snapshot" text                     NOT NULL,
  "published_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "editions_pkey" PRIMARY KEY (id),
  CONSTRAINT "editions_user_id_date_key" UNIQUE (user_id, date)
);

ALTER TABLE "g2digest"."editions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."pairing_codes" (
  "code_hash"  text                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at"    timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pairing_codes_pkey" PRIMARY KEY (code_hash)
);

ALTER TABLE "g2digest"."pairing_codes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "g2digest"."profiles" (
  "user_id"    uuid                     NOT NULL,
  "language"   text                     NOT NULL DEFAULT 'en'::text,
  "units"      jsonb                    NOT NULL DEFAULT '{"distance": "km", "temperature": "C"}'::jsonb,
  "glossary"   jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "no_gloss"   jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "delivery"   jsonb                    NOT NULL DEFAULT '{"days": ["mon", "tue", "wed", "thu", "fri"], "time": "07:00", "timezone": "America/Los_Angeles"}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "g2digest"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION g2digest.redeem_pairing_code (
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
  SET search_path TO 'g2digest', 'extensions'
  AS $function$
declare v_user uuid;
begin
  update pairing_codes set used_at = now()
  where code_hash = p_code_hash and used_at is null and expires_at > now()
  returning pairing_codes.user_id into v_user;
  if v_user is null then return; end if;
  return query
    insert into device_tokens (token_hash, user_id, kind, label)
    values (p_token_hash, v_user, 'glasses', left(coalesce(nullif(trim(p_label), ''), 'Even G2'), 60))
    returning device_tokens.id, device_tokens.user_id;
end $function$;

CREATE OR REPLACE FUNCTION g2digest.resolve_access_token (
  p_token_hash text
)
  RETURNS TABLE (
    token_id uuid,
    user_id  uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'g2digest', 'extensions'
  AS $function$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning id, access_tokens.user_id
$function$;

CREATE OR REPLACE FUNCTION g2digest.resolve_device_token (
  p_token_hash text
)
  RETURNS TABLE (
    device_id uuid,
    user_id   uuid,
    kind      text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'g2digest', 'extensions'
  AS $function$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash and revoked_at is null
  returning id, device_tokens.user_id, device_tokens.kind
$function$;

ALTER TABLE "g2digest"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."briefs"
  ADD CONSTRAINT "briefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."cards"
  ADD CONSTRAINT "cards_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."device_tokens"
  ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."cards"
  ADD CONSTRAINT "cards_edition_id_fkey" FOREIGN KEY (edition_id) REFERENCES g2digest.editions(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."editions"
  ADD CONSTRAINT "editions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."pairing_codes"
  ADD CONSTRAINT "pairing_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "g2digest"."profiles"
  ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX access_tokens_user ON g2digest.access_tokens USING btree (user_id);

CREATE INDEX cards_edition ON g2digest.cards USING btree (edition_id, "position");

CREATE INDEX device_tokens_user ON g2digest.device_tokens USING btree (user_id);

CREATE INDEX pairing_codes_user ON g2digest.pairing_codes USING btree (user_id);

CREATE POLICY "own access tokens" ON "g2digest"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own brief" ON "g2digest"."briefs"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own cards" ON "g2digest"."cards"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own devices" ON "g2digest"."device_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own editions" ON "g2digest"."editions"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own profile" ON "g2digest"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

REVOKE ALL ON FUNCTION "g2digest"."redeem_pairing_code"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "g2digest"."redeem_pairing_code"(text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "g2digest"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "g2digest"."resolve_access_token"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "g2digest"."resolve_device_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "g2digest"."resolve_device_token"(text) TO "postgres", "service_role";

GRANT USAGE ON SCHEMA "g2digest" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "g2digest" TO "postgres";

GRANT USAGE ON SCHEMA "g2digest" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."access_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."access_tokens" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."briefs" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."briefs" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."briefs" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."cards" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."cards" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."cards" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."device_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."device_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."device_tokens" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."editions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."editions" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."editions" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."pairing_codes" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."pairing_codes" TO "service_role";

GRANT SELECT ON TABLE "g2digest"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "g2digest"."profiles" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "g2digest"."profiles" TO "service_role";

-- ---------------------------------------------------------------- storage (added by hand: data statements)
-- Audio for published cards: <user_id>/<date>/<slug>-glance.mp3 and -deep-dive.mp3. Private bucket:
-- the build agent uploads through signed upload URLs from the Worker (MCP create_audio_upload), and
-- the plugin, preview and podcast feed play signed URLs the Worker hands out. Owners may read their
-- own folder directly too (defense in depth; the Worker is the gate).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('g2digest', 'g2digest', false, 26214400,
        array['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/opus'])
on conflict do nothing;

create policy "g2digest: own audio read" on storage.objects for select
  using (bucket_id = 'g2digest' and (storage.foldername(name))[1] = auth.uid()::text);
