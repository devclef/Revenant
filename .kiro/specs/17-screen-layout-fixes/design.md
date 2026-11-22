# Screen Layout Fixes Bugfix Design

## Overview

Seven screens of the live demo and the persona demos are visibly broken (D1 to D7 in `bugfix.md`), and the checks that exist did not stop any of them. The fix has two halves that ship together, one defect at a time:

1. Each defect gets a targeted CSS or component change. Copy, step order and controls do not change.
2. Each defect gets a paired `layout-check` rule (SF1, TT1, CT1, UQ1, CW1, GO1, FR1, LC1) that is a blocker with no `--require` flag. Each rule is a pure verdict function exported from `tools/qa/` plus a browser reader. The unit test for the verdict holds the measurements taken on the unfixed `main` as a failing fixture and the post-fix measurements as a passing fixture. That test is the fail-on-main evidence. It lives in the same commit as the fix.

Three decisions are made and stated as such:

- The loop builds `tools/qa/layout-gate.mjs`. The owner wires it into `scripts/check.sh`, which `ci.yml` runs and `ci-gate` requires, so a blocker fails `ci-gate`.
- The Wait step shows one wax seal in the first viewport. The sealed envelope keeps its seal. The letter card keeps all its content, its link and its calendar and backup controls. Only the card's decorative wax mark is not drawn while the card is shown inside the Wait step (the printable card and PDF are generated elsewhere and are unchanged).
- On Maya's Break the seal at 900 px and wider, the Seal group's left edge is at most 64 px from the right edge of the figures column.

## Glossary

- **Bug_Condition (C)**: `isBugCondition(S)` in `bugfix.md`: a rendered screen state that matches any of D1 to D7.
- **Property (P)**: the screen state after the fix, which passes SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1.
- **Preservation**: copy, step order, controls, 30-second lock, Write desk, press-and-hold behaviour, receipts layout at 900 px and wider, data values and every row that passes today.
- **Surface**: the nearest ancestor of an element that paints an opaque background (or a gradient or image), as the browser composites it. Never a design token.
- **Drawn box**: the box a decorative layer paints: for the Ghost, the body, hem and glow with no inner margins trimmed; for the Soil, `[data-soil-strip]`.
- **Press target**: the visible mark the reader is told to press (the wax), not the button or wrapper that holds it.
- **Verdict function**: a pure `xxFailures(reading)` function in `tools/qa/` that returns failure messages. The browser reader only collects the reading.
- **`hasPrimaryCard()`**: in `src/components/live/stepper/live-steps.ts`; decides whether a step sits on the cream `.card`.
- **`--content-column-max`**: the CSS variable set on `.scene` in `scene.module.css`, `min(34rem, 46vw)`.

## Bug Details

### Bug Condition

The bug manifests on seven screens. The conditions are the ones in `bugfix.md`. In short: the Seal and Wait steps keep a paper card their content no longer fits (D1, D2); the receipts column uses the Ghost's 46vw cap on a phone (D3); the phone Ghost layer ignores the intro text (D4); the Previous control and the script-focused heading assume the wrong surface or focus mode (D5, D6); the Break the seal step places figures, Seal group and Soil by three separate systems (D7).

**Formal Specification:**
```
FUNCTION isBugCondition(S)
  INPUT: S of type Screen (step, viewport, DOM, computed styles)
  OUTPUT: boolean

  RETURN (S.step = "seal" AND S.width >= 900 AND S.panel.width < 0.99 * S.card.width)
      OR (S.step = "seal" AND S.wax.atRest.width < 44)
      OR (S.step = "wait" AND EXISTS t IN S.text : contrast(t.colour, surfaceOf(t)) < threshold(t))
      OR (S.step = "wait" AND (COUNT(S.demoLabels) > 1 OR COUNT(S.waxSeals, firstViewport) > 1))
      OR (S.persona AND S.step = "receipts" AND S.width <= 480 AND S.column.width < S.width - 48)
      OR (S.persona AND S.step = "remember" AND S.width <= 480
            AND EXISTS t IN S.textAndControls : overlaps(t.box, S.ghost.drawnBox))
      OR (S.step = "remember" AND S.previousControl.visible
            AND contrast(S.previousControl.colour, surfaceOf(S.previousControl)) < 4.5)
      OR (S.step = "remember" AND S.noInputYet AND S.activeElement.isNonInteractive
            AND S.activeElement.outline.visible)
      OR (S.persona AND S.step = "break" AND S.width >= 900
            AND (EXISTS t IN S.textAndControls : overlaps(t.box, S.soil.drawnBox)
                 OR S.sealGroup.left - S.figures.right > 64))
END FUNCTION
```

