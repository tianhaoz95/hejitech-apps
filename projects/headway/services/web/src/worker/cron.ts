// The every-minute cron: refresh the realtime snapshot, then run the alert engine for everyone with
// an iPhone registered for alerts, push what's due, and record it so it's never sent twice.
import { dueNotifications, normalizeSettings, type Tracked } from "@headway/core";
import { sendPush, pushConfigured } from "./push.ts";
import { refreshRealtime } from "./realtime.ts";
import { admin, saveTracked, type Env } from "./store.ts";

/** Sent-notification keys are kept this long (service alert ids repeat while an alert lasts). */
const SENT_RETENTION_DAYS = 14;

export interface CronReport {
  live: boolean;
  users: number;
  sent: number;
  failed: number;
}

export async function runCron(env: Env, now = new Date()): Promise<CronReport> {
  const db = admin(env);
  const snapshot = await refreshRealtime(env, db, now).catch((e: Error) => (console.error("realtime refresh failed:", e.message), null));
  const report: CronReport = { live: Boolean(snapshot && now.getTime() - snapshot.fetched_at < 10 * 60_000), users: 0, sent: 0, failed: 0 };
  if (!pushConfigured(env)) return report;

  const { data: devices } = await db.from("push_devices").select("id, user_id, apns_token, environment");
  if (!devices?.length) return report;
  const users = [...new Set(devices.map((d) => d.user_id as string))];
  const since = new Date(now.getTime() - SENT_RETENTION_DAYS * 86400_000).toISOString();
  const [{ data: profiles }, { data: tracked }, { data: sent }] = await Promise.all([
    db.from("profiles").select("user_id, settings").in("user_id", users),
    db.from("tracked_trips").select("user_id, trip_id, service_date, from_station, to_station").in("user_id", users),
    db.from("sent_notifications").select("user_id, key").in("user_id", users).gte("sent_at", since),
  ]);
  report.users = users.length;

  for (const userId of users) {
    const settings = normalizeSettings(profiles?.find((p) => p.user_id === userId)?.settings);
    const t = tracked?.find((x) => x.user_id === userId);
    const trackedTrip: Tracked | null = t ? { trip_id: t.trip_id, service_date: t.service_date, from: t.from_station, to: t.to_station } : null;
    const keys = new Set((sent ?? []).filter((s) => s.user_id === userId).map((s) => s.key as string));
    const { notifications, trackingDone } = dueNotifications({ now: now.getTime(), settings, snapshot, tracked: trackedTrip, sent: keys });
    if (trackingDone && trackedTrip) await saveTracked(db, userId, null);
    if (!notifications.length) continue;
    // Record first: a crash after sending must not repeat the notification every minute.
    await db.from("sent_notifications").upsert(notifications.map((n) => ({ user_id: userId, key: n.key, sent_at: now.toISOString() })), { ignoreDuplicates: true });
    for (const d of devices.filter((x) => x.user_id === userId)) {
      for (const n of notifications) {
        const r = await sendPush(env, d, n);
        if (r.ok) report.sent++;
        else {
          report.failed++;
          console.error(`push ${n.kind} to device ${d.id} failed: ${r.reason}`);
          if (r.gone) {
            await db.from("push_devices").delete().eq("id", d.id);
            break;
          }
        }
      }
    }
  }
  // Housekeeping once an hour.
  if (now.getUTCMinutes() === 7) {
    await db.from("sent_notifications").delete().lt("sent_at", since);
    await db.from("pairing_codes").delete().lt("expires_at", new Date(now.getTime() - 86400_000).toISOString());
  }
  return report;
}
