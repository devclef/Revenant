#!/usr/bin/env node
// Revenant layout check (spec 07 and spec 08, design.md "QA browser steps").
// Owner-only: tools/** is not an agent path.
//
// One command walks the judge journey in headless Chromium at each size, runs
// the box and geometry checks (F1, F2, G1 to G3, D1, E1, T0), the spec 08
// checks (N1, W1, X1, B1, L1, R1, LG1 and the polish rows T2, FT1, BAND1) and
// the neutrality and data rules (NT1, NT2), and prints one line per result. It
// is the only copy of those check snippets. design.md points here.
//
// Spec 08 checks (spec 08 design.md "Owner patches", a):
//   N1  numbers-focus   after "See the numbers": the Figures_Heading is focused,
//                       below the Top_Bar and above the viewport bottom, and it
//                       moves at most 1 px from the figures read to the close read.
//   W1  letter-width    letter Stage: the Letter_Text is 28 to 40 em at 1366x800 and
//                       1280x800, and at least 280 px at 360x640.
//   X1  scroll-width    every Stage and page reached: no sideways scroll.
//   B1  figure-boxes    figures and close: every value, answer, change line and
//                       formula box sits inside its Figure_Entry box.
//   L1  line-labels     figures and close: no two Number_Line labels overlap.
//   R1  recall-in-view  recall, scrolled to the top: question, field and next
//                       control are inside the viewport.
//   LG1 landing-ghost   /: the Landing_Ghost is visible and its body covers no
//                       headline line and not the Accent link.
//   T2, FT1, BAND1      polish only: tick labels, footer against the Soil, and the
//                       largest row-to-row colour change in one pixel column at the
//                       light's x from the bottom of the Soil strip: on / down past
//                       the explanation section's top edge, on the persona page's
//                       intact stage down to the first text or the viewport bottom.
// A check whose element is not on this build yet prints a note, not a BLOCKER:
// N1 without [data-figures-heading], B1 without [data-figure-entry] or a
// figValue class, L1 without [data-line-label], LG1 without [data-ghost-pit] on /.
// W1, X1 and R1 measure what every build has and are always checked.
//
// Line format: <PASS|BLOCKER|polish|note> <id> <name> <WxH> <stage> <detail>.
// The spec 08 checks put the measured values and threshold=<...> in <detail>.
//
// Usage:
//   npm run layout-check -- --url http://localhost:3000
//   npm run layout-check -- --url http://localhost:3000 --sizes 360x640
//   npm run layout-check -- --url http://localhost:3000 --all-sizes
//
// Options:
//   --url <origin>      Required. The running app. Start it first, with a database
//                       that has the demo personas (see docs/agent-loop.md).
//   --sizes <WxH,...>   Viewports. Default 1366x800,1280x800,360x640 (spec 08 R27.1).
//   --all-sizes         The seven spec 07 sizes plus 1366x800. Used for the polish pass.
//   --shots <dir>       Screenshots go to <dir>/<WxH>/<stage>.png.
//                       Default layout-check-shots.
//   --chromium <path>   Chromium binary. Default $CHROMIUM_PATH, then /usr/bin/chromium.
//
// Results, one level per line:
//   BLOCKER  Fails the run. Only these:
//            - text or a control on the Ghost's body (G1), or on the Soil strip (F2, F1)
//            - the main button of a stage not fully visible at 1280x800 without scrolling
//            - a spec 08 check that measured its element and failed (N1, W1, X1, B1, L1,
//              R1, LG1)
//            - a flow that cannot be finished: the control is there and does nothing
//            - a judgement word, an exclamation mark or red or green text outside the
//              persona letter (neutrality.md, data-integrity.md)
//   polish   Reported, never fails the run. Every other layout measure: 1 px drift,
//            margins, the Top_Bar height, dust height, a date wrapping, a sideways
//            Ghost move, and any size other than 1280x800 for the button rule.
//   note     A stage this build does not have yet, or one the walk could not reach.
//            Not a failure.
//
// Exit codes: 0 no blocker. 1 at least one blocker. 2 the check could not start
// (bad arguments, no Chromium, or the app does not answer at --url).

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DEFAULT_SIZES = ["1366x800", "1280x800", "360x640"];
const ALL_SIZES = ["360x640", "1024x768", "1280x720", "1280x800", "1366x800", "1440x900", "1920x1080", "2560x1440"];
// Spec 08 thresholds (spec 08 requirements R2, R3, R8, R27).
const PHONE_WIDTH_MAX = 600;
const LETTER_EM_MIN = 28;
const LETTER_EM_MAX = 40;
const LETTER_PHONE_MIN_PX = 280;
const FOCUS_DRIFT_MAX_PX = 1;
const FOCUS_SETTLE_MS = 1000;
// BAND1 column: start this far inside the bottom of the Soil strip, run this far
// past the explanation section's top edge on /, and stop this far above text.
const BAND_INTO_STRIP_PX = 2;
const BAND_EDGE_PAST_PX = 6;
const BAND_TEXT_GAP_PX = 4;
const MAIN_RULE_SIZE = "1280x800";
const TOP_BAR_SIZE = "360x640";
const TOP_BAR_MAX_PX = 96;
const WAIT_MS = 8000;
const PERSONA_PATH = "/demo/personas/us-maya";
const PICK_UP = "Pick up the letter";
const NEXT = "Next question";
const RECORD = "Record my answers";
const BREAK_SEAL = "Break the seal";
const SEE_NUMBERS = "See the numbers";
// The landing's Accent control is a next/link, so the walk finds it by role link.
const LANDING_START = /Open Maya/;
const SHOW_ALL = "Show everything";
const SEALED_BODY = JSON.stringify({ status: "sealed", opensAt: "2099-01-01T00:00:00.000Z" });

// ---------------------------------------------------------------------------
// Page-side checks. Each runs inside the page through page.evaluate, so it must
// stay self-contained. Thresholds come from design.md (Ghost_Body_Box, R5.19).
// ---------------------------------------------------------------------------

// F2: nothing readable or clickable on the Soil strip.
const F2 = () => {
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  if (!soil) return null;
  const onOpaquePanel = (el) => {
    for (let p = el; p && p !== document.querySelector("main"); p = p.parentElement) {
      const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
    }
    return false;
  };
  const hits = [];
  const panelHits = [];
  for (const el of document.querySelectorAll("main h1, main h2, main h3, main p, main li, main a, main button, main input, main label, main summary, header p, header button")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (r.bottom > soil.top && r.top < soil.bottom && r.right > soil.left && r.left < soil.right) {
      (onOpaquePanel(el) ? panelHits : hits).push(el.textContent.trim().slice(0, 40) || el.tagName);
    }
  }
  return { hits, panelHits };
};

// F1: named boxes fully in the window and off the Soil strip. `selectors` is a list of { name, sel }.
const F1 = (selectors) => {
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  return selectors.map(({ name, sel }) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    // A box on an opaque paper panel is drawn over the Soil, so its text still reads.
    const onPanel = (() => {
      for (let p = el; p && p !== document.querySelector("main"); p = p.parentElement) {
        const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
      }
      return false;
    })();
    const onSoil = soil && !onPanel ? r.bottom > soil.top && r.top < soil.bottom : false;
    const onPanelSoil = soil && onPanel ? r.bottom > soil.top && r.top < soil.bottom : false;
    return { name, inView, onSoil, onPanelSoil };
  });
};

