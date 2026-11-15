// Reports and blocks on gallery templates (App Store guideline 1.2; DECISIONS #73). Anyone signed in can
// report a published template once (they can change the reason): it disappears for them at once, and
// AUTO_HIDE_REPORTS open reports from different people hide it from everyone (trip_templates.moderated_at)
// until the owner reviews it with `scripts/moderation.mjs`. "Hide trips from this traveler" blocks the
// template's author for the reporter: the gallery, search and agents' search_templates leave out all of
// their templates. Authors stay anonymous: nothing here reveals who wrote a template or who reported it.
import { Db, eq } from "./db.js";

export const REASONS = ["spam", "offensive", "unsafe", "misleading", "other"] as const;
export type Reason = (typeof REASONS)[number];
export const AUTO_HIDE_REPORTS = 3;

export class ReportError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export interface ReportInput { reason?: unknown; details?: unknown; block?: unknown }

/** Checks a report body (pure; unit-tested). */
export function checkReport(body: ReportInput): { reason: Reason; details: string | null; block: boolean } {
  const reason = String(body.reason ?? "");
  if (!(REASONS as readonly string[]).includes(reason)) throw new ReportError(`reason must be one of ${REASONS.join(", ")}`);
  const details = typeof body.details === "string" && body.details.trim() ? body.details.trim().slice(0, 1000) : null;
  return { reason: reason as Reason, details, block: body.block === true };
}

interface TemplateRef { id: string; user_id: string; status: string; moderated_at: string | null }

export async function reportTemplate(db: Db, reporterId: string, slug: string, body: ReportInput, now = new Date()) {
  const input = checkReport(body);
  const t = await db.one<TemplateRef>("trip_templates", `select=id,user_id,status,moderated_at&slug=${eq(slug)}`);
  if (!t || t.status !== "published") throw new ReportError("This trip isn't in the gallery (anymore).", 404);
  if (t.user_id === reporterId) throw new ReportError("This is your own trip: take it down from its page instead.", 400);
  await db.insert("template_reports", { template_id: t.id, reporter_id: reporterId, reason: input.reason, details: input.details, created_at: now.toISOString(), resolved_at: null, resolution: null }, { upsert: true, onConflict: "template_id,reporter_id" });
  if (input.block) await db.insert("template_blocks", { user_id: reporterId, blocked_user_id: t.user_id }, { upsert: true, onConflict: "user_id,blocked_user_id" });
  const open = await db.select<{ id: string }>("template_reports", `select=id&template_id=${eq(t.id)}&resolved_at=is.null`);
  let hiddenForEveryone = !!t.moderated_at;
  if (!t.moderated_at && open.length >= AUTO_HIDE_REPORTS) {
    await db.update("trip_templates", `id=${eq(t.id)}`, { moderated_at: now.toISOString(), moderation_note: `hidden automatically after ${open.length} reports` });
    hiddenForEveryone = true;
  }
  console.log("template report", JSON.stringify({ slug, reason: input.reason, open: open.length, hidden: hiddenForEveryone, block: input.block }));
  return { reported: true, blocked: input.block, open_reports: open.length, hidden_for_everyone: hiddenForEveryone };
}

/** What the gallery leaves out for one signed-in viewer: templates they reported, authors they blocked. */
export async function hiddenFor(db: Db, viewerId: string | undefined): Promise<{ templates: Set<string>; owners: Set<string> }> {
  if (!viewerId) return { templates: new Set(), owners: new Set() };
  const [reports, blocks] = await Promise.all([
    db.select<{ template_id: string }>("template_reports", `select=template_id&reporter_id=${eq(viewerId)}`).catch(() => []),
    db.select<{ blocked_user_id: string }>("template_blocks", `select=blocked_user_id&user_id=${eq(viewerId)}`).catch(() => []),
  ]);
  return { templates: new Set(reports.map((r) => r.template_id)), owners: new Set(blocks.map((b) => b.blocked_user_id)) };
}

/** Unblocks every traveler the viewer blocked (Settings › "Show hidden travelers again"). */
export async function clearBlocks(db: Db, viewerId: string): Promise<number> {
  const before = await db.select<{ blocked_user_id: string }>("template_blocks", `select=blocked_user_id&user_id=${eq(viewerId)}`);
  if (before.length) await db.delete("template_blocks", `user_id=${eq(viewerId)}`);
  return before.length;
}
