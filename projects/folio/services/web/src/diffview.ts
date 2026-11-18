// Renders the API's FileDiff[] (see @folio/core diff.ts) as side-by-side-numbered unified hunks.
import { el } from "./supabase.ts";

export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
  a?: number;
  b?: number;
}
export interface FileDiff {
  path: string;
  status: "added" | "deleted" | "modified" | "renamed" | "binary";
  from?: string;
  hunks: { aStart: number; aLines: number; bStart: number; bLines: number; lines: DiffLine[] }[];
  added: number;
  removed: number;
  truncated?: boolean;
}

const LABEL: Record<FileDiff["status"], string> = { added: "new", deleted: "deleted", modified: "", renamed: "renamed", binary: "binary" };

export function diffView(files: FileDiff[]): HTMLElement {
  if (!files.length) return el("p", { class: "muted small" }, "No changes.");
  return el(
    "div",
    {},
    ...files.map((f) => {
      const head = el(
        "div",
        { class: "diff-head" },
        el("span", {}, f.from ? `${f.from} → ${f.path}` : f.path),
        LABEL[f.status] && el("span", { class: "pill" }, LABEL[f.status]),
        el("span", { class: "stat" }, el("span", { class: "plus" }, `+${f.added}`), " ", el("span", { class: "minus" }, `−${f.removed}`))
      );
      const body = el("div", { class: "diff-body" });
      if (f.status === "binary" || (f.status !== "modified" && !f.hunks.length && f.status !== "added" && f.status !== "deleted")) {
        body.append(el("div", { class: "diff-note" }, f.status === "renamed" ? "Moved, contents unchanged." : "Binary file changed."));
      } else if (!f.hunks.length) {
        body.append(el("div", { class: "diff-note" }, f.status === "added" ? "Empty file." : "No line changes."));
      }
      for (const h of f.hunks) {
        body.append(el("div", { class: "diff-hunk" }, `@@ −${h.aStart},${h.aLines} +${h.bStart},${h.bLines} @@`));
        for (const l of h.lines.slice(0, 2000)) {
          body.append(
            el(
              "div",
              { class: `diff-line ${l.kind === "same" ? "" : l.kind}` },
              el("span", { class: "n" }, l.a ?? ""),
              el("span", { class: "n" }, l.b ?? ""),
              el("span", { class: "t" }, (l.kind === "add" ? "+ " : l.kind === "del" ? "− " : "  ") + l.text)
            )
          );
        }
      }
      if (f.truncated) body.append(el("div", { class: "diff-note" }, "Large change, shown as a full rewrite."));
      return el("div", { class: "diff" }, head, body);
    })
  );
}