// G1 (R5.19): no text line box and no control box on the Ghost_Body_Box.
const G1 = () => {
  const onOpaquePanel = (el, stop) => {
    for (let p = el; p && p !== stop; p = p.parentElement) {
      const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
    }
    return false;
  };
  const g = document.querySelector("[data-ghost-box]")?.getBoundingClientRect();
  if (!g) return null;
  const body = {
    l: g.left + 0.12 * g.width,
    r: g.right - 0.12 * g.width,
    t: g.top + 0.155 * g.height,
    b: g.bottom - 0.12 * g.height,
  };
  const hit = (r) => r.width > 0 && r.height > 0 && r.right > body.l && r.left < body.r && r.bottom > body.t && r.top < body.b;
  const hits = [];
  for (const root of [document.querySelector("main"), document.querySelector("header")]) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (!text) continue;
      // Text on an opaque panel inside <main> (an envelope, a card) is drawn over the Ghost and stays readable.
      if (root.tagName === "MAIN" && onOpaquePanel(n.parentElement, root)) continue;
      if (n.parentElement?.closest("[class*=\"nvelope\"]")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (hit(r)) {
          hits.push(`"${text.slice(0, 40)}"`);
          break;
        }
      }
    }
  }
  for (const el of document.querySelectorAll("main a, main button, main input, main label, header button, header a")) {
    // A control on an opaque card is drawn over the Ghost too, and is still usable.
    if (el.closest("main") && onOpaquePanel(el, document.querySelector("main"))) continue;
    if (hit(el.getBoundingClientRect())) hits.push(`control "${(el.textContent.trim() || el.tagName).slice(0, 30)}"`);
  }
  return { hits: [...new Set(hits)] };
};

// G2 (R5.16, R5.17): the Ghost_Box centre x, from the browser's own box.
const G2 = () => {
  const g = document.querySelector("[data-ghost-box]")?.getBoundingClientRect();
  return g ? g.left + g.width / 2 : null;
};

// G3 (R8.14, R6.18): wordmark and headline line up, even side margins, Soil full width.
const G3 = () => {
  const wm = document.querySelector("[data-wordmark]")?.getBoundingClientRect();
  const h1 = document.querySelector("h1")?.getBoundingClientRect();
  const last = document.querySelector("[data-topbar-last]")?.getBoundingClientRect();
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  if (!wm || !last || !soil) return null;
  return {
    leftMargin: wm.left,
    rightMargin: innerWidth - last.right,
    headlineLeft: h1 ? h1.left : null,
    soilLeft: soil.left,
    soilRight: soil.right,
    windowWidth: innerWidth,
  };
};

// D1 (R6.16): the highest drawn canvas row over 3 s, against the ceiling.
const D1 = async () => {
  const c = document.querySelector("[data-soil-canvas]");
  if (!c) return null;
  const ctx = c.getContext("2d");
  const k = c.width / c.getBoundingClientRect().width;
  const bar = document.querySelector("header").getBoundingClientRect().bottom;
  const h1 = document.querySelector("[data-scene-ceiling]")?.getBoundingClientRect().bottom ?? 0;
  const ceiling = Math.max(bar, h1) + 8 - c.getBoundingClientRect().top;
  let highest = Infinity;
  for (let i = 0; i < 30; i++) {
    const rows = Math.max(1, Math.floor(ceiling * k));
    const d = ctx.getImageData(0, 0, c.width, rows).data;
    for (let p = 3; p < d.length; p += 4) {
      if (d[p] > 0) {
        highest = Math.min(highest, Math.floor((p >> 2) / c.width) / k);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { ceiling, drawnAboveCeiling: highest !== Infinity, highest: highest === Infinity ? null : highest };
};

// E1 (R8.8): each Envelope_Front date on one line.
const E1 = () =>
  [...document.querySelectorAll("[data-date]")].map((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    return { text: el.textContent, lines: tops.size };
  });

// T0 (R8.1): the Top_Bar height in CSS px.
const T0 = () => document.querySelector("header")?.getBoundingClientRect().height ?? null;

// ---------------------------------------------------------------------------
// Spec 08 page-side measures (spec 08 design.md "Owner patches", a). Each returns
// { missing: true } when the element it measures is not on this build, so the
// runner prints a note instead of a BLOCKER.
// ---------------------------------------------------------------------------

// N1 (R2, R27.2): focus and position of the Figures_Heading.
const N1_READ = () => {
  const heading = document.querySelector("[data-figures-heading]");
  if (!heading) return { missing: true };
  const bar = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  return {
    focused: document.activeElement === heading,
    active: document.activeElement?.tagName?.toLowerCase() ?? "none",
    top: heading.getBoundingClientRect().top,
    barBottom: bar,
    viewportHeight: innerHeight,
    stage: document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") ?? null,
  };
};

// W1 (R3.2, R3.3, R27.3): the Letter_Text content box, in em and px. Builds that
// predate [data-letter-text] are measured on the letter paragraph inside the
// sealed letter (the longest <p> there), so the check works on main today.
const W1_READ = () => {
  let el = document.querySelector("[data-letter-text]");
  if (!el) {
    const root = document.querySelector('[class*="sealedLetter"]');
    if (root) {
      el = [...root.querySelectorAll("p")].sort((a, b) => b.textContent.length - a.textContent.length)[0] ?? null;
    }
  }
  if (!el) return { missing: true };
  const cs = getComputedStyle(el);
  const px = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const fontPx = parseFloat(cs.fontSize);
  return { px, fontPx, em: px / fontPx, selector: el.hasAttribute("data-letter-text") ? "[data-letter-text]" : "sealed letter <p>" };
};

// X1 (R3.4, R27.4): sideways scroll.
const X1_READ = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
});

// B1 (R3.5, R27.5): every value, answer, change line and formula inside its entry.
const B1_READ = () => {
  const entries = [...document.querySelectorAll("[data-figure-entry]")];
  const hasFigValue = !!document.querySelector('[data-figure-entry] [class*="figValue"]');
  if (!entries.length || !hasFigValue) return { missing: true, entries: entries.length, hasFigValue };
  const outside = [];
  let measured = 0;
  const parts = [
    ["then", '[data-role="then"] [class*="figValue"]'],
    ["now", '[data-role="now"] [class*="figValue"]'],
    ["answer", '[data-line-label="answer"], [class*="figAnswer"]'],
    ["change", '[class*="change"]'],
    ["formula", '[class*="formula"]'],
  ];
  entries.forEach((entry, i) => {
    const e = entry.getBoundingClientRect();
    for (const [name, sel] of parts) {
      for (const el of entry.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        measured += 1;
        const over = Math.max(e.left - r.left, r.right - e.right, e.top - r.top, r.bottom - e.bottom);
        if (over > 0.5) outside.push(`entry ${i + 1} ${name} by ${over.toFixed(1)} px`);
      }
    }
  });
  return { missing: false, entries: entries.length, measured, outside };
};

// L1 (R5.3, R27.5): pairwise overlap of Number_Line labels, per entry.
const L1_READ = () => {
  const labels = [...document.querySelectorAll("[data-line-label]")];
  if (!labels.length) return { missing: true };
  const groups = new Map();
  for (const el of labels) {
    const key = el.closest("[data-figure-entry]") ?? el.parentElement;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  const overlaps = [];
  let worst = 0;
  let g = 0;
  for (const els of groups.values()) {
    g += 1;
    const boxes = els.map((el) => [el.getAttribute("data-line-label") || "label", el.getBoundingClientRect()]);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [na, a] = boxes[i];
        const [nb, b] = boxes[j];
        const area = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        worst = Math.max(worst, area);
        if (area > 0) overlaps.push(`entry ${g}: ${na} and ${nb} overlap ${area.toFixed(1)} px²`);
      }
    }
  }
  return { missing: false, labels: labels.length, overlaps, worst };
};

