# Implementation Plan: 05 Reveal ceremony

Each task is one GitHub issue, worked by `frontend-dev`, and leaves `main` passing the CI gate. Each PR stays under 2,500 changed lines as `.github/agents.json` counts them (`package-lock.json` and `drizzle/meta/**` excluded) and inside `frontend-dev`'s paths plus `shared`. Validation always includes the CI gate; the command in each task is what the agent runs locally first.

"Before this task" lists work from other specs that must be on `main` first; the owner holds those. Every task carries "Blocked by #49" there, because #49 built the reveal stages this spec reworks. "Depends on" lists only tasks in this spec. They form a straight chain, each task depending on the one before it (see the graph at the end), so only one spec 05 PR is open at a time.

Follow `design.md` in this folder for every file name, constant, interface and algorithm, and `requirements.md` for the rules. Follow `tone.md`, `neutrality.md` and `data-integrity.md`.

## Rules for every task

- **Boundaries (R1).** Do not change `src/app/api/**`, `src/lib/crypto/**` (including `demo-key.ts`), `src/lib/seal-format/**`, `src/lib/letter-store/**`, `src/lib/db/**`, `src/lib/recall/**`, `opening-machine.ts`, `useOpeningFlow.ts` or `api.ts`. Send only events that already exist. `opening-machine.test.ts` and `opening-machine.property.test.ts` pass unchanged except for the clauses a task adds.
- **Paths that match your globs but are not yours.** Do not edit `src/app/layout.tsx`, `src/app/page.tsx` or `src/app/globals.css`. They match `frontend-dev`'s globs (`src/app/**/*.tsx`, `src/app/**/*.css`), so the PR check will not catch it. Check your own diff for them before you open the PR. Also leave `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**`, `tools/**` and `public/**` alone. Ceremony tokens and rules go in CSS modules under `src/components/ceremony/` and the demo pages' own CSS modules.
- **No new dependency** in `package.json` (R1.4). If you think you need one, stop and ask the owner.
- **Final state first.** Every animated view renders its settled final state on first render. Motion starts in a layout effect on the client, in full motion only. The static render must hold every label and number (design, "Final state first").
- **Each sequence ships with** its Skip control, its Calm_Mode path and its button equivalent (R11.1, R11.4, R18.5).
- **No sound and no vibration** before task 10 (R18.6).
- **Copy** goes in `src/components/ceremony/copy.ts` (R16), with no string literals in components.
- **Assets** are original or CC0, each with an entry in `src/components/ceremony/ASSETS.md` (R15). Prefer CSS and inline SVG.
- **The PR description states** (R18.8):
  - the three values printed by `node scripts/check-js-budget.mjs` after `npm run build`;
  - screenshots of the Stages the task builds, taken with the QA steps listed in the task;
  - every asset added, with its `ASSETS.md` entry (or "none").
- **QA steps** are numbered as in design.md, "QA browser steps". Stages that later tasks build being missing, or still in their spec 03 look on the new surface, is expected and is not a finding (R18.10).
- If the task changes a spec 03 test, the PR description names each test changed and why.

## Tasks

