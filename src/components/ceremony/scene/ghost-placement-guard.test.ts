// Feature: 15-the-flow (spec 15 task 6, requirement 5.5 and 5.6)
//
// CSS source guard. The ghost is part of the centred column, so no rule may
// place it by a viewport-percentage variable (--ghost-x) or by the old
// .ghostPlace wrapper, and no envelope rule may draw the Dirt band. This test
// reads the source files, so it fails the moment any of them comes back.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sceneCss = readFileSync(join(here, "scene.module.css"), "utf8");
const sceneGhost = readFileSync(join(here, "Ghost.tsx"), "utf8");
const envelopeDir = join(here, "..", "envelope");
const envelopeCss = readFileSync(join(envelopeDir, "Envelope.module.css"), "utf8");
const envelopeTsx = readFileSync(join(envelopeDir, "Envelope.tsx"), "utf8");

describe("ghost placement guard (spec 15 R5.5)", () => {
  it("has no --ghost-x variable in the scene CSS", () => {
    expect(sceneCss).not.toMatch(/--ghost-x/);
  });

  it("has no .ghostPlace rule or class in the scene CSS or the Ghost markup", () => {
    expect(sceneCss).not.toMatch(/\.ghostPlace\b/);
    expect(sceneGhost).not.toMatch(/ghostPlace/);
  });

  it("has no right-edge clip or translate of the Ghost", () => {
    // The compact right-edge move used 100vw - 16px; the ghost stays centred.
    expect(sceneCss).not.toMatch(/100vw - 16px/);
  });
});

describe("envelope dirt guard (spec 15 R5.6)", () => {
  it("has no Dirt rule in the envelope CSS", () => {
    expect(envelopeCss).not.toMatch(/\.dirt\b/);
    expect(envelopeCss).not.toMatch(/dirtBand/);
  });

  it("has no Dirt group in the envelope markup", () => {
    expect(envelopeTsx).not.toMatch(/\bDirt\b/);
    expect(envelopeTsx).not.toMatch(/styles\.dirt/);
  });
});
