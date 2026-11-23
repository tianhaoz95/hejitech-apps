// Folio's artifact service: every read and write the web API and the MCP server make goes through
// here, so roles, limits, attribution and the activity feed are enforced in one place.
import {
  agentLabel,
  applyOps,
  can,
  checkManifest,
  clampText,
  describeOps,
  diffText,
  entryFile,
  isTextType,
  LIMITS,
  newSlug,
  normalizePath,
  OpError,
  parseArtifactRef,
  parseOps,
  pathsToLoad,
  sha256Hex,
  utf8Length,
  type Action,
  type EditOp,
  type FileDiff,
  type Manifest,
  type Role,
  type Visibility,
  type WorkingFile,
} from "@folio/core";
import { FREE, planFor, proUrl } from "./plan.ts";
import { PRO } from "./pro-config.ts";
import type { PushEvent } from "./push.ts";
import { BUCKET, emailsFor, PREFIX, randomToken, sha256, type Db } from "./store.ts";

/** Sends iPhone notifications and webhooks for events (set per request by the Worker; tests leave it unset). */
let notifier: ((e: PushEvent) => Promise<unknown>) | null = null;
export function setNotifier(fn: ((e: PushEvent) => Promise<unknown>) | null): void {
  notifier = fn;
}

/** Who is acting: a signed-in person through the site, or an agent acting for them. */
export interface Actor {
  userId: string | null;
  /** Shown on versions, suggestions, comments and events ("Claude Code", "Gemini CLI", "Web"). */
  agent: string;
  model?: string | null;
  via: "web" | "mcp" | "api";
  /** No notifications (seeding the App Review demo: no devices, and Workers cap subrequests). */
  quiet?: boolean;
}

export class FolioError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export interface ArtifactRow {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  description: string;
  visibility: Visibility;
  head_version: number;
  forked_from: string | null;
  forked_from_version: number | null;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  artifact_id: string;
  number: number;
  parent: number | null;
  manifest: Manifest;
  message: string;
  author_id: string | null;
  agent: string;
  model: string | null;
  via: string;
  kind: string;
  suggestion_id: string | null;
  restored_from: number | null;
  created_at: string;
}

export interface SuggestionRow {
  id: string;
  artifact_id: string;
  number: number;
  base_version: number;
  title: string;
  rationale: string;
  ops: EditOp[];
  status: "open" | "accepted" | "rejected" | "withdrawn";
  author_id: string | null;
  agent: string;
  model: string | null;
  via: string;
  resolved_by: string | null;
  resolved_agent: string | null;
  resolution_note: string | null;
  result_version: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const ARTIFACT_COLS = "id, slug, owner_id, title, description, visibility, head_version, forked_from, forked_from_version, created_at, updated_at";

function fail(error: { message: string } | null, what: string): void {
  if (error) throw new FolioError(500, "database", `couldn't ${what}: ${error.message}`);
}

// ------------------------------------------------------------------ access

export async function findArtifact(db: Db, ref: unknown): Promise<ArtifactRow> {
  const parsed = parseArtifactRef(ref);
  if (!parsed) {
    throw new FolioError(400, "bad_ref", `"${String(ref ?? "").slice(0, 80)}" isn't an artifact. Pass its slug, id or Folio URL (list_artifacts shows them).`);
  }
  const q = db.from("artifacts").select(ARTIFACT_COLS);
  const { data, error } = await (parsed.id ? q.eq("id", parsed.id) : q.eq("slug", parsed.slug!)).maybeSingle();
  fail(error, "load the artifact");
  if (!data) throw new FolioError(404, "not_found", `No artifact ${parsed.slug ?? parsed.id}. It may have been deleted, or the link is wrong.`);
  return data as ArtifactRow;
}

export async function roleFor(db: Db, a: ArtifactRow, userId: string | null): Promise<Role | null> {
  if (userId && a.owner_id === userId) return "owner";
  if (userId) {
    const { data } = await db.from("members").select("role").eq("artifact_id", a.id).eq("user_id", userId).maybeSingle();
    if (data) return data.role as Role;
  }
  return a.visibility === "link" ? "viewer" : null;
}

const NEEDS: Record<Action, string> = {
  read: "access",
  comment: "access",
  suggest: "access",
  edit: "editor access (ask the owner, or use suggest_edit instead)",
  review: "editor access",
  manage: "owner access",
};

/** Loads an artifact and checks the actor may do `action` on it. */
export async function access(db: Db, actor: Actor, ref: unknown, action: Action): Promise<{ a: ArtifactRow; role: Role }> {
  const a = await findArtifact(db, ref);
  const role = await roleFor(db, a, actor.userId);
  // Without any role the artifact doesn't exist as far as this caller can tell.
  if (!role) throw new FolioError(404, "not_found", `No artifact ${a.slug}. It may have been deleted, or it isn't shared with you.`);
  if (action !== "read" && !actor.userId) throw new FolioError(401, "sign_in", "Sign in to do that.");
  if (!can(role, action)) throw new FolioError(403, "forbidden", `You're a ${role} on "${a.title}"; that needs ${NEEDS[action]}.`, { your_role: role });
  return { a, role };
}

// ------------------------------------------------------------------ blobs and versions

export async function loadVersion(db: Db, a: ArtifactRow, number?: number | null): Promise<VersionRow> {
  const n = number ?? a.head_version;
  if (!Number.isInteger(n) || n < 1 || n > a.head_version) {
    throw new FolioError(404, "no_version", `"${a.title}" has versions 1–${a.head_version}; there's no version ${number}.`, { head_version: a.head_version });
  }
  const { data, error } = await db.from("versions").select("*").eq("artifact_id", a.id).eq("number", n).maybeSingle();
  fail(error, "load the version");
  if (!data) throw new FolioError(404, "no_version", `Version ${n} is missing.`);
  return data as VersionRow;
}

/** Text of the given blob hashes (text files only). */
export async function loadTexts(db: Db, artifactId: string, hashes: string[]): Promise<Record<string, string>> {
  const want = [...new Set(hashes)];
  if (!want.length) return {};
  const out: Record<string, string> = {};
  for (let i = 0; i < want.length; i += 100) {
    const { data, error } = await db.from("blobs").select("hash, text").eq("artifact_id", artifactId).in("hash", want.slice(i, i + 100));
    fail(error, "load file contents");
    for (const r of data ?? []) if (r.text !== null) out[r.hash as string] = r.text as string;
  }
  return out;
}

/** Current text by path for the given paths of a manifest. */
export async function textsByPath(db: Db, artifactId: string, manifest: Manifest, paths: string[]): Promise<Record<string, string>> {
  const textPaths = paths.filter((p) => manifest[p] && isTextType(manifest[p].type));
  const byHash = await loadTexts(db, artifactId, textPaths.map((p) => manifest[p].hash));
  return Object.fromEntries(textPaths.filter((p) => byHash[manifest[p].hash] !== undefined).map((p) => [p, byHash[manifest[p].hash]]));
}

export async function readBytes(db: Db, artifactId: string, hash: string, type: string): Promise<Uint8Array> {
  if (isTextType(type)) {
    const t = await loadTexts(db, artifactId, [hash]);
    if (t[hash] === undefined) throw new FolioError(404, "missing_blob", "File contents are missing.");
    return new TextEncoder().encode(t[hash]);
  }
  const { data, error } = await db.storage.from(BUCKET).download(`${artifactId}/${hash}`);
  if (error || !data) throw new FolioError(404, "missing_blob", `File contents are missing${error ? `: ${error.message}` : ""}.`);
  return new Uint8Array(await data.arrayBuffer());
}

/** The 402 for a limit only Pro lifts. */
export function proNeeded(what: string): FolioError {
  return new FolioError(402, "pro_required", `${what} ${PRO.name} lifts this: ${proUrl()}`, { url: proUrl() });
}

/** A version larger than the free plan allows needs the artifact owner's Pro. */
async function checkVersionSize(db: Db, ownerId: string, manifest: Manifest): Promise<void> {
  const total = Object.values(manifest).reduce((n, f) => n + f.size, 0);
  if (total <= FREE.versionBytes) return;
  const { limits } = await planFor(db, ownerId);
  if (total > limits.versionBytes) {
    const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
    throw proNeeded(`All files of one version may be at most ${mb(limits.versionBytes)} on the owner's plan (this is ${mb(total)}).`);
  }
}

/** Stores the contents of changed files and returns the manifest of the whole file set. */
async function saveBlobs(db: Db, artifactId: string, files: Record<string, WorkingFile>, ownerId: string): Promise<Manifest> {
  const manifest: Manifest = {};
  const fresh: { hash: string; size: number; text?: string; bytes?: Uint8Array; type: string }[] = [];
  for (const [path, f] of Object.entries(files)) {
    if (f.hash) {
      manifest[path] = { hash: f.hash, size: f.size, type: f.type };
      continue;
    }
    const hash = await sha256Hex(f.text !== undefined ? f.text : f.bytes!);
    manifest[path] = { hash, size: f.size, type: f.type };
    fresh.push({ hash, size: f.size, text: f.text, bytes: f.bytes, type: f.type });
  }
  const problems = checkManifest(manifest);
  if (problems.length) throw new FolioError(422, "limits", problems.join("; "));
  await checkVersionSize(db, ownerId, manifest);
  if (!fresh.length) return manifest;
  const { data: have } = await db.from("blobs").select("hash").eq("artifact_id", artifactId).in("hash", [...new Set(fresh.map((f) => f.hash))]);
  const existing = new Set((have ?? []).map((r) => r.hash as string));
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  for (const f of fresh) {
    if (existing.has(f.hash) || seen.has(f.hash)) continue;
    seen.add(f.hash);
    if (f.text !== undefined) {
      rows.push({ artifact_id: artifactId, hash: f.hash, size: f.size, text: f.text, in_storage: false });
    } else {
      const { error } = await db.storage.from(BUCKET).upload(`${artifactId}/${f.hash}`, f.bytes!, { contentType: f.type, upsert: true });
      if (error) throw new FolioError(500, "storage", `couldn't store a file: ${error.message}`);
      rows.push({ artifact_id: artifactId, hash: f.hash, size: f.size, text: null, in_storage: true });
    }
  }
  if (rows.length) {
    const { error } = await db.from("blobs").upsert(rows, { onConflict: "artifact_id,hash", ignoreDuplicates: true });
    fail(error, "store file contents");
  }
  return manifest;
}

function sameManifest(a: Manifest, b: Manifest): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => b[k] && b[k].hash === a[k].hash && b[k].type === a[k].type);
}

