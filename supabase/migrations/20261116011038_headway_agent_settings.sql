CREATE TABLE "headway"."agent_access" (
  "user_id"       uuid                     NOT NULL,
  "edit_settings" boolean                  NOT NULL DEFAULT false,
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "agent_access_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "headway"."agent_access"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."agent_changes" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid                     NOT NULL,
  "client"     text,
  "summary"    text[]                   NOT NULL,
  "before"     jsonb                    NOT NULL,
  "after"      jsonb                    NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "undone_at"  timestamp with time zone,
  CONSTRAINT "agent_changes_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."agent_changes"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "headway"."agent_access"
  ADD CONSTRAINT "agent_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."agent_changes"
  ADD CONSTRAINT "agent_changes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX agent_changes_user_created ON headway.agent_changes USING btree (user_id, created_at DESC);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."agent_access" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."agent_changes" TO "service_role";
