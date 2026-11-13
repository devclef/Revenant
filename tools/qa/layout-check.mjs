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
// Spec 09 checks (spec 09 design.md "Owner patches", q, and "Check hooks"):
//   BO1   button-overflow     every button and button-styled link: scrollWidth <= clientWidth.
//   BC1   control-in-card     every control inside its nearest [data-card], fieldset or
//                             [data-stage-panel].
//   RS1   scale-overlap       marks: no box of one [data-recorded-scale] meets a box of another.
//   GZ1   ghost-after-seal    letter, figures, close: no [data-ghost] in the document; during
//                             the seal, the Ghost_Body_Box centre hits the Ghost or nothing.
//   FV1   heading-focus-ring  the Figures_Heading has no outline after a mouse click on the
//                             figures button, and has one after Tab and Enter.
//   CTA1  landing-ctas        /: [data-cta="primary"] and [data-cta="secondary"] in view at the
//                             top; the primary links to /demo.
//   DX1   demo-cards-in-view  /demo at the Desktop_Sizes and the Wide_Size: every persona open
//                             link in view at the top.
//   HW1   hero-wide           2560x1440: the / h1 font size is at least 1.5 times its 1366x800 size.
//   ST1   step-indicator      persona intact to close: [data-step-indicator] present; one
//                             aria-current="step" from recall on; 1 line at 600 px and wider,
//                             at most 2 below.
//   RC1   receipts-in-view    after the figures button at the Desktop_Sizes and the Wide_Size:
//                             the first [data-figure-entry] fully in view.
//   PH1   first-viewport ... PH7 touch-targets: the phone checks at 390x844 and 360x640
//                             (runPhoneChecks, exported for tools/qa/journey-check.mjs).
//   FONT1 fonts-loaded        the sans face loaded and on <body> on every page; the serif face
//                             loaded and on the Letter_Text where the letter shows (runFontCheck,
//                             exported). FONT2 fonts-sans-ui: every h1 to h3 and button in sans.
// Spec 12 Write-step checks (spec 12 design.md "W1.6: viewport arithmetic"), on /demo/live.
// They replace the spec 11 L3 thresholds, which needed every primary control, Next
// included, in view at phone sizes. Next's bottom is printed as a note, never asserted.
//   W1.6  write-step        at 1440x900: the Letter_Field shows 10 lines in view, its top is
//                           in view and the Occasion chips are in view. At phone sizes PH1
//                           asks for the field's top and 6 lines in view instead.
//   W1.7  write-step        at 390x844 and below 600 px: Next's bottom is at most one window
//                           height below the fold (2 x the window height). At 360x640 the
//                           document and the Write card have no sideways scroll.
// A spec 09 check prints BLOCKER only when its ID is passed with --require; any other
// failure prints polish. A spec 09 check whose element is not on the page prints a note.
//
// Spec 10 checks (spec 10 design.md "Owner patches", ad), BLOCKER only with --require:
//   TK1   tick-on-axis        figures and close: each [data-line-tick] top on its
//                             [data-line-axis] top (0±0.5 px), at most 8 px from its
//                             [data-line-label]; no two labels overlap.
//   SI1   step-indicator-fit  from recall on: every [data-step-indicator] li unclipped, in
//                             the viewport and clear of [data-ghost]; four items; at most
//                             2 lines below 600 px, 1 elsewhere. Not run at intact.
//   GT1   ghost-over-text     at the intact, recall and letter Stage starts and scrolled
//                             to the bottom (not marks or seal, which AL1 and SG1 own): no
//                             visible p, h1-h3, li, label, button, a, input or textarea
//                             outside [data-ghost] meets the Ghost_Body_Box. Elements
//                             inside the Ghost (the Envelope date lines, the Seal_Group)
//                             are skipped; ET1 and SG1 check them.
//                             Below 600 px, a note on builds with the pick-up.
//   FC1   load-focus          persona recall reached on load: focus on [data-stage-heading]
//                             and scrollY unchanged. A note on builds with the pick-up.
//   ET1   seal-on-envelope    marks at the Desktop_Sizes and 2560x1440: [data-envelope-seal]
//                             inside its [data-envelope-state], on no [data-date], no two
//                             drawn elements overlapping.
//   SG1   seal-group          marks: [data-seal-group] beside the Ghost_Body_Box (gap 0 to
//                             24 px), level with the seal, clear of the body and the
//                             Envelope; on the phone 0 to 24 px under [data-ghost].
//   AL1   answer-list         marks at every size: [data-answer-list] present, clear of
//                             [data-ghost] and [data-seal-group].
//   CF1   card-fit            every [data-card] and [data-stage-panel]: height minus its
//                             children's union at most 48 px, and it holds a non-control.
//   FP1   fastest-path        a fresh Maya page, pressing only [data-primary-control] (the
//                             button inside a wrapper) to [data-figures-heading]: at most
//                             2 + questions presses. A note on builds with the pick-up, or
//                             where the empty field leaves the button disabled.
// The persona walk works before and after spec 10 tasks 5 and 9: it presses "Pick up
// the letter" only when the build shows it, keeps a prefilled field, fills an empty one,
// and presses "Next question" and "Record my answers" with the mouse.
//
// Line format: <PASS|BLOCKER|polish|note> <id> <name> <WxH> <stage> <detail>.
// The spec 08 and spec 09 checks put the measured values and threshold=<...> in <detail>.
//
// Usage:
//   npm run layout-check -- --url http://localhost:3000
//   npm run layout-check -- --url http://localhost:3000 --sizes 360x640
//   npm run layout-check -- --url http://localhost:3000 --all-sizes
//   npm run layout-check -- --url http://localhost:3000 --require BO1,BC1,FV1
//
// Options:
//   --url <origin>      Required. The running app. Start it first, with a database
//                       that has the demo personas (see docs/agent-loop.md).
//   --sizes <WxH,...>   Viewports. Default 1366x800,1280x800,360x640,390x844,2560x1440
//                       (the spec 09 Evidence_Sizes).
//   --all-sizes         The seven spec 07 sizes plus 1366x800 and 390x844. Used for the polish pass.
//   --require <ID,...>  Spec 09 and spec 10 check IDs whose failures are BLOCKERs. An unknown ID prints a note.
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
//            - a spec 09 check that failed and whose ID was passed with --require
//   polish   Reported, never fails the run. Every other layout measure: 1 px drift,
//            margins, the Top_Bar height, dust height, a date wrapping, a sideways
//            Ghost move, and any size other than 1280x800 for the button rule.
//   note     A stage this build does not have yet, or one the walk could not reach.
//            Not a failure.
//
// Exit codes: 0 no blocker. 1 at least one blocker. 2 the check could not start
// (bad arguments, no Chromium, or the app does not answer at --url).

import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SIZES = ["1366x800", "1280x800", "360x640", "390x844", "2560x1440"];
const ALL_SIZES = ["360x640", "390x844", "1024x768", "1280x720", "1280x800", "1366x800", "1440x900", "1920x1080", "2560x1440"];
// Spec 09 (design.md "Owner patches", q). Only these IDs are accepted by --require.
const SPEC09_CHECKS = ["BO1", "BC1", "RS1", "GZ1", "FV1", "CTA1", "DX1", "HW1", "ST1", "RC1", "PH1", "PH2", "PH3", "PH4", "PH5", "PH6", "PH7", "FONT1", "FONT2"];
// Spec 10 (spec 10 design.md "Owner patches", ad). Also accepted by --require.
const SPEC10_CHECKS = ["TK1", "SI1", "GT1", "FC1", "ET1", "SG1", "AL1", "CF1", "FP1"];
const REQUIRABLE_CHECKS = [...SPEC09_CHECKS, ...SPEC10_CHECKS];
const TK1_AXIS_TOL_PX = 0.5;
const TK1_LABEL_GAP_MAX_PX = 8;
const SI1_ITEMS = 4;
const SI1_LINES_PHONE_MAX = 2;
const SG1_GAP_MAX_PX = 24;
const CF1_SLACK_MAX_PX = 48;
const FP1_MAX_PRESSES = 12;
const FP1_WAIT_STEPS = 15;
// The walk waits this long after load for recall or a "Pick up the letter" button.
const FIRST_STAGE_WAIT_MS = 15000;
// The walk's answer for an empty text field (an Author_Question, spec 10 task 7 on).
const TEXT_ANSWER = "Mostly work, and the evenings at home.";
const DESKTOP_SIZES = ["1366x800", "1280x800"];
const WIDE_SIZE = "2560x1440";
const HW1_BASE_SIZE = "1366x800";
const HW1_RATIO_MIN = 1.5;
const PH_GAP_MAX_PX = 64;
const PH_TOPBAR_MAX_PX = 56;
const PH_TARGET_MIN_PX = 44;
const PH_HEADLINE_LINES_LANDING = 3;
const PH_HEADLINE_LINES_OTHER = 2;
const PH6_SIZE = "390x844";
const PH6_SCREENS = 3;
const ST_LINES_PHONE_MAX = 2;
// Spec 12 W1.6 and W1.7 (design.md "W1.6: viewport arithmetic"). The Write step is
// the first card of /demo/live. Lines are counted only where the whole line is in
// the window. Next is reported, not asserted, at 1440x900 and at the phone sizes.
const WRITE_CARD = '[data-card="live-step-write"]';
const W16_SIZE = "1440x900";
const W16_LINES_DESKTOP = 10;
const W16_LINES_PHONE = 6;
const W17_SIDEWAYS_SIZE = "360x640";
const W17_NEXT_SCREENS_MAX = 2;
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
// Both personas are walked, because spec 09 QA checks name both. Maya's stages
// and shots keep their spec 07 names; Tomás's carry the "eu-tomas/" prefix.
// Tomás's answers follow the unit the recall question shows (spec 09 C8 changes it).
const PERSONAS = [
  { key: "us-maya", path: PERSONA_PATH, prefix: "", answers: () => ["3.20", "3.90"] },
  { key: "eu-tomas", path: "/demo/personas/eu-tomas", prefix: "eu-tomas/", answers: (text) => (/1,000 litres/.test(text) ? ["1850", "1700"] : ["1.85", "1.70"]) },
];
const PICK_UP = "Pick up the letter";
const NEXT = "Next question";
const RECORD = "Record my answers";
const BREAK_SEAL = "Break the seal";
// Spec 09 renames: the figures button (task 14), "Show everything" (task 17) and
// the landing's Accent control (tasks 8 and 9). The walk accepts the old and new
// labels, and the data-* hooks first where a build has them.
const SEE_NUMBERS = "See the numbers";
const FIGURES_LABEL = /^(See the numbers|See the receipts)$/;
const FIGURES_HOOK = '[data-advance="figures"]';
// The landing's Accent control is a next/link, so the walk finds it by role link.
const LANDING_START = /Open Maya/;
const LANDING_HOOK = '[data-cta="primary"]';
const SHOW_ALL = "Show everything";
const SHOW_ALL_LABEL = /^(Show everything|Skip to the receipts)$/;
const LIVE_PATH = "/demo/live";
const LIVE_UNREACHED = "created, confirming, sealing, sealed, the wait, unlock, testify and receipts";
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
  const link = document.querySelector('[data-cta="primary"]') ?? [...document.querySelectorAll("a")].find((a) => re.test(a.textContent));
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
    // Text a reader typed (spec 10 S2.2) is never checked.
    if (el.closest("[data-user-content]")) continue;
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
// Spec 09 page-side measures (spec 09 design.md "Owner patches", q). Each runs
// inside the page and stays self-contained. Each returns { missing: true } when
// the element it measures is not on this build, so the runner prints a note.
// ---------------------------------------------------------------------------

