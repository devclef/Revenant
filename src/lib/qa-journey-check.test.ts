import { describe, expect, it } from "vitest";

import { compareEnvelopeHash, ENVELOPE_HASH_THRESHOLD } from "../../tools/qa/journey-check.mjs";

/**
 * Unit tests for the J10 persona envelope-hash verdict (issue #425) in
 * tools/qa/journey-check.mjs. The function is pure: no network, no browser.
 */

const HASH = "5925def5dd62f6719db9f9bbc05fbbf210eac1fdd3d4c3018b3b97cb84a4728f";

describe("compareEnvelopeHash (J10)", () => {
  it("passes when production answers 200, openable, with the recorded hash", () => {
    const v = compareEnvelopeHash({
      expectedHash: HASH,
      httpStatus: 200,
      body: { status: "openable", envelopeHash: HASH },
    });
    expect(v.status).toBe("pass");
    expect(v.measured).toBe(`envelopeHash=${HASH}`);
    expect(v.threshold).toBe(ENVELOPE_HASH_THRESHOLD);
  });

  it("fails when the envelope hash differs from personas.json", () => {
    const other = "0".repeat(64);
    const v = compareEnvelopeHash({
      expectedHash: HASH,
      httpStatus: 200,
      body: { status: "openable", envelopeHash: other },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe(`envelopeHash ${other} != envelope_hash ${HASH}`);
  });

  it("fails when the 200 body has no envelopeHash", () => {
    const v = compareEnvelopeHash({
      expectedHash: HASH,
      httpStatus: 200,
      body: { status: "openable" },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe(`envelopeHash none != envelope_hash ${HASH}`);
  });

  it("fails when the letter is not openable", () => {
    const v = compareEnvelopeHash({
      expectedHash: HASH,
      httpStatus: 200,
      body: { status: "sealed", envelopeHash: HASH },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe('status="sealed", need "openable"');
  });

  it("fails when the body has no status", () => {
    const v = compareEnvelopeHash({ expectedHash: HASH, httpStatus: 200, body: {} });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe('status="none", need "openable"');
  });

  it("fails on a 200 with no JSON body", () => {
    const v = compareEnvelopeHash({ expectedHash: HASH, httpStatus: 200, body: null });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe('status="none", need "openable"');
  });

  it("fails on a non-200 status and reports it", () => {
    const v = compareEnvelopeHash({
      expectedHash: HASH,
      httpStatus: 404,
      body: { status: "openable", envelopeHash: HASH },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("HTTP 404");
  });

  it("fails when the request itself failed (httpStatus null)", () => {
    const v = compareEnvelopeHash({ expectedHash: HASH, httpStatus: null, body: null });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("request failed");
  });

  it("fails when personas.json has no envelope_hash for the persona", () => {
    const v = compareEnvelopeHash({
      expectedHash: undefined,
      httpStatus: 200,
      body: { status: "openable", envelopeHash: HASH },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("personas.json has no envelope_hash");
  });

  it("fails when the recorded envelope_hash is an empty string", () => {
    const v = compareEnvelopeHash({
      expectedHash: "",
      httpStatus: 200,
      body: { status: "openable", envelopeHash: "" },
    });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("personas.json has no envelope_hash");
  });
});
