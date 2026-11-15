SET local check_function_bodies = off;

CREATE TABLE "weehours"."app_store_notifications" (
  "id"          text                     NOT NULL,
  "type"        text                     NOT NULL,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "app_store_notifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "weehours"."app_store_notifications"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "weehours"."app_store_purchases" (
  "original_transaction_id" text                     NOT NULL,
  "household_id"            uuid                     NOT NULL,
  "user_id"                 uuid                     NOT NULL,
  "product_id"              text                     NOT NULL,
  "plan"                    text                     NOT NULL,
  "environment"             text                     NOT NULL,
  "transaction_id"          text                     NOT NULL,
  "expires_at"              timestamp with time zone,
  "revoked_at"              timestamp with time zone,
  "signed_at"               timestamp with time zone NOT NULL,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "app_store_purchases_pkey" PRIMARY KEY (original_transaction_id),
  CONSTRAINT "app_store_purchases_plan_check" CHECK ((plan = ANY (ARRAY['monthly'::text, 'yearly'::text, 'lifetime'::text])))
);

ALTER TABLE "weehours"."app_store_purchases"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "weehours"."app_store_purchases"
  ADD CONSTRAINT "app_store_purchases_household_id_fkey" FOREIGN KEY (household_id) REFERENCES weehours.households(id) ON DELETE CASCADE;

CREATE INDEX app_store_purchases_household ON weehours.app_store_purchases USING btree (household_id);

REVOKE ALL ON FUNCTION "weehours"."record_purchase"(text, timestamp WITH time zone) FROM PUBLIC;

REVOKE ALL ON FUNCTION "weehours"."record_purchase"(text, timestamp WITH time zone) FROM "service_role";

GRANT EXECUTE ON FUNCTION "weehours"."record_purchase"(text, timestamp WITH time zone) TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."app_store_notifications" TO "authenticated", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "weehours"."app_store_purchases" TO "authenticated", "service_role";
