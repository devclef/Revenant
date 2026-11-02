// Feature: 05-reveal-ceremony, Task 10 (R14.1, R14.4; Property 24)
//
// Tests for the sound toggle. The repo has no DOM environment, so the markup is
// checked with `renderToStaticMarkup` (the same as the other ceremony tests),
// the press behaviour through the pure `nextSoundEnabled`, and the module graph
// by reading the source of the toggle's own files.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { SoundToggle } from "./SoundToggle";
import { nextSoundEnabled, useSoundEnabled } from "./useSoundEnabled";

const here = dirname(fileURLToPath(import.meta.url));
const toggleSource = readFileSync(resolve(here, "SoundToggle.tsx"), "utf8");
const hookSource = readFileSync(resolve(here, "useSoundEnabled.ts"), "utf8");

/** Source with comments removed, so a word in a comment never counts as code. */
const codeOnly = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const toggleCode = codeOnly(toggleSource);
const hookCode = codeOnly(hookSource);

describe("SoundToggle default state", () => {
  it("renders off by default: aria-pressed is false and the label offers to turn sound on", () => {
    const html = renderToStaticMarkup(createElement(SoundToggle));

    expect(html).toContain("<button");
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).toContain(CEREMONY_COPY.soundOn);
    expect(html).not.toContain(CEREMONY_COPY.soundOff);
  });

  it("is a button of type button, so it never submits a form", () => {
    const html = renderToStaticMarkup(createElement(SoundToggle));
    expect(html).toContain('type="button"');
  });

  it("starts from a false state in the hook", () => {
    // The hook is a `useState(false)`. Its source pins the default, since a
    // hook can only be run inside a render.
    expect(hookCode).toMatch(/useState\(false\)/);
  });
});

describe("SoundToggle press behaviour", () => {
  it("one press turns sound on and a second press turns it off", () => {
    expect(nextSoundEnabled(false)).toBe(true);
    expect(nextSoundEnabled(true)).toBe(false);
    expect(nextSoundEnabled(nextSoundEnabled(false))).toBe(false);
  });

  it("the component's press handler uses nextSoundEnabled and reports the new state", () => {
    expect(toggleCode).toMatch(/nextSoundEnabled\(enabled\)/);
    expect(toggleCode).toMatch(/setEnabled\(next\)/);
    expect(toggleCode).toMatch(/onChange\?\.\(next\)/);
  });

  it("the hook exposes an in-memory setter and no other state", () => {
    expect(typeof useSoundEnabled).toBe("function");
    expect(hookCode).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/);
  });
});

describe("SoundToggle module graph", () => {
  it("the toggle and its hook do not import sound.ts", () => {
    for (const source of [toggleCode, hookCode]) {
      expect(source).not.toMatch(/from\s+["'][^"']*sound(\.ts)?["']/);
      expect(source).not.toMatch(/import\(\s*["'][^"']*sound(\.ts)?["']\s*\)/);
    }
  });

  it("the toggle does not touch Web Audio or vibration", () => {
    for (const source of [toggleCode, hookCode]) {
      expect(source).not.toMatch(/AudioContext|navigator\.vibrate/);
    }
  });
});

describe("SoundToggle copy", () => {
  it("the label strings exist and are non-empty", () => {
    expect(CEREMONY_COPY.soundOn.length).toBeGreaterThan(0);
    expect(CEREMONY_COPY.soundOff.length).toBeGreaterThan(0);
    expect(CEREMONY_COPY.soundNote.length).toBeGreaterThan(0);
  });

  it("the label strings carry no exclamation mark", () => {
    expect(CEREMONY_COPY.soundOn).not.toContain("!");
    expect(CEREMONY_COPY.soundOff).not.toContain("!");
    expect(CEREMONY_COPY.soundNote).not.toContain("!");
  });
});
