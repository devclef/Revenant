import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { sealReducer, type FallbackOrigin, type SealState } from "./seal-machine";

/**
 * Property 7 (spec 06 backup-only start and decline, design 3.1, R7.6, R8.1,
 * R8.5, R8.6): a backup-key fallback starts and declines by its origin.
 * A Seal_Step start always carries no passkey. A cannot_lock start keeps the
 * passkeyCreated flag. Declining a Seal_Step fallback returns to the form;
 * declining a cannot_lock fallback returns to cannot_lock with the same flag.
 */

const originArb = fc.constantFrom<FallbackOrigin>("cannot_lock", "seal_step");
const passkeyArb = fc.boolean();

describe("Property 7: backup-only start and decline follow the origin", () => {
  it("a Seal_Step start from write always enters fallback_key with no passkey", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(sealReducer({ tag: "write" }, { type: "SEAL_STEP_BACKUP_START" })).toEqual({
          tag: "fallback_key",
          origin: "seal_step",
          passkeyCreated: false,
        });
      }),
    );
  });

  it("a cannot_lock start keeps passkeyCreated and marks origin cannot_lock", () => {
    fc.assert(
      fc.property(passkeyArb, (passkeyCreated) => {
        const next = sealReducer(
          { tag: "cannot_lock", passkeyCreated },
          { type: "FALLBACK_START" },
        );
        expect(next).toEqual({ tag: "fallback_key", origin: "cannot_lock", passkeyCreated });
      }),
    );
  });

  it("declining returns to the form for seal_step and to cannot_lock for cannot_lock", () => {
    fc.assert(
      fc.property(originArb, passkeyArb, (origin, passkeyCreated) => {
        const state: SealState = { tag: "fallback_key", origin, passkeyCreated };
        const next = sealReducer(state, { type: "FALLBACK_DECLINE" });
        if (origin === "seal_step") {
          expect(next).toEqual({ tag: "write" });
        } else {
          expect(next).toEqual({ tag: "cannot_lock", passkeyCreated });
        }
      }),
    );
  });

  it("a Seal_Step decline never reaches cannot_lock, whatever the passkey flag", () => {
    fc.assert(
      fc.property(passkeyArb, (passkeyCreated) => {
        const next = sealReducer(
          { tag: "fallback_key", origin: "seal_step", passkeyCreated },
          { type: "FALLBACK_DECLINE" },
        );
        expect(next.tag).toBe("write");
      }),
    );
  });

  it("SEAL_STEP_BACKUP_START is ignored in every state except write", () => {
    const otherStates: SealState[] = [
      { tag: "creating" },
      { tag: "created" },
      { tag: "confirming" },
      { tag: "preparing" },
      { tag: "sealing" },
      { tag: "cancelled" },
      { tag: "failed", kind: "network", passkeyCreated: false },
      { tag: "cannot_lock", passkeyCreated: true },
      { tag: "fallback_key", origin: "cannot_lock", passkeyCreated: true },
      { tag: "fallback_key", origin: "seal_step", passkeyCreated: false },
    ];
    fc.assert(
      fc.property(fc.constantFrom(...otherStates), (state) => {
        expect(sealReducer(state, { type: "SEAL_STEP_BACKUP_START" })).toBe(state);
      }),
    );
  });
});
