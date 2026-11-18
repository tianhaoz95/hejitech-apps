// Line diffs between two texts (Myers' O(ND) algorithm) grouped into hunks, plus a unified-diff
// rendering for agents. Used for versions, suggestions and the web viewer.

export type DiffLine = { kind: "same" | "add" | "del"; text: string; a?: number; b?: number };

export interface Hunk {
  aStart: number;
  aLines: number;
  bStart: number;
  bLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  status: "added" | "deleted" | "modified" | "renamed" | "binary";
  from?: string;
  hunks: Hunk[];
  added: number;
  removed: number;
  /** Set when the diff was too large to compute line by line. */
  truncated?: boolean;
}

const MAX_D = 4000;

function splitLines(s: string): string[] {
  if (s === "") return [];
  const lines = s.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Edit script between two line arrays. Falls back to "delete all, add all" past MAX_D edits. */
export function diffLines(aText: string, bText: string): { lines: DiffLine[]; truncated: boolean } {
  const a = splitLines(aText);
  const b = splitLines(bText);
  // Trim common prefix/suffix: most edits are small and local.
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf);
  const B = b.slice(pre, b.length - suf);

  const head: DiffLine[] = a.slice(0, pre).map((text, i) => ({ kind: "same", text, a: i + 1, b: i + 1 }));
  const tail: DiffLine[] = a.slice(a.length - suf).map((text, i) => ({
    kind: "same",
    text,
    a: a.length - suf + i + 1,
    b: b.length - suf + i + 1,
  }));

  const mid = myers(A, B);
  let truncated = false;
  let body: DiffLine[];
  if (mid) {
    body = mid.map((l) => ({ ...l, a: l.a !== undefined ? l.a + pre : undefined, b: l.b !== undefined ? l.b + pre : undefined }));
  } else {
    truncated = true;
    body = [
      ...A.map((text, i) => ({ kind: "del" as const, text, a: pre + i + 1 })),
      ...B.map((text, i) => ({ kind: "add" as const, text, b: pre + i + 1 })),
    ];
  }
  return { lines: [...head, ...body, ...tail], truncated };
}

function myers(a: string[], b: string[]): DiffLine[] | null {
  const n = a.length;
  const m = b.length;
  if (!n && !m) return [];
  if (!n) return b.map((text, i) => ({ kind: "add", text, b: i + 1 }));
  if (!m) return a.map((text, i) => ({ kind: "del", text, a: i + 1 }));
  const max = Math.min(n + m, MAX_D);
  const offset = max;
  let v: Int32Array = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = false;
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) x = v[offset + k + 1];
      else x = v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        trace.push(v.slice());
        break outer;
      }
    }
  }
  if (!found) return null;
  // Backtrack.
  const out: DiffLine[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 2; d >= 0 && (x > 0 || y > 0); d--) {
    v = trace[d];
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = d === 0 ? 0 : v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      out.push({ kind: "same", text: a[x - 1], a: x, b: y });
      x--;
      y--;
    }
    if (d === 0) break;
    if (x === prevX) {
      out.push({ kind: "add", text: b[y - 1], b: y });
      y--;
    } else {
      out.push({ kind: "del", text: a[x - 1], a: x });
      x--;
    }
  }
  while (x > 0 && y > 0) {
    out.push({ kind: "same", text: a[x - 1], a: x, b: y });
    x--;
    y--;
  }
  return out.reverse();
}

/** Groups a line diff into hunks with `context` unchanged lines around each change. */
export function toHunks(lines: DiffLine[], context = 3): Hunk[] {
  const hunks: Hunk[] = [];
  const changes = lines.map((l, i) => (l.kind !== "same" ? i : -1)).filter((i) => i >= 0);
  if (!changes.length) return hunks;
  let start = Math.max(0, changes[0] - context);
  let end = Math.min(lines.length - 1, changes[0] + context);
  const flush = () => {
    const slice = lines.slice(start, end + 1);
    const firstA = slice.find((l) => l.a !== undefined)?.a ?? 0;
    const firstB = slice.find((l) => l.b !== undefined)?.b ?? 0;
    hunks.push({
      aStart: firstA || (slice[0].b ?? 1),
      aLines: slice.filter((l) => l.kind !== "add").length,
      bStart: firstB || (slice[0].a ?? 1),
      bLines: slice.filter((l) => l.kind !== "del").length,
      lines: slice,
    });
  };
  for (const c of changes.slice(1)) {
    if (c - context <= end + 1) end = Math.min(lines.length - 1, c + context);
    else {
      flush();
      start = Math.max(0, c - context);
      end = Math.min(lines.length - 1, c + context);
    }
  }
  flush();
  return hunks;
}

export function diffText(path: string, a: string | null, b: string | null, opts: { from?: string } = {}): FileDiff {
  const { lines, truncated } = diffLines(a ?? "", b ?? "");
  const hunks = toHunks(lines);
  return {
    path,
    status: a === null ? "added" : b === null ? "deleted" : opts.from ? "renamed" : "modified",
    ...(opts.from ? { from: opts.from } : {}),
    hunks,
    added: lines.filter((l) => l.kind === "add").length,
    removed: lines.filter((l) => l.kind === "del").length,
    ...(truncated ? { truncated } : {}),
  };
}

/** Renders file diffs as a unified diff (what agents read). */
export function unifiedDiff(diffs: FileDiff[], labels: { a: string; b: string } = { a: "a", b: "b" }): string {
  const out: string[] = [];
  for (const d of diffs) {
    const aPath = d.status === "added" ? "/dev/null" : `${labels.a}/${d.from ?? d.path}`;
    const bPath = d.status === "deleted" ? "/dev/null" : `${labels.b}/${d.path}`;
    out.push(`--- ${aPath}`, `+++ ${bPath}`);
    if (d.status === "binary") {
      out.push("Binary file changed");
      continue;
    }
    for (const h of d.hunks) {
      out.push(`@@ -${h.aStart},${h.aLines} +${h.bStart},${h.bLines} @@`);
      for (const l of h.lines) out.push((l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ") + l.text);
    }
    if (d.truncated) out.push("(diff too large: shown as a full rewrite)");
  }
  return out.join("\n");
}
