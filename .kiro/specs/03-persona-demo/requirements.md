# Requirements Document

Spec: 03 Persona demo

## Introduction

This spec delivers Demo 1 from `product.md`: the persona demo at `/demo`, the must-have for judges. A judge picks a persona, breaks the seal, answers the sealed recall questions, and then sees, in this order, what they answered, what the persona wrote, and the figures then vs now. There is no passkey.

The first release has one US persona. Its letter is written as of a date in the US window and opens on election day, 2024-11-05, which is already past, so it opens right away. Its figures are US petrol and diesel from `DEMO_FIGURES` (the fixture in `src/lib/figures/demo`, spec 02-demo-figures). More personas and real data come later. Adding a persona must be a content-only change.

The spec covers:

- the recall question generator in `src/lib/recall`;
- the persona content and the committed persona list;
- the persona sealing script under `scripts/seal-personas*` and how it runs against the deployed database;
- the then-vs-now change and comparability check in `src/lib/figures`;
- the `/demo` pages and the reveal;
- a link from the landing page into `/demo`.

It builds on spec 02-sealed-letters (seal format, crypto, `storePersonaLetter`, the letter, secret and openings routes) and spec 02-demo-figures (catalogue, fixture, loader, `thenAndNow`, `isFixtureFigure`). It follows `product.md`, `data-integrity.md`, `neutrality.md`, `tone.md`, `crypto.md`, `tech.md` and `structure.md`.

The persona letter text draft belongs in the design, for the owner's review. These requirements state only the rules it must meet.

## Out of scope

Passkeys and PRF, the live demo (Demo 2), real data fetching and the real-data file, EU and Sweden personas, letter cards, backup key cards, PDF, `.ics`, any route that seals a letter over HTTP, rate limiting, and analytics.

## Glossary

- **Persona**: A fictional person whose letter is pre-sealed for the demo. Personas have no self-reported figures.
- **Persona_List**: The committed file listing the current persona set: for each persona its key, display name, region, letter ID, `written_as_of` date, `opens_at`, the ordered list of tracked metrics (each a metric ID paired with its `recall_subject`), and the path of its letter text. It is the only source of which personas `/demo` shows.
- **recall_subject**: A short phrase for one tracked metric in the Persona_List, such as "a gallon of regular gasoline", that the Recall_Generator puts into that metric's recall question.
- **Persona_Letter**: A letter for one persona, sealed as a payload version 1 envelope with the published demo key and stored in `demo_letters` with kind `persona`.
- **Sealing_Script**: The script under `scripts/seal-personas*` that builds, seals and stores the Persona_Letters in the Persona_List.
- **Recall_Generator**: The pure code in `src/lib/recall` that writes recall questions from metric definitions and their `recall_subject` strings at sealing time.
- **Recall_Record**: The JSON value holding a judge's recall answers, encrypted with the opening records key and stored through `POST /api/openings`.
- **Demo_Index**: The `/demo` page that lists the personas in the Persona_List.
- **Opening_Flow**: The browser code and pages that fetch a Persona_Letter, verify and decrypt it, run the recall step and show the reveal.
- **Reveal**: The ordered display after the Recall_Record is stored: the judge's answers, then the letter text, then the figures then vs now.
- **Then_Figure**: A figure sealed inside the payload. It is read only from the decrypted payload.
- **Now_Figure**: The latest figure for the same series in `DEMO_FIGURES`, found in the browser at opening.
- **Change_Calculator**: The pure code in `src/lib/figures` that decides whether a Then_Figure and a Now_Figure are comparable and, if they are, computes the change between them.
- **Comparable**: A Then_Figure and a Now_Figure are comparable when both are `official`, their `source`, `series_id`, `unit` and `region` are equal, both periods are a real `YYYY-MM-DD` date or a real `YYYY-MM` month, and the Now_Figure's period end is later than the Then_Figure's period end.
- **Fixture_Figure**: A figure for which `isFixtureFigure` returns `true`.
- **Demo_Key**: `PUBLIC_DEMO_BACKUP_KEY` from `src/lib/crypto`, the published backup key for demo letters only.
- **Verification_Result**: The outcome of `openLetter`'s envelope hash check: passed, or `verification_failed`.
- **Persona_Window**: For the US, the 12 months up to and including election day: 2023-11-05 to 2024-11-05 inclusive.

## Requirements

### R1. Persona list and content

**User story:** As the owner, I want personas to live in committed content files, so adding a persona or replacing its data needs no code change.

