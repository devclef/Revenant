// Spec 11 P3.1: the Envelope's date lines are switched by the showDates flag.
// The closed front shows both lines by default, so every existing caller keeps
// its dates. The held Envelope on the recall card passes showDates false.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatLetterDate,
} from "@/components/ui/letter-date";

import { CEREMONY_COPY } from "../copy";
import { Envelope, type EnvelopePersona } from "./Envelope";

const persona: EnvelopePersona = {
  key: "maya",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
  demo: true,
};

const writtenText = CEREMONY_COPY.envelopeWrittenAsOf.replace(
  "{date}",
  formatCalendarDate(persona.written_as_of),
);
const opensText = CEREMONY_COPY.envelopeOpens.replace(
  "{date}",
  formatLetterDate(persona.opens_at, { kind: "utc" }),
);

function render(showDates?: boolean): string {
  return renderToStaticMarkup(
    createElement(Envelope, {
      state: "closed",
      layout: "responsive",
      persona,
      showDates,
    }),
  );
}

describe("Envelope showDates", () => {
  it("shows both date lines on the closed front by default", () => {
    const html = render();
    expect(html).toContain(writtenText);
    expect(html).toContain(opensText);
    expect(html.match(/data-date/g)).toHaveLength(2);
  });

  it("shows both date lines when showDates is true", () => {
    const html = render(true);
    expect(html).toContain(writtenText);
    expect(html).toContain(opensText);
  });

  it("renders no date lines when showDates is false", () => {
    const html = render(false);
    expect(html).not.toContain(writtenText);
    expect(html).not.toContain(opensText);
    expect(html).not.toContain("data-date");
  });

  it("keeps the envelope art when showDates is false", () => {
    expect(render(false)).toContain('data-envelope-state="closed"');
  });
});
