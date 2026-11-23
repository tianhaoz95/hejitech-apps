SET local check_function_bodies = off;

CREATE TABLE "folio"."billing_customers" (
  "user_id"            uuid                     NOT NULL,
  "stripe_customer_id" text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_customers_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "billing_customers_stripe_customer_id_key" UNIQUE (stripe_customer_id)
);

ALTER TABLE "folio"."billing_customers"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."billing_events" (
  "id"          text                     NOT NULL,
  "type"        text                     NOT NULL,
  "user_id"     uuid,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "billing_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "folio"."billing_events"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."pro_grants" (
  "email"      text                     NOT NULL,
  "until"      timestamp with time zone,
  "note"       text,
  "granted_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "pro_grants_email_check" CHECK ((email = lower(email))),
  CONSTRAINT "pro_grants_pkey" PRIMARY KEY (email)
);

ALTER TABLE "folio"."pro_grants"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."purchases" (
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
  CONSTRAINT "purchases_source_check" CHECK ((source = ANY (ARRAY['app_store'::text, 'stripe'::text]))),
  CONSTRAINT "purchases_tier_check" CHECK ((tier = ANY (ARRAY['annual'::text, 'lifetime'::text])))
);

ALTER TABLE "folio"."purchases"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "folio"."webhooks" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        uuid                     NOT NULL,
  "url"            text                     NOT NULL,
  "secret"         text                     NOT NULL,
  "artifact_id"    uuid,
  "kinds"          text[]                   NOT NULL DEFAULT '{commented,suggested,suggestion_revised}'::text[],
  "include_agents" boolean                  NOT NULL DEFAULT false,
  "last_status"    integer,
  "last_error"     text,
  "last_sent_at"   timestamp with time zone,
  "failures"       integer                  NOT NULL DEFAULT 0,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "webhooks_pkey" PRIMARY KEY (id)
);

ALTER TABLE "folio"."webhooks"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION folio.search_files (
  p_artifacts uuid[],
  p_terms     text[],
  p_limit     integer DEFAULT 60
)
  RETURNS TABLE (
    artifact_id uuid,
    path        text,
    pos         integer,
    excerpt     text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'folio'
  AS $function$
  select a.id, f.key, strpos(lower(b.text), p_terms[1]),
         substr(b.text, greatest(1, strpos(lower(b.text), p_terms[1]) - 200), 500)
  from artifacts a
  join versions v on v.artifact_id = a.id and v.number = a.head_version
  cross join lateral jsonb_each(v.manifest) f
  join blobs b on b.artifact_id = a.id and b.hash = f.value->>'hash'
  where a.id = any(p_artifacts)
    and b.text is not null
    and not exists (select 1 from unnest(p_terms) t where strpos(lower(b.text), t) = 0)
  order by a.updated_at desc, f.key
  limit p_limit
$function$;

ALTER TABLE "folio"."billing_customers"
  ADD CONSTRAINT "billing_customers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."purchases"
  ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "folio"."webhooks"
  ADD CONSTRAINT "webhooks_artifact_id_fkey" FOREIGN KEY (artifact_id) REFERENCES folio.artifacts(id) ON DELETE CASCADE;

ALTER TABLE "folio"."webhooks"
  ADD CONSTRAINT "webhooks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX purchases_user ON folio.purchases USING btree (user_id);

CREATE INDEX webhooks_user ON folio.webhooks USING btree (user_id);

REVOKE ALL ON FUNCTION "folio"."search_files"(uuid[], text[], integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "folio"."search_files"(uuid[], text[], integer) TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."billing_customers" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."billing_events" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."pro_grants" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."purchases" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "folio"."webhooks" TO "service_role";
