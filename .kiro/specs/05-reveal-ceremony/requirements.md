# Requirements Document

Spec: 05 Reveal ceremony

## Introduction

The persona demo from spec 03 works end to end, but it looks like forms and buttons. This spec turns it into the ceremony that `tone.md` asks for: a candlelit desk, a sealed envelope, a recall gesture, a seal that cracks under the judge's finger, a letter that soaks into the page, and the figures then and now stamped onto a number line next to the judge's own ink mark. It is the screen every judge experiences and the one the 3-minute video shows.

It is a UX layer only. It changes how the existing flow looks and moves. It does not change what the flow does.

Concept B, "One Desk", is decided: one dark oak desk, lit by one candle, seen close and slightly from above. The camera moves between stations on the desk instead of the page changing. Animation uses CSS, SVG, the Web Animations API and one small 2D canvas for dust. There is no animation library and no 3D engine.

This spec builds on spec 03 (the Opening_Flow, its state machine, the Reveal) and on task #49 (spec 03 task 8, which builds the reveal's letter and figures stages and which this spec reworks). Spec 04 task 10 (#84) adds a test against the same figures component. It waits on the end of the spec 04 data chain, not on this spec, so R9.7 and R9.8 keep `FiguresThenNow({ opened })` and its labels unchanged for it.

The design is written after #49 merges, because #49 is rewriting `src/components/reveal`. This document therefore names behaviour and rules, not files or props, except where a file is a hard boundary.

## Decisions already made

| Topic | Decision |
|---|---|
| Concept | B, One Desk. |
| Where the desk lives | `/demo` and `/demo/personas/[key]`. The landing page `/` is not changed. |
| Animation library | None. CSS, SVG, Web Animations API, one 2D canvas. |
| Sound | Optional, off by default, synthesised in the browser, last task. |
| Vibration | Follows the sound toggle. Off by default. |
| JS budget in CI | `scripts/check-js-budget.mjs`, added to `scripts/check.sh` by the owner after `npm run build`. LCP is a manual Lighthouse check. |
| Seal break | Moves from the card link to the reveal, after the recall step (R3, R6). |
| Recall scale | One fixed logarithmic scale for every question (R4). |
| Gap between mark and figure | Shown on the number line. Never computed, written, coloured or scored (R9, R12). |

## Out of scope

Anything in the API routes, `src/lib/crypto` (including `demo-key.ts`), sealing, `src/lib/seal-format`, `src/lib/letter-store`, the Recall_Record schema, the Sealing_Script and the opening state machine's states and transitions. The landing page, `src/app/layout.tsx` and `src/app/globals.css`. Real letters, passkeys, the live demo, cards and `.ics`. More personas (the desk must look right with one to six). WebGL.

## Glossary

- **Ceremony**: The visual and interactive layer this spec adds to the demo pages. It reads state from the Opening_Flow and sends the same events. It owns no flow state except view-local animation state.
- **Desk**: The scene on `/demo` with the candle, the dust and the envelopes.
- **Station**: One place on the desk the camera rests at. A Stage is shown at a Station.
- **Stage**: A named step of the journey. Each Stage has a stable `data-ceremony` value (R3).
- **Step**: A view-local part of Stage 3 of the Reveal: `then`, `passage` and `now`.
- **Mark**: The judge's own answer drawn in ink on a scale or number line.
- **Recall_Scale**: The fogged scale on which the judge drags the Mark (R4).
- **Number_Line**: The line for one tracked figure in the Reveal, with the Then_Stamp, the Now_Stamp and the Mark (R12).
- **Stamp**: A pressed block holding one figure with its value, unit, period, region and source name.
- **Seal_Break**: The press-and-hold or drag gesture on the wax seal, and its button equivalent (R6).
- **Skip**: The visible control that ends the sequence now running at its final state.
- **Calm_Mode**: The state in which no decorative motion runs: either `prefers-reduced-motion: reduce` or the judge's own Calm control (R11).
- **Position_Property**: A CSS custom property whose name is on the fixed list in R10.3.
- **Flow**, **Opening_Flow**, **Reveal**, **Recall_Record**, **Then_Figure**, **Now_Figure**, **Comparable**, **Fixture_Figure**, **Persona_List**: as defined in spec 03.

## Requirements

### R1. Hard boundaries

**User story:** As the owner, I want the ceremony to be a skin on the working flow, so nothing about sealing, opening or recording can change by accident.

