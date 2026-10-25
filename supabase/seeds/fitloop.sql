-- FitLoop local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- One athlete with the example plan (packages/core/fixtures/example-plan.json) as version 1, a few
-- check-ins, open feedback and vitals. Sign in with athlete@example.com, password "fitloop-dev".
-- Local-only tokens: glasses fld_dev_local_device, agent fla_dev_local_token (MCP).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000f1700', 'authenticated', 'authenticated',
   'athlete@example.com', crypt('fitloop-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-0000000f1700', '00000000-0000-4000-8000-0000000f1700',
        '{"sub":"00000000-0000-4000-8000-0000000f1700","email":"athlete@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into fitloop.profiles (user_id, settings) values ('00000000-0000-4000-8000-0000000f1700', $json${"units": "metric", "vitals": {"live_hr": true, "health_daily": true, "manual": true, "photos": false}, "agent_access": {"vitals": true, "photos": false, "feedback": true, "checkins": true}, "reminders": {"workout": {"on": true, "minutes_before": 10}, "meals": {"on": true}, "evening": {"on": true, "time": "21:00"}, "weekly": {"on": true, "weekday": "sun", "time": "18:00"}}, "glasses": {"show_hr": true, "auto_rest_timer": true}, "about": {"goals": "Lose about 4 kg by mid-December and keep my strength.", "restrictions": "Left knee: no jumping or deep lunges.", "equipment": "Office gym: dumbbells to 30 kg, cable, bike.", "schedule": "45 min at lunch on weekdays; free on weekends.", "diet": "Vegetarian on weekdays.", "notes": ""}}$json$)
on conflict (user_id) do nothing;

-- The example plan, starting at the seed's Monday so "today" always has something in it.
insert into fitloop.plans (user_id, version, plan, change_note, starts_on)
select '00000000-0000-4000-8000-0000000f1700', 1,
       jsonb_set($json${
  "format": 1,
  "title": "Strength + lean-out, 8 weeks",
  "summary": "Three full-body strength sessions and two short cardio days a week, built around 45-minute weekday lunch breaks and a bad left knee. Meals hit about 2200 kcal with 160 g protein, vegetarian on weekdays.",
  "starts_on": "2026-10-19",
  "ends_on": "2026-12-13",
  "goals": [
    { "id": "lose-fat", "text": "Lose 4 kg while keeping strength", "metric": "weight", "target": 78, "unit": "kg", "by": "2026-12-13" },
    { "id": "squat", "text": "Goblet squat 32 kg for 3x10 without knee pain" }
  ],
  "constraints": ["Left knee: no jumping, no deep lunges", "45 min on weekdays, at the office gym (dumbbells, cable, bike)", "Vegetarian Monday to Friday"],
  "targets": { "calories": 2200, "protein_g": 160, "carbs_g": 220, "fat_g": 70, "water_l": 2.5 },
  "week": {
    "mon": {
      "title": "Full body A",
      "workouts": [
        {
          "id": "full-body-a", "title": "Full body A", "time": "12:00", "duration_min": 45, "kind": "strength",
          "exercises": [
            { "id": "bike", "name": "Bike warm-up", "sets": 1, "duration_sec": 300, "load": "easy", "rest_sec": 60, "cues": ["Easy pace, nose breathing", "Cadence around 80"] },
            { "id": "goblet-squat", "name": "Goblet squat", "sets": 3, "reps": "8-10", "load": "24 kg", "rest_sec": 90, "cues": ["Bell at chest, elbows in", "Sit between the hips", "Knees track over toes", "Stop above pain"], "instructions": "Hold the dumbbell vertically at your chest. Sit down between your hips to a box if needed, pause, drive up through the whole foot.", "alternative": "Box squat to a bench" },
            { "id": "db-row", "name": "One-arm dumbbell row", "sets": 3, "reps": 10, "load": "22 kg", "rest_sec": 60, "cues": ["Flat back, hand on bench", "Pull elbow to hip", "2 s down"] },
            { "id": "db-press", "name": "Dumbbell bench press", "sets": 3, "reps": "8-10", "load": "20 kg", "rest_sec": 90, "cues": ["Shoulder blades pinned", "Wrists over elbows", "Touch, then press"] },
            { "id": "plank", "name": "Plank", "sets": 3, "duration_sec": 40, "rest_sec": 45, "cues": ["Ribs down, squeeze glutes", "Straight line ear to ankle"] }
          ]
        }
      ],
      "meals": [
        { "id": "breakfast", "name": "Breakfast", "time": "07:30", "items": [{ "name": "Greek yogurt", "amount": "300 g" }, { "name": "Berries", "amount": "1 cup" }, { "name": "Granola", "amount": "40 g" }], "macros": { "calories": 520, "protein_g": 36, "carbs_g": 60, "fat_g": 14 } },
        { "id": "lunch", "name": "Lunch", "time": "13:00", "items": [{ "name": "Tofu rice bowl", "amount": "1 bowl" }, { "name": "Edamame", "amount": "100 g" }], "macros": { "calories": 680, "protein_g": 48, "carbs_g": 75, "fat_g": 20 }, "prep": ["Press tofu 10 min", "Pan-fry with soy and garlic"] },
        { "id": "snack", "name": "Protein shake", "time": "16:00", "items": [{ "name": "Whey or pea protein", "amount": "1 scoop" }, { "name": "Banana", "amount": "1" }], "macros": { "calories": 250, "protein_g": 26, "carbs_g": 30, "fat_g": 3 } },
        { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Lentil curry", "amount": "1.5 cups" }, { "name": "Brown rice", "amount": "1 cup" }, { "name": "Spinach", "amount": "2 cups" }], "macros": { "calories": 720, "protein_g": 45, "carbs_g": 60, "fat_g": 30 } }
      ]
    },
    "tue": {
      "title": "Zone 2 bike",
      "workouts": [
        { "id": "zone-2", "title": "Zone 2 bike", "time": "12:00", "duration_min": 35, "kind": "cardio", "exercises": [
          { "id": "bike-z2", "name": "Steady bike, zone 2", "sets": 1, "duration_sec": 1800, "load": "zone 2", "rest_sec": 0, "cues": ["You can still talk", "HR about 125-140"] }
        ] }
      ],
      "meals": [
        { "id": "breakfast", "name": "Breakfast", "time": "07:30", "items": [{ "name": "Oats with whey", "amount": "1 bowl" }, { "name": "Walnuts", "amount": "20 g" }], "macros": { "calories": 520, "protein_g": 38, "carbs_g": 62, "fat_g": 14 } },
        { "id": "lunch", "name": "Lunch", "time": "13:00", "items": [{ "name": "Bean burrito bowl", "amount": "1 bowl" }], "macros": { "calories": 700, "protein_g": 42, "carbs_g": 85, "fat_g": 18 } },
        { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Tempeh stir-fry", "amount": "1 plate" }, { "name": "Noodles", "amount": "1 cup" }], "macros": { "calories": 900, "protein_g": 70, "carbs_g": 80, "fat_g": 30 } }
      ]
    },
    "wed": { "title": "Rest day", "workouts": [], "meals": [
      { "id": "breakfast", "name": "Breakfast", "time": "07:30", "items": [{ "name": "Greek yogurt", "amount": "300 g" }, { "name": "Berries", "amount": "1 cup" }], "macros": { "calories": 420, "protein_g": 34, "carbs_g": 40, "fat_g": 10 } },
      { "id": "lunch", "name": "Lunch", "time": "13:00", "items": [{ "name": "Tofu rice bowl", "amount": "1 bowl" }], "macros": { "calories": 680, "protein_g": 48, "carbs_g": 75, "fat_g": 20 } },
      { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Lentil pasta", "amount": "2 cups" }, { "name": "Side salad", "amount": "1 bowl" }], "macros": { "calories": 950, "protein_g": 60, "carbs_g": 105, "fat_g": 30 } }
    ] },
    "thu": { "title": "Full body B", "workouts": [
      { "id": "full-body-b", "title": "Full body B", "time": "12:00", "duration_min": 45, "kind": "strength", "exercises": [
        { "id": "bike", "name": "Bike warm-up", "sets": 1, "duration_sec": 300, "load": "easy", "rest_sec": 60, "cues": ["Easy pace"] },
        { "id": "rdl", "name": "Dumbbell Romanian deadlift", "sets": 3, "reps": 10, "load": "2x22 kg", "rest_sec": 90, "cues": ["Soft knees, hips back", "Bells slide down thighs", "Neutral spine"] },
        { "id": "lat-pulldown", "name": "Lat pulldown", "sets": 3, "reps": 12, "load": "50 kg", "rest_sec": 60, "cues": ["Chest up", "Elbows to back pockets"] },
        { "id": "step-up", "name": "Low step-up", "sets": 3, "reps": 8, "load": "bodyweight", "rest_sec": 60, "cues": ["Low box, right leg leads", "Stop if the knee hurts"], "alternative": "Glute bridge" },
        { "id": "pallof", "name": "Pallof press", "sets": 3, "reps": 10, "load": "cable", "rest_sec": 45, "cues": ["Resist the twist", "Press straight out"] }
      ] }
    ], "meals": [
      { "id": "breakfast", "name": "Breakfast", "time": "07:30", "items": [{ "name": "Greek yogurt", "amount": "300 g" }, { "name": "Granola", "amount": "40 g" }], "macros": { "calories": 520, "protein_g": 36, "carbs_g": 60, "fat_g": 14 } },
      { "id": "lunch", "name": "Lunch", "time": "13:00", "items": [{ "name": "Chickpea salad wrap", "amount": "2" }], "macros": { "calories": 700, "protein_g": 40, "carbs_g": 80, "fat_g": 22 } },
      { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Tofu curry", "amount": "1.5 cups" }, { "name": "Rice", "amount": "1 cup" }], "macros": { "calories": 950, "protein_g": 80, "carbs_g": 80, "fat_g": 34 } }
    ] },
    "fri": { "title": "Intervals", "workouts": [
      { "id": "intervals", "title": "Bike intervals", "time": "12:00", "duration_min": 30, "kind": "hiit", "exercises": [
        { "id": "warm-up", "name": "Easy spin", "sets": 1, "duration_sec": 300, "rest_sec": 0, "cues": ["Easy"] },
        { "id": "hard", "name": "Hard interval", "sets": 6, "duration_sec": 60, "load": "RPE 8", "rest_sec": 90, "cues": ["Hard but steady", "Easy spin in the rest"] },
        { "id": "cool-down", "name": "Cool-down spin", "sets": 1, "duration_sec": 300, "rest_sec": 0, "cues": ["Bring the HR down"] }
      ] }
    ], "meals": [
      { "id": "breakfast", "name": "Breakfast", "time": "07:30", "items": [{ "name": "Oats with whey", "amount": "1 bowl" }], "macros": { "calories": 500, "protein_g": 36, "carbs_g": 62, "fat_g": 12 } },
      { "id": "lunch", "name": "Lunch", "time": "13:00", "items": [{ "name": "Tofu rice bowl", "amount": "1 bowl" }], "macros": { "calories": 680, "protein_g": 48, "carbs_g": 75, "fat_g": 20 } },
      { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Veggie pizza", "amount": "3 slices" }, { "name": "Side salad", "amount": "1 bowl" }], "macros": { "calories": 1000, "protein_g": 50, "carbs_g": 110, "fat_g": 38 } }
    ] },
    "sat": { "title": "Long walk", "workouts": [
      { "id": "walk", "title": "Long walk", "duration_min": 60, "kind": "cardio", "exercises": [
        { "id": "walk", "name": "Brisk walk", "sets": 1, "duration_sec": 3600, "rest_sec": 0, "cues": ["Hills welcome", "Phone in pocket"] }
      ] }
    ], "meals": [
      { "id": "brunch", "name": "Brunch", "time": "10:00", "items": [{ "name": "Eggs", "amount": "3" }, { "name": "Toast", "amount": "2 slices" }, { "name": "Avocado", "amount": "1/2" }], "macros": { "calories": 700, "protein_g": 32, "carbs_g": 50, "fat_g": 38 } },
      { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Salmon", "amount": "180 g" }, { "name": "Potatoes", "amount": "250 g" }, { "name": "Green beans", "amount": "1 cup" }], "macros": { "calories": 850, "protein_g": 50, "carbs_g": 70, "fat_g": 35 } }
    ] },
    "sun": { "title": "Rest day", "workouts": [], "meals": [
      { "id": "brunch", "name": "Brunch", "time": "10:00", "items": [{ "name": "Protein pancakes", "amount": "3" }, { "name": "Berries", "amount": "1 cup" }], "macros": { "calories": 650, "protein_g": 45, "carbs_g": 80, "fat_g": 15 } },
      { "id": "dinner", "name": "Dinner", "time": "19:00", "items": [{ "name": "Chicken stir-fry", "amount": "1 plate" }, { "name": "Rice", "amount": "1 cup" }], "macros": { "calories": 850, "protein_g": 60, "carbs_g": 85, "fat_g": 25 } }
    ] }
  },
  "overrides": {
    "2026-11-26": { "title": "Thanksgiving", "workouts": [
      { "id": "walk", "title": "Morning walk", "time": "09:00", "duration_min": 45, "kind": "cardio", "exercises": [
        { "id": "walk", "name": "Brisk walk", "sets": 1, "duration_sec": 2700, "rest_sec": 0, "cues": ["Before the feast"] }
      ] }
    ], "meals": [] }
  }
}
$json$::jsonb, '{starts_on}', to_jsonb(to_char(date_trunc('week', current_date)::date - 7, 'YYYY-MM-DD'))) - 'ends_on',
       'First plan: three strength days around the left knee, two short cardio days, vegetarian weekdays.',
       date_trunc('week', current_date)::date - 7
where not exists (select 1 from fitloop.plans where user_id = '00000000-0000-4000-8000-0000000f1700');

insert into fitloop.checkins (user_id, date, ref, kind, status, plan_version, data, source, at) values
  ('00000000-0000-4000-8000-0000000f1700', date_trunc('week', current_date)::date - 7, 'full-body-a', 'workout', 'done', 1, '{}', 'glasses', now() - interval '7 days'),
  ('00000000-0000-4000-8000-0000000f1700', date_trunc('week', current_date)::date - 7, 'lunch', 'meal', 'done', 1, '{"portion":"less"}', 'glasses', now() - interval '7 days'),
  ('00000000-0000-4000-8000-0000000f1700', date_trunc('week', current_date)::date - 6, 'zone-2', 'workout', 'done', 1, '{"avg_hr":133}', 'watch', now() - interval '6 days'),
  ('00000000-0000-4000-8000-0000000f1700', date_trunc('week', current_date)::date - 4, 'full-body-b/step-up', 'exercise', 'swapped', 1, '{"swapped_for":"Glute bridge"}', 'phone', now() - interval '4 days')
on conflict do nothing;

insert into fitloop.feedback (user_id, date, ref, plan_version, text, tags, source)
select '00000000-0000-4000-8000-0000000f1700', date_trunc('week', current_date)::date - 4, 'full-body-b/step-up', 1, 'Step-ups bugged my left knee again, swapped for glute bridges.', array['pain'], 'glasses'
where not exists (select 1 from fitloop.feedback where user_id = '00000000-0000-4000-8000-0000000f1700');

insert into fitloop.vitals (user_id, date, metric, value, source) values
  ('00000000-0000-4000-8000-0000000f1700', current_date - 7, 'weight', 82.1, 'health'),
  ('00000000-0000-4000-8000-0000000f1700', current_date - 3, 'weight', 81.6, 'health'),
  ('00000000-0000-4000-8000-0000000f1700', current_date - 1, 'resting_hr', 58, 'health'),
  ('00000000-0000-4000-8000-0000000f1700', current_date - 1, 'sleep_hours', 7.2, 'health'),
  ('00000000-0000-4000-8000-0000000f1700', current_date - 1, 'energy', 4, 'manual')
on conflict do nothing;

insert into fitloop.device_tokens (token_hash, user_id, label) values ('319dfdf05b9682443b454502e12a304261b38c977a1396677320d2bebb8fc255', '00000000-0000-4000-8000-0000000f1700', 'Seed glasses')
on conflict (token_hash) do nothing;
insert into fitloop.access_tokens (token_hash, user_id, name) values ('90fb09661f7033737787058aa718568520eeb411f6a188f1ea7a51ff7346fb9f', '00000000-0000-4000-8000-0000000f1700', 'Seed agent')
on conflict (token_hash) do nothing;
