SET local check_function_bodies = off;

CREATE SCHEMA "contempo";

CREATE TABLE "contempo"."admins" (
  "user_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admins_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "contempo"."admins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."app_feedback" (
  "id"              text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "description"     text                     NOT NULL DEFAULT ''::text,
  "screenshot_path" text                     NOT NULL,
  "download_url"    text,
  "region"          jsonb,
  "app_version"     text                     NOT NULL DEFAULT ''::text,
  "build_number"    text                     NOT NULL DEFAULT ''::text,
  "os_version"      text                     NOT NULL DEFAULT ''::text,
  "device_model"    text                     NOT NULL DEFAULT ''::text,
  "screen_name"     text                     NOT NULL DEFAULT ''::text,
  "locale"          text                     NOT NULL DEFAULT ''::text,
  "status"          text                     NOT NULL DEFAULT 'pending'::text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "triaged_at"      timestamp with time zone,
  "resolved_at"     timestamp with time zone,
  CONSTRAINT "app_feedback_app_version_check" CHECK ((char_length(app_version) <= 50)),
  CONSTRAINT "app_feedback_build_number_check" CHECK ((char_length(build_number) <= 50)),
  CONSTRAINT "app_feedback_description_check" CHECK ((char_length(description) <= 5000)),
  CONSTRAINT "app_feedback_device_model_check" CHECK ((char_length(device_model) <= 100)),
  CONSTRAINT "app_feedback_locale_check" CHECK ((char_length(locale) <= 50)),
  CONSTRAINT "app_feedback_os_version_check" CHECK ((char_length(os_version) <= 100)),
  CONSTRAINT "app_feedback_pkey" PRIMARY KEY (id),
  CONSTRAINT "app_feedback_region_check"
    CHECK
    (((region IS NULL) OR ((jsonb_typeof(region) = 'object'::text) AND ((((region ->> 'x'::text))::double precision >= (0)::double precision) AND (((region ->> 'x'::text))::double
    precision <= (1)::double precision)) AND
    ((((region ->> 'y'::text))::double precision >= (0)::double precision) AND (((region ->> 'y'::text))::double precision <= (1)::double precision)) AND
    ((((region ->> 'w'::text))::double precision >= (0)::double precision) AND (((region ->> 'w'::text))::double precision <= (1)::double precision)) AND
    ((((region ->> 'h'::text))::double precision >= (0)::double precision) AND (((region ->> 'h'::text))::double precision <= (1)::double precision))))),
  CONSTRAINT "app_feedback_screen_name_check" CHECK ((char_length(screen_name) <= 200)),
  CONSTRAINT "app_feedback_screenshot_path_check" CHECK (((char_length(screenshot_path) >= 1) AND (char_length(screenshot_path) <= 500))),
  CONSTRAINT "app_feedback_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'triaged'::text, 'resolved'::text]))),
  "user_id"         uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."app_feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."attachments" (
  "id"           text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "entry_id"     text                     NOT NULL,
  "file_name"    text                     NOT NULL,
  "content_type" text                     NOT NULL,
  "file_size"    bigint                   NOT NULL,
  "storage_path" text                     NOT NULL,
  "download_url" text                     NOT NULL DEFAULT ''::text,
  "uploaded_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "note"         text                     NOT NULL DEFAULT ''::text,
  CONSTRAINT "attachments_content_type_check" CHECK (((char_length(content_type) >= 1) AND (char_length(content_type) <= 150))),
  CONSTRAINT "attachments_download_url_check" CHECK ((char_length(download_url) <= 2000)),
  CONSTRAINT "attachments_file_name_check" CHECK (((char_length(file_name) >= 1) AND (char_length(file_name) <= 300))),
  CONSTRAINT "attachments_file_size_check" CHECK (((file_size >= 1) AND (file_size <= 104857600))),
  CONSTRAINT "attachments_note_check" CHECK ((char_length(note) <= 2000)),
  CONSTRAINT "attachments_pkey" PRIMARY KEY (id),
  CONSTRAINT "attachments_storage_path_check" CHECK (((char_length(storage_path) >= 1) AND (char_length(storage_path) <= 500))),
  "user_id"      uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."attachments"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."audio_captures" (
  "id"           text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "storage_path" text                     NOT NULL,
  "captured_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "lat"          double precision,
  "lng"          double precision,
  "language"     text,
  CONSTRAINT "audio_captures_language_check" CHECK ((language = ANY (ARRAY['en'::text, 'zh'::text, 'auto'::text]))),
  CONSTRAINT "audio_captures_lat_check" CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision))),
  CONSTRAINT "audio_captures_lng_check" CHECK (((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision))),
  CONSTRAINT "audio_captures_pkey" PRIMARY KEY (id),
  CONSTRAINT "audio_captures_storage_path_check" CHECK (((char_length(storage_path) >= 1) AND (char_length(storage_path) <= 500))),
  "user_id"      uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."audio_captures"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."categories" (
  "id"         text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "categories_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
  CONSTRAINT "categories_pkey" PRIMARY KEY (id),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."corrections" (
  "id"          text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "entry_id"    text                     NOT NULL,
  "field_name"  text                     NOT NULL,
  "ai_value"    text                     NOT NULL,
  "final_value" text                     NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "corrections_ai_value_check" CHECK ((char_length(ai_value) <= 5000)),
  CONSTRAINT "corrections_entry_id_check" CHECK (((char_length(entry_id) >= 1) AND (char_length(entry_id) <= 200))),
  CONSTRAINT "corrections_field_name_check" CHECK (((char_length(field_name) >= 1) AND (char_length(field_name) <= 100))),
  CONSTRAINT "corrections_final_value_check" CHECK ((char_length(final_value) <= 5000)),
  CONSTRAINT "corrections_pkey" PRIMARY KEY (id),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."corrections"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."entries" (
  "id"                      text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "property_id"             text                     NOT NULL DEFAULT ''::text,
  "property_name"           text                     NOT NULL DEFAULT ''::text,
  "task"                    text                     NOT NULL DEFAULT ''::text,
  "duration_minutes"        integer                  NOT NULL DEFAULT 0,
  "category"                text                     NOT NULL DEFAULT 'other'::text,
  "status"                  text                     NOT NULL DEFAULT 'pending_review'::text,
  "source"                  text                     NOT NULL DEFAULT 'manual'::text,
  "activity_date"           timestamp with time zone NOT NULL DEFAULT now(),
  "logged_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "confirmed_at"            timestamp with time zone,
  "is_vague"                boolean                  NOT NULL DEFAULT false,
  "is_backfilled"           boolean                  NOT NULL DEFAULT false,
  "days_late"               integer                  NOT NULL DEFAULT 0,
  "risk_reasons"            text[]                   NOT NULL DEFAULT '{}'::text[],
  "photo_urls"              text[]                   NOT NULL DEFAULT '{}'::text[],
  "in_progress"             boolean                  NOT NULL DEFAULT false,
  "is_paused"               boolean                  NOT NULL DEFAULT false,
  "paused_at"               timestamp with time zone,
  "paused_duration_seconds" integer                  NOT NULL DEFAULT 0,
  "is_trip"                 boolean                  NOT NULL DEFAULT false,
  "mileage_capture_method"  text                     NOT NULL DEFAULT ''::text,
  "miles"                   double precision         NOT NULL DEFAULT 0,
  "odometer_start"          double precision,
  "odometer_end"            double precision,
  "trip_start_lat"          double precision,
  "trip_start_lng"          double precision,
  "trip_end_lat"            double precision,
  "trip_end_lng"            double precision,
  "capture_lat"             double precision,
  "capture_lng"             double precision,
  "stop_lat"                double precision,
  "stop_lng"                double precision,
  "audio_url"               text                     NOT NULL DEFAULT ''::text,
  "raw_transcript"          text,
  "stopped_at"              timestamp with time zone,
  "role_id"                 text,
  "role_name"               text,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "entries_audio_url_check" CHECK ((char_length(audio_url) <= 2000)),
  CONSTRAINT "entries_capture_lat_check" CHECK (((capture_lat >= ('-90'::integer)::double precision) AND (capture_lat <= (90)::double precision))),
  CONSTRAINT "entries_capture_lng_check" CHECK (((capture_lng >= ('-180'::integer)::double precision) AND (capture_lng <= (180)::double precision))),
  CONSTRAINT "entries_category_check" CHECK (((char_length(category) >= 1) AND (char_length(category) <= 100))),
  CONSTRAINT "entries_days_late_check" CHECK (((days_late >= 0) AND (days_late <= 3650))),
  CONSTRAINT "entries_duration_minutes_check" CHECK (((duration_minutes >= 0) AND (duration_minutes <= 1440))),
  CONSTRAINT "entries_mileage_capture_method_check" CHECK ((char_length(mileage_capture_method) <= 20)),
  CONSTRAINT "entries_miles_check" CHECK (((miles >= (0)::double precision) AND (miles <= (100000)::double precision))),
  CONSTRAINT "entries_paused_duration_seconds_check" CHECK (((paused_duration_seconds >= 0) AND (paused_duration_seconds <= 86400))),
  CONSTRAINT "entries_photo_urls_check" CHECK ((cardinality(photo_urls) <= 30)),
  CONSTRAINT "entries_pkey" PRIMARY KEY (id),
  CONSTRAINT "entries_property_id_check" CHECK ((char_length(property_id) <= 200)),
  CONSTRAINT "entries_property_name_check" CHECK ((char_length(property_name) <= 200)),
  CONSTRAINT "entries_raw_transcript_check" CHECK ((char_length(raw_transcript) <= 5000)),
  CONSTRAINT "entries_risk_reasons_check" CHECK ((cardinality(risk_reasons) <= 20)),
  CONSTRAINT "entries_role_id_check" CHECK ((char_length(role_id) <= 200)),
  CONSTRAINT "entries_role_name_check" CHECK ((char_length(role_name) <= 200)),
  CONSTRAINT "entries_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'voice'::text, 'text'::text, 'photo'::text]))),
  CONSTRAINT "entries_status_check" CHECK ((status = ANY (ARRAY['pending_review'::text, 'confirmed'::text]))),
  CONSTRAINT "entries_stop_lat_check" CHECK (((stop_lat >= ('-90'::integer)::double precision) AND (stop_lat <= (90)::double precision))),
  CONSTRAINT "entries_stop_lng_check" CHECK (((stop_lng >= ('-180'::integer)::double precision) AND (stop_lng <= (180)::double precision))),
  CONSTRAINT "entries_task_check" CHECK ((char_length(task) <= 5000)),
  CONSTRAINT "entries_trip_end_lat_check" CHECK (((trip_end_lat >= ('-90'::integer)::double precision) AND (trip_end_lat <= (90)::double precision))),
  CONSTRAINT "entries_trip_end_lng_check" CHECK (((trip_end_lng >= ('-180'::integer)::double precision) AND (trip_end_lng <= (180)::double precision))),
  CONSTRAINT "entries_trip_start_lat_check" CHECK (((trip_start_lat >= ('-90'::integer)::double precision) AND (trip_start_lat <= (90)::double precision))),
  CONSTRAINT "entries_trip_start_lng_check" CHECK (((trip_start_lng >= ('-180'::integer)::double precision) AND (trip_start_lng <= (180)::double precision))),
  "user_id"                 uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."entries"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."feedback" (
  "id"         text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "message"    text                     NOT NULL,
  "email"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "feedback_email_check" CHECK ((char_length(email) <= 200)),
  CONSTRAINT "feedback_message_check" CHECK (((char_length(message) >= 1) AND (char_length(message) <= 5000))),
  CONSTRAINT "feedback_pkey" PRIMARY KEY (id)
);

ALTER TABLE "contempo"."feedback"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."properties" (
  "id"         text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "properties_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 200))),
  CONSTRAINT "properties_pkey" PRIMARY KEY (id),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."properties"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."roles" (
  "id"         text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "name"       text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "roles_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
  CONSTRAINT "roles_pkey" PRIMARY KEY (id),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."roles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."stripe_customers" (
  "customer_id" text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "stripe_customers_pkey" PRIMARY KEY (customer_id),
  CONSTRAINT "stripe_customers_user_id_key" UNIQUE (user_id)
);

ALTER TABLE "contempo"."stripe_customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."subscriptions" (
  "user_id"                uuid                     NOT NULL,
  "stripe_customer_id"     text,
  "stripe_subscription_id" text,
  "status"                 text                     NOT NULL DEFAULT 'none'::text,
  "price_id"               text,
  "current_period_end"     timestamp with time zone,
  "cancel_at_period_end"   boolean                  NOT NULL DEFAULT false,
  "updated_at"             timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "contempo"."subscriptions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."text_captures" (
  "id"          text                     NOT NULL DEFAULT (gen_random_uuid())::text,
  "raw_text"    text                     NOT NULL,
  "captured_at" timestamp with time zone NOT NULL DEFAULT now(),
  "lat"         double precision,
  "lng"         double precision,
  CONSTRAINT "text_captures_lat_check" CHECK (((lat >= ('-90'::integer)::double precision) AND (lat <= (90)::double precision))),
  CONSTRAINT "text_captures_lng_check" CHECK (((lng >= ('-180'::integer)::double precision) AND (lng <= (180)::double precision))),
  CONSTRAINT "text_captures_pkey" PRIMARY KEY (id),
  CONSTRAINT "text_captures_raw_text_check" CHECK (((char_length(raw_text) >= 1) AND (char_length(raw_text) <= 5000))),
  "user_id"     uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "contempo"."text_captures"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "contempo"."token_usage" (
  "user_id"       uuid                     NOT NULL,
  "kind"          text                     NOT NULL,
  "week_id"       text                     NOT NULL,
  "input_tokens"  bigint                   NOT NULL DEFAULT 0,
  "output_tokens" bigint                   NOT NULL DEFAULT 0,
  "request_count" bigint                   NOT NULL DEFAULT 0,
  "week_start"    timestamp with time zone NOT NULL,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "token_usage_input_tokens_check" CHECK ((input_tokens >= 0)),
  CONSTRAINT "token_usage_kind_check" CHECK ((kind = ANY (ARRAY['device'::text, 'cloud'::text]))),
  CONSTRAINT "token_usage_output_tokens_check" CHECK ((output_tokens >= 0)),
  CONSTRAINT "token_usage_pkey" PRIMARY KEY (user_id, kind, week_id),
  CONSTRAINT "token_usage_request_count_check" CHECK ((request_count >= 0)),
  CONSTRAINT "token_usage_week_id_check" CHECK ((week_id ~ '^\d{4}-W\d{2}$'::text))
);

ALTER TABLE "contempo"."token_usage"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION contempo.add_token_usage (
  p_user       uuid,
  p_kind       text,
  p_week_id    text,
  p_week_start timestamp with time zone,
  p_input      bigint,
  p_output     bigint
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'contempo', 'extensions'
  AS $function$
  insert into contempo.token_usage as t (user_id, kind, week_id, week_start, input_tokens, output_tokens, request_count)
  values (p_user, p_kind, p_week_id, p_week_start, greatest(p_input, 0), greatest(p_output, 0), 1)
  on conflict (user_id, kind, week_id) do update set
    input_tokens = t.input_tokens + excluded.input_tokens,
    output_tokens = t.output_tokens + excluded.output_tokens,
    request_count = t.request_count + 1,
    updated_at = now();
$function$;

CREATE OR REPLACE FUNCTION contempo.app_feedback_guard()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'contempo', 'extensions'
  AS $function$
begin
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.created_at := now();
    new.triaged_at := null;
    new.resolved_at := null;
  elsif (to_jsonb(new) - 'status' - 'triaged_at' - 'resolved_at') <> (to_jsonb(old) - 'status' - 'triaged_at' - 'resolved_at') then
    raise exception 'only status, triaged_at and resolved_at can change';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION contempo.attachment_note_only()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'contempo', 'extensions'
  AS $function$
begin
  if (new.id, new.user_id, new.entry_id, new.file_name, new.content_type, new.file_size, new.storage_path, new.download_url, new.uploaded_at)
     is distinct from
     (old.id, old.user_id, old.entry_id, old.file_name, old.content_type, old.file_size, old.storage_path, old.download_url, old.uploaded_at) then
    raise exception 'only an attachment''s note can change';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION contempo.feedback_server_time()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'contempo', 'extensions'
  AS $function$
begin
  new.created_at := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION contempo.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'contempo', 'extensions'
  AS $function$
  select exists (select 1 from contempo.admins where user_id = auth.uid());
$function$;

CREATE OR REPLACE FUNCTION contempo.record_device_token_usage (
  p_week_id    text,
  p_week_start timestamp with time zone,
  p_input      bigint,
  p_output     bigint
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'contempo', 'extensions'
  AS $function$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform contempo.add_token_usage(auth.uid(), 'device', p_week_id, p_week_start, p_input, p_output);
end;
$function$;

ALTER TABLE "contempo"."admins"
  ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "contempo"."attachments"
  ADD CONSTRAINT "attachments_entry_id_fkey" FOREIGN KEY (entry_id) REFERENCES contempo.entries(id) ON DELETE CASCADE;

ALTER TABLE "contempo"."stripe_customers"
  ADD CONSTRAINT "stripe_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "contempo"."subscriptions"
  ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "contempo"."token_usage"
  ADD CONSTRAINT "token_usage_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX attachments_entry ON contempo.attachments USING btree (entry_id);

CREATE TRIGGER app_feedback_guard
  BEFORE INSERT OR UPDATE ON contempo.app_feedback
  FOR EACH ROW
  EXECUTE FUNCTION contempo.app_feedback_guard();

CREATE TRIGGER attachment_note_only
  BEFORE UPDATE ON contempo.attachments
  FOR EACH ROW
  EXECUTE FUNCTION contempo.attachment_note_only();

CREATE TRIGGER feedback_server_time
  BEFORE INSERT ON contempo.feedback
  FOR EACH ROW
  EXECUTE FUNCTION contempo.feedback_server_time();

CREATE POLICY "own admin row" ON "contempo"."admins"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "admins triage app feedback" ON "contempo"."app_feedback"
  FOR UPDATE
  TO PUBLIC
  USING (contempo.is_admin())
  WITH CHECK (contempo.is_admin());

CREATE POLICY "admins read feedback" ON "contempo"."feedback"
  FOR SELECT
  TO PUBLIC
  USING (contempo.is_admin());

CREATE POLICY "anyone sends feedback" ON "contempo"."feedback"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "read own subscription" ON "contempo"."subscriptions"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "read own token usage" ON "contempo"."token_usage"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."audio_captures";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."categories";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."entries";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."properties";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."roles";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."subscriptions";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."text_captures";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "contempo"."token_usage";

REVOKE ALL ON FUNCTION "contempo"."add_token_usage"(uuid, text, text, timestamp WITH time zone, bigint, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "contempo"."add_token_usage"(uuid, text, text, timestamp WITH time zone, bigint, bigint) TO "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "contempo"."app_feedback_guard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "contempo"."attachment_note_only"() TO "postgres";

GRANT EXECUTE ON FUNCTION "contempo"."feedback_server_time"() TO "postgres";

GRANT EXECUTE ON FUNCTION "contempo"."is_admin"() TO "postgres";

REVOKE ALL ON FUNCTION "contempo"."record_device_token_usage"(text, timestamp WITH time zone, bigint, bigint) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "contempo"."record_device_token_usage"(text, timestamp WITH time zone, bigint, bigint) TO "authenticated", "postgres";

GRANT USAGE ON SCHEMA "contempo" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "contempo" TO "postgres";

GRANT USAGE ON SCHEMA "contempo" TO "service_role";

GRANT SELECT ON TABLE "contempo"."admins" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."admins" TO "postgres", "service_role";

GRANT INSERT, SELECT, UPDATE ON TABLE "contempo"."app_feedback" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."app_feedback" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."attachments" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."attachments" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."audio_captures" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."audio_captures" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."categories" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."categories" TO "postgres", "service_role";

GRANT INSERT, SELECT ON TABLE "contempo"."corrections" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."corrections" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."entries" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."entries" TO "postgres", "service_role";

GRANT INSERT ON TABLE "contempo"."feedback" TO "anon";

GRANT INSERT, SELECT ON TABLE "contempo"."feedback" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."feedback" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."properties" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."properties" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."roles" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."roles" TO "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."stripe_customers" TO "postgres", "service_role";

GRANT SELECT ON TABLE "contempo"."subscriptions" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."subscriptions" TO "postgres", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "contempo"."text_captures" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."text_captures" TO "postgres", "service_role";

GRANT SELECT ON TABLE "contempo"."token_usage" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "contempo"."token_usage" TO "postgres", "service_role";

ALTER TABLE "contempo"."app_feedback"
  ADD CONSTRAINT "app_feedback_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "add own app feedback" ON "contempo"."app_feedback"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "read own or admin app feedback" ON "contempo"."app_feedback"
  FOR SELECT
  TO PUBLIC
  USING (((user_id = auth.uid()) OR contempo.is_admin()));

ALTER TABLE "contempo"."attachments"
  ADD CONSTRAINT "attachments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "own attachments" ON "contempo"."attachments"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."audio_captures"
  ADD CONSTRAINT "audio_captures_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "own audio captures" ON "contempo"."audio_captures"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."categories"
  ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX categories_user ON contempo.categories USING btree (user_id);

CREATE POLICY "own categories" ON "contempo"."categories"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."corrections"
  ADD CONSTRAINT "corrections_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "add own corrections" ON "contempo"."corrections"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((user_id = auth.uid()));

CREATE POLICY "read own corrections" ON "contempo"."corrections"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

ALTER TABLE "contempo"."entries"
  ADD CONSTRAINT "entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX entries_user_activity ON contempo.entries USING btree (user_id, activity_date DESC);

CREATE INDEX entries_user_open ON contempo.entries USING btree (user_id, is_trip)
  WHERE in_progress;

CREATE POLICY "own entries" ON "contempo"."entries"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."properties"
  ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX properties_user ON contempo.properties USING btree (user_id);

CREATE POLICY "own properties" ON "contempo"."properties"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."roles"
  ADD CONSTRAINT "roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX roles_user ON contempo.roles USING btree (user_id);

CREATE POLICY "own roles" ON "contempo"."roles"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

ALTER TABLE "contempo"."text_captures"
  ADD CONSTRAINT "text_captures_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "own text captures" ON "contempo"."text_captures"
  FOR ALL
  TO PUBLIC
  USING ((user_id = auth.uid()))
  WITH CHECK ((user_id = auth.uid()));

-- ---------------------------------------------------------------- hand-written: storage
-- One private bucket; every object lives under the owner's id: <uid>/entries/<entryId>/…,
-- <uid>/audio/…, <uid>/feedback/…. Policy names carry the project: storage.objects policies are
-- shared by every project. Admins (contempo.admins) may read feedback screenshots.
insert into storage.buckets (id, name, public) values ('contempo', 'contempo', false) on conflict do nothing;

create policy "contempo: own files read" on storage.objects for select
  using (bucket_id = 'contempo' and ((storage.foldername(name))[1] = auth.uid()::text
    or ((storage.foldername(name))[2] = 'feedback' and contempo.is_admin())));
create policy "contempo: own files write" on storage.objects for insert
  with check (bucket_id = 'contempo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "contempo: own files update" on storage.objects for update
  using (bucket_id = 'contempo' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "contempo: own files delete" on storage.objects for delete
  using (bucket_id = 'contempo' and (storage.foldername(name))[1] = auth.uid()::text);