async function commit(
  db: Db,
  a: ArtifactRow,
  base: number,
  manifest: Manifest,
  actor: Actor,
  opts: { message: string; kind: string; suggestionId?: string; restoredFrom?: number }
): Promise<number> {
  const { data, error } = await db.rpc("commit_version", {
    p_artifact: a.id,
    p_base: base,
    p_manifest: manifest,
    p_message: clampText(opts.message, LIMITS.message),
    p_author: actor.userId,
    p_agent: actor.agent,
    p_model: actor.model ?? null,
    p_via: actor.via,
    p_kind: opts.kind,
    p_suggestion: opts.suggestionId ?? null,
    p_restored_from: opts.restoredFrom ?? null,
  });
  if (error) {
    const m = error.message.match(/stale:(\d+)/);
    if (m) throw await staleError(db, { ...a, head_version: Number(m[1]) }, base, []);
    throw new FolioError(500, "database", `couldn't save the version: ${error.message}`);
  }
  a.head_version = Number(data);
  return Number(data);
}

async function logEvent(
  db: Db,
  artifactId: string,
  actor: Actor,
  kind: string,
  summary: string,
  extra: { version?: number; suggestion_number?: number; comment_id?: string } = {}
): Promise<void> {
  const { data } = await db
    .from("events")
    .insert({
      artifact_id: artifactId,
      kind,
      summary: summary.slice(0, 500),
      actor_id: actor.userId,
      agent: actor.agent,
      via: actor.via,
      ...extra,
    })
    .select("id")
    .maybeSingle();
  const id = (data?.id as number | undefined) ?? undefined;
  if (notifier && !actor.quiet) await notifier({ id, artifactId, kind, summary, agent: actor.agent, via: actor.via, actorId: actor.userId, ...extra }).catch(() => undefined);
}

/** Paths whose contents differ between two manifests. */
function changedPaths(a: Manifest, b: Manifest): string[] {
  const all = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...all].filter((p) => a[p]?.hash !== b[p]?.hash || a[p]?.type !== b[p]?.type).sort();
}

async function staleError(db: Db, a: ArtifactRow, base: number, conflicting: string[]): Promise<FolioError> {
  const { data } = await db
    .from("versions")
    .select("number, agent, message")
    .eq("artifact_id", a.id)
    .gt("number", base)
    .order("number")
    .limit(20);
  const later = (data ?? []) as { number: number; agent: string; message: string }[];
  const by = [...new Set(later.map((v) => v.agent))].join(", ") || "someone";
  const files = conflicting.length ? ` They changed ${conflicting.join(", ")}, which this edit also touches.` : "";
  return new FolioError(
    409,
    "stale",
    `Version ${base} is out of date: "${a.title}" is at version ${a.head_version} (changed by ${by}).${files} Read the current files again (get_artifact or read_file) and redo the edit with base_version ${a.head_version}.`,
    { head_version: a.head_version, base_version: base, conflicting_paths: conflicting, newer_versions: later }
  );
}

function touchedPaths(ops: EditOp[]): string[] {
  return [...new Set(ops.flatMap((o) => (o.op === "rename" ? [o.path, o.to] : [o.path])))];
}

/**
 * Applies ops written against `base`. When the artifact moved on since, the ops are replayed on
 * the head as long as no file they touch changed in between — or the only ops on such files are
 * `replace`s that still match exactly once. Anything else is a conflict (409 stale).
 */
async function applyRebased(
  db: Db,
  a: ArtifactRow,
  base: number,
  ops: EditOp[]
): Promise<{ files: Record<string, WorkingFile>; changed: string[]; onto: number; rebased: boolean; baseManifest: Manifest }> {
  if (!Number.isInteger(base) || base < 1) {
    throw new FolioError(400, "base_version", `base_version is required: the version your edit is based on (the artifact is at ${a.head_version}).`, { head_version: a.head_version });
  }
  if (base > a.head_version) throw new FolioError(400, "base_version", `There's no version ${base} yet; the artifact is at ${a.head_version}.`, { head_version: a.head_version });
  const baseV = await loadVersion(db, a, base);
  let manifest = baseV.manifest;
  let rebased = false;
  if (base !== a.head_version) {
    const head = await loadVersion(db, a, a.head_version);
    const moved = new Set(changedPaths(baseV.manifest, head.manifest));
    const conflicts = touchedPaths(ops).filter((p) => moved.has(p));
    const unsafe = ops.some((o) => o.op !== "replace" && touchedPaths([o]).some((p) => moved.has(p)));
    if (unsafe) throw await staleError(db, a, base, conflicts);
    manifest = head.manifest;
    rebased = true;
  }
  const texts = await textsByPath(db, a.id, manifest, pathsToLoad(ops, manifest));
  try {
    const { files, changed } = applyOps(manifest, ops, texts);
    return { files, changed, onto: a.head_version, rebased, baseManifest: baseV.manifest };
  } catch (e) {
    if (e instanceof OpError) {
      if (rebased) throw await staleError(db, a, base, touchedPaths(ops));
      throw new FolioError(422, "op_failed", e.message);
    }
    throw e;
  }
}

function parseOpsOrThrow(input: unknown): EditOp[] {
  try {
    return parseOps(input);
  } catch (e) {
    throw new FolioError(400, "bad_ops", (e as Error).message);
  }
}

// ------------------------------------------------------------------ artifacts

export interface FileInput {
  path: string;
  content?: string;
  base64?: string;
  content_type?: string;
}

function titleFromHtml(files: Record<string, WorkingFile>): string {
  for (const f of Object.values(files)) {
    const m = f.text?.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (m) return m[1].trim();
  }
  return "";
}

