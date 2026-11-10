-- iPhones that get a notification when a new edition is published (APNs device tokens).
-- The Worker (service role) registers, reads and removes them; clients have no access.
create table g2digest.push_devices (
  apns_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  environment text not null default 'production' check (environment in ('production', 'sandbox')),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index push_devices_user on g2digest.push_devices(user_id);

alter table g2digest.push_devices enable row level security;

grant select, insert, update, delete on g2digest.push_devices to service_role;
revoke all on g2digest.push_devices from authenticated, anon;
