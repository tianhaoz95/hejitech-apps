-- HQ's own store (Cloudflare D1). HQ never reads another project's database: everything here is
-- HQ's own data (cards, decisions, runs, the audit log) plus the policy the CLI syncs from .hq/.

CREATE TABLE config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  policy_json TEXT NOT NULL,
  commit_sha TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  project TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  plan TEXT NOT NULL,
  verify TEXT NOT NULL,
  tier TEXT NOT NULL,
  effort TEXT NOT NULL,
  risk TEXT NOT NULL,
  risk_reason TEXT,
  verbs_json TEXT NOT NULL DEFAULT '[]',
  source_json TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  decided_by TEXT,
  branch TEXT,
  pr_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX cards_status ON cards (status, priority DESC);
CREATE INDEX cards_project ON cards (project, status);
CREATE INDEX cards_dedupe ON cards (dedupe_key);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL REFERENCES cards (id),
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX comments_card ON comments (card_id, id);

CREATE TABLE decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL REFERENCES cards (id),
  decision TEXT NOT NULL,
  reason TEXT,
  by TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX decisions_at ON decisions (at DESC);

-- Evidence added after the proposal: build results, screenshots, the reviewer's verdict.
CREATE TABLE attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL REFERENCES cards (id),
  phase TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  file_key TEXT,
  by TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX attachments_card ON attachments (card_id, id);

-- Work for runners: scout, ceo, build, review, reply, verb, health.
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  project TEXT,
  scout TEXT,
  card_id TEXT,
  verb TEXT,
  args_json TEXT NOT NULL DEFAULT '{}',
  runs_on TEXT NOT NULL DEFAULT 'any',
  agent TEXT,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  runner TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  summary TEXT,
  output TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  session TEXT
);
CREATE INDEX runs_status ON runs (status, created_at);
CREATE INDEX runs_scout ON runs (kind, scout, project, created_at DESC);

CREATE TABLE health (
  project TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  ok INTEGER NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT
);
CREATE INDEX audit_at ON audit (at DESC);