### Examples

- D1: at 1440x900 the Seal panel is 1040 px wide in a 1360 px cream card. Expected: no cream strip beside the panel. The wax is 15 px (10 px at 390x844) inside a 392 px button. Expected: at least 44 px.
- D2: the Wait h1 "Seal your own letter" is `#ffffff` on `#f6ead4`, about 1.2:1. Two "Demo" labels and two wax seals show. Expected: 4.5:1 or 3:1 for large text, one label, one seal.
- D3: at 390 px the receipts column is 179.4 px with 89 px margins. Expected: at least 342 px (390 minus 48).
- D4: the Ghost body box 164..220 x 143..208 and its hem overlap "A letter from Maya" at y 206..224. Expected: no overlap with the drawn box.
- D5: "Previous question" is `#ffffff` on cream, about 1.2:1. Expected: ink text and a visible border.
- D6: on load the `h2[tabindex="-1"]` shows a 2 px solid dark outline. Expected: no outline on the heading; the first Tab stop still shows its ring.
- D7: the Soil strip 40..488 x 419..545 crosses the diesel line at y 419..440, and the Seal group is 134 px from the figures. Expected: Soil clear of all text, gap at most 64 px.
- Edge: at 899 px and below, D7's gap rule does not apply (the Ghost column cap and single-column layout stay as today).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Every word on every screen, in the same order (3.1). "Seal your own letter", "Press the seal." and the persona questions and recollections are not touched.
- Steps, controls, Back rules and the 30-second lock (3.2).
- The Write step's desk with paper pieces and no card paper (3.3).
- Press and hold: growth with progress, pool stages, halo when ready, passkey prompt on release (3.4). Only the resting size changes.
- Testify, Break the seal and Receipts of the live demo on the desk, and the Ghost from emergence to the break only (3.5).
- Receipts column width and order at 900 px and wider, and the 46vw cap where the Ghost sits beside a column (3.6).
- Figures, provenance, periods, "historical record" labels, no judgement colour (3.7).
- Calm mode and `prefers-reduced-motion` (3.8).
- Landing, `/demo`, Priya, the EU persona and every `layout-check` and `journey-check` row that passes today (3.9). No row is loosened.
- One h1 per step, focus moves to the step heading, accessible names and tab order (3.10).

**Scope:** every screen state for which `isBugCondition` is false is unaffected. That includes the Write step, all desktop-width receipts, the landing page and the EU persona.

## Hypothesized Root Cause

Per defect. "Confirmed" means measured in a browser in `root-causes.md`; "Likely" is read from CSS and each is isolated by the same change that fixes it.

