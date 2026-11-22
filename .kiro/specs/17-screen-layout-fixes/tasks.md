# Implementation Plan

Each top-level task is one work unit from `design.md`, in the design's order. Every task changes files: the fix, the paired layout-check rule, and a unit test holding the main-branch measurements as a failing fixture and the post-fix values as a passing fixture. Running the tests (`npx vitest --run <file>`) is part of finishing the code-change sub-task, not a separate step. Test files are under `src/lib/` in the style of `layout-check-spec16-rows.test.ts`.

- [ ] 1. D6: no focus box on a script-focused heading (rule FR1)

  - [ ] 1.1 Fix the focus outline and add the FR1 rule
    - Edit `src/app/globals.css`, `src/components/ceremony/ceremony.module.css` and `src/components/reveal/RecallReader.module.css`: add `h1[tabindex="-1"]:focus, h2[tabindex="-1"]:focus, [data-step-heading]:focus { outline: none }`. Leave `.desk :focus-visible` and `.onPaper :focus-visible` for controls. Leave `focusHeading` in `CeremonyRoot.tsx` unchanged.
    - Create `tools/qa/layout-rules-17.mjs` with the `frFailures(reading)` verdict function and the browser reader. The reader loads the step with no input and reads the active element's computed outline. It fails when a non-interactive element (`tabindex="-1"`, not a link, button, input, select, textarea or `[role=button]`) has a visible outline. It presses Tab once and fails when the next control shows none. Messages name the element, the measured value and the threshold.
    - Edit `tools/qa/layout-check.mjs` to import FR1 and run it on every step the walk reaches at 1440x900 and 390x844, as a blocker with no `--require`.
    - Run the task 1.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.noInputYet AND S.activeElement.isHeading AND S.activeElement.outline.visible_
    - _Expected_Behavior: no outline on a script-focused non-interactive element; the next Tab stop shows a ring_
    - _Preservation: `focusHeading` unchanged; control focus rings unchanged; one h1 per step_
    - _Requirements: 1.8, 2.8, 2.10, 3.10_

  - [ ] 1.2 Write the FR1 tests
    - **Property 1: Bug Condition** - Script-focused heading draws no outline
    - Create `src/lib/layout-check-fr1.test.ts`. Failing fixture from main: active element `H2`, outline `2px solid rgb(31, 27, 22)`. Passing fixture: outline style `none`. Include an outline-width 0 boundary and a Tab-stop-without-ring failing case.
    - **Property 2: Preservation** - Control rings and `focusHeading` remain
    - In the same file, add a source test that the new selectors exist in the three CSS files, that `.desk :focus-visible` and `.onPaper :focus-visible` are still present, and that `focusHeading` in `src/components/ceremony/CeremonyRoot.tsx` is unchanged. Add a property test over random outline style, width, colour alpha and interactive flag: FR1 fails exactly when a non-interactive element has a visible outline.
    - _Requirements: 2.8, 2.10, 3.10_

- [ ] 2. D5: "Previous question" readable on the recall card (rule CT1)

  - [ ] 2.1 Fix the control colour and add the CT1 rule
    - Edit `src/components/recall/NavRow.module.css`: `.previous` uses `var(--ink)` for text and `1px solid var(--ink)` for the border. Replace the dark-scene comment.
    - Extend `tools/qa/layout-rules-17.mjs` with `ctFailures(reading)` and the CT1 reader. The reader walks every visible text node, reads the parent's computed `color`, `font-size` and `font-weight`, and composites the colour over its surface by blending ancestor `background-color` values up to the first opaque one. Where an ancestor has a gradient or image, it clips a screenshot of the line box with the text made transparent and takes the worst pixel. No design token is read. The verdict fails below 4.5:1, or below 3:1 when the font is 24 px or larger, or 18.66 px or larger and bold.
    - Edit `tools/qa/layout-check.mjs` to run CT1 on Press the seal, Remember (after answering question 1 so "Previous question" exists), Break the seal, Receipts and the landing page, at both sizes, as a blocker.
    - Run the task 2.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.previousControl.visible AND contrast(S.previousControl.colour, surfaceOf(S.previousControl)) < 4.5_
    - _Expected_Behavior: ink text at least 4.5:1 and a border at least 3:1 on the cream_
    - _Preservation: no copy change; control order and accessible names unchanged_
    - _Requirements: 1.7, 2.3, 2.7, 2.10, 3.1, 3.10_

  - [ ] 2.2 Write the CT1 tests
    - **Property 1: Bug Condition** - Text meets contrast on its real surface
    - Create `src/lib/layout-check-ct1.test.ts`. Failing fixture from main: `#ffffff` on `#f6ead4` (about 1.2:1) for "Previous question". Passing fixture: ink `#1f1b16` on `#f6ead4`. Add boundary cases at exactly 4.5:1, 3:1, 24 px and bold 18.66 px, plus compositing cases (opaque, semi-transparent over opaque, nested alpha, gradient worst-pixel choice).
    - **Property 2: Preservation** - Copy and tab order unchanged
    - In the same file, add a source test that `.previous` uses `--ink` with a 1px border and that the "Previous question" string is unchanged. Add a property test over random colour pairs and font sizes: CT1 agrees with the WCAG formula and the large-text threshold switch.
    - _Requirements: 2.3, 2.7, 2.10, 3.1_

