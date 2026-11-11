// Feature: 09-demo-polish (C1.1, C1.2, P5.3)
//
// Render tests for the Persona_Intro: the content it shows, the question count
// and the time line, and the stage rules in scene.module.css that show it in
// emerging, sealed and intact and hide it after that.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { PersonaIntro, introQuestionsText, type PersonaIntroProps } from "./PersonaIntro";

const base: PersonaIntroProps = {
  personaName: "Maya",
  introLine:
    "Maya, who works early shifts at a clinic, writes on a May Sunday about her commute, filling the tank and Saturday deliveries.",
  writtenAsOf: "2024-05-12",
  opensAt: "2024-11-05T00:00:00.000Z",
  questionCount: 2,
};

function render(props: Partial<PersonaIntroProps> = {}): string {
  return renderToStaticMarkup(createElement(PersonaIntro, { ...base, ...props }));
}

const intro = resolve(__dirname, "intro.module.css");
const sceneCss = readFileSync(resolve(__dirname, "..", "scene", "scene.module.css"), "utf8");

describe("PersonaIntro content (spec 09 C1.1)", () => {
  it("shows the intro line from the Persona_List", () => {
    expect(render()).toContain("writes on a May Sunday");
  });

  it("shows Written as of and Opens with the dates, in the letter's own zone", () => {
    const html = render();
    expect(html).toContain(CEREMONY_COPY.envelopeWrittenAsOf.replace("{date}", "12 May 2024"));
    expect(html).toContain(CEREMONY_COPY.envelopeOpens.replace("{date}", "5 November 2024"));
  });

  it("shows only Opens {date}: no event name and no Date source link", () => {
    const html = render();
    expect(html).toContain("Opens 5 November 2024");
    expect(html).not.toContain("presidential election");
    expect(html).not.toContain(" · ");
    expect(html).not.toContain("Date source");
    expect(html).not.toContain("<a ");
  });

  it("shows the question count from the Persona_List, with the plural and singular forms", () => {
    expect(render({ questionCount: 2 })).toContain("answer 2 questions");
    expect(render({ questionCount: 1 })).toContain("answer one question");
    expect(introQuestionsText(3)).toContain("3 questions");
  });

  it("omits the time line until FLOW_MINUTES is set", () => {
    expect(render()).not.toContain("It takes about");
  });

  it("shows the time line from FLOW_MINUTES when it is given", () => {
    expect(render({ flowMinutes: 2 })).toContain("It takes about 2 minutes.");
  });

  it("puts the fictional-persona notice first, with the name filled in", () => {
    const html = render();
    const notice = CEREMONY_COPY.personaNotice.replace("{name}", "Maya");
    expect(html).toContain(notice);
    expect(html.indexOf(notice)).toBeLessThan(html.indexOf("writes on a May Sunday"));
    expect(html.indexOf(notice)).toBeLessThan(html.indexOf("Written as of"));
  });

  it("reads only the Persona_List values it is given, never a sealed payload", () => {
    const source = readFileSync(resolve(__dirname, "PersonaIntro.tsx"), "utf8");
    const imports = source.match(/^import [^;]*from "[^"]+";/gm) ?? [];
    for (const line of imports) {
      expect(line).not.toMatch(/lib\/crypto|lib\/seal-format|letter-store/);
    }
  });
});

describe("PersonaIntro stages (spec 09 C1, emerging and sealed)", () => {
  it("shows in emerging and sealed: the hide rule names only the later Stages", () => {
    const start = sceneCss.indexOf(".personaColumn:has(> :is(");
    expect(start).toBeGreaterThanOrEqual(0);
    const hides = sceneCss.slice(start, sceneCss.indexOf("}", start));
    for (const stage of ["emerging", "sealed"]) {
      expect(hides).not.toContain(`"${stage}"`);
    }
    for (const stage of ["recall", "marks", "seal", "letter", "figures", "close"]) {
      expect(hides).toContain(`"${stage}"`);
    }
  });

  it("is hidden from the recall Stage on, through the persona column", () => {
    expect(sceneCss).toMatch(
      /\.personaColumn:has\(> :is\(\[data-ceremony="recall"\][^)]*\)\) > \[data-persona-intro\]\s*\{\s*display:\s*none;/,
    );
  });

  it("shows the notice inside the Persona_Intro at every width, with no CSS hiding", () => {
    const css = readFileSync(intro, "utf8");
    const notice = css.slice(css.indexOf(".notice {"), css.indexOf("}", css.indexOf(".notice {")));
    expect(notice).not.toMatch(/display:\s*none/);
    expect(css).not.toMatch(/\.notice \{\s*display:/);
  });
});
