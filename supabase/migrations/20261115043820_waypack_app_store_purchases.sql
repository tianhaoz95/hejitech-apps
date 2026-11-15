CREATE TABLE "waypack"."app_store_purchases" (
  "original_transaction_id" text                     NOT NULL,
  "user_id"                 uuid                     NOT NULL,
  "product_id"              text                     NOT NULL,
  "tier"                    text                     NOT NULL,
  "environment"             text                     NOT NULL,
  "transaction_id"          text                     NOT NULL,
  "expires_at"              timestamp with time zone,
  "revoked_at"              timestamp with time zone,
  "signed_at"               timestamp with time zone NOT NULL,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "app_store_purchases_pkey" PRIMARY KEY (original_transaction_id),
  CONSTRAINT "app_store_purchases_tier_check" CHECK ((tier = ANY (ARRAY['annual'::text, 'lifetime'::text])))
);

ALTER TABLE "waypack"."app_store_purchases"
  ENABLE ROW LEVEL SECURITY;

CREATE INDEX app_store_purchases_user ON waypack.app_store_purchases USING btree (user_id);

COMMENT ON TABLE "waypack"."app_store_purchases" IS 'Waypack Pro bought in the iPhone app (StoreKit 2), one row per original transaction; written only by the Worker after verifying Apple''s signature (DECISIONS #72)';

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "waypack"."app_store_purchases" TO "service_role";
