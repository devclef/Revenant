# Requirements Document

Spec: 06 Lock and unlock (Demo 2)

## Introduction

Demo 1 (the persona letters, specs 03 and 05) shows the opening. Demo 2 shows the locking. A judge writes a short letter at `/demo`, picks figures from the demo catalogue, and seals the letter in their own browser with their own passkey (WebAuthn PRF), exactly as `crypto.md` describes. The letter is locked for 30 seconds. A countdown runs. When the server's clock says the time has come, the judge unlocks the letter with the same passkey, answers the sealed recall questions, and sees the reveal.

This spec adds the pieces that do not exist yet:

- the passkey wrap, which is the second factor in the key hierarchy in `crypto.md` (the envelope header from spec 02 already has room for it, but `sealLetter` and `openLetter` only handle the backup wrap today);
- the PRF check at sealing;
- a server path that stores a sealed demo letter with a 30-second lock (spec 02 left this out on purpose: "Live demo sealing moves to the passkey demo spec");
- the pages for writing, sealing, waiting and unlocking, where each passkey prompt is started by its own click;
- a fallback that seals with a backup key alone when the device cannot lock a letter with a passkey;
- optionally, the letter card, the calendar file, and the backup key card for a letter that also has a working passkey.

Everything else is reused. The sealed payload format (`src/lib/seal-format`), the envelope hash, the three letter routes (`GET /api/letters/{id}`, `GET /api/letters/{id}/secret`, `POST /api/openings`), the append-only `openings` table, the Recall_Record, the Opening_Flow and the Reveal components all stay as they are, except for the small additions this document names.

Rules that apply throughout: `crypto.md`, `data-integrity.md`, `neutrality.md`, `tone.md` and `tech.md` in `.kiro/steering/`.

### How this document is organised

The requirements are in five parts so they can be split into tasks that run in the right order (see R24).

| Part | Requirements | Owner role | Depends on |
|---|---|---|---|
| A. Server and database | R1 to R6 | crypto-dev | Only what is on `main` |
| B. Browser crypto | R7 to R11 | crypto-dev | Only what is on `main` |
| C. Pages and flow, including the backup key fallback | R12 to R19 | frontend-dev | Parts A and B, and spec 05 task 9 |
| D. Optional keepsakes | R20 and R21 | frontend-dev | Part C |
| E. Tests, checks and tasks | R22 to R24 | All | Not applicable |

## Out of scope

- Real letters. This spec adds no route, page or form that inserts into the `letters` table. Real letters keep the 3-month rule from spec 02 (R5).
- Self-reported personal numbers. Demo 2 offers only official figures from the demo catalogue.
- Rate limiting and spam protection (`tech.md` defers them). Rate limiting is replaced by two cheap caps in R3.7 and R4.11 (Busy_Limits); nothing finer is in scope.
- Any change to the persona letters, the Sealing_Script or the published demo key.
- Predictions, wages, comments on what the judge wrote, and any LLM feature.
- A server-side check of WebAuthn assertions. The passkey is a key source, not a login (`crypto.md`).
- Opening a letter without the Revenant server (the known limitation in `tech.md`).

## Glossary

- **Live_Letter**: A demo letter that a judge seals in their own browser with their own passkey. Stored in `demo_letters` with `kind` `live`.
- **Persona_Letter**: A pre-sealed demo letter from spec 03. Stored in `demo_letters` with `kind` `persona`. Opened with the published demo key. This spec leaves Persona_Letters unchanged.
- **Real_Letter**: A row in the `letters` table. Needs `opens_at` at least 3 months after `sealed_at`.
- **Lock_Duration**: Exactly 30,000 milliseconds. The only lock a Live_Letter may have.
- **Draft**: A server-held record made by the prepare route. It holds a Letter_ID and a Server_Secret and nothing else. A Draft is not a sealed record.
- **Draft_Lifetime**: 10 minutes, measured by the database clock.
- **Letter_ID**: The 22-character unpadded base64url form of 16 random bytes, as in spec 02.
- **Server_Secret**: The per-letter 32-byte time-lock secret from `crypto.md`.
- **Busy_Limits**: The two caps that make the Prepare_Route and the Seal_Route return HTTP 429 `{"error":"busy"}`: more than 1,000 unexpired Drafts, and more than 500 Live_Letters sealed in the past 24 hours (R3.7, R4.11).
- **Backup_Fallback**: The path in R15.9 that seals a Live_Letter with a Backup_Wrap only, when the PRF_Check cannot pass.
- **Create_Press**, **Confirm_Press**: The two clicks in the Sealing_Flow. The Create_Press ("Create your passkey") starts the `create` call. The Confirm_Press ("Confirm your passkey") starts the `get` call (R15.1).
- **Prepare_Route**: `POST /api/letters/demo/prepare`.
- **Seal_Route**: `POST /api/letters/demo/seal`.
- **Passkey_Module**: The browser-only module `src/lib/crypto/passkey.ts` that creates a passkey, runs the PRF check and asks for an assertion.
- **Authenticator_Port**: A small TypeScript interface with two methods, `create` and `get`, that wraps `navigator.credentials`. The Passkey_Module takes it as an argument so tests can pass a fake.
- **PRF_Output**: The 32-byte result of the WebAuthn PRF extension. It never leaves the browser.
- **PRF_Check**: The sequence in `crypto.md` "PRF check at sealing", spelled out in R7. Steps 1 to 4 run in the Passkey_Module across the Create_Press and the Confirm_Press. Step 5 (the wrap check) runs inside `sealLetter` (R8.5).
- **Passkey_Wrap**: The wrapped DEK with factor `passkey` in the envelope header.
- **Backup_Wrap**: The wrapped DEK with factor `backup` in the envelope header.
- **Sealing_Flow**: The browser steps from "Seal this letter" to a stored Live_Letter (R15).
- **Unlock_Flow**: The Opening_Flow from spec 03 and spec 05 as extended by R17.
- **Demo_Catalogue**: The series in `DEMO_FIGURES` (`src/lib/figures/demo`), which merges the real figure file and the US fuel fixture.
- **Fixture_Figure**: A figure whose `source` and `series_id` start with `FIXTURE`. Spec 03 R13 rules for the "fixture data" label apply.
- **Letter_Page**: The page at `/l/{letterId}`.
- **Seal_Page**: The page at `/demo/live`.
- **Opening_Flow**, **Reveal**, **Recall_Record**, **Recall_Generator**, **Demo_Index**, **Then_Figure**, **Now_Figure**: As defined in spec 03.
- **Server_Clock**: The PostgreSQL `now()` value read in the same statement as the row it decides about, as `findLetter` does today. In the Seal_Route and the Prepare_Route it is the database `now()` in the same transaction.
- **Owner_Check**: The short manual test on the live site in R23.

## Requirements

## Part A. Server and database (crypto-dev)

### Requirement 1: Reuse and boundaries

**User Story:** As the owner, I want Demo 2 to reuse what is already built, so there is one sealed format, one letter store and one reveal.

#### Acceptance Criteria

1. THE System SHALL seal a Live_Letter with payload format version 1 from `src/lib/seal-format` and envelope header version 1. THE System SHALL NOT add a payload version or a header version.
2. THE System SHALL read a Live_Letter, release its Server_Secret and record its recall answers through the existing routes `GET /api/letters/{id}`, `GET /api/letters/{id}/secret` and `POST /api/openings`. THE System SHALL NOT add a second route for any of those three jobs.
3. THE System SHALL show a Live_Letter with the existing Opening_Flow and Reveal components. IF the existing components need a change, THEN THE change SHALL be the smallest one that supports the requirement, and every existing test for the Persona_Letter path SHALL pass unchanged.
4. THE System SHALL add no entry to `dependencies` in `package.json`. IF a task finds it needs one, THEN THE task SHALL stop and ask the owner (see Decisions and notes, item 2).
5. THE System SHALL use only WebCrypto and the browser's WebAuthn API (`navigator.credentials`) for passkeys, key derivation and encryption. `crypto.md` forbids third-party crypto libraries.
6. THE server code in this spec (`src/app/api/**`, `src/lib/letter-store/**`, `src/lib/db/**`) SHALL NOT import `src/lib/crypto`, directly or through another module. The existing import-boundary tests SHALL pass.
7. THE System SHALL leave the Content Security Policy in `src/lib/security-headers.ts` unchanged. Passkeys and PRF need no CSP change.
8. THE System SHALL keep the Persona_Letter flow working. `GET /demo/personas/us-maya` SHALL open and reveal exactly as it does on `main`.

### Requirement 2: Live letters live apart from real letters

**User Story:** As the owner, I want demo letters stored away from real ones, so a demo letter can never be mistaken for a real one.

#### Acceptance Criteria

