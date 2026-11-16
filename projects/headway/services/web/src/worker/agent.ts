// Assistants changing a rider's commute (MCP `update_commute`), only when the rider turned it on in
// the app (`headway.agent_access`, off by default; MCP can't reach the switch). Every change is kept
// with its before/after (`headway.agent_changes`), pushed to the rider's phones, and can be undone.
import { applyCommutePatch, diffHeadline, settingsDiff, type Notification, type Settings } from "@headway/core";
import { PUSH_DEVICE_COLUMNS, sendPush } from "./push.ts";
import { loadSettings, saveSettings, type Db, type Env } from "./store.ts";

/** How many recent changes the app lists. */
const CHANGES_LISTED = 10;

export interface AgentChange {
  id: string;
  client: string | null;
  summary: string[];
  created_at: string;
  undone_at: string | null;
}

export async function agentCanEdit(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from("agent_access").select("edit_settings").eq("user_id", userId).maybeSingle();
  return data?.edit_settings === true;
}

/** Only from the rider's own session (api.ts): never from MCP. */
export async function setAgentCanEdit(db: Db, userId: string, on: boolean): Promise<void> {
  const { error } = await db.from("agent_access").upsert({ user_id: userId, edit_settings: on, updated_at: new Date().toISOString() });
  if (error) throw new Error(`couldn't save: ${error.message}`);
}

export async function recentAgentChanges(db: Db, userId: string): Promise<AgentChange[]> {
  const { data } = await db.from("agent_changes").select("id, client, summary, created_at, undone_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(CHANGES_LISTED);
  return (data ?? []) as AgentChange[];
}

export type EditResult =
  | { ok: true; changes: string[]; settings: Settings; change_id: string | null }
  | { ok: false; status: number; error: string; issues?: { path: string; message: string }[] };

/** An assistant's change: checked, saved, recorded and announced on the rider's phones. */
export async function agentEditCommute(env: Env, db: Db, userId: string, client: string | null, patch: unknown): Promise<EditResult> {
  if (!(await agentCanEdit(db, userId))) {
    return { ok: false, status: 403, error: "The rider hasn't allowed assistants to change their Headway settings. They can turn on \"Let assistants change my commute\" in the Headway app under Settings › Assistants (or on the web settings page). Tell them that, and don't retry until they have." };
  }
  const { settings: before } = await loadSettings(db, userId);
  const r = applyCommutePatch(before, patch);
  if ("issues" in r) return { ok: false, status: 422, error: "Nothing was changed: " + r.issues.map((i) => `${i.path || "(patch)"} ${i.message}`).join("; "), issues: r.issues };
  const changes = settingsDiff(before, r.settings);
  if (!changes.length) return { ok: true, changes: [], settings: before, change_id: null };
  await saveSettings(db, userId, r.settings);
  const { data } = await db.from("agent_changes").insert({ user_id: userId, client, summary: changes, before, after: r.settings }).select("id").single();
  const id = (data?.id as string | undefined) ?? null;
  await announce(env, db, userId, client, changes, id).catch((e: Error) => console.error("agent change push failed:", e.message));
  return { ok: true, changes, settings: r.settings, change_id: id };
}

async function announce(env: Env, db: Db, userId: string, client: string | null, changes: string[], id: string | null) {
  const { data: devices } = await db.from("push_devices").select(`id, ${PUSH_DEVICE_COLUMNS}`).eq("user_id", userId);
  if (!devices?.length) return;
  const n: Notification = {
    key: `settings:${id ?? Date.now()}`,
    kind: "settings",
    priority: true,
    thread: "headway-settings",
    title: `${client ?? "Your assistant"} changed your commute`,
    body: `${diffHeadline(changes)}. Undo it in Settings › Assistants.`,
  };
  const results = await Promise.all(devices.map((d) => sendPush(env, d, n)));
  for (const [i, r] of results.entries()) if (!r.ok && r.reason !== "NotConfigured") console.error(`settings push to device ${devices[i].id} failed: ${r.reason}`);
}

/**
 * Puts the settings back to before an assistant's change. Refused when the settings changed since
 * (undoing then would also throw away the later change).
 */
export async function undoAgentChange(db: Db, userId: string, changeId: string): Promise<{ ok: true; settings: Settings } | { ok: false; status: number; error: string }> {
  const { data } = await db.from("agent_changes").select("before, after, undone_at").eq("id", changeId).eq("user_id", userId).maybeSingle();
  if (!data) return { ok: false, status: 404, error: "no such change" };
  if (data.undone_at) return { ok: false, status: 409, error: "already undone" };
  const { settings: current } = await loadSettings(db, userId);
  if (settingsDiff(current, data.after as Settings).length) {
    return { ok: false, status: 409, error: "Your settings changed after this, so it can't be undone on its own. Change them in Commute instead." };
  }
  await saveSettings(db, userId, data.before as Settings);
  await db.from("agent_changes").update({ undone_at: new Date().toISOString() }).eq("id", changeId);
  return { ok: true, settings: data.before as Settings };
}
