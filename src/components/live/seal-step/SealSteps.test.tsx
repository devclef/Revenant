// Feature: 15-the-flow (spec 15, task 9; prototype screens 9 to 15).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { SealSteps } from "./SealSteps";

describe("SealSteps", () => {
  it("lists the two presses in order with their labels", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice={null} />,
    );
    expect(html).toContain(LIVE_COPY.sealStepOne);
    expect(html).toContain(LIVE_COPY.sealStepTwo);
    expect(html.indexOf(LIVE_COPY.sealStepOne)).toBeLessThan(
      html.indexOf(LIVE_COPY.sealStepTwo),
    );
  });

  it("renders the done press with its passkey line and the current press with its hint", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="created" backupChoice="card" />,
    );
    expect(html).toMatch(/data-seal-step-state="done"/);
    expect(html).toMatch(/data-seal-step-state="current"/);
    expect(html).toContain(LIVE_COPY.sealStepPasskeyMade);
    expect(html).toContain(LIVE_COPY.sealStepTwoHint);
  });

  it("marks no press current before a backup choice", () => {
    const html = renderToStaticMarkup(
      <SealSteps tag="write" backupChoice={null} />,
    );
    expect(html).not.toMatch(/data-seal-step-state="current"/);
    expect(html.match(/data-seal-step-state="pending"/g)?.length).toBe(2);
  });
});
