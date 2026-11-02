import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { KeyNotice, UnlockInfo } from "@/components/reveal/opening-machine";
import type { UnlockControls } from "@/components/reveal/unlock";
import { LIVE_COPY } from "./copy";
import { UnlockView } from "./UnlockView";

/**
 * Markup tests for the key step (spec 06 task 8, R17.2, R17.5 to R17.10).
 * Rendered with `renderToStaticMarkup`, no DOM. Each control's behaviour is
 * tested through the controls it is given; the view itself never calls crypto.
 */

/** Escape text the way React's server render escapes it, for `toContain`. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function controlsWith(ready: boolean): UnlockControls {
  return { ready, passkey: vi.fn(), backup: vi.fn() };
}

const BOTH: UnlockInfo = { passkey: { rpId: "letters.example" }, backup: true };
const PASSKEY_ONLY: UnlockInfo = {
  passkey: { rpId: "letters.example" },
  backup: false,
};
const BACKUP_ONLY: UnlockInfo = { passkey: null, backup: true };

function render(
  unlock: UnlockInfo,
  notice: KeyNotice | null,
  ready = true,
): string {
  return renderToStaticMarkup(
    createElement(UnlockView, { unlock, notice, controls: controlsWith(ready) }),
  );
}

describe("UnlockView: which controls show", () => {
  it("shows the passkey button and the key field when both wraps exist", () => {
    const markup = render(BOTH, null);
    expect(markup).toContain(esc(LIVE_COPY.unlockPasskey));
    expect(markup).toContain('id="unlock-backup-key"');
    expect(markup).not.toContain(esc(LIVE_COPY.backupOnly));
  });

  it("shows only the passkey button for a passkey-only letter", () => {
    const markup = render(PASSKEY_ONLY, null);
    expect(markup).toContain(esc(LIVE_COPY.unlockPasskey));
    expect(markup).not.toContain('id="unlock-backup-key"');
  });

  it("shows the backup-only text and no passkey control for a backup-only letter (R17.10)", () => {
    const markup = render(BACKUP_ONLY, null);
    expect(markup).toContain(esc(LIVE_COPY.backupOnly));
    expect(markup).toContain('id="unlock-backup-key"');
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPasskey));
  });
});

describe("UnlockView: the passkey control waits for the crypto module (R17.2)", () => {
  it("renders the passkey button disabled until the crypto module is ready", () => {
    const markup = render(PASSKEY_ONLY, null, false);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Unlock with your passkey/);
    expect(markup).toContain(esc(LIVE_COPY.unlockPreparing));
  });

  it("renders the passkey button enabled once the crypto module is ready", () => {
    const markup = render(PASSKEY_ONLY, null, true);
    expect(markup).not.toMatch(/<button[^>]*disabled/);
    expect(markup).not.toContain(esc(LIVE_COPY.unlockPreparing));
  });
});

describe("UnlockView: the key field (R17.10)", () => {
  it("has the text type and the attributes that keep a key unaltered", () => {
    const markup = render(BACKUP_ONLY, null);
    expect(markup).toContain('type="text"');
    expect(markup).toContain('autoComplete="off"');
    expect(markup).toContain('autoCorrect="off"');
    expect(markup).toContain('autoCapitalize="off"');
    expect(markup).toContain('spellCheck="false"');
  });

  it("has no paste handler in the view source", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "UnlockView.tsx"), "utf8");
    expect(source).not.toMatch(/onPaste/);
  });

  it("imports no crypto module, statically or dynamically", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "UnlockView.tsx"), "utf8");
    expect(source).not.toMatch(/@\/lib\/crypto/);
  });
});

describe("UnlockView: notices in a status region", () => {
  it("renders an empty status region when there is no notice", () => {
    const markup = render(BOTH, null);
    expect(markup).toContain('role="status"');
  });

  const cases: ReadonlyArray<readonly [KeyNotice, string]> = [
    ["cancelled", LIVE_COPY.noticeCancelled],
    ["no_prf", LIVE_COPY.noticeNoPrf],
    ["failed", LIVE_COPY.noticeFailed],
    ["wrong_passkey", LIVE_COPY.noticeWrongPasskey],
    ["mistyped_key", LIVE_COPY.noticeMistyped],
    ["wrong_backup", LIVE_COPY.noticeWrongBackup],
  ];

  it.each(cases)("shows the %s notice text", (notice, text) => {
    const markup = render(BOTH, notice);
    expect(markup).toContain(esc(text));
  });

  it("names the header rpId in the wrong_domain notice, not the page host (R17.5)", () => {
    const markup = render(BOTH, "wrong_domain");
    expect(markup).toContain(esc(LIVE_COPY.noticeWrongDomain.replace("{domain}", "letters.example")));
    expect(markup).not.toContain("{domain}");
  });
});
