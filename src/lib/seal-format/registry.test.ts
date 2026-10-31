import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { formats, parseEnvelope, parsePayload } from "./registry";

const here = dirname(fileURLToPath(import.meta.url));

// A valid v1 envelope: the hand-authored golden fixture (single backup wrap, no
// passkey fields). Reusing it keeps the registry test's "valid header" input
// honest -- it is the same object the hash test pins.
function readGoldenEnvelope(): Record<string, unknown> {
  const path = join(here, "__fixtures__", "golden-v1-envelope.json");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

const validEnvelope = readGoldenEnvelope();

// A minimal valid v1 payload: one metric, one official figure referencing it,
// one number recall question referencing it, and one text question. Enough to
// exercise every cross-reference rule the schema enforces.
const validPayload = {
  format_version: 1,
  letter_text: "A letter to my future self.",
  metrics: [
    {
      id: "fuel-us",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
    },
  ],
  figures: [
    {
      kind: "official",
      metric_id: "fuel-us",
      value: "3.412",
      unit: "USD per gallon",
      region: "U.S. city average",
      period: "2026-09",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
      retrieved_at: "2026-10-30T14:02:11Z",
      source_url: "https://www.eia.gov/",
    },
  ],
  recall_questions: [
    {
      id: "q1",
      answer_type: "number",
      text: "What do you think a gallon of gas cost then?",
      metric_id: "fuel-us",
    },
    {
      id: "q2",
      answer_type: "text",
      text: "How did that autumn feel?",
    },
  ],
} as const;

describe("formats registry", () => {
  it("has exactly version 1 with payload and header schemas", () => {
    expect(Object.keys(formats)).toEqual(["1"]);
    expect(formats[1].payload).toBeDefined();
    expect(formats[1].header).toBeDefined();
  });
});

describe("parseEnvelope", () => {
  it("selects the v1 schema by formatVersion and returns ok with the value", () => {
    const result = parseEnvelope(validEnvelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.formatVersion).toBe(1);
      expect(result.value.letterId).toBe(validEnvelope.letterId);
    }
  });

  it("returns unsupported_format for an unknown version", () => {
    const result = parseEnvelope({ ...validEnvelope, formatVersion: 2 });
    expect(result).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("returns unsupported_format when the version field is missing", () => {
    const { formatVersion, ...withoutVersion } = validEnvelope;
    void formatVersion;
    const result = parseEnvelope(withoutVersion);
    expect(result).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("returns unsupported_format when the version is not a positive integer", () => {
    for (const bad of [0, -1, 1.5, "1", null, true, Number.NaN, Infinity]) {
      const result = parseEnvelope({ ...validEnvelope, formatVersion: bad });
      expect(result).toEqual({ ok: false, error: "unsupported_format" });
    }
  });

  it("returns unsupported_format for a non-object input", () => {
    for (const bad of [null, undefined, 42, "x", [], true]) {
      const result = parseEnvelope(bad);
      expect(result).toEqual({ ok: false, error: "unsupported_format" });
    }
  });

  it("returns invalid with the first failing field path for a known version", () => {
    // Known version (1) but a corrupt payloadNonce: the schema rejects it and
    // the registry reports the first failing issue path joined by '.'.
    const result = parseEnvelope({
      ...validEnvelope,
      payloadNonce: "not-base64url!!",
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "invalid") {
      expect(result.field).toBe("payloadNonce");
    } else {
      throw new Error("expected invalid result");
    }
  });

  it("reports a nested field path joined by '.' when a wrap is malformed", () => {
    const result = parseEnvelope({
      ...validEnvelope,
      wrappedDeks: [
        {
          factor: "backup",
          nonce: "ERERERERERERERER",
          wrappedKey: "too-short",
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "invalid") {
      expect(result.field).toBe("wrappedDeks.0.wrappedKey");
    } else {
      throw new Error("expected invalid result");
    }
  });
});

describe("parsePayload", () => {
  it("selects the v1 schema by format_version and returns ok with the value", () => {
    const result = parsePayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.format_version).toBe(1);
      expect(result.value.letter_text).toBe(validPayload.letter_text);
    }
  });

  it("returns unsupported_format for an unknown version", () => {
    const result = parsePayload({ ...validPayload, format_version: 99 });
    expect(result).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("returns unsupported_format when the version field is missing", () => {
    const { format_version, ...withoutVersion } = validPayload;
    void format_version;
    const result = parsePayload(withoutVersion);
    expect(result).toEqual({ ok: false, error: "unsupported_format" });
  });

  it("returns unsupported_format when the version is not a positive integer", () => {
    for (const bad of [0, -3, 2.5, "1", null, false, Number.NaN, Infinity]) {
      const result = parsePayload({ ...validPayload, format_version: bad });
      expect(result).toEqual({ ok: false, error: "unsupported_format" });
    }
  });

  it("returns unsupported_format for a non-object input", () => {
    for (const bad of [null, undefined, 7, "x", [], false]) {
      const result = parsePayload(bad);
      expect(result).toEqual({ ok: false, error: "unsupported_format" });
    }
  });

  it("returns invalid with the first failing field path for a known version", () => {
    // Known version (1) but whitespace-only letter_text: the schema rejects it.
    const result = parsePayload({ ...validPayload, letter_text: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "invalid") {
      expect(result.field).toBe("letter_text");
    } else {
      throw new Error("expected invalid result");
    }
  });

  it("reports a cross-reference failure's field path", () => {
    // A figure referencing a metric_id that no declared metric has: the
    // superRefine issue path is figures.0.metric_id.
    const result = parsePayload({
      ...validPayload,
      figures: [{ ...validPayload.figures[0], metric_id: "no-such-metric" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok && result.error === "invalid") {
      expect(result.field).toBe("figures.0.metric_id");
    } else {
      throw new Error("expected invalid result");
    }
  });
});
