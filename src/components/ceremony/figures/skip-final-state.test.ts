// Feature: 05-reveal-ceremony, issue #103
//
// Skip reaches the final state of stage 3 (R11.4): then, passage and now are
// settled, every Stamp and counter value is shown, and every change line is
// shown. The renders here are static (renderToStaticMarkup), so these tests
// check the three pieces that make the final state reachable on a real page:
//
//   1. the Skip target is `done` (stepAfterSkip) and the settle path clears the
//      timers before it moves there (ThenNowSequence.tsx source);
//   2. the stamp drop and counter roll stop once the sequence is `done`, so the
//      resting styles are what the reader sees (figures.module.css);
//   3. the timeline's final Step is `done`, so Skip and the natural end agree.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { planThenNow, stepAfterSkip } from "./ThenNowSequence";

const here = __dirname;
const css = readFileSync(resolve(here, "figures.module.css"), "utf8");
const sequenceSource = readFileSync(resolve(here, "ThenNowSequence.tsx"), "utf8");

describe("stage 3 Skip target", () => {
  it("settles at done", () => {
    expect(stepAfterSkip()).toBe("done");
  });

  it("the timeline ends at done, the same Step Skip reaches", () => {
    const plan = planThenNow([{ key: "metric-0" }]);
    expect(plan.steps.at(-1)?.step).toBe("done");
    expect(plan.steps.at(-1)?.startMs).toBe(plan.totalMs);
  });

  it("the finish callback clears pending Steps before settling at stepAfterSkip", () => {
    expect(sequenceSource).toMatch(
      /const finish = useCallback\(\(\) => \{\s*clearTimers\(\);\s*setStep\(stepAfterSkip\(\)\);\s*\}, \[clearTimers\]\);/,
    );
  });

  it("registers finish with the shared Skip only while Steps run", () => {
    expect(sequenceSource).toMatch(
      /if \(step === "done"\) return undefined;\s*return register\(finish\);/,
    );
  });
});

describe("stage 3 final state for Stamps and counters", () => {
  it("stops the stamp drop and the counter roll once the sequence is done", () => {
    expect(css).toMatch(
      /\.sequence\[data-step="done"\] \.drop,\s*\.sequence\[data-step="done"\] \.roll\s*\{\s*animation:\s*none;\s*\}/,
    );
  });

  it("keeps the change-line settle rule (the change lines show at done)", () => {
    expect(css).toMatch(/\.sequence\[data-step="done"\] \[data-change\]\s*\{\s*animation:\s*none;\s*\}/);
  });

  it("the Passage unmounts once the sequence is done (only the passage Step shows it)", () => {
    expect(sequenceSource).toMatch(/step === "passage" \? <Passage \/> : null/);
  });
});
