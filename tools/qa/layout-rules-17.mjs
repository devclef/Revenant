// Spec 17 browser rules for the layout check (GitHub issue #577).
// Owner-only: tools/** is not an agent path.
//
// FR1 (script-focused heading draws no outline):
//   A non-interactive element that the script focuses (tabindex=-1, and not an a,
//   button, input, select, textarea or [role=button]) must draw no visible outline.
//   The Tab-next control, the first control reached by pressing Tab once from there,
//   must draw a visible focus ring. Both checks read computed styles only.
//
// CT1 (GitHub issue #579, spec 17 requirements 2.3, 2.7 and 2.10):
//   Text meets WCAG 2.2 contrast on the surface it is painted on. The contrast maths and the
//   DOM reader are src/lib/layout-check-ct1.ts. They load only when CT1 runs, so the other QA
//   tools still load on a Node without TypeScript type stripping. CT1 runs at 390x844 and
//   360x640 on the steps layout-check.mjs names. Any failing text is a BLOCKER.
//   Thresholds (src/lib/layout-check-ct1.ts): normal text 4.5:1; large text 3:1, where large means
//   24 px or more, or 18.66 px or more at weight 700. Bold text below those sizes is normal text.
//   Tests: src/lib/layout-check-ct1.test.ts (21 tests, including a fast-check property).
//
// Exports:
//   CT1_SIZES                     the viewports CT1 runs at.
//   readCt1Failures(page)         CT1 failures for the page as it is now; [] when all text passes.
//   parseColorAlpha(value)        alpha of a computed colour string (0 to 1).
//   isOutlineVisible(outline)     true when style is not none or hidden, width > 0 and colour alpha > 0.
//   frFailures(reading)           FR1 failures for one reading; [] when both checks pass.
//   readFr1Reading(page)          reads a loaded page: active element, Tab, next control. No input before the read.
//   readFr1(options)              opens a page at a URL and size, reads it with readFr1Reading, then closes the page.
//   cwFailures(reading)           CW1 failures for one reading; [] when the content column is wide enough.
//   rectOverlap(a, b)             overlap of two rects in px, or null when they do not overlap strictly.
//   goFailures(reading)           GO1 failures for one reading; [] when no text or control meets the Ghost.
//   readLc1Reading(page)          reads [data-figures-column] and [data-seal-group] rects from a loaded page.
//   lcFailures(reading)           LC1 failures for one reading; [] when the columns are coherent.
//
// LC1 (GitHub issue #585, spec 17 D7): the Seal group sits at most 64 px right of the figures column and
//   its top lies inside the column's top and bottom. The reading is { figures, sealGroup }: each is one
//   rect { left, top, right, bottom } in CSS pixels, or null when the element is not on the page.
//   A gap of exactly 64 px passes; 65 px fails. A missing rect fails as "no measurement".
//
// GO1 (GitHub issue #583): no text line or control rect overlaps the Ghost drawn box. The reading is
//   { ghost, text, controls }: ghost is one rect or null, text is [{ label, rect }] (one rect per text
//   node Range), controls is [{ label, rect }]. A rect is { left, top, right, bottom } in CSS pixels,
//   the shape getBoundingClientRect returns. Edges that only touch do not overlap.
//
// CW1 (GitHub issue #581, spec 17 D3): the [data-content-column] content box is at least
//   viewport width minus 48 px. The reading is { width, viewport }: width is the column's content
//   box width in CSS pixels (border-box width minus padding and border), viewport is the layout
//   viewport width in CSS pixels. Both are numbers; anything else fails as "no measurement".
//
// The reading shape, as produced by readFr1Reading:
//   {
//     active: { tagName, tabIndex, role, outline: { style, width, color } } | null,
//     next:   { tagName, label, outline: { style, width, color } } | null
//   }

const INTERACTIVE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);

/**
 * Alpha of a computed CSS colour string, from 0 (fully transparent) to 1.
 * Colours in a form this parser does not know count as opaque, so a check
 * never passes a visible outline by mistake.
 */
export function parseColorAlpha(value) {
  if (typeof value !== "string") return 1;
  const text = value.trim().toLowerCase();
  if (text === "" || text === "transparent") return 0;
  const match = /^rgba?\((.*)\)$/.exec(text);
  if (!match) return 1;
  const parts = match[1].replace("/", ",").split(/[\s,]+/).filter((part) => part !== "");
  if (parts.length < 4) return 1;
  const raw = parts[3];
  const alpha = raw.endsWith("%") ? parseFloat(raw) / 100 : parseFloat(raw);
  return Number.isFinite(alpha) ? alpha : 1;
}

