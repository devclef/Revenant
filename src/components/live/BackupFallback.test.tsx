// Static-markup and console tests for the backup-key screen (spec 06, Task 7;
// R20.1–R20.6). Rendered with renderToStaticMarkup, as the other live tests do.
// Clicks cannot run in this Node test environment, so the seal control's
// disabled state is checked in the markup and the hook tests cover the
// behaviour behind each press.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackupFallback, keyGroups, type BackupFallbackProps } from "./BackupFallback";
import { LIVE_COPY } from "./copy";

/** A key shaped like formatBackupKey output: 27 characters in groups of four. */
const KEY = "ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567";

function renderHtml(overrides: Partial<BackupFallbackProps> = {}): string {
  return renderToStaticMarkup(
    createElement(BackupFallback, {
      keyText: KEY,
      origin: "cannot_lock",
      onSealPress: () => undefined,
      onDecline: () => undefined,
      ...overrides,
    }),
  );
}

function renderText(overrides: Partial<BackupFallbackProps> = {}): string {
  return renderHtml(overrides)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("keyGroups", () => {
  it("splits a printed key into groups of four", () => {
    expect(keyGroups(KEY)).toEqual(["ABCD", "EFGH", "JKMN", "PQRS", "TVWX", "YZ23", "4567"]);
  });

  it("keeps every group at four characters except a shorter final group", () => {
    const groups = keyGroups("ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567-XYZ");
    expect(groups.slice(0, -1).every((group) => group.length === 4)).toBe(true);
    expect(groups.at(-1)).toBe("XYZ");
  });

  it("drops empty groups", () => {
    expect(keyGroups("ABCD--EFGH-")).toEqual(["ABCD", "EFGH"]);
  });
});

describe("BackupFallback markup", () => {
  it("renders the key as one span per group of four", () => {
    const html = renderHtml();
    const groups = keyGroups(KEY);
    expect(html.match(/data-live-key/g)).toHaveLength(1);
    for (const group of groups) {
      expect(html).toContain(`>${group}</span>`);
    }
    expect((html.match(/<span class="[^"]*keyGroup[^"]*">/g) ?? []).length).toBe(groups.length);
  });

  it("shows the warning, the save checkbox and the decline action", () => {
    const txt = renderText();
    expect(txt).toContain(LIVE_COPY.fallbackWarning);
    expect(txt).toContain(LIVE_COPY.savedLabel);
    expect(txt).toContain(LIVE_COPY.notNow);
    expect(txt).toContain(LIVE_COPY.copyKey);
  });

  it("disables the seal control until the checkbox is ticked", () => {
    const html = renderHtml();
    expect(html).toMatch(/<button[^>]*\bdisabled\b[^>]*>[^<]*Seal with this key/);
  });

  it("leaves the save checkbox unticked on first render", () => {
    const html = renderHtml();
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*>/);
    expect(html).not.toMatch(/<input[^>]*\bchecked\b/);
  });
});

describe("BackupFallback key handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs nothing while the key is generated, formatted and rendered", async () => {
    const crypto = await import("@/lib/crypto");
    const calls: unknown[][] = [];
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    for (const m of methods) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        calls.push(args);
      });
    }

    const bytes = crypto.generateBackupKey();
    const keyText = crypto.formatBackupKey(bytes);
    renderToStaticMarkup(
      createElement(BackupFallback, {
        keyText,
        origin: "cannot_lock",
        onSealPress: () => undefined,
        onDecline: () => undefined,
      }),
    );

    expect(calls).toEqual([]);
  });

  it("the printed key uses the groups of four from formatBackupKey", async () => {
    const crypto = await import("@/lib/crypto");
    const keyText = crypto.formatBackupKey(crypto.generateBackupKey());
    const groups = keyGroups(keyText);
    expect(groups.slice(0, -1).every((group) => group.length === 4)).toBe(true);
    expect(groups.join("-")).toBe(keyText);
  });
});

describe("BackupFallback origin", () => {
  it("shows noPrfOther only when the fallback came from cannot_lock", () => {
    expect(renderHtml({ origin: "cannot_lock" })).toContain(LIVE_COPY.noPrfOther);
    expect(renderHtml({ origin: "seal_step" })).not.toContain(LIVE_COPY.noPrfOther);
    expect(renderHtml({ origin: "seal_step" })).not.toContain("data-no-prf-other");
  });

  it("keeps the key, Copy, intro, warning, checkbox and seal control for seal_step", () => {
    const txt = renderText({ origin: "seal_step" });
    expect(txt).toContain(LIVE_COPY.fallbackIntro);
    expect(txt).toContain(LIVE_COPY.fallbackWarning);
    expect(txt).toContain(LIVE_COPY.savedLabel);
    expect(txt).toContain(LIVE_COPY.copyKey);
    expect(txt).toContain(LIVE_COPY.sealWithKey);
    expect(renderHtml({ origin: "seal_step" })).toMatch(/<button[^>]*\bdisabled\b[^>]*>[^<]*Seal with this key/);
  });
});

describe("BackupFallback heading and copy", () => {
  it("gives the h1 data-step-heading and tabindex -1", () => {
    const h1 = renderHtml().match(/<h1[^>]*>/)?.[0] ?? "";
    expect(h1).toContain('data-step-heading=""');
    expect(h1).toContain('tabindex="-1"');
    expect(renderHtml()).toContain(LIVE_COPY.fallbackTitle);
  });

  it("gives the h1 the same attributes for seal_step", () => {
    const h1 = renderHtml({ origin: "seal_step", real: true }).match(/<h1[^>]*>/)?.[0] ?? "";
    expect(h1).toContain('data-step-heading=""');
    expect(h1).toContain('tabindex="-1"');
  });

  it("names the seal control in noPrfPress and does not mention wax", () => {
    expect(LIVE_COPY.noPrfPress).toContain("Seal with this key");
    expect(LIVE_COPY.noPrfPress).not.toMatch(/wax/i);
    expect(renderText()).toContain(LIVE_COPY.noPrfPress);
    expect(renderText()).not.toMatch(/press the wax/i);
  });

  it("shows no Demo label in real mode for either origin", () => {
    expect(renderHtml({ origin: "cannot_lock", real: true })).not.toContain("data-demo-label");
    expect(renderHtml({ origin: "seal_step", real: true })).not.toContain("data-demo-label");
  });
});

describe("BackupFallback real mode", () => {
  it("shows the Demo label in demo mode", () => {
    expect(renderHtml()).toContain("data-demo-label");
  });

  it("omits the Demo label in real mode and keeps the key, the warning and the no-passkey line", () => {
    const html = renderHtml({ real: true });
    expect(html).not.toContain("data-demo-label");
    expect(html).toContain(LIVE_COPY.fallbackTitle);
    expect(html).toContain(LIVE_COPY.fallbackWarning);
    expect(html).toContain(LIVE_COPY.noPrfOther);
    expect(html).toContain("ABCD");
  });
});
