// Feature: 05-reveal-ceremony
//
// Tests for the desk envelope link (DeskEnvelopeLink.tsx, design.md "Camera
// moves without a transition API", R8.7). The repo's test environment is Node
// with no DOM, so the behaviour is driven through `createEnvelopeLinkHandlers`
// with fake events and fake routers:
//
//   - the rendered markup is a real `<a href>` to the persona letter;
//   - hover and focus call `router.prefetch`;
//   - Calm, the light desk, a modifier key, or a non-primary button give plain
//     navigation: no `preventDefault`, no animation, no `router.push`;
//   - a full-motion click runs the FLIP over DESK_TO_ENVELOPE_MS, then pushes;
//   - if the animation or `router.push` throws, or the animation is cancelled,
//     the link falls back to a plain location change.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DESK_TO_ENVELOPE_MS } from "../constants";
import { MotionProvider } from "../motion";
import {
  DeskEnvelopeLink,
  type DeskEnvelopeLinkProps,
  type EnvelopeClickEvent,
  type EnvelopeLinkEnv,
  type FlipTarget,
  type Rect,
  createEnvelopeLinkHandlers,
  envelopeTargetRect,
  flipTo,
  handleEnvelopeClick,
  isPlainNavigation,
} from "./DeskEnvelopeLink";

// `next/navigation`'s useRouter throws outside the app router, so the static
// render needs a stub. The stub is hoisted so the mock factory can reach it.
const routerStub = vi.hoisted(() => ({
  prefetch: () => undefined,
  push: () => undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
}));

const HREF = "/demo/personas/maya";

const RECT: Rect = { left: 10, top: 20, width: 100, height: 50 };

type FakeTargetOptions = {
  rect?: Rect;
  noAnimate?: boolean;
  animateThrows?: boolean;
  finished?: Promise<unknown>;
};

type FakeTarget = FlipTarget & {
  animateCalls: { keyframes: Keyframe[]; options: KeyframeEffectOptions }[];
};

function fakeTarget(opts: FakeTargetOptions = {}): FakeTarget {
  const animateCalls: FakeTarget["animateCalls"] = [];
  const target: FakeTarget = {
    animateCalls,
    getBoundingClientRect: () => opts.rect ?? RECT,
    animate: undefined,
  };
  if (!opts.noAnimate) {
    target.animate = (keyframes, options) => {
      animateCalls.push({ keyframes, options });
      if (opts.animateThrows) throw new Error("animate blew up");
      return { finished: opts.finished ?? Promise.resolve() };
    };
  }
  return target;
}

function makeEnv(overrides: Partial<EnvelopeLinkEnv> = {}) {
  const router = {
    prefetch: vi.fn<(href: string) => unknown>(() => undefined),
    push: vi.fn<(href: string, options?: { scroll?: boolean }) => unknown>(() => undefined),
  };
  const navigate = vi.fn();
  const env: EnvelopeLinkEnv = {
    mode: "full",
    href: HREF,
    router,
    viewport: () => ({ width: 1000, height: 800 }),
    remPx: () => 16,
    navigate,
    ...overrides,
  };
  return { env, router, navigate };
}

function click(
  target: FakeTarget,
  extra: Partial<Pick<EnvelopeClickEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">> = {},
) {
  const preventDefault = vi.fn();
  const event: EnvelopeClickEvent = {
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    button: 0,
    currentTarget: target,
    preventDefault,
    ...extra,
  };
  return { event, preventDefault };
}

describe("DeskEnvelopeLink markup", () => {
  it("renders a real anchor to the persona letter, with its children", () => {
    const props: DeskEnvelopeLinkProps = {
      href: HREF,
      className: "x",
      children: createElement("span", null, "Maya"),
    };
    const html = renderToStaticMarkup(
      createElement(MotionProvider, null, createElement(DeskEnvelopeLink, props)),
    );
    expect(html).toContain(`<a href="${HREF}" class="x">`);
    expect(html).toContain("<span>Maya</span>");
    expect(html.startsWith("<a ")).toBe(true);
  });
});

describe("prefetch on hover and focus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prefetches the letter on pointer enter", () => {
    const { env, router } = makeEnv();
    createEnvelopeLinkHandlers(env).onPointerEnter();
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    expect(router.prefetch).toHaveBeenCalledWith(HREF);
  });

  it("prefetches the letter on focus", () => {
    const { env, router } = makeEnv();
    createEnvelopeLinkHandlers(env).onFocus();
    expect(router.prefetch).toHaveBeenCalledTimes(1);
    expect(router.prefetch).toHaveBeenCalledWith(HREF);
  });

  it("does not let a failed prefetch throw into the page", () => {
    const { env, router } = makeEnv();
    router.prefetch.mockImplementation(() => {
      throw new Error("offline");
    });
    expect(() => createEnvelopeLinkHandlers(env).onPointerEnter()).not.toThrow();
    expect(() => createEnvelopeLinkHandlers(env).onFocus()).not.toThrow();
  });
});

