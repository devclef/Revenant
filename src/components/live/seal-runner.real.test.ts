import { describe, expect, it, vi } from "vitest";

import { opensAtFor } from "@/lib/seal-format";

import type { PrepareResult, SealApi, SealPostResult } from "./api";
import { REAL_COPY } from "./copy";
import { pressCreate, sealWithPasskey, type SealDeps } from "./seal-runner";

const NOW = Date.parse("2026-11-06T12:00:00.000Z");
const TZ = "Europe/Stockholm";
const EMPTY_FIGURES = { fixture: false, series: new Map() };

const b64 = (bytes: number[]) => Buffer.from(Uint8Array.from(bytes)).toString("base64url");

function makeDeps(api: SealApi, overrides: Partial<Record<string, unknown>> = {}) {
  const sealLetter = vi.fn(async () => ({
    envelope: {},
    envelopeHash: "a".repeat(64),
  }));
  const createPasskey = vi.fn(async () => ({
    ok: true as const,
    credentialId: new Uint8Array([1]),
    prfSalt: new Uint8Array([2]),
    createdPrf: null,
  }));
  class SealError extends Error {
    error = { kind: "wrap_failed" as const };
  }
  const crypto = {
    sealLetter,
    createPasskey,
    SealError,
    ...overrides,
  };
  const deps = {
    crypto: crypto as unknown as SealDeps["crypto"],
    port: {} as SealDeps["port"],
    api,
    rpId: "revenant.devclef.se",
    now: () => NOW,
  } satisfies SealDeps;
  return { deps, sealLetter, createPasskey };
}

const confirmed = {
  credentialId: new Uint8Array([1]),
  prfSalt: new Uint8Array([2]),
  prfOutput: new Uint8Array(32).fill(7),
};

function prepareOk(): PrepareResult {
  return {
    ok: true,
    letterId: b64(new Array(16).fill(3)),
    serverSecret: b64(new Array(32).fill(4)),
    serverNow: new Date(NOW).toISOString(),
  };
}

function realDraft(opensOn: string | null) {
  return {
    text: "A letter to keep.",
    metricIds: [],
    figures: EMPTY_FIGURES,
    real: { opensOn, timeZone: TZ },
  };
}

describe("real mode: the date is checked before any request", () => {
  it("refuses a too-early date with no request, and keeps the draft", async () => {
    const api = { prepare: vi.fn(async () => prepareOk()), seal: vi.fn() };
    const { deps, sealLetter } = makeDeps(api);
    const draft = realDraft("2026-11-10");

    const outcome = await sealWithPasskey(deps, { draft, confirmed });

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.event).toEqual({ type: "FAILED", kind: "too_early", passkeyCreated: true });
    expect(api.prepare).not.toHaveBeenCalled();
    expect(sealLetter).not.toHaveBeenCalled();
    // The draft is the visitor's own; the runner does not change it.
    expect(draft.text).toBe("A letter to keep.");
  });

  it("refuses a missing date as invalid, with no request", async () => {
    const api = { prepare: vi.fn(async () => prepareOk()), seal: vi.fn() };
    const { deps } = makeDeps(api);
    const outcome = await sealWithPasskey(deps, { draft: realDraft(null), confirmed });
    expect(outcome).toMatchObject({ ok: false, event: { kind: "invalid_date" } });
    expect(api.prepare).not.toHaveBeenCalled();
  });
});

describe("real mode: opensAt is the picked date, not the 30-second lock", () => {
  it("seals with opensAt at 00:00 of the picked date and a sealed time from the server clock", async () => {
    const api: SealApi = {
      prepare: vi.fn(async () => prepareOk()),
      seal: vi.fn(async (body) => ({
        ok: true as const,
        letterId: body.letterId,
        sealedAt: new Date(NOW).toISOString(),
        opensAt: opensAtFor("2027-05-12", TZ),
        envelopeHash: "a".repeat(64),
      })),
    };
    const { deps, sealLetter } = makeDeps(api);

    const outcome = await sealWithPasskey(deps, { draft: realDraft("2027-05-12"), confirmed });

    expect(outcome.ok).toBe(true);
    expect(sealLetter).toHaveBeenCalledWith(
      expect.objectContaining({ opensAt: opensAtFor("2027-05-12", TZ) }),
    );
  });

  it("maps a 422 from the seal route to too_early and keeps the draft", async () => {
    const posted: SealPostResult = { ok: false, kind: "clock" };
    const api: SealApi = { prepare: vi.fn(async () => prepareOk()), seal: vi.fn(async () => posted) };
    const { deps } = makeDeps(api);
    const outcome = await sealWithPasskey(deps, { draft: realDraft("2027-05-12"), confirmed });
    expect(outcome).toMatchObject({ ok: false, event: { type: "FAILED", kind: "too_early" } });
  });

  it("maps a 400 from the seal route to invalid_date", async () => {
    const posted: SealPostResult = { ok: false, kind: "invalid" };
    const api: SealApi = { prepare: vi.fn(async () => prepareOk()), seal: vi.fn(async () => posted) };
    const { deps } = makeDeps(api);
    const outcome = await sealWithPasskey(deps, { draft: realDraft("2027-05-12"), confirmed });
    expect(outcome).toMatchObject({ ok: false, event: { type: "FAILED", kind: "invalid_date" } });
  });

  it("a failed seal reports no SEALED event, so no keepsake can be made", async () => {
    const api: SealApi = {
      prepare: vi.fn(async () => prepareOk()),
      seal: vi.fn(async () => ({ ok: false as const, kind: "network" as const })),
    };
    const { deps } = makeDeps(api);
    const outcome = await sealWithPasskey(deps, { draft: realDraft("2027-05-12"), confirmed });
    expect(outcome.ok).toBe(false);
    expect(outcome.event.type).toBe("FAILED");
  });
});

describe("the passkey name", () => {
  const unused: SealApi = { prepare: vi.fn(), seal: vi.fn() };

  it("names the passkey for the opening date when a user name is given (real mode)", async () => {
    const { deps, createPasskey } = makeDeps(unused);
    await pressCreate(deps, REAL_COPY.passkeyUserName.replace("{date}", "12 May 2027"));
    expect(createPasskey).toHaveBeenCalledWith(deps.port, {
      rpId: "revenant.devclef.se",
      userName: "Revenant letter · opens 12 May 2027",
    });
  });

  it("passes no user name in demo mode, so the default name is kept", async () => {
    const { deps, createPasskey } = makeDeps(unused);
    await pressCreate(deps);
    expect(createPasskey).toHaveBeenCalledWith(deps.port, { rpId: "revenant.devclef.se" });
  });
});