1. THE Persona_List SHALL be a committed file that holds, for each persona, a unique key, a display name, a region, a letter ID, a `written_as_of` date, an `opens_at` timestamp, the ordered list of metrics the persona tracks (each entry a metric ID and its `recall_subject`), and the path of a committed plain-text letter file.
2. THE Persona_List SHALL hold exactly one persona in this spec: a US persona whose `written_as_of` is inside the US Persona_Window, whose `opens_at` is `2024-11-05T00:00:00.000Z`, and whose tracked metrics are the two `DEMO_FIGURES` fixture series for US petrol and US diesel, each with its `recall_subject`.
3. THE Persona_List SHALL give each persona a letter ID that is a 22-character unpadded base64url string decoding to exactly 16 bytes, generated once from a cryptographic random source and then committed, and unique across the Persona_List.
4. WHEN a persona entry and its letter text file are added to the Persona_List, THE Sealing_Script SHALL seal and store that persona's Persona_Letter, THE Demo_Index SHALL list that persona, and THE Opening_Flow SHALL open that persona's letter, with no change to any TypeScript or TSX file.
5. IF the Persona_List has a duplicate key or letter ID, a letter ID that breaks criterion 3, a `written_as_of` that is not a real `YYYY-MM-DD` calendar date, an `opens_at` that is not a millisecond-precision UTC timestamp ending in `Z`, an `opens_at` that is not later than 00:00 UTC on the `written_as_of` date, an empty metric ID list, a metric ID listed twice for the same persona, a metric ID that is not in `DEMO_FIGURES`, a `recall_subject` that has no non-whitespace character, is longer than 100 characters, or breaks the R2.4 rules, or a letter text path that does not point to an existing file, THEN a test in `npm test` SHALL fail with a message naming the persona key and the field at fault.
6. THE letter text SHALL be plain text of 1 to 5,000 Unicode code points with at least one non-whitespace character, so the sealed payload passes `payloadV1Schema`, and a test in `npm test` SHALL fail with a message naming the persona key if any letter text in the Persona_List breaks this limit.
7. THE letter text SHALL be about everyday life (work, family, bills, plans, hopes), and SHALL contain no mention of elections, voting, parties, candidates, officials, policies, governments or political movements, as checked by the test in criterion 10 and by the owner's review in criterion 9.
8. THE letter text SHALL contain no figure or price, and a test in `npm test` SHALL fail with a message naming the persona key if any letter text contains a digit (0–9) or a currency symbol or currency word (at least: `$`, `€`, `£`, `kr`, dollar, cent, euro, krona, kronor, USD, EUR, SEK). Spelled-out amounts are caught by the owner's review in criterion 9.
9. THE Persona_List and letter text SHALL avoid stereotypes tied to region, class, age or background, and SHALL pass the copy test in `neutrality.md` in the owner's review before the persona is sealed.
10. A test in `npm test` SHALL fail with a message naming the persona key and the matched term if any letter text in the Persona_List contains, case-insensitively and at the start of a word, any term from a committed list of election and party terms (at least: election, vote, voting, ballot, campaign, candidate, party, parties, Democrat, Republican, president, congress, senate, government, policy, policies), so inflected forms such as "elections", "voter" and "presidential" also match.

### R2. Recall questions

**User story:** As a judge, I want the letter to ask me how I remember the prices before it shows me anything, so the gap between memory and record is mine to see.

1. THE Recall_Generator SHALL be a pure function in `src/lib/recall` that takes an ordered list of 0 to 20 metric definitions, each paired with its `recall_subject`, and returns one recall question per metric definition, in the same order. An empty list SHALL return an empty list.
2. THE Recall_Generator SHALL give each question `answer_type` `number`, a `metric_id` equal to its metric definition's ID, an ID unique within the returned list, and text of 1 to 500 characters.
3. THE Recall_Generator SHALL build each question text only from the paired `recall_subject` and the metric definition's `unit`, in the form "What do you think {recall_subject} cost then?" (for example "What do you think a gallon of regular gasoline cost then?"). Changing a definition's `display_name`, `region`, `source` or `series_id` SHALL NOT change the text. The unit is shown next to the answer input as set out in R8.2.
4. THE `recall_subject` and the question text the Recall_Generator produces SHALL contain no figure `value`, no figure period, no `source` or `series_id` string from the payload, no exclamation mark, and none of these words as whole words, case-insensitive: more, less, higher, lower, rise, rose, risen, fall, fell, fallen, increase, increased, decrease, decreased, up, down, cheaper, dearer, soar, soared, drop, dropped.
5. WHEN the Recall_Generator receives the same metric definitions and `recall_subject` strings twice, THE Recall_Generator SHALL return deeply equal questions (deterministic output).
6. IF the Recall_Generator receives more than 20 metric definitions, two definitions with the same ID, or a `recall_subject` that has no non-whitespace character, is longer than 100 characters, or breaks criterion 4, THEN THE Recall_Generator SHALL throw an error naming the problem and return no questions.
7. FOR ALL generated lists of 0 to 20 valid metric definitions with unique IDs, each paired with a generated valid `recall_subject` (1 to 100 characters, at least one non-whitespace character, meeting criterion 4), a payload holding those definitions and the generated questions SHALL pass `payloadV1Schema` (property test, at least 100 runs).
8. THE Sealing_Script SHALL write the generated questions into the payload's `recall_questions` at sealing time.
9. THE Opening_Flow SHALL show each question's text exactly as read from the decrypted payload, in payload order, and SHALL NOT import or call the Recall_Generator.
10. THE question wording SHALL use second person and follow `tone.md`, and the owner SHALL confirm it passes the `neutrality.md` copy test before any Persona_Letter is sealed.

### R3. Recall record format

**User story:** As the reader, I want my recall answers stored encrypted in a defined shape, so a later version of Revenant can still read them.