// R1 (R8.2, R27.6): the recall question, field and next control in the viewport.
const R1_READ = () =>
  [
    ["question", '[data-fit="question"]'],
    ["field", '[data-fit="answer"] input'],
    ["next", '[data-fit="advance"]'],
  ].map(([name, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const r = el.getBoundingClientRect();
    return { name, top: r.top, bottom: r.bottom, left: r.left, right: r.right, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
  });

// LG1 (R9.10, R9.11, R27.7): the Landing_Ghost is visible and its body is clear of
// the headline's line boxes and the Accent link. The body box uses the same
// fractions as G1.
const LG1_READ = (startPattern) => {
  const pit = document.querySelector("[data-ghost-pit]");
  if (!pit) return { missing: true };
  const boxEl = pit.querySelector("[data-ghost-box]") ?? pit;
  const g = boxEl.getBoundingClientRect();
  let opacity = 1;
  for (let el = boxEl; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
  const inViewport = g.right > 0 && g.bottom > 0 && g.left < innerWidth && g.top < innerHeight;
  const body = { l: g.left + 0.12 * g.width, r: g.right - 0.12 * g.width, t: g.top + 0.155 * g.height, b: g.bottom - 0.12 * g.height };
  const hit = (r) => r.width > 0 && r.height > 0 && r.right > body.l && r.left < body.r && r.bottom > body.t && r.top < body.b;
  const hits = [];
  const h1 = document.querySelector("h1");
  if (h1) {
    const range = document.createRange();
    range.selectNodeContents(h1);
    if ([...range.getClientRects()].some(hit)) hits.push("headline");
  }
  const re = new RegExp(startPattern);
  const link = [...document.querySelectorAll("a")].find((a) => re.test(a.textContent));
  if (link && hit(link.getBoundingClientRect())) hits.push("Accent link");
  return { missing: false, width: g.width, height: g.height, opacity, inViewport, hits, centre: g.left + g.width / 2 };
};

// T2 (R6.5, polish): tick labels per scale. Uses [data-tick-label] when a build
// has it, else the children of each scale's labels row.
const T2_READ = () => {
  let groups = [...document.querySelectorAll("[data-tick-labels]")].map((row) => [...row.querySelectorAll("[data-tick-label]")]);
  if (!groups.length) groups = [...document.querySelectorAll('[class*="labels"]')].map((row) => [...row.children]);
  const overlaps = [];
  groups.forEach((els, g) => {
    const boxes = els.map((el) => [el.textContent.trim(), el.getBoundingClientRect()]).filter(([, r]) => r.width > 0);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [ta, a] = boxes[i];
        const [tb, b] = boxes[j];
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) overlaps.push(`scale ${g + 1}: "${ta}" and "${tb}"`);
      }
    }
  });
  return { scales: groups.length, overlaps };
};

// FT1 (R12.6, polish): with the page scrolled to its end, the footer against the Soil strip.
const FT1_READ = () => {
  const footer = document.querySelector("footer");
  if (!footer) return { missing: true };
  const f = footer.getBoundingClientRect();
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  const touches = soil ? f.bottom > soil.top && f.top < soil.bottom : false;
  return { missing: false, top: f.top, bottom: f.bottom, soilTop: soil?.top ?? null, soilBottom: soil?.bottom ?? null, touches };
};

// BAND1 (R9.13, polish): one column of pixels at the light's x, from just inside
// the bottom of the Soil strip downwards, in page coordinates. On / it runs past
// the first screen to BAND_EDGE_PAST_PX below the top edge of the explanation
// section, because the band ends in a hard edge there. It stops BAND_TEXT_GAP_PX
// above the first text or control the column would cross, so it never reads text.
const BAND1_GEOMETRY = ({ edgePast, textGap, intoStrip }) => {
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  if (!soil) return null;
  const pit = document.querySelector("[data-ghost-pit]")?.getBoundingClientRect();
  const frameW = Math.min(innerWidth, 1440);
  const frameL = (innerWidth - frameW) / 2;
  const xView = pit ? pit.left + pit.width / 2 : innerWidth >= 900 ? frameL + 0.72 * frameW : innerWidth / 2;
  const x = Math.round(Math.min(innerWidth - 1, Math.max(0, xView)));
  const sy = window.scrollY;
  const top = Math.floor(soil.bottom + sy) - intoStrip;
  // The page's explanation block is the element after the Scene root (only on /).
  let end = innerHeight + sy;
  let edge = null;
  const root = document.querySelector('[data-ceremony="scene"]');
  if (root) {
    let el = root;
    while (el && !el.nextElementSibling) el = el.parentElement;
    const next = el?.nextElementSibling;
    if (next) {
      edge = Math.round(next.getBoundingClientRect().top + sy);
      end = edge + edgePast;
    }
  }
  // Stop above the first text, control or opaque panel (a card, a paper surface)
  // inside <main> that crosses the column, so its edge is not read as the band.
  // The explanation section on / sits outside <main>, so its edge is still read.
  // A wrapper painted in the page's own background colour is not a panel.
  const pageBg = getComputedStyle(document.body).backgroundColor;
  const opaque = (el) => {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg === pageBg) return false;
    const m = bg.match(/[\d.]+/g);
    return !!m && (m.length < 4 || Number(m[3]) >= 0.9);
  };
  let firstText = null;
  const candidates = [
    ...document.querySelectorAll("h1, h2, h3, p, li, a, button, input, label, summary"),
    ...[...document.querySelectorAll("main *")].filter(opaque),
  ];
  for (const t of candidates) {
    const r = t.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.left > x || r.right < x) continue;
    const tTop = r.top + sy;
    if (tTop > top && (firstText === null || tTop < firstText)) firstText = tTop;
  }
  if (firstText !== null) end = Math.min(end, Math.floor(firstText) - textGap);
  return { x, top, bottom: Math.floor(end), edge, firstText: firstText === null ? null : Math.round(firstText), docHeight: document.documentElement.scrollHeight };
};


// Neutrality and data (neutrality.md, data-integrity.md). Persona letter text is
// exempt from the words check (the letter is the persona's own voice); it is
// read by the copy test instead. Everything else on screen is checked.
const NEUTRALITY = () => {
  const JUDGEMENT = /\b(soared|plunged|skyrocketed|finally|cheaper|dearer|better|worse)\b/i;
  const hueName = (css) => {
    const parts = css.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    if (parts.length > 3 && Number(parts[3]) < 0.5) return null;
    const [r, g, b] = parts.slice(0, 3).map((v) => Number(v) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.25 || max < 0.4) return null;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h <= 15 || h >= 345) return "red";
    if (h >= 80 && h <= 170) return "green";
    return null;
  };
  const judgement = new Set();
  const exclaim = new Set();
  const colour = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || el.closest("script, style, noscript")) continue;
    if (el.closest('[class*="sealedLetter"]')) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const match = text.match(JUDGEMENT);
    if (match) judgement.add(match[0].toLowerCase());
    if (text.includes("!")) exclaim.add(text.slice(0, 40));
    const hue = hueName(getComputedStyle(el).color);
    if (hue) colour.add(`${hue} text "${text.slice(0, 40)}"`);
  }
  return { judgement: [...judgement], exclaim: [...exclaim], colour: [...colour] };
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Waits until no CSS animation or transition is running, so box checks read the settled layout.
async function settle(page, maxMs = 5000) {
  // The Ghost bob repeats forever, so only finite animations count.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
    null,
    { timeout: maxMs },
  ).catch(() => {});
  await sleep(200);
}