1. THE System SHALL store every Live_Letter in the `demo_letters` table with `kind` `live`. THE System SHALL NOT store a Live_Letter in `letters`.
2. THE System SHALL add one new Drizzle SQL migration, numbered after `0000_sealed_letters.sql`. THE migration SHALL only add objects, with one exception named in criterion 3. THE migration SHALL NOT change a row, a trigger or a column of an existing table.
3. THE migration SHALL replace the check constraint `demo_letters_kind` with one that allows exactly `persona` and `live`. Spec 02 R4.3 reserved this change for this spec. Existing `persona` rows SHALL stay byte-for-byte unchanged.
4. THE migration SHALL add a check constraint on `demo_letters` that holds when `kind` is not `live`, or when `opens_at` equals `sealed_at` plus exactly 30 seconds. IF an insert gives a `live` row any other gap between `sealed_at` and `opens_at`, THEN THE database SHALL reject the insert and store no row.
5. THE migration SHALL create the table `demo_letter_drafts` with these NOT NULL columns: `id` (text primary key, same format check as `demo_letters.id`), `server_secret` (bytea, exactly 32 bytes, checked) and `created_at` (timestamptz, default `now()`). THE table SHALL have no immutability trigger, because a Draft is deleted when it is used or when it expires. THE table SHALL hold no letter content.
6. THE existing immutability triggers on `letters`, `demo_letters` and `openings` SHALL stay in place and SHALL still raise on every update, delete and truncate. A test SHALL show that a `live` row cannot be updated, deleted or truncated.
7. THE System SHALL store anything that happens after sealing (the encrypted recall answers and the opening time) only in the existing append-only `openings` table, through the existing `POST /api/openings` route. THE System SHALL add no mutable column to any sealed table.
8. WHEN the migrate command runs on a database that already has this migration, THE System SHALL apply nothing and exit with status 0. IF any statement in the migration fails, THEN THE System SHALL roll back the whole migration and exit with a non-zero status.
9. THE migration and its Drizzle schema change SHALL leave `.env.example` and the Helm chart untouched. IF a task adds an environment variable, THEN THE same change SHALL update `.env.example`, the chart, `values.yaml` and the chart README, and bump the chart `version` (`tech.md`).

### Requirement 3: Prepare a letter

**User Story:** As a judge's browser, I want a fresh Letter_ID and Server_Secret from the server, so I can seal a letter that the server can time-lock.

#### Acceptance Criteria

1. WHEN the Prepare_Route receives a POST, THE Prepare_Route SHALL create a Draft with a Letter_ID made from 16 bytes of `globalThis.crypto.getRandomValues` and a 32-byte Server_Secret made the same way, and SHALL return HTTP 201 with a JSON body holding exactly `letterId`, `serverSecret` (unpadded base64url, 43 characters) and `serverNow` (a UTC ISO 8601 string with milliseconds ending in `Z`, from the Server_Clock).
2. THE Prepare_Route SHALL return no `rpId`. THE Seal_Page gets `rpId` from `RP_ID` when the server renders the page (R12.8), never from the request's host or any header.
3. IF `RP_ID` is unset or empty, THEN THE Prepare_Route SHALL return HTTP 503 with the body `{"error":"not_configured"}` and SHALL create no Draft.
4. THE Prepare_Route SHALL ignore the request body and SHALL NOT read it.
5. IF the generated Letter_ID already exists in `demo_letter_drafts`, `demo_letters` or `letters`, THEN THE Prepare_Route SHALL generate a new one, up to 3 attempts in total. IF all 3 attempts collide, THEN THE Prepare_Route SHALL return HTTP 500 with the fixed body `{"error":"internal"}`.
6. WHEN the Prepare_Route runs, THE Prepare_Route SHALL first delete every Draft whose `created_at` is more than Draft_Lifetime before the Server_Clock. This is the only cleanup. THE System SHALL add no scheduled job for it.
7. IF, after the cleanup in criterion 6, `demo_letter_drafts` holds more than 1,000 rows, THEN THE Prepare_Route SHALL return HTTP 429 with the body `{"error":"busy"}` and SHALL create no Draft. The count SHALL be read in the same transaction as the insert. Every row left after the cleanup is unexpired, so the cap counts unexpired Drafts only.
8. THE Prepare_Route SHALL send `Cache-Control: no-store` on every response, including errors.
9. THE Prepare_Route SHALL write nothing to any log (console, stdout, stderr), and SHALL return only fixed error bodies. A route test SHALL send a known Server_Secret path through a forced database failure and check that neither the response body nor captured log output contains the secret.
10. THE System SHALL add `RP_ID` and `APP_ORIGIN` to `.env.example` (names only, no values). The Helm chart already sets both from its ConfigMap, so no chart change is expected.

### Requirement 4: Seal a letter with a 30-second lock

**User Story:** As the operator, I want the server to accept a sealed demo letter only if its lock is exactly 30 seconds, so the short lock cannot be used for anything else.

#### Acceptance Criteria

1. WHEN the Seal_Route receives a POST, THE Seal_Route SHALL run these checks in this order, and SHALL stop at the first one that fails:

   | Step | Check | Failure status | Failure body |
   |---|---|---|---|
   | 1 | Declared `Content-Length` over 100,000, or body text over 100,000 characters | 413 | `{"error":"too_large"}` |
   | 2 | Body is not valid JSON | 400 | `{"error":"invalid_body","field":"body"}` |
   | 3 | Zod: body is an object with exactly `letterId` (string), `envelope` (object) and `envelopeHash` (string); unknown keys are stripped | 400 | `{"error":"invalid_body","field":"<first failing field>"}` |
   | 4 | `parseEnvelope` accepts the envelope | 400 | `{"error":"invalid_envelope"}` |
   | 5 | `RP_ID` is set, and the header's `rpId` (when the header has one) equals `RP_ID` | 400 (header `rpId` differs) or 503 (`RP_ID` unset) | `{"error":"invalid_envelope"}` or `{"error":"not_configured"}` |
   | 6 | The recomputed envelope hash equals the submitted `envelopeHash` | 400 | `{"error":"hash_mismatch"}` |
   | 7 | A Draft with this Letter_ID exists and is younger than Draft_Lifetime by the Server_Clock | 404 | `{"error":"not_found"}` |
   | 8 | No more than 500 Live_Letters were sealed in the past 24 hours (criterion 11) | 429 | `{"error":"busy"}` |
   | 9 | The Lock rule in criterion 2 holds | 422 | `{"error":"lock_out_of_range"}` |
   | 10 | Insert and Draft delete succeed | 201 | See criterion 4 |

2. THE Lock rule SHALL hold only when all three of these are true, using the header's `sealedAt` and `opensAt` and the Server_Clock `T` read in the same transaction as the insert:
   - `opensAt` minus `sealedAt` equals exactly 30,000 milliseconds;
   - `opensAt` is later than `T`;
   - `opensAt` is at most 60,000 milliseconds after `T`.
3. THE Seal_Route SHALL, in one transaction, insert the envelope into `demo_letters` with `kind` `live`, `id` from the Draft, `server_secret` copied from the Draft, `envelope` as `canonicalize(envelope)`, `envelope_hash` as the recomputed hash, `sealed_at` and `opens_at` from the header, and SHALL delete the Draft. IF either statement fails, THEN THE transaction SHALL roll back and the Draft SHALL stay.
4. WHEN the Seal_Route succeeds, THE Seal_Route SHALL return HTTP 201 with a JSON body holding exactly `letterId`, `sealedAt` and `opensAt`, both as UTC ISO 8601 strings with milliseconds ending in `Z`.
5. THE Seal_Route SHALL reject any envelope that has no wrapped DEK. This holds already through `parseEnvelope`, because a header needs 1 or 2 wraps. A Live_Letter MAY have a Passkey_Wrap, a Backup_Wrap or both.
6. WHEN a Draft has been used or has expired, THE Seal_Route SHALL return the same 404 body as for an unknown Letter_ID, so the two cases cannot be told apart.
7. THE Seal_Route SHALL NOT import `src/lib/crypto`. It SHALL use only `src/lib/seal-format` and the letter store.
8. THE Seal_Route SHALL send `Cache-Control: no-store` on every response, and SHALL write nothing to any log. Any unexpected failure SHALL become `HTTP 500` with `{"error":"internal"}`, with the error dropped and not chained. A validation error SHALL name only the failing field and SHALL NOT echo a submitted value.
9. THE letter store SHALL gain one function, `storeLiveLetter`, that implements criteria 3 and the Lock rule. It SHALL throw a `LetterStoreError` with a fixed message for each failed check, as `storePersonaLetter` does. THE Seal_Route SHALL call it and SHALL contain no SQL.
10. THE Seal_Route SHALL run no UPDATE and no DELETE on `letters`, `demo_letters` or `openings`. The only DELETE it runs is the Draft delete in criterion 3.
11. THE Busy_Limit check for the Seal_Route SHALL count the `demo_letters` rows with `kind` `live` whose `sealed_at` is later than the Server_Clock minus 24 hours, in the same transaction as the insert. IF the count is above 500, THEN THE Seal_Route SHALL return HTTP 429 with `{"error":"busy"}` and store nothing. The window is rolling, so old Live_Letters stop counting after 24 hours and a spammer cannot disable Demo 2 for good. THE check SHALL come after the Draft check (step 7), so an unknown Letter_ID still gets 404, and SHALL leave the Draft in place so the judge can retry within Draft_Lifetime.
12. THE `storeLiveLetter` function SHALL throw a `LetterStoreError` with a fixed message for the busy case as well (criterion 9).

