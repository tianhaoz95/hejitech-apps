// Demo data for the store videos, shared by the iPhone takes (app-preview-record.mjs) and the Android takes
// (play-video-record.mjs). LOCAL stack only (Supabase 127.0.0.1:55421, Headway Worker 8792, FitLoop 8794).
//
// Headway: a Monday 7:29 demo clock, the seed rider's commute (Mountain View → San Francisco), a demo family
// group ("The Parks": Sam riding, Riley running late) and one staged 6-minute delay on the first train the
// rider can still make. FitLoop: the seed athlete's plan on 2026-11-12 (a workout day) with an agent reply on
// the seeded knee note. All of it is demo data.
import { REPO, sh, sleep } from "./demo-record-lib.mjs";

export const supabase = "http://127.0.0.1:55421";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
export const SERVICE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB = "supabase_db_waypack";
export const sql = (q) => sh("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-At"], { input: q });

export async function signIn(email, password, create = true) {
  const r = await fetch(`${supabase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (r.ok) return (await r.json()).access_token;
  if (!create) throw new Error(`sign-in ${email}`);
  await fetch(`${supabase}/auth/v1/admin/users`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
  return signIn(email, password, false);
}
export const call = (site) => async (path, { method = "GET", auth, body } = {}) => {
  const r = await fetch(site + path, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) console.warn("!!", method, path, r.status, t.slice(0, 160));
  try { return JSON.parse(t); } catch { return null; }
};

export const HEADWAY_AT = "2026-11-09T07:29:00-08:00";
export const headwayApi = call("http://127.0.0.1:8792");

// Returns the delayed train `t` (from the board), its kind's name and the rider's token.
export async function stageHeadway() {
  const api = headwayApi, AT = HEADWAY_AT;
  await api("/api/dev/clock", { method: "PUT", body: { at: AT } });
  const me = await signIn("rider@example.com", "headway-dev");
  const sam = await signIn("sam.store@example.com", "demo-pass-123");
  const riley = await signIn("riley.store@example.com", "demo-pass-123");
  const fam = (auth, p = "", o = {}) => api(`/api/family${p}`, { auth, ...o });
  for (const a of [sam, riley, me]) { await api("/api/track", { method: "DELETE", auth: a }); if ((await fam(a))?.group) await fam(a, "", { method: "DELETE" }); }
  await fam(me, "", { method: "POST", body: { name: "The Parks", display_name: "Jordan" } });
  for (const [a, mail, name] of [[sam, "sam.store@example.com", "Sam"], [riley, "riley.store@example.com", "Riley"]]) {
    await fam(me, "/invites", { method: "POST", body: { email: mail } });
    const inv = (await fam(a)).invites[0];
    await api(`/api/family/invites/${inv.id}/accept`, { method: "POST", auth: a, body: { display_name: name } });
    await fam(a, "/me", { method: "PUT", body: { display_name: name } });
  }
  const g = (await fam(me)).group;
  const id = (n) => g.members.find((m) => m.display_name === n)?.user_id, meId = g.members.find((m) => m.me).user_id;
  const pa = (await api("/api/board?from=palo_alto&to=san_francisco")).trains[0];
  await api("/api/track", { method: "POST", auth: sam, body: { trip_id: pa.trip_id, service_date: pa.service_date, from: "palo_alto", to: "san_francisco" } });
  await fam(sam, "/me", { method: "PUT", body: { shares: { trip: [meId], commute: [meId] } } });
  await fam(riley, "/status", { method: "PUT", body: { code: "running_late", minutes: 30 } });
  await fam(riley, "/me", { method: "PUT", body: { shares: { status: [meId] } } });
  await fam(me, "/me", { method: "PUT", body: { shares: { trip: [id("Sam"), id("Riley")] }, follows: { [id("Sam")]: { notify: ["trip"], live: true }, [id("Riley")]: { notify: ["status"], live: false } } } });
  // One live delay on the first train the rider can still make (the board's "late" state and the alert).
  const now = Date.parse(AT);
  const board = await api("/api/board?from=mountain_view&to=san_francisco");
  const t = board.trains.find((x) => x.dep - 10 * 60_000 > now + 60_000);
  const stations = (await import(`${REPO}/projects/headway/packages/core/src/timetable.gen.json`, { with: { type: "json" } })).default.stations;
  const stops = Object.fromEntries(stations.flatMap((s) => [[s.nb, { delay: 360 }], [s.sb, { delay: 360 }]]));
  const r = await fetch(`${supabase}/rest/v1/realtime?on_conflict=id`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", "Content-Profile": "headway", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: 1, fetched_at: new Date(now).toISOString(), snapshot: { fetched_at: now, feed_ts: Math.floor(now / 1000), alerts: [], trips: { [t.trip_id]: { start_date: t.service_date, stops } } }, error: null }) });
  if (!r.ok) throw new Error(`snapshot ${r.status}`);
  sql(`delete from headway.sent_notifications; delete from headway.eta_shares; delete from headway.activity_tokens;`);
  await sleep(21_000); // the Worker caches the snapshot for 20 s
  const kind = { LOC: "Local", LTD: "Limited", EXP: "Express", SCC: "South County" }[t.kind] ?? "Train";
  console.log(`staged: ${kind} ${t.train} 6 min late; Sam on ${pa.train}`);
  // The alert engine's wording for the delay.
  const newDep = new Date(t.dep + 360_000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(/\s?[AP]M$/, "");
  return { t, kind, me, late: { title: `${kind} ${t.train} is 6 min late`, body: `It now leaves Mountain View at ${newDep}.` } };
}

export const FITLOOP_DAY = "2026-11-12";
export const FITLOOP_ATHLETE = "00000000-0000-4000-8000-0000000f1700";
export function stageFitloop() {
  sql(`delete from fitloop.checkins where user_id='${FITLOOP_ATHLETE}' and date='${FITLOOP_DAY}';`);
  // The agent's reply to the seeded knee note, as an agent would leave it over MCP (demo text).
  sql(`update fitloop.feedback set agent_reply='Thanks for flagging it. I swapped step-ups for glute bridges and kept the depth shallow on goblet squats. Tell me how the knee feels on Saturday.', addressed_at=now() where user_id='${FITLOOP_ATHLETE}' and agent_reply is null;`);
}
export const unstageFitloop = () => sql(`delete from fitloop.checkins where user_id='${FITLOOP_ATHLETE}' and date='${FITLOOP_DAY}';`);

export async function restore() {
  await headwayApi("/api/dev/clock", { method: "PUT", body: { at: null } });
  console.log("Headway's demo clock is back to real time");
}