1. THE Recall_Record SHALL be defined by a strict, versioned Zod schema that holds a version number equal to `1` and, for each recall question in the payload, the question ID and either the judge's answer as a decimal string or an explicit "no answer", and SHALL reject any object that contains a key the schema does not define.
2. THE Recall_Record SHALL hold exactly one entry for every recall question in the payload, with no duplicate question IDs and no entry for any question ID that is not in the payload.
3. THE Recall_Record schema SHALL accept a number answer only if, after leading and trailing whitespace is removed, it is a non-negative decimal string of 1 to 40 characters made of one or more digits and an optional fractional part of a dot followed by one or more digits.
4. IF a judge's input for a recall question is empty after leading and trailing whitespace is removed and the judge has not selected that question's "no answer" control, THEN THE Opening_Flow SHALL treat the input as invalid under R8.4 and SHALL NOT record that question as "no answer". A question is recorded as "no answer" only through the explicit control in R8.3.
5. IF a value fails the Recall_Record schema (wrong version, missing or extra question ID, duplicate question ID, unknown key, or a number answer that breaks criterion 3), THEN THE Recall_Record schema SHALL reject the value with a validation error and SHALL NOT return a partial record.
6. FOR ALL valid Recall_Records, encrypting with `encryptOpeningRecord`, then decrypting with `decryptOpeningRecord` and parsing with the schema, SHALL return a value deeply equal to the original (round trip, property test, at least 100 runs).
7. THE Recall_Record SHALL store each number answer as the judge typed it with only leading and trailing whitespace removed, with no rounding, reformatting or unit conversion.
8. WHILE the Reveal shows recall answers, THE Opening_Flow SHALL label each one as the judge's own answer and SHALL NOT show a source, series ID, `source_url` or `retrieved_at` next to it.

### R4. Sealing persona letters

**User story:** As the owner, I want one command that seals the current personas into the deployed database, so the demo works after every deploy without manual steps that can go wrong.

1. WHEN the Sealing_Script runs, THE Sealing_Script SHALL, for each persona in the Persona_List, build a payload version 1 holding the letter text read from the persona's letter text path, `written_as_of`, the metric definitions of the tracked series, one Then_Figure per tracked series, and the questions the Recall_Generator returns for those metric definitions, each paired with its `recall_subject` from the Persona_List.
2. THE Sealing_Script SHALL take each Then_Figure from `DEMO_FIGURES` with `thenAndNow(metricId, written_as_of, DEMO_FIGURES).then`, and SHALL copy that figure into the payload with no field changed, rounded, rescaled or added.
3. IF `thenAndNow` returns a missing "then" result for any tracked series of a persona, THEN THE Sealing_Script SHALL report that persona as failed with a message naming the persona key and metric ID, SHALL store nothing for that persona, and SHALL exit with a non-zero status as set out in criterion 14.
4. THE Sealing_Script SHALL take each metric definition in the payload from the series of the same ID in `DEMO_FIGURES`, copied with only the fields in `metricDefinitionV1Schema`.
5. THE Sealing_Script SHALL seal each payload with `sealLetter`, using the Persona_List letter ID, a fresh 32-byte server secret from a cryptographic random source, the Demo_Key, `sealedAt` set to the current UTC time, and the persona's `opens_at`.
6. THE Sealing_Script SHALL store each sealed envelope with `storePersonaLetter` in `demo_letters` with kind `persona`.
7. WHEN the Sealing_Script runs and a persona's letter ID already exists in `demo_letters`, THE Sealing_Script SHALL open the stored letter with the Demo_Key and its stored server secret, compare the decrypted payload with the payload it would build, and skip the persona without changing any row if the two payloads are deeply equal (same keys, same values, same array order).
8. IF a persona's letter ID already exists in `demo_letters` and either the stored letter fails to open (including a Verification_Result of `verification_failed`) or the stored payload differs from the payload the Sealing_Script would build, THEN THE Sealing_Script SHALL report that persona as failed with a message saying its stored letter can't be reused and it needs a new letter ID, SHALL change no row, and SHALL exit with a non-zero status as set out in criterion 14.
9. IF a persona's letter ID exists in `letters` (real letters), THEN THE Sealing_Script SHALL report that persona as failed with a message naming the letter ID collision, SHALL store nothing for that persona, and SHALL exit with a non-zero status as set out in criterion 14.
10. WHEN the Sealing_Script runs a second time in a row against the same database with an unchanged Persona_List and letter texts, THE Sealing_Script SHALL report every persona as skipped, store no row, and exit with status 0.
11. THE Sealing_Script SHALL print, for each persona, only the persona key, the letter ID, the result (stored, skipped or failed) and, for a failure, the reason from criteria 3, 8, 9 or 12, and SHALL NOT print or log the server secret, the DEK, the envelope ciphertext, the letter text or `DATABASE_URL`.
12. THE Sealing_Script SHALL read the database location only from `DATABASE_URL` and SHALL add no new environment variable. IF `DATABASE_URL` is unset or empty, THEN THE Sealing_Script SHALL exit with a non-zero status before storing anything.
13. THE Sealing_Script SHALL run from the published app image against the deployed database, and SHALL meet all of these:
    - THE build SHALL bundle the Sealing_Script into a single self-contained JavaScript file, including the Persona_List, the letter texts and `DEMO_FIGURES`, that runs with plain `node` in the app image, with no TypeScript runtime and no devDependency needed at runtime.
    - THE Sealing_Script SHALL run in the existing `migrate` init container of the web Deployment (`deploy/helm/revenant/templates/deployment.yaml`), immediately after `node scripts/migrate.mjs` completes successfully, so ordering after migrations needs no Job or Helm hook.
    - IF the migrations or the Sealing_Script exit with a non-zero status, THEN the `migrate` init container SHALL fail, and the web container SHALL NOT start.
    - Any bundler added for this SHALL be a devDependency pinned to an exact version (no range operator), named in the design with the reason.
    - THE Dockerfile change that copies the bundle into the image and the Helm chart change to the `migrate` init container SHALL be platform-dev tasks. Any chart change SHALL update the chart's `values.yaml` and README in the same change and bump the chart `version`. IF the change touches `.env.example`, THEN the same rule applies.
