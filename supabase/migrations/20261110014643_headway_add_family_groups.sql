SET local check_function_bodies = off;

CREATE TABLE "headway"."family_groups" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "owner_id"   uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "family_groups_name_check" CHECK (((char_length(name) >= 1) AND (char_length(name) <= 40))),
  CONSTRAINT "family_groups_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."family_groups"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."family_invites" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "group_id"   uuid                     NOT NULL,
  "email"      text                     NOT NULL,
  "invited_by" uuid                     NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "family_invites_email_check" CHECK (((email = lower(email)) AND ((char_length(email) >= 3) AND (char_length(email) <= 254)))),
  CONSTRAINT "family_invites_group_id_email_key" UNIQUE (group_id, email),
  CONSTRAINT "family_invites_pkey" PRIMARY KEY (id)
);

ALTER TABLE "headway"."family_invites"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "headway"."family_members" (
  "user_id"      uuid                     NOT NULL,
  "group_id"     uuid                     NOT NULL,
  "role"         text                     NOT NULL,
  "display_name" text                     NOT NULL,
  "shares"       jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "follows"      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "status"       jsonb,
  "joined_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "family_members_display_name_check" CHECK (((char_length(display_name) >= 1) AND (char_length(display_name) <= 20))),
  CONSTRAINT "family_members_pkey" PRIMARY KEY (user_id),
  CONSTRAINT "family_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'member'::text])))
);

ALTER TABLE "headway"."family_members"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION headway.push_users_by_email (
  p_email text
)
  RETURNS TABLE (
    user_id uuid
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'headway', 'extensions'
  AS $function$
  select u.id from auth.users u
  where lower(u.email) = lower(p_email)
    and exists (select 1 from headway.push_devices d where d.user_id = u.id)
$function$;

ALTER TABLE "headway"."family_groups"
  ADD CONSTRAINT "family_groups_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."family_invites"
  ADD CONSTRAINT "family_invites_group_id_fkey" FOREIGN KEY (group_id) REFERENCES headway.family_groups(id) ON DELETE CASCADE;

ALTER TABLE "headway"."family_invites"
  ADD CONSTRAINT "family_invites_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "headway"."family_members"
  ADD CONSTRAINT "family_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES headway.family_groups(id) ON DELETE CASCADE;

ALTER TABLE "headway"."family_members"
  ADD CONSTRAINT "family_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX family_invites_email ON headway.family_invites USING btree (email);

CREATE INDEX family_members_group ON headway.family_members USING btree (group_id);

CREATE POLICY "own family membership" ON "headway"."family_members"
  FOR SELECT
  TO PUBLIC
  USING ((user_id = auth.uid()));

REVOKE ALL ON FUNCTION "headway"."push_users_by_email"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "headway"."push_users_by_email"(text) TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."family_groups" TO "service_role";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."family_invites" TO "service_role";

GRANT SELECT ON TABLE "headway"."family_members" TO "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "headway"."family_members" TO "service_role";