1. **D1 slab (confirmed card, likely sizing).** `hasPrimaryCard()` returns true for `seal` and `wait`, so both sit on the paper `.card`. The Seal panel is its own `#0b0912` surface with `max-width: 1240px; margin-inline: auto` as a grid item in `.primary`. An auto-margin grid item sizes to its content, and the press column adds no intrinsic width, so it measures 1040 px in a 1360 px card.
2. **D1 wax (confirmed).** `press.module.css` `.wax` uses `scale(calc(0.15 + 0.85 * var(--press-progress)))`. At rest the progress is 0, so the wax is 15% of its box. The old P1 row measures the button (392x253), which passes.
3. **D2 (confirmed).** Same `hasPrimaryCard()` cause. `LiveWaitStep` renders `.panel` (paper) in the card. `stepHeading("wait")` returns `<h1 class="liveHeading">` whose colour is `--text` (white, the desk colour). The stepper adds an `h2` "Wait" in `--ink`, so the card holds two headings from two surface assumptions. DEMO twice: the Top_Bar chip from `SceneShell demo` and `<DemoLabel />` in `LiveWaitStep`. Seal twice: `SealedEnvelopeView` draws a seal and `LetterCard` draws a `WaxSeal`.
4. **D3 (confirmed).** `.receipts` takes `max-inline-size: var(--content-column-max)` and `margin-inline: auto`. The variable is `min(34rem, 46vw)`, which exists to keep the column clear of the Ghost at 900 px and wider. On a phone the Ghost has left by Receipts, so the cap only narrows the column. The live demo uses the same variable.
5. **D4 (confirmed).** Below 600 px `.ghostLayer` is anchored to the document and the Ghost sits at about y 130..219. The Persona_Intro starts at y 206 and nothing reserves space under the Ghost. The hem is drawn below the "Ghost_Body_Box" the old checks use.
6. **D5 (confirmed).** `NavRow.module.css` `.previous` is `#ffffff` on transparent. Its comment says the recall surface is the dark Scene. The recall card has been paper since specs 15 and 16.
7. **D6 (confirmed).** The heading is `tabindex="-1"` and gets script focus in `CeremonyRoot.tsx` `focusHeading`. The rules that hide the ring use `:focus:not(:focus-visible)`. Chromium treats script focus before any input as `:focus-visible`, so `.desk :focus-visible` and `.onPaper :focus-visible` draw a 2 px outline.
8. **D7 (likely).** The figures sit in a column (`max-width: min(28rem, 40vw)`), the Seal group is `position: absolute` in `.marksLayer` and placed from the Ghost's geometry (`--ghost-cx`, `--ghost-w`), and the Soil is anchored to the Scene root's bottom. The column is anchored from the top and does not reserve `--soil-clear`.

### Why the existing checks missed each defect

| Defect | What exists | Why it passed or did not fail |
|---|---|---|
| D1 slab | `layout-check` W and W1.6 measure the Write step. P1 measures the Seal step. | Nothing compares a panel to the surface it sits on. P1 asks for the largest focusable element, at least 44x44, and the only orange control. |
| D1 wax | P1 | P1 measures the button (392x253). The wax is a child that the transform shrinks, and it is never measured. |
| D2 | T1 and TG2 (wait-envelope, wait-ghost) | They print "not reached" on every run. `journey-check` J9 stops before pressing the seal. The live walk that seals with a virtual passkey runs only R10.1 and R10.6. |
| D2 contrast | `contrast.test.ts` and similar | They read hex values from CSS tokens and check named pairs. No browser check reads a text node's colour against its real background. |
| D3 | W1 and R10.6 | W1 fails at 390 on today's build (135.0 px) but `layout-check` is not in `ci.yml`, `scripts/check.sh` or any workflow, and `journey-check` does not run it. R10.6 passes because it demands equality between two equally narrow columns. |
| D4 | G1 and GT1 | G1 skips text with an opaque ancestor, and the `.desk` wrapper is opaque, so all text in it is skipped (0 hits). GT1 finds it (`hits=2 "A letter from Maya"`) but it is a polish row, neither in `SPEC15_CHECKS` nor passed with `--require`. Both use the trimmed body box. |
| D5 | none | No check compares a control's colour to its background. "Previous question" appears only from question 2, and the walks answer through it without measuring. |
| D6 | FC1, step-indicator rows, `checkHeadingRing` | FC1 checks that focus is on the heading, not that it draws a ring. Unit tests assert the CSS rule exists, not what Chromium does on load. |
| D7 | F1, F2, SG1, G2 | F2 blocks only when the text is not on an opaque panel. The figures sit in a panel, so it reports at polish level. Nothing measures the distance between columns. |

Two gaps apply to everything. `layout-check` and `journey-check` share no library, and `journey-check` measures only step name, sideways scroll, Motion_Control count and console errors. And a run on `main` ends with "Blockers: 3 Polish: 105 Not reached: 96", so polish rows that already held the D4 and D7 overlaps were never read. The new rules are blockers and run in CI, which removes both gaps for these defects.

## Correctness Properties

Property 1: Bug Condition - Screens render without the seven layout defects

