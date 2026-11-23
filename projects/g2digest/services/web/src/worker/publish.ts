// validate_cards and publish_cards (PRD §8.1), shared by the MCP tools and the tests. A publish must
// carry the preview_hash of an error-free validation of that exact bundle (validation renders the
// preview snapshot, so "publish without a preview render" is refused as E_NO_PREVIEW), and is
// validated again against the current guide, brief and uploaded files.
import { cardId, GUIDE_VERSION, previewHash, validate, type Bundle, type Issue, type ValidationResult } from "@g2digest/core";
import { loadBrief, pruneEditions, uploadedAudio, type Db } from "./store.ts";

const PREVIEW_TTL_SEC = 86400;
const previewKey = (userId: string, hash: string) => `preview:${userId}:${hash}`;

function datesOf(bundle: unknown): string[] {
  const b = bundle as Partial<Bundle>;
  const dates = typeof b?.date === "string" ? [b.date] : [];
  for (const c of Array.isArray(b?.cards) ? b.cards : []) if (typeof c?.carried_from === "string") dates.push(c.carried_from);
  return dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
}

async function logBuildRun(
  db: Db,
  userId: string,
  action: "validate" | "publish",
  bundle: unknown,
  ok: boolean,
  errors: Issue[],
  warnings: Issue[],
  agentName?: string,
) {
  const date = typeof (bundle as Partial<Bundle>)?.date === "string" ? (bundle as Partial<Bundle>).date : null;
  await db.from("build_runs").insert({
    user_id: userId,
    action,
    edition_date: date,
    status: ok ? "ok" : "error",
    error_count: errors.length,
    warning_count: warnings.length,
    errors: errors.slice(0, 20),
    agent_name: agentName ?? null,
  }).then(() => undefined, () => undefined);
}

export async function validateForUser(
  db: Db,
  kv: KVNamespace,
  userId: string,
  bundle: unknown,
  agentName?: string,
): Promise<ValidationResult & { preview_hash: string | null }> {
  const { brief, brief_version } = await loadBrief(db, userId);
  const uploaded = await uploadedAudio(db, userId, datesOf(bundle));
  const result = validate(bundle, { brief, brief_version, guide_version: GUIDE_VERSION, uploaded });
  await logBuildRun(db, userId, "validate", bundle, result.ok, result.errors, result.warnings, agentName);
  if (!result.ok) return { ...result, preview_hash: null };
  const hash = await previewHash(bundle);
  await kv.put(previewKey(userId, hash), result.snapshot, { expirationTtl: PREVIEW_TTL_SEC });
  return { ...result, preview_hash: hash };
}

export interface PublishOptions {
  draft?: boolean;
  publish_at?: string;
  agentName?: string;
}

export interface PublishResult {
  published: boolean;
  status?: "published" | "draft" | "scheduled";
  publish_at?: string | null;
  errors: Issue[];
  warnings: Issue[];
  date?: string;
  edition_id?: string;
  cards?: string[];
  /** Dates of the editions deleted to keep only the newest ones (store.ts KEEP_EDITIONS). */
  pruned?: string[];
}

