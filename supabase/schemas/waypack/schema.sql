-- Waypack, declarative (supabase/README.md): everything lives in the `waypack` schema. Generate
-- migrations with scripts/db_migration.sh waypack <what>; data statements (the `waypack` bucket)
-- go into the migration by hand. Waypack lived in `public` until 20261016100000/…110000 moved it;
-- this file is that end state (dumped, then reviewed).

CREATE SCHEMA waypack;

CREATE FUNCTION waypack.increment_remix(share_token text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'waypack'
    AS $$
  update waypack.trip_shares set remix_count = remix_count + 1 where token = share_token and revoked_at is null;
$$;

CREATE FUNCTION waypack.increment_template_remix(template_slug text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'waypack'
    AS $$
  update waypack.trip_templates set remix_count = remix_count + 1 where slug = template_slug and status = 'published';
$$;

CREATE FUNCTION waypack.storage_list(p_bucket text, p_prefix text, p_after text DEFAULT ''::text, p_limit integer DEFAULT 1000) RETURNS TABLE(name text, size bigint, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
  from storage.objects o
  where o.bucket_id = p_bucket
    and starts_with(o.name, p_prefix)
    and o.name collate "C" > p_after collate "C"
  order by o.name collate "C"
  limit least(p_limit, 1000);
$$;

CREATE FUNCTION waypack.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at = now(); return new; end $$;

CREATE TABLE waypack.api_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    token_prefix text NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone
);

CREATE TABLE waypack.billing_events (
    id text NOT NULL,
    user_id uuid,
    type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE waypack.entitlements (
    user_id uuid NOT NULL,
    tier text DEFAULT 'free'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    source text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    CONSTRAINT entitlements_tier_check CHECK ((tier = ANY (ARRAY['free'::text, 'annual'::text, 'lifetime'::text])))
);

COMMENT ON COLUMN waypack.entitlements.source IS 'stripe | manual';

CREATE TABLE waypack.map_extracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    version integer NOT NULL,
    area_index integer DEFAULT 0 NOT NULL,
    area_hash text NOT NULL,
    bbox double precision[] NOT NULL,
    max_zoom integer NOT NULL,
    basemap_build text,
    tiles_key text,
    tiles_bytes bigint,
    tiles_sha256 text,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    CONSTRAINT map_extracts_bbox_check CHECK ((array_length(bbox, 1) = 4)),
    CONSTRAINT map_extracts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'ready'::text, 'failed'::text, 'expired'::text, 'skipped'::text])))
);

CREATE TABLE waypack.place_bookings (
    trip_id uuid NOT NULL,
    user_id uuid NOT NULL,
    place_id text NOT NULL,
    status text NOT NULL,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT place_bookings_note_check CHECK ((char_length(note) <= 500)),
    CONSTRAINT place_bookings_status_check CHECK ((status = ANY (ARRAY['unbooked'::text, 'held'::text, 'booked'::text])))
);

CREATE TABLE waypack.place_price_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid NOT NULL,
    user_id uuid NOT NULL,
    place_id text NOT NULL,
    observed_at text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    source text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT place_price_snapshots_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT place_price_snapshots_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT place_price_snapshots_note_check CHECK ((char_length(note) <= 500)),
    CONSTRAINT place_price_snapshots_source_check CHECK ((char_length(source) <= 200))
);

CREATE TABLE waypack.profiles (
    id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE waypack.trip_invites (
    trip_id uuid NOT NULL,
    code text NOT NULL,
    owner_email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);

CREATE TABLE waypack.trip_members (
    trip_id uuid NOT NULL,
    user_id uuid NOT NULL,
    email text,
    owner_email text,
    role text DEFAULT 'viewer'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trip_members_role_check CHECK ((role = 'viewer'::text))
);

CREATE TABLE waypack.trip_previews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid,
    token text NOT NULL,
    title text,
    files jsonb DEFAULT '{}'::jsonb NOT NULL,
    rev integer DEFAULT 0 NOT NULL,
    bytes bigint DEFAULT 0 NOT NULL,
    validation jsonb,
    published_version integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    base_version integer,
    note text
);

CREATE TABLE waypack.trip_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid NOT NULL,
    version integer NOT NULL,
    token text NOT NULL,
    title text,
    summary text,
    start_date date,
    end_date date,
    files jsonb DEFAULT '{}'::jsonb NOT NULL,
    bytes bigint DEFAULT 0 NOT NULL,
    redactions integer DEFAULT 0 NOT NULL,
    remix_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);