describe("plain navigation", () => {
  it("is plain in calm and light motion, and in full motion without modifiers", () => {
    expect(isPlainNavigation("calm", { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true);
    expect(isPlainNavigation("light", { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true);
    expect(isPlainNavigation("full", { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);
  });

  it.each([
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
    ["a middle button", { button: 1 }],
  ])("is plain when %s is used in full motion", (_label, extra) => {
    expect(isPlainNavigation("full", { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra })).toBe(true);
  });

  it("treats a missing button as the primary button", () => {
    expect(isPlainNavigation("full", { metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);
  });

  it.each([
    ["calm", "calm"],
    ["light", "light"],
  ] as const)("in %s motion, leaves the click alone and does not animate", async (_label, mode) => {
    const { env, router } = makeEnv({ mode });
    const target = fakeTarget();
    const { event, preventDefault } = click(target);
    await handleEnvelopeClick(env, event);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(target.animateCalls).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["altKey", { altKey: true }],
    ["a middle click", { button: 1 }],
  ])("with %s in full motion, leaves the click alone", async (_label, extra) => {
    const { env, router, navigate } = makeEnv();
    const target = fakeTarget();
    const { event, preventDefault } = click(target, extra);
    await handleEnvelopeClick(env, event);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(target.animateCalls).toHaveLength(0);
    expect(router.push).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("full-motion click", () => {
  it("cancels the browser navigation, animates, then pushes with scroll", async () => {
    const { env, router, navigate } = makeEnv();
    const target = fakeTarget();
    const { event, preventDefault } = click(target);
    await handleEnvelopeClick(env, event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(target.animateCalls).toHaveLength(1);
    expect(target.animateCalls[0].options.duration).toBe(DESK_TO_ENVELOPE_MS);
    expect(target.animateCalls[0].options.fill).toBe("forwards");
    expect(router.push).toHaveBeenCalledWith(HREF, { scroll: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("pushes only after the animation finishes", async () => {
    let finish: (value?: unknown) => void = () => undefined;
    const finished = new Promise<unknown>((resolve) => {
      finish = resolve;
    });
    const { env, router } = makeEnv();
    const target = fakeTarget({ finished });
    const { event } = click(target);
    const done = handleEnvelopeClick(env, event);
    await Promise.resolve();
    expect(router.push).not.toHaveBeenCalled();
    finish();
    await done;
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});

describe("throw fallback", () => {
  it("navigates with a plain location change when the element cannot animate", async () => {
    const { env, router, navigate } = makeEnv();
    const { event } = click(fakeTarget({ noAnimate: true }));
    await handleEnvelopeClick(env, event);
    expect(navigate).toHaveBeenCalledWith(HREF);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates with a plain location change when animate throws", async () => {
    const { env, router, navigate } = makeEnv();
    const { event } = click(fakeTarget({ animateThrows: true }));
    await handleEnvelopeClick(env, event);
    expect(navigate).toHaveBeenCalledWith(HREF);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates with a plain location change when the animation is cancelled", async () => {
    const { env, router, navigate } = makeEnv();
    const { event } = click(fakeTarget({ finished: Promise.reject(new Error("cancelled")) }));
    await handleEnvelopeClick(env, event);
    expect(navigate).toHaveBeenCalledWith(HREF);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("navigates with a plain location change when router.push throws", async () => {
    const { env, router, navigate } = makeEnv();
    router.push.mockImplementation(() => {
      throw new Error("router gone");
    });
    const { event } = click(fakeTarget());
    await handleEnvelopeClick(env, event);
    expect(navigate).toHaveBeenCalledWith(HREF);
  });
});

describe("envelopeTargetRect", () => {
  it("is 26rem wide on a wide viewport and centred, below max(6rem, 14vh)", () => {
    // 0.84 * 1000 = 840 is wider than 26 * 16 = 416, so the width is 416.
    const rect = envelopeTargetRect({ width: 1000, height: 800 }, 16);
    expect(rect.left).toBeCloseTo(292, 6);
    expect(rect.top).toBeCloseTo(112, 6);
    expect(rect.width).toBeCloseTo(416, 6);
    expect(rect.height).toBeCloseTo(260, 6);
  });

  it("is 84vw wide on a narrow viewport, and 6rem from the top when that is lower", () => {
    // 0.84 * 300 = 252 is narrower than 416. 0.14 * 600 = 84 is less than 96.
    const rect = envelopeTargetRect({ width: 300, height: 600 }, 16);
    expect(rect.width).toBeCloseTo(252, 6);
    expect(rect.left).toBeCloseTo(24, 6);
    expect(rect.top).toBe(96);
    expect(rect.height).toBeCloseTo(252 / 1.6, 6);
  });
});

describe("flipTo", () => {
  it("animates from the current rect to the target with one transform", async () => {
    const target = fakeTarget({ rect: { left: 10, top: 20, width: 100, height: 50 } });
    await flipTo(target, { left: 100, top: 200, width: 200, height: 100 }, 450);
    const [call] = target.animateCalls;
    expect(call.keyframes[0]).toEqual({ transformOrigin: "0 0", transform: "translate(0px, 0px) scale(1, 1)" });
    // dx = 100 - 10 = 90, dy = 200 - 20 = 180, scale = 200/100 and 100/50 = 2.
    expect(call.keyframes[1]).toEqual({ transformOrigin: "0 0", transform: "translate(90px, 180px) scale(2, 2)" });
    expect(call.options).toMatchObject({ duration: 450, fill: "forwards" });
  });

  it("throws synchronously for an element with no size", () => {
    const target = fakeTarget({ rect: { left: 0, top: 0, width: 0, height: 0 } });
    expect(() => flipTo(target, { left: 0, top: 0, width: 1, height: 1 }, 450)).toThrow(RangeError);
    expect(target.animateCalls).toHaveLength(0);
  });
});
