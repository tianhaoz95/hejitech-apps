CREATE TABLE "hq"."request_messages" (
  "id"           bigint                   GENERATED ALWAYS AS IDENTITY NOT NULL,
  "workspace_id" uuid                     NOT NULL,
  "request_id"   text                     NOT NULL,
  "author"       text                     NOT NULL,
  "kind"         text                     NOT NULL,
  "body"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "request_messages_kind_check" CHECK ((kind = ANY (ARRAY['reply'::text, 'answer'::text, 'system'::text]))),
  CONSTRAINT "request_messages_pkey" PRIMARY KEY (id)
);

ALTER TABLE "hq"."request_messages"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "hq"."requests" (
  "id"            text                     NOT NULL,
  "workspace_id"  uuid                     NOT NULL,
  "project"       text,
  "body"          text                     NOT NULL,
  "status"        text                     NOT NULL,
  "outcome"       text,
  "requested_by"  text                     NOT NULL,
  "claimed_by"    text,
  "claimed_until" timestamp with time zone,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "requests_outcome_check" CHECK ((outcome = ANY (ARRAY['proposed'::text, 'question'::text, 'declined'::text, 'note'::text]))),
  CONSTRAINT "requests_pkey" PRIMARY KEY (id),
  CONSTRAINT "requests_status_check" CHECK ((status = ANY (ARRAY['open'::text, 'claimed'::text, 'answered'::text, 'closed'::text])))
);

ALTER TABLE "hq"."requests"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "hq"."cards"
  ADD COLUMN "figures" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "hq"."cards"
  ADD COLUMN "request_id" text;

ALTER TABLE "hq"."runs"
  ADD COLUMN "request_id" text;

ALTER TABLE "hq"."request_messages"
  ADD CONSTRAINT "request_messages_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."cards"
  ADD CONSTRAINT "cards_request_id_fkey" FOREIGN KEY (request_id) REFERENCES hq.requests(id) ON DELETE SET NULL;

ALTER TABLE "hq"."request_messages"
  ADD CONSTRAINT "request_messages_request_id_fkey" FOREIGN KEY (request_id) REFERENCES hq.requests(id) ON DELETE CASCADE;

ALTER TABLE "hq"."requests"
  ADD CONSTRAINT "requests_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES hq.workspaces(id) ON DELETE CASCADE;

ALTER TABLE "hq"."runs"
  ADD CONSTRAINT "runs_request_id_fkey" FOREIGN KEY (request_id) REFERENCES hq.requests(id) ON DELETE CASCADE;

CREATE INDEX cards_request ON hq.cards USING btree (request_id)
  WHERE (request_id IS NOT NULL);

CREATE INDEX request_messages_request ON hq.request_messages USING btree (request_id, id);

CREATE INDEX requests_workspace_status ON hq.requests USING btree (workspace_id, status, created_at DESC);

CREATE POLICY "members read request messages" ON "hq"."request_messages"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

CREATE POLICY "members read requests" ON "hq"."requests"
  FOR SELECT
  TO PUBLIC
  USING (hq.has_role(workspace_id));

GRANT SELECT ON TABLE "hq"."request_messages" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."request_messages" TO "service_role";

GRANT SELECT ON TABLE "hq"."requests" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "hq"."requests" TO "service_role";
