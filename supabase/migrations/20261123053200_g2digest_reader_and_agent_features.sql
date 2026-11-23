-- G2 Digest: bookmarks, reader signals, build run diagnostics, scheduled/draft editions,
-- revocable edition/card share links, podcast audio byte metadata, and Android FCM devices.

alter table g2digest.editions
  add column if not exists status text not null default 'published' check (status in ('published', 'draft', 'scheduled')),
  add column if not exists publish_at timestamptz;

create table if not exists g2digest.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_date date not null,
  card_slug text not null,
  card_title text not null,
  section_title text,
  body text not null,
  source_url text,
  created_at timestamptz not null default now(),
  primary key (user_id, edition_date, card_slug)
);
create index if not exists bookmarks_user_created on g2digest.bookmarks(user_id, created_at desc);
alter table g2digest.bookmarks enable row level security;
create policy "own bookmarks" on g2digest.bookmarks for select using (user_id = auth.uid());
grant select on table g2digest.bookmarks to authenticated;
grant select, insert, update, delete on table g2digest.bookmarks to service_role;

create table if not exists g2digest.reader_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_date date not null,
  card_slug text not null,
  section_id text,
  signal text not null check (signal in ('deep_dive_played', 'glance_played', 'bookmarked', 'skipped_fast', 'opened')),
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists reader_signals_user_created on g2digest.reader_signals(user_id, created_at desc);
alter table g2digest.reader_signals enable row level security;
grant select, insert, update, delete on table g2digest.reader_signals to service_role;

create table if not exists g2digest.build_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('validate', 'publish')),
  edition_date text,
  status text not null check (status in ('ok', 'error')),
  error_count integer not null default 0,
  warning_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  agent_name text,
  created_at timestamptz not null default now()
);
create index if not exists build_runs_user_created on g2digest.build_runs(user_id, created_at desc);
alter table g2digest.build_runs enable row level security;
create policy "own build runs" on g2digest.build_runs for select using (user_id = auth.uid());
grant select on table g2digest.build_runs to authenticated;
grant select, insert, update, delete on table g2digest.build_runs to service_role;

create table if not exists g2digest.edition_shares (
  token_hash text primary key,
  id uuid not null unique default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  edition_date date not null,
  card_slug text,
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);
create index if not exists edition_shares_user on g2digest.edition_shares(user_id, created_at desc);
alter table g2digest.edition_shares enable row level security;
create policy "own edition shares" on g2digest.edition_shares for select using (user_id = auth.uid());
grant select on table g2digest.edition_shares to authenticated;
grant select, insert, update, delete on table g2digest.edition_shares to service_role;

create table if not exists g2digest.audio_meta (
  user_id uuid not null references auth.users(id) on delete cascade,
  audio_path text not null,
  bytes integer not null check (bytes >= 0),
  content_type text,
  updated_at timestamptz not null default now(),
  primary key (user_id, audio_path)
);
alter table g2digest.audio_meta enable row level security;
grant select, insert, update, delete on table g2digest.audio_meta to service_role;

create table if not exists g2digest.fcm_devices (
  fcm_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists fcm_devices_user on g2digest.fcm_devices(user_id);
alter table g2digest.fcm_devices enable row level security;
grant select, insert, update, delete on table g2digest.fcm_devices to service_role;
