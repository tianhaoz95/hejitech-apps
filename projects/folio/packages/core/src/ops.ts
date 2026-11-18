// Edit operations: the only way an artifact changes. An edit (or a suggestion) is a list of ops
// applied in order to one version's files; the result becomes the next version.
import { base64ToBytes, contentTypeFor, isTextType, LIMITS, normalizePath, utf8Length, type Manifest } from "./files.ts";

export type EditOp =
  /** Creates or overwrites a file: `content` (text) or `base64` (bytes). */
  | { op: "write"; path: string; content?: string; base64?: string; content_type?: string }
  /** Replaces `old` with `new` in a text file. `old` must match exactly once unless `all` is set. */
  | { op: "replace"; path: string; old: string; new: string; all?: boolean }
  | { op: "delete"; path: string }
  | { op: "rename"; path: string; to: string };

/** A file while ops are applied: unchanged files keep their hash, changed ones carry content. */
export interface WorkingFile {
  type: string;
  size: number;
  /** Set for files unchanged since the base version. */
  hash?: string;
  text?: string;
  bytes?: Uint8Array;
}

export class OpError extends Error {
  constructor(
    readonly index: number,
    message: string
  ) {
    super(index >= 0 ? `ops[${index}]: ${message}` : message);
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Validates untrusted input into ops (accepts a few common aliases agents use). */
export function parseOps(input: unknown): EditOp[] {
  if (!Array.isArray(input)) throw new OpError(-1, "ops must be an array");
  if (!input.length) throw new OpError(-1, "ops is empty: nothing to change");
  if (input.length > LIMITS.ops) throw new OpError(-1, `at most ${LIMITS.ops} ops per edit`);
  return input.map((raw, i) => {
    if (!raw || typeof raw !== "object") throw new OpError(i, "each op must be an object");
    const o = raw as Record<string, unknown>;
    const kind = str(o.op) ?? str(o.type) ?? str(o.kind);
    let path: string;
    try {
      path = normalizePath(o.path ?? o.file);
    } catch (e) {
      throw new OpError(i, (e as Error).message);
    }
    switch (kind) {
      case "write":
      case "create":
      case "put": {
        const content = str(o.content) ?? str(o.text);
        const base64 = str(o.base64);
        if (content === undefined && base64 === undefined) throw new OpError(i, `write ${path}: give content (text) or base64 (bytes)`);
        if (content !== undefined && base64 !== undefined) throw new OpError(i, `write ${path}: give content or base64, not both`);
        const type = str(o.content_type) ?? str(o.contentType);
        return { op: "write", path, ...(content !== undefined ? { content } : { base64 }), ...(type ? { content_type: type } : {}) };
      }
      case "replace":
      case "str_replace":
      case "edit": {
        const oldS = str(o.old) ?? str(o.old_string) ?? str(o.old_str) ?? str(o.find) ?? str(o.search);
        const newS = str(o.new) ?? str(o.new_string) ?? str(o.new_str) ?? str(o.replace) ?? str(o.replacement);
        if (oldS === undefined || newS === undefined) throw new OpError(i, `replace ${path}: give old and new`);
        if (oldS === "") throw new OpError(i, `replace ${path}: old is empty; use write to set a whole file`);
        if (oldS === newS) throw new OpError(i, `replace ${path}: old and new are the same`);
        return { op: "replace", path, old: oldS, new: newS, ...(o.all === true || o.replace_all === true ? { all: true } : {}) };
      }
      case "delete":
      case "remove":
        return { op: "delete", path };
      case "rename":
      case "move": {
        let to: string;
        try {
          to = normalizePath(o.to ?? o.new_path ?? o.destination);
        } catch (e) {
          throw new OpError(i, `rename ${path}: ${(e as Error).message}`);
        }
        if (to === path) throw new OpError(i, `rename ${path}: to is the same path`);
        return { op: "rename", path, to };
      }
    }
    throw new OpError(i, `unknown op "${kind ?? ""}" (use write, replace, delete or rename)`);
  });
}

/** Paths whose current text must be loaded before `applyOps` (replace targets from the base). */
export function pathsToLoad(ops: EditOp[], manifest: Manifest): string[] {
  const need = new Set<string>();
  const fresh = new Set<string>();
  const alias = new Map<string, string>(); // current path -> base path it came from
  for (const op of ops) {
    if (op.op === "write") fresh.add(op.path);
    if (op.op === "rename") {
      const from = alias.get(op.path) ?? op.path;
      if (!fresh.has(op.path)) alias.set(op.to, from);
      else fresh.add(op.to);
    }
    if (op.op === "replace" && !fresh.has(op.path)) {
      const base = alias.get(op.path) ?? op.path;
      if (manifest[base] && isTextType(manifest[base].type)) need.add(base);
    }
  }
  return [...need];
}

function countOccurrences(hay: string, needle: string): number {
  let n = 0;
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) n++;
  return n;
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Applies ops to a version's files. `texts` holds the current text of every path `pathsToLoad`
 * returned. Returns the new file set and the paths that changed; throws OpError on the first op
 * that can't apply (nothing is partially applied).
 */
export function applyOps(
  manifest: Manifest,
  ops: EditOp[],
  texts: Record<string, string>
): { files: Record<string, WorkingFile>; changed: string[] } {
  const files: Record<string, WorkingFile> = {};
  for (const [p, f] of Object.entries(manifest)) {
    files[p] = { type: f.type, size: f.size, hash: f.hash, ...(texts[p] !== undefined ? { text: texts[p] } : {}) };
  }
  const changed = new Set<string>();
  const touch = (p: string) => changed.add(p);

  ops.forEach((op, i) => {
    switch (op.op) {
      case "write": {
        const type = op.content_type?.trim() || contentTypeFor(op.path);
        if (op.content !== undefined) {
          if (!isTextType(type)) throw new OpError(i, `write ${op.path}: ${type} is binary; send base64`);
          files[op.path] = { type, size: utf8Length(op.content), text: op.content };
        } else {
          let bytes: Uint8Array;
          try {
            bytes = base64ToBytes(op.base64!);
          } catch (e) {
            throw new OpError(i, `write ${op.path}: ${(e as Error).message}`);
          }
          if (isTextType(type)) {
            const text = new TextDecoder("utf-8").decode(bytes);
            files[op.path] = { type, size: utf8Length(text), text };
          } else {
            files[op.path] = { type, size: bytes.length, bytes };
          }
        }
        touch(op.path);
        return;
      }
      case "replace": {
        const f = files[op.path];
        if (!f) throw new OpError(i, `replace ${op.path}: no such file${hintPaths(files, op.path)}`);
        if (!isTextType(f.type)) throw new OpError(i, `replace ${op.path}: ${f.type} is binary; use write with base64`);
        if (f.text === undefined) throw new OpError(i, `replace ${op.path}: file text wasn't loaded`);
        const n = countOccurrences(f.text, op.old);
        if (n === 0) {
          const loose = squash(f.text).includes(squash(op.old));
          throw new OpError(
            i,
            `replace ${op.path}: old text not found${loose ? " (it matches when whitespace is ignored: copy the exact spacing and line breaks)" : ""}. Read the file again and copy old exactly.`
          );
        }
        if (n > 1 && !op.all) throw new OpError(i, `replace ${op.path}: old text matches ${n} places; include more surrounding text so it matches once, or set all: true`);
        const text = op.all ? f.text.split(op.old).join(op.new) : f.text.replace(op.old, () => op.new);
        files[op.path] = { type: f.type, size: utf8Length(text), text };
        touch(op.path);
        return;
      }
      case "delete": {
        if (!files[op.path]) throw new OpError(i, `delete ${op.path}: no such file${hintPaths(files, op.path)}`);
        delete files[op.path];
        touch(op.path);
        return;
      }
      case "rename": {
        const f = files[op.path];
        if (!f) throw new OpError(i, `rename ${op.path}: no such file${hintPaths(files, op.path)}`);
        if (files[op.to]) throw new OpError(i, `rename ${op.path}: ${op.to} already exists (delete it first)`);
        delete files[op.path];
        files[op.to] = f;
        touch(op.path);
        touch(op.to);
        return;
      }
    }
  });
  return { files, changed: [...changed].sort() };
}

function hintPaths(files: Record<string, WorkingFile>, wanted: string): string {
  const paths = Object.keys(files).sort();
  if (!paths.length) return "";
  const base = wanted.split("/").pop()!.toLowerCase();
  const close = paths.filter((p) => p.toLowerCase().endsWith(base) || p.toLowerCase().includes(base.replace(/\.[^.]+$/, "")));
  const list = (close.length ? close : paths).slice(0, 8).join(", ");
  return ` (files: ${list}${!close.length && paths.length > 8 ? ", …" : ""})`;
}

/** A one-line description of ops for activity feeds ("replace in index.html, write data.json"). */
export function describeOps(ops: EditOp[]): string {
  const parts = ops.map((o) => (o.op === "rename" ? `rename ${o.path} → ${o.to}` : o.op === "replace" ? `edit ${o.path}` : `${o.op} ${o.path}`));
  const uniq = [...new Set(parts)];
  return uniq.length > 4 ? `${uniq.slice(0, 4).join(", ")} and ${uniq.length - 4} more` : uniq.join(", ");
}