- [ ] 3. D3: receipts column at least the viewport minus 48 px on a phone (rule CW1)

  - [ ] 3.1 Fix the column width and add the CW1 rule
    - Edit `src/components/ceremony/scene/scene.module.css`: `--content-column-max` stays `min(34rem, 46vw)` inside `@media (min-width: 900px)` and is `min(34rem, 100%)` below it.
    - Edit `src/components/reveal/receipts.module.css` (and the live receipts column stylesheet it shares) so both receipts columns use the variable with no extra narrowing.
    - Add `data-content-column` to the receipts, recall, write and seal column elements in the TSX components that render them under `src/components/reveal/`, `src/components/ceremony/` and `src/components/live/`.
    - Extend `tools/qa/layout-rules-17.mjs` with `cwFailures(reading)` and the CW1 reader: content box width of `[data-content-column]` must be at least `viewportWidth - 48`, run at 390x844 and 360x640 on every step the walk reaches. Edit `tools/qa/layout-check.mjs` to run it as a blocker. Keep R10.6's comparison and add the floor.
    - Run the task 3.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where S.step = "receipts" AND S.width <= 480 AND S.column.width < S.width - 48_
    - _Expected_Behavior: column at least 342 px at 390 px wide, with at most 16 px margin a side; live receipts column matches_
    - _Preservation: `min(34rem, 46vw)` at 900 px and wider; receipts order unchanged_
    - _Requirements: 1.5, 2.5, 2.10, 3.6_

  - [ ] 3.2 Write the CW1 tests
    - **Property 1: Bug Condition** - Phone column meets the minimum width
    - Create `src/lib/layout-check-cw1.test.ts`. Failing fixture from main: `{ width: 179.4, viewport: 390 }` (minimum 342). Passing fixture: `{ width: 342, viewport: 390 }`. Boundary at exactly `viewport - 48` and at 360x640.
    - **Property 2: Preservation** - Desktop cap unchanged
    - In the same file, add a source test that `--content-column-max` is `min(34rem, 46vw)` inside the 900 px query in `scene.module.css`. Add a property test for random viewport widths from 360 to 899: CW1 fails exactly when the column is under `width - 48`.
    - _Requirements: 2.5, 2.10, 3.6_

