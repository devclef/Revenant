// Feature: 05-reveal-ceremony
//
// Tests for tilt.ts (design.md "Desk", R8.6): the orientation-to-light mapping,
// the iOS permission check and request, and the listener. Node only. The window
// and the target element are fakes.

import { describe, expect, it, vi } from "vitest";

import { PARALLAX_MAX_DEG, PARALLAX_MAX_PX } from "../constants";
import {
  hasOrientationSensor,
  lightFromOrientation,
  needsTiltPermission,
  requestTiltPermission,
  startTilt,
  TILT_NEUTRAL_BETA_DEG,
  type OrientationReading,
  type TiltWindow,
} from "./tilt";

type Listener = (event: OrientationReading) => void;

/** A window stand-in that records its deviceorientation listeners. */
function fakeWindow(requestPermission?: () => Promise<string>) {
  const listeners = new Set<Listener>();
  const win: TiltWindow = {
    DeviceOrientationEvent:
      requestPermission === undefined ? {} : { requestPermission },
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
  };
  return { win, listeners };
}

/** A target element stand-in that records the custom properties written onto it. */
function fakeElement() {
  const props = new Map<string, string>();
  const el = {
    style: {
      setProperty: (name: string, value: string) => {
        props.set(name, value);
      },
    },
  } as unknown as HTMLElement;
  return { el, props };
}

describe("lightFromOrientation", () => {
  it("maps the neutral reading to the centre of the light", () => {
    const v = lightFromOrientation({ beta: TILT_NEUTRAL_BETA_DEG, gamma: 0 });
    expect(v.x).toBe(0.5);
    expect(v.y).toBe(0.5);
    expect(Math.abs(v.px)).toBe(0);
    expect(Math.abs(v.py)).toBe(0);
  });

  it("treats a missing or non-finite angle as neutral", () => {
    const v = lightFromOrientation({ beta: null, gamma: Number.NaN });
    expect(v.x).toBe(0.5);
    expect(v.y).toBe(0.5);
  });

  it("moves the light across with gamma", () => {
    const right = lightFromOrientation({ beta: TILT_NEUTRAL_BETA_DEG, gamma: 15 });
    const left = lightFromOrientation({ beta: TILT_NEUTRAL_BETA_DEG, gamma: -15 });
    expect(right.x).toBeGreaterThan(0.5);
    expect(left.x).toBeLessThan(0.5);
  });

  it("keeps the light and the parallax inside their bounds for any reading", () => {
    const readings: OrientationReading[] = [
      { beta: 900, gamma: 900 },
      { beta: -900, gamma: -900 },
      { beta: 180, gamma: -90 },
      { beta: 0, gamma: 90 },
    ];
    for (const reading of readings) {
      const v = lightFromOrientation(reading);
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1);
      expect(Math.abs(v.px)).toBeLessThanOrEqual(PARALLAX_MAX_PX);
      expect(Math.abs(v.py)).toBeLessThanOrEqual(PARALLAX_MAX_PX);
      expect(Math.abs(v.degX)).toBeLessThanOrEqual(PARALLAX_MAX_DEG);
      expect(Math.abs(v.degY)).toBeLessThanOrEqual(PARALLAX_MAX_DEG);
    }
  });
});

describe("tilt permission (iOS)", () => {
  it("needs no request where the browser has no requestPermission", () => {
    expect(needsTiltPermission(fakeWindow().win)).toBe(false);
  });

  it("needs a request where requestPermission exists", () => {
    expect(needsTiltPermission(fakeWindow(async () => "granted").win)).toBe(true);
  });

  it("resolves true when the permission is granted", async () => {
    const { win } = fakeWindow(async () => "granted");
    await expect(requestTiltPermission(win)).resolves.toBe(true);
  });

  it("resolves false when the permission is denied", async () => {
    const { win } = fakeWindow(async () => "denied");
    await expect(requestTiltPermission(win)).resolves.toBe(false);
  });

  it("resolves false when the request throws", async () => {
    const { win } = fakeWindow(async () => {
      throw new Error("not from a gesture");
    });
    await expect(requestTiltPermission(win)).resolves.toBe(false);
  });

  it("calls the request on the event constructor it belongs to", async () => {
    const request = vi.fn(async () => "granted");
    const { win } = fakeWindow(request);
    await requestTiltPermission(win);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("startTilt", () => {
  it("writes the light from each orientation reading onto the target", () => {
    const { win, listeners } = fakeWindow();
    const { el, props } = fakeElement();
    startTilt(el, win);
    expect(listeners.size).toBe(1);
    for (const listener of listeners) {
      listener({ beta: TILT_NEUTRAL_BETA_DEG, gamma: 20 });
    }
    expect(props.get("--light-x")).toBe(String(lightFromOrientation({ beta: TILT_NEUTRAL_BETA_DEG, gamma: 20 }).x));
    expect(props.has("--parallax-x")).toBe(true);
  });

  it("removes its listener when the returned stop function runs", () => {
    const { win, listeners } = fakeWindow();
    const { el } = fakeElement();
    const stop = startTilt(el, win);
    stop();
    expect(listeners.size).toBe(0);
  });
});

describe("hasOrientationSensor (desktop Chromium gets no tilt control)", () => {
  /** A window with the orientation API and a chosen number of touch points. */
  function windowWithTouch(maxTouchPoints: number | undefined): TiltWindow {
    const { win } = fakeWindow();
    return {
      ...win,
      navigator: maxTouchPoints === undefined ? undefined : { maxTouchPoints },
    };
  }

  it("is false on desktop Chromium: the API exists but there are no touch points", () => {
    expect(hasOrientationSensor(windowWithTouch(0))).toBe(false);
  });

  it("is false when the browser reports no navigator at all", () => {
    expect(hasOrientationSensor(windowWithTouch(undefined))).toBe(false);
  });

  it("is false when the orientation API is absent, even on a touch device", () => {
    const { win } = fakeWindow();
    const noApi: TiltWindow = {
      ...win,
      DeviceOrientationEvent: undefined,
      navigator: { maxTouchPoints: 5 },
    };
    expect(hasOrientationSensor(noApi)).toBe(false);
  });

  it("is true on a touch-capable phone with the orientation API", () => {
    expect(hasOrientationSensor(windowWithTouch(5))).toBe(true);
  });
});
