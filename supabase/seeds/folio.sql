-- Folio local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- One developer account: folio-dev@example.com, password "folio-dev".
-- Local-only agent token: fol_dev_local_token (MCP). One sample artifact, slug "seedpage2".

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000f011', 'authenticated', 'authenticated',
   'folio-dev@example.com', crypt('folio-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-00000000f011',
        '{"sub":"00000000-0000-4000-8000-00000000f011","email":"folio-dev@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into folio.access_tokens (token_hash, user_id, name)
values (encode(extensions.digest('fol_dev_local_token', 'sha256'), 'hex'), '00000000-0000-4000-8000-00000000f011', 'Local dev agent')
on conflict (token_hash) do nothing;

do $$
declare
  v_id uuid := '00000000-0000-4000-8000-0000000a0001';
  v_html text := E'<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>Sample</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello from Folio</h1>\n  <p>Any agent can edit this page.</p>\n</body>\n</html>\n';
  v_css text := E'body { font: 16px/1.5 system-ui, sans-serif; margin: 40px; }\nh1 { color: #2f5bea; }\n';
begin
  if exists (select 1 from folio.artifacts where id = v_id) then return; end if;
  insert into folio.artifacts (id, slug, owner_id, title, description, head_version)
  values (v_id, 'seedpage2', '00000000-0000-4000-8000-00000000f011', 'Sample page', 'A seeded artifact for local development.', 0);
  insert into folio.blobs (artifact_id, hash, size, text) values
    (v_id, encode(extensions.digest(convert_to(v_html, 'utf8'), 'sha256'), 'hex'), octet_length(convert_to(v_html, 'utf8')), v_html),
    (v_id, encode(extensions.digest(convert_to(v_css, 'utf8'), 'sha256'), 'hex'), octet_length(convert_to(v_css, 'utf8')), v_css);
  perform folio.commit_version(v_id, 0, jsonb_build_object(
    'index.html', jsonb_build_object('hash', encode(extensions.digest(convert_to(v_html, 'utf8'), 'sha256'), 'hex'), 'size', octet_length(convert_to(v_html, 'utf8')), 'type', 'text/html; charset=utf-8'),
    'style.css', jsonb_build_object('hash', encode(extensions.digest(convert_to(v_css, 'utf8'), 'sha256'), 'hex'), 'size', octet_length(convert_to(v_css, 'utf8')), 'type', 'text/css; charset=utf-8')
  ), 'Seeded sample', '00000000-0000-4000-8000-00000000f011', 'Seed', null, 'api', 'create');
  insert into folio.events (artifact_id, kind, version, actor_id, agent, via, summary)
  values (v_id, 'created', 1, '00000000-0000-4000-8000-00000000f011', 'Seed', 'api', 'Created with index.html, style.css');
end $$;
