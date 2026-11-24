// Daily contemporaneity nudge cron: warns hosts before unconfirmed drafts cross the IRS 14-day
// contemporaneity threshold, and reminds them to tighten vague descriptions while the work is fresh.
import { pushConfigured, sendAlertPush, type AlertPayload, type PushDevice } from "./push.ts";
import { admin, type Db, type Env } from "./store.ts";

export interface NudgeSummary {
  usersChecked: number;
  nudgesSent: number;
  staleDevicesRemoved: number;
}

interface PendingRow {
  user_id: string;
  status: string;
  is_vague: boolean;
  activity_date: string;
}

/** ISO week key (YYYY-Www) so a user receives at most one nudge of each kind per week. */
export function isoWeekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Compute the nudge (if any) for a user's recent entries. Pure so unit tests can verify directly. */
export function evaluateNudge(rows: PendingRow[], now = new Date()): { key: string; alert: AlertPayload } | null {
  const nowMs = now.getTime();
  const week = isoWeekKey(now);

  let approachingCliff = 0;
  let vagueRecent = 0;
  for (const r of rows) {
    const ageDays = Math.floor((nowMs - Date.parse(r.activity_date)) / 86400000);
    if (r.status === "pending_review" && ageDays >= 7 && ageDays <= 13) approachingCliff++;
    if (r.status === "confirmed" && r.is_vague && ageDays >= 0 && ageDays <= 13) vagueRecent++;
  }

  if (approachingCliff > 0) {
    return {
      key: `contempo:draft_cliff:${week}`,
      alert: {
        kind: "draft_cliff",
        title: "Confirm drafts before the 14-day IRS window",
        body:
          approachingCliff === 1
            ? "You have 1 unconfirmed entry approaching 14 days old. Confirm it now to keep your log contemporaneous."
            : `You have ${approachingCliff} unconfirmed entries approaching 14 days old. Confirm them now to keep your log contemporaneous.`,
      },
    };
  }
  if (vagueRecent > 0) {
    return {
      key: `contempo:vague_detail:${week}`,
      alert: {
        kind: "vague_detail",
        title: "Strengthen short audit entries",
        body:
          vagueRecent === 1
            ? "1 recent entry is flagged as short or generic. Add one concrete detail while it's fresh."
            : `${vagueRecent} recent entries are flagged as short or generic. Add a concrete detail while it's fresh.`,
      },
    };
  }
  return null;
}

export async function runContemporaneityNudges(env: Env, now = new Date()): Promise<NudgeSummary> {
  const out: NudgeSummary = { usersChecked: 0, nudgesSent: 0, staleDevicesRemoved: 0 };
  if (!pushConfigured(env)) return out;

  const db = admin(env);
  const { data: devices } = await db
    .from("push_devices")
    .select("id, user_id, apns_token, fcm_token, environment");
  const allDevices = (devices ?? []) as (PushDevice & { id: string; user_id: string })[];
  if (allDevices.length === 0) return out;

  const byUser = new Map<string, (PushDevice & { id: string; user_id: string })[]>();
  for (const d of allDevices) {
    const list = byUser.get(d.user_id) ?? [];
    list.push(d);
    byUser.set(d.user_id, list);
  }

  const cutoffIso = new Date(now.getTime() - 15 * 86400000).toISOString();
  for (const [userId, userDevices] of byUser) {
    out.usersChecked++;
    const { data: entries } = await db
      .from("entries")
      .select("user_id, status, is_vague, activity_date")
      .eq("user_id", userId)
      .gte("activity_date", cutoffIso);

    const nudge = evaluateNudge((entries ?? []) as PendingRow[], now);
    if (!nudge) continue;

    // Dedupe via sent_notifications.
    const { data: existing } = await db
      .from("sent_notifications")
      .select("key")
      .eq("user_id", userId)
      .eq("key", nudge.key)
      .maybeSingle();
    if (existing) continue;

    let anySent = false;
    for (const dev of userDevices) {
      const res = await sendAlertPush(env, dev, nudge.alert);
      if (res.ok) anySent = true;
      else if (res.gone) {
        await db.from("push_devices").delete().eq("id", dev.id);
        out.staleDevicesRemoved++;
      }
    }
    if (anySent) {
      await db.from("sent_notifications").upsert({ user_id: userId, key: nudge.key, sent_at: now.toISOString() });
      out.nudgesSent++;
    }
  }

  await pruneOldNotifications(db, now);
  return out;
}

async function pruneOldNotifications(db: Db, now: Date): Promise<void> {
  const oldIso = new Date(now.getTime() - 45 * 86400000).toISOString();
  await db.from("sent_notifications").delete().lt("sent_at", oldIso);
}
