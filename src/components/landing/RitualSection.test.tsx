// Feature: 09-demo-polish (H2 step 1)
//
// The four ritual cards are list items of one ordered list, in step order.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { RitualSection } from "./RitualSection";

describe("RitualSection list markup", () => {
  it("renders the four cards as li elements of one ol, in step order", () => {
    const html = renderToStaticMarkup(<RitualSection />);

    const lists = html.match(/<ol\b[^>]*>[\s\S]*?<\/ol>/g) ?? [];
    expect(lists).toHaveLength(1);
    const list = lists[0] ?? "";
    expect(list).toContain("ritualList");

    const items = list.match(/<li\b[^>]*>[\s\S]*?<\/li>/g) ?? [];
    expect(items).toHaveLength(4);
    expect(list.match(/<li\b/g)?.length).toBe(4);

    BRAND_COPY.ritualSteps.forEach((step, index) => {
      expect(items[index]).toContain("ritualCard");
      expect(items[index]).toContain(`>${index + 1}<`);
      expect(items[index]).toContain(step.name);
      expect(items[index]).toContain(step.line);
    });
  });
});
