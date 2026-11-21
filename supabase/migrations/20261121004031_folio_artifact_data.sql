CREATE TABLE "folio"."artifact_data" (
  "artifact_id" uuid                     NOT NULL,
  "data"        jsonb                    NOT NULL,
  "bytes"       integer                  NOT NULL,
  "agent"       text                     NOT NULL,
  "updated_by"  uuid,
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "artifact_data_pkey" PRIMARY KEY (artifact_id)
);

ALTER TABLE "folio"."artifact_data"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "folio"."artifact_data"
  ADD CONSTRAINT "artifact_data_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."artifact_data"
  ADD CONSTRAINT "artifact_data_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."artifact_data" TO "service_role";
