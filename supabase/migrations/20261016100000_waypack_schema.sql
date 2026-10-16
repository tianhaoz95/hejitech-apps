-- Waypack moves out of `public` into its own schema, like every other project (step 1 of 2).
-- The schema is created empty first so the Data API can expose it before anything moves (an
-- exposed schema that doesn't exist breaks PostgREST); the Worker falls back to `public` for
-- whatever isn't in `waypack` yet. Step 2 (…_waypack_move_to_schema.sql) moves the objects.
create schema if not exists waypack;
grant usage on schema waypack to anon, authenticated, service_role;