_For any_ screen state where the bug condition holds (isBugCondition returns true), the fixed render SHALL satisfy SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1 as measured by the browser: the Seal panel fills its surface with no cream strip; the wax at rest is at least 44x44 CSS px; every text node meets 4.5:1 (3:1 at 24 px or 18.66 px bold) against its composited surface; the Wait step shows one Demo label and one wax seal in the first viewport; the main column is at least the viewport width minus 48 px at 390x844 and 360x640; no text or control overlaps the Ghost's or the Soil's drawn box; no non-interactive element shows an outline on script focus while the next Tab stop shows one; and the Seal group is at most 64 px from the figures column with its top inside the column's vertical span.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - Unaffected screens and flows render as before

_For any_ screen state where the bug condition does NOT hold (isBugCondition returns false), the fixed render SHALL produce the same copy and the same flow as the original render, and every `layout-check` and `journey-check` row that passes today SHALL still pass, preserving the Write desk, the press-and-hold behaviour, the desktop receipts width and order, the Ghost lifetime, the data values and the keyboard and screen-reader behaviour.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

Property 3: Gate - A blocker fails the required check

_For any_ pull request build where one of the eight rules fails on a covered screen and size, `tools/qa/layout-gate.mjs` SHALL exit non-zero, and once the owner has wired it into `scripts/check.sh`, `ci-gate` fails.

**Validates: Requirements 2.10, 2.11**

## Fix Implementation

### Changes Required

#### Shared rule module

**File**: `tools/qa/layout-rules-17.mjs` (new, created by the first work unit and extended by each later one)

Each rule exports a verdict function and a browser reader string, and `layout-check.mjs` imports them. Every failure message names the element, the measured value and the threshold, for example `CT1 h1 "Seal your own letter" colour #ffffff on #f6ead4 = 1.2:1, want 3:1`. The rule IDs are added to `SPEC15_CHECKS` style always-block handling (no `--require`). The rules are listed in the order of the work units.

#### Per-defect fix and paired rule

**D6 / FR1 (focus ring on a script-focused heading)**
- Fix: in `ceremony.module.css` and `RecallReader.module.css` (`globals.css` is platform-dev's and is not touched), add `h1[tabindex="-1"]:focus, h2[tabindex="-1"]:focus, [data-step-heading]:focus { outline: none }`, scoped to non-interactive focus targets. `.desk :focus-visible` and `.onPaper :focus-visible` stay for every control. `focusHeading` is unchanged, so 3.10 holds.
- Rule FR1: load the step with no input; read `document.activeElement`; compute `getComputedStyle(el).outlineStyle`/`outlineWidth`/`outlineColor` (visible when style is not `none`, width above 0 and colour alpha above 0). Fail when the active element is non-interactive (`tabindex="-1"` and not a link, button, input, select, textarea or `[role=button]`) and its outline is visible. Then press Tab once, read the new active element, and fail when it is interactive and its outline is not visible (a control the reader tabs to must show a ring). Runs on every step the walk reaches, at both sizes.

**D5 and D2 contrast / CT1 (computed colour against the real composited background)**
- Fix D5: `NavRow.module.css` `.previous` uses the paper ink (`--ink`, `#1f1b16`) for text and `1px solid` the same ink for the border, on the cream. Ink on `#f6ead4` is above 14:1. The dark-scene comment in the file is replaced.
- Fix D2 (heading): once the Wait step is on the desk (D2 fix below), the h1 stays white on the dark surface, and the stepper `h2` takes its colour from the surface through a `data-surface` attribute on the card (`paper` uses `--ink`, `desk` uses `--text`), so no heading is drawn in a colour chosen for the other surface.
- Rule CT1 reader: for every visible text node (a `TreeWalker` over text nodes with a non-empty trimmed value, parent not `display: none`, `visibility: hidden` or zero-size), read the parent's computed `color` and `font-size`/`font-weight`. Composite the colour over its surface: walk ancestors upward, collect each computed `background-color`, stop at the first with alpha 1, and blend the collected colours bottom-up with the standard alpha formula (including the element's own `opacity` chain). If any ancestor on the way has a `background-image` other than `none` (gradient or image), sampling replaces the arithmetic: set the text colour to transparent, take a clipped screenshot of the text's line box, draw it to a canvas in the page, and read every pixel; the surface luminance is the worst case (the one that gives the lowest ratio). No design token is read at any point. The verdict function takes `{ text, colour, surface, fontPx, bold }`, computes the WCAG ratio, and fails below 4.5, or below 3 when `fontPx >= 24` or `bold && fontPx >= 18.66`. Runs on the Press the seal, Wait, Remember (after answering question 1 so "Previous question" exists), Break the seal and Receipts steps and the landing page.

