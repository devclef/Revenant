// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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

  it("renders the done press with its passkey line and the current press with its hint", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="created" backupChoice="card" />,
    );
    expect(html).toMatch(/data-seal-step-state="done"/);
    expect(html).toMatch(/data-seal-step-state="current"/);
    expect(html).toContain(PRESS_COPY.stepPasskeyMade);
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
