// The sealing flow without React (spec 06-lock-and-unlock, R15.1, design.md
// "Seal_Page" and "Sealing sequence"). No React, no storage, no console.
//
// Two presses start two passkey prompts. Each press is its own function, and
// each calls the crypto module as the first async operation of its click
// (pressCreate and pressConfirm have no await of their own). sealWithPasskey
// runs only after both prompts have passed: prepare, times, payload, seal,
// post, then the secrets are zeroed.
//
// The crypto barrel is never imported here; the browser module arrives through
// SealDeps, typed by crypto-module.ts.

import { decodeBase64url, type PayloadV1 } from "@/lib/seal-format";
import type { LoadedFigures } from "@/lib/figures";
import type { CryptoModule } from "./crypto-module";
import type { SealApi } from "./api";
import { computeSealTimes } from "./clock";
import { buildLivePayload } from "./build-payload";
import type { SealEvent, SealFailureKind } from "./seal-machine";

/** The browser port type, taken from the crypto module's own signature. */
export type AuthenticatorPort = Parameters<CryptoModule["createPasskey"]>[0];

export interface SealDeps {
  crypto: CryptoModule;
  port: AuthenticatorPort;
  api: SealApi;
  rpId: string;
  /** Browser clock in milliseconds. Only the offset from the server clock uses it. */
  now: () => number;
}

/** What the Create_Press keeps: the passkey's ID, salt and create-time PRF. */
export interface Created {
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  createdPrf: Uint8Array | null;
}

/** What the Confirm_Press keeps: the PRF output for the seal, zeroed after use. */
export interface Confirmed {
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  prfOutput: Uint8Array;
}

/** The letter the judge wrote and the figures picked. Held in memory only. */
export interface SealDraft {
  text: string;
  metricIds: readonly string[];
  figures: LoadedFigures;
}

export type SealedEvent = Extract<SealEvent, { type: "SEALED" }>;
export type FailureEvent = Extract<SealEvent, { type: "CANCELLED" | "CANNOT_LOCK" | "FAILED" }>;

export type CreateStep = { ok: true; created: Created } | { ok: false; event: FailureEvent };
export type ConfirmStep = { ok: true; confirmed: Confirmed } | { ok: false; event: FailureEvent };
export type SealOutcome = { ok: true; event: SealedEvent } | { ok: false; event: FailureEvent };

type CreateResult = Awaited<ReturnType<CryptoModule["createPasskey"]>>;
type ConfirmResult = Awaited<ReturnType<CryptoModule["confirmPasskey"]>>;

function failure(kind: SealFailureKind, passkeyCreated: boolean, metricId?: string): FailureEvent {
  return {
    type: "FAILED",
    kind,
    passkeyCreated,
    ...(metricId !== undefined ? { metricId } : {}),
  };
}

function mapCreate(result: CreateResult): CreateStep {
  if (result.ok) {
    return {
      ok: true,
      created: {
        credentialId: result.credentialId,
        prfSalt: result.prfSalt,
        createdPrf: result.createdPrf,
      },
    };
  }
  if (result.reason === "cancelled") return { ok: false, event: { type: "CANCELLED" } };
  // Nothing was created, so the passkey flag is false.
  return { ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: false } };
}

function mapConfirm(result: ConfirmResult): ConfirmStep {
  if (result.ok) {
    return {
      ok: true,
      confirmed: {
        credentialId: result.credentialId,
        prfSalt: result.prfSalt,
        prfOutput: result.prfOutput,
      },
    };
  }
  if (result.reason === "cancelled") return { ok: false, event: { type: "CANCELLED" } };
  // The create prompt already succeeded, so a passkey exists on the device.
  return { ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: true } };
}

/**
 * The Create_Press. Calls `createPasskey` synchronously, so the passkey prompt
 * is the first async operation of the click (R15.1 step 1).
 */
export function pressCreate(deps: SealDeps): Promise<CreateStep> {
  return deps.crypto.createPasskey(deps.port, { rpId: deps.rpId }).then(mapCreate);
}

/**
 * The Confirm_Press. Calls `confirmPasskey` synchronously, so the second prompt
 * is the first async operation of the click (R15.1 step 2).
 */
