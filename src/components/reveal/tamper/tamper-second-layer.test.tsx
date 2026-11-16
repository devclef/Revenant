// Feature: 13-the-seal, A3 (second layer: "Also fix the fingerprint").
//
// Unit examples for the second-layer copy and its markup. The run itself is
// covered in tamper-run.test.ts. Here the refusal layers, the two-attempt
// summary and the copy rules are checked with fixed results, so no crypto runs.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SecondLayerResult } from "./TamperControl";
import {
  TAMPER_COPY,
  refusalLayer,
  refusalLine,
  secondLayerCopy,
} from "./tamper-copy";
import type { RecomputedFingerprintRun } from "./tamper-run";

/** A second-layer run whose copy was refused with the given error kind. */
function secondRun(kind: string): Pick<RecomputedFingerprintRun, "result"> {
  return {
    result: {
      ok: false,
      error: { kind },
    } as RecomputedFingerprintRun["result"],
  };
}

describe("refusalLayer", () => {
  it("maps the hash check to the fingerprint layer", () => {
    expect(refusalLayer("verification_failed")).toBe("fingerprint");
  });

  it("maps the AES-GCM check to the tag layer", () => {
    expect(refusalLayer("tampered")).toBe("tag");
  });

  it("maps any other error kind to no layer, so it is never a refusal", () => {
    expect(refusalLayer("wrong_key")).toBeNull();
    expect(refusalLayer("invalid_input")).toBeNull();
  });
});

describe("refusalLine names the check that refused an attempt (A3.2)", () => {
  it("says the fingerprint check for the fingerprint layer", () => {
    expect(refusalLine("fingerprint")).toBe(TAMPER_COPY.refusedAtFingerprint);
    expect(TAMPER_COPY.refusedAtFingerprint).toContain("fingerprint check");
  });

  it("says the authentication tag check for the tag layer", () => {
    expect(refusalLine("tag")).toBe(TAMPER_COPY.refusedAtTag);
    expect(TAMPER_COPY.refusedAtTag).toContain("authentication tag check");
  });
});

describe("secondLayerCopy (A3.2)", () => {
  it("lists both attempts, each with the layer that refused it", () => {
    const copy = secondLayerCopy("fingerprint", secondRun("tampered"));
    expect(copy).toEqual({
      kind: "attempts",
      heading: TAMPER_COPY.attemptsHeading,
      attempts: [
        {
          label: TAMPER_COPY.attemptOne,
          refusal: TAMPER_COPY.refusedAtFingerprint,
        },
        {
          label: TAMPER_COPY.attemptTwo,
          refusal: TAMPER_COPY.refusedAtTag,
        },
      ],
    });
  });

  it("shows the plain not-as-expected message when the first attempt was not a fingerprint refusal", () => {
    expect(secondLayerCopy("tag", secondRun("tampered"))).toEqual({
      kind: "not_as_expected",
      message: TAMPER_COPY.notAsExpected,
    });
    expect(secondLayerCopy(null, secondRun("tampered"))).toEqual({
      kind: "not_as_expected",
      message: TAMPER_COPY.notAsExpected,
    });
  });

  it("shows the plain message when the fingerprint-fixed copy is refused at the fingerprint check", () => {
    // The hash was recomputed, so a fingerprint refusal here is a broken setup.
    expect(
      secondLayerCopy("fingerprint", secondRun("verification_failed")).kind,
    ).toBe("not_as_expected");
  });

  it("shows the plain message when the fingerprint-fixed copy opens", () => {
    const run = {
      result: { ok: true, value: {} },
    } as unknown as Pick<RecomputedFingerprintRun, "result">;
    expect(secondLayerCopy("fingerprint", run).kind).toBe("not_as_expected");
  });
});

/** React escapes apostrophes in static markup, so the expected text is escaped too. */
const escaped = (text: string) => text.replace(/'/g, "&#x27;");

describe("SecondLayerResult markup (A3.2)", () => {
  it("renders both attempt labels and both refusal lines", () => {
    const html = renderToStaticMarkup(
      createElement(SecondLayerResult, {
        copy: secondLayerCopy("fingerprint", secondRun("tampered")),
      }),
    );
    expect(html).toContain(TAMPER_COPY.attemptsHeading);
    expect(html).toContain(TAMPER_COPY.attemptOne);
    expect(html).toContain(TAMPER_COPY.attemptTwo);
    expect(html).toContain(escaped(TAMPER_COPY.refusedAtFingerprint));
    expect(html).toContain(escaped(TAMPER_COPY.refusedAtTag));
    expect(html).toContain("data-tamper-second=");
  });

  it("renders the plain message when the summary is not as expected", () => {
    const html = renderToStaticMarkup(
      createElement(SecondLayerResult, {
        copy: { kind: "not_as_expected", message: TAMPER_COPY.notAsExpected },
      }),
    );
    expect(html).toContain(TAMPER_COPY.notAsExpected);
    expect(html).not.toContain(TAMPER_COPY.attemptsHeading);
  });
});

describe("second-layer copy follows tone.md and neutrality.md (A3.3)", () => {
  const SECOND_KEYS = [
    "secondLayerButton",
    "secondLayerNote",
    "attemptsHeading",
    "attemptOne",
    "attemptTwo",
    "refusedAtFingerprint",
    "refusedAtTag",
  ] as const;

  it("has none of the judgement words, attack words or win words", () => {
    const banned = [
      /\battack/i,
      /\bwin\b/i,
      /\bwon\b/i,
      /\bcaught\b/i,
      /\bwrong\b/i,
      /\bhacked\b/i,
      /\bbetter\b/i,
      /\bworse\b/i,
      /\bsuccess/i,
      /\bfail/i,
    ];
    for (const key of SECOND_KEYS) {
      const value = TAMPER_COPY[key];
      for (const pattern of banned) {
        expect(value, `${key} must not match ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("has no exclamation mark", () => {
    for (const key of SECOND_KEYS) {
      expect(TAMPER_COPY[key]).not.toContain("!");
    }
  });
});