### Requirement 5: Real letters keep their 3-month rule

**User Story:** As the owner, I want the 30-second lock to be impossible for real letters, so no bug can turn a demo shortcut into a real one.

#### Acceptance Criteria

1. THE System SHALL add no route, script or function that inserts into `letters`.
2. THE database check `letters_opens_at_min_lock` (at least 3 months between `sealed_at` and `opens_at`) SHALL stay unchanged.
3. A test against real PostgreSQL SHALL insert a row into `letters` with `opens_at` equal to `sealed_at` plus 30 seconds and SHALL assert that the database rejects the insert and stores no row.
4. A test SHALL assert that the Seal_Route never writes to `letters`: after a successful seal, `letters` holds no row with that Letter_ID.
5. A test SHALL assert that a `demo_letters` row with `kind` `live` and a 31-second gap is rejected by the database, and that a `persona` row with an `opens_at` in the past is still accepted.
6. THE Seal_Route SHALL reject any `opensAt` minus `sealedAt` other than 30,000 milliseconds with HTTP 422 (R4.1 step 9). The server therefore refuses a 3-month lock and a 1-second lock alike on this route.

### Requirement 6: The server clock decides, for Live_Letters too

**User Story:** As a judge, I want the lock to be a real lock, so unlocking before 30 seconds have passed is not possible, whatever my device clock says.

#### Acceptance Criteria

1. WHILE the Server_Clock is before a Live_Letter's `opens_at`, THE existing `GET /api/letters/{id}` SHALL return only `status` `sealed`, `opensAt` and `demo` `true`, and THE existing `GET /api/letters/{id}/secret` SHALL return HTTP 403 with `opensAt` only, and THE existing `POST /api/openings` SHALL return HTTP 403 and store nothing.
2. WHEN the Server_Clock is at or after a Live_Letter's `opens_at`, THE existing routes SHALL return the envelope, release the Server_Secret and accept the recall record, as spec 02 R6 and R7 say.
3. THE client clock SHALL NOT decide anything. THE browser MAY use its own clock, corrected by the offset in R15.5, only to draw the countdown (R16), and SHALL NOT use it to decide whether to request the Server_Secret or to open the letter.
4. THE Prepare_Route's `serverNow` SHALL be used by the browser only to compute the offset in R15.5, which sets `sealedAt` and `opensAt` in the header so they sit near the Server_Clock, and which corrects the countdown display (R16.2). THE Seal_Route SHALL NOT trust it; the Lock rule (R4.2) decides.
5. THE System SHALL NOT change `src/lib/letter-store/clock.ts` or the three existing letter routes, except that a test file MAY be added next to each.
6. AN integration test against real PostgreSQL SHALL seal a Live_Letter (R22.3) and prove criteria 1 and 2 with the real database clock.

## Part B. Browser crypto (crypto-dev)

### Requirement 7: Create the passkey and run the PRF check

**User Story:** As a judge, I want Revenant to check that my passkey really works for locking before it seals anything, so I never end up with a letter I cannot open.

#### Acceptance Criteria

1. THE Passkey_Module SHALL be browser-only, in `src/lib/crypto/passkey.ts`, exported from `src/lib/crypto/index.ts`, and SHALL take an Authenticator_Port as an argument. THE default port SHALL call `navigator.credentials.create` and `navigator.credentials.get`. THE Passkey_Module SHALL expose the PRF_Check as two functions, one for the Create_Press (`create`, then PRF_Check step 1) and one for the Confirm_Press (`get`, then PRF_Check steps 2 to 4), because each prompt needs its own click (R15.1).
2. WHEN the Passkey_Module creates a passkey, THE Passkey_Module SHALL make the call to the port's `create` the first asynchronous operation of the function, with no `await`, request or dynamic import before it, and SHALL call `create` with all of these:
   - `rp.id` set to the `rpId` it was given (the value the Seal_Page received from `RP_ID` at render), and `rp.name` set to `Revenant`;
   - `user.id` set to 16 random bytes, `user.name` set to `Revenant demo` and `user.displayName` set to `Revenant demo`;
   - `challenge` set to 32 random bytes;
   - `pubKeyCredParams` with algorithms -7 and -257;
   - `authenticatorSelection` with `residentKey` `required` and `userVerification` `required`, and no `authenticatorAttachment`, so the browser can offer "use a phone or tablet";
   - `attestation` `none`;
   - `extensions.prf.eval.first` set to a `prfSalt` of 32 random bytes;
   - `timeout` 120000.
3. THE Passkey_Module SHALL run the PRF_Check in this order and SHALL stop at the first step that fails:
   1. `create` returns a credential with a non-empty `rawId` (1 to 1023 bytes). This ends the Create_Press function, which returns the credential ID, the `prfSalt` and any PRF result that `create` carried, for the Confirm_Press function to use.
   2. `get` is called, as the first asynchronous operation of the Confirm_Press function, with `allowCredentials` holding exactly that credential, `userVerification` `required`, the same `rpId`, a fresh 32-byte challenge, and `extensions.prf.eval.first` equal to the same `prfSalt`.
   3. The `get` result carries `prf.results.first` of exactly 32 bytes.
   4. IF the `create` result also carried `prf.results.first`, THEN it equals the `get` result byte for byte.
   5. The wrap-and-unwrap check in R8.5 passes. This step runs inside `sealLetter` after the Prepare_Route has answered, not in the Passkey_Module.
