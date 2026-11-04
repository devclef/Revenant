import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_COPY } from "@/components/live/copy";
import { OpeningFlow } from "@/components/reveal/OpeningFlow";
import { REVEAL_COPY } from "@/components/reveal/copy";

/**
 * Tests for the Letter_Page server component at `/l/[id]` (spec 06 task 8,
 * R17.1). The page calls `notFound()` unless the segment is a letter ID, and
 * imports no crypto or database module. The fetch guard fails any request made
 * during render.
 */

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));

import LetterPage from "./page";
import LetterNotFound from "./not-found";

const here = dirname(fileURLToPath(import.meta.url));
// A real letter ID shape, the same one the persona list uses.
const VALID_ID = "wom_GdH6gqP6AGgnyhIMgA";

beforeEach(() => {
  notFound.mockClear();
  vi.stubGlobal("fetch", () => {
    throw new Error("the Letter_Page must not fetch during render");
  });
});

describe("/l/[id] page", () => {
  it("calls notFound() for a segment that is not a letter ID", async () => {
    await expect(
      LetterPage({ params: Promise.resolve({ id: "not-a-letter" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders the live flow for a letter ID without calling notFound()", async () => {
    const element = await LetterPage({
      params: Promise.resolve({ id: VALID_ID }),
    });
    expect(notFound).not.toHaveBeenCalled();
    const markup = renderToStaticMarkup(element);
    // LiveLetter renders nothing on the server. It reads the backup key from
    // the fragment in its mount effect and renders the flow after that, so the
    // loading scene is absent from the static markup (R21.6).
    expect(markup).not.toContain(
      REVEAL_COPY.loading.replace(/'/g, "&#x27;"),
    );
    // No passkey control before the Server_Secret is released (R17.2).
    expect(markup).not.toContain(LIVE_COPY.unlockPasskey);
  });

  it("renders no Ghost and no Soil on the live flow (spec 07 task 2)", () => {
    // The live flow is the same OpeningFlow the persona page uses, minus the
    // persona-only scene. Its loading view is the server markup: the Ghost, the
    // Soil strip and the Soil canvas must all be absent.
    const markup = renderToStaticMarkup(
      createElement(OpeningFlow, {
        letterId: VALID_ID,
        personaName: LIVE_COPY.regionLabel,
        mode: "live",
      }),
    );
    expect(markup).toContain('data-ceremony="');
    expect(markup).not.toContain("data-ghost-box");
    expect(markup).not.toContain("data-soil-strip");
    expect(markup).not.toContain("<canvas");
    expect(markup).not.toContain("Written as of");
    expect(markup).not.toContain("Prepared later as a demo");
    expect(markup).not.toContain("Sealed for the demo on");
  });

  it("imports no crypto module and no database module (R17.1)", () => {
    const source = readFileSync(resolve(here, "page.tsx"), "utf8");
    expect(source).not.toMatch(/@\/lib\/crypto/);
    expect(source).not.toMatch(/letter-store/);
    expect(source).not.toMatch(/@\/lib\/db/);
  });
});

describe("/l/[id] not-found page", () => {
  it("shows the letter-not-found copy and a link to /demo", () => {
    const markup = renderToStaticMarkup(createElement(LetterNotFound));
    expect(markup).toContain(
      LIVE_COPY.letterNotFound.replace(/'/g, "&#x27;"),
    );
    expect(markup).toMatch(/href="\/demo"/);
  });
});