// BO1 (A8.1): button labels inside their buttons, after web fonts load.
const BO1_READ = async () => {
  await document.fonts.ready;
  const els = [...document.querySelectorAll('button, a[class*="button" i]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: true };
  const over = [];
  let worst = 0;
  for (const el of els) {
    const d = el.scrollWidth - el.clientWidth;
    worst = Math.max(worst, d);
    if (d > 0) over.push(`"${(el.textContent.trim() || el.getAttribute("aria-label") || el.tagName).slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}px`);
  }
  return { missing: false, count: els.length, worst, over };
};

// BC1 (A8.2): every control inside its nearest card, fieldset or Stage panel.
const BC1_READ = () => {
  const CONTAINER = "[data-card], fieldset, [data-stage-panel]";
  const containers = document.querySelectorAll(CONTAINER);
  if (!containers.length) return { missing: true };
  const controls = document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, summary, [role="button"], a[class*="button" i]');
  let measured = 0;
  let worst = 0;
  const outside = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const box = el.parentElement?.closest(CONTAINER);
    if (!box) continue;
    measured += 1;
    const c = box.getBoundingClientRect();
    const by = Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
    worst = Math.max(worst, by);
    if (by > 0.5) outside.push(`"${(el.textContent.trim() || el.getAttribute("aria-label") || el.tagName).slice(0, 30)}" by ${by.toFixed(1)}px`);
  }
  return { missing: false, containers: containers.length, measured, worst, outside };
};

// RS1 (A9.2): no box inside one read-only Recall_Scale meets a box in another.
const RS1_READ = async () => {
  await document.fonts.ready;
  const scales = [...document.querySelectorAll("[data-recorded-scale]")];
  if (!scales.length) return { missing: true };
  const sets = scales.map((s) => [s, ...s.querySelectorAll("*")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0));
  let worst = 0;
  const hits = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      let pairWorst = 0;
      for (const a of sets[i]) {
        for (const b of sets[j]) {
          const area = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          pairWorst = Math.max(pairWorst, area);
        }
      }
      worst = Math.max(worst, pairWorst);
      if (pairWorst > 0.01) hits.push(`scale ${i + 1} and ${j + 1} overlap ${pairWorst.toFixed(1)}px²`);
    }
  }
  return { missing: false, scales: scales.length, worst, hits };
};

// GZ1 (A11): during the seal, what the Ghost_Body_Box centre hits; after it, the
// [data-ghost] elements left in the document. The body box uses G1's fractions.
const GZ1_READ = (duringSeal) => {
  const ghosts = document.querySelectorAll("[data-ghost]");
  if (!duringSeal) return { missing: false, count: ghosts.length };
  const ghost = ghosts[0];
  if (!ghost) return { missing: true };
  const g = (ghost.querySelector("[data-ghost-box]") ?? ghost).getBoundingClientRect();
  const x = g.left + g.width / 2;
  const y = (g.top + 0.155 * g.height + g.bottom - 0.12 * g.height) / 2;
  const hit = document.elementFromPoint(x, y);
  const ok = !hit || hit === document.documentElement || hit === document.body || ghost.contains(hit);
  const describe = (el) => (el ? `<${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? ` class="${el.className.slice(0, 40)}"` : ""}>` : "nothing");
  return { missing: false, count: ghosts.length, x, y, hit: describe(hit), ok };
};

// FV1 (A12): the Figures_Heading's outline as it is now.
const FV1_READ = () => {
  const h = document.querySelector("[data-figures-heading]");
  if (!h) return { missing: true };
  const cs = getComputedStyle(h);
  return { missing: false, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, focused: document.activeElement === h, focusVisible: h.matches(":focus-visible") };
};

// CTA1 (B1.1, B1.3, B1.5): the landing's calls to action at the top of the page.
const CTA1_READ = () => {
  const inView = (r) => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  const primary = document.querySelector('[data-cta="primary"]');
  if (!primary) return { missing: true };
  const secondary = document.querySelector('[data-cta="secondary"]');
  const p = primary.getBoundingClientRect();
  const s = secondary?.getBoundingClientRect() ?? null;
  return {
    missing: false,
    href: primary.getAttribute("href"),
    primary: { top: p.top, bottom: p.bottom, inView: inView(p) },
    secondary: s ? { top: s.top, bottom: s.bottom, inView: inView(s) } : null,
  };
};

