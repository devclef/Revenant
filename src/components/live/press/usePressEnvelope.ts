"use client";

// Feature: 13-the-seal
//
// usePressEnvelope maps the press model (press-hold.ts) onto the two passkey
// calls of the Seal step (spec 13, design section 2):
//
// - write mode: the passkey prompt for creating the seal starts only from the
//   pointer release after a full hold, or from one keyboard activation. It
//   never starts from a timer (P5.2). It calls onCreatePress.
// - setting mode: the Setting_State. One plain press, no hold. It calls
//   onConfirmPress.
// - inert mode: the control accepts nothing (used on failure screens).
//
// The logic lives in `createPressController`, a plain object with no React
// and no DOM, so the node test environment can exercise it. The hook only
// wires it to the element, the window listeners and the animation frames.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type {
  PointerEvent as ReactPointerEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import { PRESS_IDLE, pressStep } from "./press-hold";
import type { PressEvent, PressState } from "./press-hold";
import { poolStage } from "./press-pose";
import type { PoolStage } from "./press-pose";

/** What the control does. `inert` accepts no press at all. */
export type PressMode = "write" | "setting" | "inert";

export type PressConfig = {
  mode: PressMode;
  /** True until a Backup_Choice is made and the input is valid (aria-disabled). */
  disabled: boolean;
  /** Reduced motion or Calm_Mode: no hold, one activation runs the press (P2.7). */
  instant: boolean;
  onCreatePress: () => void;
  onConfirmPress: () => void;
  /** Called when a disabled press is activated, so field messages can appear. */
  onAttempt?: () => void;
};

/** Receives the press progress (0 to 1) and the wax pool stage for each change. */
export type PressFrameSink = (
  progress: number,
  stage: PoolStage | null,
) => void;

export type PressController = {
  /** A pointer went down on the control. True when the press is tracked, so the caller listens for the release. */
  down: (now: number) => boolean;
  /** A pointer release. Starts the prompt only after a full hold (write) or as the plain press (setting). */
  up: (now: number) => void;
  /** A pointer cancel or blur. A cancelled press never starts a prompt. */
  cancel: (now: number) => void;
  /** One animation frame of a running press. True while another frame is needed. */
  tick: (now: number) => boolean;
  /** A click. Keyboard and assistive-technology clicks have detail 0 and start the press. */
  click: (detail: number) => void;
  /**
   * The Seal_Button's click. One ACTIVATE whatever the click's detail or the
   * motion setting. Nothing awaits before the press handler runs.
   */
  activate: () => void;
  /** Ends the current press, for example after a failed prompt (RETRY). */
  reset: () => void;
};

function stageFor(state: PressState): PoolStage | null {
  if (state.phase === "idle") return null;
  return poolStage(state.progress);
}

/** A tracked press is holding, armed or settling; its frames must keep running. */
function needsFrames(state: PressState): boolean {
  return (
    state.phase === "holding" ||
    state.phase === "armed" ||
    state.phase === "settling"
  );
}

/**
 * The press controller. `readConfig` is read on every event, so a changed mode
 * or disabled flag applies to the next event with no re-subscription.
 */
export function createPressController(
  readConfig: () => PressConfig,
  onFrame: PressFrameSink,
): PressController {
  let state: PressState = PRESS_IDLE;
  let lastMode: PressMode | null = null;
  let downOnControl = false;

  /** A mode change ends any earlier press, so the Setting_State accepts its own press. */
  function sync(): PressConfig {
    const config = readConfig();
    if (lastMode !== null && config.mode !== lastMode) {
      state = PRESS_IDLE;
      downOnControl = false;
      onFrame(0, null);
    }
    lastMode = config.mode;
    return config;
  }

  function report(): void {
    onFrame(state.progress, stageFor(state));
  }

  /** Runs one event through the model. The prompt starts after the state has moved on, so a re-entrant event is ignored. */
  function apply(config: PressConfig, event: PressEvent): void {
    const result = pressStep(state, event);
    state = result.state;
    if (result.effect === "start_prompt") {
      if (config.mode === "setting") {
        config.onConfirmPress();
      } else {
        config.onCreatePress();
      }
    }
    report();
  }

  function fromSetting(config: PressConfig): void {
    // The Setting_State press has no hold: the release is the press.
    if (config.disabled) return;
    apply(config, { type: "ACTIVATE" });
  }

  return {
    down(now) {
      const config = sync();
      if (config.mode === "inert" || config.disabled || config.instant)
        return false;
      if (config.mode === "setting") {
        downOnControl = true;
        return true;
      }
      apply(config, { type: "DOWN", now });
      return true;
    },

    up(now) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.mode === "setting") {
        if (downOnControl) {
          downOnControl = false;
          fromSetting(config);
        }
        return;
      }
      // A release while disabled counts as a cancel, so nothing starts.
      apply(
        config,
        config.disabled ? { type: "CANCEL", now } : { type: "UP", now },
      );
    },

    cancel(now) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.mode === "setting") {
        downOnControl = false;
        return;
      }
      apply(config, { type: "CANCEL", now });
    },

    tick(now) {
      const config = sync();
      if (config.mode === "inert" || !needsFrames(state)) return false;
      apply(config, { type: "TICK", now });
      return needsFrames(state);
    },

    click(detail) {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.disabled) {
        config.onAttempt?.();
        return;
      }
      // Instant mode runs the press on any click. Otherwise a pointer click
      // (detail > 0) is ignored, because the release already handled it.
      if (!config.instant && detail !== 0) return;
      apply(config, { type: "ACTIVATE" });
    },

    activate() {
      const config = sync();
      if (config.mode === "inert") return;
      if (config.disabled) {
        config.onAttempt?.();
        return;
      }
      apply(config, { type: "ACTIVATE" });
    },

    reset() {
      state = PRESS_IDLE;
      downOnControl = false;
      report();
    },
  };
}

