# Bugfix Requirements Document

## Introduction

A walk of production at 1440x900 and 390x844 found seven visibly broken screens. The checks that exist today (`tools/qa/layout-check.mjs` and the scheduled `tools/qa/journey-check.mjs`) did not stop any of them. This spec fixes the screens and closes the hole in the checks: every defect below is paired with a layout-check rule that fails on today's `main` and passes after the fix.

The defects, with the measurements taken on production and on a local build of `main` (commit `ba4000f7`):

- **D1, Press the seal (`/demo/live`, desktop).** The dark Seal step panel is 1040 px wide inside a 1360 px cream card, which leaves a 300 px blank cream slab on the right. The wax at rest measures 15 px (10 px on the phone) inside a 392 px press button.
- **D2, Wait (`/demo/live`, desktop and phone).** The whole step sits on cream paper. The h1 "Seal your own letter" is drawn in the desk's white text colour on that cream. The DEMO label appears twice (Top_Bar chip and in-panel label). The wax seal appears twice (the sealed envelope and the letter card).
- **D3, Receipts (persona, phone).** The receipts column is 179.4 px wide (46vw of 390 px), centred with an 89 px margin on each side, so lines wrap after two or three words.
- **D4, Remember (persona, phone).** The Ghost's hem and body overlap the line "A letter from Maya" (text box 36..348 x 206..224, Ghost body box 164..220 x 143..208, hem drawn below it).
- **D5, Remember (persona, from question 2).** "Previous question" is white text (`#ffffff`) with a transparent background on the cream recall card. The ratio is about 1.2:1.
- **D6, Remember (persona, on load).** The question heading (an `h2` with `tabindex="-1"`) shows a solid 2 px dark focus box on load, before the reader has touched anything.
- **D7, Break the seal (Maya, desktop).** The Soil strip (40..488 x 419..545) overlaps the diesel figure line ("3.90 USD per gallon", y 419..440). The content sits in three unrelated columns: the figures at x 40, the Seal group at x 622 (a 134 px gap), the Ghost at x 812.

Your suspicion that D1 and D2 share one cause, a paper background leaking from the write desk, is half right. They do share one cause, but in the other direction. Only the Write step sheds the paper card (`.card.deskCard`). `hasPrimaryCard()` still returns true for Seal and Wait, so both are drawn on the cream `.card`, while their content was restyled for a dark surface (Seal sets its own `#0b0912` panel; the Wait heading uses the desk text colour). The root-cause notes and the reasons the checks missed each defect are in `root-causes.md` in this folder, as input for the design.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Press the seal step shows at a desktop width THEN the system draws the dark Seal panel narrower than its cream card, so a cream slab of about 300 px shows to the right of the panel.

1.2 WHEN the Press the seal step shows, at rest, before a press THEN the system draws the wax at 15% of its size (15 px at 1440x900, 10 px at 390x844), even though the press button around it is 392 px or 268 px wide.

1.3 WHEN the Wait step shows (desktop or phone) THEN the system draws the whole step on the cream card, and draws the h1 "Seal your own letter" in white on that cream.

1.4 WHEN the Wait step shows THEN the system shows the DEMO label twice, and shows the wax seal twice (the sealed envelope and the letter card).

1.5 WHEN a persona's Receipts step shows on a phone (390 px) THEN the system limits the receipts column to 179.4 px, so figure lines, source lines and notes wrap after two or three words. The live demo's receipts column is the same width.

1.6 WHEN a persona's Remember step shows on a phone THEN the system draws the Ghost over the line "A letter from Maya" and the line below it.

1.7 WHEN the "Previous question" control shows on the recall card THEN the system draws it as white text with a transparent background on cream paper.

1.8 WHEN a persona's Remember step loads and the question heading receives script focus, before any key or pointer input THEN the system draws a solid focus box around the heading.

1.9 WHEN the Break the seal step shows at 1440x900 THEN the system lets the Soil strip cross the second figure line, and places the figures, the Seal group and the Ghost in three columns with no visible relation (134 px between the figures and the Seal group).

1.10 WHEN any of 1.1 to 1.9 occurs THEN the system's checks pass: `journey-check` (J9) measures only the step name, sideways scroll, the Motion_Control count and console errors, and `layout-check` is run by hand, reports the Ghost overlap (GT1) only as polish, skips text inside the opaque dark desk when it tests the Ghost (G1), and compares the live receipts column to the persona column (R10.6) without a minimum, so 179.4 px equals 179.4 px and passes.

### Expected Behavior (Correct)

2.1 WHEN the Press the seal step shows at a desktop width THEN the system SHALL draw the Seal panel across the full width of its surface, with no strip of a different surface visible beside it. The paired rule SF1 SHALL fail on today's `main` (panel 1040 px in a 1360 px card) and pass after the fix. Evidence for SF1: the step's content surface covers at least 99% of the inline size of the surface it sits on, and no cream pixel run wider than 2 px sits inside the step card beside a dark panel.

