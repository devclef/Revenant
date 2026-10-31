// Public API of the sealed-letter format.
//
// This barrel re-exports everything a caller should use to encode, hash, parse
// and validate a sealed envelope and its payload. Import from here rather than
// reaching into individual modules, so the surface stays stable as internal
// files move.
//
// This module imports nothing from src/lib/crypto or src/lib/db. The whole
// seal-format library is pure and safe to import from either the browser or the
// server.

// Unpadded base64url codec and letter-ID check.
export { encodeBase64url, decodeBase64url, isLetterId } from "./base64url";

// Canonical JSON (RFC 8785 / JCS).
export { canonicalize } from "./canonical-json";

// SHA-256 envelope hash.
export { envelopeHash } from "./hash";

// Version registry and safe parsers.
export {
  formats,
  parseEnvelope,
  parsePayload,
  type ParseResult,
} from "./registry";

// Payload v1 schema and type, plus the single-figure and single-metric schemas
// it is built from.
export {
  payloadV1Schema,
  figureV1Schema,
  metricDefinitionV1Schema,
  type PayloadV1,
  type FigureV1,
  type MetricDefinitionV1,
} from "./v1/payload";

// Header v1 schema, type and the hash-input helper.
export {
  headerV1Schema,
  headerWithoutCiphertext,
  type EnvelopeV1,
} from "./v1/header";