- [ ] 4. D4: Ghost clear of the intro text on the phone Remember step (rule GO1, Ghost)

  - [ ] 4.1 Fix the Ghost overlap and add the GO1 rule
    - Edit the phone Ghost layer CSS in `src/components/ceremony/scene/scene.module.css` to expose the drawn bottom (body, hem and glow) as `--ghost-bottom`.
    - Edit the Persona_Intro stylesheet in `src/components/ceremony/` so its `margin-block-start` is `max(0px, calc(var(--ghost-bottom) - var(--intro-top)))`. Add `data-ghost-box` on the Ghost's drawn box if it is missing. The Ghost position and the copy do not change.
    - Extend `tools/qa/layout-rules-17.mjs` with `goFailures(reading)` and the GO1 reader. It collects the Ghost's drawn box with no inner margins trimmed, and the rect of every text line (a `Range` per text node) and every control. Opaque ancestors are not an exemption, so text inside `.desk` is tested. It runs at the start of the step and after scrolling to the bottom. Messages name the text or control, the layer and the overlap in px.
    - Edit `tools/qa/layout-check.mjs` to run GO1 on Remember at 390x844 as a blocker, replacing GT1's polish level and G1's opaque skip for these screens.
    - Run the task 4.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "remember" AND S.width <= 480 AND EXISTS t IN S.textAndControls : overlaps(t.box, S.ghost.drawnBox)_
    - _Expected_Behavior: no text or control intersects the Ghost's drawn box_
    - _Preservation: Ghost position, copy and lifetime (emergence to break) unchanged_
    - _Requirements: 1.6, 1.10, 2.6, 2.10, 3.1, 3.5_

  - [ ] 4.2 Write the GO1 tests
    - **Property 1: Bug Condition** - Text and controls clear of the Ghost
    - Create `src/lib/layout-check-go1.test.ts`. Failing fixture from main: text box `36..348 x 206..224` against Ghost drawn box `164..220 x 143..208` plus hem. Passing fixture: the same text moved below the drawn bottom. Include the case where the text has an opaque ancestor and must still fail.
    - **Property 2: Preservation** - Ghost lifetime and copy unchanged
    - In the same file, add a source test that `--ghost-bottom` and the intro margin rule exist, and a property test over random rect pairs: GO1 fails exactly when the rects intersect.
    - _Requirements: 2.6, 2.10, 3.5_

- [ ] 5. D7: Break the seal columns grouped and Soil clear of text (rules LC1 and GO1, Soil)

  - [ ] 5.1 Fix the layout and add the LC1 rule
    - Edit `src/components/ceremony/scene/scene.module.css`: at 900 px and wider, the figures column and the Seal group share one grid with `column-gap: 48px`. The Seal group is a grid item right of the figures with its top aligned to the figures column's top, and is no longer positioned from `--ghost-cx` and `--ghost-w`. The marks column gets `padding-block-end: var(--soil-clear)`.
    - Add `data-figures-column` and `data-seal-group` to the Break the seal components under `src/components/ceremony/` that render the figures and the Seal group.
    - Extend `tools/qa/layout-rules-17.mjs` with `lcFailures(reading)` and the LC1 reader. It fails when `sealGroup.left - figures.right > 64` or when `sealGroup.top` is outside `[figures.top, figures.bottom]`. Extend `goFailures` and its reader to also test `[data-soil-strip]`.
    - Edit `tools/qa/layout-check.mjs` to run LC1 on Maya's Break the seal at 1440x900 and GO1 with the Soil on Break the seal at 1440x900 and 390x844, as blockers.
    - Run the task 5.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "break" AND S.width >= 900 AND (EXISTS t IN S.text : overlaps(t.box, S.soil.box) OR S.sealGroup.left - S.figures.right > 64)_
    - _Expected_Behavior: Soil clear of every text line; Seal group at most 64 px from the figures column and its top inside the column's span_
    - _Preservation: layout below 900 px unchanged; figures, provenance and copy unchanged_
    - _Requirements: 1.9, 2.9, 2.10, 3.7_

  - [ ] 5.2 Write the LC1 and Soil tests
    - **Property 1: Bug Condition** - Columns grouped and Soil clear
    - Create `src/lib/layout-check-lc1.test.ts`. Failing fixtures from main: gap 134 px; text `y 419..440` against Soil `40..488 x 419..545`. Passing fixtures: gap 48 px with the Seal group top inside the column span; text ending above the Soil top. Boundaries at gap 64 (pass) and 65 (fail).
    - **Property 2: Preservation** - Narrow layout and data unchanged
    - In the same file, add a source test that the grid, `column-gap: 48px` and `padding-block-end: var(--soil-clear)` exist in `scene.module.css`, and a property test over random gaps: LC1 fails exactly when the gap exceeds 64.
    - _Requirements: 2.9, 2.10, 3.7_

