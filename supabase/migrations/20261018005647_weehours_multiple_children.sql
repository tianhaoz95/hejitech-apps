SET local check_function_bodies = off;

ALTER TABLE "weehours"."babies"
  ADD COLUMN "settings" jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "weehours"."babies"
  ADD COLUMN "position" integer NOT NULL DEFAULT 0;

ALTER TABLE "weehours"."babies"
  ADD COLUMN "archived_at" timestamp WITH time zone;

ALTER TABLE "weehours"."captures"
  ADD COLUMN "baby_id" uuid;

CREATE OR REPLACE FUNCTION weehours.first_baby (
  p_household uuid
)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  select id from babies where household_id = p_household
  order by archived_at is not null, position, created_at limit 1
$function$;

CREATE OR REPLACE FUNCTION weehours.my_household()
  RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
  select (h.settings - 'babies')
    || jsonb_build_object(
      'id', h.id, 'name', h.name,
      'baby_id', b.id, 'baby_name', b.name, 'birth_date', b.birth_date,
      'babies', (
        select jsonb_agg(c.settings || jsonb_build_object('id', c.id, 'name', c.name, 'birth_date', c.birth_date,
                                                          'position', c.position, 'archived', c.archived_at is not null)
                         order by c.position, c.created_at)
        from babies c where c.household_id = h.id),
      'caregivers', coalesce((
        select jsonb_agg(
          coalesce((select c from jsonb_array_elements(h.settings->'caregivers') c where c->>'id' = m.user_id::text), '{}'::jsonb)
          || jsonb_build_object('id', m.user_id, 'name', m.display_name)
        ) from members m where m.household_id = h.id), '[]'::jsonb))
  from households h join babies b on b.id = weehours.first_baby(h.id)
  where h.id = my_household_id()
  limit 1
$function$;

CREATE OR REPLACE FUNCTION weehours.save_babies (
  p_babies jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
declare v_household uuid := my_household_id(); b jsonb;
begin
  if v_household is null then raise exception 'no household'; end if;
  for b in select * from jsonb_array_elements(p_babies) loop
    insert into babies as x (id, household_id, name, birth_date, settings, position, archived_at)
    values ((b->>'id')::uuid, v_household, coalesce(nullif(trim(b->>'name'), ''), 'Baby'), (b->>'birth_date')::date,
            b - 'id' - 'name' - 'birth_date' - 'position' - 'archived', coalesce((b->>'position')::int, 0),
            case when (b->>'archived')::boolean then now() end)
    on conflict (id) do update set
      name = excluded.name, birth_date = excluded.birth_date, settings = excluded.settings, position = excluded.position,
      archived_at = case when excluded.archived_at is null then null else coalesce(x.archived_at, excluded.archived_at) end
    where x.household_id = v_household;
  end loop;
end $function$;

CREATE OR REPLACE FUNCTION weehours.update_household (
  p_id         uuid,
  p_name       text,
  p_baby_name  text,
  p_birth_date date,
  p_settings   jsonb
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'weehours', 'extensions'
  AS $function$
begin
  if p_id is distinct from my_household_id() then raise exception 'not a member'; end if;
  update households set name = p_name, settings = p_settings - 'babies' where id = p_id;
  update babies set name = p_baby_name, birth_date = p_birth_date where id = first_baby(p_id);
end $function$;

GRANT EXECUTE ON FUNCTION "weehours"."first_baby"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "weehours"."save_babies"(jsonb) TO "postgres";
