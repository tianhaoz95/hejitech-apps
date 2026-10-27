CREATE TABLE "headway"."activity_tokens" (
  "user_id"     uuid                     NOT NULL,
  "kind"        text                     NOT NULL,
  "token"       text                     NOT NULL,
  "trip_id"     text,
  "environment" text                     NOT NULL DEFAULT 'production'::text,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "activity_tokens_environment_check" CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
  CONSTRAINT "activity_tokens_kind_check" CHECK ((kind = ANY (ARRAY['start'::text, 'update'::text]))),
  CONSTRAINT "activity_tokens_pkey" PRIMARY KEY (user_id, kind, token)
);

ALTER TABLE "headway"."activity_tokens"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "headway"."activity_tokens"
  ADD CONSTRAINT "activity_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX activity_tokens_user ON headway.activity_tokens USING btree (user_id);

CREATE POLICY "own activity tokens" ON "headway"."activity_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

GRANT SELECT ON TABLE "headway"."activity_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."activity_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."activity_tokens" TO "service_role";
