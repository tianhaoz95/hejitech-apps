-- Headway local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- One rider commuting Mountain View → San Francisco. Sign in with rider@example.com, password
-- "headway-dev". Local-only tokens: glasses hwd_dev_local_device, assistant hwa_dev_local_token (MCP).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000c47e', 'authenticated', 'authenticated',
   'rider@example.com', crypt('headway-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000c47e', '00000000-0000-4000-8000-00000000c47e',
        '{"sub":"00000000-0000-4000-8000-00000000c47e","email":"rider@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into headway.profiles (user_id, settings) values
  ('00000000-0000-4000-8000-00000000c47e', $json$
{
  "morning": { "from": "mountain_view", "to": "san_francisco", "walk_minutes": 10, "usual": "08:00", "window": { "start": "06:00", "end": "10:30" } },
  "evening": { "from": "san_francisco", "to": "mountain_view", "walk_minutes": 8, "usual": "17:30", "window": { "start": "15:30", "end": "20:00" } },
  "switch_at": "12:00",
  "days": [0, 1, 2, 3, 4],
  "alerts": { "delay": true, "delay_threshold": 5, "cancellation": true, "service": true, "leave_now": true, "arrival": true, "arrival_minutes": 5 }
}
$json$)
on conflict (user_id) do nothing;

insert into headway.device_tokens (token_hash, user_id, label) values
  ('2046208fd035c9b0f53edff709aee99bc8914b71048d00e98a6942b012b17006', '00000000-0000-4000-8000-00000000c47e', 'Seed glasses')
on conflict (token_hash) do nothing;

insert into headway.access_tokens (token_hash, user_id, name) values
  ('41b30b1a5e350f74f9f00d127c90e24edffd2a22079e5fbdfe59182788633229', '00000000-0000-4000-8000-00000000c47e', 'Seed assistant')
on conflict (token_hash) do nothing;
