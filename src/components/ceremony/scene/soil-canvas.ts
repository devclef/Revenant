// Feature: 07-judge-journey
//
// The Soil_Canvas (design.md "SceneBackdrop and the Soil", steps 6 to 9, R6.3,
// R6.5, R6.12, R6.16 to R6.18). Browser-only. soil-model.ts computes what to
// draw; this module draws it onto one 2D canvas. SoilCanvasLoader (task 4)
// loads this file by dynamic import, so it is never in the first-load bundle.
//
// No colour literal sits here. Every colour is read once from the tokens with
// getComputedStyle and mixed in code. The base is drawn once per size from the
// seed. Each frame blits that base, then dust, then clods. The frame loop
// writes no markup.

import { DUST_MAX_FPS, DUST_CEILING_GAP_PX, CLOD_GRAVITY_PX_S2, RISE_AT_MS, SOIL_DPR_MAX, SOIL_RESIZE_DEBOUNCE_MS } from "../constants";
import type { MotionMode } from "../motion";
import { lightX, soilBandPx, soilTopPx } from "./layout";
import { buildSoilModel, CLOD_BOUNCE_FACTORS, DUST_SWAY_PX_S, type Clod, type DustParticle, type SoilGeometry, type SoilModel } from "./soil-model";

/** An RGB triple, each channel 0 to 255. */
export type RGB = readonly [number, number, number];

/** The soil colours, read from the tokens. */
export interface SoilColours {
  deep: RGB;
  mid: RGB;
  lit: RGB;
  dust: RGB;
  clod: RGB;
}

/** What the ceiling needs from the page, in viewport pixels. */
export interface CeilingInputs {
  /** Top_Bar bottom. */
  barBottom: number;
  /** Headline bottom while the headline shows, otherwise null. */
  headlineBottom: number | null;
  /** The scene layer's current translateY (negative when lifted). */
  translateY: number;
}

export interface BackingSize {
  width: number;
  height: number;
  /** The DPR actually used, `min(SOIL_DPR_MAX, devicePixelRatio || 1)`. */
  ratio: number;
}

export interface PointXY {
  x: number;
  y: number;
}

export interface ClodPoint extends PointXY {
  /** 1 at launch, 0 at the end of the life. */
  alpha: number;
}

/** Interval between drawn frames, ms. */
const FRAME_MS = 1000 / DUST_MAX_FPS;
/** Clod physics step, s. Fixed, so a clod's place depends only on its age. */
const CLOD_STEP_S = 1 / 60;
/** Clods bounce on the soil top plus this many px (design step 7). */
const CLOD_BOUNCE_BELOW_TOP_PX = 8;
/** Share of a clod's speed kept when pushed back from the dust ceiling. */
const CLOD_CEILING_REBOUND = 0.3;
/** The wrap line sits this far above the soil top (R6.5). */
const DUST_WRAP_ABOVE_TOP_PX = 4;
/** Radius of a clod dot, px. */
const CLOD_RADIUS_PX = 2.2;
/**
 * Clear space between a dot's drawn edge and the ceiling, px. The layout check
 * (D1) reads the highest drawn pixel, so a dot's edge, not its centre, must sit
 * on or below the ceiling.
 */
const DOT_CEILING_CLEAR_PX = 1;

/** Dust ceiling: `max(Top_Bar bottom, headline bottom) + 8 px − translateY` (R6.16). */
export function dustCeiling(c: CeilingInputs): number {
  const top = c.headlineBottom === null ? c.barBottom : Math.max(c.barBottom, c.headlineBottom);
  return top + DUST_CEILING_GAP_PX - c.translateY;
}

/** Canvas backing store size. DPR is capped at SOIL_DPR_MAX (R6.5). */
export function backingSize(w: number, h: number, devicePixelRatio: number | undefined): BackingSize {
  const ratio = Math.min(SOIL_DPR_MAX, devicePixelRatio || 1);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio), ratio };
}

