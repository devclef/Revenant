import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { promptStarters } from "./copy";
import { insertAtSelection, PromptStarters } from "./PromptStarters";

const [FIRST] = promptStarters;

describe("insertAtSelection", () => {
  it("inserts at the start of a selection, replacing the selected text", () => {
    // "Dear me, hello" with "Dear" selected (0 to 4).
    const result = insertAtSelection("Dear me, hello", 0, 4, "X");
    expect(result).toEqual({ text: "X me, hello", caret: 1 });
  });

  it("inserts into the middle of a selection, replacing the selected text", () => {
    // "abcdef" with "cd" selected (2 to 4).
    const result = insertAtSelection("abcdef", 2, 4, "XY");
    expect(result).toEqual({ text: "abXYef", caret: 4 });
  });

  it("inserts at the end of a selection that runs to the end of the text", () => {
    // "abcdef" with "ef" selected (4 to 6).
    const result = insertAtSelection("abcdef", 4, 6, "XY");
    expect(result).toEqual({ text: "abcdXY", caret: 6 });
  });

  it("inserts at an empty caret at the start of the text", () => {
    const result = insertAtSelection("abc", 0, 0, "XY");
    expect(result).toEqual({ text: "XYabc", caret: 2 });
  });

  it("inserts at an empty caret in the middle of the text", () => {
    const result = insertAtSelection("abc", 1, 1, "XY");
    expect(result).toEqual({ text: "aXYbc", caret: 3 });
  });

  it("inserts at an empty caret at the end of the text", () => {
    const result = insertAtSelection("abc", 3, 3, "XY");
    expect(result).toEqual({ text: "abcXY", caret: 5 });
  });

  it("inserts into an empty field", () => {
    const result = insertAtSelection("", 0, 0, "XY");
    expect(result).toEqual({ text: "XY", caret: 2 });
  });

  it("treats a reversed selection the same as the forward one", () => {
    const forward = insertAtSelection("abcdef", 2, 4, "XY");
    const reversed = insertAtSelection("abcdef", 4, 2, "XY");
    expect(reversed).toEqual(forward);
  });

  it("clamps selection ends that run past the text", () => {
    const result = insertAtSelection("abc", 1, 99, "XY");
    expect(result).toEqual({ text: "aXY", caret: 3 });
  });
});

describe("PromptStarters", () => {
  const html = renderToStaticMarkup(
    createElement(PromptStarters, {
      fieldRef: { current: null },
      onInsert: () => {},
    }),
  );

  it("renders one button per starter, labelled with the starter text", () => {
    expect(promptStarters).toHaveLength(3);
    for (const starter of promptStarters) {
      expect(html).toContain(`>${starter}</button>`);
    }
    expect(html.match(/<button/g)).toHaveLength(3);
  });

  it("renders each button as type=button so it never submits a form", () => {
    expect(html.match(/<button type="button"/g)).toHaveLength(3);
  });

  it("names the group of starters", () => {
    expect(html).toContain('role="group"');
    expect(html).toContain("aria-label=");
  });

  it("applies the wrapping group class and the starter button classes", () => {
    // The group wraps onto rows beneath the letter field. Each button takes the
    // shared outlined control class and the starter class (phone-size layout).
    const group = html.match(/<div role="group"[^>]*class="([^"]+)"/);
    expect(group).not.toBeNull();
    expect(group?.[1]).toMatch(/starters/);

    const buttonClasses = [
      ...html.matchAll(/<button type="button" class="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(buttonClasses).toHaveLength(3);
    for (const classes of buttonClasses) {
      expect(classes).toMatch(/secondary/);
      expect(classes).toMatch(/starter(?!s)/);
    }
  });

  it("starts with an existing starter as the first button label", () => {
    expect(html).toContain(FIRST);
  });
});
