CREATE TABLE "folio"."push_devices" (
  "apns_token"         text                     NOT NULL,
  "user_id"            uuid                     NOT NULL,
  "environment"        text                     NOT NULL DEFAULT 'production'::text,
  "notify_suggestions" boolean                  NOT NULL DEFAULT true,
  "notify_comments"    boolean                  NOT NULL DEFAULT true,
  "notify_edits"       boolean                  NOT NULL DEFAULT true,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "last_sent_at"       timestamp with time zone,
  CONSTRAINT "push_devices_environment_check" CHECK ((environment = ANY (ARRAY['production'::text, 'sandbox'::text]))),
  CONSTRAINT "push_devices_pkey" PRIMARY KEY (apns_token)
);

ALTER TABLE "folio"."push_devices"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "folio"."push_devices"
  ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX push_devices_user ON folio.push_devices USING btree (user_id);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."push_devices" TO "service_role";
