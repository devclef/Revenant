# Requirements Document

Spec: 16 Remember first

## Introduction

The owner cut the demo video and walked the deployed site at 1440 × 900 (home, `/demo`, all three personas, and `/demo/live` from Write to Receipts). Four kinds of problem came out of it. A bug on Write scrolls the page away between pointer down and pointer up, so the press is lost. Some product words do not work when said to a person: "testify" sounds like a courtroom, and "remember first" explains itself. The Write desk tells the author not to answer the questions, while the fold check refuses to seal an unanswered one. The receipts take too long to read.

This spec fixes those before the final video is recorded. The bug comes first. Everything else is copy, order and layout. Nothing sealed changes.

Spec 15's prototype (`docs/design/15-flow/`) stays the reference for everything this spec does not change. Where this spec changes a string, an order or a label that the prototype shows, this spec wins and the prototype files are not redrawn. QA treats those differences as expected and lists them.

Strings marked **(proposed)** are this spec's wording, which the owner approved as written on review. They are collected in "Proposed wording" below so the owner can review them in one place. Every one follows `tone.md` and `neutrality.md`: short, second person (except the maker's own story, Requirement 15), no exclamation mark, at most 25 words per sentence, and nothing that grades what the reader remembered.

The steering files change in the same PR as this spec so that they and the spec agree, as in spec 15: `tone.md` and `product.md`, plus wording-only edits in `neutrality.md` and `structure.md` where they name the step (Requirement 2.10).

## Code facts this spec relies on

Read from the checkout at `1183739` on the day this spec was written. The first task that touches an area re-reads it and reports any difference in a commit message body.