export async function createArtifact(
  db: Db,
  actor: Actor,
  input: { title?: unknown; description?: unknown; files: unknown; message?: unknown; visibility?: unknown; forkedFrom?: { id: string; version: number } }
): Promise<{ a: ArtifactRow; version: number }> {
  if (!actor.userId) throw new FolioError(401, "sign_in", "Sign in to create artifacts.");
  if (!Array.isArray(input.files) || !input.files.length) {
    throw new FolioError(400, "files", "files is required: a list of { path, content } (or { path, base64 } for images and other binary files).");
  }
  const ops = parseOpsOrThrow((input.files as Record<string, unknown>[]).map((f) => ({ ...f, op: "write" })));
  const { count } = await db.from("artifacts").select("id", { count: "exact", head: true }).eq("owner_id", actor.userId);
  if ((count ?? 0) >= FREE.artifacts) {
    const { status, limits } = await planFor(db, actor.userId);
    if ((count ?? 0) >= limits.artifacts) {
      if (status.pro) throw new FolioError(422, "limits", `You have ${count} artifacts, the most one person can own. Delete some first.`);
      throw proNeeded(`You have ${count} artifacts, the most the free plan keeps (${FREE.artifacts}). Delete some, or get Pro for up to ${LIMITS.artifacts}.`);
    }
  }
  let built: { files: Record<string, WorkingFile>; changed: string[] };
  try {
    built = applyOps({}, ops, {});
  } catch (e) {
    throw new FolioError(422, "op_failed", (e as Error).message);
  }
  const title = clampText(input.title, LIMITS.title) || titleFromHtml(built.files) || "Untitled";
  const visibility: Visibility = input.visibility === "link" ? "link" : "private";
  let slug = newSlug();
  let row: ArtifactRow | null = null;
  for (let i = 0; i < 4 && !row; i++) {
    const { data, error } = await db
      .from("artifacts")
      .insert({
        slug,
        owner_id: actor.userId,
        title,
        description: clampText(input.description, LIMITS.description),
        visibility,
        ...(input.forkedFrom ? { forked_from: input.forkedFrom.id, forked_from_version: input.forkedFrom.version } : {}),
      })
      .select(ARTIFACT_COLS)
      .single();
    if (error?.code === "23505") slug = newSlug();
    else fail(error, "create the artifact");
    row = data as ArtifactRow | null;
  }
  if (!row) throw new FolioError(500, "database", "couldn't pick a unique link; try again.");
  try {
    const manifest = await saveBlobs(db, row.id, built.files, row.owner_id);
    const version = await commit(db, row, 0, manifest, actor, {
      message: clampText(input.message, LIMITS.message) || (input.forkedFrom ? "Forked" : "Created"),
      kind: input.forkedFrom ? "fork" : "create",
    });
    await logEvent(db, row.id, actor, "created", `Created "${title}" with ${Object.keys(manifest).sort().join(", ")}`, { version });
    return { a: row, version };
  } catch (e) {
    await deleteArtifactRow(db, row.id);
    throw e;
  }
}

export async function editArtifact(
  db: Db,
  actor: Actor,
  ref: unknown,
  input: { base_version: unknown; ops: unknown; message?: unknown }
): Promise<{ a: ArtifactRow; version: number; changed: string[]; rebased_from?: number }> {
  const { a } = await access(db, actor, ref, "edit");
  const ops = parseOpsOrThrow(input.ops);
  const base = Number(input.base_version);
  const r = await applyRebased(db, a, base, ops);
  const manifest = await saveBlobs(db, a.id, r.files, a.owner_id);
  const head = await loadVersion(db, a, r.onto);
  if (sameManifest(manifest, head.manifest)) throw new FolioError(422, "no_change", "That edit leaves every file as it is; nothing to save.");
  const message = clampText(input.message, LIMITS.message) || describeOps(ops);
  const version = await commit(db, a, r.onto, manifest, actor, { message, kind: "edit" });
  await logEvent(db, a.id, actor, "edited", `v${version}: ${message}`, { version });
  return { a, version, changed: changedPaths(head.manifest, manifest), ...(r.rebased ? { rebased_from: base } : {}) };
}

export async function restoreVersion(db: Db, actor: Actor, ref: unknown, number: unknown, message?: unknown): Promise<{ a: ArtifactRow; version: number }> {
  const { a } = await access(db, actor, ref, "edit");
  const old = await loadVersion(db, a, Number(number));
  const head = await loadVersion(db, a, a.head_version);
  if (sameManifest(old.manifest, head.manifest)) throw new FolioError(422, "no_change", `Version ${old.number} is the same as the current version.`);
  const version = await commit(db, a, a.head_version, old.manifest, actor, {
    message: clampText(message, LIMITS.message) || `Restored version ${old.number}`,
    kind: "restore",
    restoredFrom: old.number,
  });
  await logEvent(db, a.id, actor, "restored", `v${version}: restored version ${old.number}`, { version });
  return { a, version };
}

export async function updateArtifact(
  db: Db,
  actor: Actor,
  ref: unknown,
  input: { title?: unknown; description?: unknown; visibility?: unknown }
): Promise<ArtifactRow> {
  const { a } = await access(db, actor, ref, "manage");
  const patch: Record<string, unknown> = {};
  const changes: string[] = [];
  if (typeof input.title === "string") {
    const t = clampText(input.title, LIMITS.title);
    if (!t) throw new FolioError(400, "title", "title can't be empty");
    patch.title = t;
    changes.push(`renamed to "${t}"`);
  }
  if (typeof input.description === "string") {
    patch.description = clampText(input.description, LIMITS.description);
    changes.push("description updated");
  }
  if (input.visibility !== undefined) {
    if (input.visibility !== "private" && input.visibility !== "link") throw new FolioError(400, "visibility", "visibility is private or link");
    patch.visibility = input.visibility;
    changes.push(input.visibility === "link" ? "anyone with the link can view" : "only members can view");
  }
  if (!changes.length) return a;
  const { data, error } = await db.from("artifacts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", a.id).select(ARTIFACT_COLS).single();
  fail(error, "update the artifact");
  await logEvent(db, a.id, actor, "settings", changes.join("; "));
  return data as ArtifactRow;
}

async function deleteArtifactRow(db: Db, id: string): Promise<void> {
  const { data } = await db.from("blobs").select("hash").eq("artifact_id", id).eq("in_storage", true);
  const paths = (data ?? []).map((r) => `${id}/${r.hash}`);
  // Link-preview pictures (og.ts) live beside the blobs.
  const { data: shots } = await db.storage.from(BUCKET).list(id, { search: "og-", limit: 1000 });
  for (const f of shots ?? []) paths.push(`${id}/${f.name}`);
  for (let i = 0; i < paths.length; i += 100) await db.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  await db.from("artifacts").delete().eq("id", id);
}

export async function deleteArtifact(db: Db, actor: Actor, ref: unknown): Promise<{ deleted: string }> {
  const { a } = await access(db, actor, ref, "manage");
  await deleteArtifactRow(db, a.id);
  return { deleted: a.slug };
}

/** Stars or unstars an artifact for the person (anyone who can open it). Not an event. */
export async function setFavorite(db: Db, actor: Actor, ref: unknown, on: boolean): Promise<{ favorite: boolean }> {
  if (!actor.userId) throw new FolioError(401, "auth", "Sign in to keep favorites.");
  const { a } = await access(db, actor, ref, "read");
  const { error } = on
    ? await db.from("favorites").upsert({ user_id: actor.userId, artifact_id: a.id }, { onConflict: "user_id,artifact_id", ignoreDuplicates: true })
    : await db.from("favorites").delete().eq("user_id", actor.userId).eq("artifact_id", a.id);
  fail(error, on ? "add the favorite" : "remove the favorite");
  return { favorite: on };
}

// ------------------------------------------------------------------ live data

export interface DataInfo {
  bytes: number;
  agent: string;
  updated_at: string;
}

/**
 * Sets an artifact's live data (what its pages read at .folio/data.json). `merge` updates the
 * top-level keys of an object instead of replacing it (a null value removes a key). Not a version
 * and no activity event: a scheduled refresh would otherwise flood both.
 */
