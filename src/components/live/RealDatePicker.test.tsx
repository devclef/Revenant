import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { earliestOpeningDate } from "@/lib/seal-format";

import { REAL_COPY } from "./copy";
import { RealDatePicker } from "./RealDatePicker";

const NOW = Date.parse("2026-11-06T12:00:00.000Z");
const MIN = earliestOpeningDate(NOW, "Europe/Stockholm");

function render(value: string | null, timeZoneFallback = false): string {
  return renderToStaticMarkup(
    createElement(RealDatePicker, {
      value,
      min: MIN,
      timeZoneFallback,
      onChange: () => {},
    }),
  );
}

describe("RealDatePicker", () => {
  it("is a native date input whose min is the earliest allowed opening date", () => {
    const html = render(null);
    expect(html).toContain('type="date"');
    expect(html).toContain(`min="${MIN}"`);
  });

  it("is labelled with the copy for the opening date", () => {
    const html = render(null);
    expect(html).toContain(REAL_COPY.dateLabel);
    expect(html).toContain(REAL_COPY.dateHint);
  });

  it("writes the chosen date in the R15.1 form", () => {
    const html = render("2027-05-12");
    expect(html).toContain('value="2027-05-12"');
    expect(html).toContain("Opens at midnight on 12 May 2027, in your time zone.");
  });

  it("says the opening is at midnight UTC when the zone is unknown", () => {
    expect(render("2027-05-12", true)).toContain(REAL_COPY.utcFallback);
    expect(render("2027-05-12", false)).not.toContain(REAL_COPY.utcFallback);
  });
});