export type UsePressEnvelopeOptions = PressConfig;

export type PressEnvelopeHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onClick: (event: ReactMouseEvent<HTMLElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLElement>) => void;
};

export type UsePressEnvelope = {
  handlers: PressEnvelopeHandlers;
  /** The element that receives `--press-progress`. Set it on the control. */
  elementRef: RefObject<HTMLButtonElement | null>;
  /** The wax pool stage, or null when no pool is shown. Changes only on a stage change. */
  stage: PoolStage | null;
  reset: () => void;
  /** The Seal_Button's click. Stable identity; see `PressController.activate`. */
  activate: () => void;
};

/**
 * The React binding for `createPressController`. Progress is written straight
 * to `--press-progress` on the element each frame, with no React render per
 * frame. React state changes only when the pool stage changes.
 */
export function usePressEnvelope(
  options: UsePressEnvelopeOptions,
): UsePressEnvelope {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const elementRef = useRef<HTMLButtonElement | null>(null);
  const [stage, setStage] = useState<PoolStage | null>(null);
  const frameRef = useRef<number | null>(null);
  const releaseRef = useRef<{
    up: (e: Event) => void;
    cancel: (e: Event) => void;
  } | null>(null);

  const [controller] = useState(() =>
    createPressController(
      () => optionsRef.current,
      (progress, nextStage) => {
        elementRef.current?.style.setProperty(
          "--press-progress",
          String(progress),
        );
        setStage(nextStage);
      },
    ),
  );

  const stopFrames = useCallback(() => {
    if (
      frameRef.current !== null &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  }, []);

  const stopListening = useCallback(() => {
    const listeners = releaseRef.current;
    if (listeners === null) return;
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.cancel);
    releaseRef.current = null;
  }, []);

  // The frame loop calls tick and never a passkey function. It stops as soon
  // as the controller reports the press is no longer running.
  const runFrames = useCallback(() => {
    if (
      frameRef.current !== null ||
      typeof requestAnimationFrame !== "function"
    )
      return;
    const loop = () => {
      frameRef.current = null;
      if (controller.tick(performance.now())) {
        frameRef.current = requestAnimationFrame(loop);
      }
    };
    frameRef.current = requestAnimationFrame(loop);
  }, [controller]);

  useEffect(() => {
    return () => {
      stopFrames();
      stopListening();
    };
  }, [stopFrames, stopListening]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // A press that is not tracked (disabled, inert, instant) takes no pointer capture.
      if (!controller.down(performance.now())) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture can throw on some devices. The window listeners below still end the press.
      }
      stopListening();
      // The release handler runs synchronously inside the pointerup event.
      // That is the only place a pointer press can start a prompt.
      const onUp = () => {
        stopListening();
        controller.up(performance.now());
      };
      const onCancel = () => {
        stopListening();
        controller.cancel(performance.now());
      };
      releaseRef.current = { up: onUp, cancel: onCancel };
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      runFrames();
    },
    [controller, runFrames, stopListening],
  );

  const onClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      controller.click(event.detail);
    },
    [controller],
  );

  // A long press on touch opens the browser callout menu. The control is a
  // press-and-hold, so that menu is suppressed (spec 09 P8.1).
  const onContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  const reset = useCallback(() => {
    controller.reset();
  }, [controller]);

  const activate = useCallback(() => {
    controller.activate();
  }, [controller]);

  return {
    handlers: { onPointerDown, onClick, onContextMenu },
    elementRef,
    stage,
    reset,
    activate,
  };
}
