// Feature: 05-reveal-ceremony, Task 5 (task 3 of the then-and-now work)
//
// ThenNowSequence: the stage 3 Steps (design.md "The stage 3 sequence", R3.1,
// R11.2, R11.4, R12.7, R12.8).
//
// The Steps run for every entry at once, in this order:
//
//   then     the then Stamps drop and their counters roll,
//   hold     a pause of STEP_HOLD_MS (still the then Step),
//   passage  Passage plays for PASSAGE_MS,
//   now      the now Stamps drop and their counters roll,
//   change   each change line and formula line fades in over CHANGE_FADE_MS,
//   done     the Stage becomes close.
//
// The Stage moves through then, passage, now and close. The Steps send no flow
// event (R12.7): they report `step` only through the local view, so the Ceremony
// Stage and `data-ceremony` follow the Steps. A reader's own actions never move
// the Flow.
//
// Plan (pure): `planThenNow` takes the entries and returns the timeline. Its
// `steps` list has one item per Step, whatever the number of entries, so the
// stage 3 plan length never grows with the figures (R10.5). Every duration and
// easing comes from constants.ts, never from the data.
//
// Final state first: the first render is `done`, which holds every entry in its
// settled place. In full motion a layout effect moves to `then` before the
// browser paints, then schedules the later Steps. In light motion the same
// Steps run. In Calm mode the sequence starts and stays at `done` and schedules
// nothing (R11.2). Skip (the shared Skip control) jumps straight to `done` and
// clears the timers (R11.4).

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CHANGE_FADE_MS,
  COUNTER_ROLL_MS,
  EASE_STAMP,
  EASE_STANDARD,
  PASSAGE_MS,
  STAMP_DROP_MS,
  STEP_HOLD_MS,
} from "../constants";
import { useLocalView } from "../local-view";
import type { MotionMode } from "../motion";
import { useMotion } from "../motion";
import { useSequence } from "../skip";
import { Passage } from "./Passage";
import styles from "./figures.module.css";

/** The Steps the sequence reports through the local view (`LocalView.step`). */
export type ThenNowStep = "then" | "passage" | "now" | "done";

/** One entry (one figure) of the stage 3 sequence. */
export type ThenNowEntry = {
  /** A stable key, in payload order. */
  key: string;
};

/** One Step on the timeline. `startMs` is measured from the start of stage 3. */
export type ThenNowPlanStep = {
  step: ThenNowStep;
  startMs: number;
  durationMs: number;
  easing: string;
};

/** The timeline for the whole stage 3 sequence. */
export type ThenNowPlan = {
  /** The Steps in order. Its length is the same for any number of entries. */
  steps: readonly ThenNowPlanStep[];
  /** The change and formula lines, faded in together for every entry. */
  changeFade: { startMs: number; durationMs: number; easing: string };
  /** When the whole sequence has settled. */
  totalMs: number;
  /** The entries, in payload order. */
  entries: readonly ThenNowEntry[];
};

/**
 * The pure plan for the stage 3 sequence. Every entry shares the same timing,
 * so the plan depends on the number of Steps and the constants only. It never
 * reads a value, a span or a distance (R10.5). The entries are carried through
 * unchanged, so their order stays the payload order (R9.3).
 */
export function planThenNow(entries: readonly ThenNowEntry[]): ThenNowPlan {
  // A stamp and its counter land together: the step lasts as long as the slower.
  const thenDuration = Math.max(STAMP_DROP_MS, COUNTER_ROLL_MS);
  const passageStart = thenDuration + STEP_HOLD_MS;
  const nowStart = passageStart + PASSAGE_MS;
  const nowDuration = thenDuration;
  const changeStart = nowStart + nowDuration;
  const totalMs = changeStart + CHANGE_FADE_MS;

  const steps: ThenNowPlanStep[] = [
    { step: "then", startMs: 0, durationMs: thenDuration, easing: EASE_STAMP },
    { step: "passage", startMs: passageStart, durationMs: PASSAGE_MS, easing: EASE_STANDARD },
    { step: "now", startMs: nowStart, durationMs: nowDuration, easing: EASE_STAMP },
    { step: "done", startMs: totalMs, durationMs: 0, easing: EASE_STANDARD },
  ];

  return {
    steps,
    changeFade: { startMs: changeStart, durationMs: CHANGE_FADE_MS, easing: EASE_STANDARD },
    totalMs,
    entries: entries.map((entry) => ({ key: entry.key })),
  };
}

/**
 * The Step the sequence starts from once it is mounted. Calm mode starts at
 * `done`, so the settled state is shown and nothing animates (R11.2). Every
 * other mode starts at `then`.
 */
export function startStepFor(mode: MotionMode): ThenNowStep {
  return mode === "calm" ? "done" : "then";
}

/** The Step a Skip settles the sequence at. Skip always goes to `done` (R11.4). */
export function stepAfterSkip(): ThenNowStep {
  return "done";
}

export type ThenNowSequenceProps = {
  /** The entries in payload order. Only their count shapes the timeline. */
  entries: readonly ThenNowEntry[];
  /** The stage 3 content: the then and now figures, drawn by FiguresThenNow. */
  children: ReactNode;
};

export function ThenNowSequence({ entries, children }: ThenNowSequenceProps) {
  const { mode } = useMotion();
  const { setLocalView } = useLocalView();
  const { register } = useSequence();

  const [step, setStep] = useState<ThenNowStep>("done");
  const timers = useRef<number[]>([]);
  const started = useRef(false);
  const entriesRef = useRef(entries);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) {
      window.clearTimeout(timer);
    }
    timers.current = [];
  }, []);

  // Skip: clear every pending Step and settle at once. The Skip callback is
  // registered while the sequence runs, so the shared Skip control reaches it.
  const finish = useCallback(() => {
    clearTimers();
    setStep(stepAfterSkip());
  }, [clearTimers]);

  // The timeline reads the latest entries when it starts. Only the count shapes
  // it, so this does not restart the timeline when the array identity changes.
  useLayoutEffect(() => {
    entriesRef.current = entries;
  });

  // Start (full and light) or settle (calm). Runs before paint, so the first
  // painted frame is the then Step, not a flash of the settled state.
  useLayoutEffect(() => {
    if (mode === "calm") {
      finish();
      return;
    }
    if (started.current) return;
    started.current = true;

    const plan = planThenNow(entriesRef.current);
    const [first, ...later] = plan.steps;
    setStep(startStepFor(mode));
    if (first === undefined) return;
    timers.current = later.map((planned) =>
      window.setTimeout(() => setStep(planned.step), planned.startMs),
    );
  }, [mode, finish]);

  // Clear pending Steps when the sequence unmounts.
  useEffect(() => clearTimers, [clearTimers]);

  // Register with Skip only while the Steps are running.
  useEffect(() => {
    if (step === "done") return undefined;
    return register(finish);
  }, [step, register, finish]);

  // Report the Step through the local view so the Stage follows it (R3.1).
  useEffect(() => {
    setLocalView({ step });
  }, [step, setLocalView]);

  return (
    <div className={styles.sequence} data-step={step}>
      {step === "passage" ? <Passage /> : null}
      {children}
    </div>
  );
}