- [x] 1. Scene base on the persona page
  - Agent: `frontend-dev` · Depends on: none · Estimated size: ~1,950 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/constants.ts`, `stages.ts`, `motion.ts`, `skip.tsx`, `LiveRegion.tsx`, `CeremonyRoot.tsx`, `copy.ts`, `ceremony.module.css`, `ASSETS.md`, `desk/DeskScene.tsx`, `desk/DeskScene.module.css`, `desk/useLight.ts`, `src/components/reveal/OpeningFlow.tsx`, `src/app/demo/personas/[key]/page.tsx`, the scan tests in `src/components/reveal` and `src/components/demo`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `constants.ts` holds every value in design.md "Constants", with no import and no value computed from data. `POSITION_PROPERTIES` is `["--pos-mark", "--pos-then", "--pos-now"]`.
    - `stages.ts` exports `Stage`, `LocalView` and `stageFor` per design.md "Stage resolution". The default local view is `{ sealing: false, step: "done" }`.
    - `motion.ts` exports `MotionProvider` and `useMotion()` with modes `full`, `light` and `calm`. `calm` follows `prefers-reduced-motion` or the judge's Calm control. The server render and first client render use `full` and the final state. Settings live in memory only (R1.5).
    - `CeremonyRoot` replaces the `div` in `OpeningFlow` with the same `role="region"`, `aria-label`, `tabIndex={-1}` and focus-on-`state.tag` effect, and adds `data-ceremony` (from `stageFor`) and `data-ceremony-motion`. A polite live region announces the new Stage. A visible Calm control switches mode. A Skip control renders only while a sequence is registered through `useSequence()`; none is registered yet.
    - `OpeningFlow` gains the optional `persona` prop (`key`, `written_as_of`, `opens_at`) and the persona page passes it from the Persona_List. `letterId` still comes only from the list (spec 03 R16.5).
    - `DeskScene` replaces `PageShell` on the persona page: a dark desk drawn with CSS gradients, one candle light layer (opacity swing at most `CANDLE_FLICKER_AMPLITUDE`, no step changes), pointer-driven light and parallax up to `PARALLAX_MAX_DEG` and `PARALLAX_MAX_PX`. No dust and no tilt yet. Without JavaScript the page shows the static desk. The Demo label stays visible without scrolling at 360 by 640 and meets AA.
    - Every view stays its spec 03 view, on a `ParchmentSurface` over the desk. Error states set `data-ceremony="error"`.
    - `ceremony.module.css` holds the desk tokens from design.md "Colour and contrast" and the focus rings. `ASSETS.md` exists with its header and no entries unless an asset file is added.
    - Tests: Property 1 (every Flow state maps to one Stage); Property 22 (contrast of every desk and paper token pair, focus rings at 3:1); Property 23 (every asset file is listed, licence `original` or `CC0`, at most 150 kB); the scan tests (`no-jsx-text`, `copy`, `source-scan`, `import-boundary`) extended to `src/components/ceremony`; a source scan that bans `Math.random` and `Date.now` in render code under `ceremony/`; a test that nothing under `ceremony/` imports `@/lib/crypto` statically.
  - Spec 03 tests changed: the scan tests above get `src/components/ceremony` added to their file walks (additions only). `src/app/demo/personas/[key]/page.test.tsx` may need updating if it asserts the `PageShell` markup; change only that.
  - QA steps: 03, 04, 05, 08, 11, 13, 16 (check `data-ceremony` takes the names in R3.1 at each state, with the spec 03 view inside), 18 (the Calm control sets `data-ceremony-motion="calm"` and the page still works), 20, 21. Before task 2 merges the card link still reads "Break the seal"; use it by that name.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1, R3.1–R3.3, R3.8, R10.3, R10.5, R11.2, R11.3, R11.5–R11.8, R13.1, R13.4–R13.7, R15, R16, R17.3_

- [ ] 2. Envelope, checking views and the card and loading wording
  - Agent: `frontend-dev` · Depends on: 1 · Estimated size: ~1,650 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/envelope/**`, `src/components/ceremony/copy.ts`, `src/components/reveal/OpeningFlow.tsx`, `src/components/reveal/copy.ts`, `src/components/demo/copy.ts`, `src/components/demo/PersonaCard.tsx`, `src/components/demo/PersonaCard.test.tsx`, `src/app/demo/page.test.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `Envelope` (SVG, states `closed`, `turned`, `open`), `WaxSeal`, `sealPattern(key)` (FNV-1a into mulberry32, 8 rim styles, 12 centre glyphs, 15° rotations, one wax colour) and `EnvelopeView` per design.md "Envelope and seal".
    - The `envelope` Stage covers `loading`, `openable` and `verifying` (statement in `role="status"`) and `sealed` (opening date, time remaining, "Try again" at zero, nothing about the contents). The `intact` Stage shows the seal-is-intact statement before any question and the control that sends `BEGIN`; the envelope turns over only after `BEGIN`.
    - The envelope shows "Written as of", the opening date and "Prepared later as a demo" from the list fields. It never shows `sealedAt` and never says sealed on a persona date (R3.7). Its size, folds and markup do not depend on the letter (R3.6). It is drawn at `ENVELOPE_TARGET`.
    - R2: `breakSeal` becomes `openLetter` with the text "Pick up the letter" in `components/demo/copy.ts`; `loading` becomes "Bringing the letter into the light." in `components/reveal/copy.ts`. `PersonaCard.tsx`, its test, `src/app/demo/page.test.tsx` and the `OpeningFlow.tsx` comment follow. The tests check the new strings and that "Break the seal" appears nowhere in the Demo_Index or on a card. Do not edit `src/lib/crypto/demo-key.ts`.
    - Tests: Property 3 (the envelope is the same for every letter); Property 4 (a seal's pattern depends only on the key); Property 2's envelope clauses (no Mark, no recall question, no letter before their Stage).
  - Spec 03 tests changed: `PersonaCard.test.tsx` and `src/app/demo/page.test.tsx` (new key and link text, "Break the seal" absent); `OpeningFlow.test.tsx` only if it names the old loading wording in a test title.
  - QA steps: 03, 04, 05, 19, 20, 22 (`envelope` and `intact` at 360 px).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R2, R3.1, R3.6, R3.7, R5, R8.4, R10.7, R16_

- [ ] 3. Seal_Break and the marks Stage
  - Agent: `frontend-dev` · Depends on: 2 · Estimated size: ~1,500 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/seal/**`, `src/components/ceremony/copy.ts`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/copy.ts`, `src/components/ui/ParchmentSurface.module.css`, `src/components/ceremony/ceremony.module.css`, `src/components/ceremony/CeremonyRoot.tsx`, `src/components/ceremony/desk/DeskScene.module.css`, `src/components/ceremony/desk/DeskScene.tsx`, `src/components/demo/DemoLabel.module.css`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `hold.ts` (pure hold model), `cracks.ts` (nine fixed paths from the seal's centre, in a fixed draw order) and `SealBreak.tsx` per design.md "Seal_Break".
    - Reveal stage 1 shows the existing answers as plain text (the `marks` Stage), the unbroken seal, the instruction line and the "Break the seal" button. It replaces the `stage1Next` button. The `stage1Next` key is removed from `reveal/copy.ts` with its test. "Show everything" stays.
    - A hold of `SEAL_HOLD_MS` or the button sends `ADVANCE` exactly once. An early release settles the cracks back over `SEAL_SETTLE_MS` and sends nothing. The Stage is `seal` while sealing and `marks` otherwise. On break: seal split with `FLAKE_COUNT` flakes on fixed paths, the flap lifts, the letter slides out and `ADVANCE` was sent when the split started.
    - Skip is visible during the Seal_Break and goes to the end state, sending `ADVANCE` once if not yet sent. "Show everything" shows the seal already split and sends `SHOW_ALL`. In Calm_Mode the button shows the split seal at once.
    - `setPointerCapture` is called inside a `try`; if it throws, the hold continues with listeners on the window.
    - The crack paths do not depend on the contact point, the persona or any data. No vibration.
    - Tests: Property 5 (exactly one `ADVANCE`, only when complete); Property 6 (cracks independent of contact point and key); the seal clause of Property 19 (the pointer hold has a button that sends the same event); Property 2's seal clauses (no split seal, open flap or letter before stage 2).
  - Desk fixes from task 1 (found when the desk was first looked at in a browser; each is an acceptance item with a QA check):
    - (a) Paper text is cream on cream: `.desk` sets `color: var(--desk-ink)` and ParchmentSurface `.surface` sets no colour, so paper panels inherit it. Give `.surface` `color: var(--ink)`. QA check: on the persona page, the text inside the paper panel is dark ink and clears AA on `--paper`.
    - (b) The Demo label is `--ink-soft` with no background on the desk. It must meet AA there: use desk tokens or give it its own paper background. QA check: the label is readable at desktop width and at 360 px, and its ratio on the desk surface is at least 4.5:1.
    - (c) A cream ring is drawn around the whole ceremony region on every state change. No ring on the region itself; keep rings on controls and Stage headings. QA check: change state (for example answer a question, then advance) and no outline appears around the region; Tab still shows a ring on each control, and a Stage heading focused by script still shows its ring.
    - (d) The Calm control is a plain grey browser button. Make it a small, quiet text button in desk tokens at the top right of the region. QA check: the control is styled (no default grey button), sits at the top right at desktop width and at 360 px, meets AA on the desk and has a visible focus ring.
    - (e) The resting candle light sits far below the paper. Rest it behind the paper. QA check: at rest, the light is centred behind the paper panel, not below it, at desktop width and at 360 px.
  - Spec 03 tests changed: any test that names `stage1Next` or the "Read the letter" button (`Reveal` stage 1 clauses in `opening-machine.property.test.ts` and `OpeningFlow.test.tsx`). Find them with `grep -rn "stage1Next\|Read the letter" src`.
  - QA steps: 05, 08, 09, 10, 11, 18 (button path and keyboard), 22 (`seal` at 360 px). Steps 09 and 10 dispatch with `pointerId: 1`.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R3.1, R3.3, R3.4, R6, R11.1, R11.2, R11.4, R16_

- [ ] 4. Number lines, stamps and the extended neutrality test
  - Agent: `frontend-dev` · Depends on: 3 · Estimated size: ~1,750 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/figures/number-line.ts`, `NumberLine.tsx`, `Stamp.tsx`, `figures.module.css`, `src/components/reveal/FigureEntry.tsx`, `src/components/reveal/FiguresThenNow.tsx`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/change-neutral.property.test.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `number-line.ts` per design.md "Number_Line geometry": range from the then and now values only, padding `max(0.25 × span, 0.05 × |then|)`, 1 unit when both are 0, positions clamped to [0, 1], and `Number()` used for drawing only.
    - `FigureEntry` renders one comparable entry from given figures: the existing `FigureLine`s and `ChangeLine`, plus a `NumberLine` with the Mark and two `Stamp`s. `FiguresThenNow` keeps its `{ opened }` signature, adds an optional `record`, and uses `FigureEntry` for comparable entries. Unavailable and not-comparable entries keep exactly their #49 markup, with no line and no Mark (R9.6).
    - `Stamp` frames a `FigureLine` unchanged and adds the face value and the source name as text. Both Stamps show at once in this task, with a vertical drop on mount in full motion. Labels, fixture label, fixture note, "historical record, retrieved" label and the one-click source details are exactly as #49 renders them (R9.1, R9.8).
    - The Mark comes from the Recall_Record's answer for that figure's question. "No answer" draws no Mark element. A Mark outside the range sits at the nearer edge with identical markup at both edges. Only `--pos-mark`, `--pos-then` and `--pos-now` carry positions.
    - Figures stay in payload order (R9.3). No text, colour, size or motion depends on the distance between the Mark and a figure (R9.4).
    - Property 20 is extended, not duplicated, per design.md Property 13: whole comparable entry, the Mark reflected (`m → 2t − m`) in the fall, every position `p` and `1 − p` within 1e-9, only the listed style properties allowed, skeletons byte-identical. Counter cells are added in task 5.
    - Tests: Properties 11, 12, 15, 17, 18 and the Property 20 extension.
  - Spec 03 tests changed: `change-neutral.property.test.tsx` (extended, existing assertions kept); `FiguresThenNow.test.tsx` and `fixture-label.test.tsx` must pass unchanged.
  - QA steps: 13, 16 (the final state: stamps, lines, labels, change line), 22 (stage 3 at 360 px). Passage and counter come in task 5; stamps show at once until then.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R4.10, R9, R10.1–R10.4, R11.9, R12.1–R12.4, R17.3_

