# Requirements Document

Spec: 14 The write desk

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category. The technology it resurrects is the wax seal. This spec was written on 17 November 2026 against `main` at `ba2cd6c`, after spec 13 tasks 1 to 11, 14 to 17 and 19 had merged. Spec 13 tasks 12, 13, 18 and 20 to 23 are still open and keep their own order. The owner's dates from spec 13 stand: feature freeze 27 November 2026, video recorded 1 to 2 December, submission on 3 December. 4 December 2026, 2:00 PM PT is only the platform deadline.

Spec 13 made the seal the hero. The owner's walk of `/demo/live` after it found that the steps around the seal still read as a form:

- **The Write step is a form on a cream panel.** The owner wants a letter on a sheet of paper beside an envelope that shows what goes inside it, on the dark page.
- **The Seal step breaks at 1440 wide.** The press envelope overlaps the text column, and the line under it goes blank once a backup option is chosen, because `WriteForm.tsx` sets `pressLine` to `""`.
- **Testify does not look like the questions the author wrote.** The questions should come back looking the way they were written.
- **Smaller defects** on the persona Testify and Read steps, the receipts, the Top_Bar, the Scene's soil band, `/demo` and `/how-it-is-sealed`.

The owner supplied a full design for the Write step, the Seal step and Testify, with exact copy, sizes and colours. This spec writes that design down as requirements, keeps every steering rule, and records each decision the owner left open.

This spec runs unattended once `tasks.md` is committed. No task waits for an owner's look, approval or answer. Where something was unclear, the decision is recorded under "Decisions already made".

Requirements are numbered by group: G (rules for every task), S (the Seal step and the shared step header), W (the Write step), T (Testify), R (the persona Read step and the receipts), B (the Top_Bar and the Scene), X (smaller fixes), D (`/demo` and `/how-it-is-sealed`, cut first) and Q (verification). Group letters W and T are reused from spec 13 with new meanings. A reference to an earlier spec always names it ("spec 13 W1"). Every rule of `.kiro/steering/` and of specs 02 to 13 still holds unless "Rules this spec replaces" names it. The steering files win any conflict with this spec or with the owner's design.

## Code facts this spec relies on

Checked on 17 November 2026 in the local checkout, by reading the files named. I did not run a browser, so the visual symptoms in the Introduction are the owner's observations. The first task of each group records its reproduction as its first commit before changing anything (G2.6).

| Topic | What exists | Not yet known |
|---|---|---|
| Write and Seal step markup | `src/components/live/WriteForm.tsx` renders both steps in section mode (`section="write"` and `section="seal"`). `section="all"` is the `/seal` form. The Write section renders `OccasionPicker`, the `textarea#live-letter`, `AuthorQuestions`, `ReceiptsDisclosure` (holding `FigurePicker` and `SelfReportedRows`), and an action row with `LIVE_COPY.receiptsAction` ("Add a receipt") and `LIVE_COPY.nextButton` ("Next"). | — |
| Blank press line | In `WriteForm.tsx`, `pressLine` is `""` when the state is not `created` and a Backup_Choice is made. `PressEnvelope` then renders an empty `role="status"` line (`data-press-line`). | — |
| Step header | `src/components/live/stepper/LiveStepper.tsx` renders `StepIndicator` (an `ol` of numbered steps with `data-state` `done`, `current` or `todo`) and, for steps with a Primary_Card, an `h2` with `stepName(step)`. On a step change it calls `heading.focus({ preventScroll: true })` and `heading.scrollIntoView({ block: "start" })`. `SealPage.tsx` renders the page `h1` `LIVE_COPY.liveHeading` ("Seal your own letter"). | Why the track and title still end under the Top_Bar after Next. The first S task measures it. |
| Step names | `LIVE_STEP_NAMES` in `live-steps.ts` takes "Write", "Press the seal", "Testify" and "See the receipts" from `BRAND_COPY.ritualSteps`, "Wait" from `LIVE_COPY.waitStep` and "Break the seal" from `CEREMONY_COPY.steps[1]`. | — |
| Occasions | `src/components/live/occasions.ts` holds `OCCASIONS` (ids `year`, `work`, `family`, `decision`, `blank`, each with `label`, `starter`, `placeholder`, `questions`) and `applyOccasion`, which writes the starter into an empty or unedited letter (spec 11 L2.2) and replaces unedited question rows. `LIVE_COPY.occasionLabels.blank` is "Blank". | — |
| Copy | `LIVE_COPY` and `REAL_COPY` in `src/components/live/copy.ts`; `PRESS_COPY` in `src/components/live/press/copy.ts`; `REVEAL_COPY` in `src/components/reveal/copy.ts`; `CEREMONY_COPY` in `src/components/ceremony/copy.ts`; `SCENE_COPY` in `src/components/ceremony/scene/copy.ts`; `DEMO_COPY` in `src/components/demo/copy.ts`; `HOW_COPY` in `src/components/how/copy.ts`. | — |
| Strings the owner named | `LIVE_COPY.figuresHint` is "Choose between 1 and {max}. Each is sealed as published, with its period and source." `LIVE_COPY.figuresHintOne` is "Choose 1. It is sealed as published, with its period and source." `LIVE_COPY.busyBody` is "Demo 2 is busy right now. Nothing was sealed. Try again later." `LIVE_COPY.passkeySteps` still says "Each time, you press a button first.", which spec 13's press-and-hold made untrue. `PRESS_COPY.chooseFirst` is "Choose what to do about the backup key first." `LIVE_COPY.backupChoiceLegend` is "The backup key". | — |
| Testify | `src/components/reveal/RecallStep.tsx` renders `TestifyContext` and `RecallPager` (`src/components/ceremony/recall/RecallPager.tsx`). The pager shows the counter (`REVEAL_COPY.questionCounter`, plus `questionCounterAsOf` for a persona), the question as an `h2`, then for a number question the input with the Next button in one row, the Sample_Note, "No answer", the `CEREMONY_COPY.parsedValue` line ("Read as {value}"), the readings, errors, "Previous question" in its own row, and the `RecallScale`. A text question uses `TextAnswerField`, labelled by the question heading. The persona text answers render in `RecallReader.tsx`. `Opened.header.sealedAt` holds the sealing time. | — |
| Recall scale ranges | `src/components/ceremony/recall/unit-ranges.ts` has two literal ranges, "USD per gallon" (0 to 10) and "EUR per litre" (0 to 3). Every other displayed unit gets `FALLBACK_RANGE`, a log track from 0.01 to 100,000. The catalogue in `src/lib/figures/catalogue.ts` holds only the units "USD per gallon" and "EUR per 1,000 litres", and `displayUnitFor` shows the second as "EUR per litre". So both catalogue units already have an entry. | — |
| Change display | `src/lib/figures/format-change.ts` (data-dev) formats the signed difference and the percentage. `src/components/reveal/ChangeLine.tsx` renders the change and the readable formula (`REVEAL_COPY.formulaLabel`) inline. `ReceiptCard.tsx` holds the change line. Catalogue series carry `period_type` (for example `weekly`). | — |
| Number line | `src/components/ceremony/figures/NumberLine.tsx` and `line-labels.ts` place the "Then", "Now" and `CEREMONY_COPY.lineAnswer` labels. | — |
| Top_Bar | `src/components/ceremony/scene/TopBar.tsx` shows the wordmark and Demo chip, and on the persona page the notice, Calm, sound and Skip. The notice is hidden during `recall` (TestifyContext holds it) and, below 600 px, before `recall` (PersonaIntro holds it). Skip renders only while `useSequence().hasActive`. | — |
| Persona Read step | `src/components/ceremony/letter/LetterBlock.tsx` and `LetterBlock.module.css` draw the paper with two `.crease` hairlines across its full width. The "See the receipts" control is `REVEAL_COPY.stage2Next`; "Show everything" is `REVEAL_COPY.showAll`. | The CSS rule that leaves the column at about 440 px at 1440 wide. The first R task names it. |
| Demo pages | `src/app/demo/page.tsx` renders `DemoLabel`, the intro and the persona cards, then `LiveEntry` (`DEMO_COPY.liveEntryHeading` "Seal your own letter", `liveEntryBody`, `liveEntryLink` "Go to the live demo" as a text link). `src/app/how-it-is-sealed/page.tsx` renders `<SceneShell variant="plain" demo={false}>`. | — |
| Fonts and tokens | `src/app/layout.tsx` loads `EBGaramond-Variable.woff2` as `--font-serif` and `Inter-Variable.woff2` as `--font-sans`. `src/components/ceremony/scene/tokens.css` defines `--bg` #0b0912, `--muted` #bdb4dc, `--accent` #ff7b1c, `--paper` #f6ead4 and `--ink-soft` #4a4036. | Whether the EB Garamond file has an italic axis. |
| Budgets | `scripts/check-js-budget.mjs`: `/` 160 kB, `/demo` 160 kB, `/demo/personas/[key]` 260 kB, `/demo/live` 260 kB, `/l/[id]` 260 kB (gzipped, kB = 1,000 bytes). | The headroom at the spec's base commit. The first task measures it. |
| Checks | `scripts/check.sh` runs lint, typecheck, `npm test`, `npm run build` and the JS budget. `npm run layout-check` runs `tools/qa/layout-check.mjs` (rows such as `wFailures`, `w8Failures`, `p1Failures`, `f3Failures`). `npm run live-walk` runs `src/test/integration/live-walk.test.ts` with `WALK=1`. | — |
| Ownership | `.github/agents.json`: frontend-dev owns `src/app/**/*.tsx`, `src/app/**/*.css` and `src/components/**`; data-dev owns `src/lib/figures/**`; platform-dev owns `tools/qa/**`, `src/test/**`, `src/app/page.tsx` and `README.md`; crypto-dev owns `src/lib/crypto/**` and `src/lib/seal-format/**`. Test files under `src/` are shared. `max_changed_lines` is 5,000. | — |

## Decisions already made