14. IF the Sealing_Script fails for one or more personas, THEN THE Sealing_Script SHALL still process and report every other persona in the Persona_List, SHALL keep rows stored for other personas, and SHALL exit with a non-zero status after the last report. WHEN every persona is stored or skipped, THE Sealing_Script SHALL exit with status 0.

### R5. Immutability and persona replacement

**User story:** As the owner, I want demo letters to stay as sealed, so replacing fixture data with real data never rewrites history.

1. THE Sealing_Script and the Opening_Flow SHALL issue no `UPDATE`, `DELETE` or `TRUNCATE` statement on `demo_letters`, `letters` or `openings`. The only write the Sealing_Script makes is an insert through `storePersonaLetter`, and the only write the Opening_Flow makes is an insert through `POST /api/openings`.
2. IF the payload the Sealing_Script would build for a persona differs from the stored payload for that persona's letter ID under the comparison in R4.7 (for example fixture figures replaced by real figures, or edited letter text), THEN THE Persona_List SHALL give that persona a new letter ID that meets R1.3, has never been used for any persona before, and exists in neither `demo_letters` nor `letters`. The row stored under the old letter ID SHALL stay in `demo_letters`, and its envelope and envelope hash SHALL be byte-for-byte the same before and after the new letter is sealed.
3. THE Demo_Index SHALL list only the personas in the committed Persona_List, in Persona_List order, and SHALL NOT query or list rows of `demo_letters`.
4. WHEN the `/demo` letter route receives a persona key that is in the Persona_List, THE Opening_Flow SHALL take the letter ID for that key from the Persona_List only, and SHALL request no letter ID from any other source.
5. IF the `/demo` letter route receives a persona key that is not in the Persona_List, THEN THE Opening_Flow SHALL show a not-found page and SHALL make no request to `GET /api/letters/{id}`, its secret route or `POST /api/openings`. A `demo_letters` row whose letter ID is no longer in the Persona_List SHALL NOT be reachable through any `/demo` page.

### R6. Demo index and landing link

**User story:** As a judge, I want to find the demo from the front page and pick a persona, so I can try the opening experience without waiting years.

1. THE landing page SHALL show a link to `/demo` whose visible text contains the word "demo" and says that it opens the demo, without puns or exclamation marks.
2. THE Demo_Index SHALL show exactly one card per persona in the Persona_List, in the order the Persona_List gives, with the persona's display name, region, the `written_as_of` date labelled "written as of", the opening date taken from `opens_at`, and a "Break the seal" control.
3. THE Demo_Index SHALL show the `written_as_of` date and the opening date as day, full month name and four-digit year (for example "5 November 2024"), matching the calendar dates in the Persona_List whatever the viewer's timezone.
4. THE Demo_Index SHALL say, in plain words visible without scrolling on a 360 by 640 CSS pixel viewport, that the personas are fictional, that their letters were prepared later as a demo, and that no passkey is needed.
5. THE Demo_Index and every Opening_Flow page SHALL carry a "Demo" label that is visible without scrolling on a 360 by 640 CSS pixel viewport.
6. THE persona cards SHALL show nothing from inside the sealed payload: no letter text, figures, metric names or recall questions.
7. WHEN a judge activates a persona card's "Break the seal" control, THE Demo_Index SHALL open the Opening_Flow for that persona's letter ID without asking for a passkey or a key.
8. IF the Persona_List contains no personas, THEN THE Demo_Index SHALL show an empty-state message, in the voice of `tone.md`, saying that no demo letters are available, and SHALL show no persona cards.

### R7. Breaking the seal

**User story:** As a judge, I want "Break the seal" to open the real sealed letter in my browser, so the demo shows the actual mechanism.

