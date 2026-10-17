-- Contempo, declarative (supabase/README.md): everything lives in the `contempo` schema.
-- Generate migrations with scripts/db_migration.sh contempo <what>; the storage bucket and its
-- policies are data statements added to the migration by hand (see the init migration).
--
-- Moved from Firestore (project contempo-str) on 2026-10-16. The model stays "everything belongs
-- to one owner" (users/{uid}/… in Firestore): every table has user_id, RLS is ownership-only, and
-- the field checks the Firestore rules did by hand are check constraints here (mirrored from
-- projects/contempo/android/core/.../model/*.kt). Ids are text so clients keep minting their own
-- (offline-first creates, idempotent retries). Rows go with the auth user (on delete cascade);
-- the Worker deletes Storage objects before deleting the user (POST /api/account/delete).

create schema contempo;
-- A non-public schema gets no Data API privileges by default; RLS below decides what rows clients see.
grant usage on schema contempo to anon, authenticated, service_role;

-- Who may use the admin/ site (coupons). Replaces Firebase's `admin` custom claim; rows are
-- added by hand (SQL editor / service role), never by clients.
create table contempo.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function contempo.is_admin() returns boolean
language sql stable security definer set search_path = contempo, extensions as $$
  select exists (select 1 from contempo.admins where user_id = auth.uid());
$$;

create table contempo.properties (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);
create index properties_user on contempo.properties(user_id);

-- Who did the work on an entry when it wasn't the owner (property manager, cleaner, ...).
create table contempo.roles (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index roles_user on contempo.roles(user_id);

-- The user's own categories next to the built-in ones (maintenance, turnover, ...).
create table contempo.categories (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index categories_user on contempo.categories(user_id);

create table contempo.entries (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id text not null default '' check (char_length(property_id) <= 200),
  property_name text not null default '' check (char_length(property_name) <= 200),
  task text not null default '' check (char_length(task) <= 5000),
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 1440),
  category text not null default 'other' check (char_length(category) between 1 and 100),
  status text not null default 'pending_review' check (status in ('pending_review', 'confirmed')),
  source text not null default 'manual' check (source in ('manual', 'voice', 'text', 'photo')),
  activity_date timestamptz not null default now(),
  logged_at timestamptz not null default now(),
  confirmed_at timestamptz,
  is_vague boolean not null default false,
  is_backfilled boolean not null default false,
  days_late integer not null default 0 check (days_late between 0 and 3650),
  risk_reasons text[] not null default '{}' check (cardinality(risk_reasons) <= 20),
  photo_urls text[] not null default '{}' check (cardinality(photo_urls) <= 30),
  in_progress boolean not null default false,
  is_paused boolean not null default false,
  paused_at timestamptz,
  paused_duration_seconds integer not null default 0 check (paused_duration_seconds between 0 and 86400),
  is_trip boolean not null default false,
  mileage_capture_method text not null default '' check (char_length(mileage_capture_method) <= 20),
  miles double precision not null default 0 check (miles between 0 and 100000),
  odometer_start double precision,
  odometer_end double precision,
  trip_start_lat double precision check (trip_start_lat between -90 and 90),
  trip_start_lng double precision check (trip_start_lng between -180 and 180),
  trip_end_lat double precision check (trip_end_lat between -90 and 90),
  trip_end_lng double precision check (trip_end_lng between -180 and 180),
  capture_lat double precision check (capture_lat between -90 and 90),
  capture_lng double precision check (capture_lng between -180 and 180),
  stop_lat double precision check (stop_lat between -90 and 90),
  stop_lng double precision check (stop_lng between -180 and 180),
  audio_url text not null default '' check (char_length(audio_url) <= 2000),
  raw_transcript text check (char_length(raw_transcript) <= 5000),
  stopped_at timestamptz,
  role_id text check (char_length(role_id) <= 200),
  role_name text check (char_length(role_name) <= 200),
  updated_at timestamptz not null default now()
);
create index entries_user_activity on contempo.entries(user_id, activity_date desc);
create index entries_user_open on contempo.entries(user_id, is_trip) where in_progress;

-- Files attached to an entry. Immutable except the note (contempo.attachment_note_only).
create table contempo.attachments (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id text not null references contempo.entries(id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 300),
  content_type text not null check (char_length(content_type) between 1 and 150),
  file_size bigint not null check (file_size between 1 and 104857600),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  download_url text not null default '' check (char_length(download_url) <= 2000),
  uploaded_at timestamptz not null default now(),
  note text not null default '' check (char_length(note) <= 2000)
);
create index attachments_entry on contempo.attachments(entry_id);

create or replace function contempo.attachment_note_only() returns trigger
language plpgsql set search_path = contempo, extensions as $$
begin
  if (new.id, new.user_id, new.entry_id, new.file_name, new.content_type, new.file_size, new.storage_path, new.download_url, new.uploaded_at)
     is distinct from
     (old.id, old.user_id, old.entry_id, old.file_name, old.content_type, old.file_size, old.storage_path, old.download_url, old.uploaded_at) then
    raise exception 'only an attachment''s note can change';
  end if;
  return new;
end;
$$;
create trigger attachment_note_only before update on contempo.attachments
  for each row execute function contempo.attachment_note_only();

-- What the AI suggested vs what the user kept: training signal, append-only.
create table contempo.corrections (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_id text not null check (char_length(entry_id) between 1 and 200),
  field_name text not null check (char_length(field_name) between 1 and 100),
  ai_value text not null check (char_length(ai_value) <= 5000),
  final_value text not null check (char_length(final_value) <= 5000),
  recorded_at timestamptz not null default now()
);

-- Audio recorded on a device that can't transcribe it (the watch); the phone processes the queue.
create table contempo.audio_captures (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  captured_at timestamptz not null default now(),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  language text check (language in ('en', 'zh', 'auto'))
);

-- Quick Capture's typed text, parsed in the background.
create table contempo.text_captures (
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  raw_text text not null check (char_length(raw_text) between 1 and 5000),
  captured_at timestamptz not null default now(),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180)
);

-- LLM token usage per ISO week (week_id "GGGG-Www"). 'device' rows come from the client that ran
-- the model (contempo.record_device_token_usage); 'cloud' rows only from the Worker.
create table contempo.token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('device', 'cloud')),
  week_id text not null check (week_id ~ '^\d{4}-W\d{2}$'),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  request_count bigint not null default 0 check (request_count >= 0),
  week_start timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, week_id)
);

create or replace function contempo.add_token_usage(
  p_user uuid, p_kind text, p_week_id text, p_week_start timestamptz, p_input bigint, p_output bigint
) returns void
language sql security definer set search_path = contempo, extensions as $$
  insert into contempo.token_usage as t (user_id, kind, week_id, week_start, input_tokens, output_tokens, request_count)
  values (p_user, p_kind, p_week_id, p_week_start, greatest(p_input, 0), greatest(p_output, 0), 1)
  on conflict (user_id, kind, week_id) do update set
    input_tokens = t.input_tokens + excluded.input_tokens,
    output_tokens = t.output_tokens + excluded.output_tokens,
    request_count = t.request_count + 1,
    updated_at = now();
$$;
revoke all on function contempo.add_token_usage(uuid, text, text, timestamptz, bigint, bigint) from public, anon, authenticated;
grant execute on function contempo.add_token_usage(uuid, text, text, timestamptz, bigint, bigint) to service_role;

create or replace function contempo.record_device_token_usage(
  p_week_id text, p_week_start timestamptz, p_input bigint, p_output bigint
) returns void
language plpgsql security definer set search_path = contempo, extensions as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  perform contempo.add_token_usage(auth.uid(), 'device', p_week_id, p_week_start, p_input, p_output);
end;
$$;
revoke all on function contempo.record_device_token_usage(text, timestamptz, bigint, bigint) from public, anon;
grant execute on function contempo.record_device_token_usage(text, timestamptz, bigint, bigint) to authenticated;

-- Stripe subscription state, written only by the Worker's Stripe webhook.
create table contempo.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none',
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table contempo.stripe_customers (
  customer_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------ privileges + RLS

alter table contempo.admins enable row level security;
alter table contempo.properties enable row level security;
alter table contempo.roles enable row level security;
alter table contempo.categories enable row level security;
alter table contempo.entries enable row level security;
alter table contempo.attachments enable row level security;
alter table contempo.corrections enable row level security;
alter table contempo.audio_captures enable row level security;
alter table contempo.text_captures enable row level security;
alter table contempo.token_usage enable row level security;
alter table contempo.subscriptions enable row level security;
alter table contempo.stripe_customers enable row level security;

grant select on contempo.admins to authenticated;
grant select, insert, update, delete on contempo.properties, contempo.roles, contempo.categories,
  contempo.entries, contempo.attachments, contempo.audio_captures, contempo.text_captures to authenticated;
grant select, insert on contempo.corrections to authenticated;
grant select on contempo.token_usage, contempo.subscriptions to authenticated;
grant all on all tables in schema contempo to service_role;

create policy "own admin row" on contempo.admins for select using (user_id = auth.uid());

create policy "own properties" on contempo.properties for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own roles" on contempo.roles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own categories" on contempo.categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own entries" on contempo.entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own attachments" on contempo.attachments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own audio captures" on contempo.audio_captures for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own text captures" on contempo.text_captures for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own corrections" on contempo.corrections for select using (user_id = auth.uid());
create policy "add own corrections" on contempo.corrections for insert with check (user_id = auth.uid());

create policy "read own token usage" on contempo.token_usage for select using (user_id = auth.uid());
create policy "read own subscription" on contempo.subscriptions for select using (user_id = auth.uid());

-- Live lists on the phone and the web (Firestore snapshot listeners before).
alter publication supabase_realtime add table contempo.entries, contempo.properties, contempo.roles,
  contempo.categories, contempo.token_usage, contempo.subscriptions, contempo.audio_captures, contempo.text_captures;
