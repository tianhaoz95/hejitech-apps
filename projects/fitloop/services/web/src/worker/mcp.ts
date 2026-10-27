// MCP server (Streamable HTTP, JSON responses) at /mcp for the user's own agent (Claude, Meta Muse…).
// Authentication happens before this runs (index.ts): OAuth grants issued by this Worker, or
// personal access tokens `fla_…` made in the app. The agent is the user's coach: it reads what the
// user shares (settings decide), publishes plan versions and answers feedback.
import {
  addDays, adherence, checkPlan, dayState, errorsOf, GUIDE, GUIDE_VERSION, localDate, Navigator, normalizeSettings, PLAN_FORMAT_VERSION, WEEKDAYS,
  type DayPlan, type Plan, type World,
} from "@fitloop/core";
import { BUCKET, checkinsBetween, feedbackList, loadSettings, PHOTO_URL_TTL_SEC, planSpans, planVersions, published, saveSettings, type Db } from "./store.ts";
import { uploadExerciseGif } from "./exercise_media.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.1.0";
const MAX_RANGE_DAYS = 120;

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const RANGE = {
  from: { type: "string", description: "YYYY-MM-DD (default: 13 days before `to`)" },
  to: { type: "string", description: "YYYY-MM-DD (default: today in the user's time zone)" },
};
const PLAN = { type: "object", description: `The whole plan (format ${PLAN_FORMAT_VERSION}); get_plan_guide has the format.` };
const ro = (title: string) => ({ title, readOnlyHint: true, openWorldHint: false });
const rw = (title: string, idempotent = false) => ({ title, readOnlyHint: false, destructiveHint: false, idempotentHint: idempotent, openWorldHint: false });

