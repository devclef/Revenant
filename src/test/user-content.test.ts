import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { textOutsideUserContent } from "./user-content";

/**
 * A generated HTML tree. Every text leaf is wrapped in its own `<span>`, so
 * each leaf is one text node in the markup and the helper returns it as its
 * own entry. Adjacent leaves can therefore not merge into one run.
 */
type TreeNode =
  | { kind: "text"; value: string }
  | { kind: "el"; tag: string; userContent: boolean; children: TreeNode[] };

const TEXT_CHARS = [
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,",
  "é",
  "&",
  "<",
  ">",
];

const textArb: fc.Arbitrary<TreeNode> = fc
  .array(fc.constantFrom(...TEXT_CHARS), { minLength: 1, maxLength: 12 })
  .map((chars) => ({ kind: "text" as const, value: chars.join("") }));

const ELEMENT_TAGS = ["div", "p", "section", "span"] as const;

function nodeArb(depth: number): fc.Arbitrary<TreeNode> {
  if (depth <= 0) return textArb;
  const elementArb: fc.Arbitrary<TreeNode> = fc.record({
    kind: fc.constant("el" as const),
    tag: fc.constantFrom(...ELEMENT_TAGS),
    userContent: fc.boolean(),
    children: fc.array(nodeArb(depth - 1), { maxLength: 3 }),
  });
  return fc.oneof(textArb, elementArb);
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(node: TreeNode): string {
  if (node.kind === "text") return `<span>${escapeText(node.value)}</span>`;
  const attributes = node.userContent ? ' data-user-content=""' : "";
  const children = node.children.map(render).join("");
  return `<${node.tag}${attributes}>${children}</${node.tag}>`;
}

/** The text leaves that sit outside every user-content element, in document order. */
function expectedOutside(nodes: TreeNode[], insideUserContent = false): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      if (!insideUserContent) out.push(node.value);
    } else {
      out.push(
        ...expectedOutside(node.children, insideUserContent || node.userContent),
      );
    }
  }
  return out;
}

describe("textOutsideUserContent", () => {
  it("property: returns exactly the text outside every data-user-content element, in order", () => {
    fc.assert(
      fc.property(fc.array(nodeArb(3), { maxLength: 4 }), (roots) => {
        const html = roots.map(render).join("");
        expect(textOutsideUserContent(html)).toEqual(expectedOutside(roots));
      }),
      { numRuns: 300 },
    );
  });

  it("returns nothing when the whole document is user content", () => {
    const html =
      '<div data-user-content=""><p><span>letter one</span></p><span>letter two</span></div>';
    expect(textOutsideUserContent(html)).toEqual([]);
  });

  it("returns text around nested user-content elements and skips the nested text", () => {
    const html = [
      "<main>",
      "<span>before</span>",
      '<div data-user-content=""><span>letter</span>',
      '<p data-user-content=""><span>nested answer</span></p>',
      "<span>still inside the outer letter</span></div>",
      "<span>after</span>",
      "</main>",
    ].join("");
    expect(textOutsideUserContent(html)).toEqual(["before", "after"]);
  });

  it("returns the text that sits between two user-content elements", () => {
    const html = [
      '<div data-user-content=""><span>first letter</span></div>',
      "<span>between</span>",
      '<section data-user-content=""><span>second letter</span></section>',
    ].join("");
    expect(textOutsideUserContent(html)).toEqual(["between"]);
  });

  it("returns outside text when user content sits inside an ordinary wrapper", () => {
    const html =
      '<section><div data-user-content=""><p><span>x</span></p></div><span>y</span></section>';
    expect(textOutsideUserContent(html)).toEqual(["y"]);
  });
});