/** Width in CSS pixels from a computed value such as "2px". Unknown values count as 0. */
function parseWidthPx(value) {
  const width = parseFloat(value);
  return Number.isFinite(width) ? width : 0;
}

/** True when the computed outline would be visible to a reader. */
export function isOutlineVisible(outline) {
  if (!outline) return false;
  const style = String(outline.style ?? "none").trim().toLowerCase();
  if (style === "none" || style === "hidden") return false;
  if (!(parseWidthPx(outline.width) > 0)) return false;
  return parseColorAlpha(outline.color) > 0;
}

/** True when the element is focusable by script but not by Tab, and not a control. */
function isNonInteractive(active) {
  if (!active) return false;
  const tabIndex = String(active.tabIndex ?? "");
  if (tabIndex !== "-1") return false;
  if (INTERACTIVE_TAGS.has(String(active.tagName ?? "").toUpperCase())) return false;
  if (String(active.role ?? "").toLowerCase() === "button") return false;
  return true;
}

/**
 * FR1 failures for one reading. An empty array means both checks pass.
 * Each failure names the rule, the element and what was drawn.
 */
export function frFailures(reading) {
  const failures = [];
  const active = reading?.active ?? null;
  const next = reading?.next ?? null;

  if (isNonInteractive(active) && isOutlineVisible(active.outline)) {
    failures.push({
      id: "FR1",
      check: "script-focus-outline",
      element: String(active.tagName ?? "").toLowerCase(),
      message: `Script-focused ${String(active.tagName ?? "").toLowerCase()} (tabindex -1) draws an outline: style ${active.outline.style}, width ${active.outline.width}, colour ${active.outline.color}.`,
    });
  }

  if (!next) {
    failures.push({
      id: "FR1",
      check: "tab-focus-ring",
      element: null,
      message: "Pressing Tab once reached no control, so no focus ring could be checked.",
    });
  } else if (!isOutlineVisible(next.outline)) {
    failures.push({
      id: "FR1",
      check: "tab-focus-ring",
      element: String(next.tagName ?? "").toLowerCase(),
      message: `The Tab-next ${String(next.tagName ?? "").toLowerCase()}${next.label ? ` (${next.label})` : ""} shows no focus ring.`,
    });
  }

  return failures;
}

/** Script run inside the page. Reads an element's computed outline. */
const READ_ACTIVE = () => {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return null;
  const style = getComputedStyle(el);
  return {
    tagName: el.tagName,
    tabIndex: el.getAttribute("tabindex") ?? String(el.tabIndex),
    role: el.getAttribute("role") ?? "",
    label: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 80),
    outline: {
      style: style.outlineStyle,
      width: style.outlineWidth,
      color: style.outlineColor,
    },
  };
};

/**
 * Reads FR1 values from a page that is already at the step. It reads the active
 * element first, presses Tab once, then reads the newly focused control.
 * It sends no other input, so the first read shows the page as loaded.
 */
export async function readFr1Reading(page) {
  const active = await page.evaluate(READ_ACTIVE);
  await page.keyboard.press("Tab");
  const next = await page.evaluate(READ_ACTIVE);
  return { active, next };
}

/**
 * Opens a fresh page at a URL and size, reads FR1, then closes the page.
 * options: { browser, url, width, height, settleMs? }. The caller owns the browser.
 */
export async function readFr1(options) {
  const { browser, url, width, height, settleMs = 0 } = options;
  const context = await browser.newContext({ viewport: { width, height } });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    if (settleMs > 0) await page.waitForTimeout(settleMs);
    return await readFr1Reading(page);
  } finally {
    await context.close();
  }
}

// CT1 (GitHub issue #579). The viewports the rule runs at.
export const CT1_SIZES = ["390x844", "360x640"];

/**
 * CT1 failures for the page as it is now. Each failure names the element, its text,
 * the measured ratio and the ratio the text needs. The module is imported here, not at
 * the top of the file, so a Node that cannot load TypeScript still runs every other rule.
 */
export async function readCt1Failures(page) {
  const ct1 = await import("../../src/lib/layout-check-ct1.ts");
  const readings = await ct1.readTextContrast(page);
  return readings.flatMap((reading) => ct1.ctFailures(reading));
}

// CW1 (GitHub issue #581). The content column keeps at least this much room under a phone viewport.
export const CW1_INSET_PX = 48;

// The viewports CW1 runs at.
export const CW1_SIZES = ["390x844", "360x640"];

/**
 * CW1 failures for one reading: { width, viewport } in CSS pixels. An empty array means the
 * content column is at least viewport minus CW1_INSET_PX wide. Equal to the minimum passes.
 * Each failure starts with "CW1" and names the measured width and the minimum it needed.
 */
