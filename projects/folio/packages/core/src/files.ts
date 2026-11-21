// Files inside an artifact: paths, content types and the limits every surface enforces.

/** What a version records for each file (its manifest entry). */
export interface FileMeta {
  /** SHA-256 of the file's bytes (hex). */
  hash: string;
  size: number;
  type: string;
}

export type Manifest = Record<string, FileMeta>;

export const LIMITS = {
  /** Files in one version. */
  files: 200,
  /** One text file (bytes, UTF-8). */
  textBytes: 2 * 1024 * 1024,
  /** One binary file (bytes). */
  binaryBytes: 8 * 1024 * 1024,
  /** All files of one version together. */
  versionBytes: 25 * 1024 * 1024,
  /** Operations in one edit or suggestion. */
  ops: 100,
  /** Artifacts one person owns. */
  artifacts: 1000,
  title: 140,
  description: 1000,
  message: 500,
  comment: 10_000,
  /** An artifact's live data (JSON, `.folio/data.json`). */
  dataBytes: 256 * 1024,
  rationale: 10_000,
  agent: 80,
} as const;

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  tsv: "text/tab-separated-values; charset=utf-8",
  svg: "image/svg+xml",
  xml: "application/xml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  ts: "text/plain; charset=utf-8",
  tsx: "text/plain; charset=utf-8",
  jsx: "text/plain; charset=utf-8",
  py: "text/plain; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  wasm: "application/wasm",
};

/** The content type Folio serves a path with (by extension). */
export function contentTypeFor(path: string): string {
  const ext = path.split("/").pop()!.split(".").pop()!.toLowerCase();
  return TYPES[ext] ?? "application/octet-stream";
}

/** Text files are stored as text, edited with `replace` and shown in diffs; the rest are bytes. */
export function isTextType(type: string): boolean {
  const t = type.toLowerCase();
  return (
    t.startsWith("text/") ||
    t.startsWith("application/json") ||
    t.startsWith("application/xml") ||
    t.startsWith("image/svg+xml") ||
    t.startsWith("application/javascript")
  );
}

/**
 * Normalizes and validates a file path: relative, `/`-separated, no `.`/`..` segments, no
 * control characters, at most 200 characters. Returns the normalized path or throws.
 */
/** Where an artifact's pages read its live data (set by agents, outside the version history). */
export const DATA_DIR = ".folio";
export const DATA_PATH = ".folio/data.json";

export function normalizePath(input: unknown): string {
  if (typeof input !== "string") throw new Error("path must be a string");
  let p = input.trim().replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/^\/+/, "");
  p = p.replace(/\/{2,}/g, "/");
  if (!p) throw new Error("path is empty");
  if (p.length > 200) throw new Error(`path is longer than 200 characters: ${p.slice(0, 40)}…`);
  if (p.endsWith("/")) throw new Error(`path names a folder, not a file: ${p}`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(p)) throw new Error("path contains control characters");
  for (const seg of p.split("/")) {
    if (seg === "." || seg === "..") throw new Error(`path may not contain "${seg}" segments: ${p}`);
  }
  if (p.split("/")[0] === DATA_DIR) throw new Error(`${DATA_DIR}/ is Folio's own folder (${DATA_PATH} is the artifact's live data, set with set_data); pick another path`);
  return p;
}

export function utf8Length(s: string): number {
  return new TextEncoder().encode(s).length;
}

export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const d = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(clean)) throw new Error("base64 content isn't valid base64");
  const std = clean.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** The file a viewer opens first: index.html, else the only/first .html file, else the first file. */
export function entryFile(paths: string[]): string | null {
  if (!paths.length) return null;
  if (paths.includes("index.html")) return "index.html";
  const html = paths.filter((p) => /\.html?$/i.test(p)).sort();
  if (html.length) return html.find((p) => !p.includes("/")) ?? html[0];
  return [...paths].sort()[0];
}

export function manifestBytes(m: Manifest): number {
  return Object.values(m).reduce((n, f) => n + f.size, 0);
}

/** Checks a whole manifest against the limits; returns the problems (empty when fine). */
export function checkManifest(m: Manifest): string[] {
  const problems: string[] = [];
  const paths = Object.keys(m);
  if (!paths.length) problems.push("an artifact needs at least one file");
  if (paths.length > LIMITS.files) problems.push(`at most ${LIMITS.files} files per artifact (this has ${paths.length})`);
  const total = manifestBytes(m);
  if (total > LIMITS.versionBytes) problems.push(`all files together may be at most ${mb(LIMITS.versionBytes)} (this is ${mb(total)})`);
  for (const [p, f] of Object.entries(m)) {
    const max = isTextType(f.type) ? LIMITS.textBytes : LIMITS.binaryBytes;
    if (f.size > max) problems.push(`${p} is ${mb(f.size)}; a ${isTextType(f.type) ? "text" : "binary"} file may be at most ${mb(max)}`);
  }
  // A path can't be both a file and a folder ("a" and "a/b").
  const set = new Set(paths);
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      if (set.has(prefix)) problems.push(`${prefix} is a file, so ${p} can't be inside it`);
    }
  }
  return problems;
}

function mb(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}