export function pressConfirm(deps: SealDeps, created: Created): Promise<ConfirmStep> {
  return deps.crypto
    .confirmPasskey(deps.port, {
      rpId: deps.rpId,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      createdPrf: created.createdPrf,
    })
    .then(mapConfirm);
}

export interface SealRunInput {
  draft: SealDraft;
  confirmed: Confirmed;
  /**
   * Called once the Prepare_Route has answered, so the reducer can move from
   * `preparing` to `sealing`.
   */
  onPrepared?: () => void;
  /**
   * The backup key for the Backup_Wrap. Unused until the Backup_Fallback task
   * lands; the passkey-only flow never reads it.
   */
  backupKey?: Uint8Array;
}

function decodeOrNull(value: string): Uint8Array | null {
  try {
    return decodeBase64url(value);
  } catch {
    return null;
  }
}

/**
 * R15.1 steps 3 to 8, in order, stopping at the first failure. Steps 1 and 2
 * (the two prompts) have already passed when this runs.
 */
export async function sealWithPasskey(deps: SealDeps, input: SealRunInput): Promise<SealOutcome> {
  const { confirmed, draft } = input;
  const prfOutput = confirmed.prfOutput;
  let serverSecret: Uint8Array | null = null;

  try {
    // Step 3: the first request of the flow. Nothing is sent before this.
    const prepared = await deps.api.prepare();
    const arrivedMs = deps.now();
    if (!prepared.ok) {
      const kind: SealFailureKind = prepared.kind === "busy" ? "busy" : prepared.kind === "network" ? "network" : "server";
      return { ok: false, event: failure(kind, true) };
    }
    input.onPrepared?.();

    const letterId = decodeOrNull(prepared.letterId);
    serverSecret = decodeOrNull(prepared.serverSecret);
    if (letterId === null || serverSecret === null) {
      return { ok: false, event: failure("server", true) };
    }

    // Step 4: sealedAt and opensAt from the server clock and the offset.
    const times = computeSealTimes({
      serverNow: prepared.serverNow,
      arrivedMs,
      nowMs: deps.now(),
    });

    // Step 5: the payload. A missing "then" figure stops the seal (R13.5).
    const built = buildLivePayload({
      text: draft.text,
      metricIds: draft.metricIds,
      sealedDate: times.sealedAt.slice(0, 10),
      figures: draft.figures,
    });
    if (!built.ok) {
      return { ok: false, event: failure("missing_then", true, built.metricId) };
    }
    const payload: PayloadV1 = built.payload;

    // Step 6: seal. The wrap check (R8.5) runs inside sealLetter.
    let sealed: Awaited<ReturnType<CryptoModule["sealLetter"]>>;
    try {
      sealed = await deps.crypto.sealLetter({
        payload,
        letterId,
        serverSecret,
        passkey: {
          prfOutput,
          credentialId: confirmed.credentialId,
          prfSalt: confirmed.prfSalt,
          rpId: deps.rpId,
        },
        sealedAt: times.sealedAt,
        opensAt: times.opensAt,
      });
    } catch (error) {
      if (error instanceof deps.crypto.SealError && error.error.kind === "wrap_failed") {
        return { ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: true } };
      }
      return { ok: false, event: failure("server", true) };
    }

    // Step 7: post the envelope.
    const posted = await deps.api.seal({
      letterId: prepared.letterId,
      envelope: sealed.envelope,
      envelopeHash: sealed.envelopeHash,
    });
    if (!posted.ok) {
      const kind: SealFailureKind =
        posted.kind === "busy"
          ? "busy"
          : posted.kind === "clock"
            ? "clock"
            : posted.kind === "network"
              ? "network"
              : "server";
      return { ok: false, event: failure(kind, true) };
    }

    return {
      ok: true,
      event: {
        type: "SEALED",
        letterId: posted.letterId,
        sealedAt: posted.sealedAt,
        opensAt: posted.opensAt,
        offsetMs: times.offsetMs,
        factors: "passkey",
      },
    };
  } finally {
    // Step 8: discard the time-lock secret and the PRF output. The crypto module
    // zeroes its own copy; these are the caller's copies.
    serverSecret?.fill(0);
    prfOutput.fill(0);
  }
}