- [ ] 6. D1: Seal panel fills its surface and the wax is at least 44 px at rest (rules SF1 and TT1)

  - [ ] 6.1 Fix the card, panel and wax, and add SF1 and TT1
    - Edit `src/components/live/stepper/live-steps.ts`: `hasPrimaryCard()` returns false for `seal`. The `write` case is unchanged.
    - Edit `src/components/live/seal-step/seal-step.module.css`: `.step` uses `inline-size: 100%` in place of `margin-inline: auto`, and keeps `max-inline-size` only for the text measure inside the panel.
    - Edit `src/components/live/seal-step/press.module.css`: `.wax` rests at `scale(calc(0.25 + 0.75 * var(--press-progress)))`.
    - Add `data-seal-step`, `data-press-target` and `data-wax` to the matching elements in the Seal step TSX under `src/components/live/seal-step/`.
    - Extend `tools/qa/layout-rules-17.mjs` with `sfFailures(reading)` and `ttFailures(reading)` and their readers. SF1 fails when the panel width is under 99% of the surface width, or when a cream pixel run wider than 2 px sits beside the dark panel. TT1 measures the visible `[data-wax]` mark of every `[data-press-target]` or `role="button"` the reader is told to press, at rest, and fails under 44x44 CSS px. The button's size never stands in for the mark.
    - Edit `tools/qa/layout-check.mjs` to run SF1 and TT1 on Press the seal at 1440x900, 390x844 and 360x640 as blockers.
    - Run the task 6.2 test file until it passes.
    - _Bug_Condition: isBugCondition(S) where (S.step = "seal" AND S.width >= 900 AND S.panel.width < 0.99 * S.card.width) OR (S.step = "seal" AND S.wax.atRest.width < 44)_
    - _Expected_Behavior: panel fills its surface; wax at rest at least 44x44 and growing to full size during a press_
    - _Preservation: Write desk and `.deskCard` unchanged; press-and-hold stages, halo and passkey prompt unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.10, 3.3, 3.4_

  - [ ] 6.2 Write the SF1 and TT1 tests
    - **Property 1: Bug Condition** - Panel fills surface; wax meets target size
    - Create `src/lib/layout-check-sf1-tt1.test.ts`. Failing fixtures from main: SF1 `{ panelWidth: 1040, surfaceWidth: 1360 }`; TT1 wax `15x15` at 1440x900 and `10x10` at 390x844 with the button `392x253` passing alone. Passing fixtures: panel equal to the surface; wax at least 60x60. Boundaries at 99% and 44 px.
    - **Property 2: Preservation** - Write desk and press behaviour unchanged
    - In the same file, add source tests that `hasPrimaryCard()` still handles `write` as before, `.deskCard` is untouched, and the wax formula reaches scale 1 at progress 1. Add a property test over random panel and surface widths: SF1 fails exactly when the ratio is under 0.99.
    - _Requirements: 2.1, 2.2, 2.10, 3.3, 3.4_

