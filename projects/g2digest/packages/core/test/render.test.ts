import { describe, expect, it } from "vitest";
import { CJK_GLYPH_PX, glyphPx, isCjkChar, textPx } from "../src/font.ts";
import { dateKicker, LINE_PX, MAX_LINES, metricLine, positionDots, render, screenText, snapshot, wrap } from "../src/render.ts";
import type { Bundle } from "../src/types.ts";
import { fixtureBundle } from "./helpers.ts";

describe("render", () => {
  it("is a pure function of the bundle", () => {
    expect(render(fixtureBundle())).toEqual(render(fixtureBundle()));
  });
  it("renders the fixture in the fixed anatomy", () => {
    const frames = render(fixtureBundle());
    expect(frames.map((f) => f.id)).toEqual([
      "2026-10-22-cover", "2026-10-22-tldr", "2026-10-22-providers-quiet", "2026-10-22-proteina-binders",
      "2026-10-22-open-coder-speed", "2026-10-22-markets-close", "2026-10-22-end",
    ]);
    const proteina = frames[3];
    expect(proteina.lines[0]).toBe("AI/ML 1/2");
    expect(proteina.lines.at(-2)).toBe("FLOW MATCHING");
    expect(proteina.footer).toBe("♪ DEEP DIVE 3 MIN");
    expect(frames[0].lines[0]).toBe("THU OCT 22");
    expect(frames[2].footer).toMatch(/^♪ \d+S · NO DEEP DIVE$/);
    const metric = fixtureBundle().cards[5].metrics![0];
    expect(frames[5].lines[2]).toBe(metricLine(metric.label, metric.value));
    expect(frames[5].lines[2]).toMatch(/^[A-Z]+ \.{3,} -1\.2%$/);
    for (const f of frames) for (const l of f.lines) expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
  });
  it("matches the snapshot", () => {
    expect(snapshot(render(fixtureBundle()))).toMatchSnapshot();
  });
});

describe("helpers", () => {
  it("wraps at word boundaries by the glasses' pixel widths", () => {
    expect(wrap("one two three four five six seven", 90)).toEqual(["one two", "three four", "five six", "seven"]);
    const lines = wrap("A plain sentence that is long enough to need more than one line on the glasses, even at full width.");
    expect(lines.length).toBe(2);
    for (const [i, l] of lines.entries()) {
      expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
      if (i < lines.length - 1) expect(textPx(`${l} ${lines[i + 1].split(" ")[0]}`)).toBeGreaterThan(LINE_PX);
    }
  });
  it("pads metric lines out to the right edge", () => {
    const l = metricLine("Dow", "-0.5%");
    expect(l.startsWith("DOW ") && l.endsWith(" -0.5%")).toBe(true);
    expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
    expect(LINE_PX - textPx(l)).toBeLessThan(textPx("."));
  });
  it("pins the footer to the frame's last line", () => {
    const text = screenText(["KICKER", "Title", "Body", "FOOTER"]);
    expect(text.split("\n")).toHaveLength(MAX_LINES);
    expect(text.split("\n").at(-1)).toBe("FOOTER");
    expect(text.endsWith("\n")).toBe(false);
  });
  it("points the End card to the past editions (the tour's End to exit)", () => {
    expect(render(fixtureBundle()).at(-1)!.footer).toBe("SWIPE UP: ALL EDITIONS");
  });
  it("fits the frame and leaves the dots' column: 510 px lines, 9 of them", () => {
    expect([LINE_PX, MAX_LINES]).toEqual([510, 9]);
  });
  it("shows the position as dots, one per card", () => {
    expect(positionDots(0, 4)).toEqual(["●", "○", "○", "○"]);
    expect(positionDots(2, 4)).toEqual(["○", "○", "●", "○"]);
    expect(positionDots(0, 1)).toEqual([]);
  });
  it("keeps the dot in a window when there are more cards than rows", () => {
    expect(positionDots(0, 12)).toEqual(["●", "○", "○", "○", "○", "○", "○", "○", "↓"]);
    expect(positionDots(6, 12)).toEqual(["↑", "○", "○", "○", "●", "○", "○", "○", "↓"]);
    expect(positionDots(11, 12)).toEqual(["↑", "○", "○", "○", "○", "○", "○", "○", "●"]);
    for (let i = 0; i < 12; i++) expect(positionDots(i, 12)).toContain("●");
  });
  it("names the day", () => {
    expect(dateKicker("2026-10-22")).toBe("THU OCT 22");
  });
});

