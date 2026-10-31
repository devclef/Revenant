# Requirements Document

Spec: 02 Sealed letters

## Introduction

Letters can be sealed, stored, time-locked and opened. This spec delivers the sealed letter format, browser crypto with the published demo key, the first migration (`letters`, `demo_letters`, `openings`, immutability triggers), a server-side store function for persona letters, and the routes to read a letter's status or envelope, release its server secret after the opening date, and append encrypted recall answers. It is the foundation for the persona demo in spec 03. Follows `crypto.md`, `tech.md` and `data-integrity.md`.

## Out of scope

Passkeys and PRF, the backup key card, PDF and image cards, `.ics`, the fetch job, persona letter content and the persona sealing script itself, the `/demo` UI, the figures data file (separate data-dev spec), any route that seals a letter, and rate limiting. Live demo sealing (the `prepare` and `seal` routes, draft storage and the 30-second lock) moves to the passkey demo spec.

## Requirements

### R1. Sealed payload format

**User story:** As a future reader, I want a letter to carry everything it needs, so it opens and shows exactly what was sealed even if the app or a data source changes.

1. THE SYSTEM SHALL define the payload schema with Zod in `src/lib/seal-format/`, one module per `format_version`, starting with version `1`.
2. THE version 1 payload SHALL contain exactly these parts: `format_version`, the letter text, an optional `written_as_of` date, 0 to 50 tracked figures, 0 to 50 metric definitions as at sealing, and 0 to 20 recall questions. IF a payload contains a field the version 1 schema does not define, THEN THE SYSTEM SHALL reject the payload.
3. THE letter text SHALL be plain text of 1 to 5,000 Unicode code points, and SHALL contain at least one character that is not whitespace. IF the letter text is empty, whitespace only, or longer than 5,000 code points, THEN THE SYSTEM SHALL reject the payload.
4. WHERE a payload carries `written_as_of`, THE value SHALL be a calendar date string in the form `YYYY-MM-DD` that names a real date. IF `written_as_of` does not match that form or names a date that does not exist (for example `2024-02-30`), THEN THE SYSTEM SHALL reject the payload. IF `written_as_of` is later than the UTC calendar date of the header's `sealedAt`, THEN THE crypto module's seal function SHALL reject the seal and return no envelope, since the server cannot read the payload. `written_as_of` SHALL be stored only inside the encrypted payload, SHALL NOT appear in the envelope header, SHALL NOT replace or change `sealedAt`, and SHALL NOT be presented as the date the letter was sealed. Real letters omit it.
5. EACH figure SHALL carry `metric_id`, `value`, `unit`, `region`, `period`, `source`, `series_id`, `retrieved_at` and a `kind` of `official` or `self-reported`. `unit`, `region`, `period`, `source` and `series_id` SHALL each be strings of 1 to 200 characters. `retrieved_at` SHALL be an ISO 8601 timestamp in UTC with a `Z` suffix.
6. WHERE a figure's `kind` is `official`, THE figure SHALL carry a `source_url` that is an absolute `https` URL of at most 2,048 characters. WHERE a figure's `kind` is `self-reported`, THE figure's `source` SHALL be `self-reported`. IF either rule is broken, THEN THE SYSTEM SHALL reject the payload.
7. THE figure `value` SHALL be a decimal string exactly as published, at most 40 characters long, made of an optional leading minus sign, one or more digits, and an optional fractional part of a dot followed by one or more digits. IF a value is a JavaScript number, uses exponent notation, has a leading plus sign, thousands separators or surrounding whitespace, or does not match this form, THEN THE SYSTEM SHALL reject the payload.
8. EACH metric definition SHALL carry an ID that is unique within the payload, a display name, unit, region, source and series ID. EACH figure's `metric_id` SHALL match exactly one metric definition ID in the same payload. IF a figure references an ID that is not in the payload, or two metric definitions share an ID, THEN THE SYSTEM SHALL reject the payload.
9. EACH recall question SHALL carry an ID that is unique within the payload, its full question text of 1 to 500 characters, and an `answer_type` of `number` or `text`, and MAY carry a `metric_id` that references one metric definition ID in the same payload. WHERE a recall question's `answer_type` is `number`, THE question SHALL carry a `metric_id`, and the answer's unit and region SHALL be those of that metric definition. WHERE a recall question's `answer_type` is `text`, THE `metric_id` SHALL stay optional. IF a recall question has no `answer_type` or any value other than `number` or `text`, a `number` question has no `metric_id`, a `metric_id` references an ID that is not in the payload, or two recall questions share an ID, THEN THE SYSTEM SHALL reject the payload.
10. IF a payload fails its version's schema at sealing, THEN THE SYSTEM SHALL refuse to seal it, return an error naming the first failing field, and store nothing.
11. IF a decrypted payload fails its version's schema at opening, THEN THE SYSTEM SHALL report the payload as invalid and SHALL show no part of the letter text, figures or recall questions.
12. THE opening code SHALL select the schema by `format_version` and SHALL keep a schema for every version ever sealed.
13. IF the `format_version` of a payload at opening has no schema, THEN THE SYSTEM SHALL report the letter as unsupported and SHALL show no part of the payload.
14. FOR ALL valid version 1 payloads, both with and without `written_as_of`, serialising then parsing SHALL produce a payload that is deeply equal to the original, with every figure `value` string and any `written_as_of` string identical character for character (round trip).

