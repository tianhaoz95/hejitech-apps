import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "./firebase";

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
async function withPermissionRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "permission-denied") throw err;
    await new Promise((resolve) => setTimeout(resolve, 800));
    return fn();
  }
}

function toAppFeedbackReport(snap: QueryDocumentSnapshot<DocumentData>): AppFeedbackReport {
  const d = snap.data();
  // users/{uid}/appFeedback/{feedbackId}
  const uid = snap.ref.parent.parent?.id ?? "unknown";
  return {
    id: snap.id,
    uid,
    docPath: snap.ref.path,
    description: d.description ?? "",
    screenshotPath: d.screenshotPath ?? "",
    screenshotUrl: d.downloadURL ?? null,
    region: d.region ?? null,
    appVersion: d.appVersion ?? "",
    buildNumber: d.buildNumber ?? "",
    osVersion: d.osVersion ?? "",
    deviceModel: d.deviceModel ?? "",
    screenName: d.screenName ?? "",
    locale: d.locale ?? "",
    status: (d.status as FeedbackStatus) ?? "pending",
    createdAt: (d.createdAt as Timestamp)?.toDate?.() ?? new Date(),
  };
}

/** Collection-group read across every user's appFeedback — allowed for an admin by firestore.rules' isAdmin(). */
export async function listAppFeedback(status: FeedbackStatus | "all", max = 100): Promise<AppFeedbackReport[]> {
  const base = collectionGroup(db, "appFeedback");
  const q =
    status === "all"
      ? query(base, orderBy("createdAt", "desc"), limit(max))
      : query(base, where("status", "==", status), orderBy("createdAt", "desc"), limit(max));
  const snap = await withPermissionRetry(() => getDocs(q));
  const reports = snap.docs.map(toAppFeedbackReport);

  // downloadURL is optional on the doc (see isValidAppFeedback) — resolve it
  // from Storage for any report that doesn't already have one cached.
  await Promise.all(
    reports.map(async (report) => {
      if (report.screenshotUrl || !report.screenshotPath) return;
      try {
        report.screenshotUrl = await getDownloadURL(ref(storage, report.screenshotPath));
      } catch {
        // Leave null — the UI shows a placeholder rather than failing the whole list.
      }
    }),
  );

  return reports;
}

export async function markAppFeedback(docPath: string, status: "triaged" | "resolved"): Promise<void> {
  const field = status === "triaged" ? "triagedAt" : "resolvedAt";
  await withPermissionRetry(() => updateDoc(doc(db, docPath), { status, [field]: Timestamp.now() }));
}

export async function listAnonymousFeedback(max = 100): Promise<AnonymousFeedback[]> {
  const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(max));
  const snap = await withPermissionRetry(() => getDocs(q));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      message: data.message ?? "",
      email: data.email ?? null,
      createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    };
  });
}
