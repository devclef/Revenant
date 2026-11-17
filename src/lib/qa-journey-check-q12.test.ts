import { describe, expect, it } from "vitest";

import {
  ALL_CHECKS,
  compareLandingSeal,
  LANDING_SEAL_THRESHOLD,
} from "../../tools/qa/journey-check.mjs";

/**
 * Unit tests for the Q1.2 landing-seal verdict (spec 13 Q1.2, issue #438) in
 * tools/qa/journey-check.mjs. The function is pure: no network, no browser.
 */

const HTML_WITH_SEAL =
  '<main><div class="sealBox" data-landing-seal=""></div></main>';

describe("compareLandingSeal (Q1.2)", () => {
  it("passes when / answers 200 and its raw HTML carries data-landing-seal", () => {
    const v = compareLandingSeal({ httpStatus: 200, html: HTML_WITH_SEAL });
    expect(v.status).toBe("pass");
    expect(v.threshold).toBe(LANDING_SEAL_THRESHOLD);
  });

  it("fails when the server-rendered HTML has no data-landing-seal", () => {
    const v = compareLandingSeal({ httpStatus: 200, html: "<main></main>" });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe(
      "data-landing-seal missing from the server-rendered HTML",
    );
  });

  it("fails when / answers a non-200 status", () => {
    const v = compareLandingSeal({ httpStatus: 503, html: HTML_WITH_SEAL });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("HTTP 503");
  });

  it("fails when the request itself failed", () => {
    const v = compareLandingSeal({ httpStatus: null, html: null });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("request failed");
  });

  it("fails when the 200 response has no HTML body", () => {
    const v = compareLandingSeal({ httpStatus: 200, html: null });
    expect(v.status).toBe("fail");
    expect(v.measured).toBe("no HTML body");
  });

  it("runs by default with the other journey checks", () => {
    expect(ALL_CHECKS).toContain("Q1.2");
  });
});