1. WHEN the judge activates "Break the seal", THE Opening_Flow SHALL request `GET /api/letters/{id}` for the persona's letter ID from the Persona_List, and SHALL ignore further activations of the control until that opening attempt has ended in a displayed result or error.
2. WHILE the letter route returns `status` `sealed`, or the secret route refuses the server secret because its opening date has not been reached, THE Opening_Flow SHALL show a "still sealed" state with the opening date and the time remaining, and SHALL show nothing about the contents.
3. WHEN the letter route returns `status` `openable`, THE Opening_Flow SHALL request `GET /api/letters/{id}/secret`, parse the Demo_Key with `parseBackupKey`, and call `openLetter` with the envelope, envelope hash, server secret and parsed Demo_Key, all in the browser.
4. THE Opening_Flow SHALL make no request to any origin other than the app's own origin, and SHALL send no key, plaintext, answer or payload field to the server other than the encrypted Recall_Record through `POST /api/openings`.
5. WHEN `openLetter` returns `ok`, THE Opening_Flow SHALL show a statement that the Verification_Result passed and the sealed contents have not changed since sealing (for example "Your seal is intact. Nothing here has changed since it was sealed."), and SHALL show it before any recall question is displayed.
6. IF `openLetter` returns `verification_failed`, THEN THE Opening_Flow SHALL say the letter failed verification and cannot be trusted, and SHALL show no letter text, figures or recall questions.
7. IF `openLetter` returns `wrong_key`, `tampered`, `unsupported_format`, `invalid_payload` or `invalid_input`, THEN THE Opening_Flow SHALL show a message specific to that error kind, different from the messages for the other kinds, that says what happened and what the judge can do, and SHALL show no part of the payload.
8. IF the letter route returns 404, THEN THE Opening_Flow SHALL say the demo letter has not been placed yet and that the judge can try again later.
9. IF any request fails with a network error, a 5xx status, or a 4xx status not covered by criteria 2 and 8, THEN THE Opening_Flow SHALL say the letter could not be reached, show no part of the payload, and offer a retry control that restarts the opening attempt from criterion 1.
10. THE Opening_Flow SHALL keep the DEK, opening records key, server secret, decrypted payload and Recall_Record only in memory, and SHALL NOT write any of them to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL or console output.

### R8. Recall step

**User story:** As a judge, I want to answer the recall questions before anything is revealed, so my memory is recorded before the record can influence it.

1. WHEN `openLetter` returns `ok` and the seal-verified message from R7.5 has been shown, THE Opening_Flow SHALL show all recall questions from the decrypted payload, in payload order, and SHALL show no letter text and no figure until `POST /api/openings` has returned 201 for the Recall_Record.
2. THE Opening_Flow SHALL show, for each number question, the question text and the unit of its metric definition next to the input, and SHALL show no figure value, no period, no source and no hint about the answer.
3. THE Opening_Flow SHALL give each question an explicit "no answer" control, and WHEN the judge selects that control for a question, THE Opening_Flow SHALL record that question as "no answer" in the Recall_Record, whatever its input field holds.
4. IF the judge submits while any question has neither its "no answer" control selected nor a typed answer that is a valid number answer under R3.3 (an empty field counts as not valid), THEN THE Opening_Flow SHALL show, next to each such question, a message that the answer needs to be a number, such as 3.50, or can be marked "no answer". It SHALL keep every typed answer as entered and SHALL NOT send the Recall_Record.
5. WHEN the judge submits and every question has a valid number answer or "no answer", THE Opening_Flow SHALL encrypt the Recall_Record with `encryptOpeningRecord` and the opening records key from `openLetter`, and send it to `POST /api/openings` with the letter ID.
6. WHEN `POST /api/openings` returns 201, THE Opening_Flow SHALL start the Reveal.
7. IF `POST /api/openings` returns any status other than 201 or fails with a network error, THEN THE Opening_Flow SHALL say the answers could not be recorded and offer a retry control that resends the same encrypted record. It SHALL keep the judge's answers and SHALL NOT start the Reveal.
8. WHEN a judge breaks the seal of the same persona again, THE Opening_Flow SHALL run the recall step again and store a new Recall_Record as a new opening.
9. WHILE a `POST /api/openings` request is in flight, THE Opening_Flow SHALL disable the submit and retry controls, so that one submission sends at most one Recall_Record.

### R9. Reveal order and pacing

**User story:** As a judge, I want the reveal to land one part at a time, so I read my memory, then the letter, then the numbers.

1. WHEN the Recall_Record has been stored, THE Opening_Flow SHALL start the Reveal and show its three parts one at a time in this order: the judge's answers, then the letter text, then the figures then vs now, and SHALL NOT make any part visible before the part that precedes it.
2. THE Opening_Flow SHALL show each of the judge's answers next to its question's full sealed text and unit, and SHALL show "no answer" for any question the judge marked "no answer" with the control in R8.3.
3. THE Opening_Flow SHALL NOT compute, show or label any difference, accuracy or grade between a judge's answer and any figure.
4. WHILE any part of the Reveal is not yet visible, THE Opening_Flow SHALL show a visible control that can be reached and activated by keyboard and that, when activated, shows all three parts at once in the same order as criterion 1.
5. WHERE the browser reports `prefers-reduced-motion: reduce`, THE Opening_Flow SHALL show the Reveal without animated transitions and SHALL keep the order from criterion 1.
6. THE Opening_Flow SHALL let a judge reach and activate every control in the recall step and the Reveal using the keyboard alone, and SHALL show a visible focus indicator on the focused control.
7. THE Opening_Flow SHALL render body text, figures, labels and controls in the recall step and the Reveal at WCAG 2.2 AA contrast or higher: at least 4.5:1 for normal text and 3:1 for large text and control boundaries.

### R10. Letter display and demo labelling

