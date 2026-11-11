// Feature: 11-any-letter, Property 12 (X5.3)
//
// `focusableUnderHidden` returns exactly the focusable elements that have an
// `aria-hidden="true"` ancestor, checked against a generated tree of markup.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { focusableUnderHidden } from "./focusable-under-hidden";

describe("focusableUnderHidden (example cases)", () => {
  it("finds a button inside an aria-hidden ancestor", () => {
    const html = '<div aria-hidden="true"><button>Go</button></div>';
    expect(focusableUnderHidden(html).map((e) => e.tag)).toEqual(["button"]);
  });

  it("ignores a button outside every hidden subtree", () => {
    const html =
      '<div aria-hidden="true"><span>x</span></div><button>Go</button>';
    expect(focusableUnderHidden(html)).toEqual([]);
  });

  it("does not count an element's own aria-hidden, only its ancestors", () => {
    expect(
      focusableUnderHidden('<button aria-hidden="true">Go</button>'),
    ).toEqual([]);
  });

  it("closes the hidden level when the aria-hidden element closes", () => {
    const html = '<div aria-hidden="true"><div></div></div><button>Go</button>';
    expect(focusableUnderHidden(html)).toEqual([]);
  });

  it("treats a void element as a leaf, so it does not leave a hidden level open", () => {
    const html =
      '<div aria-hidden="true"><img alt=""></div><button>Go</button>';
    expect(focusableUnderHidden(html)).toEqual([]);
  });

  it("finds an input under a hidden ancestor, but not a hidden-type input", () => {
    expect(
      focusableUnderHidden(
        '<div aria-hidden="true"><input type="text"></div>',
      ).map((e) => e.tag),
    ).toEqual(["input"]);
    expect(
      focusableUnderHidden(
        '<div aria-hidden="true"><input type="hidden"></div>',
      ),
    ).toEqual([]);
  });

  it("counts a link only when it has an href", () => {
    expect(
      focusableUnderHidden('<div aria-hidden="true"><a href="#x">x</a></div>'),
    ).toHaveLength(1);
    expect(
      focusableUnderHidden('<div aria-hidden="true"><a>x</a></div>'),
    ).toEqual([]);
  });

  it("counts a tabindex of 0 or more, but not -1", () => {
    expect(
      focusableUnderHidden(
        '<div aria-hidden="true"><div tabindex="0">x</div></div>',
      ),
    ).toHaveLength(1);
    expect(
      focusableUnderHidden(
        '<div aria-hidden="true"><div tabindex="-1">x</div></div>',
      ),
    ).toEqual([]);
  });

  it("ignores tags inside script text", () => {
    const html =
      '<div aria-hidden="true"><script>var s = "<button>";</script></div>';
    expect(focusableUnderHidden(html)).toEqual([]);
  });

  it("strips comments before reading tags", () => {
    expect(
      focusableUnderHidden(
        '<div aria-hidden="true"><!-- <button> --></div><button>x</button>',
      ),
    ).toEqual([]);
  });

  it("returns the opening tag as written, in document order", () => {
    const html =
      '<div aria-hidden="true"><button id="a">A</button><a href="/b">B</a></div>';
    expect(focusableUnderHidden(html)).toEqual([
      { tag: "button", openTag: '<button id="a">' },
      { tag: "a", openTag: '<a href="/b">' },
    ]);
  });
});

// --- Property 12 -------------------------------------------------------------

type Kind =
  | "div"
  | "span"
  | "button"
  | "link"
  | "plain-link"
  | "text-input"
  | "image"
  | "tab0"
  | "tab-1";

type Node = { kind: Kind; hidden: boolean; children: Node[] };

const VOID_KINDS = new Set<Kind>(["text-input", "image"]);

/** The opening tag for a node, and whether that tag is focusable on its own. */
function tagFor(node: Node): {
  open: string;
  focusable: boolean;
  name: string;
} {
  const hidden = node.hidden ? ' aria-hidden="true"' : "";
  switch (node.kind) {
    case "div":
      return { open: `<div${hidden}>`, focusable: false, name: "div" };
    case "span":
      return { open: `<span${hidden}>`, focusable: false, name: "span" };
    case "button":
      return { open: `<button${hidden}>`, focusable: true, name: "button" };
    case "link":
      return { open: `<a href="/x"${hidden}>`, focusable: true, name: "a" };
    case "plain-link":
      return { open: `<a${hidden}>`, focusable: false, name: "a" };
    case "text-input":
      return {
        open: `<input type="text"${hidden}>`,
        focusable: true,
        name: "input",
      };
    case "image":
      return { open: `<img alt=""${hidden}>`, focusable: false, name: "img" };
    case "tab0":
      return {
        open: `<div tabindex="0"${hidden}>`,
        focusable: true,
        name: "div",
      };
    case "tab-1":
      return {
        open: `<div tabindex="-1"${hidden}>`,
        focusable: false,
        name: "div",
      };
  }
}

/** The markup for a tree, and the expected result: focusable nodes under a hidden ancestor. */
function render(
  nodes: Node[],
  underHidden: boolean,
  expected: string[],
): string {
  let html = "";
  for (const node of nodes) {
    const { open, focusable, name } = tagFor(node);
    html += open;
    const hiddenBelow = underHidden || node.hidden;
    if (focusable && underHidden) expected.push(open);
    if (VOID_KINDS.has(node.kind)) continue;
    html += render(node.children, hiddenBelow, expected);
    html += `</${name}>`;
  }
  return html;
}

const KINDS: Kind[] = [
  "div",
  "span",
  "button",
  "link",
  "plain-link",
  "text-input",
  "image",
  "tab0",
  "tab-1",
];

/** A tree of at most `depth` levels. Leaves have no children. */
function nodeArb(depth: number): fc.Arbitrary<Node> {
  const kind = fc.constantFrom(...KINDS);
  const hidden = fc.boolean();
  if (depth <= 0) {
    return fc.record({ kind, hidden, children: fc.constant<Node[]>([]) });
  }
  return fc.record({
    kind,
    hidden,
    children: fc.array(nodeArb(depth - 1), { maxLength: 3 }),
  });
}

describe("Property 12: focusable elements are never under aria-hidden", () => {
  it("returns exactly the focusable elements with an aria-hidden ancestor, in document order", () => {
    fc.assert(
      fc.property(fc.array(nodeArb(3), { maxLength: 4 }), (tree) => {
        const expected: string[] = [];
        const html = render(tree, false, expected);
        const actual = focusableUnderHidden(html).map((e) => e.openTag);
        expect(actual).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});
