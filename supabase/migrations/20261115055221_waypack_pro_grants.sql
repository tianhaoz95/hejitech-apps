CREATE TABLE "waypack"."pro_grants" (
  "email"      text                     NOT NULL,
  "until"      timestamp with time zone,
  "note"       text,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pro_grants_email_check" CHECK ((email = lower(email))),
  CONSTRAINT "pro_grants_pkey" PRIMARY KEY (email)
);

ALTER TABLE "waypack"."pro_grants"
  ENABLE ROW LEVEL SECURITY;

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "waypack"."pro_grants" TO "service_role";