// DX1 (B2.4): every persona open link on /demo inside the viewport at the top.
const DX1_READ = () => {
  const links = [...document.querySelectorAll('a[href^="/demo/personas/"]')];
  if (!links.length) return { missing: true };
  return {
    missing: false,
    links: links.map((a) => {
      const r = a.getBoundingClientRect();
      return { href: a.getAttribute("href"), bottom: r.bottom, right: r.right, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
    }),
  };
};

// HW1 (B4.1): the h1 font size in px.
const HW1_READ = () => {
  const h1 = document.querySelector("h1");
  return h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
};

// ST1 (C2): the Step_Indicator, its current steps and its line count.
const ST1_READ = () => {
  const el = document.querySelector("[data-step-indicator]");
  if (!el) return { missing: true };
  const items = [...el.querySelectorAll("li")];
  const boxes = (items.length ? items : [...el.children]).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  const tops = [];
  for (const r of boxes) if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
  return { missing: false, current: el.querySelectorAll('[aria-current="step"]').length, steps: items.length, lines: tops.length };
};

// RC1 (C3.5): the first Figure_Entry fully inside the viewport.
const RC1_READ = () => {
  const el = document.querySelector("[data-figure-entry]");
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  return { missing: false, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
};

// ---------------------------------------------------------------------------
// Spec 10 page-side measures (spec 10 design.md "Owner patches", ad). Each runs
// inside the page and stays self-contained, and returns { missing: true } when
// the element it measures is not on this build, so the runner prints a note.
// ---------------------------------------------------------------------------
// TK1 (X1): every Number_Line tick hangs from its axis and reaches its label.
const TK1_READ = () => {
  const axes = [...document.querySelectorAll("[data-line-axis]")];
  if (!axes.length) return { missing: true };
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const ticks = [];
  const overlaps = [];
  for (const axis of axes) {
    let root = axis.parentElement;
    while (root && root !== document.body && !root.querySelector("[data-line-tick]")) root = root.parentElement;
    if (!root) continue;
    const a = axis.getBoundingClientRect();
    const labels = [...root.querySelectorAll("[data-line-label]")]
      .map((el) => ({ el, r: el.getBoundingClientRect(), kind: el.getAttribute("data-line-label") }))
      .filter((l) => l.r.width > 0 && l.r.height > 0);
    for (const t of root.querySelectorAll("[data-line-tick]")) {
      const r = t.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const kind = t.getAttribute("data-line-tick") || "?";
      const cx = (r.left + r.right) / 2;
      const label =
        labels.find((l) => l.kind === kind) ??
        [...labels].sort((x, y) => Math.abs((x.r.left + x.r.right) / 2 - cx) - Math.abs((y.r.left + y.r.right) / 2 - cx))[0];
      const gap = label ? Math.max(0, label.r.top - r.bottom, r.top - label.r.bottom) : null;
      ticks.push({ kind, dTop: r.top - a.top, gap });
    }
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        if (meets(labels[i].r, labels[j].r)) overlaps.push(`${labels[i].el.textContent.trim().slice(0, 20)} / ${labels[j].el.textContent.trim().slice(0, 20)}`);
      }
    }
  }
  if (!ticks.length) return { missing: true };
  return { missing: false, axes: axes.length, ticks, overlaps };
};
// SI1 (X2.2, X2.4): every Step_Indicator item whole, in view and clear of the Ghost.
const SI1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const el = document.querySelector("[data-step-indicator]");
  if (!el) return { missing: true };
  const items = [...el.querySelectorAll("li")];
  const ghost = ghostRectOf(document.querySelector("[data-ghost]"));
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const tops = [];
  const problems = [];
  for (const li of items) {
    const r = li.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
    const name = li.textContent.trim().slice(0, 24);
    if (li.scrollWidth > li.clientWidth) problems.push(`"${name}" clipped (${li.scrollWidth}>${li.clientWidth})`);
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) problems.push(`"${name}" outside the viewport`);
    if (ghost && meets(r, ghost)) problems.push(`"${name}" under [data-ghost]`);
  }
  return { missing: false, items: items.length, lines: tops.length, problems };
};
// GT1 (X2.1, C1.6, C7.1): no text or control outside the Ghost on the Ghost_Body_Box,
// the drawing's box less G1's empty margins (12% each side, 15.5% top, 12% bottom).
const GT1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const ghostEl = document.querySelector("[data-ghost]");
  if (!ghostEl) return { missing: true };
  const box = ghostRectOf(ghostEl);
  if (!box) return { missing: true };
  const g = {
    left: box.left + 0.12 * box.width,
    right: box.right - 0.12 * box.width,
    top: box.top + 0.155 * box.height,
    bottom: box.bottom - 0.12 * box.height,
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
    return true;
  };
  const GT1_SELECTOR = "p, h1, h2, h3, li, label, button, a, input, textarea";
  const els = [...document.querySelectorAll(GT1_SELECTOR)].filter((el) => isVisible(el) && !el.closest("[data-ghost]"));
  const hits = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.right - g.left > 0.5 && g.right - r.left > 0.5 && r.bottom - g.top > 0.5 && g.bottom - r.top > 0.5) {
      hits.push(`<${el.tagName.toLowerCase()}> "${(el.textContent.trim() || el.getAttribute("aria-label") || "").slice(0, 30)}"`);
    }
  }
  return { missing: false, measured: els.length, ghost: { top: g.top, bottom: g.bottom, left: g.left, right: g.right }, hits: [...new Set(hits)] };
};
// FC1 (C1.12): focus and scroll once recall starts on page load.
const FC1_READ = () => {
  const a = document.activeElement;
  return {
    onHeading: !!a && a !== document.body && (a.matches("[data-stage-heading]") || !!a.closest("[data-stage-heading]")),
    active: a ? `<${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""}>` : "none",
    hasHeading: !!document.querySelector("[data-stage-heading]"),
    scrollY: window.scrollY,
  };
};
// ET1 (C6.1, C6.2): the held seal inside its Envelope, on no date line, nothing overlapping.
const ET1_READ = () => {
  const seal = document.querySelector("[data-envelope-seal]");
  if (!seal) return { missing: true };
  const env = seal.closest("[data-envelope-state]") ?? document.querySelector("[data-ghost] [data-envelope-state]") ?? document.querySelector("[data-envelope-state]");
  if (!env) return { missing: true };
  const s = seal.getBoundingClientRect();
  const e = env.getBoundingClientRect();
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const inside = s.left >= e.left - 0.5 && s.top >= e.top - 0.5 && s.right <= e.right + 0.5 && s.bottom <= e.bottom + 0.5;
  const dates = [...env.querySelectorAll("[data-date]")].filter((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const onDates = dates.filter((d) => meets(s, d.getBoundingClientRect())).map((d) => d.textContent.trim().slice(0, 30));
  // Drawn elements: the seal and every text element inside the Envelope box.
  const drawn = [seal, ...[...env.querySelectorAll("p, h1, h2, h3, span")].filter((el) => {
    if (seal.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.textContent.trim() && ![...el.children].some((c) => c.textContent.trim());
  })];
  const pairs = [];
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      const a = drawn[i];
      const b = drawn[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (meets(a.getBoundingClientRect(), b.getBoundingClientRect())) {
        const name = (el) => (el === seal ? "seal" : `"${el.textContent.trim().slice(0, 20)}"`);
        pairs.push(`${name(a)} / ${name(b)}`);
      }
    }
  }
  return { missing: false, state: env.getAttribute("data-envelope-state"), inside, seal: s, envelope: e, dates: dates.length, onDates, pairs };
};
// SG1 (C6.1, C6.3, C6.4, C6.8): the Seal_Group beside the Ghost_Body_Box, level with the seal.
const SG1_READ = (phone) => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const group = document.querySelector("[data-seal-group]");
  if (!group) return { missing: true };
  const r = group.getBoundingClientRect();
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const ghostEl = document.querySelector("[data-ghost]");
  const ghost = ghostRectOf(ghostEl);
  const gb = document.querySelector("[data-ghost-box]")?.getBoundingClientRect() ?? null;
  const body = gb ? { left: gb.left + 0.12 * gb.width, right: gb.right - 0.12 * gb.width, top: gb.top + 0.155 * gb.height, bottom: gb.bottom - 0.12 * gb.height } : null;
  const env = document.querySelector("[data-ghost] [data-envelope-state]")?.getBoundingClientRect() ?? null;
  const seal = document.querySelector("[data-envelope-seal]")?.getBoundingClientRect() ?? null;
  const hint = [...group.querySelectorAll("p")].find((p) => p.textContent.trim()) ?? null;
  const inView = r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = { missing: false, group: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }, inView };
  if (phone) {
    out.ghostBottom = ghost ? ghost.bottom : null;
    out.belowGhost = ghost ? r.top - ghost.bottom : null;
    out.onGhost = ghost ? meets(r, ghost) : false;
    return out;
  }
  if (!body) return { missing: true };
  out.onBody = meets(r, body);
  out.onEnvelope = env ? meets(r, env) : false;
  // The body edge that faces the Content_Column: the column sits left of the Ghost on wide screens.
  const columnLeft = (r.left + r.right) / 2 < (body.left + body.right) / 2;
  out.edgeGap = columnLeft ? body.left - r.right : r.left - body.right;
  const sealY = seal ? (seal.top + seal.bottom) / 2 : null;
  out.sealY = sealY;
  out.level = sealY !== null && sealY >= r.top && sealY <= r.bottom;
  if (hint) {
    const cs = getComputedStyle(hint);
    out.hintAlign = cs.textAlign;
    out.hintClipped = hint.scrollWidth > hint.clientWidth;
  } else {
    out.hintAlign = null;
    out.hintClipped = false;
  }
  return out;
};
// AL1 (C6.10): the Answer_List in marks, clear of the Ghost and the Seal_Group.
const AL1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const list = document.querySelector("[data-answer-list]");
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  if (!list) return { present: false };
  const r = list.getBoundingClientRect();
  const ghost = ghostRectOf(document.querySelector("[data-ghost]"));
  const group = document.querySelector("[data-seal-group]")?.getBoundingClientRect() ?? null;
  return {
    present: r.width > 0 && r.height > 0,
    onGhost: ghost ? meets(r, ghost) : false,
    onGroup: group ? meets(r, group) : false,
  };
};
// CF1 (C6.7, C7.3): no card much taller than what it holds, and none that holds only controls.
const CF1_READ = () => {
  const cards = [...document.querySelectorAll("[data-card], [data-stage-panel]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!cards.length) return { missing: true };
  const CONTROL = "button, a, input, select, textarea, label, summary";
  const out = [];
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const kids = [...card.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
    const union = kids.length ? Math.max(...kids.map((b) => b.bottom)) - Math.min(...kids.map((b) => b.top)) : 0;
    const content = [...card.querySelectorAll("*")].some((el) => {
      if (el.matches(CONTROL) || el.closest(CONTROL)) return false;
      if (!el.textContent.trim() && !el.matches("svg, img")) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });
    const name = card.getAttribute("data-card") || (card.hasAttribute("data-stage-panel") ? "stage-panel" : card.tagName.toLowerCase());
    out.push({ name, height: r.height, union, slack: r.height - union, content });
  }
  return { missing: false, cards: out };
};
// FP1 (C5.12): mark the control a judge presses next, or return null. A
// [data-primary-control] that is a button or link is pressed itself; a wrapper
// (the recall answer row holds the field and its button) has its enabled button
// pressed. A press-and-hold target with no button inside is skipped.
const FP1_TARGET = () => {
  for (const old of document.querySelectorAll("[data-fp1-target]")) old.removeAttribute("data-fp1-target");
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  };
  for (const c of document.querySelectorAll("[data-primary-control]")) {
    if (!visible(c)) continue;
    const el = c.matches("button, a[href]") ? c : [...c.querySelectorAll("button, a[href]")].find((b) => visible(b));
    if (!el) continue;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return { blocked: (el.textContent.trim() || el.tagName).slice(0, 30) };
    el.setAttribute("data-fp1-target", "");
    return { label: (el.textContent.trim() || el.tagName).slice(0, 30) };
  }
  return null;
};
// PH1 on / (P1.1): headline, Hero_Sentence, both calls to action and the Landing_Ghost
// in the first viewport. The Hero_Sentence is [data-hero-sentence], else the first
// paragraph in a [data-block] after the h1.
const PH1_LANDING = () => {
  const scene = document.querySelector('[data-ceremony="scene"]') ?? document.body;
  const h1 = document.querySelector("h1");
  const after = (el) => h1 && (h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const sentence = document.querySelector("[data-hero-sentence]")
    ?? [...scene.querySelectorAll("[data-block] p, p[data-block]")].find((p) => after(p) && !p.closest("[data-cta]"));
  const named = [
    ["headline", h1],
    ["Hero_Sentence", sentence],
    ["primary", document.querySelector('[data-cta="primary"]')],
    ["Landing_Ghost", scene.querySelector("[data-ghost-pit] [data-ghost-box]") ?? document.querySelector("[data-ghost-box]")],
  ];
  const secondary = document.querySelector('[data-cta="secondary"]');
  if (secondary) named.push(["secondary", secondary]);
  const missing = named.filter(([, el]) => !el).map(([n]) => n);
  const items = named.filter(([, el]) => el).map(([name, el]) => {
    const r = el.getBoundingClientRect();
    return { name, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
  });
  return { missing, items };
};

// PH1 on the persona page: scroll so the top of [data-stage-content] meets the
// bottom of a sticky or fixed Top_Bar. Returns false when the hook is missing.
const PH1_STAGE_SCROLL = () => {
  const sc = document.querySelector("[data-stage-content]");
  if (!sc) return false;
  const bar = document.querySelector("[data-topbar]");
  const pos = bar ? getComputedStyle(bar).position : "static";
  const off = bar && (pos === "sticky" || pos === "fixed") ? bar.getBoundingClientRect().height : 0;
  window.scrollTo({ top: Math.max(0, sc.getBoundingClientRect().top + window.scrollY - off), behavior: "instant" });
  return true;
};

// W1.6 and W1.7 (spec 12): the Write step's Letter_Field, Occasion chips and Next on
// /demo/live. Returns { missing: true } when the Write card or its field is absent.
// Lines in view are counted from the field's top, down to the window bottom.
const WRITE_READ = (cardSelector) => {
  const card = document.querySelector(cardSelector);
  const field = card?.querySelector("textarea");
  if (!card || !field) return { missing: true };
  const cs = getComputedStyle(field);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  let lh = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lh)) lh = (parseFloat(cs.fontSize) || 16) * 1.2;
  const r = field.getBoundingClientRect();
  const fieldLines = Math.round((r.height - padTop - padBottom - border) / lh);
  const linesInView = r.top >= 0 ? Math.min(fieldLines, Math.max(0, Math.floor((innerHeight - r.top - padTop) / lh + 0.01))) : 0;
  const inWindow = (b) => b.width > 0 && b.height > 0 && b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth;
  const chipButtons = [...(card.querySelector("fieldset")?.querySelectorAll("button") ?? [])];
  const chips = chipButtons.map((b) => b.getBoundingClientRect());
  const nextButton = [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next");
  const nextRect = nextButton ? nextButton.getBoundingClientRect() : null;
  return {
    missing: false,
    field: { top: r.top, bottom: r.bottom, topInView: r.top >= 0 && r.top < innerHeight, lines: fieldLines, linesInView, lineHeight: lh },
    chips: { count: chips.length, inView: chips.length > 0 && chips.every(inWindow), top: chips.length ? Math.min(...chips.map((c) => c.top)) : null, bottom: chips.length ? Math.max(...chips.map((c) => c.bottom)) : null },
    next: nextRect ? { top: nextRect.top, bottom: nextRect.bottom } : null,
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    card: { scrollWidth: card.scrollWidth, clientWidth: card.clientWidth },
  };
};

// PH1 on the persona page and /demo/live: every visible [data-primary-control] in view.
const PH1_CONTROLS = () => {
  const els = [...document.querySelectorAll("[data-primary-control]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: ["[data-primary-control]"], items: [] };
  return {
    missing: [],
    items: els.map((el) => {
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute("aria-label") || el.textContent.trim() || el.tagName).slice(0, 30);
      return { name, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
    }),
  };
};

// PH2 (P2.1): the largest vertical gap between consecutive [data-block] boxes in the viewport.
const PH2_READ = () => {
  const blocks = [...document.querySelectorAll("[data-block]")]
    .filter((el) => !el.closest("[data-soil]"))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight)
    .sort((a, b) => a.top - b.top);
  if (blocks.length < 2) return { missing: true, blocks: blocks.length };
  let maxBottom = blocks[0].bottom;
  let worst = 0;
  let at = null;
  for (const r of blocks.slice(1)) {
    const gap = r.top - maxBottom;
    if (gap > worst) {
      worst = gap;
      at = Math.round(maxBottom);
    }
    maxBottom = Math.max(maxBottom, r.bottom);
  }
  return { missing: false, blocks: blocks.length, worst, at };
};

// PH3 (P3.1, P3.2): the h1's lines and the words on each, from one range per word.
const PH3_READ = () => {
  const h1 = document.querySelector("h1");
  if (!h1) return { missing: true };
  const hr = h1.getBoundingClientRect();
  if (hr.width <= 1 || hr.height <= 1) return { missing: false, hidden: true };
  const lines = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const re = /[^\s\u00a0]+(?:\u00a0[^\s\u00a0]+)*/g;
    for (let m = re.exec(n.textContent); m; m = re.exec(n.textContent)) {
      const range = document.createRange();
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const r = [...range.getClientRects()].find((x) => x.width > 0);
      if (!r) continue;
      const line = lines.find((l) => Math.abs(l.top - r.top) < r.height / 2);
      if (line) line.words += 1;
      else lines.push({ top: r.top, words: 1 });
    }
  }
  lines.sort((a, b) => a.top - b.top);
  return { missing: false, hidden: false, lines: lines.length, words: lines.map((l) => l.words) };
};

// PH4 (P5.1): the Top_Bar height.
const PH4_READ = () => {
  const bar = document.querySelector("[data-topbar]");
  if (!bar) return { missing: true };
  return { missing: false, height: bar.getBoundingClientRect().height, compact: bar.hasAttribute("data-compact") };
};

// PH5 (P6.3): every descendant inside each Figure_Entry and the figures panel, and
// each one's own background painted.
const PH5_READ = () => {
  const roots = [...document.querySelectorAll("[data-figure-entry], [data-figures-panel]")];
  if (!roots.length) return { missing: true };
  const outside = [];
  const unpainted = [];
  let worst = 0;
  roots.forEach((root, i) => {
    const e = root.getBoundingClientRect();
    if (e.width === 0 || e.height === 0) return;
    const name = root.hasAttribute("data-figures-panel") ? "panel" : `entry ${i + 1}`;
    for (const el of root.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      const by = Math.max(e.left - r.left, r.right - e.right, e.top - r.top, r.bottom - e.bottom);
      worst = Math.max(worst, by);
      if (by > 0.5) outside.push(`${name} <${el.tagName.toLowerCase()}> by ${by.toFixed(1)}px`);
    }
    const cs = getComputedStyle(root);
    const m = cs.backgroundColor.match(/[\d.]+/g);
    const painted = (m && (m.length < 4 || Number(m[3]) > 0)) || cs.backgroundImage !== "none";
    if (!painted) unpainted.push(name);
  });
  return { missing: false, roots: roots.length, worst, outside: [...new Set(outside)], unpainted };
};

// PH6 (P7.1): letter Stage top to the close's first line, against the screens budget.
const PH6_READ = (screens) => {
  const close = document.querySelector("[data-close-line]");
  const stage = document.querySelector("[data-letter-stage]");
  const text = document.querySelector("[data-letter-text]");
  const missing = [["[data-close-line]", close], ["[data-letter-stage]", stage], ["[data-letter-text]", text]].filter(([, el]) => !el).map(([n]) => n);
  if (missing.length) return { missing };
  const length = close.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
  const letter = text.getBoundingClientRect().height;
  return { missing: [], length, letter, limit: screens * innerHeight + letter };
};

// PH7 (P8.4): every visible target at least min x min px. Inline text links are
// exempt; inside [data-topbar] the check applies only with data-compact. An input
// in a label is measured with its label's box.
const PH7_READ = (min) => {
  const small = [];
  let measured = 0;
  for (const el of document.querySelectorAll('a, button, summary, input:not([type="hidden"]), textarea, [role="button"]')) {
    let r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const bar = el.closest("[data-topbar]");
    if (bar && !bar.hasAttribute("data-compact")) continue;
    if (el.tagName === "A") {
      const parent = el.parentElement;
      if (parent && (parent.tagName === "P" || parent.tagName === "LI") && parent.textContent.trim() !== el.textContent.trim()) continue;
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (label) {
        const l = label.getBoundingClientRect();
        r = { width: Math.max(r.right, l.right) - Math.min(r.left, l.left), height: Math.max(r.bottom, l.bottom) - Math.min(r.top, l.top) };
      }
    }
    measured += 1;
    if (r.width < min || r.height < min) small.push(`"${(el.getAttribute("aria-label") || el.textContent.trim() || el.getAttribute("type") || el.tagName).slice(0, 24)}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  if (!measured) return { missing: true };
  return { missing: false, measured, small };
};

// FONT1 (L1.4, L1.5): the first family of --font-sans loaded and first on <body>; where
// the Letter_Text shows ([data-letter-text], else W1's fallback), the first family of
// --font-serif loaded and first on the Letter_Text. A face no text uses stays unloaded,
// so the serif is not checked on a page without the letter.
const FONT1_READ = async () => {
  await document.fonts.ready;
  const first = (v) => (v || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const root = getComputedStyle(document.documentElement);
  const sans = first(root.getPropertyValue("--font-sans"));
  const serif = first(root.getPropertyValue("--font-serif"));
  if (!sans) return { missing: true };
  const loaded = (fam) => [...document.fonts].some((f) => first(f.family) === fam && f.status === "loaded");
  let letter = document.querySelector("[data-letter-text]");
  if (!letter) {
    const sealed = document.querySelector('[class*="sealedLetter"]');
    if (sealed) letter = [...sealed.querySelectorAll("p")].sort((a, b) => b.textContent.length - a.textContent.length)[0] ?? null;
  }
  if (letter) {
    const r = letter.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) letter = null;
  }
  return {
    missing: false,
    sans,
    sansLoaded: loaded(sans),
    body: first(getComputedStyle(document.body).fontFamily),
    letter: letter
      ? { serif, serifLoaded: !!serif && loaded(serif), family: first(getComputedStyle(letter).fontFamily), selector: letter.hasAttribute("data-letter-text") ? "[data-letter-text]" : "sealed letter <p>" }
      : null,
  };
};

// FONT2 (L2.1): every visible h1 to h3 and button in the sans family.
const FONT2_READ = () => {
  const first = (v) => (v || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const sans = first(getComputedStyle(document.documentElement).getPropertyValue("--font-sans"));
  if (!sans) return { missing: true };
  const els = [...document.querySelectorAll("h1, h2, h3, button")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: true };
  const off = els.filter((el) => first(getComputedStyle(el).fontFamily) !== sans).map((el) => `<${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 24)}" in ${first(getComputedStyle(el).fontFamily)}`);
  return { missing: false, sans, measured: els.length, off };
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
  const opts = { url: null, sizes: DEFAULT_SIZES, shots: "layout-check-shots", chromium: null, require: [] };
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
    else if (arg === "--require") opts.require = take().split(",").map((s) => s.trim()).filter(Boolean);
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
  // `name` is a label (string or RegExp), or { loc, label } from figuresButton or landingStart.
  const located = typeof name === "object" && name !== null && "loc" in name;
  const button = located ? name.loc : page.getByRole(role, { name, exact: typeof name === "string" }).first();
  if ((await button.count()) === 0) return;
  const label = located ? `"${name.label}"` : typeof name === "string" ? `"${name}"` : `"${name.source}"`;
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
  // The reference Stage is intact when the walk reached it, else recall (spec 10 ad).
  if (stage === (ctx.g2Ref ?? "intact")) {
    ctx.intactCentre = centre;
    if (Math.abs(centre - expected) > 1) ctx.rep.add("polish", "G2", `Ghost centre x ${centre.toFixed(1)} px, expected ${expected.toFixed(1)} px`);
    else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px (expected ${expected.toFixed(1)})`);
    return;
  }
  if (ctx.intactCentre === null) return;
  const diff = Math.abs(centre - ctx.intactCentre);
  if (diff > 1) ctx.rep.add("polish", "G2", `Ghost moved sideways by ${diff.toFixed(1)} px from ${ctx.g2Ref ?? "intact"} (${centre.toFixed(1)} px)`);
  else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px, same as ${ctx.g2Ref ?? "intact"}`);
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

// ---------------------------------------------------------------------------
// Spec 09 checks. Each builds a result { id, name, status, detail } with status
// "pass", "fail" or "missing"; report() prints it. A failure is a BLOCKER only
// when the ID was passed with --require, else polish. "missing" is a note.
// ---------------------------------------------------------------------------

const px = (v) => `${Math.round(v)}px`;
const result = (id, name, status, detail) => ({ id, name, status, detail });

function report(ctx, r) {
  if (!r) return;
  const level = r.status === "pass" ? "ok" : r.status === "missing" ? "note" : ctx.required.has(r.id) ? "blocker" : "polish";
  ctx.rep.add(level, r.id, r.detail, r.name);
}

const parseSize = (size) => size.split("x").map(Number);

function routeKind(route) {
  const path = route.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return "landing";
  if (path === "/demo") return "index";
  if (path === LIVE_PATH) return "live";
  if (path.startsWith("/demo/personas/")) return "persona";
  return "other";
}

/**
 * The phone checks PH1 to PH7 (spec 09 design.md "Owner patches", q), for the
 * page as it is now. `size` is "WxH"; `route` is the page's path, for example
 * "/", "/demo/live" or "/demo/personas/us-maya". At 600 px and wider it returns
 * []. Returns one { id, name, status: "pass"|"fail"|"missing", detail } per check
 * that applies; detail holds the measured values and threshold=. The page's
 * scroll position is restored before it returns. Exported for the Journey_Check.
 */
export async function runPhoneChecks(page, size, route) {
  const [w, h] = parseSize(size);
  if (w >= PHONE_WIDTH_MAX) return [];
  const kind = routeKind(route);
  const stage = await stageOf(page);
  const beforeFirstStep = kind === "landing" || (kind === "persona" && ["emerging", "sealed", "intact"].includes(stage));
  const startY = await page.evaluate(() => window.scrollY);
  const toTop = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const out = [];
  try {
    // PH1 first-viewport.
    if (kind === "landing" || kind === "live" || kind === "persona") {
      let r;
      let where = "scrollY 0";
      if (kind === "landing") {
        await toTop();
        r = await page.evaluate(PH1_LANDING);
      } else if (kind === "live") {
        // W1.6: the Write step's field top and its first 6 lines are in view. Next is not asserted here (W1.7 reads its reach).
        await toTop();
        const w6 = await page.evaluate(WRITE_READ, WRITE_CARD);
        r = w6.missing
          ? { missing: [WRITE_CARD], items: [] }
          : {
              missing: [],
              items: [{ name: `Letter_Field ${w6.field.linesInView} of ${W16_LINES_PHONE} lines`, top: w6.field.top, bottom: w6.field.bottom, inView: w6.field.topInView && w6.field.linesInView >= W16_LINES_PHONE }],
            };
      } else {
        const scrolled = await page.evaluate(PH1_STAGE_SCROLL);
        await sleep(150);
        r = scrolled ? await page.evaluate(PH1_CONTROLS) : { missing: ["[data-stage-content]"], items: [] };
        where = `scrollY ${Math.round(await page.evaluate(() => window.scrollY))} (top of [data-stage-content])`;
      }
      const parts = r.items.map((i) => `${i.name}=${px(i.top)}..${px(i.bottom)}${i.inView ? "" : "(out)"}`);
      const threshold = kind === "live" ? `threshold=field top and ${W16_LINES_PHONE} lines inside viewport (W1.6), Next not asserted` : "threshold=inside viewport";
      const detail = `${parts.join(" ")}${r.missing.length ? ` missing=${r.missing.join(",")}` : ""} viewport=${w}x${h} at ${where} ${threshold}`;
      out.push(result("PH1", "first-viewport", r.missing.length ? "missing" : r.items.every((i) => i.inView) ? "pass" : "fail", detail));
    }
    await toTop();
    // PH2 dead-space.
    if (beforeFirstStep) {
      const r = await page.evaluate(PH2_READ);
      out.push(r.missing
        ? result("PH2", "dead-space", "missing", `not on this build: ${r.blocks} [data-block] box(es) in view, need 2`)
        : result("PH2", "dead-space", r.worst <= PH_GAP_MAX_PX ? "pass" : "fail", `blocks=${r.blocks} worstGap=${px(r.worst)}${r.at === null ? "" : ` below y=${r.at}px`} threshold=<=${PH_GAP_MAX_PX}px`));
    }
    // PH3 headline-lines.
    {
      const max = kind === "landing" ? PH_HEADLINE_LINES_LANDING : PH_HEADLINE_LINES_OTHER;
      const r = await page.evaluate(PH3_READ);
      if (r.missing) out.push(result("PH3", "headline-lines", "missing", "no h1 on this page"));
      else if (r.hidden) out.push(result("PH3", "headline-lines", "missing", "the h1 is visually hidden at this Stage"));
      else {
        const lone = r.words.slice(0, -1).some((n) => n === 1);
        out.push(result("PH3", "headline-lines", r.lines <= max && !lone ? "pass" : "fail", `lines=${r.lines} wordsPerLine=${r.words.join(",")} threshold=lines<=${max}, no lone word before the last line`));
      }
    }
    // PH4 topbar-height.
    {
      const r = await page.evaluate(PH4_READ);
      out.push(r.missing
        ? result("PH4", "topbar-height", "missing", "no [data-topbar] on this page")
        : result("PH4", "topbar-height", r.height <= PH_TOPBAR_MAX_PX ? "pass" : "fail", `height=${r.height.toFixed(1)}px compact=${r.compact} threshold=<=${PH_TOPBAR_MAX_PX}px`));
    }
    // PH5 card-containment, where the figures show.
    if (kind === "persona" && (stage === "figures" || stage === "close")) {
      const r = await page.evaluate(PH5_READ);
      out.push(r.missing
        ? result("PH5", "card-containment", "missing", "not on this build: no [data-figure-entry] or [data-figures-panel]")
        : result("PH5", "card-containment", r.outside.length || r.unpainted.length ? "fail" : "pass", `roots=${r.roots} worst=${r.worst.toFixed(1)}px outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 3).join("; ")})` : ""} unpainted=${r.unpainted.length ? r.unpainted.join(",") : "none"} threshold=0px, background painted`));
    }
    // PH6 page-height, at 390x844 in close.
    if (kind === "persona" && stage === "close" && size === PH6_SIZE) {
      const r = await page.evaluate(PH6_READ, PH6_SCREENS);
      out.push(r.missing.length
        ? result("PH6", "page-height", "missing", `not on this build: ${r.missing.join(", ")}`)
        : result("PH6", "page-height", r.length <= r.limit ? "pass" : "fail", `length=${px(r.length)} letterText=${px(r.letter)} threshold=<=${px(r.limit)} (${PH6_SCREENS}x${h} + letterText)`));
    }
    // PH7 touch-targets.
    {
      const r = await page.evaluate(PH7_READ, PH_TARGET_MIN_PX);
      out.push(r.missing
        ? result("PH7", "touch-targets", "missing", "no target measured on this page")
        : result("PH7", "touch-targets", r.small.length ? "fail" : "pass", `targets=${r.measured} small=${r.small.length}${r.small.length ? ` (${r.small.slice(0, 5).join("; ")})` : ""} threshold=>=${PH_TARGET_MIN_PX}x${PH_TARGET_MIN_PX}px`));
    }
  } finally {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  }
  return out;
}

/**
 * FONT1 fonts-loaded for the page as it is now (spec 09 design.md "Owner
 * patches", q). Returns one { id, name, status: "pass"|"fail"|"missing", detail }.
 * Exported for the Journey_Check.
 */
export async function runFontCheck(page) {
  const r = await page.evaluate(FONT1_READ);
  if (r.missing) return result("FONT1", "fonts-loaded", "missing", "no --font-sans on <html>");
  const problems = [];
  if (!r.sansLoaded) problems.push(`${r.sans} not loaded`);
  if (r.body !== r.sans) problems.push(`body starts with ${r.body}`);
  let letter = "letter=none (serif not checked)";
  if (r.letter) {
    letter = `serif=${r.letter.serif} serifLoaded=${r.letter.serifLoaded} letter=${r.letter.family} (${r.letter.selector})`;
    if (!r.letter.serifLoaded) problems.push(`${r.letter.serif || "--font-serif"} not loaded`);
    if (r.letter.family !== r.letter.serif) problems.push(`Letter_Text starts with ${r.letter.family}`);
  }
  const detail = `sans=${r.sans} sansLoaded=${r.sansLoaded} body=${r.body} ${letter} threshold=loaded and first${problems.length ? ` (${problems.join("; ")})` : ""}`;
  return result("FONT1", "fonts-loaded", problems.length ? "fail" : "pass", detail);
}

async function checkFonts(page, ctx, route) {
  report(ctx, await runFontCheck(page));
  const r = await page.evaluate(FONT2_READ);
  report(ctx, r.missing
    ? result("FONT2", "fonts-sans-ui", "missing", `no heading or button on ${route}`)
    : result("FONT2", "fonts-sans-ui", r.off.length ? "fail" : "pass", `sans=${r.sans} measured=${r.measured} off=${r.off.length}${r.off.length ? ` (${r.off.slice(0, 3).join("; ")})` : ""} threshold=0`));
}

async function checkPhone(page, ctx, route) {
  for (const r of await runPhoneChecks(page, ctx.size, route)) report(ctx, r);
}

async function checkButtonOverflow(page, ctx) {
  const r = await page.evaluate(BO1_READ);
  report(ctx, r.missing
    ? result("BO1", "button-overflow", "missing", "no button on this page")
    : result("BO1", "button-overflow", r.over.length ? "fail" : "pass", `buttons=${r.count} worst=${r.worst}px over=${r.over.length}${r.over.length ? ` (${r.over.slice(0, 3).join("; ")})` : ""} threshold=scrollWidth<=clientWidth`));
}

async function checkControlInCard(page, ctx) {
  const r = await page.evaluate(BC1_READ);
  report(ctx, r.missing
    ? result("BC1", "control-in-card", "missing", "not on this build: no [data-card], fieldset or [data-stage-panel]")
    : result("BC1", "control-in-card", r.outside.length ? "fail" : "pass", `containers=${r.containers} controls=${r.measured} worst=${r.worst.toFixed(1)}px outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 3).join("; ")})` : ""} threshold=0.5px`));
}

async function checkScaleOverlap(page, ctx) {
  const r = await page.evaluate(RS1_READ);
  report(ctx, r.missing
    ? result("RS1", "scale-overlap", "missing", "not on this build: no [data-recorded-scale]")
    : result("RS1", "scale-overlap", r.hits.length ? "fail" : "pass", `scales=${r.scales} worst=${r.worst.toFixed(1)}px²${r.hits.length ? ` (${r.hits.slice(0, 3).join("; ")})` : ""} threshold=0px²`));
}

// GZ1: ctx.ghostHook is set once a [data-ghost] has been seen in this walk, so a
// build without the hook gets a note after the seal, not a pass.
async function checkGhostGone(page, ctx, duringSeal) {
  const r = await page.evaluate(GZ1_READ, duringSeal);
  if (r.count) ctx.ghostHook = true;
  if (duringSeal) {
    report(ctx, r.missing
      ? result("GZ1", "ghost-after-seal", "missing", "not on this build: no [data-ghost] during the seal")
      : result("GZ1", "ghost-after-seal", r.ok ? "pass" : "fail", `bodyCentre=${px(r.x)},${px(r.y)} hit=${r.hit} threshold=the Ghost or nothing`));
    return;
  }
  if (!ctx.ghostHook) {
    report(ctx, result("GZ1", "ghost-after-seal", "missing", "not on this build: no [data-ghost] seen before the seal"));
    return;
  }
  report(ctx, result("GZ1", "ghost-after-seal", r.count ? "fail" : "pass", `ghostElements=${r.count} threshold=0`));
}

async function checkHeadingRing(page, ctx, via) {
  const r = await page.evaluate(FV1_READ);
  if (r.missing) {
    report(ctx, result("FV1", "heading-focus-ring", "missing", "not on this build: no [data-figures-heading]"));
    return;
  }
  const want = via === "mouse" ? "none" : "not none";
  const ok = via === "mouse" ? r.outlineStyle === "none" : r.outlineStyle !== "none";
  report(ctx, result("FV1", "heading-focus-ring", ok ? "pass" : "fail", `via=${via} outlineStyle=${r.outlineStyle} outlineWidth=${r.outlineWidth} focused=${r.focused} focusVisible=${r.focusVisible} threshold=${want}`));
}

async function checkLandingCtas(page, ctx) {
  const r = await page.evaluate(CTA1_READ);
  if (r.missing) {
    report(ctx, result("CTA1", "landing-ctas", "missing", 'not on this build: no [data-cta="primary"]'));
    return;
  }
  const problems = [];
  if (!r.primary.inView) problems.push("primary out of view");
  if (r.secondary && !r.secondary.inView) problems.push("secondary out of view");
  if (r.href !== "/demo") problems.push(`primary href=${r.href}`);
  const sec = r.secondary ? `${px(r.secondary.top)}..${px(r.secondary.bottom)}` : "absent";
  report(ctx, result("CTA1", "landing-ctas", problems.length ? "fail" : "pass", `primary=${px(r.primary.top)}..${px(r.primary.bottom)} href=${r.href} secondary=${sec} viewport=${ctx.w}x${ctx.h} threshold=in view at the top, href=/demo`));
}

async function checkDemoCards(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(DX1_READ);
  if (r.missing) {
    report(ctx, result("DX1", "demo-cards-in-view", "missing", "no persona link on /demo"));
    return;
  }
  const parts = r.links.map((l) => `${l.href}=bottom ${px(l.bottom)}${l.inView ? "" : "(out)"}`);
  report(ctx, result("DX1", "demo-cards-in-view", r.links.every((l) => l.inView) ? "pass" : "fail", `${parts.join(" ")} viewport=${ctx.w}x${ctx.h} threshold=inside viewport at scrollY 0`));
}

// HW1: at the Wide_Size, compare with the 1366x800 headline. The run stores the
// 1366x800 size when it walks that size; otherwise it opens / there once.
async function checkHeroWide(page, ctx) {
  if (ctx.size === HW1_BASE_SIZE) ctx.memo.h1At1366 = await page.evaluate(HW1_READ);
  if (ctx.size !== WIDE_SIZE) return;
  const wide = await page.evaluate(HW1_READ);
  if (ctx.memo.h1At1366 === undefined) {
    const [bw, bh] = parseSize(HW1_BASE_SIZE);
    const other = await page.context().browser().newContext({ viewport: { width: bw, height: bh } });
    try {
      const p = await other.newPage();
      await p.goto(`${ctx.base}/`, { waitUntil: "load" });
      ctx.memo.h1At1366 = await p.evaluate(HW1_READ);
    } finally {
      await other.close();
    }
  }
  const base = ctx.memo.h1At1366;
  if (wide === null || base === null) {
    report(ctx, result("HW1", "hero-wide", "missing", "no h1 on /"));
    return;
  }
  const ratio = wide / base;
  report(ctx, result("HW1", "hero-wide", ratio >= HW1_RATIO_MIN ? "pass" : "fail", `h1=${wide}px at ${WIDE_SIZE}, ${base}px at ${HW1_BASE_SIZE} ratio=${ratio.toFixed(2)} threshold=>=${HW1_RATIO_MIN}`));
}

async function checkStepIndicator(page, ctx, stage) {
  const r = await page.evaluate(ST1_READ);
  if (r.missing) {
    report(ctx, result("ST1", "step-indicator", "missing", "not on this build: no [data-step-indicator]"));
    return;
  }
  const maxLines = isPhone(ctx) ? ST_LINES_PHONE_MAX : 1;
  const wantCurrent = stage === "intact" ? null : 1;
  const ok = r.lines <= maxLines && (wantCurrent === null || r.current === wantCurrent);
  report(ctx, result("ST1", "step-indicator", ok ? "pass" : "fail", `steps=${r.steps} current=${r.current} lines=${r.lines} threshold=present${wantCurrent === null ? "" : ", current=1"}, lines<=${maxLines}`));
}

async function checkReceiptsInView(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(RC1_READ);
  report(ctx, r.missing
    ? result("RC1", "receipts-in-view", "missing", "not on this build: no [data-figure-entry]")
    : result("RC1", "receipts-in-view", r.inView ? "pass" : "fail", `firstEntry=${px(r.top)}..${px(r.bottom)} viewport=${ctx.w}x${ctx.h} scrollY=${Math.round(await page.evaluate(() => window.scrollY))} threshold=fully inside viewport`));
}

// ---------------------------------------------------------------------------
// Spec 10 checks (spec 10 design.md "Owner patches", ad). Each prints measured
// values and threshold=, and is a BLOCKER only with --require; a check whose
// element is not on this build prints a note.
// ---------------------------------------------------------------------------
async function checkTickOnAxis(page, ctx) {
  const r = await page.evaluate(TK1_READ);
  if (r.missing) {
    report(ctx, result("TK1", "tick-on-axis", "missing", "not on this build: no [data-line-axis] with [data-line-tick]"));
    return;
  }
  const off = r.ticks.filter((t) => Math.abs(t.dTop) > TK1_AXIS_TOL_PX);
  const far = r.ticks.filter((t) => t.gap === null || t.gap > TK1_LABEL_GAP_MAX_PX);
  const worstTop = Math.max(...r.ticks.map((t) => Math.abs(t.dTop)));
  const worstGap = Math.max(...r.ticks.map((t) => (t.gap === null ? Infinity : t.gap)));
  const list = (ts) => ts.slice(0, 4).map((t) => `${t.kind} dTop=${t.dTop.toFixed(1)} gap=${t.gap === null ? "no label" : t.gap.toFixed(1)}`).join("; ");
  const bad = off.length || far.length || r.overlaps.length;
  report(ctx, result("TK1", "tick-on-axis", bad ? "fail" : "pass", `axes=${r.axes} ticks=${r.ticks.length} worstTopOffset=${worstTop.toFixed(1)}px worstLabelGap=${Number.isFinite(worstGap) ? worstGap.toFixed(1) : "no label"}px labelOverlaps=${r.overlaps.length}${bad ? ` (${[list([...off, ...far]), ...r.overlaps.slice(0, 2)].filter(Boolean).join("; ")})` : ""} threshold=top offset 0±${TK1_AXIS_TOL_PX}px, label gap<=${TK1_LABEL_GAP_MAX_PX}px, no label overlap`));
}
// SI1 reads the indicator with the page at the top, where it is drawn, then restores the scroll.
async function checkStepFit(page, ctx) {
  const startY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(150);
  const r = await page.evaluate(SI1_READ);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  if (r.missing) {
    report(ctx, result("SI1", "step-indicator-fit", "missing", "not on this build: no [data-step-indicator]"));
    return;
  }
  const maxLines = isPhone(ctx) ? SI1_LINES_PHONE_MAX : 1;
  const problems = [...r.problems];
  if (r.items !== SI1_ITEMS) problems.push(`${r.items} items`);
  if (r.lines > maxLines) problems.push(`${r.lines} lines`);
  report(ctx, result("SI1", "step-indicator-fit", problems.length ? "fail" : "pass", `items=${r.items} lines=${r.lines}${problems.length ? ` (${problems.slice(0, 4).join("; ")})` : ""} threshold=${SI1_ITEMS} items, scrollWidth<=clientWidth, inside the viewport, clear of [data-ghost], lines<=${maxLines}`));
}
// GT1 at the Stage start, then again with the page scrolled to the bottom.
async function checkGhostText(page, ctx) {
  // Below 600 px the Ghost fix is spec 10 task 5's (X2.1), which also removes the
  // pick-up press that scrolls the page. Until then GT1 prints a note on the phone.
  // Patch ai removes this tolerance.
  if (isPhone(ctx) && ctx.pickedUp) {
    report(ctx, result("GT1", "ghost-over-text", "missing", `this build needs a "${PICK_UP}" press before recall; below ${PHONE_WIDTH_MAX} px GT1 reads only a build that opens on recall`));
    return;
  }
  const startY = await page.evaluate(() => window.scrollY);
  const first = await page.evaluate(GT1_READ);
  if (first.missing) {
    report(ctx, result("GT1", "ghost-over-text", "missing", "no [data-ghost] box at this Stage"));
    return;
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await sleep(250);
  const bottom = await page.evaluate(GT1_READ);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  const hits = [...new Set([...first.hits, ...(bottom.missing ? [] : bottom.hits.map((h) => `${h} (scrolled)`))])];
  report(ctx, result("GT1", "ghost-over-text", hits.length ? "fail" : "pass", `measured=${first.measured} ghostBody=${px(first.ghost.left)}..${px(first.ghost.right)}x${px(first.ghost.top)}..${px(first.ghost.bottom)} hits=${hits.length}${hits.length ? ` (${hits.slice(0, 4).join("; ")})` : ""} threshold=0 outside [data-ghost] on the Ghost_Body_Box (at the Stage start and scrolled to the bottom)`));
}
// FC1 reads the persona page once recall starts on load, with no pick-up press.
async function checkLoadFocus(page, ctx, loadY) {
  if (ctx.pickedUp) {
    report(ctx, result("FC1", "load-focus", "missing", `this build needs a "${PICK_UP}" press before recall; FC1 reads only a recall reached on load`));
    return;
  }
  const r = await page.evaluate(FC1_READ);
  if (!r.hasHeading) {
    report(ctx, result("FC1", "load-focus", "missing", "not on this build: no [data-stage-heading]"));
    return;
  }
  const drift = Math.abs(r.scrollY - loadY);
  const ok = r.onHeading && drift < 1;
  report(ctx, result("FC1", "load-focus", ok ? "pass" : "fail", `active=${r.active} onHeading=${r.onHeading} scrollY=${Math.round(r.scrollY)} atLoad=${Math.round(loadY)} threshold=focus on [data-stage-heading], scrollY unchanged`));
}
async function checkSealOnEnvelope(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(ET1_READ);
  if (r.missing) {
    report(ctx, result("ET1", "seal-on-envelope", "missing", "not on this build: no [data-envelope-seal] in a [data-envelope-state] box"));
    return;
  }
  const problems = [];
  if (!r.inside) problems.push("seal outside the Envelope box");
  if (r.onDates.length) problems.push(`seal on ${r.onDates.map((d) => `"${d}"`).join(", ")}`);
  if (r.pairs.length) problems.push(`overlap ${r.pairs.slice(0, 3).join("; ")}`);
  report(ctx, result("ET1", "seal-on-envelope", problems.length ? "fail" : "pass", `state=${r.state} seal=${px(r.seal.left)}..${px(r.seal.right)}x${px(r.seal.top)}..${px(r.seal.bottom)} envelope=${px(r.envelope.left)}..${px(r.envelope.right)}x${px(r.envelope.top)}..${px(r.envelope.bottom)} dateLines=${r.dates}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=seal inside the Envelope, on no [data-date], no two drawn elements overlap`));
}
async function checkSealGroup(page, ctx) {
  const phone = isPhone(ctx);
  if (!phone && !DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(SG1_READ, phone);
  if (r.missing) {
    report(ctx, result("SG1", "seal-group", "missing", "not on this build: no [data-seal-group] (or no [data-ghost-box] to measure against)"));
    return;
  }
  const g = `group=${px(r.group.left)}..${px(r.group.right)}x${px(r.group.top)}..${px(r.group.bottom)} inView=${r.inView}`;
  const problems = [];
  if (!r.inView) problems.push("outside the viewport");
  if (phone) {
    if (r.belowGhost === null) problems.push("no [data-ghost] box");
    else if (r.belowGhost < 0 || r.belowGhost > SG1_GAP_MAX_PX) problems.push(`top ${r.belowGhost.toFixed(1)}px below the Ghost`);
    if (r.onGhost) problems.push("on [data-ghost]");
    report(ctx, result("SG1", "seal-group", problems.length ? "fail" : "pass", `${g} belowGhost=${r.belowGhost === null ? "n/a" : `${r.belowGhost.toFixed(1)}px`}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=top 0 to ${SG1_GAP_MAX_PX}px below [data-ghost], not on it, inside the First_Viewport`));
    return;
  }
  if (r.onBody) problems.push("on the Ghost_Body_Box");
  if (r.onEnvelope) problems.push("on the Envelope");
  if (r.edgeGap < 0 || r.edgeGap > SG1_GAP_MAX_PX) problems.push(`edge gap ${r.edgeGap.toFixed(1)}px`);
  if (!r.level) problems.push("not level with the seal");
  if (r.hintAlign !== null && r.hintAlign !== "left" && r.hintAlign !== "center" && r.hintAlign !== "start") problems.push(`hint text-align ${r.hintAlign}`);
  if (r.hintClipped) problems.push("hint clipped");
  report(ctx, result("SG1", "seal-group", problems.length ? "fail" : "pass", `${g} edgeGap=${r.edgeGap.toFixed(1)}px sealY=${r.sealY === null ? "n/a" : px(r.sealY)} hintAlign=${r.hintAlign ?? "no hint"}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=clear of the Ghost_Body_Box and the Envelope, edge gap 0 to ${SG1_GAP_MAX_PX}px, seal centre within the group, hint left or centre and unclipped, inside the viewport`));
}
async function checkAnswerList(page, ctx) {
  const r = await page.evaluate(AL1_READ);
  const problems = [];
  if (!r.present) problems.push("no [data-answer-list] in marks");
  if (r.onGhost) problems.push("on [data-ghost]");
  if (r.onGroup) problems.push("on [data-seal-group]");
  report(ctx, result("AL1", "answer-list", problems.length ? "fail" : "pass", `present=${r.present} onGhost=${!!r.onGhost} onSealGroup=${!!r.onGroup}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=present, clear of [data-ghost] and [data-seal-group]`));
}
async function checkCardFit(page, ctx) {
  const r = await page.evaluate(CF1_READ);
  if (r.missing) {
    report(ctx, result("CF1", "card-fit", "missing", "no [data-card] or [data-stage-panel] at this Stage"));
    return;
  }
  const bad = r.cards.filter((c) => c.slack > CF1_SLACK_MAX_PX || !c.content);
  const worst = Math.max(...r.cards.map((c) => c.slack));
  report(ctx, result("CF1", "card-fit", bad.length ? "fail" : "pass", `cards=${r.cards.length} worstSlack=${worst.toFixed(1)}px${bad.length ? ` (${bad.slice(0, 3).map((c) => `${c.name} height=${px(c.height)} content=${px(c.union)}${c.content ? "" : " controls only"}`).join("; ")})` : ""} threshold=height minus content<=${CF1_SLACK_MAX_PX}px, holds a non-control`));
}
// FP1: a fresh persona page, pressing only [data-primary-control] from load to the
// Figures_Heading. Each press stores a Recall_Record in the local database, as the
// main walk does.
async function checkFastestPath(context, ctx, p) {
  ctx.rep.stage(`${p.prefix}fastest path`);
  const page = await newPage(context);
  try {
    await page.goto(`${ctx.base}${p.path}`, { waitUntil: "load" });
    const first = await reachRecall(page);
    if (first !== "recall") {
      report(ctx, result("FP1", "fastest-path", "missing", first === "pickup" ? `this build needs a "${PICK_UP}" press before recall; FP1 reads only a recall reached on load` : "recall not reached"));
      return;
    }
    const counter = await page.evaluate(() => document.querySelector('[data-fit="counter"]')?.textContent ?? "");
    const total = Number((/of\s+(\d+)/i.exec(counter) ?? [])[1]) || null;
    const limit = total === null ? null : 2 + total;
    const pressed = [];
    let reached = false;
    let stuck = null;
    for (let i = 0; i < FP1_MAX_PRESSES; i += 1) {
      let target = null;
      for (let t = 0; t < FP1_WAIT_STEPS; t += 1) {
        if ((await page.locator("[data-figures-heading]").count()) > 0) {
          reached = true;
          break;
        }
        target = await page.evaluate(FP1_TARGET);
        if (target?.label) break;
        await sleep(400);
      }
      if (reached) break;
      if (!target?.label) {
        stuck = { stage: await stageOf(page), blocked: target?.blocked ?? null };
        break;
      }
      await page.locator("[data-fp1-target]").first().click({ timeout: WAIT_MS });
      pressed.push(target.label);
      await sleep(600);
    }
    if (!reached && (await page.locator("[data-figures-heading]").count()) > 0) reached = true;
    const path = pressed.map((l) => `"${l}"`).join(" > ") || "none";
    if (!reached && stuck?.blocked && stuck.stage === "recall") {
      report(ctx, result("FP1", "fastest-path", "missing", `"${stuck.blocked}" is disabled with the field as it loads (no Sample_Answer on this build); presses=${pressed.length} path=${path}`));
      return;
    }
    const ok = reached && limit !== null && pressed.length <= limit;
    report(ctx, result("FP1", "fastest-path", ok ? "pass" : "fail", `questions=${total ?? "unknown"} presses=${pressed.length} reachedFiguresHeading=${reached}${stuck ? ` stoppedAt=${stuck.stage}${stuck.blocked ? ` ("${stuck.blocked}" disabled)` : ""}` : ""} path=${path} threshold=<=${limit ?? "2+questions"} presses to [data-figures-heading]`));
  } finally {
    await page.close();
  }
}
// The first of the recall Stage or a "Pick up the letter" button, after load.
// Builds before spec 10 task 5 show the button; later builds open on recall.
async function reachRecall(page, timeout = FIRST_STAGE_WAIT_MS) {
  const pickUp = page.getByRole("button", { name: PICK_UP, exact: true });
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if ((await stageOf(page)) === "recall") return "recall";
    if ((await pickUp.count()) > 0 && (await pickUp.first().isVisible())) return "pickup";
    await sleep(200);
  }
  return null;
}
// Answers every recall question. A field that holds a value (a Sample_Answer) is
// kept; an empty one gets the walk's answer. The primary control is pressed with
// the mouse, never Enter, since Enter adds a line break in a text field.
// onQuestion(i, kind) runs before each press. Returns null or a blocker message.
async function answerAll(page, answers, onQuestion = async () => {}) {
  const field = page.locator('input[type="text"]:visible, textarea:visible').first();
  const counterText = () => page.evaluate(() => document.querySelector('[data-fit="counter"]')?.textContent?.trim() ?? "");
  for (let i = 0; i < 20; i += 1) {
    if ((await field.count()) > 0) {
      const value = await field.inputValue();
      if (!value.trim()) await field.fill(answers[i] ?? answers[answers.length - 1] ?? TEXT_ANSWER);
    }
    const next = page.getByRole("button", { name: NEXT, exact: true });
    const record = page.getByRole("button", { name: RECORD, exact: true });
    if ((await next.count()) > 0 && (await next.first().isVisible())) {
      await onQuestion(i, NEXT);
      const before = await counterText();
      await next.first().click();
      try {
        await page.waitForFunction((b) => (document.querySelector('[data-fit="counter"]')?.textContent?.trim() ?? "") !== b, before, { timeout: WAIT_MS });
      } catch {
        return `answering question ${i + 1} does not reach question ${i + 2} (counter: "${before}")`;
      }
      continue;
    }
    if ((await record.count()) > 0 && (await record.first().isVisible())) {
      await onQuestion(i, RECORD);
      await record.first().click();
      return null;
    }
    return `no "${NEXT}" or "${RECORD}" button on question ${i + 1}`;
  }
  return "more than 20 questions";
}
// The spec 09 checks every page and Stage gets.
async function checkEveryPage(page, ctx, route, { fonts = false } = {}) {
  await guard(ctx, "BO1", () => checkButtonOverflow(page, ctx));
  await guard(ctx, "BC1", () => checkControlInCard(page, ctx));
  if (fonts) await guard(ctx, "FONT1", () => checkFonts(page, ctx, route));
  await guard(ctx, "PH", () => checkPhone(page, ctx, route));
}

// The figures button: [data-advance="figures"], else either label (task 14 renames it).
async function figuresButton(page) {
  const hooked = page.locator(FIGURES_HOOK);
  if ((await hooked.count()) > 0) return { loc: hooked.first(), label: FIGURES_HOOK };
  const named = page.getByRole("button", { name: FIGURES_LABEL });
  if ((await named.count()) > 0) return { loc: named.first(), label: (await named.first().textContent())?.trim() || SEE_NUMBERS };
  return null;
}

// The landing's start: [data-cta="primary"], else the old "Open Maya" link.
async function landingStart(page) {
  const hooked = page.locator(LANDING_HOOK);
  if ((await hooked.count()) > 0) return { loc: hooked.first(), label: LANDING_HOOK };
  const named = page.getByRole("link", { name: LANDING_START });
  if ((await named.count()) > 0) return { loc: named.first(), label: LANDING_START.source };
  return null;
}

// Tab until the control has focus, so the press that follows is a keyboard press.
async function tabTo(page, loc) {
  for (let i = 0; i < 120; i++) {
    if (await loc.evaluate((el) => document.activeElement === el)) return true;
    await page.keyboard.press("Tab");
  }
  return false;
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
    const start = await landingStart(page);
    hasStart = start !== null;
    if (stage !== "scene") {
      ctx.rep.add("note", "scene", `the landing is not a scene on this build (data-ceremony is ${stage ?? "missing"}); skipped`);
    } else {
      await shot(page, ctx, "scene");
      await guard(ctx, "F2", () => checkSoil(page, ctx));
      if (start) await guard(ctx, "BTN", () => checkMainButton(page, ctx, start, true, "link"));
      await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
      await guard(ctx, "LG1", () => checkLandingGhost(page, ctx));
      await guard(ctx, "BAND1", () => checkLightBand(page, ctx));
      await guard(ctx, "FT1", () => checkFooter(page, ctx));
      await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
      await guard(ctx, "CTA1", () => checkLandingCtas(page, ctx));
      await guard(ctx, "HW1", () => checkHeroWide(page, ctx));
      await checkEveryPage(page, ctx, "/", { fonts: true });
    }
  } finally {
    await page.close();
  }

  if (!hasStart) {
    ctx.rep.stage("emerging, sealed, error");
    ctx.rep.add("note", "walk", `the landing has no ${LANDING_HOOK} and no "Open Maya's letter" link on this build; these stages are skipped`);
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
    const start = await landingStart(page);
    if (!start) throw new Error("no landing start control");
    await start.loc.click({ timeout: WAIT_MS });
    // From task 9 the primary call to action opens /demo; the walk then opens Maya's letter from there.
    await sleep(300);
    if (new URL(page.url()).pathname.replace(/\/+$/, "") === "/demo") {
      await page.locator(`a[href="${PERSONA_PATH}"]`).first().click({ timeout: WAIT_MS });
    }
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
    for (const persona of PERSONAS) {
      const link = await page.locator(`a[href="${persona.path}"]`).count();
      if (link === 0) ctx.rep.add("blocker", "walk", `/demo has no link to ${persona.path}, so the judge cannot reach the letter`);
      else ctx.rep.add("ok", "walk", `/demo links to ${persona.path}`);
    }
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "DX1", () => checkDemoCards(page, ctx));
    await checkEveryPage(page, ctx, "/demo", { fonts: true });
  } finally {
    await page.close();
  }
}

// The persona walk: intact, recall (two questions), marks, seal (when built), letter, figures, close.
// Maya's walk presses the figures button with the mouse and Tomás's with Tab and
// Enter, so FV1 reads both cases at every size.
async function persona(context, ctx, p, via) {
  const page = await newPage(context);
  ctx.ghostHook = false;
  ctx.intactCentre = null;
  ctx.pickedUp = false;
  ctx.g2Ref = "intact";
  try {
    await personaWalk(page, ctx, p, via);
  } catch (error) {
    // Once the persona page is open, an error that stops the walk means the judge cannot finish the flow.
    const where = ctx.stage ? ` at the ${ctx.stage} stage` : "";
    ctx.rep.add("blocker", "walk", `the flow stopped${where}: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

async function personaWalk(page, ctx, p, via) {
  const S = (stage) => `${p.prefix}${stage}`;
  const route = p.path;
  ctx.rep.stage(S("intact"));
  const res = await page.goto(`${ctx.base}${p.path}`, { waitUntil: "load" });
  if (!res || res.status() !== 200) {
    ctx.rep.add("blocker", "walk", `${p.path} answered HTTP ${res?.status() ?? "none"}; the flow cannot be finished`);
    return;
  }
  const loadY = await page.evaluate(() => window.scrollY);
  // Spec 10 ad: builds before task 5 show "Pick up the letter"; later builds open on recall.
  const first = await reachRecall(page);
  if (first === null) {
    ctx.rep.add("blocker", "walk", `no "${PICK_UP}" button and no recall stage on ${p.path} within ${FIRST_STAGE_WAIT_MS / 1000} s; the flow cannot be finished`);
    return;
  }
  ctx.pickedUp = first === "pickup";
  ctx.g2Ref = ctx.pickedUp ? "intact" : "recall";
  if (ctx.pickedUp) {
    const pickUp = page.getByRole("button", { name: PICK_UP, exact: true });
    await sleep(2600); // the Ghost's rise (900 ms delay + 1500 ms) settles before the box checks
    await shot(page, ctx, S("intact"));
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
    await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "intact"));
    await guard(ctx, "GT1", () => checkGhostText(page, ctx));
    await guard(ctx, "CF1", () => checkCardFit(page, ctx));
    await guard(ctx, "GZ1", async () => {
      if (await page.evaluate(() => !!document.querySelector("[data-ghost]"))) ctx.ghostHook = true;
    });
    await checkEveryPage(page, ctx, route, { fonts: true });
    // Pick up the letter: the recall stage.
    await pickUp.click();
    if (!(await waitForStage(page, "recall"))) {
      ctx.rep.add("blocker", "walk", `"${PICK_UP}" does not reach the recall stage (data-ceremony is ${await stageOf(page)})`);
      return;
    }
  }
  ctx.rep.stage(S("recall"));
  if (!ctx.pickedUp) {
    ctx.rep.add("ok", "walk", "recall reached on load, with no pick-up press");
    await sleep(500);
  }
  await guard(ctx, "FC1", () => checkLoadFocus(page, ctx, loadY));
  // The handed layout starts moving a frame after the stage changes, so wait before settling.
  await sleep(ctx.pickedUp ? 1500 : 2600);
  await settle(page);
  // R1 reads the page as the judge first sees it, before anything scrolls.
  await guard(ctx, "R1", () => checkRecallInView(page, ctx));
  await shot(page, ctx, S("recall"));
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
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "recall"));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "GT1", () => checkGhostText(page, ctx));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  if (!ctx.pickedUp) {
    await guard(ctx, "GZ1", async () => {
      if (await page.evaluate(() => !!document.querySelector("[data-ghost]"))) ctx.ghostHook = true;
    });
  }
  await checkEveryPage(page, ctx, route, { fonts: !ctx.pickedUp });
  const answers = p.answers(await page.evaluate(() => document.body.innerText));
  const problem = await answerAll(page, answers, async (i, control) => {
    if (i > 0) await guard(ctx, "G1", () => checkGhostBody(page, ctx));
    if (i === 0 || control === RECORD) await guard(ctx, "BTN", () => checkMainButton(page, ctx, control));
  });
  if (problem) {
    ctx.rep.add("blocker", "walk", problem);
    return;
  }
  // Marks: both answers recorded.
  ctx.rep.stage(S("marks"));
  if (!(await waitForStage(page, "marks"))) {
    ctx.rep.add("blocker", "walk", `"${RECORD}" does not reach the marks stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  await sleep(1500);
  await settle(page);
  await shot(page, ctx, S("marks"));
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
  await guard(ctx, "RS1", () => checkScaleOverlap(page, ctx));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "marks"));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "ET1", () => checkSealOnEnvelope(page, ctx));
  await guard(ctx, "SG1", () => checkSealGroup(page, ctx));
  await guard(ctx, "AL1", () => checkAnswerList(page, ctx));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  await checkEveryPage(page, ctx, route);

  // Seal: the hold, when this build has the seal target (a later spec 07 task).
  const seal = page.locator("[data-seal-target]").first();
  if ((await seal.count()) > 0) {
    ctx.rep.stage(S("seal"));
    await seal.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const init = { pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      el.dispatchEvent(new PointerEvent("pointerdown", init));
    });
    await sleep(700);
    await shot(page, ctx, S("seal"));
    await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "seal"));
    await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, true));
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
  ctx.rep.stage(S("letter"));
  await sleep(2300);
  await shot(page, ctx, S("letter"));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "W1", () => checkLetterWidth(page, ctx));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  // The letter is long by design, so the figures button sits below it and is not held to the 1280x800 rule.
  const figures = await figuresButton(page);
  if (figures) await guard(ctx, "BTN", () => checkMainButton(page, ctx, figures));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "letter"));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "GT1", () => checkGhostText(page, ctx));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  await checkEveryPage(page, ctx, route, { fonts: true });

  // Figures: [data-advance="figures"], else "See the numbers" or "See the receipts".
  if (!figures) {
    ctx.rep.add("blocker", "walk", `no ${FIGURES_HOOK} and no "See the numbers" or "See the receipts" button after the letter; the flow cannot be finished`);
    return;
  }
  if (via === "keyboard") {
    if (!(await tabTo(page, figures.loc))) {
      ctx.rep.add("note", "FV1", `Tab did not reach "${figures.label}"; pressed with the mouse instead`, "heading-focus-ring");
      via = "mouse";
      await figures.loc.click();
    } else {
      await page.keyboard.press("Enter");
    }
  } else {
    await figures.loc.click();
  }
  await sleep(100);
  const figuresStage = await stageOf(page);
  if (figuresStage === "letter") {
    await sleep(400);
    if ((await stageOf(page)) === "letter") {
      ctx.rep.add("blocker", "walk", `"${figures.label}" does nothing (still in the letter stage)`);
      return;
    }
  }
  ctx.rep.stage(S("figures"));
  ctx.rep.add("ok", "walk", `figures reached (data-ceremony is ${await stageOf(page)})`);
  // N1 reads where the press landed the judge, so nothing scrolls before it.
  let headingFound = false;
  await guard(ctx, "N1", async () => {
    headingFound = await checkNumbersFocus(page, ctx, figures.label, S("figures"));
  });
  if (p.key === PERSONAS[0].key) ctx.hasFiguresHeading = headingFound;
  await guard(ctx, "FV1", () => checkHeadingRing(page, ctx, via));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));

  // Close.
  if (await waitForStage(page, "close", 12000)) {
    ctx.rep.stage(S("close"));
    await sleep(1000);
    // RC1 reads where the figures button left the judge, before anything scrolls.
    await guard(ctx, "RC1", () => checkReceiptsInView(page, ctx));
    await guard(ctx, "B1", () => checkFigureBoxes(page, ctx));
    await guard(ctx, "L1", () => checkLineLabels(page, ctx));
    await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
    await shot(page, ctx, S("close"));
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "FT1", () => checkFooter(page, ctx));
    await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));
    await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "close"));
    await guard(ctx, "SI1", () => checkStepFit(page, ctx));
    await guard(ctx, "TK1", () => checkTickOnAxis(page, ctx));
    await guard(ctx, "CF1", () => checkCardFit(page, ctx));
    await guard(ctx, "FONT2", async () => {
      const r = await page.evaluate(FONT2_READ);
      if (!r.missing) report(ctx, result("FONT2", "fonts-sans-ui", r.off.length ? "fail" : "pass", `sans=${r.sans} measured=${r.measured} off=${r.off.length}${r.off.length ? ` (${r.off.slice(0, 3).join("; ")})` : ""} threshold=0`));
    });
    await checkEveryPage(page, ctx, route);
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
    // As the main walk (spec 10 ad): press "Pick up the letter" only where this build shows it.
    const first = await reachRecall(page);
    if (first === null) throw new Error("neither recall nor a pick-up button");
    if (first === "pickup") {
      await page.getByRole("button", { name: PICK_UP, exact: true }).click({ timeout: WAIT_MS });
      if (!(await waitForStage(page, "recall"))) throw new Error("recall not reached");
    }
    await sleep(1500);
    const problem = await answerAll(page, PERSONAS[0].answers(""));
    if (problem) throw new Error(problem);
    if (!(await waitForStage(page, "marks"))) throw new Error("marks not reached");
    await sleep(1500);
    const showAllControl = page.getByRole("button", { name: SHOW_ALL_LABEL }).or(page.getByRole("link", { name: SHOW_ALL_LABEL })).first();
    const label = (await showAllControl.textContent({ timeout: WAIT_MS }))?.trim() || SHOW_ALL;
    await showAllControl.click({ timeout: WAIT_MS });
    await guard(ctx, "N1", () => checkNumbersFocus(page, ctx, label));
  } catch (error) {
    ctx.rep.add("note", "N1", `"${SHOW_ALL}" or "Skip to the receipts" walk not finished: ${String(error.message ?? error).split("\n")[0]}`, "numbers-focus");
  } finally {
    await page.close();
  }
}

