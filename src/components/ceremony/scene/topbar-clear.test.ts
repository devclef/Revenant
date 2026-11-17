// The Top_Bar publishes its rendered height as --topbar-clear, so a heading's
// scroll-margin-top clears a bar that wraps taller than 96 px (W8). The hook
// runs in the browser, so these tests read its source.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const topBarSource = readFileSync(
  join(process.cwd(), "src/components/ceremony/scene/TopBar.tsx"),
  "utf8",
);

describe("TopBar --topbar-clear", () => {
  it("measures the header with a ResizeObserver", () => {
    expect(topBarSource).toContain("new ResizeObserver(update)");
    expect(topBarSource).toContain("observer.observe(header)");
  });

  it("sets the variable from the header's offsetHeight on the document root", () => {
    expect(topBarSource).toContain(
      "root.style.setProperty(\"--topbar-clear\", `${header.offsetHeight}px`)",
    );
  });

  it("removes the variable and disconnects the observer on unmount", () => {
    expect(topBarSource).toContain("observer.disconnect()");
    expect(topBarSource).toContain("root.style.removeProperty(\"--topbar-clear\")");
  });

  it("attaches the ref to the header element", () => {
    expect(topBarSource).toContain("ref={headerRef}");
  });
});