1. THE Ceremony SHALL change no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `src/lib/recall/`, and no migration. It SHALL NOT edit `src/lib/crypto/demo-key.ts`, even though a comment there mentions "Break the seal".
2. THE Ceremony SHALL NOT change the states, events or transitions in `src/components/reveal/opening-machine.ts`. Every Ceremony gesture SHALL send an event that already exists: `START`, `BEGIN`, `EDIT_DRAFT`, `TOGGLE_NO_ANSWER`, a submit through the existing handler, `RETRY_POST`, `ADVANCE` or `SHOW_ALL`. `opening-machine.test.ts` and `opening-machine.property.test.ts` SHALL pass unchanged.
3. THE Recall_Record the Ceremony produces SHALL be exactly the record the spec 03 code produces: the same schema, the same `buildRecallRecord` function, the same encryption and the same `POST /api/openings` body. The Ceremony SHALL only change how the drafts are entered.
4. THE Ceremony SHALL add no runtime dependency. `dependencies` in `package.json` SHALL be unchanged. IF a task finds it needs one, THEN it SHALL stop and ask the owner.
5. THE Ceremony SHALL keep every spec 03 R14 rule: the Content Security Policy from `src/lib/security-headers.ts` unchanged and unrelaxed, no request to any origin but the page's own, `Referrer-Policy: no-referrer`, no letter text, answer, key or payload field sent anywhere, and nothing written to `localStorage`, `sessionStorage`, IndexedDB, cookies or the URL. Settings (Calm control, sound toggle, tilt) SHALL live in memory for the visit only.
6. THE Ceremony SHALL NOT import `src/lib/crypto` statically. The spec 03 import-boundary test SHALL pass, extended to the new folders.
7. THE Ceremony SHALL NOT edit `src/app/layout.tsx`, `src/app/page.tsx` or `src/app/globals.css`. These match frontend-dev's globs in `.github/agents.json` (`src/app/**/*.tsx`, `src/app/**/*.css`), so the PR path check will not catch an edit. The agent SHALL check its own diff for them before opening the PR, and the QA agent SHALL fail a PR that touches them. Ceremony colours, tokens and global-looking rules SHALL live in CSS modules under `src/components/ceremony/` and the demo pages' own CSS modules.
8. THE Ceremony SHALL NOT edit `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**` or `tools/**`. These are owner-only.

### R2. Card link and loading wording

**User story:** As a judge, I want the words on the card and the first loading screen to say what really happens, so nothing claims the seal is broken before it is.

The seal now breaks after the recall step (R3, R6), so the card link and the first loading text must stop saying so. Spec 03 R6.2, R6.7, R7 and its design were amended to match; `product.md` too.

1. THE card link text in `components/demo/copy.ts` (`breakSeal`) SHALL be "Pick up the letter". THE loading text in `components/reveal/copy.ts` (`loading`) SHALL be "Bringing the letter into the light." Neither SHALL contain the words "break", "broken" or "breaking". Both are also in the spec 03 `design.md` copy tables.
2. THE key `breakSeal` MAY be renamed (for example `openLetter`). IF it is, THEN `PersonaCard.tsx`, `PersonaCard.test.tsx`, `src/app/demo/page.test.tsx` and the comment in `OpeningFlow.tsx` SHALL be updated in the same change. The tests SHALL check the new strings and SHALL check that the string "Break the seal" no longer appears in the Demo_Index or on a card.
3. THE words "Break the seal" SHALL appear only on the Seal_Break button equivalent in the Reveal (R6.3).
4. THE strings "Checking the seal." and "Your seal is intact. Nothing here has changed since it was sealed." SHALL stay as they are.

### R3. The journey, its Stages and how they map to the Flow

**User story:** As the owner, I want every Stage named and reachable in a known state, so the QA agent's browser check can screenshot each one.

1. THE Ceremony SHALL mark its root element with `data-ceremony="<stage>"`, using exactly these stage names, and SHALL change the value only when the judge sees that Stage:

   | Stage | Route | Flow state | What the judge sees |
   |---|---|---|---|
   | `desk` | `/demo` | none | The desk with the envelopes. |
   | `envelope` | `/demo/personas/{key}` | `loading`, `sealed`, `openable`, `verifying` | One envelope, waiting. When the state is `sealed`: the opening date and time remaining. |
   | `intact` | same | `verified` | The envelope turned toward the judge, with the seal-is-intact statement and the control that sends `BEGIN`. |
   | `recall` | same | `recall`, `submitting`, `submit_failed` | The back of the envelope with one Recall_Scale per question. |
   | `marks` | same | `reveal`, stage 1 | The Recall_Scales, now read-only, with the judge's ink Marks and their answers, and the unbroken wax seal. |
   | `seal` | same | `reveal`, stage 1 | The Seal_Break in progress, or the button's short version playing. |
   | `letter` | same | `reveal`, stage 2 | The flap open and the letter soaking into view. |
   | `then` | same | `reveal`, stage 3 | One Number_Line per figure with the Mark and the Then_Stamp. |
   | `passage` | same | `reveal`, stage 3 | The time-passing transition. |
   | `now` | same | `reveal`, stage 3 | The Now_Stamp, the counter and the change line. |
   | `close` | same | `reveal`, stage 3, after `now` | The calm ending (R12). |

   Error states from spec 03 (`not_placed`, `unreachable`, `verification_failed`, `open_failed`) keep their `FlowError` view on the desk surface and set `data-ceremony="error"`.
2. THE Ceremony SHALL also set `data-ceremony-motion` to `full` or `calm` so a browser check can tell which path it is looking at.
3. THE Ceremony SHALL change Stage only in response to the Flow state, the judge's own control, or the sequence the judge is watching. No timer SHALL move the judge from `intact` to `recall`, from `recall` to `marks`, or from `marks` to `letter`.
4. THE Seal_Break SHALL send `ADVANCE` once, from reveal stage 1 to stage 2. The move from stage 2 to stage 3 SHALL be sent by a visible "read the figures" control, as in spec 03, and SHALL NOT be sent by a timer.
5. THE Reveal SHALL still show its parts in the spec 03 R9.1 order: the judge's answers, then the letter, then the figures. Nothing from a later part SHALL be in the document before its Stage.
6. THE `still sealed` view SHALL keep spec 03's behaviour: the opening date, the time remaining and a "Try again" control at zero. It SHALL show nothing about the contents. The envelope SHALL look the same whatever the letter holds: the same size, the same number of folds, no hint of length or of the number of figures.
7. THE envelope view SHALL show the persona's "written as of" date and the opening date from the Persona_List, and the line that the letter was prepared later as a demo. It SHALL NOT say the letter was sealed on the persona's date (spec 03 R10.3, `data-integrity.md`). Before the letter is opened, the page has no `sealedAt`, and the envelope SHALL NOT show one.
8. EACH Stage's content SHALL be reachable with the keyboard alone, and each Stage SHALL be reachable in Calm_Mode with buttons only (R11).
9. THE QA browser check SHALL be able to reach each Stage at its URL and state without a database change: `desk` at `/demo`; `envelope`, `intact`, `recall`, `marks`, `seal`, `letter`, `then`, `passage`, `now` and `close` at `/demo/personas/us-maya` by the button path; the `sealed` variant of `envelope` by stubbing `GET /api/letters/{id}` in the browser. The design SHALL give the exact steps.