**D1 and D2 cards / SF1 (panel fills its surface)**
- Fix: `hasPrimaryCard()` in `live-steps.ts` returns true only for `write`'s non-paper desk case today; after the fix it returns false for `seal` and `wait`, so they sit on the desk like Testify, Break the seal and Receipts (3.5). `.step` in `seal-step.module.css` drops `margin-inline: auto` for `inline-size: 100%` with `max-inline-size` kept only for text measure inside the panel. The Wait `.panel` in `live.module.css` is restyled for the dark surface (dark background, desk text colour, the same border treatment as the Seal panel).
- Rule SF1 reader: find the step's content surface (`[data-seal-step]` or `[data-wait-step]`) and the nearest ancestor that paints a different surface (`[data-card]` or the Scene frame). Reading: `{ panelWidth, surfaceWidth, creamRun }`. Verdict fails when `panelWidth < 0.99 * surfaceWidth`, or when a clipped screenshot row at mid-height of the card, sampled across the card's width, holds a cream-coloured run (within 8 of `#f6ead4` per channel) wider than 2 px beside the dark panel. Runs on Press the seal at 1440x900 and 390x844.

**D1 wax / TT1 (press target size measured on the visible wax)**
- Fix: in `press.module.css`, `.wax` rests at `scale(calc(0.25 + 0.75 * var(--press-progress)))`. At the narrowest container (about 240 px at 360 px viewport) the wax is at least 60 px, at 392 px it is 98 px, and it still grows to full size during a press (3.4).
- Rule TT1 reader: select every element with `[data-press-target]` or `role="button"` that the step tells the reader to press, plus the visible mark inside it (the `.wax` element, found by `[data-wax]`). Take `getBoundingClientRect()` of the mark, which includes the transform. Verdict fails when any width or height is under 44 CSS px, naming the element. The button wrapper's size is read too but never stands in for the mark. The wax is measured at rest, before any pointer event. Runs on Press the seal at both sizes and at 360x640.

**D2 duplicates / UQ1 (one Demo label, one wax seal)**
- Fix: `LiveWaitStep.tsx` does not render `<DemoLabel />` inside the panel because the Top_Bar chip already shows it (the same rule DL1 uses on `/demo`). `SealedEnvelopeView` keeps its seal. `LetterCard` gets a prop `showSeal` that the Wait step passes as false; the card's text, link, calendar and backup controls are unchanged, and the printable card and PDF do not use the prop.
- Rule UQ1 reader: count visible `[data-demo-label]` plus the Top_Bar chip (text "Demo", as DL1 reads it) and count visible `[data-wax-seal]` elements whose rect intersects the first viewport (`0..innerHeight`). Verdict fails when either count is not exactly 1. Runs on the Wait step, reached by the existing virtual-passkey walk (`LIVE_PATH`), at both sizes.

**D3 / CW1 (minimum content width)**
- Fix: in `scene.module.css`, `--content-column-max` keeps `min(34rem, 46vw)` inside `@media (min-width: 900px)` and is `min(34rem, 100%)` below it, so the receipts column and the live receipts column are the viewport minus the 16 px page padding a side. The Ghost cap still applies at 900 px and wider (3.6).
- Rule CW1 reader: for the step's main content column (`[data-content-column]`, added to the receipts, recall, write and seal columns), read the content box width (`clientWidth` minus padding). Verdict fails when it is under `viewportWidth - 48`, and states the viewport, the width and the minimum. It runs at 390x844 and 360x640 only, on every step the walk reaches, and replaces equality (R10.6) with a minimum: R10.6 keeps its comparison and CW1 adds the floor.

