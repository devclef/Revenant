"use client";

import { useEffect, useState } from "react";

/**
 * PRF_Hint (spec 08, design.md "PRF_Hint"; R16). An up-front, non-deciding
 * check of whether the browser reports WebAuthn PRF support through
 * `PublicKeyCredential.getClientCapabilities()`. It shows a message on the
 * Write step when support is reported missing. It blocks nothing: the PRF_Check
 * at sealing still decides alone (R16.5, R16.6).
 *
 * The probe sends no request and writes nothing to storage or the URL (R16.7).
 * It lives outside lib/crypto because it is a capability hint, not crypto.
 */

/** How long the capability call may take before the hint gives up (R16.3). */
export const PRF_HINT_TIMEOUT_MS = 2000;

/** `missing` only when the browser reports `extension:prf` as false. */
export type PrfHint = "missing" | "none";

/** The outcome of the one capability call. */
export type PrfProbe =
  | { kind: "unsupported" }
  | { kind: "rejected" }
  | { kind: "timeout" }
  | { kind: "resolved"; caps: Record<string, unknown> };

/**
 * Maps a probe outcome to the hint. `missing` exactly when the call resolved
 * and its `extension:prf` entry is the boolean false. Every other case is
 * `none` (R16.2, R16.3, R16.4).
 */
export function prfHintFrom(probe: PrfProbe): PrfHint {
  if (probe.kind !== "resolved") return "none";
  return probe.caps["extension:prf"] === false ? "missing" : "none";
}

type CapabilityApi = {
  getClientCapabilities?: () => Promise<Record<string, unknown> | null | undefined>;
};

/** Reads the capability call without ever throwing. */
async function readCapabilities(): Promise<PrfProbe> {
  const api = (globalThis as { PublicKeyCredential?: CapabilityApi })
    .PublicKeyCredential;
  if (!api || typeof api.getClientCapabilities !== "function") {
    return { kind: "unsupported" };
  }
  try {
    const caps = await api.getClientCapabilities();
    return { kind: "resolved", caps: caps ?? {} };
  } catch {
    return { kind: "rejected" };
  }
}

/**
 * Runs the one capability call, raced against PRF_HINT_TIMEOUT_MS. Resolves to
 * `timeout` when the call is still pending at the deadline. The timer is
 * cleared as soon as the call settles.
 */
export function probePrfCapabilities(): Promise<PrfProbe> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<PrfProbe>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "timeout" }), PRF_HINT_TIMEOUT_MS);
  });
  return Promise.race([readCapabilities(), deadline]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * The hint for this device. Starts as `none`, runs the probe once on mount, and
 * then holds the result. Until the probe settles the hint is `none`, so nothing
 * shows early and nothing blocks.
 */
export function usePrfHint(): PrfHint {
  const [hint, setHint] = useState<PrfHint>("none");

  useEffect(() => {
    let active = true;
    void probePrfCapabilities().then((probe) => {
      if (active) setHint(prfHintFrom(probe));
    });
    return () => {
      active = false;
    };
  }, []);

  return hint;
}
