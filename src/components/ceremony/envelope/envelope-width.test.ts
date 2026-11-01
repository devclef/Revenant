// The envelope stays inside its paper panel at 360 px (issue #119). Its own
// box and the frame that holds it are capped at the container width, and the
// frame clips any overflow instead of spilling onto the panel edge.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const envelopeCss = readFileSync(resolve(__dirname, "Envelope.module.css"), "utf8");
const viewCss = readFileSync(resolve(__dirname, "EnvelopeView.module.css"), "utf8");

function bodyOf(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

describe("the envelope is width-constrained", () => {
  it(".envelope is capped at max-width: 100%", () => {
    const body = bodyOf(envelopeCss, ".envelope");
    expect(body).toMatch(/max-width:\s*100%/);
    expect(body).toMatch(/width:\s*100%/);
  });

  it(".frame is capped at max-width: 100% and clips overflow", () => {
    const body = bodyOf(viewCss, ".frame");
    expect(body).toMatch(/max-width:\s*100%/);
    expect(body).toMatch(/overflow:\s*hidden/);
  });
});
