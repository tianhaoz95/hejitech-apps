// Reports and blocks on gallery templates (lib/reports.ts) and what the gallery shows afterwards.
import { describe, expect, it } from "vitest";
import { AUTO_HIDE_REPORTS, checkReport, clearBlocks, reportTemplate, ReportError } from "../src/lib/reports.js";
import { publishedCards, templateBySlug } from "../src/lib/templates.js";
import type { Db } from "../src/lib/db.js";

type Row = Record<string, unknown>;
const match = (row: Row, q: string) =>
  q.split("&").every((part) => {
    const [k, v] = part.split(/=(.*)/s);
    if (["select", "order", "limit"].includes(k)) return true;
    const val = decodeURIComponent(v ?? "");
    if (val.startsWith("eq.")) return String(row[k]) === val.slice(3);
    if (val === "is.null") return row[k] == null;
    return true;
  });
class FakeDb {
  tables: Record<string, Row[]> = {};
  async select<T>(t: string, q = "") { return (this.tables[t] ?? []).filter((r) => match(r, q)).map((r) => structuredClone(r)) as T[]; }
  async one<T>(t: string, q: string) { return ((await this.select<T>(t, q))[0] ?? null) as T | null; }
  async insert<T>(t: string, row: Row, opts: { upsert?: boolean; onConflict?: string } = {}) {
    const rows = (this.tables[t] ??= []);
    const keys = (opts.onConflict ?? "id").split(",");
    const have = rows.find((r) => keys.every((k) => r[k] !== undefined && r[k] === row[k]));
    if (have && !opts.upsert) throw Object.assign(new Error("duplicate"), { status: 409 });
    if (have) return [structuredClone(Object.assign(have, row))] as T[];
    rows.push({ id: crypto.randomUUID(), ...row });
    return [structuredClone(row)] as T[];
  }
  async update<T>(t: string, q: string, patch: Row) {
    const rows = (this.tables[t] ?? []).filter((r) => match(r, q));
    for (const r of rows) Object.assign(r, structuredClone(patch));
    return rows as T[];
  }
  async delete(t: string, q: string) { this.tables[t] = (this.tables[t] ?? []).filter((r) => !match(r, q)); return null; }
}

const AUTHOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_AUTHOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const people = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const template = (id: string, slug: string, user_id: string) => ({
  id, slug, user_id, status: "published", moderated_at: null, remix_count: 0, published_at: "2026-11-01T00:00:00Z",
  card: { slug, title: slug, status: "published" }, manifest: {},
});
function gallery() {
  const db = new FakeDb();
  db.tables.trip_templates = [template("t1", "sequoia-snow", AUTHOR), template("t2", "big-sur", AUTHOR), template("t3", "zion", OTHER_AUTHOR)];
  return { db, dbx: db as unknown as Db };
}
const slugs = async (dbx: Db, viewer?: string) => (await publishedCards(dbx, viewer)).map((c) => c.slug).sort();

describe("template reports", () => {
  it("checks the reason and trims details", () => {
    expect(checkReport({ reason: "spam", details: "  ads  " })).toEqual({ reason: "spam", details: "ads", block: false });
    expect(checkReport({ reason: "offensive", block: true }).block).toBe(true);
    expect(() => checkReport({ reason: "boring" })).toThrow(ReportError);
  });

  it("hides a reported template for the reporter only, at once", async () => {
    const { dbx } = gallery();
    await reportTemplate(dbx, people[0], "sequoia-snow", { reason: "misleading" });
    expect(await slugs(dbx, people[0])).toEqual(["big-sur", "zion"]);
    expect(await slugs(dbx, people[1])).toEqual(["big-sur", "sequoia-snow", "zion"]);
    expect(await slugs(dbx)).toEqual(["big-sur", "sequoia-snow", "zion"]);
    expect(await templateBySlug(dbx, "sequoia-snow", people[0])).toBeNull();
    expect(await templateBySlug(dbx, "sequoia-snow", people[1])).not.toBeNull();
  });

  it("blocking hides every template of that author for the reporter; clearing brings them back", async () => {
    const { dbx } = gallery();
    await reportTemplate(dbx, people[0], "sequoia-snow", { reason: "offensive", block: true });
    expect(await slugs(dbx, people[0])).toEqual(["zion"]);
    expect(await clearBlocks(dbx, people[0])).toBe(1);
    expect(await slugs(dbx, people[0])).toEqual(["big-sur", "zion"]); // the reported one stays hidden
  });

  it(`hides a template from everyone after ${AUTO_HIDE_REPORTS} reports; its author still sees it`, async () => {
    const { db, dbx } = gallery();
    for (const [i, who] of people.entries()) {
      const r = await reportTemplate(dbx, who, "sequoia-snow", { reason: "spam" });
      expect(r.hidden_for_everyone).toBe(i + 1 >= AUTO_HIDE_REPORTS);
    }
    expect(db.tables.trip_templates[0].moderation_note).toMatch(/after 3 reports/);
    expect(await slugs(dbx)).toEqual(["big-sur", "zion"]);
    expect(await templateBySlug(dbx, "sequoia-snow")).toBeNull();
    expect(await templateBySlug(dbx, "sequoia-snow", AUTHOR)).not.toBeNull();
  });

  it("one report per person (a second one updates it), and never your own or an unpublished one", async () => {
    const { db, dbx } = gallery();
    await reportTemplate(dbx, people[0], "zion", { reason: "spam" });
    await reportTemplate(dbx, people[0], "zion", { reason: "unsafe", details: "closed trail" });
    expect(db.tables.template_reports).toHaveLength(1);
    expect(db.tables.template_reports[0]).toMatchObject({ reason: "unsafe", details: "closed trail" });
    await expect(reportTemplate(dbx, AUTHOR, "big-sur", { reason: "spam" })).rejects.toMatchObject({ status: 400 });
    db.tables.trip_templates[1].status = "draft";
    await expect(reportTemplate(dbx, people[0], "big-sur", { reason: "spam" })).rejects.toMatchObject({ status: 404 });
  });
});
