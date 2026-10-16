// node --test scripts/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkRepo, checkSql } from "./check_supabase.mjs";

const projects = ["waypack", "foo", "foo_bar"];
const ok = (sql, project = "foo") => assert.deepEqual(checkSql(sql, project, projects), []);
const bad = (sql, pattern, project = "foo") => {
  const found = checkSql(sql, project, projects);
  assert.ok(found.some((p) => pattern.test(p)), `expected ${pattern} in ${JSON.stringify(found)}`);
};

test("a well-behaved project migration passes", () => {
  ok(`
    create schema if not exists foo;
    create table foo.orders (id uuid primary key, user_id uuid not null references auth.users (id) on delete cascade);
    alter table foo.orders enable row level security;
    create policy "own orders" on foo.orders for select using (auth.uid() = user_id);
    create index orders_user on foo.orders (user_id);
    create or replace function foo.touch() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    create trigger orders_touch before update on foo.orders for each row execute function foo.touch();
    create policy "foo files" on storage.objects for select using (bucket_id = 'foo');
    insert into storage.buckets (id, name, public) values ('foo', 'foo', false);
    grant usage on schema foo to authenticated;
    select extensions.uuid_generate_v4();
  `);
});

test("other projects' schemas are off limits, including public (Waypack's)", () => {
  bad("create table foo.x (p uuid references public.profiles (id));", /references schema "public"/);
  bad("create view foo.v as select * from foo_bar.things;", /another project's/);
  bad("create function foo.f() returns int language sql as $$ select count(*) from public.trips $$;", /"public"/);
  bad("select * from public.trips;", /"public"/);
  bad("create table foo.x (id int); select 1 from foo.x join public.trips on true;", /"public"/);
  bad("insert into public.trips values (1);", /"public"/);
});

test("names must be schema-qualified and in the project's schema", () => {
  bad("create table orders (id int);", /unqualified name \(write foo\.orders\)/);
  bad("create or replace function touch() returns int language sql as $$ select 1 $$;", /unqualified/);
  bad("alter table orders add column x int;", /unqualified/);
  bad("create policy p on orders using (true);", /unqualified/);
  bad("create schema bar;", /creates schema "bar"/);
  bad("create function auth.f() returns int language sql as $$ select 1 $$;", /shared schema "auth"/);
  bad("create table storage.mine (id int);", /shared schema "storage"/);
});

test("no triggers on the shared auth.users", () => {
  bad("create trigger t after insert on auth.users for each row execute function foo.f();", /auth\.users/);
  bad('create trigger t after insert on "auth"."users" for each row execute function foo.f();', /auth\.users/);
});

test("only the project's own bucket", () => {
  bad("insert into storage.buckets (id, name, public) values ('waypack', 'waypack', false);", /bucket 'waypack'/);
});

test("comments and string literals are not references", () => {
  ok(`
    -- copies the idea of public.trips
    /* see public.profiles */
    create table foo.notes (body text default 'public.trips is Waypack''s');
  `);
});

test("Waypack (legacy) owns public but not other projects' schemas", () => {
  ok("create table public.x (id int); create table y (id int); insert into storage.buckets (id, name) values ('waypack', 'waypack');", "waypack");
  bad("create view public.v as select * from foo.orders;", /another project's/, "waypack");
});

function repo(files, projectDirs = projects) {
  const root = mkdtempSync(join(tmpdir(), "check-supabase-"));
  for (const p of projectDirs) mkdirSync(join(root, "projects", p), { recursive: true });
  mkdirSync(join(root, "supabase/migrations"), { recursive: true });
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), body);
  }
  return checkRepo(root);
}

test("migration names: project prefix, unique timestamps, grandfathered Waypack files", () => {
  const { problems, warnings } = repo({
    "supabase/migrations/20261003000000_init.sql": "create table profiles (id uuid); create trigger t after insert on auth.users for each row execute function public.f();",
    "supabase/migrations/20261101000000_foo_orders.sql": "create schema foo; create table foo.orders (id int);",
    "supabase/migrations/20261101000000_foo_more.sql": "create table foo.more (id int);",
    "supabase/migrations/20261102000000_orders.sql": "create table foo.orders2 (id int);",
    "supabase/migrations/20261103000000_ab.sql": "select 1;",
    "supabase/migrations/2026_foo_x.sql": "select 1;",
  });
  assert.equal(warnings.length, 1, "the legacy auth.users trigger is a warning, not a failure");
  assert.ok(problems.some((p) => /timestamp 20261101000000 also used/.test(p)));
  assert.ok(problems.some((p) => /20261102000000_orders\.sql: must start with a project name/.test(p)));
  assert.ok(problems.some((p) => /20261103000000_ab\.sql: must start with a project name/.test(p)));
  assert.ok(problems.some((p) => /2026_foo_x\.sql: name must be/.test(p)));
  assert.equal(problems.length, 4, JSON.stringify(problems));
});

test("the longest project prefix owns a migration", () => {
  const { problems } = repo({ "supabase/migrations/20261101000000_foo_bar_things.sql": "create schema foo_bar; create table foo_bar.things (id int);" });
  assert.deepEqual(problems, []);
});

test("declarative files: supabase/schemas/<project>/, not Waypack, and the same SQL rules", () => {
  const { problems } = repo({
    "supabase/schemas/foo/tables/orders.sql": "create table foo.orders (id int);",
    "supabase/schemas/foo/views/v.sql": "create view foo.v as select * from public.trips;",
    "supabase/schemas/misc/x.sql": "select 1;",
    "supabase/schemas/waypack/x.sql": "create table public.x (id int);",
  });
  assert.equal(problems.length, 3, JSON.stringify(problems));
  assert.ok(problems.some((p) => /schemas\/foo\/views\/v\.sql: references schema "public"/.test(p)));
  assert.ok(problems.some((p) => /schemas\/misc: declarative files go in/.test(p)));
  assert.ok(problems.some((p) => /schemas\/waypack: waypack lives in "public"/.test(p)));
});

test("project folder names must work as schema names", () => {
  const { problems } = repo({}, ["waypack", "my-app"]);
  assert.ok(problems.some((p) => /projects\/my-app: name must be a valid schema name/.test(p)));
});
