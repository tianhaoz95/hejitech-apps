SET local check_function_bodies = off;

CREATE SCHEMA "headway";

CREATE TABLE "headway"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "headway"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."device_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "label"        text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "device_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "device_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "headway"."device_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."pairing_codes" (
  "code_hash"  text                     NOT NULL,
  "user_id"    uuid                     NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at"    timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pairing_codes_pkey" PRIMARY KEY (code_hash)
);

ALTER TABLE "headway"."pairing_codes"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."profiles" (
  "user_id"    uuid                     NOT NULL,
  "settings"   jsonb                    NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "headway"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."push_devices" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "apns_token"   text                     NOT NULL,
  "environment"  text                     NOT NULL DEFAULT 'production'::text,
  "label"        text                     NOT NULL DEFAULT 'iPhone'::text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "push_devices_apns_token_key" UNIQUE (apns_token),
  CONSTRAINT "push_devices_environment_check" CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
  CONSTRAINT "push_devices_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."push_devices"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."realtime" (
  "id"         smallint                 NOT NULL DEFAULT 1,
  "fetched_at" timestamp with time zone NOT NULL,
  "snapshot"   jsonb                    NOT NULL,
  "error"      text,
  CONSTRAINT "realtime_id_check" CHECK ((id = 1)),
  CONSTRAINT "realtime_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."realtime"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."sent_notifications" (
  "user_id" uuid                     NOT NULL,
  "key"     text                     NOT NULL,
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "sent_notifications_pkey" PRIMARY KEY (user_id, key)
);

ALTER TABLE "headway"."sent_notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."tracked_trips" (
  "user_id"      uuid                     NOT NULL,
  "trip_id"      text                     NOT NULL,
  "service_date" text                     NOT NULL,
  "from_station" text                     NOT NULL,
  "to_station"   text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "tracked_trips_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "tracked_trips_service_date_check" CHECK ((service_date ~ '^\d{8}$'::text))
);

ALTER TABLE "headway"."tracked_trips"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION headway.redeem_pairing_code (
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
  SET search_path TO 'headway', 'extensions'
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

CREATE OR REPLACE FUNCTION headway.resolve_access_token (
  p_token_hash text
)
  RETURNS TABLE (
    token_id uuid,
    user_id  uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'headway', 'extensions'
  AS $function$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$function$;

CREATE OR REPLACE FUNCTION headway.resolve_device_token (
  p_token_hash text
)
  RETURNS TABLE (
    device_id uuid,
    user_id   uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'headway', 'extensions'
  AS $function$
  update device_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, device_tokens.user_id
$function$;

ALTER TABLE "headway"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."device_tokens"
  ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."pairing_codes"
  ADD CONSTRAINT "pairing_codes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."profiles"
  ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."push_devices"
  ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."sent_notifications"
  ADD CONSTRAINT "sent_notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."tracked_trips"
  ADD CONSTRAINT "tracked_trips_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX access_tokens_user ON headway.access_tokens USING btree (user_id);

CREATE INDEX device_tokens_user ON headway.device_tokens USING btree (user_id);

CREATE INDEX pairing_codes_user ON headway.pairing_codes USING btree (user_id);

CREATE INDEX push_devices_user ON headway.push_devices USING btree (user_id);

CREATE INDEX sent_notifications_sent_at ON headway.sent_notifications USING btree (sent_at);

CREATE POLICY "own access tokens" ON "headway"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own devices" ON "headway"."device_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own profile" ON "headway"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own push devices" ON "headway"."push_devices"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own tracked trip" ON "headway"."tracked_trips"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

REVOKE ALL ON FUNCTION "headway"."redeem_pairing_code"(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "headway"."redeem_pairing_code"(text, text, text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "headway"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "headway"."resolve_access_token"(text) TO "postgres", "service_role";

REVOKE ALL ON FUNCTION "headway"."resolve_device_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "headway"."resolve_device_token"(text) TO "postgres", "service_role";

GRANT USAGE ON SCHEMA "headway" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "headway" TO "postgres";

GRANT USAGE ON SCHEMA "headway" TO "service_role";

GRANT SELECT ON TABLE "headway"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."access_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."access_tokens" TO "service_role";

GRANT SELECT ON TABLE "headway"."device_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."device_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."device_tokens" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."pairing_codes" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."pairing_codes" TO "service_role";

GRANT SELECT ON TABLE "headway"."profiles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."profiles" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."profiles" TO "service_role";

GRANT SELECT ON TABLE "headway"."push_devices" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."push_devices" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."push_devices" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."realtime" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."realtime" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."sent_notifications" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."sent_notifications" TO "service_role";

GRANT SELECT ON TABLE "headway"."tracked_trips" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."tracked_trips" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."tracked_trips" TO "service_role";
