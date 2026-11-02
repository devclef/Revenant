// Feature: 06-lock-and-unlock, Property 14: Seal times follow the offset formula
// Feature: 06-lock-and-unlock, Property 16: The countdown never rises and ends at zero
// (design.md, Correctness Properties; R15.5, R16.2, R16.4).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LOCK_DURATION_MS } from "@/lib/seal-format/live-constants";

import { computeSealTimes, remainingSeconds } from "./clock";

const MS_RANGE = { min: 0, max: 4_102_444_800_000 }; // up to 2100-01-01 UTC

const isMillisecondZ = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);

describe("Property 14: seal times follow the offset formula", () => {
  it("sets sealedAt = clock reading + (serverNow - arrival) and opensAt = sealedAt + 30 s", () => {
    fc.assert(
      fc.property(
        fc.integer(MS_RANGE),
        fc.integer(MS_RANGE),
        fc.integer({ min: 0, max: 3_600_000 }),
        (serverNowMs, arrivedMs, laterDeltaMs) => {
          const serverNow = new Date(serverNowMs).toISOString();
          const nowMs = arrivedMs + laterDeltaMs;

          const times = computeSealTimes({ serverNow, arrivedMs, nowMs });

          const expectedOffset = serverNowMs - arrivedMs;
          const expectedSealed = nowMs + expectedOffset;
          expect(times.offsetMs).toBe(expectedOffset);
          expect(times.sealedAt).toBe(new Date(expectedSealed).toISOString());
          expect(times.opensAt).toBe(new Date(expectedSealed + LOCK_DURATION_MS).toISOString());
          expect(isMillisecondZ(times.sealedAt)).toBe(true);
          expect(isMillisecondZ(times.opensAt)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("opens exactly 30 seconds after sealing", () => {
    const times = computeSealTimes({
      serverNow: "2026-11-02T10:00:00.000Z",
      arrivedMs: Date.parse("2026-11-02T09:59:59.500Z"),
      nowMs: Date.parse("2026-11-02T09:59:59.500Z"),
    });
    expect(times.sealedAt).toBe("2026-11-02T10:00:00.000Z");
    expect(times.opensAt).toBe("2026-11-02T10:00:30.000Z");
    expect(times.offsetMs).toBe(500);
  });
});

describe("Property 16: the countdown never rises and ends at zero", () => {
  it("is a non-increasing sequence of non-negative integers, and 0 once the corrected clock reaches opensAt", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_102_444_800_000 }),
        fc.integer({ min: -86_400_000, max: 86_400_000 }),
        fc.array(fc.integer({ min: 0, max: 120_000 }), { minLength: 1, maxLength: 40 }),
        (opensAtMs, offsetMs, steps) => {
          // Strictly increasing clock readings built from non-negative steps.
          let nowMs = opensAtMs - 60_000 - offsetMs;
          const readings: number[] = [];
          for (const step of steps) {
            nowMs += step + 1;
            readings.push(nowMs);
          }

          const values = readings.map((reading) => remainingSeconds(opensAtMs, reading, offsetMs));

          for (const value of values) {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
          }
          for (let i = 1; i < values.length; i += 1) {
            expect(values[i]).toBeLessThanOrEqual(values[i - 1]!);
          }
          for (let i = 0; i < readings.length; i += 1) {
            if (readings[i]! + offsetMs >= opensAtMs) {
              expect(values[i]).toBe(0);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("rounds up to whole seconds and stops at zero", () => {
    expect(remainingSeconds(30_000, 0, 0)).toBe(30);
    expect(remainingSeconds(30_000, 1, 0)).toBe(30);
    expect(remainingSeconds(30_000, 1_001, 0)).toBe(29);
    expect(remainingSeconds(30_000, 30_000, 0)).toBe(0);
    expect(remainingSeconds(30_000, 45_000, 0)).toBe(0);
  });

  it("applies the offset to the browser clock", () => {
    // Browser clock is 10 s behind the server: offset +10_000.
    expect(remainingSeconds(30_000, 0, 10_000)).toBe(20);
    expect(remainingSeconds(30_000, 20_000, 10_000)).toBe(0);
  });
});
