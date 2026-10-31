# Implementation Plan: 02 Sealed letters

Each task is one GitHub issue, worked by one agent, and leaves `main` passing the CI gate. Validation always includes the CI gate; commands below are what the agent must run locally first.

- [x] 1. Seal format: payload v1, header v1, canonical JSON and envelope hash
  - Agent: `crypto-dev` · Depends on: none
  - Before this task: the owner has committed the RFC 8785 fixture files.
  - Scope: `src/lib/seal-format/**` (`base64url.ts`, `canonical-json.ts`, `hash.ts`, `registry.ts`, `index.ts`, `v1/payload.ts`, `v1/header.ts`, `*.test.ts`, `__fixtures__/golden-v1-envelope.json`), `package.json`, `package-lock.json` (zod, fast-check). Reads but does not create `__fixtures__/rfc8785/**`.
  - Acceptance:
    - `zod` (v4) added as a runtime dependency and `fast-check` as a dev dependency, both pinned exactly.
    - Payload v1 per design.md Data Models: strict objects, optional `written_as_of` (real `YYYY-MM-DD` date), figures as a discriminated union on `kind`, recall questions as a discriminated union on `answer_type` (`number` requires `metric_id`), cross-reference and uniqueness checks. `v1/payload.ts` also exports `figureV1Schema` and `metricDefinitionV1Schema` with the types `FigureV1` and `MetricDefinitionV1` (the same schema objects `payloadV1Schema` uses), re-exported from `index.ts`. Payload v1 is frozen after this task; later changes are format version 2.
    - Header v1 per design.md: strict, millisecond `Z` timestamps, wraps sorted by factor and unique, `rpId`/`credentialId`/`prfSalt` present if and only if a passkey wrap exists, with the fixed limits (lowercase hostname 1–253 chars, `credentialId` 1–1,023 bytes, `prfSalt` 32 bytes).
    - `parseEnvelope`/`parsePayload` select the schema by version; unknown version returns `unsupported_format`, schema failure returns `invalid` with the first failing field path.
    - base64url is unpadded and strict (rejects padding, other characters, non-zero trailing bits); `isLetterId` matches 16-byte IDs only.
    - `canonicalize` is in-repo, throws on `NaN`, `±Infinity`, `undefined`, functions, symbols and `BigInt` at any depth, and passes the RFC 8785 vectors read from the committed `src/lib/seal-format/__fixtures__/rfc8785/input/*.json` and `output/*.json` (arrays, structures, unicode, values, weird). The test does not download anything (no network access). A missing fixture fails the test naming the file; it never skips.
    - `envelopeHash` is SHA-256 of the canonical envelope as 64 lowercase hex. The golden v1 envelope fixture is created and its hash asserted.
    - Properties 1–6 as fast-check tests, `numRuns: 100`, tagged `// Feature: 02-sealed-letters, Property N: <title>`.
    - `seal-format` imports nothing from `src/lib/crypto` or `src/lib/db`.
  - Validation: `bash scripts/check.sh` (`npm ci && npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.1–R1.14, R2.1–R2.10_

- [x] 2. Crypto: backup key, demo key, seal, open and opening records
  - Agent: `crypto-dev` · Depends on: 1
  - Scope: `src/lib/crypto/**` (`backup-key.ts`, `demo-key.ts`, `kdf.ts`, `seal.ts`, `open.ts`, `opening-records.ts`, `errors.ts`, `index.ts`, `*.test.ts`, `import-boundary.test.ts`)
  - Acceptance:
    - WebCrypto (`globalThis.crypto`) only; no third-party crypto library.
    - Backup key: 26 Crockford Base32 digits plus one GF(32) check digit (x⁵ + x² + 1, α = x) per design.md, displayed in hyphenated groups of four. Parsing uppercases, strips hyphens and spaces, maps `I`/`L` to `1` and `O` to `0`, and returns `mistyped_key` on wrong length, bad character, first digit above 7 or bad checksum.
    - `PUBLIC_DEMO_BACKUP_KEY` is a committed string literal whose name and comment say it is public and for demo letters only; a test asserts it parses.
    - `sealLetter` checks lengths (letter ID 16 bytes, server secret 32 bytes) and rejects `written_as_of` later than the UTC date of `sealedAt` with `invalid_input` before any key derivation. KEK, wrap AAD, payload AAD and fresh nonces per design.md.
    - `openLetter` runs hash check → unwrap → decrypt → parse, returning the `OpenError` union (`verification_failed`, `wrong_key`, `tampered`, `unsupported_format`, `invalid_payload`, `invalid_input`) and no payload or DEK on failure. Error messages are fixed strings.
    - Opening records key and `encryptOpeningRecord`/`decryptOpeningRecord` per design.md.
    - KAT for `KEK_backup` checked against `node:crypto.hkdfSync` inside the test.
    - `import-boundary.test.ts` walks imports from `src/app/api/`, `src/lib/db/` and `src/lib/letter-store/` transitively and fails if any reaches `src/lib/crypto/`.
    - Properties 7–15 and 20 as fast-check tests, `numRuns: 100` (Property 15: 25).
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.4, R1.10, R1.11, R1.13, R3.1–R3.16_

- [x] 3. Migration, Drizzle schema and the persona store function
  - Agent: `crypto-dev` · Depends on: 1
  - Before this task: the owner has added the CI Postgres service and `DATABASE_URL` to the `checks` job, changed `drizzle.config.ts` `schema` to `./src/lib/db/schema/*.ts`, and added `src/lib/letter-store/**` and `src/test/integration/**` to crypto-dev in `.github/agents.json`.
  - Scope: `src/lib/db/schema/letters.ts`, `drizzle/0000_sealed_letters.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json`, `src/lib/letter-store/store.ts`, `src/lib/letter-store/store.test.ts`, `src/test/integration/setup.ts`, `src/test/integration/schema.test.ts`
  - Acceptance:
    - One migration `0000_sealed_letters.sql` generated by `npx drizzle-kit generate --name sealed_letters`, with the trigger SQL appended by hand after `--> statement-breakpoint`. It creates `letters`, `demo_letters` and `openings` only.
    - Column types and CHECKs per design.md: letter ID regex, 32-byte `server_secret`, lowercase 64-hex `envelope_hash`, envelope as canonical `text`, `timestamptz` times, `letters` 3-month CHECK computed in UTC, `demo_letters.kind IN ('persona')`, `openings` ciphertext 1–65,536 bytes, 12-byte nonce, `opened_at DEFAULT now()`, `num_nonnulls(letter_id, demo_letter_id) = 1`, an index on each FK column.
    - Row-level `BEFORE UPDATE OR DELETE` and statement-level `BEFORE TRUNCATE` triggers on all three tables, each raising an exception.
    - Running migrate twice applies nothing the second time and exits 0.
    - `storePersonaLetter` validates the envelope, checks the 32-byte secret, recomputes the hash, checks the ID is absent from both tables and inserts into `demo_letters` as `persona` in one transaction. Failures throw `LetterStoreError` with `check: "envelope" | "server_secret" | "hash_mismatch" | "duplicate_id"` and a fixed message. Past `opens_at` is accepted.
    - Property 19 as a fast-check test, `numRuns: 100`.
    - `setup.ts` exports `describeDb`: skips with a "needs Postgres" message unless `DATABASE_URL` is set and its database name contains `test`; fails instead of skipping when `CI` is set; runs the drizzle migrator in `beforeAll`.
    - `schema.test.ts` covers R4.2–R4.9 and R5 with fresh random IDs.
    - No new environment variable; the Helm chart is unchanged.
  - Validation: `docker run -d -e POSTGRES_PASSWORD=test -e POSTGRES_DB=revenant_test -p 5432:5432 postgres:17-alpine`, then with `DATABASE_URL=postgres://postgres:test@localhost:5432/revenant_test` run `npm run db:migrate` twice, `npm test`, and `bash scripts/check.sh`
  - _Requirements: R4.1–R4.11, R5.1–R5.3, R8.4, R8.5_

- [x] 4. Routes: read a letter, release its server secret, record recall answers
  - Agent: `crypto-dev` · Depends on: 3
  - Scope: `src/app/api/letters/[id]/route.ts` and `route.test.ts`, `src/app/api/letters/[id]/secret/route.ts` and `route.test.ts`, `src/app/api/openings/route.ts` and `route.test.ts`, `src/lib/letter-store/queries.ts`, `clock.ts`, `http.ts` and their tests, `src/lib/letter-store/no-console.test.ts`
  - Acceptance:
    - `GET /api/letters/[id]`, `GET /api/letters/[id]/secret` and `POST /api/openings` return exactly the statuses and bodies in the design.md Routes tables, with checks in the listed order.
    - Malformed and unknown IDs return byte-identical 404 bodies and headers on all three routes.
    - `Cache-Control: no-store` on every response, errors included.
    - `findLetter` reads the row and the database `now()` in the same parameterised statement; routes decide with the pure `isOpenable` (equal counts as open). No client time value is read.
    - Size limits: 413 for `Content-Length` or body text over 100,000 characters, and for ciphertext decoding to more than 65,536 bytes (65,536 accepted).
    - Zod failures return 400 naming the field from the issue path, without echoing values; unknown keys such as `openedAt` are stripped.
    - Any thrown error returns the fixed 500 `{"error":"internal"}`; errors are dropped, not logged or chained.
    - No `console.*` in route or `letter-store` files, enforced by `no-console.test.ts`.
    - R8.6 leak tests: known secret, envelope ciphertext and answer ciphertext; one validation failure and one mocked database failure; neither captured console output nor response bodies contain them.
    - Properties 16–18 as fast-check tests, `numRuns: 100`.
    - Routes and `letter-store` do not import `src/lib/crypto` (the task 2 import-boundary test finds all three route files).
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R3.2, R6.1–R6.10, R7.1–R7.7, R8.1–R8.6_

- [x] 5. End-to-end test: seal, store, open, record answers, prove immutability
  - Agent: `crypto-dev` · Depends on: 2, 4
  - Scope: `src/test/integration/sealed-letters.test.ts`
  - Acceptance:
    - Seals a v1 payload with a test backup key generated in the test, stores it via `storePersonaLetter` with a past `opensAt`, reads it via the route handlers' exported `GET`, fetches the server secret, verifies the hash, decrypts, and asserts the payload deep-equals the original.
    - A second persona letter with a future `opensAt` returns only `status`, `opensAt` and `demo`; the secret route returns 403 with no secret; `POST /api/openings` returns 403 and stores nothing.
    - Recording answers for the openable letter returns 201, exactly one new `openings` row exists for it, and decrypting the stored answers with the opening records key returns the original answers.
    - `UPDATE` and `DELETE` on a `letters`, a `demo_letters` and an `openings` row each raise, and each row re-read afterwards equals the row read before.
    - Direct parameterised inserts into `letters` reject `opens_at` less than 3 months after `sealed_at` and accept exactly 3 months.
    - Fresh random IDs each run; no dependence on earlier rows; passes twice in a row against the same database.
    - Uses `describeDb` from `setup.ts` (skip without a test database, fail in CI if it would skip); finishes within 60 s.
  - Validation: CI gate with Postgres, plus locally with `DATABASE_URL=postgres://postgres:test@localhost:5432/revenant_test`: `npm test` twice in a row and `bash scripts/check.sh`
  - _Requirements: R9.1–R9.9_

## Task Dependency Graph

Dependencies: 1 → 2, 1 → 3, 3 → 4, 2 → 5, 4 → 5. Tasks 2 and 3 can run in parallel once task 1 is merged.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4"] },
    { "id": 3, "tasks": ["5"] }
  ]
}
```
