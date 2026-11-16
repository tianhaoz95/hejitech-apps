CREATE TABLE "headway"."billing_customers" (
  "user_id"            uuid                     NOT NULL,
  "stripe_customer_id" text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_customers_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE (stripe_customer_id)
);

ALTER TABLE "headway"."billing_customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."billing_events" (
  "id"          text                     NOT NULL,
  "type"        text                     NOT NULL,
  "user_id"     uuid,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."billing_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."purchases" (
  "id"          text                     NOT NULL,
  "user_id"     uuid                     NOT NULL,
  "source"      text                     NOT NULL,
  "product"     text                     NOT NULL,
  "tier"        text                     NOT NULL,
  "environment" text                     NOT NULL DEFAULT 'production'::text,
  "expires_at"  timestamp with time zone,
  "revoked_at"  timestamp with time zone,
  "signed_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "purchases_pkey" PRIMARY KEY (id),
  CONSTRAINT "purchases_source_check" CHECK ((source = ANY (ARRAY['app_store'::text, 'stripe'::text, 'play'::text]))),
  CONSTRAINT "purchases_tier_check" CHECK ((tier = ANY (ARRAY['annual'::text, 'lifetime'::text])))
);

ALTER TABLE "headway"."purchases"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "headway"."billing_customers"
  ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."purchases"
  ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX purchases_user ON headway.purchases USING btree (user_id);

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."billing_customers" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."billing_events" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."purchases" TO "service_role";