describe("multilingual glyph metrics & golden frames", () => {
  it("measures accented Latin glyphs by their base character width", () => {
    expect(glyphPx("é")).toBe(glyphPx("e"));
    expect(glyphPx("í")).toBe(glyphPx("i"));
    expect(glyphPx("ñ")).toBe(glyphPx("n"));
    expect(glyphPx("ü")).toBe(glyphPx("u"));
    expect(glyphPx("Ç")).toBe(glyphPx("C"));
    expect(glyphPx("æ")).toBeGreaterThan(glyphPx("a"));
  });

  it("measures CJK ideographs and kana as fullwidth glyphs and wraps without spaces", () => {
    expect(isCjkChar("朝")).toBe(true);
    expect(isCjkChar("あ")).toBe(true);
    expect(isCjkChar("A")).toBe(false);
    expect(glyphPx("朝")).toBe(CJK_GLYPH_PX);
    // 30 CJK chars = 600 px > 510 px LINE_PX → must wrap into 2 lines, neither exceeding LINE_PX.
    const cjk = "今朝の通勤路線は定刻通りに運行しています。天候は晴れで気温は十八度です。";
    const lines = wrap(cjk);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
      expect(l.startsWith("。")).toBe(false);
    }
  });

  it("renders multilingual cards within LINE_PX and MAX_LINES", () => {
    const multi: Bundle = {
      date: "2026-11-23",
      guide_version: "0.4",
      brief_version: 1,
      edition: {
        title: "Multilingual Morning",
        sections: [
          { section_id: "transit", title: "TRANSIT", body: "Météo et métro.", sources: [] },
          { section_id: "jp-brief", title: "TOKYO", body: "朝の速報。", sources: [] },
          { section_id: "rates", title: "RATES", body: "FX snapshot.", sources: [] },
        ],
      },
      cards: [
        {
          slug: "cover",
          kind: "cover",
          title: "Morning Brief · 朝のニュース",
          body: "Café résumé naïve Zürich — 3 sections ready.",
        },
        {
          slug: "transit-fr",
          kind: "section",
          section_id: "transit",
          template: "status",
          title: "Ligne 4 : service régulier dès 06h00",
          body: "Aucun incident signalé près de Châtelet. Température prévue : 14°C ± 1°C.",
        },
        {
          slug: "tokyo-weather",
          kind: "section",
          section_id: "jp-brief",
          template: "note",
          title: "東京エリアの朝の運行と天気予報",
          body: "山手線と中央線は平常通り運転しています。日中は晴れて最高気温は十九度の見込みです。",
        },
        {
          slug: "fx-rates",
          kind: "section",
          section_id: "rates",
          template: "metric",
          title: "Currency Desk Open",
          metrics: [
            { label: "EUR", value: "€1.08" },
            { label: "GBP", value: "£0.84" },
            { label: "JPY", value: "¥151" },
          ],
          body: "Narrow spread overnight; € → $ range stays tight.",
        },
        {
          slug: "end",
          kind: "end",
          title: "End of edition",
          body: "All caught up.",
        },
      ],
    };

    const frames = render(multi);
    expect(frames).toHaveLength(5);
    for (const f of frames) {
      expect(f.lines.length).toBeLessThanOrEqual(MAX_LINES);
      for (const l of f.lines) {
        expect(textPx(l)).toBeLessThanOrEqual(LINE_PX);
      }
    }
    // Golden-frame structure checks
    expect(frames[1].lines[0]).toBe("TRANSIT");
    expect(frames[2].lines[0]).toBe("TOKYO");
    expect(frames[3].lines[2]).toMatch(/^EUR \.{3,} €1\.08$/);
    expect(frames[3].lines[3]).toMatch(/^GBP \.{3,} £0\.84$/);
    expect(frames[3].lines[4]).toMatch(/^JPY \.{3,} ¥151$/);
    expect(snapshot(frames)).toContain("東京エリアの朝の運行と天気予報");
  });
});