| Topic | Decision |
|---|---|
| Unattended run | No task waits for an owner's look, approval or answer. A failed automated check makes the agent fix the code, not lower the check. The spec has no open questions. |
| Steering wins | Where the owner's design or this spec conflicts with `.kiro/steering/`, the steering file wins. The decisions below record each place where that changed the owner's design. |
| Dates | Group S merged by 19 November 2026, group W by 22 November, group T by 23 November, groups R, B and X by 25 November, group D by 26 November, and the final Live_Walk by the 27 November freeze. These dates are the plan; the owner's freeze date is the only hard one. |
| Order | S, W, T, then R, B and X, then D, then Q. In group Q the layout-row and Live_Walk tasks come first, then the Fix_Up_Task (19), then the Final_Walk (20), the highest-numbered task (G3.1, Q1.6). The agent loop runs one run at a time in total and takes the lowest-numbered ready issue first. |
| Cut order | Group D (D1, D2) is the only cuttable work. Whatever is merged at the 27 November 2026 freeze ships; nothing else is cut (G3.3). The Final_Walk does not depend on any group D task, so it runs whether or not group D merged (G3.5). |
| Spec 13 open tasks | Spec 14 tasks list only spec 14 dependencies. They do not wait for spec 13 tasks 12, 13, 18 or 20 to 23. Each task works on `main` as it is when the task starts. If a spec 14 PR merges after spec 13's recount (spec 13 task 22), spec 13 D1.5 repeats the recount. |
| Scope of the Write and Seal redesign | Only `/demo/live` (`WriteForm` section modes `write` and `seal`). `/seal` (section `all`) keeps its current markup, because real sealing stays no-go (spec 11 L6). Copy keys that `/seal` shares with `/demo/live` (`busyBody`, `backupChoiceLegend`, `occasionLabels.blank`) change on both (X1). |
| Fonts | EB Garamond for everything that is part of the letter (letter text, salutation, sign-off, questions), Inter for everything else. No new font file is added (spec 09 G1.6). If the EB Garamond file has no italic axis, `font-style: italic` uses the browser's synthesised oblique. |
| Colours | Only the existing tokens and the literal values the owner gave. Orange stays for "you" as `tone.md` lists it: the main buttons, the wax, the focus ring, the reader's own answer, the reader's current step on the Step_Track, the press instruction under the seal, the selected Backup_Card and the numbered question disc (a drop of wax). `tone.md` allows each of these uses. The light-orange (#ff9a4d) press instruction (the Press_Status_Line) sits on near-black, never on purple. Orange never marks a figure: the selected figure row is white (W11.4). |
| Contrast | Every value the owner gave passes WCAG 2.2 AA where it carries text: #8f86ad on #0b0912 is about 5.8:1, #6b5f51 on #f6ead4 about 5.2:1, #bdb4dc on #15111f about 9:1. The question input's resting bottom border (rgba(31,27,22,.35) on paper, about 2.1:1) is not the only sign that the field is editable: the visible "Edit" control and the placeholder also show it, and the hover and focus border is solid ink. |
| Page headings on /demo/live | Exactly one `h1` per step. On Write the `h1` is "Write to the you who opens this." and "Seal your own letter" (`LIVE_COPY.liveHeading`) becomes the eyebrow, shown in capitals by CSS and stored as written. On the Seal step the `h1` is "Press the seal." The Write and Seal steps render no Live_Stepper step-name `h2` and no `SealPage` `h1`. The Wait step and the steps after it keep today's headings and markup. |
| Step_Track | One component replaces the look of `StepIndicator` on every step of `/demo/live`. The last step's label is "Receipts", a new `LIVE_COPY` key. `BRAND_COPY.ritualSteps` and the README's step names are unchanged. On a Phone the "Step {n} of 6 · {label}" text is not a live region; the one `role="status"` step announcement (S1.5) stays the only announcement of a step change. |
| Phone | "Phone" means below 600 px (`PHONE_BELOW_PX`). The Write step's two-column row wraps when the Step_Container's content box is narrower than 992 CSS px (620 + 340 + 32), so the Envelope_Panel sits below the Letter_Sheet (W1.4). The Seal step is one column below 900 px. |
| Default Occasion | "A blank page" is chosen when the Write step first loads, as `blank` is today. |
| Occasions never write into the letter | Picking an Occasion changes the letter placeholder and replaces only question rows the author has not edited. It never writes text into the letter. The `starter` strings stay in `OCCASIONS` as the source of the placeholders and are never inserted. |
| Placeholders | "A decision": "This is the decision in front of me, and where I lean…". "A blank page": "Write whatever you want to remember about today…". "The year ahead": "This is where my year stands as I write this…". "Work": "This is what my work looks like as I write this…". "Family": "This is how things are with the people closest to me…". Each is at most 12 words (spec 13 W2.1). They are display text for the writing day in the author's voice, not questions, so `tone.md`'s rule against "today" in questions and the second-person rule (G1.5) do not apply. |
| Suggestions | Each Occasion gets a list of at least two suggested questions in `occasions.ts`. "Ask another:" shows the first two that are not already a row, from the chosen Occasion's list and then a shared list. The shared list starts with "What were you worried about when you wrote this?" and "What were you looking forward to when you wrote this?". Every suggestion names the sealing day. The leading "+ " on a pill is decoration and is hidden from assistive technology. |
| Envelope checklist values | "The letter": "{n} words" ("1 word"), or "not written yet" when the letter is empty. Words are runs of non-space characters. "Questions on top": "{n} of 3", counting non-empty rows. "A receipt": "none yet", or the receipts joined by " · ": "1 price" or "{n} prices" for official figures, "1 own number" for a self-reported one. The phone line reads "Letter · {n} questions · no receipt" with the same parts ("No letter yet", "1 question", "no questions", "1 price" and so on). |
| Seal readiness | The small envelope's seal is at 35 % opacity until the Write step's own check would pass (the same check the "Fold it and press the seal" button runs, W13.2), then at full opacity. |
| Failed fold | The summary line under the button reads "Check the note above, then try again." |
| Own number view | `data-integrity.md` requires a region and a period for every figure, and the existing self-reported rules require both. So the view adds a fourth input, "Where?" (placeholder "My city"), on its own row after "Amount" and "Unit". The sealed period is the same YYYY-MM-DD sealing day the Write_Check uses for the self-reported period rule. It is shown under the inputs as "Dated {date}", with the date written as day, full month and year (for example "Dated 17 November 2026"). The view holds exactly one own number, with no add or remove control. A view left fully blank seals nothing and does not block the fold (spec 12 W6). |
| Figure row text | The Short_Name from `short-names.ts`, then region and period. A `weekly` series' period reads "week of {day} {Mon}", for example "week of 9 Nov". Other periods keep the picker's current form (spec 12 K2.4). The value uses Display_Precision. The unit uses a short form from one literal table ("USD per gallon" is "USD/gal", "EUR per litre" is "EUR/L"); a unit with no entry shows in full. The full unit stays in the row's accessible name and in Details. A display rescale is shown as today (spec 09 C8). |
| Sources line | "Sources: {names}." lists the distinct publishers of the rows shown, in row order, from one literal table of short publisher names. With today's catalogue it reads "Sources: U.S. EIA · EU Weekly Oil Bulletin." "Details" is a disclosure button that shows the existing per-figure source details (`figureSourceName`, `figureSeriesId`, `figureSourceLink`, `figureRetrieved`) for every row. |
| Figure hint | "Choose up to {max}." The singular form is "You can choose 1." The second sentence ("Each is sealed as published…") is dropped from the hint; the sources line and Details carry provenance. |
| Seal step paragraph | One paragraph: "This letter is sealed in your browser with your own passkey. Your device will ask for the passkey twice. The passkey will be named "Revenant demo" in your passkey manager." The sentence "Each time, you press a button first." is dropped because it is no longer true. `LIVE_COPY.warning` keeps its exact wording. |
| Seal step status line | Before a choice: "Choose a backup option first." After a choice: "Press and hold the wax to seal it." Under `prefers-reduced-motion: reduce` or Calm_Mode, where one press seals (spec 13 P2.7): "Press the wax to seal it." While creating, confirming, preparing or sealing: `LIVE_COPY.stepCreating`, `stepConfirming`, `stepPreparing` or `stepSealing`. In `created` (the Setting_State): `PRESS_COPY.setting`. `LIVE_COPY.stepCreated` does not show on the Seal step. |
| Instant press | Under `prefers-reduced-motion: reduce` or Calm_Mode, `WriteForm` passes `instant` to `PressEnvelope`, so one press seals with no hold (spec 13 P2.7, S6.9). |
| Envelope line | "To me, on opening day · {n} questions on top", with "1 question on top" for one, and only "To me, on opening day" when there is none. |
| Seal step links | "Opening on another device?" is a disclosure button that shows the existing `LIVE_COPY.crossDevice` text. "← Back to the letter" goes back to the Write step and keeps the draft (spec 09 D2.2). It is disabled, at the same position, while a passkey prompt, the Setting_State or the sealing runs. Both are text controls, never orange. |
| Testify counter | Live and real letters: "Question {n} of {total} · you wrote this on {date}", with `{date}` from `Opened.header.sealedAt` as a calendar date in the reader's time zone (for example "17 November 2026"). Persona letters keep "Question {n} of {total} · as of {date}", because the judge did not write them. |
| Testify order | Number questions: counter, question, intro (first question only), unit, rescale note where one applies, field, readings and errors, Recall_Scale, Sample_Note, "No answer", then the navigation row. Text questions: counter, disc and question, field, character count and error, "No answer", navigation row. |
| "Read as" line | `CEREMONY_COPY.parsedValue` is removed from the pager. The value the reader typed still shows in the input and in the Recall_Scale's label, so spec 08's rule that the parsed value shows before submit still holds. The two-readings choice for an ambiguous separator stays. |
| Scale ranges | Every displayed unit that `/demo/live` can seal or a persona letter holds gets a literal entry in `UNIT_RANGE_TABLE`. The ranges stay literals, never computed from a figure or an answer (spec 08), so the scale gives no hint. `FALLBACK_RANGE` stays for a unit no catalogue has. |
| Same period | When the then and now figures are a Same_Figure on a Live_Letter or real letter, the change line is not shown. The period type is read from the sealed period string, never from the catalogue: a period written YYYY-MM-DD is a week, and the receipt says "Same week as when you sealed it. A letter kept for months would show the change." A period written YYYY-MM is a month: "Same month as when you sealed it. A letter kept for months would show the change." Any other period: "Same period as when you sealed it. A letter kept for months would show the change." Both figures still show with their periods. |
| Change rounding | The change is still computed from the full-precision values in `src/lib/figures` (`data-integrity.md`). Only its display changes: the difference is shown with the same number of fraction digits as the then and now values it sits beside. The percentage keeps one fraction digit. The sign and direction word still come from the exact difference. |
| Formula placement | `data-integrity.md` requires the formula alongside the result. It moves out of the change sentence to a line directly under the Source line on the same receipt card, in plain view, never inside a disclosure. |
| Ghost on the Read step | `tone.md` says the ghost delivers the letter and leaves. The ghost leaving on the persona Read step is kept. The fix is the empty right half: the letter column is centred. |
| Creases | The two crease hairlines stay as decoration but are drawn only in the paper's side margins, so no crease crosses a line of text (`tone.md`: texture never sits on text). |
| Top_Bar | One fixed layout on every Scene page: wordmark and Demo chip on the left; on the persona page the notice; then Calm, sound (where the page has it) and Skip on the right, in that order. The persona notice is in the Top_Bar on every Stage and at every width; TestifyContext and PersonaIntro no longer carry it. The Skip slot is always rendered: while no sequence runs it is a native `disabled` button at 40 % opacity, out of the Tab order, at the same position. |
| /how-it-is-sealed | The page gets the Demo chip (`demo` true on its SceneShell). |
| /demo live entry | `LiveEntry` becomes a card in the same family as the persona cards. "Go to the live demo" is an `a` link to `/demo/live`, styled with the persona card's orange button, so it works with JavaScript off. |
| Contrast and copy tooling | `node tools/hooks/tone-check.mjs` and the existing copy tests check every changed copy file. |
| Config | `.config.kiro` for this spec has its own `specId`, in the same shape as spec 13's. |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **Spec 13 W1.1 to W1.3 (one Writing_Column at most 44 rem, paper no wider than the column plus 80 px, Letter_Field top position)**: replaced by W1 and W4. Spec 13 W1.4 stays, except that the label is visually hidden and the minimum height is 296 px (W5).
- **Spec 13 W3 (Occasions as underlined text options)**: replaced by W3 (pills).
- **Spec 13 W5.1 (only the Step_Heading and the Occasion control above the Letter_Field)**: replaced by W2 (Step_Track, eyebrow, `h1`, intro and Occasion row).
- **Spec 13 W6 ("Add a receipt" beside Next, one native `details`)**: replaced by W10 (the "Tuck in a receipt" card; a native `details` only on phone).
- **Spec 13 W4.4 (a question row at most two lines tall)**: replaced by W7, whose row has a lock line under the input. The owner's design requires it.
- **Spec 13 W7.1 and W7.2 (Receipt_Rows with no card border, at most two lines)**: replaced for official figures by W11 and for own numbers by W12. The owner's design requires it. Spec 13 W7.3 (period next to value, source one step away) and W7.5 (the Picker_Note once) stay.
- **Spec 11 L2.2, the part that puts the Occasion's letter starter into the letter field**: replaced by W3.4. The part about question rows stays.
- **Spec 11 L1.4 and `LIVE_COPY.receiptsAction`, `receiptsSummary` on `/demo/live`**: replaced by W10.
- **Spec 10 C2.1's legend and hint (`authorQuestionsLegend`, `authorQuestionsHint`), `answerInLetter` and `authorQuestionAdd` on `/demo/live`**: replaced by W6 and W8.
- **Spec 10 C1.5 (the typed number answer and Next in one row)**: replaced by T2.5 (the main button sits in the Nav_Row).
- **Spec 12 Z2's Single_Figure_View for Same_Figure cards on a Live_Letter or real letter**: replaced by R7.1. Persona cards keep spec 12 Z2.
- **Spec 13 P1.3, the part that keeps Back as an outlined button**: replaced by S5.4 (a text link). The Press_Envelope stays the only orange button on the Seal step.
- **Spec 09 D2.1's numbered step list look and the use of "See the receipts" as the stepper's last label**: replaced by S1.
- **Spec 09 P5.1 (Top_Bar at most 56 CSS px at the Phone_Sizes) and P5.3 (the notice in Persona_Intro), on the persona page only**: replaced by B1.5. Every other page keeps P5.1.
- **Spec 07 R8.3 and the TopBar rule that hides the persona notice during `recall` and below 600 px before `recall`, and spec 11 P3 where TestifyContext holds the notice during `recall`**: replaced by B1. The notice wording (spec 07 R8.4), the 96 px height limit (R8.1) and "the notice once" stay.
- **Spec 07 R8.6, the part where Skip is not rendered while no sequence runs**: replaced by B1.3. While a sequence runs Skip is still visible, in the Tab order and works with Enter and Space.
- **Spec 08's "Read as {value}" line (`CEREMONY_COPY.parsedValue`) under the recall number field**: replaced by T2.3.

## Out of scope

- Any change under `src/lib/crypto/`, `src/lib/seal-format/`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`, and any change to the sealed payload, the envelope header or `format_version`.
- Any edit to `.kiro/**`, `.github/**`, `tools/agents/**`, `tools/dispatcher/**`, `tools/hooks/**` or `scripts/check.sh`.
- `/seal` (real sealing), whose markup stays as it is.
- The Wait step's content and layout (spec 13 T1 to T3 stay).
- A new Stage, persona, Occasion, figure source, region or font.
- Scoring, summarising or interpreting the testimony against the letter (`neutrality.md`).
- The README, the video script and the recount (spec 13 group D).

## Known limitations

- **The sealing-day date on the sheet is the browser's.** The date in the sheet's top row and the "Dated {date}" of an own number use the visitor's device date. The sealed `sealedAt` is still the server's time.
- **The 30-second letter has no change to show.** "Now" equals "then" (`data-integrity.md`); the same-period line says so instead of showing 0.
- **The Live_Walk proves the code path, not any phone's passkey provider** (spec 11 Known limitations).

## Open questions for the owner

None. Every open point is decided above.

## Glossary

- **Write_Step**: The "Write" step of `/demo/live` (`WriteForm` section `write`).
- **Seal_Step**: The "Press the seal" step of `/demo/live` (`WriteForm` section `seal`), as in spec 13.
- **Step_Container**: The centred container of the Write_Step and the Seal_Step, at most 1240 px wide with 32 px side padding.
- **Step_Track**: The six-step row at the top of each `/demo/live` step (S1).
- **Step_Header**: The Step_Track, the eyebrow, the `h1`, the intro and, on the Write_Step, the Occasion_Row.
- **Occasion_Row**: "Start from" and the five Occasion pills (W3).
- **Letter_Sheet**: The paper surface of the Write_Step that holds the letter and the questions (W4).
- **Letter_Field**: The letter `textarea` on the Letter_Sheet, as in specs 11 to 13.
- **Perforation**: The dashed line across the Letter_Sheet between the letter and the questions (W6.1).
- **Question_Section**: The fieldset "P.S. Questions for opening day" on the Letter_Sheet (W6).
- **Question_Row**: One Author_Question row in the Question_Section (W7).
- **Wax_Disc**: The 30 px orange numbered circle beside a question (W7.2, T1.3).
- **Lock_Line**: The muted line under each question input: "Answered on opening day, before the letter is shown." (W7.5).
- **Suggestion_Pill**: A pill under the last Question_Row that adds a suggested question (W8).
- **Envelope_Panel**: The column to the right of the Letter_Sheet with the In_The_Envelope_Card, the Receipt_Card_Panel and the Fold_Button (W9 to W13).
- **In_The_Envelope_Card**: The card "In the envelope" with the small envelope and the three checklist lines (W9).
- **Checklist_Line**: One of the three lines of the In_The_Envelope_Card.
- **Receipt_Card_Panel**: The card "Tuck in a receipt" (W10).
- **Receipt_Toggle**: The two-way segmented control "A public price" / "A number of my own" (W10.3).
- **Figure_Row**: One official figure the author can tuck in (W11).
- **Own_Number_View**: The "A number of my own" view of the Receipt_Card_Panel (W12).
- **Fold_Button**: The button "Fold it and press the seal" that ends the Write_Step (W13).
- **Write_Check**: The validation the Fold_Button runs, the same as today's Write-step Next (letter, question rows, self-reported rows, the nothing-to-testify rule, the figure limit).
- **Press_Envelope**, **Backup_Choice**, **Warning_Text**, **Setting_State**, **Release_Event**: as defined in spec 13.
- **Backup_Card**: One of the two radio cards of the Backup_Choice (S4).
- **Press_Status_Line**: The `role="status"` line under the Press_Envelope (`data-press-line`, S6).
- **Recall_Pager**: `RecallPager.tsx`, the one-question-at-a-time Testify view.
- **Answer_Field**: The text answer field of a text question (`TextAnswerField`) or the number input of a number question.
- **Nav_Row**: The row under a question with "Previous question" on the left and "Next question" or "Record my answers" on the right (T1.5).
- **Same_Period_Line**: The line shown instead of the change when then and now are a Same_Figure (R7).
- **Formula_Line**: The readable then-vs-now formula of a receipt (`REVEAL_COPY.formulaLabel`).
- **Top_Bar_Slot**: A fixed position in the Top_Bar for one control (B1).
- **Soil_Band**: The purple soil and glow decoration of the Scene (`SoilStrip`, `SoilCanvasLoader`).
- **Evidence_Sizes**: 1440×900 and 390×844, each with and without `prefers-reduced-motion: reduce`.
- **Phone**: a viewport below 600 CSS px wide.
- **Final_Walk**: The last task (20): a report-only run of `npm run live-walk` and `npm run layout-check` on merged `main` (Q1.5).
- **Fix_Up_Task**: Task 19, the frontend-dev task that runs the layout rows and the Live_Walk on a local stack and fixes product code until both pass (Q1.6).
- **Persona_Letter**, **Live_Letter**, **Opening_Flow**, **Reveal_Host**, **Live_Stepper**, **Ghost**, **Scene**, **Scene_Frame**, **Stage**, **Calm_Mode**, **Skip**, **Recall_Scale**, **Sample_Note**, **Number_Line**, **Receipt_Card**, **Short_Name**, **Display_Precision**, **Picker_Note**, **Occasion**, **Author_Question**, **Sealing_Day_Anchor**, **Rehearsal_Line**, **Top_Bar**, **First_Viewport**, **Step_Shot**, **Live_Walk**, **Journey_Check**, **Our_Copy**, **Scoring_Words_Always**, **Scoring_Words_Scene**, **Retired_Phrase**, **Same_Figure**, **Single_Figure_View**, **Phone_Sizes**: as defined in specs 05 to 13.

## Requirements

### G1. Roles and boundaries

**User Story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working without me.

#### Acceptance Criteria

1. EACH task SHALL name exactly one role from `.github/agents.json`, and its PR SHALL change only files matched by that role's paths or the `shared` list and listed in the task's Scope.
2. EACH task SHALL list its "Depends on" tasks by spec 14 task number only, or "none", and SHALL NOT list a spec 13 task.
3. THE PRs SHALL change no file under `.kiro/`, `.github/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`, and SHALL NOT change `scripts/check.sh`, `README.md` or `docs/video-script.md`.
4. THE PRs SHALL keep the privacy and size rules of spec 09 G1.5 and G1.6: the CSP header byte-identical, no browser request to another origin, nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment, no new entry in `dependencies`, no animation library, no WebGL, no new font file, no new sound cue and no vibration cue (the existing Top_Bar sound control of B1 stays).
5. EVERY string of Our_Copy that a PR adds or changes SHALL live in its feature folder's `copy.ts` module, except the Occasion placeholders and suggestions in `occasions.ts`, the Short_Names in `short-names.ts`, and the literal short-unit and short-publisher tables of the Decisions, which live in one module each in their feature folder. Every such string SHALL pass the `neutrality.md` copy test and SHALL have at most 25 words per sentence, no exclamation mark, no pun and no word on `tone.md`'s avoid list. Every sentence that addresses the reader SHALL be in the second person; letter placeholders, which are written in the author's voice, are exempt. No string SHALL contain any of the Scoring_Words_Always. Strings in the Scene copy modules SHALL also contain none of the Scoring_Words_Scene.
6. THE Accent (#ff7b1c and its tints, including #ff9a4d) SHALL mark only the main buttons, the wax (including the Wax_Disc and the wax seal's halo), the focus ring, the reader's own answer, the reader's own choice (the selected Backup_Card), the reader's current step on the Step_Track (S1.2) and the Press_Status_Line (S6). It SHALL NOT mark a figure, a change or a direction, and SHALL NOT be used for text on purple.
7. EVERY text and number SHALL meet WCAG 2.2 AA contrast on the surface it sits on: 4.5:1 for text below 24 px regular or 18.66 px bold, 3:1 for larger text, and 3:1 for the boundary of a control that has no other visible sign of being a control. Text on purple SHALL be pure white (#ffffff). Soil, glow, crease and texture decoration SHALL NOT sit under any text.
8. WHILE `prefers-reduced-motion: no-preference` is set and Calm_Mode is off, THE pages SHALL run decorative motion that changes only `transform` and `opacity`. WHILE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE pages SHALL run no decorative motion, and the step-change scroll SHALL be instant (S2.4). No second Motion_Control SHALL be added.
9. AT each PR's final commit, every route SHALL be at or under its budget in `scripts/check-js-budget.mjs`, and no budget value in that file SHALL be changed.
10. EVERY Author_Question default and Suggestion_Pill question that a PR adds or changes SHALL name the sealing day and SHALL NOT contain "right now", "today" or "currently".

### G2. Tests and evidence

**User Story:** As the owner, I want every task to prove itself with checks QA can run alone, so that the spec runs without me.

#### Acceptance Criteria

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser, apart from `npm run layout-check` and the Live_Walk.
2. THE property tests SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 14-write-desk, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the SHA, the exit status and PASS or FAIL in a commit message body (G2.9).
4. FOR EACH task whose diff changes the rendered markup or CSS of a route, THE QA review SHALL take PNG screenshots of every step, Stage or page the task changes at each of the four Evidence_Sizes, named `<step-or-page>-<width>x<height>[-reduced].png`. At 390×844 the shots SHALL be First_Viewport captures, plus one full-page capture per changed page at 390×844 without reduced motion, named `<page>-390x844-full.png`. Dev agents SHALL attach no screenshots.
5. EACH task SHALL state in a commit message body (G2.9) every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, and every earlier-spec test it changed or retired with the reason, writing "none" for an empty list.
6. THE first task of each of groups S, W, T, R, B and X SHALL make its reproduction its first commit, before changing anything: an empty commit whose message body names, for each symptom in its group, the component, the CSS rule or source line that causes it, the measured numbers, and the `main` commit SHA it was measured on. The reproduction SHALL use no screenshots from `main`.
7. EACH task that adds or changes a string of Our_Copy SHALL state in a commit message body (G2.9) the result of `node tools/hooks/tone-check.mjs` for every copy file it changed, and the result of a search of the rendered Our_Copy of every page it changed showing that no Retired_Phrase remains.
8. EVERY size, colour and font value stated in an acceptance criterion or in "Decisions already made" SHALL be checked by a CSS source test (in the style of `constants-css.test.ts`) or by a computed-style read in `tools/qa/layout-check.mjs`. Sizes SHALL match within 1 CSS px. Colours, including alpha, SHALL match exactly. The approximate contrast ratios in the Decisions SHALL be checked as at least the WCAG threshold of G1.7, not as exact values.
9. ANYTHING this spec or a task asks a task to report SHALL go in a commit message body on the task's branch, kept short, because commit bodies are what reach the PR and they are cut at 12,000 characters. No task SHALL rely on editing the PR description or attaching files to the PR.

### G3. Task order, cuts and dates

**User Story:** As the owner, I want the work in dependency order with one clear cut, so that a late freeze costs the least.

#### Acceptance Criteria

1. THE tasks SHALL be numbered in the order S, W, T, then R, B and X, then D, then Q. Within Q the layout-row and Live_Walk tasks come first, the Fix_Up_Task is task 19, and the Final_Walk is task 20, the highest-numbered task. The agent loop runs one run at a time in total and takes the lowest-numbered ready issue first. Each task SHALL be one GitHub issue and one PR for one role, at or under `max_changed_lines` (5,000) as `.github/agents.json` counts it.
2. WHEN a PR merges, THE `main` branch SHALL pass `bash scripts/check.sh`. On a production build, `/`, `/demo`, `/demo/live`, `/how-it-is-sealed`, every persona page, and `/l/[id]` for an ID that does not exist SHALL each return a status below 500 and render with no uncaught page error at both Evidence_Sizes.
3. THE group D tasks (D1, D2) SHALL be the only cuttable work: whatever is merged on `main` at the 27 November 2026 freeze ships, and nothing else is cut.
4. THE requirements of groups G, S, W, T, R, B, X and Q SHALL NOT be cut.
5. THE Final_Walk task SHALL NOT depend on any group D task, so that cutting group D leaves it runnable.

### Group S. The Seal step and the shared step header

### S1. The Step_Track

**User Story:** As a judge sealing my own letter, I want a quiet track of the six steps, so that I always know where I am.

#### Acceptance Criteria

1. THE Live_Stepper SHALL show the Step_Track on every step of `/demo/live`: six steps in one row, in this order and labelled "Write", "Press the seal", "Wait", "Testify", "Break the seal" and "Receipts". Each step is a circular dot followed by a 13 px Inter label, and neighbouring steps are joined by 36 px long, 1 px hairlines in #3a3350. The "Receipts" label SHALL come from a new `LIVE_COPY` key, and `BRAND_COPY.ritualSteps` SHALL stay unchanged.
2. THE current step SHALL have a 12 px dot in #ff7b1c with a 4 px halo in rgba(255,123,28,.22), a label in #ffffff at font-weight 700, and `aria-current="step"`. Done steps SHALL have an 8 px dot in #bdb4dc and a label in #bdb4dc. Future steps SHALL have an 8 px dot in #3a3350 and a label in #8f86ad. No step other than the current one SHALL carry `aria-current`.
3. FOR EACH step of `/demo/live`, THE Step_Track SHALL mark exactly one step current, every earlier step done and every later step future, and SHALL expose each state as `data-state` `current`, `done` or `todo` on the step's element, so that no state is told by colour alone.
4. WHILE the viewport is a Phone, THE Step_Track SHALL show the text "Step {n} of 6 · {label}" (for example "Step 1 of 6 · Write"), using the S1.1 label of the current step, and the six dots joined by their hairlines. It SHALL show no per-step labels. This text SHALL NOT be a live region.
5. WHEN the Live_Stepper moves to another step, THE Step_Track SHALL update its one `role="status"` announcement (spec 09, `LIVE_COPY.stepAnnounce`) with the S1.1 label of the new step, and the page SHALL contain no other live region that announces the step change.

### S2. The step container and the step change

**User Story:** As a judge, I want the track and the title in view after every step change, so that I never land half under the top bar.

#### Acceptance Criteria

1. THE Write_Step and the Seal_Step SHALL sit in the Step_Container: horizontally centred, at most 1240 px wide, with 32 px left and right padding, on the dark page (`--bg` #0b0912). The Scene light SHALL show as a purple glow whose centre lies in the top-right quarter of the viewport. The glow element SHALL be `aria-hidden`, SHALL take no pointer events, and SHALL NOT intersect the bounding box of any text element of the step (`tone.md`: glow never sits on text).
2. WHEN the Live_Stepper moves to another step, including Back, THE page SHALL scroll so that, 1,000 ms after the change, the top edge of the Step_Track lies between 16 and 48 CSS px below the bottom edge of the Top_Bar at both Evidence_Sizes. If the page is scrolled to its top, a gap larger than 48 px is allowed.
3. WHEN the Live_Stepper moves to the Write_Step, the Seal_Step or the Wait step, THE step's heading (the `h1` on Write and Seal, the Live_Stepper's step heading on Wait) SHALL receive focus with `preventScroll`, the page SHALL make no further scroll after S2.2, and the heading's whole bounding box SHALL lie below the Top_Bar's bottom edge (spec 13 W8 stays). Testify and Receipts SHALL keep the Opening_Flow's own focus rules.
4. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE scroll of S2.2 SHALL be instant.
5. THE first S task SHALL name, from measurements on `main`, why the track and title end under the Top_Bar after Next at both Evidence_Sizes.

### S3. The Seal step text column

**User Story:** As a judge, I want the Seal step to say plainly what happens, so that I know what the passkey does before I press.

#### Acceptance Criteria

1. THE Seal_Step SHALL show the Step_Track with "Write" done and "Press the seal" current. WHILE the viewport is 900 CSS px wide or wider, the text column and the Press_Envelope column SHALL sit side by side with a 64 px column gap, and their vertical centres SHALL align within 1 px. WHILE the viewport is below 900 px, there SHALL be one column with the text column first and the Press_Envelope after it.
2. THE text column SHALL be at most 520 px wide and SHALL hold, in this order: the `h1` "Press the seal." (Inter 48 px, weight 900, letter-spacing -0.03em, #ffffff), one paragraph in 17 px #bdb4dc, the Warning_Text, the Backup_Choice, `LIVE_COPY.fallbackButton` (only when the PRF hint is `missing`, as today), and one 13 px line of links. The Seal_Step SHALL have no eyebrow, no intro, exactly one `h1`, no `SealPage` `h1` and no Live_Stepper step-name `h2`.
3. THE paragraph SHALL read exactly: "This letter is sealed in your browser with your own passkey. Your device will ask for the passkey twice. The passkey will be named "Revenant demo" in your passkey manager." THE sentence "Each time, you press a button first." SHALL appear nowhere on `/demo/live`.
4. THE Warning_Text SHALL keep the exact wording of `LIVE_COPY.warning` as body text at the paragraph's size, outside any disclosure, animation or hover, and spec 13 P6 SHALL still hold. At 390×844, P6.2 SHALL count as met when the Warning_Text box and the wax seal box both fit in one 844 px tall window at a single scroll offset.
5. THE sentence that the letter is sealed in the browser with the author's own passkey SHALL appear on the Seal_Step once (spec 13 W5.3).

### S4. The backup choice as two cards

**User Story:** As a judge, I want the backup choice as two clear cards, so that I see both options and what each means.

#### Acceptance Criteria

1. THE Backup_Choice SHALL be a `fieldset` with the legend "If you lose this passkey" (15 px, weight 700) and two Backup_Cards 10 px apart.
2. EACH Backup_Card SHALL be a `label` wrapping a native radio input, with 16 px 18 px padding, a 10 px radius, background #15111f, a 1 px #2a2340 border, a custom 18 px radio circle, a title in 15 px weight 600 in #ffffff and one help line in 13 px #bdb4dc. The native radio SHALL stay focusable and in the accessibility tree, with the title as its accessible name and the help line as its accessible description. The custom circle SHALL be `aria-hidden`.
3. THE first Backup_Card SHALL read "Download a backup key card" with the help line "A small image with a QR code. It opens the letter if the passkey is gone." THE second SHALL read "Skip it. A lost passkey means a lost letter." with the help line "Fine for a 30-second rehearsal."
4. WHEN a Backup_Card is selected, THE Backup_Card SHALL show an orange (#ff7b1c) border, a tint of rgba(255,123,28,.10) and a filled orange radio circle.
5. THE Backup_Choice SHALL start with no option selected and SHALL keep the behaviour of spec 13 P7.2 to P7.6. That includes the explicit confirmation of "Skip it", the backup key card on the Wait step, `LIVE_COPY.backupChoiceUnchosen` under the cards after a press attempt with no choice, and the unchanged cannot-lock and `BackupFallback` paths.
6. THE Backup_Choice SHALL be operable by keyboard alone: Tab reaches the group once, the arrow keys move between the two radios and select them, and while a radio has `:focus-visible` its Backup_Card SHALL show a #ff7b1c focus ring at least 2 CSS px thick outside its border.
7. WHILE a passkey prompt, the Setting_State or the sealing runs, THE two radios SHALL be disabled and the selected Backup_Card SHALL keep its S4.4 look.

### S5. The links under the choice

**User Story:** As a judge, I want a way back to my letter and an answer about other devices, so that I am not stuck on the Seal step.

#### Acceptance Criteria

1. THE Seal_Step SHALL show one 13 px line under the Backup_Choice with two text controls: "Opening on another device?" and "← Back to the letter".
2. WHEN the author activates "Opening on another device?", THE Seal_Step SHALL toggle the existing `LIVE_COPY.crossDevice` text below the line of links, and the control SHALL be a `button` with `aria-expanded` set to `false` at load and to the text's visibility after each activation.
3. WHEN the author activates "← Back to the letter" while the seal state is `write`, THE Live_Stepper SHALL return to the Write_Step with the letter, questions, receipts and Occasion kept (spec 09 D2.2).
4. THE two controls SHALL be text controls, not orange, and the Press_Envelope SHALL stay the only orange button on the Seal_Step (spec 13 P1.3, Q1.2).
5. THE "←" in "← Back to the letter" SHALL be hidden from assistive technology, so the control's accessible name is "Back to the letter".
6. WHILE a passkey prompt, the Setting_State or the sealing runs, THE "← Back to the letter" control SHALL be disabled and SHALL stay at its position.

### S6. The press envelope and its status line

**User Story:** As a judge, I want the envelope to show when it can be pressed and to always tell me what to do, so that the step never goes silent.

#### Acceptance Criteria

1. THE Press_Envelope SHALL be horizontally centred in its column, min(440 px, column width) wide with an aspect ratio of 1.55 (within 1 px), in #f1e4c8 with a 6 px radius and the shadow 0 40px 90px rgba(0,0,0,.6). The flap SHALL be drawn as a triangle from both top corners to a point on the vertical centre line, filled darker than #f1e4c8.
2. THE Press_Envelope SHALL show at its bottom left, in EB Garamond italic 17 px, "To me, on opening day · {n} questions on top", where {n} counts the non-empty Question_Rows. It SHALL read "To me, on opening day · 1 question on top" for one and only "To me, on opening day" for none. The line SHALL be display-only and SHALL NOT change the control's accessible name "Press the seal".
3. THE wax seal SHALL be 112 px across at a 440 px envelope, scaled in proportion to the envelope width, and centred on the flap point. It SHALL be the press-and-hold control of spec 13 (P1, P2, P4, P5), unchanged in behaviour.
4. WHILE no Backup_Choice is made, or the crypto module has not loaded, THE wax seal SHALL be at 40 % opacity with `cursor: not-allowed` and `aria-disabled="true"`. WHILE a passkey prompt or the sealing runs, THE wax seal SHALL be at full opacity with no halo and `aria-disabled="true"`.
5. WHILE a Backup_Choice is made, the crypto module has loaded and no prompt is open, THE wax seal SHALL be at full opacity with the double halo 0 0 0 10px rgba(255,123,28,.18), 0 0 0 22px rgba(255,123,28,.08), and `aria-disabled="false"`. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE halo SHALL be off.
6. THE Press_Status_Line SHALL sit horizontally centred under the envelope as one `role="status"` line in 15 px weight 600, and its text SHALL be non-empty in every seal state from `write` until the letter is stored. The only exception is the inert failure and cancel views (spec 13 P4.3), where the failure screen's message is the status. On the Seal_Step, `StepStatus` SHALL NOT repeat the Press_Status_Line text, so each state line is announced once.
7. WHILE no Backup_Choice is made, THE Press_Status_Line SHALL read "Choose a backup option first." in #bdb4dc (this replaces the text of `PRESS_COPY.chooseFirst`). WHILE a choice is made and no prompt is open, THE Press_Status_Line SHALL read "Press and hold the wax to seal it." in #ff9a4d, or, WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, "Press the wax to seal it." in #ff9a4d. WHILE the seal state is creating, confirming, preparing or sealing, THE Press_Status_Line SHALL show `LIVE_COPY.stepCreating`, `stepConfirming`, `stepPreparing` or `stepSealing` respectively, in #bdb4dc. WHILE the seal state is `created`, THE Press_Status_Line SHALL show `PRESS_COPY.setting` in #bdb4dc. `LIVE_COPY.stepCreated` SHALL NOT show on the Seal_Step.
8. AT both Evidence_Sizes, THE bounding box of the Press_Envelope SHALL NOT intersect the bounding box of any element of the text column, and the Seal_Step SHALL cause no horizontal scroll at 390 and 1440 wide.
9. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE Seal_Step SHALL render the Press_Envelope in instant mode (spec 13 P2.7), so one pointer press or one Enter or Space activation seals with no hold.

### Group W. The Write step

### W1. The Write step layout

**User Story:** As a judge, I want the Write step to look like a letter on a desk beside its envelope, so that writing feels like writing a letter.

#### Acceptance Criteria

1. THE Write_Step SHALL render in the Step_Container on the dark page, with the Step_Header on top and, 28 px below it, a wrapping flex row with a 32 px gap.
2. THE row SHALL hold the Letter_Sheet on the left (`flex: 999 1 620px`) and the Envelope_Panel on the right (`flex: 1 1 340px`), with the Letter_Sheet before the Envelope_Panel in DOM and Tab order.
3. WHILE the Letter_Sheet and the Envelope_Panel sit side by side and the Envelope_Panel's height is at most the viewport height minus the Top_Bar's bottom edge minus 32 CSS px, THE Envelope_Panel SHALL be sticky with its top edge at least 16 CSS px below the Top_Bar's bottom edge.
4. WHILE the Step_Container's content box is narrower than 992 CSS px (620 + 340 + 32), THE Envelope_Panel SHALL sit below the Letter_Sheet at the full content width; at 992 CSS px and wider they SHALL sit side by side.
5. THE Write_Step SHALL cause no horizontal scroll at 390, 1055, 1056 and 1440 CSS px wide.
6. IF the Envelope_Panel is taller than the viewport below the Top_Bar, THEN THE Envelope_Panel SHALL scroll with the page so that the Fold_Button can be scrolled fully into view at 1440×900 with every Figure_Row listed.

### W2. The Write step header

**User Story:** As a judge, I want the page to say what to write before I start, so that I know what the letter is for.

#### Acceptance Criteria

1. THE Step_Header of the Write_Step SHALL show, top to bottom: the Step_Track, the eyebrow, the `h1`, the intro and the Occasion_Row.
2. THE eyebrow SHALL be a non-heading text element whose text content is "Seal your own letter" (`LIVE_COPY.liveHeading`), displayed as "SEAL YOUR OWN LETTER" by CSS `text-transform`, in 12 px weight 600 with letter-spacing .16em in #bdb4dc.
3. THE `h1` SHALL read "Write to the you who opens this." in Inter 56 px, weight 900, letter-spacing -0.03em and line-height 1.02, and 36 px on a Phone. THE Write_Step SHALL have exactly one `h1`, SHALL render no step-name `h2` from the Live_Stepper, and the `h1` SHALL be the heading that receives focus on arrival (S2.3).
4. THE intro SHALL read "Say where things stand today. Then leave a few questions. When it opens, you answer them from memory first, then read what you wrote." in 17 px #bdb4dc, at most 620 px wide.

### W3. The Occasion pills

**User Story:** As a judge, I want to start from a kind of letter, so that I am not facing a blank page, without the app writing my letter for me.

#### Acceptance Criteria

1. THE Occasion_Row SHALL be a `fieldset` whose visible legend is "Start from" in 13 px #bdb4dc, followed by five `button type="button"` pills in this order: "The year ahead", "Work", "Family", "A decision" and "A blank page". On `/demo/live` the visually hidden legend `LIVE_COPY.occasionLegend` is not rendered.
2. EACH pill SHALL be 44 px tall, fully rounded, with 16 px horizontal padding and 14 px weight 500 text. An unselected pill SHALL be transparent with a 1 px #4a4266 border and white text. The selected pill SHALL be solid white with #0b0912 text and `aria-pressed="true"`; the others SHALL have `aria-pressed="false"`. WHEN the Write_Step first loads, "A blank page" SHALL be the selected pill.
3. WHEN the author picks a pill, THE Write_Step SHALL change the Letter_Field placeholder to that Occasion's line from "Decisions already made", and SHALL replace only question rows that are empty after trim, missing, or still equal to the question the previous Occasion put at that position. A row the author typed SHALL be kept in place (spec 11 L2.2, question part).
4. FOR ALL letter texts, including the empty string and whitespace-only text, and all sequences of Occasion picks, THE letter text after the picks SHALL equal the letter text before them, character for character.
5. WHILE the viewport is a Phone, THE Occasion_Row SHALL scroll sideways in one line, and the page SHALL not scroll sideways.
6. THE Occasion rules of spec 11 L2.5 stay: the Occasion is client-side only and never stored, sent or sealed.

### W4. The Letter_Sheet

**User Story:** As a judge, I want a sheet of warm paper, so that the letter looks like a letter.

#### Acceptance Criteria

1. THE Letter_Sheet SHALL have background #f6ead4, a 6 px radius, padding 48px 56px 40px (24px 20px on a Phone) and the shadow 0 30px 80px rgba(0,0,0,.55).
2. THE Letter_Sheet SHALL show a top row, space-between: "Dear future me," in EB Garamond italic 26 px #1f1b16 on the left, and on the right the visitor's local date in 13 px #4a4036, written in English as weekday, day, full month and year (for example "Tuesday, 17 November 2026"). WHILE the viewport is a Phone, the date SHALL wrap onto its own line under the salutation, left-aligned.
3. THE salutation and the date SHALL be display only: they SHALL NOT be part of the Letter_Field value, counted or sealed. THE server HTML SHALL hold an empty date slot of the row's height, THE date SHALL be filled in on the client after mount, and loading the page SHALL log no hydration warning in the console.
4. THE Letter_Sheet SHALL show a bottom row, space-between, under the Letter_Field: "— me, today" in EB Garamond italic 20 px #4a4036 on the left (display only, never sealed), and `LIVE_COPY.letterCount` "{count} of 5,000 characters" in 12 px #4a4036 on the right. The count is in Unicode code points (`countCodePoints`, the same count the validation uses) and grouped in thousands (for example "1,234"). Above 5,000 it SHALL show the true count (for example "5,012 of 5,000 characters").

### W5. The Letter_Field

**User Story:** As a judge, I want to write on ruled paper, so that typing feels like writing.

#### Acceptance Criteria

1. THE Letter_Field SHALL have no border and a transparent background, with EB Garamond 21 px text in #1f1b16 at a line-height of 32 px. WHEN focused, it SHALL show the orange focus ring together with a 1 px #1f1b16 line, so the focus indicator reaches at least 3:1 against #f6ead4.
2. THE Letter_Field SHALL draw ruled lines every 32 px behind the text with a `repeating-linear-gradient` in rgba(74,64,54,.16). The vertical gap between each text line's baseline and the nearest rule SHALL be at most 2 CSS px at the first, a middle and the last visible line, both before and after the field scrolls internally.
3. THE Letter_Field SHALL be at least 296 px tall and SHALL grow with its text up to the larger of 296 px and `letterFieldMaxPx` (half the visual viewport), then scroll inside itself. No typed text is cut off or hidden.
4. WHILE the Letter_Field value is the empty string, THE Letter_Field SHALL show the chosen Occasion's placeholder from "Decisions already made" in EB Garamond italic #6b5f51, at most 12 words, never stored, counted or sealed (spec 13 W2).
5. THE Letter_Field SHALL have the visually hidden label "Your letter" and no `maxlength`. IF the text is empty after trim or over 5,000 code points when the field is touched or the Fold_Button is pressed, THEN THE Letter_Sheet SHALL show `LIVE_COPY.letterEmpty` or `LIVE_COPY.letterTooLong` directly under the bottom row, linked by `aria-describedby`. The typed text is kept and the step stays on Write (spec 13 W1.4).

### W6. The perforation and the Question_Section

**User Story:** As a judge, I want my questions set apart as a postscript, so that I see they are for the day it opens.

#### Acceptance Criteria

1. THE Letter_Sheet SHALL draw the Perforation from its left edge to its right edge (within 1 CSS px of each): a 2 px dashed line in rgba(74,64,54,.28), 36 px below the bottom row (or below the letter problem line when shown) and 32 px above the Question_Section.
2. THE Question_Section SHALL be a `fieldset` with the legend "P.S. Questions for opening day" in EB Garamond 26 px weight 500 #1f1b16.
3. UNDER the legend, THE Question_Section SHALL show, in 14 px #4a4036 at most 560 px wide: "These stay on top of the envelope. When it opens, you answer each one from memory, before a word of the letter is shown. You don't answer them now."
4. THE Question_Rows SHALL be 22 px apart.
5. IF the Write_Check reports the nothing-to-testify problem after the question rows or receipts were touched or the Fold_Button was pressed (spec 11 L1.2), THEN THE Question_Section SHALL show `LIVE_COPY.nothingToTestify` once, under the rows, and the Write_Step SHALL show it nowhere else.
6. WHILE the Question_Section has no Question_Row, THE Question_Section SHALL still show its legend, the W6.3 text and the Suggestion_Pills (W8), and no empty row.

### W7. A question row

**User Story:** As a judge, I want each question to look like a line I can edit and to say when it is answered, so that I know what it is for.

#### Acceptance Criteria

1. EACH Question_Row SHALL be a horizontal flex row with a 16 px gap: the Wax_Disc on the left, the question in the middle and the "Remove" control on the right.
2. THE Wax_Disc SHALL be a 30 px circle in #ff7b1c holding the row number in 13 px weight 800 #0b0912 text, with the inset shadow 0 -2px 0 rgba(0,0,0,.18), and SHALL be `aria-hidden`.
3. THE question input SHALL use EB Garamond italic 21 px in ink #1f1b16 on a transparent background, with an always-visible 1 px bottom border in rgba(31,27,22,.35) that turns solid #1f1b16 on hover and on focus. Its visually hidden label is "Question {n}", and it SHALL grow to show its whole text with no inner scroll bar.
4. EACH Question_Row SHALL show at the right end of its input line a pencil icon and "Edit" in 12 px #4a4036, never overlapping typed text. It is `aria-hidden`, has no Tab stop, and has a pointer target of at least 24×24 CSS px. Clicking or tapping it SHALL focus the input with the caret at the end, and the input's accessible name SHALL stay "Question {n}". AN empty input SHALL show the placeholder "Write a question for opening day…".
5. DIRECTLY under the input, 10 px down, THE Question_Row SHALL show the Lock_Line: a 14 px lock icon and "Answered on opening day, before the letter is shown." in 13 px #4a4036, with no border, no background, no hover style and no focus stop, so that it cannot be mistaken for a text box. The lock icon SHALL be `aria-hidden`, and the input's `aria-describedby` SHALL reference the Lock_Line (and the row's problem message when shown).
6. THE "Remove" control SHALL stay the spec 13 W4 text button, at least 44×44 CSS px, with the accessible name "Remove question {n}", and focus SHALL move as spec 13 W4.3 states.
7. THE question rules of spec 10 C2 stay: at most three questions, at most 200 code points each, no `maxlength`. IF a row is over 200 code points after the row was touched or the Fold_Button was pressed, THEN THE row SHALL show `LIVE_COPY.questionTooLong`, set `aria-invalid="true"` and keep the text. A row that is empty after trim SHALL NOT be sealed, counted in "Questions on top" or given a message.

### W8. Asking another question

**User Story:** As a judge, I want a couple of good questions offered, so that I can add one without thinking up the wording.

#### Acceptance Criteria

1. WHILE fewer than three Question_Rows exist, THE Question_Section SHALL show "Ask another:" in 13 px #4a4036 under the last Question_Row (or under the intro line when there is no row), then up to two Suggestion_Pills, then "+ Write my own". IF fewer than two unused suggestions remain, THEN THE Question_Section SHALL show only the ones that remain, and with none it SHALL show only "+ Write my own".
2. EACH Suggestion_Pill SHALL be at least 40 px tall, fully rounded, with a 1 px rgba(74,64,54,.35) border and EB Garamond italic 17 px text in #1f1b16 prefixed "+ ", for example "+ What were you worried about when you wrote this?". Text that does not fit on one line SHALL wrap inside the pill, and the pill SHALL cause no horizontal scroll at 390 wide. "+ Write my own" SHALL be the same pill in Inter 14 px weight 600.
3. WHEN the author activates a Suggestion_Pill, THE Write_Step SHALL add a Question_Row holding that suggestion's text, SHALL move focus to that row's input, and SHALL treat the row as edited, so a later Occasion pick (W3.3) keeps it.
4. WHEN the author activates "+ Write my own", THE Write_Step SHALL add an empty Question_Row and focus its input.
5. THE suggestions SHALL be recomputed from the current rows on every change. They SHALL be taken in list order from the chosen Occasion's list in `occasions.ts` and then the shared list, SHALL skip any suggestion equal to a row's trimmed text, SHALL each be at most 200 characters, SHALL each contain a Sealing_Day_Anchor, and SHALL contain none of "right now", "today" or "currently" (`tone.md`). Each Occasion's list SHALL hold at least two suggestions.
6. WHILE three Question_Rows exist, THE Question_Section SHALL show "Three is the most a letter holds." in 13 px #4a4036 instead of the pills.
7. THE "+ " prefix SHALL be hidden from assistive technology, each Suggestion_Pill's accessible name SHALL be "Add the question: {text}", and the accessible name of "+ Write my own" SHALL be "Write my own".

### W9. The "In the envelope" card

**User Story:** As a judge, I want to see what goes into the envelope as I write, so that I know when the letter is ready to seal.

#### Acceptance Criteria

1. THE Envelope_Panel SHALL be a column of the In_The_Envelope_Card, the Receipt_Card_Panel and the Fold_Button, 20 px apart. EACH card SHALL have background #15111f, a 1 px #2a2340 border, a 10 px radius and 24 px padding.
2. THE In_The_Envelope_Card SHALL show the eyebrow "In the envelope" (displayed in capitals by CSS) in 12 px weight 600 with letter-spacing .16em in #bdb4dc.
3. THE In_The_Envelope_Card SHALL show a small envelope drawing 150 px tall at the card's full width: paper #f1e4c8 with the closed flap as a darker triangle (#e6d5b2) from the top corners to the middle, and the existing `WaxSeal` at 52 px across where the flap point meets, drawn with no hash (the Blank_Signet of spec 13 U5.1). THE drawing SHALL be `aria-hidden`.
4. THE small envelope's seal SHALL be at 35 % opacity while the Write_Check would fail and at full opacity while it would pass. The result SHALL be recomputed on every draft change, SHALL ignore the figures request status, and SHALL show no message, set no touched state and move no focus.
5. THE In_The_Envelope_Card SHALL show three Checklist_Lines in 14 px, 12 px apart, each with a 20 px circle marker, a label and a #bdb4dc value on the right: "The letter" with "{n} words", "Questions on top" with "{n} of 3", and "A receipt" with "none yet" or the receipt summary, as "Decisions already made" defines them. A question counts when its trimmed text is not empty. An official figure counts when it is chosen. An own number counts only when its name, amount, unit and region are all filled. A receipt chosen in the inactive Receipt_Toggle view still counts.
6. EACH marker SHALL be a filled #ff7b1c circle with a dark ✓ when its item is present, and an empty dashed #6d6488 ring when not. THE marker SHALL be `aria-hidden`, and each Checklist_Line's text SHALL state whether the item is present. An item is present when its value is not "not written yet", "0 of 3" or "none yet". THE Checklist_Lines SHALL NOT be a live region.
7. FOR ALL drafts, THE Checklist_Line values SHALL be computed by one pure function from the letter text, the question rows and the chosen receipts.
8. WHILE the viewport is a Phone, THE In_The_Envelope_Card SHALL show its three Checklist_Lines as one line "{letter} · {questions} · {receipt}". {letter} is "Letter" or "No letter yet". {questions} is "1 question", "{n} questions" or "no questions". {receipt} is "no receipt" or the receipt summary, for example "Letter · 3 questions · no receipt".

### W10. The "Tuck in a receipt" card

**User Story:** As a judge, I want one place to tuck in a receipt, so that I am never shown two ways to add one.

#### Acceptance Criteria

1. THE Receipt_Card_Panel SHALL show a title row with "Tuck in a receipt" (17 px weight 700) on the left and "Optional" (12 px #bdb4dc) on the right, then one line in 14 px #bdb4dc: "A number sealed with its date. When it opens, you guess it first, then see it next to today's."
2. THE Write_Step SHALL show no "Add a receipt" control, no `LIVE_COPY.receiptsSummary` summary, no "Receipts" link or heading, and no second way to add a receipt. The Step_Track label "Receipts" (S1.1) is not affected.
3. THE Receipt_Card_Panel SHALL show the Receipt_Toggle: a #0b0912 pill track with 4 px padding holding two equal 40 px buttons "A public price" and "A number of my own". THE active button SHALL be solid white with #0b0912 text and `aria-pressed="true"`; the inactive one SHALL have #bdb4dc text on transparent and `aria-pressed="false"`. "A public price" SHALL be active at first.
4. WHILE the figures request is loading or has failed, THE public price view SHALL show `LIVE_COPY.receiptsLoading` or `LIVE_COPY.receiptsUnavailable` as a `role="status"` line, THE Own_Number_View SHALL stay usable, and THE Fold_Button SHALL NOT wait for the request (spec 11 X2).
5. WHILE the viewport is a Phone, THE Receipt_Card_Panel SHALL be a native `details`, closed by default, with the summary "Tuck in a receipt (optional)". Inside the `details`, the title row of W10.1 SHALL NOT repeat. The line, the Receipt_Toggle and both views SHALL be the same as at wider widths.
6. WHEN the author switches the Receipt_Toggle, THE Receipt_Card_Panel SHALL keep the figures chosen and the own number typed in the other view, and THE Write_Step SHALL seal both, whichever view is active when the Fold_Button is activated.

### W11. A public price row

**User Story:** As a judge, I want each price as one clear row with its date, so that I can choose without opening anything.

#### Acceptance Criteria

1. THE public price view SHALL show "Choose up to {max}." with {max} the figure limit (`figureLimit`), or "You can choose 1." when the limit is 1, then the Figure_Rows 8 px apart as one list in catalogue order, with no region headings, never sorted or styled by value or direction. IF no series can be offered, THEN THE public price view SHALL show `LIVE_COPY.figuresNoneAvailable` with its link instead of the hint and the list.
2. EACH Figure_Row SHALL be a full-width button at least 56 px tall with an 8 px radius and `aria-pressed`, showing: an 18 px checkbox square on the left; in the middle the Short_Name in 14 px weight 600 (for example "Regular gasoline") and under it the region and period in 12 px #bdb4dc (for example "United States · week of 9 Nov"); on the right the value and unit in 14 px weight 700 (for example "4.00 USD/gal"). The region text SHALL be `LIVE_COPY.regionUs` or `LIVE_COPY.regionEu` for a figure in that region group, otherwise the figure's own region. The figure's own region (for example "EU27, weighted average") SHALL appear in Details and in the row's accessible name. The accessible name SHALL hold the Short_Name, the region, the period, the value and the full unit. The checkbox square SHALL be `aria-hidden`. IF a series has no published value, THEN the row SHALL show the unit with no value.
3. AN unselected Figure_Row SHALL have a #0b0912 background and a 1 px #2a2340 border.
4. A selected Figure_Row SHALL have a 1.5 px white border, the tint rgba(245,243,255,.06) and a white check square with a dark tick, and SHALL NOT use the Accent.
5. A focused Figure_Row SHALL show only the focus ring (the Accent outline with an offset of at least 2 px) and SHALL NOT show the selected border, tint or tick unless it is selected.
6. WHILE the figure limit is reached, EACH unselected Figure_Row SHALL be `aria-disabled="true"`, SHALL ignore activation, and SHALL keep W11.2's text colours. THE public price view SHALL show `LIVE_COPY.figuresTooMany` (or `figuresTooManyOne`) under the list.
7. EACH Figure_Row SHALL show its period next to its value (`data-integrity.md`), SHALL keep the fixture label and the fallback retrieved date of spec 12 K2 where they apply, and the Picker_Note SHALL show once above the list (spec 12 K3). The fixture label SHALL follow the Short_Name. The `LIVE_COPY.pickerRetrieved` date SHALL follow the period on the second line.
8. UNDER the list, THE public price view SHALL show in 12 px #bdb4dc "Sources: {names}." and a "Details" disclosure button with `aria-expanded`, closed by default. {names} SHALL use the short-name table, and a publisher missing from the table SHALL show its source name in full. When open, Details SHALL show for every row, under its Short_Name, the existing source name, series ID, source link and retrieved date, and the `REVEAL_COPY.asPublished` value.

### W12. A number of my own

**User Story:** As a judge, I want to seal a number only I know, clearly marked as mine, so that it is never mistaken for official data.

#### Acceptance Criteria

1. THE Own_Number_View SHALL show labelled inputs, each 44 px tall with an 8 px radius, background #0b0912 and a 1 px #3a3350 border: "What is it?" (placeholder "My rent") on its own row, then "Amount" and "Unit" side by side, then "Where?" (placeholder "My city") on its own row.
2. THE Own_Number_View SHALL show under the inputs "Dated {date}" and "Marked self-reported. Revenant doesn't check it." in 12 px #bdb4dc. {date} SHALL be the same calendar day as the Letter_Sheet's date, written as day, full month and year (for example "17 November 2026").
3. THE Own_Number_View SHALL seal the number with `source = self-reported`, the name, value, unit and region as typed, and as its period the same YYYY-MM-DD sealing day the Write_Check uses for the self-reported period rule, under the existing rules (`LIVE_COPY.selfReportedTextLength`, `selfReportedValue`, `selfReportedMissing`). `LIVE_COPY.selfReportedPeriod` SHALL never show on this view.
4. IF every input of the Own_Number_View is empty or whitespace only, THEN THE Write_Step SHALL seal no own number and SHALL NOT block the Fold_Button (spec 12 W6). IF some but not all of name, amount, unit and region are filled, THEN THE Own_Number_View SHALL show `LIVE_COPY.selfReportedMissing` naming the empty ones, and the Write_Check SHALL fail.
5. THE Own_Number_View SHALL draw no vertical rule, pseudo-element bar or border beside any of its controls other than the inputs' own borders.
6. THE Own_Number_View SHALL hold exactly one own number and SHALL show no `LIVE_COPY.selfReportedAdd`, `selfReportedRemove` or `selfReportedLimit` control or line.

### W13. The Fold_Button

**User Story:** As a judge, I want one clear button that folds the letter and moves to the seal, so that I know what comes next.

#### Acceptance Criteria

1. THE Envelope_Panel SHALL end with the Fold_Button: a full-width 56 px pill, solid #ff7b1c, with #0b0912 16 px weight 800 text "Fold it and press the seal" and a right arrow that is `aria-hidden`. WHEN the pointer hovers the Fold_Button, its fill SHALL be #ff8f3d.
2. WHEN the author activates the Fold_Button and the Write_Check passes, THE Live_Stepper SHALL move to the Seal_Step. The Write_Check SHALL be the same validation today's Write-step Next runs, and SHALL NOT wait for the figures request.
3. IF the Write_Check fails, THEN THE Write_Step SHALL show each failing field's message at that field and SHALL show one line under the Fold_Button: "Check the note above, then try again." It SHALL move focus to the first failing field in page order: the Letter_Field, then the Question_Rows, then the receipt fields. A nothing-to-testify failure focuses the first Question_Row input, or "+ Write my own" when there is no row. IF the failing field is in the inactive Receipt_Toggle view or the closed phone `details`, THEN THE Write_Step SHALL first switch to that view or open the `details`. THE summary line SHALL go away once the Write_Check passes. No draft text SHALL be lost.
4. UNDER the Fold_Button, THE Write_Step SHALL show the Rehearsal_Line (`LIVE_COPY.rehearsalLine`), centred in 13 px #bdb4dc, exactly once on the step (spec 13 W5.2).
5. THE Fold_Button SHALL be the only button on the Write_Step with an Accent fill or border. The Accent focus ring on other controls is allowed (G1.6).

### Group T. Testify

### T1. The questions come back as they were written

**User Story:** As a judge opening my own letter, I want my questions to come back looking the way I wrote them, so that Testify feels like the same letter.

#### Acceptance Criteria

1. THE Recall_Pager SHALL show one question at a time, and T1.2 to T1.6 SHALL apply to every text question (`answer_type` "text") it shows on `/demo/live`, `/l/[id]` and a Persona_Letter. Number questions follow T2.
2. ABOVE the question, THE Recall_Pager SHALL show one small line: "Question {n} of {total} · you wrote this on {date}" for a Live_Letter or a real letter, with `{date}` from `Opened.header.sealedAt` as a calendar date in the reader's time zone; and "Question {n} of {total} · as of {date}" for a Persona_Letter. The live and real counter string SHALL be a new `REVEAL_COPY` key. `REVEAL_COPY.questionCounterAsOf` SHALL stay byte-identical. `{total}` SHALL count every sealed question, text and number.
3. THE question `h2` SHALL show the Wax_Disc (30 px, #ff7b1c, number = the counter's {n} in 13 px weight 800 #0b0912, inset shadow 0 -2px 0 rgba(0,0,0,.18), `aria-hidden`) 16 px left of the question text. The text SHALL be EB Garamond italic 26 px, exactly as sealed, never truncated, and SHALL meet G1.7. The heading's accessible name SHALL equal the question text.
4. WHEN a text question appears, THE Recall_Pager SHALL show the Answer_Field directly under the question with the visible label "Your answer, from memory" (a new `REVEAL_COPY` key). The field's accessible name SHALL be the question text followed by that label, and the field SHALL receive focus. IF "No answer" is checked, THEN the "No answer" checkbox SHALL receive focus instead.
5. UNDER the Answer_Field, in this order, THE Recall_Pager SHALL show the character count (`REVEAL_COPY.textCount`) and any `textAnswerInvalid` message, then "No answer", then the Nav_Row. The Nav_Row has "Previous question" on the left from question 2 on and the main button ("Next question", or `REVEAL_COPY.submit` / `submitting` on the last question) right-aligned on every question, including question 1. `REVEAL_COPY.submitFailed` SHALL show directly under the Nav_Row.
6. AT 390×844, THE question, the Answer_Field and the Nav_Row's main button of a text question SHALL lie inside the First_Viewport, including a 200-character question, with and without `prefers-reduced-motion: reduce`.
7. THE persona text answers (`RecallReader`) SHALL use the same counter line, Wax_Disc and question type, and SHALL keep their fictional label on every screen (spec 11 P1.7). `RecallReader` SHALL NOT show the "Your answer, from memory" label. Her answers keep their fictional label instead.
8. THE Recall_Pager SHALL keep its rules from specs 07, 10 and 11: no figure, period, source or hint, focus on the field, the record stored before anything else is shown, and the existing validation messages.

### T2. Number questions keep one order

**User Story:** As a judge on a persona's fuel question, I want the controls in a steady order, so that the next button is where I expect it.

#### Acceptance Criteria

1. FOR every number question, THE Recall_Pager SHALL show, in this order: the counter line, the question, the intro (`recallHint` or `recallIntro`, first question only), the unit, the rescale note where one applies, the Answer_Field, the readings choice, `numberUnreadable` and `answerInvalid`, the Recall_Scale, the Sample_Note where it applies, "No answer", and the Nav_Row.
2. THE Nav_Row SHALL be the same component as in T1.5, with "Previous question" on the left from question 2 on and the main button on the right.
3. THE Recall_Pager SHALL NOT show the `CEREMONY_COPY.parsedValue` line, and SHALL drop its id from the field's `aria-describedby`. WHEN the field resolves to a value, THE Recall_Scale's label SHALL show that value (`answerText`). WHILE the field is ambiguous with no reading picked, or unreadable, THE scale label SHALL show no value and the readings choice or the unreadable message SHALL show.
4. THE Sample_Note rules of spec 10 C5.5 stay, and no wording SHALL call a sample or an answer right, close, near, wrong, off or accurate.
5. THE number question's main button SHALL move from the answer row to the Nav_Row, replacing spec 10 C1.5 (typed number and Next in one row) for this spec. AT 390×844, THE counter, question, Answer_Field and the Nav_Row's main button of every persona number question, with its Sample_Note shown, SHALL lie inside the First_Viewport.

### T3. A sensible scale for every unit

**User Story:** As a judge, I want the scale to fit the price I am asked about, so that I can mark it.

#### Acceptance Criteria

1. FOR every number question unit that `/demo/live` can seal and every unit sealed in a persona letter, `scaleRangeFor(displayUnitFor(unit))` SHALL return a `UNIT_RANGE_TABLE` entry, not `FALLBACK_RANGE`, and lookup SHALL stay exact.
2. THE `UNIT_RANGE_TABLE` SHALL gain a literal entry, keyed by the exact displayed string, for every displayed unit the Q2.10 test finds missing.
3. THE ranges SHALL stay literal constants and SHALL NOT be computed from any figure, answer or now figure (spec 08).
4. THE `FALLBACK_RANGE` SHALL stay for a displayed unit with no entry.
5. A test SHALL check that every bundled real figure value and every persona sealed figure value, in its displayed unit, lies within its unit's literal `min` to `max`.

### Group R. The persona Read step and the receipts

### R1. The Read step uses the page

**User Story:** As a judge reading a persona letter at 1440 wide, I want the letter in the middle of the page, so that it does not sit squeezed in a left column.

#### Acceptance Criteria

1. THE first R task SHALL name the CSS rule that holds the persona Read step in a column of about 440 px at 1440×900.
2. AT 900 px and wider, THE persona Read step SHALL centre the letter column in the Scene_Frame, with the centre of the column within 8 CSS px of the centre of the frame, and the column at least 600 CSS px wide at 1440×900. Below 900 px THE column SHALL keep today's width rules (spec 08 R3.3). The ghost leaving SHALL NOT shift the column's position by more than 1 CSS px.
3. THE Ghost SHALL leave on the Read step as today (`tone.md`: the ghost delivers the letter and leaves).

### R2. Creases stay off the text

**User Story:** As a judge, I want to read every line, so that no decoration cuts through the letter.

#### Acceptance Criteria

1. THE crease marks SHALL be drawn only inside the paper's left and right padding boxes, at 1/3 and 2/3 of the paper height. IF a padding box is narrower than 8 CSS px, THEN no crease mark SHALL be drawn in it.
2. AT both Evidence_Sizes, THE bounding box of every crease mark SHALL NOT intersect the bounding box of any line of letter text.

### R3. The two actions after reading

**User Story:** As a judge, I want the next step to look like a button I can press, so that I do not think it is disabled.

#### Acceptance Criteria

1. THE "See the receipts" control (`REVEAL_COPY.stage2Next`) SHALL use the shared primary button style: solid #ff7b1c with #0b0912 text, at least 44 px tall.
2. THE "Show everything" control (`REVEAL_COPY.showAll`) SHALL be an outlined button with a transparent background, #ffffff text and a 1 px border with at least 3:1 contrast against the surface it sits on, never orange.
3. BOTH controls SHALL meet G1.7, and each SHALL perform the same action as on `main` (`stage2Next` moves to the receipts Stage; `showAll` shows every Stage in its final state).

### R4. The formula sits under the source

**User Story:** As a judge, I want the change sentence short and the formula close to the source, so that the receipt reads easily and still shows how the change was made.

#### Acceptance Criteria

1. THE change line SHALL show only the fixture label where it applies, the direction word, the difference, the percentage when defined, the two periods joined by `periodRange`, and the rescale note where it applies. It SHALL NOT show the formula.
2. THE Formula_Line SHALL be the next sibling after the Source control (the `details` with `REVEAL_COPY.sourceSummary`), outside it, visible whether it is open or closed. It SHALL end with one `REVEAL_COPY.checkAtSource` link per distinct `source_url` of the two inputs, or show the series ID where no `source_url` was sealed.

### R5. The change matches the values shown

**User Story:** As a judge, I want the change to have the same precision as the numbers beside it, so that it does not show digits the numbers do not.

#### Acceptance Criteria

1. THE then-vs-now difference SHALL be computed from the full-precision values in `src/lib/figures` as today.
2. THE displayed difference SHALL have the same number of fraction digits as the then and now values shown: the unit's Display_Precision where one exists, otherwise the larger fraction-digit count of the two displayed values, after any display rescale. The percentage SHALL keep one fraction digit and SHALL be absent when the then value is 0.
3. FOR ALL then and now values, THE direction word and sign SHALL come from the exact difference. An exact difference of 0 SHALL show "unchanged" with no sign. A non-zero difference that rounds to zero SHALL keep the exact sign (for example "+0.00" with "rose"). The same rule SHALL apply to the percentage.
4. THE Formula_Line SHALL show the inputs at full sealed precision (after any display rescale), then " = " and the result exactly as displayed: "({now} - {then}) / {then} x 100 = {percent}", or "{now} - {then} = {difference}" when there is no percentage.

### R6. Number line labels do not overlap

**User Story:** As a judge, I want the labels on the number line apart, so that I can read my answer and "Then".

#### Acceptance Criteria

1. FOR ALL then, now and answer positions and label widths, including no answer (two labels) and coincident points, THE rendered label boxes SHALL NOT intersect, SHALL keep at least `LINE_LABEL_GAP_PX` between boxes in one row, and SHALL lie within the Number_Line's horizontal bounds. This SHALL be checked by a fast-check property on `placeLineLabels` and by `layout-check` on every persona and one live letter at the Evidence_Sizes, after web fonts load.
2. THE label placement SHALL stay in `line-labels.ts` as a pure function.

### R7. The same period says so

**User Story:** As a judge opening a 30-second letter, I want to be told why nothing changed, so that I do not read "unchanged 0.000" as a finding.

#### Acceptance Criteria

1. IF the then and now figures are a Same_Figure (equal source, series_id, unit, region, period and exact value) on a Live_Letter or real letter, THEN THE Receipt_Card SHALL show the then and now rows, the Number_Line as on a compared card, and the Same_Period_Line, and SHALL NOT show the change line, the Formula_Line or `REVEAL_COPY.nothingToCompare`. This replaces spec 12 Z2's Single_Figure_View for these cards. A same-period pair with different values (a revision) SHALL keep the not-comparable card.
2. THE Same_Period_Line SHALL read "Same week as when you sealed it. A letter kept for months would show the change." when the sealed period is written YYYY-MM-DD, "Same month as when you sealed it. A letter kept for months would show the change." when it is written YYYY-MM, and "Same period as when you sealed it. A letter kept for months would show the change." otherwise. The period type SHALL be read from the sealed period string (YYYY-MM-DD is a week, YYYY-MM is a month, anything else is a period), never from the catalogue.
3. THE Receipt_Card SHALL still show the then and now figures, each with its period and source.
4. FOR ALL receipts, THE change line SHALL be shown if and only if the then and now figures are comparable (`data-integrity.md`) and are not a Same_Figure.

### Group B. The Top_Bar and the Scene

### B1. One fixed Top_Bar

**User Story:** As a judge, I want the top bar controls to stay where they are, so that I can find Calm, sound and Skip without hunting.

#### Acceptance Criteria

1. THE Top_Bar SHALL use fixed Top_Bar_Slots on every Scene page, in this order from left to right: the wordmark, the Demo chip (where the page shows it), the persona notice (on a persona page only), then Calm, sound (only on a page with a sound cue) and Skip. A page whose Top_Bar has `controls="none"` (`/l/[id]`) SHALL keep showing no Calm, sound or Skip in the Top_Bar.
2. FOR every pair of Stages of a persona page, and every pair of steps of `/demo/live`, at the same viewport size (each Evidence_Size and 360×640) and the same Calm_Mode and sound state, THE left x position and the width of the wordmark, the Demo chip, the notice, Calm, sound and Skip SHALL each be equal within 1 CSS px, and the Top_Bar height SHALL be equal within 1 CSS px, including when Skip changes between enabled and disabled.
3. THE Skip control SHALL always be rendered in its slot, with the accessible name `CEREMONY_COPY.skip`. WHILE a sequence runs, Skip SHALL be enabled, in the Tab order, and SHALL work with Enter and Space (spec 07 R8.6). WHILE no sequence runs, Skip SHALL be a native `disabled` button, out of the Tab order, with the same box and label at 40 % opacity. As an inactive control it is exempt from G1.7.
4. ON a persona page, THE persona notice (`personaNoticeText`) SHALL be in the Top_Bar on every Stage and at every width, and SHALL be the only element on the page whose text equals it. TestifyContext and PersonaIntro SHALL NOT render it. THE fictional label on the persona's pre-written answers (spec 11 P1.7, T1.7) is not the notice and SHALL stay.
5. ON a persona page, THE Top_Bar SHALL be at most 96 CSS px tall at 360×640 and 390×844 with the notice wrapped and Skip shown. This replaces spec 09 P5.1 (56 px) and P5.3 (notice in Persona_Intro) on the persona page only. Every other page SHALL keep spec 09 P5.1 (at most 56 CSS px at the Phone_Sizes). THE Top_Bar SHALL keep spec 07 R8.4 and R8.14.

### B2. Decoration stays out from behind text

**User Story:** As a reader, I want text on a clean surface, so that the soil and glow never sit behind words.

#### Acceptance Criteria

1. AT both Evidence_Sizes, with the page scrolled to its top, to half its maximum scroll offset and to its end, THE bounding box of the soil strip (`[data-soil-strip]`) and the box from the highest drawn Soil_Canvas row to the canvas bottom SHALL NOT intersect the bounding box of any visible text element on `/`, `/demo`, every step of `/demo/live` before the reveal, every persona page Stage and `/l/[id]`. A visible text element has a non-whitespace text node and is neither `aria-hidden` nor visually hidden. Text on an opaque panel that covers the Soil_Band does not count (the F2 rule). A Soil_Band that has computed opacity 0 or is not displayed counts as absent.
2. THE fix SHALL keep the Soil_Band `aria-hidden`, with its colours, jagged edge and motion unchanged, and SHALL change only its position or size.

### Group X. Smaller fixes

### X1. Wording fixes

**User Story:** As a judge, I want plain, current wording, so that nothing refers to a name I was never told.

#### Acceptance Criteria

1. `LIVE_COPY.busyBody` SHALL read "The live demo is busy right now. Nothing was sealed. Try again later." wherever `SealFailure` renders it, including `/seal`.
2. `LIVE_COPY.figuresHint` SHALL read "Choose up to {max}." and `LIVE_COPY.figuresHintOne` SHALL read "You can choose 1."
3. `PRESS_COPY.chooseFirst` SHALL read "Choose a backup option first." and `LIVE_COPY.backupChoiceLegend` SHALL read "If you lose this passkey". The legend changes on `/seal` too, because `BackupChoice` renders there; the `/seal` markup is unchanged.
4. `LIVE_COPY.occasionLabels.blank` SHALL read "A blank page" on `/demo/live` and on `/seal`, which shares `OccasionPicker`.
5. WHEN `WriteForm` renders in section `write` or `seal`, its markup SHALL contain none of `LIVE_COPY.receiptsAction`, `receiptsSummary`, `answerInLetter`, `authorQuestionAdd`, `occasionLegend` or `passkeySteps`. WHEN it renders in section `all` (`/seal`), it SHALL still contain every one of these keys it rendered at `ba2cd6c`, including `passkeySteps` unchanged, because `/seal` still asks for a button press before each prompt.
6. THE rendered Our_Copy of every `/demo/live` step and of `/demo` SHALL contain neither "Demo 1" nor "Demo 2".

### X2. The receipts defects are gone

**User Story:** As a judge, I want the receipt controls to behave, so that pressing twice or tabbing in does not confuse me.

#### Acceptance Criteria

1. WHEN the author activates any button or link on the Write_Step twice in a row, THE second activation SHALL change the page's markup or focus, unless the control shows its result through `aria-pressed`, `aria-expanded` or a checked state.
2. WHEN keyboard focus lands on an unselected Figure_Row, THE Figure_Row SHALL look unselected apart from the focus ring (W11.5).
3. THE first X task SHALL reproduce the stray vertical bar on `/seal`, which still renders `SelfReportedRows`, at the task's starting commit, and SHALL name the element and the CSS rule behind it. IF the cause is shared CSS, THEN THE first X task SHALL fix it there. THE first X task SHALL confirm that the new Own_Number_View meets W12.5.

### Group D. `/demo` and `/how-it-is-sealed` (cut first)

### D1. The /demo page lines up and offers the live demo plainly

**User Story:** As a judge on `/demo`, I want the page to line up and the live demo to look like a choice, so that I see both demos.

#### Acceptance Criteria

1. AT both Evidence_Sizes, THE left edges of the `DemoLabel`, the `h1`, the intro note, the persona list and the `LiveEntry` card SHALL each equal the left edge of `[data-wordmark]` within 1 CSS px (spec 07 R8.14).
2. THE `LiveEntry` SHALL be the last card after the persona cards. At 1440×900 it SHALL be as wide as one persona card, within 1 CSS px. At 390×844 it SHALL be full width. Its background, border, radius and padding SHALL match the computed style of the persona card's paper. It SHALL show `DEMO_COPY.liveEntryHeading`, then `liveEntryBody`, then `liveEntryLink`. `liveEntryLink` SHALL be an `a` element to `/demo/live` that has the same computed background, text colour, height and radius as the persona card's orange button and works with JavaScript off. The card SHALL have no envelope drawing and no wax seal.
3. AFTER `npm run build`, THE `/demo` route SHALL stay at or under 160 kB in `scripts/check-js-budget.mjs`. At 390 and 1440 wide, `/demo` SHALL have `scrollWidth` no more than `clientWidth` + 1 px, the `checkHorizontalScroll` rule.

### D2. /how-it-is-sealed carries the Demo chip

**User Story:** As a judge, I want the same Demo chip on every demo page, so that I know where I am.

#### Acceptance Criteria

1. THE `/how-it-is-sealed` page SHALL render its SceneShell with `demo` true, so its Top_Bar shows `SCENE_COPY.demoChip` in the B1.1 slot. The page SHALL gain no backdrop, Soil_Band or Ghost.

### Group Q. Verification

### Q1. Layout rows and the Final_Walk

**User Story:** As the owner, I want browser checks of every new rule and a final walk on `main`, so that I know it works before the judges do.

#### Acceptance Criteria

1. THE `tools/qa/layout-check.mjs` SHALL gain one row per rule that needs a browser, each named after its requirement: S1, S2.2, S2.3, S3.1, S3.4, S6.1, S6.4 to S6.8, W1 to W13 (sizes, colours, fonts, order, sticky panel, no horizontal scroll), T1.6, T2.1, T2.5, R1.2, R2.2, R3, R6.1, B1.2, B1.4, B1.5, B2.1, X2.1, and D1.1 to D1.3 if group D merged.
2. THE checks that assert rules this spec replaces SHALL be retired or changed in the same task, each with its reason. In `layout-check.mjs`: the spec 13 `wFailures` column and paper widths, Occasion heights, receipt row heights, PH4's 56 px limit on the persona page (now B1.5), and F3.4's notice count (now text equal to `personaNoticeText`). In `live-walk.test.ts` and `live-walk-helpers.ts`: the "Add a receipt" click, the Receipts_Disclosure own-number read, the lost-passkey checkbox (now the "Skip it" Backup_Card), the Write-step "Next" (now the Fold_Button), and `STEP_INDICATOR_EXPECTATIONS` "See the receipts" (now "Receipts"). The `[data-live-stepper] [data-step-indicator] [aria-current='step']` hook SHALL keep working on the Step_Track.
3. THE Live_Walk SHALL run both variants (one figure, no figure) at both Evidence_Sizes, with and without reduced motion. It SHALL cover: picking an Occasion (letter text unchanged); adding a suggested question; "+ Write my own"; opening the phone `details` at 390; tucking in a public price (one-figure variant); typing an own number; a failed fold (focus on the first failing field, one summary line); a passing fold; the Seal_Step before and after choosing "Skip it" and confirming, with the S6.7 Press_Status_Line text for the motion setting; "← Back to the letter" with the draft kept; the press; the Wait step; Testify of a text question and, in the one-figure variant, a number question; the receipts with the Same_Period_Line; and the persona Read step.
4. THE Live_Walk SHALL fail on: an empty Press_Status_Line, or one that differs from S6.7 for its state, before the letter is stored; the Press_Envelope intersecting the text column at 1440; the Step_Track under the Top_Bar after a step change; a Top_Bar control that moves between steps (B1.2); an orange Figure_Row; a second orange button on the Write_Step or the Seal_Step; a Testify counter without "you wrote this on" on a Live_Letter; a horizontal scroll (`checkHorizontalScroll`); clipped text (`checkClippedText`); a console error (`checkConsoleErrors`).
5. THE Final_Walk SHALL be report-only: it SHALL run `npm run live-walk` and `npm run layout-check` on merged `main`, and SHALL record the commit SHA and every result line in a commit message body (G2.9). QA SHALL pass the Final_Walk when its run record matches a rerun on the same SHA. Any FAIL lines SHALL stay in the record for the owner. The Final_Walk task SHALL fix no product files.
6. BEFORE the Final_Walk, THE Fix_Up_Task (task 19, one frontend-dev task, depending on the layout-row and Live_Walk tasks) SHALL start Postgres with `docker run`, run the migrations, seal the personas, build and start the app, run `npm run layout-check` and `npm run live-walk`, and fix product code until both pass. THE Fix_Up_Task SHALL NOT edit a layout-check row, a threshold or a Live_Walk step. IF nothing fails, THEN THE Fix_Up_Task SHALL make one empty commit whose message body quotes the passing result lines. IF a row itself is wrong, THEN THE Fix_Up_Task SHALL say so in its commit notes and leave the row unchanged.
7. THE layout-row and Live_Walk tasks SHALL list every product failure their new rows or walk steps find in their commit notes under the heading "For task 19". A product failure SHALL NOT fail their QA; only a broken row or a broken walk script SHALL.

### Q2. Property and source tests

**User Story:** As the owner, I want the new rules pinned by tests, so that a later change cannot break them silently.

#### Acceptance Criteria

1. THE tests SHALL include a property that, for any letter text and any sequence of Occasion picks, the letter text is unchanged and only unedited question rows change (W3.3, W3.4).
2. THE tests SHALL include a property that the Checklist_Line function returns the word count, the non-empty question count and the receipt summary defined in "Decisions already made", for any draft (W9.5, W9.7).
3. THE tests SHALL include a property that the small envelope's seal is at full opacity if and only if the Write_Check passes, for any draft (W9.4).
4. THE tests SHALL include an example test over every suggestion and placeholder in `occasions.ts` that each suggestion contains a Sealing_Day_Anchor, none contains "right now", "today" or "currently", and each placeholder has at most 12 words (W8.5, W5.4).
5. THE tests SHALL include a property that the Step_Track marks exactly one step current, every earlier step done and every later step future (S1.3).
6. THE tests SHALL include a property that, for every seal state before the letter is stored, every Backup_Choice value (none, download, skip) and every motion setting (full, reduced, Calm_Mode), the Press_Status_Line text is non-empty and equals the S6.7 line for that combination (S6.6, S6.7).
7. THE tests SHALL include a property that the displayed difference has as many fraction digits as the displayed then and now values, that its sign equals the sign of the exact difference, and that a displayed zero carries no sign (R5.2, R5.3).
8. THE tests SHALL include a property that the change line is shown if and only if the figures are comparable and are not a Same_Figure (R7.1, R7.4).
9. THE tests SHALL include a property that the Number_Line label boxes from `line-labels.ts` never intersect (R6.1).
10. THE tests SHALL include an example test that every displayed catalogue unit has an entry in `UNIT_RANGE_TABLE`, and a source scan that `unit-ranges.ts` reads no figure value (T3.1 to T3.3).
11. THE tests SHALL include a markup test that, for every Stage and for the pages `/`, `/demo`, `/demo/live` and `/how-it-is-sealed`: the Top_Bar renders the B1.1 slots in order, with Skip present and `disabled` when no sequence runs; the persona page renders `personaNoticeText` exactly once, and never inside TestifyContext or PersonaIntro; `/l/[id]` renders no Top_Bar controls; and `/how-it-is-sealed` renders the Demo chip and no backdrop (B1.1, B1.3, B1.4, D2.1).
12. THE tests SHALL include an example test that `busyBody`, `figuresHint`, `figuresHintOne`, `chooseFirst`, `backupChoiceLegend` and `occasionLabels.blank` equal their X1.1 to X1.4 strings exactly, that the `write` and `seal` sections render none of the X1.5 keys while section `all` still renders them, and that no Our_Copy string on `/demo/live` or `/demo` contains "Demo 1" or "Demo 2" (X1).
