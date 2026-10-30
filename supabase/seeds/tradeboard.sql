-- Trading Plan Board local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- The owner signs in with owner@example.com / "tradeboard-dev" (email sign-in is local only), then
-- enrolls TOTP on first visit. Three agents with local-only tokens: tba_dev_claude, tba_dev_gemini,
-- tba_dev_muse; one executor credential tbx_dev_local (executor id "local"). The board itself
-- (policy v1, control row, the DEMO plan) is created by the Worker on first use, as in production.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000b0a4', 'authenticated', 'authenticated',
   'owner@example.com', crypt('tradeboard-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000b0a4', '00000000-0000-4000-8000-00000000b0a4',
        '{"sub":"00000000-0000-4000-8000-00000000b0a4","email":"owner@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into tradeboard.agents (agent_id, display_name) values ('claude', 'Claude'), ('gemini', 'Gemini'), ('muse', 'Muse');
insert into tradeboard.agent_tokens (token_hash, agent_id, label) values
  (encode(extensions.digest('tba_dev_claude', 'sha256'), 'hex'), 'claude', 'local dev'),
  (encode(extensions.digest('tba_dev_gemini', 'sha256'), 'hex'), 'gemini', 'local dev'),
  (encode(extensions.digest('tba_dev_muse', 'sha256'), 'hex'), 'muse', 'local dev');
insert into tradeboard.executor_tokens (token_hash, executor_id, label) values
  (encode(extensions.digest('tbx_dev_local', 'sha256'), 'hex'), 'local', 'local dev');
