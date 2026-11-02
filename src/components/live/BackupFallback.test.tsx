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
