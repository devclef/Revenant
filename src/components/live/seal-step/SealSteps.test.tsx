// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REAL_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import { SealSteps } from "./SealSteps";

describe("SealSteps", () => {
  it("lists the two presses in order with their labels", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice={null} />,
    );
    expect(html).toContain(PRESS_COPY.stepOne);
    expect(html).toContain(PRESS_COPY.stepTwo);
    expect(html.indexOf(PRESS_COPY.stepOne)).toBeLessThan(
      html.indexOf(PRESS_COPY.stepTwo),
    );
  });

  it("renders the done press with its passkey line and the current press without a hint when created", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="created" backupChoice="card" />,
    );
    expect(html).toMatch(/data-seal-step-state="done"/);
    expect(html).toMatch(/data-seal-step-state="current"/);
    expect(html).toContain(PRESS_COPY.stepPasskeyMade.replace(/"/g, "&quot;"));
    expect(html).not.toContain(PRESS_COPY.stepTwoHint);
  });

  it("shows the second press hint while it waits for the device", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="confirming" backupChoice="card" />,
    );
    expect(html).toContain(PRESS_COPY.stepTwoHint);
  });

  it("marks no press current before a backup choice", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice={null} />,
    );
    expect(html).not.toMatch(/data-seal-step-state="current"/);
    expect(html.match(/data-seal-step-state="pending"/g)?.length).toBe(2);
  });
});

describe("SealSteps real input (spec 19)", () => {
  it("renders the REAL_COPY first-press hint when real is set", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice="card" real />,
    );
    expect(html).toContain(REAL_COPY.stepOneHint.replace(/'/g, "&#x27;"));
    expect(html).not.toContain(PRESS_COPY.stepOneHint.replace(/"/g, "&quot;"));
  });

  it("renders the demo hint when real is omitted", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice="card" />,
    );
    expect(html).toContain(PRESS_COPY.stepOneHint.replace(/"/g, "&quot;"));
  });
});