4. WHEN the Create_Press function succeeds, THE Passkey_Module SHALL return `{ ok: true, credentialId, prfSalt, createdPrf }`, and WHEN the Confirm_Press function passes steps 2 to 4, THE Passkey_Module SHALL return `{ ok: true, credentialId, prfSalt, prfOutput }`. IF any step fails, THEN THE Passkey_Module SHALL return `{ ok: false, reason }` where `reason` is exactly one of `unsupported` (no `PublicKeyCredential` in the browser), `cancelled` (the user dismissed a prompt or it timed out), `no_prf` (the `get` result has no PRF result or one of the wrong length), `prf_mismatch` (criterion 3 step 4), `wrap_failed` (reported by `sealLetter`, R8.5) or `failed` (anything else). It SHALL return no `prfOutput` and no credential on failure.
5. THE Passkey_Module SHALL NOT assume PRF support from the user agent. It SHALL decide only from what the PRF_Check returns.
6. THE Passkey_Module SHALL NOT throw for an expected failure. It SHALL catch the errors from the port and map them to `reason`.
7. THE Passkey_Module SHALL NOT log, store or send the PRF_Output, the `prfSalt`, the credential ID or any challenge. That excludes console output, `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL and thrown error messages.
8. WHEN the PRF_Check fails, THE System SHALL store no Passkey_Wrap. THE passkey that the device created cannot be removed by a web page, so the pages (R15.6) tell the judge it can be deleted.

### Requirement 8: Seal with a passkey wrap

**User Story:** As a judge, I want my letter locked by my passkey and by the server's clock together, so nobody can open it early, not even me.

#### Acceptance Criteria

1. THE `sealLetter` function SHALL accept, besides its current inputs, an optional passkey factor: `{ prfOutput, credentialId, prfSalt, rpId }`. IF the passkey factor is given, THEN THE header SHALL carry a Passkey_Wrap and the three header fields `rpId`, `credentialId` and `prfSalt`. IF it is not given, THEN THE header SHALL carry none of the three (spec 02 R2.4).
2. THE `backupKey` input of `sealLetter` SHALL become optional. THE function SHALL require at least one factor and SHALL reject a seal with neither, with the existing `invalid_input` error. A seal with a backup key and no passkey factor SHALL behave exactly as it does on `main`, so the Persona_Letters and the Sealing_Script stay unchanged.
3. THE Passkey_Wrap SHALL be the DEK encrypted with AES-256-GCM under `KEK_passkey = HKDF-SHA256(ikm = PRF_Output ‖ Server_Secret, salt = Letter_ID bytes, info = "revenant-kek-passkey-v1")`, with a fresh random 96-bit nonce and AAD equal to the Letter_ID bytes followed by the ASCII bytes `passkey`.
4. THE header's wraps SHALL stay sorted with `backup` before `passkey`, and SHALL hold at most one wrap per factor (spec 02 R2.1 and the header schema).
5. BEFORE `sealLetter` returns an envelope that carries a Passkey_Wrap, THE function SHALL unwrap that wrap again with the same KEK and SHALL compare the result with the DEK. IF they differ, THEN THE function SHALL return no envelope and SHALL report `wrap_failed`. This is step 5 of the PRF_Check.
6. THE payload ciphertext's AAD SHALL stay "the canonical JSON of the header without the ciphertext" (spec 02 R3.4), so the Passkey_Wrap and the three passkey header fields are authenticated by the payload's GCM tag.
7. THE `sealLetter` function SHALL reject, before any key derivation, a `prfOutput` that is not 32 bytes, a `prfSalt` that is not 32 bytes, an empty `credentialId`, and an `rpId` that is not a lowercase hostname.
8. THE header SHALL reveal nothing about what the letter tracks. THE seal function SHALL add to the header no field other than those in criterion 1.
9. FOR ALL valid payloads and valid inputs, sealing with a passkey factor and then opening with the same PRF_Output and Server_Secret (R9) SHALL return a payload equal to the original. A property test SHALL check this over at least 100 generated payloads, with the passkey factor alone and with both factors.

### Requirement 9: Open with a passkey

**User Story:** As a judge, I want my passkey to open my letter after the 30 seconds, on the device where I made it.

#### Acceptance Criteria

1. THE `openLetter` function SHALL accept either `backupKey` (as today) or a passkey factor `{ prfOutput }`, and SHALL reject an input with neither, with the existing `invalid_input` error naming the field.
2. WHEN `openLetter` is given a PRF_Output, THE function SHALL recompute and compare the envelope hash first (spec 02 R3.11), then derive `KEK_passkey` as in R8.3, unwrap the Passkey_Wrap with AAD `Letter_ID ‖ "passkey"`, and decrypt the payload.
3. IF the envelope has no Passkey_Wrap, THEN `openLetter` given a PRF_Output SHALL return the existing `wrong_key` error and no payload.
4. IF the unwrap fails, THEN `openLetter` SHALL return `wrong_key`. IF the unwrap works and the payload decryption fails, THEN `openLetter` SHALL return `tampered`. In both cases it SHALL return no payload, no partial plaintext and no DEK. These are the existing error kinds.
5. THE Passkey_Module SHALL export a function that asks for an assertion for a stored letter: it takes the envelope header's `rpId`, `credentialId` and `prfSalt`, calls `get` with `allowCredentials` holding that credential, `userVerification` `required` and `extensions.prf.eval.first` set to the `prfSalt`, and returns `{ ok: true, prfOutput }` or `{ ok: false, reason }`. THE reasons SHALL be `unsupported`, `cancelled`, `no_prf` (no 32-byte PRF result), `wrong_domain` (the page's hostname differs from `rpId`) or `failed`.
6. THE assertion function SHALL check, before calling `get`, that `rpId` equals the page's hostname. IF it does not, THEN THE function SHALL return `wrong_domain` without calling `get`.
7. THE assertion function SHALL be called only from a user gesture, such as a button press (a browser rule for WebAuthn), and the call to the port's `get` SHALL be the first asynchronous operation of the function, with no `await`, request or dynamic import before it, because Safari can refuse or add a dialog to a prompt that is not started directly by a click. The Opening_Flow SHALL honour that (R17.2).
8. THE existing `verification_failed` result SHALL still come first: a changed envelope SHALL never reach key derivation.
9. THE PRF_Output SHALL be held in memory only and SHALL be overwritten with zeros as soon as `openLetter` has returned.

### Requirement 10: Key hygiene

**User Story:** As a user, I want no key material to leak, so the operator cannot read my letter.

#### Acceptance Criteria

1. THE PRF_Output, the DEK, the Server_Secret, the opening records key, the plaintext and any backup key SHALL stay in browser memory and SHALL NOT be written to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL or any log, and SHALL NOT be sent to the server. The only things sent to the server are the sealed envelope, its hash, and the encrypted recall record.
2. THE only secret that the browser receives from the server at sealing is the Server_Secret in the Prepare_Route response. THE browser SHALL send it nowhere.
3. WHEN the Backup_Fallback shows the backup key on screen (R15.9), THE page SHALL keep the key in component memory only, SHALL NOT put it in the URL, an attribute other than the visible text and the Copy control's clipboard write, a log or a request, and SHALL discard it when the seal is stored or the judge declines.
4. A test SHALL seal and open a letter with a fake Authenticator_Port, with the passkey factor and with the Backup_Fallback, while capturing console output, and SHALL assert that none of the PRF_Output, the DEK, the Server_Secret, the backup key and the plaintext appears in it or in any thrown error message (the same check as spec 02 R3.16).
5. A test SHALL assert that the `demo_letters` row of a sealed Live_Letter contains neither the letter text nor any figure value, as plain text or in base64url.
6. THE Passkey_Module SHALL import nothing from `src/lib/db`, `src/lib/letter-store` or `src/app/api`.

### Requirement 11: Testable without a real passkey

**User Story:** As the QA agent, I cannot use a real passkey, so I need the crypto and the flow to be testable with a fake.

#### Acceptance Criteria

1. THE Authenticator_Port SHALL be a TypeScript interface with `create(options)` and `get(options)`, where the options and results use plain `ArrayBuffer` and `Uint8Array` values and not DOM credential classes, so tests need no DOM.
2. THE System SHALL include a fake Authenticator_Port for tests, in `src/lib/crypto/` next to its tests. THE fake SHALL derive its PRF result as HMAC-SHA-256 over the requested `prfSalt` with a fixed test key, so the same credential and salt give the same 32 bytes on `create` and `get`.
3. THE fake SHALL be configurable to fail in each of these ways: no PRF extension result on `create` only; no PRF result on `create` and `get`; a 31-byte PRF result; a `create` result that differs from the `get` result; the user cancelling; `PublicKeyCredential` missing. A test SHALL map each to its `reason` in R7.4.
4. THE fake SHALL NOT be importable from production code. A test or lint rule SHALL make `npm test` or `npm run lint` fail if any file outside `*.test.ts(x)` and the fake's own folder imports it.
5. THE Sealing_Flow and the Unlock_Flow (R15 and R17) SHALL take the Authenticator_Port through one injection point, so flow tests can pass the fake.

## Part C. Pages and flow (frontend-dev; depends on spec 05 task 9)

### Requirement 12: Entry from the demo index and the Write step

**User Story:** As a judge, I want to find Demo 2 on `/demo` and write a short letter, so I can try the locking myself.

#### Acceptance Criteria

1. THE Demo_Index at `/demo` SHALL show one extra entry, clearly separate from the persona list, that links to `/demo/live`. THE entry SHALL be outside the persona list element, so the Demo_Index test "exactly the personas in the Persona_List, in order" (spec 03 R6) still passes unchanged.
2. THE Seal_Page SHALL show the "Demo" label first (spec 03 R6.4), then a heading, then a short note in Revenant's voice that says three things: the judge is making a real sealed letter, it is locked for 30 seconds only because this is a demo, and it opens with the judge's own passkey.
3. THE Seal_Page SHALL have a plain-text letter field. THE field SHALL accept 1 to 5,000 Unicode code points with at least one character that is not whitespace, and SHALL show a live count of code points.
4. IF the letter text is empty, whitespace only or over 5,000 code points when the judge presses "Create your passkey", THEN THE Seal_Page SHALL show a message next to the field, keep the text as typed, and start nothing.
5. THE Seal_Page SHALL render the letter text as plain text everywhere it is shown (spec 03 R10.4). Markup characters SHALL stay literal.
6. THE Seal_Page SHALL NOT summarise, grade, correct or comment on what the judge wrote.
7. THE Seal_Page SHALL make no network request when it loads, when the judge types or picks, and when the judge presses the Create_Press or the Confirm_Press. THE first request SHALL be the Prepare_Route call, made only after PRF_Check steps 1 to 4 have passed (R15.1). THE page SHALL keep the draft letter in memory only.
8. WHEN the server renders the Seal_Page, THE Seal_Page SHALL read `RP_ID` from the environment at request time (not at build time) and pass it to the Sealing_Flow as `rpId`. IF `RP_ID` is unset or empty, THEN THE Seal_Page SHALL show a calm message that Demo 2 is not available on this server and SHALL show no seal control.

### Requirement 13: Pick figures from the demo catalogue

**User Story:** As a judge, I want to choose which everyday figures go into my letter, so the reveal has numbers that matter to me.

#### Acceptance Criteria

1. THE Seal_Page SHALL list the series of the Demo_Catalogue that have at least one figure, in catalogue order, each with its display name, unit and region. THE list SHALL be the same for every judge and SHALL NOT be ordered or filtered by how a series moved.
2. THE judge SHALL choose 1 to 6 series. IF the judge presses "Create your passkey" with none or more than 6 chosen, THEN THE Seal_Page SHALL show a message and start nothing.
3. WHERE a series is a Fixture_Figure series, THE list SHALL show the visible label "fixture data" next to it, with the same wording as spec 03 R13.
4. WHEN the judge seals, THE System SHALL put into the payload, for each chosen series, one Then_Figure and one metric definition. THE Then_Figure SHALL be `thenAndNow(metricId, <UTC date of sealing>, DEMO_FIGURES).then`, copied with no field changed, rounded, rescaled or added. THE metric definition SHALL be the catalogue's, copied with only the fields in `metricDefinitionV1Schema`.
5. IF `thenAndNow` reports the "then" figure as missing for a chosen series, THEN THE Seal_Page SHALL refuse to seal, SHALL name the series in a message, and SHALL store nothing. THE page SHALL NOT substitute another figure, series, region or period (data-integrity.md).
6. THE payload SHALL carry no `written_as_of` (spec 02 R1.4: real sealing omits it). THE payload SHALL carry no self-reported figure.
7. THE list SHALL show, for each series, the period of its latest figure in plain form (for example "Sep 2026"), so the judge can see which period will be sealed. THE list SHALL NOT show the value.

### Requirement 14: Recall questions are sealed with the letter

**User Story:** As a judge, I want to be asked what I remember before the reveal, as in Demo 1, so the gap between memory and record is the product here too.

#### Acceptance Criteria

1. WHEN the judge seals, THE System SHALL build one recall question for each chosen series with the existing Recall_Generator, and SHALL seal the questions inside the payload (`recall_questions`), in the same order as the chosen series.
2. THE System SHALL take the `recall_subject` for each series from one fixed table in `src/components/live/` keyed by metric ID, with one entry for every series that can be listed in R13.1. A test SHALL fail if a listed series has no entry, and SHALL run `checkRecallSubject` over every entry.
3. THE recall subjects SHALL hold no digit, no source, no series ID and no direction word, as the Recall_Generator already enforces. They SHALL follow `neutrality.md`.
4. THE recall questions SHALL be written out in full inside the sealed payload at sealing. The Unlock_Flow SHALL read them from the decrypted payload and SHALL NOT regenerate them.

### Requirement 15: The Sealing_Flow

**User Story:** As a judge, I want sealing to feel final and a little solemn, and I want plain words if my device cannot do it.

#### Acceptance Criteria

1. THE Sealing_Flow SHALL use two separate clicks for the two passkey prompts and SHALL run these steps in this order, stopping at the first failure:
   1. WHEN the judge presses "Create your passkey" (the Create_Press) with valid input and the warning of criterion 11 confirmed, THE flow SHALL call the Passkey_Module's create function (R7.2) as the first asynchronous operation of the click handler, with no request, `await` or dynamic import before it. This is PRF_Check step 1.
   2. WHEN the create function succeeds, THE page SHALL show a new control "Confirm your passkey" and SHALL NOT start the next prompt by itself. WHEN the judge presses it (the Confirm_Press), THE flow SHALL call the Passkey_Module's confirm function as the first asynchronous operation of the click handler, with no request in between. This is PRF_Check steps 2 to 4.
   3. ONLY after PRF_Check steps 1 to 4 have passed, THE flow SHALL call the Prepare_Route.
   4. Set `sealedAt` and `opensAt` (criterion 5).
   5. Build the payload (R13, R14) and validate it with `payloadV1Schema`.
   6. Call `sealLetter` with the Letter_ID bytes, the Server_Secret, the payload and the passkey factor. The wrap check (R8.5, PRF_Check step 5) runs here.
   7. Post `{ letterId, envelope, envelopeHash }` to the Seal_Route.
   8. Discard the DEK, the Server_Secret and the PRF_Output from memory.
2. BEFORE the Create_Press, THE Seal_Page SHALL tell the judge in plain words, next to the "Create your passkey" control, that the device will ask for the passkey twice, in two steps with a button each, and that the passkey will be named "Revenant demo" in their passkey manager.
3. THE Seal_Page SHALL start loading `@/lib/crypto` by dynamic `import()` once it has mounted, never during server rendering, and SHALL keep the "Create your passkey" control disabled, with a status line, until the module has loaded, so no import runs between a click and the passkey call (criterion 1). THE Sealing_Flow SHALL use the loaded module for the Confirm_Press as well.
4. THE Sealing_Flow SHALL make requests only to the app's own origin, with `cache: "no-store"`, `credentials: "same-origin"` and `referrerPolicy: "no-referrer"`.
5. WHEN the Prepare_Route's response arrives, THE Sealing_Flow SHALL record the offset `serverNow` minus the browser clock's time at that moment, SHALL set `sealedAt` to the browser clock's current time plus that offset, and SHALL set `opensAt` to `sealedAt` plus exactly 30,000 milliseconds, both as millisecond-precision UTC ISO strings. THE flow SHALL keep the offset for the countdown (R16.2). No passkey prompt follows the Prepare_Route call, so the prompts do not eat the lock.
6. IF the PRF_Check returns `unsupported`, `no_prf`, `prf_mismatch` or `wrap_failed`, THEN THE Sealing_Flow SHALL seal nothing, send nothing to the Seal_Route, and show a message in Revenant's voice that says plainly: this device and passkey provider cannot lock a letter with a passkey, the letter has not been sealed and nothing was stored, and what to do next (try another device or browser, or use "use a phone or tablet" when the browser offers it, or seal with a backup key instead, or try the persona letters). THE message SHALL offer the control "Seal with a backup key instead" (criterion 9). WHERE the browser created a passkey before the failure, THE message SHALL say the judge may delete the passkey named "Revenant demo" from their passkey manager. THE page SHALL keep working and SHALL offer a link back to `/demo`.
7. IF the PRF_Check returns `cancelled`, THEN THE Sealing_Flow SHALL show a calm message that nothing was sealed and offer "Try again", which restarts from the Create_Press. THE letter text and chosen series SHALL stay as typed.
8. IF the PRF_Check returns `failed`, or the Prepare_Route or the Seal_Route fails with a network error, a 5xx status or HTTP 404, THEN THE Sealing_Flow SHALL show a message that the letter was not sealed and offer "Try again" from the Create_Press. A retry SHALL create a new Draft and a new passkey. THE message SHALL NOT claim that the letter was sealed. IF the Seal_Route returns HTTP 422 `lock_out_of_range`, THEN THE message SHALL say that the device clock looks different from Revenant's clock by more than the demo allows, and that nothing was sealed. IF the Prepare_Route or the Seal_Route returns HTTP 429 `busy`, THEN THE message SHALL say in a calm tone that Demo 2 is busy, that nothing was sealed, and to try again later, and SHALL offer "Try again". WHERE the failure happened after a passkey was created, THE message SHALL also carry the passkey-deletion note of criterion 6.
9. WHEN the judge presses "Seal with a backup key instead" (the Backup_Fallback), THE Sealing_Flow SHALL, with no passkey prompt:
   1. generate the key with `generateBackupKey` and show it on screen as text in groups of four, as `formatBackupKey` produces, with a "Copy" control;
   2. say plainly, in the same area, that this key is then the only way to open the letter, that a lost key means a lost letter, and that Revenant cannot recover it;
   3. show a checkbox labelled "I have saved this key", and keep the control that seals disabled until the checkbox is ticked;
   4. WHEN the judge ticks the checkbox and presses the seal control, call the Prepare_Route, set `sealedAt` and `opensAt` (criterion 5), build and validate the payload, call `sealLetter` with the backup key and no passkey factor (so the header has a Backup_Wrap only, R8.2), and post to the Seal_Route;
   5. IF the judge declines (a "Not now" control, or leaves the key unsaved), THEN seal nothing, send nothing, discard the key from memory, and show the message of criterion 6.
   THE Backup_Fallback SHALL follow criteria 4, 8 and 10 to 14 as well, and the key SHALL be handled as R10.3 says. A Live_Letter sealed this way has no `rpId`, `credentialId` or `prfSalt` in its header.
10. WHILE a passkey prompt or a request is in flight, THE Seal_Page SHALL disable the control that started it and show a status line (`role="status"`) with the current step in plain words. ONE press SHALL send at most one Seal_Route request.
11. THE Seal_Page SHALL show, before "Create your passkey" can be pressed, a warning in plain words, not softened by atmosphere (`tone.md`), that a lost or deleted passkey means this letter can never be opened. THE judge SHALL confirm it with a checkbox labelled with that sentence. IF the checkbox is not ticked when the judge presses "Create your passkey", THEN THE Seal_Page SHALL show a message and start nothing. (Without the optional backup key of R21 this checkbox is how a skipped backup key is confirmed, as `crypto.md` requires. The Backup_Fallback has its own confirmation in criterion 9.)
12. THE Seal_Page SHALL explain, in the same area, that a passkey may not work on a device from a different ecosystem, and that the judge can open the letter on a device that has the passkey or use their computer's "use a phone" option.
13. THE Sealing_Flow SHALL show the sealing as final. WHEN the Seal_Route returns 201, THE page SHALL say that the letter is sealed and cannot be changed.
14. THE Sealing_Flow SHALL keep the Letter_ID, the typed letter and all keys in memory only.

### Requirement 16: Waiting and the countdown

**User Story:** As a judge, I want to see my sealed letter wait for 30 seconds, so the lock is visible.

#### Acceptance Criteria

1. WHEN the Seal_Route returns 201, THE Seal_Page SHALL show a sealed state with: the statement that the letter is sealed, the opening time from the response in the judge's local time, a countdown, the letter link as plain text (`<origin>/l/<letterId>`) with a "Copy link" control, and a link to the Letter_Page.
2. THE countdown SHALL be drawn from the browser clock corrected by the same offset as R15.5 (the Prepare_Route's `serverNow` minus the browser clock at the moment that response arrived) and the `opensAt` from the response, and SHALL be display only (R6.3). It SHALL update at least once a second and SHALL stop at zero.
3. THE sealed state SHALL show nothing from the letter or the figures. THE letter text SHALL NOT be shown again after sealing (spec product.md "Wait": sealed contents are hidden, including from the author).
4. WHEN the countdown reaches zero, THE Seal_Page SHALL show a control "Go to your letter" that links to the Letter_Page. THE page SHALL NOT navigate by itself.
5. THE sealed state SHALL tell the judge in plain words to keep the link, because the page keeps nothing once it is closed. WHERE the letter was sealed with the Backup_Fallback, THE sealed state SHALL also say that the backup key is the only way to open the letter, SHALL NOT show the key again, and SHALL tell the judge to paste the key into the field on the Letter_Page.
6. WHILE the countdown runs, THE sealed state SHALL honour Calm_Mode from spec 05: no decorative motion, and the countdown text still updates.

### Requirement 17: Unlock at the Letter_Page

**User Story:** As a judge, I want to unlock the letter with my passkey after the 30 seconds and be asked what I remember before anything is shown.

#### Acceptance Criteria

1. THE System SHALL add the route `/l/{letterId}`. THE route SHALL be a server component that checks the ID with `isLetterId` and calls `notFound()` for a malformed ID. THE route SHALL render the Opening_Flow for that Letter_ID, which loads the letter by the existing `GET /api/letters/{id}`.
2. WHEN the letter route reports `status` `openable` and the header has a Passkey_Wrap, THE Unlock_Flow SHALL, after the Server_Secret has been released, show one control "Unlock with your passkey". THE passkey assertion (R9.5) SHALL be requested only when the judge presses that control, never automatically, and the call to `get` SHALL be the first asynchronous operation of the click handler, with no request, `await` or dynamic import between the click and `get`. THE Letter_Page SHALL therefore load `@/lib/crypto` by dynamic `import()` before it shows the control (or keep the control disabled until the module has loaded), and SHALL have released the Server_Secret before the control is shown.
3. WHEN the assertion returns a PRF_Output, or the judge submits a valid backup key (criterion 10), THE Unlock_Flow SHALL call `openLetter` with the envelope, hash, Server_Secret and the PRF_Output or the backup key, and SHALL then continue exactly as the Persona_Letter flow does: the "Your seal is intact" statement first, then the recall questions, then `POST /api/openings`, then the Reveal (spec 03 R7 to R9 and spec 05 R3).
4. WHILE the letter route reports `status` `sealed`, THE Letter_Page SHALL show the existing still-sealed state: the opening date, the time remaining and "Try again" at zero, and nothing about the contents. IF the judge presses "Try again" at zero while the Server_Clock is still before `opens_at`, THEN THE page SHALL stay in the still-sealed state with the new remaining time. THE client clock SHALL NOT decide to skip the server check. WHEN the still-sealed countdown reaches zero, THE Letter_Page SHALL check the letter route once by itself, and SHALL then wait for the judge to press "Try again" for any further check. THE countdown at zero SHALL be a display event only; THE server's answer to the automatic check decides whether the page moves on.
5. IF the assertion returns `cancelled`, THEN THE Unlock_Flow SHALL keep the control and show a calm message that nothing was opened.
6. IF the assertion returns `no_prf` or `failed`, THEN THE Unlock_Flow SHALL say that this device could not produce the key for this passkey, that the letter is unchanged, and that the judge can try a device that has the passkey or the computer's "use a phone" option, and SHALL keep the control.
7. IF the assertion returns `wrong_domain`, THEN THE Unlock_Flow SHALL say which domain the letter's passkey belongs to (the header's `rpId`) and that the letter can only be unlocked there, without calling `get`.
8. IF `openLetter` returns `wrong_key`, THEN THE Unlock_Flow SHALL say the passkey is probably not the one that sealed this letter, and keep the control. IF it returns `tampered`, `verification_failed`, `unsupported_format`, `invalid_payload` or `invalid_input`, THEN THE Unlock_Flow SHALL show the existing message for that kind (spec 03 R7.6 and R7.7) and no part of the payload.
9. IF the letter route returns 404, THEN THE Letter_Page SHALL show the existing not-placed message. IF a request fails with a network error or a 5xx status, THEN THE Letter_Page SHALL show the existing unreachable message with a retry control.
10. WHERE the header has a Backup_Wrap, THE Letter_Page SHALL, after the Server_Secret has been released, show a field for the backup key. WHERE the header has a Backup_Wrap and no Passkey_Wrap, THE page SHALL say plainly that this letter needs its backup key and show no passkey control. WHERE the header has both wraps, THE page SHALL show the passkey control and the key field. THE field SHALL accept pasting (no paste blocking, and the pasted text with its groups of four, dashes, spaces and letter case accepted as `parseBackupKey` accepts them), SHALL turn off autocomplete, autocorrect and spell checking, and SHALL check the text with `parseBackupKey` before any request or decryption (spec 02 R3.7 and R3.8). IF `parseBackupKey` reports a mistyped key, THEN THE page SHALL say so, keep the field and send nothing. IF `openLetter` returns `wrong_key` for a backup key, THEN THE page SHALL say the key does not match this letter and keep the field.
11. THE Letter_Page SHALL show the "Demo" label whenever the letter route reports `demo` `true`.
12. THE Letter_Page SHALL keep the DEK, PRF_Output, Server_Secret, opening records key, decrypted payload and Recall_Record in memory only.
13. THE Persona_Letter flow (spec 03) SHALL keep using the published demo key and SHALL NOT show the passkey control. A test SHALL show that the Persona_Letter route renders the same states as before this spec.
14. THE Opening_Flow state machine MAY gain a small number of states and transitions for the passkey control and the backup key field, or the controls MAY sit in a wrapper before the flow starts; the design SHALL choose. WHICHEVER it chooses, every existing test for `opening-machine` and for the Persona_Letter path SHALL pass unchanged, and new tests SHALL cover the new transitions. (The owner has agreed to a small machine change. Spec 05 R1.2 froze the machine for spec 05 only.)

### Requirement 18: The reveal for a Live_Letter

**User Story:** As a judge, I want the reveal to be honest about my letter: it was sealed 30 seconds ago, so the numbers have not changed.

#### Acceptance Criteria

1. THE Reveal for a Live_Letter SHALL use the existing order: what the judge remembered, then the letter, then the figures then and now (spec 03 R9 and spec 05 R3).
2. THE Reveal for a Live_Letter SHALL show "Sealed on {date and time}" taken from the header's `sealedAt`, in the judge's local time. THE Reveal SHALL NOT show "Written as of", "Prepared later as a demo" or "Sealed for the demo on", because the letter was really sealed at that moment. THE payload carries no `written_as_of`, so the existing code shows no "Written as of" line already.
3. THE Reveal SHALL show the Then_Figure from the payload with its period, region and a way to its source, and the "historical record, retrieved [date]" label where it applies, as spec 03 R13 says.
4. THE Reveal SHALL look up the Now_Figure with the existing mechanism (`thenAndNow(...).now` over `DEMO_FIGURES`), and SHALL NOT fetch any other data or invent any number.
5. IF the Then_Figure and the Now_Figure are the same figure (same series, period, value and source), THEN THE Reveal SHALL show both with their own periods and the computed change, which is 0, using the existing Change_Calculator and its formula line. THE Reveal SHALL NOT hide the pair, fabricate a difference, or add words that call the result good, bad, small or surprising.
6. THE Reveal for a Live_Letter SHALL show one fixed note, from the copy module, saying that this letter was locked for 30 seconds and that the longer comparison is in the persona letters, with a link to `/demo`. THE note SHALL make no claim about whether the numbers changed.
7. THE Reveal SHALL show the "fixture data" label next to each Fixture_Figure and the one fixture note per page (spec 03 R13).
8. THE Reveal SHALL keep the ceremony from spec 05 (envelope, seal break, ink, stamps, number lines) for Live_Letters. THE seal-break step SHALL read as breaking the seal of the judge's own letter and SHALL NOT mention a persona.
9. THE neutrality tests from spec 03 and spec 05 (a rise and a mirror-image fall render alike) SHALL pass unchanged.

### Requirement 19: Copy, tone and accessibility

**User Story:** As the owner, I want every new word in one reviewable place, in Revenant's voice, and usable by everyone.

#### Acceptance Criteria

1. THE System SHALL keep every new user-facing string for the Seal_Page and the Letter_Page in copy modules in their feature folders (`src/components/live/copy.ts`), with no string literal in components, including `aria-label`s and live-region messages. THE existing scan tests for JSX text literals and banned words SHALL cover `src/components/live/`.
2. THE copy SHALL follow `tone.md` and `neutrality.md`: second person, short calm sentences of at most 25 words, the vocabulary *seal*, *sealed*, *open*, *unseal*, *letter*, *record*, *then* and *now*, no exclamation marks, no puns and no horror clichés. THE copy SHALL pass the neutrality copy test.
3. THE warning about a lost passkey (R15.11) and the messages for unsupported devices (R15.6) SHALL be plain and unmissable. Atmosphere SHALL NOT soften them.
4. EVERY control SHALL work with the keyboard alone. EVERY status change SHALL be announced in a polite live region. WHEN the page changes step, focus SHALL move to the new step's heading, as in spec 03 and spec 05.
5. EVERY pointer target SHALL be at least 24 by 24 CSS pixels, and the seal control at least 44 by 44.
6. EVERY text and number SHALL meet WCAG 2.2 AA contrast on the surface it sits on, and a test SHALL compute the ratios for the new token pairs, as spec 03 task 8 does.
7. THE Seal_Page and the Letter_Page SHALL load no third-party script and no analytics (`tech.md`).
8. THE Seal_Page SHALL work at 320 CSS pixels wide and at 200% text size without loss of content.

## Part D. Optional keepsakes (frontend-dev; last)

Part D is optional. Part C is complete without it. A task for Part D starts only when Part C is on `main`.

### Requirement 20: Letter card and calendar file

**User Story:** As a judge, I want a card with a QR code and a calendar file, so I can find my letter again.

#### Acceptance Criteria

1. WHERE Part D is built, WHEN the Seal_Route returns 201, THE Seal_Page SHALL generate in the browser a letter card: a printable page (the browser's print dialog can save it as a PDF) with a QR code of `https://<domain>/l/<letterId>`, the opening date and time, and the Letter_ID link as text. THE card SHALL contain no key, no letter text and no figure.
2. THE QR code SHALL be drawn as inline SVG by a QR encoder in `src/lib/cards/`, written in this repository. THE System SHALL NOT add a runtime dependency for it (R1.4), because the backup key card's QR code carries the backup key and `crypto.md` names a compromised dependency as the main residual risk.
3. WHERE Part D is built, THE Seal_Page SHALL offer an `.ics` download generated in the browser by code in `src/lib/ics/`. THE file SHALL hold one event at `opensAt` in UTC, a title in Revenant's voice, the letter link in the description and in the `URL` field, and a reminder alarm. THE file SHALL hold no letter content, no figure and no key.
4. THE `.ics` file SHALL follow RFC 5545: CRLF line endings, lines folded at 75 octets, escaped commas, semicolons and backslashes, and a `DTSTAMP` and a `UID`. A test SHALL check each rule and a round trip: parsing the generated file with a small test parser SHALL give back the same `opensAt`, link and title.
5. THE card and the `.ics` download SHALL be generated and offered without any request to the server and without a service worker caching them.
6. IF the download cannot start because the browser blocks it, THEN THE Seal_Page SHALL show the letter link as text, which is already shown (R16.1).

