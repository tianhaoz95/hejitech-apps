// Artifact references, roles and who-did-what labels.

export type Role = "owner" | "editor" | "viewer";
export type Visibility = "private" | "link";

/**
 * What each role may do. Anyone who can read may also comment and suggest: suggestions are how
 * a viewer (or another agent) proposes a change for an editor to accept.
 */
export const CAN = {
  read: ["owner", "editor", "viewer"],
  comment: ["owner", "editor", "viewer"],
  suggest: ["owner", "editor", "viewer"],
  edit: ["owner", "editor"],
  review: ["owner", "editor"],
  manage: ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof CAN;

export function can(role: Role | null | undefined, action: Action): boolean {
  return !!role && (CAN[action] as readonly Role[]).includes(role);
}

const SLUG_ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

/** A short, unambiguous public id for an artifact's URL (/a/<slug>). */
export function newSlug(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => SLUG_ALPHABET[b % SLUG_ALPHABET.length]).join("");
}

export const SLUG_RE = /^[23456789abcdefghijkmnpqrstuvwxyz]{6,16}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses what an agent passes as "artifact": a slug, an id, or any Folio URL that contains one
 * (…/a/<slug>, …/a/<slug>/v/3, …/r/<slug>/…). Returns the slug or id, or null.
 */
export function parseArtifactRef(input: unknown): { slug?: string; id?: string; version?: number } | null {
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (UUID_RE.test(s)) return { id: s.toLowerCase() };
  if (SLUG_RE.test(s)) return { slug: s };
  const m = s.match(/\/(?:a|r)\/([23456789abcdefghijkmnpqrstuvwxyz]{6,16})(?:\/v\/?(\d+)|\/(\d+)(?=\/))?/);
  if (m) {
    const v = m[2] ?? m[3];
    return { slug: m[1], ...(v ? { version: Number(v) } : {}) };
  }
  return null;
}

/**
 * The label an action is attributed to: the agent's own name for itself when it gives one,
 * else the MCP client's name, else the connection's name; "web" for the site.
 */
export function agentLabel(parts: { declared?: unknown; client?: string | null; connection?: string | null }): string {
  const clean = (v: unknown) =>
    typeof v === "string"
      ? v
          .replace(/[\u0000-\u001f\u007f<>]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80)
      : "";
  return clean(parts.declared) || clean(parts.client) || clean(parts.connection) || "Agent";
}

export function clampText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