**D4 and D7 overlap / GO1 (Ghost and Soil rect against every text and control rect)**
- Fix D4: the phone Ghost layer exposes its drawn bottom (body, hem and glow) as `--ghost-bottom`, and the Persona_Intro takes `margin-block-start: max(0px, calc(var(--ghost-bottom) - var(--intro-top)))` so the intro starts below the drawn box. The Ghost's position and the copy do not change.
- Fix D7 (Soil): the marks column reserves `padding-block-end: var(--soil-clear)` so the last figure line ends above the Soil strip's top edge.
- Rule GO1 reader: collect the drawn box of the Ghost (`[data-ghost-box]` extended by the hem and glow, with no inner margins removed) and of the Soil (`[data-soil-strip]`). Collect the rect of every text line (a `Range` per text node, `getClientRects()`) and every control. Opaque ancestors are not an exemption: text inside `.desk` and inside paper panels is tested. Verdict fails on any intersection, naming the text or control, the layer and the overlap in px. It runs at the start of the step and again after scrolling to the bottom, and is a blocker, replacing GT1's polish level and G1's opaque-ancestor skip for these screens. Runs on Remember at 390x844, and Break the seal at 1440x900 and 390x844.

**D7 grouping / LC1 (column coherence)**
- Fix: at 900 px and wider, the figures column and the Seal group share one grid in `scene.module.css`. The Seal group is a grid item placed in the column to the right of the figures with `column-gap: 48px`, and its top is aligned to the figures column's top. The Ghost keeps its place. The Seal group is no longer positioned from `--ghost-cx` and `--ghost-w`.
- Rule LC1 reader: read the right edge of the figures column (`[data-figures-column]`), the left and top of `[data-seal-group]`, and the column's top and bottom. Verdict fails when `sealGroup.left - figures.right > 64`, or when `sealGroup.top` is outside `[figures.top, figures.bottom]`. The 64 px threshold is decided. Runs on Maya's Break the seal at 1440x900.

#### Gate

**Files built by the loop**: `tools/qa/layout-gate.mjs` (new), `package.json` (script `layout-gate`), `src/lib/layout-gate.test.ts`.

- `layout-gate.mjs` exports `buildGateArgs(env)` (pure: sizes `1440x900,390x844`, the Chromium path from `CHROMIUM_PATH`, shots to a temp dir, no `--require`) and a `main()` that starts `node .next/standalone/server.js` on a free port, waits on `/api/health`, prepares the demo personas the way the smoke job and README prepare them (migrate, then `seal-personas`), runs `layout-check.mjs --url`, stops the server, and returns the exit code of `layout-check`. `layout-check` already exits 1 on a blocker.
- **Owner edits after the last task** (agents cannot change these files): add `step "layout-check (blockers)"; node tools/qa/layout-gate.mjs` to `scripts/check.sh` after the build and the JS budget, running when `CI` is set or `LAYOUT_CHECK=1` and printing a skip line otherwise; set `CHROMIUM_PATH: /usr/bin/google-chrome` on the `scripts/check.sh` step in `ci.yml` (the binary `journey-check.yml` uses); adjust `.github/agents.json` only if needed; note the step in `docs/agent-loop.md`. `ci-gate` already requires `checks`, so the gate job is unchanged.
- No Helm change: no environment variable, port, probe, migration or job is added to the app, so the chart `version` does not change.

## Testing Strategy

### Validation Approach

Each work unit changes code and adds the rule and its test in the same commit. The test asserts the rule's verdict on two fixtures. The failing fixture holds the measurements taken on the unfixed `main` (the numbers in `bugfix.md` and `root-causes.md`). The passing fixture holds the values the fixed CSS produces. A source-level test reads the CSS and the component file and asserts the change that makes the passing fixture true (the existing pattern in `write-fit.test.ts` and `topbar-slot-css.test.ts`). The browser run of `layout-check` in the gate then reads the real geometry.

### Exploratory Bug Condition Checking

**Goal**: surface counterexamples on the unfixed code, and confirm or refute the root causes. The two likely causes (D1 sizing, D7 placement) are isolated inside their own work units, because each unit's source test names the property that actually produces the measurement (for D1, `inline-size: 100%` replacing the auto margin; for D7, the grid placement replacing `--ghost-cx` positioning). If the first measurement in the unit contradicts the hypothesis, the unit's fix follows the measurement and the unit's fixture reflects it.

