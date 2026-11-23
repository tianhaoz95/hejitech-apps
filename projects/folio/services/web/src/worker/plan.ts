// What each plan allows. Folio stays useful without Pro: anyone can make, share, review and search
// artifacts. Pro raises how many artifacts a person owns and how large a version may be, and adds
// webhooks. The artifact's owner's plan counts, whoever makes the change (a member's agent editing
// your artifact uses your limits). Checked in service.ts, so the web, the iPhone app and every
// agent meet the same limits; the 402 says how to get Pro.
import { LIMITS } from "@folio/core";
import { proStatus, type ProStatus } from "./billing.ts";
import { PRO } from "./pro-config.ts";
import type { Db } from "./store.ts";

export interface Limits {
  artifacts: number;
  versionBytes: number;
  webhooks: number;
}

export const FREE: Limits = { artifacts: 25, versionBytes: 10 * 1024 * 1024, webhooks: 0 };
export const PRO_LIMITS: Limits = { artifacts: LIMITS.artifacts, versionBytes: LIMITS.versionBytes, webhooks: 10 };

/** Set per request by the Worker (its PUBLIC_URL), for the link in 402 messages. */
let siteUrl = "";
export function setSiteUrl(url: string): void {
  siteUrl = url;
}
export const proUrl = () => `${siteUrl}${PRO.accountPath}`;

export async function planFor(db: Db, userId: string, email?: string): Promise<{ status: ProStatus; limits: Limits }> {
  const status = await proStatus(db, userId, email);
  return { status, limits: status.pro ? PRO_LIMITS : FREE };
}