CREATE TABLE waypack.trip_versions (
    trip_id uuid NOT NULL,
    version integer NOT NULL,
    bundle_key text NOT NULL,
    bundle_sha256 text NOT NULL,
    bundle_bytes bigint NOT NULL,
    manifest jsonb NOT NULL,
    sdk_version text NOT NULL,
    map_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE waypack.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    start_date date,
    end_date date,
    current_version integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT trips_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'ready'::text, 'failed'::text])))
);

CREATE VIEW waypack.trip_summaries WITH (security_invoker='true') AS
 SELECT t.id,
    t.title,
    t.start_date,
    t.end_date,
    t.current_version,
    t.status,
    t.updated_at,
    v.bundle_bytes,
    v.bundle_sha256,
    v.created_at AS version_created_at,
    (COALESCE(( SELECT sum(e.tiles_bytes) AS sum
           FROM waypack.map_extracts e
          WHERE ((e.trip_id = t.id) AND (e.status = 'ready'::text))), (0)::numeric))::bigint AS tiles_bytes,
    (( SELECT count(*) AS count
           FROM waypack.map_extracts e
          WHERE ((e.trip_id = t.id) AND (e.status = ANY (ARRAY['pending'::text, 'processing'::text])))))::integer AS extracts_pending
   FROM (waypack.trips t
     LEFT JOIN waypack.trip_versions v ON (((v.trip_id = t.id) AND (v.version = t.current_version))))
  WHERE (t.deleted_at IS NULL);

CREATE TABLE waypack.trip_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid NOT NULL,
    version integer NOT NULL,
    slug text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    title text NOT NULL,
    card jsonb NOT NULL,
    manifest jsonb NOT NULL,
    remix_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT trip_templates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'hidden'::text])))
);

CREATE TABLE waypack.uploads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    trip_id uuid,
    size_bytes bigint NOT NULL,
    object_key text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    purpose text DEFAULT 'publish'::text NOT NULL,
    preview_id uuid,
    CONSTRAINT uploads_purpose_check CHECK ((purpose = ANY (ARRAY['publish'::text, 'preview'::text]))),
    CONSTRAINT uploads_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text, 'finalized'::text, 'failed'::text, 'expired'::text])))
);

ALTER TABLE ONLY waypack.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.api_tokens
    ADD CONSTRAINT api_tokens_token_hash_key UNIQUE (token_hash);

ALTER TABLE ONLY waypack.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY waypack.entitlements
    ADD CONSTRAINT entitlements_stripe_customer_id_key UNIQUE (stripe_customer_id);

ALTER TABLE ONLY waypack.map_extracts
    ADD CONSTRAINT map_extracts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.place_bookings
    ADD CONSTRAINT place_bookings_pkey PRIMARY KEY (trip_id, place_id);

ALTER TABLE ONLY waypack.place_price_snapshots
    ADD CONSTRAINT place_price_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.trip_invites
    ADD CONSTRAINT trip_invites_code_key UNIQUE (code);

ALTER TABLE ONLY waypack.trip_invites
    ADD CONSTRAINT trip_invites_pkey PRIMARY KEY (trip_id);

ALTER TABLE ONLY waypack.trip_members
    ADD CONSTRAINT trip_members_pkey PRIMARY KEY (trip_id, user_id);

ALTER TABLE ONLY waypack.trip_previews
    ADD CONSTRAINT trip_previews_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.trip_previews
    ADD CONSTRAINT trip_previews_token_key UNIQUE (token);

ALTER TABLE ONLY waypack.trip_shares
    ADD CONSTRAINT trip_shares_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.trip_shares
    ADD CONSTRAINT trip_shares_token_key UNIQUE (token);

ALTER TABLE ONLY waypack.trip_templates
    ADD CONSTRAINT trip_templates_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.trip_templates
    ADD CONSTRAINT trip_templates_slug_key UNIQUE (slug);

ALTER TABLE ONLY waypack.trip_versions
    ADD CONSTRAINT trip_versions_pkey PRIMARY KEY (trip_id, version);

ALTER TABLE ONLY waypack.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);

ALTER TABLE ONLY waypack.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);

CREATE INDEX entitlements_stripe_customer_idx ON waypack.entitlements USING btree (stripe_customer_id);

CREATE INDEX map_extracts_expiry_idx ON waypack.map_extracts USING btree (expires_at) WHERE (status = 'ready'::text);

