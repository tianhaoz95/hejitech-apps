-- Folio Pro. Purchases from every store (the App Store, Stripe on the web), one row per purchase:
-- an App Store original transaction, a Stripe subscription or one-time payment. The Worker verifies
-- each store's own record before writing here and combines these rows with pro_grants into one
-- answer (GET /api/pro), so buying anywhere unlocks Pro on the web, the iPhone app and every agent.
-- Only the Worker reads and writes them (service key). Kept when someone deletes their Folio data:
-- they are the account's purchase records.
create table folio.purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('app_store', 'stripe')),
  product text not null,
  tier text not null check (tier in ('annual', 'lifetime')),
  environment text not null default 'production',
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchases_user on folio.purchases (user_id);
alter table folio.purchases enable row level security;
grant select, insert, update, delete on table folio.purchases to service_role;

-- The Stripe customer behind each account. The Stripe account is shared by every HEJI product:
-- everything this Worker creates there carries metadata app=folio.
create table folio.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table folio.billing_customers enable row level security;
grant select, insert, update, delete on table folio.billing_customers to service_role;

-- Each Stripe event and App Store notification, once (both stores retry until they get a 2xx).
create table folio.billing_events (
  id text primary key,
  type text not null,
  user_id uuid,
  received_at timestamptz not null default now()
);
alter table folio.billing_events enable row level security;
grant select, insert, update, delete on table folio.billing_events to service_role;

-- Pro given by email (scripts/grant_pro.sh folio: testers, early adopters, the owner). Keyed by the
-- lower-case email so a grant works before the person first signs in; `until` null = for good.
create table folio.pro_grants (
  email text primary key check (email = lower(email)),
  until timestamptz,
  note text,
  granted_at timestamptz not null default now()
);
alter table folio.pro_grants enable row level security;
grant select, insert, update, delete on table folio.pro_grants to service_role;
