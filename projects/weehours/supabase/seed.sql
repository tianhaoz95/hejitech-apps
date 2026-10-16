-- Local development seed: two parents in one household with half a day of log.
-- Sign in with parent1@example.com / parent2@example.com, password "newborn-dev".
-- MCP dev token: wh_dev_local_token (read + write), local only.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated',
   'parent1@example.com', crypt('newborn-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000000b', 'authenticated', 'authenticated',
   'parent2@example.com', crypt('newborn-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a',
   '{"sub":"00000000-0000-4000-8000-00000000000a","email":"parent1@example.com"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b',
   '{"sub":"00000000-0000-4000-8000-00000000000b","email":"parent2@example.com"}', 'email', now(), now(), now());

insert into public.households (id, name, settings) values
  ('00000000-0000-4000-8000-0000000000aa', 'Dev household',
   '{"bottle_ml": 120, "default_feed": "bottle", "categories": ["bottle","breast","diaper","sleep","growth","pumping"],
     "reminders": {"feed_every_minutes": 180, "diaper_every_minutes": 240, "overdue_margin_minutes": 20, "snooze_minutes": 10, "adaptive": false},
     "night_start": 1260, "night_end": 420, "caregivers": []}');
insert into public.babies (id, household_id, name, birth_date) values
  ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000aa', 'Mia', current_date - 21);
insert into public.members (household_id, user_id, display_name) values
  ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000a', 'Alex'),
  ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000000b', 'Sam');
insert into public.entitlements (household_id, trial_started_at) values
  ('00000000-0000-4000-8000-0000000000aa', now() - interval '3 days');

insert into public.access_tokens (user_id, household_id, name, scope, token_hash) values
  ('00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000aa', 'Local dev agent', 'write',
   encode(digest('wh_dev_local_token', 'sha256'), 'hex'));

-- half a day of entries, relative to now
with p as (
  select '00000000-0000-4000-8000-0000000000aa'::uuid h, '00000000-0000-4000-8000-0000000000bb'::uuid b,
         '00000000-0000-4000-8000-00000000000a'::uuid a, '00000000-0000-4000-8000-00000000000b'::uuid s
), rows(mins, type, fields, who, surface, input, transcript) as (values
  (720, 'feed.bottle.start', '{"contents":"formula"}', 'a', 'phone', 'tap', null),
  (700, 'feed.bottle.finish', '{"consumed_fraction":0.75}', 'a', 'phone', 'voice', 'finished, a quarter left'),
  (650, 'diaper', '{"kind":"wet"}', 'a', 'ring', 'gesture', null),
  (600, 'sleep.start', '{}', 'a', 'watch', 'tap', null),
  (480, 'sleep.end', '{}', 's', 'phone', 'tap', null),
  (470, 'feed.breast.start', '{"side":"left"}', 's', 'phone', 'voice', 'nursing on the left'),
  (455, 'feed.breast.switch', '{"side":"right"}', 's', 'watch', 'tap', null),
  (440, 'feed.breast.finish', '{}', 's', 'watch', 'tap', null),
  (420, 'diaper', '{"kind":"dirty"}', 's', 'phone', 'voice', 'big poop'),
  (300, 'feed.bottle.start', '{"contents":"breast_milk"}', 'a', 'glasses', 'gesture', null),
  (285, 'feed.bottle.finish', '{"consumed_fraction":0.5}', 'a', 'glasses', 'voice', 'drank half'),
  (250, 'sleep.start', '{}', 'a', 'ring', 'gesture', null),
  (160, 'sleep.end', '{}', 'a', 'phone', 'tap', null),
  (150, 'feed.bottle.single', '{"consumed_fraction":1,"contents":"formula"}', 's', 'mcp', 'agent', null),
  (70, 'diaper', '{"kind":"wet"}', 's', 'watch', 'voice', 'wet diaper'),
  (68, 'diaper', '{"kind":"wet"}', 'a', 'phone', 'tap', null)
)
insert into public.events (id, household_id, baby_id, type, fields, occurred_at, logged_at, logged_by, provenance)
select gen_random_uuid(), p.h, p.b, r.type, r.fields::jsonb, now() - make_interval(mins => r.mins), now() - make_interval(mins => r.mins),
       case r.who when 'a' then p.a else p.s end,
       jsonb_strip_nulls(jsonb_build_object('surface', r.surface, 'input', r.input, 'raw_transcript', r.transcript,
         'confidence_tier', case when r.input = 'voice' then 'auto' end,
         'model_version', case when r.input = 'voice' then 'laya-q8_0' end))
from rows r cross join p
order by r.mins desc;
