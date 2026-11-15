CREATE TABLE "waypack"."template_blocks" (
  "user_id"         uuid                     NOT NULL,
  "blocked_user_id" uuid                     NOT NULL,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "template_blocks_pkey" PRIMARY KEY (user_id, blocked_user_id)
);

ALTER TABLE "waypack"."template_blocks"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "waypack"."template_reports" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "template_id" uuid                     NOT NULL,
  "reporter_id" uuid                     NOT NULL,
  "reason"      text                     NOT NULL,
  "details"     text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  "resolved_at" timestamp with time zone,
  "resolution"  text,
  CONSTRAINT "template_reports_details_check" CHECK ((char_length(details) <= 1000)),
  CONSTRAINT "template_reports_pkey" PRIMARY KEY (id),
  CONSTRAINT "template_reports_reason_check" CHECK ((reason = ANY (ARRAY['spam'::text, 'offensive'::text, 'unsafe'::text, 'misleading'::text, 'other'::text]))),
  CONSTRAINT "template_reports_resolution_check" CHECK ((resolution = ANY (ARRAY['removed'::text, 'kept'::text]))),
  CONSTRAINT "template_reports_template_id_reporter_id_key" UNIQUE (template_id, reporter_id)
);

ALTER TABLE "waypack"."template_reports"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "waypack"."trip_templates"
  ADD COLUMN "moderated_at" timestamp WITH time zone;

ALTER TABLE "waypack"."trip_templates"
  ADD COLUMN "moderation_note" text;

ALTER TABLE "waypack"."template_reports"
  ADD CONSTRAINT "template_reports_template_id_fkey" FOREIGN KEY (template_id) REFERENCES waypack.trip_templates(id) ON DELETE CASCADE;

CREATE INDEX template_reports_open ON waypack.template_reports USING btree (template_id)
  WHERE (resolved_at IS NULL);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "waypack"."template_blocks" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "waypack"."template_reports" TO "service_role";