export const TOOLS = [
  { name: "get_plan_guide", title: "Get the plan guide", description: "How FitLoop works with you (the coaching loop), the plan format and every rule validate_plan enforces. Fetch it at the start of every session.", inputSchema: { type: "object", properties: {} }, annotations: ro("Get the plan guide") },
  { name: "get_profile", title: "Get the user's profile", description: "What the user wants every agent to know (goals, restrictions, equipment, schedule, diet, notes), their units and time zone, today's date for them, and which data they share with you. If `about` fields are empty, interview the user (see get_plan_guide) and save their answers with update_profile_notes before building a plan.", inputSchema: { type: "object", properties: {} }, annotations: ro("Get the user's profile") },
  { name: "update_profile_notes", title: "Update the profile notes", description: "Save what you learned about the user from interviewing them or during coaching (only the fields you pass change), so the user sees it in FitLoop Settings and the next session starts from it. Tell the user what you saved.", inputSchema: { type: "object", properties: { goals: { type: "string" }, restrictions: { type: "string" }, equipment: { type: "string" }, schedule: { type: "string" }, diet: { type: "string" }, notes: { type: "string" } } }, annotations: rw("Update the profile notes", true) },
  { name: "get_current_plan", title: "Get the current plan", description: "The plan in force now: version, the whole plan, the change note and when it was published. Null before the first publish.", inputSchema: { type: "object", properties: {} }, annotations: ro("Get the current plan") },
  { name: "validate_plan", title: "Validate a plan", description: "Checks a plan against every rule (errors block publishing, warnings are advice) and renders what the glasses will show for the first workout of a sample day, so you can see it fits.", inputSchema: { type: "object", required: ["plan"], properties: { plan: PLAN } }, annotations: ro("Validate a plan") },
  { name: "publish_plan", title: "Publish a plan", description: "Publishes the plan as the next version; it governs from its starts_on (pass today's date to replace the current plan now). Refused while validate_plan finds errors. The change_note is shown to the user: say what changed and why, in plain words.", inputSchema: { type: "object", required: ["plan", "change_note"], properties: { plan: PLAN, change_note: { type: "string" } } }, annotations: rw("Publish a plan") },
  { name: "get_checkins", title: "Get check-ins", description: "What the user did: per set (reps, load, rpe, heart rate), exercise, workout and meal (eaten/skipped/swapped, portion), with notes. Needs the user's check-ins sharing switch.", inputSchema: { type: "object", properties: RANGE }, annotations: ro("Get check-ins") },
  { name: "get_progress", title: "Get progress", description: "Adherence per day (completion, workouts and meals done vs planned), averages and the workout streak over a range, across plan versions.", inputSchema: { type: "object", properties: RANGE }, annotations: ro("Get progress") },
  { name: "get_feedback", title: "Get feedback", description: "The user's notes to you, left in the moment (text + tags, the date and plan item). Read the open ones before changing the plan.", inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "addressed", "all"] } } }, annotations: ro("Get feedback") },
  { name: "respond_to_feedback", title: "Reply to feedback", description: "Your reply to one note (the user sees it next to their note). addressed=true (default) closes it.", inputSchema: { type: "object", required: ["id", "reply"], properties: { id: { type: "string" }, reply: { type: "string" }, addressed: { type: "boolean" } } }, annotations: rw("Reply to feedback", true) },
  { name: "get_vitals", title: "Get vitals", description: "Daily vitals the user shares (weight, resting heart rate, HRV, sleep, steps, active energy, energy/mood/soreness) from Apple Health, the Watch or typed in. Only metrics whose source is switched on, and only if vitals sharing is on.", inputSchema: { type: "object", properties: { ...RANGE, metrics: { type: "array", items: { type: "string" } } } }, annotations: ro("Get vitals") },
  { name: "list_photos", title: "List progress photos", description: "Progress photo dates and notes; with the user's photo-sharing switch on, also short-lived image links.", inputSchema: { type: "object", properties: RANGE }, annotations: ro("List progress photos") },
  { name: "get_weekly_review", title: "Get the weekly review", description: "One week at a glance for planning the next: adherence, open feedback, swaps and skips, vitals trend, the plan version. Defaults to the last 7 days.", inputSchema: { type: "object", properties: { week_start: { type: "string", description: "YYYY-MM-DD" } } }, annotations: ro("Get the weekly review") },
  {
    name: "upload_exercise_gif",
    title: "Upload exercise demonstration GIF",
    description: "Upload an exercise animation GIF to FitLoop's permanent hosted storage. Provide the exercise name or slug and either a public source URL (which FitLoop downloads and stores) or base64-encoded GIF data. Returns the permanent hosted gifUrl on FitLoop (https://fitloop.hejitech.workers.dev/api/exercises/<slug>.gif) to place in your plan's animation object.",
    inputSchema: {
      type: "object",
      required: ["exercise"],
      properties: {
        exercise: { type: "string", description: "Exercise name or slug (e.g. 'cat-cow', 'goblet-squat', 'bird-dog')" },
        source_url: { type: "string", description: "Public HTTPS URL to fetch the GIF from (FitLoop downloads and stores it)" },
        data_base64: { type: "string", description: "Base64-encoded GIF data (if you generated or have the raw bytes)" },
      },
    },
    annotations: rw("Upload exercise demonstration GIF"),
  },
];

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function range(args: Record<string, unknown>, todayStr: string): { from: string; to: string } {
  const to = isDate(args.to) ? args.to : todayStr;
  const from = isDate(args.from) ? args.from : addDays(to, -13);
  if (from > to) throw new Error("from must be on or before to");
  if (Date.parse(to) - Date.parse(from) > MAX_RANGE_DAYS * 86400_000) throw new Error(`at most ${MAX_RANGE_DAYS} days at a time`);
  return { from, to };
}

