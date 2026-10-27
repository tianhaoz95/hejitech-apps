CREATE TABLE "headway"."eta_shares" (
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "trip_id"      text                     NOT NULL,
  "service_date" text                     NOT NULL,
  "from_station" text                     NOT NULL,
  "to_station"   text                     NOT NULL,
  "name"         text,
  "expires_at"   timestamp with time zone NOT NULL,
  "revoked_at"   timestamp with time zone,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "eta_shares_pkey" PRIMARY KEY (token_hash),
  CONSTRAINT "eta_shares_service_date_check" CHECK ((service_date ~ '^\d{8}$'::text))
);

ALTER TABLE "headway"."eta_shares"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "headway"."eta_shares"
  ADD CONSTRAINT "eta_shares_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX eta_shares_user ON headway.eta_shares USING btree (user_id);

CREATE POLICY "own eta shares" ON "headway"."eta_shares"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

GRANT SELECT ON TABLE "headway"."eta_shares" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "headway"."eta_shares" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."eta_shares" TO "service_role";
