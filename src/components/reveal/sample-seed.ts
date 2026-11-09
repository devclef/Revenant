// The seed for one visit's Sample_Pick (spec 10 design.md, "C5. Sample
// answers"; requirements C5.4, C5.6).
//
// The seed comes only from the Web Crypto API. When `getRandomValues` is
// missing (a very old browser) this throws, and the caller treats that as "no
// seed": the opening flow then starts with empty answer fields. The seed is
// never replaced by a weaker source.
//
// Pure apart from the Web Crypto call: no clock, no storage, no logging.

/**
 * Draw one 32-bit seed from `crypto.getRandomValues`. Throws when the Web
 * Crypto API is not available, so the caller can fall back to no samples.
 */
export function drawSampleSeed(): number {
  const webCrypto: Partial<Pick<Crypto, "getRandomValues">> | undefined =
    globalThis.crypto;
  if (
    webCrypto === undefined ||
    typeof webCrypto.getRandomValues !== "function"
  ) {
    throw new Error("Web Crypto getRandomValues is not available");
  }
  const values = new Uint32Array(1);
  webCrypto.getRandomValues(values);
  const seed = values[0];
  if (seed === undefined) {
    throw new Error("Web Crypto getRandomValues returned no value");
  }
  return seed;
}