export async function setData(db: Db, actor: Actor, ref: unknown, input: { data?: unknown; merge?: unknown }): Promise<{ a: ArtifactRow; info: DataInfo }> {
  const { a } = await access(db, actor, ref, "edit");
  if (input.data === undefined) throw new FolioError(400, "data", "data is required: any JSON value (usually an object) for the pages to read at .folio/data.json");
  let value = input.data;
  if (input.merge === true) {
    const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
    if (!isObj(value)) throw new FolioError(400, "data", "merge needs data to be an object (its keys update the current data)");
    const { data: cur } = await db.from("artifact_data").select("data").eq("artifact_id", a.id).maybeSingle();
    const merged: Record<string, unknown> = isObj(cur?.data) ? { ...(cur!.data as Record<string, unknown>) } : {};
    for (const [k, v] of Object.entries(value)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    value = merged;
  }
  const text = JSON.stringify(value);
  const bytes = utf8Length(text);
  if (bytes > LIMITS.dataBytes) {
    throw new FolioError(413, "too_large", `Live data may be at most ${LIMITS.dataBytes / 1024} KB (this is ${Math.ceil(bytes / 1024)} KB). Keep only what the pages show; put larger files in the artifact itself.`);
  }
  const updated_at = new Date().toISOString();
  const { error } = await db
    .from("artifact_data")
    .upsert({ artifact_id: a.id, data: value, bytes, agent: actor.agent, updated_by: actor.userId, updated_at }, { onConflict: "artifact_id" });
  fail(error, "save the data");
  return { a, info: { bytes, agent: actor.agent, updated_at } };
}

/** The live data and who last set it (null data when none was ever set). */
export async function getData(db: Db, actor: Actor, ref: unknown): Promise<{ a: ArtifactRow; data: unknown; info: DataInfo | null }> {
  const { a } = await access(db, actor, ref, "read");
  const row = await dataRow(db, a.id);
  return { a, data: row?.data ?? null, info: row ? { bytes: row.bytes, agent: row.agent, updated_at: row.updated_at } : null };
}

/** For rendering, export and fork: no access check (the caller did it). */
export async function dataRow(db: Db, artifactId: string): Promise<{ data: unknown; bytes: number; agent: string; updated_at: string } | null> {
  const { data, error } = await db.from("artifact_data").select("data, bytes, agent, updated_at").eq("artifact_id", artifactId).maybeSingle();
  fail(error, "load the data");
  return (data as { data: unknown; bytes: number; agent: string; updated_at: string } | null) ?? null;
}

export async function forkArtifact(db: Db, actor: Actor, ref: unknown, input: { title?: unknown; version?: unknown }): Promise<{ a: ArtifactRow; version: number }> {
  const { a } = await access(db, actor, ref, "read");
  if (!actor.userId) throw new FolioError(401, "sign_in", "Sign in to fork.");
  const v = await loadVersion(db, a, input.version === undefined || input.version === null ? null : Number(input.version));
  const files: FileInput[] = [];
  const texts = await loadTexts(db, a.id, Object.values(v.manifest).map((f) => f.hash));
  for (const [path, f] of Object.entries(v.manifest)) {
    if (isTextType(f.type)) files.push({ path, content: texts[f.hash] ?? "", content_type: f.type });
    else {
      const bytes = await readBytes(db, a.id, f.hash, f.type);
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      files.push({ path, base64: btoa(s), content_type: f.type });
    }
  }
  const out = await createArtifact(db, actor, {
    title: clampText(input.title, LIMITS.title) || `${a.title} (fork)`,
    description: a.description,
    files,
    message: `Forked from ${a.slug} v${v.number}`,
    forkedFrom: { id: a.id, version: v.number },
  });
  // A fork of a page that reads live data should work as it did: copy the data too.
  const d = await dataRow(db, a.id);
  if (d) await db.from("artifact_data").insert({ artifact_id: out.a.id, data: d.data, bytes: d.bytes, agent: actor.agent, updated_by: actor.userId });
  await logEvent(db, a.id, actor, "forked", `Forked v${v.number} into a new artifact`, { version: v.number });
  return out;
}

export interface ArtifactSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  visibility: Visibility;
  role: Role;
  head_version: number;
  open_suggestions: number;
  /** Who asked for review: the agent of the newest open suggestion, null when there is none. */
  review_agent: string | null;
  /** Comments not yet resolved, replies included (the same count as the artifact's own view). */
  unresolved_comments: number;
  /** Starred by the person listing (per person, not per artifact). */
  favorite: boolean;
  updated_at: string;
  created_at: string;
}

export async function listArtifacts(db: Db, userId: string, query?: unknown, limit = 100): Promise<ArtifactSummary[]> {
  const [{ data: owned, error: e1 }, { data: memberRows, error: e2 }, { data: favRows, error: e3 }] = await Promise.all([
    db.from("artifacts").select(ARTIFACT_COLS).eq("owner_id", userId).order("updated_at", { ascending: false }).limit(1000),
    db.from("members").select("artifact_id, role").eq("user_id", userId),
    db.from("favorites").select("artifact_id").eq("user_id", userId),
  ]);
  fail(e1 ?? e2 ?? e3, "list artifacts");
  const favs = new Set((favRows ?? []).map((f) => f.artifact_id as string));
  const roles = new Map<string, Role>((memberRows ?? []).map((m) => [m.artifact_id as string, m.role as Role]));
  let shared: ArtifactRow[] = [];
  if (roles.size) {
    const { data, error } = await db.from("artifacts").select(ARTIFACT_COLS).in("id", [...roles.keys()]);
    fail(error, "list shared artifacts");
    shared = (data ?? []) as ArtifactRow[];
  }
  let rows = [...((owned ?? []) as ArtifactRow[]).map((a) => ({ a, role: "owner" as Role })), ...shared.map((a) => ({ a, role: roles.get(a.id)! }))];
  const q = typeof query === "string" ? query.trim().toLowerCase() : "";
  if (q) rows = rows.filter(({ a }) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.slug === q);
  rows.sort((x, y) => y.a.updated_at.localeCompare(x.a.updated_at));
  rows = rows.slice(0, limit);
  const counts = new Map<string, number>();
  const reviewAgents = new Map<string, string>();
  const comments = new Map<string, number>();
  if (rows.length) {
    const ids = rows.map((r) => r.a.id);
    const [{ data: sugg }, { data: open }] = await Promise.all([
      db.from("suggestions").select("artifact_id, agent").eq("status", "open").in("artifact_id", ids).order("created_at", { ascending: false }),
      db.from("comments").select("artifact_id").eq("resolved", false).in("artifact_id", ids).limit(10000),
    ]);
    for (const r of sugg ?? []) {
      const id = r.artifact_id as string;
      counts.set(id, (counts.get(id) ?? 0) + 1);
      if (!reviewAgents.has(id)) reviewAgents.set(id, r.agent as string);
    }
    for (const r of open ?? []) comments.set(r.artifact_id as string, (comments.get(r.artifact_id as string) ?? 0) + 1);
  }
  return rows.map(({ a, role }) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    description: a.description,
    visibility: a.visibility,
    role,
    head_version: a.head_version,
    open_suggestions: counts.get(a.id) ?? 0,
    review_agent: reviewAgents.get(a.id) ?? null,
    unresolved_comments: comments.get(a.id) ?? 0,
    favorite: favs.has(a.id),
    updated_at: a.updated_at,
    created_at: a.created_at,
  }));
}

export interface FileView {
  path: string;
  type: string;
  size: number;
  hash: string;
  text: boolean;
  content?: string;
  omitted?: string;
}

/** A version's files, with text contents up to `budget` bytes in all (larger ones are left out). */
export async function versionFiles(db: Db, a: ArtifactRow, v: VersionRow, opts: { content: boolean; budget?: number; only?: string[] }): Promise<FileView[]> {
  const paths = Object.keys(v.manifest)
    .filter((p) => !opts.only || opts.only.includes(p))
    .sort((x, y) => (x === entryFile(Object.keys(v.manifest)) ? -1 : y === entryFile(Object.keys(v.manifest)) ? 1 : x.localeCompare(y)));
  const budget = opts.budget ?? 200_000;
  let used = 0;
  const include: string[] = [];
  if (opts.content) {
    for (const p of [...paths].sort((x, y) => v.manifest[x].size - v.manifest[y].size)) {
      const f = v.manifest[p];
      if (!isTextType(f.type)) continue;
      if (used + f.size > budget) continue;
      used += f.size;
      include.push(p);
    }
  }
  const texts = include.length ? await textsByPath(db, a.id, v.manifest, include) : {};
  return paths.map((p) => {
    const f = v.manifest[p];
    const text = isTextType(f.type);
    const view: FileView = { path: p, type: f.type, size: f.size, hash: f.hash, text };
    if (opts.content) {
      if (texts[p] !== undefined) view.content = texts[p];
      else view.omitted = text ? "large: read it with read_file" : "binary";
    }
    return view;
  });
}

export async function readFile(
  db: Db,
  actor: Actor,
  ref: unknown,
  input: { path: unknown; version?: unknown; start_line?: unknown; end_line?: unknown }
): Promise<{ a: ArtifactRow; version: number; path: string; type: string; size: number; content: string; total_lines: number; start_line: number; end_line: number }> {
  const { a } = await access(db, actor, ref, "read");
  const v = await loadVersion(db, a, input.version === undefined || input.version === null ? null : Number(input.version));
  let path: string;
  try {
    path = normalizePath(input.path);
  } catch (e) {
    throw new FolioError(400, "path", (e as Error).message);
  }
  const f = v.manifest[path];
  if (!f) throw new FolioError(404, "no_file", `Version ${v.number} has no ${path} (files: ${Object.keys(v.manifest).sort().join(", ")}).`);
  if (!isTextType(f.type)) throw new FolioError(422, "binary", `${path} is ${f.type} (${f.size} bytes), not text.`);
  const t = await textsByPath(db, a.id, v.manifest, [path]);
  const all = (t[path] ?? "").split("\n");
  const start = Math.max(1, Number(input.start_line) || 1);
  const end = Math.min(all.length, Number(input.end_line) || all.length);
  const content = start === 1 && end === all.length ? (t[path] ?? "") : all.slice(start - 1, end).join("\n");
  return { a, version: v.number, path, type: f.type, size: f.size, content, total_lines: all.length, start_line: start, end_line: end };
}

