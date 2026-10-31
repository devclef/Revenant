# Implementation Plan: 03 Persona demo

Each task is one GitHub issue, worked by one agent, and leaves `main` passing the CI gate. Each PR stays under 3,000 changed lines as `.github/agents.json` counts them (`package-lock.json` and `drizzle/meta/**` excluded) and inside one role's paths plus `shared`. Validation always includes the CI gate; the commands below are what the agent must run locally first, ending with `bash scripts/check.sh`.

"Before this task" lists work from other specs that must be on `main` first; the owner holds those. "Depends on" lists only tasks in this spec. Every property test is a fast-check test tagged `// Feature: 03-persona-demo, Property N: <title>`, with `numRuns: 100` unless the task says otherwise. No test makes a network request (R16.1).

- [x] 1. Change calculator, exact decimals and change display formatting
  - Agent: `data-dev` · Depends on: none
  - Before this task: spec 02-demo-figures task 1 is on `main` (`periodEnd`, `isRealDate`, `isRealMonth`, the catalogue's `display_rescale`, and `FigureV1` from `src/lib/seal-format`). Blocked by #38.
  - Scope: `src/lib/figures/decimal.ts`, `change.ts`, `format-change.ts`, `locale.ts`, `rescale.ts`, `src/lib/figures/index.ts` (add exports) and their `*.test.ts`
  - Acceptance:
    - `decimal.ts` per design.md: `parseDecimal` (throws `RangeError` on a string not matching `^-?[0-9]+(\.[0-9]+)?$`), `toDecimalString` (canonical, no trailing fractional zeros, `"0"` never `"-0"`), `add`, `sub`, `isZero`, and `ratioPercent` as `BigInt` long division to 20 significant digits, rounded half to even, with an `exact` flag.
    - `computeChange(then, now)` returns `ChangeResult` per design.md with `CHANGE_FORMULA_ID = "then-now-change-v1"`. Checks run in the order `kind`, `source`, `series_id`, `unit`, `region`, `unreadable_period`, `no_newer_figure`; the first failure is the reason. `unreadable_period` is returned when either period is neither a real `YYYY-MM-DD` nor a real `YYYY-MM` (owner decision). A zero then value gives `percent: null`. Value and period strings are copied as given; inputs are not mutated.
    - `formatChange`, `formatValue` and `formatPeriod` per design.md:
      - Sign from the exact difference: `+`, `−` (U+2212), or no sign with direction `unchanged`.
      - Magnitudes through `Intl.NumberFormat(locale, { …, roundingMode: "halfExpand" }).format(decimalString)`, never through a `Number`.
      - Difference uses the larger fraction-digit count of the inputs; percent uses one fraction digit.
      - Dates through `Intl.DateTimeFormat` with `timeZone: "UTC"`. `YYYY-MM` shows month and year, `YYYY-MM-DD` a full date, anything else exactly as stored.
      - Output words are only `rose`, `fell`, `unchanged`, `to` and month names.
    - `localeForRegion("U.S.")` is `"en-US"`; any other region falls back to `"en"`.
    - `rescaleForDisplay(value, divisor)` shifts the decimal point by the power of ten, exactly, for display only.
    - Example tests:
      - Gasoline `2.00 → 5.00` gives `+3.00` and `+150.0%`; diesel `9.00 → 6.00` gives `−3.00` and `−33.3%`.
      - A zero then value gives no percent.
      - A `YYYY-MM` vs `YYYY-MM-DD` pair compares by period end.
      - An unreadable period gives `unreadable_period`; equal period ends give `no_newer_figure`.
      - A source scan finds no `Number(`, `parseFloat`, `parseInt` or unary `+` on values in `decimal.ts`, `change.ts` and `format-change.ts`.
    - Property tests (value generators: strings matching the value pattern, up to 40 characters, scales 0–12, zero, very large and very small magnitudes):
      - Property 1: The change is exact and leaves its inputs alone. Validates R12.1, R12.4, R12.5, R12.6, R12.7, R12.10.
      - Property 2: A rise and its mirror-image fall differ only in sign. Validates R12.7.
      - Property 3: Trailing fractional zeros don't change the result. Validates R12.7.
      - Property 4: The percentage carries at least ten significant digits. Validates R12.5.
      - Property 5: Non-comparable pairs are reported with the first failing field. Validates R12.2, R12.3, R12.8, R12.11.
      - Property 6: Change text shows direction only through sign or the three words. Validates R11.8, R12.9, R15.3.
      - Property 7: Display rounding is exact decimal rounding. Validates R11.9, R11.10.
    - Pure modules: nothing imported from `src/lib/crypto`, `src/lib/db` or Node built-ins. No new dependencies.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R11.8, R11.9, R11.10, R12.1–R12.11, R15.3_

- [x] 2. Recall question generator and recall record schema
  - Agent: `frontend-dev` · Depends on: none
  - Before this task: spec 02-sealed-letters task 2 is on `main` (`encryptOpeningRecord`, `decryptOpeningRecord`, `sealLetter`, for Property 11). Blocked by #29.
  - Scope: `src/lib/recall/generate.ts`, `banned-words.ts`, `record.ts`, `index.ts` and their `*.test.ts`
  - Acceptance:
    - `generateRecallQuestions(items)` per design.md: 0–20 items in, one question per item in order, `id` `q1`, `q2`, …, `answer_type: "number"`, `metric_id` from the metric, text exactly `What do you think ${subject.trim()} cost then?`. No metric field other than `id` is read for the output.
    - `checkRecallSubject(subject, metric)` returns a problem for: no non-whitespace character, over 100 characters, `!`, any digit, the metric's `source` or `series_id` (case-insensitive), or a word from `banned-words.ts` as a whole word, case-insensitive. The list is exactly the R2.4 list.
    - The generator throws `RecallInputError` with a fixed message naming the problem and the item index for more than 20 items, a duplicate metric ID or any subject problem, and returns nothing.
    - The question type is `PayloadV1["recall_questions"][number]`; `src/lib/seal-format` is not edited.
    - `record.ts`: `recallRecordV1Schema` (strict, `version: 1`, `answers` as a discriminated union on `kind` of `number` and `no_answer`), `recallRecordSchemaFor(questionIds)` enforcing every ID exactly once with no unknown IDs, and `buildRecallRecord(questions, drafts)` per design.md. Number answers are trimmed, then checked as 1–40 characters matching `^[0-9]+(\.[0-9]+)?$`, and stored as trimmed with no other reformatting.
    - Example tests:
      - Maya's two subjects give "What do you think a gallon of regular gasoline cost then?" and "What do you think a gallon of diesel cost then?".
      - `"  3.50 "` is stored as `"3.50"`; `"03.50"` stays `"03.50"`.
      - An empty draft without the "no answer" toggle is invalid.
    - Property tests:
      - Property 8: Generated recall questions are valid, ordered and deterministic. Validates R2.1, R2.2, R2.3, R2.5, R2.7.
      - Property 9: The generator rejects bad input and returns nothing. Validates R2.4, R2.6.
      - Property 10: The Recall_Record schema accepts exactly the valid records. Validates R3.1, R3.2, R3.3, R3.5.
      - Property 11: Recall records survive encryption unchanged (`numRuns: 25`). Validates R3.6.
      - Property 12: Drafts become records only as typed. Validates R3.4, R3.7, R8.3, R8.4.
    - No new dependencies.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R2.1–R2.7, R2.10, R3.1–R3.7, R14.5_

- [x] 3. Persona list, Maya's letter and persona validation
  - Agent: `frontend-dev` · Depends on: 2
  - Before this task: spec 02-demo-figures task 2 is on `main` (`DEMO_FIGURES`, with `isRealDate` from task 1). Blocked by #39.
  - Scope: `content/personas/personas.json`, `content/personas/letters/us-maya.txt`, `src/lib/personas/schema.ts`, `index.ts`, `banned-terms.ts`, `letter-checks.ts` and their `*.test.ts`
  - Acceptance:
    - `personas.json` holds exactly the Maya entry from the design.md persona draft and `"retired_letter_ids": []`. The `letter_id` is generated once with `node -e "console.log(require('node:crypto').randomBytes(16).toString('base64url'))"` and committed.
    - `us-maya.txt` is exactly the letter text in design.md.
    - `schema.ts` enforces every R1.5 rule and the design.md field rules (key pattern and length, name and region length, `isLetterId`, `isRealDate`, millisecond `Z` `opens_at` later than the `written_as_of` midnight UTC, 1–20 unique metrics present in `DEMO_FIGURES.series`, `checkRecallSubject` on each subject, `letter_path` matching `^letters/[a-z0-9-]+\.txt$`, unique keys and IDs, no current ID in `retired_letter_ids`, no ID twice across both lists).
    - Failures are formatted `persona "<key>": <field>: <problem>`, falling back to the list index when the key itself is invalid.
    - `index.ts` exports `PERSONAS`, parsed once at import and deep-frozen; an invalid list throws at import.
    - `letter-checks.ts` `checkLetterText(key, text)` checks 1–5,000 code points with a non-whitespace character, no digit, no `$ € £`, no whole currency word (`dollars?`, `cents?`, `euros?`, `krona`, `kronor`, `kr`, `usd`, `eur`, `sek`), and no election or party term at a word start from `banned-terms.ts` (the R1.10 list plus `politic`, `governor`, `mayor`, `senator`, `minister`, `parliament`, `riksdag`). Each failure names the persona key and, for terms, the matched term.
    - Tests read each letter file with `node:fs` from `content/personas/` and check it exists and passes `checkLetterText`. Each `recall_subject` contains no `DEMO_FIGURES` value, period, source or series ID string.
    - Property tests:
      - Property 13: Persona_List validation names the persona and the field. Validates R1.3, R1.5, R5.2.
      - Property 14: Letter text checks catch digits, currency and political terms. Validates R1.6, R1.8, R1.10.
    - Web code never imports the `.txt` files.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.1–R1.10, R2.4, R2.10, R5.2_

- [ ] 4. Sealing script, its bundle and its integration tests
  - Agent: `crypto-dev` · Depends on: 2, 3
  - Before this task: spec 02-sealed-letters tasks 2, 3 and 4 are on `main` (`sealLetter`, `openLetter`, `parseBackupKey`, `PUBLIC_DEMO_BACKUP_KEY`, `storePersonaLetter`, `LetterStoreError`, `findLetter`, `describeDb`), and spec 02-demo-figures task 2 is on `main` (`DEMO_FIGURES`, `thenAndNow`). Blocked by #29, #30, #31, #39.
  - Scope: `scripts/seal-personas-core.ts`, `scripts/seal-personas.ts`, `scripts/seal-personas.build.mjs`, `scripts/seal-personas-texts.d.ts`, `src/test/integration/seal-personas.test.ts`, `src/test/integration/seal-personas-core.test.ts`, `package.json`, `package-lock.json`
  - Acceptance:
    - `buildPersonaPayload` per design.md: then figures from `thenAndNow(metricId, written_as_of, figures).then`, copied with no field changed; metric definitions picked to the six `metricDefinitionV1Schema` keys; questions from `generateRecallQuestions`; result checked with `payloadV1Schema.parse`. Returns `{ ok: false, metricId }` for the first metric with no then figure. Reads no clock and no randomness.
    - `sealPersonas(deps)` per the design.md flowchart, persona by persona in list order, each in its own `try/catch`:
      - No row: 32 fresh random bytes as server secret, `sealLetter` with the list letter ID, the parsed demo key, `sealedAt` from `now()` and the persona's `opens_at`, then `storePersonaLetter` → `stored`.
      - Row with `demo = false` → `failed: real_letter_collision`.
      - Row with `demo = true`: open with the demo key and stored secret; canonical JSON equal → `skipped`; not equal or not `ok` → `failed: stored_letter_differs`.
      - `LetterStoreError` → `store_rejected`; anything else → `unexpected_error`, with the error dropped.
      - `exitCode` is 1 when any result failed, else 0.
    - Only `findLetter` reads and `storePersonaLetter` inserts. No `UPDATE`, `DELETE` or `TRUNCATE`.
    - If `findLetter` on `main` doesn't return `serverSecret` and `demo`, stop and ask the owner; don't add a query to `letter-store`.
    - Entry `seal-personas.ts`: exits 1 with `seal-personas: DATABASE_URL is not set` on stderr when `DATABASE_URL` is unset or empty, before importing anything that connects. Prints only the fixed `formatResultLine` lines from design.md. Closes the pool with `getSql().end({ timeout: 5 })` in `finally` and sets `process.exitCode`.
    - `seal-personas.build.mjs` builds `dist/seal-personas.mjs` with the design.md esbuild options, the `createRequire` banner and the `virtual:persona-letter-texts` plugin that reads `content/personas/personas.json` generically. It fails if the metafile shows any output import that is not a Node built-in.
    - `package.json`: `esbuild` `0.28.2` in `devDependencies`, pinned exactly; `"build": "next build && node scripts/seal-personas.build.mjs"`; `"seal-personas": "node dist/seal-personas.mjs"`. No runtime dependency added.
    - `seal-personas.test.ts` (uses `describeDb`, letter IDs replaced with fresh random ones per run):
      - First run stores one `persona` row per persona; second run reports all `skipped` and inserts nothing.
      - A run with edited letter text under the same IDs reports `failed` naming each letter ID, and every row's `envelope` and `envelope_hash` is byte-for-byte unchanged.
      - Each stored letter opens with the demo key and its figures deep-equal `thenAndNow(…, written_as_of, DEMO_FIGURES).then.figure`.
      - An ID pre-inserted into `letters` reports `real_letter_collision`.
    - `seal-personas-core.test.ts` (no database): the entry run as a child process with an empty `DATABASE_URL` exits non-zero and stores nothing, plus:
      - Property 15: Persona payloads hold the "then" figures untouched. Validates R2.8, R4.1, R4.2, R4.3, R4.4.
      - Property 16: Sealing is idempotent and never rewrites a row (`numRuns: 25`, in-memory insert-only fake store, real crypto). Validates R4.3, R4.7, R4.8, R4.9, R4.10, R4.11, R4.14, R5.1.
    - Nothing under `src/` imports `scripts/`. The spec 02 import-boundary test passes unchanged.
    - No new environment variable; the Helm chart and `.env.example` are unchanged.
  - Validation: with `DATABASE_URL=postgres://postgres:test@localhost:5432/revenant_test` against `postgres:17-alpine`: `npm run db:migrate`, `npm test` twice in a row, `npm run build && npm run seal-personas` twice (second run all `skipped`, exit 0), then `bash scripts/check.sh`
  - _Requirements: R2.8, R4.1–R4.12, R4.13 (bundle and package.json parts), R4.14, R5.1, R14.5, R14.6, R16.1–R16.3_

- [ ] 5. Run the sealing script in the migrate init container
  - Agent: `platform-dev` · Depends on: 4
  - Before this task: none.
  - Scope: `.dockerignore`, `Dockerfile`, `deploy/helm/revenant/templates/deployment.yaml`, `deploy/helm/revenant/values.yaml`, `deploy/helm/revenant/README.md`, `deploy/helm/revenant/Chart.yaml`
  - Acceptance:
    - `.dockerignore` gets `!scripts/seal-personas*` next to `!scripts/migrate.mjs`, so the builder stage sees the sources. `content/` stays included.
    - The Dockerfile runner stage copies `/app/dist/seal-personas.mjs` to `./scripts/seal-personas.mjs` owned by `1001:1001`, with one sentence in the comment above the migrate copies. No extra `node_modules` copy.
    - The `migrate` init container runs `sh -c` with `node scripts/migrate.mjs && node scripts/seal-personas.mjs` when `demo.sealPersonas` is true and `node scripts/migrate.mjs` alone when false, as in design.md. A non-zero exit from either fails the init container, so `web` doesn't start. `DATABASE_URL` still comes from the existing Secret.
    - `values.yaml` documents `demo.sealPersonas: true` with the design.md comment.
    - Chart `README.md` lists the value in the Values table and adds a short "Demo persona letters" section saying what the step does and that a failure blocks startup.
    - `Chart.yaml` `version` gets a minor bump (`0.2.1` → `0.3.0`, or the next minor after `main`).
    - `.env.example` unchanged; no new variable, secret, port or probe.
    - `helm lint` passes; `helm template` renders the combined command by default and only `node scripts/migrate.mjs` with `--set demo.sealPersonas=false`; no Secret is rendered.
    - `docker build .` succeeds and `scripts/seal-personas.mjs` exists in the image.
  - Validation: `helm template ci deploy/helm/revenant` and `helm template ci deploy/helm/revenant --set demo.sealPersonas=false` (compare the `migrate` command), `docker build .`, then `bash scripts/check.sh`
  - _Requirements: R4.13_

- [x] 6. Demo index, persona cards, demo label and landing link
  - Agent: `frontend-dev` · Depends on: 3
  - Before this task: none.
  - Scope: `src/app/demo/page.tsx`, `src/app/demo/page.test.tsx`, `src/app/demo/*.css` if needed, `src/app/page.tsx`, `src/components/demo/PersonaCard.tsx`, `DemoLabel.tsx`, `dates.ts`, `copy.ts`, `*.module.css` and their `*.test.ts(x)`
  - Acceptance:
    - `/demo` is a server component that renders `DemoLabel`, the heading, the intro note and one `PersonaCard` per `PERSONAS` entry in list order. With an empty list it renders `indexEmpty` and no cards. It makes no database access.
    - `PersonaCard` shows display name, region, "Written as of {date}", "Opens {date}" and a "Break the seal" link to `/demo/personas/{key}`. It receives only list fields.
    - `DemoLabel` and the intro note come before the first card in document order, so they are visible without scrolling on a 360 by 640 viewport.
    - `dates.ts`: `formatCalendarDate` and `formatUtcDate` with `Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })`.
    - `components/demo/copy.ts` holds the design.md Demo_Index strings (`demoLabel` to `indexEmpty`). Components hold no user-facing literals.
    - `src/app/page.tsx` gets one `<Link href="/demo">` with the text "Open the demo letters" after the last paragraph, and its "no call-to-action link" comment is updated.
    - Tests (with `renderToStaticMarkup`, no DOM library):
      - The index renders exactly `PERSONAS`, in order (R16.5). A two-persona list passed through props renders two cards (R1.4).
      - The empty state renders with no cards.
      - Cards contain no payload strings (letter text, figure values, question text).
      - The landing page links to `/demo` with text containing "demo".
      - Copy scan of `components/demo/copy.ts`: no `!`, no sentence over 25 words, no `tone.md` clichés, and every error or empty-state string names an action.
      - No JSX text nodes made of letters in `src/components/demo` and `src/app/demo` `.tsx` files.
      - Property 21: Calendar dates don't depend on the viewer's timezone (runs with `TZ` set to `UTC`, `Pacific/Kiritimati` and `America/Adak`). Validates R6.3, R10.2, R13.3.
    - If `.tsx` tests don't compile under the current Vitest config, stop and ask; `vitest.config.ts` is platform-dev's.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R1.4, R5.3, R6.1–R6.8, R15.1–R15.4, R16.5_

- [ ] 7. Persona route, opening flow, recall step and reveal shell
  - Agent: `frontend-dev` · Depends on: 2, 3, 6
  - Before this task: spec 02-sealed-letters tasks 2 and 4 are on `main` (crypto API and the letter, secret and openings routes). Blocked by #29, #31.
  - Scope: `src/app/demo/personas/[key]/page.tsx`, `src/app/demo/personas/[key]/not-found.tsx` and their tests, `src/components/demo/copy.ts` (add not-found strings), `src/components/reveal/opening-machine.ts`, `api.ts`, `useOpeningFlow.ts`, `OpeningFlow.tsx`, `StillSealed.tsx`, `SealIntact.tsx`, `FlowError.tsx`, `RecallStep.tsx`, `Reveal.tsx`, `RememberedAnswers.tsx`, `copy.ts`, `reveal.module.css`, `import-boundary.test.ts` and their `*.test.ts(x)`
  - Acceptance:
    - `/demo/personas/[key]` awaits `params`, looks the key up in `PERSONAS`, calls `notFound()` if missing, and otherwise renders `DemoLabel` and `<OpeningFlow letterId=… personaName=… />` with the letter ID from the list only. `not-found.tsx` shows `notFoundTitle`, `notFoundBody` and a link back to `/demo`, and makes no API request.
    - `opening-machine.ts` implements `FlowState`, `FlowEvent` and `reduce` with the design.md state machine and rules: `START` only in the initial, `unreachable` and `sealed` states; recall only after `verified`; `SUBMIT` and `RETRY_POST` ignored in `submitting`; `RETRY_POST` resends the same `sealed` ciphertext and nonce; `reveal` only from `POST_OK` in `submitting`, entered at stage 1; `ADVANCE` adds one stage up to 3; `SHOW_ALL` sets 3. Error states carry no payload.
    - `api.ts` uses only `/api/letters/${id}`, `/api/letters/${id}/secret` and `/api/openings`, with `cache: "no-store"`, `credentials: "same-origin"`, `referrerPolicy: "no-referrer"`, and validates each response body with Zod; a malformed body maps to `unreachable`.
    - `useOpeningFlow.ts` loads crypto only with `await import("@/lib/crypto")`, parses `PUBLIC_DEMO_BACKUP_KEY` with `parseBackupKey`, calls `openLetter`, and encrypts the record from `buildRecallRecord` with `encryptOpeningRecord` before posting `{ letterId, ciphertext, nonce }`. A `useRef` guard starts one attempt per mount, including under Strict Mode.
    - Views: `StillSealed` shows the opening date and time remaining and a "Try again" control at zero; `SealIntact` shows `sealIntact` and "Begin" before any question; `FlowError` shows distinct copy per error kind; `RecallStep` is a `<form noValidate>` with one `<fieldset>` per question (legend = sealed text, input with `inputMode="decimal"`, unit beside it, "No answer" checkbox, inline error), submit disabled while posting.
    - `Reveal.tsx` renders the staged shell with the next-stage button and "Show everything" while a stage is hidden, and stage 1 `RememberedAnswers` (question text, unit, "Your answer: …" or "No answer", no provenance, no comparison). Stages 2 and 3 render nothing yet; task 8 fills them.
    - `components/reveal/copy.ts` holds the design.md opening, still sealed, verification, error, recall and stage 1 strings. `reveal.module.css` has `:focus-visible` with a 2 px ink outline and a `prefers-reduced-motion: reduce` block setting `transition: none` and `animation: none`. State is memory-only.
    - Tests (stubbed `fetch`, a guard fails any unstubbed call, `renderToStaticMarkup`, no DOM library):
      - One test per error kind with distinct copy and no payload strings (R7.6–R7.9).
      - `verification_failed` renders no letter text, recall question or figure (R16.4).
      - A failed or non-201 POST shows the retry control and no reveal (R16.4).
      - No letter text and no figure render before the record is stored (R16.4).
      - Every request URL starts with `/api/`, and the only POST body has exactly `letterId`, `ciphertext` and `nonce`.
      - Unknown persona key calls `notFound()` with no `fetch`.
      - Source scan finds no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `console.`, `history.` or `dangerouslySetInnerHTML` in `src/components/reveal` and `src/components/demo`.
      - Copy scan of `components/reveal/copy.ts` per R15.2–R15.4, and no JSX letter text nodes in the new `.tsx` files.
      - `import-boundary.test.ts`: server files under `src/app/demo/**`, walked transitively and stopping at `"use client"` modules, never reach `src/lib/crypto`; no file in `src/components/**` statically imports `@/lib/crypto`; nothing in `src/components/reveal` imports `src/lib/recall/generate`. The spec 02 boundary test passes unchanged.
      - Property 17: Nothing is revealed before the answers are stored. The reducer clauses in full; the rendering clause for every state this task renders. Validates R7.1, R7.5, R7.6, R7.7, R8.1, R8.6, R8.7, R8.9, R9.1, R9.4.
    - No change to `src/middleware.ts` or `src/lib/security-headers.ts`, and no route handler added or changed.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R2.9, R3.4, R3.8, R5.4, R5.5, R7.1–R7.10, R8.1–R8.9, R9.2–R9.4, R9.6, R14.1–R14.4, R14.6, R14.7, R15.1–R15.4, R16.1, R16.4_

- [ ] 8. Reveal: letter view, figures then vs now, fixture labels
  - Agent: `frontend-dev` · Depends on: 1, 7
  - Before this task: spec 02-demo-figures task 2 is on `main` (`DEMO_FIGURES`, `thenAndNow`, `isFixtureFigure`). Blocked by #39.
  - Scope: `src/components/reveal/Reveal.tsx`, `SealedLetter.tsx`, `FiguresThenNow.tsx`, `FigureLine.tsx`, `ChangeLine.tsx`, `FixtureNote.tsx`, `copy.ts` (add reveal strings), `reveal.module.css` and their `*.test.ts(x)`, plus the Property 17 test file from task 7
  - Acceptance:
    - `Reveal.tsx` renders stage 2 `SealedLetter` and stage 3 `FiguresThenNow`, one at a time, in order; "Show everything" renders all three at once. Stage changes come only from the judge's controls. Each stage fades in over 600 ms, instantly under reduced motion, and focus moves to its heading.
    - `SealedLetter` shows "Written as of {date}" (when the payload has `written_as_of`), the demo letter label (always), "Sealed for the demo on {sealedAt}" from the header, then the letter text in a `<p>` with `white-space: pre-wrap`. No added commentary.
    - `FiguresThenNow` shows one entry per payload figure in payload order with the metric display name. Then figures come only from the payload. The now figure is `thenAndNow(metricId, sealedAt.slice(0, 10), DEMO_FIGURES).now`; a missing one shows `nowUnavailableUnknown` or `nowUnavailableEmpty` and no change.
    - `computeChange` decides comparability. Not comparable shows both figures with their own periods, `notComparable` and the reason sentence, including `reason.unreadable_period`: "A figure's period could not be read, so no change is shown." Comparable shows the `formatChange` line and the formula line.
    - `FigureLine` holds value, unit, period, region and the label in one element, then `<details><summary>Source</summary>` with source, series ID and an `<a href={source_url} rel="noreferrer noopener" target="_blank">`. Labels: `fixture data` for fixture figures (never "historical record"); `historical record, retrieved {UTC date}` for non-fixture then figures; `retrieved {date}` for non-fixture now figures. A change line with a fixture input carries `fixture data`. `FixtureNote` appears once at the top of stage 3 when any shown figure is a fixture.
    - A rescaled series shows the rescaled value and unit with the `rescaled` note.
    - Rise and fall share elements and classes; the only colour is ink. Labels use AA tokens from `globals.css`; the fixture label is ink text in a 1 px ink border.
    - `copy.ts` gains the design.md reveal strings (`stage2Title` to `reason.no_newer_figure`). Direction words come only from `format-change.ts`.
    - Tests (`renderToStaticMarkup`, no DOM library):
      - Every rendered fixture figure has a visible "fixture data" label next to it (R16.4).
      - Computed contrast ratios for the text and label token pairs in `globals.css` are at least 4.5:1.
      - Copy scan of the new strings per R15.2–R15.4, and no JSX letter text nodes in the new `.tsx` files.
      - Extend Property 17's rendering clause: letter text only in `reveal` at stage ≥ 2, figure values only at stage 3.
      - Property 18: Letter text is shown literally. Validates R10.1, R10.4.
      - Property 19: Every figure shows its provenance and the right label. Validates R11.1, R11.2, R11.3, R13.1, R13.2, R13.3, R13.4, R13.5.
      - Property 20: A rise and a fall render the same markup. Validates R11.8, R16.4.
    - No network request for figures; `DEMO_FIGURES` is a static import.
  - Validation: `bash scripts/check.sh` (`npm run lint && npm run typecheck && npm test && npm run build`)
  - _Requirements: R9.1, R9.4–R9.7, R10.1–R10.5, R11.1–R11.10, R13.1–R13.6, R15.1–R15.4, R16.4_

## Notes

Two changes from the design.md task split plan, so every task wires in what it adds and nothing is left orphaned:

- The persona route `/demo/personas/[key]` and its not-found page move from task 6 to task 7, because the route renders `OpeningFlow`. Task 7 therefore depends on task 6 (for `DemoLabel` and the demo copy module), and tasks 4 and 6 form one wave, tasks 5 and 7 the next.
- Task 7 adds the `Reveal` shell with stage 1 (`RememberedAnswers`) so the `reveal` state renders something from the start. Task 8 adds stages 2 and 3 and extends the Property 17 test.

Task 5 is what makes the demo appear on the deployed site. Until it merges, the owner can run `npm run build && DATABASE_URL=… npm run seal-personas` against a test database.

## Task Dependency Graph

Dependencies: 2 → 3, 2 → 4, 3 → 4, 4 → 5, 3 → 6, 2 → 7, 3 → 7, 6 → 7, 1 → 8, 7 → 8. Tasks 1 and 2 can start together; 4 (crypto-dev) runs alongside 6, and 5 (platform-dev) alongside 7. Cross-spec prerequisites are in each task's "Before this task" line and are held by the owner.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3"] },
    { "id": 2, "tasks": ["4", "6"] },
    { "id": 3, "tasks": ["5", "7"] },
    { "id": 4, "tasks": ["8"] }
  ]
}
```