### Requirement 21: Backup key card and fragment

**User Story:** As a judge, I want an optional backup key alongside my working passkey, so a lost passkey does not mean a lost letter.

#### Acceptance Criteria

1. WHERE Part D is built, THE Seal_Page SHALL show, before "Create your passkey", an unticked checkbox "Also make a backup key card" with a plain explanation of what the key is. WHEN the judge has ticked it and the flow reaches the seal step (R15.1 step 6), THE Sealing_Flow SHALL generate the key with `generateBackupKey` in the browser and pass it to `sealLetter` together with the passkey factor, so the header has both wraps (R8.2).
2. WHERE the judge does not tick the checkbox, THE Seal_Page SHALL require the explicit confirmation already in R15.11. THE Part D change SHALL NOT remove that confirmation.
3. WHERE Part D is built, WHEN the Seal_Route returns 201 for a letter that has a Backup_Wrap (made by criterion 1 or by the Backup_Fallback), THE sealed state SHALL offer the backup key card for download or printing, and SHALL hold the key in memory only until the judge leaves the page. THE Backup_Fallback key shown on screen (R15.9) SHALL stay the way to save the key when Part D is not built.
4. THE backup key card SHALL be a separate printable page, generated in the browser, that says what it is, that after the opening date it opens the letter on its own, and that it should be kept like a house key. THE card SHALL carry the letter link as text and as a QR code with the key in the URL fragment (`/l/<letterId>#k=<key>`), as `crypto.md` says. THE QR code SHALL come from the encoder in `src/lib/cards/` (R20.2).
5. THE backup key SHALL NOT be sent to the server, logged, stored, cached by a service worker, or included in any request. THE card SHALL NOT be uploaded.
6. WHEN the Letter_Page loads with a `#k=` fragment, THE page SHALL read the key, then remove the fragment with `history.replaceState` before any other work, and SHALL put the key into the key field of R17.10 for the judge to submit. THE key SHALL NOT appear in logs, analytics, error reports or `Referer`. The existing `Referrer-Policy: no-referrer` SHALL stay.
7. THE backup-key sealing tests SHALL use the existing backup key round trip (spec 02 R3.14) and the double-wrap round trip (R8.9).

