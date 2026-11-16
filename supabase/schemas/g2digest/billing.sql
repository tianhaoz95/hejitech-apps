-- G2 Digest Pro purchases from every store (App Store, Stripe on the web, Google Play), one row per
-- purchase: an App Store original transaction, a Stripe subscription or one-time payment, a Play
-- purchase token. The Worker verifies each store's own record before writing here and combines
-- these rows with pro_grants into one answer (GET /api/pro), so buying on any platform unlocks every
-- platform signed in to the same account. Only the Worker reads and writes them (service key).
-- Kept when someone deletes their G2 Digest data: they are the account's purchase records.
create table g2digest.purchases (
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
create index purchases_user on g2digest.purchases (user_id);
alter table g2digest.purchases enable row level security;
grant select, insert, update, delete on table g2digest.purchases to service_role;

-- The Stripe customer behind each account. The Stripe account is shared by every HEJI product:
-- everything this Worker creates there carries metadata app=g2digest.
create table g2digest.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table g2digest.billing_customers enable row level security;
grant select, insert, update, delete on table g2digest.billing_customers to service_role;

-- Each Stripe event and App Store notification, once (both stores retry until they get a 2xx).
create table g2digest.billing_events (
  id text primary key,
  type text not null,
  user_id uuid,
  received_at timestamptz not null default now()
);
alter table g2digest.billing_events enable row level security;
grant select, insert, update, delete on table g2digest.billing_events to service_role;