// W1.6 and W1.7 (spec 12 design.md "W1.6: viewport arithmetic") on /demo/live at
// the Write step. The phone field rule (PH1) runs through checkPhone. Failures are
// BLOCKERs, like the spec 08 checks: the Write step must fit the thresholds on every run.
async function checkWriteStep(page, ctx) {
  const r = await page.evaluate(WRITE_READ, WRITE_CARD);
  if (r.missing) {
    ctx.rep.add("note", "W1.6", `no Write card with a Letter_Field on /demo/live (${WRITE_CARD})`, "write-step");
    return;
  }
  const next = r.next ? `Next=${px(r.next.top)}..${px(r.next.bottom)} (note, not asserted)` : "Next not found (note)";
  ctx.rep.add("note", "W1.6", `${next} at ${ctx.size}`, "write-step");
  const w16 = [];
  if (ctx.size === W16_SIZE) {
    if (!r.field.topInView) w16.push(`Letter_Field top ${px(r.field.top)} is outside the window`);
    if (r.field.linesInView < W16_LINES_DESKTOP) w16.push(`Letter_Field shows ${r.field.linesInView} lines in view, need ${W16_LINES_DESKTOP}`);
    if (!r.chips.inView) w16.push(`Occasion chips ${r.chips.count ? `${px(r.chips.top)}..${px(r.chips.bottom)} are not all inside the window` : "not found"}`);
    const detail = `field=${px(r.field.top)}..${px(r.field.bottom)} lines=${r.field.linesInView} of ${r.field.lines} in view chips=${r.chips.count} inView=${r.chips.inView} threshold=field top in view, ${W16_LINES_DESKTOP} lines in view, chips in view`;
    ctx.rep.add(w16.length ? "blocker" : "ok", "W1.6", w16.length ? `${detail} (${w16.join("; ")})` : detail, "write-step");
  }
  const w17 = [];
  if (isPhone(ctx) && r.next) {
    const limit = W17_NEXT_SCREENS_MAX * ctx.h;
    if (r.next.bottom > limit) w17.push(`Next bottom ${px(r.next.bottom)} is past ${px(limit)}, more than one short scroll`);
  }
  if (ctx.size === W17_SIDEWAYS_SIZE) {
    if (r.doc.scrollWidth > r.doc.clientWidth) w17.push(`document scrollWidth ${r.doc.scrollWidth}px > clientWidth ${r.doc.clientWidth}px`);
    if (r.card.scrollWidth > r.card.clientWidth) w17.push(`Write card scrollWidth ${r.card.scrollWidth}px > clientWidth ${r.card.clientWidth}px`);
  }
  if (isPhone(ctx) || ctx.size === W17_SIDEWAYS_SIZE) {
    const detail = `next=${r.next ? `${px(r.next.top)}..${px(r.next.bottom)}` : "none"} viewport=${ctx.w}x${ctx.h} docScroll=${r.doc.scrollWidth}/${r.doc.clientWidth} cardScroll=${r.card.scrollWidth}/${r.card.clientWidth} threshold=Next bottom <= ${W17_NEXT_SCREENS_MAX} x window height, no sideways scroll at ${W17_SIDEWAYS_SIZE}`;
    ctx.rep.add(w17.length ? "blocker" : "ok", "W1.7", w17.length ? `${detail} (${w17.join("; ")})` : detail, "write-step");
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
      if (path === LIVE_PATH) {
        await guard(ctx, "W1.6", () => checkWriteStep(page, ctx));
        // Only the steps before the first passkey prompt are reachable here.
        const step = await page.evaluate(() => document.querySelector("[data-live-step]")?.getAttribute("data-live-step") ?? null);
        ctx.rep.add(step ? "ok" : "note", "walk", step ? `/demo/live step "${step}" reached` : "no [data-live-step] on /demo/live");
      }
      await checkEveryPage(page, ctx, path, { fonts: true });
      if (path === LIVE_PATH) ctx.rep.add("note", "live", `not reached: ${LIVE_UNREACHED} (they need a passkey)`);
    } finally {
      await page.close();
    }
  }
}