/** What the glasses would show when the first workout of a sample day is opened. */
function preview(plan: Plan): { day: string; lines: string[] } | null {
  for (const d of WEEKDAYS) {
    const day: DayPlan | undefined = plan.week?.[d];
    if (!day?.workouts?.length) continue;
    const date = plan.starts_on;
    const synthetic: Plan = { ...plan, overrides: { ...(plan.overrides ?? {}), [date]: day } };
    const world: World = { date, now: Date.now(), day: dayState(synthetic, date, []), planVersion: null, hr: 128, showHr: true, autoRest: true };
    const nav = new Navigator();
    const today = nav.lines(world);
    nav.openWorkout(world, day.workouts[0].id);
    return { day: d, lines: [...today, "----", ...nav.lines(world)] };
  }
  return null;
}

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, db: Db, publicUrl = "https://fitloop.hejitech.workers.dev"): Promise<unknown> {
  const userId = caller.userId;
  const { settings } = await loadSettings(db, userId);
  const todayStr = localDate(Date.now(), settings.timezone);
  switch (name) {
    case "get_plan_guide":
      return { guide_version: GUIDE_VERSION, plan_format: PLAN_FORMAT_VERSION, guide: GUIDE };
    case "get_profile":
      return {
        today: todayStr, timezone: settings.timezone, units: settings.units, about: settings.about,
        shared_with_you: {
          checkins: settings.agent_access.checkins, feedback: settings.agent_access.feedback,
          vitals: settings.agent_access.vitals ? Object.entries(settings.vitals).filter(([k, on]) => on && k !== "photos").map(([k]) => k) : [],
          photos: settings.vitals.photos && settings.agent_access.photos ? "images" : settings.vitals.photos ? "dates only" : "off",
        },
      };
    case "update_profile_notes": {
      const about = { ...settings.about };
      for (const k of Object.keys(about) as (keyof typeof about)[]) {
        if (args[k] === undefined) continue;
        if (typeof args[k] !== "string" || (args[k] as string).length > 2000) throw new Error(`${k} must be text up to 2000 characters`);
        about[k] = args[k] as string;
      }
      await saveSettings(db, userId, normalizeSettings({ ...settings, about }));
      return { saved: true, about };
    }
    case "get_current_plan": {
      const rows = await planVersions(db, userId, 30);
      const current = rows.find((r) => r.starts_on <= todayStr) ?? rows[0];
      const upcoming = rows.filter((r) => r.starts_on > todayStr).map((r) => ({ version: r.version, starts_on: r.starts_on }));
      return { current: current ? published(current) : null, upcoming };
    }
    case "validate_plan": {
      const issues = checkPlan(args.plan);
      const errors = errorsOf(issues);
      return { ok: errors.length === 0, errors, warnings: issues.filter((i) => i.severity === "warning"), glasses_preview: errors.length ? null : preview(args.plan as Plan) };
    }
    case "publish_plan": {
      const errors = errorsOf(checkPlan(args.plan));
      if (errors.length) return { published: false, errors, hint: "fix the errors (validate_plan) and publish again" };
      const note = String(args.change_note ?? "").trim();
      if (!note) throw new Error("change_note: tell the user what changed and why");
      const plan = args.plan as Plan;
      const { data, error } = await db.rpc("publish_plan", { p_user: userId, p_plan: plan, p_change_note: note.slice(0, 2000), p_starts_on: plan.starts_on, p_by: caller.via === "oauth" ? "agent" : "agent-token" });
      if (error) throw new Error(`couldn't publish: ${error.message}`);
      return { published: true, version: data, starts_on: plan.starts_on, in_force_today: plan.starts_on <= todayStr };
    }
    case "get_checkins": {
      if (!settings.agent_access.checkins) throw new Error("the user hasn't shared check-ins with agents (FitLoop Settings → Agent access)");
      const r = range(args, todayStr);
      return { ...r, checkins: await checkinsBetween(db, userId, r.from, r.to) };
    }
    case "get_progress": {
      const r = range(args, todayStr);
      const [rows, checkins] = await Promise.all([planVersions(db, userId, 200), checkinsBetween(db, userId, r.from, r.to)]);
      return adherence(planSpans(rows), settings.agent_access.checkins ? checkins : [], r.from, r.to);
    }
    case "get_feedback": {
      if (!settings.agent_access.feedback) throw new Error("the user hasn't shared feedback with agents");
      const status = args.status === "addressed" || args.status === "all" ? args.status : "open";
      return { feedback: await feedbackList(db, userId, status) };
    }
    case "respond_to_feedback": {
      if (!settings.agent_access.feedback) throw new Error("the user hasn't shared feedback with agents");
      const reply = String(args.reply ?? "").trim();
      if (!reply) throw new Error("reply is required");
      const addressed = args.addressed !== false;
      const { data, error } = await db.from("feedback").update({ agent_reply: reply.slice(0, 2000), status: addressed ? "addressed" : "open", addressed_at: addressed ? new Date().toISOString() : null })
        .eq("user_id", userId).eq("id", String(args.id ?? "")).select("id");
      if (error || !data?.length) throw new Error("no such feedback");
      return { ok: true, id: data[0].id, status: addressed ? "addressed" : "open" };
    }
    case "get_vitals": {
      if (!settings.agent_access.vitals) throw new Error("the user hasn't shared vitals with agents");
      const r = range(args, todayStr);
      const sources = [settings.vitals.health_daily && "health", settings.vitals.manual && "manual", settings.vitals.live_hr && "watch"].filter(Boolean) as string[];
      let q = db.from("vitals").select("date, metric, value, source").eq("user_id", userId).gte("date", r.from).lte("date", r.to).in("source", sources).order("date");
      if (Array.isArray(args.metrics) && args.metrics.length) q = q.in("metric", args.metrics.map(String));
      const { data } = await q;
      return { ...r, entries: data ?? [] };
    }
    case "list_photos": {
      if (!settings.vitals.photos) return { photos: [], note: "progress photos are switched off" };
      const r = range(args, todayStr);
      const { data } = await db.from("photos").select("id, taken_on, path, note").eq("user_id", userId).gte("taken_on", r.from).lte("taken_on", r.to).order("taken_on");
      const rows = data ?? [];
      const urls = settings.agent_access.photos && rows.length ? (await db.storage.from(BUCKET).createSignedUrls(rows.map((x) => x.path), PHOTO_URL_TTL_SEC)).data ?? [] : [];
      return { ...r, photos: rows.map((x, i) => ({ id: x.id, taken_on: x.taken_on, note: x.note, url: urls[i]?.signedUrl })) };
    }
    case "get_weekly_review": {
      const from = isDate(args.week_start) ? args.week_start : addDays(todayStr, -6);
      const to = addDays(from, 6);
      const [rows, checkins, feedback, vitals] = await Promise.all([
        planVersions(db, userId, 200), checkinsBetween(db, userId, from, to), feedbackList(db, userId, "open"),
        db.from("vitals").select("date, metric, value, source").eq("user_id", userId).gte("date", addDays(from, -7)).lte("date", to).order("date"),
      ]);
      const shared = settings.agent_access.checkins ? checkins : [];
      const weights = (vitals.data ?? []).filter((v) => v.metric === "weight");
      return {
        from, to, plan_version: rows.find((r) => r.starts_on <= to)?.version ?? null,
        adherence: adherence(planSpans(rows), shared, from, to),
        changes_made_by_user: shared.filter((c) => c.status === "swapped" || c.status === "skipped" || c.data?.moved_to).map((c) => ({ date: c.date, ref: c.ref, status: c.status, data: c.data, note: c.note })),
        open_feedback: settings.agent_access.feedback ? feedback : "not shared",
        weight: settings.agent_access.vitals && weights.length >= 2 ? { first: weights[0], last: weights.at(-1), change: Number(weights.at(-1)!.value) - Number(weights[0].value) } : null,
      };
    }
    case "upload_exercise_gif": {
      const exercise = String(args.exercise ?? "");
      const sourceUrl = typeof args.source_url === "string" ? args.source_url : undefined;
      const dataBase64 = typeof args.data_base64 === "string" ? args.data_base64 : undefined;
      return uploadExerciseGif(db, publicUrl, exercise, { sourceUrl, dataBase64 });
    }
  }
  throw new Error(`unknown tool ${name}`);
}

export async function handleMcp(req: Request, caller: Caller, db: Db, publicUrl = "https://fitloop.hejitech.workers.dev"): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return json({ name: "fitloop-mcp", transport: "streamable-http" });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id ?? null, result });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "fitloop", version: SERVER_VERSION },
        instructions: "You are the user's fitness and nutrition coach; FitLoop is where your plan lives while they follow it (iPhone, Apple Watch, web, Even G2 glasses). Start with get_plan_guide and get_profile; if the user's profile notes (goals, restrictions, equipment, schedule, diet) are empty, interview them in 1–2 short rounds and save their answers with update_profile_notes before writing a plan. Read open feedback and progress before changing anything, validate_plan until it's clean, publish_plan with a plain change note, then reply to the feedback you acted on.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, caller, db, publicUrl);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}