### R4. Recall scale (the `recall` Stage)

**User story:** As a judge, I want to drag a marker to where I remember the value, so recall feels like a gesture and not a form.

The scale cannot take its range from data, because a range taken from the sealed figure or the current figure would hint at the answer (spec 03 R8.2). It also cannot start small and widen. The real units show why:

| Unit | Typical value | Start 0–10, widening ×10 | Widenings |
|---|---|---|---|
| USD per gallon | about 3.5 | 0–10 | 0 |
| EUR per 1,000 litres | about 1,700 | 0–10, 0–100, 0–1,000, 0–10,000 | 3 |
| SEK per month | 10,000 or more | 0–10 up to 0–100,000 | 4 |

Two units need more than two widenings, so the scale is a fixed logarithmic scale, the same for every question.

1. THE Recall_Scale SHALL be the same for every question in every letter: a logarithmic track from 0.01 to 100,000, seven decades, with faint decade labels (0.01, 0.1, 1, 10, 100, 1,000, 10,000, 100,000) and no other number on the track at level 0. WHILE the track is zoomed (levels 1 and 2, criterion 12), it MAY also show its two window end labels, which come only from the marker's position. It SHALL take nothing from the payload except the question text and the unit label that spec 03 already shows. No range, tick, default position or label SHALL come from a figure, a period or a metric.
2. THE Mark SHALL start unplaced. The judge places it by dragging the marker, or by pressing on the track, with a pointer, finger or pen.
3. WHILE the judge drags the marker, THE Recall_Scale SHALL show the value under the marker, rounded to three significant figures, written as a plain decimal with no exponent, with the unit. The value shown SHALL be the value that will be recorded if the judge lets go there.
4. WHEN the judge releases the marker, THE Recall_Scale SHALL send `EDIT_DRAFT` for that question with that decimal string, and the Mark SHALL stay in ink at that place. A Mark placed or moved by any route SHALL send `EDIT_DRAFT` with a string that passes the Recall_Record number rule (spec 03 R3.3).
5. THE marker SHALL be a keyboard-operable slider (`role="slider"` with `aria-valuetext` giving the value and unit). Left and Right (and Down and Up) SHALL move it by one step of the third significant figure, Page Down and Page Up by one decade, Home and End to the two ends. Every move SHALL send `EDIT_DRAFT`.
6. THE existing number text field and "No answer" checkbox from spec 03 SHALL stay in the document and keep working, visually part of the scale. The text field is the exact route: the judge can type any valid number, including 0 and values beyond the track. Typing SHALL move the Mark to match. Moving the Mark SHALL update the text field. "No answer" SHALL send `TOGGLE_NO_ANSWER`, remove the Mark and disable the marker.
7. A typed value below 0.01 (including 0) or above 100,000 SHALL put the Mark at the matching end of the track, with the same look at both ends and no text, arrow or colour that says it is beyond the track. The recorded value SHALL be the typed value.
8. THE Recall_Scale SHALL NOT show, hint at or react to any figure. Its fog, ticks and labels SHALL be identical for every question and every letter.
9. WHEN the judge submits, THE existing validation SHALL decide. An invalid or empty question SHALL show the existing inline message (spec 03 R8.4), and the Marks and typed values SHALL stay as entered.
10. WHEN the Recall_Record is stored, THE Mark SHALL stay on screen in ink into the `marks` Stage and the Number_Line (R12), at the position of the recorded value on that surface's own scale.
11. THE scale SHALL work with touch (no page scroll during a drag along the track, via `touch-action`), and the marker's hit area SHALL be at least 44 by 44 CSS pixels.
12. ON a 360 CSS pixel wide viewport, THE judge SHALL be able to set a value to two significant figures by drag alone, with no keyboard and no typing. The seven decades fit in about 300 pixels, so one decade is about 40 pixels and a step from 3.5 to 3.6 is under one pixel. The design therefore picks a drag-only way to refine the value (for example the track zooms into the decade being dragged). Nothing about it SHALL come from data: the zoom SHALL be the same for every question, SHALL depend only on the marker's position and the pointer, and SHALL leave the number shown under the marker equal to the value that will be recorded (criterion 3).

### R5. The envelope and the checking views (the `envelope` and `intact` Stages)

**User story:** As a judge, I want the wait to feel like a letter on a desk, not a spinner.

1. WHILE the Flow state is `loading`, `openable` or `verifying`, THE Ceremony SHALL show the persona's envelope on the desk with the R2 loading text or "Checking the seal." as its statement, and SHALL give the statement `role="status"`.
2. WHILE the Flow state is `sealed`, THE Ceremony SHALL show the same envelope, the opening date, the time remaining (display only, as in spec 03) and the "Try again" control at zero.
3. WHEN the Flow state is `verified`, THE Ceremony SHALL show the seal-is-intact statement before any recall question and a control that sends `BEGIN`. The envelope SHALL turn over to show the recall scales only after `BEGIN`.
4. THE envelope SHALL NOT show the wax seal broken, cracked or lifted before the Seal_Break.
5. THE views SHALL keep the spec 03 focus rule: when the Stage changes, focus moves to the new Stage's heading or region.