**User story:** As a judge, I want it to be clear this is a demo letter written as of a past date, so I am never told something false about when it was sealed.

1. THE Opening_Flow SHALL show the letter text as plain text with every line break kept, and SHALL show any HTML tags or markup characters in the letter text as literal characters, never rendered as formatting, links or elements.
2. WHERE the payload carries `written_as_of`, THE Opening_Flow SHALL show the label "written as of" followed by that date as a calendar date with day, month name and year and no time of day, in the same view as the letter text and visible before the judge scrolls past the start of the letter text.
3. THE Opening_Flow SHALL NOT describe `written_as_of` as the date the letter was sealed. WHERE the Opening_Flow shows a sealing date, it SHALL be the header's `sealedAt`.
4. THE Opening_Flow SHALL show the letter text character for character as decrypted. It SHALL add no summary, commentary or other text inside or around the letter text except the labels required by this requirement.
5. WHEN the Opening_Flow shows a Persona_Letter's text, THE Opening_Flow SHALL show a label saying the letter is a demo prepared later than its "written as of" date, in the same view as the letter text, whether or not the payload carries `written_as_of`.

### R11. Figures then vs now

**User story:** As a judge, I want each figure shown with where it came from and the plain change, so I can check it myself.

1. THE Opening_Flow SHALL show one entry per Then_Figure in the decrypted payload, in payload order. THE order SHALL NOT depend on any value or on the direction of any change.
2. THE Opening_Flow SHALL show in each entry the metric's display name. For the Then_Figure and the Now_Figure it SHALL also show the value, unit, period and region next to the number, plus a link or control that shows the source, series ID and `source_url` after one click or tap.
3. THE Opening_Flow SHALL take each Then_Figure only from the decrypted payload, and SHALL NOT replace it with any figure from `DEMO_FIGURES`.
4. THE Opening_Flow SHALL find each Now_Figure in `DEMO_FIGURES`, bundled with the app, as the figure with the latest period end in the series whose `metric_id` matches the sealed figure's `metric_id`. It SHALL make no network request for figures.
5. IF `DEMO_FIGURES` has no series for a Then_Figure's `metric_id`, or the series has no figures, THEN THE Opening_Flow SHALL show the Then_Figure and show no change. It SHALL also say the current figure is unavailable and give the reason: either the series is not in the catalogue, or the series has no figures.
6. IF the Change_Calculator reports the Then_Figure and Now_Figure as not Comparable, THEN THE Opening_Flow SHALL show both figures with their own periods and show no change. It SHALL also say they are not comparable and name each reason that applies: a figure is not `official`, or `source`, `series_id`, `unit` or `region` differ, or a figure's period could not be read, or the Now_Figure's period end is not later than the Then_Figure's.
7. WHEN the figures are Comparable, THE Opening_Flow SHALL show the change computed by the Change_Calculator, the formula with both input values, and both input periods, for example "+12% · Nov 2024 to Oct 2026". Each input SHALL be linked to its source details as in criterion 2.
8. THE Opening_Flow SHALL render a rise and a fall with the same markup, colour, icon and weight, differing only in the numbers and their sign. Change text SHALL show direction only as R12.9 allows: the sign (`+` or `−`, for example "+0.50" or "−0.50") or one of the words "rose", "fell" or "unchanged". It SHALL contain no evaluative words such as "soared", "plunged", "better" or "worse".
9. THE Opening_Flow SHALL format numbers and dates for the figure's region. It SHALL round only the displayed text, and SHALL pass unrounded values, at full published precision, to the Change_Calculator.
10. WHERE a figure's catalogue series has a display rescale, THE Opening_Flow SHALL show the rescaled value with the rescaled unit and a note that it was rescaled from the published unit. THE US series in this spec have no display rescale.

### R12. Change calculation and comparability

**User story:** As the owner, I want the change formula in one place in `src/lib/figures`, so the formula shown is the formula used.

