# Implementation Plan: 17 Screen layout fixes

## Overview

Spec 17 fixes seven broken screens of the live demo and the persona demos (D1 to D7 in `bugfix.md`) and closes the hole in the checks: each defect is paired with a `layout-check` rule (SF1, TT1, CT1, UQ1, CW1, GO1, FR1, LC1) that is a blocker with no `--require` flag. Copy, step order and controls do not change.

`bugfix.md` says what is broken and what must hold, and `design.md` says which files change and how. Each defect is two tasks, in the design's unit order: a frontend-dev task for the CSS or component fix with a source test, then a platform-dev task for the rule, its wiring in `layout-check.mjs` and the verdict test that holds the main-branch measurements as a failing fixture and the post-fix measurements as a passing fixture. The last task builds the gate script.

| Tasks | Defect | Rule | Roles |
|---|---|---|---|
| 1, 2 | D6 focus outline on a script-focused heading | FR1 | frontend-dev, platform-dev |
| 3, 4 | D5 "Previous question" contrast | CT1 | frontend-dev, platform-dev |
| 5, 6 | D3 receipts column on a phone | CW1 | frontend-dev, platform-dev |
| 7, 8 | D4 Ghost over the intro text | GO1 (Ghost) | frontend-dev, platform-dev |
| 9, 10 | D7 Break the seal columns and Soil | LC1, GO1 (Soil) | frontend-dev, platform-dev |
| 11, 12 | D1 Seal panel and wax size | SF1, TT1 | frontend-dev, platform-dev |
| 13, 14 | D2 Wait step | UQ1, CT1 and SF1 on Wait | frontend-dev, platform-dev |
| 15 | Gate script | none | platform-dev |
| 16 | D7 again on desktop: step track gap, Soil clearance, Seal group beside the marks, Ghost overlap | LC1, GO1 | frontend-dev |

Each task is one GitHub issue and one PR for one role, inside that role's paths in `.github/agents.json` (plus `shared`). "Depends on" lists only task numbers of this spec. The agent loop runs one task at a time and takes the lowest-numbered ready issue.

## Rules for every task

- **Branch and PR.** The dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are listed in your task's Scope, plus new `*.test.ts(x)` files next to the code they test. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Hard boundaries.** No task changes a file under `.kiro/`, `.github/`, `docs/`, `tools/agents/`, `tools/dispatcher/`, `tools/hooks/`, `scripts/check.sh`, `src/app/api/`, `src/lib/letter-store/`, `src/lib/db/`, `src/lib/crypto/`, `src/lib/seal-format/` or `drizzle/`, the Helm chart or an environment variable. No task changes persona letter text, a sealed answer, a letter id, an envelope hash or a figure value. No new `dependencies` or `devDependencies` entry.
- **Copy and flow.** No string, step order, control or accessible name changes (Requirement 3.1, 3.2, 3.10). Source tests pin the strings a task touches.
- **Tests are part of the task.** Running the task's tests (`npx vitest --run <file>`) is part of finishing its code sub-task. No task is only a run, a check, a measurement or a checkpoint.
- **Rule tasks.** A rule's verdict function is pure and exported from `tools/qa/layout-rules-17.mjs`. The browser reader only collects the reading. Each failure message names the element, the measured value and the threshold. Each rule runs as a blocker with no `--require`. The unit test is `src/lib/layout-check-<rule>.test.ts` with the failing fixture from the unfixed `main` and the passing fixture from the fixed build.
- **Preservation.** Every `layout-check` and `journey-check` row that passes today still passes. No row is loosened.
- **Evidence.** A commit message body states the final commit SHA, the exit status of the task's tests and PASS or FAIL, and every earlier test changed or retired with its reason ("none" if empty).
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body. If something is still unclear, decide, record the decision in a commit message body under "Decisions", and continue. Do not stop to ask.

## Tasks

