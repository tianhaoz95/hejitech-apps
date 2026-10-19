-- Written by hand: scripts/db_migration.sh needs the local stack (Docker), which wasn't available.
-- Mirrors supabase/schemas/weehours/schema.sql.

CREATE OR REPLACE FUNCTION weehours.set_display_name (
  p_name text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
begin
  if nullif(trim(p_name), '') is null then raise exception 'empty name'; end if;
  update members set display_name = trim(p_name) where user_id = auth.uid() and household_id = my_household_id();
end $function$;

CREATE OR REPLACE FUNCTION weehours.delete_access_token (
  p_id uuid
)
  RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  delete from access_tokens where id = p_id and user_id = auth.uid() and revoked_at is not null
$function$;

GRANT EXECUTE ON FUNCTION "weehours"."set_display_name"(text) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."delete_access_token"(uuid) TO "postgres";