1. THE Change_Calculator SHALL be a pure function in `src/lib/figures` that takes a Then_Figure and a Now_Figure and returns one of two results: a not-comparable result with a reason, or a change result.
2. IF either figure's `kind` is not `official`, or the two figures differ in `kind`, `source`, `series_id`, `unit` or `region`, THEN THE Change_Calculator SHALL return not comparable, with a reason naming the first failing field in the order `kind`, `source`, `series_id`, `unit`, `region`.
3. IF both figures pass criterion 2 and either figure's period is neither a real `YYYY-MM-DD` date nor a real `YYYY-MM` month, THEN THE Change_Calculator SHALL return not comparable with reason `unreadable_period`.
4. WHEN the figures are Comparable and the Then_Figure's value is not zero, THE Change_Calculator SHALL return a change result containing the difference `now − then`, the percentage change `(now − then) ÷ then × 100`, a formula identifier, and the periods of both inputs.
5. THE Change_Calculator SHALL compute from the figures' decimal value strings without binary floating-point arithmetic. The difference SHALL be exact. The percentage SHALL be exact or carry at least 10 significant digits. Rounding for display SHALL happen only in a separate display formatting function.
6. THE Change_Calculator SHALL NOT read, change or return any figure other than its two inputs, and each input SHALL be deep-equal before and after the call.
7. FOR ALL generated pairs of Comparable figures, the property tests (at least 100 runs) SHALL check that: the difference plus the Then_Figure value equals the Now_Figure value exactly; swapping a rise for the mirror-image fall changes only the sign of the difference; and the result is the same for any decimal value strings that differ only by trailing fractional zeros.
8. FOR ALL generated pairs where either `kind` is not `official`, or the pair differs in one of `kind`, `source`, `series_id`, `unit` or `region`, or either period is neither a real `YYYY-MM-DD` date nor a real `YYYY-MM` month, or the Now_Figure is not newer, the Change_Calculator SHALL return not comparable (property test, at least 100 runs).
9. THE module that formats the change for display SHALL be in `src/lib/figures`. Its output SHALL show direction only through the sign (`+` or `−`) or one of the words "rose", "fell" or "unchanged", and SHALL contain no other word of direction, size or judgement. For a rise and its mirror-image fall, the two outputs SHALL differ only in the sign or direction word.
10. IF the figures are Comparable and the Then_Figure's value is zero, THEN THE Change_Calculator SHALL return a change result containing the difference, the formula identifier and both input periods, and no percentage.
11. IF both figures pass criterion 2, both periods are readable under criterion 3, and the Now_Figure's period end is equal to or earlier than the Then_Figure's period end, THEN THE Change_Calculator SHALL return not comparable with reason `no_newer_figure`.

### R13. Fixture and provenance labels

**User story:** As a judge, I want fake figures marked wherever they appear, so I never take a fixture number for a real price.

1. THE Opening_Flow SHALL call `isFixtureFigure` on every Then_Figure and every Now_Figure it shows, and SHALL show a visible "fixture data" text label next to the value of each figure for which it returns `true`, in the same element that holds the figure's value, period and unit.
2. IF a shown figure is a Fixture_Figure, THEN THE Opening_Flow SHALL show the "fixture data" label in place of the "historical record, retrieved [date]" label, and SHALL NOT call the figure a historical record anywhere on the page.
3. IF a shown Then_Figure is not a Fixture_Figure, THEN THE Opening_Flow SHALL label it "historical record, retrieved [date]", where [date] is the UTC calendar date of the figure's `retrieved_at` written as day, month name and year (for example "30 October 2026"), and SHALL NOT label it "sealed on" any date.
4. IF either input of a shown change result is a Fixture_Figure, THEN THE Opening_Flow SHALL also show the "fixture data" label next to that change result.
5. WHILE at least one figure shown on a page is a Fixture_Figure, THE Opening_Flow SHALL show one note on that page, visible without user interaction, saying the figures are fixture data for building the demo and are not real prices.
6. THE Opening_Flow SHALL render the "fixture data" label and the note in criterion 5 as text, not colour or iconography alone, with a contrast ratio of at least 4.5:1 against their background (WCAG 2.2 AA for normal text).

### R14. Security and privacy on demo pages

**User story:** As the operator, I want the demo pages to keep the same protections as real letter pages, so the demo never teaches a weaker pattern.

1. THE Demo_Index and every page of the Opening_Flow SHALL be served with the Content Security Policy produced by `src/lib/security-headers.ts`, with no origin, directive or source keyword added or relaxed for these pages.
2. WHEN the Demo_Index or any page of the Opening_Flow loads in a browser, THE browser SHALL request scripts, styles, fonts and images only from the page's own origin, and SHALL make no request to any analytics or other third-party origin.
3. THE Demo_Index and every page of the Opening_Flow SHALL be served with the header `Referrer-Policy: no-referrer`, including responses for a letter ID that does not exist.
4. WHILE the Opening_Flow runs, THE Opening_Flow SHALL send the letter text, the recall answers in plaintext, the content key and the Demo_Key to no server in any URL, query string, header or request body. The only recall data it sends is the encrypted Recall_Record.
5. THE `dependencies` section of `package.json` SHALL contain no package that this spec adds. IF a task needs a new runtime dependency, THEN THE design SHALL name the package, pin it to an exact version (no range operator) and give the reason before the task adds it. A bundler for the Sealing_Script under R4.13 goes in `devDependencies`, pinned to an exact version, and is not a runtime dependency.
6. Route handlers, server components, and code under `src/app/api/`, `src/lib/db/` and `src/lib/letter-store/` SHALL NOT import `src/lib/crypto`, directly or through another module. THE Opening_Flow SHALL import `src/lib/crypto` only from modules marked as client components, and the spec 02 import-boundary test SHALL pass unchanged. THE Sealing_Script (`scripts/seal-personas*`) is exempt: it runs as a one-off Node script, not inside the web server, and imports `sealLetter`, `openLetter` and `parseBackupKey` from `src/lib/crypto`, which spec 02-sealed-letters (R3.1) built to run in Node scripts. No route handler, server component or `src/lib/letter-store` module SHALL import the Sealing_Script.
7. THE route handlers added or changed by this spec SHALL NOT insert, update or delete rows in `letters` or `demo_letters` for any HTTP method.

### R15. User-facing copy

**User story:** As the owner, I want all demo copy in one place and in Revenant's voice, so it can be reviewed for tone and neutrality in one pass.

