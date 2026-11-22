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
//
// Exports:
//   CT1_SIZES                     the viewports CT1 runs at.
//   readCt1Failures(page)         CT1 failures for the page as it is now; [] when all text passes.
//   parseColorAlpha(value)        alpha of a computed colour string (0 to 1).
//   isOutlineVisible(outline)     true when style is not none or hidden, width > 0 and colour alpha > 0.
//   frFailures(reading)           FR1 failures for one reading; [] when both checks pass.
//   readFr1Reading(page)          reads a loaded page: active element, Tab, next control. No input before the read.
//   readFr1(options)              opens a page at a URL and size, reads it with readFr1Reading, then closes the page.
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
