-- Polymath local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- Seed developer profile. Sign in with polymath@example.com, password "polymath-dev".
-- Local assistant token: plt_dev_local_token (MCP).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000009017', 'authenticated', 'authenticated',
   'polymath@example.com', crypt('polymath-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000009017', '00000000-0000-4000-8000-000000009017',
        '{"sub":"00000000-0000-4000-8000-000000009017","email":"polymath@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into polymath.profiles (user_id, display_name, preferences, recent_courses)
values (
  '00000000-0000-4000-8000-000000009017',
  'Systems Learner',
  '{"theme": "dark", "fontSize": 14, "autoRunTests": true}'::jsonb,
  '[{"id": "pytorch-vllm-sglang", "title": "PyTorch Deep Systems: Building vLLM, SGLang & TRT-LLM", "path": "~/heji-courses/pytorch-vllm-sglang"}]'::jsonb
)
on conflict (user_id) do update set
  display_name = excluded.display_name,
  preferences = excluded.preferences;

-- Seed local personal access token for testing MCP (SHA-256 of 'plt_dev_local_token')
insert into polymath.access_tokens (token_hash, user_id, name)
values (
  'ba06857f62e873634dcda5f7d24d2dd70a3c7b6408d6d67b57b98d36eb74a008',
  '00000000-0000-4000-8000-000000009017',
  'local-cli-test'
)
on conflict (token_hash) do nothing;
