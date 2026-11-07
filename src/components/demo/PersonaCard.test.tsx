import { createElement } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Link from "next/link";
import { Envelope } from "@/components/ceremony/envelope/Envelope";
import { WaxSeal, normaliseWaxSealIds } from "@/components/ui/WaxSeal";

import { PersonaCard, type PersonaCardProps } from "./PersonaCard";
import { DEMO_COPY } from "./copy";
import {
  formatCalendarDate,
  formatLetterDate,
} from "@/components/ui/letter-date";

// `next/navigation`'s useRouter throws outside the app router, so the static
// render needs a stub. The stub is hoisted so the mock factory can reach it.
const routerStub = vi.hoisted(() => ({
  prefetch: () => undefined,
  push: () => undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
}));

/**
 * Markup tests for a single PersonaCard on the Demo_Index page (R6.2, R6.6,
 * R6.7). Renders with `renderToStaticMarkup` and `createElement`, with no DOM
 * library and no JSX.
 *
 * The props here are the only fields a card may receive: the persona's list
 * fields. No sealed payload is ever passed in (R6.6).
 */

/** Example list-field props. Dates are chosen to format to distinct strings. */
const PROPS = {
  personaKey: "us-maya",
  display_name: "Maya",
  region: "United States",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
} as const;

/** The same persona with the public event its opening date comes from. */
const EVENT_PROPS: PersonaCardProps = {
  personaKey: "eu-anna",
  display_name: "Anna",
  region: "European Union",
  written_as_of: "2024-03-01",
  opens_at: "2024-06-09T00:00:00.000Z",
  opening_event_name: "European Parliament election",
};

const render = (props: PersonaCardProps = PROPS) =>
  normaliseWaxSealIds(renderToStaticMarkup(createElement(PersonaCard, props)));

/** The accessible name the envelope link must carry. */
const labelFor = (name: string) =>
  DEMO_COPY.openLetterFor.replace("{name}", name);

/** Escapes text the way React writes it into an attribute. */
const attr = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** A minimal view of a React element, enough to walk an unrendered tree. */
type El = { type: unknown; props: { children?: unknown; [name: string]: unknown } };

/** Every element of `type` in an unrendered element tree, in source order. */
function findElements(node: unknown, type: unknown, out: El[] = []): El[] {
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, type, out);
    return out;
  }
  if (node !== null && typeof node === "object" && "props" in node) {
    const el = node as El;
    if (el.type === type) out.push(el);
    findElements(el.props.children, type, out);
  }
  return out;
}

/** The unrendered element tree the card returns (it calls no hooks itself). */
const tree = (props: PersonaCardProps = PROPS) =>
  PersonaCard(props) as unknown as El;