- [ ] 5. Passage, counter and the then-and-now steps
  - Agent: `frontend-dev` · Depends on: 4 · Estimated size: ~1,400 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/figures/Counter.tsx`, `Passage.tsx`, `ThenNowSequence.tsx`, `figures.module.css`, `src/components/ceremony/copy.ts`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/change-neutral.property.test.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `Counter` renders `aria-hidden` digit strips over the final text: for each digit a strip of ten digits ending on the target, resting at the last digit in the static and final state. Every strip rolls the same distance, the same direction, for `COUNTER_ROLL_MS` with `EASE_STAMP`.
    - `Passage` plays for `PASSAGE_MS` whatever the span: three sheets turning and the light drifting, `aria-hidden`, with a live-region line.
    - `ThenNowSequence` runs the Steps `then` (stamps drop, counters roll), a pause of `STEP_HOLD_MS`, `passage`, `now`, then the change and formula lines fade in over `CHANGE_FADE_MS`, for all entries together. The Steps send no event. The Stage is `then`, `passage`, `now`, then `close` when done. Skip jumps every Step to its final state. Calm_Mode starts at `done`.
    - Easing and durations are only from `constants.ts`. The `plan*()` functions are pure.
    - Property 20's extension gains the counter-cell clause (every `[data-counter]` cell equal once its digits are replaced).
    - Tests: Property 14 (timings are constants, never data; stage 3 plan length does not grow with entries); the counter clause of Property 13; Property 20 calm clause for these views.
  - Spec 03 tests changed: `change-neutral.property.test.tsx` (extended again). `FiguresThenNow.test.tsx` and `fixture-label.test.tsx` pass unchanged.
  - QA steps: 13, 14, 15, 16, 17 (Skip in stage 3), 18 (Calm goes straight to the final state), 22.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R10.5, R10.6, R11.2, R11.4, R12.5–R12.8, R14.4, R17.3_

- [ ] 6. Letter ink
  - Agent: `frontend-dev` · Depends on: 5 · Estimated size: ~600 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/letter/**`, `src/components/ceremony/copy.ts`, `src/components/reveal/SealedLetter.tsx`, `src/components/reveal/Reveal.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `InkLetter` wraps `SealedLetter`. The labels render unmasked. The letter text is in the document in full, character for character, from the first render. `SealedLetter` gains `data-ink-text` on the letter `p` and nothing else changes in its markup.
    - In full motion a layout effect measures the lines and animates only `mask-*` properties, one line at a time, `min(INK_LINE_DELAY_MS, floor((INK_TOTAL_MAX_MS − INK_LINE_FADE_MS) / lines))` apart, ending within 8 s. The timing depends on the line count alone.
    - Skip is visible while the ink runs and shows the whole text. If a line height can't be read, the text just shows.
    - Tests: Property 16 (the ink effect never touches the letter's characters; the plan touches only `mask-*`); the ink clause of Property 14.
  - Spec 03 tests changed: none. `SealedLetter.test.tsx` (Property 18) must pass unchanged.
  - QA steps: 11, 12, 18, 22 (`letter` at 360 px).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R7, R11.2, R11.4, R16_

- [ ] 7. The desk on /demo
  - Agent: `frontend-dev` · Depends on: 6 · Estimated size: ~1,600 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/app/demo/page.tsx`, `src/app/demo/page.module.css`, `src/app/demo/page.test.tsx`, `src/components/demo/PersonaCard.tsx`, `PersonaCard.module.css`, `PersonaCard.test.tsx`, `src/components/ceremony/desk/**`, `src/components/ceremony/copy.ts`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `/demo` renders `DeskScene` around the server markup spec 03 requires, in the same order (Demo label, heading, intro note, then the cards or the empty state). With scripts disabled it shows the static desk and the same cards. The Demo_Index test passes.
    - `PersonaCard` keeps its props and text and is drawn as an envelope on the desk with a `WaxSeal` seeded by `personaKey`. It receives only list fields. 1 to 6 personas fit with no layout change and no placeholder envelopes.
    - `DeskEnvelopeLink` follows design.md "Camera moves without a transition API": real `<a>`, prefetch on hover and focus, FLIP over `DESK_TO_ENVELOPE_MS` then `router.push`, plain navigation in Calm_Mode, light mode or with modifier keys. If animation or push throws, it navigates anyway.
    - `dust.ts` and `tilt.ts` load by dynamic `import()` after mount, in `full` mode only. Dust: at most `DUST_MAX_PARTICLES`, `DUST_MAX_FPS`, paused when hidden. Tilt: a "Let the light follow your phone" control where a permission is needed. The low-power probe switches to `light` mode.
    - The route stays within its budget: `/demo` at most 130 kB. Record a manual Lighthouse mobile run on `/demo` in the PR: LCP at most 2.5 s, CLS under 0.1. The LCP element is server-rendered text. Check Next did not inline any asset as a `data:` URI.
    - The empty state shows on the desk with no envelopes. The landing page is unchanged.
    - Tests: the Demo_Index renders exactly the Persona_List in order (spec 03 R16.5); source and import checks that dust and tilt are dynamic imports; a test that Calm_Mode never imports them.
  - Spec 03 tests changed: `PersonaCard.test.tsx` and `src/app/demo/page.test.tsx` only if the new wrapper changes the markup they check; keep their assertions.
  - QA steps: 01, 02 (360 px), 03 (the camera move; the Stage must end at `envelope`), 18 (the link is a plain navigation in Calm).
  - Validation: `bash scripts/check.sh`
  - _Requirements: R8, R11.1–R11.3, R13.1, R13.3–R13.7, R16_