export async function listVersions(db: Db, actor: Actor, ref: unknown, limit = 50): Promise<{ a: ArtifactRow; versions: Omit<VersionRow, "manifest">[] & { files: number }[] }> {
  const { a } = await access(db, actor, ref, "read");
  const { data, error } = await db
    .from("versions")
    .select("number, parent, message, agent, model, via, kind, suggestion_id, restored_from, created_at, manifest")
    .eq("artifact_id", a.id)
    .order("number", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  fail(error, "list versions");
  const sids = (data ?? []).map((v) => v.suggestion_id).filter(Boolean) as string[];
  const numbers = new Map<string, number>();
  if (sids.length) {
    const { data: s } = await db.from("suggestions").select("id, number").in("id", sids);
    for (const r of s ?? []) numbers.set(r.id as string, r.number as number);
  }
  const versions = (data ?? []).map(({ manifest, suggestion_id, ...v }) => ({
    ...v,
    files: Object.keys(manifest as Manifest).length,
    ...(suggestion_id ? { suggestion: numbers.get(suggestion_id as string) ?? null } : {}),
  }));
  return { a, versions: versions as never };
}

/** Line diffs between two manifests (renames detected by identical contents). */
export async function diffManifests(db: Db, artifactId: string, from: Manifest, to: Manifest, opts: { paths?: string[] } = {}): Promise<FileDiff[]> {
  let changed = changedPaths(from, to);
  if (opts.paths?.length) changed = changed.filter((p) => opts.paths!.includes(p));
  const removed = changed.filter((p) => from[p] && !to[p]);
  const added = changed.filter((p) => !from[p] && to[p]);
  const renames = new Map<string, string>(); // to -> from
  for (const p of added) {
    const src = removed.find((r) => from[r].hash === to[p].hash && ![...renames.values()].includes(r));
    if (src) renames.set(p, src);
  }
  const hashes = changed.flatMap((p) => [from[p], to[p]]).filter((f) => f && isTextType(f.type)).map((f) => f!.hash);
  const texts = await loadTexts(db, artifactId, hashes);
  const out: FileDiff[] = [];
  for (const p of changed) {
    if ([...renames.values()].includes(p)) continue;
    const a = from[p];
    const b = to[p];
    if (renames.has(p)) {
      out.push({ path: p, from: renames.get(p), status: "renamed", hunks: [], added: 0, removed: 0 });
      continue;
    }
    if ((a && !isTextType(a.type)) || (b && !isTextType(b.type))) {
      out.push({ path: p, status: !a ? "added" : !b ? "deleted" : "binary", hunks: [], added: 0, removed: 0 });
      continue;
    }
    out.push(diffText(p, a ? (texts[a.hash] ?? "") : null, b ? (texts[b.hash] ?? "") : null));
  }
  return out;
}

export async function diffVersions(db: Db, actor: Actor, ref: unknown, fromN: unknown, toN: unknown, paths?: string[]): Promise<{ a: ArtifactRow; from: number; to: number; files: FileDiff[] }> {
  const { a } = await access(db, actor, ref, "read");
  const to = await loadVersion(db, a, toN === undefined || toN === null ? null : Number(toN));
  const fromNum = fromN === undefined || fromN === null ? (to.parent ?? 0) : Number(fromN);
  const from = fromNum === 0 ? null : await loadVersion(db, a, fromNum);
  const files = await diffManifests(db, a.id, from?.manifest ?? {}, to.manifest, { paths });
  return { a, from: fromNum, to: to.number, files };
}

// ------------------------------------------------------------------ suggestions

async function loadSuggestion(db: Db, a: ArtifactRow, number: unknown): Promise<SuggestionRow> {
  const n = Number(number);
  if (!Number.isInteger(n) || n < 1) throw new FolioError(400, "suggestion", "suggestion must be a suggestion number (#1, #2, …)");
  const { data, error } = await db.from("suggestions").select("*").eq("artifact_id", a.id).eq("number", n).maybeSingle();
  fail(error, "load the suggestion");
  if (!data) throw new FolioError(404, "no_suggestion", `"${a.title}" has no suggestion #${n}.`);
  return data as SuggestionRow;
}

/** The files a suggestion produces on its base version (for previews and diffs). */
export async function suggestionFiles(db: Db, a: ArtifactRow, s: SuggestionRow): Promise<{ base: Manifest; files: Record<string, WorkingFile> }> {
  const base = await loadVersion(db, a, s.base_version);
  const texts = await textsByPath(db, a.id, base.manifest, pathsToLoad(s.ops, base.manifest));
  return { base: base.manifest, files: applyOps(base.manifest, s.ops, texts).files };
}

/** Line diffs for working files against a manifest (texts of changed working files are in memory). */
async function diffWorking(db: Db, artifactId: string, base: Manifest, files: Record<string, WorkingFile>): Promise<FileDiff[]> {
  const paths = [...new Set([...Object.keys(base), ...Object.keys(files)])].filter((p) => !files[p] || !base[p] || files[p].hash !== base[p].hash).sort();
  const texts = await loadTexts(db, artifactId, paths.map((p) => base[p]).filter((f) => f && isTextType(f.type)).map((f) => f!.hash));
  return paths.map((p) => {
    const b = base[p];
    const f = files[p];
    if ((b && !isTextType(b.type)) || (f && !isTextType(f.type))) return { path: p, status: !b ? "added" : !f ? "deleted" : "binary", hunks: [], added: 0, removed: 0 } as FileDiff;
    return diffText(p, b ? (texts[b.hash] ?? "") : null, f ? (f.text ?? "") : null);
  });
}

export async function suggestEdit(
  db: Db,
  actor: Actor,
  ref: unknown,
  input: { base_version: unknown; ops: unknown; title?: unknown; rationale?: unknown }
): Promise<{ a: ArtifactRow; suggestion: SuggestionRow; files: FileDiff[] }> {
  const { a } = await access(db, actor, ref, "suggest");
  const ops = parseOpsOrThrow(input.ops);
  const base = Number(input.base_version || a.head_version);
  const baseV = await loadVersion(db, a, base);
  let files: Record<string, WorkingFile>;
  try {
    files = applyOps(baseV.manifest, ops, await textsByPath(db, a.id, baseV.manifest, pathsToLoad(ops, baseV.manifest))).files;
  } catch (e) {
    throw new FolioError(422, "op_failed", `This suggestion doesn't apply to version ${base}: ${(e as Error).message}`);
  }
  const probe: Manifest = {};
  for (const [p, f] of Object.entries(files)) probe[p] = { hash: f.hash ?? "new", size: f.size, type: f.type };
  const problems = checkManifest(probe);
  if (problems.length) throw new FolioError(422, "limits", problems.join("; "));
  const { data: num, error: e1 } = await db.rpc("next_suggestion_number", { p_artifact: a.id });
  fail(e1, "number the suggestion");
  const title = clampText(input.title, LIMITS.title) || describeOps(ops);
  const { data, error } = await db
    .from("suggestions")
    .insert({
      artifact_id: a.id,
      number: Number(num),
      base_version: base,
      title,
      rationale: clampText(input.rationale, LIMITS.rationale),
      ops,
      author_id: actor.userId,
      agent: actor.agent,
      model: actor.model ?? null,
      via: actor.via,
    })
    .select("*")
    .single();
  fail(error, "save the suggestion");
  const s = data as SuggestionRow;
  await logEvent(db, a.id, actor, "suggested", `#${s.number} ${title}`, { suggestion_number: s.number });
  return { a, suggestion: s, files: await diffWorking(db, a.id, baseV.manifest, files) };
}

export async function listSuggestions(db: Db, actor: Actor, ref: unknown, status?: unknown): Promise<{ a: ArtifactRow; suggestions: Omit<SuggestionRow, "ops">[] }> {
  const { a } = await access(db, actor, ref, "read");
  let q = db.from("suggestions").select("*").eq("artifact_id", a.id).order("number", { ascending: false }).limit(200);
  if (typeof status === "string" && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  fail(error, "list suggestions");
  return {
    a,
    suggestions: ((data ?? []) as SuggestionRow[]).map(({ ops, ...s }) => ({ ...s, ops_count: ops.length, summary: describeOps(ops) })) as never,
  };
}

export async function getSuggestion(db: Db, actor: Actor, ref: unknown, number: unknown): Promise<{ a: ArtifactRow; suggestion: SuggestionRow; files: FileDiff[]; applies_to_head: boolean }> {
  const { a } = await access(db, actor, ref, "read");
  const s = await loadSuggestion(db, a, number);
  const { base, files } = await suggestionFiles(db, a, s);
  let applies = true;
  if (s.status === "open" && s.base_version !== a.head_version) {
    try {
      await applyRebased(db, a, s.base_version, s.ops);
    } catch {
      applies = false;
    }
  }
  return { a, suggestion: s, files: await diffWorking(db, a.id, base, files), applies_to_head: applies };
}

export async function reviewSuggestion(
  db: Db,
  actor: Actor,
  ref: unknown,
  number: unknown,
  decision: unknown,
  note?: unknown
): Promise<{ a: ArtifactRow; suggestion: SuggestionRow; version?: number }> {
  if (decision !== "accept" && decision !== "reject" && decision !== "withdraw") throw new FolioError(400, "decision", "decision is accept, reject or withdraw");
  const { a, role } = await access(db, actor, ref, decision === "withdraw" ? "suggest" : "review");
  const s = await loadSuggestion(db, a, number);
  if (s.status !== "open") throw new FolioError(409, "resolved", `Suggestion #${s.number} is already ${s.status}.`);
  if (decision === "withdraw" && s.author_id !== actor.userId && !can(role, "review")) throw new FolioError(403, "forbidden", "Only its author can withdraw a suggestion.");
  const resolution = {
    resolved_by: actor.userId,
    resolved_agent: actor.agent,
    resolution_note: clampText(note, LIMITS.comment) || null,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (decision !== "accept") {
    const status = decision === "reject" ? "rejected" : "withdrawn";
    const { data, error } = await db.from("suggestions").update({ status, ...resolution }).eq("id", s.id).eq("status", "open").select("*").single();
    fail(error, "update the suggestion");
    await logEvent(db, a.id, actor, `suggestion_${status}`, `#${s.number} ${s.title}${resolution.resolution_note ? `: ${resolution.resolution_note}` : ""}`, { suggestion_number: s.number });
    return { a, suggestion: data as SuggestionRow };
  }
  const r = await applyRebased(db, a, s.base_version, s.ops);
  const manifest = await saveBlobs(db, a.id, r.files, a.owner_id);
  const head = await loadVersion(db, a, r.onto);
  if (sameManifest(manifest, head.manifest)) throw new FolioError(422, "no_change", `Suggestion #${s.number} changes nothing on the current version (already applied?). Reject or withdraw it instead.`);
  const version = await commit(db, a, r.onto, manifest, actor, {
    message: `#${s.number} ${s.title} (suggested by ${s.agent})`,
    kind: "suggestion",
    suggestionId: s.id,
  });
  const { data, error } = await db.from("suggestions").update({ status: "accepted", result_version: version, ...resolution }).eq("id", s.id).select("*").single();
  fail(error, "update the suggestion");
  await logEvent(db, a.id, actor, "suggestion_accepted", `#${s.number} ${s.title} → v${version}`, { version, suggestion_number: s.number });
  return { a, suggestion: data as SuggestionRow, version };
}

export async function reviseSuggestion(
  db: Db,
  actor: Actor,
  ref: unknown,
  number: unknown,
  input: { base_version?: unknown; ops?: unknown; title?: unknown; rationale?: unknown }
): Promise<{ a: ArtifactRow; suggestion: SuggestionRow; files: FileDiff[] }> {
  const { a, role } = await access(db, actor, ref, "suggest");
  const s = await loadSuggestion(db, a, number);
  if (s.status !== "open") throw new FolioError(409, "resolved", `Suggestion #${s.number} is already ${s.status}.`);
  if (s.author_id !== actor.userId && !can(role, "review")) throw new FolioError(403, "forbidden", "Only its author or an editor can revise a suggestion.");
  const ops = input.ops !== undefined ? parseOpsOrThrow(input.ops) : s.ops;
  const base = input.base_version !== undefined ? Number(input.base_version) : s.base_version;
  const baseV = await loadVersion(db, a, base);
  let files: Record<string, WorkingFile>;
  try {
    files = applyOps(baseV.manifest, ops, await textsByPath(db, a.id, baseV.manifest, pathsToLoad(ops, baseV.manifest))).files;
  } catch (e) {
    throw new FolioError(422, "op_failed", `The revised suggestion doesn't apply to version ${base}: ${(e as Error).message}`);
  }
  const patch: Record<string, unknown> = { ops, base_version: base, updated_at: new Date().toISOString() };
  if (typeof input.title === "string" && input.title.trim()) patch.title = clampText(input.title, LIMITS.title);
  if (typeof input.rationale === "string") patch.rationale = clampText(input.rationale, LIMITS.rationale);
  const { data, error } = await db.from("suggestions").update(patch).eq("id", s.id).select("*").single();
  fail(error, "revise the suggestion");
  await logEvent(db, a.id, actor, "suggestion_revised", `#${s.number} revised against v${base}`, { suggestion_number: s.number });
  return { a, suggestion: data as SuggestionRow, files: await diffWorking(db, a.id, baseV.manifest, files) };
}

// ------------------------------------------------------------------ comments

export async function addComment(
  db: Db,
  actor: Actor,
  ref: unknown,
  input: { body: unknown; path?: unknown; anchor?: unknown; version?: unknown; suggestion?: unknown; reply_to?: unknown }
): Promise<{ a: ArtifactRow; comment: Record<string, unknown> }> {
  const { a } = await access(db, actor, ref, "comment");
  const body = clampText(input.body, LIMITS.comment);
  if (!body) throw new FolioError(400, "body", "body (the comment text) is required");
  let path: string | null = null;
  if (input.path !== undefined && input.path !== null && input.path !== "") {
    try {
      path = normalizePath(input.path);
    } catch (e) {
      throw new FolioError(400, "path", (e as Error).message);
    }
  }
  let suggestionId: string | null = null;
  let suggestionNumber: number | undefined;
  if (input.suggestion !== undefined && input.suggestion !== null && input.suggestion !== "") {
    const s = await loadSuggestion(db, a, input.suggestion);
    suggestionId = s.id;
    suggestionNumber = s.number;
  }
  let parentId: string | null = null;
  if (typeof input.reply_to === "string" && input.reply_to) {
    const { data } = await db.from("comments").select("id, parent_id, suggestion_id, path").eq("artifact_id", a.id).eq("id", input.reply_to).maybeSingle();
    if (!data) throw new FolioError(404, "no_comment", "reply_to doesn't name a comment on this artifact");
    parentId = (data.parent_id as string | null) ?? (data.id as string);
    // A reply belongs where its thread is.
    if (!suggestionId && data.suggestion_id) {
      suggestionId = data.suggestion_id as string;
      const { data: s } = await db.from("suggestions").select("number").eq("id", suggestionId).single();
      suggestionNumber = s?.number as number | undefined;
    }
    if (!path && data.path) path = data.path as string;
  }
  let anchor: Record<string, unknown> | null = null;
  if (input.anchor && typeof input.anchor === "object") {
    const an = input.anchor as Record<string, unknown>;
    anchor = {};
    if (typeof an.selector === "string") anchor.selector = an.selector.slice(0, 300);
    if (typeof an.text === "string") anchor.text = an.text.slice(0, 500);
    if (Number.isInteger(an.line)) anchor.line = an.line;
    if (Number.isInteger(an.end_line)) anchor.end_line = an.end_line;
    if (!Object.keys(anchor).length) anchor = null;
  }
  const version = input.version !== undefined && input.version !== null ? (await loadVersion(db, a, Number(input.version))).number : a.head_version;
  const { data, error } = await db
    .from("comments")
    .insert({
      artifact_id: a.id,
      version,
      suggestion_id: suggestionId,
      parent_id: parentId,
      path,
      anchor,
      body,
      author_id: actor.userId,
      agent: actor.agent,
      model: actor.model ?? null,
      via: actor.via,
    })
    .select("*")
    .single();
  fail(error, "save the comment");
  const where = suggestionNumber ? ` on #${suggestionNumber}` : path ? ` on ${path}` : "";
  await logEvent(db, a.id, actor, "commented", `${parentId ? "Replied" : "Commented"}${where}: ${body.slice(0, 140)}`, {
    comment_id: data.id as string,
    version,
    ...(suggestionNumber ? { suggestion_number: suggestionNumber } : {}),
  });
  return { a, comment: publicComment(data as Record<string, unknown>, suggestionNumber) };
}

function publicComment(c: Record<string, unknown>, suggestionNumber?: number | null): Record<string, unknown> {
  return {
    id: c.id,
    body: c.body,
    agent: c.agent,
    model: c.model,
    via: c.via,
    version: c.version,
    path: c.path,
    anchor: c.anchor,
    reply_to: c.parent_id,
    resolved: c.resolved,
    created_at: c.created_at,
    mine: undefined,
    ...(suggestionNumber ? { suggestion: suggestionNumber } : {}),
  };
}

export async function listComments(db: Db, actor: Actor, ref: unknown, opts: { include_resolved?: unknown; suggestion?: unknown } = {}): Promise<{ a: ArtifactRow; comments: Record<string, unknown>[] }> {
  const { a } = await access(db, actor, ref, "read");
  let q = db.from("comments").select("*").eq("artifact_id", a.id).order("created_at").limit(500);
  if (opts.include_resolved !== true) q = q.eq("resolved", false);
  if (opts.suggestion !== undefined && opts.suggestion !== null && opts.suggestion !== "") q = q.eq("suggestion_id", (await loadSuggestion(db, a, opts.suggestion)).id);
  const { data, error } = await q;
  fail(error, "list comments");
  const rows = (data ?? []) as Record<string, unknown>[];
  const sids = [...new Set(rows.map((r) => r.suggestion_id).filter(Boolean))] as string[];
  const nums = new Map<string, number>();
  if (sids.length) {
    const { data: s } = await db.from("suggestions").select("id, number").in("id", sids);
    for (const r of s ?? []) nums.set(r.id as string, r.number as number);
  }
  return {
    a,
    comments: rows.map((c) => ({ ...publicComment(c, c.suggestion_id ? nums.get(c.suggestion_id as string) : null), mine: !!actor.userId && c.author_id === actor.userId })),
  };
}

export async function resolveComment(db: Db, actor: Actor, ref: unknown, commentId: unknown, resolved = true): Promise<{ a: ArtifactRow; id: string; resolved: boolean }> {
  const { a, role } = await access(db, actor, ref, "comment");
  const { data } = await db.from("comments").select("id, author_id, body").eq("artifact_id", a.id).eq("id", String(commentId ?? "")).maybeSingle();
  if (!data) throw new FolioError(404, "no_comment", "No such comment on this artifact.");
  if (data.author_id !== actor.userId && !can(role, "review")) throw new FolioError(403, "forbidden", "Only its author or an editor can resolve a comment.");
  const { error } = await db.from("comments").update({ resolved, resolved_by: resolved ? actor.userId : null }).eq("id", data.id);
  fail(error, "resolve the comment");
  await logEvent(db, a.id, actor, resolved ? "comment_resolved" : "comment_reopened", `${resolved ? "Resolved" : "Reopened"}: ${(data.body as string).slice(0, 120)}`, { comment_id: data.id as string });
  return { a, id: data.id as string, resolved };
}

// ------------------------------------------------------------------ activity

export async function listEvents(db: Db, actor: Actor, ref: unknown, after = 0, limit = 50): Promise<{ a: ArtifactRow; events: Record<string, unknown>[] }> {
  const { a } = await access(db, actor, ref, "read");
  let q = db.from("events").select("id, kind, version, suggestion_number, comment_id, agent, via, summary, created_at").eq("artifact_id", a.id);
  q = after > 0 ? q.gt("id", after).order("id").limit(limit) : q.order("id", { ascending: false }).limit(limit);
  const { data, error } = await q;
  fail(error, "list activity");
  const events = (data ?? []) as Record<string, unknown>[];
  return { a, events: after > 0 ? events : events.reverse() };
}

/** Activity across every artifact the user can open, oldest first after `since` (ISO time). */
export async function activityAcross(db: Db, userId: string, since?: unknown, limit = 100): Promise<Record<string, unknown>[]> {
  const mine = await listArtifacts(db, userId, undefined, 1000);
  if (!mine.length) return [];
  const byId = new Map(mine.map((a) => [a.id, a]));
  let q = db.from("events").select("id, artifact_id, kind, version, suggestion_number, agent, via, summary, created_at").in("artifact_id", [...byId.keys()].slice(0, 500));
  const s = typeof since === "string" && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : null;
  q = s ? q.gt("created_at", s).order("id").limit(limit) : q.order("id", { ascending: false }).limit(Math.min(limit, 30));
  const { data, error } = await q;
  fail(error, "list activity");
  const rows = (data ?? []) as Record<string, unknown>[];
  return (s ? rows : rows.reverse()).map((e) => {
    const a = byId.get(e.artifact_id as string)!;
    return { ...e, artifact: { slug: a.slug, title: a.title } };
  });
}

/**
 * Waits up to `seconds` for something new on the person's artifacts (or one artifact) after a
 * point, and returns as soon as there is: an agent's way to hear about a comment without polling
 * every few seconds itself. Polls the events table every 2.5 s (Workers count each query, so the
 * wait is capped at 25 s; call again to keep waiting).
 */
export async function waitForActivity(
  db: Db,
  actor: Actor,
  input: { artifact?: unknown; after?: unknown; since?: unknown; seconds?: unknown; kinds?: unknown; include_agents?: unknown }
): Promise<{ events: Record<string, unknown>[]; waited: number; last_event_id: number; timed_out: boolean }> {
  if (!actor.userId) throw new FolioError(401, "sign_in", "Sign in first.");
  const seconds = Math.min(25, Math.max(1, Number(input.seconds) || 25));
  let ids: string[];
  let byId: Map<string, { slug: string; title: string }>;
  if (input.artifact) {
    const { a } = await access(db, actor, input.artifact, "read");
    ids = [a.id];
    byId = new Map([[a.id, { slug: a.slug, title: a.title }]]);
  } else {
    const mine = await listArtifacts(db, actor.userId, undefined, 500);
    ids = mine.map((a) => a.id);
    byId = new Map(mine.map((a) => [a.id, { slug: a.slug, title: a.title }]));
  }
  // Start after an event id, else after a time, else from now (only what happens while waiting).
  let after = Number(input.after) || 0;
  if (!after) {
    const since = typeof input.since === "string" && !Number.isNaN(Date.parse(input.since)) ? new Date(input.since).toISOString() : null;
    if (since && ids.length) {
      const { data } = await db.from("events").select("id").in("artifact_id", ids).lte("created_at", since).order("id", { ascending: false }).limit(1);
      after = (data?.[0]?.id as number | undefined) ?? 0;
      if (!after) after = -1; // everything since then is new
    } else {
      const { data } = await db.from("events").select("id").order("id", { ascending: false }).limit(1);
      after = (data?.[0]?.id as number | undefined) ?? 0;
    }
  }
  const kinds = Array.isArray(input.kinds) ? input.kinds.filter((k): k is string => typeof k === "string").slice(0, 20) : [];
  const started = Date.now();
  if (!ids.length) return { events: [], waited: 0, last_event_id: Math.max(0, after), timed_out: true };
  for (;;) {
    let q = db.from("events").select("id, artifact_id, kind, version, suggestion_number, comment_id, agent, via, summary, created_at").in("artifact_id", ids).gt("id", after);
    if (kinds.length) q = q.in("kind", kinds);
    if (input.include_agents !== true) q = q.neq("via", "mcp");
    const { data, error } = await q.order("id").limit(50);
    fail(error, "wait for activity");
    const rows = (data ?? []) as Record<string, unknown>[];
    const waited = Math.round((Date.now() - started) / 1000);
    if (rows.length) {
      return {
        events: rows.map(({ artifact_id, ...e }) => ({ ...e, artifact: byId.get(artifact_id as string) })),
        waited,
        last_event_id: rows[rows.length - 1].id as number,
        timed_out: false,
      };
    }
    if (Date.now() - started + 2500 > seconds * 1000) return { events: [], waited, last_event_id: Math.max(0, after), timed_out: true };
    await new Promise((r) => setTimeout(r, 2500));
  }
}

// ------------------------------------------------------------------ search

export interface SearchHit {
  artifact: ArtifactSummary;
  /** Where the words were found: the title, the description and/or files. */
  matched_in: ("title" | "description" | "files")[];
  files: { path: string; excerpt: string }[];
  score: number;
}

/** Lower-case words of a query, quoted phrases kept together, at most 6. */
export function searchTerms(query: unknown): string[] {
  const q = typeof query === "string" ? query.toLowerCase().trim().slice(0, 200) : "";
  const terms: string[] = [];
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const t = (m[1] ?? m[2]).trim();
    if (t && !terms.includes(t)) terms.push(t);
  }
  return terms.slice(0, 6);
}

/** Readable text around the first match: tags and scripts removed, whitespace folded. */
export function excerpt(raw: string, term: string, width = 160, markup = true): string {
  // The window may start inside a <style> or <script>: drop everything up to its end tag.
  const close = markup ? raw.search(/<\/(style|script)>/i) : -1;
  const open = markup ? raw.search(/<(style|script)\b/i) : -1;
  const cut = close >= 0 && (open < 0 || close < open) ? raw.slice(raw.indexOf(">", close) + 1) : raw;
  const stripped = markup
    ? cut
        .replace(/^[^<]*?>/, " ")
        .replace(/<(script|style)\b[^>]*>[\s\S]*?(<\/\1>|$)/gi, " ")
        .replace(/<[^>]*>?/g, " ")
    : raw;
  const text = stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  const at = text.toLowerCase().indexOf(term);
  if (at < 0) return text.slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  return `${start > 0 ? "…" : ""}${text.slice(start, start + width).trim()}${start + width < text.length ? "…" : ""}`;
}

/**
 * Finds artifacts the person can open whose title, description or current files contain every
 * word of the query (case-insensitive; "quoted phrases" stay together). Best first: title hits,
 * then description, then files, newer first among equals.
 */
export async function searchArtifacts(db: Db, userId: string, query: unknown, limit = 20): Promise<SearchHit[]> {
  const terms = searchTerms(query);
  if (!terms.length) throw new FolioError(400, "query", "query is required: the words to look for.");
  const all = await listArtifacts(db, userId, undefined, 1000);
  if (!all.length) return [];
  const has = (s: string) => terms.every((t) => s.toLowerCase().includes(t));
  const { data, error } = await db.rpc("search_files", { p_artifacts: all.map((a) => a.id), p_terms: terms, p_limit: 100 });
  fail(error, "search");
  const files = new Map<string, { path: string; excerpt: string }[]>();
  for (const r of (data ?? []) as { artifact_id: string; path: string; excerpt: string }[]) {
    if (r.path.startsWith(".folio/")) continue;
    const list = files.get(r.artifact_id) ?? [];
    // Tags are stripped from pages only: in scripts and styles a "<" is code, not markup.
    if (list.length < 3) list.push({ path: r.path, excerpt: excerpt(r.excerpt, terms[0], 160, /\.(html?|svg|xml)$/i.test(r.path)) });
    files.set(r.artifact_id, list);
  }
  const hits: SearchHit[] = [];
  for (const a of all) {
    const matched_in: SearchHit["matched_in"] = [];
    if (has(a.title) || a.slug === terms.join(" ")) matched_in.push("title");
    if (has(a.description)) matched_in.push("description");
    if (files.has(a.id)) matched_in.push("files");
    if (!matched_in.length) continue;
    const score = (matched_in.includes("title") ? 4 : 0) + (matched_in.includes("description") ? 2 : 0) + (files.get(a.id)?.length ?? 0) * 0.5 + (a.favorite ? 0.25 : 0);
    hits.push({ artifact: a, matched_in, files: files.get(a.id) ?? [], score });
  }
  hits.sort((x, y) => y.score - x.score || y.artifact.updated_at.localeCompare(x.artifact.updated_at));
  return hits.slice(0, Math.min(50, Math.max(1, limit)));
}

// ------------------------------------------------------------------ sharing

export async function createInvite(db: Db, actor: Actor, ref: unknown, role: unknown, expiresDays?: unknown): Promise<{ a: ArtifactRow; token: string; role: string; expires_at: string | null }> {
  const { a } = await access(db, actor, ref, "manage");
  if (role !== "editor" && role !== "viewer") throw new FolioError(400, "role", "role is editor or viewer");
  const days = Number(expiresDays);
  const expires_at = Number.isFinite(days) && days > 0 ? new Date(Date.now() + Math.min(days, 365) * 86400_000).toISOString() : null;
  const token = randomToken(PREFIX.invite, 18);
  const { error } = await db.from("invites").insert({ token_hash: await sha256(token), artifact_id: a.id, role, created_by: actor.userId, expires_at });
  fail(error, "create the invite");
  await logEvent(db, a.id, actor, "invite", `Made a share link for ${role}s`);
  return { a, token, role, expires_at };
}

export async function listSharing(db: Db, actor: Actor, ref: unknown): Promise<{ a: ArtifactRow; owner: { id: string; email: string | null }; members: Record<string, unknown>[]; invites: Record<string, unknown>[] }> {
  const { a, role } = await access(db, actor, ref, "read");
  const { data: members } = await db.from("members").select("user_id, role, created_at").eq("artifact_id", a.id).order("created_at");
  const emails = await emailsFor(db, [a.owner_id, ...(members ?? []).map((m) => m.user_id as string)]);
  let invites: Record<string, unknown>[] = [];
  if (role === "owner") {
    const { data } = await db.from("invites").select("id, role, uses, expires_at, revoked, created_at").eq("artifact_id", a.id).eq("revoked", false).order("created_at", { ascending: false });
    invites = (data ?? []) as Record<string, unknown>[];
  }
  return {
    a,
    owner: { id: a.owner_id, email: emails[a.owner_id] ?? null },
    members: (members ?? []).map((m) => ({ user_id: m.user_id, role: m.role, email: emails[m.user_id as string] ?? null, added_at: m.created_at })),
    invites,
  };
}

export async function revokeInvite(db: Db, actor: Actor, ref: unknown, inviteId: unknown): Promise<{ ok: true }> {
  const { a } = await access(db, actor, ref, "manage");
  const { error } = await db.from("invites").update({ revoked: true }).eq("artifact_id", a.id).eq("id", String(inviteId ?? ""));
  fail(error, "revoke the invite");
  return { ok: true };
}

async function findInvite(db: Db, token: string): Promise<{ id: string; artifact_id: string; role: string; uses: number }> {
  if (!token.startsWith(PREFIX.invite)) throw new FolioError(404, "no_invite", "This share link isn't valid.");
  const { data } = await db.from("invites").select("id, artifact_id, role, uses, expires_at, revoked").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data || data.revoked) throw new FolioError(404, "no_invite", "This share link was turned off or never existed. Ask for a new one.");
  if (data.expires_at && Date.parse(data.expires_at as string) < Date.now()) throw new FolioError(410, "expired", "This share link has expired. Ask for a new one.");
  return data as { id: string; artifact_id: string; role: string; uses: number };
}

export async function previewInvite(db: Db, token: string): Promise<{ title: string; role: string; slug: string }> {
  const inv = await findInvite(db, token);
  const { data } = await db.from("artifacts").select("title, slug").eq("id", inv.artifact_id).single();
  return { title: data!.title as string, slug: data!.slug as string, role: inv.role };
}

export async function acceptInvite(db: Db, actor: Actor, token: string): Promise<{ slug: string; role: Role }> {
  if (!actor.userId) throw new FolioError(401, "sign_in", "Sign in to accept.");
  const inv = await findInvite(db, token);
  const { data: a } = await db.from("artifacts").select(ARTIFACT_COLS).eq("id", inv.artifact_id).single();
  const art = a as ArtifactRow;
  if (art.owner_id === actor.userId) return { slug: art.slug, role: "owner" };
  const { data: existing } = await db.from("members").select("role").eq("artifact_id", art.id).eq("user_id", actor.userId).maybeSingle();
  const role: Role = existing?.role === "editor" ? "editor" : (inv.role as Role);
  const { error } = await db.from("members").upsert({ artifact_id: art.id, user_id: actor.userId, role, invited_by: art.owner_id });
  fail(error, "join the artifact");
  await db.from("invites").update({ uses: inv.uses + 1 }).eq("id", inv.id);
  if (!existing) await logEvent(db, art.id, actor, "member_joined", `Joined as ${role}`);
  return { slug: art.slug, role };
}

export async function removeMember(db: Db, actor: Actor, ref: unknown, userId: unknown): Promise<{ ok: true }> {
  const uid = String(userId ?? "");
  const self = uid === actor.userId;
  const { a } = await access(db, actor, ref, self ? "read" : "manage");
  const { error } = await db.from("members").delete().eq("artifact_id", a.id).eq("user_id", uid);
  fail(error, "remove the member");
  await logEvent(db, a.id, actor, "member_removed", self ? "Left the artifact" : "Removed a member");
  return { ok: true };
}

export async function setMemberRole(db: Db, actor: Actor, ref: unknown, userId: unknown, role: unknown): Promise<{ ok: true }> {
  const { a } = await access(db, actor, ref, "manage");
  if (role !== "editor" && role !== "viewer") throw new FolioError(400, "role", "role is editor or viewer");
  const { error } = await db.from("members").update({ role }).eq("artifact_id", a.id).eq("user_id", String(userId ?? ""));
  fail(error, "change the role");
  return { ok: true };
}

// ------------------------------------------------------------------ account

/** Deletes everything Folio keeps for a person (never the shared auth user). */
export async function deleteAccountData(db: Db, userId: string): Promise<void> {
  const { data } = await db.from("artifacts").select("id").eq("owner_id", userId);
  for (const r of data ?? []) await deleteArtifactRow(db, r.id as string);
  for (const t of ["members", "access_tokens", "push_devices", "favorites", "webhooks"]) {
    const { error } = await db.from(t).delete().eq("user_id", userId);
    fail(error, `delete ${t}`);
  }
  await db.from("invites").delete().eq("created_by", userId);
  // Their comments, suggestions and versions on other people's artifacts stay, without the link to them.
  await db.from("comments").update({ author_id: null }).eq("author_id", userId);
  await db.from("suggestions").update({ author_id: null }).eq("author_id", userId);
  await db.from("versions").update({ author_id: null }).eq("author_id", userId);
  await db.from("events").update({ actor_id: null }).eq("actor_id", userId);
}

/** A person in the web app, or in the iPhone app (which sends `X-Folio-Client: iPhone`). */
export function webActor(userId: string | null, client?: string | null): Actor {
  return { userId, agent: client === "iPhone" ? "iPhone" : "Web", via: "web" };
}

export function agentActor(userId: string, parts: { declared?: unknown; client?: string | null; connection?: string | null; model?: unknown }): Actor {
  return {
    userId,
    agent: agentLabel(parts),
    model: typeof parts.model === "string" && parts.model.trim() ? parts.model.trim().slice(0, LIMITS.agent) : null,
    via: "mcp",
  };
}
