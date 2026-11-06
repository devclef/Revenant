// Feature: 08-judge-polish (R19)
//
// Checks the per-route metadata that the pages export. Every route that has
// its own title must have a different one, so a browser tab and a link preview
// name each page. The two not-found pages are the exception: both use
// "Not found". The Open Graph image must be 1200 x 630.

import { describe, expect, it } from "vitest";
import type { Metadata } from "next";

import { PERSONAS } from "@/lib/personas";

import { size as ogSize } from "./opengraph-image";
import { metadata as demoMetadata } from "./demo/page";
import { metadata as liveMetadata } from "./demo/live/page";
import { metadata as howMetadata } from "./how-it-is-sealed/page";
import { generateMetadata as letterMetadata } from "./l/[id]/page";
import { metadata as letterNotFoundMetadata } from "./l/[id]/not-found";
import { generateMetadata as personaMetadata } from "./demo/personas/[key]/page";
import { metadata as personaNotFoundMetadata } from "./demo/personas/[key]/not-found";

function titleOf(meta: Metadata): string {
  if (typeof meta.title !== "string") {
    throw new Error("expected a plain string title");
  }
  return meta.title;
}

describe("route titles", () => {
  it("gives each non-not-found route its own unique title", async () => {
    const persona = PERSONAS[0];
    if (persona === undefined) throw new Error("no persona to test with");

    const titles = [
      titleOf(demoMetadata),
      titleOf(liveMetadata),
      titleOf(howMetadata),
      titleOf(await letterMetadata({ params: Promise.resolve({ id: "x" }) })),
      titleOf(
        await personaMetadata({ params: Promise.resolve({ key: persona.key }) }),
      ),
    ];

    expect(new Set(titles).size).toBe(titles.length);
    expect(titles).toEqual([
      "Demo letters",
      "Seal a demo letter",
      "How a letter is sealed",
      "Your letter",
      `${persona.display_name}'s letter`,
    ]);
  });

  it("gives both not-found pages the shared 'Not found' title", () => {
    expect(titleOf(letterNotFoundMetadata)).toBe("Not found");
    expect(titleOf(personaNotFoundMetadata)).toBe("Not found");
  });

  it("falls back to the not-found title for an unknown persona key", async () => {
    const meta = await personaMetadata({
      params: Promise.resolve({ key: "no-such-persona" }),
    });
    expect(titleOf(meta)).toBe("Not found");
  });
});

describe("Open Graph image size", () => {
  it("exports a 1200 x 630 size", () => {
    expect(ogSize).toEqual({ width: 1200, height: 630 });
  });
});