export async function publishForUser(
  db: Db,
  kv: KVNamespace,
  userId: string,
  bundle: unknown,
  givenHash: unknown,
  opts: PublishOptions = {},
): Promise<PublishResult> {
  const hash = await previewHash(bundle);
  const snapshot = typeof givenHash === "string" && givenHash === hash ? await kv.get(previewKey(userId, hash)) : null;
  if (!snapshot) {
    const errs: Issue[] = [{
      code: "E_NO_PREVIEW",
      message: "no error-free validate_cards (with its preview) for this exact bundle: validate it, look at the snapshot, then publish with the preview_hash it returned",
    }];
    await logBuildRun(db, userId, "publish", bundle, false, errs, [], opts.agentName);
    return { published: false, warnings: [], errors: errs };
  }
  const { brief, brief_version } = await loadBrief(db, userId);
  const uploaded = await uploadedAudio(db, userId, datesOf(bundle));
  const result = validate(bundle, { brief, brief_version, guide_version: GUIDE_VERSION, uploaded });
  if (!result.ok) {
    await logBuildRun(db, userId, "publish", bundle, false, result.errors, result.warnings, opts.agentName);
    return { published: false, errors: result.errors, warnings: result.warnings };
  }

  let status: "published" | "draft" | "scheduled" = "published";
  let publishAt: string | null = null;
  if (opts.draft) {
    status = "draft";
  } else if (opts.publish_at) {
    const ts = Date.parse(opts.publish_at);
    if (Number.isNaN(ts)) {
      const errs: Issue[] = [{ code: "E_PUBLISH_AT", message: "publish_at must be a valid ISO-8601 timestamp" }];
      await logBuildRun(db, userId, "publish", bundle, false, errs, result.warnings, opts.agentName);
      return { published: false, errors: errs, warnings: result.warnings };
    }
    publishAt = new Date(ts).toISOString();
    if (ts > Date.now() + 30_000) status = "scheduled";
  }

  const b = bundle as Bundle;
  const totalAudio = b.cards.reduce((n, c) => n + (c.glance?.duration_sec ?? 0) + (c.deep_dive?.duration_sec ?? 0), 0);
  const { data: edition, error } = await db.from("editions").upsert({
    user_id: userId, date: b.date, guide_version: b.guide_version, brief_version: b.brief_version, title: b.edition.title,
    total_cards: b.cards.length, total_audio_sec: Math.round(totalAudio * 10) / 10, bundle: b, cut: b.cut ?? [],
    preview_hash: hash, preview_snapshot: snapshot, status, publish_at: publishAt, published_at: new Date().toISOString(),
  }, { onConflict: "user_id,date" }).select("id").single();
  if (error || !edition) throw new Error(`publish failed: ${error?.message ?? "no edition row"}`);

  const rows = b.cards.map((c, i) => ({
    user_id: userId, id: cardId(b.date, c.slug), edition_id: edition.id, position: i, kind: c.kind,
    section_id: c.section_id ?? null, template: c.template ?? null, lines: result.frames[i].lines,
    key_number: c.key_number ?? null, method_keyword: c.method_keyword ?? null, alert: Boolean(c.alert),
    glance_script: c.glance?.script ?? null, glance_audio_path: c.glance?.audio_path ?? null, glance_duration_sec: c.glance?.duration_sec ?? null,
    deep_dive_script: c.deep_dive?.script ?? null, deep_dive_audio_path: c.deep_dive?.audio_path ?? null, deep_dive_duration_sec: c.deep_dive?.duration_sec ?? null,
    source_url: c.source_url ?? null,
  }));
  const ids = rows.map((r) => r.id);
  // A rebuild of the same date replaces the edition: upsert its cards, drop the ones it no longer has.
  const { data: old } = await db.from("cards").select("id").eq("edition_id", edition.id);
  const gone = (old ?? []).map((r) => r.id as string).filter((id) => !ids.includes(id));
  if (gone.length) await db.from("cards").delete().eq("user_id", userId).in("id", gone);
  const { error: cardsError } = await db.from("cards").upsert(rows, { onConflict: "user_id,id" });
  if (cardsError) throw new Error(`publish failed: ${cardsError.message}`);
  await kv.delete(previewKey(userId, hash));
  await logBuildRun(db, userId, "publish", bundle, true, [], result.warnings, opts.agentName);
  // Only the newest editions are kept: the oldest goes when an 11th arrives (best effort, never fails the publish).
  const pruned = await pruneEditions(db, userId).catch(() => []);
  return {
    published: true,
    status,
    publish_at: publishAt,
    errors: [],
    warnings: result.warnings,
    date: b.date,
    edition_id: edition.id as string,
    cards: ids,
    ...(pruned.length ? { pruned } : {}),
  };
}
