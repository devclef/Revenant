/**
 * CT1: text meets WCAG 2.2 contrast on the surface it is actually painted on.
 *
 * The contrast maths here is pure, so vitest can test it without a browser.
 * `readTextContrast` drives a page through the small `ProbePage` interface,
 * which Playwright's Page satisfies. It reads computed colours from the DOM
 * and, for gradient or image surfaces, takes the worst pixel of a screenshot.
 *
 * No design token is read. Every colour comes from the rendered page.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** Alpha from 0 (transparent) to 1 (opaque). */
  a: number;
}

export const NORMAL_TEXT_RATIO = 4.5;
export const LARGE_TEXT_RATIO = 3;
/** Text at or above this size in CSS px is large. */
export const LARGE_TEXT_PX = 24;
/** Bold text at or above this size in CSS px is large. */
export const LARGE_BOLD_TEXT_PX = 18.66;
export const BOLD_WEIGHT = 700;

/** Comparison slack so a ratio of exactly the threshold passes despite float error. */
const RATIO_EPSILON = 1e-9;

export interface BackdropLayer {
  /** Computed background colour of one ancestor, as the browser reports it. */
  color: string;
  /** True when that ancestor paints a background-image (gradient or image). */
  image: boolean;
}

export type CtSurface =
  | { kind: "solid"; backdrops: string[] }
  | { kind: "pixels"; colors: Array<[number, number, number]> }
  | { kind: "unavailable"; reason: string };

/** One text element as read from the page. */
export interface CtReading {
  selector: string;
  text: string;
  /** Computed text colour. */
  ink: string;
  /** Computed font size in CSS px. */
  fontSize: number;
  /** Computed font weight (100 to 900). */
  fontWeight: number;
  surface: CtSurface;
}

export interface CtFailure {
  selector: string;
  text: string;
  /** Measured contrast ratio, or null when the colour or surface could not be read. */
  ratio: number | null;
  /** Ratio the text needs at its size and weight. */
  required: number;
  reason: string;
}

/**
 * Parses a CSS colour in `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`,
 * `rgba()` (comma or space syntax, percentages allowed) or `transparent`.
 * Returns null for anything else.
 */
export function parseColor(input: string): Rgba | null {
  const value = input.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };

  const hex = /^#([0-9a-f]+)$/.exec(value);
  if (hex) {
    const digits = hex[1];
    if (digits.length === 3 || digits.length === 4) {
      const pair = (i: number) => parseInt(digits[i] + digits[i], 16);
      return {
        r: pair(0),
        g: pair(1),
        b: pair(2),
        a: digits.length === 4 ? pair(3) / 255 : 1,
      };
    }
    if (digits.length === 6 || digits.length === 8) {
      const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16);
      return {
        r: byte(0),
        g: byte(2),
        b: byte(4),
        a: digits.length === 8 ? byte(6) / 255 : 1,
      };
    }
    return null;
  }

  const fn = /^rgba?\(([^)]*)\)$/.exec(value);
  if (!fn) return null;
  const parts = fn[1].split(/[\s,/]+/).filter((p) => p.length > 0);
  if (parts.length !== 3 && parts.length !== 4) return null;

  const channel = (p: string): number =>
    p.endsWith("%") ? (parseFloat(p) * 255) / 100 : parseFloat(p);
  const alpha = (p: string | undefined): number => {
    if (p === undefined) return 1;
    return p.endsWith("%") ? parseFloat(p) / 100 : parseFloat(p);
  };

  const values = [channel(parts[0]), channel(parts[1]), channel(parts[2]), alpha(parts[3])];
  if (values.some((v) => Number.isNaN(v))) return null;
  return {
    r: clamp(values[0], 0, 255),
    g: clamp(values[1], 0, 255),
    b: clamp(values[2], 0, 255),
    a: clamp(values[3], 0, 1),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Source-over compositing: `top` painted over `bottom`. */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return {
    r: mix(top.r, bottom.r),
    g: mix(top.g, bottom.g),
    b: mix(top.b, bottom.b),
    a,
  };
}

/** WCAG 2.2 relative luminance of an opaque colour, from 0 to 1. */
export function relativeLuminance(c: Rgba): number {
  const linear = (channel: number): number => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(c.r) + 0.7152 * linear(c.g) + 0.0722 * linear(c.b);
}