function parseArgs(argv) {
  const opts = { url: null, sizes: DEFAULT_SIZES, shots: "layout-check-shots", chromium: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      return value;
    };
    if (arg === "--url") opts.url = take();
    else if (arg === "--sizes") opts.sizes = take().split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--all-sizes") opts.sizes = ALL_SIZES;
    else if (arg === "--shots") opts.shots = take();
    else if (arg === "--chromium") opts.chromium = take();
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown option ${arg}`);
  }
  if (!opts.help) {
    if (!opts.url) throw new Error("--url is required, for example --url http://localhost:3000");
    try {
      opts.url = new URL(opts.url).origin;
    } catch {
      throw new Error(`--url is not a URL: ${opts.url}`);
    }
    for (const size of opts.sizes) {
      if (!/^\d+x\d+$/.test(size)) throw new Error(`size "${size}" must look like 1280x800`);
    }
  }
  return opts;
}

const LEVEL_LABEL = { blocker: "BLOCKER", polish: "polish", note: "note", ok: "PASS" };

function makeReport() {
  const items = [];
  const counts = { blocker: 0, polish: 0, note: 0 };
  let ctx = null;
  return {
    items,
    counts,
    setContext(next) {
      ctx = next;
    },
    stage(stage) {
      if (!ctx) return;
      ctx.stage = stage;
      console.log(`\n[${ctx.size}] ${stage}`);
    },
    // One line per result: <level> <id> <name> <WxH> <stage> <detail>. `name` is
    // the spec 08 check name, or "-" for the older checks.
    add(level, check, detail, name = "-") {
      if (level in counts) counts[level] += 1;
      if (level === "blocker") items.push({ size: ctx?.size, stage: ctx?.stage, check, detail });
      console.log(`  ${LEVEL_LABEL[level].padEnd(7)} ${check.padEnd(5)} ${name.padEnd(14)} ${ctx?.size ?? "-"} ${ctx?.stage ?? "-"} ${detail}`);
    },
  };
}

async function stageOf(page) {
  return page.evaluate(() => document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") ?? null);
}

async function waitForStage(page, name, timeout = WAIT_MS) {
  try {
    await page.waitForFunction(
      (n) => document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") === n,
      name,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

async function shot(page, ctx, stage, { keepScroll = false } = {}) {
  const dir = join(ctx.shotsDir, ctx.size);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${stage}.png`);
  // Scroll to the top only when the page is scrolled: a scroll to 0 on an unscrolled page moves the recall layout.
  // keepScroll shoots where the judge is, for example where "See the numbers" landed.
  if (!keepScroll && (await page.evaluate(() => window.scrollY)) > 0) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: file });
  // A screenshot can restart the page's transitions, so the layout is read again once they finish.
  await settle(page);
  ctx.rep.add("ok", "shot", file);
}

function checkSoil(page, ctx) {
  return page.evaluate(F2).then((r) => {
    if (r === null) return;
    if (r.hits.length) ctx.rep.add("blocker", "F2", `text or control on the Soil strip: ${r.hits.join(" | ")}`);
    else ctx.rep.add("ok", "F2", "no text or control on the Soil strip");
    if (r.panelHits.length) ctx.rep.add("polish", "F2", `paper panel overlaps the Soil strip (text is on the paper, so it reads): ${r.panelHits.join(" | ")}`);
  });
}

async function checkGhostBody(page, ctx) {
  const r = await page.evaluate(G1);
  if (r === null) return;
  if (r.hits.length) ctx.rep.add("blocker", "G1", `text or control on the Ghost body (scrollY ${Math.round(await page.evaluate(() => window.scrollY))}): ${r.hits.join(" | ")}`);
  else ctx.rep.add("ok", "G1", "no text or control on the Ghost body");
}

async function checkFit(page, ctx, selectors) {
  const results = await page.evaluate(F1, selectors);
  const missing = results.filter((r) => r.missing).map((r) => r.name);
  if (missing.length) ctx.rep.add("note", "F1", `not on this build: ${missing.join(", ")}`);
  for (const r of results.filter((x) => !x.missing)) {
    if (r.onSoil) ctx.rep.add("blocker", "F1", `"${r.name}" sits on the Soil strip`);
    else if (r.onPanelSoil) ctx.rep.add("polish", "F1", `"${r.name}" paper panel overlaps the Soil strip`);
    else if (!r.inView) ctx.rep.add("polish", "F1", `"${r.name}" is not fully in the window (scrolling; fine on a phone)`);
  }
  if (results.every((r) => r.missing || (r.inView && !r.onSoil))) ctx.rep.add("ok", "F1", "named boxes in view and off the Soil strip");
}

// The main button of a stage: blocker only at 1280x800 when it is not fully in view.
// The main button of a stage. The judge must see the first ones without scrolling
// (intact and the landing, at 1280x800). Every other main button must be reachable:
// scrolled into view, with the button at the top of the hit test at its centre.
// Being below the fold is polish.
async function checkMainButton(page, ctx, name, mustBeInView = false, role = "button") {
  const button = page.getByRole(role, { name, exact: typeof name === "string" }).first();
  if ((await button.count()) === 0) return;
  const label = typeof name === "string" ? `"${name}"` : `"${name.source}"`;
  const r = await button.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, scrollY: window.scrollY };
  });
  const inView = r.top >= 0 && r.left >= 0 && r.bottom <= ctx.h && r.right <= ctx.w;
  if (inView) {
    ctx.rep.add("ok", "BTN", `main button ${label} is fully in view`);
    return;
  }
  if (mustBeInView) {
    const detail = `main button ${label} is not fully in view without scrolling (bottom ${Math.round(r.bottom)} px, window ${ctx.h} px, scrollY ${Math.round(r.scrollY)})`;
    ctx.rep.add(ctx.size === MAIN_RULE_SIZE ? "blocker" : "polish", "BTN", detail);
    return;
  }
  await button.scrollIntoViewIfNeeded();
  const reachable = await button.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  if (reachable) {
    ctx.rep.add("polish", "BTN", `main button ${label} is below the fold at ${ctx.size} (bottom ${Math.round(r.bottom)} px); reachable after scrolling`);
  } else {
    ctx.rep.add("blocker", "BTN", `main button ${label} cannot be reached: another element covers its centre`);
  }
}

// G2 (R5.16, R5.17). The intact centre is the reference for later stages.
async function checkGhostCentre(page, ctx, stage) {
  const centre = await page.evaluate(G2);
  if (centre === null) return;
  const frameW = Math.min(ctx.w, 1440);
  const frameL = (ctx.w - frameW) / 2;
  const expected = ctx.w >= 900 ? frameL + 0.72 * frameW : ctx.w * 0.5;
  if (stage === "intact") {
    ctx.intactCentre = centre;
    if (Math.abs(centre - expected) > 1) ctx.rep.add("polish", "G2", `Ghost centre x ${centre.toFixed(1)} px, expected ${expected.toFixed(1)} px`);
    else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px (expected ${expected.toFixed(1)})`);
    return;
  }
  if (ctx.intactCentre === null) return;
  const diff = Math.abs(centre - ctx.intactCentre);
  if (diff > 1) ctx.rep.add("polish", "G2", `Ghost moved sideways by ${diff.toFixed(1)} px from intact (${centre.toFixed(1)} px)`);
  else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px, same as intact`);
}