| Topic | What exists |
|---|---|
| The keep hook | `src/components/ui/use-keep-in-visual-viewport.ts` exports `useKeepInVisualViewport(ref, calm)`, `keepInVisualViewport`, `scrollDeltaFor`, `KEEP_TOP_CLEAR_PX = 56` and `KEEP_BOTTOM_CLEAR_PX = 8`. The hook returns early only when `window.visualViewport` is missing, so it runs on every modern desktop browser. It listens for `focusin` on the whole `ref` element and, while `ref` contains `document.activeElement` (any element, including a button), re-keeps on the visual viewport's `resize` and `scroll`. `scrollDeltaFor` aligns the top edge of a box taller than the band. Tests: `use-keep-in-visual-viewport.test.ts` and `use-keep-in-visual-viewport.hook.test.ts`. |
| Hook call sites | Two calls only. `src/components/live/stepper/LiveStepper.tsx` passes `primaryRef`, the `data-primary-control` div that wraps the whole step body (the entire Write desk on Write). `src/components/ceremony/recall/RecallPager.tsx` passes `answerRef`, the field group of one question (the field and its Next or submit control). `src/components/live/AuthorQuestions.tsx` and `src/components/live/desk/QuestionRow.tsx` do not call the hook. They render inside `primaryRef`, so `LiveStepper`'s call covers them. `AuthorQuestions` renders in WriteForm's `all` section only; the desk uses `desk/QuestionSection.tsx` and `QuestionRow.tsx`. |
| Step change scroll | `LiveStepper` also scrolls the Step_Track into view one frame after a step change (`scrollIntoView`, instant under Calm). That scroll runs after a step has changed, not on a press. |
| Browser tests | `playwright-core` is a dev dependency. The Live_Walk (`src/test/integration/live-walk.test.ts`, `npm run live-walk`) drives headless Chromium from Vitest against a local production build and is skipped unless `WALK=1`. There is no `@playwright/test`. |
| Step names | Live track: `LIVE_STEP_NAMES` in `src/components/live/stepper/live-steps.ts` takes `BRAND_COPY.ritualSteps[0..2].name`, `LIVE_COPY.waitStep`, `CEREMONY_COPY.steps[1]` and `LIVE_COPY.receiptsStep` ("Receipts"). Persona track: `CEREMONY_COPY.steps` = "Testify", "Break the seal", "Read", "See the receipts" (three steps without figures, `personaStepLabels` in `ceremony/steps.ts`). `/l/{id}` track: `REVEAL_COPY.letterTrackSteps` = "Unlock", "Testify", "See the receipts". |
| "Testify" and "testimony" in UI strings | `brand/copy.ts` (`heroSentence`, `ritualSteps[2].name`, `ritualSteps[3].line`), `landing/copy.ts` (`noSealBody`), `ceremony/copy.ts` (`testimonyRecorded`, `stageLive.recall`, `steps`, `closeLine`, `closeLineNoFigures`), `reveal/copy.ts` (`letterTrackSteps`, `recallIntro`, `stage1Title`, `marksSummary`). No persona file under `content/personas/` contains either word. Identifiers, comments and the step id `"testify"` in `live-steps.ts` also contain them. |
| Screen-reader lines | `CEREMONY_COPY.stageLive` ("Testify. Say what you remember.", "Your answers are placed.") is announced by the visually hidden live region in `ceremony/LiveRegion.tsx`. On the persona page the region announces the step instead. |
| The reader's side | `REVEAL_COPY.stage1Title` and `marksSummary` ("Your testimony", the break screen and the closed marks card), `REVEAL_COPY.yourAnswer` ("Your answer", the figure card in `ReceiptCard.tsx`, `RememberedAnswers.tsx`, and the spoken prefix in `RecallPager.tsx`), `REVEAL_COPY.receiptsRemembered` ("You remembered, just now", the question pairs), `CEREMONY_COPY.lineAnswer`, `markAnswer` and `numberLineAlt` (the Number_Line). |
| Write desk strings | `src/components/live/desk/copy.ts`: `psIntro` ("…You don't answer them now."), `lockLine` ("Answered on opening day, before the letter is shown."), `answerPlaceholder` ("Answer it as you remember it…"), `receiptIntro` ("…you guess it first, then see it next to today's."). `src/components/live/copy.ts`: `authorQuestionsHint` and `answerInLetter`, shown by `AuthorQuestions.tsx`. |
| Headline | `BRAND_COPY.tagline` is "Memory rewrites itself. Revenant doesn't." It feeds the hero, `HOME_DESCRIPTION` in `src/lib/page-metadata.ts`, and `src/app/opengraph-image.tsx` (its `alt`, and a non-breaking space put into "Revenant doesn't."). `landing/landing.module.css` sizes the hero so "Memory rewrites itself." fits on one line. Tests that pin it: `src/test/tagline-source.test.ts`, `src/test/landing.test.tsx`, `brand/copy.test.ts`, `landing/LandingHero.test.tsx`, `src/lib/page-metadata.test.ts`, `src/app/opengraph-image.test.tsx`, `ceremony/scene/scene-shell.test.tsx`, `ceremony/copy-exact.property.test.ts`. Docs: `README.md` line 3, `docs/video-script.md` lines 5 and 24, `src/components/ceremony/ASSETS.md`, `.kiro/steering/product.md`. |
| Receipts order | `src/components/reveal/Reveal.tsx`: from stage 2 the receipts column shows the question pairs, then `LetterPaper` in full, then at stage 3 `FigureReceipt`/`FiguresThenNow`, then `SealLine` and `EndCard`. The letter is collapsible only at stage 3 on a phone. The persona track has a Read step (stage 2) before See the receipts (stage 3). |
| Then and Now | `ReceiptCard.tsx` labels the rows with `REVEAL_COPY.then` and `REVEAL_COPY.now`. `FigureLine.tsx` labels a now figure `labelRetrieved` ("retrieved {date}") on every letter kind. The Number_Line uses `CEREMONY_COPY.lineThen` and `lineNow`. |
| Change line | `formatChange` in `src/lib/figures/format-change.ts` returns `direction` ("rose", "fell", "unchanged"), a signed `difference` and a signed `percent`, with U+2212 for minus. `ChangeLine.tsx` prints the direction word and both signed values. `readableFormula` in `reveal/formula.ts` prints `(now - then) / then x 100 = {percent}` from `result.then.value` and `result.now.value` at full stored precision. |
| Rescale note | `REVEAL_COPY.rescaledNote` is "Shown per {toUnit}. Published per {fromUnit}." It is filled in `FigureLine.tsx` (then and now) and `change-display.ts` (the change), so it can show three times per figure. |
| Oil Bulletin values | `src/lib/figures/real/fuel-figures.json` holds the Weekly Oil Bulletin values as read from the xlsx cell, for example `"1741.8449858013737"` EUR per 1,000 litres for 2024-06-03. `display-precision.ts` shows fuel at 2 decimals in the rows. The formula has no precision rule. |
| Number field | `RecallPager.tsx` shows `CEREMONY_COPY.numberUnreadable` ("This number could not be read. Write it like 1585.76.") from the field state on every keystroke. The owner saw "1085.70" in the example on the deployed site; the checkout says 1585.76. |
| Break screen | `SealBreak.tsx` shows `CEREMONY_COPY.testimonyRecorded` ("Your testimony is recorded.") on every letter kind, including Priya's, where no answer of the reader's is recorded. |
| Persona dates on Remember | The fuel persona's question shows the written-as-of date in the header ("Written as of {date}"), in the counter (`questionCounterAsOf`) and in `REVEAL_COPY.recallIntro` ("This letter was written as of {date}. Before you read it, testify: …"). |
| Press the seal | `LIVE_COPY.sealHeading`, `sealParagraph`, `warning`, `prfHint`; `press/copy.ts` `stepOne`, `stepOneHint`, `stepTwo`, `stepTwoHint`, `setting` (`stepTwoHint` and `setting` are the same sentence); `BackupChoice` legend, options and help; `SealLinks`. |
| Home section | `ResurrectionSection.tsx` prints `LANDING_SECTION_COPY.resurrectedBody` (four sentences: the Académie des sciences, the classroom time capsule, the seal's meaning, Revenant) and the `BRAND_COPY.sealMapping` table. `NoSealSection.tsx` prints `noSealBody`. `/how-it-is-sealed` already prints the same `sealMapping` table. |
| Retired phrases | `src/test/retired-phrases.test.ts`: `RETIRED_PHRASES` scans the full text of every non-test file under `src/` and `content/personas/`, identifiers and comments included, plus the rendered `/` and its metadata. `AVOIDED_WORDS` scans `copy.ts` files and `content/personas/`, again as full text. Neither can hold "testify" today without matching identifiers such as `testimonyRecorded`. |
| QA tooling | `tools/qa/layout-check.mjs`, `tools/qa/journey-check.mjs` and `src/test/integration/live-walk-helpers.ts` name the old steps or strings. |
| Pictures | `docs/readme-hero2x.png` (alt text: "…Write and press the seal, Testify, See the receipts") and the spec 15 shots under `docs/design/15-flow/shots/` are images with the old words in them. |

## Decisions already made

From the owner's request:

1. The bug fix comes first and blocks the rest.
2. The step is called Remember. "Testify" and "testimony" leave the UI. Code names (`testimony`, `TestimonyEntry`, the step id `"testify"`, `AuthorTestimony`, store and sealed-format fields) stay as they are.
3. The headline is "Memory drifts with time. A sealed letter doesn't." The eyebrow "The wax seal, resurrected." and the calls to action stay.
4. Sealed letters, persona envelopes and their hashes, the sealed format, crypto, key steps, the time lock and the data sources do not change. Copy outside the seal (Priya's recollections, labels, help text) may change.
5. `neutrality.md` and `data-integrity.md` apply to every receipts change.
6. No route budget in `scripts/check-js-budget.mjs` is raised.

## Glossary

- **Keep_Hook**: `useKeepInVisualViewport` and its pure helpers in `src/components/ui/use-keep-in-visual-viewport.ts`.
- **Text_Field**: a `textarea`, or an `input` whose type is `text`, `search`, `email`, `tel`, `url`, `password` or `number`. Buttons, checkboxes, radios, range inputs and elements with a `button` or `slider` role are not Text_Fields.
- **Field_Group**: the smallest element that holds one Text_Field and, where the field has one, its own Next or submit control. On the Write desk a field has no Next control of its own, so its Field_Group is the field's row (the field, its label and its line of help).
- **Keyboard_Open**: the state where `window.visualViewport.height` is smaller than the layout viewport height (`window.innerHeight`) by at least the Keyboard_Threshold, while `visualViewport.scale` is 1. Pinch zoom alone is not Keyboard_Open.
- **Keyboard_Threshold**: a fixed number of CSS pixels named as a constant next to the Keep_Hook. The design fixes the value.
- **Write_Control**: any control on the Write step that is pressed rather than typed in: the Fold_Button ("Fold it and press the seal"), the Occasion pills, the Suggestion_Pills (including "Write my own"), each Remove control, the Edit control, the receipt toggles ("A public price", "A number of my own"), the Details control and every other `button`, checkbox and radio on the step.
- **Press_Test**: the browser test of Requirement 1 that presses and releases Write_Controls with a real pointer, touch or key.
- **Remember_Step**: the step named "Testify" today, where the reader says what they remember before anything sealed is shown. The step id `"testify"` in code stays.
- **Remembered_Phrase**: the one phrase the UI uses for the reader's side, beside the record.
- **Recollection**: a persona's pre-written, fictional answer from memory (Priya). It stays outside the sealed letter.
- **At_Opening_Figure**: the figure today called "Now": for a persona, the record for the week of its opening date; for a live or real letter, the latest record when the letter is read.
- **Published_Precision**: the number of decimals a publisher prints for a series, recorded per series with a link to where the publisher prints it.
- **User-facing string**: the value of a string in a `copy.ts` module (or `occasions.ts`), text in `content/personas/` shown on screen, and text of a rendered page outside user content. Identifiers, object keys, comments and step ids are not user-facing strings.
- **Live_Walk**: `src/test/integration/live-walk.test.ts`, as defined in spec 14 and extended in spec 15.

## Proposed wording

**Approved.** The owner approved all proposed wording as written, on review of this spec: every row below, every string marked **(proposed)** in the requirements, and the proposed strings in `design.md` ("Where the code differs from the requirements", items 1, 2, 5 and 8, including `ritualSteps[3].line`, `numberLineAltNoAnswer`, `saidJustNow` and `stepPasskeyMade`). The inline **(proposed)** markers stay as the record of where the wording came from. "Key" is the copy constant today. A new key is marked *new*.

| Requirement | Key | Today | Proposed |
|---|---|---|---|
| 2 | `BRAND_COPY.ritualSteps[2].name` | Testify | Remember |
| 2 | `CEREMONY_COPY.steps` | Testify · Break the seal · Read · See the receipts | Remember · Break the seal · Read · Receipts |
| 2 | `REVEAL_COPY.letterTrackSteps` | Unlock · Testify · See the receipts | Unlock · Remember · Receipts |
| 2 | `BRAND_COPY.ritualSteps[3].name` | See the receipts | Receipts |
| 2 | `CEREMONY_COPY.stageLive.recall` | Testify. Say what you remember. | Remember first. Then read. |
| 2 | `BRAND_COPY.heroSentence` | …When it opens, you testify first, then read what you wrote. | …When it opens, you remember first, then read what you wrote. |
| 2, 13 | `REVEAL_COPY.recallIntro` | This letter was written as of {date}. Before you read it, testify: say what you remember about that time. | Before you read it, say what you remember about that time. |
| 2 | `DESK_COPY.receiptIntro` | A number sealed with its date. When it opens, you guess it first, then see it next to today's. | A number sealed with its date. When it opens, you remember it first, then see it beside the record at opening. |
| 3 | `REVEAL_COPY.stage1Title`, `marksSummary` | Your testimony | You remembered, just now |
| 3 | `REVEAL_COPY.yourAnswer` (receipts uses only) | Your answer | You remembered, just now |
| 3 | `CEREMONY_COPY.lineAnswer` | Your answer | You remembered, just now |
| 3 | `CEREMONY_COPY.markAnswer` | Your answer: {value} {unit} | You remembered, just now: {value} {unit} |
| 3, 7 | `CEREMONY_COPY.numberLineAlt` | …Now {now} {unit}, {nowPeriod}. Your answer {answer} {unit}. | …At opening {now} {unit}, {nowPeriod}. You remembered {answer} {unit}. |
| 3 | `CEREMONY_COPY.closeLine` | Your testimony sits beside the record. What lies between them is yours to read. | What you remembered sits beside the record. What lies between them is yours to read. |
| 3 | `CEREMONY_COPY.closeLineNoFigures` | Her testimony and her letter are side by side. What they say is yours to read. | Her recollections and her letter are side by side. What they say is yours to read. |
| 5 | `BRAND_COPY.tagline` | Memory rewrites itself. Revenant doesn't. | Memory drifts with time. A sealed letter doesn't. |
| 6 | `DESK_COPY.psIntro` | These stay on top of the envelope. When it opens, you answer each one from memory, before a word of the letter is shown. You don't answer them now. | Answer each one now. When it opens, you're asked again from memory, before you see your answer or the letter. |
| 6 | `DESK_COPY.lockLine` | Answered on opening day, before the letter is shown. | Asked again on opening day, before your answer is shown. |
| 6 | `DESK_COPY.answerPlaceholder` | Answer it as you remember it… | Write your answer… |
| 6 | `LIVE_COPY.authorQuestionsHint` | When the letter opens, you'll answer these from memory before you read it. | Answer each one now. When it opens, you're asked again from memory before you read it. |
| 6 | `LIVE_COPY.answerInLetter` | Answer them in your letter too, in your own words. | Removed. |
| 7 | `REVEAL_COPY.now`, `CEREMONY_COPY.lineNow` | Now | At opening |
| 9 | `REVEAL_COPY.rescaledNote` | Shown per {toUnit}. Published per {fromUnit}. | Shown in {toUnit}. Published in {fromUnit}. |
| 12 | `CEREMONY_COPY.testimonyRecorded` | Your testimony is recorded. | What you remembered is recorded. |
| 12 | *new* `CEREMONY_COPY.recollectionsRead` (Priya) | Your testimony is recorded. | You've read her recollections. Nothing of yours is recorded. |
| 12 | `CEREMONY_COPY.stageLive.marks` | Your answers are placed. | What you remembered is recorded. |
| 14 | `LIVE_COPY.sealParagraph` | You'll press the wax twice: once to make your passkey, once to set the seal. The passkey is named "Revenant demo" in your passkey manager. | Press the wax twice: once to make your passkey, once to set the seal. |
| 14 | `PRESS_COPY.stepOneHint` | Press the wax to make your passkey. | Press the wax. The passkey is saved as "Revenant demo". |
| 15 | `LANDING_SECTION_COPY.resurrectedBody` | Four sentences (Académie, time capsule, the seal's meaning, Revenant) | For centuries, a wax seal showed that a letter was written then and nobody had opened it since. |
| 15 | `LANDING_SECTION_COPY.noSealBody` | A seal proves the letter wasn't changed. It can't stop your memory changing. So before you read, you testify, and Revenant never says what the gap means. | No wax seal could make you remember first. Revenant asks before you read, and never says what the gap means. |
| 15 | *new* `LANDING_SECTION_COPY.makerTitle`, `makerBody` | none | Why I built it · My English teacher had us write letters to ourselves, then mailed them back fifteen years later. What I read wasn't what I remembered. |

## Out of scope

The sealed format, `src/lib/crypto/`, `src/lib/seal-format/`, `scripts/seal-personas*`, every sealed row, persona letter text, persona sealed questions and sealed answers, envelope hashes, `content/personas/personas.json` letter ids, the time lock, the data sources and their adapters, the figure files' values, the database, the API routes, the Helm chart, environment variables, `docs/kiro-writeup.md`, any new route, any new dependency, any raised route budget, redrawing the spec 15 prototype or its shots, and regenerating `docs/readme-hero2x.png` or `docs/concept.png`.

## Requirements

### Requirement 1: A press on Write never scrolls the page

**User Story:** As a judge on `/demo/live`, I want to press "Fold it and press the seal" and have it work the first time, so that the demo does not lose my press.

#### Acceptance Criteria

1. WHEN a Write_Control is pressed and released with a mouse, a touch or the keyboard (Tab to it, then Enter or Space), with any hold from 0 ms to 2,000 ms between down and up, THE Write step SHALL keep `window.scrollY` at pointer up (or key up) equal to its value at pointer down (or key down), with a difference of 0 px. This SHALL hold at 1440 × 900 and 390 × 844, with Calm on and with Calm off.
2. WHEN the Fold_Button is pressed and released once with a valid draft, THE live demo SHALL show Press the seal as the current step without a second press. The Step_Track scroll that follows a step change (`LiveStepper`, one frame after the change) SHALL stay as it is, and the zero-scroll check in 1.1 SHALL end at pointer up, before that scroll.
3. IF the Fold_Button is pressed with an unanswered question, THEN THE fold check SHALL keep spec 15 R7.4: it names the question and moves focus to that question's answer field after the release. THE draft SHALL stay unchanged, and THE live demo SHALL stay on Write.
4. WHILE Keyboard_Open is false, THE Keep_Hook SHALL make no scroll call, on every device, whether or not `window.visualViewport` exists.
5. WHILE Keyboard_Open, IF the focused element is not a Text_Field (a button, checkbox, radio, pill, toggle, slider or any other non-Text_Field), THEN THE Keep_Hook SHALL make no scroll call on `focusin`, on visual viewport `resize` or on visual viewport `scroll`.
6. WHILE Keyboard_Open, WHEN a Text_Field gains focus, or the visual viewport resizes or scrolls while a Text_Field holds focus, THE Keep_Hook SHALL scroll only as far as it takes to place that field's Field_Group between the visual viewport's top plus `KEEP_TOP_CLEAR_PX` (56 px) and its bottom less `KEEP_BOTTOM_CLEAR_PX` (8 px), as spec 09 P9 requires. With Calm on the scroll SHALL be instant. With Calm off it SHALL be smooth.
7. THE Keep_Hook SHALL measure only the Field_Group of the focused Text_Field. No call site SHALL pass the element that wraps a whole step, card or form. IF a Field_Group is taller than the band in 1.6, THEN THE Keep_Hook SHALL keep the focused Text_Field's own box inside the band and SHALL NOT align the group's top edge.
8. THE call in `LiveStepper.tsx` SHALL NOT pass `primaryRef`. Every Text_Field on Write, Press the seal and Wait SHALL be kept through its own Field_Group, as the Glossary defines it. This covers the letter field, each question field and answer field in `QuestionRow.tsx` and `AuthorQuestions.tsx`, the own-number fields, and the backup key field. On Write each field's Field_Group is its row: the field, its label and its line of help.
9. THE call in `RecallPager.tsx` SHALL keep passing its Field_Group (the field and its Next or submit control), and SHALL follow 1.4 to 1.7. WHEN Next, Previous, "No answer" or "I don't remember" is pressed and released, `window.scrollY` SHALL stay the same, as in 1.1.
10. EACH of the four places named by the owner (`LiveStepper.tsx`, `AuthorQuestions.tsx`, `desk/QuestionRow.tsx`, `ceremony/recall/RecallPager.tsx`) SHALL be checked for the same fault. A commit message body SHALL state, for each place, whether the fault was found there and what changed.
11. THE Press_Test SHALL be a Chromium test using `playwright-core`, with no new dependency. It SHALL be skipped unless `WALK=1` and SHALL run against a local production build, like the Live_Walk. With `window.visualViewport` left in place, it SHALL type a letter and an answer. It SHALL then press and release the Fold_Button with `page.mouse`: down, a hold of 600 ms, then up. It SHALL do this at 1440 × 900 and 390 × 844, with Calm on and with Calm off. It SHALL assert that `scrollY` at pointer up equals `scrollY` at pointer down, and that Press the seal is the current step within 2,000 ms of pointer up.
12. THE Press_Test SHALL also press and release, at both sizes, an Occasion pill, a Suggestion_Pill, "Write my own", Remove and each receipt toggle, asserting that `scrollY` is unchanged across each press as in 1.1. It SHALL tap the Fold_Button with touch at 390 × 844, and reach the Fold_Button with Tab and press Enter at 1440 × 900. IF the Press_Test is run against the code at `1183739` (before this fix), THEN it SHALL fail at 1440 × 900 and at 390 × 844, and a commit message body SHALL record that failing run.
13. THE Keep_Hook unit tests SHALL show each of these cases:
    - no scroll call while Keyboard_Open is false;
    - no scroll call on `focusin` of a button, checkbox or radio while Keyboard_Open;
    - no scroll call on a visual viewport resize while a button inside the group holds focus;
    - a scroll for a Text_Field while Keyboard_Open, smooth with Calm off and instant with Calm on;
    - pinch zoom (`visualViewport.scale` above 1) treated as Keyboard_Open being false;
    - a visual viewport height shortfall of one pixel less than Keyboard_Threshold treated as Keyboard_Open being false, and a shortfall equal to Keyboard_Threshold treated as Keyboard_Open;
    - for a group taller than the band, the focused field's box kept in the band rather than the group's top.

    Each existing test that expects a scroll on any `focusin` SHALL be updated, and a commit message body SHALL name it and give the reason.

### Requirement 2: Remember, not testify

**User Story:** As a reader, I want the step to be called what it is, so that I know what to do without anyone explaining a word.

#### Acceptance Criteria

1. THE Remember_Step SHALL be labelled "Remember" in every step track, on desktop and in the phone line "Step {n} of {total} · {label}". The tracks SHALL read as follows: `/demo/live` is "Write · Press the seal · Wait · Remember · Break the seal · Receipts" (Remember is step 4 of 6). A persona letter with figures is "Remember · Break the seal · Read · Receipts" (step 1 of 4). A persona letter without figures is "Remember · Break the seal · Read" (step 1 of 3). `/l/{id}` is "Unlock · Remember · Receipts" (step 2 of 3) **(proposed: "Receipts", see Open question 1)**.
2. THE home ritual cards SHALL name the third step "Remember" and the fourth step "Receipts" **(proposed)**. The third card SHALL keep its line, character for character: "When it opens, write what you think you answered, before a word is shown."
3. THE hero sentence (`BRAND_COPY.heroSentence`) SHALL read exactly "Seal what you believe now, a goal, a worry, a decision. When it opens, you remember first, then read what you wrote."
4. WHEN the Remember_Step becomes the current step on `/demo/live` or `/l/{id}`, THE visually hidden live region SHALL announce "Remember first. Then read." **(proposed)**. On persona pages the region SHALL keep announcing the step name, which is now "Remember".
5. THE persona question help (`REVEAL_COPY.recallIntro`) SHALL read exactly "Before you read it, say what you remember about that time." **(proposed)**. It SHALL hold no date (Requirement 13).
6. THE receipt card on Write (`DESK_COPY.receiptIntro`) SHALL read exactly "A number sealed with its date. When it opens, you remember it first, then see it beside the record at opening." **(proposed)**
7. THE home section on what no wax seal could do SHALL use "remember first" where it now says "testify", with the wording set in Requirement 15.
8. NO User-facing string SHALL contain a word beginning with "testif" or "testimon", matched without regard to case. This covers visible text, screen-reader-only text, `aria-label` and `alt` values, and page metadata on `/`, `/demo`, every `/demo/personas/{key}` page, `/demo/live` and `/l/{id}`. Requirement 4 enforces this with a test.
9. WHERE the Read step offers a button to go on to the Receipts step, THE button SHALL keep its label "See the receipts".
10. THE steering files SHALL change in the same PR as this spec:
    - `tone.md`: the vocabulary list, the "Testify" moment renamed "Remember", the examples, and "the reader's testimony" in the orange list and in the receipts moment.
    - `product.md`: core loop step 6, the "What's new" paragraph, and the persona and live demo lines that say "testify" or "testimony".
    - `neutrality.md` and `structure.md`: wording-only edits where they name the step.

    In each of these files the only edits SHALL be swaps of the step name or of the words "testify" and "testimony". No rule SHALL be added, removed or changed in meaning.
11. THE code names SHALL stay unchanged: `testimony`, `TestimonyEntry`, `AuthorTestimony`, `testimonyRecorded`, `nothingToTestify`, the step id `"testify"`, and every store and sealed-format field. Stored and sealed data written before this change SHALL still read back as before.

### Requirement 3: One phrase for what the reader remembered

**User Story:** As a reader, I want my side of the receipts to have one name, so that I recognise it on every screen.

#### Acceptance Criteria

1. THE Remembered_Phrase SHALL be the exact string "You remembered, just now" **(proposed)**, with that capitalisation and no end punctuation when it stands alone as a label.
2. WHERE a letter records the reader's answers (live demo, real letter, fuel persona), THE break screen heading and the closed marks card SHALL show the Remembered_Phrase in place of "Your testimony" (`REVEAL_COPY.stage1Title`, `marksSummary`).
3. WHERE a letter records the reader's answers, THE Receipts and Read steps SHALL label the reader's side with the Remembered_Phrase in each author question pair, each figure card row (`ReceiptCard.tsx`), each entry in `RememberedAnswers.tsx` and the Number_Line label (`CEREMONY_COPY.lineAnswer`).
4. THE screen-reader text of the Number_Line mark SHALL read "You remembered, just now: {value} {unit}" (`CEREMONY_COPY.markAnswer`). THE Number_Line alternative (`numberLineAlt`) SHALL read "…At opening {now} {unit}, {nowPeriod}. You remembered {answer} {unit}." **(proposed)**, with "At opening" as Requirement 7 sets.
5. WHILE the reader enters an answer on the Remember_Step, THE spoken prefix in `RecallPager.tsx` SHALL stay "Your answer", and the field label SHALL stay "What you think you answered".
6. THE break screen and the Receipts and Read steps SHALL contain no visible or screen-reader label "Your answer" for the reader's side. A test SHALL assert this on the live demo, a fuel persona and a real letter.
7. ON Priya's letter, THE persona label "She remembered · fictional" SHALL stay, and THE Remembered_Phrase SHALL NOT appear, because no answer of the reader's is recorded.
8. THE fuel persona close line (`CEREMONY_COPY.closeLine`) SHALL read "What you remembered sits beside the record. What lies between them is yours to read." THE close line for a letter without figures (`closeLineNoFigures`) SHALL read "Her recollections and her letter are side by side. What they say is yours to read." **(proposed)**
9. IF the Remembered_Phrase as the Number_Line label at 390 × 844 wraps past two lines or overlaps the box of a figure value, mark or period, THEN THE task SHALL report the measured layout in a commit message body and leave the label for the owner to shorten. The task SHALL NOT pick a shorter label itself.

### Requirement 4: Retired words and copy tests

**User Story:** As the owner, I want the old words kept out by a test, so that they do not come back.

#### Acceptance Criteria

1. THE retired-word check in `src/test/retired-phrases.test.ts` SHALL treat as retired any word that starts with "testif" or "testimon", in any letter case. This covers "testify", "testifies", "testified", "testifying", "testimony" and "testimonies", and matches Requirement 2.8.
2. THE retired-word check SHALL scan only User-facing strings in these places: the string values in every non-test `copy.ts` module and in `occasions.ts`; the on-screen text of files under `content/personas/`, leaving out the copy-test records as it does today; and the rendered `/` page with its metadata.
3. THE retired-word check SHALL NOT match identifiers, object keys, comments or step ids. Names such as `testimony`, `TestimonyEntry`, `AuthorTestimony`, `testimonyRecorded`, `nothingToTestify` and the step id `"testify"` SHALL pass the check.
4. IF a scanned User-facing string contains a retired word, THEN THE retired-word check SHALL fail and name the file (or the rendered page) and the string that matched.
5. THE retired-phrases test SHALL include a case proving 4.3 and 4.4 on fixture input. A key named `testimonyRecorded` with the value "What you remembered is recorded." passes. A string value containing "Testimony" or "testified" fails.
6. THE phrase "Memory rewrites itself" SHALL be added to `RETIRED_PHRASES`. `RETIRED_PHRASES` SHALL keep scanning the full text of every non-test file under `src/` and `content/personas/`, plus the rendered `/` and its metadata.
7. WHEN a task changes a string that this spec changes, THE same task SHALL update every test under `src/` that asserts the old value of that string to the new value. The commit message body SHALL name each updated test and the requirement behind the change.
8. WHEN a task changes a step name or string that `tools/qa/layout-check.mjs`, `tools/qa/journey-check.mjs` or `src/test/integration/live-walk-helpers.ts` looks for, THE same task SHALL update that tool to the new name or string.

### Requirement 5: The headline

**User Story:** As the owner, I want the site to say what the video says, so that they line up.

#### Acceptance Criteria

1. THE hero headline SHALL read exactly "Memory drifts with time. A sealed letter doesn't.", taken from `BRAND_COPY.tagline`. THE eyebrow "The wax seal, resurrected." and both calls to action SHALL keep their current text, order and links.
2. THE page metadata description (`HOME_DESCRIPTION` in `src/lib/page-metadata.ts`) and the Open Graph image (`src/app/opengraph-image.tsx`, both its rendered text and its `alt`) SHALL contain the new headline exactly as in 5.1, taken from `BRAND_COPY.tagline`.
3. THE Open Graph image SHALL join "letter" and "doesn't." with a non-breaking space, so that "doesn't." never starts a line on its own.
4. WHEN `/` renders at 1440 × 900, THE hero SHALL show "Memory drifts with time." on exactly one rendered line, with Calm on and off.
5. WHEN `/` renders at 390 × 844, THE hero headline SHALL have no rendered line that holds only one word, with Calm on and off.
6. THE tagline SHALL read exactly as in 5.1 in each of these places: `.kiro/steering/product.md`, the README hero line (line 3), `docs/video-script.md` (the italic line on line 5, and the spoken line of section 1 on line 24, which reads "Memory drifts with time. A sealed letter doesn't. That's Revenant: the wax seal, resurrected.") and `src/components/ceremony/ASSETS.md`.
7. WHEN the headline changes, THE tests that pin the old tagline (`src/test/tagline-source.test.ts`, `src/test/landing.test.tsx`, `brand/copy.test.ts`, `landing/LandingHero.test.tsx`, `src/lib/page-metadata.test.ts`, `src/app/opengraph-image.test.tsx`, `ceremony/scene/scene-shell.test.tsx`, `ceremony/copy-exact.property.test.ts`) SHALL assert the new headline, and none of them SHALL assert "Memory rewrites itself" as a current string.

### Requirement 6: Write says you answer now

**User Story:** As an author, I want the desk to tell me once, plainly, that I answer each question now, so that the fold check does not surprise me.

#### Acceptance Criteria

1. THE P.S. intro on the Write desk (`DESK_COPY.psIntro`) SHALL read "Answer each one now. When it opens, you're asked again from memory, before you see your answer or the letter." **(proposed)**, and SHALL appear once on the Write step.
2. THE line shown under each question row in `desk/QuestionRow.tsx` (`DESK_COPY.lockLine`) SHALL read "Asked again on opening day, before your answer is shown." **(proposed)**
3. WHILE an answer field on the Write step is empty, THE field SHALL show the placeholder "Write your answer…" (`DESK_COPY.answerPlaceholder`) **(proposed)**.
4. THE hint in `AuthorQuestions.tsx` (`LIVE_COPY.authorQuestionsHint`) SHALL read "Answer each one now. When it opens, you're asked again from memory before you read it." **(proposed)**.
5. THE string "Answer them in your letter too, in your own words." (`LIVE_COPY.answerInLetter`) SHALL be removed from `src/components/live/copy.ts`, and `AuthorQuestions.tsx` SHALL render no replacement line in its place.
6. NO User-facing string rendered on the Write step SHALL say that the author does not answer now or that the answer is first given on opening day. The phrases "You don't answer them now", "Answered on opening day", "Answer it as you remember it" and "you'll answer these from memory" SHALL NOT appear in any rendered Write step, at 1440 × 900 or at 390 × 844.
7. THE Write step SHALL keep the behaviour spec 15 R7 set. The fold check still refuses to seal a question without an answer, names that question and moves focus to its answer field (spec 15 R7.4, and 1.3 here). Each answer is still limited to 1,000 code points. The author can still have at most three questions. Only the strings in 6.1 to 6.5 change.
8. THE copy tests that pin `psIntro`, `lockLine`, `answerPlaceholder`, `authorQuestionsHint` or `answerInLetter` SHALL be updated to the new strings, or retired where the string is removed, and each SHALL be named with its reason in a commit message body (4.7).

### Requirement 7: "At opening", not "Now"

**User Story:** As a judge reading a persona letter in 2026, I want the second figure labelled by what it is, so that a 2024 date beside "Now" does not confuse me.

#### Acceptance Criteria

1. THE figure card (`ReceiptCard.tsx`) and the Number_Line SHALL label the At_Opening_Figure "At opening" **(proposed)** on every letter kind (fuel persona, live demo and real letter), through `REVEAL_COPY.now` and `CEREMONY_COPY.lineNow`. No receipts row, Number_Line label or Number_Line alternative SHALL label the At_Opening_Figure "Now".
2. THE figure card and the Number_Line SHALL label the sealed figure "Then", unchanged.
3. THE Number_Line alternative (`CEREMONY_COPY.numberLineAlt`) SHALL name the At_Opening_Figure "At opening {now} {unit}, {nowPeriod}", as in the Proposed wording table.
4. WHEN the At_Opening_Figure is shown, THE figure card SHALL show the figure's own period next to the "At opening" label, as today. The period SHALL be the figure's period, not the opening date or the date it was read.
5. WHERE the letter is a persona letter, THE figure card SHALL label the At_Opening_Figure's retrieval with `labelHistoricalRecord` ("historical record, retrieved {date}") in place of `labelRetrieved` ("retrieved {date}").
6. WHERE the letter is a live demo or real letter, THE figure card SHALL keep `labelRetrieved` ("retrieved {date}") for the At_Opening_Figure.
7. IF the At_Opening_Figure is unavailable, THEN THE figure card SHALL keep the "At opening" label and show the unavailable reason in place of the figure, as it does today for "Now". The sealed figure SHALL still show.
8. THE "At opening" label SHALL name no direction and no judgement, and SHALL pass the `neutrality.md` copy test.
9. THE "now" names in code (`pickNow`, `now`, the `now` role, and the keys `REVEAL_COPY.now` and `CEREMONY_COPY.lineNow`) SHALL stay as they are. Only their string values change.

### Requirement 8: The change line and the formula

**User Story:** As a reader, I want the change said once and the formula in numbers I can check, so that the receipt reads in a couple of seconds.

#### Acceptance Criteria

1. WHEN a figure card shows a change between Then and At opening, THE change line SHALL show, in this order: the direction word ("rose", "fell" or "unchanged"), the difference without a sign, the percentage without a sign, then both periods, separated by " · ". For Maya's regular gasoline it SHALL read "fell 0.57 · 15.8% · {then period} to 4 Nov 2024" **(proposed)**. The change line SHALL NOT contain "+", "-" or U+2212.
2. THE difference SHALL keep the decimals set by spec 15 R12.4, which are the same decimals as the Then and At opening rows. THE percentage SHALL show exactly one decimal. Both SHALL be rounded only at display time. IF the direction is "unchanged", THEN the difference and the percentage SHALL show as zero at those decimals, with no sign.
3. THE formula SHALL appear on the same figure card as the change line, in the form "({at opening} - {then}) / {then} x 100 = {signed percent}", for example "= −15.8%". The signed result SHALL use U+2212 for minus and show one decimal. THE formula is the only place on the card where a sign appears.
4. WHERE a series has a recorded Published_Precision, THE formula SHALL show each input with exactly that number of decimals. WHERE the figure has an exact display rescale by 10^k, THE number of decimals SHALL be the Published_Precision plus k, so that no digit the publisher prints is dropped and no digit is added. WHERE a series has no recorded Published_Precision, THE formula SHALL show the stored value in full.
5. THE change and the formula result SHALL be computed in `src/lib/figures` from the stored values at full precision, never from the displayed inputs. THE source details SHALL keep "As published: {value} {unit}", with the stored value in full and in the published unit.
6. THE Published_Precision of each series SHALL be recorded with a link to a page or file where the publisher prints values for that series at that precision. IF that printed precision cannot be found, THEN THE series SHALL have no recorded Published_Precision and 8.4's fallback SHALL apply. No precision SHALL be inferred from the stored value or estimated.
7. THE change line and the formula SHALL use the same colour, weight, size and layout for rose, fell and unchanged. No colour, icon or arrow SHALL mark a direction.
8. IF Then and At opening have the same period, THEN THE figure card SHALL keep the same-period line from spec 15 R12.5 and show no change line, percentage or formula. IF the two figures differ in unit, region or series, THEN THE figure card SHALL show no change line, percentage or formula, and SHALL say they are not comparable, as `data-integrity.md` requires.

### Requirement 9: One unit note per figure

**User Story:** As a reader of Tomás's letter, I want the unit note once and in plain words.

#### Acceptance Criteria

1. WHERE a figure card shows any value in a unit rescaled from its published unit, THE figure card SHALL show the rescale note "Shown in {toUnit}. Published in {fromUnit}.", with both units written as the card writes them, for example "Shown in EUR per litre. Published in EUR per 1,000 litres."
2. THE rescale note SHALL appear exactly once per figure card, as one line on the card. It SHALL NOT be repeated on the Then row, the At opening row, the change line or the formula. This applies on every letter kind (persona, live and real), at 1440 × 900 and 390 × 844, and also when the At_Opening_Figure is unavailable or not comparable.
3. IF no value on a figure card is rescaled, THEN THE figure card SHALL show no rescale note.
4. THE stored value SHALL stay as published, and the rescale SHALL stay exact (a power of ten) and display-only. THE source details SHALL keep "As published: {value} {unit}", with the stored value in full and in the published unit.

### Requirement 10: The receipts read in order

**User Story:** As a reader on the Receipts step, I want what I remembered beside the record first, so that I don't scroll past a letter I just read.

#### Acceptance Criteria

1. WHILE the Receipts step is shown for a letter with at least one sealed figure (stage 3 in `Reveal.tsx`), THE receipts column SHALL show these blocks top to bottom: each author question pair in sealed order (none if the letter has no author questions), the figure cards in sealed order, the letter folded under a "Read the letter again" control, the seal line, then the end card.
2. WHEN the Receipts step first renders the folded letter, THE letter text SHALL be hidden and only the "Read the letter again" control SHALL show, at 1440 × 900 and 390 × 844.
3. WHEN the reader activates "Read the letter again" by mouse, touch, Enter or Space, THE letter SHALL open in full in the same place in the column, and the control SHALL report its open or closed state to assistive technology. Under Calm the letter SHALL open with no motion.
4. WHILE the Read step is shown, or the Receipts step is shown for a letter with no sealed figures, THE receipts column SHALL keep spec 15 R12.2: each author question pair, then the letter in full and not folded, then the seal line and the end card.
5. THE order in 10.1 to 10.4 SHALL apply the same way to the fuel personas, Priya, the live demo and real letters (`/l/{id}`). No block SHALL be reordered, hidden or added based on which direction a figure moved.
6. WHILE `/demo/live` step 6 is shown, THE question pairs, the figure cards and the folded letter SHALL sit in one column horizontally centred within 1 CSS px of the viewport centre. Its width SHALL be within 1 CSS px of the persona receipts column at the same viewport, at 1440 × 900 and 390 × 844.
7. THE sound control SHALL appear only in the Top_Bar (spec 15 R5.1). No sound control SHALL render inside the receipts column or above a receipts heading.
8. WHEN the reader takes the "Show everything" path, THE receipts column SHALL show the blocks in the order of 10.1 for a letter with figures and 10.4 for a letter without, with the letter folded as in 10.2.
9. `product.md` (core loop step 7) and `tone.md` (the receipts moment) SHALL say that on the Receipts step the letter, already read, is folded after the figures.

### Requirement 11: The number field waits until you finish

**User Story:** As a reader typing "4.10", I want no error while I am still typing.

#### Acceptance Criteria

1. WHILE a figure question's number field holds focus and the reader has not tried to advance from it, THE Remember_Step SHALL NOT show `CEREMONY_COPY.numberUnreadable` for that field and SHALL NOT set `aria-invalid` on it for unreadable text. This holds after every keystroke, including text that cannot be read yet, such as "4." or "12a".
2. WHEN the number field loses focus, or the reader tries to advance from it (Enter in the field, or a press on Next or "Record my answers"), and its trimmed text is not empty and cannot be read as one number, THE Remember_Step SHALL show `CEREMONY_COPY.numberUnreadable` under the field, set `aria-invalid` on the field and link the message to it through `aria-describedby`.
3. IF the trimmed text of the number field is empty when it loses focus, THEN THE Remember_Step SHALL NOT show `CEREMONY_COPY.numberUnreadable`.
4. WHEN the message is shown and the reader's next edit makes the text readable or empty, THE Remember_Step SHALL clear the message and the unreadable `aria-invalid` on that edit, without waiting for the field to lose focus. While the text stays unreadable, the message SHALL stay shown.
5. WHILE the field text cannot be read, THE Remember_Step SHALL keep refusing to advance (Next and "Record my answers" stay disabled, as today) and SHALL show no value in the Recall_Scale label, whether or not the message is shown yet.
6. THE two-reading choice, the scale, the "No answer" checkbox and the value sent to the draft for each kind of text (canonical value, or "" for ambiguous, unreadable or empty text) SHALL keep their current behaviour.
7. THE task SHALL check the example in the message against the deployed site at `revenant.devclef.se`. The commit message body SHALL say which example the site shows and, if it differs from "1085.70", why.
8. THE tests in `RecallPager.field.test.tsx` that expect the message on first paint of "12a" SHALL be updated to 11.1 to 11.4, and each SHALL be named with its reason in a commit message body.

### Requirement 12: Break the seal says what happened

**User Story:** As a reader at the seal, I want one plain line about what was kept.

#### Acceptance Criteria

1. WHILE the break screen is shown for a live demo letter, a real letter (`/l/{id}`) or a fuel persona letter, THE break screen SHALL show "What you remembered is recorded." **(proposed)** from `CEREMONY_COPY.testimonyRecorded`, in place of "Your testimony is recorded."
2. WHILE the break screen is shown for the text persona letter (Priya), where no answer of the reader's is recorded, THE break screen SHALL show "You've read her recollections. Nothing of yours is recorded." **(proposed)** from the new key `CEREMONY_COPY.recollectionsRead`. It SHALL NOT show the line from 12.1.
3. WHERE the visually hidden live region in `ceremony/LiveRegion.tsx` announces the marks stage (the live demo and `/l/{id}`), THE live region SHALL announce "What you remembered is recorded." **(proposed)** from `CEREMONY_COPY.stageLive.marks`, in place of "Your answers are placed." On persona pages the region SHALL keep announcing the step, as it does today.
4. THE break screen SHALL show exactly one of the lines from 12.1 and 12.2, exactly once in its visible text, on every letter kind (spec 15 R1.5). The live region announcement in 12.3 is not counted as visible text.
5. THE lines in 12.1 to 12.3 SHALL contain no exclamation mark and none of the words "testify", "testimony" (any form), "wrong" or "caught", and SHALL NOT grade what the reader remembered (`tone.md`, `neutrality.md`).

### Requirement 13: The persona Remember step names its date once

**User Story:** As a judge, I want the written-as-of date once, near the question.

#### Acceptance Criteria

1. WHILE a persona Remember_Step shows a figure question, THE counter SHALL read "Question {n} of {total} · as of {date}". On that screen, this counter SHALL be the only place where the written-as-of date appears.
2. WHILE a persona Remember_Step shows an author question (Priya's included), THE line above the question SHALL read "As of {date} you asked yourself:". On that screen, this line SHALL be the only place where the written-as-of date appears, and the counter SHALL carry no date.
3. THE {date} in 13.1 and 13.2 SHALL be the persona's written-as-of date, in the same date format the persona page uses today.
4. WHILE any persona Remember_Step question is shown, THE step header and the help text ("Before you read it, say what you remember about that time.", Requirement 2.5) SHALL contain no date. THE header SHALL no longer show "Written as of {date}".
5. WHEN a tester counts the written-as-of date in the visible text of one persona Remember_Step screen, at 1440 × 900 or 390 × 844, THE count SHALL be exactly 1.
6. THE live demo and `/l/{id}` Remember_Step SHALL keep their sealing-date line ("On {date} you asked yourself:") unchanged.
7. THE persona letter SHALL stay labelled "as of" its date on the receipts. THE persona letter SHALL never claim to have been sealed on that date (`data-integrity.md`).

### Requirement 14: Press the seal, quick and solemn

**User Story:** As an author at the seal, I want the step short, with the warning I can't miss.

#### Acceptance Criteria

1. WHEN the live demo reaches Press the seal, THE step SHALL show the lost-passkey warning (`LIVE_COPY.warning`) with its text unchanged.
2. WHILE Press the seal is shown, before the first press, between the two presses and after them, THE lost-passkey warning SHALL be visible without a reader action. Visible means it is not inside a closed disclosure, not hidden and not collapsed. Without a reader action means the reader has not clicked, tapped, expanded or scrolled.
3. WHEN Press the seal is reached and the Step_Track scroll has finished, THE lost-passkey warning SHALL be wholly inside the viewport and SHALL sit above the wax (its bottom edge above the wax's top edge). This SHALL hold at 1440 × 900 and 390 × 844, with Calm on and off.
4. THE step paragraph (`LIVE_COPY.sealParagraph`) SHALL read "Press the wax twice: once to make your passkey, once to set the seal." **(proposed)**
5. THE first press's hint (`PRESS_COPY.stepOneHint`) SHALL read "Press the wax. The passkey is saved as "Revenant demo"." **(proposed)**
6. WHILE Press the seal is shown, in any of the states named in 14.2, THE text "Revenant demo" SHALL appear exactly once in the step's visible text, in the first press's hint.
7. WHILE Press the seal is shown, in any of the states named in 14.2, NO sentence SHALL appear more than once in the step's visible text. The heading, paragraph, warning, step hints, `PRESS_COPY.setting`, the press status line, the backup choice and `SealLinks` all count. Today `stepTwoHint` and `setting` are the same sentence, so after this change at most one of them can be visible at a time.
8. THE two presses, the backup choice and its confirmation, the cross-device help and the no-PRF path SHALL behave as before this spec. Their existing tests SHALL pass with only the string changes from 14.4 and 14.5. Any other test change SHALL be named with its reason in a commit message body (Requirement 17.8).

### Requirement 15: What we resurrected, short

**User Story:** As a visitor, I want the history in two lines and the reason it was built.

#### Acceptance Criteria

1. THE home section headed "What we resurrected" SHALL hold, in this order, the `resurrectedBody` text and the `noSealBody` text from "Proposed wording", together at most three sentences: what a wax seal showed, then the one thing no wax seal could do. **(proposed)**
2. THE home page SHALL no longer render a separate section headed "What no wax seal could do". Its text SHALL appear only inside the "What we resurrected" section, as 15.1 says.
3. THE home page SHALL NOT render the `BRAND_COPY.sealMapping` table. `/how-it-is-sealed` SHALL keep rendering that table unchanged, and the home page footer SHALL keep its link to `/how-it-is-sealed`.
4. THE "What we resurrected" section SHALL end with the maker's story under the heading "Why I built it" (`makerTitle`), unsigned. The `makerBody` text SHALL be in the first person and at most two sentences. It SHALL say that an English teacher had the class write letters to themselves and mailed them back fifteen years later, and that what the maker read was not what they remembered. **(proposed)**
5. EVERY sentence in the section SHALL have at most 25 words and no exclamation mark, and SHALL contain none of the words banned by `tone.md`, the existing banned-word test or Requirement 4.
6. `tone.md` SHALL name the maker's story as the only first-person passage in the UI. Everywhere else the second-person rule stays as it is.
7. THE wax-seal and no-seal sentences on the home page SHALL contain no year, date or count unless a source is linked beside it (the 1735 rule in `landing/copy.ts`). THE maker's story is the author's own recollection and is exempt from this rule. Its "fifteen years" SHALL NOT be presented as a sourced figure.
8. THE school story in the README (line 18) SHALL say "English teacher" and "fifteen years", the same as `makerBody`.
9. THE tests in `landing-sections.test.tsx` that pin the old section text (the four-sentence limit, the phrase "a letter in it can hold any part of life", and the `NoSealSection` render) SHALL be updated or retired under Requirement 4.7. A test SHALL check the three-sentence limit in 15.1, the two-sentence limit in 15.4, and that the home page has no `sealMapping` table.

### Requirement 16: Nothing sealed changes

**User Story:** As the owner, I want these fixes to leave every letter exactly as it was sealed.

#### Acceptance Criteria

1. THE PR for this spec SHALL change no sealed row, persona letter text, persona sealed question or sealed answer, envelope or envelope hash, letter id in `content/personas/personas.json`, sealed format, crypto primitive, key step, time lock, data source adapter or figure file value. A diff of the PR against `1183739` SHALL show no change under `src/lib/crypto/`, `src/lib/seal-format/`, `scripts/seal-personas*` or `drizzle/`, and no change to the API routes or the persona letter and sealed-answer files.
2. WHEN each persona letter is opened after this spec's changes, THE seal check SHALL pass with the same envelope hash it had at `1183739`, and THE receipts SHALL show the same sealed questions, sealed answers, letter text and figure values.
3. WHEN a figure is shown on any screen this spec changes (the figure card, the change line, the formula, the Number_Line and the source details), THE figure SHALL keep its value, unit, region, period, source and `retrieved_at` from the sealed letter or the figure file, and SHALL show its period beside it.
4. THE rose, fell and unchanged change lines, and a Then value above or below the At_Opening_Figure, SHALL use the same colour, weight, size and icon (or no icon). No colour or icon SHALL tell them apart.
5. THE PR SHALL raise no value in `scripts/check-js-budget.mjs`.
6. IF a task's change makes a route exceed its budget in `scripts/check-js-budget.mjs`, THEN THE task SHALL stop without merging that change, and SHALL report the route and its measured size beside the budget in a commit message body.

### Requirement 17: Verification

**User Story:** As the owner, I want to check the fixes the way I will record the video.

#### Acceptance Criteria

1. WHEN the Live_Walk runs with `WALK=1` against a local production build, THE Live_Walk SHALL walk `/demo/live` from Write to Receipts, each persona page from Remember to its last step, at 1440 × 900 and 390 × 844, and SHALL assert that each step track shows the step names of Requirement 2.1.
2. WHEN the Live_Walk runs with `WALK=1`, THE Live_Walk SHALL include the Press_Test of Requirements 1.11 and 1.12. Without `WALK=1`, both SHALL be skipped, as the Live_Walk is today.
3. THE layout check (`tools/qa/layout-check.mjs`) SHALL have one row for each of these, at 1440 × 900 and 390 × 844, each reporting pass or fail:
   - 10.1: on the Receipts step the elements appear top to bottom in the order of 10.1, and the letter is closed.
   - 10.6: on live step 6 the question pairs, the letter and the figures share one horizontal centre, within 1 CSS pixel, and the same width as the persona receipts column.
   - 14.3: the lost-passkey warning is unfolded and its box ends above the wax's top edge, inside the layout viewport, with no scroll.
   - 5.4 and 5.5: at 1440 × 900 the hero's first sentence takes one line box, and at 390 × 844 no headline line holds a single word.
4. THE README and `docs/video-script.md` SHALL contain "Remember" as the step name, the headline of Requirement 5.1, and the receipts order of Requirement 10.1. Apart from the README image alt text in 17.5, neither SHALL contain "testify", "testimony" (any form) or "Memory rewrites itself".
5. THE README image alt text SHALL name the words the image shows today, including "Testify". The image itself is not redrawn.
6. WHEN the final walk runs on merged `main`, THE walk report SHALL list each screen (route, step and viewport) where a string from this spec differs from the matching spec 15 shot under `docs/design/15-flow/shots/`, marked as an expected difference. THE report SHALL go in the commit message body or PR description of the final verification task.
7. IF the Live_Walk, the Press_Test or a layout check row from 17.3 fails on merged `main`, THEN THE verification task SHALL NOT be marked done, and the failing check, route and viewport SHALL be reported in its commit message body.
8. WHEN a task changes behaviour, THE task SHALL update or retire the tests that the change outdates, and SHALL name each test with its reason in a commit message body.

## Open questions

The owner decided every question below on review: the design's default (see `design.md`, "Open questions and the design's defaults"). The questions stay as the record.

1. **"Receipts" or "See the receipts".** This spec proposes "Receipts" as the one step name in every track and on the ritual card, and keeps "See the receipts" only as the button on the Read step. The tone moment is called "See the receipts". Confirm or swap. Decided: the default. "Receipts" in every track and on the ritual card, and "See the receipts" only as the Read step's button.
2. **Published precision for the Oil Bulletin.** The stored value is what the Bulletin's xlsx cell holds (`1741.8449858013737`). The precision the Commission prints in its published tables still needs to be checked. Until it is, Requirements 8.4 and 8.6 leave Tomás's formula at the stored value in full, so the raw float would stay. The owner may prefer that the formula show the same rounded values as the rows, with the existing "Values here are rounded for display" note. Decided: the default. No Published_Precision row for the Oil Bulletin, so Tomás's formula shows the stored value in full.
3. **The live demo's "At opening".** After a 30-second lock, "At opening" is accurate. For a real letter read days after `opens_at`, the figure is the latest when read. Confirm one label for every letter kind. Decided: the default. "At opening" on every letter kind, with the figure's own period beside it.
4. **The visual viewport `scroll` listener.** Spec 09 P9 also re-keeps on the visual viewport's `scroll`. WHILE Keyboard_Open, that can pull back a reader who scrolls on purpose. This spec keeps it under 1.4 to 1.7. Say if it should go. Decided: the default. The listener stays, gated by Keyboard_Open and Text_Field.
5. **The maker's story.** Confirm the wording and that it is unsigned, under the heading "Why I built it". Decided: the default. The proposed wording, unsigned, under "Why I built it".
6. **Pictures with old words.** `docs/readme-hero2x.png` and the spec 15 shots say "Testify". They are out of scope here. Say if the README image should be redrawn before the video. Decided: the default. Not redrawn, and the README alt text keeps "Testify" (17.5).
