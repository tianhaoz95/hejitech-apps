CREATE SCHEMA "icecap";

CREATE TABLE "icecap"."admins" (
  "user_id"    uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admins_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "icecap"."admins"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."billing_customers" (
  "user_id"            uuid                     NOT NULL,
  "stripe_customer_id" text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_customers_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE (stripe_customer_id)
);

ALTER TABLE "icecap"."billing_customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."billing_events" (
  "id"          text                     NOT NULL,
  "type"        text                     NOT NULL,
  "user_id"     uuid,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "icecap"."billing_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."pro_grants" (
  "email"      text                     NOT NULL,
  "until"      timestamp with time zone,
  "note"       text,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pro_grants_email_check" CHECK ((email = lower(email))),
  CONSTRAINT "pro_grants_pkey" PRIMARY KEY (email)
);

ALTER TABLE "icecap"."pro_grants"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."properties" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "data"       jsonb                    NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "properties_data_check" CHECK ((jsonb_typeof(data) = 'object'::text)),
  CONSTRAINT "properties_pkey" PRIMARY KEY (id),
  "user_id"    uuid                     NOT NULL DEFAULT auth.uid()
);

ALTER TABLE "icecap"."properties"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."purchases" (
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
  CONSTRAINT "purchases_source_check" CHECK ((source = 'stripe'::text)),
  CONSTRAINT "purchases_tier_check" CHECK ((tier = ANY (ARRAY['annual'::text, 'lifetime'::text])))
);

ALTER TABLE "icecap"."purchases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."settings" (
  "default_assumptions" jsonb                    NOT NULL,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "settings_default_assumptions_check" CHECK ((jsonb_typeof(default_assumptions) = 'object'::text)),
  "user_id"             uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "settings_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "icecap"."settings"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "icecap"."waitlist" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "email"      text                     NOT NULL,
  "name"       text,
  "source"     text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "waitlist_email_check" CHECK (((email = lower(email)) AND ((length(email) >= 6) AND (length(email) <= 255)))),
  CONSTRAINT "waitlist_name_check" CHECK ((length(name) <= 200)),
  CONSTRAINT "waitlist_pkey" PRIMARY KEY (id),
  CONSTRAINT "waitlist_source_check" CHECK ((length(source) <= 100))
);

ALTER TABLE "icecap"."waitlist"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "icecap"."admins"
  ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "icecap"."billing_customers"
  ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "icecap"."purchases"
  ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX purchases_user ON icecap.purchases USING btree (user_id);

CREATE UNIQUE INDEX waitlist_email ON icecap.waitlist USING btree (email);

ALTER PUBLICATION "supabase_realtime" ADD TABLE "icecap"."properties";

GRANT USAGE ON SCHEMA "icecap" TO "anon", "authenticated", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."admins" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."billing_customers" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."billing_events" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."pro_grants" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."properties" TO "authenticated", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."purchases" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."settings" TO "authenticated", "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "icecap"."waitlist" TO "service_role";

ALTER TABLE "icecap"."properties"
  ADD CONSTRAINT "properties_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX properties_user_created ON icecap.properties USING btree (user_id, created_at DESC);

CREATE POLICY "own properties" ON "icecap"."properties"
  FOR ALL
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

ALTER TABLE "icecap"."settings"
  ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "own settings" ON "icecap"."settings"
  FOR ALL
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
