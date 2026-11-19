# Requirements Document

Spec: 15 The flow

## Introduction

The owner walked the live site at 1440 × 900 and 390 × 844 and found that only the Write desk has its new design. The steps after it fall back to older looks, and the question model breaks the core promise: an author cannot answer a question when writing, so at opening the testimony has nothing to be compared with. Design 15 (`docs/design/15-flow/`, merged in PR #508) is the owner-approved design for every page and state. This spec builds it.

The prototype is the design. This spec says what to build and points at the prototype. It does not describe the prototype again. Sizes, colours, spacing and strings are in `docs/design/15-flow/` (the HTML and CSS) and in its `README.md` (every string per screen, the Occasion question table, Priya's copy, Decisions, Steering changes, Sealed format changes). Where this spec and the prototype differ on something the prototype draws, the prototype wins. Where the prototype shows nothing (motion, sound, the seal check, error handling, keyboard), the app keeps what it does today.

The steering files were changed in the same PR as this spec so that they and the spec agree (`tone.md`, `product.md`, `neutrality.md`, `tech.md`, `structure.md`, `data-integrity.md`).

## Code facts this spec relies on

Read from the checkout on the day this spec was written. The first task that touches an area re-reads it and reports any difference in a commit message body.

| Topic | What exists |
|---|---|
| Sealed format | `src/lib/seal-format/registry.ts` holds `formats = { 1: ... }`. `parsePayload` and `parseEnvelope` pick the schema by version. `src/lib/seal-format/v1/payload.ts` defines `payloadV1Schema`, whose `recall_questions` are `number` (with `metric_id`) or `text` questions. `src/lib/crypto/seal.ts` and `open.ts` call the parsers. `OpenResult.payload` is typed `PayloadV1`. |
| Payload consumers | `src/components/reveal/opening-machine.ts` (`payload: PayloadV1`), `FiguresThenNow.tsx` (`SelfReportedOnly`), `ceremony/recall/RecallPager.tsx` (a `Pick` of `PayloadV1`), `live/build-payload.ts`, `live/seal-runner.ts`, `src/lib/recall/generate.ts`. |
| Persona sealing | `scripts/seal-personas-core.ts` builds a deterministic v1 payload per persona from `content/personas/personas.json`, the letter text, `samples.json` and the figure file, and seals it with the published demo key. `content/personas/personas.json` holds each persona's `letter_id`, `envelope_hash`, `author_questions` and a `retired_letter_ids` list. `content/personas/letters/answers.json` holds Priya's pre-written answers, shown on her Testify step and never sealed. Sealed rows are immutable (database triggers). |
| "Now" figures | Reveal fetches `GET /api/figures` and `pickNow` (`src/lib/figures/now.ts`) picks the series. For a persona this gives the latest record, not the record for the opening date. `src/lib/figures/then-now.ts` (`thenAndNow`) returns the figure at or before a date. |
| Live demo | `/demo/live` renders `LiveStepper` with six steps. After Wait, "Go to your letter" leaves the page for `/l/{id}`. `/l/{id}` and persona pages render the opening flow from `src/components/reveal/` and `src/components/ceremony/`. |
| Ghost and Scene | `scene/Ghost.tsx` and `scene.module.css` pin `.ghostPlace` by viewport percentage behind the content. `ceremony/envelope/Envelope.tsx` draws a `Dirt` band on every envelope. |
| Occasion wording | `src/components/live/occasions.ts` holds `OCCASIONS`, `DEFAULT_QUESTION`, `SHARED_SUGGESTIONS`. Tests ban "right now", "today" and "currently" in question text (`desk/occasions-desk.test.ts`, `live/occasions.test.ts`, `live/copy.test.ts`) and `src/test/retired-phrases.test.ts` holds retired phrases. |
| Budgets | `scripts/check-js-budget.mjs` holds the per-route budgets. |

## Decisions already made

Everything in `docs/design/15-flow/README.md`, including its Decisions, the Occasion question table and Priya's approved copy. In particular:

1. A sealed format version 2 carries the answer to each author question. Version 1 letters keep opening.
2. Each author answer is at most 1,000 characters (code points). One question by default, up to three.
3. The persona notice sits in a strip under the bar on phone and in the bar on desktop.
4. `/seal` stays off. It shows the `not-found` screen.
5. The reader's testimony on an author question is stored as today's text answer. No new table or column.
6. "I don't remember" on an author question is shown on the receipts as the same words, in the reader's testimony slot. It adds no new string.
7. A persona letter's "now" figure is the official record for the week of its opening date: 4 November 2024 for Maya, the week of 3 June 2024 (the record at or before 9 June 2024) for Tomás.

## Glossary

- **Author question**: a text question the author writes and answers when writing the letter. A figure question is the other kind and is generated from a tracked figure.
- **Sealed answer**: the author's answer to an author question, sealed inside the letter (format version 2).
- **Testimony**: what the reader writes or enters at opening, before anything sealed is shown. For an author question it is what they think they answered.
- **Recollection**: a persona's pre-written, fictional testimony. It stays outside the sealed letter.
- **Prototype**: the approved design in `docs/design/15-flow/`. A **screen ID** is the name of one prototype screen, for example `testify-text`.

## Out of scope

`docs/kiro-writeup.md`, the Helm chart, environment variables, real sealing on `/seal`, new regions, sources, fonts or personas, any change to a crypto primitive, key step or header field, and any new route budget.

## Requirements

### Requirement 1: The prototype is the reference

**User Story:** As the owner, I want every real screen to match the approved prototype, so that I review the app against one picture.

#### Acceptance Criteria

1. WHEN a task covers a screen ID of `docs/design/15-flow/`, THE task SHALL build that screen in the app's components and CSS modules, using the tokens in `src/components/ceremony/scene/tokens.css`, and SHALL NOT paste prototype HTML or CSS.
2. THE app SHALL show every string of a screen exactly as the README entry for that screen ID lists it. Strings live in the feature folder's `copy.ts`, except the Occasion wording in `occasions.ts`.
3. WHEN QA reviews a task, THE QA review SHALL drive the real app into the same state as each covered screen ID at 1440 × 900 and 390 × 844 and compare it with `shots/{id}-desktop.png` and `shots/{id}-phone.png`. Any visible difference other than live data (dates, letter ids, fingerprints, figure values) is a defect unless the task's commit notes say why.
4. THE app SHALL keep today's behaviour for anything the prototype does not draw: motion, sound, the seal check, error handling and keyboard use.
5. THE app SHALL show nothing twice on one screen: the testimony, the persona notice, the DEMO label, the seal.
6. EVERY text colour SHALL pass WCAG 2.2 AA on its own surface. No text SHALL sit on soil, glow or a gradient.
7. THE primary action SHALL be in view without scrolling at 1440 × 900 and 390 × 844 on Press the seal (the wax), Wait (when ready), Unlock, every Testify question and Break the seal.

### Requirement 2: Sealed answers in format version 2

**User Story:** As an author, I want to seal my answer with each question, so that at opening what I remember can be set beside what I wrote.

#### Acceptance Criteria

1. THE sealed format SHALL have a version 2 whose payload carries, for each author (text) question, a sealed answer of 1 to 1,000 code points that is not only whitespace. A number question carries none.
2. THE header and every other payload field of version 2 SHALL keep the meaning they have in version 1. No crypto primitive, key step or header field changes.
3. WHEN a version 1 letter is opened, THE app SHALL open it exactly as today.
4. THE sealing code SHALL accept a version 1 or a version 2 payload, and THE opening code SHALL return either, typed so that the consumers can tell them apart.
5. WHEN a version 2 payload has a text question without a sealed answer, THE parser SHALL reject it with `invalid` and the path of the question.
6. WHEN the reveal shows a question from a version 1 letter, THE reveal SHALL show "No answer was sealed with this question." in place of the sealed answer.
7. THE server SHALL store nothing new. The answer is inside the encrypted payload.

### Requirement 3: Priya sealed as version 2

**User Story:** As a judge, I want Priya's letter to show her recollection beside her sealed answer, so that the demo shows the model without my own letter.

#### Acceptance Criteria

1. THE persona content SHALL hold Priya's two rewritten questions, her two sealed answers and her two recollections exactly as in the README section "Priya: copy for the owner to approve".
2. THE sealing script SHALL seal Priya's letter as version 2 with those answers, deterministically, with the published demo key.
3. WHEN Priya's letter is sealed again, THE persona list SHALL point at the new letter id and envelope fingerprint, and the old letter id SHALL be added to `retired_letter_ids`. THE old version 1 row stays in `demo_letters` (sealed rows cannot be changed) and nothing in the app references it.
4. THE recollections SHALL stay outside the sealed letter, in `content/personas/letters/answers.json`, and the sealed answers SHALL be in `content/personas/letters/sealed-answers.json`.
5. THE persona content validators SHALL check both files for shape, count, 1 to 1,000 code points and the content rules already applied to her letter.
6. THE fuel personas' letters SHALL stay as they are.

### Requirement 4: Persona "now" figures

**User Story:** As a judge, I want the "now" figure of a persona letter to be the record for its opening date, so that the then-versus-now change is the one the persona window was chosen to show.

#### Acceptance Criteria

1. THE figures library SHALL return, for a persona's metric and its opening date, the official record at or before that date, with full provenance, never converted or filled.
2. WHEN the persona is Maya, THE "now" figures SHALL be the 4 November 2024 records (regular gasoline 3.069, diesel 3.536, USD per gallon, U.S.).
3. WHEN the persona is Tomás, THE "now" figures SHALL be the records for the week at or before 9 June 2024.
4. THE persona page SHALL give the reveal this response in the shape `pickNow` already reads, in place of the `GET /api/figures` request. Live and real letters keep the request.
5. IF no record exists at or before the opening date, THE reveal SHALL say the figure is unavailable and why, and SHALL still show the sealed figure.

### Requirement 5: One shell

**User Story:** As a reader, I want every page to look and behave like one product, so that nothing feels borrowed from an older design.

**Covers:** every screen ID.

#### Acceptance Criteria

1. EVERY page SHALL show the same top bar: the wordmark (uppercase, letter-spaced) and the DEMO chip on the left; on the right, in this order, the persona notice (persona pages only), Calm, Sound (only where there is sound) and Skip (only while a sequence runs). THE Skip slot SHALL be reserved and first in the button group so nothing shifts. A disabled control SHALL never be shown.
2. THE persona notice SHALL sit in the bar on one line at 1440 and in a strip under the bar on phone, never both.
3. THE app SHALL draw one step track per flow: Write · Press the seal · Wait · Testify · Break the seal · Receipts on `/demo/live`, and Testify · Break the seal · Receipts on `/l/{id}` and on persona pages. On phone it SHALL show "Step {n} of {total} · {label}" with the bars as drawn.
4. EVERY screen SHALL use one centred column. The Write desk SHALL keep its two columns at 992 px and wider.
5. THE ghost SHALL be part of the column: centred, in the flow, never beside or behind a card and never clipped at 390 px. It SHALL appear from emergence until the seal breaks, at the sizes of the prototype for emergence, Testify and Break the seal. It SHALL leave when the seal breaks. It SHALL NOT appear on home, `/demo`, `/how-it-is-sealed`, Write, Press the seal, Wait, still-sealed, unlock or the receipts.
6. EVERY envelope SHALL be drawn without the dirt band. Soil SHALL be a strip under the envelope, never painted across it.
7. WARM paper and the serif SHALL be used only for what was sealed: the letter, the author's questions as written, the sealed answers (and the letter card). Everything else is Inter on the dark page.
8. THE reader's testimony on the receipts screen SHALL carry the orange rule. Orange SHALL keep every other use `tone.md` lists and SHALL never mark a figure, a change or a direction.

### Requirement 6: Home, demo, how it is sealed and not found

**User Story:** As a visitor, I want the entry pages to match the rest of the product.

**Covers:** `home`, `demo`, `how`, `not-found`.

#### Acceptance Criteria

1. THE home page and `/demo` SHALL be built as in the prototype, with the envelope on soil and no ghost.
2. THE `/demo` page SHALL show the three persona cards and the live card in one consistent grid, each envelope inside its card.
3. THE ritual card copy SHALL be the README's strings for `home`.
4. THE `/how-it-is-sealed` page SHALL use the shared shell and keep its current content.
5. WHEN `/seal` is requested, OR when no route matches, THE app SHALL show the `not-found` screen. `/seal` stays off.

### Requirement 7: The Write step

**User Story:** As an author, I want to answer each question as I write it, so that my future self has something to be compared with.

**Covers:** `write-empty`, `write-filled`, `write-check`, `write-own-number`.

#### Acceptance Criteria

1. EVERY question row SHALL have the question and the author's answer. A question SHALL NOT be sealed without an answer.
2. THE desk SHALL start with one question row, the chosen Occasion's default, and SHALL allow up to three. "Ask another" suggestions SHALL stay.
3. THE answer SHALL accept up to 1,000 code points. WHEN an answer is longer, THE fold check SHALL name the question and say so, and SHALL NOT seal.
4. WHEN the fold is pressed with an unanswered question, THE fold check SHALL name the first unanswered question ("Question {n} has no answer yet. Answer it or remove it.") and move focus to its answer field.
5. WHEN a question is removed, ITS answer SHALL be removed with it. WHEN an Occasion is picked, a question the author edited and its answer SHALL be kept, and an answer SHALL never be overwritten.
6. THE envelope panel's seal SHALL be at 35% until the fold check would pass.
7. THE letter SHALL seal as a version 2 payload with each author answer.
8. THE receipt choices, figure limits, own-number rules and every other Write behaviour SHALL stay as they are.

### Requirement 8: Occasion wording

**User Story:** As an author, I want questions in my own voice, so that I answer them as myself.

**Covers:** `write-empty`, `write-filled`.

#### Acceptance Criteria

1. THE Occasion table SHALL be the README table "Question wording (Occasions)": one default question per Occasion, then the Occasion's suggestions, then the shared suggestions.
2. EVERY default and suggestion SHALL be first person and present tense, SHALL use "I", "me" or "my", and SHALL NOT use "you", "your", "when you wrote this" or "the day you sealed this". The words "right now" are allowed.
3. EVERY default and suggestion SHALL follow `neutrality.md` for Occasion questions and `tone.md`.

### Requirement 9: Press the seal and Wait

**User Story:** As an author, I want a clear sealing step and a single waiting card.

**Covers:** `seal-choose`, `seal-step-1`, `seal-step-2`, `seal-sealing`, `seal-backup`, `seal-no-prf`, `seal-failed`, `wait-counting`, `wait-ready`.

#### Acceptance Criteria

1. THE Press the seal step SHALL show the two presses as the steps "Make your passkey" and "Set the seal" under the wax, and the wax SHALL carry the pressed-ghost relief in every state, at 35% before a backup choice.
2. THE sealing machine SHALL keep needing two presses. No press SHALL be removed or merged.
3. WHEN the passkey cannot make a key, THE step SHALL show `seal-no-prf` and the backup key SHALL be required.
4. THE seal SHALL NOT appear twice and DEMO SHALL appear once on Wait.
5. WHEN the time is up, THE Wait card SHALL show one action, "Open your letter". THE card SHALL have no second unlock panel and no "Go to your letter" link.
6. WHEN "Open your letter" is pressed, THE live demo SHALL continue on `/demo/live` with the six-step track.
7. THE step track SHALL NOT end at Wait.

### Requirement 10: The opening flow

**User Story:** As a reader, I want one opening experience, whether I came from the live demo or from a QR code.

**Covers:** `still-sealed`, `unlock`, `unlock-backup`, `unlock-error`, `emergence`.

#### Acceptance Criteria

1. THE opening screens on `/demo/live` and on `/l/{id}` SHALL be the same components with the same shell. `/l/{id}` SHALL use the three-step track.
2. BEFORE the opening date, `/l/{id}` SHALL show `still-sealed` and nothing about the contents.
3. THE unlock options SHALL be those of `unlock`, `unlock-backup` and `unlock-error`, with the existing cross-device help.
4. WHEN the seal check passes, THE ghost SHALL show `emergence`, and the letter SHALL be offered only once the check has passed. THE check itself SHALL stay as it is today.
5. THE persona pages SHALL open straight on the first question, with no "Before you read it" screen.
6. THE opening flow SHALL load on `/demo/live` with `next/dynamic` once the Wait step starts.

### Requirement 11: Testify

**User Story:** As a reader, I want to say what I remember before I see what I wrote.

**Covers:** `testify-text`, `testify-number`, `testify-last`, `maya-testify`, `priya-testify`.

#### Acceptance Criteria

1. FOR each author question, THE step SHALL show "On {date} you asked yourself:", the question exactly as written, and a field labelled "What you think you answered" with its hint. "I don't remember" SHALL replace "No answer" for author questions.
2. FOR a persona with sealed answers, THE step SHALL show her recollection of her answer, labelled fictional, one question at a time, with a plain control to go on.
3. FIGURE questions SHALL keep today's model and wording. Their scale range SHALL be the fixed range from `src/components/ceremony/recall/unit-ranges.ts`, never derived from a figure or an answer.
4. THE counter for a figure question SHALL read "Question {n} of {total} · sealed on {date}", and for an author question "Question {n} of {total}". A persona's figure question SHALL read "as of {date}".
5. THE persona's sample answer SHALL stay labelled as a sample, with the note as in `maya-testify`.
6. THE testimony SHALL be recorded before anything sealed is shown, and SHALL be shown once, on the receipts, never as a list above the seal.
7. ON phone, THE controls SHALL be as in the prototype so the primary action stays in view.

### Requirement 12: Break the seal and the receipts

**User Story:** As a reader, I want my testimony beside what I wrote, with no comment.

**Covers:** `break`, `maya-break`, `receipts-live`, `maya-receipts`, `maya-tampered`, `priya-receipts`.

#### Acceptance Criteria

1. THE break screen SHALL show the ghost centred with the wax in front, pressable, with the instruction and button directly under it. WHEN the seal breaks, THE ghost SHALL hand over the letter and leave.
2. THE receipts SHALL show, in one scrolling column and in this order: each author question (the question as written, the testimony, the sealed answer), the letter, the figures if any, the seal line, the end card.
3. THE app SHALL NOT comment on a difference, highlight a difference or score one, and SHALL NOT rewrite either text.
4. THE figures SHALL show Then, Now and the reader's answer with their periods and sources. THE change line SHALL show the direction word, the signed difference at the same number of decimals as Then and Now, the percentage and both periods. THE formula SHALL be shown with its result. THE values SHALL come from `src/lib/figures` at full precision.
5. WHEN Then and Now are the same period, THE receipts SHALL show the existing same-period line and SHALL show no change line, percentage or formula.
6. THE seal line SHALL read "The seal is intact. Nothing here has changed since it was sealed." with a "Show the fingerprint" disclosure. THE persona tamper control SHALL live in that row and SHALL keep today's behaviour, with the result drawn as in `maya-tampered`.
7. THE persona letter SHALL be labelled "as of" its date and SHALL never claim to have been sealed then.
8. THE live letter with no figures SHALL end on the testimony and the letter.

### Requirement 13: Keepsakes

**User Story:** As an author, I want printable cards that match the product.

**Covers:** `letter-card`, `backup-card`.

#### Acceptance Criteria

1. THE letter card and the backup key card SHALL be built as in the prototype in the browser only. The backup key SHALL never reach the server.
2. THE letter card SHALL hold no key. THE backup card SHALL say what it is, that it opens the letter on its own after the opening date, and to keep it somewhere safe.

### Requirement 14: Verification

**User Story:** As the owner, I want the whole flow checked against the prototype.

#### Acceptance Criteria

1. THE layout check SHALL have a row for each behaviour this spec fixes in position, and the Live_Walk SHALL walk the new flow: Write with answers, Press the seal in two presses, Wait, Open your letter, Testify, Break the seal and the receipts, at both sizes.
2. THE README and `docs/video-script.md` SHALL describe the new ritual: questions answered when writing and recalled at opening.
3. A task that changes behaviour SHALL update or retire the tests it outdates and SHALL name each with its reason.
4. NO value in `scripts/check-js-budget.mjs` SHALL be raised. A task that cannot fit SHALL report the measured number in its commit notes and stop.
5. THE final walk on merged `main` SHALL put every real screen beside its prototype shot and list the differences.