- [ ] 8. Recall scale
  - Agent: `frontend-dev` · Depends on: 7 · Estimated size: ~1,800 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/recall/**`, `src/components/ceremony/copy.ts`, `src/components/reveal/RecallStep.tsx`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/RecallStep.test.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - `scale-math.ts` (pure): the log map from 0.01 to 100,000, `toPlainDecimal` at three significant figures, the inverse, zoom windows and key steps per design.md "Recall_Scale". Every value matches `^[0-9]+(\.[0-9]+)?$`, is at most 40 characters and is accepted by `buildRecallRecord`.
    - `RecallScale` is a slider (`role="slider"`, `aria-valuetext`) with drag, dwell zoom (levels 0, 1 and 2, "Show the whole scale" button), keys (arrows, Page Up and Down, Home and End) and a readout that equals the string `EDIT_DRAFT` will send. Faint decade labels at level 0 only, and the two window end labels at levels 1 and 2 (R4.1). `setPointerCapture` is called inside a `try`; if it throws, the drag continues with listeners on the window. `touch-action: none`; the marker hit area is at least 44 by 44.
    - In each fieldset the existing number input and "No answer" checkbox stay, and the scale sits above them. A move sends `EDIT_DRAFT`; typing moves the Mark; "No answer" sends `TOGGLE_NO_ANSWER`, removes the Mark and disables the slider. Values below 0.01 or above 100,000 draw the Mark at that end with identical markup. Validation, inline errors and retry are the spec 03 ones.
    - In the `marks` Stage each scale renders read-only with the Mark at the recorded value and "Your answer: …" text.
    - Nothing in the scale or its zoom reads the payload, metric, unit or any figure beyond the question text and unit label (R4.8, R4.12).
    - At 296 px a two-significant-figure step at level 2 is at least 24 px (design.md "Refining by drag").
    - Tests: Properties 7, 8, 9 and 10.
  - Spec 03 tests changed: `RecallStep.test.tsx` (the scale inside each fieldset; existing assertions kept) and the recall clauses of `OpeningFlow.test.tsx` if they count form controls.
  - QA steps: 05, 06, 07, 08, 18 (arrow keys on the slider), 21, 22 (`recall` at 360 px). Step 06 dispatches with `pointerId: 1`.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R1.3, R4, R11.1, R11.7, R12.1, R16, R17.3_

- [ ] 9. Close, Skip across sequences and the accessibility review
  - Agent: `frontend-dev` · Depends on: 8 · Estimated size: ~1,150 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/close/**`, `src/components/ceremony/skip.tsx`, `CeremonyRoot.tsx`, `copy.ts`, `src/components/reveal/Reveal.tsx`, `src/components/reveal/OpeningFlow.tsx`, and the `*.test.ts(x)` for each
  - Acceptance:
    - `Close` renders after stage 3 when the Step is `done`: the heading, one line, and a "Back to the desk" link to `/demo`. Nothing else; no summary, score or comment (R12.9).
    - Skip is coordinated across every registered sequence: camera moves, Seal_Break, ink, stamps, passage, counter and close. It ends the running sequence at its final state, and in stage 3 takes `then`, `passage` and `now` to their final state with every Stamp, counter value and change line shown.
    - Review of every Ceremony view against R11: each gesture has a plain control; Calm_Mode starts no animation; focus moves to the new Stage's heading; the live region announces each Stage; focus rings at 3:1; targets at least 24 by 24; 200 % text and 320 px width lose nothing; decorative layers are hidden from assistive technology; the Mark is announced as the judge's answer, not as a position.
    - Record manual Lighthouse mobile runs for `/demo` and the persona page in the PR (LCP at most 2.5 s, CLS under 0.1, interaction latency under 200 ms).
    - Tests: Property 19 in full (every gesture has a control, every running sequence has a Skip); Property 20 (Calm_Mode starts no animation); Property 21 (same render on the server and the client with `Math.random` and `Date.now` stubbed differently); Property 2's remaining clauses.
  - Spec 03 tests changed: `opening-machine.property.test.ts` render clauses (extended, existing assertions kept).
  - QA steps: all of 01 to 22. This is the full pass; it should find nothing missing.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R3.1, R11, R12.9, R12.10, R13.4, R16, R17.3_

- [ ] 10. Sound and vibration (optional)
  - Agent: `frontend-dev` · Depends on: 9 · Estimated size: ~650 changed lines
  - Before this task: Blocked by #49 (spec 03 task 8, the reveal's letter and figures stages).
  - Scope: `src/components/ceremony/sound/**`, `src/components/ceremony/seal/SealBreak.tsx`, `src/components/ceremony/copy.ts`, `CeremonyRoot.tsx`, and the `*.test.ts(x)` for each new file
  - Acceptance:
    - A visible, labelled sound toggle (`aria-pressed`), off by default, state in memory only. `sound.ts` loads by dynamic `import()` only after the toggle is turned on, and synthesises everything with Web Audio (filtered noise for paper and the wax crack). No audio file and no network request.
    - Vibration on the Seal_Break (where `navigator.vibrate` exists) happens only while the toggle is on.
    - The same sound and vibration play for a rise and a fall and for any distance between a Mark and a figure.
    - Tests: Property 24 (off by default, `sound.ts` not imported before the toggle, `navigator.vibrate` not called while off, equal plans both ways).
  - Spec 03 tests changed: none.
  - QA steps: 09, 10, 11, 23.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R14, R17.3_

## Notes

- **Order and merging.** The tasks are a straight chain: each depends on the one before it. The dispatcher frees `frontend-dev` as soon as a PR goes to review, and nothing rebases open PRs. With several tasks ready at once, two PRs that both edit `ceremony/copy.ts`, `Reveal.tsx` or `OpeningFlow.tsx` could be open together, and a PR that can't merge makes every dispatcher tick fail. The chain keeps one spec 05 PR open at a time. After each merge `main` is consistent: a Stage whose task hasn't merged keeps its spec 03 look on the desk surface (R18.4).
- **#84 and the figures component.** Spec 04 task 10 adds a test against `FiguresThenNow({ opened })`. It waits on the spec 04 data chain, not on this spec. Task 4 and task 5 keep the signature and the labels (R9.7, R9.8).
- **The retrieved date label.** A separate issue fixes the date format in `FigureLine` (using `formatUtcDate`). No task here touches it.
- **Task 10 is optional.** The Ceremony is complete after task 9.

## Task Dependency Graph

Dependencies: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10, a straight chain.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5"] },
    { "id": 5, "tasks": ["6"] },
    { "id": 6, "tasks": ["7"] },
    { "id": 7, "tasks": ["8"] },
    { "id": 8, "tasks": ["9"] },
    { "id": 9, "tasks": ["10"] }
  ]
}
```