### R6. Breaking the seal (the `seal` Stage)

**User story:** As a judge, I want to break the seal myself and feel it give, so the unsealing is the moment I remember.

1. WHEN the Flow is in reveal stage 1, THE Ceremony SHALL show the persona's wax seal, unbroken, on the envelope, with a plain line telling the judge to press and hold it, or to use the button.
2. WHILE the judge presses and holds the seal, or drags across it, with a pointer, finger or pen, THE Ceremony SHALL spread cracks outward from the seal's centre, along fixed paths drawn in a fixed order in proportion to the hold time. The contact point SHALL NOT change which paths are drawn or their order. The hold needed to finish SHALL be a single constant (design: about 1.5 s) that does not depend on any data.
3. THE Ceremony SHALL provide a "Break the seal" button that completes the Seal_Break without holding, reachable by keyboard (Enter and Space), for screen readers and for anyone who cannot hold a press. It SHALL play a short, non-gesture version in full motion and nothing animated in Calm_Mode.
4. IF the judge lets go before the hold is complete, THEN THE seal SHALL settle back: the cracks recede to nothing, and no event is sent. The seal SHALL NOT stay partly cracked.
5. WHEN the hold completes, THE Ceremony SHALL send `ADVANCE` once, and SHALL show: the seal splitting, flakes falling and settling, the flap lifting, and the letter sliding out into the `letter` Stage. A second completion SHALL send nothing.
6. THE crack paths SHALL be fixed and start at the seal's centre. They SHALL NOT depend on any data, on the contact point or on the persona: every persona's seal cracks the same way, whatever its decorative pattern (R8.4).
7. THE Skip control SHALL be visible during the Seal_Break. WHEN it is activated, the Seal_Break SHALL go to its end state and send `ADVANCE` once if it has not been sent.
8. THE "Show everything" control from spec 03 SHALL stay available. WHEN it is activated in stage 1, THE Ceremony SHALL show the seal already broken and send `SHOW_ALL`.
9. WHERE the browser has no vibration support (including iOS Safari), THE Seal_Break SHALL work with no change. Vibration is added in R14 and nowhere else.

### R7. The letter (the `letter` Stage)

**User story:** As a judge, I want my letter to appear as ink soaking into paper, so reading it feels like opening something old.

1. WHEN the Flow is in reveal stage 2, THE letter text SHALL be in the document in full from the first render, as plain text with line breaks kept and markup characters literal (spec 03 R10.1, R10.4). The ink effect SHALL be a clip or mask on top of that text. It SHALL NOT insert, remove, reorder or retype characters.
2. THE ink SHALL reveal the text line by line at a fixed delay per line, ending within 8 seconds however long the letter is. The timing SHALL depend only on the number of lines, never on any figure or answer.
3. THE Skip control SHALL be visible while the ink runs. WHEN it is activated, the whole text SHALL show at once.
4. THE labels from spec 03 R10 SHALL stay with the letter: "Written as of {date}", the demo letter label and "Sealed for the demo on {date}". They SHALL appear before the ink starts.
5. THE letter text and its labels SHALL be at AA contrast on the paper surface (R11).
6. THE letter SHALL NOT be summarised, quoted, highlighted or commented on.

### R8. The desk (the `desk` Stage, `/demo`)

**User story:** As a judge, I want the first five seconds to hook me, so I want to pick up a letter.

1. `/demo` SHALL show a dark desk, lit by one candle, with dust drifting in the light and the persona envelopes lying on the desk. Each envelope SHALL carry its own wax seal.
2. THE server-rendered page SHALL contain everything spec 03 R6 requires, in the same order: the "Demo" label, the heading, the intro note, then one card per persona with name, region, written-as-of date, opening date and the open link from R2, or the empty state. The Demo_Index test ("exactly the personas in the Persona_List, in order") SHALL pass. The desk SHALL be an enhancement on top of this markup. With scripts disabled, the page SHALL show a static dark desk drawn with CSS and the same cards.
3. THE envelope for a persona SHALL be that persona's card: the link is the envelope. The envelope SHALL show only list fields (spec 03 R6.6).
4. EACH wax seal's pattern SHALL be generated from the persona's `key` by a fixed function, so it is the same on every visit and for every viewer. All seals SHALL use the same wax colour and differ only in pattern. No pattern, colour or position SHALL depend on anything inside a letter.
5. THE desk SHALL work with 1 to 6 personas without a layout change. With one persona, the envelope SHALL be centred and the desk SHALL show no empty "slots", decorative envelopes or placeholder cards (spec 03 R6.2 allows exactly one card per persona).
6. WHEN the pointer moves over the desk, or the phone is tilted, THE light SHALL follow it and the layers SHALL move by a slight parallax of at most 2 degrees or 12 CSS pixels. WHERE a platform needs a permission for device tilt (iOS), THE desk SHALL offer a visible control to enable it, and SHALL work without it. Tilt SHALL be off in Calm_Mode.
7. WHEN the judge activates an envelope, THE camera SHALL move to the envelope as the page navigates to `/demo/personas/{key}`, and the persona page SHALL begin with the same envelope in the same place, so the move reads as one scene. IF the move cannot be done (Calm_Mode, low-power mode, or no JavaScript), THEN it SHALL be a plain navigation.
8. THE Demo label and the intro note SHALL be visible without scrolling on a 360 by 640 CSS pixel viewport, as in spec 03 R6.4 and R6.5, and SHALL meet AA contrast on the desk surface.
9. THE desk SHALL be used only on `/demo` and `/demo/personas/[key]`. The landing page and every other route SHALL be unchanged.
10. THE empty state from spec 03 R6.8 SHALL show on the desk surface with an empty desk and no envelopes.