CREATE INDEX map_extracts_trip_idx ON waypack.map_extracts USING btree (trip_id);

CREATE INDEX place_price_snapshots_trip ON waypack.place_price_snapshots USING btree (trip_id, place_id);

CREATE INDEX trip_members_user ON waypack.trip_members USING btree (user_id);

CREATE INDEX trip_previews_expiry ON waypack.trip_previews USING btree (expires_at);

CREATE UNIQUE INDEX trip_previews_one_per_trip ON waypack.trip_previews USING btree (trip_id) WHERE (trip_id IS NOT NULL);

CREATE INDEX trip_previews_user ON waypack.trip_previews USING btree (user_id, updated_at DESC);

CREATE UNIQUE INDEX trip_shares_one_live ON waypack.trip_shares USING btree (trip_id) WHERE (revoked_at IS NULL);

CREATE INDEX trip_shares_user ON waypack.trip_shares USING btree (user_id);

CREATE UNIQUE INDEX trip_templates_one_per_trip ON waypack.trip_templates USING btree (trip_id);

CREATE INDEX trip_templates_published ON waypack.trip_templates USING btree (status) WHERE (status = 'published'::text);

CREATE INDEX trip_templates_user ON waypack.trip_templates USING btree (user_id);

CREATE INDEX trips_user_idx ON waypack.trips USING btree (user_id) WHERE (deleted_at IS NULL);

CREATE TRIGGER map_extracts_touch BEFORE UPDATE ON waypack.map_extracts FOR EACH ROW EXECUTE FUNCTION waypack.touch_updated_at();

CREATE TRIGGER trips_touch BEFORE UPDATE ON waypack.trips FOR EACH ROW EXECUTE FUNCTION waypack.touch_updated_at();

ALTER TABLE ONLY waypack.api_tokens
    ADD CONSTRAINT api_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.entitlements
    ADD CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.map_extracts
    ADD CONSTRAINT map_extracts_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.place_bookings
    ADD CONSTRAINT place_bookings_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.place_bookings
    ADD CONSTRAINT place_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.place_price_snapshots
    ADD CONSTRAINT place_price_snapshots_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.place_price_snapshots
    ADD CONSTRAINT place_price_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_invites
    ADD CONSTRAINT trip_invites_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_members
    ADD CONSTRAINT trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_members
    ADD CONSTRAINT trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_previews
    ADD CONSTRAINT trip_previews_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE SET NULL;

ALTER TABLE ONLY waypack.trip_previews
    ADD CONSTRAINT trip_previews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_shares
    ADD CONSTRAINT trip_shares_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_shares
    ADD CONSTRAINT trip_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_templates
    ADD CONSTRAINT trip_templates_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_templates
    ADD CONSTRAINT trip_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trip_versions
    ADD CONSTRAINT trip_versions_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.trips
    ADD CONSTRAINT trips_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.uploads
    ADD CONSTRAINT uploads_preview_id_fkey FOREIGN KEY (preview_id) REFERENCES waypack.trip_previews(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.uploads
    ADD CONSTRAINT uploads_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES waypack.trips(id) ON DELETE CASCADE;

ALTER TABLE ONLY waypack.uploads
    ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE waypack.api_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.billing_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.entitlements ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.map_extracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own api tokens" ON waypack.api_tokens FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "own entitlements" ON waypack.entitlements FOR SELECT USING ((auth.uid() = user_id));

CREATE POLICY "own map extracts" ON waypack.map_extracts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM waypack.trips t
  WHERE ((t.id = map_extracts.trip_id) AND (t.user_id = auth.uid()) AND (t.deleted_at IS NULL)))));

CREATE POLICY "own profile" ON waypack.profiles FOR SELECT USING ((auth.uid() = id));

CREATE POLICY "own trip versions" ON waypack.trip_versions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM waypack.trips t
  WHERE ((t.id = trip_versions.trip_id) AND (t.user_id = auth.uid()) AND (t.deleted_at IS NULL)))));

CREATE POLICY "own trips" ON waypack.trips FOR SELECT USING (((auth.uid() = user_id) AND (deleted_at IS NULL)));

ALTER TABLE waypack.place_bookings ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.place_price_snapshots ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_previews ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_shares ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trip_versions ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.trips ENABLE ROW LEVEL SECURITY;