**Test Cases** (verdict fixtures from the unfixed `main`):
1. **SF1**: `{ panelWidth: 1040, surfaceWidth: 1360 }` fails (0.76 against 0.99).
2. **TT1**: wax `15x15` at 1440x900 and `10x10` at 390x844 fail; the button `392x253` passes alone and must not stand in for the mark.
3. **CT1**: `#ffffff` on `#f6ead4` (about 1.2:1) fails for the Wait h1 and for "Previous question".
4. **UQ1**: `{ demoLabels: 2, seals: 2 }` fails.
5. **CW1**: `{ width: 179.4, viewport: 390 }` fails (minimum 342).
6. **GO1**: text box `36..348 x 206..224` against the Ghost drawn box `164..220 x 143..208` plus hem fails; text `y 419..440` against Soil `40..488 x 419..545` fails.
7. **FR1**: active element `H2` with outline `2px solid rgb(31, 27, 22)` fails.
8. **LC1**: gap 134 px fails.

**Expected Counterexamples**: the numbers above. Causes: paper card kept for dark content, transform floor at 0.15, white-on-cream tokens, document-anchored Ghost layer, `:focus-visible` matching script focus, three placement systems on one step.

### Fix Checking

**Goal**: for all inputs where the bug condition holds, the fixed screen passes the paired rule.

**Pseudocode:**
```
FOR ALL S WHERE isBugCondition(S) DO
  S' := render_fixed(S)
  ASSERT NOT isBugCondition(S')
  ASSERT SF1(S') AND TT1(S') AND CT1(S') AND UQ1(S')
     AND CW1(S') AND GO1(S') AND FR1(S') AND LC1(S')
END FOR
```

### Preservation Checking

**Goal**: for all inputs where the bug condition does not hold, the fixed render is the same.

**Pseudocode:**
```
FOR ALL S WHERE NOT isBugCondition(S) DO
  ASSERT copy(render(S)) = copy(render_fixed(S))
  ASSERT flow(render(S)) = flow(render_fixed(S))
  ASSERT layoutCheckResult(render(S)) <= layoutCheckResult(render_fixed(S))
END FOR
```