- [x] 1. D6: no focus box on a script-focused heading
  - Agent: `frontend-dev` · Depends on: none · Estimated size: S, ~120 changed lines
  - Scope: `src/components/ceremony/ceremony.module.css`, `src/components/ceremony/recall/RecallReader.module.css`, `src/components/ceremony/focus-ring-heading.test.ts` (new).
  - Design sections: "D6 / FR1", "Why the existing checks missed each defect".

  - [ ] 1.1 Remove the outline from script-focused headings
    - In both CSS files add `h1[tabindex="-1"]:focus, h2[tabindex="-1"]:focus, [data-step-heading]:focus { outline: none }`. Leave `.desk :focus-visible` and `.onPaper :focus-visible` for controls. Leave `focusHeading` in `CeremonyRoot.tsx` unchanged. `src/app/globals.css` is platform-dev's file and is not edited here.
    - Create the source test: the new selectors exist in both files, `.desk :focus-visible` and `.onPaper :focus-visible` are still present, and `focusHeading` is unchanged. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.noInputYet AND S.activeElement.isNonInteractive AND S.activeElement.outline.visible_
    - _Expected_Behavior: no outline on a script-focused non-interactive element; the next Tab stop shows a ring_
    - _Preservation: `focusHeading` unchanged; control focus rings unchanged; one h1 per step_
    - _Requirements: 1.8, 2.8, 3.10_

- [x] 2. FR1 rule: script-focused heading draws no outline
  - Agent: `platform-dev` · Depends on: 1 · Estimated size: M, ~400 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs` (new), `tools/qa/layout-check.mjs`, `src/lib/layout-check-fr1.test.ts` (new).
  - Design sections: "Shared rule module", "D6 / FR1".

  - [ ] 2.1 Add FR1 and wire it into layout-check
    - Create `tools/qa/layout-rules-17.mjs` with the `frFailures(reading)` verdict and the browser reader. The reader loads the step with no input and reads the active element's computed outline. It fails when a non-interactive element (`tabindex="-1"`, not a link, button, input, select, textarea or `[role=button]`) has a visible outline (style not `none`, width above 0, colour alpha above 0). It presses Tab once and fails when the next control shows none.
    - Edit `tools/qa/layout-check.mjs` to run FR1 on every step the walk reaches at 1440x900 and 390x844 as a blocker with no `--require`.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.noInputYet AND S.activeElement.isNonInteractive AND S.activeElement.outline.visible_
    - _Expected_Behavior: FR1 fails on main's reading and passes on the fixed build_
    - _Preservation: no existing row is loosened_
    - _Requirements: 2.8, 2.10_

  - [ ] 2.2 Write the FR1 tests
    - **Property 1: Bug Condition** - Script-focused heading draws no outline
    - Create `src/lib/layout-check-fr1.test.ts`. Failing fixture from main: active element `H2`, outline `2px solid rgb(31, 27, 22)`. Passing fixture: outline style `none`. Add an outline-width 0 boundary and a Tab-stop-without-ring failing case.
    - **Property 2: Preservation** - Control rings are still required
    - Add a property test over random outline style, width, colour alpha and interactive flag: FR1 fails exactly when a non-interactive element has a visible outline. Run the file until it passes.
    - _Requirements: 2.8, 2.10, 3.10_

- [x] 3. D5: "Previous question" readable on the recall card
  - Agent: `frontend-dev` · Depends on: none · Estimated size: S, ~100 changed lines
  - Scope: `src/components/ceremony/recall/NavRow.module.css`, `src/components/ceremony/recall/nav-row-colour.test.ts` (new).
  - Design sections: "D5 and D2 contrast / CT1".

  - [ ] 3.1 Use ink text and an ink border on `.previous`
    - Edit `NavRow.module.css`: `.previous` uses `var(--ink)` for text and `1px solid var(--ink)` for the border. Replace the dark-scene comment.
    - Create the source test: `.previous` uses `--ink` and a 1px border, and the "Previous question" string in `NavRow.tsx` is unchanged. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.previousControl.visible AND contrast(S.previousControl.colour, surfaceOf(S.previousControl)) < 4.5_
    - _Expected_Behavior: ink text at least 4.5:1 and a border at least 3:1 on the cream_
    - _Preservation: no copy change; control order and accessible names unchanged_
    - _Requirements: 1.7, 2.7, 3.1, 3.10_

- [x] 4. CT1 rule: text meets contrast on its real surface
  - Agent: `platform-dev` · Depends on: 2, 3 · Estimated size: M, ~600 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-ct1.test.ts` (new).
  - Design sections: "D5 and D2 contrast / CT1".

  - [ ] 4.1 Add CT1 and wire it into layout-check
    - Add `ctFailures(reading)` and the CT1 reader. The reader walks every visible text node, reads the parent's computed `color`, `font-size` and `font-weight`, and composites the colour over its surface by blending ancestor `background-color` values up to the first opaque one. Where an ancestor has a gradient or image, it clips a screenshot of the line box with the text made transparent and takes the worst pixel. No design token is read. The verdict fails below 4.5:1, or below 3:1 at 24 px or larger, or 18.66 px or larger and bold.
    - Edit `tools/qa/layout-check.mjs` to run CT1 on Press the seal, Remember (after answering question 1 so "Previous question" exists), Break the seal, Receipts and the landing page, at both sizes, as a blocker.
    - _Bug_Condition: isBugCondition(S) where S.step = "remember" AND S.previousControl.visible AND contrast(S.previousControl.colour, surfaceOf(S.previousControl)) < 4.5_
    - _Expected_Behavior: CT1 fails on main's reading and passes on the fixed build_
    - _Preservation: no existing row is loosened_
    - _Requirements: 2.3, 2.7, 2.10_

  - [ ] 4.2 Write the CT1 tests
    - **Property 1: Bug Condition** - Text meets contrast on its real surface
    - Create `src/lib/layout-check-ct1.test.ts`. Failing fixture from main: `#ffffff` on `#f6ead4` (about 1.2:1). Passing fixture: ink `#1f1b16` on `#f6ead4`. Add boundaries at exactly 4.5:1, 3:1, 24 px and bold 18.66 px, and compositing cases (opaque, semi-transparent over opaque, nested alpha, gradient worst-pixel choice).
    - **Property 2: Preservation** - The WCAG formula is the verdict
    - Add a property test over random colour pairs and font sizes: CT1 agrees with the WCAG formula and the large-text threshold switch. Run the file until it passes.
    - _Requirements: 2.3, 2.7, 2.10_