## Part E. Tests, checks and task split

### Requirement 22: Automated tests

**User Story:** As the owner, I want the rules checked in CI, with no real passkey and no network.

#### Acceptance Criteria

1. THE unit and property tests SHALL run in `npm test` with no network access. Tests that need PostgreSQL SHALL follow the existing integration-test pattern in `src/test/integration/`.
2. THE crypto tests SHALL use the fake Authenticator_Port (R11), which lives in `src/lib/crypto/testing/`, and SHALL cover: each failure reason in R7.4; the two-function split and the order of the PRF_Check steps in R7.3, including that `create` and `get` are each the first asynchronous operation of their function (the fake records call order); the `create` options in R7.2 (name `Revenant demo`, resident key and user verification required, the PRF salt length); seal then open with the passkey factor alone and with both factors, at least 100 generated payloads (R8.9); a wrong PRF_Output giving `wrong_key`; a changed byte giving `verification_failed`; the passkey header fields present exactly when the Passkey_Wrap is; and the unchanged Persona_Letter path.
3. THE integration test SHALL, against real PostgreSQL and the real route handlers with the fake Authenticator_Port:
   1. call the Prepare_Route and seal a payload;
   2. post it to the Seal_Route and assert HTTP 201 and one new `demo_letters` row with `kind` `live` and `opens_at` equal to `sealed_at` plus 30 seconds;
   3. assert at once that `GET /api/letters/{id}` returns only `status`, `opensAt` and `demo`, that the secret route returns 403, and that `POST /api/openings` returns 403 and stores nothing;
   4. wait until 31 seconds have passed since sealing by the real clock, then assert that the secret is released, the envelope hash verifies, the letter opens with the same fake passkey, the recall record is stored (HTTP 201) and decrypts to the original answers, and the payload equals the original. THIS test SHALL have a timeout of at most 60 seconds, and SHALL be the only test that waits.
