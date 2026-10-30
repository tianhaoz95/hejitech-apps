// MCP server (Streamable HTTP, JSON responses) for build agents, served at /mcp by this site's
// Worker. Authentication happens before this runs (index.ts): OAuth grants issued by the Worker
// itself, or personal access tokens `g2a_…` made in the web app. Either way the caller arrives as
// the user whose brief it builds.
//
// The four tools of PRD §8.1 (guide, brief, validate, publish) plus the two the build needs:
// uploading the agent's own audio, and the last card of a section for quiet_behavior show_last.
import { GUIDE, GUIDE_VERSION, type Bundle } from "@g2digest/core";
import { publishForUser, validateForUser } from "./publish.ts";
import { BUCKET, listEditions, loadBrief, type Db } from "./store.ts";

const PROTOCOL_VERSION = "2025-06-18";
export const SERVER_VERSION = "0.1.0";
const INLINE_AUDIO_MAX_BYTES = 3 * 1024 * 1024;
const EXT: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/opus": "opus" };

export interface Caller {
  userId: string;
  via: "oauth" | "token";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

const BUNDLE = { type: "object", description: "The edition bundle: { date, guide_version, brief_version, edition, cards, cut? } (guide §4, §7)." };

export const TOOLS = [
  {
    name: "get_card_authoring_guide",
    title: "Get the card authoring guide",
    description: "The current card authoring guide (form rules for every edition) and its guide_version. Fetch it at the start of every build; never build from a remembered copy.",
    inputSchema: { type: "object", properties: {} },
    annotations: { title: "Get the card authoring guide", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_user_brief",
    title: "Get the user's brief",
    description: "The user's brief config (sections, sources, instructions, budgets, language, units, glossary, delivery) and brief_version. The user edits it in the web app; build exactly what it says. Record brief_version in the bundle.",
    inputSchema: { type: "object", properties: { user_id: { type: "string", description: "Optional: must be the signed-in user (the token decides whose brief this is)." } } },
    annotations: { title: "Get the user's brief", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_audio_upload",
    title: "Upload a card's audio",
    description: "Stores one audio file you made for a card (guide §5.4). Returns the audio_path to put in the card and, unless you passed data_base64 (≤ 3 MB, stored right away), a short-lived upload_url: PUT the file's bytes there with the same Content-Type.",
    inputSchema: {
      type: "object",
      required: ["date", "slug", "kind", "content_type"],
      properties: {
        date: { type: "string", description: "Edition date, YYYY-MM-DD." },
        slug: { type: "string", description: "The card's slug." },
        kind: { type: "string", enum: ["glance", "deep_dive"] },
        content_type: { type: "string", description: "audio/mpeg (preferred), audio/mp4, audio/aac, audio/wav or audio/ogg." },
        data_base64: { type: "string", description: "Optional: the file itself, base64, up to 3 MB." },
      },
    },
    annotations: { title: "Upload a card's audio", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "validate_cards",
    title: "Validate a bundle",
    description: "Runs every rule of the guide against the bundle, the current brief and the uploaded audio. Returns errors (they block publishing), warnings, the rendered frames, an ASCII snapshot of the glasses preview (keep it in your run log) and, when there are no errors, the preview_hash publish_cards needs.",
    inputSchema: { type: "object", required: ["bundle"], properties: { bundle: BUNDLE } },
    annotations: { title: "Validate a bundle", readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "publish_cards",
    title: "Publish an edition",
    description: "Publishes the validated bundle as the user's edition for its date (replacing an earlier one for that date). Only the 10 newest editions are kept: publishing an 11th deletes the oldest and its audio (`pruned` lists their dates). Needs the preview_hash from an error-free validate_cards of this exact bundle; refused if the guide or brief changed since.",
    inputSchema: { type: "object", required: ["bundle", "preview_hash"], properties: { bundle: BUNDLE, preview_hash: { type: "string" } } },
    annotations: { title: "Publish an edition", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "get_last_cards",
    title: "Get a section's last published card",
    description: "For a section with quiet_behavior show_last on a quiet day only: the section's cards from the most recent edition before `before`, to repeat with carried_from set to that edition's date. Never use earlier cards as a template for new ones.",
    inputSchema: { type: "object", required: ["section_id", "before"], properties: { section_id: { type: "string" }, before: { type: "string", description: "Today's edition date, YYYY-MM-DD." } } },
    annotations: { title: "Get a section's last published card", readOnlyHint: true, openWorldHint: false },
  },
];

async function callTool(name: string, args: Record<string, unknown>, caller: Caller, db: Db, kv: KVNamespace): Promise<unknown> {
  const userId = caller.userId;
  switch (name) {
    case "get_card_authoring_guide":
      return { guide_version: GUIDE_VERSION, guide: GUIDE };
    case "get_user_brief": {
      if (args.user_id !== undefined && args.user_id !== userId) throw new Error("this token reads only its own user's brief");
      const { brief, brief_version } = await loadBrief(db, userId);
      return { user_id: userId, brief_version, brief };
    }
    case "create_audio_upload": {
      const date = String(args.date ?? ""), slug = String(args.slug ?? ""), kind = String(args.kind ?? "");
      const type = String(args.content_type ?? "").toLowerCase();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("slug must be lowercase-kebab-case");
      if (kind !== "glance" && kind !== "deep_dive") throw new Error("kind must be glance or deep_dive");
      const ext = EXT[type];
      if (!ext) throw new Error(`content_type must be one of ${Object.keys(EXT).join(", ")}`);
      const audio_path = `${date}/${slug}-${kind === "glance" ? "glance" : "deep-dive"}.${ext}`;
      const key = `${userId}/${audio_path}`;
      if (typeof args.data_base64 === "string") {
        const bytes = Uint8Array.from(atob(args.data_base64), (ch) => ch.charCodeAt(0));
        if (bytes.length > INLINE_AUDIO_MAX_BYTES) throw new Error("data_base64 is over 3 MB: use the upload_url instead");
        const { error } = await db.storage.from(BUCKET).upload(key, bytes, { contentType: type, upsert: true });
        if (error) throw new Error(`upload failed: ${error.message}`);
        return { audio_path, stored: true, bytes: bytes.length };
      }
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(key, { upsert: true });
      if (error || !data) throw new Error(`couldn't make an upload URL: ${error?.message ?? "unknown"}`);
      return { audio_path, upload_url: data.signedUrl, method: "PUT", headers: { "Content-Type": type }, expires_in_sec: 7200 };
    }
    case "validate_cards":
      return validateForUser(db, kv, userId, args.bundle);
    case "publish_cards":
      return publishForUser(db, kv, userId, args.bundle, args.preview_hash);
    case "get_last_cards": {
      const sectionId = String(args.section_id ?? ""), before = String(args.before ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error("before must be YYYY-MM-DD");
      const editions = (await listEditions(db, userId, 30)).filter((e) => (e.date as string) < before);
      for (const e of editions) {
        const { data } = await db.from("editions").select("bundle").eq("user_id", userId).eq("date", e.date).single();
        const cards = ((data?.bundle as Bundle | undefined)?.cards ?? []).filter((c) => c.kind === "section" && c.section_id === sectionId && !c.quiet);
        if (cards.length) return { date: e.date, cards: cards.map((c) => ({ ...c, carried_from: c.carried_from ?? e.date })) };
      }
      return { date: null, cards: [] };
    }
  }
  throw new Error(`unknown tool ${name}`);
}

export async function handleMcp(req: Request, caller: Caller, db: Db, kv: KVNamespace): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method === "GET") return json({ name: "g2digest-mcp", transport: "streamable-http" });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let msg: { id?: string | number; method: string; params?: Record<string, unknown> };
  try {
    msg = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }
  const reply = (result: unknown) => json({ jsonrpc: "2.0", id: msg.id ?? null, result });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "g2digest", version: SERVER_VERSION },
        instructions:
          "Builds one user's G2 Digest edition: fetch the guide and the brief, write the full edition, derive the cards, make and upload the audio, validate until there are no errors, keep the snapshot, then publish with the preview_hash. The guide (get_card_authoring_guide) has the full sequence and every rule.",
      });
    case "notifications/initialized":
      return new Response(null, { status: 202, headers: cors });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(name, args, caller, db, kv);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        return reply({ content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true });
      }
    }
    default:
      return json({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32601, message: `method not found: ${msg.method}` } });
  }
}