- [x] 5. D3: receipts column at least the viewport minus 48 px on a phone
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~300 changed lines
  - Scope: `src/components/ceremony/scene/scene.module.css`, `src/components/reveal/receipts.module.css`, the TSX files under `src/components/reveal/`, `src/components/ceremony/` and `src/components/live/` that render the receipts, recall, write and seal columns (attribute only), `src/components/ceremony/scene/content-column.test.ts` (new).
  - Design sections: "D3 / CW1".

  - [ ] 5.1 Lift the 46vw cap below 900 px and mark the columns
    - In `scene.module.css`, keep `--content-column-max: min(34rem, 46vw)` inside `@media (min-width: 900px)` and set `min(34rem, 100%)` below it. In `receipts.module.css` and the live receipts stylesheet, use the variable with no extra narrowing.
    - Add `data-content-column` to the receipts, recall, write and seal column elements.
    - Create the source test: the 900 px query keeps `min(34rem, 46vw)`, the narrow value is `min(34rem, 100%)`, and every named column carries the attribute. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "receipts" AND S.width <= 480 AND S.column.width < S.width - 48_
    - _Expected_Behavior: column at least 342 px at 390 px wide; live receipts column matches_
    - _Preservation: `min(34rem, 46vw)` at 900 px and wider; receipts order unchanged_
    - _Requirements: 1.5, 2.5, 3.6_