4. THE route tests for the Seal_Route SHALL cover every row of the table in R4.1, with one request each: too large, not JSON, wrong shape, an envelope that fails `parseEnvelope`, a `letterId` that differs from the envelope's, a header `rpId` that differs from `RP_ID` (400 `invalid_envelope`) and `RP_ID` unset (503), a wrong hash, an unknown Draft, an expired Draft (made by inserting a Draft with an old `created_at`), a gap of 29,999 and 30,001 milliseconds, an `opensAt` at or before `T`, an `opensAt` more than 60 seconds after `T`, the busy case (more than 500 Live_Letters with `sealed_at` in the past 24 hours gives 429 `busy`, exactly 500 does not, and rows older than 24 hours do not count, with the Draft left in place), and the success case. EACH failure test SHALL assert that no `demo_letters` row was stored.
5. THE route tests for the Prepare_Route SHALL cover: success shape, `RP_ID` unset giving 503, a collision retry, expiry cleanup of an old Draft, the busy case (more than 1,000 unexpired Drafts gives 429 `busy` and creates no Draft, exactly 1,000 does not, and expired Drafts do not count), and the log and body leak check in R3.9.
6. THE database tests SHALL cover R2.3 to R2.8 and R5.3 to R5.5, including that the migration is idempotent and that a live row cannot be updated, deleted or truncated.
7. THE frontend tests SHALL use `renderToStaticMarkup` and the fake Authenticator_Port, with no DOM and no browser, as the reveal tests do. They SHALL cover: the input checks in R12.4 and R13.2; the no-request-before-the-two-presses rule (R12.7) and `RP_ID` unset (R12.8); the step order in R15.1 with stubbed routes, including that `create` is called before any request, `get` is called before any request, and the Prepare_Route is called only after PRF_Check steps 1 to 4 pass; each PRF_Check failure showing the message in R15.6 with the "Seal with a backup key instead" control and calling the Seal_Route zero times; the Backup_Fallback (R15.9: key shown in groups of four, Copy control, the seal control disabled until "I have saved this key" is ticked, declining sealing nothing, and a header with a Backup_Wrap only); the 429 `busy` message from each route; `cancelled` offering "Try again"; the warning checkbox gate (R15.11); the sealed state showing no letter text (R16.3); the passkey control appearing only after the secret is released (R17.2); `wrong_domain` calling `get` zero times (R17.7); `get` being the first asynchronous operation after "Unlock with your passkey" with no request in between (R17.2); the backup key field accepting a pasted grouped key and reporting a mistyped one before any request (R17.10); the Letter_Page's single automatic re-check when the still-sealed countdown reaches zero, with "Try again" still shown (R17.4); the countdown offset (R16.2); the Reveal labels for a Live_Letter (R18.2 to R18.6); and that the Persona_Letter route is unchanged (R17.13).
8. THE tests SHALL include a source scan that the Sealing_Flow and the Unlock_Flow write nothing to `localStorage`, `sessionStorage`, IndexedDB or cookies and make no `console` call.
9. THE System SHALL add no browser test framework. The QA agent verifies with the unit and integration tests above and the QA agent's own browser run for everything that does not need a real passkey (the pages, the messages, the "unsupported" path using a browser without PRF or with `PublicKeyCredential` removed, and the still-sealed state).