async function checkFrame(page, ctx) {
  const g = await page.evaluate(G3);
  if (g === null) return;
  const problems = [];
  if (g.headlineLeft !== null && Math.abs(g.headlineLeft - g.leftMargin) > 1) problems.push(`headline left ${g.headlineLeft.toFixed(1)} px, wordmark ${g.leftMargin.toFixed(1)} px`);
  if (Math.abs(g.rightMargin - g.leftMargin) > 1) problems.push(`margins ${g.leftMargin.toFixed(0)} px and ${g.rightMargin.toFixed(0)} px`);
  if (g.soilLeft !== 0 || Math.abs(g.soilRight - g.windowWidth) > 1) problems.push("Soil does not run the full window width");
  if (problems.length) ctx.rep.add("polish", "G3", problems.join("; "));
  else ctx.rep.add("ok", "G3", `frame aligned: margins ${g.leftMargin.toFixed(0)} px each side`);
}

async function checkDust(page, ctx) {
  const r = await page.evaluate(D1);
  if (r === null) return;
  if (r.drawnAboveCeiling) ctx.rep.add("polish", "D1", `dust drawn ${r.highest.toFixed(1)} px, above the ceiling ${r.ceiling.toFixed(1)} px`);
  else ctx.rep.add("ok", "D1", `no dust above the ceiling (${r.ceiling.toFixed(1)} px)`);
}

async function checkDates(page, ctx) {
  const dates = await page.evaluate(E1);
  const wrapped = dates.filter((d) => d.lines !== 1);
  if (wrapped.length) ctx.rep.add("polish", "E1", `date wraps onto ${wrapped[0].lines} lines: "${wrapped[0].text}"`);
  else if (dates.length) ctx.rep.add("ok", "E1", `${dates.length} date(s) on one line`);
}

async function checkTopBar(page, ctx) {
  if (ctx.size !== TOP_BAR_SIZE) return;
  const height = await page.evaluate(T0);
  if (height === null) return;
  if (height > TOP_BAR_MAX_PX) ctx.rep.add("polish", "T0", `Top_Bar ${height.toFixed(1)} px tall (limit ${TOP_BAR_MAX_PX} px at 360 wide)`);
  else ctx.rep.add("ok", "T0", `Top_Bar ${height.toFixed(1)} px tall`);
}

async function checkNeutrality(page, ctx) {
  const r = await page.evaluate(NEUTRALITY);
  if (r.judgement.length) ctx.rep.add("blocker", "NT1", `judgement word in UI copy: ${r.judgement.join(", ")}`);
  if (r.exclaim.length) ctx.rep.add("blocker", "NT1", `exclamation mark in UI copy: ${r.exclaim.slice(0, 3).map((t) => `"${t}"`).join(", ")}`);
  if (r.colour.length) ctx.rep.add("blocker", "NT2", `${r.colour.slice(0, 3).join("; ")} (red and green are not used for figures or controls)`);
  if (!r.judgement.length && !r.exclaim.length && !r.colour.length) ctx.rep.add("ok", "NT1", "no judgement words, exclamation marks or red or green text");
}

// ---------------------------------------------------------------------------
// Spec 08 checks. BLOCKER only when the element was measured and failed; a
// missing element is a note (see the header).
// ---------------------------------------------------------------------------

const isPhone = (ctx) => ctx.w < PHONE_WIDTH_MAX;

async function checkLetterWidth(page, ctx) {
  const r = await page.evaluate(W1_READ);
  if (r.missing) {
    ctx.rep.add("note", "W1", "no Letter_Text on this page", "letter-width");
    return;
  }
  if (isPhone(ctx)) {
    const detail = `width=${r.px.toFixed(1)}px (${r.em.toFixed(1)}em, ${r.selector}) threshold=>=${LETTER_PHONE_MIN_PX}px`;
    ctx.rep.add(r.px >= LETTER_PHONE_MIN_PX ? "ok" : "blocker", "W1", detail, "letter-width");
    return;
  }
  const ok = r.em >= LETTER_EM_MIN && r.em <= LETTER_EM_MAX;
  const detail = `width=${r.em.toFixed(1)}em (${r.px.toFixed(1)}px at ${r.fontPx}px, ${r.selector}) threshold=${LETTER_EM_MIN}em..${LETTER_EM_MAX}em`;
  ctx.rep.add(ok ? "ok" : "blocker", "W1", detail, "letter-width");
}

async function checkScrollWidth(page, ctx) {
  const r = await page.evaluate(X1_READ);
  const detail = `scrollWidth=${r.scrollWidth}px clientWidth=${r.clientWidth}px threshold=scrollWidth<=clientWidth`;
  ctx.rep.add(r.scrollWidth <= r.clientWidth ? "ok" : "blocker", "X1", detail, "scroll-width");
}

