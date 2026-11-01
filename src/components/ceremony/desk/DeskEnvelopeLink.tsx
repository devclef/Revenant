"use client";

// Feature: 05-reveal-ceremony
//
// The envelope link on the desk (design.md "Camera moves without a transition
// API", R8.7). Each persona envelope on `/demo` is one of these: a real `<a>`
// to the persona's letter, so it works with no JavaScript and with the usual
// browser gestures.
//
// What it does, in order:
//
//   - On pointer enter and on focus it calls `router.prefetch(href)`, so the
//     letter is usually ready by the time the judge clicks.
//   - On click in `full` motion it cancels the browser navigation, runs one
//     FLIP transform on the envelope itself (from its current rect to the
//     `ENVELOPE_TARGET` rect on the persona page) over `DESK_TO_ENVELOPE_MS`,
//     then calls `router.push(href, { scroll: true })`.
//   - In `light` or `calm` motion, with a modifier key held, or with a
//     non-primary button, it does not touch the event. The browser handles it
//     as a plain link.
//   - If the animation can't run, is cancelled, or `router.push` throws, it
//     falls back to a plain location change.
//
// The behaviour lives in exported plain functions (`createEnvelopeLinkHandlers`,
// `isPlainNavigation`, `envelopeTargetRect`, `flipTo`) so the tests can drive
// every branch without a DOM. The component only wires them to React and to
// `next/navigation` and `useMotion`.
//
// No `Math.random` and no `Date.now` (Property 21 / the ceremony source scan).
// No user-facing text lives here, so no copy is needed.

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { DESK_TO_ENVELOPE_MS, ENVELOPE_TARGET } from "../constants";
import { type MotionMode, useMotion } from "../motion";

/** A plain rectangle in viewport pixels. */
export type Rect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** The viewport size in CSS pixels. */
export type Viewport = { readonly width: number; readonly height: number };

/** The part of the Next.js app router this link uses. */
export type EnvelopeRouter = {
  prefetch: (href: string) => unknown;
  push: (href: string, options?: { scroll?: boolean }) => unknown;
};

/**
 * The element the FLIP animation runs on. A real `HTMLAnchorElement` fits this
 * shape. `animate` is optional so a browser without the Web Animations API
 * fails the same way a broken animation does: a thrown error, then fallback.
 */
export type FlipTarget = {
  getBoundingClientRect: () => Rect;
  animate?: (
    keyframes: Keyframe[],
    options: KeyframeEffectOptions,
  ) => { finished: Promise<unknown> };
};

/** The click fields the handler reads. A React mouse event satisfies this. */
export type EnvelopeClickEvent = {
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  /** 0 is the primary button. Undefined is treated as primary. */
  readonly button?: number;
  readonly currentTarget: FlipTarget;
  preventDefault: () => void;
};

export type EnvelopeLinkEnv = {
  /** The resolved motion mode at the time of the event. */
  mode: MotionMode;
  /** The persona letter this envelope opens. */
  href: string;
  router: EnvelopeRouter;
  /** Reads the viewport size. Called on click only. */
  viewport: () => Viewport;
  /** Reads the root font size in pixels. Called on click only. */
  remPx: () => number;
  /** A plain location change. Used when the animation or push fails. */
  navigate: (href: string) => void;
};

export type EnvelopeLinkHandlers = {
  onPointerEnter: () => void;
  onFocus: () => void;
  onClick: (event: EnvelopeClickEvent) => Promise<void>;
};

/** Modes that always get plain navigation: Calm, and the light desk (R8.7). */
export function isPlainNavigation(
  mode: MotionMode,
  event: Pick<EnvelopeClickEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">,
): boolean {
  if (mode !== "full") return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  if (event.button !== undefined && event.button !== 0) return true;
  return false;
}

/**
 * The envelope's resting rect on the persona page, in viewport pixels. This
 * mirrors `ENVELOPE_TARGET` in constants.ts: width `min(84vw, 26rem)`, aspect
 * `ENVELOPE_TARGET.aspect`, top `max(6rem, 14vh)`, centred horizontally.
 */
export function envelopeTargetRect(viewport: Viewport, remPx: number): Rect {
  const width = Math.min(0.84 * viewport.width, 26 * remPx);
  const height = width / ENVELOPE_TARGET.aspect;
  const top = Math.max(6 * remPx, 0.14 * viewport.height);
  return {
    left: (viewport.width - width) / 2,
    top,
    width,
    height,
  };
}

/**
 * One FLIP transform: the element moves and scales from its current rect to
 * `target`, over `durationMs`, and stays at the target when it finishes
 * (`fill: "forwards"`), so the envelope holds its place until the next page
 * replaces it. Throws synchronously when the element can't animate. The
 * returned promise rejects if the animation is cancelled.
 */
export function flipTo(el: FlipTarget, target: Rect, durationMs: number): Promise<void> {
  if (typeof el.animate !== "function") {
    throw new TypeError("Web Animations API is not available");
  }
  const from = el.getBoundingClientRect();
  if (!(from.width > 0) || !(from.height > 0)) {
    throw new RangeError("envelope has no size to animate from");
  }
  const scaleX = target.width / from.width;
  const scaleY = target.height / from.height;
  const dx = target.left - from.left;
  const dy = target.top - from.top;
  const animation = el.animate(
    [
      { transformOrigin: "0 0", transform: "translate(0px, 0px) scale(1, 1)" },
      {
        transformOrigin: "0 0",
        transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`,
      },
    ],
    { duration: durationMs, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
  );
  return animation.finished.then(() => undefined);
}

/**
 * The three handlers for one envelope link. Pure: every dependency comes in
 * through `env`, so the tests can drive each branch directly.
 */
export function createEnvelopeLinkHandlers(env: EnvelopeLinkEnv): EnvelopeLinkHandlers {
  const prefetch = (): void => {
    try {
      env.router.prefetch(env.href);
    } catch {
      // A failed prefetch only costs speed. The click still navigates.
    }
  };

  return {
    onPointerEnter: prefetch,
    onFocus: prefetch,
    onClick: async (event) => {
      if (isPlainNavigation(env.mode, event)) return;

      event.preventDefault();
      try {
        const target = envelopeTargetRect(env.viewport(), env.remPx());
        await flipTo(event.currentTarget, target, DESK_TO_ENVELOPE_MS);
        env.router.push(env.href, { scroll: true });
      } catch {
        env.navigate(env.href);
      }
    },
  };
}

export type DeskEnvelopeLinkProps = {
  /** The persona letter's path, for example `/demo/personas/maya`. */
  href: string;
  className?: string;
  children: ReactNode;
};

/** A desk envelope that links to a persona letter (see the file header). */
export function DeskEnvelopeLink({ href, className, children }: DeskEnvelopeLinkProps) {
  const router = useRouter();
  const { mode } = useMotion();
  const handlers = createEnvelopeLinkHandlers({
    href,
    mode,
    router,
    viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
    remPx: () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    navigate: (to) => window.location.assign(to),
  });

  return (
    <a
      href={href}
      className={className}
      onPointerEnter={handlers.onPointerEnter}
      onFocus={handlers.onFocus}
      onClick={handlers.onClick}
    >
      {children}
    </a>
  );
}