### R2. Envelope header and hash

**User story:** As the operator, I want to store and time-lock a letter without learning what it contains.

1. THE envelope header SHALL contain `letterId`, `formatVersion`, `sealedAt`, `opensAt`, the payload nonce, the payload ciphertext, and one or two wrapped DEKs. Each wrapped DEK SHALL carry a factor name of `backup` or `passkey`, its nonce and the wrapped key, and there SHALL be at most one wrapped DEK per factor.
2. THE header SHALL encode every binary value as unpadded base64url. `letterId` SHALL decode to exactly 16 bytes, every nonce to exactly 12 bytes, and `prfSalt` (when present) to exactly 32 bytes.
3. THE header SHALL record `sealedAt` and `opensAt` as UTC ISO 8601 timestamps ending in `Z`. It SHALL record `formatVersion` as a positive integer naming a payload version defined under R1.
4. WHERE a letter has a passkey wrap, THE header SHALL include `rpId`, `credentialId` and `prfSalt`. WHERE a letter has no passkey wrap, THE header SHALL omit all three.
5. THE header SHALL hold no field derived from the payload other than the ciphertext, so it reveals nothing about what the letter tracks. THE header schema SHALL reject any field not named in criteria 1 and 4.
6. IF an envelope is missing a required field, has an unknown field, has a binary value of the wrong length or encoding, has two wraps for the same factor, or has any of `rpId`, `credentialId` and `prfSalt` without a passkey wrap (or a passkey wrap without all three), THEN THE SYSTEM SHALL reject the envelope with an error naming the failed rule, compute no hash and store nothing.
7. THE envelope hash SHALL be the SHA-256 of the RFC 8785 canonical JSON of the full envelope (every header field including the ciphertext, with the hash itself excluded). It SHALL be encoded as 64 lowercase hex characters.
8. THE canonical JSON and hash code SHALL be usable from server code without importing `src/lib/crypto`. For the same envelope, it SHALL produce the same hash as the browser, whatever the property order or whitespace of the submitted JSON.
9. THE canonical JSON code SHALL pass the RFC 8785 test vectors for strings, nested objects and key ordering. IF its input contains a value that JSON can't represent (`NaN`, `Infinity`, `undefined`, a function or a `BigInt`), THEN THE canonical JSON code SHALL raise an error instead of returning output.
10. THE envelope schema SHALL be versioned so that a later spec can add header fields (for the passkey wrap) without changing how envelopes sealed under this spec validate, hash or open.

### R3. Browser crypto with a demo key

**User story:** As a judge, I want persona letters to be genuinely encrypted and time-locked, so the demo shows the real mechanism without a passkey.