async function runSize(browser, base, size, opts, rep) {
  const [w, h] = size.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, shotsDir: opts.shots, rep, intactCentre: null, stage: null, hasFiguresHeading: false, required: opts.required, memo: opts.memo, ghostHook: false };
  rep.setContext(ctx);
  console.log(`\n==== ${size} ====`);
  try {
    await guard(ctx, "walk", () => landing(context, ctx));
    await guard(ctx, "walk", () => index(context, ctx));
    await guard(ctx, "walk", () => persona(context, ctx, PERSONAS[0], "mouse"));
    await guard(ctx, "walk", () => persona(context, ctx, PERSONAS[1], "keyboard"));
    await guard(ctx, "walk", () => showAll(context, ctx));
    await guard(ctx, "FP1", () => checkFastestPath(context, ctx, PERSONAS[0]));
    await guard(ctx, "walk", () => otherPages(context, ctx));
  } finally {
    await context.close();
  }
}

function printUsage() {
  console.log(`Usage: npm run layout-check -- --url <origin> [--sizes WxH,WxH] [--all-sizes] [--require ID,ID] [--shots <dir>] [--chromium <path>]`);
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
  // --require: the spec 09 checks whose failures are BLOCKERs. An unknown ID is a note.
  opts.required = new Set();
  for (const id of opts.require) {
    const known = REQUIRABLE_CHECKS.find((c) => c.toLowerCase() === id.toLowerCase());
    if (known) opts.required.add(known);
    else rep.add("note", "args", `--require: unknown check ID "${id}" ignored (known: ${REQUIRABLE_CHECKS.join(",")})`);
  }
  console.log(`Required: ${opts.required.size ? [...opts.required].join(", ") : "none (spec 09 and spec 10 checks print polish)"}`);
  opts.memo = {};
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

// Runs only as a command, so tools/qa/journey-check.mjs can import runPhoneChecks
// and runFontCheck without starting a check.
const invokedAsScript = (() => {
  try {
    return !!process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`layout-check: ${error.stack ?? error}`);
      process.exitCode = 2;
    },
  );
}