**Testing Approach**: property-based tests over the pure verdict functions (random viewport, panel and surface sizes, random colour pairs, random rect pairs), and source-level tests that pin what must not change (copy strings, the Write step's `.deskCard`, the 46vw cap inside the 900 px query, the wax growth term, `focusHeading`).

**Test Cases**:
1. **Copy and flow**: the string literals of the touched components and the order in `live-steps.ts` equal their pre-fix values.
2. **Write desk**: `hasPrimaryCard()` still handles `write` as before and `.deskCard` is untouched.
3. **Press behaviour**: the wax formula still reaches scale 1 at progress 1 and keeps its stage thresholds.
4. **Desktop receipts**: `--content-column-max` is still `min(34rem, 46vw)` at 900 px and wider.
5. **Existing rows**: R10.1, R10.6, R14.3, R5.4, NB1, GC1, DL1 and PV1 verdict tests are unchanged and still pass.

### Unit Tests

- One test file per rule in `src/lib/` (`layout-check-sf1.test.ts` and so on), in the style of `layout-check-spec16-rows.test.ts`: failing fixture, passing fixture, boundary values (99% exactly, 44 px exactly, 4.5:1 and 3:1 exactly, `width = viewport - 48`, gap 64 and 65, outline width 0).
- CT1 compositing: opaque, semi-transparent over opaque, nested alpha, and the gradient fallback's worst-pixel choice.
- Source tests for each CSS and component change listed above.
- `buildGateArgs`: sizes, Chromium path from the environment, and no `--require`.

### Property-Based Tests

- For random `(panelWidth, surfaceWidth)`, SF1 fails exactly when the ratio is under 0.99.
- For random colour pairs and font sizes, CT1 agrees with the WCAG formula and the large-text threshold switch.
- For random rect pairs, GO1 fails exactly when the rects intersect, including pairs where the text has an opaque ancestor.
- For random viewport widths from 360 to 899, CW1 fails exactly when the column is under `width - 48`.

### Integration Tests

- `layout-check` against the built app, through `layout-gate.mjs`, at 1440x900 and 390x844: the eight rules run on Press the seal, Wait (virtual-passkey walk), Remember, Break the seal, Receipts and the landing page, and the run exits 1 on any failure and 0 on today's fixed build.
- After the owner wires the gate, `scripts/check.sh` with `CI=1` runs the layout step after the build and a failing rule fails the script, so `ci-gate` fails.
- The existing spec 15 and spec 16 rows and `journey-check` J1 to J9 keep passing.

## Work Units

Each defect is two tasks, one per role, so each PR stays inside one role's paths in `.github/agents.json`. The frontend-dev task holds the CSS or component fix, the `data-*` hooks and a source test. The platform-dev task holds the rule in `tools/qa/layout-rules-17.mjs`, its wiring in `tools/qa/layout-check.mjs` and `src/lib/layout-check-<rule>.test.ts` with the unfixed-main failing fixture and the post-fix passing fixture, and depends on the fix. `src/app/globals.css` is platform-dev's, so the D6 fix is made in the two ceremony stylesheets that own the rings. Tasks run in numeric order.

| Task | Role | Defect | Files | Rule and test |
|---|---|---|---|---|
| 1 | frontend-dev | D6 | `ceremony.module.css`, `RecallReader.module.css` | source test `focus-ring-heading.test.ts` |
| 2 | platform-dev | D6 | `layout-rules-17.mjs` (new), `layout-check.mjs` | FR1, `layout-check-fr1.test.ts` |
| 3 | frontend-dev | D5 | `ceremony/recall/NavRow.module.css` | source test `nav-row-colour.test.ts` |
| 4 | platform-dev | D5 | `layout-rules-17.mjs`, `layout-check.mjs` | CT1, `layout-check-ct1.test.ts` |
| 5 | frontend-dev | D3 | `scene.module.css`, `receipts.module.css`, `data-content-column` hooks | source test `content-column.test.ts` |
| 6 | platform-dev | D3 | `layout-rules-17.mjs`, `layout-check.mjs` | CW1, `layout-check-cw1.test.ts` |
| 7 | frontend-dev | D4 | Ghost layer CSS, `intro.module.css`, `data-ghost-box` | source test `ghost-clear.test.ts` |
| 8 | platform-dev | D4 | `layout-rules-17.mjs`, `layout-check.mjs` | GO1 (Ghost), `layout-check-go1.test.ts` |
| 9 | frontend-dev | D7 | `scene.module.css`, `layout.ts`, `data-figures-column`, `data-seal-group`, `data-soil-strip` | source test `break-columns.test.ts` |
| 10 | platform-dev | D7 | `layout-rules-17.mjs`, `layout-check.mjs` | LC1 and GO1 (Soil), `layout-check-lc1.test.ts` |
| 11 | frontend-dev | D1 | `live-steps.ts`, `seal-step.module.css`, `press.module.css`, hooks | source test `seal-card.test.ts` |
| 12 | platform-dev | D1 | `layout-rules-17.mjs`, `layout-check.mjs` | SF1 and TT1, `layout-check-sf1-tt1.test.ts` |
| 13 | frontend-dev | D2 | `live-steps.ts`, `live.module.css`, `LiveWaitStep.tsx`, `LetterCard.tsx`, `stepper.module.css` | source test `wait-step.test.ts` |
| 14 | platform-dev | D2 | `layout-rules-17.mjs`, `layout-check.mjs` | UQ1, CT1 and SF1 on Wait, `layout-check-uq1.test.ts` |
| 15 | platform-dev | Gate | `tools/qa/layout-gate.mjs`, `package.json` | `layout-gate.test.ts` |

Rule tasks depend on the previous rule task as well as their fix, because they all edit `layout-rules-17.mjs` and `layout-check.mjs`. Task 15 comes last so the gate enforces rules that already pass on the fixed build. The owner then wires the gate into `scripts/check.sh` and `ci.yml` (see "Gate").