ALTER TABLE waypack.uploads ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA waypack TO anon;
GRANT USAGE ON SCHEMA waypack TO authenticated;
GRANT USAGE ON SCHEMA waypack TO service_role;

REVOKE ALL ON FUNCTION waypack.increment_remix(share_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION waypack.increment_remix(share_token text) TO service_role;

REVOKE ALL ON FUNCTION waypack.increment_template_remix(template_slug text) FROM PUBLIC;
GRANT ALL ON FUNCTION waypack.increment_template_remix(template_slug text) TO service_role;

REVOKE ALL ON FUNCTION waypack.storage_list(p_bucket text, p_prefix text, p_after text, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION waypack.storage_list(p_bucket text, p_prefix text, p_after text, p_limit integer) TO service_role;

GRANT ALL ON FUNCTION waypack.touch_updated_at() TO anon;
GRANT ALL ON FUNCTION waypack.touch_updated_at() TO authenticated;
GRANT ALL ON FUNCTION waypack.touch_updated_at() TO service_role;

GRANT ALL ON TABLE waypack.api_tokens TO anon;
GRANT ALL ON TABLE waypack.api_tokens TO authenticated;
GRANT ALL ON TABLE waypack.api_tokens TO service_role;

GRANT ALL ON TABLE waypack.billing_events TO anon;
GRANT ALL ON TABLE waypack.billing_events TO authenticated;
GRANT ALL ON TABLE waypack.billing_events TO service_role;

GRANT ALL ON TABLE waypack.entitlements TO anon;
GRANT ALL ON TABLE waypack.entitlements TO authenticated;
GRANT ALL ON TABLE waypack.entitlements TO service_role;

GRANT ALL ON TABLE waypack.map_extracts TO anon;
GRANT ALL ON TABLE waypack.map_extracts TO authenticated;
GRANT ALL ON TABLE waypack.map_extracts TO service_role;

GRANT ALL ON TABLE waypack.place_bookings TO anon;
GRANT ALL ON TABLE waypack.place_bookings TO authenticated;
GRANT ALL ON TABLE waypack.place_bookings TO service_role;

GRANT ALL ON TABLE waypack.place_price_snapshots TO anon;
GRANT ALL ON TABLE waypack.place_price_snapshots TO authenticated;
GRANT ALL ON TABLE waypack.place_price_snapshots TO service_role;

GRANT ALL ON TABLE waypack.profiles TO anon;
GRANT ALL ON TABLE waypack.profiles TO authenticated;
GRANT ALL ON TABLE waypack.profiles TO service_role;

GRANT ALL ON TABLE waypack.trip_invites TO anon;
GRANT ALL ON TABLE waypack.trip_invites TO authenticated;
GRANT ALL ON TABLE waypack.trip_invites TO service_role;

GRANT ALL ON TABLE waypack.trip_members TO anon;
GRANT ALL ON TABLE waypack.trip_members TO authenticated;
GRANT ALL ON TABLE waypack.trip_members TO service_role;

GRANT ALL ON TABLE waypack.trip_previews TO anon;
GRANT ALL ON TABLE waypack.trip_previews TO authenticated;
GRANT ALL ON TABLE waypack.trip_previews TO service_role;

GRANT ALL ON TABLE waypack.trip_shares TO anon;
GRANT ALL ON TABLE waypack.trip_shares TO authenticated;
GRANT ALL ON TABLE waypack.trip_shares TO service_role;

GRANT ALL ON TABLE waypack.trip_versions TO anon;
GRANT ALL ON TABLE waypack.trip_versions TO authenticated;
GRANT ALL ON TABLE waypack.trip_versions TO service_role;

GRANT ALL ON TABLE waypack.trips TO anon;
GRANT ALL ON TABLE waypack.trips TO authenticated;
GRANT ALL ON TABLE waypack.trips TO service_role;

GRANT ALL ON TABLE waypack.trip_summaries TO anon;
GRANT ALL ON TABLE waypack.trip_summaries TO authenticated;
GRANT ALL ON TABLE waypack.trip_summaries TO service_role;

GRANT ALL ON TABLE waypack.trip_templates TO anon;
GRANT ALL ON TABLE waypack.trip_templates TO authenticated;
GRANT ALL ON TABLE waypack.trip_templates TO service_role;

GRANT ALL ON TABLE waypack.uploads TO anon;
GRANT ALL ON TABLE waypack.uploads TO authenticated;
GRANT ALL ON TABLE waypack.uploads TO service_role;
