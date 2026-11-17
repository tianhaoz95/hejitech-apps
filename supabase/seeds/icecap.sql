-- Icecap local test data (supabase db reset). Development builds of the web app and the extension
-- sign in as pro@icecap.test / icecap-dev-123 (Pro by grant, an admin, two saved deals);
-- free@icecap.test / icecap-dev-123 has no Pro.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000ca01', 'authenticated', 'authenticated',
   'pro@icecap.test', crypt('icecap-dev-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Icecap Tester"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000ca02', 'authenticated', 'authenticated',
   'free@icecap.test', crypt('icecap-dev-123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000ca01', '00000000-0000-4000-8000-00000000ca01',
   '{"sub":"00000000-0000-4000-8000-00000000ca01","email":"pro@icecap.test"}', 'email', now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-00000000ca02', '00000000-0000-4000-8000-00000000ca02',
   '{"sub":"00000000-0000-4000-8000-00000000ca02","email":"free@icecap.test"}', 'email', now(), now(), now())
on conflict do nothing;

insert into icecap.pro_grants (email, until, note) values ('pro@icecap.test', null, 'local test user')
on conflict (email) do nothing;
insert into icecap.admins (user_id) values ('00000000-0000-4000-8000-00000000ca01') on conflict do nothing;

insert into icecap.properties (id, user_id, data) values
  ('00000000-0000-4000-8000-0000000ca101', '00000000-0000-4000-8000-00000000ca01', '{
    "mode": "rental", "price": 485000, "address": "1247 Maple Street, Austin, TX 78701",
    "url": "https://www.redfin.com/TX/Austin/1247-Maple-St-78701/home/1", "taxes": 9700, "hoa": 0,
    "estimatedRent": 3400, "rehabCost": 15000, "arv": 540000, "holdingCosts": 0,
    "assumptions": {"downPaymentPercent": 20, "interestRate": 7, "loanTermYears": 30, "vacancyRate": 5,
                    "maintenanceRate": 5, "managementFeeRate": 8, "closingCostsPercent": 3, "sellingCostsPercent": 6}
  }'),
  ('00000000-0000-4000-8000-0000000ca102', '00000000-0000-4000-8000-00000000ca01', '{
    "mode": "flip", "price": 310000, "address": "88 Oak Avenue, Columbus, OH 43201",
    "url": "https://www.zillow.com/homedetails/88-Oak-Ave-Columbus-OH-43201/1_zpid/", "taxes": 5200, "hoa": 0,
    "estimatedRent": 2100, "rehabCost": 45000, "arv": 410000, "holdingCosts": 6000,
    "assumptions": {"downPaymentPercent": 20, "interestRate": 7, "loanTermYears": 30, "vacancyRate": 5,
                    "maintenanceRate": 5, "managementFeeRate": 8, "closingCostsPercent": 3, "sellingCostsPercent": 6}
  }')
on conflict (id) do nothing;