/** The soil geometry for a window. The light x is the same rule as the Ghost's. */
export function soilGeometry(viewportWidth: number, viewportHeight: number): SoilGeometry {
  return {
    w: viewportWidth,
    band: soilBandPx(viewportWidth, viewportHeight),
    y0: soilTopPx(viewportWidth, viewportHeight),
    lx: lightX(viewportWidth),
  };
}

/** Parses a `#rrggbb` token value. Returns null for anything else. */
export function parseHexColour(value: string): RGB | null {
  const m = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) {
    return null;
  }
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Reads the six soil tokens once. Null if any token is missing or not hex. */
export function readColours(style: Pick<CSSStyleDeclaration, "getPropertyValue">): SoilColours | null {
  const read = (name: string) => parseHexColour(style.getPropertyValue(name));
  const deep = read("--soil-deep");
  const mid = read("--soil-mid");
  const lit = read("--soil-lit");
  const dust = read("--dust");
  const clod = read("--clod");
  if (!deep || !mid || !lit || !dust || !clod) {
    return null;
  }
  return { deep, mid, lit, dust, clod };
}

/** Linear mix of two colours. `k` is clamped to [0, 1]. */
function mix(a: RGB, b: RGB, k: number): RGB {
  const t = Math.min(1, Math.max(0, k));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function css(c: RGB, alpha = 1): string {
  return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})`;
}

/**
 * Draws the base once: the gradient over the strip, the pebbles, the back row
 * and the front row. It covers the full canvas width (R6.18).
 */
export function drawBase(ctx: CanvasRenderingContext2D, g: SoilGeometry, model: SoilModel, c: SoilColours): void {
  const grad = ctx.createLinearGradient(0, g.y0, 0, g.y0 + g.band);
  grad.addColorStop(0, css(c.mid));
  grad.addColorStop(0.6, css(c.deep));
  grad.addColorStop(1, css(c.deep, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, g.y0 + 6, g.w, Math.max(0, g.band - 6));

  for (const p of model.pebbles) {
    ctx.fillStyle = css(mix(c.mid, c.lit, p.strength));
    ctx.globalAlpha = 0.25 + 0.6 * p.strength;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.r, p.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const b of model.backClumps) {
    ctx.fillStyle = css(mix(c.deep, c.mid, b.shade ?? 0));
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(b.x, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const f of model.frontClumps) {
    const k = f.k ?? 0;
    const lit = mix(c.mid, c.lit, k);
    const fill = ctx.createLinearGradient(0, f.cy - f.ry, 0, f.cy + f.ry);
    fill.addColorStop(0, css(lit, 0.35 + 0.6 * k));
    fill.addColorStop(0.45, css(c.mid));
    fill.addColorStop(1, css(c.deep));
    ctx.fillStyle = fill;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(f.x, f.cy, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Where a dust dot is at this time. The dot rises at its own speed from its
 * start share of the column, sways by DUST_SWAY_PX_S, and wraps back to the
 * soil when it passes the ceiling. It never goes above the ceiling.
 */
export function dustPoint(p: DustParticle, g: SoilGeometry, ceiling: number, elapsedS: number): PointXY {
  const top = g.y0 - DUST_WRAP_ABOVE_TOP_PX;
  const range = top - ceiling;
  if (range <= 0) {
    return { x: p.x, y: ceiling };
  }
  const travelled = (p.t * range + p.speed * elapsedS) % range;
  return {
    x: p.x + DUST_SWAY_PX_S * Math.sin(elapsedS + p.swayPhase),
    y: top - travelled,
  };
}

/**
 * Where a clod is `tauS` seconds after it launched, or null before launch and
 * after its life. It falls under gravity, bounces on the soil top with the
 * design's factors, and is pushed back down when it reaches the ceiling.
 * Stepped at a fixed rate, so the same age always gives the same point.
 */
export function clodPoint(c: Clod, g: SoilGeometry, ceiling: number, tauS: number): ClodPoint | null {
  const lifeS = c.lifeMs / 1000;
  if (tauS < 0 || tauS >= lifeS) {
    return null;
  }
  const bounceY = g.y0 + CLOD_BOUNCE_BELOW_TOP_PX;
  let x = c.x;
  // A clod launches at the soil top. When the ceiling sits below that point,
  // clamp the launch so the clod is never drawn above the ceiling, even at
  // tauS = 0 where the loop below does not run (R6.16).
  let y = Math.max(c.y, ceiling);
  let vy = c.vy;
  let bounces = 0;
  let t = 0;
  while (t < tauS) {
    const step = Math.min(CLOD_STEP_S, tauS - t);
    vy += CLOD_GRAVITY_PX_S2 * step;
    y += vy * step;
    x += c.vx * step;
    if (y >= bounceY && vy > 0) {
      y = bounceY;
      if (bounces < CLOD_BOUNCE_FACTORS.length) {
        vy *= CLOD_BOUNCE_FACTORS[bounces];
        bounces += 1;
      } else {
        vy = 0;
      }
    }
    if (y < ceiling) {
      y = ceiling;
      vy = CLOD_CEILING_REBOUND * Math.abs(vy);
    }
    t += step;
  }
  return { x, y, alpha: 1 - tauS / lifeS };
}

/** Clods fly only in full motion, and only from the rise onward (R6.5). */
export function shouldDrawClods(mode: MotionMode, elapsedMs: number): boolean {
  return mode === "full" && elapsedMs >= RISE_AT_MS;
}

/**
 * The centre y at which a dot of radius `r` is drawn. The centre never goes
 * above `ceiling + r + DOT_CEILING_CLEAR_PX`, so the dot's edge stays below the
 * ceiling (R6.16).
 */
export function dotCentreY(y: number, r: number, ceiling: number): number {
  return Math.max(y, ceiling + r + DOT_CEILING_CLEAR_PX);
}

/**
 * Draws the moving layer over the base: dust, then clods. `elapsedMs` counts
 * from mount. Nothing is drawn above the ceiling.
 */
export function drawMotion(
  ctx: CanvasRenderingContext2D,
  g: SoilGeometry,
  model: SoilModel,
  c: SoilColours,
  ceiling: number,
  elapsedMs: number,
  clodsOn: boolean,
): void {
  const elapsedS = elapsedMs / 1000;
  for (const p of model.dust) {
    const pt = dustPoint(p, g, ceiling, elapsedS);
    ctx.fillStyle = css(c.dust, p.alpha);
    ctx.beginPath();
    ctx.arc(pt.x, dotCentreY(pt.y, p.r, ceiling), p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!clodsOn) {
    return;
  }
  const tauS = (elapsedMs - RISE_AT_MS) / 1000;
  for (const k of model.clods) {
    const pt = clodPoint(k, g, ceiling, tauS);
    if (pt === null) {
      continue;
    }
    ctx.fillStyle = css(c.clod, pt.alpha);
    ctx.beginPath();
    ctx.arc(pt.x, dotCentreY(pt.y, CLOD_RADIUS_PX, ceiling), CLOD_RADIUS_PX, 0, Math.PI * 2);
    ctx.fill();
  }
}

export interface SoilCanvasOptions {
  /** Element the canvas is appended to. */
  container: HTMLElement;
  /** Current motion mode. */
  mode: MotionMode;
  /** Reads the ceiling inputs from the page. Called on mount, resize and refresh. */
  readCeiling: () => CeilingInputs;
}

export interface SoilCanvasHandle {
  /** Called when the motion mode changes. `full` runs the loop, anything else stops it and clears the canvas. */
  setMode(mode: MotionMode): void;
  /** Re-reads the ceiling inputs. Call when the headline goes. */
  refreshCeiling(): void;
  /** Stops the loop, removes listeners and the canvas. */
  destroy(): void;
}

/**
 * Mounts the one canvas and starts the frame loop in full motion. Returns null
 * when the 2D context or the colour tokens are unavailable; the Soil_Fallback
 * stays in that case.
 */
export function mountSoilCanvas(options: SoilCanvasOptions): SoilCanvasHandle | null {
  const { container, readCeiling } = options;
  const doc = container.ownerDocument;
  const canvas = doc.createElement("canvas");
  canvas.setAttribute("data-soil-canvas", "");
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const colours = ctx ? readColours(window.getComputedStyle(canvas)) : null;
  const baseCanvas = doc.createElement("canvas");
  const baseCtx = baseCanvas.getContext("2d");
  if (!ctx || !colours || !baseCtx) {
    canvas.remove();
    return null;
  }
  // Narrowed constants, so the closures below need no non-null assertions.
  const drawCtx: CanvasRenderingContext2D = ctx;
  const bakeCtx: CanvasRenderingContext2D = baseCtx;
  const palette: SoilColours = colours;

  let mode = options.mode;
  let destroyed = false;
  let ratio = 1;
  let geo: SoilGeometry = soilGeometry(0, 0);
  let model: SoilModel = buildSoilModel(geo);
  let ceiling = 0;
  let raf: number | null = null;
  let startTs: number | null = null;
  let lastDraw: number | null = null;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;

  /** Sizes the canvas to the window and redraws the base from the seed. */
  function layout(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = backingSize(w, h, window.devicePixelRatio);
    ratio = size.ratio;
    geo = soilGeometry(w, h);
    model = buildSoilModel(geo);
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    baseCanvas.width = size.width;
    baseCanvas.height = size.height;
    bakeCtx.setTransform(1, 0, 0, 1, 0, 0);
    bakeCtx.clearRect(0, 0, size.width, size.height);
    bakeCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawBase(bakeCtx, geo, model, palette);
    ceiling = dustCeiling(readCeiling());
  }

  function clear(): void {
    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function paint(elapsedMs: number): void {
    drawCtx.setTransform(1, 0, 0, 1, 0, 0);
    drawCtx.clearRect(0, 0, canvas.width, canvas.height);
    drawCtx.drawImage(baseCanvas, 0, 0);
    drawCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawMotion(drawCtx, geo, model, palette, ceiling, elapsedMs, shouldDrawClods(mode, elapsedMs));
  }

  function stop(): void {
    if (raf !== null) {
      window.cancelAnimationFrame(raf);
      raf = null;
    }
  }

  function schedule(): void {
    if (raf === null && !destroyed && mode === "full" && !doc.hidden) {
      raf = window.requestAnimationFrame(tick);
    }
  }

  function tick(ts: number): void {
    raf = null;
    if (destroyed || mode !== "full" || doc.hidden) {
      return;
    }
    if (startTs === null) {
      startTs = ts;
    }
    if (lastDraw !== null && ts - lastDraw < FRAME_MS - 1) {
      schedule();
      return;
    }
    lastDraw = ts;
    paint(ts - startTs);
    schedule();
  }

  function onResize(): void {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      if (!destroyed) {
        layout();
      }
    }, SOIL_RESIZE_DEBOUNCE_MS);
  }

  function onVisibility(): void {
    if (doc.hidden) {
      stop();
    } else {
      lastDraw = null;
      schedule();
    }
  }

  layout();
  if (mode === "full") {
    schedule();
  } else {
    clear();
  }
  window.addEventListener("resize", onResize);
  doc.addEventListener("visibilitychange", onVisibility);

  return {
    setMode(next: MotionMode): void {
      if (destroyed) {
        return;
      }
      mode = next;
      if (mode === "full") {
        lastDraw = null;
        schedule();
      } else {
        stop();
        clear();
      }
    },
    refreshCeiling(): void {
      if (!destroyed) {
        ceiling = dustCeiling(readCeiling());
      }
    },
    destroy(): void {
      destroyed = true;
      stop();
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
      window.removeEventListener("resize", onResize);
      doc.removeEventListener("visibilitychange", onVisibility);
      canvas.remove();
    },
  };
}
