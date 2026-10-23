-- G2 Digest local seed (supabase/seeds/*.sql are loaded in name order by `supabase db reset`).
-- One reader with the seeded example brief (projects/g2digest/packages/core/fixtures/reference-brief.json,
-- split into profile + brief as the Worker stores it). Sign in with reader@example.com, password
-- "g2digest-dev". Local-only tokens: agent g2a_dev_local_token (MCP), glasses g2d_dev_local_device,
-- podcast feed g2f_dev_local_feed.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000002d1', 'authenticated', 'authenticated',
   'reader@example.com', crypt('g2digest-dev', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '00000000-0000-4000-8000-0000000002d1', '00000000-0000-4000-8000-0000000002d1',
        '{"sub":"00000000-0000-4000-8000-0000000002d1","email":"reader@example.com"}', 'email', now(), now(), now())
on conflict do nothing;

insert into g2digest.profiles (user_id, language, units, glossary, no_gloss, delivery) values
  ('00000000-0000-4000-8000-0000000002d1', 'en', '{"temperature": "C", "distance": "km"}',
   '[{"term": "inference", "gloss": "running a trained model to get answers"}]',
   '["LLM", "GPU", "API", "open weights"]',
   '{"time": "13:40", "timezone": "America/Los_Angeles", "days": ["mon", "tue", "wed", "thu", "fri"]}');

insert into g2digest.briefs (user_id, brief_version, config) values
  ('00000000-0000-4000-8000-0000000002d1', 1, $json$
{
  "title": "Afternoon brief",
  "tldr": true,
  "total_card_budget": 12,
  "total_audio_budget_sec": 1200,
  "sections": [
    {
      "id": "providers",
      "title": "Providers",
      "template": "status",
      "source": { "kind": "web_news", "entities": ["Baseten", "Fireworks AI"], "query": "Baseten OR \"Fireworks AI\" news" },
      "instructions": "One card per company that had real news in the last day: launches, funding, outages, deals, leadership. Attribute reports that aren't confirmed by the company. An outage or security incident is an alert. If neither company had news, one quiet card that says so.",
      "max_cards": 2,
      "quiet_behavior": "show_status",
      "audio": { "glance": true, "deep_dive": "on_alert" }
    },
    {
      "id": "breakthroughs",
      "title": "AI/ML",
      "template": "discovery",
      "source": { "kind": "web_news", "entities": [], "query": "AI ML research breakthrough new model release" },
      "instructions": "New AI/ML results that change what is possible, ranked by how much they move the field, not by hype. Prefer released models, papers with numbers and open weights over announcements. Skip funding news and product marketing. Leave the section out on a day with nothing that clears the bar.",
      "max_cards": 3,
      "quiet_behavior": "omit",
      "audio": { "glance": true, "deep_dive": "required" }
    },
    {
      "id": "markets",
      "title": "Markets",
      "template": "metric",
      "source": { "kind": "finance", "entities": ["Nasdaq Composite", "S&P 500", "Dow Jones Industrial Average"] },
      "instructions": "Today's close (or latest) for the three indexes as percentage moves, and the one driver behind the move in plain words.",
      "max_cards": 1,
      "quiet_behavior": "show_last",
      "audio": { "glance": true, "deep_dive": "never" }
    }
  ]
}
$json$::jsonb);

insert into g2digest.access_tokens (user_id, name, token_hash) values
  ('00000000-0000-4000-8000-0000000002d1', 'Local dev agent', encode(digest('g2a_dev_local_token', 'sha256'), 'hex'));
insert into g2digest.device_tokens (user_id, kind, label, token_hash) values
  ('00000000-0000-4000-8000-0000000002d1', 'glasses', 'Dev glasses', encode(digest('g2d_dev_local_device', 'sha256'), 'hex')),
  ('00000000-0000-4000-8000-0000000002d1', 'feed', 'Dev podcast feed', encode(digest('g2f_dev_local_feed', 'sha256'), 'hex'));