export function cwFailures(reading) {
  const width = reading?.width;
  const viewport = reading?.viewport;
  if (typeof width !== "number" || !Number.isFinite(width) || typeof viewport !== "number" || !Number.isFinite(viewport)) {
    return ["CW1 no [data-content-column] width to measure"];
  }
  const minimum = viewport - CW1_INSET_PX;
  if (width < minimum) {
    return [`CW1 content column ${width} px, want at least ${minimum} px (viewport ${viewport} px minus ${CW1_INSET_PX})`];
  }
  return [];
}

/** True when a rect has four finite numbers. Anything else is not a measurement. */
function isMeasuredRect(rect) {
  if (!rect) return false;
  return [rect.left, rect.top, rect.right, rect.bottom].every((value) => typeof value === "number" && Number.isFinite(value));
}

/**
 * Overlap of two rects in CSS pixels, or null when they do not overlap. The test is strict:
 * rects that only share an edge have zero overlap and return null.
 * Pure function with no DOM dependency.
 */
export function rectOverlap(a, b) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (!(width > 0) || !(height > 0)) return null;
  return { width, height };
}

/**
 * GO1 failures for one reading. An empty array means no text line or control meets the Ghost.
 * Each failure names the layer (text or control), the element label and the overlap in px.
 * A missing Ghost box or a missing rect fails as "no measurement", so a check never passes silently.
 */
export function goFailures(reading) {
  const ghost = reading?.ghost ?? null;
  if (!isMeasuredRect(ghost)) {
    return [{ id: "GO1", check: "ghost-overlap", layer: null, message: "GO1 no [data-ghost-box] rect to measure." }];
  }

  const layers = [
    { layer: "text", items: Array.isArray(reading?.text) ? reading.text : [] },
    { layer: "control", items: Array.isArray(reading?.controls) ? reading.controls : [] },
  ];
  const failures = [];
  for (const { layer, items } of layers) {
    for (const item of items) {
      const label = String(item?.label ?? "").trim().slice(0, 80) || layer;
      if (!isMeasuredRect(item?.rect)) {
        failures.push({ id: "GO1", check: "ghost-overlap", layer, message: `GO1 no measurement for ${layer} "${label}".` });
        continue;
      }
      const overlap = rectOverlap(item.rect, ghost);
      if (overlap) {
        failures.push({
          id: "GO1",
          check: "ghost-overlap",
          layer,
          message: `GO1 ${layer} "${label}" overlaps the Ghost by ${round(overlap.width)} px wide and ${round(overlap.height)} px tall.`,
        });
      }
    }
  }
  return failures;
}

/** Rounds to one decimal place for messages. */
function round(value) {
  return Math.round(value * 10) / 10;
}

// LC1 (GitHub issue #585). The Seal group may sit at most this far right of the figures column.
export const LC1_MAX_GAP_PX = 64;

/** Script run inside the page. Reads the figures column and the Seal group as plain rects. */
const READ_LC1 = () => {
  const rectOf = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  return { figures: rectOf("[data-figures-column]"), sealGroup: rectOf("[data-seal-group]") };
};

/** Reads LC1 values from a page that is already at the Break the seal step. Sends no input. */
export async function readLc1Reading(page) {
  return page.evaluate(READ_LC1);
}

/**
 * LC1 failures for one reading. An empty array means the columns are coherent:
 * the Seal group starts at most LC1_MAX_GAP_PX right of the figures column, and its top
 * lies within the column's top and bottom. Each failure names the check and the measured value.
 */
export function lcFailures(reading) {
  const figures = reading?.figures ?? null;
  const sealGroup = reading?.sealGroup ?? null;
  if (!isMeasuredRect(figures) || !isMeasuredRect(sealGroup)) {
    return [{ id: "LC1", check: "column-coherence", message: "LC1 no [data-figures-column] or [data-seal-group] rect to measure." }];
  }

  const failures = [];
  const gap = sealGroup.left - figures.right;
  if (gap > LC1_MAX_GAP_PX) {
    failures.push({
      id: "LC1",
      check: "column-gap",
      message: `LC1 Seal group starts ${round(gap)} px right of the figures column, want at most ${LC1_MAX_GAP_PX} px.`,
    });
  }
  if (sealGroup.top < figures.top || sealGroup.top > figures.bottom) {
    failures.push({
      id: "LC1",
      check: "column-top",
      message: `LC1 Seal group top ${round(sealGroup.top)} px is outside the figures column, ${round(figures.top)} px to ${round(figures.bottom)} px.`,
    });
  }
  return failures;
}
