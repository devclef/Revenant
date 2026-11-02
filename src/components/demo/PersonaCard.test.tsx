import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DeskEnvelopeLink } from "@/components/ceremony/desk/DeskEnvelopeLink";
import { MotionProvider } from "@/components/ceremony/motion";
import { WaxSeal } from "@/components/ceremony/envelope/WaxSeal";

import { PersonaCard, type PersonaCardProps } from "./PersonaCard";
import { DEMO_COPY } from "./copy";
import { formatCalendarDate, formatUtcDate } from "./dates";

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
 * Markup tests for a single PersonaCard (R6.2, R6.6, R6.7). Renders with
 * `renderToStaticMarkup` and `createElement` — no DOM library and no JSX, so
 * the card's full output is just a string we can scan.
 *
 * The props here are the only fields a card may receive: the persona's list
 * fields. No sealed payload (letter text, metric figures) is ever passed in,
 * because a card never receives it (R6.6); the card is a label and a way in.
 */

/** Example list-field props. Dates are chosen to format to distinct strings. */
const PROPS = {
  personaKey: "us-maya",
  display_name: "Maya",
  region: "United States",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
} as const;

/**
 * The card reads the motion mode through DeskEnvelopeLink, so it renders
 * inside a MotionProvider, as it does on the Demo_Index page through DeskScene.
 */
const render = (props: PersonaCardProps = PROPS) =>
  renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(PersonaCard, props)),
  );

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
  it("shows the display name and region", () => {
    const html = render();
    expect(html).toContain(PROPS.display_name);
    expect(html).toContain(PROPS.region);
  });

  it('shows the "Written as of" line with the date formatted via dates.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.writtenAsOfPrefix);
    expect(html).toContain(formatCalendarDate(PROPS.written_as_of));
    // Sanity-check the fixture: the helper really does reshape the raw input.
    expect(formatCalendarDate(PROPS.written_as_of)).toBe("12 May 2024");
  });

  it('shows the "Opens" line with the date formatted via dates.ts', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.opensPrefix);
    expect(html).toContain(formatUtcDate(PROPS.opens_at));
    expect(formatUtcDate(PROPS.opens_at)).toBe("5 November 2024");
  });

  it('renders a "Pick up the letter" link to /demo/personas/{key}', () => {
    const html = render();
    expect(html).toContain(DEMO_COPY.openLetter);
    expect(html).toContain("Pick up the letter");
    expect(html).toContain(`href="/demo/personas/${PROPS.personaKey}"`);
  });

  it('never says "Break the seal" on the card (R2)', () => {
    // The old link copy was "Break the seal"; the seal-break moment belongs to
    // the reveal ceremony, not a persona card. The card only invites the reader
    // in, so the words must appear nowhere in its markup.
    const html = render();
    expect(html).not.toContain("Break the seal");
  });

  it("renders the raw ISO/calendar inputs nowhere — only the formatted dates", () => {
    const html = render();
    // The unformatted source values must not leak into the visible card.
    expect(html).not.toContain(PROPS.written_as_of);
    expect(html).not.toContain(PROPS.opens_at);
  });

  it("contains no sealed-payload strings — a card is list fields only (R6.6)", () => {
    const html = render().toLowerCase();
    // A card never receives the letter body, its metric figures, units,
    // sources or periods. None of these could appear because the component
    // only reads the list-field props above. Guard against a future prop leak.
    // "letter text" (not the bare word "letter", which is product vocabulary
    // used in the "Pick up the letter" link label) stands in for the sealed
    // letter body; the rest are real payload markers a card can never hold.
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

  it("is one desk envelope: the anchor is a DeskEnvelopeLink to the persona letter", () => {
    const root = tree();
    expect(root.type).toBe(DeskEnvelopeLink);
    expect(root.props.href).toBe(`/demo/personas/${PROPS.personaKey}`);
  });

  it("renders the envelope as a real anchor with the persona href", () => {
    const html = render();
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/demo/personas/${PROPS.personaKey}"[^>]*>`),
    );
  });

  it("seeds the WaxSeal from personaKey and nothing else", () => {
    const seals = findElements(tree(), WaxSeal);
    expect(seals).toHaveLength(1);
    expect(seals[0]?.props.patternKey).toBe(PROPS.personaKey);
  });

  it("the WaxSeal markup is the one for personaKey, and it is hidden from assistive tech", () => {
    const html = render();
    const sealSvg = renderToStaticMarkup(
      createElement(WaxSeal, { patternKey: PROPS.personaKey, size: 48 }),
    );
    expect(html).toContain(sealSvg);
    // The seal is decorative: the link already carries the persona's name.
    expect(html).toMatch(/aria-hidden="true"[^>]*>\s*<svg/);
  });

  it("passes only the list fields to the card, never sealed payload", () => {
    const withPayload = {
      ...PROPS,
      letter_text: "SEALED BODY MARKER",
      figures: [{ value: "9.999", unit: "USD per gallon" }],
    } as unknown as PersonaCardProps;
    const html = render(withPayload);
    expect(html).not.toContain("SEALED BODY MARKER");
    expect(html).not.toContain("9.999");
    // The element tree carries only the list fields the card reads.
    const root = tree(withPayload);
    expect(Object.keys(root.props).sort()).toEqual(["children", "className", "href"]);
  });

  it("keeps the card's text unchanged inside the envelope", () => {
    const html = render();
    expect(html).toContain(PROPS.display_name);
    expect(html).toContain(PROPS.region);
    expect(html).toContain(DEMO_COPY.openLetter);
  });
});
