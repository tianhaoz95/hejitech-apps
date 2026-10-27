-- Tether local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- One developer workspace. Sign in with dev@example.com, password "tether-dev".
-- Local-only assistant token: ttr_dev_local_token (MCP).
-- Sample host points to example.invalid (clearly labelled sample, points nowhere real per PRD §18.4).

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000007e74', 'authenticated', 'authenticated',
   'dev@example.com', crypt('tether-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-000000007e74', '00000000-0000-4000-8000-000000007e74',
        '{"sub":"00000000-0000-4000-8000-000000007e74","email":"dev@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into tether.workspaces (user_id, tree, settings) values
  ('00000000-0000-4000-8000-000000007e74', $json$
{
  "version": 1,
  "root": {
    "type": "split",
    "direction": "horizontal",
    "ratio": 0.5,
    "first": {
      "type": "pane",
      "id": "pane-1",
      "tabs": [
        { "id": "tab-1", "type": "web", "title": "Example", "web": { "url": "https://example.com" } }
      ],
      "activeTabId": "tab-1"
    },
    "second": {
      "type": "pane",
      "id": "pane-2",
      "tabs": [
        { "id": "tab-2", "type": "ssh", "title": "sample@example.invalid (disconnected)", "ssh": { "hostId": "sample-host-1" } },
        { "id": "tab-3", "type": "files", "title": "Files", "files": { "mode": "local", "path": "/" } }
      ],
      "activeTabId": "tab-2"
    }
  },
  "focusedPaneId": "pane-1"
}
$json$, $settings$
{
  "terminalFontSize": 14,
  "landscapeLockWhenMonitorConnected": true,
  "defaultSearchEngine": "https://duckduckgo.com/?q="
}
$settings$)
on conflict (user_id) do nothing;

insert into tether.hosts (user_id, id, label, host, port, username, auth, key_id, remember_password, auto_reconnect_on_display_reconnect) values
  ('00000000-0000-4000-8000-000000007e74', 'sample-host-1', 'Sample Host (Placeholder)', 'example.invalid', 22, 'sample', 'key', 'sample-key-1', false, false)
on conflict (user_id, id) do nothing;

insert into tether.bookmarks (user_id, id, title, url) values
  ('00000000-0000-4000-8000-000000007e74', 'bm-1', 'Example Documentation', 'https://example.com')
on conflict (user_id, id) do nothing;

insert into tether.access_tokens (token_hash, user_id, name) values
  ('16949c5fac5341cfbe10c97e4bcd5038b27498bf51f62b138b4282ff3c672523', '00000000-0000-4000-8000-000000007e74', 'Seed assistant')
on conflict (token_hash) do nothing;