1. THE crypto module in `src/lib/crypto/` SHALL use only WebCrypto (`globalThis.crypto`) and `crypto.getRandomValues`, with no third-party crypto library, so the same code runs in browsers, Node scripts and tests.
2. Code under `src/app/api/`, `src/lib/db/` and the server-side store function from R5.1 SHALL NOT import `src/lib/crypto`, directly or through another module. A lint rule or test SHALL make `npm run lint` or `npm test` fail if any of them does.
3. IF a sealing or opening call receives a `letterId` that does not decode to exactly 16 bytes or a serverSecret that does not decode to exactly 32 bytes, THEN THE crypto module SHALL reject the call before any key derivation, and SHALL return no envelope or payload.
4. WHEN sealing, THE crypto module SHALL generate a random 256-bit DEK and encrypt the canonical JSON payload with AES-256-GCM, a fresh random 96-bit nonce, and AAD equal to the canonical JSON of the envelope header without the payload ciphertext. That header includes the wrapped DEK entries. Two seals of the same payload with the same keys SHALL produce different nonces and different ciphertexts.
5. WHEN sealing, THE crypto module SHALL wrap the DEK with AES-256-GCM under `KEK_backup = HKDF-SHA256(ikm = backupKey ‖ serverSecret, salt = letterId, info = "revenant-kek-backup-v1")`, with a fresh random 96-bit nonce and AAD `letterId ‖ "backup"`.
6. THE backup key SHALL be 128 random bits, encoded as Crockford Base32 in groups of four characters separated by hyphens, followed by one checksum character. The checksum SHALL detect any single-character substitution and any swap of two adjacent characters.
7. WHEN a backup key is entered, THE crypto module SHALL accept upper or lower case, ignore hyphens and spaces, and read `I` and `L` as `1` and `O` as `0` before checking it.
8. IF an entered backup key has a wrong checksum, the wrong length, or a character outside the Crockford alphabet after that normalisation, THEN THE crypto module SHALL reject it with an error that says the key is mistyped, without fetching or using the serverSecret and without any decryption attempt.
9. THE published demo key SHALL be a fixed backup key that passes the checksum check, committed in the repository, with a name and comment that both say it is public and for demo letters only.
10. THE opening records key SHALL be `HKDF-SHA256(ikm = DEK, salt = letterId, info = "revenant-opening-v1")`. Recall answers SHALL be encrypted with it using AES-256-GCM, a fresh random 96-bit nonce, and AAD `letterId ‖ "opening"`.
11. WHEN opening, THE crypto module SHALL recompute the envelope hash (R2.7) and compare it with the stored envelope hash before any unwrap or decryption.
12. IF the recomputed envelope hash does not match the stored hash, THEN THE crypto module SHALL return a "verification failed" result, attempt no unwrap or decryption, and return no payload.
13. IF the DEK unwrap fails, THEN THE crypto module SHALL return a "wrong key" error. IF the DEK unwraps but payload decryption fails, THEN THE crypto module SHALL return a "tampered" error. In both cases it SHALL return no payload, no partial plaintext and no DEK.
14. FOR ALL valid payloads and keys, sealing then opening with the same backup key and serverSecret SHALL return a payload equal to the original. A round-trip test SHALL check this over at least 100 generated payloads, including empty figure lists and letter text of 1 and 5,000 characters.
15. FOR ALL sealed envelopes, opening SHALL fail with a different backup key, with a different serverSecret, or after any single byte of the header or ciphertext is changed. The change case SHALL fail at the hash check (criterion 12), and SHALL also fail at AES-GCM (criterion 13) when the hash is recomputed over the changed envelope.
16. THE crypto module SHALL NOT log, persist or make network requests with the DEK, backup key, serverSecret, opening records key or plaintext. That excludes console output, `localStorage`, `sessionStorage`, IndexedDB, cookies and thrown error messages. A test SHALL check that none of these values appears in console output or error messages during a seal and open.

### R4. Database tables and immutability

**User story:** As a user, I want sealed letters to be unchangeable at the database level, so no application bug can alter or remove one.

1. THE SYSTEM SHALL add one Drizzle SQL migration that creates `letters` (real), `demo_letters` and `openings` only.
2. EACH row in `letters` and `demo_letters` SHALL store these values, all as NOT NULL columns: the letter ID (128-bit random, primary key), the envelope, the envelope hash (64 lowercase hex characters), `sealed_at`, `opens_at` and the serverSecret (256-bit). All timestamps SHALL be `timestamptz` in UTC.
3. EACH `demo_letters` row SHALL store a NOT NULL demo kind. In this spec the only allowed value is `persona`. IF an insert gives any other demo kind, THEN THE database SHALL reject the insert and store no row. A `persona` row MAY have any `opens_at`, including one in the past. A later spec may add `live` with its own constraint in a new migration.
4. `letters` and `demo_letters` SHALL be separate tables, with no column, flag or route that moves or converts a row from one table to the other.
5. IF an insert into `letters` has an `opens_at` earlier than `sealed_at + interval '3 months'`, THEN THE database SHALL reject it with a CHECK constraint violation and store no row.
6. `letters`, `demo_letters` and `openings` SHALL each have a row-level `BEFORE UPDATE OR DELETE` trigger and a statement-level `BEFORE TRUNCATE` trigger. Each trigger SHALL raise an exception.
7. IF any statement tries to update, delete or truncate rows in `letters`, `demo_letters` or `openings`, THEN THE database SHALL reject the statement, and every affected row SHALL stay byte-for-byte unchanged.
8. EACH `openings` row SHALL store the encrypted recall answers, their nonce, and an `opened_at` set by the database clock, all as NOT NULL columns. Each row SHALL reference exactly one row in either `letters` or `demo_letters` through a foreign key.
9. IF an insert into `openings` references no sealed letter, references both tables, or references a letter ID that does not exist, THEN THE database SHALL reject the insert and store no row.
10. WHEN the migrate command runs on a database that already has this migration, THE SYSTEM SHALL apply nothing and exit with status 0.
11. IF any statement in the migration fails, THEN THE SYSTEM SHALL roll back the whole migration, leave none of its tables or triggers in place, and exit with a non-zero status.