describe("PersonaCard markup", () => {
  it("shows the display name and region in the sans", () => {
    const html = render();
    expect(html).toContain(PROPS.display_name);
    expect(html).toContain(PROPS.region);
  });

  it('shows the "Written as of" line with the date from letter-date.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.writtenAsOfPrefix);
    expect(html).toContain(formatCalendarDate(PROPS.written_as_of));
    expect(formatCalendarDate(PROPS.written_as_of)).toBe("12 May 2024");
  });

  it('shows the "Opens" line with the date from letter-date.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.opensPrefix);
    expect(html).toContain(formatLetterDate(PROPS.opens_at, { kind: "utc" }));
    expect(formatLetterDate(PROPS.opens_at, { kind: "utc" })).toBe(
      "5 November 2024",
    );
  });

  it("adds the plain name of the opening event after the opening date", () => {
    const html = render(EVENT_PROPS);
    expect(html).toContain(
      `9 June 2024${DEMO_COPY.eventSeparator}European Parliament election`,
    );
    expect(html).toContain("Opens");
  });

  it("shows no event name when the persona has no opening event", () => {
    const html = render();
    expect(html).not.toContain(DEMO_COPY.eventSeparator);
  });

  it("shows the orange button with the text \"Open {name}'s letter\"", () => {
    const html = render();
    expect(html).toContain(`>${attr(labelFor("Maya"))}<`);
    expect(html).toContain("Open Maya");
  });

  it("gives the envelope link the accessible name \"Open {name}'s letter\"", () => {
    const html = render();
    expect(html).toContain(`aria-label="${attr(labelFor("Maya"))}"`);
    expect(render(EVENT_PROPS)).toContain(
      `aria-label="${attr(labelFor("Anna"))}"`,
    );
  });

  it("never says \"Break the seal\" on the card (R2)", () => {
    expect(render()).not.toContain("Break the seal");
  });

  it('never says "Pick up the letter" on the card (R6.7)', () => {
    expect(render()).not.toContain("Pick up the letter");
  });

  it("renders the raw ISO/calendar inputs nowhere, only the formatted dates", () => {
    const html = render();
    expect(html).not.toContain(PROPS.written_as_of);
    expect(html).not.toContain(PROPS.opens_at);
  });

  it("contains no sealed-payload strings, since a card is list fields only (R6.6)", () => {
    const html = render().toLowerCase();
    const payloadStrings = [
      "letter text",
      "USD per gallon",
      "U.S. EIA",
      "3.412",
      "self-reported",
      "format_version",
      "serverSecret",
      "ciphertext",
    ];
    for (const needle of payloadStrings) {
      expect(
        html,
        `card markup must not contain payload string "${needle}"`,
      ).not.toContain(needle.toLowerCase());
    }
  });

  it("is one envelope: the anchor is a next/link to the persona letter", () => {
    const root = tree();
    expect(root.type).toBe(Link);
    expect(root.props.href).toBe(`/demo/personas/${PROPS.personaKey}`);
  });

  it("renders the envelope as one real anchor with the persona href", () => {
    const html = render();
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/demo/personas/${PROPS.personaKey}"[^>]*>`),
    );
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("draws the closed envelope turned to its back, with the wax seal on the flap", () => {
    const envelopes = findElements(tree(), Envelope);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.props.state).toBe("turned");
    const html = render();
    const sealSvg = normaliseWaxSealIds(
      renderToStaticMarkup(createElement(WaxSeal, { size: 64 })),
    );
    expect(html).toContain(sealSvg);
  });

  it("hides the envelope drawing from assistive tech, since the link carries the name", () => {
    const html = render();
    expect(html).toMatch(/class="[^"]*art[^"]*" aria-hidden="true"[^>]*>\s*<div/);
    expect(html).toMatch(/<svg/);
  });

  it("passes only list fields to the card, never sealed payload", () => {
    const withPayload = {
      ...PROPS,
      letter_text: "SEALED BODY MARKER",
      figures: [{ value: "9.999", unit: "USD per gallon" }],
    } as unknown as PersonaCardProps;
    const html = render(withPayload);
    expect(html).not.toContain("SEALED BODY MARKER");
    expect(html).not.toContain("9.999");
    const root = tree(withPayload);
    expect(Object.keys(root.props).sort()).toEqual([
      "aria-label",
      "children",
      "className",
      "href",
    ]);
  });
});

describe("PersonaCard date colour", () => {
  it("does not put the accent colour on any date", () => {
    const html = render(EVENT_PROPS);
    // Each date sits in a span with the date-value class; none may be the button.
    const dateSpans = html.match(/<span class="[^"]*dateValue[^"]*">[^<]*<\/span>/g);
    expect(dateSpans).toHaveLength(2);
    for (const span of dateSpans ?? []) {
      expect(span).not.toContain("button");
      expect(span).not.toContain("accent");
    }
    const css = readFileSync(
      resolve(__dirname, "PersonaCard.module.css"),
      "utf8",
    );
    const dateRules = css.match(/\.(dateRow|dateLabel|dateValue)\s*\{[^}]*\}/g) ?? [];
    expect(dateRules).toHaveLength(3);
    for (const rule of dateRules) {
      expect(rule).not.toContain("var(--accent)");
      expect(rule).not.toContain("var(--on-accent)");
    }
  });
});
