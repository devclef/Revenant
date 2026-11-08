# Requirements Document

Spec: 10 Own questions

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category. Submissions close 4 December 2026, 2:00 PM PT. The owner's feature freeze is 27 November 2026. Judging runs 16 December 2026 to 29 January 2027, and the site must work the whole time. This spec was written on 8 November 2026, with every spec 09 task merged on `main` (`3d48d51`).

Today the Testify step asks only about public figures. That doesn't match the product the README promises: "memory rewrites itself", and testimony should be about the author's own life. Each of the three ways in has its own gap:

- **Real letters.** An author who seals a letter for six months is asked what a gallon of diesel cost. Nothing asks about their own life.
- **The persona demo.** The judge isn't Maya, and her letter never mentions a price, so the three parts of the reveal (testimony, letter, receipts) don't connect. The judge also picks the letter twice: once on `/demo`, then again with the Pick_Up_Button. The judge has to type an answer to every question before anything is shown.
- **The live demo.** After the 30-second lock the now figures equal the then figures, so the payoff shows nothing new.

This spec lets the author ask their future self up to three questions while writing. When the letter opens, the author answers them from memory before anything is shown. The reveal then shows each question with what they just said, followed by the full letter. The letter is the record. Revenant never compares the two.

The owner's production walk at 2560×1440, 1366×800 and 390×844 also found these problems on `main`:

- **Break the seal (`marks` Stage).** The WaxSeal sits in the middle of the Envelope the Ghost holds and covers its text ("Written as of 12 May 2024", "Opens 5 November 2024"). The Seal_Hint "Press and hold the seal to break it, or use the button below." floats left of the Ghost, is right-aligned, is clipped where it meets the Ghost's body, and says "below" when the button is up and to the left. That button sits alone in a large, nearly empty cream card with the Skip_Link, far from the seal, and in an outline style that differs from the orange primary button on every other Stage. At 600 px and wider the `marks` Stage shows none of the judge's answers.
- **Receipts.** The "Then" tick on the Number_Line floats 60 to 90 px below the axis, cut off from its label, at the Desktop_Sizes and the Phone_Sizes.
- **Phone persona start.** At 390×844 the Ghost covers the Persona_Intro text, and the Step_Indicator is cut off ("Testify Brea…", and only "See the receipts" while on Testify).
- **Neutrality.** The persona opening dates carry election names: "U.S. presidential election day" for Maya and "European Parliament election" for Tomás, on the `/demo` envelopes and in the Persona_Intro. An election name next to a price that went up reads as political.
- **README.** The status line still says spec 08 is in progress, and the persona demo line describes "a real US election window".

Requirements are grouped and numbered by priority: G (rules for every task); S (steering and the copy scans, first); X (production bugs and the election labels, P0); C (the critical path, P1, in this order: C1 dropping the pick-up Stage, C3 the Recall_Record v2, C4 Testify, C2 the Write step questions, C5 the prefilled samples, C6 Break the seal, C7 the other Stages, C8 the Reveal, C9 the live demo payoff); P (persona letters that carry the price, P1, after C5 and alongside C6 to C9); R (self-reported numbers, moved in from spec 08, after C9); E (final audit and presentation). Every group ships; there is no cut line. Every rule of `.kiro/steering/` and of specs 02 to 09 still holds unless "Rules this spec replaces" names it.

## Code facts this spec relies on

Checked against `main` at `3d48d51` on 8 November 2026, in a local checkout at that commit.

