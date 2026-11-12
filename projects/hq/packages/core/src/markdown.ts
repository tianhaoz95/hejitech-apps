// Markdown for card text (why, plan, verify), comments and request threads, and the document a
// figure is shown in. Card text is written by agents that read CI logs, issues and web pages, and it
// is shown inside a page that holds a signed-in session, so this renderer is safe by construction:
// every character of the source is escaped, the only tags in the output are the ones written here,
// raw HTML never passes, links are http(s)/mailto only and nothing is loaded from the network (an
// image becomes a link). Drawings are separate: `![title](figure:<id>)` leaves a placeholder that
// the portal and the app fill with a sandboxed frame (figureDocument below).

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

const SAFE_URL = /^(https?:\/\/|mailto:)[^\s<>"']+$/i;
const FIGURE_REF = /^figure:([a-z0-9][a-z0-9-]{0,39})$/;
/** A paragraph that is only a figure reference. */
const FIGURE_LINE = /^\s*!\[([^\]]*)\]\(\s*figure:([a-z0-9][a-z0-9-]{0,39})\s*\)\s*$/;

/** Inline markdown → HTML. The input is raw text; everything is escaped here. */
function inline(src: string): string {
  const kept: string[] = [];
  const keep = (html: string) => `\u0000${kept.push(html) - 1}\u0000`;
  // Code spans first: nothing inside them is markdown.
  let s = src.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_m, _t, code: string) => keep(`<code>${escapeHtml(code.trim())}</code>`));
  s = escapeHtml(s);
  // Images never load: a figure reference becomes its title, anything else a link.
  s = s.replace(/!\[([^\]]*)\]\(\s*([^()\s]+)\s*\)/g, (_m, alt: string, url: string) => {
    if (FIGURE_REF.test(url)) return keep(`<em>${alt || "figure"}</em>`);
    return SAFE_URL.test(url) ? keep(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${alt || "image"}</a>`) : alt;
  });
  s = s.replace(/\[([^\]]+)\]\(\s*([^()\s]+)(?:\s+&quot;[^&]*&quot;)?\s*\)/g, (_m, text: string, url: string) =>
    SAFE_URL.test(url) ? keep(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${emphasis(text)}</a>`) : text
  );
  s = s.replace(/&lt;((?:https?:\/\/|mailto:)[^\s<>"']+?)&gt;/g, (_m, url: string) => keep(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"']*[^\s<>"'.,;:!?)\]])/g, (_m, pre: string, url: string) => `${pre}${keep(`<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`)}`);
  s = emphasis(s);
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)]);
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*([^\s*](?:[^*]*[^\s*])?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^\w])__([^\s_](?:[^_]*[^\s_])?)__(?![\w])/g, "$1<strong>$2</strong>")
    .replace(/\*([^\s*](?:[^*]*[^\s*])?)\*/g, "<em>$1</em>")
    .replace(/(^|[^\w])_([^\s_](?:[^_]*[^\s_])?)_(?![\w])/g, "$1<em>$2</em>")
    .replace(/~~([^\s~](?:[^~]*[^\s~])?)~~/g, "<del>$1</del>");
}

