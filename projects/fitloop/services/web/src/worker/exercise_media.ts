import { findCatalogExercise, renderProceduralPresetGif } from "@fitloop/core";
import { BUCKET, type Db } from "./store.ts";

export const MAX_GIF_BYTES = 10 * 1024 * 1024; // 10 MB

export function normalizeExerciseSlug(exercise: string): string {
  const s = exercise
    .toLowerCase()
    .trim()
    .replace(/\.gif$/i, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) throw new Error("exercise name or slug is required");
  return s;
}

export function isGif(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  const h = String.fromCharCode(...bytes.subarray(0, 6));
  return h === "GIF87a" || h === "GIF89a";
}

export interface UploadGifOptions {
  sourceUrl?: string;
  dataBase64?: string;
  rawBytes?: Uint8Array;
  preset?: string;
}

export interface UploadGifResult {
  ok: true;
  exercise: string;
  gifUrl: string;
  size_bytes: number;
}

/**
 * On-demand cache resolver:
 * 1. Checks Supabase Storage for cached `exercises/<slug>.gif`.
 * 2. If not found, resolves via procedural rigging presets or the 1,300+ item open exercise dataset.
 * 3. Persists fetched/rendered GIF in Supabase Storage.
 * 4. Returns GIF bytes.
 */
export async function getOrResolveExerciseGif(db: Db, exercise: string): Promise<Uint8Array | null> {
  const slug = normalizeExerciseSlug(exercise);
  const key = `exercises/${slug}.gif`;

  // 1. Check if already cached in Supabase Storage
  const { data, error } = await db.storage.from(BUCKET).download(key);
  if (!error && data) {
    const buf = await data.arrayBuffer();
    return new Uint8Array(buf);
  }

  // 2. Resolve via catalog or procedural rigging
  const resolved = findCatalogExercise(slug);
  if (!resolved) return null;

  let bytes: Uint8Array | null = null;
  if (resolved.type === "procedural") {
    bytes = renderProceduralPresetGif(resolved.preset);
  } else if (resolved.type === "dataset") {
    try {
      let res = await fetch(resolved.primaryUrl);
      if (!res.ok) {
        res = await fetch(resolved.fallbackUrl);
      }
      if (res.ok) {
        const buf = await res.arrayBuffer();
        bytes = new Uint8Array(buf);
      }
    } catch {
      bytes = null;
    }
  }

  if (!bytes || !bytes.length || !isGif(bytes)) {
    return null;
  }

  // 3. Cache to Supabase Storage for subsequent instant edge serving
  try {
    await db.storage.from(BUCKET).upload(key, bytes, {
      contentType: "image/gif",
      upsert: true,
    });
  } catch {
    // Non-fatal if cache upload fails; return bytes to client anyway
  }

  return bytes;
}

export async function uploadExerciseGif(
  db: Db,
  publicUrl: string,
  exercise: string,
  opts: UploadGifOptions,
): Promise<UploadGifResult> {
  const slug = normalizeExerciseSlug(exercise);
  let bytes: Uint8Array | null = null;

  if (opts.rawBytes && opts.rawBytes.length > 0) {
    bytes = opts.rawBytes;
  } else if (opts.dataBase64) {
    const clean = opts.dataBase64.replace(/^data:image\/[a-z0-9+]+;base64,/i, "").trim();
    const bin = atob(clean);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else if (opts.sourceUrl) {
    if (!/^https?:\/\//i.test(opts.sourceUrl)) {
      throw new Error("source_url must be a valid HTTP or HTTPS URL");
    }
    const res = await fetch(opts.sourceUrl);
    if (!res.ok) {
      throw new Error(`failed to fetch GIF from source_url (${res.status} ${res.statusText})`);
    }
    const buf = await res.arrayBuffer();
    bytes = new Uint8Array(buf);
  } else if (opts.preset) {
    bytes = renderProceduralPresetGif(opts.preset);
    if (!bytes) {
      throw new Error(`unknown procedural preset "${opts.preset}"`);
    }
  } else {
    // Auto-resolve from catalog or procedural rigging if no custom data provided
    bytes = await getOrResolveExerciseGif(db, slug);
    if (!bytes) {
      throw new Error(
        "must provide either source_url, data_base64, raw GIF bytes, or a known catalog exercise/preset name",
      );
    }
  }

  if (!bytes || !bytes.length) {
    throw new Error("empty GIF data");
  }
  if (bytes.length > MAX_GIF_BYTES) {
    throw new Error(`GIF exceeds 10 MB limit (${(bytes.length / (1024 * 1024)).toFixed(2)} MB)`);
  }
  if (!isGif(bytes)) {
    throw new Error("file is not a valid GIF (must start with GIF87a or GIF89a header)");
  }

  const key = `exercises/${slug}.gif`;
  const up = await db.storage.from(BUCKET).upload(key, bytes, {
    contentType: "image/gif",
    upsert: true,
  });

  if (up.error) {
    throw new Error(`failed to store GIF in FitLoop storage: ${up.error.message}`);
  }

  const base = publicUrl.replace(/\/+$/, "");
  const gifUrl = `${base}/api/exercises/${slug}.gif`;

  return {
    ok: true,
    exercise: slug,
    gifUrl,
    size_bytes: bytes.length,
  };
}