- [x] 6. CW1 rule: minimum content width
  - Agent: `platform-dev` · Depends on: 4, 5 · Estimated size: M, ~350 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-cw1.test.ts` (new).
  - Design sections: "D3 / CW1".

  - [ ] 6.1 Add CW1 and wire it into layout-check
    - Add `cwFailures(reading)` and the reader: the content box width of `[data-content-column]` must be at least `viewportWidth - 48`. Run it at 390x844 and 360x640 on every step the walk reaches, as a blocker. Keep R10.6's comparison and add the floor beside it.
    - _Bug_Condition: isBugCondition(S) where S.step = "receipts" AND S.width <= 480 AND S.column.width < S.width - 48_
    - _Expected_Behavior: CW1 fails on main's reading and passes on the fixed build_
    - _Preservation: R10.6 keeps its comparison_
    - _Requirements: 2.5, 2.10_

  - [ ] 6.2 Write the CW1 tests
    - **Property 1: Bug Condition** - Phone column meets the minimum width
    - Create `src/lib/layout-check-cw1.test.ts`. Failing fixture from main: `{ width: 179.4, viewport: 390 }` (minimum 342). Passing fixture: `{ width: 342, viewport: 390 }`. Boundary at exactly `viewport - 48`, and at 360x640.
    - **Property 2: Preservation** - Only narrow columns fail
    - Add a property test for random viewport widths from 360 to 899: CW1 fails exactly when the column is under `width - 48`. Run the file until it passes.
    - _Requirements: 2.5, 2.10, 3.6_

- [x] 7. D4: Ghost clear of the intro text on the phone Remember step
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~300 changed lines
  - Scope: `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/Ghost.tsx`, `src/components/ceremony/scene/PersonaGhost.tsx`, `src/components/ceremony/intro/intro.module.css`, `src/components/ceremony/intro/ghost-clear.test.ts` (new).
  - Design sections: "D4 and D7 overlap / GO1".

  - [ ] 7.1 Reserve the Ghost's drawn bottom above the intro
    - The phone Ghost layer exposes its drawn bottom (body, hem and glow) as `--ghost-bottom`. The Persona_Intro takes `margin-block-start: max(0px, calc(var(--ghost-bottom) - var(--intro-top)))`. Add `data-ghost-box` on the Ghost's drawn box if missing. The Ghost position and the copy do not change.
    - Create the source test: `--ghost-bottom` and the intro margin rule exist, and the Ghost placement constants are unchanged. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "remember" AND S.width <= 480 AND EXISTS t IN S.textAndControls : overlaps(t.box, S.ghost.drawnBox)_
    - _Expected_Behavior: no text or control intersects the Ghost's drawn box_
    - _Preservation: Ghost position, copy and lifetime (emergence to break) unchanged_
    - _Requirements: 1.6, 2.6, 3.1, 3.5_

- [x] 8. GO1 rule (Ghost): text and controls clear of the Ghost
  - Agent: `platform-dev` · Depends on: 6, 7 · Estimated size: M, ~450 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-go1.test.ts` (new).
  - Design sections: "D4 and D7 overlap / GO1".

  - [ ] 8.1 Add GO1 for the Ghost and wire it into layout-check
    - Add `goFailures(reading)` and the reader. It collects the Ghost's drawn box (`[data-ghost-box]`, with no inner margins trimmed), the rect of every text line (a `Range` per text node) and every control. Opaque ancestors are not an exemption, so text inside `.desk` is tested. It runs at the start of the step and after scrolling to the bottom. Messages name the text or control, the layer and the overlap in px.
    - Edit `tools/qa/layout-check.mjs` to run GO1 on Remember at 390x844 as a blocker, replacing GT1's polish level and G1's opaque-ancestor skip for these screens.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "remember" AND S.width <= 480 AND EXISTS t IN S.textAndControls : overlaps(t.box, S.ghost.drawnBox)_
    - _Expected_Behavior: GO1 fails on main's reading and passes on the fixed build_
    - _Preservation: no existing row is loosened_
    - _Requirements: 2.6, 2.10_

  - [ ] 8.2 Write the GO1 tests
    - **Property 1: Bug Condition** - Text and controls clear of the Ghost
    - Create `src/lib/layout-check-go1.test.ts`. Failing fixture from main: text box `36..348 x 206..224` against Ghost drawn box `164..220 x 143..208` plus hem. Passing fixture: the same text moved below the drawn bottom. Include a case where the text has an opaque ancestor and must still fail.
    - **Property 2: Preservation** - Only intersecting rects fail
    - Add a property test over random rect pairs: GO1 fails exactly when the rects intersect. Run the file until it passes.
    - _Requirements: 2.6, 2.10_