2.2 WHEN the Press the seal step shows, at rest, before a press THEN the system SHALL draw the wax at least 44 CSS px across at every viewport from 360 px up, while the wax keeps growing during a press up to its full size. The paired rule TT1 SHALL fail on today's `main` (15 px and 10 px) and pass after the fix. TT1 measures the drawn target, not only the button that holds it: every element with `[data-press-target]` or `role="button"` that the reader is told to press, and its visible mark, is at least 44x44 CSS px.

2.3 WHEN the Wait step shows (desktop or phone) THEN the system SHALL draw every line of text on a surface that gives at least 4.5:1 contrast for body text and 3:1 for text of 24 px or larger (18.66 px bold), including the h1 "Seal your own letter". The paired rule CT1 SHALL fail on today's `main` and pass after the fix. CT1 reads each visible text node's computed colour and the real background it is drawn on: the nearest ancestor with an opaque background, and the gradient or image behind it when there is one, never a design token.

2.4 WHEN the Wait step shows THEN the system SHALL show the DEMO label once and one wax seal in the first viewport. The paired rule UQ1 SHALL fail on today's `main` (two labels, two seals) and pass after the fix. UQ1 counts visible `[data-demo-label]`, the Top_Bar chip, and visible wax seals in the first viewport of the Wait step. The letter card stays on the page with its content, its link and its calendar and backup controls unchanged.

2.5 WHEN a persona's Receipts step shows on a phone THEN the system SHALL give the receipts column at least 320 px at 390 px wide (the viewport minus the page padding of 16 px a side), centred or left-aligned with no more than 16 px of margin a side, and the live demo's receipts column SHALL match it. The paired rule CW1 SHALL fail on today's `main` (179.4 px) and pass after the fix. CW1 states a minimum, in px, for the main content column of every step at 390x844 and 360x640: the column's content box is at least the viewport width minus 48 px. Equality with another column is not a pass condition.

2.6 WHEN a persona's Remember step shows on a phone THEN the system SHALL keep the Ghost's drawn body, hem and glow clear of every text line and control on the page. The paired rule GO1 SHALL fail on today's `main` and pass after the fix. GO1 tests every text node and control on the page, including text inside the dark desk, against the Ghost's drawn box (no inner margins removed), at the start of the step and scrolled to the bottom, and it is a blocker.

2.7 WHEN the "Previous question" control shows on the recall card THEN the system SHALL draw it in the paper's ink colour with a visible border on the cream, at least 4.5:1 for its text and 3:1 for its border. The paired rule is CT1 (clause 2.3), which SHALL fail on today's `main` for this control, with the control reached by answering question 1 first.

2.8 WHEN a persona's Remember step loads and the question heading receives script focus, before any key or pointer input THEN the system SHALL draw no focus box on the heading, and SHALL still draw the visible focus ring on every control the reader tabs to. The paired rule FR1 SHALL fail on today's `main` and pass after the fix. FR1 loads each step with no input, reads the computed outline of the active element, and fails when a non-interactive element (`tabindex="-1"` heading or region) has a visible outline. It also presses Tab once and fails when the next control shows no outline.

2.9 WHEN the Break the seal step shows at 1440x900 THEN the system SHALL keep the Soil strip clear of every figure line and text line, and SHALL group the figures, the Seal group and the Ghost so the Seal group's left edge is no more than 64 px from the right edge of the figures column. The paired rules are GO1 (Soil as well as Ghost: text and controls never sit on the Soil strip's drawn box) and LC1 (column coherence: the gap between the figures column and the Seal group is at most 64 px, and the Seal group's top is inside the figures column's vertical span). Both SHALL fail on today's `main` (overlap on the diesel line, gap 134 px) and pass after the fix. The 64 px threshold is decided.

2.10 WHEN `layout-check` runs THEN the system SHALL run the rules SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1 on the live-demo Press the seal and Wait steps, the persona Remember, Break the seal and Receipts steps and the landing page, at 1440x900 and 390x844, treat every failure as a blocker with no `--require` flag, and exit 1. The Wait step SHALL be reached by the existing virtual-passkey walk. Each rule's failure message SHALL name the element, the measured value and the threshold. Each rule's pure verdict function SHALL have a unit test in the same change as its fix. The test holds the measurements taken on the unfixed `main` (the numbers in the Introduction) as a fixture that fails, and the post-fix measurements as a fixture that passes.