### R9. Figures stay honest in the ceremony

**User story:** As the owner, I want no animation to weaken a number's provenance or imply a verdict.

1. THE Ceremony SHALL keep every spec 03 R11 and R13 rule, and every data-integrity.md display rule: each figure shown with its value, unit, period, region and a one-click way to its source, series ID and `source_url`; the "fixture data" label next to each Fixture_Figure and the one fixture note on the page; the "historical record, retrieved [date]" label on each non-fixture Then_Figure; no "sealed on" for a persona date.
2. THE Stamp for a figure SHALL show the figure's value, unit, period and region, and the source name, as text. The Then_Stamp and Now_Stamp SHALL carry the same labels the spec 03 figure line carries.
3. THE figures SHALL stay in the order of the sealed payload. THE Ceremony SHALL NOT sort, group, hide or reorder figures by the size or direction of their change, by the Mark's distance from them, or by any other value.
4. THE Ceremony SHALL NOT compute, write, colour or score any difference, accuracy or grade between a judge's answer and a figure (spec 03 R9.3 as amended). No text, number, colour, size, order, sound, vibration or motion SHALL depend on the distance between a Mark and a figure.
5. THE change line and formula line from spec 03 R11.7 and R12 SHALL stay after the Now_Stamp lands, with their periods and links.
6. IF the Change_Calculator reports a pair as not Comparable, THEN THE Ceremony SHALL draw no Number_Line and no Mark for it, and SHALL show the not-comparable sentence and both figures with their own periods, as spec 03 R11.6 says. IF a Now_Figure is unavailable (spec 03 R11.5), THEN THE Ceremony SHALL draw no Number_Line and no Mark for it and SHALL show the Then_Figure and the unavailable sentence.
7. THE final state of the figures stage SHALL be present in a server-rendered or static render of the figures component: all labels, the fixture label and note, the "historical record" label, the stamps' text and the final counter values. Animation SHALL be applied after hydration on top of that state. The spec 03 task 8 tests and the spec 04 task 10 (#84) test SHALL pass unchanged.
8. THE Ceremony SHALL keep the component names `FiguresThenNow`, `FigureLine` and `FixtureNote`, and the props that #49 and #84 use. IF the design finds it cannot, THEN it SHALL say so and ask the owner before changing them.

### R10. Neutrality

**User story:** As the owner, I want a rise and a fall to look, move and time the same, with a test that proves it.

1. A rise and a fall SHALL get the same colour, icon, weight, motion, duration, easing, delay, sound and vibration. No part of the Ceremony SHALL treat "up" or "down" differently, and it SHALL use no colour, icon or arrow that implies a judgement.
2. THE existing Property 20 test (spec 03: a rise and its mirror-image fall render the same markup) SHALL be extended, not duplicated. It SHALL cover the new components: the Stamps, the Number_Line, the counter, the Mark, the passage transition, the Seal_Break and the Recall_Scale. For a rise and its mirror-image fall, the rendered markup SHALL be identical except for:
   - the numeric text and the sign or direction word, as spec 03 R11.8 allows; and
   - the values of the Position_Properties in `style` attributes.
3. THE Position_Properties SHALL be a fixed list of names defined in one module, with these names or a subset of them: `--pos-mark`, `--pos-then`, `--pos-now`. Every other property in every `style` attribute, every class name and every attribute SHALL match between the two renders.
4. SPEC 03's mirror keeps the Then_Figure at `t` and moves the Now_Figure from `t + d` to `t − d`, so the range shifts with it, and a Mark with the same value would not land at `1 − p`. THE test SHALL therefore reflect the Mark too, from `m` to `2t − m`, in the mirror-image fall. It SHALL then check that every Position_Property `p` in the rise equals `1 − p` in the fall, within a tolerance of 1e-9. THE range padding and minimum-span rules (R12.2) SHALL satisfy this, and a Mark outside the range SHALL land on the opposite edge.
5. ALL durations, delays and easing values SHALL be constants defined in one module, with no input from any figure, answer, period, span or change. A property test (at least 100 runs) SHALL generate arbitrary figures, answers and spans and assert that every duration, delay and easing in the rendered markup and the animation settings is the same for all of them.
6. THE passage transition SHALL last the same time whatever the span between the periods. The counter wheels SHALL always roll in the same direction, from the same starting digits, for the same time. THE Stamps SHALL always drop vertically onto their place. The Number_Line axis SHALL always ascend from left to right.
7. THE Ceremony text SHALL pass the neutrality.md copy test. It SHALL name no party, candidate, official or policy and SHALL NOT use evaluative words.

### R11. Accessibility

**User story:** As a judge using a keyboard, a screen reader or reduced motion, I want the same journey with nothing lost.

