import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LIVE_COPY } from "./copy";
import type { SealState } from "./seal-machine";

/**
 * The way back to the demo on the Seal_Page (spec 07 task 1). It must render
 * above every Sealing_Flow state, so each state is driven through a mocked
 * flow hook and the markup must hold the link to `/demo`.
 */

let currentState: SealState = { tag: "write" };

vi.mock("./useSealFlow", () => ({
  useSealFlow: () => ({
    state: currentState,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    onFallbackStart: () => {},
    onFallbackSealPress: () => {},
    onFallbackDecline: () => {},
    onRetry: () => {},
    getBackupKeyText: () => "KEY-TEXT",
  }),
}));

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => null,
}));

vi.mock("./WriteForm", () => ({ WriteForm: () => null }));
vi.mock("./SealedView", () => ({ SealedView: () => null }));
vi.mock("./SealFailure", () => ({ SealFailure: () => null }));
vi.mock("./BackupFallback", () => ({ BackupFallback: () => null }));

import { SealPage } from "./SealPage";

const ALL_STATES: SealState[] = [
  { tag: "write" },
  { tag: "creating" },
  { tag: "created" },
  { tag: "confirming" },
  { tag: "preparing" },
  { tag: "sealing" },
  { tag: "fallback_key", passkeyCreated: false },
  {
    tag: "sealed",
    letterId: "wom_GdH6gqP6AGgnyhIMgA",
    sealedAt: "2026-11-05T21:00:00.000Z",
    opensAt: "2026-11-05T21:01:00.000Z",
    offsetMs: 0,
    factors: "passkey",
    envelopeHash: "a".repeat(64),
  },
  { tag: "cannot_lock", passkeyCreated: false },
  { tag: "cancelled" },
  { tag: "failed", kind: "network", passkeyCreated: false },
];

function render(state: SealState): string {
  currentState = state;
  return renderToStaticMarkup(
    createElement(SealPage, {
      rpId: "revenant.devclef.se",
      appOrigin: "https://revenant.devclef.se",
    }),
  );
}

describe("Seal_Page back to the demo (spec 07 task 1)", () => {
  it.each(ALL_STATES.map((state) => [state.tag, state] as const))(
    "shows the link to /demo in the %s state",
    (tag, state) => {
      const html = render(state);
      expect(html).toContain(`data-live-step="${tag}"`);
      expect(html).toContain('href="/demo"');
      expect(html).toContain(LIVE_COPY.backToDemo);
    },
  );

  it("renders the link once per state", () => {
    const html = render({ tag: "write" });
    expect(html.split('href="/demo"').length - 1).toBe(1);
  });
});