### R5. Storing persona letters

**User story:** As a developer, I want to store a sealed persona letter from a script, so the end-to-end test and the persona sealing script in spec 03 have a supported path.

1. WHEN the server-side store function is called from a Node script, without a browser or HTTP, with an envelope, its submitted hash and the 256-bit serverSecret it was sealed with, THE SYSTEM SHALL validate the envelope against the envelope schema, recompute the hash, and insert the envelope into `demo_letters` as a `persona` letter. It SHALL accept an `opens_at` in the past.
2. IF the store function's input fails validation, the recomputed hash differs, or the `letterId` already exists in `letters` or `demo_letters`, THEN THE store function SHALL throw an error saying which check failed and insert nothing.
3. THIS spec SHALL add no route that inserts into `letters` or `demo_letters`.

### R6. Reading a letter and releasing its server secret

**User story:** As a reader, I want the letter link to show a countdown before the opening date and the envelope after it, with the server's clock deciding.

1. WHEN `GET /api/letters/{id}` is requested for a sealed letter while the server's UTC clock is before `opens_at`, THE SYSTEM SHALL return HTTP 200 with only `{ status: "sealed", opensAt, demo }`, with no envelope, envelope hash or serverSecret.
2. WHEN `GET /api/letters/{id}` is requested for a sealed letter while the server's UTC clock is at or after `opens_at`, THE SYSTEM SHALL return HTTP 200 with only `{ status: "openable", opensAt, demo, envelope, envelopeHash }`. The envelope and hash SHALL be exactly the values stored at sealing.
3. WHEN `GET /api/letters/{id}/secret` is requested for a sealed letter while the server's UTC clock is at or after `opens_at`, THE SYSTEM SHALL return HTTP 200 with only the serverSecret as a base64url string.
4. IF `GET /api/letters/{id}/secret` is requested for a sealed letter while the server's UTC clock is before `opens_at`, THEN THE SYSTEM SHALL return HTTP 403 with only `opensAt` and no serverSecret.
5. THE SYSTEM SHALL make every time comparison with the database or server UTC clock. A request where the clock equals `opens_at` to the millisecond SHALL count as "at or after". Any time the client sends in a header, query or body SHALL have no effect on the response.
6. THE SYSTEM SHALL return `opensAt` in every response as a UTC ISO 8601 string ending in `Z`.
7. THE `demo` field SHALL be `true` for every row from `demo_letters` and `false` for every row from `letters`, and every response for a demo letter SHALL include it.
8. IF the ID is not a well-formed 128-bit letter ID in the header's `letterId` encoding (unpadded base64url of 16 bytes), or it matches no sealed letter in `letters` or `demo_letters`, THEN THE SYSTEM SHALL return HTTP 404 from both routes. The body SHALL be identical in every one of these cases, so a caller cannot tell a malformed ID and an unknown ID apart.
9. IF a database error occurs while either route is reading a letter, THEN THE SYSTEM SHALL return HTTP 500 with no envelope, serverSecret, stack trace or database message.
10. THE letter and secret routes SHALL send `Cache-Control: no-store` on every response, error responses included.

### R7. Recording recall answers

**User story:** As a reader, I want my recall answers stored before the reveal, without the operator being able to read them.