1. EVERY Ceremony gesture SHALL have a control that does the same thing without dragging, holding, pointer precision or timing: the Recall_Scale (slider keys and the text field), the Seal_Break (the "Break the seal" button), the envelope on the desk (a link), the stage 2 to 3 move (a button), Skip (a button) and device tilt (none needed; it is decoration).
2. WHERE the browser reports `prefers-reduced-motion: reduce`, THE Ceremony SHALL run in Calm_Mode: no parallax, no dust, no flicker, no camera move, no ink-soak, no counter roll, no passage transition and no flakes. Each Stage SHALL change by an instant cut or a fade of at most 150 ms. Each sequence SHALL be replaced by its end state, and the Seal_Break by the button. The order of Stages SHALL not change.
3. THE Ceremony SHALL show a visible "calm" control on every page where it moves, which switches to Calm_Mode for the visit and back. Ambient motion that runs for more than five seconds (dust, flicker) SHALL be stopped by it (WCAG 2.2.2).
4. A visible Skip control SHALL be reachable by keyboard during every sequence: the camera moves, the Seal_Break, the ink-soak, the Stamps and passage, the counter, and the close. Skip SHALL end the running sequence at its final state. In the figures stage, Skip SHALL take the Steps `then`, `passage` and `now` straight to their final state, with every Stamp, counter value and change line shown.
5. THE Ceremony SHALL NOT make anything flash more than three times a second, and the candle SHALL NOT change brightness by more than a small fixed amount (design states the amount).
6. THE text and numbers on every surface SHALL meet WCAG 2.2 AA: at least 4.5:1 for normal text and 3:1 for large text and control boundaries, on the actual surface they sit on, including the dark desk and the lit and unlit parts of it. The "faded ink" effect SHALL appear only on decoration. A test SHALL compute the contrast ratio for every text and surface token pair, as spec 03 task 8 does, and fail below the thresholds.
7. EVERY pointer target SHALL be at least 24 by 24 CSS pixels (WCAG 2.2 2.5.8), and the main controls at least 44 by 44.
8. THE Ceremony SHALL keep focus management: when the Stage changes, focus moves to the new Stage's heading, and the change is announced in a polite live region. Every control SHALL show a visible focus indicator that is at least 3:1 against both the surface and the unfocused state.
9. DECORATIVE layers (dust, light, the desk, flakes, counter wheels) SHALL be hidden from assistive technology. The Mark SHALL be announced as the judge's answer with its value and unit, not as a position. The Number_Line SHALL be announced as text: the figures with their periods, as in R9, and no statement about where the Mark lies.
10. THE Ceremony SHALL work with no pointer, with a screen reader and at 200% text size and 320 CSS pixels width without loss of content.

### R12. The then-and-now Stage and the close

**User story:** As a judge, I want each figure to land like a stamp, with my own mark already there, so I see the gap without being told what it means.

1. WHEN the Flow is in reveal stage 3, THE Ceremony SHALL show one Number_Line per Then_Figure in payload order. Each Number_Line SHALL show the Mark (R4) if the answer was a number, and SHALL show no Mark if the answer was "No answer".
2. THE Number_Line range SHALL come only from the Then_Figure value and the Now_Figure value of that line. It SHALL have equal padding on both sides of the span between them, so the figures sit symmetrically. WHEN the two values are equal, THE range SHALL use a minimum span set by a fixed rule from the value alone (the design states it), so the two Stamps and the Mark are still drawn and legible. The Mark SHALL NOT change the range, the padding, the ticks or the position of any Stamp.
3. A Mark whose value is outside the range SHALL sit at the nearer edge, with the same look at both edges and no text, arrow or colour that says it is beyond the range. A Mark inside the range SHALL sit at its value.
4. THE axis SHALL be plain: ticks and tick labels SHALL be exact published values or rescales of them, with period and unit shown by the Stamps. The axis SHALL NOT invent a number. Positions are for drawing only. No displayed number SHALL be computed from a position.
5. THE sequence for each Number_Line SHALL be: the Then_Stamp lands, pressed, with its period and source; the passage transition plays (pages turning, the light shifting) for a fixed time; the Now_Stamp lands in the same way; the figure counters roll like an old counter and end on the exact published value, formatted as spec 03 formats it; then the change line and formula appear.
6. THE counter SHALL end on the exact value text in the document. Rolling wheels SHALL be decoration over that text (R11.9), and the text SHALL be correct in the static render (R9.7).
7. THE Steps `then`, `passage` and `now` SHALL be view-local. They SHALL send no event. THE Stage 3 move to `close` SHALL send no event.
8. IF figures are many, THE Steps SHALL run for all lines together, not one line after another, so the sequence length does not grow with the number of figures.
9. THE `close` Stage SHALL be calm: a still view of the desk with the letter, a plain line in Revenant's voice that the record has been shown and nothing more and a clear link back to the desk (`/demo`). It SHALL contain no summary, score, comment or call to compare.
10. THE `close` copy SHALL follow tone.md and neutrality.md.

### R13. Performance

**User story:** As a judge on a mid-range phone, I want the demo to start fast and stay smooth.

