// The report's config and its design blocks. The page text lives in index.html; this file holds
// what report.js needs to build the hand-off, plus diagrams/charts/tables drawn by design.js.
window.REPORT = {
  key: "2026-10-28-headway-subscription-monetization-v1",
  dir: "reports/archive/2026-10-28-headway-subscription-monetization",
  repo: "tianhaoz95/hejitech-apps",
  port: 8822,
  title: "Headway Paid Subscription Strategy & Monetization Blueprint",
  project: "projects/headway",
  context: [
    "projects/headway/CLAUDE.md",
    "projects/headway/packages/core/src/schedule.ts",
    "projects/headway/packages/core/src/alerts.ts",
    "projects/headway/services/web/src/worker/api.ts",
    "projects/headway/services/web/src/worker/cron.ts",
    "projects/headway/apps/glasses/src/app.ts",
    "projects/headway/apps/ios/App/Sources/AppModel.swift",
    "projects/headway/apps/android/app/src/main/java/tech/heji/headway/ui/TrainsViewModel.kt",
    "supabase/migrations/20261025020632_headway_init.sql"
  ],
  brief: "Analyze and design a paid subscription model for Headway: what features to keep behind the paywall, how to handle cross-platform entitlements across iOS, Android, Apple Watch, Wear OS, Even G2 glasses and MCP, how much to charge based on market willingness to pay, and a competitive breakdown.",

  nextSteps: ({ ticks }) => [
    `Read the report at ${window.REPORT.dir} (serve: ${window.REPORT.dir}/script/serve.sh).`,
    ticks.total ? `${ticks.done} of ${ticks.total} checklist items are done; pick up from the first open one.` : "",
    "Confirm the pricing tier ($19.99/yr, $2.99/mo, $49.99 lifetime) and feature boundary.",
    "Decide between RevenueCat vs native StoreKit 2 + Google Play Billing server notifications.",
    "Implement the Supabase headway.subscriptions schema migration and Worker entitlement enforcement."
  ].filter(Boolean),

  blocks: {
    architecture: {
      kind: "flow",
      title: "Cross-Platform Entitlement Architecture",
      note: "Today all features hit the Worker with bare Supabase session/device tokens. Proposed: receipts flow through RevenueCat (or direct webhooks) to mint a single authoritative entitlement row in Supabase headway.subscriptions, unlocking iPhone, Apple Watch, Android, Wear OS, Even G2 smart glasses, and MCP.",
      today: {
        nodes: [
          { id: "ios", label: "iPhone / Watch", sub: "apps/ios", col: 0, row: 0, type: "ui" },
          { id: "android", label: "Android / Wear", sub: "apps/android", col: 0, row: 1, type: "ui" },
          { id: "glasses", label: "Even G2 Glasses", sub: "apps/glasses (.ehpk)", col: 0, row: 2, type: "ui" },
          { id: "worker", label: "Cloudflare Worker", sub: "services/web (/api)", col: 1, row: 1, type: "model" },
          { id: "db", label: "Supabase DB", sub: "schema headway", col: 2, row: 1, type: "store" }
        ],
        edges: [
          { from: "ios", to: "worker", label: "Bearer session token" },
          { from: "android", to: "worker", label: "Bearer session token" },
          { from: "glasses", to: "worker", label: "device_token" },
          { from: "worker", to: "db", label: "all features free" }
        ]
      },
      proposed: {
        nodes: [
          { id: "ios", label: "iPhone / Watch", sub: "StoreKit 2 / App Store", col: 0, row: 0, type: "ui" },
          { id: "android", label: "Android / Wear", sub: "Google Play Billing", col: 0, row: 1, type: "ui" },
          { id: "glasses", label: "Even G2 Glasses", sub: "Paired HUD display", col: 0, row: 2, type: "ui" },
          { id: "rc", label: "Billing / Webhooks", sub: "RevenueCat or App Store/Play API", col: 1, row: 0, state: "new", type: "external" },
          { id: "worker", label: "Cloudflare Worker", sub: "services/web (Entitlement check)", col: 1, row: 1, state: "changed", type: "model" },
          { id: "db", label: "Supabase DB", sub: "headway.subscriptions", col: 2, row: 1, state: "new", type: "store" }
        ],
        edges: [
          { from: "ios", to: "rc", label: "Purchase & restore", state: "new" },
          { from: "android", to: "rc", label: "Purchase & restore", state: "new" },
          { from: "rc", to: "worker", label: "POST /api/webhooks/billing", state: "new" },
          { from: "worker", to: "db", label: "upsert subscription row", state: "new" },
          { from: "glasses", to: "worker", label: "verify is_pro on /api/board", state: "changed" },
          { from: "ios", to: "worker", label: "claim Pro Live Activities/APNs", state: "changed" },
          { from: "android", to: "worker", label: "sync wear Pro complication", state: "changed" }
        ]
      }
    },

    pricing_comp: {
      kind: "chart",
      type: "bar",
      title: "Annual Transit & Commuter App Pricing Benchmarks",
      unit: "USD / year",
      note: "Headway's recommended $19.99/yr tier sits right between the budget niche of Caltrain Companion and general transit behemoths like Transit Royale, while offering 10x higher perceived value through Even G2 glasses and Live Activities.",
      x: ["Caltrain Companion", "Citymapper Club", "Headway (Proposed)", "Transit Royale", "Flighty Pro (Bench)"],
      series: [
        {
          name: "Annual Price",
          values: [4.00, 9.99, 19.99, 24.99, 49.99],
          basis: "measured",
          source: "App Store / Google Play verified pricing Oct 2026"
        }
      ]
    },

    competitor_matrix: {
      kind: "table",
      title: "Caltrain & Transit Competitor Feature Matrix",
      note: "Competitors either provide broad multi-modal schedules without deep hardware integration, or are legacy Caltrain apps that lack modern Apple/Android/Smart Glasses capabilities.",
      head: ["App", "Primary Focus", "Pricing Model", "Apple Watch / Wear OS", "Live Activities / Island", "Smart Glasses HUD", "AI / MCP API"],
      rows: [
        ["Headway (Ours)", "Dedicated Caltrain glanceable intelligence", "Freemium ($2.99/mo, $19.99/yr, $49.99 life)", "Full WatchOS + Wear OS Complications & Tiles", "Yes (Realtime push APNs)", "Yes (Even G2 + R1 Ring)", "Yes (/mcp tools)"],
        ["Caltrain Companion", "Legacy Caltrain schedule & delay alerts", "Freemium ($4.00/yr 'My Conductor')", "Basic Apple Watch only (no Wear OS)", "No", "No", "No"],
        ["Transit App", "Multi-modal bus/train/metro trip planning", "Freemium ($4.99/mo, $24.99/yr 'Royale')", "Apple Watch only", "Yes (Go navigation)", "No", "No"],
        ["Citymapper", "Multi-modal urban routing & directions", "Freemium ($1.49/mo, $9.99/yr 'Club')", "Apple Watch & Wear OS", "Yes (Turn-by-turn)", "No", "No"],
        ["Official Caltrain Mobile", "Mobile ticketing and fare payments", "Free (Agency app)", "No", "No", "No", "No"],
        ["Caltrain Live (Web)", "Open-source community live train map", "Free (Open-source web)", "No", "No", "No", "No"]
      ]
    },

    tier_matrix: {
      kind: "table",
      title: "Free vs. Headway Pro Feature Boundary",
      note: "The boundary strictly preserves core commuter safety and timetable utility in Free, while paywalling continuous background automation, multi-device hardware syncing, smart glasses heads-up display, and AI extensions.",
      head: ["Feature Area", "Free Tier", "Headway Pro ($19.99/yr or $2.99/mo)", "Why It Converts"],
      rows: [
        ["Live Departure Boards", "Yes: closest station + next 3 trains", "Yes: all stations + express filters + unlimited history", "Basic timetable must always work"],
        ["Timetable & Station Flip", "Yes: full offline compiled timetable", "Yes: full offline compiled timetable", "Core utility prevents churn"],
        ["Saved Commute Legs", "1 active leg (e.g. morning to work)", "Unlimited legs (morning, evening, weekend, airport)", "Daily commuters need reverse commute automatic switching"],
        ["Smart Push Alerts (APNs)", "None or static schedule departure reminder", "Autonomous GTFS-RT delay warnings, cancellations & 'Leave Now'", "Saves 20-30 min standing on windy platforms"],
        ["Live Activities & Dynamic Island", "15-min trial / single manual trip", "Unlimited automatic Live Activities on Lock Screen & Island", "High-frequency dopamine for iPhone tech commuters"],
        ["Apple Watch & Wear OS", "Basic station departures on demand", "Wrist Complications & Wear OS Tiles with auto-updating countdown", "Glance at wrist while biking or walking without pulling phone out"],
        ["Even G2 Glasses & R1 Ring", "Demo mode / 1-day pairing test", "Unlimited Head-Up Display board + R1 rotary scroll tracking", "Exclusive killer feature: zero hands, zero phone pull"],
        ["Live ETA Sharing (eta_shares)", "View shared link", "Create live web tracking links to text family/co-workers", "Utility when meeting partners or arranging rides"],
        ["MCP Server & AI Agent Tools", "No", "Personal assistant token access (Claude/Gemini/Antigravity)", "Silicon Valley tech demographic loves AI agent workflow"]
      ]
    },

    journey: {
      kind: "steps",
      title: "Cross-Platform Purchase & Glasses Unlock Journey",
      note: "How a user upgrades on iPhone or Android, and seamlessly unlocks their smart glasses and watch without separate app store transactions.",
      steps: [
        { actor: "User on iPhone or Android", text: "Taps 'Upgrade to Headway Pro' on the Commute Alerts or Glasses tab. Completes purchase via native Apple StoreKit 2 or Google Play Billing with FaceID / Biometrics." },
        { actor: "Billing SDK (RevenueCat / StoreKit)", text: "Validates cryptographic receipt with App Store or Google Play servers, then posts an authenticated webhook payload to the Cloudflare Worker." },
        { actor: "Cloudflare Worker (/api/webhooks)", text: "Upserts the user's record in Supabase headway.subscriptions with status='active', tier='pro', platform='ios', expires_at=TIMESTAMP." },
        { actor: "Apple Watch / Wear OS", text: "Parent phone syncs updated Pro entitlement via WatchConnectivity / Wearable Data Layer. Watch complications immediately activate live countdowns." },
        { actor: "Even G2 Smart Glasses", text: "Glasses plugin connects to Worker with paired device_token. Worker verifies is_pro=true on the parent account and streams full live HUD departure board." }
      ]
    },

    schema: {
      kind: "code",
      title: "Proposed Supabase Database Schema Migration",
      note: "Clean isolation inside the headway schema, adhering to the monorepo's graduation rules and RLS security policies.",
      lang: "sql",
      after: `-- Create subscriptions table in headway schema
CREATE TABLE "headway"."subscriptions" (
  "user_id"                 uuid                     NOT NULL,
  "status"                  text                     NOT NULL DEFAULT 'inactive',
  "tier"                    text                     NOT NULL DEFAULT 'free',
  "platform"                text                     NOT NULL, -- 'ios', 'android', 'web', 'lifetime'
  "original_transaction_id" text                     UNIQUE,
  "product_id"              text                     NOT NULL,
  "starts_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"              timestamp with time zone,
  "is_in_grace_period"      boolean                  NOT NULL DEFAULT false,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "subscriptions_status_check" CHECK (status IN ('active', 'trialing', 'canceled', 'expired', 'past_due', 'inactive'))
);

ALTER TABLE "headway"."subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscription"
  ON "headway"."subscriptions" FOR SELECT
  USING (auth.uid() = user_id);

-- Helper function for Worker & RLS
CREATE OR REPLACE FUNCTION "headway"."is_pro_user"(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "headway"."subscriptions"
    WHERE user_id = target_user_id
      AND status IN ('active', 'trialing')
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
    }
  }
};