async function checkFigureBoxes(page, ctx) {
  const r = await page.evaluate(B1_READ);
  if (r.missing) {
    ctx.rep.add("note", "B1", `not on this build: ${r.entries ? "" : "[data-figure-entry] "}${r.hasFigValue ? "" : "figValue class"}`.trim(), "figure-boxes");
    return;
  }
  const detail = `entries=${r.entries} boxes=${r.measured} outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 4).join("; ")})` : ""} threshold=0`;
  ctx.rep.add(r.outside.length ? "blocker" : "ok", "B1", detail, "figure-boxes");
}

async function checkLineLabels(page, ctx) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const r = await page.evaluate(L1_READ);
  if (r.missing) {
    ctx.rep.add("note", "L1", "not on this build: no [data-line-label] elements", "line-labels");
    return;
  }
  const detail = `labels=${r.labels} worst=${r.worst.toFixed(1)}px²${r.overlaps.length ? ` (${r.overlaps.slice(0, 3).join("; ")})` : ""} threshold=0px²`;
  ctx.rep.add(r.overlaps.length ? "blocker" : "ok", "L1", detail, "line-labels");
}

async function checkRecallInView(page, ctx) {
  // R27.6 reads with the page scrolled to the top. Focus on the field can scroll
  // the page by itself, which would hide a field that sits below the fold.
  const scrolledBy = await page.evaluate(() => window.scrollY);
  if (scrolledBy > 0) await page.evaluate(() => window.scrollTo(0, 0));
  // Then read only once every box has stayed put for 400 ms.
  let results = await page.evaluate(R1_READ);
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const next = await page.evaluate(R1_READ);
    const still = next.every((r, k) => r.missing || Math.abs(r.top - results[k].top) < 0.5);
    results = next;
    if (still) break;
  }
  const missing = results.filter((r) => r.missing).map((r) => r.name);
  const out = results.filter((r) => !r.missing && !r.inView);
  const parts = results.filter((r) => !r.missing).map((r) => `${r.name}=${Math.round(r.top)}..${Math.round(r.bottom)}px`);
  const detail = `${parts.join(" ")}${missing.length ? ` missing=${missing.join(",")}` : ""} viewport=${ctx.w}x${ctx.h} focusScroll=${Math.round(scrolledBy)}px threshold=inside viewport at scrollY 0`;
  // A missing field is a flow problem the walk reports itself, so only out-of-view boxes block here.
  ctx.rep.add(out.length || missing.length === results.length ? "blocker" : "ok", "R1", detail, "recall-in-view");
}

async function checkLandingGhost(page, ctx) {
  // The rise is CSS; wait for every finite animation on the Ghost to finish.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
    null,
    { timeout: 5000 },
  ).catch(() => {});
  const r = await page.evaluate(LG1_READ, LANDING_START.source);
  if (r.missing) {
    ctx.rep.add("note", "LG1", "not on this build: no [data-ghost-pit] on /", "landing-ghost");
    return;
  }
  const visible = r.width > 0 && r.height > 0 && r.opacity > 0 && r.inViewport;
  const detail = `box=${r.width.toFixed(0)}x${r.height.toFixed(0)}px opacity=${r.opacity.toFixed(2)} inViewport=${r.inViewport} overlaps=${r.hits.length ? r.hits.join(",") : "none"} threshold=visible, no overlap`;
  ctx.rep.add(visible && !r.hits.length ? "ok" : "blocker", "LG1", detail, "landing-ghost");
}

async function checkTicks(page, ctx) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const r = await page.evaluate(T2_READ);
  if (!r.scales) return;
  const detail = `scales=${r.scales} overlaps=${r.overlaps.length}${r.overlaps.length ? ` (${r.overlaps.slice(0, 3).join("; ")})` : ""} threshold=0`;
  ctx.rep.add(r.overlaps.length ? "polish" : "ok", "T2", detail, "tick-labels");
}

async function checkFooter(page, ctx) {
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(150);
  const r = await page.evaluate(FT1_READ);
  await page.evaluate((y) => window.scrollTo(0, y), before);
  if (r.missing) {
    ctx.rep.add("note", "FT1", "no <footer> on this page", "footer");
    return;
  }
  const soil = r.soilTop === null ? "no Soil strip" : `soil=${Math.round(r.soilTop)}..${Math.round(r.soilBottom)}px`;
  ctx.rep.add(r.touches ? "polish" : "ok", "FT1", `footer=${Math.round(r.top)}..${Math.round(r.bottom)}px ${soil} threshold=no overlap`, "footer");
}

// BAND1: reads the screenshot's pixels in a blank page through a canvas, so the
// check needs no image library. The clip is in page coordinates with a full-page
// capture, so the column can run past the first screen.
async function checkLightBand(page, ctx) {
  if ((await page.evaluate(() => window.scrollY)) > 0) await page.evaluate(() => window.scrollTo(0, 0));
  const geo = await page.evaluate(BAND1_GEOMETRY, { edgePast: BAND_EDGE_PAST_PX, textGap: BAND_TEXT_GAP_PX, intoStrip: BAND_INTO_STRIP_PX });
  if (geo === null || geo.bottom - geo.top < 2) return;
  const fullPage = geo.bottom > ctx.h;
  const png = await page.screenshot({ fullPage, clip: { x: geo.x, y: geo.top, width: 1, height: geo.bottom - geo.top } });
  const blank = await page.context().newPage();
  try {
    const edgeRow = geo.edge === null ? -1 : geo.edge - geo.top;
    const worst = await blank.evaluate(async ([b64, edgeAt]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, 1, img.height).data;
      let max = 0;
      let at = 0;
      let edgeMax = null;
      for (let y = 1; y < img.height; y++) {
        for (let ch = 0; ch < 3; ch++) {
          const diff = Math.abs(d[y * 4 + ch] - d[(y - 1) * 4 + ch]);
          if (diff > max) {
            max = diff;
            at = y;
          }
          // The explanation section's top edge, within 2 rows either side.
          if (edgeAt >= 0 && Math.abs(y - edgeAt) <= 2) edgeMax = Math.max(edgeMax ?? 0, diff);
        }
      }
      return { max, at, edgeMax };
    }, [png.toString("base64"), edgeRow]);
    const edge = geo.edge === null ? "" : ` explanationTop=${geo.edge}px edgeChange=${worst.edgeMax ?? "n/a"}`;
    const text = geo.firstText === null ? "" : ` firstText=${geo.firstText}px`;
    const detail = `x=${geo.x}px rows=${geo.top}..${geo.bottom}px${fullPage ? " (full page)" : ""}${edge}${text} maxRowChange=${worst.max} at y=${geo.top + worst.at}px threshold=<=2`;
    ctx.rep.add(worst.max <= 2 ? "ok" : "polish", "BAND1", detail, "light-band");
  } finally {
    await blank.close();
  }
}

// N1: after the control press, read once at FOCUS_SETTLE_MS (R2.2's limit), then
// again FOCUS_SETTLE_MS after the close Stage, and compare the heading top.
async function checkNumbersFocus(page, ctx, via, shotName = null) {
  const began = Date.now();
  // The figures shot: the fade-up settles to close about 780 ms after the press,
  // before the first read at about 1,000 ms, so the shot is taken first, as a
  // plain viewport capture where the press landed (no scroll reset, no settle wait).
  if (shotName) {
    const stageNow = await stageOf(page);
    const dir = join(ctx.shotsDir, ctx.size);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${shotName}.png`);
    await page.screenshot({ path: file });
    ctx.rep.add("ok", "shot", `${file} at data-ceremony "${stageNow}", scrollY ${Math.round(await page.evaluate(() => window.scrollY))}`);
  }
  await sleep(Math.max(0, FOCUS_SETTLE_MS - 100 - (Date.now() - began)));
  const first = await page.evaluate(N1_READ);
  if (first.missing) {
    ctx.rep.add("note", "N1", `not on this build: no [data-figures-heading] (after "${via}")`, "numbers-focus");
    return false;
  }
  await waitForStage(page, "close", 12000);
  await sleep(FOCUS_SETTLE_MS);
  const second = await page.evaluate(N1_READ);
  const drift = Math.abs(second.top - first.top);
  const problems = [];
  if (!first.focused || !second.focused) problems.push(`active=${second.focused ? first.active : second.active}`);
  if (first.top < first.barBottom) problems.push("top above the Top_Bar");
  if (first.top >= first.viewportHeight) problems.push("top below the viewport");
  if (drift > FOCUS_DRIFT_MAX_PX) problems.push(`moved ${drift.toFixed(1)}px`);
  const detail = `via="${via}" focused=${first.focused}/${second.focused} top=${first.top.toFixed(1)}px (${first.stage}) then ${second.top.toFixed(1)}px (${second.stage}) barBottom=${first.barBottom.toFixed(1)}px viewport=${first.viewportHeight}px drift=${drift.toFixed(1)}px threshold=focused, barBottom<=top<viewport, drift<=${FOCUS_DRIFT_MAX_PX}px${problems.length ? ` (${problems.join("; ")})` : ""}`;
  ctx.rep.add(problems.length ? "blocker" : "ok", "N1", detail, "numbers-focus");
  return true;
}

// Runs one check. A thrown error here is a check that could not run, which is
// reported as a note so the walk carries on.
async function guard(ctx, label, fn) {
  try {
    await fn();
  } catch (error) {
    ctx.rep.add("note", label, `could not run: ${String(error.message ?? error).split("\n")[0]}`);
  }
}

async function newPage(context) {
  return context.newPage();
}

// Landing: `/` in the scene, then the Emergence, sealed and error stages from the button.
async function landing(context, ctx) {
  ctx.rep.stage("scene");
  const page = await newPage(context);
  let hasStart = false;
  try {
    await page.goto(`${ctx.base}/`, { waitUntil: "load" });
    await sleep(1000);
    const stage = await stageOf(page);
    hasStart = (await page.getByRole("link", { name: LANDING_START }).count()) > 0;
    if (stage !== "scene") {
      ctx.rep.add("note", "scene", `the landing is not a scene on this build (data-ceremony is ${stage ?? "missing"}); skipped`);
    } else {
      await shot(page, ctx, "scene");
      await guard(ctx, "F2", () => checkSoil(page, ctx));
      await guard(ctx, "BTN", () => checkMainButton(page, ctx, LANDING_START, true, "link"));
      await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
      await guard(ctx, "LG1", () => checkLandingGhost(page, ctx));
      await guard(ctx, "BAND1", () => checkLightBand(page, ctx));
      await guard(ctx, "FT1", () => checkFooter(page, ctx));
      await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    }
  } finally {
    await page.close();
  }

  if (!hasStart) {
    ctx.rep.stage("emerging, sealed, error");
    ctx.rep.add("note", "walk", "the landing has no \"Open Maya's letter\" button on this build; these stages are skipped");
    return;
  }

  // A stub answer that arrives after the page has closed has nothing to answer, so its error is ignored.
  const answer = (status, body) => (route) => route.fulfill({ status, contentType: "application/json", body }).catch(() => {});
  await fromLanding(context, ctx, "emerging", async (route) => {
    await sleep(4000);
    await answer(200, SEALED_BODY)(route);
  }, 1500);
  await fromLanding(context, ctx, "sealed", answer(200, SEALED_BODY), 2500);
  await fromLanding(context, ctx, "error", answer(404, "{}"), 1500);
}