1. THE gzipped first-load JavaScript for each route, as `scripts/check-js-budget.mjs` measures it from the Next build output, SHALL stay at or under: `/` 130 kB, `/demo` 130 kB, `/demo/personas/[key]` 175 kB (1 kB = 1,000 bytes, as `next build` reports). The values when this spec started: `/` 106.5 kB, `/demo` 106.8 kB, `/demo/personas/[key]` 139.6 kB. `/` SHALL stay within 2 kB of 106.5 kB, because it is unchanged.
2. THE script runs in `scripts/check.sh` right after the `npm run build` step (in place). Each task's PR description SHALL state the three measured values from `node scripts/check-js-budget.mjs` after `npm run build`.
3. THE Ceremony SHALL load its heavier parts (the canvas dust, the tilt code, the sound code) with dynamic `import()`, only on the routes and in the modes that need them, and SHALL NOT load them in Calm_Mode.
4. THE largest contentful paint on `/demo` SHALL be at most 2.5 s on a mid-range Android phone with Lighthouse mobile throttling. This is a manual check, recorded in the PR. The LCP element SHALL be server-rendered text (the heading or intro), not an image, and SHALL NOT wait for scripts or textures. Cumulative layout shift SHALL be under 0.1 and interaction latency under 200 ms.
5. THE total of all image and texture bytes the Ceremony loads SHALL be at most 150 kB, and at most 40 kB before the first paint. Prefer CSS gradients and inline SVG to files. No file SHALL be loaded by a `data:` or `blob:` URL (the CSP allows images only from `'self'`). The build SHALL be checked to make sure Next does not inline a CSS asset as a `data:` URI.
6. WHERE the device is low-power (fewer than four logical cores, or measured frame time above 24 ms over one second), THE Ceremony SHALL switch to a lighter mode on its own: no dust, no parallax, no tilt, camera moves as cross-fades. The Flow SHALL not change.
7. THE Ceremony SHALL animate only `transform` and `opacity` for anything that moves, SHALL keep the desk to one composited plane, and SHALL mount a Station's decorative layers only while it is in view. Only decorative layers (dust, light, flakes, wheels) unmount. The answers, the letter and the figures SHALL stay in the document once shown, because the reveal stages accumulate and "Show everything" shows all three.

### R14. Sound and vibration (optional)

**User story:** As a judge, I want an optional touch of sound and feel, off unless I ask.

1. THE Ceremony SHALL offer a visible, labelled sound toggle. Sound and vibration SHALL be off by default and SHALL start only after the judge turns the toggle on, which is a user gesture.
2. SOUND SHALL be synthesised in the browser with Web Audio (for example filtered noise for paper and for the wax crack). No audio file SHALL be added, so no audio licence is needed. No network request SHALL be made for sound.
3. VIBRATION on the Seal_Break (where the browser supports it) SHALL be on only while the sound toggle is on.
4. THE same sound and the same vibration SHALL play for a rise and a fall, and for every distance between a Mark and a figure.
5. THE toggle state SHALL live in memory for the visit only. THE sound code SHALL be loaded only after the toggle is turned on.
6. THIS requirement is the last task, and the Ceremony SHALL be complete without it. No earlier task SHALL vibrate or play sound.

### R15. Assets and licences

**User story:** As the owner, I want every asset to be original or CC0, with its source on record, so nothing needs a licence check at the end.

1. EVERY image, texture, font file, icon or sound the Ceremony adds SHALL be original work created in this repository or CC0. Anything else SHALL NOT be added.
2. A file `src/components/ceremony/ASSETS.md` SHALL list each asset with its path, how it was made or where it came from, its licence (original or CC0) and the date. A test SHALL fail if a file in the Ceremony's asset folder has no entry.
3. THE existing fonts (EB Garamond, Inter, both OFL, in `src/app/fonts`) SHALL be reused. No font SHALL be added.
4. PREFER assets that are code: CSS gradients, inline SVG paths and procedural patterns. Textures that must be files SHALL stay inside the R13.5 budget.
5. NO asset SHALL be generated by an AI image tool unless the owner approves it and the licence terms are recorded in `ASSETS.md`.

### R16. Copy

**User story:** As the owner, I want all new words in one reviewable place, in Revenant's voice.

1. EVERY user-facing string the Ceremony adds SHALL be in a copy module in `src/components/ceremony/`, and spec 03 R15.1 SHALL hold: no string literal in components, including `aria-label`s, the live-region announcements and the labels of buttons that stand in for gestures.
2. THE copy SHALL follow spec 03 R15.2 to R15.4: second person, sentences of at most 25 words, the tone.md vocabulary, no exclamation marks, no puns, no horror cliché, no evaluative or directional word beyond what R12 of spec 03 allows, and every error or empty state naming an action.
3. THE existing tests that scan for JSX text literals and for banned words SHALL cover `src/components/ceremony/`.
4. THE copy tests SHALL include the new strings: the Seal_Break instructions and button, the Recall_Scale instructions, the calm control, the Skip control, the close, the tilt control, the sound toggle and every live-region message.

### R17. Tests

**User story:** As the owner, I want the ceremony's rules checked in CI.

1. THE tests SHALL run in `npm test` with no network access, and SHALL not need a database.
2. THE existing spec 03 tests SHALL pass unchanged, except the ones R2.2 names, which change in the same task as the copy.
3. THE Ceremony SHALL add tests that check:
   - the Stage mapping in R3.1 for each Flow state, using `renderToStaticMarkup`;
   - nothing from a later Stage is in the document before its Stage (extending spec 03 Property 17);
   - the Recall_Scale produces a draft string that `buildRecallRecord` accepts, for any position, and the scale's map from position to value and back is stable to three significant figures (property test, at least 100 runs);
   - the Recall_Record built from a Mark equals the one built from the same typed text;
   - the Number_Line range, padding and minimum span, and that a Mark never changes any Stamp's position (property test, at least 100 runs);
   - a Mark outside the range sits at the nearer edge with identical markup at both edges;
   - R10.2 to R10.5 (the extended Property 20 and the constants test);
   - the Seal_Break: an early release sends no event, a full hold sends one `ADVANCE`, the button sends one `ADVANCE`, a second completion sends none;
   - the contrast ratios in R11.6;
   - the static render of the figures stage holds the final state (R9.7);
   - every Ceremony gesture has a button or key equivalent;
   - `ASSETS.md` lists every asset (R15.2);
   - the import-boundary and source-scan rules in R1;
   - no `Math.random`, `Date.now` or clock read affects any rendered text, so the static render is the same on the server and in the browser (hydration).
