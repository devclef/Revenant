// Feature: 10-own-questions (C1.10)
//
// The passkey press is the first asynchronous call of the unlock gesture. The
// WebAuthn prompt must open inside the click, so nothing before the port's
// `get` may await. `startPasskeyAssertion` is already tested to call the port
// synchronously (live/unlock.test.ts); this test pins the press that calls it.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "useOpeningFlow.ts"), "utf8");

/** The text of `passkeyUnlock`, from its declaration to the backup key field. */
function passkeyPress(): string {
  const start = source.indexOf("const passkeyUnlock = useCallback(");
  const end = source.indexOf("// Backup key field", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("the passkey press (C1.10)", () => {
  it("calls startPasskeyAssertion before any await in the press", () => {
    const press = passkeyPress();
    const call = press.indexOf("startPasskeyAssertion(");
    expect(call).toBeGreaterThan(-1);
    expect(press.slice(0, call)).not.toMatch(/\bawait\b/);
  });

  it("does not await anything in the press at all", () => {
    expect(passkeyPress()).not.toMatch(/\bawait\b/);
  });

  it("only moves on to UNLOCK after the assertion resolves, with no second press", () => {
    const press = passkeyPress();
    expect(press).toContain("safeDispatch({ type: \"UNLOCK\" })");
    expect(press.indexOf("startPasskeyAssertion(")).toBeLessThan(press.indexOf(".then("));
  });
});
