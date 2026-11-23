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
//   readGo1Soil(page)             reads the [data-soil-strip] rect for GO1's reading.soil, or null.
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
//   GO1 also tests each text rect against the optional soil rect ([data-soil-strip]); a text line that
//   overlaps the Soil strip fails with check "soil-overlap". No soil key, or soil null, skips that test.
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
 * GO1 failures for one reading. An empty array means no text line or control meets the Ghost,
 * and no text line meets the Soil strip when the reading carries one.
 * The reading is { ghost, text, controls, soil? }. soil is the [data-soil-strip] rect, or null when
 * the page has no strip. When soil is absent or null the Soil check is skipped; a measured soil
 * rect is tested against every text line. Each failure names the layer (text or control), the element
 * label and the overlap in px. A missing Ghost box or a missing rect fails as "no measurement", so a
 * check never passes silently.
 */
export function goFailures(reading) {
  const ghost = reading?.ghost ?? null;
  if (!isMeasuredRect(ghost)) {
    return [{ id: "GO1", check: "ghost-overlap", layer: null, message: "GO1 no [data-ghost-box] rect to measure." }];
  }

  const soil = reading?.soil ?? null;
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
      if (layer === "text" && isMeasuredRect(soil)) {
        const soilOverlap = rectOverlap(item.rect, soil);
        if (soilOverlap) {
          failures.push({
            id: "GO1",
            check: "soil-overlap",
            layer,
            message: `GO1 text "${label}" overlaps the Soil strip by ${round(soilOverlap.width)} px wide and ${round(soilOverlap.height)} px tall.`,
          });
        }
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

// GO1 soil reader: the [data-soil-strip] rect for goFailures' reading.soil, or null when the page has no strip.
const READ_GO1_SOIL = () => {
  const el = document.querySelector("[data-soil-strip]");
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

/** Reads the Soil strip rect for GO1 from a loaded page. Sends no input. */
export async function readGo1Soil(page) {
  return page.evaluate(READ_GO1_SOIL);
}

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
// SF1 (GitHub issue #587, spec 17 D1, bugfix 2.1): the Seal panel fills its surface. The reading is
//   { panelWidth, surfaceWidth, creamRun }, widths in CSS px. creamRun is the widest run, in CSS px, of
//   cream pixels (each channel within SF1_CREAM_TOLERANCE of SF1_CREAM) on a row through the panel's
//   middle, outside the panel. A run wider than SF1_MAX_CREAM_RUN_PX is a cream strip beside the panel.
//   Any failure is a BLOCKER.
export const SF1_RATIO = 0.99;
export const SF1_CREAM = [246, 234, 212];
export const SF1_CREAM_TOLERANCE = 8;
export const SF1_MAX_CREAM_RUN_PX = 2;

/** True when an RGB triple is cream within SF1_CREAM_TOLERANCE on every channel. */
function isCream(r, g, b) {
  return (
    Math.abs(r - SF1_CREAM[0]) <= SF1_CREAM_TOLERANCE &&
    Math.abs(g - SF1_CREAM[1]) <= SF1_CREAM_TOLERANCE &&
    Math.abs(b - SF1_CREAM[2]) <= SF1_CREAM_TOLERANCE
  );
}

/**
 * Widest run of cream pixels in one row of RGBA bytes, in image pixels. Pixels with index in
 * [excludeFrom, excludeTo) belong to the panel and break a run. Pure function.
 */
export function creamRunPx(rgba, excludeFrom, excludeTo) {
  const width = Math.floor(rgba.length / 4);
  let best = 0;
  let run = 0;
  for (let x = 0; x < width; x += 1) {
    const inPanel = x >= excludeFrom && x < excludeTo;
    const i = x * 4;
    const cream = !inPanel && isCream(rgba[i], rgba[i + 1], rgba[i + 2]);
    run = cream ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/**
 * SF1 failures for one reading. An empty array means the panel fills at least 99% of its surface
 * and no cream strip wider than SF1_MAX_CREAM_RUN_PX sits beside it.
 */
export function sfFailures(reading) {
  const panelWidth = reading?.panelWidth;
  const surfaceWidth = reading?.surfaceWidth;
  const creamRun = reading?.creamRun;
  const measured = [panelWidth, surfaceWidth, creamRun].every((value) => typeof value === "number" && Number.isFinite(value));
  if (!measured) {
    return [{ id: "SF1", check: "panel-fills-surface", message: "SF1 no [data-seal-step] panel, surface or cream row to measure." }];
  }

  const failures = [];
  const minimum = SF1_RATIO * surfaceWidth;
  if (panelWidth < minimum) {
    failures.push({
      id: "SF1",
      check: "panel-width",
      message: `SF1 Seal panel is ${round(panelWidth)} px wide in a ${round(surfaceWidth)} px surface, want at least ${round(minimum)} px (99%).`,
    });
  }
  if (creamRun > SF1_MAX_CREAM_RUN_PX) {
    failures.push({
      id: "SF1",
      check: "cream-strip",
      message: `SF1 a cream strip ${round(creamRun)} px wide sits beside the Seal panel, want at most ${SF1_MAX_CREAM_RUN_PX} px.`,
    });
  }
  return failures;
}

/** Script run inside the page. Reads the Seal panel, its surface and the viewport. Sends no input. */
const READ_SF1 = () => {
  const panel = document.querySelector("[data-seal-step]");
  if (!panel) return null;
  const surface = panel.closest("[data-card]") ?? panel.parentElement;
  if (!surface) return null;
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  return {
    panel: rectOf(panel),
    surface: rectOf(surface),
    viewport: { width: window.innerWidth, height: window.innerHeight },
  };
};

/** Script run in a blank page. Decodes a PNG (base64) and returns the first row as RGBA bytes. */
const DECODE_ROW = async (b64) => {
  const img = new Image();
  img.src = `data:image/png;base64,${b64}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, 1).data;
  return { width: img.width, rgba: Array.from(data) };
};

/**
 * Reads SF1 values from a page already at the Press the seal step. It takes one clipped screenshot
 * row through the panel's middle, decodes it in a blank page of the same context, and measures the
 * cream run outside the panel. The row is null when the panel's middle is outside the viewport.
 */
export async function readSf1Reading(page) {
  const rects = await page.evaluate(READ_SF1);
  if (!rects) return { panelWidth: null, surfaceWidth: null, creamRun: null };
  const { panel, surface, viewport } = rects;
  const left = Math.max(0, surface.left);
  const right = Math.min(viewport.width, surface.right);
  const midY = Math.round(panel.top + panel.height / 2);
  if (!(right > left) || midY < 0 || midY >= viewport.height) {
    return { panelWidth: panel.width, surfaceWidth: surface.width, creamRun: null };
  }

  const png = await page.screenshot({ clip: { x: left, y: midY, width: right - left, height: 1 } });
  const probe = await page.context().newPage();
  let row;
  try {
    await probe.goto("about:blank");
    row = await probe.evaluate(DECODE_ROW, png.toString("base64"));
  } finally {
    await probe.close();
  }

  const scale = row.width / (right - left);
  const excludeFrom = Math.round((panel.left - left) * scale);
  const excludeTo = Math.round((panel.right - left) * scale);
  const runPx = creamRunPx(row.rgba, excludeFrom, excludeTo);
  return { panelWidth: panel.width, surfaceWidth: surface.width, creamRun: runPx / scale };
}

// TT1 (GitHub issue #587, spec 17 D1, bugfix 2.2): the visible wax mark the reader presses is at least
// TT1_MIN_PX square at rest. The reading is { targets: [{ label, wax }] }, one entry per press target,
// where wax is { width, height } in CSS px of the [data-wax] mark (the transform included), or null when
// the target holds no mark. The button wrapper's size never stands in for the mark. Any failure is a BLOCKER.
export const TT1_MIN_PX = 44;

/**
 * TT1 failures for one reading. An empty array means every press target's wax mark is at least
 * TT1_MIN_PX in both width and height. A target with no measurable mark fails.
 */
export function ttFailures(reading) {
  const targets = Array.isArray(reading?.targets) ? reading.targets : [];
  if (targets.length === 0) {
    return [{ id: "TT1", check: "wax-target-size", message: "TT1 no [data-press-target] found to measure." }];
  }

  const failures = [];
  for (const target of targets) {
    const label = String(target?.label ?? "").trim().slice(0, 80) || "press target";
    const wax = target?.wax ?? null;
    const measured = wax && Number.isFinite(wax.width) && Number.isFinite(wax.height);
    if (!measured) {
      failures.push({ id: "TT1", check: "wax-target-size", message: `TT1 no [data-wax] mark measured for "${label}".` });
      continue;
    }
    if (wax.width < TT1_MIN_PX || wax.height < TT1_MIN_PX) {
      failures.push({
        id: "TT1",
        check: "wax-target-size",
        message: `TT1 wax mark for "${label}" is ${round(wax.width)} x ${round(wax.height)} px at rest, want at least ${TT1_MIN_PX} x ${TT1_MIN_PX} px.`,
      });
    }
  }
  return failures;
}

/**
 * Script run inside the page. One entry per press target: [data-press-target], or a role=button that
 * holds a [data-wax] mark. Reads the mark's rect only. Sends no input, so it reads the step at rest.
 */
const READ_TT1 = () => {
  const root = document.querySelector("[data-seal-step]") ?? document;
  const targets = Array.from(root.querySelectorAll("[data-press-target], [role='button']")).filter(
    (el) => el.matches("[data-press-target]") || el.querySelector("[data-wax]"),
  );
  return targets.map((el) => {
    const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 80);
    const wax = el.matches("[data-wax]") ? el : el.querySelector("[data-wax]");
    if (!wax) return { label, wax: null };
    const r = wax.getBoundingClientRect();
    return { label, wax: { width: r.width, height: r.height } };
  });
};

/** Reads TT1 values from a page at the Press the seal step, before any pointer event. Sends no input. */
export async function readTt1Reading(page) {
  return { targets: await page.evaluate(READ_TT1) };
}