- [ ] 7. D2: Wait step on the desk with one Demo label and one wax seal (rule UQ1, CT1 and SF1 on Wait)

  - [ ] 7.1 Fix the Wait step and add the UQ1 rule
    - Edit `src/components/live/stepper/live-steps.ts`: `hasPrimaryCard()` returns false for `wait`.
    - Edit `src/components/live/live.module.css`: restyle the Wait `.panel` for the dark surface (dark background, desk text colour, the Seal panel's border treatment).
    - Edit `src/components/live/LiveWaitStep.tsx`: remove the in-panel `<DemoLabel />` (the Top_Bar chip stays) and pass `showSeal={false}` to `LetterCard`. Copy, link, calendar and backup controls stay as they are.
    - Edit the `LetterCard` component under `src/components/` (and its stylesheet): add a `showSeal` prop that defaults to true, so the printable card and PDF are unchanged.
    - Edit `src/components/live/stepper/stepper.module.css` and the card element: add `data-surface` (`paper` uses `--ink`, `desk` uses `--text`) so the stepper `h2` takes its colour from the surface.
    - Extend `tools/qa/layout-rules-17.mjs` with `uqFailures(reading)` and the UQ1 reader: count visible `[data-demo-label]` plus the Top_Bar chip, and visible `[data-wax-seal]` elements in the first viewport. Both counts must be exactly 1.
    - Edit `tools/qa/layout-check.mjs` to run UQ1, CT1 and SF1 on the Wait step, reached by the existing virtual-passkey walk (`LIVE_PATH`), at 1440x900 and 390x844, as blockers.
    - Run the task 7.2 test files until they pass.
    - _Bug_Condition: isBugCondition(S) where S.step = "wait" AND (EXISTS t IN S.text : contrast(t.colour, backgroundOf(t)) < 4.5 OR COUNT(S.demoLabels) > 1 OR COUNT(S.waxSeals, firstViewport) > 1)_
    - _Expected_Behavior: every line meets contrast on its surface; one Demo label; one wax seal in the first viewport_
    - _Preservation: "Seal your own letter" and all copy unchanged; letter card content and controls unchanged; steps and the 30-second lock unchanged_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 2.10, 3.1, 3.2, 3.10_

  - [ ] 7.2 Write the UQ1 and Wait tests
    - **Property 1: Bug Condition** - One label, one seal, readable heading
    - Create `src/lib/layout-check-uq1.test.ts`. Failing fixture from main: `{ demoLabels: 2, seals: 2 }`. Passing fixture: `{ demoLabels: 1, seals: 1 }`.
    - Edit `src/lib/layout-check-ct1.test.ts` to add the Wait cases: the h1 "Seal your own letter" as `#ffffff` on `#f6ead4` fails; white on the dark Wait surface passes.
    - **Property 2: Preservation** - Copy, card content and step order unchanged
    - In `src/lib/layout-check-uq1.test.ts`, add source tests that `LiveWaitStep.tsx` no longer renders `DemoLabel`, passes `showSeal={false}`, and that the heading string, the step order in `live-steps.ts` and the `LetterCard` default of `showSeal` are unchanged. Add a property test over random label and seal counts: UQ1 passes exactly when both are 1.
    - _Requirements: 2.3, 2.4, 2.10, 3.1, 3.2_

- [ ] 8. Gate: layout-check runs in `scripts/check.sh` and fails `ci-gate` on a blocker

  - [ ] 8.1 Add the gate script and wire it into check.sh and CI
    - Create `tools/qa/layout-gate.mjs` exporting `buildGateArgs(env)` (pure: sizes `1440x900,390x844`, Chromium path from `CHROMIUM_PATH`, shots to a temp dir, no `--require`) and `main()`. `main()` starts `node .next/standalone/server.js` on a free port, waits on `/api/health`, prepares the demo personas (migrate, then `seal-personas`), runs `tools/qa/layout-check.mjs --url`, stops the server and returns the exit code.
    - Edit `scripts/check.sh`: add `step "layout-check (blockers)"; node tools/qa/layout-gate.mjs` after the build and the JS budget. It runs when `CI` is set or `LAYOUT_CHECK=1` and prints a skip line otherwise.
    - Edit `.github/agents.json`: add `scripts/check.sh` (and `tools/qa/layout-gate.mjs`) to the path ownership of the role agent that carries this unit, so the owner-only path rule allows the edit.
    - Edit `.github/workflows/ci.yml`: set `CHROMIUM_PATH: /usr/bin/google-chrome` on the `scripts/check.sh` step and keep `DATABASE_URL` as it is. `ci-gate` is unchanged.
    - Edit `package.json`: add the script `layout-gate`.
    - Edit the header comment of `tools/qa/layout-check.mjs` to state that SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1 block with no `--require` and exit 1. Edit `docs/agent-loop.md` to note the new step in `scripts/check.sh`.
    - Run the task 8.2 test file until it passes. No Helm change, so the chart `version` stays.
    - _Bug_Condition: isBugCondition(S) for any of D1 to D7 reaching a pull request without a failing required check_
    - _Expected_Behavior: a failing rule makes `scripts/check.sh` exit non-zero, so `ci-gate` fails_
    - _Preservation: every row that passes today still passes; `check.sh` still passes on a laptop without Chromium or Postgres_
    - _Requirements: 1.10, 2.10, 2.11, 3.9_

  - [ ] 8.2 Write the gate tests
    - **Property 1: Bug Condition** - A blocker fails the required check
    - Create `src/lib/layout-gate.test.ts`: `buildGateArgs` returns the sizes `1440x900,390x844`, takes the Chromium path from `CHROMIUM_PATH`, and never contains `--require`. A source test asserts `scripts/check.sh` calls `tools/qa/layout-gate.mjs`, `.github/workflows/ci.yml` sets `CHROMIUM_PATH`, and `.github/agents.json` lists `scripts/check.sh`.
    - **Property 2: Preservation** - Existing rows and skip path kept
    - In the same file, add a source test that `scripts/check.sh` prints a skip line when neither `CI` nor `LAYOUT_CHECK` is set, and that the R10.1, R10.6, R14.3, R5.4, NB1, GC1, DL1 and PV1 verdict tests still exist unchanged.
    - _Requirements: 2.10, 2.11, 3.9_