async function fromLanding(context, ctx, stage, handler, settleMs) {
  ctx.rep.stage(stage);
  const page = await newPage(context);
  try {
    await page.route("**/api/letters/**", handler);
    await page.goto(`${ctx.base}/`, { waitUntil: "load" });
    await page.getByRole("link", { name: LANDING_START }).click({ timeout: WAIT_MS });
    await sleep(settleMs);
    const got = await stageOf(page);
    if (got !== stage) {
      ctx.rep.add("note", stage, `not reached: data-ceremony is ${got ?? "missing"} after the click`);
      return;
    }
    await shot(page, ctx, stage);
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    if (stage === "emerging" || stage === "sealed") {
      const pickUp = await page.getByRole("button", { name: PICK_UP, exact: true }).count();
      if (pickUp) ctx.rep.add("polish", "walk", `"${PICK_UP}" is shown in the ${stage} stage`);
    }
  } catch (error) {
    ctx.rep.add("note", stage, `not reached: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

// /demo: the index must link to Maya's letter, so the judge can reach the persona.
async function index(context, ctx) {
  ctx.rep.stage("index");
  const page = await newPage(context);
  try {
    const res = await page.goto(`${ctx.base}/demo`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      ctx.rep.add("note", "index", `/demo answered HTTP ${res?.status() ?? "none"}; skipped`);
      return;
    }
    await sleep(800);
    await shot(page, ctx, "index");
    const link = await page.locator(`a[href="${PERSONA_PATH}"]`).count();
    if (link === 0) ctx.rep.add("blocker", "walk", `/demo has no link to ${PERSONA_PATH}, so the judge cannot reach the letter`);
    else ctx.rep.add("ok", "walk", "/demo links to the persona letter");
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  } finally {
    await page.close();
  }
}

// The persona walk: intact, recall (two questions), marks, seal (when built), letter, figures, close.
async function persona(context, ctx) {
  const page = await newPage(context);
  try {
    await personaWalk(page, ctx);
  } catch (error) {
    // Once the persona page is open, an error that stops the walk means the judge cannot finish the flow.
    const where = ctx.stage ? ` at the ${ctx.stage} stage` : "";
    ctx.rep.add("blocker", "walk", `the flow stopped${where}: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

async function personaWalk(page, ctx) {
  ctx.rep.stage("intact");
  const res = await page.goto(`${ctx.base}${PERSONA_PATH}`, { waitUntil: "load" });
  if (!res || res.status() !== 200) {
    ctx.rep.add("blocker", "walk", `${PERSONA_PATH} answered HTTP ${res?.status() ?? "none"}; the flow cannot be finished`);
    return;
  }
  const pickUp = page.getByRole("button", { name: PICK_UP, exact: true });
  try {
    await pickUp.waitFor({ timeout: 15000 });
  } catch {
    ctx.rep.add("blocker", "walk", `no "${PICK_UP}" button on ${PERSONA_PATH}; the flow cannot be finished`);
    return;
  }
  await sleep(2600); // the Ghost's rise (900 ms delay + 1500 ms) settles before the box checks
  await shot(page, ctx, "intact");
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "G1", () => checkGhostBody(page, ctx));
  await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "intact"));
  await guard(ctx, "G3", () => checkFrame(page, ctx));
  await guard(ctx, "E1", () => checkDates(page, ctx));
  await guard(ctx, "T0", () => checkTopBar(page, ctx));
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, PICK_UP, true));
  await guard(ctx, "D1", () => checkDust(page, ctx));
  await guard(ctx, "BAND1", () => checkLightBand(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));

  // Pick up the letter: the recall stage.
  await pickUp.click();
  if (!(await waitForStage(page, "recall"))) {
    ctx.rep.add("blocker", "walk", `"${PICK_UP}" does not reach the recall stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  ctx.rep.stage("recall");
  // The handed layout starts moving a frame after the stage changes, so wait before settling.
  await sleep(1500);
  await settle(page);
  // R1 reads the page as the judge first sees it, before anything scrolls.
  await guard(ctx, "R1", () => checkRecallInView(page, ctx));
  await shot(page, ctx, "recall");
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  await guard(ctx, "T2", () => checkTicks(page, ctx));
  await guard(ctx, "F1", () => checkFit(page, ctx, [
    { name: "question", sel: '[data-fit="question"]' },
    { name: "answer", sel: '[data-fit="answer"]' },
    { name: "advance", sel: '[data-fit="advance"]' },
  ]));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "G1", () => checkGhostBody(page, ctx));
  await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "recall"));
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, NEXT));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));

  const answer = page.locator('input[type="text"]');
  await answer.first().fill("3.20");
  await answer.first().press("Enter");
  if ((await page.getByText("Question 2 of 2").count()) === 0) {
    const counter = await page.evaluate(() => document.querySelector('[data-fit="counter"]')?.textContent ?? "");
    ctx.rep.add("blocker", "walk", `answering question 1 does not reach question 2 (counter: "${counter.trim()}")`);
    return;
  }
  await guard(ctx, "G1", () => checkGhostBody(page, ctx));
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, RECORD));

  // Only the current question's field is rendered, so question 2 is the first text input again.
  await answer.first().fill("3.90");
  await answer.first().press("Enter");

  // Marks: both answers recorded.
  ctx.rep.stage("marks");
  if (!(await waitForStage(page, "marks"))) {
    ctx.rep.add("blocker", "walk", `"${RECORD}" does not reach the marks stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  await sleep(1500);
  await settle(page);
  await shot(page, ctx, "marks");
  await guard(ctx, "F1", () => checkFit(page, ctx, [
    { name: "marks-heading", sel: '[data-fit="marks-heading"]' },
    { name: "marks-answers", sel: '[data-fit="marks-answers"]' },
    { name: "break", sel: '[data-fit="break"]' },
  ]));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "G1", () => checkGhostBody(page, ctx));
  await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "marks"));
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, BREAK_SEAL));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  await guard(ctx, "T2", () => checkTicks(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));

  // Seal: the hold, when this build has the seal target (a later spec 07 task).
  const seal = page.locator("[data-seal-target]").first();
  if ((await seal.count()) > 0) {
    ctx.rep.stage("seal");
    await seal.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const init = { pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      el.dispatchEvent(new PointerEvent("pointerdown", init));
    });
    await sleep(700);
    await shot(page, ctx, "seal");
    await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "seal"));
    await seal.evaluate((el) => {
      const box = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    });
    await sleep(400);
  } else {
    ctx.rep.add("note", "seal", "no seal target on this build (the seal hold is a later spec 07 task); skipped");
  }

  // Break the seal: the letter stage.
  const breakButton = page.getByRole("button", { name: BREAK_SEAL, exact: true });
  if ((await breakButton.count()) === 0) {
    ctx.rep.add("blocker", "walk", `no "${BREAK_SEAL}" button in marks; the flow cannot be finished`);
    return;
  }
  await breakButton.click();
  if (!(await waitForStage(page, "letter"))) {
    ctx.rep.add("blocker", "walk", `"${BREAK_SEAL}" does not reach the letter stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  ctx.rep.stage("letter");
  await sleep(2300);
  await shot(page, ctx, "letter");
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "W1", () => checkLetterWidth(page, ctx));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  // The letter is long by design, so "See the numbers" sits below it and is not held to the 1280x800 rule.
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, SEE_NUMBERS));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));

  // Figures.
  const numbers = page.getByRole("button", { name: SEE_NUMBERS, exact: true });
  if ((await numbers.count()) === 0) {
    ctx.rep.add("blocker", "walk", `no "${SEE_NUMBERS}" button after the letter; the flow cannot be finished`);
    return;
  }
  await numbers.click();
  await sleep(100);
  const figuresStage = await stageOf(page);
  if (figuresStage === "letter") {
    await sleep(400);
    if ((await stageOf(page)) === "letter") {
      ctx.rep.add("blocker", "walk", `"${SEE_NUMBERS}" does nothing (still in the letter stage)`);
      return;
    }
  }
  ctx.rep.stage("figures");
  ctx.rep.add("ok", "walk", `figures reached (data-ceremony is ${await stageOf(page)})`);
  // N1 reads where the press landed the judge, so nothing scrolls before it.
  let headingFound = false;
  await guard(ctx, "N1", async () => {
    headingFound = await checkNumbersFocus(page, ctx, SEE_NUMBERS, "figures");
  });
  ctx.hasFiguresHeading = headingFound;
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));

  // Close.
  if (await waitForStage(page, "close", 12000)) {
    ctx.rep.stage("close");
    await sleep(1000);
    await guard(ctx, "B1", () => checkFigureBoxes(page, ctx));
    await guard(ctx, "L1", () => checkLineLabels(page, ctx));
    await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
    await shot(page, ctx, "close");
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "FT1", () => checkFooter(page, ctx));
  } else {
    ctx.rep.add("note", "close", `not reached: the walk stops at data-ceremony "${await stageOf(page)}" on this build`);
  }
}

// N1 again through "Show everything" from the marks Stage (R2.3). Runs only on
// builds that have [data-figures-heading]; otherwise the first walk's note stands.
async function showAll(context, ctx) {
  ctx.rep.stage("show everything");
  if (!ctx.hasFiguresHeading) {
    ctx.rep.add("note", "N1", `skipped "${SHOW_ALL}": no [data-figures-heading] on this build`, "numbers-focus");
    return;
  }
  const page = await newPage(context);
  try {
    await page.goto(`${ctx.base}${PERSONA_PATH}`, { waitUntil: "load" });
    await page.getByRole("button", { name: PICK_UP, exact: true }).click({ timeout: 15000 });
    if (!(await waitForStage(page, "recall"))) throw new Error("recall not reached");
    await sleep(1500);
    const answer = page.locator('input[type="text"]');
    await answer.first().fill("3.20");
    await answer.first().press("Enter");
    await answer.first().fill("3.90");
    await answer.first().press("Enter");
    if (!(await waitForStage(page, "marks"))) throw new Error("marks not reached");
    await sleep(1500);
    await page.getByRole("button", { name: SHOW_ALL, exact: true }).click({ timeout: WAIT_MS });
    await guard(ctx, "N1", () => checkNumbersFocus(page, ctx, SHOW_ALL));
  } catch (error) {
    ctx.rep.add("note", "N1", `"${SHOW_ALL}" walk not finished: ${String(error.message ?? error).split("\n")[0]}`, "numbers-focus");
  } finally {
    await page.close();
  }
}

// X1 on the other letter pages (R27.4). /l/[id] needs a sealed live letter, which
// this walk does not create, so it measures the page an unknown id renders.
async function otherPages(context, ctx) {
  for (const [stage, path] of [["live", "/demo/live"], ["letter-page", "/l/layoutcheck-unknown-id"]]) {
    ctx.rep.stage(stage);
    const page = await newPage(context);
    try {
      const res = await page.goto(`${ctx.base}${path}`, { waitUntil: "load" });
      await sleep(800);
      if (path.startsWith("/l/")) ctx.rep.add("note", "X1", `${path} answered HTTP ${res?.status() ?? "none"}; measured that page, not a live letter`, "scroll-width");
      await shot(page, ctx, stage);
      await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
      await guard(ctx, "FT1", () => checkFooter(page, ctx));
      await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    } finally {
      await page.close();
    }
  }
}

async function runSize(browser, base, size, opts, rep) {
  const [w, h] = size.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, shotsDir: opts.shots, rep, intactCentre: null, stage: null, hasFiguresHeading: false };
  rep.setContext(ctx);
  console.log(`\n==== ${size} ====`);
  try {
    await guard(ctx, "walk", () => landing(context, ctx));
    await guard(ctx, "walk", () => index(context, ctx));
    await guard(ctx, "walk", () => persona(context, ctx));
    await guard(ctx, "walk", () => showAll(context, ctx));
    await guard(ctx, "walk", () => otherPages(context, ctx));
  } finally {
    await context.close();
  }
}

function printUsage() {
  console.log(`Usage: npm run layout-check -- --url <origin> [--sizes WxH,WxH] [--all-sizes] [--shots <dir>] [--chromium <path>]`);
}

async function main() {
  const started = Date.now();
  // Loaded here, not at the top, so a missing package gets a plain message and exit 2 instead of a stack trace.
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error("layout-check: playwright-core is not installed in this checkout. Run `npm ci` once, then run the check again.");
    return 2;
  }
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`layout-check: ${error.message}`);
    printUsage();
    return 2;
  }
  if (opts.help) {
    printUsage();
    return 0;
  }

  try {
    const res = await fetch(opts.url, { redirect: "manual" });
    await res.body?.cancel();
  } catch (error) {
    console.error(`layout-check: the app does not answer at ${opts.url} (${error.cause?.code ?? error.message}). Start it first.`);
    return 2;
  }

  const executablePath = opts.chromium ?? process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  if (executablePath && !existsSync(executablePath)) {
    console.error(`layout-check: no Chromium at ${executablePath}. Pass --chromium <path>.`);
    return 2;
  }

  opts.shots = resolve(opts.shots);
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
  } catch (error) {
    console.error(`layout-check: could not start Chromium: ${error.message.split("\n")[0]}`);
    return 2;
  }

  const rep = makeReport();
  console.log(`Revenant layout check: ${opts.url}`);
  console.log(`Sizes: ${opts.sizes.join(", ")}. Screenshots: ${opts.shots}`);
  try {
    for (const size of opts.sizes) {
      await runSize(browser, opts.url, size, opts, rep);
    }
  } finally {
    await browser.close();
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log("\n==== Summary ====");
  if (rep.items.length) {
    console.log("Blockers:");
    for (const item of rep.items) console.log(`  [${item.size}] ${item.stage ?? "-"}  ${item.check}  ${item.detail}`);
  }
  console.log(`Blockers: ${rep.counts.blocker}   Polish: ${rep.counts.polish}   Not reached: ${rep.counts.note}`);
  console.log(`Time: ${seconds} s`);
  console.log(rep.counts.blocker ? "Result: FAIL (blockers)" : "Result: PASS (no blockers)");
  return rep.counts.blocker ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`layout-check: ${error.stack ?? error}`);
    process.exitCode = 2;
  },
);