/** WCAG contrast ratio between two opaque colours, from 1 to 21. */
export function contrastRatio(x: Rgba, y: Rgba): number {
  const lx = relativeLuminance(x);
  const ly = relativeLuminance(y);
  const hi = Math.max(lx, ly);
  const lo = Math.min(lx, ly);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Ratio the text needs. Text is large at 24 px or more, or at 18.66 px or more
 * when bold (weight 700 or more). Large text needs 3:1; other text needs 4.5:1.
 */
export function requiredRatio(fontSizePx: number, fontWeight: number): number {
  const large =
    fontSizePx >= LARGE_TEXT_PX ||
    (fontSizePx >= LARGE_BOLD_TEXT_PX && fontWeight >= BOLD_WEIGHT);
  return large ? LARGE_TEXT_RATIO : NORMAL_TEXT_RATIO;
}

/**
 * Keeps the layers from the text's own element outwards, up to and including
 * the first opaque background. Anything further out is hidden behind it.
 * Input and output are nearest-first.
 */
export function trimToOpaque(layers: BackdropLayer[]): BackdropLayer[] {
  const out: BackdropLayer[] = [];
  for (const layer of layers) {
    out.push(layer);
    const c = parseColor(layer.color);
    if (c && c.a === 1 && !layer.image) break;
  }
  return out;
}

/**
 * Resolves the opaque colour a text element sits on. `backdrops` is nearest
 * first. Semi-transparent layers are composited over the first opaque one
 * outwards. With no opaque layer, the page is taken to be white.
 */
export function resolveSolidSurface(backdrops: Rgba[]): Rgba {
  const opaqueAt = backdrops.findIndex((c) => c.a === 1);
  const white: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  const base = opaqueAt === -1 ? white : backdrops[opaqueAt];
  let surface = base;
  const start = opaqueAt === -1 ? backdrops.length - 1 : opaqueAt - 1;
  for (let i = start; i >= 0; i--) {
    surface = over(backdrops[i], surface);
  }
  return surface;
}

/**
 * Lowest contrast between the text ink and any of the given opaque surface
 * pixels. Semi-transparent ink is composited over each pixel first.
 * Returns Infinity when there are no pixels.
 */
export function worstPixelRatio(
  ink: Rgba,
  pixels: ReadonlyArray<readonly [number, number, number]>,
): number {
  let worst = Infinity;
  for (const [r, g, b] of pixels) {
    const surface: Rgba = { r, g, b, a: 1 };
    const painted = over(ink, surface);
    worst = Math.min(worst, contrastRatio(painted, surface));
  }
  return worst;
}

/**
 * Checks one text reading. Returns [] when the text meets its required ratio,
 * otherwise one failure. Unreadable colours and surfaces fail, never pass.
 */
export function ctFailures(reading: CtReading): CtFailure[] {
  const required = requiredRatio(reading.fontSize, reading.fontWeight);
  const text = reading.text.length > 80 ? `${reading.text.slice(0, 77)}...` : reading.text;
  const fail = (ratio: number | null, reason: string): CtFailure[] => [
    { selector: reading.selector, text, ratio, required, reason },
  ];

  const ink = parseColor(reading.ink);
  if (!ink) return fail(null, `text colour "${reading.ink}" could not be read`);

  const surface = reading.surface;
  if (surface.kind === "unavailable") {
    return fail(null, `surface could not be read: ${surface.reason}`);
  }

  let ratio: number;
  if (surface.kind === "solid") {
    const backdrops: Rgba[] = [];
    for (const raw of surface.backdrops) {
      const c = parseColor(raw);
      if (!c) return fail(null, `background colour "${raw}" could not be read`);
      backdrops.push(c);
    }
    const bg = resolveSolidSurface(backdrops);
    ratio = contrastRatio(over(ink, bg), bg);
  } else {
    if (surface.colors.length === 0) {
      return fail(null, "no surface pixels were read");
    }
    ratio = worstPixelRatio(ink, surface.colors);
  }

  if (ratio + RATIO_EPSILON >= required) return [];
  return fail(ratio, `contrast ${ratio.toFixed(2)}:1 is below ${required}:1`);
}

/** The part of a page that the reader needs. Playwright's Page satisfies it. */
export interface ProbePage {
  evaluate<R, A = undefined>(pageFunction: (arg: A) => R | Promise<R>, arg?: A): Promise<R>;
  screenshot(options: {
    clip: { x: number; y: number; width: number; height: number };
  }): Promise<Buffer>;
}

interface ProbeRow {
  index: number;
  selector: string;
  text: string;
  ink: string;
  fontSize: number;
  fontWeight: number;
  layers: BackdropLayer[];
}

/**
 * Reads every visible text element on the page: its computed colour, font
 * size and weight, and the backgrounds it sits on. Elements on a gradient or
 * image get a screenshot of their box, with their own text hidden, and the
 * worst pixel decides the result.
 *
 * The page is left as it was found: the probe attributes and style are removed
 * before this returns, including when a read throws.
 */
export async function readTextContrast(page: ProbePage): Promise<CtReading[]> {
  const rows = await page.evaluate((): ProbeRow[] => {
    const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
    const isVisible = (el: Element): boolean => {
      let opacity = 1;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse") {
          return false;
        }
        opacity *= Number(cs.opacity);
      }
      if (opacity === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const out: ProbeRow[] = [];
    const seen = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const el = node.parentElement;
      const own = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (el && own && !SKIP.has(el.tagName) && !seen.has(el) && isVisible(el)) {
        seen.add(el);
        const cs = getComputedStyle(el);
        const layers: BackdropLayer[] = [];
        for (let n: Element | null = el; n; n = n.parentElement) {
          const ncs = getComputedStyle(n);
          layers.push({ color: ncs.backgroundColor, image: ncs.backgroundImage !== "none" });
        }
        const index = out.length;
        el.setAttribute("data-ct1-index", String(index));
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        out.push({
          index,
          selector: `${tag}${id}`,
          text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
          ink: cs.color,
          fontSize: parseFloat(cs.fontSize),
          fontWeight: Number(cs.fontWeight),
          layers,
        });
      }
      node = walker.nextNode();
    }
    return out;
  });

  try {
    const readings: CtReading[] = [];
    for (const row of rows) {
      const layers = trimToOpaque(row.layers);
      const base = {
        selector: row.selector,
        text: row.text,
        ink: row.ink,
        fontSize: row.fontSize,
        fontWeight: row.fontWeight,
      };
      if (!layers.some((layer) => layer.image)) {
        readings.push({ ...base, surface: { kind: "solid", backdrops: layers.map((l) => l.color) } });
        continue;
      }
      const colors = await readSurfacePixels(page, row.index);
      readings.push({
        ...base,
        surface: colors
          ? { kind: "pixels", colors }
          : { kind: "unavailable", reason: "the element has no visible box to screenshot" },
      });
    }
    return readings;
  } finally {
    await page.evaluate(() => {
      document.querySelectorAll("[data-ct1-index]").forEach((el) => {
        el.removeAttribute("data-ct1-index");
      });
      document.querySelectorAll("[data-ct1-probe]").forEach((el) => {
        el.removeAttribute("data-ct1-probe");
      });
      document.getElementById("ct1-probe-style")?.remove();
    });
  }
}

