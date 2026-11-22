import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { frFailures } from "../../tools/qa/layout-rules-17.mjs";

type Outline = { style: string; width: string; color: string };
type Reading = {
  active: { tagName: string; tabIndex: string; role: string; outline: Outline } | null;
  next: { tagName: string; label: string; outline: Outline } | null;
};

const RING: Outline = { style: "auto", width: "2px", color: "rgb(31, 27, 22)" };
const NO_RING: Outline = { style: "none", width: "0px", color: "rgb(31, 27, 22)" };

function reading(active: Reading["active"], next: Reading["next"] = { tagName: "BUTTON", label: "Next", outline: RING }): Reading {
  return { active, next };
}

function scriptFocusFailures(r: Reading) {
  return frFailures(r).filter((f: { check: string }) => f.check === "script-focus-outline");
}

describe("FR1 fixed cases", () => {
  it("fails when a script-focused H2 draws a solid 2px outline", () => {
    const r = reading({
      tagName: "H2",
      tabIndex: "-1",
      role: "",
      outline: { style: "solid", width: "2px", color: "rgb(31, 27, 22)" },
    });
    const failures = frFailures(r);
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("FR1");
    expect(failures[0].check).toBe("script-focus-outline");
    expect(failures[0].element).toBe("h2");
  });

  it("passes when the script-focused H2 has outline style none", () => {
    const r = reading({ tagName: "H2", tabIndex: "-1", role: "", outline: NO_RING });
    expect(frFailures(r)).toEqual([]);
  });

  it("passes when the outline width is 0 even with a solid style", () => {
    const r = reading({
      tagName: "H2",
      tabIndex: "-1",
      role: "",
      outline: { style: "solid", width: "0px", color: "rgb(31, 27, 22)" },
    });
    expect(scriptFocusFailures(r)).toEqual([]);
  });

  it("fails the Tab-stop check when the Tab-next control draws no ring", () => {
    const r = reading(
      { tagName: "H2", tabIndex: "-1", role: "", outline: NO_RING },
      { tagName: "A", label: "Back", outline: NO_RING },
    );
    const failures = frFailures(r);
    expect(failures).toHaveLength(1);
    expect(failures[0].check).toBe("tab-focus-ring");
    expect(failures[0].element).toBe("a");
  });
});

const STYLES = ["none", "hidden", "solid", "dashed", "dotted", "double", "auto", "groove"] as const;

describe("FR1 property: script-focus failure iff a non-interactive element has a visible outline", () => {
  it("matches the visibility rule for random style, width, alpha and interactive flag", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STYLES),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 0, max: 1000 }),
        fc.boolean(),
        (style, widthTenths, alphaThousandths, interactive) => {
          const width = `${widthTenths / 2}px`;
          const alpha = (alphaThousandths / 1000).toFixed(3);
          const color = `rgba(31, 27, 22, ${alpha})`;
          const visible =
            style !== "none" && style !== "hidden" && widthTenths / 2 > 0 && alphaThousandths > 0;
          const r = reading({
            tagName: interactive ? "BUTTON" : "H2",
            tabIndex: "-1",
            role: "",
            outline: { style, width, color },
          });
          const failed = scriptFocusFailures(r).length > 0;
          expect(failed).toBe(!interactive && visible);
        },
      ),
      { numRuns: 500 },
    );
  });
});
