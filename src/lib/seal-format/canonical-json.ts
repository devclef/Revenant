// Canonical JSON (RFC 8785, JCS) for the sealed-letter envelope hash.
//
// The envelope is serialised to canonical JSON and hashed with SHA-256, so the
// same logical value must always produce byte-for-byte identical output. The
// rules we rely on:
//   - object members are sorted by their keys' UTF-16 code units (the default
//     lexicographic order of JS string comparison, which JCS specifies),
//   - arrays keep their given order,
//   - strings and numbers are serialised by JSON.stringify.
//
// Only JSON-representable values are allowed. NaN, +/-Infinity, undefined,
// functions, symbols and BigInt have no canonical JSON form, so they are
// rejected at any depth rather than silently dropped or coerced, which would
// let two distinct inputs hash the same.
//
// This module imports nothing from src/lib/crypto or src/lib/db. It is pure and
// safe to import from either the browser or the server.

function write(value: unknown, out: string[]): void {
  if (value === null) {
    out.push("null");
    return;
  }

  const t = typeof value;

  if (t === "string") {
    out.push(JSON.stringify(value));
    return;
  }

  if (t === "boolean") {
    out.push(value ? "true" : "false");
    return;
  }

  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new TypeError("value is not representable in JSON");
    }
    out.push(JSON.stringify(value));
    return;
  }

  if (Array.isArray(value)) {
    out.push("[");
    for (let i = 0; i < value.length; i++) {
      if (i > 0) out.push(",");
      write(value[i], out);
    }
    out.push("]");
    return;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    out.push("{");
    let first = true;
    for (const key of keys) {
      if (!first) out.push(",");
      first = false;
      out.push(JSON.stringify(key), ":");
      write(obj[key], out);
    }
    out.push("}");
    return;
  }

  // undefined, function, symbol, bigint: no canonical JSON form.
  throw new TypeError("value is not representable in JSON");
}

/** Serialise `value` to canonical JSON (RFC 8785 / JCS). */
export function canonicalize(value: unknown): string {
  const out: string[] = [];
  write(value, out);
  return out.join("");
}
