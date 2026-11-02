// Tests for the backup key card (spec 06, task 12; R21.3–R21.5). Static markup
// through renderToStaticMarkup, as the other live tests do. The key is a fixed
// 27-character string, so the output is deterministic.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";

import { BackupKeyCard, backupKeyFragmentUrl } from "./BackupKeyCard";
import { LIVE_COPY } from "./copy";
import { letterLinkText } from "./keepsake-files";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123letterid00";
const KEY = "3ABC-DEFG-HJKM-NPQR-STVW-XYZ0-12A";

function renderCard(): string {
  return renderToStaticMarkup(
    createElement(BackupKeyCard, { letterId: LETTER_ID, appOrigin: APP_ORIGIN, keyText: KEY }),
  );
}

describe("backupKeyFragmentUrl", () => {
  it("puts the key without hyphens after #k= on the letter link", () => {
    expect(backupKeyFragmentUrl(APP_ORIGIN, LETTER_ID, KEY)).toBe(
      `${APP_ORIGIN}/l/${LETTER_ID}#k=3ABCDEFGHJKMNPQRSTVWXYZ012A`,
    );
  });

  it("has no hyphen in the fragment", () => {
    const url = backupKeyFragmentUrl(APP_ORIGIN, LETTER_ID, KEY);
    expect(url.slice(url.indexOf("#k="))).not.toContain("-");
  });
});

describe("BackupKeyCard — static markup", () => {
  it("renders the Demo label, the card title and the card's plain statements", () => {
    const html = renderCard();
    expect(html).toContain(DEMO_COPY.demoLabel);
    expect(html).toContain(LIVE_COPY.backupCardTitle);
    expect(html).toContain(LIVE_COPY.backupCardWhat);
    expect(html).toContain(LIVE_COPY.backupCardKeep);
  });

  it("shows the letter link as text", () => {
    const html = renderCard();
    expect(html).toContain(letterLinkText(APP_ORIGIN, LETTER_ID));
  });

  it("shows the key in groups of four, seven groups for 27 characters", () => {
    const html = renderCard();
    const groups = html.match(/data-live-key[\s\S]*?<\/div>/)?.[0] ?? "";
    const spans = groups.match(/<span class="[^"]*">([^<]*)<\/span>/g) ?? [];
    expect(spans.map((span) => span.replace(/<[^>]*>/g, ""))).toEqual([
      "3ABC",
      "DEFG",
      "HJKM",
      "NPQR",
      "STVW",
      "XYZ0",
      "12A",
    ]);
  });

  it("renders a QR code block marked as decorative", () => {
    const html = renderCard();
    expect(html).toContain("data-live-backup-qr");
    expect(html).toMatch(/aria-hidden="true" data-live-backup-qr="true"/);
    expect(html).toContain('role="img"');
  });

  it("has a print control that is hidden in print", () => {
    const html = renderCard();
    expect(html).toContain(LIVE_COPY.printCard);
    expect(html).toContain("data-live-print");
  });
});

describe("BackupKeyCard — no network, storage or logging (R21.3–R21.5)", () => {
  it("its source makes no request, writes no storage, and logs nothing", () => {
    const source = readFileSync(new URL("./BackupKeyCard.tsx", import.meta.url), "utf8");
    const forbidden = [
      /\bfetch\(/,
      /XMLHttpRequest/,
      /sendBeacon/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
      /\bcaches\b/,
      /console\./,
      /serviceWorker/,
    ];
    for (const pattern of forbidden) {
      expect(source, `BackupKeyCard.tsx matches ${String(pattern)}`).not.toMatch(pattern);
    }
  });
});
