// Sealed-letter format registry: version -> {payload, header} schemas, plus the
// two safe parsers used everywhere a stored envelope or payload is read back.
//
// Opening code must support EVERY format version ever sealed. A new version is
// a new entry in `formats` with its own frozen schema module; the meaning of an
// existing version never changes. See crypto.md and design.md.
//
// `parseEnvelope` peeks at the header's `formatVersion`; `parsePayload` at the
// payload's `format_version`. Both reject an input whose version is not a
// positive integer, or not a version we know, with `unsupported_format`, before
// the schema runs. A known version that fails its schema returns `invalid` with
// the first failing Zod issue path.
//
// This module imports only the v1 schema modules. It imports nothing from
// src/lib/crypto or src/lib/db; it is pure and safe to import from either the
// browser or the server.

import type { z } from "zod";
import { payloadV1Schema, type PayloadV1 } from "./v1/payload";
import { headerV1Schema, type EnvelopeV1 } from "./v1/header";

// The registry. Add a new version as a new numeric key with its own schema
// module; never change an existing entry's meaning.
export const formats = {
  1: { payload: payloadV1Schema, header: headerV1Schema },
} as const;

type FormatVersion = keyof typeof formats;

// Result of a parse: either a typed value, or a reason it was rejected.
// `unsupported_format` means the version is missing, not a positive integer, or
// not in the registry. `invalid` means the version is known but the schema
// rejected the value; `field` is the first failing issue path joined with '.'.
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: "unsupported_format" }
  | { ok: false; error: "invalid"; field: string };

// A positive integer we can use to index `formats`. Rejects non-numbers, NaN,
// Infinity, zero, negatives and non-integers.
function knownVersion(v: unknown): FormatVersion | undefined {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    return undefined;
  }
  return (v in formats ? (v as FormatVersion) : undefined);
}

// The version field of an unparsed object, read without assuming the input is
// even an object. Returns undefined for anything that is not a plain record.
function peek(json: unknown, key: string): unknown {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return undefined;
  }
  return (json as Record<string, unknown>)[key];
}

// Run a schema and shape its outcome into a ParseResult. On failure, the first
// Zod issue's path is joined with '.' so the caller gets one stable field name.
function run<S extends z.ZodType>(
  schema: S,
  json: unknown,
): ParseResult<z.infer<S>> {
  const result = schema.safeParse(json);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const first = result.error.issues[0];
  const field = first ? first.path.join(".") : "";
  return { ok: false, error: "invalid", field };
}

/**
 * Parse a stored envelope (header + ciphertext). Selects the schema by the
 * header's `formatVersion`. Unknown or non-positive-integer version ->
 * `unsupported_format`. Known version, bad shape -> `invalid` with `field`.
 */
export function parseEnvelope(json: unknown): ParseResult<EnvelopeV1> {
  const version = knownVersion(peek(json, "formatVersion"));
  if (version === undefined) {
    return { ok: false, error: "unsupported_format" };
  }
  return run(formats[version].header, json);
}

/**
 * Parse a decrypted payload. Selects the schema by the payload's
 * `format_version`. Unknown or non-positive-integer version ->
 * `unsupported_format`. Known version, bad shape -> `invalid` with `field`.
 */
export function parsePayload(json: unknown): ParseResult<PayloadV1> {
  const version = knownVersion(peek(json, "format_version"));
  if (version === undefined) {
    return { ok: false, error: "unsupported_format" };
  }
  return run(formats[version].payload, json);
}