const FENCE = /^ {0,3}(```+|~~~+)\s*([\w+-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const QUOTE = /^ {0,3}>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

const cells = (line: string): string[] => {
  const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
};

const startsBlock = (line: string, next: string | undefined): boolean =>
  FENCE.test(line) || HEADING.test(line) || RULE.test(line) || ITEM.test(line) || QUOTE.test(line) || FIGURE_LINE.test(line) || (line.includes("|") && next !== undefined && TABLE_SEP.test(next) && next.includes("-"));

function blocks(lines: string[], depth: number): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(FENCE);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !(lines[i].trim().startsWith(fence[1][0].repeat(3)) && /^ {0,3}(`{3,}|~{3,})\s*$/.test(lines[i]))) body.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    const fig = line.match(FIGURE_LINE);
    if (fig) {
      out.push(`<div class="md-figure" data-figure="${fig[2]}" data-title="${escapeHtml(fig[1])}"></div>`);
      i++;
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      // Card sections already own h3, so markdown headings start one level below.
      const level = Math.min(6, h[1].length + 3);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (RULE.test(line)) { out.push("<hr>"); i++; continue; }

    if (QUOTE.test(line) && depth < 6) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim() && (QUOTE.test(lines[i]) || !startsBlock(lines[i], lines[i + 1]))) {
        body.push(lines[i].match(QUOTE)?.[1] ?? lines[i]);
        i++;
      }
      out.push(`<blockquote>${blocks(body, depth + 1)}</blockquote>`);
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) rows.push(cells(lines[i++]));
      const cell = (tag: string, c: string, k: number) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ""}>${inline(c ?? "")}</${tag}>`;
      out.push(
        `<div class="md-table"><table><thead><tr>${head.map((c, k) => cell("th", c, k)).join("")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${head.map((_h, k) => cell("td", r[k] ?? "", k)).join("")}</tr>`)
          .join("")}</tbody></table></div>`
      );
      continue;
    }

    const item = line.match(ITEM);
    if (item && depth < 6) {
      const base = item[1].length;
      const ordered = /\d/.test(item[2]);
      const items: string[][] = [];
      while (i < lines.length) {
        const m = lines[i].match(ITEM);
        if (m && m[1].length <= base + 1 && /\d/.test(m[2]) === ordered) {
          items.push([m[3]]);
          i++;
          continue;
        }
        const blank = !lines[i].trim();
        const indent = lines[i].match(/^\s*/)![0].length;
        // A deeper line (or a blank one followed by a deeper line) continues the current item.
        if (!blank && indent > base + 1) { items[items.length - 1].push(lines[i].slice(Math.min(indent, base + 2))); i++; continue; }
        if (blank && i + 1 < lines.length && lines[i + 1].trim() && (lines[i + 1].match(/^\s*/)![0].length > base + 1 || (lines[i + 1].match(ITEM)?.[1].length ?? 99) <= base + 1 && /\d/.test(lines[i + 1].match(ITEM)![2]) === ordered)) {
          if (lines[i + 1].match(/^\s*/)![0].length > base + 1) items[items.length - 1].push("");
          i++;
          continue;
        }
        if (!blank && !m && !startsBlock(lines[i], lines[i + 1])) { items[items.length - 1].push(lines[i].trim()); i++; continue; }
        break;
      }
      const start = ordered ? Number(item[2].replace(/\D/g, "")) : 1;
      const li = items.map((body) => {
        const task = body[0].match(/^\[([ xX])\]\s+(.*)$/);
        if (task) body[0] = `${task[1] === " " ? "☐" : "☑"} ${task[2]}`;
        const simple = body.length === 1 || body.slice(1).every((l) => l.trim() && !startsBlock(l, undefined));
        return `<li>${simple ? inline(body.join("\n")).replace(/\n/g, "<br>") : blocks(body, depth + 1)}</li>`;
      });
      out.push(ordered ? `<ol${start !== 1 ? ` start="${start}"` : ""}>${li.join("")}</ol>` : `<ul>${li.join("")}</ul>`);
      continue;
    }

    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++]);
    // Card text was plain before it was markdown: a single newline stays a line break.
    out.push(`<p>${inline(para.map((l) => l.trim()).join("\n")).replace(/\n/g, "<br>")}</p>`);
  }
  return out.join("\n");
}

/** Markdown → safe HTML. Figure references on their own line become `<div data-figure="id">`. */
export function renderMarkdown(src: string): string {
  // eslint-disable-next-line no-control-regex
  const text = String(src ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
  return blocks(text.split("\n"), 0);
}

/** The ids of the figures a markdown text places, in order. */
export function figureRefs(src: string): string[] {
  return String(src ?? "").split("\n").map((l) => l.match(FIGURE_LINE)?.[2]).filter((x): x is string => !!x);
}

/** Markdown → one line of plain text, for list rows, notifications and the CLI. */
export function plainText(src: string, max = 180): string {
  const t = String(src ?? "")
    .replace(/^ {0,3}(```+|~~~+).*$/gm, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^ {0,3}(#{1,6}|>|[-*+]|\d{1,9}[.)])\s+/gm, "")
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, " ")
    .replace(/(\*\*|__|~~|`)/g, "")
    .replace(/(^|\s)[*_]([^*_\s][^*_]*)[*_](?=\s|[.,;:!?)]|$)/g, "$1$2")
    .replace(/\s*\|\s*/g, " · ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^· | ·$/g, "");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * The document a figure is shown in. The portal puts it in `<iframe sandbox srcdoc>` and the app in
 * a web view with JavaScript off: no scripts, no network (the policy below), no way out of the box.
 * The variables give drawings the reader's light or dark colours.
 */
export function figureDocument(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<style>
:root{color-scheme:light dark;--fg:#1c2230;--muted:#6a7080;--panel:#fffefb;--soft:#eeebe3;--line:#cfcabd;--accent:#2b6cb0;--ok:#2f7d4f;--warn:#a66b00;--bad:#b4412f}
@media (prefers-color-scheme:dark){:root{--fg:#e8e9ee;--muted:#9aa0ae;--panel:#1a1e27;--soft:#252a35;--line:#3a4150;--accent:#7fb0e6;--ok:#6cc08c;--warn:#f4b860;--bad:#ef8a78}}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
body{padding:8px;min-height:100vh;display:flex;flex-direction:column;justify-content:center}
body>*{flex:none}
svg{max-width:100%;height:auto;display:block;margin:0 auto}
svg text{fill:var(--fg);font-family:inherit}
table{border-collapse:collapse}td,th{border:1px solid var(--line);padding:4px 8px;text-align:left}
a{color:inherit;pointer-events:none;text-decoration:none}
</style></head><body>
${html}
</body></html>`;
}
