// Tests for the source-adapter error type (04-real-figures).
//
// Every SourceError must carry a fixed, neutral message that names the
// publisher, the kind, and the identifying detail for that kind, and must
// never contain a banned direction word (see neutrality.md). The publisher
// and kind are exposed as readonly fields.

import { describe, expect, it } from "vitest";

import {
  SourceError,
  type SourceErrorDetail,
  type SourceErrorKind,
  type SourcePublisher,
} from "./errors";

/** Words that would editorialise about a change — never allowed in a message. */
const BANNED_DIRECTION_WORDS = [
  "rose",
  "fell",
  "improved",
  "worsened",
  "corrected",
  "revised",
] as const;

/**
 * One case per SourceErrorKind: the detail to construct it with, and the
 * substrings the message must contain to name its identifying detail. Keeping
 * every kind in one table means a new kind without a test case is obvious.
 */
const CASES: ReadonlyArray<{
  kind: SourceErrorKind;
  detail: SourceErrorDetail;
  mustContain: readonly string[];
}> = [
  {
    kind: "auth_required",
    detail: { status: 401, url: "https://api.eia.gov/series" },
    mustContain: ["status 401", "https://api.eia.gov/series"],
  },
  {
    kind: "http_status",
    detail: { status: 503, url: "https://api.eia.gov/series" },
    mustContain: ["status 503", "https://api.eia.gov/series"],
  },
  {
    kind: "network",
    detail: { url: "https://api.eia.gov/series" },
    mustContain: ["https://api.eia.gov/series"],
  },
  {
    kind: "empty_body",
    detail: { url: "https://api.eia.gov/series" },
    mustContain: ["https://api.eia.gov/series"],
  },
  {
    kind: "wrong_host",
    detail: { url: "https://evil.example.com/series" },
    mustContain: ["https://evil.example.com/series"],
  },
  {
    kind: "unreadable_file",
    detail: { url: "https://ec.europa.eu/bulletin.xlsx" },
    mustContain: ["https://ec.europa.eu/bulletin.xlsx"],
  },
  {
    kind: "link_not_found",
    detail: { url: "https://ec.europa.eu/bulletin" },
    mustContain: ["https://ec.europa.eu/bulletin"],
  },
  {
    kind: "series_mismatch",
    detail: { expectedSeriesId: "EMM_EPMR_PTE_NUS_DPG", foundSeriesId: "none" },
    mustContain: ["EMM_EPMR_PTE_NUS_DPG", "none"],
  },
  {
    kind: "unit_mismatch",
    detail: { headerKey: "Price", foundUnit: "EUR per 1000L" },
    mustContain: ["Price", "EUR per 1000L"],
  },
  {
    kind: "sheet_missing",
    detail: { sheet: "Prices" },
    mustContain: ["Prices"],
  },
  {
    kind: "header_missing",
    detail: { headerKey: "Date" },
    mustContain: ["Date"],
  },
  {
    kind: "header_duplicated",
    detail: { headerKey: "Date" },
    mustContain: ["Date"],
  },
  {
    kind: "bad_date",
    detail: { row: 12, date: "0000-13-40" },
    mustContain: ["row 12", "0000-13-40"],
  },
  {
    kind: "duplicate_date",
    detail: { date: "2024-05-06" },
    mustContain: ["2024-05-06"],
  },
  {
    kind: "bad_cell",
    detail: { row: 7, cellValue: "N/A" },
    mustContain: ["row 7", "N/A"],
  },
  {
    kind: "bad_row_marker",
    detail: { row: 9, marker: "US_" },
    mustContain: ["row 9", "US_"],
  },
  {
    kind: "date_system",
    detail: { url: "https://ec.europa.eu/bulletin.xlsx" },
    mustContain: ["https://ec.europa.eu/bulletin.xlsx"],
  },
];

describe("SourceError", () => {
  const publishers: readonly SourcePublisher[] = ["eia", "oil-bulletin"];

  for (const publisher of publishers) {
    for (const { kind, detail, mustContain } of CASES) {
      describe(`${publisher} / ${kind}`, () => {
        const error = new SourceError(publisher, kind, detail);

        it("names the publisher and kind in the message", () => {
          expect(error.message).toContain(publisher);
          expect(error.message).toContain(kind);
        });

        it("names its identifying detail in the message", () => {
          for (const needle of mustContain) {
            expect(error.message).toContain(needle);
          }
        });

        it("contains no banned direction word", () => {
          const lower = error.message.toLowerCase();
          for (const word of BANNED_DIRECTION_WORDS) {
            expect(lower).not.toMatch(new RegExp(`\\b${word}\\b`));
          }
        });
      });
    }
  }

  it("exposes publisher and kind as fields", () => {
    const error = new SourceError("eia", "http_status", { status: 503 });
    expect(error.publisher).toBe("eia");
    expect(error.kind).toBe("http_status");
  });

  it("is an Error with name SourceError", () => {
    const error = new SourceError("oil-bulletin", "network", {});
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SourceError);
    expect(error.name).toBe("SourceError");
  });

  it("builds a message naming only publisher and kind when detail is empty", () => {
    const error = new SourceError("eia", "empty_body");
    expect(error.message).toBe("eia: empty_body");
  });

  it("throws if a detail field would inject a banned direction word", () => {
    // The constructor guards neutrality: a detail value carrying a banned word
    // (here via the cell value) must be rejected, not emitted.
    expect(
      () => new SourceError("eia", "bad_cell", { row: 1, cellValue: "revised" }),
    ).toThrow(/banned direction word/);
  });
});