4. THE Ceremony SHALL NOT add a browser test framework to the test suite. The browser check is the QA agent's Playwright run (R3.9), which screenshots each Stage.

### R18. Task split and order

**User story:** As the owner, I want the work cut so the video moments land first, each task leaves the flow working, and each PR stays reviewable.

1. EACH task SHALL be one GitHub issue and one PR, under 2,500 changed lines as `max_changed_lines` counts them in `.github/agents.json`, with a line estimate in `tasks.md`, and SHALL stay inside frontend-dev's paths plus `shared`.
2. EVERY task body SHALL contain the line "Before this task: Blocked by #49". No task is blocked by #84.
3. THE tasks SHALL run in this order, so the moments for the 3-minute video land first. The dependencies are a straight chain, each task depending on the one before it, so only one spec 05 PR is open at a time:

   | # | Task | Depends on | Rough lines |
   |---|---|---|---|
   | 1 | Scene base: desk surface, light, motion settings and Calm_Mode, Skip, Stage wrapper with `data-ceremony`, constants and Position_Property list, contrast tokens, `ASSETS.md`, and the live region (R3, R10.3, R10.5, R11, R13, R15) | none | 1,950 |
   | 2 | Envelope and checking views, the `intact` Stage, and the R2 copy change with its test updates (R2, R3, R5) | 1 | 1,650 |
   | 3 | Seal_Break, the `marks` and `seal` Stages (R6) | 2 | 1,500 |
   | 4 | Number_Lines, Stamps, range and Mark rules, the extended Property 20 with mirror reflection (R4.10, R9, R10.1 to R10.4, R12.1 to R12.4) | 3 | 1,750 |
   | 5 | Passage transition, counter, the sequenced Steps `then`, `passage` and `now`, and the constants test (R10.5, R10.6, R12.5 to R12.8) | 4 | 1,400 |
   | 6 | Letter ink-soak (R7) | 5 | 600 |
   | 7 | The desk on `/demo` (R8) | 6 | 1,600 |
   | 8 | Recall_Scale (R4) | 7 | 1,800 |
   | 9 | Close, Skip across all sequences including the Stage 3 Steps, and the reduced-motion and contrast review (R11, R12.9, R17) | 8 | 1,150 |
   | 10 | Sound and vibration (R14), optional | 9 | 650 |

   About 14,050 lines in total. Task 4 draws the Number_Lines and Stamps with both Stamps shown at once; task 5 adds the sequence between them. IF a task is found over 2,500 lines, THEN it SHALL be split and the split noted.
4. EACH task SHALL leave the Flow working end to end. A Stage that its task has not rebuilt yet SHALL keep the spec 03 look, on the new surface.
5. EACH task that adds a sequence SHALL include that sequence's Skip, Calm_Mode path and button equivalent. Task 9 reviews them as a whole, and adds the one that crosses sequences.
6. THE sound toggle and vibration come only in task 10. Tasks 1 to 9 SHALL NOT vibrate or play sound.
7. THE tasks SHALL NOT change a file outside frontend-dev's paths. A requirement that needs one SHALL be listed in the design for the owner's decision. The known ones are `src/app/layout.tsx`, `src/app/page.tsx` and `src/app/globals.css` (R1.7), `scripts/check.sh` and `scripts/check-js-budget.mjs` (R13.2) and `public/**` (listed for both platform-dev and frontend-dev; the Ceremony SHALL NOT use it).
8. EACH task's PR description SHALL state: the measured values from `scripts/check-js-budget.mjs`, the screenshots of its Stages taken with the QA agent's steps (R3.9), and a list of every asset added with its `ASSETS.md` entry.
10. EACH task body SHALL list the QA step numbers (design, "QA browser steps") that apply to it, and SHALL say that Stages from later tasks being missing or still in their spec 03 look is expected and is not a finding.
9. THE tasks SHALL carry the "Validation" line `bash scripts/check.sh` and, for tasks 2, 3, 4, 5 and 8, a note of which spec 03 tests they change and why.

## Open items for the owner

1. **Stage 3 and "only the sentence" (R9.6).** The brief said, for not comparable pairs, "no line, only the sentence". Spec 03 R11.6 and `data-integrity.md` say both figures keep their own periods. This document keeps the figures and the sentence and draws no line.
2. **The date on the envelope.** The brief asked for "the date it was sealed". A persona letter must never say it was sealed on the persona's date, and the real `sealedAt` is inside the letter and unavailable until it is opened (R3.7). The envelope shows "written as of" and the opening date, and the letter view shows "Sealed for the demo on {date}" after opening, as spec 03 requires.
3. **Where the desk lives.** "`/demo` only" is read as `/demo` and `/demo/personas/[key]`, so the desk is one continuous scene across both. `/` is unchanged.
4. **Completed spec 03 task text.** `.kiro/specs/03-persona-demo/tasks.md` task 6 (done) still says the card has a "Break the seal" link. It is a record of finished work, so it was left as it is. Spec 03 requirements and design were amended.
5. **Spec 03 property reference.** The brief said to extend "Property 20 / R12.4". Property 20 validates spec 03 R11.8 and R16.4. R12.4 is the change formula. This document extends Property 20 (R10.2).
