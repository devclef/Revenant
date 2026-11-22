// Tests for SoundSlotContext. The default reporter is a no-op, so a flow that
// mounts outside a plain Scene does not throw.

import { createElement, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SoundSlotContext } from "./SoundSlotContext";

function Probe() {
  const report = useContext(SoundSlotContext);
  report();
  return createElement("span", null, "probe");
}

describe("SoundSlotContext", () => {
  it("defaults to a reporter that does nothing and does not throw", () => {
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<span>probe</span>");
  });
});
