// The every-minute cron: refresh the realtime snapshot, then run the alert engine for everyone with
// an iPhone registered for alerts, push what's due, and record it so it's never sent twice.
import { board, boardActivityState, dueNotifications, normalizeSettings, progress, type RealtimeSnapshot, type Tracked } from "@headway/core";
import { BOARD_ACTIVITY_PREFIX, NOT_BOARD_ACTIVITY, sendPush, sendLiveActivityPush, pushConfigured, type LiveActivityContentState } from "./push.ts";
import { refreshRealtime } from "./realtime.ts";
import { admin, saveTracked, type Env } from "./store.ts";

/** Sent-notification keys are kept this long (service alert ids repeat while an alert lasts). */
const SENT_RETENTION_DAYS = 14;
/** A board Live Activity is ended after this long (ActivityKit's own limit is 8 hours). */
const BOARD_ACTIVITY_MAX_MS = 3 * 3600_000;

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
  await pushBoardActivities(env, db, snapshot, now, report);

  const { data: devices } = await db.from("push_devices").select("id, user_id, apns_token, environment");
  if (!devices?.length) return report;
  const users = [...new Set(devices.map((d) => d.user_id as string))];
  const since = new Date(now.getTime() - SENT_RETENTION_DAYS * 86400_000).toISOString();
  const dayAgo = new Date(now.getTime() - 86400_000).toISOString();
  await db.from("eta_shares").delete().lt("expires_at", dayAgo);
  const [{ data: profiles }, { data: tracked }, { data: sent }, { data: actTokens }] = await Promise.all([
    db.from("profiles").select("user_id, settings").in("user_id", users),
    db.from("tracked_trips").select("user_id, trip_id, service_date, from_station, to_station").in("user_id", users),
    db.from("sent_notifications").select("user_id, key").in("user_id", users).gte("sent_at", since),
    db.from("activity_tokens").select("user_id, kind, token, trip_id, environment").in("user_id", users),
  ]);
  report.users = users.length;

  for (const userId of users) {
    const settings = normalizeSettings(profiles?.find((p) => p.user_id === userId)?.settings);
    const t = tracked?.find((x) => x.user_id === userId);
    const trackedTrip: Tracked | null = t ? { trip_id: t.trip_id, service_date: t.service_date, from: t.from_station, to: t.to_station } : null;
    const keys = new Set((sent ?? []).filter((s) => s.user_id === userId).map((s) => s.key as string));
    const { notifications, trackingDone } = dueNotifications({ now: now.getTime(), settings, snapshot, tracked: trackedTrip, sent: keys });
    if (trackingDone && trackedTrip) {
      await saveTracked(db, userId, null);
      await db.from("activity_tokens").delete().eq("user_id", userId).eq("kind", "update").or(NOT_BOARD_ACTIVITY);
    }
    if (notifications.length) {
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

    // Live Activity updates
    if (trackedTrip) {
      const p = progress(trackedTrip, now.getTime(), snapshot);
      if (p) {
        const contentState: LiveActivityContentState = {
          pred_arr: p.pred_arr,
          delay_min: p.delay_min,
          next: p.next ? p.next.name : null,
          next_pred: p.next ? p.next.pred : null,
          stops_left: p.stops_left,
          cancelled: p.cancelled,
          arrived: p.arrived,
        };
        const userTokens = (actTokens ?? []).filter((x) => x.user_id === userId);
        const updateTokens = userTokens.filter((x) => x.kind === "update" && (!x.trip_id || x.trip_id === trackedTrip.trip_id) && !String(x.trip_id ?? "").startsWith(BOARD_ACTIVITY_PREFIX));

        if (updateTokens.length > 0) {
          for (const tok of updateTokens) {
            const isEnd = p.arrived || p.cancelled;
            const r = await sendLiveActivityPush(env, { token: tok.token, environment: tok.environment }, {
              event: isEnd ? "end" : "update",
              dismissalDate: isEnd ? Math.floor(now.getTime() / 1000) + 900 : undefined,
              contentState,
            });
            if (r.ok) report.sent++;
            else {
              report.failed++;
              if (r.gone) await db.from("activity_tokens").delete().eq("token", tok.token);
            }
            if (isEnd) await db.from("activity_tokens").delete().eq("token", tok.token);
          }
        } else {
          // Push-to-start if the activity wasn't started on phone (e.g. tracked via glasses or MCP)
          const startToken = userTokens.find((x) => x.kind === "start");
          if (startToken && !p.arrived && !p.cancelled) {
            const r = await sendLiveActivityPush(env, { token: startToken.token, environment: startToken.environment }, {
              event: "start",
              attributes: {
                trip_id: p.trip_id,
                train: p.train,
                kind: p.kind,
                to: p.to.name,
              },
              contentState,
            });
            if (r.ok) report.sent++;
            else if (r.gone) await db.from("activity_tokens").delete().eq("token", startToken.token);
          }
        }
      }
    }
  }

  // Housekeeping once an hour.
  if (now.getUTCMinutes() === 7) {
    await db.from("sent_notifications").delete().lt("sent_at", since);
    await db.from("pairing_codes").delete().lt("expires_at", new Date(now.getTime() - 86400_000).toISOString());
    await db.from("activity_tokens").delete().lt("updated_at", new Date(now.getTime() - 86400_000).toISOString());
  }
  return report;
}

/** Every minute: push the next trains to each "next trains" Live Activity, ending it after three hours. */
async function pushBoardActivities(env: Env, db: ReturnType<typeof admin>, snapshot: RealtimeSnapshot | null, now: Date, report: CronReport): Promise<void> {
  const { data: tokens } = await db.from("activity_tokens").select("token, trip_id, environment, updated_at").eq("kind", "update").like("trip_id", `${BOARD_ACTIVITY_PREFIX}%`);
  for (const tok of tokens ?? []) {
    const [from, to] = String(tok.trip_id).slice(BOARD_ACTIVITY_PREFIX.length).split(">");
    const b = board(from, to, now.getTime(), snapshot);
    if (!b) {
      await db.from("activity_tokens").delete().eq("token", tok.token);
      continue;
    }
    const isEnd = now.getTime() - new Date(tok.updated_at).getTime() > BOARD_ACTIVITY_MAX_MS;
    const r = await sendLiveActivityPush(env, { token: tok.token, environment: tok.environment }, {
      event: isEnd ? "end" : "update",
      dismissalDate: isEnd ? Math.floor(now.getTime() / 1000) : undefined,
      contentState: boardActivityState(b, now.getTime()),
    });
    if (r.ok) report.sent++;
    else report.failed++;
    if (isEnd || (!r.ok && r.gone)) await db.from("activity_tokens").delete().eq("token", tok.token);
  }
}