### Requirement 23: Owner check on the live site

**User Story:** As the owner, I want a short manual check with a real passkey, because no automated test can prove that a real device does PRF.

#### Acceptance Criteria

1. THE final core task (task 6) SHALL post the Owner_Check as a checklist in its issue. THE QA agent SHALL record its verdict as "owner check pending" until the owner has ticked the list.
2. THE Owner_Check SHALL be exactly these steps, on `https://revenant.devclef.se` with a device that supports PRF (as `tech.md` lists):
   1. Open `/demo`, follow the link to Demo 2, write a short letter, pick two series, tick the lost-passkey warning and press "Create your passkey".
   2. Approve the first passkey prompt, press "Confirm your passkey" and approve the second prompt. Check the passkey appears in the device's passkey manager named "Revenant demo".
   3. Check the sealed state shows a countdown from 30 seconds and shows no letter text.
   4. Press the link to the letter before the countdown ends. Check the page says it is still sealed and shows the time remaining.
   5. After the countdown, open the letter and press "Unlock with your passkey". Check the seal-is-intact statement comes before the recall questions.
   6. Answer the recall questions and finish the reveal. Check the letter text matches what was typed, each figure shows its period, and the change is 0.
   7. Open the Letter_Page in a browser without PRF support or on a device without the passkey. Check the message is clear and the page still works. Then, in a browser without PRF support, choose "Seal with a backup key instead", save the key, tick "I have saved this key", seal, and after the countdown paste the key into the key field on the Letter_Page and open the letter.
   8. Open `/demo/personas/us-maya` and check Demo 1 still opens as before.
3. THE Owner_Check SHALL record the device, operating system, browser and passkey provider used in step 1, in the issue.
4. THE owner SHALL delete the "Revenant demo" passkeys made during the check from the device afterwards.

### Requirement 24: Task split and order

**User Story:** As the owner, I want the work cut so crypto-dev and platform-level work starts now, the pages follow spec 05, and the optional keepsakes come last.

#### Acceptance Criteria

1. EACH task SHALL be one GitHub issue and one PR, SHALL stay inside one role's paths plus `shared`, and SHALL aim for about 1,500 changed lines, even though `max_changed_lines` in `.github/agents.json` allows 5,000. A task whose estimate is well over 1,500 lines SHALL be split before it starts.
2. THE tasks SHALL follow this order:

   | # | Task | Requirements | Role | Depends on |
   |---|---|---|---|---|
   | 1 | Migration, Drizzle schema, `storeLiveLetter`, Prepare_Route and Seal_Route (including the `rpId` check and the Busy_Limits), `.env.example`, route and database tests | R1 to R6, R22.4 to R22.6 | crypto-dev | Only `main` |
   | 2 | Passkey_Module (create and confirm functions), Authenticator_Port and fake, `sealLetter` and `openLetter` passkey support, crypto tests | R7 to R11, R22.2 | crypto-dev | Only `main` |
   | 3 | Integration test of the whole server and crypto path with the 31-second wait | R6.6, R22.3 | crypto-dev | 1, 2 |
   | 4a | Seal_Page, part 1: server-rendered `rpId` (R12.8), Write step, figure picker, recall subjects, Demo_Index entry | R12, R13, R14, R19 | frontend-dev | Spec 05 task 9 |
   | 4b | Seal_Page, part 2: Sealing_Flow with the two presses, the Backup_Fallback, busy and error messages, sealed state and countdown | R15, R16, R19 | frontend-dev | 1, 2, 4a, and spec 05 task 9 |
   | 5 | Letter_Page: unlock with passkey, backup key field with paste, still-sealed re-check, Unlock_Flow changes, Live_Letter reveal labels | R17, R18, R19 | frontend-dev | 4b |
   | 6 | Owner_Check checklist and the QA run | R22.9, R23 | frontend-dev | 5 |
   | 7 (optional) | Letter card (QR encoder) and `.ics` | R20 | frontend-dev | 6 |
   | 8 (optional) | Optional backup key beside a working passkey, backup key card, `#k=` fragment | R21 | frontend-dev | 7 |

3. TASKS 1 and 2 SHALL be allowed to run at the same time, because they share no file. TASK 4a MAY also run at the same time, because it needs only spec 05 task 9. TASK 1 owns `drizzle/**`, `src/lib/db/schema/letters*`, `src/lib/letter-store/**`, `src/app/api/letters/**` and `.env.example`. TASK 2 owns `src/lib/crypto/**`.
4. NO task before task 4a SHALL touch `src/components/**` or `src/app/**/*.tsx`.
5. EVERY frontend task SHALL carry the line "Before this task: spec 05 task 9 is on `main`", and SHALL list which QA steps apply and say that parts of later tasks being missing is not a finding.
6. EVERY task's PR description SHALL state which spec 02, 03 and 05 tests it touched and why, or "none".
7. THE tasks SHALL carry the Validation line `bash scripts/check.sh`.
8. THE size of the first-load JavaScript for `/demo/live` and `/l/[id]` SHALL stay at or under 175 kB gzipped, as `scripts/check-js-budget.mjs` measures it for `/demo/personas/[key]`. EACH frontend PR SHALL state the measured values. `@/lib/crypto` SHALL be loaded by dynamic `import()`, so it does not count toward first load.

## Decisions and notes

All earlier open items are settled.

1. **Opening_Flow state machine.** A small change to `opening-machine.ts` is allowed if every existing test passes unchanged (R17.14).
2. **QR encoder.** Written in this repository with no dependency, because the backup key card's QR code carries the key and `crypto.md` names a compromised dependency as the main residual risk. "PDF" means the browser's print-to-PDF (R20.2).
3. **Two presses at sealing.** The PRF_Check needs `create` and then `get`. Each runs from its own click (R15.1) and the page explains this in advance (R15.2). A demo script should expect two presses.
4. **Rate limits.** Settled as requirements: R3.7 and R4.11 (Busy_Limits).
5. **Live letters cannot be removed.** The immutability triggers protect Live_Letters too. Test letters sealed on `revenant.devclef.se` stay in the database. This matches `product.md` ("treat letters sealed before the final domain is chosen as test letters"). Accepted.
6. **The "then" figure may be old.** The Demo_Catalogue holds the figures prefetched into the repository. A Live_Letter's "then" figure is the latest period in that file, which can be weeks old, and the "now" figure is the same figure until the file is replaced. R13.7 shows the period before sealing and R18.5 shows the zero change. Accepted.
