-- Price tracking (DECISIONS #67): prices the agent or user observed for a trip's places, and
-- whether each place is booked. Kept outside the bundle so a price check never mints a trip
-- version; the Worker merges them into manifest.json (with a computed booking signal) whenever the
-- trip is previewed or published. Rows for places a published version no longer has are deleted.
-- No confirmation numbers, names or payment details: the tools reject notes that look like them.
create table public.place_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  observed_at text not null, -- ISO-8601 as given, offset kept (the bundle shows local times)
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  source text check (char_length(source) <= 200),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index place_price_snapshots_trip on public.place_price_snapshots (trip_id, place_id);

create table public.place_bookings (
  trip_id uuid not null references public.trips on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  place_id text not null,
  status text not null check (status in ('unbooked', 'held', 'booked')),
  note text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (trip_id, place_id)
);

alter table public.place_price_snapshots enable row level security;
alter table public.place_bookings enable row level security;
-- Service role only (the Worker).