1. WHEN `POST /api/openings` receives a body that passes Zod validation, for a sealed letter in `letters` or `demo_letters` whose `opens_at` is at or before the server's UTC clock, THE SYSTEM SHALL append exactly one `openings` row. The body holds a letter ID, an encrypted answers ciphertext and its nonce. The row's `opened_at` SHALL come from the database or server UTC clock, and any time sent by the client SHALL be ignored.
2. IF the letter ID is malformed or matches no sealed letter THEN THE SYSTEM SHALL return HTTP 404 with no detail and store nothing.
3. IF the letter exists and its `opens_at` is after the server's UTC clock THEN THE SYSTEM SHALL return HTTP 403 with `opensAt` only and store nothing.
4. IF the decoded ciphertext is larger than 65,536 bytes THEN THE SYSTEM SHALL return HTTP 413 and store nothing.
5. WHEN answers are recorded, THE SYSTEM SHALL return HTTP 201 with `Cache-Control: no-store`. The body SHALL hold only the new opening ID and `openedAt` as a UTC ISO 8601 timestamp.
6. THE SYSTEM SHALL allow more than one opening per letter. Each opening SHALL be a new row, and earlier rows SHALL stay unchanged.
7. IF the body fails Zod validation THEN THE SYSTEM SHALL return HTTP 400 and store nothing, and the response SHALL not echo any part of the body. A body fails if a field is missing, a binary value is not base64url, the ciphertext decodes to 0 bytes, or the nonce does not decode to exactly 12 bytes.

### R8. Secrets and logging

**User story:** As a user, I want no key material to leak through logs or errors.

1. THE SYSTEM SHALL NOT write any of the following to any log output (console, stdout, stderr): request bodies, envelopes, serverSecrets, DEKs, backup keys, opening records keys, ciphertexts, nonces, recall answers, or the value of `DATABASE_URL`.
2. IF a route handler fails because of a validation error, a database error or an unexpected exception, THEN THE SYSTEM SHALL return an error response whose body holds only a short error description, with no stack trace, database message, SQL text or submitted values, and SHALL store nothing for that request.
3. IF Zod validation of a request body fails, THEN THE SYSTEM SHALL name the failing field in the error response without echoing the submitted value.
4. ALL database access SHALL use Drizzle or raw SQL with placeholders, and no request value SHALL be concatenated into SQL text.
5. THIS spec SHALL add no new environment variable. IF a task needs one, THEN THE SAME change SHALL update `.env.example`, the Helm chart and its `values.yaml`, and bump the chart `version`.
6. THE SYSTEM SHALL include route tests that send a known serverSecret, envelope ciphertext and answer ciphertext, trigger one validation failure and one database failure, and assert that neither the captured log output nor the response body contains any of those values.

### R9. End-to-end test

**User story:** As the owner, I want one test that proves the whole lifecycle works against real Postgres.

1. THE SYSTEM SHALL include an integration test that seals a version 1 payload with a test backup key using the crypto module, stores it with the R5 store function with an `opensAt` in the past, reads it through the `GET /api/letters/{id}` route handler, fetches the serverSecret through the `GET /api/letters/{id}/secret` route handler, verifies the envelope hash, decrypts, and asserts the decrypted payload is equal to the original.
2. THE same test SHALL store a second persona letter with an `opensAt` in the future and assert that `GET /api/letters/{id}` returns only `status`, `opensAt` and `demo`, that `GET /api/letters/{id}/secret` returns HTTP 403 with no serverSecret, and that `POST /api/openings` returns HTTP 403 and stores nothing.
3. WHEN the test records recall answers through the `POST /api/openings` route handler for the openable letter, THE same test SHALL assert an HTTP 201 response, that exactly one new `openings` row exists for that letter, and that decrypting the stored answers with the opening records key returns the original answers.
4. THE same test SHALL assert that `UPDATE` and `DELETE` on a `letters` row, a `demo_letters` row and an `openings` row each raise an exception, and that a re-read of each row afterwards is equal to the row read before the attempt.
5. THE same test SHALL insert a `letters` row directly with parameterised SQL, since no route inserts into `letters` in this spec, and SHALL assert that a row with `opens_at` less than 3 months after `sealed_at` is rejected, and that a row with `opens_at` exactly 3 months after `sealed_at` is accepted.
6. THE integration test SHALL generate new random letter IDs on each run, SHALL NOT depend on rows created by earlier runs or other tests, and SHALL pass when run twice in a row against the same database.
7. WHEN `DATABASE_URL` is unset, THE integration test SHALL be skipped with a message saying it needs Postgres, and `npm test` SHALL exit with code 0.
8. WHEN CI runs, THE integration test SHALL run against a real Postgres with the migration applied, and IF any assertion in it fails, THEN the CI gate SHALL fail.
9. THE integration test SHALL finish within 60 seconds.
