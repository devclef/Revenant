import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";
import { LIVE_COPY } from "@/components/live/copy";
import { REVEAL_COPY } from "./copy";
import type { FlowState, UnlockInfo } from "./opening-machine";
import { OpeningFlow } from "./OpeningFlow";

/**
 * Markup tests for the live mode of `OpeningFlow` (spec 06 task 8, R17.2 to
 * R17.4, R17.11, R17.13). The hook is mocked, so each `FlowState` is rendered
 * without effects or network. The fetch guard fails any call during render.
 *
 * Covered: the Demo label first for a demo letter, the key step only in
 * `awaiting_key`, the verifying scene in `unlocking`, the still-sealed view for
 * a live letter with the precise countdown, and that a persona route shows no
 * passkey control.
 */

let currentState: FlowState;
let currentLive: unknown;
const hookCalls: Array<{ letterId: string; options: unknown }> = [];
const retry = vi.fn();

vi.mock("./useOpeningFlow", () => ({
  useOpeningFlow: (letterId: string, options?: unknown) => {
    hookCalls.push({ letterId, options });
    return {
      state: currentState,
      retry,
      begin: () => {},
      editDraft: () => {},
      toggleNoAnswer: () => {},
      submit: () => {},
      retryPost: () => {},
      advance: () => {},
      showAll: () => {},
      live: currentLive,
    };
  },
}));

const LETTER_ID = "wom_GdH6gqP6AGgnyhIMgA";
const OPENS_AT = "2020-01-01T00:00:00.000Z";
const PASSKEY_AND_BACKUP: UnlockInfo = {
  passkey: { rpId: "letters.example" },
  backup: true,
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function liveFlow(demo: boolean): unknown {
  return {
    demo,
    unlock: { ready: true, passkey: () => {}, backup: () => {} },
  };
}

function renderLive(
  state: FlowState,
  options: { demo?: boolean } = {},
): string {
  currentState = state;
  currentLive = liveFlow(options.demo ?? false);
  return renderToStaticMarkup(
    createElement(OpeningFlow, {
      mode: "live",
      letterId: LETTER_ID,
      personaName: LIVE_COPY.regionLabel,
    }),
  );
}

function renderPersona(state: FlowState): string {
  currentState = state;
  currentLive = undefined;
  return renderToStaticMarkup(
    createElement(OpeningFlow, {
      letterId: LETTER_ID,
      personaName: "Maya",
      persona: {
        key: "us-maya",
        written_as_of: "2024-05-12",
        opens_at: "2024-11-05T00:00:00.000Z",
      },
    }),
  );
}

beforeEach(() => {
  hookCalls.length = 0;
  retry.mockClear();
  vi.stubGlobal("fetch", () => {
    throw new Error("the Opening_Flow must not fetch during render");
  });
});

describe("OpeningFlow live mode: options to the hook", () => {
  it("runs the user key source in live mode", () => {
    renderLive({ tag: "loading" });
    expect(hookCalls.at(-1)?.options).toMatchObject({ keySource: "user" });
  });

  it("passes no options in persona mode, so the demo key stays", () => {
    renderPersona({ tag: "loading" });
    expect(hookCalls.at(-1)?.options).toBeUndefined();
  });
});

describe("OpeningFlow live mode: the Demo label", () => {
  it("shows the Demo label first for a demo letter (R17.11)", () => {
    const markup = renderLive({ tag: "loading" }, { demo: true });
    const label = markup.indexOf(esc(DEMO_COPY.demoLabel));
    const firstView = markup.indexOf(esc(REVEAL_COPY.loading));
    expect(label).toBeGreaterThan(-1);
    expect(firstView).toBeGreaterThan(-1);
    expect(label).toBeLessThan(firstView);
  });

  it("shows no Demo label for a real letter", () => {
    const markup = renderLive({ tag: "loading" }, { demo: false });
    expect(markup).not.toContain(esc(DEMO_COPY.demoLabel));
  });
});

describe("OpeningFlow live mode: the key step", () => {
  it("renders the envelope in awaiting_key, with no key controls in the first render", () => {
    // The key step is loaded after mount (`useKeyStep`), so the server render
    // shows the envelope alone. Its controls are tested in UnlockView.test.tsx.
    const markup = renderLive({
      tag: "awaiting_key",
      envelope: {},
      envelopeHash: "h",
      unlock: PASSKEY_AND_BACKUP,
      notice: null,
    });
    expect(markup).toContain('data-ceremony="envelope"');
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
  });
  it("shows the verifying scene while unlocking, with no key control", () => {
    const markup = renderLive({
      tag: "unlocking",
      envelope: {},
      envelopeHash: "h",
      unlock: PASSKEY_AND_BACKUP,
    });
    expect(markup).toContain(esc(REVEAL_COPY.verifying));
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
  });

  it("shows no passkey control while the secret has not been released (openable)", () => {
    const markup = renderLive({ tag: "openable", envelope: {}, envelopeHash: "h" });
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
    expect(markup).not.toContain(esc(LIVE_COPY.unlockTitle));
  });
});

describe("OpeningFlow live mode: the still-sealed view", () => {
  it("shows the still-sealed view with the Try again control at zero", () => {
    const markup = renderLive({ tag: "sealed", opensAt: OPENS_AT });
    expect(markup).toContain(esc(REVEAL_COPY.sealedTitle));
    expect(markup).toContain(esc(REVEAL_COPY.sealedRetry));
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
  });
});

describe("OpeningFlow persona route (R17.13)", () => {
  it("shows no passkey control and keeps the still-sealed persona view", () => {
    const markup = renderPersona({ tag: "sealed", opensAt: "2024-11-05T00:00:00.000Z" });
    expect(markup).toContain(esc(REVEAL_COPY.sealedTitle));
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
    expect(markup).not.toContain(esc(LIVE_COPY.unlockTitle));
    expect(markup).not.toContain(esc(DEMO_COPY.demoLabel));
  });

  it("keeps the loading scene for a persona letter", () => {
    const markup = renderPersona({ tag: "loading" });
    expect(markup).toContain(esc(REVEAL_COPY.loading));
  });
});

describe("OpeningFlow live mode: the typed key is owned by the parent", () => {
  // The key step is loaded after mount, so a server render never shows the
  // field. A DOM round trip (type, submit, KEY_REJECTED, field still holds the
  // text) needs a DOM environment, which this repo does not have. These source
  // checks pin the ownership that makes the round trip work.
  it("holds the key text in OpeningFlow, which stays mounted through unlocking", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "OpeningFlow.tsx"), "utf8");
    expect(source).toMatch(/const \[keyText, setKeyText\] = useState\(""\);/);
    expect(source).toMatch(/keyText=\{keyEntry\.keyText\}/);
    expect(source).toMatch(/onKeyTextChange=\{keyEntry\.onKeyTextChange\}/);
  });
});
