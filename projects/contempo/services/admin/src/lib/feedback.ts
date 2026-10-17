import { supabase } from "./supabase";

export type FeedbackStatus = "pending" | "triaged" | "resolved";

export interface FeedbackRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AppFeedbackReport {
  id: string;
  uid: string;
  docPath: string;
  description: string;
  screenshotPath: string;
  screenshotUrl: string | null;
  region: FeedbackRegion | null;
  appVersion: string;
  buildNumber: string;
  osVersion: string;
  deviceModel: string;
  screenName: string;
  locale: string;
  status: FeedbackStatus;
  createdAt: Date;
}

export interface AnonymousFeedback {
  id: string;
  message: string;
  email: string | null;
  createdAt: Date;
}

/**
 * Retries once on `permission-denied` after a short delay. Unlike callable
 * Cloud Functions (which fetch a fresh ID token right before every call),
 * Firestore's SDK maintains a persistent connection that re-authenticates
 * asynchronously after a token refresh — AuthContext.tsx force-refreshes
 * the token to read the admin claim right before this page mounts, and if
 * the very first query fires before Firestore's connection has caught up
 * to that refreshed token, it can get rejected even though the token is
 * valid a moment later. Confirmed live: a fresh admin sign-in hit "Missing
 * or insufficient permissions" on this exact query shape once, immediately
 * followed by it working — this closes that race instead of surfacing it
 * as an error to the admin.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAppFeedbackReport(d: any): AppFeedbackReport {
  return {
    id: d.id,
    uid: d.user_id,
    docPath: d.id,
    description: d.description ?? "",
    screenshotPath: d.screenshot_path ?? "",
    screenshotUrl: d.download_url ?? null,
    region: d.region ?? null,
    appVersion: d.app_version ?? "",
    buildNumber: d.build_number ?? "",
    osVersion: d.os_version ?? "",
    deviceModel: d.device_model ?? "",
    screenName: d.screen_name ?? "",
    locale: d.locale ?? "",
    status: (d.status as FeedbackStatus) ?? "pending",
    createdAt: new Date(d.created_at),
  };
}

/** Shake-to-report across every user (admins only, by RLS), newest first, with signed screenshot URLs. */
export async function listAppFeedback(status: FeedbackStatus | "all", max = 100): Promise<AppFeedbackReport[]> {
  let q = supabase.from("app_feedback").select("*").order("created_at", { ascending: false }).limit(max);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  const reports = (data ?? []).map(toAppFeedbackReport);
  await Promise.all(
    reports.map(async (report) => {
      if (!report.screenshotPath) return;
      const { data: signed } = await supabase.storage.from("contempo").createSignedUrl(report.screenshotPath, 3600);
      if (signed?.signedUrl) report.screenshotUrl = signed.signedUrl;
    }),
  );
  return reports;
}

/** `docPath` is the report id (kept for the pages' existing call sites). */
export async function markAppFeedback(docPath: string, status: "triaged" | "resolved"): Promise<void> {
  const field = status === "triaged" ? "triaged_at" : "resolved_at";
  const { error } = await supabase.from("app_feedback").update({ status, [field]: new Date().toISOString() }).eq("id", docPath);
  if (error) throw error;
}

export async function listAnonymousFeedback(max = 100): Promise<AnonymousFeedback[]> {
  const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false }).limit(max);
  if (error) throw error;
  return (data ?? []).map((d) => ({ id: d.id, message: d.message ?? "", email: d.email ?? null, createdAt: new Date(d.created_at) }));
}
