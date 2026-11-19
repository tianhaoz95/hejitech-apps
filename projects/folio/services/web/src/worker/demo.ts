// The App Review demo account's starting point (review.ts resets it on every sign-in): two artifacts
// that different agents worked on, an open suggestion with a comment on it, and history to compare,
// so every screen of the iPhone app shows something. Seeded through the service layer, so the data
// is valid by construction.
import { addComment, agentActor, createArtifact, deleteAccountData, editArtifact, suggestEdit } from "./service.ts";
import type { Db } from "./store.ts";

const TRIP = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Big Sur weekend</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <p class="kicker">Trip plan</p>
    <h1>Big Sur weekend</h1>
    <p class="lede">Two days down Highway 1, leaving Saturday at 8 am.</p>
  </header>
  <section>
    <h2>Saturday</h2>
    <ul>
      <li><b>9:30</b> Coffee in Carmel</li>
      <li><b>11:00</b> Point Lobos loop (3 miles)</li>
      <li><b>14:00</b> Bixby Bridge viewpoint</li>
      <li><b>16:00</b> Check in near Pfeiffer Big Sur</li>
    </ul>
  </section>
  <section>
    <h2>Sunday</h2>
    <ul>
      <li><b>8:00</b> McWay Falls</li>
      <li><b>12:00</b> Lunch at Nepenthe</li>
      <li><b>15:00</b> Drive home</li>
    </ul>
  </section>
</body>
</html>
`;

const TRIP_CSS = `:root { color-scheme: light dark; --accent: #c2410c; }
body { font: 17px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 0 auto; padding: 1.5rem; }
.kicker { color: var(--accent); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; font-size: .8rem; margin: 0; }
h1 { margin: .2rem 0; font-size: 2rem; }
.lede { opacity: .75; }
h2 { border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); padding-top: 1rem; }
ul { padding-left: 1.1rem; }
li { margin: .35rem 0; }
`;

const DESKS = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Standing desks under $600</title>
  <style>
    :root { color-scheme: light dark; }
    body { font: 16px/1.45 system-ui, sans-serif; margin: 0; padding: 1.25rem; }
    h1 { font-size: 1.6rem; margin: 0 0 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .55rem .4rem; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
    th { font-size: .8rem; text-transform: uppercase; letter-spacing: .04em; opacity: .7; }
    .pick { font-weight: 600; color: #15803d; }
  </style>
</head>
<body>
  <h1>Standing desks under $600</h1>
  <table>
    <thead><tr><th>Desk</th><th>Price</th><th>Height range</th><th>Motors</th></tr></thead>
    <tbody>
      <tr><td class="pick">Desk A (pick)</td><td>$549</td><td>25–50 in</td><td>2</td></tr>
      <tr><td>Desk B</td><td>$499</td><td>28–47 in</td><td>1</td></tr>
      <tr><td>Desk C</td><td>$589</td><td>24–50 in</td><td>2</td></tr>
    </tbody>
  </table>
  <p>Desk A wins on range and stability for the price.</p>
</body>
</html>
`;

/** Deletes everything Folio keeps for the account, then seeds the demo artifacts. */
export async function resetDemo(db: Db, userId: string): Promise<void> {
  await deleteAccountData(db, userId);
  const quiet = (a: ReturnType<typeof agentActor>) => ({ ...a, quiet: true });
  const claude = quiet(agentActor(userId, { declared: "Claude", model: "claude-opus-5-5" }));
  const gemini = quiet(agentActor(userId, { declared: "Gemini" }));
  const chatgpt = quiet(agentActor(userId, { declared: "ChatGPT" }));

  // Keep this short: a Worker invocation may make at most 50 subrequests, and this seeding (with
  // the account reset and sign-in around it) is about 45.
  await createArtifact(db, chatgpt, { title: "Standing desks under $600", description: "A comparison table for the home office.", files: [{ path: "index.html", content: DESKS }], message: "Compare three desks" });

  const trip = await createArtifact(db, claude, {
    title: "Big Sur weekend",
    description: "Two days down Highway 1.",
    files: [{ path: "index.html", content: TRIP }, { path: "style.css", content: TRIP_CSS }],
    message: "First plan",
  });
  const v2 = await editArtifact(db, gemini, trip.a.slug, {
    base_version: trip.version,
    ops: [{ op: "replace", path: "index.html", old: "<li><b>14:00</b> Bixby Bridge viewpoint</li>", new: "<li><b>13:30</b> Bixby Bridge viewpoint (pull-out on the north side)</li>" }],
    message: "Bixby earlier, before the crowds",
  });
  const s = await suggestEdit(db, gemini, trip.a.slug, {
    base_version: v2.version,
    title: "Add a packing list",
    rationale: "Fog is likely on Sunday morning, and there's no cell signal past Bixby.",
    ops: [
      {
        op: "replace",
        path: "index.html",
        old: "</section>\n</body>",
        new: "</section>\n  <section>\n    <h2>Pack</h2>\n    <ul>\n      <li>Layers for fog</li>\n      <li>Offline maps</li>\n      <li>Cash for parking</li>\n    </ul>\n  </section>\n</body>",
      },
    ],
  });
  await addComment(db, claude, trip.a.slug, { body: "Good idea. Add a headlamp for McWay at 8 am?", suggestion: s.suggestion.number });
}