1. THE Demo_Index, the Opening_Flow and the Reveal SHALL take every user-facing string from copy modules in their own feature folders. User-facing strings include headings, button labels, prompts, labels, status text, error text and empty-state text. Layout and component code SHALL contain no user-facing string literals.
2. THE user-facing copy in the copy modules of criterion 1 SHALL address the judge in the second person, SHALL keep each sentence to at most 25 words, SHALL use the product vocabulary from `tone.md` (seal, sealed, open, unseal, letter, record, then, now) for those concepts, and SHALL contain no exclamation marks, no puns, and none of the horror clichés named in `tone.md` (skulls, blood, gore, jump scares, "mwahaha"). Persona_Letter text and published values from figure provenance (unit, region, source names) are not covered by this criterion.
3. THE user-facing copy in the copy modules of criterion 1 SHALL pass the `neutrality.md` copy test. It SHALL name no party, candidate, official, movement or policy. It SHALL describe a change between a Then_Figure and a Now_Figure only with the sign (`+` or `−`) or one of the words "rose", "fell" or "unchanged", as R12.9 allows, with no words that call the change good or bad (for example "soared", "plunged", "finally").
4. IF the Demo_Index, the Opening_Flow or the Reveal shows an error or empty state, THEN THE copy shown SHALL say what happened and name at least one action the judge can take, such as trying again or going back to the Demo_Index.

### R16. Tests

**User story:** As the owner, I want the demo's rules checked in CI, so a broken persona or a mislabelled figure fails before it reaches judges.

1. THE SYSTEM SHALL include tests that run in `npm test` and pass with network access to external hosts disabled; no test SHALL make a request to any host other than the test database.
2. THE SYSTEM SHALL include an integration test, using `describeDb` from spec 02, that runs the Sealing_Script logic twice against the test database and asserts that: the first run stores exactly one `demo_letters` row of kind `persona` per persona in the Persona_List; the second run inserts no row and completes without error; and a run with a changed payload under an existing letter ID reports an error naming that letter ID and leaves every `demo_letters` row unchanged.
3. THE SYSTEM SHALL include a test that opens each sealed Persona_Letter from that integration test with the Demo_Key and asserts that the payload's Then_Figures are deeply equal to the figures `thenAndNow` returns for that persona's `written_as_of`.
4. THE SYSTEM SHALL include component or unit tests that check that: no letter text and no figure is rendered before the Recall_Record is stored; when `POST /api/openings` returns an error response or fails at the network level, a retry control is shown and no part of the Reveal is rendered; when the Verification_Result is `verification_failed`, no letter text, no recall question and no figure from the payload is rendered; every rendered Fixture_Figure has a visible "fixture data" label next to it; and a rise and a fall of equal size render with identical elements, class names and icons, differing only in the numeric text and the sign of the change.
5. THE SYSTEM SHALL include a test that the Demo_Index renders exactly the personas in the Persona_List, in Persona_List order, with no extra or missing entries.

### R17. Task split

**User story:** As the owner, I want the work split by role, so tasks for different roles run in parallel and each PR stays reviewable.

1. THE task list SHALL map each task to exactly one GitHub issue and one PR, and each PR SHALL have fewer than 3,000 changed lines, counted as `max_changed_lines` counts them in `.github/agents.json` (paths in `exclude_from_size` are not counted).
2. THE task list SHALL limit each task's changed files to the paths of one role in `.github/agents.json`, plus the paths listed under `shared`.
3. THE Change_Calculator and its display formatting (`src/lib/figures/**`) SHALL be data-dev work. THE Recall_Generator, the Recall_Record schema (`src/lib/recall/**`), the Persona_List and letter text (`content/personas/**`), the `/demo` pages and Opening_Flow (`src/app/**/*.tsx`, `src/app/**/*.css`), the reveal components (`src/components/**`) and the landing link SHALL be frontend-dev work. THE Sealing_Script (`scripts/seal-personas*`), its bundle build entry and config (kept under `scripts/seal-personas*`, not as a root `*.config.*` file, which platform-dev owns) and its integration test (`src/test/integration/**`) SHALL be crypto-dev work. The `package.json` script and the pinned bundler devDependency from R4.13 MAY be added by the crypto-dev task, because `package.json` and `package-lock.json` are `shared` in `.github/agents.json`. Any Dockerfile or Helm change for running the Sealing_Script (`Dockerfile`, `deploy/**`) SHALL be platform-dev work.
4. IF a requirement needs a file that matches no role's paths, matches only the paths of a role other than the one doing the task, or matches the paths of more than one role, THEN THE design SHALL list that file and the proposed owning role for the owner's decision, and THE task list SHALL NOT include a change to that file until the owner has decided. The owner has decided two such files: `src/app/page.tsx` (the landing link), which matches platform-dev by its exact path and frontend-dev by `src/app/**/*.tsx`, is frontend-dev work; and `src/test/integration/**` (the Sealing_Script integration test), which matches platform-dev by `src/test/**` and crypto-dev by `src/test/integration/**`, is crypto-dev work.
5. THE task list SHALL give each task a "Before this task" line that lists its dependencies on spec 02-sealed-letters tasks 2 to 4 and spec 02-demo-figures tasks 1 and 2, and a "Depends on" line that lists only tasks from this spec.
