CREATE TABLE "folio"."favorites" (
  "user_id"     uuid                     NOT NULL,
  "artifact_id" uuid                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "favorites_pkey" PRIMARY KEY (user_id, artifact_id)
);

ALTER TABLE "folio"."favorites"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "folio"."favorites"
  ADD CONSTRAINT "favorites_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."favorites"
  ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX favorites_artifact ON folio.favorites USING btree (artifact_id);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."favorites" TO "service_role";
