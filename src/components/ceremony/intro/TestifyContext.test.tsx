// Feature: 10-own-questions (C4.3, C4.10, C1.4)
//
// Render tests for the Testify_Context: the persona variant with the notice,
// the \"A letter from\" line, the two dates and the seal line; the letter variant
// with the seal line only; and the CSS that makes it short lines, not a card,
// below 600 px.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { SCENE_COPY } from "../scene/copy";
import { TestifyContext, type TestifyContextProps } from "./TestifyContext";

const persona: TestifyContextProps = {
  kind: "persona",
  personaName: "Maya",
  writtenAsOf: "2024-05-12",
  opensAt: "2024-11-05T00:00:00.000Z",
};

function render(props: TestifyContextProps): string {
  return renderToStaticMarkup(createElement(TestifyContext, props));
}

const css = readFileSync(resolve(__dirname, "intro.module.css"), "utf8");
// The Testify_Context rules are the last block of the file; PersonaIntro's own
// phone rule comes first, so split from the Testify_Context comment.
const testifyCss = css.slice(css.indexOf("/* The Testify_Context"));
const desktopRules = testifyCss.split("@media (max-width: 599.98px)")[0];
const phoneRules = testifyCss.split("@media (max-width: 599.98px)")[1] ?? "";

describe("TestifyContext: persona letter", () => {
  it("is marked with data-testify-context", () => {
    expect(render(persona)).toContain("data-testify-context");
  });

  it("shows the fictional-persona notice and the A letter from line", () => {
    const html = render(persona);
    expect(html).toContain(SCENE_COPY.personaNotice.replace("{name}", "Maya"));
    expect(html).toContain(REVEAL_COPY.contextFrom.replace("{name}", "Maya"));
  });

  it("shows Written as of and Opens on one line, with the dates", () => {
    const html = render(persona);
    expect(html).toContain("Written as of 12 May 2024 · Opens 5 November 2024");
  });

  it("ends with the seal-verified statement", () => {
    const html = render(persona);
    expect(html).toContain(REVEAL_COPY.sealIntact);
    expect(html.indexOf(REVEAL_COPY.sealIntact)).toBeGreaterThan(html.indexOf("Opens 5 November"));
  });

  it("shows no event name and no link", () => {
    const html = render(persona);
    expect(html).not.toContain("election");
    expect(html).not.toContain("<a ");
  });
});

describe("TestifyContext: Memory_Line (spec 10 C4.2)", () => {
  it("shows the Memory_Line with the written-as-of month in en-GB, exactly", () => {
    const html = render(persona);
    expect(html).toContain(
      "You lived through May 2024 too. Answer from your own memory of it.",
    );
  });

  it("puts the Memory_Line after the seal-verified statement, directly above the first question", () => {
    const html = render(persona);
    expect(html.indexOf("You lived through May 2024")).toBeGreaterThan(
      html.indexOf(REVEAL_COPY.sealIntact),
    );
  });

  it("is not shown on a Live_Letter or Real_Letter", () => {
    expect(render({ kind: "letter" })).not.toContain("You lived through");
  });

  it("is a plain line, not a card, and joins the phone size rule", () => {
    expect(desktopRules).toMatch(/\.testifyMemory \{[^}]*font-size: 0\.9rem/);
    expect(phoneRules).toMatch(/\.testifyFrom,[\s\S]*\.testifyMemory[\s\S]*font-size: 0\.875rem/);
  });
});

describe("TestifyContext: Live_Letter or Real_Letter", () => {
  it("shows only the seal-verified statement", () => {
    const html = render({ kind: "letter" });
    expect(html).toContain("data-testify-context");
    expect(html).toContain(REVEAL_COPY.sealIntact);
  });

  it("shows no persona notice, no A letter from line and no dates", () => {
    const html = render({ kind: "letter" });
    expect(html).not.toContain("fictional");
    expect(html).not.toContain("A letter from");
    expect(html).not.toContain("Written as of");
    expect(html).not.toContain("Opens ");
  });
});

describe("TestifyContext: width rules", () => {
  it("is not a card at any width: no background or padding on the block", () => {
    expect(desktopRules).toMatch(/\.testify \{[^}]*color: var\(--text\)/);
    expect(desktopRules).not.toMatch(/\.testify \{[^}]*background/);
    expect(phoneRules).toMatch(/\.testify \{[^}]*max-width: none/);
    expect(phoneRules).not.toMatch(/\.testify \{[^}]*background/);
    expect(phoneRules).not.toMatch(/\.testify \{[^}]*padding/);
  });

  it("sets the phone lines at 0.875 rem below 600 px, the notice at 0.8 rem", () => {
    expect(phoneRules).toMatch(/\.testifyNotice \{[^}]*font-size: 0\.8rem/);
    expect(phoneRules).toMatch(/\.testifyFrom,[\s\S]*font-size: 0\.875rem/);
  });

  it("fixes no height and clips nothing at phone widths, so the block reflows with its text", () => {
    // A fixed height or a clip would move the text under the Ghost or hide it,
    // and a fixed height would make the page scroll differently at 360 x 640
    // and 390 x 844 (FC1). The phone rules size the lines and nothing else.
    // The height check skips line-height, which is a line spacing, not a box height.
    expect(phoneRules).not.toMatch(/(?<![\w-])height\s*:/);
    expect(phoneRules).not.toMatch(/min-height\s*:/);
    expect(phoneRules).not.toMatch(/overflow\s*:\s*hidden/);
    expect(phoneRules).not.toMatch(/position\s*:\s*(absolute|fixed)/);
  });

  it("does not reuse the Persona_Intro ink-on-paper classes, so the phone ink rule cannot reach it", () => {
    const source = readFileSync(resolve(__dirname, "TestifyContext.tsx"), "utf8");
    expect(source).toContain("styles.testifyNotice");
    expect(source).not.toMatch(/styles\.(notice|meta|line|dates)\b/);
  });
});