2.11 WHEN a pull request changes `src/app/**`, `src/components/**` or `tools/qa/**` THEN the system SHALL run `layout-check` against the built app in CI and fail the required `ci-gate` on a blocker. This is decided: the agent loop builds the gate script `tools/qa/layout-gate.mjs`, and the owner wires it into `scripts/check.sh` (which runs when `CI` or `LAYOUT_CHECK=1` is set) and sets the Chromium path in `ci.yml`, in the owner's own PR after the last task. `ci.yml` already runs `scripts/check.sh` and `ci-gate` already requires it, so a blocker then fails the gate.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any screen's copy is read THEN the system SHALL CONTINUE TO show exactly the current words, in the current order. No clause above adds, removes or rewords text, including the heading "Seal your own letter", "Press the seal.", the questions and the recollections.

3.2 WHEN a visitor walks `/demo/live` and the persona demos THEN the system SHALL CONTINUE TO follow the same steps in the same order (Write, Press the seal, Wait, Remember, Break the seal, Receipts) with the same controls, the same 30-second lock and the same Back rules.

3.3 WHEN the Write step shows THEN the system SHALL CONTINUE TO draw the desk with its paper pieces and no card paper, unchanged from today.

3.4 WHEN the wax is pressed and held THEN the system SHALL CONTINUE TO grow with progress, change pool stage (bead, spread, full), show the halo when ready, and run the passkey prompt on release exactly as today. Only the resting size changes.

3.5 WHEN the Testify, Break the seal and Receipts steps of the live demo show THEN the system SHALL CONTINUE TO sit on the desk with no paper card, and the Ghost SHALL CONTINUE TO appear only from emergence until the seal breaks.

3.6 WHEN the receipts column shows at 900 px and wider THEN the system SHALL CONTINUE TO use the current width and order (question pairs, figures, folded letter, seal line, end card), and the Ghost column cap (46vw) SHALL CONTINUE TO apply to the steps where the Ghost is present beside the column.

3.7 WHEN a persona letter, its figures and their provenance, periods and the "historical record" labels show THEN the system SHALL CONTINUE TO show the same values, with no judgement colour, per `data-integrity.md` and `neutrality.md`.

3.8 WHEN Calm mode or `prefers-reduced-motion` is on THEN the system SHALL CONTINUE TO turn off all decorative motion, and the sequences SHALL CONTINUE TO be skippable.

3.9 WHEN the landing page, `/demo`, the text persona (Priya) and the EU persona show THEN the system SHALL CONTINUE TO pass every `layout-check` and `journey-check` row that passes today, including the existing spec 15 and spec 16 rows. A row that passes today for the wrong reason (R10.6 equal widths) MAY gain a minimum, and no row is loosened.

3.10 WHEN Wait, Receipts and the Seal step show on a keyboard or screen reader THEN the system SHALL CONTINUE TO expose one h1 per step, move focus to the step heading on a step change, and keep the controls' accessible names and tab order.

## Bug Condition

The bug conditions, one per defect. `S` is a rendered screen state (step, viewport, DOM and computed styles).

```pascal
FUNCTION isBugCondition(S)
  INPUT: S of type Screen
  OUTPUT: boolean

  RETURN
    (S.step = "seal" AND S.width >= 900 AND S.panel.width < 0.99 * S.card.width)                    // D1 slab
    OR (S.step = "seal" AND S.wax.atRest.width < 44)                                                // D1 dot
    OR (S.step = "wait" AND EXISTS t IN S.text : contrast(t.colour, backgroundOf(t)) < 4.5)         // D2 heading
    OR (S.step = "wait" AND (COUNT(S.demoLabels) > 1 OR COUNT(S.waxSeals, firstViewport) > 1))      // D2 duplicates
    OR (S.persona AND S.step = "receipts" AND S.width <= 480 AND S.column.width < S.width - 48)     // D3
    OR (S.persona AND S.step = "remember" AND S.width <= 480
          AND EXISTS t IN S.textAndControls : overlaps(t.box, S.ghost.drawnBox))                    // D4
    OR (S.step = "remember" AND S.previousControl.visible
          AND contrast(S.previousControl.colour, backgroundOf(S.previousControl)) < 4.5)           // D5
    OR (S.step = "remember" AND S.noInputYet AND S.activeElement.isHeading
          AND S.activeElement.outline.visible)                                                      // D6
    OR (S.persona AND S.step = "break" AND S.width >= 900
          AND (EXISTS t IN S.text : overlaps(t.box, S.soil.box)
               OR S.sealGroup.left - S.figures.right > 64))                                         // D7
END FUNCTION
```

```pascal
// Property: Fix Checking
FOR ALL S WHERE isBugCondition(S) DO
  S' <- render'(S)
  ASSERT NOT isBugCondition(S')
     AND SF1(S') AND TT1(S') AND CT1(S') AND UQ1(S') AND CW1(S') AND GO1(S') AND FR1(S') AND LC1(S')
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL S WHERE NOT isBugCondition(S) DO
  ASSERT copy(render(S)) = copy(render'(S)) AND flow(render(S)) = flow(render'(S))
     AND layoutCheckResult(render(S)) <= layoutCheckResult(render'(S))
END FOR
```
