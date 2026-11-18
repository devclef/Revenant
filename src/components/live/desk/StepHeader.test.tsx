import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { StepHeader } from "./StepHeader";

const render = (props: Partial<Parameters<typeof StepHeader>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(StepHeader, {
      eyebrow: LIVE_COPY.liveHeading,
      heading: DESK_COPY.heading,
      intro: DESK_COPY.intro,
      headingId: "live-step-heading",
      ...props,
    }),
  );

describe("StepHeader (spec 14, W2)", () => {
  it("renders exactly one h1 with the desk heading and the focus marker", () => {
    const html = render();
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
    expect(html).toContain(`>${DESK_COPY.heading}</h1>`);
    expect(html).toMatch(/<h1[^>]*data-step-heading=""[^>]*>/);
    expect(html).toMatch(/<h1[^>]*tabindex="-1"[^>]*>/);
    expect(html).toMatch(/<h1[^>]*id="live-step-heading"[^>]*>/);
  });

  it("renders the eyebrow as a paragraph, not a heading", () => {
    const html = render();
    expect(html).toContain(`>Seal your own letter</p>`);
    expect(html).toContain(LIVE_COPY.liveHeading);
    expect(html).not.toMatch(/<h2[\s>]/);
  });

  it("renders the intro under the heading", () => {
    const html = render();
    expect(html).toContain(`>${DESK_COPY.intro}</p>`);
    expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf(DESK_COPY.intro));
  });

  it("omits the eyebrow and the intro when only the heading is given", () => {
    const html = render({ eyebrow: undefined, intro: undefined });
    expect(html).not.toContain(LIVE_COPY.liveHeading);
    expect(html).not.toContain(DESK_COPY.intro);
    expect(html.match(/<p[\s>]/g)).toBeNull();
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  });
});
