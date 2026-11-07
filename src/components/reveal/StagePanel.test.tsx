import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import styles from "./reveal.module.css";
import paperStyles from "@/components/ui/paper.module.css";
import blockStyles from "@/components/ceremony/letter/LetterBlock.module.css";
import { readFileSync as readCss } from "node:fs";
import { join as joinPath } from "node:path";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Issue #119, task 1: every reveal stage sits on a paper panel that
 * sets its own `--ink` text colour. Without the panel, stage text inherits the
 * desk's cream ink and cannot be read on the paper-free desk.
 *
 * Rendered with `renderToStaticMarkup` (no DOM library), like the other reveal
 * markup tests. The check is structural: for each stage heading, the nearest
 * enclosing panel must carry both the paper class and the reveal
 * StagePanel class, with no `</div>` between that panel's opening tag and the
 * heading.
 */

const OPENED: Opened = {
  letterId: "letter-stage-panel",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "A short letter for the panel test.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://www.eia.gov/fixture",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [{ question_id: "q-fuel", kind: "number", value: "2.50" }],
};

function renderReveal(stage: 1 | 2 | 3): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(
            LocalViewProvider,
            null,
            createElement(Reveal, {
              opened: OPENED,
              record: RECORD,
              personaName: "Maya",
              stage,
              onAdvance: () => {},
              onShowAll: () => {},
            }),
          ),
        ),
      ),
    ),
  );
}

// Escape the way renderToStaticMarkup does, so a heading with an apostrophe
// is found in the markup.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * True when `heading` sits inside a paper panel that is also a
 * StagePanel. The nearest preceding `<div class="...">` that carries the
 * StagePanel class must carry the paper class too, and no `</div>`
 * may close between that opening tag and the heading.
 */
function isInsidePanel(html: string, heading: string): boolean {
  const at = html.indexOf(escapeHtml(heading));
  if (at < 0) return false;
  const before = html.slice(0, at);
  const divOpen = /<div class="([^"]*)"/g;
  let panelIndex = -1;
  let panelClass = "";
  let match: RegExpExecArray | null;
  while ((match = divOpen.exec(before)) !== null) {
    if (match[1].includes(styles.stagePanel)) {
      panelIndex = match.index;
      panelClass = match[1];
    }
  }
  if (panelIndex < 0) return false;
  const between = before.slice(panelIndex);
  return (
    panelClass.includes(paperStyles.paper) &&
    !between.includes("</div>")
  );
}

/**
 * True when `heading` sits inside the letter block's paper panel (stage 2,
 * LetterBlock). The nearest preceding `<div>` with the paper class must be that
 * panel, and no `</div>` may close between its opening tag and the heading.
 */
function isInsideLetterPaper(html: string, heading: string): boolean {
  const at = html.indexOf(escapeHtml(heading));
  if (at < 0) return false;
  const before = html.slice(0, at);
  const divOpen = /<div class="([^"]*)"/g;
  let paperIndex = -1;
  let match: RegExpExecArray | null;
  while ((match = divOpen.exec(before)) !== null) {
    if (match[1].includes(blockStyles.paper)) paperIndex = match.index;
  }
  if (paperIndex < 0) return false;
  return !before.slice(paperIndex).includes("</div>");
}

describe("reveal stages sit on a paper panel", () => {
  it("wraps stage 1 (the seal break) in a panel", () => {
    const html = renderReveal(1);
    expect(isInsidePanel(html, CEREMONY_COPY.sealButton)).toBe(true);
  });

  it("puts stage 2 (What was written then) in the Caption_Block, above the paper (spec 09 L6.2, L6.4)", () => {
    const html = renderReveal(2);
    const heading = html.indexOf(escapeHtml(REVEAL_COPY.stage2Title));
    const caption = html.indexOf(`class="${blockStyles.caption}"`);
    const paper = html.indexOf(`class="${blockStyles.paper}"`);
    expect(caption).toBeGreaterThanOrEqual(0);
    expect(heading).toBeGreaterThan(caption);
    expect(paper).toBeGreaterThan(heading);
    // The heading is not inside the paper: no paper class opens before it.
    expect(isInsideLetterPaper(html, REVEAL_COPY.stage2Title)).toBe(false);
  });

  it("sets --ink on the letter paper, so the letter does not inherit the desk's cream ink", () => {
    const css = readCss(
      joinPath(__dirname, "..", "ceremony", "letter", "LetterBlock.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.paper\s*\{[^}]*--ink:/);
  });

  it("keeps stage 3 (The numbers, then and now) on the dark desk, outside a panel", () => {
    // Spec 07 R14.1: the figures sit on --bg beside the Letter_Block.
    const html = renderReveal(3);
    expect(isInsidePanel(html, REVEAL_COPY.stage3Title)).toBe(false);
  });

  it("gives every stage in the markup its own panel", () => {
    const html = renderReveal(3);
    // Stage 1 uses StagePanel; stage 2 uses the letter block's paper; stage 3
    // sits on the desk (spec 07 R14.1).
    const panels = html.split(styles.stagePanel).length - 1;
    const paper = html.split(blockStyles.paper).length - 1;
    expect(panels).toBe(1);
    expect(paper).toBe(1);
  });
});

describe("the stage panel sets its own text colour", () => {
  it("declares color: var(--ink) on .stagePanel, not inherited from the desk", () => {
    const css = readFileSync(new URL("./reveal.module.css", import.meta.url), "utf8");
    const rule = css.match(/\.stagePanel\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule?.[1]).toMatch(/color:\s*var\(--ink\)/);
  });
});
