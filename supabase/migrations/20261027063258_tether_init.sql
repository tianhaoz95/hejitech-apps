SET local check_function_bodies = off;

CREATE SCHEMA "tether";

CREATE TABLE "tether"."access_tokens" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "token_hash"   text                     NOT NULL,
  "user_id"      uuid                     NOT NULL,
  "name"         text                     NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "access_tokens_pkey" PRIMARY KEY (id),
  CONSTRAINT "access_tokens_token_hash_key" UNIQUE (token_hash)
);

ALTER TABLE "tether"."access_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tether"."bookmarks" (
  "user_id"    uuid                     NOT NULL,
  "id"         text                     NOT NULL,
  "title"      text                     NOT NULL,
  "url"        text                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "bookmarks_pkey" PRIMARY KEY (user_id, id)
);

ALTER TABLE "tether"."bookmarks"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tether"."hosts" (
  "user_id"                             uuid                     NOT NULL,
  "id"                                  text                     NOT NULL,
  "label"                               text,
  "host"                                text                     NOT NULL,
  "port"                                integer                  NOT NULL DEFAULT 22,
  "username"                            text                     NOT NULL,
  "auth"                                text                     NOT NULL,
  "key_id"                              text,
  "remember_password"                   boolean                  NOT NULL DEFAULT false,
  "auto_reconnect_on_display_reconnect" boolean                  NOT NULL DEFAULT false,
  "created_at"                          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hosts_auth_check" CHECK ((auth = ANY (ARRAY['key'::text, 'password'::text, 'keyAndPassword'::text]))),
  CONSTRAINT "hosts_pkey" PRIMARY KEY (user_id, id),
  CONSTRAINT "hosts_port_check" CHECK (((port >= 1) AND (port <= 65535)))
);

ALTER TABLE "tether"."hosts"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "tether"."workspaces" (
  "user_id"    uuid                     NOT NULL,
  "tree"       jsonb                    NOT NULL,
  "settings"   jsonb                    NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workspaces_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "tether"."workspaces"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION tether.resolve_access_token (
  p_token_hash text
)
  RETURNS TABLE (
    token_id uuid,
    user_id  uuid
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'tether', 'extensions'
  AS $function$
  update access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, access_tokens.user_id
$function$;

ALTER TABLE "tether"."access_tokens"
  ADD CONSTRAINT "access_tokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "tether"."bookmarks"
  ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "tether"."hosts"
  ADD CONSTRAINT "hosts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "tether"."workspaces"
  ADD CONSTRAINT "workspaces_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX access_tokens_user ON tether.access_tokens USING btree (user_id);

CREATE INDEX bookmarks_user ON tether.bookmarks USING btree (user_id);

CREATE INDEX hosts_user ON tether.hosts USING btree (user_id);

CREATE POLICY "own access tokens" ON "tether"."access_tokens"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own bookmarks" ON "tether"."bookmarks"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own hosts" ON "tether"."hosts"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

CREATE POLICY "own workspace" ON "tether"."workspaces"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

REVOKE ALL ON FUNCTION "tether"."resolve_access_token"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "tether"."resolve_access_token"(text) TO "postgres", "service_role";

GRANT USAGE ON SCHEMA "tether" TO "anon", "authenticated";

GRANT CREATE, USAGE ON SCHEMA "tether" TO "postgres";

GRANT USAGE ON SCHEMA "tether" TO "service_role";

GRANT SELECT ON TABLE "tether"."access_tokens" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tether"."access_tokens" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tether"."access_tokens" TO "service_role";

GRANT SELECT ON TABLE "tether"."bookmarks" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tether"."bookmarks" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tether"."bookmarks" TO "service_role";

GRANT SELECT ON TABLE "tether"."hosts" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tether"."hosts" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tether"."hosts" TO "service_role";

GRANT SELECT ON TABLE "tether"."workspaces" TO "authenticated";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "tether"."workspaces" TO "postgres";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "tether"."workspaces" TO "service_role";

-- ---------------------------------------------------------------- storage (added by hand: data statements)
insert into storage.buckets (id, name, public)
values ('tether', 'tether', false)
on conflict do nothing;

create policy "tether: own files read" on storage.objects for select
  using (bucket_id = 'tether' and (storage.foldername(name))[1] = auth.uid()::text);

