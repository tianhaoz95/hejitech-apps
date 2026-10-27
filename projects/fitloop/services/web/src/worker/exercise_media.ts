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
}

export interface UploadGifResult {
  ok: true;
  exercise: string;
  gifUrl: string;
  size_bytes: number;
}

export async function uploadExerciseGif(
  db: Db,
  publicUrl: string,
  exercise: string,
  opts: UploadGifOptions,
): Promise<UploadGifResult> {
  const slug = normalizeExerciseSlug(exercise);
  let bytes: Uint8Array;

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
  } else {
    throw new Error("must provide either source_url, data_base64, or raw GIF bytes");
  }

  if (!bytes.length) {
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
