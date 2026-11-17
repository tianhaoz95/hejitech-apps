-- Icecap Pro purchases, one row per Stripe subscription or one-time payment (the web is the only
-- store). The Worker verifies Stripe's signed webhook before writing here and combines these rows
-- with pro_grants into one answer (GET /api/pro), which the extension and the web app gate on.
-- Only the Worker reads and writes them (service key).
create table icecap.purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('stripe')),
  product text not null,
  tier text not null check (tier in ('annual', 'lifetime')),
  environment text not null default 'production',
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user on icecap.purchases (user_id);
alter table icecap.purchases enable row level security;
grant select, insert, update, delete on table icecap.purchases to service_role;

-- The Stripe customer behind each account. The Stripe account is shared by every HEJI product:
-- everything this Worker creates there carries metadata app=icecap.
create table icecap.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table icecap.billing_customers enable row level security;
grant select, insert, update, delete on table icecap.billing_customers to service_role;

-- Each Stripe event, once (Stripe retries until it gets a 2xx).
create table icecap.billing_events (
  id text primary key,
  type text not null,
  user_id uuid,
  received_at timestamptz not null default now()
);
alter table icecap.billing_events enable row level security;
grant select, insert, update, delete on table icecap.billing_events to service_role;