- [x] 9. D7: Break the seal columns grouped and Soil clear of text
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~450 changed lines
  - Scope: `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/layout.ts`, `src/components/ceremony/seal/**` and `src/components/ceremony/figures/**` (attributes and placement only), `src/components/ceremony/scene/SoilStrip.tsx` (attribute only), `src/components/ceremony/scene/break-columns.test.ts` (new).
  - Design sections: "D4 and D7 overlap / GO1", "D7 grouping / LC1".

  - [ ] 9.1 Reserve the Soil clearance under the marks column
    - At 900 px and wider, the marks column gets `padding-block-end: var(--soil-clear)`, so no text line sits under the Soil_Band. The Seal group keeps its current position, which is set from `--ghost-cx` and `--ghost-w` (the #515 fix). Figures and the Seal group are not placed on a shared grid, because they never appear on screen together (`marks` and `seal` come before `figures`).
    - Add `data-figures-column`, `data-seal-group` and `data-soil-strip` (if missing) to the components that render them.
    - Create the source test: `padding-block-end: var(--soil-clear)` exists in the 900 px rules, the Seal group still reads `--ghost-cx`, and the layout below 900 px is unchanged. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "break" AND S.width >= 900 AND EXISTS t IN S.text : overlaps(t.box, S.soil.drawnBox)_
    - _Expected_Behavior: Soil clear of every text line at 900 px and wider_
    - _Preservation: layout below 900 px unchanged; figures, provenance and copy unchanged; Seal group position unchanged (#515)_
    - _Requirements: 1.9, 2.9, 3.7_

- [x] 10. LC1 rule and GO1 (Soil): columns coherent, Soil clear
  - Agent: `platform-dev` · Depends on: 8, 9 · Estimated size: M, ~450 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-lc1.test.ts` (new).
  - Design sections: "D7 grouping / LC1", "D4 and D7 overlap / GO1".

  - [ ] 10.1 Add LC1, extend GO1 to the Soil strip, and wire both
    - Add `lcFailures(reading)` and the reader. It fails when `sealGroup.left - figures.right > 64`, or when `sealGroup.top` is outside `[figures.top, figures.bottom]`. Extend `goFailures` and its reader to test `[data-soil-strip]`.
    - Edit `tools/qa/layout-check.mjs` to run LC1 on Maya's Break the seal at 1440x900, and GO1 with the Soil on Break the seal at 1440x900 and 390x844, as blockers.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step = "break" AND S.width >= 900 AND (EXISTS t IN S.text : overlaps(t.box, S.soil.drawnBox) OR S.sealGroup.left - S.figures.right > 64)_
    - _Expected_Behavior: LC1 and GO1 fail on main's reading and pass on the fixed build_
    - _Preservation: no existing row is loosened_
    - _Requirements: 2.9, 2.10_

  - [ ] 10.2 Write the LC1 and Soil tests
    - **Property 1: Bug Condition** - Columns grouped and Soil clear
    - Create `src/lib/layout-check-lc1.test.ts`. Failing fixtures from main: gap 134 px; text `y 419..440` against Soil `40..488 x 419..545`. Passing fixtures: gap 48 px with the Seal group top inside the column span; text ending above the Soil top. Boundaries at gap 64 (pass) and 65 (fail).
    - **Property 2: Preservation** - Only gaps over 64 px fail
    - Add a property test over random gaps: LC1 fails exactly when the gap exceeds 64. Run the file until it passes.
    - _Requirements: 2.9, 2.10_

- [x] 11. D1: Seal panel fills its surface and the wax is at least 44 px at rest
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~350 changed lines
  - Scope: `src/components/live/stepper/live-steps.ts`, `src/components/live/seal-step/seal-step.module.css`, `src/components/live/press/press.module.css`, the Seal step and press TSX files under `src/components/live/` (attributes only), `src/components/live/seal-step/seal-card.test.ts` (new).
  - Design sections: "D1 and D2 cards / SF1", "D1 wax / TT1".

  - [ ] 11.1 Drop the card for Seal, fill the panel, and raise the wax floor
    - In `live-steps.ts`, `hasPrimaryCard()` returns false for `seal`. The `write` case is unchanged.
    - In `seal-step.module.css`, `.step` uses `inline-size: 100%` in place of `margin-inline: auto`, and keeps `max-inline-size` only for the text measure inside the panel.
    - In `press.module.css`, `.wax` rests at `scale(calc(0.25 + 0.75 * var(--press-progress)))`.
    - Add `data-seal-step`, `data-press-target` and `data-wax` to the matching elements.
    - Create the source test: `hasPrimaryCard()` is false for `seal` and handles `write` as before, `.deskCard` is untouched, `.step` has `inline-size: 100%`, the wax formula reaches scale 1 at progress 1, and the stage thresholds are unchanged. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where (S.step = "seal" AND S.width >= 900 AND S.panel.width < 0.99 * S.card.width) OR (S.step = "seal" AND S.wax.atRest.width < 44)_
    - _Expected_Behavior: panel fills its surface; wax at rest at least 44x44 and growing to full size during a press_
    - _Preservation: Write desk and `.deskCard` unchanged; press-and-hold stages, halo and passkey prompt unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.3, 3.4_

- [x] 12. SF1 and TT1 rules: panel fills surface, wax meets target size
  - Agent: `platform-dev` · Depends on: 10, 11 · Estimated size: M, ~500 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-sf1-tt1.test.ts` (new).
  - Design sections: "D1 and D2 cards / SF1", "D1 wax / TT1".

  - [ ] 12.1 Add SF1 and TT1 and wire them into layout-check
    - Add `sfFailures(reading)` and `ttFailures(reading)` and their readers. SF1 fails when the panel width is under 99% of the surface width, or when a cream pixel run wider than 2 px (within 8 of `#f6ead4` per channel) sits beside the dark panel. TT1 measures the visible `[data-wax]` mark of every `[data-press-target]` or `role="button"` the reader is told to press, at rest, and fails under 44x44 CSS px. The button's size never stands in for the mark.
    - Edit `tools/qa/layout-check.mjs` to run SF1 and TT1 on Press the seal at 1440x900, 390x844 and 360x640 as blockers.
    - _Bug_Condition: isBugCondition(S) where (S.step = "seal" AND S.width >= 900 AND S.panel.width < 0.99 * S.card.width) OR (S.step = "seal" AND S.wax.atRest.width < 44)_
    - _Expected_Behavior: SF1 and TT1 fail on main's readings and pass on the fixed build_
    - _Preservation: no existing row is loosened_
    - _Requirements: 2.1, 2.2, 2.10_

  - [ ] 12.2 Write the SF1 and TT1 tests
    - **Property 1: Bug Condition** - Panel fills surface; wax meets target size
    - Create `src/lib/layout-check-sf1-tt1.test.ts`. Failing fixtures from main: SF1 `{ panelWidth: 1040, surfaceWidth: 1360 }`; TT1 wax `15x15` at 1440x900 and `10x10` at 390x844, with the button `392x253` passing alone. Passing fixtures: panel equal to the surface; wax at least 60x60. Boundaries at 99% and 44 px.
    - **Property 2: Preservation** - Only narrow panels and small marks fail
    - Add a property test over random panel and surface widths: SF1 fails exactly when the ratio is under 0.99. Run the file until it passes.
    - _Requirements: 2.1, 2.2, 2.10_

- [x] 13. D2: Wait step on the desk with one Demo label and one wax seal
  - Agent: `frontend-dev` · Depends on: 11 · Estimated size: M, ~400 changed lines
  - Scope: `src/components/live/stepper/live-steps.ts`, `src/components/live/live.module.css`, `src/components/live/stepper/LiveWaitStep.tsx`, `src/components/live/stepper/stepper.module.css`, `src/components/live/LetterCard.tsx` and its stylesheet, `src/components/live/LetterCard.test.tsx`, `src/components/live/stepper/wait-step.test.ts` (new).
  - Design sections: "D1 and D2 cards / SF1", "D5 and D2 contrast / CT1", "D2 duplicates / UQ1".

  - [ ] 13.1 Move Wait to the desk and remove the duplicates
    - In `live-steps.ts`, `hasPrimaryCard()` returns false for `wait`. In `live.module.css`, restyle the Wait `.panel` for the dark surface (dark background, desk text colour, the Seal panel's border treatment).
    - In `LiveWaitStep.tsx`, remove the in-panel `<DemoLabel />` (the Top_Bar chip stays) and pass `showSeal={false}` to `LetterCard`. In `LetterCard.tsx`, add a `showSeal` prop that defaults to true, so the printable card and PDF are unchanged. Copy, link, calendar and backup controls stay as they are.
    - Add `data-surface` (`paper` or `desk`) on the card element and make the stepper `h2` colour in `stepper.module.css` follow it (`paper` uses `--ink`, `desk` uses `--text`). Add `data-demo-label` and `data-wax-seal` to the elements that render them, if missing.
    - Create the source test: `LiveWaitStep.tsx` no longer renders `DemoLabel`, passes `showSeal={false}`, the heading string and the step order in `live-steps.ts` are unchanged, and the `LetterCard` default of `showSeal` is true. Run it and `LetterCard.test.tsx` until they pass.
    - _Bug_Condition: isBugCondition(S) where S.step = "wait" AND (EXISTS t IN S.text : contrast(t.colour, surfaceOf(t)) < threshold(t) OR COUNT(S.demoLabels) > 1 OR COUNT(S.waxSeals, firstViewport) > 1)_
    - _Expected_Behavior: every line meets contrast on its surface; one Demo label; one wax seal in the first viewport_
    - _Preservation: "Seal your own letter" and all copy unchanged; letter card content and controls unchanged; steps and the 30-second lock unchanged_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.1, 3.2, 3.10_

- [x] 14. UQ1 rule, with CT1 and SF1 on the Wait step
  - Agent: `platform-dev` · Depends on: 12, 13 · Estimated size: M, ~450 changed lines
  - Scope: `tools/qa/layout-rules-17.mjs`, `tools/qa/layout-check.mjs`, `src/lib/layout-check-uq1.test.ts` (new), `src/lib/layout-check-ct1.test.ts`.
  - Design sections: "D2 duplicates / UQ1", "D5 and D2 contrast / CT1".

  - [ ] 14.1 Add UQ1 and wire UQ1, CT1 and SF1 onto Wait
    - Add `uqFailures(reading)` and the reader: count visible `[data-demo-label]` plus the Top_Bar chip (text "Demo", as DL1 reads it), and visible `[data-wax-seal]` elements whose rect intersects the first viewport. Both counts must be exactly 1.
    - Edit `tools/qa/layout-check.mjs` to run UQ1, CT1 and SF1 on the Wait step, reached by the existing virtual-passkey walk (`LIVE_PATH`), at 1440x900 and 390x844, as blockers.
    - _Bug_Condition: isBugCondition(S) where S.step = "wait" AND (EXISTS t IN S.text : contrast(t.colour, surfaceOf(t)) < threshold(t) OR COUNT(S.demoLabels) > 1 OR COUNT(S.waxSeals, firstViewport) > 1)_
    - _Expected_Behavior: UQ1 fails on main's reading and passes on the fixed build_
    - _Preservation: the virtual-passkey walk and every passing row are unchanged_
    - _Requirements: 2.3, 2.4, 2.10_

  - [ ] 14.2 Write the UQ1 and Wait tests
    - **Property 1: Bug Condition** - One label, one seal, readable heading
    - Create `src/lib/layout-check-uq1.test.ts`. Failing fixture from main: `{ demoLabels: 2, seals: 2 }`. Passing fixture: `{ demoLabels: 1, seals: 1 }`. In `layout-check-ct1.test.ts` add the Wait cases: the h1 "Seal your own letter" as `#ffffff` on `#f6ead4` fails; white on the dark Wait surface passes.
    - **Property 2: Preservation** - Only counts other than 1 fail
    - Add a property test over random label and seal counts: UQ1 passes exactly when both are 1. Run both files until they pass.
    - _Requirements: 2.3, 2.4, 2.10_

- [x] 15. Gate script: run layout-check against the built app
  - Agent: `platform-dev` · Depends on: 14 · Estimated size: M, ~350 changed lines
  - Scope: `tools/qa/layout-gate.mjs` (new), `tools/qa/layout-check.mjs` (header comment only), `package.json` (the `layout-gate` script), `src/lib/layout-gate.test.ts` (new).
  - Design sections: "Gate".

  - [ ] 15.1 Build the gate script
    - Create `tools/qa/layout-gate.mjs` exporting `buildGateArgs(env)` (pure: sizes `1440x900,390x844`, the Chromium path from `CHROMIUM_PATH`, shots to a temp dir, never `--require`) and `main()`. `main()` starts `node .next/standalone/server.js` on a free port, waits on `/api/health`, prepares the demo personas the way the smoke job and README do (migrate, then `seal-personas`), runs `tools/qa/layout-check.mjs --url`, stops the server, and returns the exit code of `layout-check`.
    - Add the `layout-gate` script to `package.json`. Edit the header comment of `tools/qa/layout-check.mjs` to state that SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1 block with no `--require` and exit 1.
    - No Helm change: no environment variable, port, probe, migration or job is added to the app, so the chart `version` stays.
    - _Bug_Condition: isBugCondition(S) for any of D1 to D7 reaching a pull request without a failing check_
    - _Expected_Behavior: `node tools/qa/layout-gate.mjs` exits non-zero on any blocker and zero on the fixed build_
    - _Preservation: every row that passes today still passes_
    - _Requirements: 2.10, 2.11, 3.9_

  - [ ] 15.2 Write the gate tests
    - **Property 1: Bug Condition** - A blocker fails the gate
    - Create `src/lib/layout-gate.test.ts`: `buildGateArgs` returns the sizes `1440x900,390x844`, takes the Chromium path from `CHROMIUM_PATH`, and never contains `--require`. A test with a stubbed `layout-check` run shows `main()` returns its non-zero exit code and still stops the server.
    - **Property 2: Preservation** - Existing verdict tests stay
    - Add a source test that the R10.1, R10.6, R14.3, R5.4, NB1, GC1, DL1 and PV1 verdict tests still exist. Run the file until it passes.
    - _Requirements: 2.10, 2.11, 3.9_

- [ ] 16. D7 again: desktop Break the seal and Remember clear of the step track, the Soil and the Ghost
  - Agent: `frontend-dev` · Depends on: none · Estimated size: M, ~300 changed lines
  - Scope: `src/components/ceremony/scene/scene.module.css`, `src/components/ceremony/scene/layout.ts`, `src/components/ceremony/ceremony.module.css` (the step track and the first block under it only), `src/components/ceremony/seal/**`, `src/components/reveal/Reveal.tsx` and `src/components/reveal/reveal.module.css` (placement only), `src/components/ceremony/scene/break-columns.test.ts`.
  - Design sections: "D4 and D7 overlap / GO1", "D7 grouping / LC1".
  - Why: the D7 fix (#600) moved the figures off the Soil box but left them touching it, and kept the Seal group placed from the Ghost. The gate first measured these screens when GO1 and LC1 were tightened (Soil clearance, the step track gap, LC1 on the marks card). Judges will use a desktop, so these are the screens that matter for the demo.

  - [ ] 16.1 Clear the step track, the Soil and the Ghost at 1440x900
    - On the Remember step, the first line under the step track ("A letter from Maya", "A letter from Tomás") starts at least 16 px below the track. Measured on main: 1 px.
    - On Break the seal, the heading "You remembered, just now" starts at least 16 px below the step track (main: -1 px); the Seal group's left edge is at most 64 px right of the marks card `[data-card="marks"]`, with its top inside the card's span (main: 154 px); no text line is within 8 px of the Soil strip's box (main: "3.79 USD per gallon" and "1.62 EUR per litre" 17 px into it); and no text or control overlaps the Ghost's drawn box (main: "What you remembered is recorded." and "Press and hold the wax seal to break it," inside the glow).
    - This replaces task 9.1's decision that the Seal group keeps its position from `--ghost-cx` (#515). The Seal group and the Ghost move together so the Ghost still holds the envelope; the layout below 900 px is unchanged.
    - Update `break-columns.test.ts` so its source assertions match the new placement. Run it until it passes.
    - _Bug_Condition: isBugCondition(S) where S.persona AND S.step IN {"recall", "break"} AND S.width >= 900 AND (gap(track, firstLine) < 16 OR S.sealGroup.left - S.marks.right > 64 OR EXISTS t IN S.text : gap(t.box, S.soil.box) < 8 OR EXISTS t IN S.text + S.controls : overlaps(t.box, S.ghost.drawnBox))_
    - _Expected_Behavior: at 1440x900, for us-maya and eu-tomas, `layout-check` reports no GO1 or LC1 blocker on the recall and marks stages_
    - _Preservation: layout below 900 px unchanged; figures, provenance, copy, controls and step order unchanged; the Ghost still holds the envelope until the break_
    - _Requirements: 2.6, 2.9, 3.7_
    - After merge the owner removes the matching 1440x900 GO1 and LC1 entries from `tools/qa/layout-gate-baseline.json` (platform-dev's path, outside this task's scope), so the gate blocks them from then on.

## Deferred (not a task yet)

Not numbered, so `spec_sync` opens no issue for it. Promote it to a task after the demo.

- **Phone layout on the persona demo and `/demo/live` (390x844).** Judges are expected to use a desktop, so this waits. Entries in `tools/qa/layout-gate-baseline.json`, measured on main:
  - GO1 soil-overlap on Remember question 2 (16 for us-maya, 17 for eu-tomas): the answer scale numbers, the unit line and the sample-answer note sit on the Soil strip, at the start and scrolled to the bottom.
  - GO1 soil-overlap on Break the seal (3 per persona): "Press and hold the wax seal to break it," and the "Break the seal" button, scrolled to the bottom.
  - GO1 ghost-overlap on Remember and Break the seal, already in the baseline before this change.
  - CW1 on `/demo/live`: the content column is 310 px on the Write step and 294 px on Press the seal, want at least 342 px.

## Owner edits (done before task 1)
The owner has already made the owner-only edits, so no task changes these files:
- `scripts/check.sh` runs `node tools/qa/layout-gate.mjs` as the step "layout-check (blockers)" after the JS budget, when `CI` or `LAYOUT_CHECK=1` is set. It is skipped until `tools/qa/layout-gate.mjs` exists, so tasks 1 to 14 are unaffected. Once task 15 adds the gate script, it must pass in CI as part of that task's PR.
- `.github/workflows/ci.yml` sets `CHROMIUM_PATH: /usr/bin/google-chrome` on the `scripts/check.sh` step. `DATABASE_URL` is unchanged, and `ci-gate` already requires `checks`.
- `.github/agents.json` needs no change: `tools/qa/**` and `src/lib/*.test.ts` are platform-dev's.
- `docs/agent-loop.md` describes the new step.