| Topic | What exists |
|---|---|
| Sealed format | `src/lib/seal-format/v1/payload.ts` (frozen): `recall_questions` is a discriminated union on `answer_type`. A `"text"` question has `id` (1 to 200 characters), `text` (1 to 500 characters) and an optional `metric_id`. At most 20 recall questions, 50 metrics and 50 figures per payload; none of the three arrays has a minimum, so a payload with no figures and no metrics is valid. Self-reported figures (`kind: "self-reported"`, `source: "self-reported"`, no `source_url`) are already part of v1. |
| Recall_Generator | `src/lib/recall/generate.ts`: number questions only, IDs `q1`, `q2`, …, text "What do you think {subject} cost then?". |
| Recall_Record | `src/lib/recall/record.ts`: strict `version: 1`, at most 20 answers, each `{question_id, kind: "number", value}` (non-negative decimal, 1 to 40 characters after trim) or `{question_id, kind: "no_answer"}`. `buildRecallRecord` treats every non-"no answer" draft as a number. |
| Record encryption | `encryptOpeningRecord` in `src/lib/crypto/opening-records.ts` takes any JSON value and encrypts `UTF-8(canonicalize(value))`. No crypto change is needed for a new record version. |
| Record reading | No production code reads a stored record. `decryptOpeningRecord` is exported from `src/lib/crypto` but called only by tests, and `src/app/api/openings/route.ts` exports `POST` only. A second opening of the same letter asks for testimony again. |
| Size limit | `POST /api/openings` rejects a request body over 100,000 characters and a ciphertext over 65,536 bytes; the `openings_ciphertext_len` CHECK in `drizzle/0000_sealed_letters.sql` has the same 65,536 bound. The route never parses the record. |
| Opening_Flow | `opening-machine.ts`: `OPENED` moves `verifying` (persona) or `unlocking` (Live_Letter, Real_Letter) to `verified`; only `BEGIN` moves `verified` to `recall`. The `verified` view is `EnvelopeView` variant `verified`, which shows `sealIntact` and the Pick_Up_Button ("Pick up the letter") for every letter kind, gated by `showPickUp` until the Emergence is done. |
| Live unlock | On `/demo/live` (the Live_Stepper's Wait step) and on `/l/[id]`, the reader presses "Unlock with your passkey" (the WebAuthn `get()` runs in that click) or submits the backup key, and then also has to press "Pick up the letter". The second press starts no WebAuthn call and unlocks no audio, so it is not needed as a user gesture. |
| Focus rule | `focusTargetFor(prev, next)` in `src/components/ceremony/stages.ts` reads only the two Stages and returns `default` for every entry into `recall`. `focusStageDefault` in `CeremonyRoot.tsx` then calls `focus()` with no `preventScroll` on `[data-stage-focus]`, which the recall view puts on the answer field (spec 07 R9.6, R11.2), so the browser scrolls to the field. The table's cases are pinned in `CeremonyRoot.test.tsx` ("CeremonyRoot focus rule"). Skip from `marks` or `seal` returns `figures-heading`. |
| Stage list | `stages.ts`: `emerging`, `sealed`, `envelope`, `intact`, `recall`, `marks`, `seal`, `letter`, `figures`, `close`, `error`. The persona Step_Indicator (`ceremony/steps.ts`) maps `recall` to Testify and shows no current step in `intact`. The Live_Stepper has its own step list (`live/stepper/live-steps.ts`) and does not share the Stage list. Both render `src/components/ui/StepIndicator.tsx`. |
| `marks` Stage answers | `src/components/reveal/Reveal.tsx`: below 600 px the `marks` card shows the Answer_List (`AnswerList.tsx`, number questions only) above the SealBreak. At 600 px and wider the `marks` card in stage 1 holds only the SealBreak; the marks rows and the read-only Recall_Scales appear only inside the closed "Your testimony" disclosure from `figures` on. The WaxSeal goes on the held Envelope only at 900 px and wider (`SEAL_ON_ENVELOPE_MIN_PX` in `ceremony/seal/seal-placement.ts`). |
| Recall pacing | One question per screen. The recall view shows "Next question" (`REVEAL_COPY.nextQuestion`) on every question but the last, and "Record my answers" (`REVEAL_COPY.submit`) on the last. Break the seal is `CEREMONY_COPY.sealButton`; "See the receipts" is `REVEAL_COPY.stage2Next`. |
| Seeded random | `src/components/ceremony/scene/rng.ts` exports `mulberry32(seed)`. It is deterministic for a seed and reads no clock or `Math.random`. A per-visit pick still needs a fresh seed for each visit. |
| Randomness scan | `src/components/ceremony/source-scan.test.ts` scans every non-test `.ts`/`.tsx` file under `src/components/ceremony` for `Math.random` and `Date.now` outside comments and strings, with only `dust.ts` and `rng.ts` allow-listed by basename. No scan forbids `crypto.getRandomValues` in components; `src/middleware.ts` and `src/lib/letter-store/drafts.ts` already call it. |
| Number formatting | `rescaleForDisplay(value, divisor)` in `src/lib/figures/rescale.ts` shifts the decimal point exactly; `displayRescaleForUnit("EUR per 1,000 litres")` gives divisor 1,000. `formatValue(value, region, fractionDigits?)` in `src/lib/figures/format-change.ts` formats the decimal string with `roundingMode: "halfExpand"` in the region's locale (`en-US` for "U.S.", `en-GB` otherwise). With no `fractionDigits`, the Receipt_Card shows the published precision (for example 3.643). |
| Persona Then_Values | In `src/lib/figures/real/fuel-figures.json`, the latest weekly figure on or before 12 May 2024 is period 2024-05-06 for all four tracked series: `us-gasoline-regular` 3.643 and `us-diesel` 3.894 USD per gallon; `eu-petrol-euro95` 1791.3149889844324 and `eu-diesel` 1645.194212158339 EUR per 1,000 litres. At two decimals through the Display_Rescale: 3.64, 3.89, 1.79 and 1.65. The design confirms these against the sealed payloads before P1 is written. |
| Persona content | `content/personas/personas.json` is validated by the strict schema in `src/lib/personas/schema.ts`. Both personas carry an `opening_event` with an election name. `src/lib/personas/letter-checks.ts` fails any persona letter that contains a digit, `$`, `€`, `£` or a currency word (spec 03 R1.8). Current letter IDs: Maya `ydsos6hcjdEUOs3sK42RQg` (renewed by spec 09 task 13), Tomás `8t6Bz4bWlaUky-byt1mzGg`. |
| Write step | `src/components/live/WriteForm.tsx` serves `/demo/live` (Live_Stepper) and `/seal` (`mode="real"`, behind `realSealingOn()`). Three Prompt_Starters exist (`promptStarters` in `live/copy.ts`). `build-payload.ts` seals only official figures and only Figure_Questions. `src/components/live/form.ts` reports `figures_none` below `MIN_FIGURES` (1, in `constants.ts`) for both modes (spec 06 R13.2: 1 to 6 series). |
| Copy scans | `tools/hooks/tone-check.mjs` skips `*.test.*` files and scans changed files under `src/app/**/*.tsx`, `src/components/**` and `content/personas/**`. The `copy-tone-check` IDE hook matches `src/**/*.tsx` and `content/**/*.md|txt`. `src/test/retired-phrases.test.ts` scans source files for Retired_Phrases. None of them reads text a user types at runtime. |
| Steering text | `.kiro/steering/product.md` lines 79 to 84 describe Demo 1 as "written before a recent election" and list the windows as "presidential election, 5 November 2024", "European Parliament election, 6–9 June 2024" and "Riksdag election, 11 September 2022". `.kiro/steering/neutrality.md` line 22 says elections appear as dates "described in plain terms ("2028 U.S. presidential election day")" and are used for the demo persona windows. |
| Presentation docs | `docs/` holds `agent-loop.md`, `design/`, and images only. `docs/kiro-writeup.md` and `docs/video-script.md` do not exist and have never been in git history. The README has no "Judge quick path" box and its status line names spec 08. Spec 09 task 24 is ticked, but its Owner_Patches t (README judge box), u (`docs/kiro-writeup.md`) and v (`docs/video-script.md`) were not committed at `3d48d51`, and neither was spec 09 Owner_Patch o (`.github/workflows/freshness-check.yml` and `keepalive.yml`). The owner is committing patches o, t, u and v now, outside this spec. |
| Ownership | `src/lib/recall/**`, `src/lib/personas/**`, `content/personas/**` and `src/components/**` are frontend-dev. `scripts/seal-personas*`, `src/lib/seal-format/**`, `src/lib/crypto/**` and `src/app/api/openings/**` are crypto-dev. `.kiro/**`, `tools/**`, `README.md`, `docs/**`, `.github/**` and `scripts/check.sh` are owner-only. |

## Decisions already made

| Topic | Decision |
|---|---|
| Deadlines | Group S and group X merged by 13 November 2026. Real sealing go/no-go on 20 November 2026, unchanged (spec 08 R25). Feature freeze 27 November 2026. Submission 4 December 2026, 2:00 PM PT. |
| Order | Steering patch, then the production bugs, then the critical path: drop the pick-up Stage (C1), Recall_Record v2 (C3), Testify (C4), Write step questions (C2), prefilled samples (C5), Break the seal (C6), the other Stages (C7), Reveal (C8), live demo payoff (C9). Group P after C5, group R after C9, group E last (G3). |
| Testify before the Write step | C3 and C4 are built and tested with fixture letters that carry text questions, so no deploy hold is needed between C2 and C4: the Write step questions ship only after Testify can answer them (G3.1). |
| Scope | Everything in this spec ships, including group R and the per-visit Sample_Pick (C5.6). There is no cut order. |
| Sealed format and crypto | No change. Author_Questions are sealed as v1 `"text"` questions with no `metric_id` and no new `format_version`. The key hierarchy, time lock, envelope, header fields and hash stay exactly as they are. |
| Recall_Record | A new version 2 adds a Text_Answer kind of 1 to 1,000 code points and the Sample_Flag. Version 1 records stay valid for the exported parser. It is encrypted with the existing opening records key and stays under the 65,536-byte ciphertext limit at the Max_Record (C3). |
| Sample_Flag | Stored in the encrypted Recall_Record_V2 on a number answer that is a Kept_Sample, so the record itself says the answer was a sample (C3.4, C5.8). |
| Size check | Checked at the Max_Record only: 3 Text_Answers and 17 number answers, every number answer carrying the Sample_Flag. There is no 3 plus 20 case, because the v1 payload allows at most 20 questions (C3.6). |
| Author_Questions | 0 to 3 per letter, 1 to 200 code points each. A row that is empty after trimming is dropped at sealing and never blocks it; only a row longer than 200 code points blocks. Neutral Question_Starters that don't lead, and one plain line suggesting the author also answers them in the letter (C2). |
| Author_Questions in the live demo | Optional. `/demo/live` starts with one editable, removable Author_Question row holding "What's on your mind right now?". `/seal` starts with no prefilled row (C2.12, C9.5). |
| Figures on a Real_Letter | A Real_Letter with at least one Author_Question may seal 0 figures; its Reveal then shows no receipts step. A Real_Letter with no Author_Question needs 1 to 6 figures. `/demo/live` keeps 1 to 6 figures (C2.13, C8.9). |
| More than 3 text questions | An opened payload with more than 3 text questions shows the `invalid_payload` FlowError. No letter Revenant sealed can hit this (C3.9). |
| Testify | Author_Questions first, each with a free-text field and a "No answer" control. One question per screen with the existing "Next question"; "Record my answers" only on the last question. Answers are stored before anything is shown (spec 03 R8.1, unchanged). |
| Focus on page load | On the persona page, `recall` is entered on page load with no user gesture: focus goes to the recall Stage heading with `preventScroll`, not to the answer field, and nothing scrolls. After a passkey or backup key unlock, the current rule stays: focus goes to the answer field (C1.12). |
| Fastest_Path | 4 activations for a persona with two Figure_Questions: Next question, Record my answers, break the seal, See the receipts (C5.12). |
| Reveal | For each Author_Question: the question, then "What you said just now". Below that, the full letter with nothing placed against its lines (C8, spec 07 R13 and the ceremony-truth-check rule 3). |
| `marks` Stage | The Answer_List shows at every size in the Content_Column, Author_Questions first, Text_Answers clamped to three lines. The Seal_Hint and Seal_Button sit together at the Ghost, beside the Ghost_Body_Box edge facing the Content_Column, level with the WaxSeal (C6). |
| Skip | Skip moves focus to the Author_Testimony heading when the letter has Author_Questions, and to the Figures_Heading otherwise (C6.5). |
| Neutrality | Revenant never scores, diffs, highlights, summarises or interprets the gap between the testimony and the letter. No similarity measure, no AI. Written into `neutrality.md` (S1). |
| Live demo | Gets Author_Questions too. Its payoff leads with them; the figures come after (C9). |
| Real letters | `/seal` uses the same Write step. The 20 November go/no-go is unchanged. |
| Self-reported numbers | In this spec: spec 08 later-tasks task 23, moved in as written and adjusted where it touches the same Write step and Reveal files (group R). |
| Persona demo | Personas keep Figure_Questions only. The testimony is framed as the judge's own memory of that month. Each Figure_Question gets a prefilled Sample_Answer picked at random from 3 to 5 stored Sample_Candidates, one of which is the Record_Candidate (the Then_Value at two decimals, as the Testify field shows it), so some samples equal the record. No candidate is ever labelled right, close, wrong or off (C4, C5). |
| Sample answers and `tone.md` | `tone.md` is amended for Persona_Letters only: the judge never lived the persona's life, and the Sample_Label makes the sample visible. Every other letter keeps "no hints about what's inside" (S1.4). |
| Spread_Rule thresholds | Near within 5% of the Then_Value, below at most 85%, above at least 115%. The Record_Candidate counts as the Near_Candidate. The design may tighten the thresholds but not loosen them (C5.2). |
| Sample_Pick seed | Drawn after hydration in a `useEffect` with `crypto.getRandomValues`, never in render and never with `Math.random` or `Date.now`, so the scan in `source-scan.test.ts` passes with no new allow-list entry (C5.6). |
| Persona letters | Each letter states each tracked figure's Then_Value as an official average the persona saw, in her or his own words, at two decimals with "about" ("Regular was about $3.64 a gallon this week."), equal to the sealed value after `rescaleForDisplay` and `formatValue(value, region, 2)`. Never a price the persona paid, since personas have no personal numbers (P1). |
| Persona reseal | Both personas are resealed under new letter IDs. The owner seals the new rows before the image that carries the new IDs goes live. The old rows stay in the database, because the immutability triggers forbid deleting them (P2). |
| Election labels | Removed from every opening date. The dates stay (X4). |
| Pick-up Stage | Removed for every letter kind, with one code path. The persona page opens straight on Testify once the envelope has loaded and its hash has been checked. The Live_Letter and Real_Letter unlock goes straight to Testify after the passkey or backup key (C1). |
| Stored records | No production code reads a stored record, and this spec adds none. The version-aware parser is exported and covered by tests (C3.7). |
| Sound | Off until the judge presses "Turn sound on" (spec 05 R14, spec 09 C4.4). No Stage is needed to unlock audio. |
| Evidence sizes | 2560×1440, 1366×800, 1280×800, 390×844 and 360×640, with and without reduced motion for every on-screen task in groups C, X and P (G2.4). |
| Presentation docs | The owner commits spec 09 Owner_Patches o (`freshness-check.yml`, `keepalive.yml`), t (README judge box), u (`docs/kiro-writeup.md`) and v (`docs/video-script.md`) now. This spec's README and docs patches build on those committed files and do not apply them again (X3.3, E1.3). |
| Privacy and size | Spec 09 G1.5 and G1.6 unchanged: the CSP header byte-identical, no request to another origin, nothing written to storage, cookies or the URL, no new `dependencies` entry, no animation library, no WebGL, every route inside `scripts/check-js-budget.mjs`. |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **`product.md`, Decisions, "Testify step (MVP)"** (fixed questions generated from the tracked data points; AI questions post-MVP): replaced by S1.2. AI-generated questions stay out of scope.
- **`product.md`, Core loop step 6 and Demo 1 bullets** (testify only to sealed figure questions; the judge opens the letter with no prefilled answers; the Demo 1 windows described as elections in lines 79 to 84): extended and rewritten by S1.2.
- **`neutrality.md` line 22** (elections described in plain terms, such as "2028 U.S. presidential election day", used for the demo persona windows): rewritten by S1.3.4.
- **`tone.md`, "Testify: one question at a time, gentle prompts, no hints about what's inside"**: kept, with one exception for Persona_Letters only: the labelled Sample_Answer (S1.4).
- **Spec 03 R1.8 and its test in `src/lib/personas/letter-checks.ts`** (no digit, currency symbol or currency word in a persona letter): replaced by P1. A persona letter may contain exactly the Letter_Price_Lines P1 defines and no other digit or currency.
- **Spec 03 R7.5** (the seal-verified message, then a control, before the recall step), **spec 05 R5.3** and the `intact` row of **spec 05 R3** (the control that sends `BEGIN`): replaced by C1. The seal-verified message is still shown before any question, as part of the Testify_Context.
- **Spec 05 R1.2, spec 07 R1.4, spec 08 R1.4 and spec 09 G1.5, first item** (the states, events and transitions of `opening-machine.ts` unchanged; only existing events): replaced by C1 and C3 for exactly these changes: the judge-driven `BEGIN` gate and the Pick_Up_Button go; the recall drafts may start with Sample_Answers; the record type becomes the Recall_Record v2. Every other state, event and transition, the one-attempt rule, the single submission, the retry with the same bytes, and the reveal gate (only a stored record enters `reveal`) stay.
- **Spec 07 R2.1 `intact` row, R2.7 (no timer from `intact` to `recall`), R9.8 to R9.12, R9.14 and R9.16 (Pick_Up_Button parts), R10.3 to R10.9, R18.3, R19.6 (Pick_Up_Button target), the R24.3 Pick_Up_Button row, the R26 pick-up gate property, and the Pick_Up_Button and First_Step glossary terms**: replaced by C1 and the First_Step entry in the Glossary. The Ghost still rises with the Envelope and holds it through Testify (C1.5).
- **Spec 07 R9.6 and R11.2, and the spec 08 `focusTargetFor` table, for an entry into `recall` on page load** (focus the answer field named by `[data-stage-focus]`): replaced by C1.12 on the persona page. Entry after a passkey or backup key unlock keeps the current rule.
- **Spec 09 C1.1** ("from the first render until the Pick_Up_Button is activated") and **spec 09 C9.2** (Persona_Intro and Pick_Up_Button in the First_Viewport in `intact`): replaced by C4.3 and C4.4 (the Testify_Context above the first question).
- **Spec 09 C2.1 and C2.2** ("from the `intact` Stage"; "in `intact` no step shall be current"): replaced by C1.7.
- **Spec 09 C1.1 item 2, C1.3, C1.5, the event part of L5.2 and OD20** (the Opening_Event name and link on the Persona_Intro and the `/demo` envelopes, and Maya's Opening_Event): replaced by X4. The plain opening dates stay.
- **Spec 09 G1.7 and spec 08 "Recall_Record schema unchanged"**, and **spec 03 R3.1** (the version equals `1`): replaced by C3. Version 1 is never edited and stays valid for the exported parser.
- **Spec 03 R3.4** (empty input is invalid unless "No answer" is chosen): kept for typed answers. A Sample_Answer left in place is a valid answer (C5.5).
- **Spec 09 C4.1, C5.1 and C5.2** (the Break the seal button and the Skip_Link stay in the Content_Column; the instruction line within 48 px of the Envelope's box): replaced by C6. The `sealInstruction` string is replaced by C6.3.
- **Spec 09 C4.2 and C4.3, and spec 08 R2.1 to R2.3, for Skip** (Skip moves focus to the Figures_Heading): replaced by C6.5 when the letter has at least one Author_Question.
- **Spec 09 P6.4 and C3.4, for the `marks` Stage in stage 1** (the Answer_List on the phone only; no answers shown at 600 px and wider): replaced by C6.10. The closed "Your testimony" disclosure from `figures` on stays.
- **Spec 09 D3.2** (nothing prefilled on the Write step): replaced on `/demo/live` only, for the one Author_Question row C9.5 prefills. The letter field still starts empty everywhere, and `/seal` prefills nothing (C2.12).
- **Spec 06 R13.2 and `MIN_FIGURES` in `src/components/live/form.ts`, on `/seal` only** (choose 1 to 6 series): replaced by C2.13. A Real_Letter with at least one Author_Question may seal 0 to 6 figures. `/demo/live` keeps 1 to 6.
- **Spec 06 R14.1 and the `build-payload.ts` rule "a self-reported figure never reaches the payload"**: replaced by group R.
- **Spec 06 R12 and spec 09 D2.1 and D3** (the Write step holds the letter field and its Prompt_Starters only): extended by C2 (the Author_Question rows) and group R (the self-reported rows).
- **Spec 08 R26.1's WHERE clause and spec 08 R26.7** (the conditions spec 08 put on self-reported numbers): replaced by group R. R26.1 applies as an unconditional requirement.
- **Spec 09 G2.2** (the property test tag): this spec's tag is `// Feature: 10-own-questions, Property N: <title>`.
- **Spec 08 later-tasks task 23**: moved into group R of this spec. Spec 08 task 24's self-reported check is done by E1.2.

## Out of scope

- Any change to `src/lib/seal-format/**`, `src/lib/crypto/**`, the key hierarchy, the time lock, envelope header fields, the envelope hash or any `format_version`.
- Any change to `POST /api/openings`, its size limits or the `openings` table.
- Any production code path that reads, decrypts or shows a stored Recall_Record.
- AI-generated questions, a summary of the letter, a similarity measure, a diff, a highlight, a match score or any other comparison between testimony and letter.
- Author_Questions for Persona_Letters, or personas with personal numbers.
- New official series, new personas, Sweden.
- Editing Author_Questions after sealing.
- Moving the persona opening dates. Only the event names go.
- Deleting the old persona rows. The immutability triggers forbid it.
- Removing the second passkey prompt at sealing (spec 09 "Two passkey prompts").

## Known limitations

- **A second opening asks again.** No production code reads a stored record, so a reader who opens the same letter a second time is asked to testify again and is not shown the first testimony. Each opening appends its own encrypted record. Showing an earlier testimony is post-MVP.
- **Old persona rows remain.** The rows under the retired persona letter IDs stay in the database, because the immutability triggers forbid deleting them. Nothing links to them.

## Glossary

- **Author_Question**: A question the letter's author writes on the Write step for their future self. Sealed as a v1 recall question with `answer_type: "text"`, no `metric_id`, and the text as typed after trimming (C2).
- **Figure_Question**: A recall question with `answer_type: "number"` and a `metric_id`, written by the Recall_Generator from a tracked figure.
- **Question_Starter**: A neutral starter question the author can click to fill an empty Author_Question row (C2.4).
- **Live_Prefill**: The one Author_Question row `/demo/live` starts with, holding "What's on your mind right now?", which the judge can edit or remove (C9.5).
- **Answer_In_Letter_Line**: The one plain line on the Write step that suggests the author also answers their Author_Questions in the letter itself (C2.5).
- **Recall_Record_V2**: Version 2 of the Recall_Record, which adds the Text_Answer kind and the Sample_Flag (C3).
- **Record_Parser**: The exported version-aware function in `src/lib/recall/` that parses a decrypted record of version 1 or version 2 (C3.7).
- **Text_Answer**: A Recall_Record_V2 answer of kind `text`, holding 1 to 1,000 code points as typed after trimming.
- **Kept_Sample**: A submitted number answer whose submitted text equals the prefilled Sample_Answer exactly, character for character, whatever the judge did in the field before submitting.
- **Sample_Flag**: The marker on a Recall_Record_V2 number answer that says the answer is a Kept_Sample (C3.4).
- **Max_Record**: The largest Recall_Record_V2 the schema accepts: 3 Text_Answers of 1,000 code points and 17 number answers of 40 characters, every number answer carrying the Sample_Flag, with 200-character question IDs, every character chosen for the longest canonical JSON encoding (C3.6).
- **Load_Entry**: Entry into the `recall` Stage on page load, with no user gesture in between: the persona page's path from `emerging` to `recall` (C1.12).
- **Gesture_Entry**: Entry into the `recall` Stage straight after a passkey or backup key unlock the reader pressed (C1.12).
- **Testify_Context**: The compact block above the first question on the persona page: the Persona_Intro in its compact form and the seal-verified statement (C4.3).
- **Memory_Line**: The line on the persona Testify step that frames the testimony as the judge's own memory of the written-as-of month, for example "You lived through May 2024 too." (C4.2).
- **Sample_Candidates**: The 3 to 5 candidate answers stored for one persona Figure_Question in the persona content, next to the letter and outside the sealed payload, one of them the Record_Candidate (C5.1).
- **Record_Candidate**: The Sample_Candidate equal to the sealed Then_Value at two decimals, as the Testify field shows it (after any Display_Rescale), for example 3.64 for Maya's regular gasoline value 3.643 (C5.2).
- **Sample_Answer**: The one Sample_Candidate picked for a Figure_Question on a visit and filled into its Testify field (C5.4).
- **Sample_Pick**: The pick of one Sample_Candidate per Figure_Question, made with `mulberry32` from a seed drawn fresh for each visit (C5.4, C5.6).
- **Sample_Note**: The Testify line that says a sample answer is filled in and can be changed (C5.5).
- **Sample_Label**: The label "sample answer" next to a Kept_Sample under "Your testimony" and on the Receipt_Card (C5.8).
- **Spread_Rule**: The rule on the Sample_Candidates of one question: at least one Near_Candidate, one Below_Candidate and one Above_Candidate (C5.2).
- **Near_Candidate**, **Below_Candidate**, **Above_Candidate**: A Sample_Candidate within 5% of the Then_Value as the Testify field shows it; at most 85% of it; at least 115% of it (C5.2).
- **Author_Testimony**: The Reveal block that shows each Author_Question followed by "What you said just now" and the Text_Answer, or "No answer" (C8).
- **Author_Testimony_Heading**: The heading of the Author_Testimony block, and the Skip focus target for a letter with Author_Questions (C6.5).
- **Letter_Price_Line**: A sentence in a persona letter that states one tracked figure's Then_Value at two decimals, with "about", in the unit the Testify field uses (P1).
- **Seal_Hint**: The one instruction line next to the WaxSeal in the `marks` Stage (C6).
- **Seal_Button**: The fallback "Break the seal" button for keyboard and touch (C6).
- **Seal_Group**: The Seal_Hint and the Seal_Button, placed together as one group (C6.3).
- **Envelope_Text**: Every text element drawn on the Envelope the Ghost holds: the display name, "Written as of {date}" and "Opens {date}".
- **Fastest_Path**: The persona path with the fewest activations from page load to the Figures_Heading, keeping every Sample_Answer. For a persona with two Figure_Questions it is 4 activations: Next question, Record my answers, break the seal, See the receipts (C5.12).
- **Then_Tick**: The tick and label of the Then_Value on the Number_Line of a Receipt_Card (X1).
- **Opening_Event_Label**: Any rendered event name or event link next to a persona opening date (X4).
- **Our_Copy**: Text Revenant writes: copy modules, page source, persona content files and the Open Graph image source.
- **User_Content**: Text a reader types at runtime: the letter, Author_Questions, Text_Answers and self-reported fields. It never lives in a source file. The Live_Prefill text is Our_Copy until the judge edits it.
- **FlowError**: The existing error view, `src/components/reveal/FlowError.tsx`, shown for `not_placed`, `unreachable`, `verification_failed` and `open_failed`.
- **First_Step**: The `emerging` Stage on the persona page, ended when the `recall` Stage starts. Every Stage after it is after the First_Step. This replaces the spec 08 term.
- **Evidence_Sizes**, **Phone_Sizes**, **Wide_Size**, **First_Viewport**, **Compact_Top_Bar**, **Compact_Ghost**, **Answer_List**, **Real_Device_Check**, **Production_Check**, **Journey_Check**, **Persona_Intro**, **Opening_Event**, **Step_Indicator**, **Receipt_Card**, **Skip_Link**, **Seal_Verdict**, **Letter_Disclosure**, **Caption_Block**, **Display_Rescale**, **Live_Stepper**, **Prompt_Starter**, **Retired_Phrases**, **Copy task**, **WaxSeal**, **Envelope_Flap**, **Brand_Copy**: as defined in spec 09.
- **Judge**, **Desktop_Sizes**, **QA agent**, **Recall_Number_Parser**, **Figures_Heading**, **Letter_Text**, **Then_Value**, **Now_Value**, **Answer_Value**, **Unit_Range_Table**, **Hero**, **Catalogue**, **Figures_API**, **Real_Letter**, **Real_Seal_Page**, **How_Page**, **Owner_Patch**, **Self_Reported_Figure**: as defined in spec 08.
- **Scene**, **Ghost**, **Soil**, **Emergence**, **Envelope**, **Envelope_Front**, **Pick_Up_Button**, **Top_Bar**, **Letter_Block**, **Accent**, **Calm_Mode**, **Figure_Entry**, **Content_Column**, **Ghost_Box**, **Ghost_Body_Box**, **Recall_Pager**, **Scoring_Words_Always**, **Scoring_Words_Scene**, **Scene_Copy_Modules**: as defined in spec 07.
- **Ceremony**, **Stage**, **Skip**, **Mark**, **Recall_Scale**, **Number_Line**, **Seal_Break**: as defined in spec 05.
- **Persona_List**, **recall_subject**, **Persona_Letter**, **Recall_Generator**, **Recall_Record**, **Demo_Index**, **Opening_Flow**, **Reveal**, **Then_Figure**, **Now_Figure**, **Demo_Key**, **Sealing_Script**: as defined in spec 03.
- **Live_Letter**, **Letter_Page**, **Seal_Page**, **Sealing_Flow**, **PRF_Check**: as defined in spec 06.

## Requirements

### G1. Roles and boundaries

**User story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

1. THE task's PR SHALL change only files that are matched by the task role's paths or the `shared` list in `.github/agents.json` and are listed in the task's Scope.
2. THE frontend-dev and platform-dev tasks SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`.
3. WHEN a task needs a change to `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`, THE task SHALL attach the change as an Owner_Patch to its issue or PR description, and its PR diff SHALL contain no change to that file.
4. THE PRs SHALL keep spec 09 G1.5 except its first item, which "Rules this spec replaces" limits: the CSP header value byte-identical; no browser request to another origin; nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment; no new entry in the `dependencies` object of `package.json`.
5. THE PRs SHALL add no animation library, no WebGL, no new font, and no sound or vibration cue, and every route SHALL stay at or under its budget in `scripts/check-js-budget.mjs`.
6. THE PRs SHALL change no crypto primitive, key hierarchy step, envelope header field or `format_version`, and SHALL edit no line of `src/lib/seal-format/v1/payload.ts` or of the Recall_Record version 1 schema.
7. EVERY string of Our_Copy that a PR adds or changes SHALL live in its feature folder's copy module or in the persona content files, SHALL pass the `neutrality.md` copy test and the `tone.md` copy rules (second person, at most 25 words per sentence, no exclamation mark, no pun), and SHALL contain none of the Scoring_Words_Always; strings in the Scene_Copy_Modules SHALL also contain none of the Scoring_Words_Scene.
8. THE Accent SHALL mark only the reader's own answer, the main buttons, the wax and the focus ring (spec 09 G1.9). A Kept_Sample is the judge's submitted answer and MAY use the Accent, with its Sample_Label in the text colour.

### G2. Tests and evidence

**User story:** As the owner, I want proof from the browser and from production, so that a task that passes locally can't fail silently on the live site.

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser (spec 08 R30.1).
2. THE property tests the design lists SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 10-own-questions, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the commit SHA, the exit status and PASS or FAIL in its PR description.
4. EACH task that changes anything on screen SHALL attach PNG screenshots of every Stage or page it changes at each of the Evidence_Sizes, named `<stage-or-page>-<width>x<height>.png`, and, for every group C, group X and group P task, the same set with `prefers-reduced-motion: reduce` named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots SHALL be First_Viewport captures, plus one full-page capture per page.
5. EACH task's PR description SHALL state every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, every earlier-spec test it changed or retired with the reason, every asset it added with its size in bytes, and every Owner_Patch it attaches, writing "none" for an empty list.
6. EACH group X, group C and group P task SHALL state a Production_Check and a Real_Device_Check (spec 09 G2.6, G2.8), and THE owner SHALL record both results in the task's issue after deploy. A failure SHALL be handled as spec 09 OD14 describes.
7. THE QA agent SHALL run the rows of the design's "QA browser steps" table that the task lists, found with the pattern `^\| 10 \|`, and the `npm run layout-check` checks the task's "QA check" lines name, passed with `--require`.
8. EACH copy task SHALL attach the result of `node tools/hooks/tone-check.mjs` for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing that no Retired_Phrase remains (spec 09 G2.9).

### G3. Task order

**User story:** As the owner, I want the work in the order of the critical path, so that the demo's main change lands first.

1. THE tasks SHALL be numbered so that the S1 Owner_Patch task comes first, every group S and group X task has a lower number than every group C task, and the group C tasks follow this order: C1, C3, C4, C2, C5, C6, C7, C8, C9. THE C3 and C4 tasks SHALL be built and tested with fixture letters that carry text questions, so that the C2 task needs no deploy hold. Group P tasks SHALL follow C5. Group R tasks SHALL follow C9. Group E SHALL come last.
2. EACH task SHALL be one GitHub issue and one PR for one role, with a changed-line estimate at or under `max_changed_lines` in `.github/agents.json` (5,000).
3. NO role task SHALL be dispatched before the S1 Owner_Patch is committed on `main`. EVERY task SHALL list "steering updated (S1 Owner_Patch on `main`)" under "Before this task".
4. THE owner SHALL merge no group C task while a group X task is open, unless the group X task's issue records a blocker the owner accepts.
5. WHEN a PR merges, `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]`, `/demo/personas/us-maya` and `/demo/personas/eu-tomas` SHALL load without error, with each persona flow reaching the `close` Stage from `/`.
6. EVERY task of this spec SHALL be planned to merge by the 27 November 2026 freeze. THE tasks SHALL contain no cut order and no optional group.
7. IF a task fails to merge by the end of 27 November 2026 despite being worked, THEN its issue SHALL be closed unmerged with the reason, and the group E audit SHALL remove every claim that depends on it.

### Group S. Steering and the copy scans

### S1. Steering first (Owner_Patch)

**User story:** As the owner, I want steering to describe author questions and sample answers before any agent builds them, so that no agent follows the old rule.

1. BEFORE any role task of this spec is dispatched, THE owner SHALL commit the Owner_Patches for `.kiro/steering/product.md`, `.kiro/steering/neutrality.md` and `.kiro/steering/tone.md` (design, Owner patches). NO role agent SHALL commit them (G1.3).
2. THE `product.md` patch SHALL change only these items and keep everything else:
   1. Core loop step 1: the author may also write up to three questions for their future self.
   2. Core loop step 2: personal numbers are labelled self-reported.
   3. Core loop step 6 (Testify): the author answers their own questions first, then the figure questions, all before anything is shown.
   4. Core loop step 7: each question with the answer just given, then the full letter, then the numbers.
   5. The "Testify step (MVP)" decision: Author_Questions plus fixed Figure_Questions generated from the tracked figures; AI-generated questions stay post-MVP and must follow `neutrality.md`.
   6. Demo 1: personas keep Figure_Questions only; the persona page opens straight on Testify; each question carries a labelled Sample_Answer the judge can change; the persona opening dates are shown as plain dates with no event name.
   7. Demo 2: the judge can ask their own question, the Write step starts with one editable question, and the payoff leads with it.
   8. Lines 79 to 84 (Demo 1 and its windows): the persona letters are described as written as of a date in each window and set to open on a fixed date, and each window is given as the 12 months up to a plain date (5 November 2024; 9 June 2024; 11 September 2022), with no election named.
3. THE `neutrality.md` patch SHALL add these rules under "Revenant does not":
   1. Score, diff, highlight, summarise or interpret the gap between the testimony and the letter, or between a Text_Answer and any line of the letter. No similarity measure, no keyword match and no AI on either.
   2. Call a Sample_Answer, or any answer, right, close, near, wrong, off or accurate, in the UI or in persona copy.
   3. Show an event name next to a persona opening date.
4. THE `neutrality.md` patch SHALL rewrite line 22 so that, in the MVP, election dates only set the demo persona windows and are shown as plain dates with no event name, and a description in plain terms ("2028 U.S. presidential election day") applies only to suggested opening dates after the MVP.
5. THE `tone.md` patch SHALL add to the Testify moment that a Persona_Letter may prefill one labelled Sample_Answer per Figure_Question, and SHALL keep "no hints about what's inside" for every other letter.
6. THE patches SHALL keep every other rule of `product.md`, `neutrality.md` and `tone.md` unchanged, apart from the rewrites of `product.md` lines 79 to 84 (S1.2.8) and `neutrality.md` line 22 (S1.4), and SHALL pass the `neutrality.md` copy test themselves.

### S2. Scans check only Our_Copy

**User story:** As the owner, I want the copy checks to flag our words and never a reader's, so that a letter or answer is never refused or rewritten for its content.

1. THE design SHALL list, for `tools/hooks/tone-check.mjs`, the `copy-tone-check` IDE hook, the `ceremony-truth-check` IDE hook, `src/test/retired-phrases.test.ts`, every copy test under `src/` and the Journey_Check, which inputs each one reads, and SHALL show that none reads User_Content.
2. IF a check reads rendered HTML, THEN THE check SHALL skip every element marked as User_Content (the Letter_Text of a Live_Letter or Real_Letter, the Author_Question text, the Text_Answer text and any self-reported field), using one data attribute the design names.
3. THE Persona_Letter text, the Question_Starters, the Live_Prefill text and the Sample_Candidates are Our_Copy, and every check SHALL still scan them in their source files.
4. NO runtime code SHALL check, block, change or warn about User_Content for its words: an Author_Question, a Text_Answer or a letter is accepted when it meets its length rules alone.
5. WHERE a check needs a change, THE change SHALL be an Owner_Patch attached to the S1 task (G1.3).

### S3. Retired copy

**User story:** As the owner, I want removed wording to stay removed.

1. THE Retired_Phrases SHALL gain "Pick up the letter", the `sealInstruction` sentence "Press and hold the seal to break it, or use the button below.", "U.S. presidential election day" and "European Parliament election".
2. `src/test/retired-phrases.test.ts` SHALL fail on any of them in a non-test source file under `src/` or in `content/personas/` outside the copy-test records (`content/personas/letters/*-copy-test.md`), naming the file and line.
3. THE `copy-tone-check` hook and the Journey_Check SHALL flag the same phrases (Owner_Patch, S2.5).

### Group X. Production bugs and the election labels (P0)

### X1. The Then_Tick sits on the axis

**User story:** As a judge reading the receipts, I want the Then mark on the line next to its label.

1. AT every Evidence_Size, THE Then_Tick's mark SHALL touch the Number_Line's axis, with a vertical gap of 0 CSS px between the mark's box and the axis box.
2. THE Then_Tick's label SHALL sit within 8 CSS px of its mark, and SHALL overlap no other label or tick on the same Number_Line.
3. THE Now tick and the answer Mark SHALL meet criteria 1 and 2 too, so then, now and the answer stay equal in treatment (spec 08 R4).
4. A layout check SHALL fail when the Then_Tick's mark is more than 0 CSS px off the axis or more than 8 CSS px from its label (Owner_Patch to `tools/qa/layout-check.mjs`).

### X2. The phone persona start screen

**User story:** As a judge on a phone, I want to read the persona card and see every step name.

1. AT the Phone_Sizes, THE Ghost_Box SHALL overlap no text box of the Persona_Intro or the Testify_Context, in every Stage from first paint to `recall`.
2. AT every Evidence_Size, THE Step_Indicator SHALL show all four step names in full, with no truncation, no ellipsis and no step clipped by the viewport or its container, in at most two lines at the Phone_Sizes and one line elsewhere (spec 09 C2.5).
3. THE Step_Indicator SHALL show the current step and every other step in every Stage where it renders.
4. A layout check SHALL fail when a Step_Indicator item's `scrollWidth` exceeds its `clientWidth` or its box leaves the viewport (Owner_Patch).

### X3. README status (Owner_Patch)

1. THE README status line SHALL say that specs 01 to 09 are complete and spec 10 (own questions) is in progress, with the date of the patch.
2. THE README persona demo line SHALL describe the letter by its written-as-of date and opening date, and SHALL NOT name an election (X4).
3. THE patch SHALL be attached to the first group X task. It SHALL change only the status line and the persona demo line, on top of the README that spec 09 patch t has already changed; it SHALL NOT add or edit the Judge quick path box (E1.3).

### X4. Plain opening dates

**User story:** As a judge of any political view, I want the persona dates shown as dates, so that nothing ties a price to an election.

1. THE `/demo` envelopes, the Persona_Intro, the Testify_Context, the persona page metadata and every other persona surface SHALL show the opening date as "Opens {date}" with no Opening_Event_Label.
2. THE Persona_List SHALL hold no `opening_event` entry for any persona, and THE schema SHALL reject one, so a later edit can't bring the label back without a schema change.
3. THE opening dates (`opens_at`) SHALL stay unchanged.
4. THE copy-test records `content/personas/letters/us-copy-test.md` and `eu-copy-test.md` SHALL record the removal with the reviewer's name.

### Group C. The critical path (P1)

### C1. No pick-up Stage

**User story:** As a judge who already chose a letter on `/demo`, I want the page to open on the first question, so that I don't pick the letter up twice.

1. WHEN a persona letter has loaded and its envelope hash has been checked and the letter has opened, THE Opening_Flow SHALL show the first recall question with no judge action in between.
2. WHEN a Live_Letter or a Real_Letter opens after the passkey or backup key unlock, THE Opening_Flow SHALL show the first recall question with no judge action in between, through the same code path as C1.1.
3. THE page SHALL render no Pick_Up_Button, and the `BEGIN` event, the begin guard, `showPickUp`, the `pickUp` and `begin` copy keys and the `intact` Stage SHALL be removed, unless the design shows one of them still has a non-pick-up use and names it.
4. IF loading, the hash check or the opening fails, THEN THE page SHALL show the existing FlowError for that failure and SHALL render no recall question, no Testify_Context seal statement and no Sample_Answer (spec 07 R9.12 kept in meaning).
5. WHILE Calm_Mode is off, THE Ghost SHALL rise with the Envelope on page load and hold it through `recall`, `submitting` and `submit_failed`.
6. THE Emergence SHALL NOT delay the first question: THE first question SHALL be in the document in the same render as the `recall` state at any Emergence phase, and THE Ghost_Box SHALL overlap no box of the first question, its field, its controls or the Testify_Context at any Evidence_Size and any Emergence phase.
7. THE persona Step_Indicator SHALL show Testify as the current step from the first render of the `recall` Stage. Before `recall` (the `emerging` Stage), THE Step_Indicator MAY show no current step.
8. UNDER reduced motion or Calm_Mode, THE page SHALL show the settled scene, with the Ghost holding the Envelope at its end pose and no motion, from the first render.
9. THE Live_Stepper SHALL move from Wait to Testify when the letter opens, with no step or control in between, and SHALL keep its six steps.
10. THE passkey assertion SHALL still be requested only inside the judge's press of the unlock control, as its first asynchronous operation (spec 06 R17.2). THE design SHALL state that no other step needs a user gesture.
11. THE QA steps, layout checks, unit tests and property tests that refer to the Pick_Up_Button or the `intact` Stage SHALL be changed or retired, and each SHALL be named in the PR.
12. WHEN the persona page enters `recall` by Load_Entry, THE page SHALL move focus to the recall Stage heading with `preventScroll: true`, SHALL NOT focus the answer field, and SHALL NOT change the scroll position. WHEN a page enters `recall` by Gesture_Entry, THE page SHALL keep the current rule and focus the answer field named by `[data-stage-focus]`. `focusTargetFor` SHALL encode both cases, and its tests in `CeremonyRoot.test.tsx` SHALL cover each.

### C2. Author_Questions on the Write step

**User story:** As an author, I want to ask my future self a few questions, so that opening the letter tests my own memory.

1. THE Write step on `/demo/live` and `/seal` SHALL offer 0 to 3 Author_Question rows after the letter field, each a single text field with a visible label and a remove control, and one "Add a question" control while fewer than 3 rows exist.
2. EACH sealed Author_Question SHALL be 1 to 200 code points after trimming leading and trailing whitespace, with at least one non-whitespace character.
3. WHEN the author seals, THE Write step SHALL drop every Author_Question row that is empty after trimming, whether or not the row was touched, and SHALL NOT block sealing for it. IF a row is longer than 200 code points after trimming, THEN THE Write step SHALL show a message saying what is allowed, keep the text as typed, and block sealing until the row is fixed or removed. THE message SHALL show only after the row was touched or a seal was attempted (spec 09 A4.4).
4. THE Write step SHALL offer the Question_Starters as buttons. WHEN the author activates one, THE Write step SHALL put its text into the first empty row, or add a row if fewer than 3 exist, and SHALL do nothing when 3 rows are full.
5. THE Write step SHALL show the Answer_In_Letter_Line next to the rows.
6. EACH Question_Starter and the Live_Prefill text SHALL be about the author's everyday life, SHALL not lead toward an answer, and SHALL contain no digit, no figure, no party, policy or election, and no direction word from spec 03 R2.4. THE design SHALL list at least three Question_Starters, starting from the owner's examples: "What was on your mind most days?", "Who did you spend your evenings with?", "What were you saving for?".
7. WHEN the letter is sealed, THE payload SHALL hold each Author_Question as a v1 recall question with `answer_type: "text"`, no `metric_id`, a unique ID that can't collide with a Figure_Question ID, and the text exactly as typed after trimming.
8. THE Author_Questions SHALL come before every Figure_Question in `recall_questions`, in the order the author wrote them.
9. THE payload SHALL pass `payloadV1Schema` with `format_version: 1` for every combination of 0 to 3 Author_Questions and 1 to the live figure maximum of Figure_Questions, and, for a Real_Letter, for 1 to 3 Author_Questions with 0 figures. A test SHALL cover the 0-figure Real_Letter combination.
10. THE Author_Question rows SHALL keep their text through Back and Next in the Live_Stepper, through the cancelled, failed and cannot-lock screens, and through Try again (spec 06 R15.7, spec 09 D2.2).
11. AFTER the seal is stored, THE page SHALL NOT show the Author_Questions again until the letter opens (spec 06 R16.3).
12. ON `/seal`, THE Author_Question rows SHALL start empty, and THE Write step SHALL prefill nothing (spec 09 D3.2). `/demo/live` starts with the Live_Prefill (C9.5).
13. ON `/seal`, THE Write step SHALL accept 0 to 6 figures WHEN the letter has at least one non-empty Author_Question, and 1 to 6 figures otherwise; `form.ts` SHALL report `figures_none` only when the letter has no Author_Question. ON `/demo/live`, THE Write step SHALL keep 1 to 6 figures.

### C3. Recall_Record_V2

**User story:** As the owner, I want text answers stored as safely as number answers, so that the operator can't read them and old records still parse.

1. THE Recall_Record_V2 SHALL be a strict schema with `version: 2` and at most 20 answers, each one of: a number answer (the spec 03 R3.3 rules, unchanged), a Text_Answer, or "no answer"; any unknown key SHALL be rejected.
2. A Text_Answer SHALL hold 1 to 1,000 code points after trimming leading and trailing whitespace, with at least one non-whitespace character, and SHALL store the text exactly as typed apart from that trim.
3. THE Recall_Record_V2 SHALL hold at most 3 Text_Answers.
4. A number answer MAY carry the Sample_Flag, and THE schema SHALL accept the Sample_Flag only on a number answer. THE Opening_Flow SHALL set the Sample_Flag on a number answer exactly when the answer is a Kept_Sample.
5. A Recall_Record_V2 bound to one letter's questions SHALL require exactly one answer per question ID, a Text_Answer or "no answer" for every text question, and a number answer or "no answer" for every number question.
6. WHEN the Max_Record is encrypted with `encryptOpeningRecord`, THE ciphertext SHALL be at most 65,536 bytes and the `POST /api/openings` request body at most 100,000 characters, and a test SHALL assert both figures and print them.
7. `src/lib/recall/` SHALL export the Record_Parser, which accepts version 1 and version 2, and SHALL parse a version 1 record exactly as the version 1 schema does. Tests SHALL cover the Record_Parser. No production code SHALL call the Record_Parser on a stored record in this spec (Known limitations).
8. THE Opening_Flow SHALL build and post a Recall_Record_V2 for every letter it opens from the release of this requirement, including letters sealed before it.
9. IF an opened payload holds more than 3 text questions, THEN THE Opening_Flow SHALL show the existing `invalid_payload` FlowError and show nothing from the letter.
10. FOR ALL valid Recall_Record_V2 values, encrypting with `encryptOpeningRecord`, decrypting with `decryptOpeningRecord` and parsing with the Record_Parser SHALL return a value deeply equal to the original (round trip, property test).
11. FOR ALL valid version 1 records, the Record_Parser SHALL return a value equal to the version 1 schema's parse (property test).
12. THE Recall_Record_V2 SHALL live in `src/lib/recall/`, and `encryptOpeningRecord`, `decryptOpeningRecord` and `POST /api/openings` SHALL stay unchanged.

### C4. Testify

**User story:** As someone opening a letter, I want to answer my own questions from memory first, so that I see what I remember before I read what I wrote.

1. THE Testify step SHALL show the recall questions in payload order, one question per screen (`tone.md`), with the existing "Next question" control on every question but the last and "Record my answers" on the last, so Author_Questions come first (C2.8).
2. FOR a Persona_Letter, THE Testify step SHALL show the Memory_Line, built from the written-as-of month, framing the testimony as the judge's own memory of that time, in calm `tone.md` voice, with no mention of the persona's own life.
3. ON the persona page, THE Testify_Context SHALL sit above the first question from the first render of `recall`: the Persona_Intro in a compact form (who wrote the letter, "Written as of {date}", "Opens {date}" and the fictional-persona line) and the seal-verified statement "The seal is intact. Nothing here has changed since it was sealed.".
4. AT every Evidence_Size, THE first question's field SHALL be inside the First_Viewport at the start of `recall`, with no scroll. AT the Evidence_Sizes other than 360×640, THE question's primary control ("Next question" or "Record my answers") SHALL be inside it too.
5. EACH text question SHALL have a multi-line text field with the question as its accessible name, a character count against 1,000, and the existing "No answer" control.
6. IF a text question is empty after trimming and "No answer" is not chosen, or longer than 1,000 code points, THEN THE Testify step SHALL keep the text, say what is allowed, and SHALL NOT submit.
7. EACH number question SHALL keep the Recall_Number_Parser, the Recall_Scale and the "No answer" control unchanged (spec 08 R32).
8. THE Testify step SHALL show no letter text, no figure and no Now_Figure until `POST /api/openings` has returned 201 (spec 03 R8.1).
9. THE Testify step SHALL show the text of an Author_Question exactly as sealed, with no change, no check and no comment (S2.4).
10. THE Live_Letter and Real_Letter Testify step SHALL show the seal-verified statement above the first question.

### C5. Prefilled sample answers (persona letters only)

**User story:** As a judge, I want a sample answer already in each field, so that I can go through the whole opening without typing.

1. THE persona content SHALL hold, for each persona Figure_Question, 3 to 5 Sample_Candidates, in a file next to the letter in `content/personas/` and outside the sealed payload.
2. THE Sample_Candidates of each question SHALL include exactly one Record_Candidate, equal to the number in `formatValue(v, region, 2)`, where `v` is the sealed Then_Value after `rescaleForDisplay` when the unit has a Display_Rescale and the sealed value otherwise, and SHALL meet the Spread_Rule against the sealed Then_Value as the Testify field shows it: at least one Near_Candidate, one Below_Candidate and one Above_Candidate. THE Record_Candidate counts as a Near_Candidate.
3. EVERY Sample_Candidate SHALL be non-negative, inside the question unit's Unit_Range_Table range, written with two decimals, as the Testify field shows the Then_Value, and SHALL pass the Recall_Number_Parser and the Recall_Record number rules exactly as a typed answer does.
4. WHEN a persona letter opens, THE Opening_Flow SHALL make one Sample_Pick per Figure_Question and fill the Sample_Answer into that question's field. THE Sample_Pick SHALL be made after hydration, outside render, and SHALL NOT be written to storage, cookies or the URL. UNTIL the Sample_Pick has run, THE field SHALL be empty and THE Sample_Note SHALL NOT show.
5. WHILE a field holds its Sample_Answer, THE Testify step SHALL show the Sample_Note ("A sample answer is filled in. Change it if you remember differently.", final wording in the design) next to it, and the field SHALL count as answered, so that question's "Next question" or "Record my answers" control is enabled at once.
6. EACH visit SHALL draw a fresh seed for the Sample_Pick in a `useEffect` after hydration, from `crypto.getRandomValues` on a one-element `Uint32Array`, and SHALL pass it to `mulberry32`. THE seed SHALL NOT be drawn in render, and no module under `src/components/ceremony` SHALL call `Math.random` or `Date.now` for it, so `src/components/ceremony/source-scan.test.ts` passes with no new allow-list entry. THE Sample_Pick SHALL take an injected seed, so tests can fix the pick.
7. THE judge SHALL be able to edit the Sample_Answer, clear it, or choose "No answer". A cleared field SHALL follow C4.6 and spec 03 R3.4.
8. THE Recall_Record SHALL store the value actually submitted. WHEN a submitted answer is a Kept_Sample, THE Reveal SHALL show the Sample_Label next to it under "Your testimony" and on its Receipt_Card. An answer whose text differs from the Sample_Answer in any character SHALL get no Sample_Label.
9. NO Sample_Candidate, Sample_Note, Sample_Label or persona copy SHALL call any answer right, close, near, wrong, off or accurate, and THE Reveal SHALL show a Kept_Sample beside the record exactly as it shows any other answer, including a Kept_Sample that equals the record (S1.3).
10. LIVE_Letters and Real_Letters SHALL get no Sample_Answer.
11. THE property tests SHALL show that: every persona Figure_Question has 3 to 5 Sample_Candidates; exactly one of them is the Record_Candidate computed from the sealed payload; the Spread_Rule holds for each; every Sample_Candidate passes the same validation as a typed answer; the Sample_Pick always returns one of the stored Sample_Candidates for any seed; a Kept_Sample is labelled with the Sample_Label in the Reveal and carries the Sample_Flag in the record; and an answer that differs from the Sample_Answer in any character carries neither.
12. A QA step SHALL walk the Fastest_Path at 1366×800 and 390×844 for each persona and record the number of activations; for a persona with two Figure_Questions, more than 4 SHALL fail.

### C6. Break the seal

**User story:** As a judge at the climax, I want one clear thing to press, next to where it is, so that breaking the seal feels like one act.

1. AT the Desktop_Sizes and the Wide_Size, in the `marks` and `seal` Stages, THE WaxSeal SHALL sit on the Envelope_Flap of the Envelope the Ghost holds, and its box SHALL overlap no Envelope_Text box. AT the Phone_Sizes, where the Compact_Ghost is at most 120 CSS px tall, THE WaxSeal, the Seal_Hint and the Seal_Button SHALL sit together in the Content_Column directly below the Compact_Ghost, the group's top within 24 CSS px of the Ghost_Box's bottom edge, overlapping no Ghost_Box.
2. NO element drawn on the Envelope SHALL overlap another element drawn on it at any Evidence_Size.
3. AT the Desktop_Sizes and the Wide_Size, THE Seal_Hint and the Seal_Button SHALL sit together as the Seal_Group, with the Seal_Group's nearest edge within 24 CSS px of the Ghost_Body_Box edge that faces the Content_Column, and the WaxSeal's vertical centre inside the Seal_Group's vertical extent. THE Seal_Group SHALL overlap neither the Ghost_Body_Box nor the Envelope.
4. THE Seal_Hint SHALL be fully inside the viewport and unclipped, SHALL be left-aligned or centred, and SHALL contain no word that places a control (below, above, left, right, beside), unless that word is true at every Evidence_Size.
5. THE Seal_Button SHALL be the one fallback control for keyboard and touch, SHALL sit in the Seal_Group directly under the Seal_Hint, SHALL use the orange primary button style of the other Stages, and SHALL break the seal exactly as press-and-hold does.
6. THE Skip_Link SHALL stay quiet text under the Seal_Button and SHALL send `SHOW_ALL` exactly once. WHEN the letter has at least one Author_Question, THE Skip_Link SHALL move focus to the Author_Testimony_Heading; otherwise it SHALL move focus to the Figures_Heading (spec 09 C4.2, C4.3). `focusTargetFor` SHALL encode this, and its tests SHALL cover both cases.
7. THE `marks` Stage SHALL render no card or panel that holds only controls, and no card whose box is more than 48 CSS px taller than its content.
8. THE WaxSeal and the Seal_Group SHALL be the focal point: at the Desktop_Sizes and the Wide_Size they SHALL sit at the Ghost as C6.1 and C6.3 state, and at the Phone_Sizes all three SHALL be inside the First_Viewport of the `marks` Stage.
9. THE layout SHALL meet criteria 1 to 8 at 2560×1440, 1366×800, 1280×800, 390×844 and 360×640, with and without reduced motion.
10. THE `marks` Stage SHALL show the Answer_List at every Evidence_Size, in the Content_Column, overlapping no Ghost_Box and no element of the Seal_Group, with the Seal_Group at the Ghost. THE Answer_List SHALL list Author_Questions first, and SHALL clamp each Text_Answer to three lines there; the full text is in the Author_Testimony (C8.2).
11. A layout check SHALL fail when the WaxSeal's box overlaps an Envelope_Text box, the Seal_Group's box overlaps the Ghost_Body_Box or the Envelope, the Seal_Group's nearest edge is more than 24 CSS px from the facing Ghost_Body_Box edge, or the Answer_List overlaps the Ghost_Box (Owner_Patch).

### C7. The other Stages

**User story:** As a judge, I want every Stage to read cleanly, with controls next to what they act on.

1. IN `recall`, `letter`, `figures` and `close`, THE Ghost_Box SHALL overlap no text box, field or control at any Evidence_Size, with and without reduced motion.
2. EACH control in those Stages SHALL sit within 48 CSS px of the element it acts on, or directly under it in the Content_Column.
3. NO Stage SHALL render a card whose box is more than 48 CSS px taller than its content, or a card that holds only controls.
4. THE task SHALL list in its PR each problem found per Stage and size, with a screenshot before and after.
5. A layout check SHALL cover criteria 1 and 3 (Owner_Patch).

### C8. The Reveal

**User story:** As someone who just testified, I want to see what I said next to each of my questions, then my letter as I wrote it.

1. THE `marks` Stage ("Your testimony") SHALL list every answer in the Answer_List at every Evidence_Size, Author_Questions first, each with its question text, before the letter is shown (C6.10).
2. IN the `letter` Stage, THE Reveal SHALL show the Author_Testimony above the paper and outside it: the Author_Testimony_Heading, then, for each Author_Question in payload order, the question text, then "What you said just now", then the Text_Answer as recorded in full, or "No answer".
3. BELOW the Author_Testimony, THE Reveal SHALL show the full letter text in the paper, as one unchanged text node, with nothing placed against any of its lines (spec 07 R13.3, L6 of spec 09).
4. THE Reveal SHALL NOT compare, score, diff, highlight, quote, summarise or link any part of a Text_Answer to any part of the letter, and SHALL compute no measure between them (S1.3).
5. THE Text_Answer SHALL keep its line breaks and SHALL be shown as plain text, never as HTML.
6. WHEN a letter has no Author_Question, THE Reveal SHALL show no Author_Testimony block and no empty heading.
7. THE order SHALL stay: testimony, the letter, then the numbers (`tone.md` "See the receipts").
8. THE Author_Testimony and the Text_Answers SHALL carry the User_Content marker (S2.2).
9. WHEN a Real_Letter has no figures, THE Reveal SHALL show no `figures` Stage, no "See the receipts" control, no Figures_Heading and no empty figures list, and SHALL go from the letter to the `close` Stage.

### C9. The live demo payoff

**User story:** As a judge who sealed a letter 30 seconds ago, I want to answer my own question again from memory, so that the demo shows what Revenant is for.

1. THE `/demo/live` Write step SHALL offer the Author_Question rows and Question_Starters of C2.
2. WHEN a Live_Letter with Author_Questions opens, THE Testify step SHALL ask them first, then the Figure_Questions.
3. THE Receipts step SHALL lead with the Author_Testimony and the letter, and SHALL show the figures after them.
4. THE live lock note SHALL keep saying, without judgement, that the letter was locked for 30 seconds (spec 06 R18.6), and SHALL point to the persona letters for a then-and-now story.
5. THE `/demo/live` Write step SHALL start with one Author_Question row holding the Live_Prefill text "What's on your mind right now?", which the judge can edit, clear or remove. Author_Questions SHALL stay optional: a removed or cleared row seals no question (C2.3), and the Question_Starters SHALL be visible.

### Group P. Persona letters with the price

### P1. The letter contains the number

**User story:** As a judge who testified about Maya's fuel price, I want to find that price in her letter.

1. EACH persona letter SHALL contain one Letter_Price_Line per tracked figure, in the persona's own everyday voice, stating that figure's sealed Then_Value as an official average the persona saw (the news or the radio, never a station sign, since a sign shows one station's price and not the official average), never as a price the persona paid, in the unit the Testify field uses (`USD per gallon`; `EUR per litre` through the Display_Rescale for Tomás).
2. EACH Letter_Price_Line SHALL write the number with exactly two decimals and "about" before it, equal to `formatValue(v, region, 2)`, where `v` is the sealed value after `rescaleForDisplay` when the unit has a Display_Rescale and the sealed value otherwise. For example, Maya's sealed regular gasoline value 3.643 USD per gallon (period 2024-05-06) gives "Regular was about $3.64 a gallon this week."
3. A test SHALL fail unless every number in a persona letter equals, at two decimals, the value P1.2 computes for one of that persona's tracked figures from its sealed payload, and every tracked figure's value appears exactly once.
4. THE letter SHALL contain no other digit, currency symbol or currency word. THE currency symbol or word SHALL appear only inside a Letter_Price_Line.
5. THE letter SHALL keep spec 03 R1.6, R1.7, R1.9 and R1.10: everyday life, no election or party term, no stereotypes, and the owner's copy test review recorded with the reviewer's name in the copy-test record before sealing.
6. THE letter SHALL say nothing about whether the price is high, low, rising or falling.
7. IN Maya's letter (`content/personas/letters/us-maya.txt`), THE regular gasoline Letter_Price_Line SHALL stay where the design places it, and THE diesel Letter_Price_Line SHALL be the sentence "The radio put diesel at about $3.89 a gallon this week, which is what the van runs on." in the Saturday paragraph, directly after the sentence ending "…the broken scones on the way home.". Criteria 1 to 6 SHALL hold for both lines.

### P2. Reseal the personas

1. BOTH personas SHALL get new letter IDs, with the current IDs (`ydsos6hcjdEUOs3sK42RQg`, `8t6Bz4bWlaUky-byt1mzGg`) moved to `retired_letter_ids` (spec 03 R5.2).
2. THE owner SHALL run the Sealing_Script for the new letter IDs against the production database, and confirm both new rows exist, before the image that carries the new IDs is deployed, so that no deploy serves a persona letter ID with no row (G3.5). THE owner SHALL record the script output and the deploy order in the task's issue. THE Production_Check SHALL open both personas through to `close`.
3. THE rows under the retired IDs SHALL stay in the database, because the immutability triggers forbid deleting them.
4. THE sealed payloads SHALL stay version 1 and hold Figure_Questions only.
5. THE task SHALL be frontend-dev (content and `src/lib/personas`). IF the Sealing_Script needs a change, THEN THE change SHALL be a separate crypto-dev task.

### Group R. Self-reported numbers

### R1. Self-reported numbers on the Write step and in the Reveal

**User story:** As a letter writer, I want to seal my own rent or grocery bill, so that the letter holds numbers only I know.

1. THE spec 08 later-tasks task 23 SHALL move into this spec's tasks as written, keeping spec 08 R26.1 to R26.6 with R26.1 applied as an unconditional requirement, and with its dependency on spec 08 task 22 replaced by this spec's C9 task.
2. THE "Your own numbers" group SHALL sit after the Author_Question rows on the Write step, and SHALL keep its rows through the same Back, Next and Try again paths as C2.10.
3. A self-reported figure SHALL get no recall question, and SHALL be sealed in the v1 payload with `kind: "self-reported"` and `source: "self-reported"`, with no new `format_version`.
4. THE Reveal SHALL list self-reported figures after the official ones under "Your own numbers", labelled "self-reported", with no now value and no change, after the Author_Testimony and the letter.
5. A self-reported figure SHALL NOT count toward the 1-figure minimum of C2.13; only official figures do.

### Group E. Final audit and presentation

### E1. Promise audit after the freeze

1. THE final task SHALL list every user-facing claim about Author_Questions, sample answers, self-reported numbers and real sealing against the code on `main`, and fix or remove each claim no merged code makes true.
2. THE audit SHALL confirm that every surface describing self-reported numbers matches the merged group R code.
3. THE owner commits spec 09 Owner_Patches o (`freshness-check.yml`, `keepalive.yml`), t (README "Judge quick path" box), u (`docs/kiro-writeup.md`) and v (`docs/video-script.md`) outside this spec. THIS spec's README, `docs/kiro-writeup.md` and `docs/video-script.md` Owner_Patches SHALL build on the files those patches committed, SHALL edit them in place, and SHALL NOT re-create or re-apply them. These SHALL describe Author_Questions, the persona sample answers and the live demo payoff, and the video script SHALL show the live demo beat: write a question, wait 30 seconds, answer it again from memory, see it beside the letter.
4. THE audit SHALL confirm that no README text, video script, write-up, Open Graph image, test or QA step refers to the two letter IDs this spec retires, `ydsos6hcjdEUOs3sK42RQg` (Maya) and `8t6Bz4bWlaUky-byt1mzGg` (Tomás), apart from the `retired_letter_ids` entries in the Persona_List and the tests that read that list. THE search SHALL cover these two letter IDs only. Older retired IDs such as `wom_GdH6gqP6AGgnyhIMgA` are ordinary test fixtures and are outside the search.