/**
 * Screenshots one element's box with its text made transparent, then returns
 * the distinct opaque colours in the picture. Returns null when the box is not
 * visible in the viewport.
 */
async function readSurfacePixels(
  page: ProbePage,
  index: number,
): Promise<Array<[number, number, number]> | null> {
  try {
    const clip = await page.evaluate((i: number) => {
      const el = document.querySelector(`[data-ct1-index="${i}"]`);
      if (!(el instanceof HTMLElement)) return null;
      el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
      el.setAttribute("data-ct1-probe", "");
      const style = document.createElement("style");
      style.id = "ct1-probe-style";
      // The text, and the element's own border, outline and shadow, are hidden. A
      // button's border is drawn in its ink, so left in the picture it would be read
      // as the surface and every outlined button would measure 1:1.
      style.textContent =
        "[data-ct1-probe], [data-ct1-probe] * { color: transparent !important; " +
        "-webkit-text-fill-color: transparent !important; text-shadow: none !important; " +
        "caret-color: transparent !important; text-decoration-color: transparent !important; " +
        "border-color: transparent !important; outline-color: transparent !important; " +
        "box-shadow: none !important; }";
      document.head.append(style);
      const r = el.getBoundingClientRect();
      const x = Math.max(0, r.left);
      const y = Math.max(0, r.top);
      const right = Math.min(window.innerWidth, r.right);
      const bottom = Math.min(window.innerHeight, r.bottom);
      if (right - x < 1 || bottom - y < 1) return null;
      return { x, y, width: right - x, height: bottom - y };
    }, index);
    if (!clip) return null;

    const png = await page.screenshot({ clip });
    return await page.evaluate(async (b64: string) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(
        new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return [];
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const distinct = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        distinct.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      }
      return Array.from(distinct, (v): [number, number, number] => [
        (v >> 16) & 255,
        (v >> 8) & 255,
        v & 255,
      ]);
    }, png.toString("base64"));
  } finally {
    await page.evaluate(() => {
      document.querySelectorAll("[data-ct1-probe]").forEach((el) => {
        el.removeAttribute("data-ct1-probe");
      });
      document.getElementById("ct1-probe-style")?.remove();
    });
  }
}
