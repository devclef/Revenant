import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalize } from "./canonical-json";
import { envelopeHash } from "./hash";

const here = dirname(fileURLToPath(import.meta.url));

// The hand-authored, schema-valid golden v1 envelope (single backup wrap, no
// passkey fields). Reading it fails loudly naming the file if it is missing,
// rather than skipping: the golden vector must be visible, not silently passed.
function readGolden(): string {
  const path = join(here, "__fixtures__", "golden-v1-envelope.json");
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(
      `missing golden-v1-envelope.json at ${path}: ${String(err)}`,
    );
  }
}

const GOLDEN_JSON = readGolden();
const golden = JSON.parse(GOLDEN_JSON) as Record<string, unknown>;

// The pinned digest. If this value ever changes, either the fixture or the
// canonicalisation changed; both are deliberate, versioned decisions, so a
// change here must be reviewed, never adjusted to make the test pass.
const EXPECTED_HASH =
  "9f0e9c378d4425ad2a412cac9885a26ae827261d175fc24672e0f53f944ad824";

// Independent reference: SHA-256 over UTF-8(canonicalize(envelope)) using
// node:crypto rather than the WebCrypto path envelopeHash uses. If the two
// disagree, the pinned value is not trusted on envelopeHash's word alone.
function referenceHash(value: unknown): string {
  return createHash("sha256")
    .update(Buffer.from(canonicalize(value), "utf8"))
    .digest("hex");
}

describe("envelopeHash: golden v1 envelope", () => {
  it("returns a 64-character lowercase hex digest", async () => {
    const hash = await envelopeHash(golden);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the pinned expected digest", async () => {
    const hash = await envelopeHash(golden);
    expect(hash).toBe(EXPECTED_HASH);
  });

  it("agrees with an independent node:crypto SHA-256 over canonicalize", async () => {
    const hash = await envelopeHash(golden);
    expect(hash).toBe(referenceHash(golden));
    // And the independent computation itself lands on the pinned value.
    expect(referenceHash(golden)).toBe(EXPECTED_HASH);
  });

  it("is unchanged when object keys are reordered", async () => {
    // Rebuild the same envelope with members inserted in reverse key order.
    // Canonicalisation sorts keys, so the digest must not move.
    const reordered = reverseKeyOrder(golden);
    // Sanity: the serialisations differ before canonicalisation, so this is a
    // real reordering, not an identical object.
    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(golden));

    const hash = await envelopeHash(reordered);
    expect(hash).toBe(EXPECTED_HASH);
  });

  it("is unchanged under insignificant whitespace in the source JSON", async () => {
    // The fixture on disk is pretty-printed; re-serialise it compact (no
    // indentation or newlines). Parsing discards whitespace either way, so the
    // resulting value — and its digest — must be identical.
    const compact = JSON.stringify(golden);
    expect(compact).not.toBe(GOLDEN_JSON);

    const fromCompact = JSON.parse(compact) as unknown;
    const hash = await envelopeHash(fromCompact);
    expect(hash).toBe(EXPECTED_HASH);
  });
});

// Recursively rebuild a JSON value so every object's keys are inserted in the
// reverse of their natural sorted order. Arrays keep their order (canonical
// JSON preserves array order, so reordering them would change the value).
function reverseKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reverseKeyOrder);
  }
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort().reverse();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = reverseKeyOrder(obj[key]);
    }
    return out;
  }
  return value;
}
