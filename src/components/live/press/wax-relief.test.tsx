// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).
//
// The wax carries the pressed-ghost relief in every press state, and the relief
// is decorative: it has no text and is hidden from assistive technology.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PressEnvelope } from "./PressEnvelope";

const STATES = [
  { name: "unready", props: { disabled: true } },
  { name: "ready", props: { ready: true } },
  { name: "running", props: { running: true } },
  { name: "inert", props: { inert: true } },
] as const;

describe("wax relief", () => {
  for (const state of STATES) {
    it(`draws the ghost relief inside the wax when ${state.name}`, () => {
      const html = renderToStaticMarkup(<PressEnvelope {...state.props} />);
      expect(html).toMatch(/data-wax-relief=""/);
      expect(html).toMatch(/<svg[^>]*aria-hidden="true"[^>]*data-wax-relief/);
    });
  }

  it("keeps the relief out of the accessible name and the description", () => {
    const html = renderToStaticMarkup(<PressEnvelope disabled />);
    expect(html).toContain('aria-label="Press the seal"');
    expect(html).not.toMatch(/<svg[^>]*data-wax-relief[^>]*>[^<]*<title/);
  });
});
