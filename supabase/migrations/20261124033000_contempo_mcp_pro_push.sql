-- Contempo: unified cross-platform Pro (purchases, billing_customers, billing_events, pro_grants),
-- MCP personal access tokens (access_tokens + resolve_access_token), and push nudge tables
-- (push_devices, sent_notifications).

create table contempo.purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('app_store', 'stripe', 'play')),
  product text not null,
  tier text not null check (tier in ('annual', 'lifetime')),
  environment text not null default 'production',
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user on contempo.purchases (user_id);
alter table contempo.purchases enable row level security;
grant select, insert, update, delete on table contempo.purchases to service_role;

create table contempo.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table contempo.billing_customers enable row level security;
grant select, insert, update, delete on table contempo.billing_customers to service_role;

create table contempo.billing_events (
  id text primary key,
  type text not null,
  user_id uuid,
  received_at timestamptz not null default now()
);
alter table contempo.billing_events enable row level security;
grant select, insert, update, delete on table contempo.billing_events to service_role;

create table contempo.pro_grants (
  email text primary key check (email = lower(email)),
  until timestamptz,
  note text,
  granted_at timestamptz not null default now()
);
alter table contempo.pro_grants enable row level security;
grant select, insert, update, delete on table contempo.pro_grants to service_role;

create table contempo.access_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index access_tokens_user on contempo.access_tokens(user_id);
alter table contempo.access_tokens enable row level security;
grant select on table contempo.access_tokens to authenticated;
grant select, insert, update, delete on table contempo.access_tokens to service_role;
create policy "own access tokens" on contempo.access_tokens for select using (user_id = auth.uid());

create or replace function contempo.resolve_access_token(p_token_hash text)
returns table (token_id uuid, user_id uuid)
language sql security definer set search_path = contempo, extensions as $$
  update contempo.access_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning id, contempo.access_tokens.user_id
$$;
revoke all on function contempo.resolve_access_token(text) from public, anon, authenticated;
grant execute on function contempo.resolve_access_token(text) to service_role;

create table contempo.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apns_token text unique,
  fcm_token text unique,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  label text not null default 'iPhone',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_devices_one_token check ((apns_token is null) <> (fcm_token is null))
);
create index push_devices_user on contempo.push_devices(user_id);
alter table contempo.push_devices enable row level security;
grant select on table contempo.push_devices to authenticated;
grant select, insert, update, delete on table contempo.push_devices to service_role;
create policy "own push devices" on contempo.push_devices for select using (user_id = auth.uid());

create table contempo.sent_notifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
create index sent_notifications_sent_at on contempo.sent_notifications(sent_at);
alter table contempo.sent_notifications enable row level security;
grant select, insert, update, delete on table contempo.sent_notifications to service_role;
