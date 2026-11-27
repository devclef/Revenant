#!/usr/bin/env node
// Revenant layout check (spec 07 and spec 08, design.md "QA browser steps").
// Owner-only: tools/** is not an agent path.
//
// One command walks the judge journey in headless Chromium at each size, runs
// the box and geometry checks (F1, F2, G1 to G3, D1, E1, T0), the spec 08
// checks (N1, W1, X1, B1, L1, R1, LG1 and the polish rows T2, FT1; spec 15 rows NB1, GC1, DL1, PV1) and
// the neutrality and data rules (NT1, NT2), and prints one line per result. It
// is the only copy of those check snippets. design.md points here.
//
// Spec 08 checks (spec 08 design.md "Owner patches", a):
//   N1  numbers-focus   after "See the numbers": the Figures_Heading is focused,
//                       below the Top_Bar and above the viewport bottom, and it
//                       moves at most 1 px from the figures read to the close read.
//   W1  letter-width    letter Stage: the Letter_Text is 28 to 40 em at 1366x800 and
//                       1280x800, and at least 280 px at 360x640.
//   X1  scroll-width    every Stage and page reached: no sideways scroll.
//   B1  figure-boxes    figures and close: every value, answer, change line and
//                       formula box sits inside its Figure_Entry box.
//   L1  line-labels     figures and close: no two Number_Line labels overlap.
//   R1  recall-in-view  recall, scrolled to the top: question, field and next
//                       control are inside the viewport.
//   LG1 landing-ghost   /: at 900 px and wider the Landing_Ghost is visible and
//                       its body covers no headline line and not the Accent link.
//                       Below 900 px it must be hidden (it covered the wax seal).
//   T2, FT1             polish only: tick labels, and the footer against the Soil.
//   BAND1               retired: it measured a light band down the Soil strip. Spec 15
//                       deletes the Envelope's dirt group (design.md, Envelope), so the
//                       band is gone. NB1 checks that it stays gone.
// A check whose element is not on this build yet prints a note, not a BLOCKER:
// N1 without [data-figures-heading], B1 without [data-figure-entry] or a
// figValue class, L1 without [data-line-label], LG1 without [data-ghost-pit] on /.
// W1, X1 and R1 measure what every build has and are always checked.
//
// Spec 09 checks (spec 09 design.md "Owner patches", q, and "Check hooks"):
//   BO1   button-overflow     every button and button-styled link: scrollWidth <= clientWidth.
//   BC1   control-in-card     every control inside its nearest [data-card], fieldset or
//                             [data-stage-panel].
//   RS1   scale-overlap       marks: no box of one [data-recorded-scale] meets a box of another.
//   GZ1   ghost-after-seal    letter, figures, close: no [data-ghost] in the document; during
//                             the seal, the Ghost_Body_Box centre hits the Ghost or nothing.
//   FV1   heading-focus-ring  the Figures_Heading has no outline after a mouse click on the
//                             figures button, and has one after Tab and Enter.
//   CTA1  landing-ctas        /: [data-cta="primary"] and [data-cta="secondary"] in view at the
//                             top; the primary links to /demo.
//   DX1   demo-cards-in-view  /demo at the Desktop_Sizes and the Wide_Size: every persona open
//                             link in view at the top.
//   U9    persona-seal-size   /demo at 1440x900 and 390x844: every [data-persona-seal] at least
//                             96 px wide and inside its persona card; no sideways scroll.
//                             Additive (issue #425): no existing layout-check row or test
//                             was changed or retired by this row.
//   U8    break-seal-size    Break the seal at 1440x900 and 390x844: the [data-seal-target] svg is
//                             at least 160 px (1440) and 120 px (390) wide, and the seal, the
//                             Break the seal hold control ([data-seal-button]) and any Skip
//                             control are inside the viewport (spec 13 U8.1 to U8.3).
//   LS1   landing-seal        / at 1440x900 and 390x844: [data-landing-seal] is at least 160 px
//                             (1440) and 120 px (390) wide, inside the First_Viewport, and the h1
//                             and the primary call to action are inside it (spec 13 L1.1 to L1.3).
//                             The row is LS1 because L1 is already the line-labels row.
//   P1    press-envelope      /demo/live seal step at 1440x900 and 390x844: the Press_Envelope is the
//                             largest element, a focusable button of at least 44x44 px, and the
//                             Press_Envelope and at most one Seal_Button inside [data-press-column]
//                             are the orange controls. The Warning_Text does not move during a short hold
//                             that sends nothing (spec 13 P1.1 to P1.4 as the failure messages name).
//   T1    wait-envelope      Wait step (after a passkey seal, so reached by Live_Walk, not here): the
//                             Sealed_Envelope_View and countdown inside the First_Viewport, and the
//                             Keep_Section top at or below the view bottom (spec 13 T1.2, T1.3).
//   TG2   wait-ghost          the same Wait step: the risen ghost box does not intersect the
//                             Keep_Section (spec 13 T2.2). Row ID TG2 because T2 is the tick row.
//   W     write-step          /demo/live Write step at 1440x900 and 390x844: Letter_Field top and
//                             question row heights (spec 13 W1.3, W4.4). The column and paper widths,
//                             Occasion heights and receipt row heights were retired (see W1, W4, W11, W12).
//   W8    heading-offset      /demo/live after the step change to Press the seal: the Step_Heading
//                             box at least 16 px below the Top_Bar (spec 13 W8.2).
//   LF1   landing-halves      / at 1440x900: each section with an h2 has content reaching past 60 %
//                             of its width (spec 13 F1.4). Row ID LF1 because F1 is the fit row.
//   LF2   ritual-cards        / at 1440x900 (wide rules) and 390x844 (one column): ritual card padding,
//                             text width, gaps and body text, and no clipped text (spec 13 F2.1 to F2.3).
//   F3    persona-remember     persona Remember step at 1440x900: the fictional notice clear of the
//                             Step_Indicator labels, question, answer and continue control in the
//                             viewport (spec 13 F3.1, F3.2). The notice count was retired: B1.4 counts it.
//   F4    live-remember       live Remember step (after a passkey seal, so reached by Live_Walk): Ghost
//                             inside the viewport, verdict 16 px below the Top_Bar, Ghost clear of the
//                             question, answer and verdict (spec 13 F4.1 to F4.3).
//   HW1   hero-wide           2560x1440: the / h1 font size is at least 1.5 times its 1366x800 size.
//   ST1   step-indicator      persona intact to close: [data-step-indicator] present; one
//                             aria-current="step" from recall on; 1 line at 600 px and wider,
//                             at most 2 below.
//   RC1   receipts-in-view    after the figures button at the Desktop_Sizes and the Wide_Size:
//                             the first [data-figure-entry] fully in view.
//   PH1   first-viewport ... PH7 touch-targets: the phone checks at 390x844 and 360x640
//                             (runPhoneChecks, exported for tools/qa/journey-check.mjs).
//   FONT1 fonts-loaded        the sans face loaded and on <body> on every page; the serif face
//                             loaded and on the Letter_Text where the letter shows (runFontCheck,
//                             exported). FONT2 fonts-sans-ui: every h1 to h3 and button in sans.
// Spec 12 Write-step checks (spec 12 design.md "W1.6: viewport arithmetic"), on /demo/live.
// They replace the spec 11 L3 thresholds, which needed every primary control, Next
// included, in view at phone sizes. Next's bottom is printed as a note, never asserted.
//   W1.6  write-step        at 1440x900: the Letter_Field shows 10 lines in view, its top is
//                           in view and the Occasion chips are in view. At phone sizes PH1
//                           asks for the field's top and 6 lines in view instead.
//   W1.7  write-step        at 360x640: the document and the Write card have no sideways
//                           scroll. Next's bottom is printed as a note at every size.
//   H1.6  landing-sections  at 1440x900 on /: every section's content box is at least 60%
//                           of the viewport width. Below 60% is a BLOCKER.
//   H2.7  ritual            at 1440x900 on /: the ritual list holds exactly four items in one
//                           row. Any other count or row layout is a BLOCKER.
// A spec 09 check prints BLOCKER only when its ID is passed with --require; any other
// failure prints polish. A spec 09 check whose element is not on the page prints a note.
//
// Spec 10 checks (spec 10 design.md "Owner patches", ad), BLOCKER only with --require:
//   TK1   tick-on-axis        figures and close: each [data-line-tick] top on its
//                             [data-line-axis] top (0±0.5 px), at most 8 px from its
//                             [data-line-label]; no two labels overlap.
//   SI1   step-indicator-fit  from recall on: every [data-step-indicator] li unclipped, in
//                             the viewport and clear of [data-ghost]; four items; at most
//                             2 lines below 600 px, 1 elsewhere. Not run at intact.
//   GT1   ghost-over-text     at the intact, recall and letter Stage starts and scrolled
//                             to the bottom (not marks or seal, which AL1 and SG1 own): no
//                             visible p, h1-h3, li, label, button, a, input or textarea
//                             outside [data-ghost] meets the Ghost_Body_Box. Elements
//                             inside the Ghost (the Envelope date lines, the Seal_Group)
//                             are skipped; ET1 and SG1 check them.
//                             Below 600 px, a note on builds with the pick-up.
//   FC1   load-focus          persona recall reached on load: focus on [data-stage-heading]
//                             and scrollY unchanged. A note on builds with the pick-up.
//   ET1   seal-on-envelope    marks at the Desktop_Sizes and 2560x1440: [data-envelope-seal]
//                             inside its [data-envelope-state], on no [data-date], no two
//                             drawn elements overlapping.
//   SG1   seal-group          marks: [data-seal-group] beside the Ghost_Body_Box (gap 0 to
//                             24 px), level with the seal, clear of the body and the
//                             Envelope; on the phone 0 to 24 px under [data-ghost].
//   AL1   answer-list         marks at every size: [data-answer-list] present, clear of
//                             [data-ghost] and [data-seal-group].
//   CF1   card-fit            every [data-card] and [data-stage-panel]: height minus its
//                             children's union at most 48 px, and it holds a non-control.
//   FP1   fastest-path        a fresh Maya page, pressing only [data-primary-control] (the
//                             button inside a wrapper) to [data-figures-heading]: at most
//                             2 + questions presses. A note on builds with the pick-up, or
//                             where the empty field leaves the button disabled.
// The persona walk works before and after spec 10 tasks 5 and 9: it presses "Pick up
// the letter" only when the build shows it, keeps a prefilled field, fills an empty one,
// and presses "Next question" and "Record my answers" with the mouse.
//
// Spec 14 Q1.1 desk rows (design.md "Layout rows"), on /demo/live at DESK_SIZES:
//   S1    step-track        the six Step_Track dots, labels, hairlines, one current, phone text
//   S2.2  step-change       Step_Track 16 to 48 px under the Top_Bar 1,000 ms after Fold
//   S2.3  step-focus        focus on [data-step-heading], no scroll drift after the change
//   S3.1  seal-columns      64 px column gap and level centres at 900 px and wider
//   S3.4  warning-to-seal   390 px only: seal bottom at most 844 px below the Warning_Text top
//   S6.1  press-envelope    width, 1.55 aspect, colour, radius, shadow, seal scale
//   S6.4  seal-no-choice    40 % opacity, not-allowed, aria-disabled, status line (before a choice)
//   S6.5  seal-chosen       full opacity, halo, aria-disabled false, status line (after "Skip it")
//   S6.6, S6.7              prompt and sealing states: reached by Live_Walk, noted here
//   S6.8  press-vs-text     envelope meets no text-column element; no horizontal scroll
//   W1    write-layout      side by side from 992 px, level tops, sticky panel, no scroll, Fold reachable
//   W4    letter-sheet      paper colour, radius, padding
//   W6.1  perforation       dashed 2 px line from sheet edge to sheet edge
//   W13.1 fold-button       56 px, Accent fill, dark 16 px weight 800 text, hover colour
//   W13.5 desk-accent       no Accent fill or border on other desk buttons
// Not yet rows: W2, W3, W5, W7 to W12, T, R, B, X2.1 and D1.1 to D1.3 (see the commit notes).
//
// Spec 15 rows (spec 15 tasks.md 14.1, design.md "Testing Strategy"). They block on any
// failure, with no --require, because the spec asks for them in the PR:
//   NB1   no-dirt-band       / and each persona page: no element with a dirt class or
//                            [data-dirt]. Replaces BAND1.
//   GC1   ghost-column       recall at 360x640 and 390x844: the [data-ghost] box is inside
//                            the viewport (unclipped) and its centre is within 8 px of the
//                            viewport centre (tone.md: the ghost is part of the column).
//   DL1   one-demo-label     /demo and each persona recall: exactly one "Demo" text leaf,
//                            the Top_Bar chip counted.
//   PV1   primary-in-view    recall (Remember) at 360x640, 390x844 and 1440x900: the
//                            [data-primary-control] button is inside the viewport. Press the
//                            seal, Wait, Unlock and Break the seal are measured by the Live_Walk
//                            (spec 15 task 14.2), not here.
// Already covered, so no row was added: "one persona notice" is B1.4 (the notice counted
// once in the Top_Bar), and "the Skip slot is stable" is B1.2 (the slots keep their place
// across the steps).
//
// Spec 16 rows (spec 16 requirement 17.3, task 15), at 1440x900 and 390x844. Like the
// spec 15 rows they block on any failure, with no --require (checkSpec16Rows):
//   R10.1 receipts-order     Maya's Receipts step and live step 6 (receiptsOrderFailures): question
//                            pairs, figure cards, the seal line and the end card top to bottom,
//                            the open letter beside the receipts rather than after the figures,
//                            no fold control on the page, and the letter text visible.
//   R10.6 live-column        live step 6 (splitColumnFailures): the record column (the union of the
//                            non-letter blocks) and the letter column side by side, tops level,
//                            each at least 280 px wide, the pair centred within 1 px of the
//                            viewport centre, and the record column within 1 px of Maya's
//                            receipts column width.
//   R14.3 passkey-warning    live Press the seal, after the step scroll and before any reader
//                            action: [data-warning-text] unfolded, inside the layout viewport,
//                            its bottom above the wax top. Calm off and on.
//   R5.4  hero-lines         /: at 1440x900 "Memory drifts with time." on one line box (5.4);
//                            at 390x844 no headline line holds one word (5.5). Calm off and on.
// R10.6 seals a real live demo letter with a virtual passkey (CTAP2 with PRF) and waits out
// the 30-second lock, so it needs the app's database and RP_ID set to the --url host.
//
// Spec 20 Part D readings (spec 20 design "QA browser steps", c to g). They run on the receipts
// of Maya and of live step 6 in every build. S20.long runs at 1280x800 with a 5,000-character
// letter and needs [data-receipts-layout="split"], else it reports "missing".
//   S20.c column-placement   900 px and wider: the letter column starts right of the record column,
//                            tops level within 1 px. Narrower: no two blocks sit side by side.
//   S20.d letter-sticks      900 px and wider only: after scrolling to the end, the letter column top
//                            is 0 to 32 px under the Top_Bar, unless the receipts end has reached its bottom.
//   S20.e focus-in-view      the Figures_Heading lies between the Top_Bar and the viewport bottom,
//                            1 s after the move. Only its position is read; document.activeElement
//                            is not checked, so focus is covered by the FV1 and N1 rows instead.
//   S20.f letter-motion      full motion: at most one animate call on the letter, and the letter
//                            node held before the move is still the one shown 2 s after it.
//   S20.f-reduced            reduced motion: no animate call and no animation on the letter.
//   S20.g figure-accent      no figure text is drawn in --accent.
//   S20.long long-letter     the letter column has tabindex 0, End scrolls it, and the last
//                            character comes into view.
//   S20.w split-width        Maya's receipts at 1280x800, 1440x900 and 1920x1080, scrolled to the end:
//                            the record column and the letter column are each at least 420 px wide,
//                            no element of the record column reaches into the letter column, and the
//                            end-card heading fits its card (scrollWidth <= clientWidth, box inside
//                            the card). Runs once, with the first spec 16 size.
//
// FR1   script-focus-outline  (GitHub issue #577, tools/qa/layout-rules-17.mjs) at 1440x900 and 390x844,
//                            on every step the walk shoots: a script-focused non-control draws no
//                            outline, and Tab once reaches a visible focus ring. Always a BLOCKER,
//                            with no --require. The row presses Tab, then puts scroll and focus back.
//
// CT1   text-contrast         (GitHub issue #579, tools/qa/layout-rules-17.mjs and src/lib/layout-check-ct1.ts)
//                            at 390x844 and 360x640: every visible text element meets WCAG 2.2 AA
//                            contrast on the surface it is painted on (4.5:1, or 3:1 for large text).
//                            Read on Press the seal, Remember (after question 1), Break the seal
//                            (the marks step), Receipts (the close step) and the landing, and on Wait
//                            at 1440x900 and 390x844. A walk that does not reach Press the seal or Wait
//                            is itself a CT1 BLOCKER, never a note, so an unreachable page cannot pass. Always a
//                            BLOCKER, with no --require. Spec 17 requirements 2.3, 2.7 and 2.10.
//
// GO1   ghost-overlap         (GitHub issue #583, tools/qa/layout-rules-17.mjs) at 390x844 on the Remember
//                            step (recall), at its start and scrolled to the bottom: no text line or
//                            visible control rect overlaps the Ghost's drawn box. No opaque-panel exemption.
//                            Each overlap is a BLOCKER that names the text or control, the layer and the px overlap.
//                            It replaces GT1 and the G1 opaque-ancestor skip on that step.
//                            GO1 also tests every text line against the [data-soil-strip] rect, read again
//                            after the scroll: an overlap fails (soil-overlap), and so does a line closer
//                            than 8 px, touching included (soil-clearance).
//                            On Break the seal (Maya's walk, marks stage) at 1440x900 and 390x844.
//
// LC1   column-coherence      (GitHub issue #585, tools/qa/layout-rules-17.mjs) on Break the seal at 1440x900
//                            (the persona walks): the Seal group starts at most 64 px right of the column
//                            beside it ([data-figures-column], else the marks card, which is what Break the
//                            seal shows), and its top lies inside the column's top and bottom. On Break the
//                            seal and on Remember, the first text line under [data-step-track] starts at
//                            least 16 px below the track (track-gap). Any failure is a BLOCKER.
//
// CW1   content-column-width  (GitHub issue #581, tools/qa/layout-rules-17.mjs)
//                            at 390x844 and 360x640: the [data-content-column] content box is at least
//                            viewport minus 48 px. Read on every step shot() captures, on Press the seal,
//                            and beside the R10.6 live-receipts comparison. A page with no column is
//                            skipped. Any failing reading is a BLOCKER.
//
// SF1   panel-fills-surface   (GitHub issue #587, tools/qa/layout-rules-17.mjs) on Press the seal at
//                            1440x900, 390x844 and 360x640: the Seal panel is at least 99% of its
//                            surface width, and no cream strip wider than 2 px sits beside it.
//                            Any failure is a BLOCKER.
// TT1   wax-target-size       (GitHub issue #587, tools/qa/layout-rules-17.mjs) on Press the seal at the
//                            same sizes: each [data-wax] press mark is at least 44 x 44 px at rest.
//                            Any failure is a BLOCKER.
//
// Line format: <PASS|BLOCKER|polish|note> <id> <name> <WxH> <stage> <detail>.
// The spec 08 and spec 09 checks put the measured values and threshold=<...> in <detail>.
//
// Usage:
//   npm run layout-check -- --url http://localhost:3000
//   npm run layout-check -- --url http://localhost:3000 --sizes 360x640
//   npm run layout-check -- --url http://localhost:3000 --all-sizes
//   npm run layout-check -- --url http://localhost:3000 --require BO1,BC1,FV1
//
// Options:
//   --url <origin>      Required. The running app. Start it first, with a database
//                       that has the demo personas (see docs/agent-loop.md).
//   --sizes <WxH,...>   Viewports. Default 1366x800,1280x800,360x640,390x844,2560x1440
//                       (the spec 09 Evidence_Sizes).
//   --all-sizes         The seven spec 07 sizes plus 1366x800 and 390x844. Used for the polish pass.
//   --require <ID,...>  Spec 09 and spec 10 check IDs whose failures are BLOCKERs. An unknown ID prints a note.
//   --shots <dir>       Screenshots go to <dir>/<WxH>/<stage>.png.
//                       Default layout-check-shots.
//   --chromium <path>   Chromium binary. Default $CHROMIUM_PATH, then /usr/bin/chromium.
//
// Results, one level per line:
//   BLOCKER  Fails the run. Only these:
//            - text or a control on the Ghost's body (G1), or on the Soil strip (F2, F1)
//            - the main button of a stage not fully visible at 1280x800 without scrolling
//            - a spec 08 check that measured its element and failed (N1, W1, X1, B1, L1,
//              R1, LG1)
//            - a flow that cannot be finished: the control is there and does nothing
//            - a judgement word, an exclamation mark or red or green text outside the
//              persona letter (neutrality.md, data-integrity.md)
//            - a spec 09 check that failed and whose ID was passed with --require
//            - a spec 15 row (NB1, GC1, DL1, PV1) that failed, with no --require
//            - the spec 17 rows SF1, TT1, CT1, UQ1, CW1, GO1, FR1 and LC1 that failed.
//              They block with no --require. Any blocker makes the process exit 1.
//   polish   Reported, never fails the run. Every other layout measure: 1 px drift,
//            margins, the Top_Bar height, dust height, a date wrapping, a sideways
//            Ghost move, and any size other than 1280x800 for the button rule.
//   note     A stage this build does not have yet, or one the walk could not reach.
//            Not a failure.
//
// Exit codes: 0 no blocker. 1 at least one blocker. 2 the check could not start
// (bad arguments, no Chromium, or the app does not answer at --url).
//
// For task 15: rows that fail because of a product file, from the run of the spec 15
// rows against a built app. Each entry names the row, its output and the suspected file.
// The two entries below were quoted in the ticket for this task. The layout check was not
// run against a built app in the task that wrote this list. QA confirms them with
// `npm run layout-check`.
//
//   DL1   one-demo-label         labels=2 on /demo, want one
//         suspected file:        src/components/ceremony/scene/TopBar.tsx and src/app/demo/page.tsx
//   PV1   primary-in-view        at 360x640 the primary control is outside the viewport
//         suspected file:        src/components/ceremony/recall/RecallPager.tsx
//
// For task 19: known product gaps. Each row below reads a hook attribute that no
// src/ file renders yet, so on a build without it the row reports a missing or
// failing result. This list is written from the row code and a grep of src/. No
// row has been run against a built app. The owner must run npm run layout-check
// and quote each result line.
//
//   S3.4  warning-to-seal        today: missing ("no [data-warning-text] or [data-press-envelope]")
//         missing attribute:     data-press-envelope
//         suspected file:        no src file renders it yet
//   S6.1  press-envelope         today: missing ("no [data-press-envelope]")
//         missing attribute:     data-press-envelope
//         suspected file:        no src file renders it yet
//   S6.8  press-vs-text          today: fail ("S6.8 no [data-press-envelope] to measure")
//         missing attribute:     data-press-envelope
//         suspected file:        no src file renders it yet
//   R1.2  letter-column          today: missing ("no [data-scene-frame] to centre against")
//         missing attribute:     data-scene-frame
//         suspected file:        no src file renders it yet
//   T2.5  sample-note-viewport   today: fail ("T2.5 Sample_Note is outside the First_Viewport")
//         missing attribute:     data-sample-note
//         suspected file:        no src file renders it yet
//   W8    ask-another            today: no pills found, so the pill checks run on an empty list
//         missing attribute:     data-suggestion-pill
//         suspected file:        no src file renders it yet
//   S6.6, S6.7, R6.1             need a manual Live_Walk passkey run by the owner.
//
// The W8 heading-offset row (W8.2) reads data-topbar and data-live-stepper, not any
// attribute above.

//
// Speed and scope (owner change, see docs/agent-loop.md "Layout check"):
//   --jobs N           sections run N at a time in one browser (default 4; --jobs 1 is
//                      the old one-after-another order). Output keeps the section order.
//   --stages a,b       only the sections of these stage groups (layout-scope.mjs STAGE_GROUPS).
//   --only-sizes a,b   every section, the walk included, only at these sizes.
//   --quiet            prints only BLOCKER lines, "could not run" notes and the summary.
//                      The full output always goes to <shots>/layout-check.log.
//   --save-blockers f  writes the run's BLOCKER and polish rows to f (JSON).
//   --baseline f|main  marks each BLOCKER new or already on main; only new ones fail.
//                      "main" asks tools/qa/layout-baseline.mjs for the cached main run.
// A browser that closes part-way is started again and the section re-run once. SIGHUP is
// ignored, so a closed terminal no longer kills the browser; SIGTERM and SIGINT stop the
// run and still print the summary. Exit 3 means the run did not finish.

import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALL_STAGE_GROUPS,
  baselineGaps,
  blockersFile,
  matchBaseline,
  parseSizeList,
  parseStages,
  personaOfStage,
  readBlockersFile,
  resultOf,
  sectionRuns,
  summaryLines,
} from "./layout-scope.mjs";
import {
  CT1_SIZES,
  CW1_SIZES,
  cwFailures,
  frFailures,
  goFailures,
  lcFailures,
  lcTrackFailures,
  readCt1Failures,
  readFr1Reading,
  readGo1Soil,
  readLc1Reading,
  readSf1Reading,
  readTt1Reading,
  readUq1Reading,
  sfFailures,
  ttFailures,
  uqFailures,
} from "./layout-rules-17.mjs";

// SF1 and TT1 (GitHub issue #587) run on Press the seal at these sizes. Each failure is a BLOCKER.
export const SF1_TT1_SIZES = ["1440x900", "390x844", "360x640"];

// FR1 (GitHub issue #577) runs at these sizes on every step the walk shoots. It always blocks.
const FR1_SIZES = ["1440x900", "390x844"];
// GO1 (GitHub issue #583) runs on the Remember step at these sizes. It replaces GT1 and the G1 opaque skip there.
const GO1_SIZES = ["390x844"];
// GO1 also runs on Break the seal (the marks stage) at these sizes, with the Soil strip check.
const GO1_BREAK_SIZES = ["1440x900", "390x844"];
// LC1 (GitHub issue #585) runs on Break the seal at these sizes.
const LC1_SIZES = ["1440x900"];

const DEFAULT_SIZES = ["1366x800", "1280x800", "360x640", "390x844", "2560x1440"];
const ALL_SIZES = ["360x640", "390x844", "1024x768", "1280x720", "1280x800", "1366x800", "1440x900", "1920x1080", "2560x1440"];
// Spec 09 (design.md "Owner patches", q). Only these IDs are accepted by --require.
const SPEC09_CHECKS = ["BO1", "BC1", "RS1", "GZ1", "FV1", "CTA1", "DX1", "HW1", "ST1", "RC1", "PH1", "PH2", "PH3", "PH4", "PH5", "PH6", "PH7", "FONT1", "FONT2"];
// Spec 10 (spec 10 design.md "Owner patches", ad). Also accepted by --require.
const SPEC10_CHECKS = ["TK1", "SI1", "GT1", "FC1", "ET1", "SG1", "AL1", "CF1", "FP1"];
const REQUIRABLE_CHECKS = [...SPEC09_CHECKS, ...SPEC10_CHECKS];
const TK1_AXIS_TOL_PX = 0.5;
const TK1_LABEL_GAP_MAX_PX = 8;
const SI1_ITEMS = 4;
const SI1_LINES_PHONE_MAX = 2;
const SG1_GAP_MAX_PX = 24;
const CF1_SLACK_MAX_PX = 48;
const FP1_MAX_PRESSES = 12;
const FP1_WAIT_STEPS = 15;
// The walk waits this long after load for recall or a "Pick up the letter" button.
const FIRST_STAGE_WAIT_MS = 15000;
// The walk's answer for an empty text field (an Author_Question, spec 10 task 7 on).
const TEXT_ANSWER = "Mostly work, and the evenings at home.";
// Exactly 200 characters, for the T1.6 200-character case (checkPersonaRows).
const T16_ANSWER = "Mostly work, and the evenings at home. ".repeat(6).slice(0, 200);
const DESKTOP_SIZES = ["1366x800", "1280x800"];
const WIDE_SIZE = "2560x1440";
const HW1_BASE_SIZE = "1366x800";
const HW1_RATIO_MIN = 1.5;
const PH_GAP_MAX_PX = 64;
const PH_TOPBAR_MAX_PX = 56;
// The persona page's bar holds the fictional notice and Skip (spec 14 B1.5, 96 px at 360 and 390).
const PH_TOPBAR_PERSONA_MAX_PX = 96;
// The Top_Bar height limit for a route kind (routeKind). Pure, so unit tests use it.
export function phTopbarMaxPx(kind) {
  return kind === "persona" ? PH_TOPBAR_PERSONA_MAX_PX : PH_TOPBAR_MAX_PX;
}
const PH_TARGET_MIN_PX = 44;
const PH_HEADLINE_LINES_LANDING = 3;
const PH_HEADLINE_LINES_OTHER = 2;
const PH6_SIZE = "390x844";
const PH6_SCREENS = 3;
const ST_LINES_PHONE_MAX = 2;
// Spec 12 W1.6 and W1.7 (design.md "W1.6: viewport arithmetic"). The Write step is
// the first card of /demo/live. Lines are counted only where the whole line is in
// the window. Next is reported, not asserted, at 1440x900 and at the phone sizes.
const WRITE_CARD = '[data-card="live-step-write"]';
const W16_SIZE = "1440x900";
const W16_LINES_DESKTOP = 10;
const W16_LINES_PHONE = 6;
const W17_SIDEWAYS_SIZE = "360x640";
// H1.6 (spec 11 H1.6, spec 12 design.md "Layout checks"): on / at 1440x900, no section's
// content box may be narrower than 60% of the viewport width.
const H16_SIZE = "1440x900";
const H16_RATIO_MIN = 0.6;
// H2.7 (spec 12 design.md "Layout checks"): on / at 1440x900 the ritual list is four items
// in one row. Items whose tops differ by at most H27_ROW_TOLERANCE_PX share a row.
const H27_SIZE = "1440x900";
const H27_ITEMS = 4;
const H27_ROW_TOLERANCE_PX = 1;
// Spec 08 thresholds (spec 08 requirements R2, R3, R8, R27).
const PHONE_WIDTH_MAX = 600;
const LETTER_EM_MIN = 28;
const LETTER_EM_MAX = 40;
const LETTER_PHONE_MIN_PX = 280;
const FOCUS_DRIFT_MAX_PX = 1;
const FOCUS_SETTLE_MS = 1000;
// Spec 15 rows. They always block (see report) and need no --require.
// R10.1 (receipts order) and R10.6 (live column) always use the open-letter readings
// (receiptsOrderFailures and splitColumnFailures).
const SPEC15_CHECKS = ["NB1", "GC1", "DL1", "PV1", "R10.1", "R10.6", "R14.3", "R5.4"];
// Spec 20 Part D readings (see the header). They block on any failure, like the spec 15 rows.
const S20_CHECKS = ["S20.c", "S20.d", "S20.e", "S20.f", "S20.f-reduced", "S20.g", "S20.long", "S20.w"];
const GC1_CENTRE_TOL_PX = 8;
// The text of the Top_Bar's Demo chip (scene/copy.ts) and of the DemoLabel (demo/copy.ts).
const SPEC15_DEMO_LABEL = "Demo";
const MAIN_RULE_SIZE = "1280x800";
const TOP_BAR_SIZE = "360x640";
const TOP_BAR_MAX_PX = 96;
const WAIT_MS = 8000;
const PERSONA_PATH = "/demo/personas/us-maya";
// Both personas are walked, because spec 09 QA checks name both. Maya's stages
// and shots keep their spec 07 names; Tomás's carry the "eu-tomas/" prefix.
// Tomás's answers follow the unit the recall question shows (spec 09 C8 changes it).
const PERSONAS = [
  { key: "us-maya", path: PERSONA_PATH, prefix: "", answers: () => ["3.20", "3.90"] },
  { key: "eu-tomas", path: "/demo/personas/eu-tomas", prefix: "eu-tomas/", answers: (text) => (/1,000 litres/.test(text) ? ["1850", "1700"] : ["1.85", "1.70"]) },
];
const PICK_UP = "Pick up the letter";
const NEXT = "Next question";
const RECORD = "Record my answers";
const BREAK_SEAL = "Break the seal";
// Spec 09 renames: the figures button (task 14), "Show everything" (task 17) and
// the landing's Accent control (tasks 8 and 9). The walk accepts the old and new
// labels, and the data-* hooks first where a build has them.
const SEE_NUMBERS = "See the numbers";
const FIGURES_LABEL = /^(See the numbers|See the receipts)$/;
const FIGURES_HOOK = '[data-advance="figures"]';
// The landing's Accent control is a next/link, so the walk finds it by role link.
const LANDING_START = /Open Maya/;
const LANDING_HOOK = '[data-cta="primary"]';
const SHOW_ALL = "Show everything";
const SHOW_ALL_LABEL = /^(Show everything|Skip to the receipts)$/;
const LIVE_PATH = "/demo/live";
const LIVE_UNREACHED = "created, confirming, sealing, sealed, the wait, unlock, remember and receipts";
const SEALED_BODY = JSON.stringify({ status: "sealed", opensAt: "2099-01-01T00:00:00.000Z" });

// ---------------------------------------------------------------------------
// Page-side checks. Each runs inside the page through page.evaluate, so it must
// stay self-contained. Thresholds come from design.md (Ghost_Body_Box, R5.19).
// ---------------------------------------------------------------------------

// F2: nothing readable or clickable on the Soil strip.
const F2 = () => {
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  if (!soil) return null;
  const onOpaquePanel = (el) => {
    for (let p = el; p && p !== document.querySelector("main"); p = p.parentElement) {
      const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
    }
    return false;
  };
  const hits = [];
  const panelHits = [];
  for (const el of document.querySelectorAll("main h1, main h2, main h3, main p, main li, main a, main button, main input, main label, main summary, header p, header button")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (r.bottom > soil.top && r.top < soil.bottom && r.right > soil.left && r.left < soil.right) {
      (onOpaquePanel(el) ? panelHits : hits).push(el.textContent.trim().slice(0, 40) || el.tagName);
    }
  }
  return { hits, panelHits };
};

// F1: named boxes fully in the window and off the Soil strip. `selectors` is a list of { name, sel }.
const F1 = (selectors) => {
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  return selectors.map(({ name, sel }) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const r = el.getBoundingClientRect();
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    // A box on an opaque paper panel is drawn over the Soil, so its text still reads.
    const onPanel = (() => {
      for (let p = el; p && p !== document.querySelector("main"); p = p.parentElement) {
        const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
      }
      return false;
    })();
    const onSoil = soil && !onPanel ? r.bottom > soil.top && r.top < soil.bottom : false;
    const onPanelSoil = soil && onPanel ? r.bottom > soil.top && r.top < soil.bottom : false;
    return { name, inView, onSoil, onPanelSoil };
  });
};

// G1 (R5.19): no text line box and no control box on the Ghost_Body_Box.
const G1 = () => {
  const onOpaquePanel = (el, stop) => {
    for (let p = el; p && p !== stop; p = p.parentElement) {
      const m = getComputedStyle(p).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) >= 0.9)) return true;
    }
    return false;
  };
  const g = document.querySelector("[data-ghost-box]")?.getBoundingClientRect();
  if (!g) return null;
  const body = {
    l: g.left + 0.12 * g.width,
    r: g.right - 0.12 * g.width,
    t: g.top + 0.155 * g.height,
    b: g.bottom - 0.12 * g.height,
  };
  const hit = (r) => r.width > 0 && r.height > 0 && r.right > body.l && r.left < body.r && r.bottom > body.t && r.top < body.b;
  const hits = [];
  for (const root of [document.querySelector("main"), document.querySelector("header")]) {
    if (!root) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (!text) continue;
      // Text on an opaque panel inside <main> (an envelope, a card) is drawn over the Ghost and stays readable.
      if (root.tagName === "MAIN" && onOpaquePanel(n.parentElement, root)) continue;
      if (n.parentElement?.closest("[class*=\"nvelope\"]")) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) {
        if (hit(r)) {
          hits.push(`"${text.slice(0, 40)}"`);
          break;
        }
      }
    }
  }
  for (const el of document.querySelectorAll("main a, main button, main input, main label, header button, header a")) {
    // A control on an opaque card is drawn over the Ghost too, and is still usable.
    if (el.closest("main") && onOpaquePanel(el, document.querySelector("main"))) continue;
    if (hit(el.getBoundingClientRect())) hits.push(`control "${(el.textContent.trim() || el.tagName).slice(0, 30)}"`);
  }
  return { hits: [...new Set(hits)] };
};

// G2 (R5.16, R5.17): the Ghost_Box centre x, from the browser's own box.
const G2 = () => {
  const g = document.querySelector("[data-ghost-box]")?.getBoundingClientRect();
  return g ? g.left + g.width / 2 : null;
};

// G3 (R8.14, R6.18): wordmark and headline line up, even side margins, Soil full width.
const G3 = () => {
  const wm = document.querySelector("[data-wordmark]")?.getBoundingClientRect();
  const h1 = document.querySelector("h1")?.getBoundingClientRect();
  const last = document.querySelector("[data-topbar-last]")?.getBoundingClientRect();
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  if (!wm || !last || !soil) return null;
  return {
    leftMargin: wm.left,
    rightMargin: innerWidth - last.right,
    headlineLeft: h1 ? h1.left : null,
    soilLeft: soil.left,
    soilRight: soil.right,
    windowWidth: innerWidth,
  };
};

// D1 (R6.16): the highest drawn canvas row over 3 s, against the ceiling.
const D1 = async () => {
  const c = document.querySelector("[data-soil-canvas]");
  if (!c) return null;
  const ctx = c.getContext("2d");
  const k = c.width / c.getBoundingClientRect().width;
  const bar = document.querySelector("header").getBoundingClientRect().bottom;
  const h1 = document.querySelector("[data-scene-ceiling]")?.getBoundingClientRect().bottom ?? 0;
  const ceiling = Math.max(bar, h1) + 8 - c.getBoundingClientRect().top;
  let highest = Infinity;
  for (let i = 0; i < 30; i++) {
    const rows = Math.max(1, Math.floor(ceiling * k));
    const d = ctx.getImageData(0, 0, c.width, rows).data;
    for (let p = 3; p < d.length; p += 4) {
      if (d[p] > 0) {
        highest = Math.min(highest, Math.floor((p >> 2) / c.width) / k);
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return { ceiling, drawnAboveCeiling: highest !== Infinity, highest: highest === Infinity ? null : highest };
};

// E1 (R8.8): each Envelope_Front date on one line.
const E1 = () =>
  [...document.querySelectorAll("[data-date]")].map((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    return { text: el.textContent, lines: tops.size };
  });

// T0 (R8.1): the Top_Bar height in CSS px.
const T0 = () => document.querySelector("header")?.getBoundingClientRect().height ?? null;

// ---------------------------------------------------------------------------
// Spec 08 page-side measures (spec 08 design.md "Owner patches", a). Each returns
// { missing: true } when the element it measures is not on this build, so the
// runner prints a note instead of a BLOCKER.
// ---------------------------------------------------------------------------

// N1 (R2, R27.2): focus and position of the Figures_Heading.
const N1_READ = () => {
  const heading = document.querySelector("[data-figures-heading]");
  if (!heading) return { missing: true };
  const bar = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
  return {
    focused: document.activeElement === heading,
    active: document.activeElement?.tagName?.toLowerCase() ?? "none",
    top: heading.getBoundingClientRect().top,
    barBottom: bar,
    viewportHeight: innerHeight,
    stage: document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") ?? null,
  };
};

// W1 (R3.2, R3.3, R27.3): the Letter_Text content box, in em and px. Builds that
// predate [data-letter-text] are measured on the letter paragraph inside the
// sealed letter (the longest <p> there), so the check works on main today.
const W1_READ = () => {
  let el = document.querySelector("[data-letter-text]");
  if (!el) {
    const root = document.querySelector('[class*="sealedLetter"]');
    if (root) {
      el = [...root.querySelectorAll("p")].sort((a, b) => b.textContent.length - a.textContent.length)[0] ?? null;
    }
  }
  if (!el) return { missing: true };
  const cs = getComputedStyle(el);
  const px = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const fontPx = parseFloat(cs.fontSize);
  return { px, fontPx, em: px / fontPx, selector: el.hasAttribute("data-letter-text") ? "[data-letter-text]" : "sealed letter <p>" };
};

// X1 (R3.4, R27.4): sideways scroll.
const X1_READ = () => ({
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
});

// B1 (R3.5, R27.5): every value, answer, change line and formula inside its entry.
const B1_READ = () => {
  const entries = [...document.querySelectorAll("[data-figure-entry]")];
  const hasFigValue = !!document.querySelector('[data-figure-entry] [class*="figValue"]');
  if (!entries.length || !hasFigValue) return { missing: true, entries: entries.length, hasFigValue };
  const outside = [];
  let measured = 0;
  const parts = [
    ["then", '[data-role="then"] [class*="figValue"]'],
    ["now", '[data-role="now"] [class*="figValue"]'],
    ["answer", '[data-line-label="answer"], [class*="figAnswer"]'],
    ["change", '[class*="change"]'],
    ["formula", '[class*="formula"]'],
  ];
  entries.forEach((entry, i) => {
    const e = entry.getBoundingClientRect();
    for (const [name, sel] of parts) {
      for (const el of entry.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        measured += 1;
        const over = Math.max(e.left - r.left, r.right - e.right, e.top - r.top, r.bottom - e.bottom);
        if (over > 0.5) outside.push(`entry ${i + 1} ${name} by ${over.toFixed(1)} px`);
      }
    }
  });
  return { missing: false, entries: entries.length, measured, outside };
};

// L1 (R5.3, R27.5): pairwise overlap of Number_Line labels, per entry.
const L1_READ = () => {
  const labels = [...document.querySelectorAll("[data-line-label]")];
  if (!labels.length) return { missing: true };
  const groups = new Map();
  for (const el of labels) {
    const key = el.closest("[data-figure-entry]") ?? el.parentElement;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  const overlaps = [];
  let worst = 0;
  let g = 0;
  for (const els of groups.values()) {
    g += 1;
    const boxes = els.map((el) => [el.getAttribute("data-line-label") || "label", el.getBoundingClientRect()]);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [na, a] = boxes[i];
        const [nb, b] = boxes[j];
        const area = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        worst = Math.max(worst, area);
        if (area > 0) overlaps.push(`entry ${g}: ${na} and ${nb} overlap ${area.toFixed(1)} px²`);
      }
    }
  }
  return { missing: false, labels: labels.length, overlaps, worst };
};

// R1 (R8.2, R27.6): the recall question, field and next control in the viewport.
const R1_READ = () =>
  [
    ["question", '[data-fit="question"]'],
    ["field", '[data-fit="answer"] input'],
    ["next", '[data-fit="advance"]'],
  ].map(([name, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return { name, missing: true };
    const r = el.getBoundingClientRect();
    return { name, top: r.top, bottom: r.bottom, left: r.left, right: r.right, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
  });

// LG1 (R9.10, R9.11, R27.7): the Landing_Ghost is visible and its body is clear of
// the headline's line boxes and the Accent link. The body box uses the same
// fractions as G1.
// The persona Remember step pre-fills each figure question with a sample answer,
// picked per visit from a seed drawn with crypto.getRandomValues on one
// Uint32Array (src/components/reveal/sample-seed.ts). The picked value moves the
// scale readout, so a run could report a CT1 or GO1 row that another run of the
// same commit did not, and the baseline gate failed at random. Every context
// this script opens returns this fixed value for that one call shape, so the
// same build always shows the same samples. Every other getRandomValues call
// (Uint8Array nonces and keys) is untouched.
const SAMPLE_SEED = 1;
function pinSampleSeedInPage(seed) {
  const original = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (array) => {
    if (array instanceof Uint32Array && array.length === 1) {
      array[0] = seed;
      return array;
    }
    return original(array);
  };
}
function pinSampleSeed(browser) {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    await context.addInitScript(pinSampleSeedInPage, SAMPLE_SEED);
    return context;
  };
  return browser;
}

const LG1_HIDDEN_BELOW_PX = 900;
const LG1_READ = (startPattern) => {
  const pit = document.querySelector("[data-ghost-pit]");
  if (!pit) return { missing: true };
  const boxEl = pit.querySelector("[data-ghost-box]") ?? pit;
  const g = boxEl.getBoundingClientRect();
  let opacity = 1;
  for (let el = boxEl; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
  const inViewport = g.right > 0 && g.bottom > 0 && g.left < innerWidth && g.top < innerHeight;
  const body = { l: g.left + 0.12 * g.width, r: g.right - 0.12 * g.width, t: g.top + 0.155 * g.height, b: g.bottom - 0.12 * g.height };
  const hit = (r) => r.width > 0 && r.height > 0 && r.right > body.l && r.left < body.r && r.bottom > body.t && r.top < body.b;
  const hits = [];
  const h1 = document.querySelector("h1");
  if (h1) {
    const range = document.createRange();
    range.selectNodeContents(h1);
    if ([...range.getClientRects()].some(hit)) hits.push("headline");
  }
  const re = new RegExp(startPattern);
  const link = document.querySelector('[data-cta="primary"]') ?? [...document.querySelectorAll("a")].find((a) => re.test(a.textContent));
  if (link && hit(link.getBoundingClientRect())) hits.push("Accent link");
  return { missing: false, width: g.width, height: g.height, opacity, inViewport, hits, centre: g.left + g.width / 2 };
};

// T2 (R6.5, polish): tick labels per scale. Uses [data-tick-label] when a build
// has it, else the children of each scale's labels row.
const T2_READ = () => {
  let groups = [...document.querySelectorAll("[data-tick-labels]")].map((row) => [...row.querySelectorAll("[data-tick-label]")]);
  if (!groups.length) groups = [...document.querySelectorAll('[class*="labels"]')].map((row) => [...row.children]);
  const overlaps = [];
  groups.forEach((els, g) => {
    const boxes = els.map((el) => [el.textContent.trim(), el.getBoundingClientRect()]).filter(([, r]) => r.width > 0);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [ta, a] = boxes[i];
        const [tb, b] = boxes[j];
        if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)) overlaps.push(`scale ${g + 1}: "${ta}" and "${tb}"`);
      }
    }
  });
  return { scales: groups.length, overlaps };
};

// FT1 (R12.6, polish): with the page scrolled to its end, the footer against the Soil strip.
const FT1_READ = () => {
  const footer = document.querySelector("footer");
  if (!footer) return { missing: true };
  const f = footer.getBoundingClientRect();
  const soil = document.querySelector("[data-soil-strip]")?.getBoundingClientRect();
  const touches = soil ? f.bottom > soil.top && f.top < soil.bottom : false;
  return { missing: false, top: f.top, bottom: f.bottom, soilTop: soil?.top ?? null, soilBottom: soil?.bottom ?? null, touches };
};

// Neutrality and data (neutrality.md, data-integrity.md). Persona letter text is
// exempt from the words check (the letter is the persona's own voice); it is
// read by the copy test instead. Everything else on screen is checked.
const NEUTRALITY = () => {
  const JUDGEMENT = /\b(soared|plunged|skyrocketed|finally|cheaper|dearer|better|worse)\b/i;
  const hueName = (css) => {
    const parts = css.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    if (parts.length > 3 && Number(parts[3]) < 0.5) return null;
    const [r, g, b] = parts.slice(0, 3).map((v) => Number(v) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < 0.25 || max < 0.4) return null;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h <= 15 || h >= 345) return "red";
    if (h >= 80 && h <= 170) return "green";
    return null;
  };
  const judgement = new Set();
  const exclaim = new Set();
  const colour = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || el.closest("script, style, noscript")) continue;
    if (el.closest('[class*="sealedLetter"]')) continue;
    // Text a reader typed (spec 10 S2.2) is never checked.
    if (el.closest("[data-user-content]")) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const match = text.match(JUDGEMENT);
    if (match) judgement.add(match[0].toLowerCase());
    if (text.includes("!")) exclaim.add(text.slice(0, 40));
    const hue = hueName(getComputedStyle(el).color);
    if (hue) colour.add(`${hue} text "${text.slice(0, 40)}"`);
  }
  return { judgement: [...judgement], exclaim: [...exclaim], colour: [...colour] };
};

// ---------------------------------------------------------------------------
// Spec 09 page-side measures (spec 09 design.md "Owner patches", q). Each runs
// inside the page and stays self-contained. Each returns { missing: true } when
// the element it measures is not on this build, so the runner prints a note.
// ---------------------------------------------------------------------------

// BO1 (A8.1): button labels inside their buttons, after web fonts load.
const BO1_READ = async () => {
  await document.fonts.ready;
  const els = [...document.querySelectorAll('button, a[class*="button" i]')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: true };
  const over = [];
  let worst = 0;
  for (const el of els) {
    const d = el.scrollWidth - el.clientWidth;
    worst = Math.max(worst, d);
    if (d > 0) over.push(`"${(el.textContent.trim() || el.getAttribute("aria-label") || el.tagName).slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}px`);
  }
  return { missing: false, count: els.length, worst, over };
};

// BC1 (A8.2): every control inside its nearest card, fieldset or Stage panel.
const BC1_READ = () => {
  const CONTAINER = "[data-card], fieldset, [data-stage-panel]";
  const containers = document.querySelectorAll(CONTAINER);
  if (!containers.length) return { missing: true };
  const controls = document.querySelectorAll('button, input:not([type="hidden"]), select, textarea, summary, [role="button"], a[class*="button" i]');
  let measured = 0;
  let worst = 0;
  const outside = [];
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const box = el.parentElement?.closest(CONTAINER);
    if (!box) continue;
    measured += 1;
    const c = box.getBoundingClientRect();
    const by = Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom);
    worst = Math.max(worst, by);
    if (by > 0.5) outside.push(`"${(el.textContent.trim() || el.getAttribute("aria-label") || el.tagName).slice(0, 30)}" by ${by.toFixed(1)}px`);
  }
  return { missing: false, containers: containers.length, measured, worst, outside };
};

// RS1 (A9.2): no box inside one read-only Recall_Scale meets a box in another.
const RS1_READ = async () => {
  await document.fonts.ready;
  const scales = [...document.querySelectorAll("[data-recorded-scale]")];
  if (!scales.length) return { missing: true };
  const sets = scales.map((s) => [s, ...s.querySelectorAll("*")].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0));
  let worst = 0;
  const hits = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      let pairWorst = 0;
      for (const a of sets[i]) {
        for (const b of sets[j]) {
          const area = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          pairWorst = Math.max(pairWorst, area);
        }
      }
      worst = Math.max(worst, pairWorst);
      if (pairWorst > 0.01) hits.push(`scale ${i + 1} and ${j + 1} overlap ${pairWorst.toFixed(1)}px²`);
    }
  }
  return { missing: false, scales: scales.length, worst, hits };
};

// GZ1 (A11): during the seal, what the Ghost_Body_Box centre hits; after it, the
// [data-ghost] elements left in the document. The body box uses G1's fractions.
const GZ1_READ = (duringSeal) => {
  const ghosts = document.querySelectorAll("[data-ghost]");
  if (!duringSeal) return { missing: false, count: ghosts.length };
  const ghost = ghosts[0];
  if (!ghost) return { missing: true };
  const g = (ghost.querySelector("[data-ghost-box]") ?? ghost).getBoundingClientRect();
  const x = g.left + g.width / 2;
  const y = (g.top + 0.155 * g.height + g.bottom - 0.12 * g.height) / 2;
  const hit = document.elementFromPoint(x, y);
  const ok = !hit || hit === document.documentElement || hit === document.body || ghost.contains(hit);
  const describe = (el) => (el ? `<${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? ` class="${el.className.slice(0, 40)}"` : ""}>` : "nothing");
  return { missing: false, count: ghosts.length, x, y, hit: describe(hit), ok };
};

// FV1 (A12): the Figures_Heading's outline as it is now.
const FV1_READ = () => {
  const h = document.querySelector("[data-figures-heading]");
  if (!h) return { missing: true };
  const cs = getComputedStyle(h);
  return { missing: false, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth, focused: document.activeElement === h, focusVisible: h.matches(":focus-visible") };
};

// CTA1 (B1.1, B1.3, B1.5): the landing's calls to action at the top of the page.
const CTA1_READ = () => {
  const inView = (r) => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
  const primary = document.querySelector('[data-cta="primary"]');
  if (!primary) return { missing: true };
  const secondary = document.querySelector('[data-cta="secondary"]');
  const p = primary.getBoundingClientRect();
  const s = secondary?.getBoundingClientRect() ?? null;
  return {
    missing: false,
    href: primary.getAttribute("href"),
    primary: { top: p.top, bottom: p.bottom, inView: inView(p) },
    secondary: s ? { top: s.top, bottom: s.bottom, inView: inView(s) } : null,
  };
};

// H1.6: the content box width of every visible section on /, in px. The content box is
// the border box less padding and borders.
const H16_READ = () =>
  [...document.querySelectorAll("section")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .map((el) => {
      const cs = getComputedStyle(el);
      const edges = ["paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth"].reduce((sum, k) => sum + (parseFloat(cs[k]) || 0), 0);
      return {
        name: (el.getAttribute("aria-labelledby") ?? (el.hasAttribute("data-landing-hero") ? "hero" : "section")).slice(0, 30),
        width: el.getBoundingClientRect().width - edges,
      };
    });

// H2.7: the visible cards of the ritual list on /, with their tops. Missing when the page
// has no ritual list.
const H27_READ = () => {
  const list = document.querySelector('[data-block="ritual"]');
  if (!list) return { missing: true };
  const items = [...list.children]
    .filter((el) => el.tagName === "LI")
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ top: r.top }));
  return { missing: false, items };
};

// DX1 (B2.4): every persona open link on /demo inside the viewport at the top.
const DX1_READ = () => {
  const links = [...document.querySelectorAll('a[href^="/demo/personas/"]')];
  if (!links.length) return { missing: true };
  return {
    missing: false,
    links: links.map((a) => {
      const r = a.getBoundingClientRect();
      return { href: a.getAttribute("href"), bottom: r.bottom, right: r.right, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
    }),
  };
};

// HW1 (B4.1): the h1 font size in px.
const HW1_READ = () => {
  const h1 = document.querySelector("h1");
  return h1 ? parseFloat(getComputedStyle(h1).fontSize) : null;
};

// ST1 (C2): the Step_Indicator, its current steps and its line count.
const ST1_READ = () => {
  const el = document.querySelector("[data-step-indicator]");
  if (!el) return { missing: true };
  const items = [...el.querySelectorAll("li")];
  const boxes = (items.length ? items : [...el.children]).map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
  const tops = [];
  for (const r of boxes) if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
  return { missing: false, current: el.querySelectorAll('[aria-current="step"]').length, steps: items.length, lines: tops.length };
};

// RC1 (C3.5): the first Figure_Entry fully inside the viewport.
const RC1_READ = () => {
  const el = document.querySelector("[data-figure-entry]");
  if (!el) return { missing: true };
  const r = el.getBoundingClientRect();
  return { missing: false, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
};

// ---------------------------------------------------------------------------
// Spec 10 page-side measures (spec 10 design.md "Owner patches", ad). Each runs
// inside the page and stays self-contained, and returns { missing: true } when
// the element it measures is not on this build, so the runner prints a note.
// ---------------------------------------------------------------------------
// TK1 (X1): every Number_Line tick hangs from its axis and reaches its label.
const TK1_READ = () => {
  const axes = [...document.querySelectorAll("[data-line-axis]")];
  if (!axes.length) return { missing: true };
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const ticks = [];
  const overlaps = [];
  for (const axis of axes) {
    let root = axis.parentElement;
    while (root && root !== document.body && !root.querySelector("[data-line-tick]")) root = root.parentElement;
    if (!root) continue;
    const a = axis.getBoundingClientRect();
    const labels = [...root.querySelectorAll("[data-line-label]")]
      .map((el) => ({ el, r: el.getBoundingClientRect(), kind: el.getAttribute("data-line-label") }))
      .filter((l) => l.r.width > 0 && l.r.height > 0);
    for (const t of root.querySelectorAll("[data-line-tick]")) {
      const r = t.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const kind = t.getAttribute("data-line-tick") || "?";
      const cx = (r.left + r.right) / 2;
      const label =
        labels.find((l) => l.kind === kind) ??
        [...labels].sort((x, y) => Math.abs((x.r.left + x.r.right) / 2 - cx) - Math.abs((y.r.left + y.r.right) / 2 - cx))[0];
      const gap = label ? Math.max(0, label.r.top - r.bottom, r.top - label.r.bottom) : null;
      ticks.push({ kind, dTop: r.top - a.top, gap });
    }
    for (let i = 0; i < labels.length; i += 1) {
      for (let j = i + 1; j < labels.length; j += 1) {
        if (meets(labels[i].r, labels[j].r)) overlaps.push(`${labels[i].el.textContent.trim().slice(0, 20)} / ${labels[j].el.textContent.trim().slice(0, 20)}`);
      }
    }
  }
  if (!ticks.length) return { missing: true };
  return { missing: false, axes: axes.length, ticks, overlaps };
};
// SI1 (X2.2, X2.4): every Step_Indicator item whole, in view and clear of the Ghost.
const SI1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const el = document.querySelector("[data-step-indicator]");
  if (!el) return { missing: true };
  const items = [...el.querySelectorAll("li")];
  const ghost = ghostRectOf(document.querySelector("[data-ghost]"));
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const tops = [];
  const problems = [];
  for (const li of items) {
    const r = li.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top);
    const name = li.textContent.trim().slice(0, 24);
    if (li.scrollWidth > li.clientWidth) problems.push(`"${name}" clipped (${li.scrollWidth}>${li.clientWidth})`);
    if (r.left < -0.5 || r.top < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) problems.push(`"${name}" outside the viewport`);
    if (ghost && meets(r, ghost)) problems.push(`"${name}" under [data-ghost]`);
  }
  return { missing: false, items: items.length, lines: tops.length, problems };
};
// GT1 (X2.1, C1.6, C7.1): no text or control outside the Ghost on the Ghost_Body_Box,
// the drawing's box less G1's empty margins (12% each side, 15.5% top, 12% bottom).
const GT1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const ghostEl = document.querySelector("[data-ghost]");
  if (!ghostEl) return { missing: true };
  const box = ghostRectOf(ghostEl);
  if (!box) return { missing: true };
  const g = {
    left: box.left + 0.12 * box.width,
    right: box.right - 0.12 * box.width,
    top: box.top + 0.155 * box.height,
    bottom: box.bottom - 0.12 * box.height,
  };
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
    return true;
  };
  const GT1_SELECTOR = "p, h1, h2, h3, li, label, button, a, input, textarea";
  const els = [...document.querySelectorAll(GT1_SELECTOR)].filter((el) => isVisible(el) && !el.closest("[data-ghost]"));
  const hits = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.right - g.left > 0.5 && g.right - r.left > 0.5 && r.bottom - g.top > 0.5 && g.bottom - r.top > 0.5) {
      hits.push(`<${el.tagName.toLowerCase()}> "${(el.textContent.trim() || el.getAttribute("aria-label") || "").slice(0, 30)}"`);
    }
  }
  return { missing: false, measured: els.length, ghost: { top: g.top, bottom: g.bottom, left: g.left, right: g.right }, hits: [...new Set(hits)] };
};
// FC1 (C1.12): focus and scroll once recall starts on page load.
const FC1_READ = () => {
  const a = document.activeElement;
  return {
    onHeading: !!a && a !== document.body && (a.matches("[data-stage-heading]") || !!a.closest("[data-stage-heading]")),
    active: a ? `<${a.tagName.toLowerCase()}${a.id ? `#${a.id}` : ""}>` : "none",
    hasHeading: !!document.querySelector("[data-stage-heading]"),
    scrollY: window.scrollY,
  };
};
// ET1 (C6.1, C6.2): the held seal inside its Envelope, on no date line, nothing overlapping.
const ET1_READ = () => {
  const seal = document.querySelector("[data-envelope-seal]");
  if (!seal) return { missing: true };
  const env = seal.closest("[data-envelope-state]") ?? document.querySelector("[data-ghost] [data-envelope-state]") ?? document.querySelector("[data-envelope-state]");
  if (!env) return { missing: true };
  const s = seal.getBoundingClientRect();
  const e = env.getBoundingClientRect();
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const inside = s.left >= e.left - 0.5 && s.top >= e.top - 0.5 && s.right <= e.right + 0.5 && s.bottom <= e.bottom + 0.5;
  const dates = [...env.querySelectorAll("[data-date]")].filter((d) => {
    const r = d.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const onDates = dates.filter((d) => meets(s, d.getBoundingClientRect())).map((d) => d.textContent.trim().slice(0, 30));
  // Drawn elements: the seal and every text element inside the Envelope box.
  const drawn = [seal, ...[...env.querySelectorAll("p, h1, h2, h3, span")].filter((el) => {
    if (seal.contains(el)) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && el.textContent.trim() && ![...el.children].some((c) => c.textContent.trim());
  })];
  const pairs = [];
  for (let i = 0; i < drawn.length; i += 1) {
    for (let j = i + 1; j < drawn.length; j += 1) {
      const a = drawn[i];
      const b = drawn[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (meets(a.getBoundingClientRect(), b.getBoundingClientRect())) {
        const name = (el) => (el === seal ? "seal" : `"${el.textContent.trim().slice(0, 20)}"`);
        pairs.push(`${name(a)} / ${name(b)}`);
      }
    }
  }
  return { missing: false, state: env.getAttribute("data-envelope-state"), inside, seal: s, envelope: e, dates: dates.length, onDates, pairs };
};
// SG1 (C6.1, C6.3, C6.4, C6.8): the Seal_Group beside the Ghost_Body_Box, level with the seal.
const SG1_READ = (phone) => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const group = document.querySelector("[data-seal-group]");
  if (!group) return { missing: true };
  const r = group.getBoundingClientRect();
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  const ghostEl = document.querySelector("[data-ghost]");
  const ghost = ghostRectOf(ghostEl);
  const gb = document.querySelector("[data-ghost-box]")?.getBoundingClientRect() ?? null;
  const body = gb ? { left: gb.left + 0.12 * gb.width, right: gb.right - 0.12 * gb.width, top: gb.top + 0.155 * gb.height, bottom: gb.bottom - 0.12 * gb.height } : null;
  const env = document.querySelector("[data-ghost] [data-envelope-state]")?.getBoundingClientRect() ?? null;
  const seal = document.querySelector("[data-envelope-seal]")?.getBoundingClientRect() ?? null;
  const hint = [...group.querySelectorAll("p")].find((p) => p.textContent.trim()) ?? null;
  const inView = r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;
  const out = { missing: false, group: { top: r.top, bottom: r.bottom, left: r.left, right: r.right }, inView };
  if (phone) {
    out.ghostBottom = ghost ? ghost.bottom : null;
    out.belowGhost = ghost ? r.top - ghost.bottom : null;
    out.onGhost = ghost ? meets(r, ghost) : false;
    return out;
  }
  if (!body) return { missing: true };
  out.onBody = meets(r, body);
  out.onEnvelope = env ? meets(r, env) : false;
  // The body edge that faces the Content_Column: the column sits left of the Ghost on wide screens.
  const columnLeft = (r.left + r.right) / 2 < (body.left + body.right) / 2;
  out.edgeGap = columnLeft ? body.left - r.right : r.left - body.right;
  const sealY = seal ? (seal.top + seal.bottom) / 2 : null;
  out.sealY = sealY;
  out.level = sealY !== null && sealY >= r.top && sealY <= r.bottom;
  if (hint) {
    const cs = getComputedStyle(hint);
    out.hintAlign = cs.textAlign;
    out.hintClipped = hint.scrollWidth > hint.clientWidth;
  } else {
    out.hintAlign = null;
    out.hintClipped = false;
  }
  return out;
};
// AL1 (C6.10): the Answer_List in marks, clear of the Ghost and the Seal_Group.
const AL1_READ = () => {
  // The [data-ghost] box. The root element can be a zero-size wrapper, so its
  // drawing ([data-ghost-box]) is measured instead when the root has no box.
  const ghostRectOf = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
    const box = el.querySelector("[data-ghost-box]")?.getBoundingClientRect();
    return box && box.width > 0 && box.height > 0 ? box : null;
  };
  const list = document.querySelector("[data-answer-list]");
  const meets = (a, b) => a.right - b.left > 0.5 && b.right - a.left > 0.5 && a.bottom - b.top > 0.5 && b.bottom - a.top > 0.5;
  if (!list) return { present: false };
  const r = list.getBoundingClientRect();
  const ghost = ghostRectOf(document.querySelector("[data-ghost]"));
  const group = document.querySelector("[data-seal-group]")?.getBoundingClientRect() ?? null;
  return {
    present: r.width > 0 && r.height > 0,
    onGhost: ghost ? meets(r, ghost) : false,
    onGroup: group ? meets(r, group) : false,
  };
};
// CF1 (C6.7, C7.3): no card much taller than what it holds, and none that holds only controls.
const CF1_READ = () => {
  const cards = [...document.querySelectorAll("[data-card], [data-stage-panel]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!cards.length) return { missing: true };
  const CONTROL = "button, a, input, select, textarea, label, summary";
  const out = [];
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    const kids = [...card.children].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0);
    const union = kids.length ? Math.max(...kids.map((b) => b.bottom)) - Math.min(...kids.map((b) => b.top)) : 0;
    const content = [...card.querySelectorAll("*")].some((el) => {
      if (el.matches(CONTROL) || el.closest(CONTROL)) return false;
      if (!el.textContent.trim() && !el.matches("svg, img")) return false;
      const b = el.getBoundingClientRect();
      return b.width > 0 && b.height > 0;
    });
    const name = card.getAttribute("data-card") || (card.hasAttribute("data-stage-panel") ? "stage-panel" : card.tagName.toLowerCase());
    out.push({ name, height: r.height, union, slack: r.height - union, content });
  }
  return { missing: false, cards: out };
};
// FP1 (C5.12): mark the control a judge presses next, or return null. A
// [data-primary-control] that is a button or link is pressed itself; a wrapper
// (the recall answer row holds the field and its button) has its enabled button
// pressed. A press-and-hold target with no button inside is skipped.
const FP1_TARGET = () => {
  for (const old of document.querySelectorAll("[data-fp1-target]")) old.removeAttribute("data-fp1-target");
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  };
  for (const c of document.querySelectorAll("[data-primary-control]")) {
    if (!visible(c)) continue;
    const el = c.matches("button, a[href]") ? c : [...c.querySelectorAll("button, a[href]")].find((b) => visible(b));
    if (!el) continue;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return { blocked: (el.textContent.trim() || el.tagName).slice(0, 30) };
    el.setAttribute("data-fp1-target", "");
    return { label: (el.textContent.trim() || el.tagName).slice(0, 30) };
  }
  return null;
};
// PH1 on / (P1.1): headline, Hero_Sentence, both calls to action and the Landing_Ghost
// in the first viewport. The Hero_Sentence is [data-hero-sentence], else the first
// paragraph in a [data-block] after the h1.
const PH1_LANDING = () => {
  const scene = document.querySelector('[data-ceremony="scene"]') ?? document.body;
  const h1 = document.querySelector("h1");
  const after = (el) => h1 && (h1.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const sentence = document.querySelector("[data-hero-sentence]")
    ?? [...scene.querySelectorAll("[data-block] p, p[data-block]")].find((p) => after(p) && !p.closest("[data-cta]"));
  const named = [
    ["headline", h1],
    ["Hero_Sentence", sentence],
    ["primary", document.querySelector('[data-cta="primary"]')],
    ["Landing_Ghost", scene.querySelector("[data-ghost-pit] [data-ghost-box]") ?? document.querySelector("[data-ghost-box]")],
  ];
  const secondary = document.querySelector('[data-cta="secondary"]');
  if (secondary) named.push(["secondary", secondary]);
  const missing = named.filter(([, el]) => !el).map(([n]) => n);
  const items = named.filter(([, el]) => el).map(([name, el]) => {
    const r = el.getBoundingClientRect();
    return { name, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
  });
  return { missing, items };
};

// PH1 on the persona page: scroll so the top of [data-stage-content] meets the
// bottom of a sticky or fixed Top_Bar. Returns false when the hook is missing.
const PH1_STAGE_SCROLL = () => {
  const sc = document.querySelector("[data-stage-content]");
  if (!sc) return false;
  const bar = document.querySelector("[data-topbar]");
  const pos = bar ? getComputedStyle(bar).position : "static";
  const off = bar && (pos === "sticky" || pos === "fixed") ? bar.getBoundingClientRect().height : 0;
  window.scrollTo({ top: Math.max(0, sc.getBoundingClientRect().top + window.scrollY - off), behavior: "instant" });
  return true;
};

// W1.6 and W1.7 (spec 12): the Write step's Letter_Field, Occasion chips and Next on
// /demo/live. Returns { missing: true } when the Write card or its field is absent.
// Lines in view are counted from the field's top, down to the window bottom.
const WRITE_READ = (cardSelector) => {
  const card = document.querySelector(cardSelector);
  const field = card?.querySelector("textarea");
  if (!card || !field) return { missing: true };
  const cs = getComputedStyle(field);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const padBottom = parseFloat(cs.paddingBottom) || 0;
  const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  let lh = parseFloat(cs.lineHeight);
  if (!Number.isFinite(lh)) lh = (parseFloat(cs.fontSize) || 16) * 1.2;
  const r = field.getBoundingClientRect();
  const fieldLines = Math.round((r.height - padTop - padBottom - border) / lh);
  const linesInView = r.top >= 0 ? Math.min(fieldLines, Math.max(0, Math.floor((innerHeight - r.top - padTop) / lh + 0.01))) : 0;
  const inWindow = (b) => b.width > 0 && b.height > 0 && b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth;
  const chipButtons = [...(card.querySelector("fieldset")?.querySelectorAll("button") ?? [])];
  const chips = chipButtons.map((b) => b.getBoundingClientRect());
  const nextButton = [...card.querySelectorAll("button")].find((b) => b.textContent.trim() === "Next");
  const nextRect = nextButton ? nextButton.getBoundingClientRect() : null;
  return {
    missing: false,
    field: { top: r.top, bottom: r.bottom, topInView: r.top >= 0 && r.top < innerHeight, lines: fieldLines, linesInView, lineHeight: lh },
    chips: { count: chips.length, inView: chips.length > 0 && chips.every(inWindow), top: chips.length ? Math.min(...chips.map((c) => c.top)) : null, bottom: chips.length ? Math.max(...chips.map((c) => c.bottom)) : null },
    next: nextRect ? { top: nextRect.top, bottom: nextRect.bottom } : null,
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    card: { scrollWidth: card.scrollWidth, clientWidth: card.clientWidth },
  };
};

// PH1 on the persona page and /demo/live: every visible [data-primary-control] in view.
const PH1_CONTROLS = () => {
  const els = [...document.querySelectorAll("[data-primary-control]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: ["[data-primary-control]"], items: [] };
  return {
    missing: [],
    items: els.map((el) => {
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute("aria-label") || el.textContent.trim() || el.tagName).slice(0, 30);
      return { name, top: r.top, bottom: r.bottom, inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth };
    }),
  };
};

// PH2 (P2.1): the largest vertical gap between consecutive [data-block] boxes in the viewport.
const PH2_READ = () => {
  const blocks = [...document.querySelectorAll("[data-block]")]
    .filter((el) => !el.closest("[data-soil]"))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight)
    .sort((a, b) => a.top - b.top);
  if (blocks.length < 2) return { missing: true, blocks: blocks.length };
  let maxBottom = blocks[0].bottom;
  let worst = 0;
  let at = null;
  for (const r of blocks.slice(1)) {
    const gap = r.top - maxBottom;
    if (gap > worst) {
      worst = gap;
      at = Math.round(maxBottom);
    }
    maxBottom = Math.max(maxBottom, r.bottom);
  }
  return { missing: false, blocks: blocks.length, worst, at };
};

// PH3 (P3.1, P3.2): the h1's lines and the words on each, from one range per word.
const PH3_READ = () => {
  const h1 = document.querySelector("h1");
  if (!h1) return { missing: true };
  const hr = h1.getBoundingClientRect();
  if (hr.width <= 1 || hr.height <= 1) return { missing: false, hidden: true };
  const lines = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const re = /[^\s\u00a0]+(?:\u00a0[^\s\u00a0]+)*/g;
    for (let m = re.exec(n.textContent); m; m = re.exec(n.textContent)) {
      const range = document.createRange();
      range.setStart(n, m.index);
      range.setEnd(n, m.index + m[0].length);
      const r = [...range.getClientRects()].find((x) => x.width > 0);
      if (!r) continue;
      const line = lines.find((l) => Math.abs(l.top - r.top) < r.height / 2);
      if (line) line.words += 1;
      else lines.push({ top: r.top, words: 1 });
    }
  }
  lines.sort((a, b) => a.top - b.top);
  return { missing: false, hidden: false, lines: lines.length, words: lines.map((l) => l.words) };
};

// PH4 (P5.1): the Top_Bar height.
const PH4_READ = () => {
  const bar = document.querySelector("[data-topbar]");
  if (!bar) return { missing: true };
  return { missing: false, height: bar.getBoundingClientRect().height, compact: bar.hasAttribute("data-compact") };
};

// PH5 (P6.3): every descendant inside each Figure_Entry and the figures panel, and
// each one's own background painted.
const PH5_READ = () => {
  const roots = [...document.querySelectorAll("[data-figure-entry], [data-figures-panel]")];
  if (!roots.length) return { missing: true };
  const outside = [];
  const unpainted = [];
  let worst = 0;
  roots.forEach((root, i) => {
    const e = root.getBoundingClientRect();
    if (e.width === 0 || e.height === 0) return;
    const name = root.hasAttribute("data-figures-panel") ? "panel" : `entry ${i + 1}`;
    for (const el of root.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 && r.height <= 1) continue;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
      const by = Math.max(e.left - r.left, r.right - e.right, e.top - r.top, r.bottom - e.bottom);
      worst = Math.max(worst, by);
      if (by > 0.5) outside.push(`${name} <${el.tagName.toLowerCase()}> by ${by.toFixed(1)}px`);
    }
    const cs = getComputedStyle(root);
    const m = cs.backgroundColor.match(/[\d.]+/g);
    const painted = (m && (m.length < 4 || Number(m[3]) > 0)) || cs.backgroundImage !== "none";
    if (!painted) unpainted.push(name);
  });
  return { missing: false, roots: roots.length, worst, outside: [...new Set(outside)], unpainted };
};

// PH6 (P7.1): letter Stage top to the close's first line, against the screens budget.
const PH6_READ = (screens) => {
  const close = document.querySelector("[data-close-line]");
  const stage = document.querySelector("[data-letter-stage]");
  const text = document.querySelector("[data-letter-text]");
  const missing = [["[data-close-line]", close], ["[data-letter-stage]", stage], ["[data-letter-text]", text]].filter(([, el]) => !el).map(([n]) => n);
  if (missing.length) return { missing };
  const length = close.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
  const letter = text.getBoundingClientRect().height;
  return { missing: [], length, letter, limit: screens * innerHeight + letter };
};

// PH7 (P8.4): every visible target at least min x min px. Inline text links are
// exempt; inside [data-topbar] the check applies only with data-compact. An input
// in a label is measured with its label's box.
const PH7_READ = (min) => {
  const small = [];
  let measured = 0;
  for (const el of document.querySelectorAll('a, button, summary, input:not([type="hidden"]), textarea, [role="button"]')) {
    let r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) continue;
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) continue;
    const bar = el.closest("[data-topbar]");
    if (bar && !bar.hasAttribute("data-compact")) continue;
    if (el.tagName === "A") {
      const parent = el.parentElement;
      if (parent && (parent.tagName === "P" || parent.tagName === "LI") && parent.textContent.trim() !== el.textContent.trim()) continue;
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
      if (label) {
        const l = label.getBoundingClientRect();
        r = { width: Math.max(r.right, l.right) - Math.min(r.left, l.left), height: Math.max(r.bottom, l.bottom) - Math.min(r.top, l.top) };
      }
    }
    measured += 1;
    if (r.width < min || r.height < min) small.push(`"${(el.getAttribute("aria-label") || el.textContent.trim() || el.getAttribute("type") || el.tagName).slice(0, 24)}" ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
  }
  if (!measured) return { missing: true };
  return { missing: false, measured, small };
};

// FONT1 (L1.4, L1.5): the first family of --font-sans loaded and first on <body>; where
// the Letter_Text shows ([data-letter-text], else W1's fallback), the first family of
// --font-serif loaded and first on the Letter_Text. A face no text uses stays unloaded,
// so the serif is not checked on a page without the letter.
const FONT1_READ = async () => {
  await document.fonts.ready;
  const first = (v) => (v || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const root = getComputedStyle(document.documentElement);
  const sans = first(root.getPropertyValue("--font-sans"));
  const serif = first(root.getPropertyValue("--font-serif"));
  if (!sans) return { missing: true };
  const loaded = (fam) => [...document.fonts].some((f) => first(f.family) === fam && f.status === "loaded");
  let letter = document.querySelector("[data-letter-text]");
  if (!letter) {
    const sealed = document.querySelector('[class*="sealedLetter"]');
    if (sealed) letter = [...sealed.querySelectorAll("p")].sort((a, b) => b.textContent.length - a.textContent.length)[0] ?? null;
  }
  if (letter) {
    const r = letter.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) letter = null;
  }
  return {
    missing: false,
    sans,
    sansLoaded: loaded(sans),
    body: first(getComputedStyle(document.body).fontFamily),
    letter: letter
      ? { serif, serifLoaded: !!serif && loaded(serif), family: first(getComputedStyle(letter).fontFamily), selector: letter.hasAttribute("data-letter-text") ? "[data-letter-text]" : "sealed letter <p>" }
      : null,
  };
};

// FONT2 (L2.1): every visible h1 to h3 and button in the sans family.
const FONT2_READ = () => {
  const first = (v) => (v || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
  const sans = first(getComputedStyle(document.documentElement).getPropertyValue("--font-sans"));
  if (!sans) return { missing: true };
  const els = [...document.querySelectorAll("h1, h2, h3, button")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && (!el.checkVisibility || el.checkVisibility({ visibilityProperty: true }));
  });
  if (!els.length) return { missing: true };
  const off = els.filter((el) => first(getComputedStyle(el).fontFamily) !== sans).map((el) => `<${el.tagName.toLowerCase()}> "${el.textContent.trim().slice(0, 24)}" in ${first(getComputedStyle(el).fontFamily)}`);
  return { missing: false, sans, measured: els.length, off };
};

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Waits until no CSS animation or transition is running, so box checks read the settled layout.
async function settle(page, maxMs = 5000) {
  // The Ghost bob repeats forever, so only finite animations count.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
    null,
    { timeout: maxMs },
  ).catch(() => {});
  await sleep(200);
}

export const DEFAULT_JOBS = 4;

export function parseArgs(argv) {
  const opts = { url: null, sizes: DEFAULT_SIZES, shots: "layout-check-shots", chromium: null, require: [], stages: null, onlySizes: null, quiet: false, jobs: DEFAULT_JOBS, baseline: null, saveBlockers: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const take = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      return value;
    };
    if (arg === "--url") opts.url = take();
    else if (arg === "--sizes") opts.sizes = take().split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--all-sizes") opts.sizes = ALL_SIZES;
    else if (arg === "--require") opts.require = take().split(",").map((s) => s.trim()).filter(Boolean);
    else if (arg === "--shots") opts.shots = take();
    else if (arg === "--chromium") opts.chromium = take();
    else if (arg === "--stages") opts.stages = parseStages(take());
    else if (arg === "--only-sizes") opts.onlySizes = parseSizeList(take(), "--only-sizes");
    else if (arg === "--quiet") opts.quiet = true;
    else if (arg === "--baseline") opts.baseline = take();
    else if (arg === "--save-blockers") opts.saveBlockers = take();
    else if (arg === "--jobs") {
      const raw = take();
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 16) throw new Error(`--jobs must be a whole number from 1 to 16, not "${raw}"`);
      opts.jobs = n;
    } else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`unknown option ${arg}`);
  }
  if (!opts.help) {
    if (!opts.url) throw new Error("--url is required, for example --url http://localhost:3000");
    try {
      opts.url = new URL(opts.url).origin;
    } catch {
      throw new Error(`--url is not a URL: ${opts.url}`);
    }
    for (const size of opts.sizes) {
      if (!/^\d+x\d+$/.test(size)) throw new Error(`size "${size}" must look like 1280x800`);
    }
    // The walk runs at the --sizes that --only-sizes keeps (possibly none).
    if (opts.onlySizes) {
      opts.sizes = opts.sizes.filter((s) => opts.onlySizes.includes(s));
    }
  }
  return opts;
}

const LEVEL_LABEL = { blocker: "BLOCKER", polish: "polish", note: "note", ok: "PASS" };

// One report per section. `emit` receives every output line as { kind, text }:
// kind is "log", "stage" or the row level; `couldNotRun` marks a note about a
// check that threw. The run prints the lines of each section in section order.
export function makeReport(emit = (line) => console.log(line.text)) {
  const items = [];
  const rows = [];
  const counts = { blocker: 0, polish: 0, note: 0 };
  let ctx = null;
  return {
    items,
    rows,
    counts,
    setContext(next) {
      ctx = next;
    },
    log(text) {
      emit({ kind: "log", text });
    },
    stage(stage) {
      if (!ctx) return;
      ctx.stage = stage;
      emit({ kind: "stage", text: `\n[${ctx.size}] ${stage}` });
    },
    // One line per result: <level> <id> <name> <WxH> <stage> <detail>. `name` is
    // the spec 08 check name, or "-" for the older checks.
    add(level, check, detail, name = "-") {
      if (level in counts) counts[level] += 1;
      const stage = ctx?.stage ?? null;
      const row = { level, size: ctx?.size, stage, persona: ctx?.persona ?? personaOfStage(stage), check, name, detail };
      if (level === "blocker") items.push(row);
      if (level === "blocker" || level === "polish") rows.push(row);
      emit({
        kind: level,
        couldNotRun: level === "note" && /could not run/.test(String(detail)),
        text: `  ${LEVEL_LABEL[level].padEnd(7)} ${check.padEnd(5)} ${name.padEnd(14)} ${ctx?.size ?? "-"} ${stage ?? "-"} ${detail}`,
      });
    },
  };
}

// --quiet keeps BLOCKER lines and the notes about a check that could not run.
export function quietKeeps(line) {
  return line.kind === "blocker" || line.couldNotRun === true;
}

async function stageOf(page) {
  return page.evaluate(() => document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") ?? null);
}

async function waitForStage(page, name, timeout = WAIT_MS) {
  try {
    await page.waitForFunction(
      (n) => document.querySelector("[data-ceremony]")?.getAttribute("data-ceremony") === n,
      name,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
}

async function shot(page, ctx, stage, { keepScroll = false } = {}) {
  const dir = join(ctx.shotsDir, ctx.size);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${stage}.png`);
  // Scroll to the top only when the page is scrolled: a scroll to 0 on an unscrolled page moves the recall layout.
  // keepScroll shoots where the judge is, for example where "See the numbers" landed.
  if (!keepScroll && (await page.evaluate(() => window.scrollY)) > 0) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: file });
  // A screenshot can restart the page's transitions, so the layout is read again once they finish.
  await settle(page);
  await guard(ctx, "FR1", () => checkFr1(page, ctx));
  await guard(ctx, "CW1", () => checkCw1(page, ctx));
  ctx.rep.add("ok", "shot", file);
}

// FR1 (GitHub issue #577): a script-focused non-control draws no outline, and Tab once reaches a focus ring.
// It presses Tab, so the page's scroll position and focused element are put back afterwards.
async function checkFr1(page, ctx) {
  if (!FR1_SIZES.includes(ctx.size)) return;
  const scrollY = await page.evaluate(() => {
    window.__fr1Focused = document.activeElement;
    return window.scrollY;
  });
  const reading = await readFr1Reading(page);
  await page.evaluate((y) => {
    window.scrollTo(0, y);
    const prev = window.__fr1Focused;
    delete window.__fr1Focused;
    if (prev && prev !== document.body && typeof prev.focus === "function") prev.focus({ preventScroll: true });
  }, scrollY);
  const failures = frFailures(reading);
  for (const f of failures) ctx.rep.add("blocker", "FR1", f.message, f.check);
  if (failures.length === 0) ctx.rep.add("ok", "FR1", "script-focused headings draw no outline and Tab reaches a focus ring");
}

// CT1 (GitHub issue #579): text meets WCAG 2.2 contrast on its real surface. Each failing text
// is a BLOCKER. It runs at CT1_SIZES only, on the steps the walk names.
async function checkCt1(page, ctx) {
  if (!CT1_SIZES.includes(ctx.size)) return;
  const failures = await readCt1Failures(page);
  for (const f of failures) {
    ctx.rep.add("blocker", "CT1", `${f.selector} "${f.text}" needs ${f.required}:1 contrast: ${f.reason}`, "text-contrast");
  }
  if (failures.length === 0) ctx.rep.add("ok", "CT1", "text meets contrast on its surface");
}

// CW1 (GitHub issue #581): the [data-content-column] content box is at least viewport minus 48 px.
// It runs at CW1_SIZES only. A page with no [data-content-column] has no column to measure, so it is
// skipped rather than failed. Any failing reading is a BLOCKER.
async function checkCw1(page, ctx) {
  if (!CW1_SIZES.includes(ctx.size)) return;
  const reading = await page.evaluate(() => {
    const el = document.querySelector("[data-content-column]");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const px = (value) => parseFloat(value) || 0;
    const width = rect.width - px(style.borderLeftWidth) - px(style.borderRightWidth) - px(style.paddingLeft) - px(style.paddingRight);
    return { width, viewport: document.documentElement.clientWidth };
  });
  if (!reading) return;
  const failures = cwFailures(reading);
  for (const message of failures) ctx.rep.add("blocker", "CW1", message, "content-column-width");
  if (failures.length === 0) ctx.rep.add("ok", "CW1", `content column ${reading.width} px at viewport ${reading.viewport} px`);
}

// GO1 (GitHub issue #583). Measures only: the Ghost's drawn box, one rect per text line (a Range per
// text node, with no opaque-ancestor exemption) and a rect per visible control. goFailures decides.
const GO1_READ = () => {
  const rect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    return !el.checkVisibility || el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  };
  // The Ghost's drawn box (requirement 2.6, design D4 and D7): the union of the bare SVG box, the
  // body and fold paths (the hem is the body path's lower edge, measured as drawn) and the glow. The
  // glow is the .ghostGlow wrapper (the SVG's parent) plus the largest blur its drop-shadow filter
  // paints, read from the computed filter, so the drawn shadow is measured and not guessed.
  const ghostEl = document.querySelector("[data-ghost-box]");
  const union = (rects) => ({
    left: Math.min(...rects.map((r) => r.left)),
    top: Math.min(...rects.map((r) => r.top)),
    right: Math.max(...rects.map((r) => r.right)),
    bottom: Math.max(...rects.map((r) => r.bottom)),
  });
  let ghost = null;
  if (ghostEl) {
    const parts = [ghostEl.getBoundingClientRect()];
    for (const path of ghostEl.querySelectorAll("path")) parts.push(path.getBoundingClientRect());
    const glowEl = ghostEl.parentElement;
    if (glowEl) {
      const glow = glowEl.getBoundingClientRect();
      const filter = getComputedStyle(glowEl).filter || "none";
      const pad = Math.max(0, ...[...filter.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => Math.abs(parseFloat(m[1]))));
      parts.push({ left: glow.left - pad, top: glow.top - pad, right: glow.right + pad, bottom: glow.bottom + pad });
    }
    ghost = rect(union(parts));
  }
  const text = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const value = n.textContent.trim();
    const parent = n.parentElement;
    if (!value || !parent || parent.closest("script, style, noscript") || !shown(parent)) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) {
      if (r.width > 0 && r.height > 0) text.push({ label: value.slice(0, 40), rect: rect(r) });
    }
  }
  const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')]
    .filter(shown)
    .map((el) => ({
      label: (el.getAttribute("aria-label") || el.textContent || el.value || "").trim().slice(0, 40) || el.tagName.toLowerCase(),
      rect: rect(el.getBoundingClientRect()),
    }));
  return { ghost, text, controls };
};

// GO1 on the Remember step: reads at the start, scrolls to the bottom and reads again, then puts the
// scroll back. Every overlap is a BLOCKER. A missing Ghost box fails too (goFailures says so).
async function checkGo1(page, ctx, label) {
  const startY = await page.evaluate(() => window.scrollY);
  // The Soil strip is read with each text reading: its rect is in viewport coordinates, so the
  // start-of-step rect does not match the text after the scroll.
  const readings = [["at the start", { ...(await page.evaluate(GO1_READ)), soil: await readGo1Soil(page) }]];
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await sleep(250);
  readings.push(["scrolled to the bottom", { ...(await page.evaluate(GO1_READ)), soil: await readGo1Soil(page) }]);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  let count = 0;
  for (const [where, reading] of readings) {
    for (const f of goFailures(reading)) {
      count += 1;
      ctx.rep.add("blocker", "GO1", `${f.message} (${label}, ${where})`, f.check);
    }
  }
  if (count === 0) ctx.rep.add("ok", "GO1", `no text or control overlaps the Ghost (${label}, at the start and scrolled to the bottom)`);
}

// GO1 on Break the seal (marks stage) at GO1_BREAK_SIZES, including the Soil strip overlap.
async function checkGo1Break(page, ctx) {
  if (!GO1_BREAK_SIZES.includes(ctx.size)) return;
  await checkGo1(page, ctx, "Break the seal");
}

// LC1 on Break the seal at LC1_SIZES: the Seal group sits beside the column (the marks card on
// this step), and the first line under the step track is clear of it. With { trackOnly } (the
// Remember step) only the step track gap is read.
async function checkLc1(page, ctx, { trackOnly = false, label = "Break the seal" } = {}) {
  if (!LC1_SIZES.includes(ctx.size)) return;
  const reading = await readLc1Reading(page);
  const failures = [...(trackOnly ? [] : lcFailures(reading)), ...lcTrackFailures(reading)];
  for (const f of failures) ctx.rep.add("blocker", "LC1", `${f.message} (${label})`, f.check);
  if (failures.length === 0) {
    ctx.rep.add("ok", "LC1", trackOnly
      ? `first line clear of the step track at ${ctx.size} (${label})`
      : `Seal group beside the column and the first line clear of the step track at ${ctx.size} (${label})`);
  }
}

// The Ghost check on a Remember step: GO1 at GO1_SIZES, the G1 body check everywhere else.
async function checkRememberGhost(page, ctx, label) {
  if (GO1_SIZES.includes(ctx.size)) return checkGo1(page, ctx, label);
  return checkGhostBody(page, ctx);
}

// CT1 and SF1/TT1 on Press the seal. checkPressEnvelope (P1) measures only the sizes in SEAL_MIN_PX, so this
// walks /demo/live to the seal step at every CT1 and SF1_TT1 size, with the same text and Next presses.
// checkCt1, checkCw1 and checkSf1Tt1 each keep their own size gate, so a size runs only the checks it owns.
async function checkPressContrast(context, ctx) {
  if (!CT1_SIZES.includes(ctx.size) && !SF1_TT1_SIZES.includes(ctx.size)) return;
  const page = await newPage(context);
  try {
    const res = await page.goto(`${ctx.base}/demo/live`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      ctx.rep.add("note", "CT1", `/demo/live answered HTTP ${res?.status() ?? "none"}; Press the seal not read for contrast`);
      return;
    }
    // The same walk the Wait rules use: letter, answers, then the fold button. Without Press the
    // seal on screen CT1 read the Write step and passed, as it did on main, so not reaching it is
    // a blocker for every rule this page owns at this size.
    try {
      await s16LiveToSeal(page, ctx.base, { figure: false });
    } catch (error) {
      const where = await page.locator("[data-live-step]").first().getAttribute("data-live-step", { timeout: 1000 }).catch(() => null);
      const why = `${String(error?.message ?? error).split("\n")[0]} (data-live-step=${where ?? "none"})`;
      if (CT1_SIZES.includes(ctx.size)) ctx.rep.add("blocker", "CT1", `CT1 Press the seal was not reached at ${ctx.size}, so its text was not measured: ${why}. Want: [data-seal-step] on screen.`, "text-contrast");
      if (SF1_TT1_SIZES.includes(ctx.size)) {
        ctx.rep.add("blocker", "SF1", `SF1 Press the seal was not reached at ${ctx.size}: ${why}.`, "panel-fills-surface");
        ctx.rep.add("blocker", "TT1", `TT1 Press the seal was not reached at ${ctx.size}: ${why}.`, "wax-target-size");
      }
      return;
    }
    await checkCt1(page, ctx);
    await checkCw1(page, ctx);
    await checkSf1Tt1(page, ctx);
  } finally {
    await page.close();
  }
}

// SF1 (the Seal panel fills its surface, no cream strip beside it) and TT1 (the wax mark is at least
// TT1_MIN_PX square at rest). Both read the Press the seal step at rest. Each failure is a BLOCKER.
export async function checkSf1Tt1(page, ctx) {
  if (!SF1_TT1_SIZES.includes(ctx.size)) return;
  ctx.rep.log(`SF1 and TT1 on Press the seal at ${ctx.size}`);
  const sf = sfFailures(await readSf1Reading(page));
  for (const f of sf) ctx.rep.add("blocker", "SF1", f.message, f.check);
  if (sf.length === 0) ctx.rep.add("ok", "SF1", `Seal panel fills its surface at ${ctx.size}`);
  const tt = ttFailures(await readTt1Reading(page));
  for (const f of tt) ctx.rep.add("blocker", "TT1", f.message, f.check);
  if (tt.length === 0) ctx.rep.add("ok", "TT1", `press target wax mark meets the size floor at ${ctx.size}`);
}

// UQ1 (one Demo label and one wax seal), CT1 (text contrast) and SF1 (Seal panel fill) on the Wait
// step (GitHub issue #589). Wait comes after a passkey seal, so this walks /demo/live through the
// virtual passkey to the sealed step, with reduced motion so the press is one click. It runs only at
// WAIT_RULE_SIZES. Each failure is a BLOCKER.
export const WAIT_RULE_SIZES = ["1440x900", "390x844"];

async function checkWaitRules(browser, ctx) {
  if (!WAIT_RULE_SIZES.includes(ctx.size)) return;
  ctx.rep.log(`UQ1, CT1 and SF1 on the Wait step at ${ctx.size}`);
  const context = await browser.newContext({ viewport: { width: ctx.w, height: ctx.h }, reducedMotion: "reduce" });
  try {
    const page = await newPage(context);
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("WebAuthn.enable");
      await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true },
      });
      // A walk that does not reach Wait fails all three rules. As a guard() note it hid the
      // D2 regression: the gate's server had no RP_ID, /demo/live showed its unavailable state,
      // and CT1, UQ1 and SF1 on Wait never measured anything.
      try {
        await s16LiveToSeal(page, ctx.base, { figure: false });
        await page.locator('[data-backup-card="skip"]').first().click({ timeout: WAIT_MS });
        await sleep(300);
        await page.getByRole("button", { name: "Press the seal", exact: true }).click({ timeout: WAIT_MS });
        await page.locator('[data-press-mode="setting"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
        await page.locator('[data-press-mode="setting"]').click({ timeout: WAIT_MS });
        await page.locator('[data-live-step="sealed"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
      } catch (error) {
        const where = await page.locator("[data-live-step]").first().getAttribute("data-live-step", { timeout: 1000 }).catch(() => null);
        const why = `${String(error?.message ?? error).split("\n")[0]} (data-live-step=${where ?? "none"})`;
        for (const [id, check] of [["UQ1", "unique-demo-label-and-seal"], ["CT1", "text-contrast"], ["SF1", "panel-fills-surface"]]) {
          ctx.rep.add("blocker", id, `${id} the Wait step was not reached at ${ctx.size}, so nothing was measured: ${why}. Want: the virtual-passkey walk reaches [data-live-step="sealed"].`, check);
        }
        return;
      }
      await sleep(800);

      const uq = uqFailures(await readUq1Reading(page));
      for (const f of uq) ctx.rep.add("blocker", "UQ1", f.message, f.check);
      if (uq.length === 0) ctx.rep.add("ok", "UQ1", `one Demo label and one wax seal on the Wait step at ${ctx.size}`);

      const ct = await readCt1Failures(page);
      for (const f of ct) ctx.rep.add("blocker", "CT1", `${f.selector} "${f.text}" needs ${f.required}:1 contrast: ${f.reason}`, "text-contrast");
      if (ct.length === 0) ctx.rep.add("ok", "CT1", `text meets contrast on the Wait step at ${ctx.size}`);

      const sf = sfFailures(await readSf1Reading(page));
      for (const f of sf) ctx.rep.add("blocker", "SF1", f.message, f.check);
      if (sf.length === 0) ctx.rep.add("ok", "SF1", `Seal panel fills its surface on the Wait step at ${ctx.size}`);
    } finally {
      await page.close();
    }
  } finally {
    await context.close();
  }
}

function checkSoil(page, ctx) {
  return page.evaluate(F2).then((r) => {
    if (r === null) return;
    if (r.hits.length) ctx.rep.add("blocker", "F2", `text or control on the Soil strip: ${r.hits.join(" | ")}`);
    else ctx.rep.add("ok", "F2", "no text or control on the Soil strip");
    if (r.panelHits.length) ctx.rep.add("polish", "F2", `paper panel overlaps the Soil strip (text is on the paper, so it reads): ${r.panelHits.join(" | ")}`);
  });
}

async function checkGhostBody(page, ctx) {
  const r = await page.evaluate(G1);
  if (r === null) return;
  if (r.hits.length) ctx.rep.add("blocker", "G1", `text or control on the Ghost body (scrollY ${Math.round(await page.evaluate(() => window.scrollY))}): ${r.hits.join(" | ")}`);
  else ctx.rep.add("ok", "G1", "no text or control on the Ghost body");
}

async function checkFit(page, ctx, selectors) {
  const results = await page.evaluate(F1, selectors);
  const missing = results.filter((r) => r.missing).map((r) => r.name);
  if (missing.length) ctx.rep.add("note", "F1", `not on this build: ${missing.join(", ")}`);
  for (const r of results.filter((x) => !x.missing)) {
    if (r.onSoil) ctx.rep.add("blocker", "F1", `"${r.name}" sits on the Soil strip`);
    else if (r.onPanelSoil) ctx.rep.add("polish", "F1", `"${r.name}" paper panel overlaps the Soil strip`);
    else if (!r.inView) ctx.rep.add("polish", "F1", `"${r.name}" is not fully in the window (scrolling; fine on a phone)`);
  }
  if (results.every((r) => r.missing || (r.inView && !r.onSoil))) ctx.rep.add("ok", "F1", "named boxes in view and off the Soil strip");
}

// The main button of a stage: blocker only at 1280x800 when it is not fully in view.
// The main button of a stage. The judge must see the first ones without scrolling
// (intact and the landing, at 1280x800). Every other main button must be reachable:
// scrolled into view, with the button at the top of the hit test at its centre.
// Being below the fold is polish.
async function checkMainButton(page, ctx, name, mustBeInView = false, role = "button") {
  // `name` is a label (string or RegExp), or { loc, label } from figuresButton or landingStart.
  const located = typeof name === "object" && name !== null && "loc" in name;
  const button = located ? name.loc : page.getByRole(role, { name, exact: typeof name === "string" }).first();
  if ((await button.count()) === 0) return;
  const label = located ? `"${name.label}"` : typeof name === "string" ? `"${name}"` : `"${name.source}"`;
  const r = await button.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, scrollY: window.scrollY };
  });
  const inView = r.top >= 0 && r.left >= 0 && r.bottom <= ctx.h && r.right <= ctx.w;
  if (inView) {
    ctx.rep.add("ok", "BTN", `main button ${label} is fully in view`);
    return;
  }
  if (mustBeInView) {
    const detail = `main button ${label} is not fully in view without scrolling (bottom ${Math.round(r.bottom)} px, window ${ctx.h} px, scrollY ${Math.round(r.scrollY)})`;
    ctx.rep.add(ctx.size === MAIN_RULE_SIZE ? "blocker" : "polish", "BTN", detail);
    return;
  }
  await button.scrollIntoViewIfNeeded();
  const reachable = await button.evaluate((el) => {
    const b = el.getBoundingClientRect();
    const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  });
  if (reachable) {
    ctx.rep.add("polish", "BTN", `main button ${label} is below the fold at ${ctx.size} (bottom ${Math.round(r.bottom)} px); reachable after scrolling`);
  } else {
    ctx.rep.add("blocker", "BTN", `main button ${label} cannot be reached: another element covers its centre`);
  }
}

// G2 (R5.16, R5.17). The intact centre is the reference for later stages.
async function checkGhostCentre(page, ctx, stage) {
  const centre = await page.evaluate(G2);
  if (centre === null) return;
  const frameW = Math.min(ctx.w, 1440);
  const frameL = (ctx.w - frameW) / 2;
  const expected = ctx.w >= 900 ? frameL + 0.72 * frameW : ctx.w * 0.5;
  // The reference Stage is intact when the walk reached it, else recall (spec 10 ad).
  if (stage === (ctx.g2Ref ?? "intact")) {
    ctx.intactCentre = centre;
    if (Math.abs(centre - expected) > 1) ctx.rep.add("polish", "G2", `Ghost centre x ${centre.toFixed(1)} px, expected ${expected.toFixed(1)} px`);
    else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px (expected ${expected.toFixed(1)})`);
    return;
  }
  if (ctx.intactCentre === null) return;
  const diff = Math.abs(centre - ctx.intactCentre);
  if (diff > 1) ctx.rep.add("polish", "G2", `Ghost moved sideways by ${diff.toFixed(1)} px from ${ctx.g2Ref ?? "intact"} (${centre.toFixed(1)} px)`);
  else ctx.rep.add("ok", "G2", `Ghost centre x ${centre.toFixed(1)} px, same as ${ctx.g2Ref ?? "intact"}`);
}

async function checkFrame(page, ctx) {
  const g = await page.evaluate(G3);
  if (g === null) return;
  const problems = [];
  if (g.headlineLeft !== null && Math.abs(g.headlineLeft - g.leftMargin) > 1) problems.push(`headline left ${g.headlineLeft.toFixed(1)} px, wordmark ${g.leftMargin.toFixed(1)} px`);
  if (Math.abs(g.rightMargin - g.leftMargin) > 1) problems.push(`margins ${g.leftMargin.toFixed(0)} px and ${g.rightMargin.toFixed(0)} px`);
  if (g.soilLeft !== 0 || Math.abs(g.soilRight - g.windowWidth) > 1) problems.push("Soil does not run the full window width");
  if (problems.length) ctx.rep.add("polish", "G3", problems.join("; "));
  else ctx.rep.add("ok", "G3", `frame aligned: margins ${g.leftMargin.toFixed(0)} px each side`);
}

async function checkDust(page, ctx) {
  const r = await page.evaluate(D1);
  if (r === null) return;
  if (r.drawnAboveCeiling) ctx.rep.add("polish", "D1", `dust drawn ${r.highest.toFixed(1)} px, above the ceiling ${r.ceiling.toFixed(1)} px`);
  else ctx.rep.add("ok", "D1", `no dust above the ceiling (${r.ceiling.toFixed(1)} px)`);
}

async function checkDates(page, ctx) {
  const dates = await page.evaluate(E1);
  const wrapped = dates.filter((d) => d.lines !== 1);
  if (wrapped.length) ctx.rep.add("polish", "E1", `date wraps onto ${wrapped[0].lines} lines: "${wrapped[0].text}"`);
  else if (dates.length) ctx.rep.add("ok", "E1", `${dates.length} date(s) on one line`);
}

async function checkTopBar(page, ctx) {
  if (ctx.size !== TOP_BAR_SIZE) return;
  const height = await page.evaluate(T0);
  if (height === null) return;
  if (height > TOP_BAR_MAX_PX) ctx.rep.add("polish", "T0", `Top_Bar ${height.toFixed(1)} px tall (limit ${TOP_BAR_MAX_PX} px at 360 wide)`);
  else ctx.rep.add("ok", "T0", `Top_Bar ${height.toFixed(1)} px tall`);
}

async function checkNeutrality(page, ctx) {
  const r = await page.evaluate(NEUTRALITY);
  if (r.judgement.length) ctx.rep.add("blocker", "NT1", `judgement word in UI copy: ${r.judgement.join(", ")}`);
  if (r.exclaim.length) ctx.rep.add("blocker", "NT1", `exclamation mark in UI copy: ${r.exclaim.slice(0, 3).map((t) => `"${t}"`).join(", ")}`);
  if (r.colour.length) ctx.rep.add("blocker", "NT2", `${r.colour.slice(0, 3).join("; ")} (red and green are not used for figures or controls)`);
  if (!r.judgement.length && !r.exclaim.length && !r.colour.length) ctx.rep.add("ok", "NT1", "no judgement words, exclamation marks or red or green text");
}

// ---------------------------------------------------------------------------
// Spec 08 checks. BLOCKER only when the element was measured and failed; a
// missing element is a note (see the header).
// ---------------------------------------------------------------------------

const isPhone = (ctx) => ctx.w < PHONE_WIDTH_MAX;

async function checkLetterWidth(page, ctx) {
  const r = await page.evaluate(W1_READ);
  if (r.missing) {
    ctx.rep.add("note", "W1", "no Letter_Text on this page", "letter-width");
    return;
  }
  if (isPhone(ctx)) {
    const detail = `width=${r.px.toFixed(1)}px (${r.em.toFixed(1)}em, ${r.selector}) threshold=>=${LETTER_PHONE_MIN_PX}px`;
    ctx.rep.add(r.px >= LETTER_PHONE_MIN_PX ? "ok" : "blocker", "W1", detail, "letter-width");
    return;
  }
  const ok = r.em >= LETTER_EM_MIN && r.em <= LETTER_EM_MAX;
  const detail = `width=${r.em.toFixed(1)}em (${r.px.toFixed(1)}px at ${r.fontPx}px, ${r.selector}) threshold=${LETTER_EM_MIN}em..${LETTER_EM_MAX}em`;
  ctx.rep.add(ok ? "ok" : "blocker", "W1", detail, "letter-width");
}

async function checkScrollWidth(page, ctx) {
  const r = await page.evaluate(X1_READ);
  const detail = `scrollWidth=${r.scrollWidth}px clientWidth=${r.clientWidth}px threshold=scrollWidth<=clientWidth`;
  ctx.rep.add(r.scrollWidth <= r.clientWidth ? "ok" : "blocker", "X1", detail, "scroll-width");
}

async function checkFigureBoxes(page, ctx) {
  const r = await page.evaluate(B1_READ);
  if (r.missing) {
    ctx.rep.add("note", "B1", `not on this build: ${r.entries ? "" : "[data-figure-entry] "}${r.hasFigValue ? "" : "figValue class"}`.trim(), "figure-boxes");
    return;
  }
  const detail = `entries=${r.entries} boxes=${r.measured} outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 4).join("; ")})` : ""} threshold=0`;
  ctx.rep.add(r.outside.length ? "blocker" : "ok", "B1", detail, "figure-boxes");
}

async function checkLineLabels(page, ctx) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const r = await page.evaluate(L1_READ);
  if (r.missing) {
    ctx.rep.add("note", "L1", "not on this build: no [data-line-label] elements", "line-labels");
    return;
  }
  const detail = `labels=${r.labels} worst=${r.worst.toFixed(1)}px²${r.overlaps.length ? ` (${r.overlaps.slice(0, 3).join("; ")})` : ""} threshold=0px²`;
  ctx.rep.add(r.overlaps.length ? "blocker" : "ok", "L1", detail, "line-labels");
}

async function checkRecallInView(page, ctx) {
  // R27.6 reads with the page scrolled to the top. Focus on the field can scroll
  // the page by itself, which would hide a field that sits below the fold.
  const scrolledBy = await page.evaluate(() => window.scrollY);
  if (scrolledBy > 0) await page.evaluate(() => window.scrollTo(0, 0));
  // Then read only once every box has stayed put for 400 ms.
  let results = await page.evaluate(R1_READ);
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    const next = await page.evaluate(R1_READ);
    const still = next.every((r, k) => r.missing || Math.abs(r.top - results[k].top) < 0.5);
    results = next;
    if (still) break;
  }
  const missing = results.filter((r) => r.missing).map((r) => r.name);
  const out = results.filter((r) => !r.missing && !r.inView);
  const parts = results.filter((r) => !r.missing).map((r) => `${r.name}=${Math.round(r.top)}..${Math.round(r.bottom)}px`);
  const detail = `${parts.join(" ")}${missing.length ? ` missing=${missing.join(",")}` : ""} viewport=${ctx.w}x${ctx.h} focusScroll=${Math.round(scrolledBy)}px threshold=inside viewport at scrollY 0`;
  // A missing field is a flow problem the walk reports itself, so only out-of-view boxes block here.
  ctx.rep.add(out.length || missing.length === results.length ? "blocker" : "ok", "R1", detail, "recall-in-view");
}

async function checkLandingGhost(page, ctx) {
  // The rise is CSS; wait for every finite animation on the Ghost to finish.
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getTiming().iterations === Infinity),
    null,
    { timeout: 5000 },
  ).catch(() => {});
  const r = await page.evaluate(LG1_READ, LANDING_START.source);
  if (r.missing) {
    ctx.rep.add("note", "LG1", "not on this build: no [data-ghost-pit] on /", "landing-ghost");
    return;
  }
  const visible = r.width > 0 && r.height > 0 && r.opacity > 0 && r.inViewport;
  // Below 900 px the landing hides its Ghost layer with CSS (landing.module.css),
  // so on a phone the Ghost must not be drawn at all.
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < LG1_HIDDEN_BELOW_PX) {
    const detail = `box=${r.width.toFixed(0)}x${r.height.toFixed(0)}px threshold=hidden below ${LG1_HIDDEN_BELOW_PX}px`;
    ctx.rep.add(visible ? "blocker" : "ok", "LG1", detail, "landing-ghost");
    return;
  }
  const detail = `box=${r.width.toFixed(0)}x${r.height.toFixed(0)}px opacity=${r.opacity.toFixed(2)} inViewport=${r.inViewport} overlaps=${r.hits.length ? r.hits.join(",") : "none"} threshold=visible, no overlap`;
  ctx.rep.add(visible && !r.hits.length ? "ok" : "blocker", "LG1", detail, "landing-ghost");
}

async function checkTicks(page, ctx) {
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const r = await page.evaluate(T2_READ);
  if (!r.scales) return;
  const detail = `scales=${r.scales} overlaps=${r.overlaps.length}${r.overlaps.length ? ` (${r.overlaps.slice(0, 3).join("; ")})` : ""} threshold=0`;
  ctx.rep.add(r.overlaps.length ? "polish" : "ok", "T2", detail, "tick-labels");
}

async function checkFooter(page, ctx) {
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(150);
  const r = await page.evaluate(FT1_READ);
  await page.evaluate((y) => window.scrollTo(0, y), before);
  if (r.missing) {
    ctx.rep.add("note", "FT1", "no <footer> on this page", "footer");
    return;
  }
  const soil = r.soilTop === null ? "no Soil strip" : `soil=${Math.round(r.soilTop)}..${Math.round(r.soilBottom)}px`;
  ctx.rep.add(r.touches ? "polish" : "ok", "FT1", `footer=${Math.round(r.top)}..${Math.round(r.bottom)}px ${soil} threshold=no overlap`, "footer");
}

// Spec 15 rows (see the header). The pure helpers return the failure messages for a
// row, so tests can call them with fixed boxes and counts.

// NB1: no element carries a dirt class or [data-dirt]. Spec 15 deletes the Envelope's dirt group.
export function nb1Failures({ count }) {
  return count === 0 ? [] : [`NB1 ${count} element(s) with a dirt class or [data-dirt], want none`];
}

// GC1: the ghost box is inside the viewport (unclipped) and its centre is within
// GC1_CENTRE_TOL_PX of the viewport centre. The row runs at the phone sizes only.
export function gc1Failures({ ghost, w }) {
  if (!ghost) return ["GC1 no [data-ghost] to measure"];
  const out = [];
  if (ghost.left < -0.5 || ghost.right > w + 0.5) out.push(`GC1 ghost spans ${num(ghost.left, 0)}px to ${num(ghost.right, 0)}px, outside the ${w}px viewport`);
  const centre = (ghost.left + ghost.right) / 2;
  if (Math.abs(centre - w / 2) > GC1_CENTRE_TOL_PX) out.push(`GC1 ghost centre is ${num(centre, 0)}px, the viewport centre is ${num(w / 2, 0)}px`);
  return out;
}

// DL1: exactly one "Demo" label on the page, the Top_Bar chip counted.
export function dl1Failures({ count }) {
  return count === 1 ? [] : [`DL1 ${count} "Demo" labels, want one`];
}

// PV1: the primary control sits inside the viewport.
export function pv1Failures({ button, w, h }) {
  if (!button) return ["PV1 no [data-primary-control] to measure"];
  return rectInViewport(button, w, h) ? [] : [`PV1 primary control spans ${num(button.top, 0)}px to ${num(button.bottom, 0)}px, outside the ${h}px viewport`];
}

// One evaluate reads every spec 15 input, so the rows see the same page state.
const SPEC15_READ = ({ demoLabel }) => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const demoLabels = [...document.querySelectorAll("body *")].filter((el) => el.children.length === 0 && el.textContent.trim() === demoLabel).length;
  return {
    ghost: box(document.querySelector("[data-ghost]")),
    button: box(document.querySelector("[data-primary-control] button") ?? document.querySelector("[data-primary-control]")),
    demoLabels,
    dirt: document.querySelectorAll('[data-dirt], [class*="dirt" i]').length,
  };
};

// NB1 on / and on a persona page. Reads the DOM, not the pixels.
async function checkNoDirtBand(page, ctx) {
  const r = await page.evaluate(SPEC15_READ, { demoLabel: SPEC15_DEMO_LABEL });
  report(ctx, verdictRow("NB1", "no-dirt-band", nb1Failures({ count: r.dirt }), `dirt=${r.dirt} viewport=${ctx.size}`, "no dirt class or [data-dirt]"));
}

// DL1 on /demo, where the chip and the DemoLabel would both show.
async function checkDemoLabel(page, ctx) {
  const r = await page.evaluate(SPEC15_READ, { demoLabel: SPEC15_DEMO_LABEL });
  report(ctx, verdictRow("DL1", "one-demo-label", dl1Failures({ count: r.demoLabels }), `labels=${r.demoLabels} viewport=${ctx.size}`, "one Demo label"));
}

// GC1, PV1 and DL1 on the persona Remember step (recall), reached by checkPersonaRows.
async function checkRecallRows15(page, ctx) {
  const r = await page.evaluate(SPEC15_READ, { demoLabel: SPEC15_DEMO_LABEL });
  const detail = `viewport=${ctx.size}`;
  if (ctx.w < 600) {
    report(ctx, r.ghost ? verdictRow("GC1", "ghost-column", gc1Failures({ ghost: r.ghost, w: ctx.w }), detail, `ghost inside the viewport, centre within ${GC1_CENTRE_TOL_PX} px`) : missingRow("GC1", "ghost-column", "no [data-ghost] on recall"));
  }
  report(ctx, r.button ? verdictRow("PV1", "primary-in-view", pv1Failures({ button: r.button, w: ctx.w, h: ctx.h }), detail, "the primary control inside the viewport") : missingRow("PV1", "primary-in-view", "no [data-primary-control] on recall"));
  report(ctx, verdictRow("DL1", "one-demo-label", dl1Failures({ count: r.demoLabels }), `labels=${r.demoLabels} ${detail}`, "one Demo label"));
}

// N1: after the control press, read once at FOCUS_SETTLE_MS (R2.2's limit), then
// again FOCUS_SETTLE_MS after the close Stage, and compare the heading top.
async function checkNumbersFocus(page, ctx, via, shotName = null) {
  const began = Date.now();
  // The figures shot: the fade-up settles to close about 780 ms after the press,
  // before the first read at about 1,000 ms, so the shot is taken first, as a
  // plain viewport capture where the press landed (no scroll reset, no settle wait).
  if (shotName) {
    const stageNow = await stageOf(page);
    const dir = join(ctx.shotsDir, ctx.size);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${shotName}.png`);
    await page.screenshot({ path: file });
    ctx.rep.add("ok", "shot", `${file} at data-ceremony "${stageNow}", scrollY ${Math.round(await page.evaluate(() => window.scrollY))}`);
  }
  await sleep(Math.max(0, FOCUS_SETTLE_MS - 100 - (Date.now() - began)));
  const first = await page.evaluate(N1_READ);
  if (first.missing) {
    ctx.rep.add("note", "N1", `not on this build: no [data-figures-heading] (after "${via}")`, "numbers-focus");
    return false;
  }
  await waitForStage(page, "close", 12000);
  await sleep(FOCUS_SETTLE_MS);
  const second = await page.evaluate(N1_READ);
  const drift = Math.abs(second.top - first.top);
  const problems = [];
  if (!first.focused || !second.focused) problems.push(`active=${second.focused ? first.active : second.active}`);
  if (first.top < first.barBottom) problems.push("top above the Top_Bar");
  if (first.top >= first.viewportHeight) problems.push("top below the viewport");
  if (drift > FOCUS_DRIFT_MAX_PX) problems.push(`moved ${drift.toFixed(1)}px`);
  const detail = `via="${via}" focused=${first.focused}/${second.focused} top=${first.top.toFixed(1)}px (${first.stage}) then ${second.top.toFixed(1)}px (${second.stage}) barBottom=${first.barBottom.toFixed(1)}px viewport=${first.viewportHeight}px drift=${drift.toFixed(1)}px threshold=focused, barBottom<=top<viewport, drift<=${FOCUS_DRIFT_MAX_PX}px${problems.length ? ` (${problems.join("; ")})` : ""}`;
  ctx.rep.add(problems.length ? "blocker" : "ok", "N1", detail, "numbers-focus");
  return true;
}

// ---------------------------------------------------------------------------
// Spec 09 checks. Each builds a result { id, name, status, detail } with status
// "pass", "fail" or "missing"; report() prints it. A failure is a BLOCKER only
// when the ID was passed with --require, else polish. "missing" is a note.
// ---------------------------------------------------------------------------

const px = (v) => `${Math.round(v)}px`;
const result = (id, name, status, detail) => ({ id, name, status, detail });

function report(ctx, r) {
  if (!r) return;
  const level = r.status === "pass" ? "ok" : r.status === "missing" ? "note" : ctx.required.has(r.id) || SPEC15_CHECKS.includes(r.id) || S20_CHECKS.includes(r.id) ? "blocker" : "polish";
  ctx.rep.add(level, r.id, r.detail, r.name);
}

const parseSize = (size) => size.split("x").map(Number);

function routeKind(route) {
  const path = route.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  if (path === "/") return "landing";
  if (path === "/demo") return "index";
  if (path === LIVE_PATH) return "live";
  if (path.startsWith("/demo/personas/")) return "persona";
  return "other";
}

/**
 * The phone checks PH1 to PH7 (spec 09 design.md "Owner patches", q), for the
 * page as it is now. `size` is "WxH"; `route` is the page's path, for example
 * "/", "/demo/live" or "/demo/personas/us-maya". At 600 px and wider it returns
 * []. Returns one { id, name, status: "pass"|"fail"|"missing", detail } per check
 * that applies; detail holds the measured values and threshold=. The page's
 * scroll position is restored before it returns. Exported for the Journey_Check.
 */
export async function runPhoneChecks(page, size, route) {
  const [w, h] = parseSize(size);
  if (w >= PHONE_WIDTH_MAX) return [];
  const kind = routeKind(route);
  const stage = await stageOf(page);
  const beforeFirstStep = kind === "landing" || (kind === "persona" && ["emerging", "sealed", "intact"].includes(stage));
  const startY = await page.evaluate(() => window.scrollY);
  const toTop = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const out = [];
  try {
    // PH1 first-viewport.
    if (kind === "landing" || kind === "live" || kind === "persona") {
      let r;
      let where = "scrollY 0";
      if (kind === "landing") {
        await toTop();
        r = await page.evaluate(PH1_LANDING);
      } else if (kind === "live") {
        // W1.6: the Write step's field top and its first 6 lines are in view. Next is not asserted here (W1.7 reads its reach).
        await toTop();
        const w6 = await page.evaluate(WRITE_READ, WRITE_CARD);
        r = w6.missing
          ? { missing: [WRITE_CARD], items: [] }
          : {
              missing: [],
              items: [{ name: `Letter_Field ${w6.field.linesInView} of ${W16_LINES_PHONE} lines`, top: w6.field.top, bottom: w6.field.bottom, inView: w6.field.topInView && w6.field.linesInView >= W16_LINES_PHONE }],
            };
      } else {
        const scrolled = await page.evaluate(PH1_STAGE_SCROLL);
        await sleep(150);
        r = scrolled ? await page.evaluate(PH1_CONTROLS) : { missing: ["[data-stage-content]"], items: [] };
        where = `scrollY ${Math.round(await page.evaluate(() => window.scrollY))} (top of [data-stage-content])`;
      }
      const parts = r.items.map((i) => `${i.name}=${px(i.top)}..${px(i.bottom)}${i.inView ? "" : "(out)"}`);
      const threshold = kind === "live" ? `threshold=field top and ${W16_LINES_PHONE} lines inside viewport (W1.6), Next not asserted` : "threshold=inside viewport";
      const detail = `${parts.join(" ")}${r.missing.length ? ` missing=${r.missing.join(",")}` : ""} viewport=${w}x${h} at ${where} ${threshold}`;
      out.push(result("PH1", "first-viewport", r.missing.length ? "missing" : r.items.every((i) => i.inView) ? "pass" : "fail", detail));
    }
    await toTop();
    // PH2 dead-space.
    if (beforeFirstStep) {
      const r = await page.evaluate(PH2_READ);
      out.push(r.missing
        ? result("PH2", "dead-space", "missing", `not on this build: ${r.blocks} [data-block] box(es) in view, need 2`)
        : result("PH2", "dead-space", r.worst <= PH_GAP_MAX_PX ? "pass" : "fail", `blocks=${r.blocks} worstGap=${px(r.worst)}${r.at === null ? "" : ` below y=${r.at}px`} threshold=<=${PH_GAP_MAX_PX}px`));
    }
    // PH3 headline-lines.
    {
      const max = kind === "landing" ? PH_HEADLINE_LINES_LANDING : PH_HEADLINE_LINES_OTHER;
      const r = await page.evaluate(PH3_READ);
      if (r.missing) out.push(result("PH3", "headline-lines", "missing", "no h1 on this page"));
      else if (r.hidden) out.push(result("PH3", "headline-lines", "missing", "the h1 is visually hidden at this Stage"));
      else {
        const lone = r.words.slice(0, -1).some((n) => n === 1);
        out.push(result("PH3", "headline-lines", r.lines <= max && !lone ? "pass" : "fail", `lines=${r.lines} wordsPerLine=${r.words.join(",")} threshold=lines<=${max}, no lone word before the last line`));
      }
    }
    // PH4 topbar-height. The persona page allows 96 px (B1.5); every other page keeps 56 px.
    {
      const r = await page.evaluate(PH4_READ);
      const max = phTopbarMaxPx(kind);
      out.push(r.missing
        ? result("PH4", "topbar-height", "missing", "no [data-topbar] on this page")
        : result("PH4", "topbar-height", r.height <= max ? "pass" : "fail", `height=${r.height.toFixed(1)}px compact=${r.compact} threshold=<=${max}px`));
    }
    // PH5 card-containment, where the figures show.
    if (kind === "persona" && (stage === "figures" || stage === "close")) {
      const r = await page.evaluate(PH5_READ);
      out.push(r.missing
        ? result("PH5", "card-containment", "missing", "not on this build: no [data-figure-entry] or [data-figures-panel]")
        : result("PH5", "card-containment", r.outside.length || r.unpainted.length ? "fail" : "pass", `roots=${r.roots} worst=${r.worst.toFixed(1)}px outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 3).join("; ")})` : ""} unpainted=${r.unpainted.length ? r.unpainted.join(",") : "none"} threshold=0px, background painted`));
    }
    // PH6 page-height, at 390x844 in close.
    if (kind === "persona" && stage === "close" && size === PH6_SIZE) {
      const r = await page.evaluate(PH6_READ, PH6_SCREENS);
      out.push(r.missing.length
        ? result("PH6", "page-height", "missing", `not on this build: ${r.missing.join(", ")}`)
        : result("PH6", "page-height", r.length <= r.limit ? "pass" : "fail", `length=${px(r.length)} letterText=${px(r.letter)} threshold=<=${px(r.limit)} (${PH6_SCREENS}x${h} + letterText)`));
    }
    // PH7 touch-targets.
    {
      const r = await page.evaluate(PH7_READ, PH_TARGET_MIN_PX);
      out.push(r.missing
        ? result("PH7", "touch-targets", "missing", "no target measured on this page")
        : result("PH7", "touch-targets", r.small.length ? "fail" : "pass", `targets=${r.measured} small=${r.small.length}${r.small.length ? ` (${r.small.slice(0, 5).join("; ")})` : ""} threshold=>=${PH_TARGET_MIN_PX}x${PH_TARGET_MIN_PX}px`));
    }
  } finally {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  }
  return out;
}

/**
 * FONT1 fonts-loaded for the page as it is now (spec 09 design.md "Owner
 * patches", q). Returns one { id, name, status: "pass"|"fail"|"missing", detail }.
 * Exported for the Journey_Check.
 */
export async function runFontCheck(page) {
  const r = await page.evaluate(FONT1_READ);
  if (r.missing) return result("FONT1", "fonts-loaded", "missing", "no --font-sans on <html>");
  const problems = [];
  if (!r.sansLoaded) problems.push(`${r.sans} not loaded`);
  if (r.body !== r.sans) problems.push(`body starts with ${r.body}`);
  let letter = "letter=none (serif not checked)";
  if (r.letter) {
    letter = `serif=${r.letter.serif} serifLoaded=${r.letter.serifLoaded} letter=${r.letter.family} (${r.letter.selector})`;
    if (!r.letter.serifLoaded) problems.push(`${r.letter.serif || "--font-serif"} not loaded`);
    if (r.letter.family !== r.letter.serif) problems.push(`Letter_Text starts with ${r.letter.family}`);
  }
  const detail = `sans=${r.sans} sansLoaded=${r.sansLoaded} body=${r.body} ${letter} threshold=loaded and first${problems.length ? ` (${problems.join("; ")})` : ""}`;
  return result("FONT1", "fonts-loaded", problems.length ? "fail" : "pass", detail);
}

async function checkFonts(page, ctx, route) {
  report(ctx, await runFontCheck(page));
  const r = await page.evaluate(FONT2_READ);
  report(ctx, r.missing
    ? result("FONT2", "fonts-sans-ui", "missing", `no heading or button on ${route}`)
    : result("FONT2", "fonts-sans-ui", r.off.length ? "fail" : "pass", `sans=${r.sans} measured=${r.measured} off=${r.off.length}${r.off.length ? ` (${r.off.slice(0, 3).join("; ")})` : ""} threshold=0`));
}

async function checkPhone(page, ctx, route) {
  for (const r of await runPhoneChecks(page, ctx.size, route)) report(ctx, r);
}

async function checkButtonOverflow(page, ctx) {
  const r = await page.evaluate(BO1_READ);
  report(ctx, r.missing
    ? result("BO1", "button-overflow", "missing", "no button on this page")
    : result("BO1", "button-overflow", r.over.length ? "fail" : "pass", `buttons=${r.count} worst=${r.worst}px over=${r.over.length}${r.over.length ? ` (${r.over.slice(0, 3).join("; ")})` : ""} threshold=scrollWidth<=clientWidth`));
}

async function checkControlInCard(page, ctx) {
  const r = await page.evaluate(BC1_READ);
  report(ctx, r.missing
    ? result("BC1", "control-in-card", "missing", "not on this build: no [data-card], fieldset or [data-stage-panel]")
    : result("BC1", "control-in-card", r.outside.length ? "fail" : "pass", `containers=${r.containers} controls=${r.measured} worst=${r.worst.toFixed(1)}px outside=${r.outside.length}${r.outside.length ? ` (${r.outside.slice(0, 3).join("; ")})` : ""} threshold=0.5px`));
}

async function checkScaleOverlap(page, ctx) {
  const r = await page.evaluate(RS1_READ);
  report(ctx, r.missing
    ? result("RS1", "scale-overlap", "missing", "not on this build: no [data-recorded-scale]")
    : result("RS1", "scale-overlap", r.hits.length ? "fail" : "pass", `scales=${r.scales} worst=${r.worst.toFixed(1)}px²${r.hits.length ? ` (${r.hits.slice(0, 3).join("; ")})` : ""} threshold=0px²`));
}

// GZ1: ctx.ghostHook is set once a [data-ghost] has been seen in this walk, so a
// build without the hook gets a note after the seal, not a pass.
async function checkGhostGone(page, ctx, duringSeal) {
  const r = await page.evaluate(GZ1_READ, duringSeal);
  if (r.count) ctx.ghostHook = true;
  if (duringSeal) {
    report(ctx, r.missing
      ? result("GZ1", "ghost-after-seal", "missing", "not on this build: no [data-ghost] during the seal")
      : result("GZ1", "ghost-after-seal", r.ok ? "pass" : "fail", `bodyCentre=${px(r.x)},${px(r.y)} hit=${r.hit} threshold=the Ghost or nothing`));
    return;
  }
  if (!ctx.ghostHook) {
    report(ctx, result("GZ1", "ghost-after-seal", "missing", "not on this build: no [data-ghost] seen before the seal"));
    return;
  }
  report(ctx, result("GZ1", "ghost-after-seal", r.count ? "fail" : "pass", `ghostElements=${r.count} threshold=0`));
}

async function checkHeadingRing(page, ctx, via) {
  const r = await page.evaluate(FV1_READ);
  if (r.missing) {
    report(ctx, result("FV1", "heading-focus-ring", "missing", "not on this build: no [data-figures-heading]"));
    return;
  }
  const want = via === "mouse" ? "none" : "not none";
  const ok = via === "mouse" ? r.outlineStyle === "none" : r.outlineStyle !== "none";
  report(ctx, result("FV1", "heading-focus-ring", ok ? "pass" : "fail", `via=${via} outlineStyle=${r.outlineStyle} outlineWidth=${r.outlineWidth} focused=${r.focused} focusVisible=${r.focusVisible} threshold=${want}`));
}

async function checkLandingCtas(page, ctx) {
  const r = await page.evaluate(CTA1_READ);
  if (r.missing) {
    report(ctx, result("CTA1", "landing-ctas", "missing", 'not on this build: no [data-cta="primary"]'));
    return;
  }
  const problems = [];
  if (!r.primary.inView) problems.push("primary out of view");
  if (r.secondary && !r.secondary.inView) problems.push("secondary out of view");
  if (r.href !== "/demo") problems.push(`primary href=${r.href}`);
  const sec = r.secondary ? `${px(r.secondary.top)}..${px(r.secondary.bottom)}` : "absent";
  report(ctx, result("CTA1", "landing-ctas", problems.length ? "fail" : "pass", `primary=${px(r.primary.top)}..${px(r.primary.bottom)} href=${r.href} secondary=${sec} viewport=${ctx.w}x${ctx.h} threshold=in view at the top, href=/demo`));
}

// The sections narrower than H1.6's minimum (60% of the viewport width). A section
// exactly at the minimum passes. Pure, so tests/unit checks use it without a browser.
export function narrowSections(sections, viewportWidth) {
  const min = viewportWidth * H16_RATIO_MIN;
  return sections.filter((s) => s.width < min);
}

// H1.6 on / at 1440x900. Other sizes are not checked.
async function checkLandingSections(page, ctx) {
  if (ctx.size !== H16_SIZE) return;
  const sections = await page.evaluate(H16_READ);
  if (!sections.length) {
    ctx.rep.add("note", "H1.6", "no visible section on / to measure", "landing-sections");
    return;
  }
  const min = ctx.w * H16_RATIO_MIN;
  const narrow = narrowSections(sections, ctx.w);
  const parts = sections.map((s) => `${s.name}=${px(s.width)}`);
  const detail = `${parts.join(" ")} viewport=${ctx.w}x${ctx.h} threshold=content box at least ${px(min)} (${Math.round(H16_RATIO_MIN * 100)}% of width)`;
  const failures = narrow.map((s) => `${s.name} ${px(s.width)} is narrower than ${px(min)}`);
  ctx.rep.add(narrow.length ? "blocker" : "ok", "H1.6", narrow.length ? `${detail} (${failures.join("; ")})` : detail, "landing-sections");
}

// Counts the rows of the given items by their tops. Items whose tops differ by at most
// H27_ROW_TOLERANCE_PX share a row. The verdict passes only for exactly H27_ITEMS items in
// one row. Pure, so unit tests use it without a browser.
export function ritualRowVerdict(items) {
  const tops = items.map((item) => item.top).sort((a, b) => a - b);
  let rows = 0;
  let rowTop = -Infinity;
  for (const top of tops) {
    if (top - rowTop > H27_ROW_TOLERANCE_PX) {
      rows += 1;
      rowTop = top;
    }
  }
  return { count: items.length, rows, ok: items.length === H27_ITEMS && rows === 1 };
}

// H2.7 on / at 1440x900. Other sizes are not checked.
async function checkRitualRow(page, ctx) {
  if (ctx.size !== H27_SIZE) return;
  const r = await page.evaluate(H27_READ);
  if (r.missing) {
    ctx.rep.add("note", "H2.7", "no ritual list on / to measure", "ritual");
    return;
  }
  const verdict = ritualRowVerdict(r.items);
  const tops = r.items.map((item) => px(item.top)).join(",");
  const detail = `${verdict.count} items in ${verdict.rows} row(s) tops=${tops} viewport=${ctx.w}x${ctx.h} threshold=${H27_ITEMS} items in 1 row`;
  ctx.rep.add(verdict.ok ? "ok" : "blocker", "H2.7", verdict.ok ? detail : `${detail} (expected one row of ${H27_ITEMS})`, "ritual");
}

async function checkDemoCards(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(DX1_READ);
  if (r.missing) {
    report(ctx, result("DX1", "demo-cards-in-view", "missing", "no persona link on /demo"));
    return;
  }
  const parts = r.links.map((l) => `${l.href}=bottom ${px(l.bottom)}${l.inView ? "" : "(out)"}`);
  report(ctx, result("DX1", "demo-cards-in-view", r.links.every((l) => l.inView) ? "pass" : "fail", `${parts.join(" ")} viewport=${ctx.w}x${ctx.h} threshold=inside viewport at scrollY 0`));
}

// HW1: at the Wide_Size, compare with the 1366x800 headline. The run stores the
// 1366x800 size when it walks that size; otherwise it opens / there once.
async function checkHeroWide(page, ctx) {
  if (ctx.size === HW1_BASE_SIZE) ctx.memo.h1At1366 = await page.evaluate(HW1_READ);
  if (ctx.size !== WIDE_SIZE) return;
  const wide = await page.evaluate(HW1_READ);
  if (ctx.memo.h1At1366 === undefined) {
    const [bw, bh] = parseSize(HW1_BASE_SIZE);
    const other = await page.context().browser().newContext({ viewport: { width: bw, height: bh } });
    try {
      const p = await other.newPage();
      await p.goto(`${ctx.base}/`, { waitUntil: "load" });
      ctx.memo.h1At1366 = await p.evaluate(HW1_READ);
    } finally {
      await other.close();
    }
  }
  const base = ctx.memo.h1At1366;
  if (wide === null || base === null) {
    report(ctx, result("HW1", "hero-wide", "missing", "no h1 on /"));
    return;
  }
  const ratio = wide / base;
  report(ctx, result("HW1", "hero-wide", ratio >= HW1_RATIO_MIN ? "pass" : "fail", `h1=${wide}px at ${WIDE_SIZE}, ${base}px at ${HW1_BASE_SIZE} ratio=${ratio.toFixed(2)} threshold=>=${HW1_RATIO_MIN}`));
}

async function checkStepIndicator(page, ctx, stage) {
  const r = await page.evaluate(ST1_READ);
  if (r.missing) {
    report(ctx, result("ST1", "step-indicator", "missing", "not on this build: no [data-step-indicator]"));
    return;
  }
  const maxLines = isPhone(ctx) ? ST_LINES_PHONE_MAX : 1;
  const wantCurrent = stage === "intact" ? null : 1;
  const ok = r.lines <= maxLines && (wantCurrent === null || r.current === wantCurrent);
  report(ctx, result("ST1", "step-indicator", ok ? "pass" : "fail", `steps=${r.steps} current=${r.current} lines=${r.lines} threshold=present${wantCurrent === null ? "" : ", current=1"}, lines<=${maxLines}`));
}

async function checkReceiptsInView(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(RC1_READ);
  report(ctx, r.missing
    ? result("RC1", "receipts-in-view", "missing", "not on this build: no [data-figure-entry]")
    : result("RC1", "receipts-in-view", r.inView ? "pass" : "fail", `firstEntry=${px(r.top)}..${px(r.bottom)} viewport=${ctx.w}x${ctx.h} scrollY=${Math.round(await page.evaluate(() => window.scrollY))} threshold=fully inside viewport`));
}

// ---------------------------------------------------------------------------
// Spec 10 checks (spec 10 design.md "Owner patches", ad). Each prints measured
// values and threshold=, and is a BLOCKER only with --require; a check whose
// element is not on this build prints a note.
// ---------------------------------------------------------------------------
async function checkTickOnAxis(page, ctx) {
  const r = await page.evaluate(TK1_READ);
  if (r.missing) {
    report(ctx, result("TK1", "tick-on-axis", "missing", "not on this build: no [data-line-axis] with [data-line-tick]"));
    return;
  }
  const off = r.ticks.filter((t) => Math.abs(t.dTop) > TK1_AXIS_TOL_PX);
  const far = r.ticks.filter((t) => t.gap === null || t.gap > TK1_LABEL_GAP_MAX_PX);
  const worstTop = Math.max(...r.ticks.map((t) => Math.abs(t.dTop)));
  const worstGap = Math.max(...r.ticks.map((t) => (t.gap === null ? Infinity : t.gap)));
  const list = (ts) => ts.slice(0, 4).map((t) => `${t.kind} dTop=${t.dTop.toFixed(1)} gap=${t.gap === null ? "no label" : t.gap.toFixed(1)}`).join("; ");
  const bad = off.length || far.length || r.overlaps.length;
  report(ctx, result("TK1", "tick-on-axis", bad ? "fail" : "pass", `axes=${r.axes} ticks=${r.ticks.length} worstTopOffset=${worstTop.toFixed(1)}px worstLabelGap=${Number.isFinite(worstGap) ? worstGap.toFixed(1) : "no label"}px labelOverlaps=${r.overlaps.length}${bad ? ` (${[list([...off, ...far]), ...r.overlaps.slice(0, 2)].filter(Boolean).join("; ")})` : ""} threshold=top offset 0±${TK1_AXIS_TOL_PX}px, label gap<=${TK1_LABEL_GAP_MAX_PX}px, no label overlap`));
}
// SI1 reads the indicator with the page at the top, where it is drawn, then restores the scroll.
async function checkStepFit(page, ctx) {
  const startY = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await sleep(150);
  const r = await page.evaluate(SI1_READ);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  if (r.missing) {
    report(ctx, result("SI1", "step-indicator-fit", "missing", "not on this build: no [data-step-indicator]"));
    return;
  }
  const maxLines = isPhone(ctx) ? SI1_LINES_PHONE_MAX : 1;
  const problems = [...r.problems];
  if (r.items !== SI1_ITEMS) problems.push(`${r.items} items`);
  if (r.lines > maxLines) problems.push(`${r.lines} lines`);
  report(ctx, result("SI1", "step-indicator-fit", problems.length ? "fail" : "pass", `items=${r.items} lines=${r.lines}${problems.length ? ` (${problems.slice(0, 4).join("; ")})` : ""} threshold=${SI1_ITEMS} items, scrollWidth<=clientWidth, inside the viewport, clear of [data-ghost], lines<=${maxLines}`));
}
// GT1 at the Stage start, then again with the page scrolled to the bottom.
async function checkGhostText(page, ctx, { replacedByGo1 = false } = {}) {
  // On the Remember step at GO1_SIZES, GO1 (checkGo1) replaces GT1, so GT1 is only noted there.
  if (replacedByGo1 && GO1_SIZES.includes(ctx.size)) {
    report(ctx, result("GT1", "ghost-over-text", "missing", `replaced by GO1 on the Remember step at ${ctx.size}`));
    return;
  }
  // Below 600 px the Ghost fix is spec 10 task 5's (X2.1), which also removes the
  // pick-up press that scrolls the page. Until then GT1 prints a note on the phone.
  // Patch ai removes this tolerance.
  if (isPhone(ctx) && ctx.pickedUp) {
    report(ctx, result("GT1", "ghost-over-text", "missing", `this build needs a "${PICK_UP}" press before recall; below ${PHONE_WIDTH_MAX} px GT1 reads only a build that opens on recall`));
    return;
  }
  const startY = await page.evaluate(() => window.scrollY);
  const first = await page.evaluate(GT1_READ);
  if (first.missing) {
    report(ctx, result("GT1", "ghost-over-text", "missing", "no [data-ghost] box at this Stage"));
    return;
  }
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await sleep(250);
  const bottom = await page.evaluate(GT1_READ);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), startY);
  const hits = [...new Set([...first.hits, ...(bottom.missing ? [] : bottom.hits.map((h) => `${h} (scrolled)`))])];
  report(ctx, result("GT1", "ghost-over-text", hits.length ? "fail" : "pass", `measured=${first.measured} ghostBody=${px(first.ghost.left)}..${px(first.ghost.right)}x${px(first.ghost.top)}..${px(first.ghost.bottom)} hits=${hits.length}${hits.length ? ` (${hits.slice(0, 4).join("; ")})` : ""} threshold=0 outside [data-ghost] on the Ghost_Body_Box (at the Stage start and scrolled to the bottom)`));
}
// FC1 reads the persona page once recall starts on load, with no pick-up press.
async function checkLoadFocus(page, ctx, loadY) {
  if (ctx.pickedUp) {
    report(ctx, result("FC1", "load-focus", "missing", `this build needs a "${PICK_UP}" press before recall; FC1 reads only a recall reached on load`));
    return;
  }
  const r = await page.evaluate(FC1_READ);
  if (!r.hasHeading) {
    report(ctx, result("FC1", "load-focus", "missing", "not on this build: no [data-stage-heading]"));
    return;
  }
  const drift = Math.abs(r.scrollY - loadY);
  const ok = r.onHeading && drift < 1;
  report(ctx, result("FC1", "load-focus", ok ? "pass" : "fail", `active=${r.active} onHeading=${r.onHeading} scrollY=${Math.round(r.scrollY)} atLoad=${Math.round(loadY)} threshold=focus on [data-stage-heading], scrollY unchanged`));
}
async function checkSealOnEnvelope(page, ctx) {
  if (!DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(ET1_READ);
  if (r.missing) {
    report(ctx, result("ET1", "seal-on-envelope", "missing", "not on this build: no [data-envelope-seal] in a [data-envelope-state] box"));
    return;
  }
  const problems = [];
  if (!r.inside) problems.push("seal outside the Envelope box");
  if (r.onDates.length) problems.push(`seal on ${r.onDates.map((d) => `"${d}"`).join(", ")}`);
  if (r.pairs.length) problems.push(`overlap ${r.pairs.slice(0, 3).join("; ")}`);
  report(ctx, result("ET1", "seal-on-envelope", problems.length ? "fail" : "pass", `state=${r.state} seal=${px(r.seal.left)}..${px(r.seal.right)}x${px(r.seal.top)}..${px(r.seal.bottom)} envelope=${px(r.envelope.left)}..${px(r.envelope.right)}x${px(r.envelope.top)}..${px(r.envelope.bottom)} dateLines=${r.dates}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=seal inside the Envelope, on no [data-date], no two drawn elements overlap`));
}
async function checkSealGroup(page, ctx) {
  const phone = isPhone(ctx);
  if (!phone && !DESKTOP_SIZES.includes(ctx.size) && ctx.size !== WIDE_SIZE) return;
  const r = await page.evaluate(SG1_READ, phone);
  if (r.missing) {
    report(ctx, result("SG1", "seal-group", "missing", "not on this build: no [data-seal-group] (or no [data-ghost-box] to measure against)"));
    return;
  }
  const g = `group=${px(r.group.left)}..${px(r.group.right)}x${px(r.group.top)}..${px(r.group.bottom)} inView=${r.inView}`;
  const problems = [];
  if (!r.inView) problems.push("outside the viewport");
  if (phone) {
    if (r.belowGhost === null) problems.push("no [data-ghost] box");
    else if (r.belowGhost < 0 || r.belowGhost > SG1_GAP_MAX_PX) problems.push(`top ${r.belowGhost.toFixed(1)}px below the Ghost`);
    if (r.onGhost) problems.push("on [data-ghost]");
    report(ctx, result("SG1", "seal-group", problems.length ? "fail" : "pass", `${g} belowGhost=${r.belowGhost === null ? "n/a" : `${r.belowGhost.toFixed(1)}px`}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=top 0 to ${SG1_GAP_MAX_PX}px below [data-ghost], not on it, inside the First_Viewport`));
    return;
  }
  if (r.onBody) problems.push("on the Ghost_Body_Box");
  if (r.onEnvelope) problems.push("on the Envelope");
  if (r.edgeGap < 0 || r.edgeGap > SG1_GAP_MAX_PX) problems.push(`edge gap ${r.edgeGap.toFixed(1)}px`);
  if (!r.level) problems.push("not level with the seal");
  if (r.hintAlign !== null && r.hintAlign !== "left" && r.hintAlign !== "center" && r.hintAlign !== "start") problems.push(`hint text-align ${r.hintAlign}`);
  if (r.hintClipped) problems.push("hint clipped");
  report(ctx, result("SG1", "seal-group", problems.length ? "fail" : "pass", `${g} edgeGap=${r.edgeGap.toFixed(1)}px sealY=${r.sealY === null ? "n/a" : px(r.sealY)} hintAlign=${r.hintAlign ?? "no hint"}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=clear of the Ghost_Body_Box and the Envelope, edge gap 0 to ${SG1_GAP_MAX_PX}px, seal centre within the group, hint left or centre and unclipped, inside the viewport`));
}
async function checkAnswerList(page, ctx) {
  const r = await page.evaluate(AL1_READ);
  const problems = [];
  if (!r.present) problems.push("no [data-answer-list] in marks");
  if (r.onGhost) problems.push("on [data-ghost]");
  if (r.onGroup) problems.push("on [data-seal-group]");
  report(ctx, result("AL1", "answer-list", problems.length ? "fail" : "pass", `present=${r.present} onGhost=${!!r.onGhost} onSealGroup=${!!r.onGroup}${problems.length ? ` (${problems.join("; ")})` : ""} threshold=present, clear of [data-ghost] and [data-seal-group]`));
}
async function checkCardFit(page, ctx) {
  const r = await page.evaluate(CF1_READ);
  if (r.missing) {
    report(ctx, result("CF1", "card-fit", "missing", "no [data-card] or [data-stage-panel] at this Stage"));
    return;
  }
  const bad = r.cards.filter((c) => c.slack > CF1_SLACK_MAX_PX || !c.content);
  const worst = Math.max(...r.cards.map((c) => c.slack));
  report(ctx, result("CF1", "card-fit", bad.length ? "fail" : "pass", `cards=${r.cards.length} worstSlack=${worst.toFixed(1)}px${bad.length ? ` (${bad.slice(0, 3).map((c) => `${c.name} height=${px(c.height)} content=${px(c.union)}${c.content ? "" : " controls only"}`).join("; ")})` : ""} threshold=height minus content<=${CF1_SLACK_MAX_PX}px, holds a non-control`));
}
// FP1: a fresh persona page, pressing only [data-primary-control] from load to the
// Figures_Heading. Each press stores a Recall_Record in the local database, as the
// main walk does.
async function checkFastestPath(context, ctx, p) {
  ctx.rep.stage(`${p.prefix}fastest path`);
  const page = await newPage(context);
  try {
    await page.goto(`${ctx.base}${p.path}`, { waitUntil: "load" });
    const first = await reachRecall(page);
    if (first !== "recall") {
      report(ctx, result("FP1", "fastest-path", "missing", first === "pickup" ? `this build needs a "${PICK_UP}" press before recall; FP1 reads only a recall reached on load` : "recall not reached"));
      return;
    }
    const counter = await page.evaluate(() => document.querySelector('[data-fit="counter"]')?.textContent ?? "");
    const total = Number((/of\s+(\d+)/i.exec(counter) ?? [])[1]) || null;
    const limit = total === null ? null : 2 + total;
    const pressed = [];
    let reached = false;
    let stuck = null;
    for (let i = 0; i < FP1_MAX_PRESSES; i += 1) {
      let target = null;
      for (let t = 0; t < FP1_WAIT_STEPS; t += 1) {
        if ((await page.locator("[data-figures-heading]").count()) > 0) {
          reached = true;
          break;
        }
        target = await page.evaluate(FP1_TARGET);
        if (target?.label) break;
        await sleep(400);
      }
      if (reached) break;
      if (!target?.label) {
        stuck = { stage: await stageOf(page), blocked: target?.blocked ?? null };
        break;
      }
      await page.locator("[data-fp1-target]").first().click({ timeout: WAIT_MS });
      pressed.push(target.label);
      await sleep(600);
    }
    if (!reached && (await page.locator("[data-figures-heading]").count()) > 0) reached = true;
    const path = pressed.map((l) => `"${l}"`).join(" > ") || "none";
    if (!reached && stuck?.blocked && stuck.stage === "recall") {
      report(ctx, result("FP1", "fastest-path", "missing", `"${stuck.blocked}" is disabled with the field as it loads (no Sample_Answer on this build); presses=${pressed.length} path=${path}`));
      return;
    }
    const ok = reached && limit !== null && pressed.length <= limit;
    report(ctx, result("FP1", "fastest-path", ok ? "pass" : "fail", `questions=${total ?? "unknown"} presses=${pressed.length} reachedFiguresHeading=${reached}${stuck ? ` stoppedAt=${stuck.stage}${stuck.blocked ? ` ("${stuck.blocked}" disabled)` : ""}` : ""} path=${path} threshold=<=${limit ?? "2+questions"} presses to [data-figures-heading]`));
  } finally {
    await page.close();
  }
}
// The first of the recall Stage or a "Pick up the letter" button, after load.
// Builds before spec 10 task 5 show the button; later builds open on recall.
async function reachRecall(page, timeout = FIRST_STAGE_WAIT_MS) {
  const pickUp = page.getByRole("button", { name: PICK_UP, exact: true });
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if ((await stageOf(page)) === "recall") return "recall";
    if ((await pickUp.count()) > 0 && (await pickUp.first().isVisible())) return "pickup";
    await sleep(200);
  }
  return null;
}
// Answers every recall question. A field that holds a value (a Sample_Answer) is
// kept; an empty one gets the walk's answer. The primary control is pressed with
// the mouse, never Enter, since Enter adds a line break in a text field.
// onQuestion(i, kind) runs before each press. Returns null or a blocker message.
async function answerAll(page, answers, onQuestion = async () => {}) {
  const field = page.locator('input[type="text"]:visible, textarea:visible').first();
  const counterText = () => page.evaluate(() => document.querySelector('[data-fit="counter"]')?.textContent?.trim() ?? "");
  for (let i = 0; i < 20; i += 1) {
    if ((await field.count()) > 0) {
      const value = await field.inputValue();
      if (!value.trim()) await field.fill(answers[i] ?? answers[answers.length - 1] ?? TEXT_ANSWER);
    }
    const next = page.getByRole("button", { name: NEXT, exact: true });
    const record = page.getByRole("button", { name: RECORD, exact: true });
    if ((await next.count()) > 0 && (await next.first().isVisible())) {
      await onQuestion(i, NEXT);
      const before = await counterText();
      await next.first().click();
      try {
        await page.waitForFunction((b) => (document.querySelector('[data-fit="counter"]')?.textContent?.trim() ?? "") !== b, before, { timeout: WAIT_MS });
      } catch {
        return `answering question ${i + 1} does not reach question ${i + 2} (counter: "${before}")`;
      }
      continue;
    }
    if ((await record.count()) > 0 && (await record.first().isVisible())) {
      await onQuestion(i, RECORD);
      await record.first().click();
      return null;
    }
    return `no "${NEXT}" or "${RECORD}" button on question ${i + 1}`;
  }
  return "more than 20 questions";
}
// The spec 09 checks every page and Stage gets.
async function checkEveryPage(page, ctx, route, { fonts = false } = {}) {
  await guard(ctx, "BO1", () => checkButtonOverflow(page, ctx));
  await guard(ctx, "BC1", () => checkControlInCard(page, ctx));
  if (fonts) await guard(ctx, "FONT1", () => checkFonts(page, ctx, route));
  await guard(ctx, "PH", () => checkPhone(page, ctx, route));
}

// The figures button: [data-advance="figures"], else either label (task 14 renames it).
async function figuresButton(page) {
  const hooked = page.locator(FIGURES_HOOK);
  if ((await hooked.count()) > 0) return { loc: hooked.first(), label: FIGURES_HOOK };
  const named = page.getByRole("button", { name: FIGURES_LABEL });
  if ((await named.count()) > 0) return { loc: named.first(), label: (await named.first().textContent())?.trim() || SEE_NUMBERS };
  return null;
}

// The landing's start: [data-cta="primary"], else the old "Open Maya" link.
async function landingStart(page) {
  const hooked = page.locator(LANDING_HOOK);
  if ((await hooked.count()) > 0) return { loc: hooked.first(), label: LANDING_HOOK };
  const named = page.getByRole("link", { name: LANDING_START });
  if ((await named.count()) > 0) return { loc: named.first(), label: LANDING_START.source };
  return null;
}

// Tab until the control has focus, so the press that follows is a keyboard press.
async function tabTo(page, loc) {
  for (let i = 0; i < 120; i++) {
    if (await loc.evaluate((el) => document.activeElement === el)) return true;
    await page.keyboard.press("Tab");
  }
  return false;
}

// Runs one check. A thrown error here is a check that could not run, which is
// reported as a note so the walk carries on.
async function guard(ctx, label, fn) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof NotOnBuild) ctx.rep.add("note", label, `not on this build: ${error.message}`);
    else ctx.rep.add("note", label, `could not run: ${String(error.message ?? error).split("\n")[0]}`);
  }
}

// An element a row needs is not on the page. guard() prints it as a "not on this build" note.
class NotOnBuild extends Error {}

// How long a row looks for an element before it calls it absent. The page has loaded and
// settled by then; without this check an absent element waited out Playwright's 30 s
// action timeout (S2, S, W7, W12, the X2.1 setup clicks, W5.2, the P1 Next presses).
const PRESENT_MS = 2000;

async function present(locator, timeout = PRESENT_MS) {
  return locator.first().waitFor({ state: "attached", timeout }).then(() => true, () => false);
}

// The old `.click().catch(() => {})` for a control a row only sets up: skipped when absent.
async function clickIfPresent(locator) {
  if (await present(locator)) await locator.click().catch(() => {});
}

// Throws NotOnBuild when `locator` is absent, so a guarded row reports it at once.
async function need(locator, what) {
  if (!(await present(locator))) throw new NotOnBuild(`no ${what}`);
  return locator;
}

async function newPage(context) {
  return context.newPage();
}

// Landing: `/` in the scene, then the Emergence, sealed and error stages from the button.
async function landing(context, ctx) {
  ctx.rep.stage("scene");
  const page = await newPage(context);
  let hasStart = false;
  try {
    await page.goto(`${ctx.base}/`, { waitUntil: "load" });
    await sleep(1000);
    const stage = await stageOf(page);
    const start = await landingStart(page);
    hasStart = start !== null;
    if (stage !== "scene") {
      ctx.rep.add("note", "scene", `the landing is not a scene on this build (data-ceremony is ${stage ?? "missing"}); skipped`);
    } else {
      await shot(page, ctx, "scene");
      await guard(ctx, "CT1", () => checkCt1(page, ctx));
      await guard(ctx, "F2", () => checkSoil(page, ctx));
      if (start) await guard(ctx, "BTN", () => checkMainButton(page, ctx, start, true, "link"));
      await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
      await guard(ctx, "LG1", () => checkLandingGhost(page, ctx));
      await guard(ctx, "NB1", () => checkNoDirtBand(page, ctx));
      await guard(ctx, "FT1", () => checkFooter(page, ctx));
      await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
      await guard(ctx, "CTA1", () => checkLandingCtas(page, ctx));
      await guard(ctx, "LS1", () => checkLandingSeal(page, ctx));
      await guard(ctx, "H1.6", () => checkLandingSections(page, ctx));
      await guard(ctx, "LF1", () => checkLandingHalves(page, ctx));
      await guard(ctx, "LF2", () => checkRitualCards(page, ctx));
      await guard(ctx, "H2.7", () => checkRitualRow(page, ctx));
      await guard(ctx, "HW1", () => checkHeroWide(page, ctx));
      await checkEveryPage(page, ctx, "/", { fonts: true });
    }
  } finally {
    await page.close();
  }

  if (!hasStart) {
    ctx.rep.stage("emerging, sealed, error");
    ctx.rep.add("note", "walk", `the landing has no ${LANDING_HOOK} and no "Open Maya's letter" link on this build; these stages are skipped`);
    return;
  }

  // A stub answer that arrives after the page has closed has nothing to answer, so its error is ignored.
  const answer = (status, body) => (route) => route.fulfill({ status, contentType: "application/json", body }).catch(() => {});
  await fromLanding(context, ctx, "emerging", async (route) => {
    await sleep(4000);
    await answer(200, SEALED_BODY)(route);
  }, 1500);
  await fromLanding(context, ctx, "sealed", answer(200, SEALED_BODY), 2500);
  await fromLanding(context, ctx, "error", answer(404, "{}"), 1500);
}

async function fromLanding(context, ctx, stage, handler, settleMs) {
  ctx.rep.stage(stage);
  const page = await newPage(context);
  try {
    await page.route("**/api/letters/**", handler);
    await page.goto(`${ctx.base}/`, { waitUntil: "load" });
    const start = await landingStart(page);
    if (!start) throw new Error("no landing start control");
    await start.loc.click({ timeout: WAIT_MS });
    // From task 9 the primary call to action opens /demo; the walk then opens Maya's letter from there.
    await sleep(300);
    if (new URL(page.url()).pathname.replace(/\/+$/, "") === "/demo") {
      await page.locator(`a[href="${PERSONA_PATH}"]`).first().click({ timeout: WAIT_MS });
    }
    await sleep(settleMs);
    const got = await stageOf(page);
    if (got !== stage) {
      ctx.rep.add("note", stage, `not reached: data-ceremony is ${got ?? "missing"} after the click`);
      return;
    }
    await shot(page, ctx, stage);
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    if (stage === "emerging" || stage === "sealed") {
      const pickUp = await page.getByRole("button", { name: PICK_UP, exact: true }).count();
      if (pickUp) ctx.rep.add("polish", "walk", `"${PICK_UP}" is shown in the ${stage} stage`);
    }
  } catch (error) {
    ctx.rep.add("note", stage, `not reached: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

// /demo: the index must link to Maya's letter, so the judge can reach the persona.
async function index(context, ctx) {
  ctx.rep.stage("index");
  const page = await newPage(context);
  try {
    const res = await page.goto(`${ctx.base}/demo`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      ctx.rep.add("note", "index", `/demo answered HTTP ${res?.status() ?? "none"}; skipped`);
      return;
    }
    await sleep(800);
    await shot(page, ctx, "index");
    for (const persona of PERSONAS) {
      const link = await page.locator(`a[href="${persona.path}"]`).count();
      if (link === 0) ctx.rep.add("blocker", "walk", `/demo has no link to ${persona.path}, so the judge cannot reach the letter`);
      else ctx.rep.add("ok", "walk", `/demo links to ${persona.path}`);
    }
    await guard(ctx, "DL1", () => checkDemoLabel(page, ctx));
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "DX1", () => checkDemoCards(page, ctx));
    await checkEveryPage(page, ctx, "/demo", { fonts: true });
  } finally {
    await page.close();
  }
}

// The persona walk: intact, recall (two questions), marks, seal (when built), letter, figures, close.
// Maya's walk presses the figures button with the mouse and Tomás's with Tab and
// Enter, so FV1 reads both cases at every size.
async function persona(context, ctx, p, via) {
  const page = await newPage(context);
  ctx.persona = p.key;
  ctx.ghostHook = false;
  ctx.intactCentre = null;
  ctx.pickedUp = false;
  ctx.g2Ref = "intact";
  try {
    await personaWalk(page, ctx, p, via);
  } catch (error) {
    // Once the persona page is open, an error that stops the walk means the judge cannot finish the flow.
    const where = ctx.stage ? ` at the ${ctx.stage} stage` : "";
    ctx.rep.add("blocker", "walk", `the flow stopped${where}: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    ctx.persona = undefined;
    await page.close();
  }
}

async function personaWalk(page, ctx, p, via) {
  const S = (stage) => `${p.prefix}${stage}`;
  const route = p.path;
  ctx.rep.stage(S("intact"));
  const res = await page.goto(`${ctx.base}${p.path}`, { waitUntil: "load" });
  if (!res || res.status() !== 200) {
    ctx.rep.add("blocker", "walk", `${p.path} answered HTTP ${res?.status() ?? "none"}; the flow cannot be finished`);
    return;
  }
  const loadY = await page.evaluate(() => window.scrollY);
  // Spec 10 ad: builds before task 5 show "Pick up the letter"; later builds open on recall.
  const first = await reachRecall(page);
  if (first === null) {
    ctx.rep.add("blocker", "walk", `no "${PICK_UP}" button and no recall stage on ${p.path} within ${FIRST_STAGE_WAIT_MS / 1000} s; the flow cannot be finished`);
    return;
  }
  ctx.pickedUp = first === "pickup";
  ctx.g2Ref = ctx.pickedUp ? "intact" : "recall";
  if (ctx.pickedUp) {
    const pickUp = page.getByRole("button", { name: PICK_UP, exact: true });
    await sleep(2600); // the Ghost's rise (900 ms delay + 1500 ms) settles before the box checks
    await shot(page, ctx, S("intact"));
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    await guard(ctx, "G1", () => checkGhostBody(page, ctx));
    await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "intact"));
    await guard(ctx, "G3", () => checkFrame(page, ctx));
    await guard(ctx, "E1", () => checkDates(page, ctx));
    await guard(ctx, "T0", () => checkTopBar(page, ctx));
    await guard(ctx, "BTN", () => checkMainButton(page, ctx, PICK_UP, true));
    await guard(ctx, "D1", () => checkDust(page, ctx));
    await guard(ctx, "NB1", () => checkNoDirtBand(page, ctx));
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "intact"));
    await guard(ctx, "GT1", () => checkGhostText(page, ctx));
    await guard(ctx, "CF1", () => checkCardFit(page, ctx));
    await guard(ctx, "GZ1", async () => {
      if (await page.evaluate(() => !!document.querySelector("[data-ghost]"))) ctx.ghostHook = true;
    });
    await checkEveryPage(page, ctx, route, { fonts: true });
    // Pick up the letter: the recall stage.
    await pickUp.click();
    if (!(await waitForStage(page, "recall"))) {
      ctx.rep.add("blocker", "walk", `"${PICK_UP}" does not reach the recall stage (data-ceremony is ${await stageOf(page)})`);
      return;
    }
  }
  ctx.rep.stage(S("recall"));
  if (!ctx.pickedUp) {
    ctx.rep.add("ok", "walk", "recall reached on load, with no pick-up press");
    await sleep(500);
  }
  await guard(ctx, "FC1", () => checkLoadFocus(page, ctx, loadY));
  // The handed layout starts moving a frame after the stage changes, so wait before settling.
  await sleep(ctx.pickedUp ? 1500 : 2600);
  await settle(page);
  // R1 reads the page as the judge first sees it, before anything scrolls.
  await guard(ctx, "R1", () => checkRecallInView(page, ctx));
  await shot(page, ctx, S("recall"));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  await guard(ctx, "T2", () => checkTicks(page, ctx));
  await guard(ctx, "F1", () => checkFit(page, ctx, [
    { name: "question", sel: '[data-fit="question"]' },
    { name: "answer", sel: '[data-fit="answer"]' },
    { name: "advance", sel: '[data-fit="advance"]' },
  ]));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "G1", () => checkRememberGhost(page, ctx, "recall"));
  await guard(ctx, "LC1", () => checkLc1(page, ctx, { trackOnly: true, label: "Remember" }));
  await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "recall"));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "recall"));
  await guard(ctx, "F3", () => checkPersonaTestify(page, ctx));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "GT1", () => checkGhostText(page, ctx, { replacedByGo1: true }));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  if (!ctx.pickedUp) {
    await guard(ctx, "GZ1", async () => {
      if (await page.evaluate(() => !!document.querySelector("[data-ghost]"))) ctx.ghostHook = true;
    });
  }
  await checkEveryPage(page, ctx, route, { fonts: !ctx.pickedUp });
  const answers = p.answers(await page.evaluate(() => document.body.innerText));
  const problem = await answerAll(page, answers, async (i, control) => {
    // CT1 after question 1 is answered: question 2 is on screen, so Previous question exists.
    if (i === 1) await guard(ctx, "CT1", () => checkCt1(page, ctx));
    if (i === 1) await guard(ctx, "CW1", () => checkCw1(page, ctx));
    if (i > 0) await guard(ctx, "G1", () => checkRememberGhost(page, ctx, `question ${i + 1}`));
    if (i === 0 || control === RECORD) await guard(ctx, "BTN", () => checkMainButton(page, ctx, control));
  });
  if (problem) {
    ctx.rep.add("blocker", "walk", problem);
    return;
  }
  // Marks: both answers recorded.
  ctx.rep.stage(S("marks"));
  if (!(await waitForStage(page, "marks"))) {
    ctx.rep.add("blocker", "walk", `"${RECORD}" does not reach the marks stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  await sleep(1500);
  await settle(page);
  await shot(page, ctx, S("marks"));
  await guard(ctx, "F1", () => checkFit(page, ctx, [
    { name: "marks-heading", sel: '[data-fit="marks-heading"]' },
    { name: "marks-answers", sel: '[data-fit="marks-answers"]' },
    { name: "break", sel: '[data-fit="break"]' },
  ]));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "G1", () => checkGhostBody(page, ctx));
  await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "marks"));
  await guard(ctx, "GO1", () => checkGo1Break(page, ctx));
  await guard(ctx, "LC1", () => checkLc1(page, ctx));
  await guard(ctx, "BTN", () => checkMainButton(page, ctx, BREAK_SEAL));
  await guard(ctx, "CT1", () => checkCt1(page, ctx));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  await guard(ctx, "T2", () => checkTicks(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "RS1", () => checkScaleOverlap(page, ctx));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "marks"));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "ET1", () => checkSealOnEnvelope(page, ctx));
  await guard(ctx, "SG1", () => checkSealGroup(page, ctx));
  await guard(ctx, "AL1", () => checkAnswerList(page, ctx));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  await checkEveryPage(page, ctx, route);

  // Seal: the hold, when this build has the seal target (a later spec 07 task).
  const seal = page.locator("[data-seal-target]").first();
  if ((await seal.count()) > 0) {
    ctx.rep.stage(S("seal"));
    await seal.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const init = { pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 };
      el.dispatchEvent(new PointerEvent("pointerdown", init));
    });
    await sleep(700);
    await shot(page, ctx, S("seal"));
    await guard(ctx, "U8", () => checkBreakSeal(page, ctx));
    await guard(ctx, "G2", () => checkGhostCentre(page, ctx, "seal"));
    await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, true));
    await seal.evaluate((el) => {
      const box = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1, pointerType: "touch", isPrimary: true, bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }));
    });
    await sleep(400);
  } else {
    ctx.rep.add("note", "seal", "no seal target on this build (the seal hold is a later spec 07 task); skipped");
  }

  // Break the seal: the letter stage.
  const breakButton = page.getByRole("button", { name: BREAK_SEAL, exact: true });
  if ((await breakButton.count()) === 0) {
    ctx.rep.add("blocker", "walk", `no "${BREAK_SEAL}" button in marks; the flow cannot be finished`);
    return;
  }
  await breakButton.click();
  if (!(await waitForStage(page, "letter"))) {
    ctx.rep.add("blocker", "walk", `"${BREAK_SEAL}" does not reach the letter stage (data-ceremony is ${await stageOf(page)})`);
    return;
  }
  ctx.rep.stage(S("letter"));
  await sleep(2300);
  await shot(page, ctx, S("letter"));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "W1", () => checkLetterWidth(page, ctx));
  await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
  // The letter is long by design, so the figures button sits below it and is not held to the 1280x800 rule.
  const figures = await figuresButton(page);
  if (figures) await guard(ctx, "BTN", () => checkMainButton(page, ctx, figures));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));
  await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "letter"));
  await guard(ctx, "SI1", () => checkStepFit(page, ctx));
  await guard(ctx, "GT1", () => checkGhostText(page, ctx));
  await guard(ctx, "CF1", () => checkCardFit(page, ctx));
  await checkEveryPage(page, ctx, route, { fonts: true });

  // Figures: [data-advance="figures"], else "See the numbers" or "See the receipts".
  if (!figures) {
    ctx.rep.add("blocker", "walk", `no ${FIGURES_HOOK} and no "See the numbers" or "See the receipts" button after the letter; the flow cannot be finished`);
    return;
  }
  if (via === "keyboard") {
    if (!(await tabTo(page, figures.loc))) {
      ctx.rep.add("note", "FV1", `Tab did not reach "${figures.label}"; pressed with the mouse instead`, "heading-focus-ring");
      via = "mouse";
      await figures.loc.click();
    } else {
      await page.keyboard.press("Enter");
    }
  } else {
    await figures.loc.click();
  }
  await sleep(100);
  const figuresStage = await stageOf(page);
  if (figuresStage === "letter") {
    await sleep(400);
    if ((await stageOf(page)) === "letter") {
      ctx.rep.add("blocker", "walk", `"${figures.label}" does nothing (still in the letter stage)`);
      return;
    }
  }
  ctx.rep.stage(S("figures"));
  ctx.rep.add("ok", "walk", `figures reached (data-ceremony is ${await stageOf(page)})`);
  // N1 reads where the press landed the judge, so nothing scrolls before it.
  let headingFound = false;
  await guard(ctx, "N1", async () => {
    headingFound = await checkNumbersFocus(page, ctx, figures.label, S("figures"));
  });
  if (p.key === PERSONAS[0].key) ctx.hasFiguresHeading = headingFound;
  await guard(ctx, "FV1", () => checkHeadingRing(page, ctx, via));
  await guard(ctx, "F2", () => checkSoil(page, ctx));
  await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
  await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));

  // Close.
  if (await waitForStage(page, "close", 12000)) {
    ctx.rep.stage(S("close"));
    await sleep(1000);
    // RC1 reads where the figures button left the judge, before anything scrolls.
    await guard(ctx, "RC1", () => checkReceiptsInView(page, ctx));
    await guard(ctx, "B1", () => checkFigureBoxes(page, ctx));
    await guard(ctx, "L1", () => checkLineLabels(page, ctx));
    await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
    await shot(page, ctx, S("close"));
    await guard(ctx, "CT1", () => checkCt1(page, ctx));
    await guard(ctx, "F2", () => checkSoil(page, ctx));
    await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
    await guard(ctx, "FT1", () => checkFooter(page, ctx));
    await guard(ctx, "GZ1", () => checkGhostGone(page, ctx, false));
    await guard(ctx, "ST1", () => checkStepIndicator(page, ctx, "close"));
    await guard(ctx, "SI1", () => checkStepFit(page, ctx));
    await guard(ctx, "TK1", () => checkTickOnAxis(page, ctx));
    await guard(ctx, "CF1", () => checkCardFit(page, ctx));
    await guard(ctx, "FONT2", async () => {
      const r = await page.evaluate(FONT2_READ);
      if (!r.missing) report(ctx, result("FONT2", "fonts-sans-ui", r.off.length ? "fail" : "pass", `sans=${r.sans} measured=${r.measured} off=${r.off.length}${r.off.length ? ` (${r.off.slice(0, 3).join("; ")})` : ""} threshold=0`));
    });
    await checkEveryPage(page, ctx, route);
  } else {
    ctx.rep.add("note", "close", `not reached: the walk stops at data-ceremony "${await stageOf(page)}" on this build`);
  }
}

// N1 again through "Show everything" from the marks Stage (R2.3). Runs only on
// builds that have [data-figures-heading]; otherwise the first walk's note stands.
async function showAll(context, ctx) {
  ctx.rep.stage("show everything");
  if (!ctx.hasFiguresHeading) {
    ctx.rep.add("note", "N1", `skipped "${SHOW_ALL}": no [data-figures-heading] on this build`, "numbers-focus");
    return;
  }
  const page = await newPage(context);
  try {
    await page.goto(`${ctx.base}${PERSONA_PATH}`, { waitUntil: "load" });
    // As the main walk (spec 10 ad): press "Pick up the letter" only where this build shows it.
    const first = await reachRecall(page);
    if (first === null) throw new Error("neither recall nor a pick-up button");
    if (first === "pickup") {
      await page.getByRole("button", { name: PICK_UP, exact: true }).click({ timeout: WAIT_MS });
      if (!(await waitForStage(page, "recall"))) throw new Error("recall not reached");
    }
    await sleep(1500);
    const problem = await answerAll(page, PERSONAS[0].answers(""));
    if (problem) throw new Error(problem);
    if (!(await waitForStage(page, "marks"))) throw new Error("marks not reached");
    await sleep(1500);
    const showAllControl = page.getByRole("button", { name: SHOW_ALL_LABEL }).or(page.getByRole("link", { name: SHOW_ALL_LABEL })).first();
    const label = (await showAllControl.textContent({ timeout: WAIT_MS }))?.trim() || SHOW_ALL;
    await showAllControl.click({ timeout: WAIT_MS });
    await guard(ctx, "N1", () => checkNumbersFocus(page, ctx, label));
  } catch (error) {
    ctx.rep.add("note", "N1", `"${SHOW_ALL}" or "Skip to the receipts" walk not finished: ${String(error.message ?? error).split("\n")[0]}`, "numbers-focus");
  } finally {
    await page.close();
  }
}

// W1.6 and W1.7 (spec 12 design.md "W1.6: viewport arithmetic") on /demo/live at
// the Write step. The phone field rule (PH1) runs through checkPhone. Failures are
// BLOCKERs, like the spec 08 checks: the Write step must fit the thresholds on every run.
async function checkWriteStep(page, ctx) {
  const r = await page.evaluate(WRITE_READ, WRITE_CARD);
  if (r.missing) {
    ctx.rep.add("note", "W1.6", `no Write card with a Letter_Field on /demo/live (${WRITE_CARD})`, "write-step");
    return;
  }
  const next = r.next ? `Next=${px(r.next.top)}..${px(r.next.bottom)} (note, not asserted)` : "Next not found (note)";
  ctx.rep.add("note", "W1.6", `${next} at ${ctx.size}`, "write-step");
  if (ctx.size === W16_SIZE) {
    const w16 = write16Failures(r);
    const detail = `W1.6 field=${px(r.field.top)}..${px(r.field.bottom)} lines=${r.field.linesInView} of ${r.field.lines} in view chips=${r.chips.count} inView=${r.chips.inView} threshold=field top in view, ${W16_LINES_DESKTOP} lines in view, chips in view`;
    ctx.rep.add(w16.length ? "blocker" : "ok", "W1.6", w16.length ? `${detail} (${w16.join("; ")})` : detail, "write-step");
  }
  if (ctx.size === W17_SIDEWAYS_SIZE) {
    const w17 = write17Failures(r);
    const detail = `W1.7 docScroll=${r.doc.scrollWidth}/${r.doc.clientWidth} cardScroll=${r.card.scrollWidth}/${r.card.clientWidth} viewport=${ctx.w}x${ctx.h} threshold=no sideways scroll at ${W17_SIDEWAYS_SIZE}`;
    ctx.rep.add(w17.length ? "blocker" : "ok", "W1.7", w17.length ? `${detail} (${w17.join("; ")})` : detail, "write-step");
  }
}

// W1.6 at 1440x900: the Letter_Field's top is in view, it shows W16_LINES_DESKTOP lines
// in view, and every Occasion chip is in view. Returns the failure reasons; an empty list
// passes. Pure, so unit tests use it without a browser.
export function write16Failures(r) {
  const out = [];
  if (!r.field.topInView) out.push(`Letter_Field top ${px(r.field.top)} is outside the window`);
  if (r.field.linesInView < W16_LINES_DESKTOP) out.push(`Letter_Field shows ${r.field.linesInView} lines in view, need ${W16_LINES_DESKTOP}`);
  if (!r.chips.inView) out.push(`Occasion chips ${r.chips.count ? `${px(r.chips.top)}..${px(r.chips.bottom)} are not all inside the window` : "not found"}`);
  return out;
}

// W1.7 at 360x640: the document and the Write card have no sideways scroll. Next is not
// asserted here; its bottom is printed as a note. Pure, like write16Failures.
export function write17Failures(r) {
  const out = [];
  if (r.doc.scrollWidth > r.doc.clientWidth) out.push(`document scrollWidth ${r.doc.scrollWidth}px > clientWidth ${r.doc.clientWidth}px`);
  if (r.card.scrollWidth > r.card.clientWidth) out.push(`Write card scrollWidth ${r.card.scrollWidth}px > clientWidth ${r.card.clientWidth}px`);
  return out;
}

// X1 on the other letter pages (R27.4). /l/[id] needs a sealed live letter, which
// this walk does not create, so it measures the page an unknown id renders.
async function otherPages(context, ctx) {
  for (const [stage, path, group] of [["live", "/demo/live", "live"], ["letter-page", "/l/layoutcheck-unknown-id", "letter-page"]]) {
    if (!sectionRuns({ group }, ctx.scope)) continue;
    ctx.rep.stage(stage);
    const page = await newPage(context);
    try {
      const res = await page.goto(`${ctx.base}${path}`, { waitUntil: "load" });
      await sleep(800);
      if (path.startsWith("/l/")) ctx.rep.add("note", "X1", `${path} answered HTTP ${res?.status() ?? "none"}; measured that page, not a live letter`, "scroll-width");
      await shot(page, ctx, stage);
      await guard(ctx, "X1", () => checkScrollWidth(page, ctx));
      await guard(ctx, "FT1", () => checkFooter(page, ctx));
      await guard(ctx, "NT1", () => checkNeutrality(page, ctx));
      if (path === LIVE_PATH) {
        await guard(ctx, "W1.6", () => checkWriteStep(page, ctx));
        // Only the steps before the first passkey prompt are reachable here.
        const step = await page.evaluate(() => document.querySelector("[data-live-step]")?.getAttribute("data-live-step") ?? null);
        ctx.rep.add(step ? "ok" : "note", "walk", step ? `/demo/live step "${step}" reached` : "no [data-live-step] on /demo/live");
      }
      await checkEveryPage(page, ctx, path, { fonts: true });
      if (path === LIVE_PATH) ctx.rep.add("note", "live", `not reached: ${LIVE_UNREACHED} (they need a passkey)`);
    } finally {
      await page.close();
    }
  }
}

// U9 (persona seal size): the sizes at which /demo is measured for the seal row. They are
// not in the walked sizes, so the row runs its own pass.
const U9_SIZES = ["1440x900", "390x844"];
const U9_SEAL_MIN_PX = 96;

// U9: a seal width passes at 96 px and above. Pure, so unit tests use it without a browser.
export function sealWidthOk(width) {
  return width >= U9_SEAL_MIN_PX;
}

// U9: the inner rect sits inside the outer rect, within half a pixel of rounding.
// Pure, so unit tests use it without a browser.
export function rectInside(inner, outer) {
  return inner.left >= outer.left - 0.5 && inner.top >= outer.top - 0.5 && inner.right <= outer.right + 0.5 && inner.bottom <= outer.bottom + 0.5;
}

// U9: the verdict for the measured seals and page widths. Each seal is { width, rect, card }
// and card is the containing card's rect, or null when there is none. Pure.
export function personaSealVerdict({ seals, scrollWidth, clientWidth }) {
  const problems = [];
  seals.forEach((s, i) => {
    if (!sealWidthOk(s.width)) problems.push(`seal ${i + 1} is ${s.width.toFixed(1)}px wide, narrower than ${U9_SEAL_MIN_PX}px`);
    if (!s.card || !rectInside(s.rect, s.card)) problems.push(`seal ${i + 1} is not inside its card`);
  });
  if (scrollWidth > clientWidth) problems.push(`the page scrolls sideways (scrollWidth ${scrollWidth}px, clientWidth ${clientWidth}px)`);
  return { count: seals.length, problems, ok: seals.length > 0 && problems.length === 0 };
}

// U9: every [data-persona-seal] with its box and its containing card (the persona link),
// and the page widths.
const U9_READ = () => {
  const rect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    seals: [...document.querySelectorAll("[data-persona-seal]")].map((el) => {
      const r = el.getBoundingClientRect();
      const card = el.closest("a") ?? el.parentElement;
      return { width: r.width, rect: rect(r), card: card ? rect(card.getBoundingClientRect()) : null };
    }),
  };
};

async function checkPersonaSealRow(browser, base, size, rep, required) {
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: null, required, memo: {}, ghostHook: false };
  rep.setContext(ctx);
  rep.log(`\n==== ${size} (U9) ====`);
  try {
    rep.stage("demo-seals");
    const page = await newPage(context);
    try {
      const res = await page.goto(`${base}/demo`, { waitUntil: "load" });
      if (!res || res.status() !== 200) {
        rep.add("note", "U9", `/demo answered HTTP ${res?.status() ?? "none"}; seal row not measured`, "persona-seal-size");
        return;
      }
      await sleep(800);
      const r = await page.evaluate(U9_READ);
      if (r.seals.length === 0) {
        rep.add("note", "U9", `no [data-persona-seal] on /demo at ${size}`, "persona-seal-size");
        return;
      }
      const verdict = personaSealVerdict(r);
      const widths = r.seals.map((s) => `${s.width.toFixed(1)}px`).join(" ");
      const detail = `seals=${verdict.count} widths=${widths} viewport=${size} threshold=width>=${U9_SEAL_MIN_PX}px, inside its card, no sideways scroll${verdict.problems.length ? ` (${verdict.problems.join("; ")})` : ""}`;
      rep.add(verdict.ok ? "ok" : "blocker", "U9", detail, "persona-seal-size");
    } finally {
      await page.close();
    }
  } catch (error) {
    rep.add("note", "U9", `could not run: ${String(error.message ?? error).split("\n")[0]}`, "persona-seal-size");
  } finally {
    await context.close();
  }
}

// U8 (spec 13 U8.1 to U8.3), LS1 (spec 13 L1.1 to L1.3) and P1 (spec 13 P1.1 to P1.4).
// Each failure message names its requirement ID. The minimums are set for the two
// Evidence_Sizes only; other sizes get no row.
const SEAL_MIN_PX = { 1440: 160, 390: 120 };
const PRESS_MIN_PX = 44;
// Shorter than SEAL_PRESS_HOLD_MS (at least 600 ms, spec 13 P2.1), so the release
// before full progress starts no passkey prompt and sends nothing (spec 13 P2.4).
const P1_HOLD_PROBE_MS = 250;
const P1_LIVE_TEXT = "Layout check: one sentence, typed in the browser and never sent.";
const P1_WARNING_START = "A lost or deleted passkey means";
const P1_MAX_NEXT_PRESSES = 4;

// The minimum seal or landing seal width in CSS px, or null at a size these rows do not measure.
export function sealMinPx(width) {
  return SEAL_MIN_PX[width] ?? null;
}

// The rect lies inside the viewport, within half a pixel of rounding. Pure.
export function rectInViewport(rect, w, h) {
  return rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= w + 0.5 && rect.bottom <= h + 0.5;
}

// Two rects match within half a pixel on every edge. Pure.
export function rectsSame(a, b) {
  if (!a || !b) return false;
  return ["left", "top", "right", "bottom"].every((k) => Math.abs(a[k] - b[k]) <= 0.5);
}

// U8: the seal at Break the seal. seal is { width, left, top, right, bottom } or null;
// hold is the rect of the Break the seal hold control, or null when it is not on the page;
// skips is a list of rects for Skip controls. Returns the failure reasons; an empty list
// passes. Pure, so unit tests use it without a browser.
export function u8Failures(args) {
  const { seal, hold, skips, minWidth, w, h } = args;
  if (!seal) return ["U8.3 no [data-seal-target] svg to measure"];
  const out = [];
  if (seal.width < minWidth) out.push(`U8.3 (U8.1) seal is ${seal.width.toFixed(1)}px across, need ${minWidth}px`);
  if (!rectInViewport(seal, w, h)) out.push("U8.2 seal is not inside the viewport");
  if (hold && !rectInViewport(hold, w, h)) out.push("U8.2 Break the seal hold control is not inside the viewport");
  for (const s of skips) {
    if (!rectInViewport(s, w, h)) out.push("U8.2 Skip control is not inside the viewport");
  }
  return out;
}

// LS1: the landing seal and the hero's h1 and primary call to action. Returns the failure
// reasons; an empty list passes. Pure, so unit tests use it without a browser.
export function landingSealFailures({ seal, h1, cta, minWidth, w, h }) {
  if (!seal) return ["L1.2 no [data-landing-seal] to measure"];
  const out = [];
  if (seal.width < minWidth) out.push(`L1.2 landing seal is ${seal.width.toFixed(1)}px across, need ${minWidth}px`);
  if (!rectInViewport(seal, w, h)) out.push("L1.1 landing seal is not inside the First_Viewport");
  if (!h1 || !rectInViewport(h1, w, h)) out.push("L1.3 h1 is not inside the First_Viewport");
  if (!cta || !rectInViewport(cta, w, h)) out.push("L1.3 primary call to action is not inside the First_Viewport");
  return out;
}

// P1: the seal step's measurements. Returns the failure reasons; an empty list passes. Pure.
// accentCount is every orange control on the step, the Press_Envelope included. sealButtonIsAccent
// is true when the Seal_Button is orange and inside [data-press-column], so one more orange control
// is allowed. Without a Seal_Button, one orange control (the press) is expected.
export function p1Failures({ largestIsPress, press, accentCount, pressIsAccent, sealButtonIsAccent = false, warningBefore, warningDuring }) {
  const out = [];
  if (!largestIsPress) out.push("P1.1 the Press_Envelope is not the largest element on the step");
  if (!press || press.tag !== "BUTTON" || press.width < PRESS_MIN_PX || press.height < PRESS_MIN_PX) {
    const size = press ? `${press.width.toFixed(0)}x${press.height.toFixed(0)}px on a ${press.tag}` : "missing";
    out.push(`P1.2 Press_Envelope hit area is ${size}, need a focusable button of at least ${PRESS_MIN_PX}x${PRESS_MIN_PX}px`);
  }
  const allowed = sealButtonIsAccent ? 2 : 1;
  if (accentCount !== allowed || !pressIsAccent) {
    out.push(`P1.3 ${accentCount} orange control(s), need ${allowed}: the Press_Envelope alone, or the Press_Envelope plus one Seal_Button inside [data-press-column]`);
  }
  if (!warningBefore || !warningDuring) out.push("P1.4 Warning_Text not found before or during the hold");
  else if (!rectsSame(warningBefore, warningDuring)) out.push("P1.4 Warning_Text moved during the hold");
  return out;
}

// U8: the seal's rect, the Break the seal hold control ([data-seal-button], the one
// the reader holds in SealBreak.tsx) and every visible Skip control, in the page.
const U8_READ = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
  };
  const seal = document.querySelector("[data-seal-target] svg");
  const hold = document.querySelector("[data-seal-button]");
  const skips = [...document.querySelectorAll("button, a")]
    .filter((el) => /^Skip\b/.test((el.textContent || "").trim()) && el.getClientRects().length > 0)
    .map(box);
  return { seal: seal ? box(seal) : null, hold: hold ? box(hold) : null, skips };
};

// LS1: the landing seal, h1 and primary call to action, in the page.
const LS1_READ = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width };
  };
  const seal = document.querySelector("[data-landing-seal]");
  const h1 = document.querySelector("h1");
  const cta = document.querySelector('[data-cta="primary"]');
  return { seal: seal ? box(seal) : null, h1: h1 ? box(h1) : null, cta: cta ? box(cta) : null };
};

// P1: the seal step of /demo/live. The Press_Envelope is the button with data-seal-pose.
// Orange means the --wax or --accent token, read from the background or border colour of a
// control or of one of its descendants. Largest means the largest visible leaf (or the
// press itself), so a wrapper box never counts.
const P1_READ = () => {
  // data-live-step holds the seal state tag (editing, sealed...), never "seal"; the step is [data-seal-step].
  const step = document.querySelector("[data-seal-step]");
  if (!step) return { missing: true };
  const press = step.querySelector("button[data-seal-pose]");
  if (!press) return { missing: true };
  const visible = (el) => el.getClientRects().length > 0;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  };
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const rgbOf = (value) => {
    probe.style.color = "";
    probe.style.color = value;
    return probe.style.color === "" ? null : getComputedStyle(probe).color;
  };
  const root = getComputedStyle(document.documentElement);
  const accents = ["--wax", "--accent"].map((name) => root.getPropertyValue(name).trim()).filter(Boolean).map(rgbOf).filter(Boolean);
  probe.remove();
  const orange = (el) => {
    const cs = getComputedStyle(el);
    return accents.includes(cs.backgroundColor) || accents.includes(cs.borderTopColor);
  };
  const controls = [...step.querySelectorAll("button, a, input, select, textarea")].filter(visible);
  const accentControls = controls.filter((el) => orange(el) || [...el.querySelectorAll("*")].some(orange));
  // The Seal_Button counts as an allowed orange control only when it sits inside the press column.
  const sealEl = step.querySelector("[data-seal-button]");
  const sealInColumn = !!sealEl && !!sealEl.closest("[data-press-column]");
  const sealButtonIsAccent = sealInColumn && (orange(sealEl) || [...sealEl.querySelectorAll("*")].some(orange));
  const isLeaf = (el) => [...el.children].every((c) => !visible(c));
  const candidates = [press, ...[...step.querySelectorAll("*")].filter((el) => el !== press && !press.contains(el) && !el.contains(press) && visible(el) && isLeaf(el))];
  let largest = { el: null, area: -1 };
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > largest.area) largest = { el, area };
  }
  return {
    missing: false,
    accentTokens: accents.length,
    largestIsPress: largest.el === press,
    largest: largest.el ? box(largest.el) : null,
    press: box(press),
    accentCount: accentControls.length,
    pressIsAccent: accentControls.includes(press),
    sealButtonIsAccent,
  };
};

// P1: the Warning_Text box on the seal step, or null when it is not there.
const P1_WARNING = (start) => {
  const p = [...document.querySelectorAll("[data-seal-step] p")].find((el) => (el.textContent || "").trim().startsWith(start));
  if (!p) return null;
  const r = p.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
};

async function checkBreakSeal(page, ctx) {
  const minWidth = sealMinPx(ctx.w);
  if (minWidth === null) return;
  const r = await page.evaluate(U8_READ);
  if (!r.seal) {
    report(ctx, result("U8", "break-seal-size", "missing", "not on this build: no [data-seal-target] svg"));
    return;
  }
  const problems = u8Failures({ seal: r.seal, hold: r.hold, skips: r.skips, minWidth, w: ctx.w, h: ctx.h });
  const detail = `width=${r.seal.width.toFixed(1)}px viewport=${ctx.size} threshold=width>=${minWidth}px (U8.1), seal, Break the seal control and Skip inside the viewport${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("U8", "break-seal-size", problems.length ? "fail" : "pass", detail));
}

async function checkLandingSeal(page, ctx) {
  const minWidth = sealMinPx(ctx.w);
  if (minWidth === null) return;
  const r = await page.evaluate(LS1_READ);
  if (!r.seal) {
    report(ctx, result("LS1", "landing-seal", "missing", "not on this build: no [data-landing-seal]"));
    return;
  }
  const problems = landingSealFailures({ seal: r.seal, h1: r.h1, cta: r.cta, minWidth, w: ctx.w, h: ctx.h });
  const detail = `width=${r.seal.width.toFixed(1)}px viewport=${ctx.size} threshold=width>=${minWidth}px (L1.2), seal, h1 and primary call to action inside the First_Viewport (L1.1, L1.3)${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("LS1", "landing-seal", problems.length ? "fail" : "pass", detail));
}

// P1: a fresh /demo/live, the text typed and Next pressed until the seal step, then one
// short hold on the Press_Envelope that is released before full progress.
async function checkPressEnvelope(context, ctx) {
  if (sealMinPx(ctx.w) === null) return;
  const page = await newPage(context);
  try {
    const res = await page.goto(`${ctx.base}/demo/live`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      report(ctx, result("P1", "press-envelope", "missing", `/demo/live answered HTTP ${res?.status() ?? "none"}; Press_Envelope not measured`));
      return;
    }
    if (await present(page.locator("textarea"))) await page.locator("textarea").first().fill(P1_LIVE_TEXT).catch(() => {});
    await guard(ctx, "W", () => checkWriteRow(page, ctx));
    // The question answers must be filled before the Write step lets the letter fold.
    const answers = page.locator("[data-answer-input]");
    const texts = fillAnswerTexts(await answers.count());
    for (let i = 0; i < texts.length; i += 1) await answers.nth(i).fill(texts[i]).catch(() => {});
    const next = page.getByRole("button", { name: "Next", exact: true }).first();
    // W8 runs after every step press, so each step change gets its own heading row (W8.2).
    let measured = false;
    for (let i = 0; i < P1_MAX_NEXT_PRESSES; i += 1) {
      if ((await page.locator("[data-seal-step]").count()) > 0) break;
      // Spec 14 replaced Next on the Write desk with the fold button; press it when there is no Next.
      if (await present(next, 500)) await next.click({ timeout: 10_000 }).catch(() => {});
      else await clickIfPresent(page.locator("[data-fold-button]").first());
      await sleep(800);
      await guard(ctx, "W8", () => checkHeadingOffset(page, ctx, `Next press ${i + 1}`));
      measured = true;
    }
    // The page already on the seal step before any press: measure it once.
    if (!measured) await guard(ctx, "W8", () => checkHeadingOffset(page, ctx, "page load on the seal step"));
    await sleep(800);
    await guard(ctx, "T1", () => checkLiveStages(page, ctx));
    const r = await page.evaluate(P1_READ);
    if (r.missing) {
      report(ctx, result("P1", "press-envelope", "missing", "not on this build: no Press_Envelope on the seal step of /demo/live"));
      return;
    }
    if (r.accentTokens === 0) {
      report(ctx, result("P1", "press-envelope", "missing", "no --wax or --accent token on this build; the orange count cannot run"));
      return;
    }
    const before = await page.evaluate(P1_WARNING, P1_WARNING_START);
    let during = null;
    await page.mouse.move(r.press.cx, r.press.cy);
    await page.mouse.down();
    try {
      await sleep(P1_HOLD_PROBE_MS);
      during = await page.evaluate(P1_WARNING, P1_WARNING_START);
    } finally {
      await page.mouse.up();
    }
    await sleep(400);
    const problems = p1Failures({ largestIsPress: r.largestIsPress, press: r.press, accentCount: r.accentCount, pressIsAccent: r.pressIsAccent, sealButtonIsAccent: r.sealButtonIsAccent, warningBefore: before, warningDuring: during });
    const largest = r.largest ? `${r.largest.tag} ${r.largest.width.toFixed(0)}x${r.largest.height.toFixed(0)}` : "none";
    const detail = `largest=${largest} press=${r.press.width.toFixed(0)}x${r.press.height.toFixed(0)}px accent=${r.accentCount} warningTop=${before ? before.top.toFixed(1) : "n/a"}->${during ? during.top.toFixed(1) : "n/a"} viewport=${ctx.size} threshold=press largest, 44x44 px focusable, Press_Envelope and at most one Seal_Button inside [data-press-column] orange, Warning_Text unchanged in a ${P1_HOLD_PROBE_MS} ms hold${problems.length ? ` (${problems.join("; ")})` : ""}`;
    report(ctx, result("P1", "press-envelope", problems.length ? "fail" : "pass", detail));
  } finally {
    await page.close();
  }
}

// T1, TG2, W, W8, LF1, LF2, F3 and F4 (spec 13 groups T, W, F). Each failure message names
// its requirement ID. The pure verdicts below are exported for unit tests; the readers run in
// the page and the checks report one row each. Rows the walk cannot reach (the Wait and live
// Remember steps need a passkey seal) report missing.
const WIDE_MIN_PX = 900; // the desktop rules apply at this width and wider (1440 is measured)
const TOP_BAR_GAP_PX = 16;
const LF_SIZES = [H27_SIZE, "390x844"];

// Two rects overlap by more than half a pixel on both axes. Pure.
export function rectsIntersect(a, b) {
  if (!a || !b) return false;
  return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
}

// T1 (T1.2, T1.3): the envelope view and the countdown inside the First_Viewport, and the
// Keep_Section top at or below the view's bottom edge. Pure.
export function t1Failures({ view, countdown, keep, w, h }) {
  if (!view) return ["T1.2 no [data-sealed-envelope-view] to measure"];
  const out = [];
  if (!rectInViewport(view, w, h)) out.push("T1.2 Sealed_Envelope_View is not inside the First_Viewport");
  if (!countdown || !rectInViewport(countdown, w, h)) out.push("T1.2 countdown is not inside the First_Viewport");
  if (!keep) out.push("T1.3 no [data-live-keep-section] to measure");
  else if (keep.top < view.bottom - 0.5) {
    out.push(`T1.3 Keep_Section top ${keep.top.toFixed(1)}px is above the view bottom ${view.bottom.toFixed(1)}px`);
  }
  return out;
}

// TG2 (T2.2): the risen ghost's box does not intersect the Keep_Section. Pure.
export function tg2Failures({ ghost, keep }) {
  return rectsIntersect(ghost, keep) ? ["T2.2 the risen ghost intersects the Keep_Section"] : [];
}

// W (W1.3, W4.4). Desktop rules apply at WIDE_MIN_PX and wider; the phone rules apply below it.
// Rows are { height, lineHeight, padY } and a row's line limit is maxLines * lineHeight + padY.
// W1.3 and W4.4 (spec 13). The column and paper widths (now W1 and W4), the Occasion heights
// (now W3) and the receipt row heights (now W11 and W12) were retired from this check. Pure.
export function wFailures({ w, h, field, questions }) {
  if (!field) return ["W1.3 no Letter_Field (#live-letter) to measure"];
  const out = [];
  const desktop = w >= WIDE_MIN_PX;
  if (desktop) {
    if (field.top > 360 + 0.5) out.push(`W1.3 Letter_Field top is ${field.top.toFixed(0)}px from the top, need at most 360px`);
  } else if (field.top < 0 || field.top >= h) {
    out.push("W1.3 Letter_Field top is outside the First_Viewport");
  }
  if (desktop) {
    questions.forEach((q, i) => {
      const max = 2 * q.lineHeight + q.padY;
      if (q.height > max + 0.5) out.push(`W4.4 question row ${i + 1} is ${q.height.toFixed(0)}px tall, need at most two lines (${max.toFixed(0)}px)`);
    });
  }
  return out;
}

// W8 (W8.2): the Step_Heading's box starts at least 16 px below the Top_Bar's bottom edge.
// The caller reports a missing Top_Bar as a note before this runs. Pure.
export function w8Failures({ heading, topBarBottom }) {
  if (!heading) return ["W8.2 no step heading to measure"];
  if (topBarBottom === null) return [];
  const gap = heading.top - topBarBottom;
  return gap >= TOP_BAR_GAP_PX ? [] : [`W8.2 step heading top is ${gap.toFixed(1)}px below the Top_Bar, need at least ${TOP_BAR_GAP_PX}px`];
}

// LF1 (F1.4): each landing section has content reaching past 60 % of its content box, so its
// right 40 % is not empty. Sections are { name, left, width, leafRights }. Pure.
export function lf1Failures(sections) {
  return sections.flatMap((s) => {
    const edge = s.left + 0.6 * s.width;
    if (s.leafRights.some((right) => right > edge)) return [];
    return [`F1.4 ${s.name} has no content in its right 40% (content box ${s.left.toFixed(0)}..${(s.left + s.width).toFixed(0)}px)`];
  });
}

// LF2 (F2.1 to F2.3): the ritual cards. Wide: 24 px padding, 200 px text width, 24 px between
// cards, 16 px body text at line height 1.5. Phone: one column, 20 px padding. Cards are
// { left, top, right, bottom, padding, textWidth, fontSize, lineHeight, clipped }. Pure.
export function lf2Failures({ items, w }) {
  const out = [];
  const wide = w >= WIDE_MIN_PX;
  const minPad = wide ? 24 : 20;
  items.forEach((c, i) => {
    const n = i + 1;
    if (c.padding < minPad - 0.5) out.push(`${wide ? "F2.1" : "F2.2"} card ${n} padding is ${c.padding.toFixed(0)}px, need at least ${minPad}px`);
    if (c.clipped) out.push(`F2.3 card ${n} clips its text`);
    if (wide) {
      if (c.textWidth < 200 - 0.5) out.push(`F2.1 card ${n} text width is ${c.textWidth.toFixed(0)}px, need at least 200px`);
      if (c.fontSize < 16 - 0.01 || c.lineHeight < 1.5 * c.fontSize - 0.01) {
        out.push(`F2.1 card ${n} body text is ${c.fontSize.toFixed(1)}px at line height ${c.lineHeight.toFixed(1)}px, need 16px at 1.5`);
      }
    }
  });
  if (wide) {
    for (let a = 0; a < items.length; a += 1) {
      for (let b = a + 1; b < items.length; b += 1) {
        const A = items[a];
        const B = items[b];
        const gap = Math.max(A.left - B.right, B.left - A.right, A.top - B.bottom, B.top - A.bottom);
        if (gap < 24 - 0.5) out.push(`F2.1 cards ${a + 1} and ${b + 1} are ${gap.toFixed(0)}px apart, need at least 24px`);
      }
    }
  } else if (items.some((c) => Math.abs(c.left - items[0].left) > 0.5)) {
    out.push("F2.2 ritual cards are not stacked in one column");
  }
  return out;
}

// F3 (F3.1, F3.2) on the persona Remember step at 1440x900. The fictional notice does not
// overlap a Step_Indicator label; the question, the answer control and the control to go on lie
// inside the viewport. A null answer or continue control is skipped.
// F3.4 (the notice count) was retired: B1.4 checks that the element whose text equals
// personaNoticeText is shown once, inside the Top_Bar. Pure.
export function f3Failures({ w, h, notice, labels, question, answer, cont }) {
  const out = [];
  if (notice && labels.some((l) => rectsIntersect(notice, l))) {
    out.push("F3.1 the fictional notice overlaps a Step_Indicator label");
  }
  if (!question) out.push("F3.2 no question heading to measure");
  else if (!rectInViewport(question, w, h)) out.push("F3.2 question is not inside the First_Viewport");
  if (answer && !rectInViewport(answer, w, h)) out.push("F3.2 answer control is not inside the First_Viewport");
  if (cont && !rectInViewport(cont, w, h)) out.push("F3.2 control to go on is not inside the First_Viewport");
  return out;
}

// F4 (F4.1 to F4.3) on the live Remember step. The Ghost is drawn inside the viewport, the verdict
// line starts 16 px below the Top_Bar, and the Ghost covers neither the question, the answer
// control nor the verdict. others is a list of [name, rect] pairs; null rects are skipped. Pure.
export function f4Failures({ w, h, ghost, topBarBottom, verdict, others }) {
  if (!ghost) return ["F4.1 no Ghost drawn on the live Remember step"];
  const out = [];
  if (!rectInViewport(ghost, w, h)) out.push("F4.1 the Ghost is not inside the First_Viewport");
  if (verdict && topBarBottom !== null && verdict.top - topBarBottom < TOP_BAR_GAP_PX - 0.5) {
    out.push(`F4.2 verdict line starts ${(verdict.top - topBarBottom).toFixed(1)}px below the Top_Bar, need at least ${TOP_BAR_GAP_PX}px`);
  }
  for (const [name, rect] of others) {
    if (rectsIntersect(ghost, rect)) out.push(`F4.3 the Ghost covers the ${name}`);
  }
  return out;
}

// W: the Write step's Letter_Field, column, paper, Occasion controls, question rows and receipt
// rows, read in the page. Missing when there is no #live-letter.
const W_READ = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const visible = (el) => el.getClientRects().length > 0;
  const rowMetrics = (el) => {
    const cs = getComputedStyle(el);
    const line = el.querySelector("textarea, p, span") || el;
    const lcs = getComputedStyle(line);
    const fontSize = parseFloat(lcs.fontSize) || 16;
    const lineHeight = parseFloat(lcs.lineHeight) || fontSize * 1.2;
    const padY = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"].reduce((s, k) => s + (parseFloat(cs[k]) || 0), 0);
    return { height: el.getBoundingClientRect().height, lineHeight, padY };
  };
  const field = document.querySelector("textarea#live-letter");
  if (!field) return { missing: true };
  return {
    missing: false,
    field: box(field),
    questions: [...document.querySelectorAll('[class*="questionRow"]')].filter(visible).map(rowMetrics),
  };
};

// W8: the Step_Heading after a step change, and the Top_Bar's bottom edge when the bar is shown.
const W8_READ = () => {
  const heading = document.querySelector("[data-live-stepper] h2");
  if (!heading || heading.getClientRects().length === 0) return { missing: true };
  const bar = document.querySelector("[data-topbar]");
  const barShown = bar !== null && bar.getClientRects().length > 0;
  return {
    missing: false,
    step: document.querySelector("[data-live-step]")?.getAttribute("data-live-step") ?? "none",
    heading: { top: heading.getBoundingClientRect().top },
    topBarBottom: barShown ? bar.getBoundingClientRect().bottom : null,
  };
};

// LF1: the landing sections that have an h2 (the hero is excluded), with the content box and
// the right edge of each visible content element.
const LF1_READ = () => {
  const visible = (el) => el.getClientRects().length > 0;
  return [...document.querySelectorAll("section")]
    .filter((s) => visible(s) && !s.hasAttribute("data-landing-hero") && s.querySelector("h2"))
    .map((s) => {
      const r = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      const pl = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.borderLeftWidth) || 0);
      const pr = (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const leafRights = [...s.querySelectorAll("p, h1, h2, h3, li, svg, img, figure, blockquote")]
        .filter(visible)
        .map((el) => el.getBoundingClientRect())
        .filter((q) => q.width > 0 && q.height > 0)
        .map((q) => q.right);
      return {
        name: (s.querySelector("h2").textContent || "").trim().slice(0, 30),
        left: r.left + pl,
        width: r.width - pl - pr,
        leafRights,
      };
    });
};

// LF2: the ritual cards on /, with their boxes, padding, text width, body text and clipping.
const LF2_READ = () => {
  const list = document.querySelector('[data-block="ritual"]');
  if (!list) return { missing: true };
  const items = [...list.children]
    .filter((el) => el.tagName === "LI" && el.getClientRects().length > 0)
    .map((li) => {
      const r = li.getBoundingClientRect();
      const cs = getComputedStyle(li);
      const pl = parseFloat(cs.paddingLeft) || 0;
      const pr = parseFloat(cs.paddingRight) || 0;
      const edges = pl + pr + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      const text = li.querySelector("p") ?? li;
      const tcs = getComputedStyle(text);
      const fontSize = parseFloat(tcs.fontSize) || 0;
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        padding: Math.min(pl, pr),
        textWidth: r.width - edges,
        fontSize,
        lineHeight: parseFloat(tcs.lineHeight) || fontSize * 1.2,
        clipped: li.scrollWidth > li.clientWidth + 1 || text.scrollWidth > text.clientWidth + 1,
      };
    });
  if (!items.length) return { missing: true };
  return { missing: false, items };
};

// F3: the persona Remember step. The notice is the first visible paragraph that says it is
// fictional. The control to go on is the last visible button.
const F3_READ = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const visible = (el) => el.getClientRects().length > 0;
  const fictional = [...document.querySelectorAll("p")].filter((p) => visible(p) && (p.textContent || "").includes("is fictional"));
  const question = document.querySelector("[data-stage-heading]");
  const answer = [...document.querySelectorAll("[data-recall-reader] textarea, [data-recall-reader] input")].find(visible);
  const buttons = [...document.querySelectorAll("button")].filter(visible);
  const cont = buttons.length ? buttons[buttons.length - 1] : null;
  return {
    notice: fictional.length ? box(fictional[0]) : null,
    labels: [...document.querySelectorAll("[data-step-indicator] li")].filter(visible).map(box),
    question: question && visible(question) ? box(question) : null,
    answer: answer ? box(answer) : null,
    cont: cont ? box(cont) : null,
    contText: cont ? (cont.textContent || "").trim().slice(0, 40) : "",
  };
};

// T1, TG2 and F4: the Wait step and the live Remember step. Both exist only after a passkey
// seal, so a page without them returns null for each.
const LIVE_STAGE_READ = () => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const visible = (el) => el.getClientRects().length > 0;
  const first = (sel) => {
    const el = document.querySelector(sel);
    return el && visible(el) ? el : null;
  };
  const bar = first("[data-topbar]");
  const topBarBottom = bar ? bar.getBoundingClientRect().bottom : null;
  const countdown = first('[data-live-countdown="ticking"]');
  const view = first("[data-sealed-envelope-view]");
  const heldGhost = document.querySelector("[data-held-ghost] svg, [data-live-ghost-layer] svg");
  const keep = first("[data-live-keep-section]");
  const testify = first("[data-live-testify-ghost]");
  const verdict = [...document.querySelectorAll("p")].find((p) => visible(p) && (p.textContent || "").trim().startsWith("The seal is intact"));
  const question = first("[data-stage-heading]");
  const answer = first("textarea");
  return {
    topBarBottom,
    wait: countdown && view
      ? {
          view: box(view),
          countdown: box(countdown),
          keep: keep ? box(keep) : null,
          ghost: heldGhost && visible(heldGhost) ? box(heldGhost) : null,
        }
      : null,
    testify: testify
      ? {
          ghost: box(testify),
          verdict: verdict ? box(verdict) : null,
          question: question ? box(question) : null,
          answer: answer ? box(answer) : null,
        }
      : null,
  };
};

async function checkWriteRow(page, ctx) {
  const r = await page.evaluate(W_READ);
  if (r.missing) {
    report(ctx, result("W", "write-step", "missing", "not on this build: no #live-letter on the Write step"));
    return;
  }
  const problems = wFailures({ w: ctx.w, h: ctx.h, ...r });
  const desktop = ctx.w >= WIDE_MIN_PX;
  const detail = `field top=${px(r.field.top)} questions=${r.questions.length} viewport=${ctx.size} threshold=${desktop ? "field top at most 360px, question rows at most two lines" : "field top inside the viewport"}${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("W", "write-step", problems.length ? "fail" : "pass", detail));
}

// W8 row for one step change. `label` says which Next press produced the change; `r` is the
// W8_READ result. Pure, so the per-step detail and the W8.2 failure text can be unit tested.
export function w8Row({ label, viewport, r }) {
  const where = `after ${label}`;
  if (r.missing) {
    return result("W8", "heading-offset", "missing", `${where}: not on this build: no [data-live-stepper] heading after the step change`);
  }
  if (r.topBarBottom === null) {
    return result("W8", "heading-offset", "missing", `${where} step=${r.step}: not on this build: no [data-topbar] to measure the heading against`);
  }
  const problems = w8Failures({ heading: r.heading, topBarBottom: r.topBarBottom });
  const gap = r.heading.top - r.topBarBottom;
  const detail = `${where} step=${r.step} heading top=${px(r.heading.top)} topBarBottom=${px(r.topBarBottom)} gap=${gap.toFixed(1)}px viewport=${viewport} threshold=heading at least ${TOP_BAR_GAP_PX}px below the Top_Bar after a step change${problems.length ? ` (${problems.join("; ")})` : ""}`;
  return result("W8", "heading-offset", problems.length ? "fail" : "pass", detail);
}

async function checkHeadingOffset(page, ctx, label = "the step change") {
  const r = await page.evaluate(W8_READ);
  report(ctx, w8Row({ label, viewport: ctx.size, r }));
}

// T1, TG2 and F4 need the Wait and live Remember steps, which come after a passkey seal. This
// check reads them if the page is there and reports missing otherwise (Live_Walk measures them).
async function checkLiveStages(page, ctx) {
  const r = await page.evaluate(LIVE_STAGE_READ);
  const unreached = "not reached: the Wait and live Remember steps come after a passkey seal, which this check does not make; Live_Walk measures them";
  if (!r.wait) {
    report(ctx, result("T1", "wait-envelope", "missing", unreached));
    report(ctx, result("TG2", "wait-ghost", "missing", unreached));
  } else {
    const { view, countdown, keep, ghost } = r.wait;
    const problems = t1Failures({ view, countdown, keep, w: ctx.w, h: ctx.h });
    const keepTop = keep ? px(keep.top) : "n/a";
    const detail = `view=${px(view.top)}..${px(view.bottom)} countdown=${px(countdown.top)}..${px(countdown.bottom)} keep top=${keepTop} viewport=${ctx.size} threshold=view and countdown inside the First_Viewport, Keep_Section top at or below the view bottom${problems.length ? ` (${problems.join("; ")})` : ""}`;
    report(ctx, result("T1", "wait-envelope", problems.length ? "fail" : "pass", detail));
    if (!ghost) {
      report(ctx, result("TG2", "wait-ghost", "missing", "no ghost drawn on the Wait step to measure"));
    } else {
      const ghostProblems = tg2Failures({ ghost, keep });
      report(ctx, result("TG2", "wait-ghost", ghostProblems.length ? "fail" : "pass", `ghost=${px(ghost.top)}..${px(ghost.bottom)} keep top=${keepTop} viewport=${ctx.size} threshold=ghost box does not intersect the Keep_Section${ghostProblems.length ? ` (${ghostProblems.join("; ")})` : ""}`));
    }
  }
  if (!r.testify) {
    report(ctx, result("F4", "live-remember", "missing", unreached));
    return;
  }
  const { ghost, verdict, question, answer } = r.testify;
  const problems = f4Failures({
    w: ctx.w,
    h: ctx.h,
    ghost,
    topBarBottom: r.topBarBottom,
    verdict,
    others: [["question", question], ["answer control", answer], ["verdict line", verdict]],
  });
  const detail = `ghost=${px(ghost.top)}..${px(ghost.bottom)} verdict top=${verdict ? px(verdict.top) : "n/a"} topBarBottom=${r.topBarBottom === null ? "n/a" : px(r.topBarBottom)} viewport=${ctx.size} threshold=Ghost inside the viewport, verdict at least 16px below the Top_Bar, Ghost clear of question, answer and verdict${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("F4", "live-remember", problems.length ? "fail" : "pass", detail));
}

async function checkLandingHalves(page, ctx) {
  if (ctx.size !== H27_SIZE) return;
  const sections = await page.evaluate(LF1_READ);
  if (!sections.length) {
    report(ctx, result("LF1", "landing-halves", "missing", "no landing section with an h2 on / to measure"));
    return;
  }
  const problems = lf1Failures(sections);
  const parts = sections.map((s) => `${s.name}=${px(s.left)}..${px(s.left + s.width)}`);
  const detail = `${parts.join(" ")} viewport=${ctx.size} threshold=content reaches past 60% of each section's content box${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("LF1", "landing-halves", problems.length ? "fail" : "pass", detail));
}

async function checkRitualCards(page, ctx) {
  if (!LF_SIZES.includes(ctx.size)) return;
  const r = await page.evaluate(LF2_READ);
  if (r.missing) {
    report(ctx, result("LF2", "ritual-cards", "missing", "not on this build: no [data-block=\"ritual\"] cards on /"));
    return;
  }
  const problems = lf2Failures({ items: r.items, w: ctx.w });
  const cards = r.items.map((c, i) => `card${i + 1}=pad ${px(c.padding)} text ${px(c.textWidth)} body ${c.fontSize.toFixed(0)}px/${c.lineHeight.toFixed(0)}px`);
  const threshold = ctx.w >= WIDE_MIN_PX
    ? "24px padding, 200px text width, 24px between cards, 16px body text at 1.5"
    : "one column, 20px padding, no clipped text";
  const detail = `${cards.join(" ")} viewport=${ctx.size} threshold=${threshold}${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("LF2", "ritual-cards", problems.length ? "fail" : "pass", detail));
}

async function checkPersonaTestify(page, ctx) {
  if (ctx.size !== H27_SIZE) return;
  const r = await page.evaluate(F3_READ);
  if (!r.notice) {
    report(ctx, result("F3", "persona-remember", "missing", "no fictional notice on the Remember step to measure"));
    return;
  }
  const problems = f3Failures({ w: ctx.w, h: ctx.h, notice: r.notice, labels: r.labels, question: r.question, answer: r.answer, cont: r.cont });
  const detail = `notice=${px(r.notice.top)}..${px(r.notice.bottom)} labels=${r.labels.length} question=${r.question ? px(r.question.bottom) : "n/a"} continue="${r.contText}" viewport=${ctx.size} threshold=notice clear of the step labels, question, answer and continue control inside the viewport${problems.length ? ` (${problems.join("; ")})` : ""}`;
  report(ctx, result("F3", "persona-remember", problems.length ? "fail" : "pass", detail));
}

// ---------------------------------------------------------------------------
// Q1.1 desk rows (spec 14 design, "Layout rows"). Each row reads the design's
// data attributes after document.fonts.ready and names its requirement in every
// failure. A row whose element is not on this build reports missing (a note).
// The pure verdicts below are exported for unit tests.
// ---------------------------------------------------------------------------
const DESK_SIZES = ["1440x900", "390x844", "1055x900", "1056x900"];
const SEAL_SIZES = ["1440x900", "390x844"];
const DESK_LETTER = "A letter for the desk check.";
const FOLD_LABEL = "Fold it and press the seal";
const Q11_TOL_PX = 1;
const Q11_LABELS = ["Write", "Press the seal", "Wait", "Remember", "Break the seal", "Receipts"];
const S1_STYLE = {
  current: { dot: 12, dotBg: "#ff7b1c", label: "#ffffff", weight: 700 },
  done: { dot: 8, dotBg: "#bdb4dc", label: "#bdb4dc" },
  todo: { dot: 8, dotBg: "#3a3350", label: "#8f86ad" },
};
const S2_GAP_MIN_PX = 16;
const S2_GAP_MAX_PX = 48;
const S31_GAP_PX = 64;
const S31_SPLIT_PX = 900;
const S34_MAX_PX = 844;
const S61_ENV_MAX_PX = 440;
const S61_ASPECT = 1.55;
const S61_SEAL_PX = 112;
const W1_SIDE_MIN_PX = 992;
const W1_STICKY_GAP_PX = 16;
const W1_STICKY_CHROME_PX = 32;
const ACCENT_HEX = "#ff7b1c";
// G1.7: 4.5:1 for text below 24 px regular or 18.66 px bold; 3:1 for larger text and control boundaries.
const G17_TEXT_MIN = 4.5;
const G17_LARGE_MIN = 3;

// --- Pure helpers -----------------------------------------------------------

// Parses "#rrggbb" or "rgb()/rgba()" (the forms getComputedStyle and the specs use).
// Returns [r, g, b, alpha] or null.
export function parseColour(value) {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return null;
  const alpha = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
  return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), alpha];
}

// G1.8: colours match exactly, alpha included. Zero tolerance.
export function colourMatch(actual, expected) {
  const a = parseColour(actual);
  const e = parseColour(expected);
  if (!a || !e) return false;
  return a.every((channel, i) => channel === e[i]);
}

// G1.8: sizes match within 1 CSS px.
export function sizeWithin(actual, expected, tol = Q11_TOL_PX) {
  return typeof actual === "number" && Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
}

// Two boxes keep the same slot when their left edge and width both match within tol.
export function slotStable(a, b, tol = Q11_TOL_PX) {
  return !!a && !!b && Math.abs(a.left - b.left) <= tol && Math.abs(a.width - b.width) <= tol;
}

// A baseline sits on its rule when the gap is within max px (W5.2 uses 2 px).
export function baselineGapOk(gap, max = 2) {
  return typeof gap === "number" && Number.isFinite(gap) && Math.abs(gap) <= max;
}

function relativeLuminance([r, g, b]) {
  const lin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// WCAG contrast ratio between two colours (opaque, alpha ignored).
export function contrastRatio(fg, bg) {
  const a = relativeLuminance(parseColour(fg));
  const b = relativeLuminance(parseColour(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// G1.7 threshold: 3:1 for larger text and control boundaries, 4.5:1 for other text.
export function contrastThreshold({ large }) {
  return large ? G17_LARGE_MIN : G17_TEXT_MIN;
}

// Returns { ratio, min, ok } so a failure message can name the numbers it compared.
export function contrastOk(fg, bg, { large = false } = {}) {
  const ratio = contrastRatio(fg, bg);
  const min = contrastThreshold({ large });
  return { ratio, min, ok: ratio >= min };
}

const num = (v, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "n/a");

// --- S1: the Step_Track (requirement S1.1 to S1.4) --------------------------

export function s1Failures({ items, phone, phoneText }) {
  const out = [];
  if (items.length !== Q11_LABELS.length) out.push(`S1.1 ${items.length} steps, want ${Q11_LABELS.length}`);
  const currents = items.filter((it) => it.state === "current");
  if (currents.length !== 1) out.push(`S1.3 ${currents.length} current steps, want 1`);
  const idx = currents.length === 1 ? items.indexOf(currents[0]) : -1;
  items.forEach((it, i) => {
    const want = i < idx ? "done" : i === idx ? "current" : "todo";
    if (it.state !== want) out.push(`S1.3 step ${i + 1} is ${it.state}, want ${want}`);
    if ((it.state === "current") !== (it.ariaCurrent === "step")) {
      out.push(`S1.2 step ${i + 1} aria-current is ${it.ariaCurrent ?? "absent"} for state ${it.state}`);
    }
    if (i < items.length - 1) {
      const h = it.hairline;
      if (!h || h.content === "none") out.push(`S1.1 no hairline after step ${i + 1}`);
      else {
        if (!sizeWithin(h.width, 36)) out.push(`S1.1 hairline ${i + 1} is ${num(h.width)}px long, want 36px`);
        if (!sizeWithin(h.height, 1)) out.push(`S1.1 hairline ${i + 1} is ${num(h.height)}px thick, want 1px`);
        if (!colourMatch(h.bg, "#3a3350")) out.push(`S1.1 hairline ${i + 1} colour ${h.bg}, want #3a3350`);
      }
    }
    const st = S1_STYLE[it.state];
    if (!st) return;
    if (!sizeWithin(it.dotW, st.dot)) out.push(`S1.2 step ${i + 1} dot is ${num(it.dotW)}px, want ${st.dot}px`);
    if (!colourMatch(it.dotBg, st.dotBg)) out.push(`S1.2 step ${i + 1} dot colour ${it.dotBg}, want ${st.dotBg}`);
    if (!phone) {
      if (it.label !== Q11_LABELS[i]) out.push(`S1.1 step ${i + 1} label "${it.label}", want "${Q11_LABELS[i]}"`);
      if (!sizeWithin(it.labelSize, 13)) out.push(`S1.1 step ${i + 1} label is ${num(it.labelSize)}px, want 13px`);
      if (!colourMatch(it.labelColor, st.label)) out.push(`S1.2 step ${i + 1} label colour ${it.labelColor}, want ${st.label}`);
      if (st.weight !== undefined && it.labelWeight !== st.weight) {
        out.push(`S1.2 step ${i + 1} label weight ${it.labelWeight}, want ${st.weight}`);
      }
    }
  });
  if (phone) {
    const want = idx >= 0 ? `Step ${idx + 1} of ${Q11_LABELS.length} · ${Q11_LABELS[idx]}` : null;
    if (!want || !phoneText.includes(want)) out.push(`S1.4 phone text "${want ?? "none"}" not in the Step_Track`);
  }
  return out;
}

// --- S2: the step change (S2.2 scroll position, S2.3 focus) ----------------

export function s22Failures({ gap, atTop }) {
  if (atTop) return [];
  if (gap === null) return ["S2.2 no [data-step-track] or Top_Bar to measure"];
  if (gap < S2_GAP_MIN_PX || gap > S2_GAP_MAX_PX) {
    return [`S2.2 Step_Track top is ${num(gap)}px below the Top_Bar bottom, want ${S2_GAP_MIN_PX} to ${S2_GAP_MAX_PX}px`];
  }
  return [];
}

export function s23Failures({ focusedHeading, scrollDrift, headingTop, barBottom }) {
  const out = [];
  if (!focusedHeading) out.push("S2.3 focus is not on [data-step-heading]");
  if (scrollDrift === null || Math.abs(scrollDrift) > Q11_TOL_PX) {
    out.push(`S2.3 page scrolled ${num(scrollDrift)}px after the change settled, want at most 1px`);
  }
  if (headingTop === null || barBottom === null || headingTop < barBottom) {
    out.push(`S2.3 heading top ${num(headingTop)}px is under the Top_Bar bottom ${num(barBottom)}px`);
  }
  return out;
}

// --- S3: the Seal step text column ------------------------------------------

export function s31Failures({ w, text, press }) {
  if (!text || !press) return ["S3.1 no [data-seal-text] or [data-press-column] to measure"];
  if (w >= S31_SPLIT_PX) {
    const out = [];
    const gap = press.left - text.right;
    if (Math.abs(gap - S31_GAP_PX) > Q11_TOL_PX) out.push(`S3.1 column gap is ${num(gap)}px, want ${S31_GAP_PX}px`);
    const dy = Math.abs((text.top + text.bottom) / 2 - (press.top + press.bottom) / 2);
    if (dy > Q11_TOL_PX) out.push(`S3.1 column centres are ${num(dy)}px apart vertically, want at most 1px`);
    return out;
  }
  return press.top < text.top ? ["S3.1 below 900px the Press_Envelope column sits above the text column"] : [];
}

export function s34Failures({ warningTop, sealBottom }) {
  if (warningTop === null || sealBottom === null) return ["S3.4 no [data-warning-text] or [data-press-envelope] to measure"];
  const span = sealBottom - warningTop;
  return span > S34_MAX_PX ? [`S3.4 seal bottom is ${num(span, 0)}px below the Warning_Text top, want at most ${S34_MAX_PX}px`] : [];
}

// --- S6: the press envelope and its status line -----------------------------

export function s61Failures({ envW, colW, envH, bg, radius, shadow, sealW }) {
  if (envW === null || envH === null) return ["S6.1 no [data-press-envelope] to measure"];
  const out = [];
  const wantW = Math.min(S61_ENV_MAX_PX, colW);
  if (!sizeWithin(envW, wantW)) out.push(`S6.1 envelope is ${num(envW)}px wide, want ${num(wantW, 0)}px`);
  if (!sizeWithin(envH, envW / S61_ASPECT)) {
    out.push(`S6.1 envelope is ${num(envH)}px tall, want ${num(envW / S61_ASPECT)}px (aspect ${S61_ASPECT})`);
  }
  if (!colourMatch(bg, "#f1e4c8")) out.push(`S6.1 envelope colour ${bg}, want #f1e4c8`);
  if (radius !== 6) out.push(`S6.1 envelope radius ${radius}px, want 6px`);
  if (!/rgba\(0, 0, 0, 0\.6\) 0px 40px 90px/.test(shadow ?? "")) out.push(`S6.1 envelope shadow "${shadow}", want rgba(0,0,0,.6) 0 40px 90px`);
  const wantSeal = (S61_SEAL_PX * envW) / S61_ENV_MAX_PX;
  if (!sizeWithin(sealW, wantSeal)) out.push(`S6.1 seal is ${num(sealW)}px across, want ${num(wantSeal)}px`);
  return out;
}

export function s64Failures({ opacity, cursor, ariaDisabled, status, statusColour }) {
  const out = [];
  if (Math.abs(Number(opacity) - 0.4) > 1e-6) out.push(`S6.4 seal opacity ${opacity}, want 0.4`);
  if (cursor !== "not-allowed") out.push(`S6.4 seal cursor ${cursor}, want not-allowed`);
  if (ariaDisabled !== "true") out.push(`S6.4 seal aria-disabled ${ariaDisabled}, want true`);
  if (status !== "Choose a backup option first.") out.push(`S6.4 status line "${status}", want "Choose a backup option first."`);
  if (!colourMatch(statusColour, "#bdb4dc")) out.push(`S6.4 status colour ${statusColour}, want #bdb4dc`);
  return out;
}

// reduced: true when reduced motion or Calm_Mode is on (the halo is then off and the text changes).
export function s65Failures({ opacity, ariaDisabled, boxShadow, status, statusColour, reduced = false }) {
  const out = [];
  if (Math.abs(Number(opacity) - 1) > 1e-6) out.push(`S6.5 seal opacity ${opacity}, want 1`);
  if (ariaDisabled !== "false") out.push(`S6.5 seal aria-disabled ${ariaDisabled}, want false`);
  const halo = boxShadow ?? "";
  if (reduced) {
    if (halo !== "none" && halo !== "") out.push("S6.5 halo is on under reduced motion, want off");
  } else {
    for (const need of ["rgba(255, 123, 28, 0.18) 0px 0px 0px 10px", "rgba(255, 123, 28, 0.08) 0px 0px 0px 22px"]) {
      if (!halo.includes(need)) out.push(`S6.5 halo lacks "${need}"`);
    }
  }
  const wantStatus = reduced ? "Press the wax to seal it." : "Press and hold the wax to seal it.";
  if (status !== wantStatus) out.push(`S6.5 status line "${status}", want "${wantStatus}"`);
  if (!colourMatch(statusColour, "#ff9a4d")) out.push(`S6.5 status colour ${statusColour}, want #ff9a4d`);
  return out;
}

// S6.8: the envelope meets no text-column element, and the page does not scroll sideways.
export function s68Failures({ env, texts, scrollWidth, clientWidth }) {
  if (!env) return ["S6.8 no [data-press-envelope] to measure"];
  const out = [];
  for (const t of texts) {
    if (rectsIntersect(env, t)) out.push(`S6.8 envelope meets <${t.tag}> "${t.text}"`);
  }
  if (scrollWidth > clientWidth) out.push(`S6.8 horizontal scroll: scrollWidth ${scrollWidth}px > ${clientWidth}px`);
  return out;
}

// --- W: the Write step ------------------------------------------------------

// W1.2 to W1.6. Side by side from 992 px of content width; below it the panel sits under the sheet.
export function w1Failures({ contentW, sheet, panel, topBarBottom, sticky, stickyTop, panelH, vh, scrollWidth, clientWidth, foldReachable }) {
  if (!sheet || !panel) return ["W1.2 no [data-letter-sheet] or [data-envelope-panel] to measure"];
  const out = [];
  if (contentW >= W1_SIDE_MIN_PX) {
    if (panel.left < sheet.right - Q11_TOL_PX) out.push(`W1.4 at ${num(contentW, 0)}px content width the Envelope_Panel is not beside the Letter_Sheet`);
    if (Math.abs(panel.top - sheet.top) > Q11_TOL_PX) {
      out.push(`W1.4 Envelope_Panel top ${num(panel.top, 0)}px is not level with the Letter_Sheet top ${num(sheet.top, 0)}px`);
    }
    if (panelH <= vh - topBarBottom - W1_STICKY_CHROME_PX) {
      if (sticky !== "sticky") out.push(`W1.3 Envelope_Panel position is ${sticky}, want sticky`);
      if (!(stickyTop >= topBarBottom + W1_STICKY_GAP_PX - Q11_TOL_PX)) {
        out.push(`W1.3 sticky top is ${num(stickyTop, 0)}px, want at least ${num(topBarBottom + W1_STICKY_GAP_PX, 0)}px`);
      }
    }
  } else {
    if (panel.top < sheet.bottom - Q11_TOL_PX) out.push(`W1.4 at ${num(contentW, 0)}px content width the Envelope_Panel is not below the Letter_Sheet`);
    if (!sizeWithin(panel.width, contentW)) out.push(`W1.4 Envelope_Panel is ${num(panel.width, 0)}px wide, want the content width ${num(contentW, 0)}px`);
  }
  if (scrollWidth > clientWidth) out.push(`W1.5 horizontal scroll: scrollWidth ${scrollWidth}px > ${clientWidth}px`);
  if (!foldReachable) out.push("W1.6 Fold_Button cannot be scrolled fully into view");
  return out;
}

// W4.1: the sheet's paper colour, radius and padding. Phone padding is 24 px vertical, 20 px sides.
export function w4Failures({ phone, sheetStyle }) {
  if (!sheetStyle) return ["W4.1 no [data-letter-sheet] to measure"];
  const out = [];
  if (!colourMatch(sheetStyle.bg, "#f6ead4")) out.push(`W4.1 Letter_Sheet background ${sheetStyle.bg}, want #f6ead4`);
  if (!sizeWithin(sheetStyle.radius, 6)) out.push(`W4.1 Letter_Sheet radius ${num(sheetStyle.radius)}px, want 6px`);
  const want = phone ? { t: 24, r: 20, b: 24, l: 20 } : { t: 48, r: 56, b: 40, l: 56 };
  for (const [key, label] of [["pt", "top"], ["pr", "right"], ["pb", "bottom"], ["pl", "left"]]) {
    const k = key.slice(1);
    if (!sizeWithin(sheetStyle[key], want[k])) out.push(`W4.1 Letter_Sheet padding-${label} ${num(sheetStyle[key], 0)}px, want ${want[k]}px`);
  }
  return out;
}

// W6.1: the perforation runs from the sheet's left edge to its right edge, dashed, 2 px, rgba(74,64,54,.28).
export function w61Failures({ sheet, perf, border }) {
  if (!perf || !sheet) return ["W6.1 no [data-perforation] or [data-letter-sheet] to measure"];
  const out = [];
  if (!sizeWithin(perf.left, sheet.left) || !sizeWithin(perf.right, sheet.right)) {
    out.push(`W6.1 Perforation runs ${num(perf.left, 0)}..${num(perf.right, 0)}px, sheet is ${num(sheet.left, 0)}..${num(sheet.right, 0)}px`);
  }
  if (!border || border.style !== "dashed") out.push(`W6.1 Perforation style ${border?.style}, want dashed`);
  if (!border || !sizeWithin(border.width, 2)) out.push(`W6.1 Perforation is ${num(border?.width)}px thick, want 2px`);
  if (!border || !colourMatch(border.colour, "rgba(74,64,54,.28)")) out.push(`W6.1 Perforation colour ${border?.colour}, want rgba(74,64,54,.28)`);
  return out;
}

// W13.1: the Fold_Button. Full width, 56 px, solid Accent, dark 16 px weight 800 text, hover #ff8f3d.
export function w13Failures({ fold, style, panelW, hoverBg }) {
  if (!fold || !style) return ["W13.1 no [data-fold-button] to measure"];
  const out = [];
  if (!sizeWithin(fold.height, 56)) out.push(`W13.1 Fold_Button is ${num(fold.height, 0)}px tall, want 56px`);
  if (!sizeWithin(fold.width, panelW)) out.push(`W13.1 Fold_Button is ${num(fold.width, 0)}px wide, want the panel width ${num(panelW, 0)}px`);
  if (!colourMatch(style.bg, ACCENT_HEX)) out.push(`W13.1 Fold_Button fill ${style.bg}, want #ff7b1c`);
  if (!colourMatch(style.colour, "#0b0912")) out.push(`W13.1 Fold_Button text ${style.colour}, want #0b0912`);
  if (!sizeWithin(style.fontSize, 16, 0)) out.push(`W13.1 Fold_Button text ${num(style.fontSize, 0)}px, want 16px`);
  if (style.weight !== "800") out.push(`W13.1 Fold_Button weight ${style.weight}, want 800`);
  if (hoverBg !== null && !colourMatch(hoverBg, "#ff8f3d")) out.push(`W13.1 Fold_Button hover fill ${hoverBg}, want #ff8f3d`);
  return out;
}

// W13.5: every desk button except the Fold_Button has no Accent fill or border.
// buttons: [{ label, fill, borders: [{ colour, width, style }] }].
export function accentFailures(buttons) {
  const isAccent = (c) => {
    const p = parseColour(c);
    return !!p && p[3] > 0 && p[0] === 255 && p[1] === 123 && p[2] === 28;
  };
  const out = [];
  for (const b of buttons) {
    const edges = b.borders.filter((s) => s.width > 0 && s.style !== "none").map((s) => s.colour);
    if ([b.fill, ...edges].some(isAccent)) out.push(`W13.5 "${b.label}" has an Accent fill or border; only the Fold_Button may`);
  }
  return out;
}

// --- Browser reads ----------------------------------------------------------

const Q11_RECT = (el) => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};

const S1_READ = () => {
  const root = document.querySelector("[data-step-track]");
  if (!root) return null;
  const lis = [...root.querySelectorAll("li[data-state]")];
  const items = lis.map((li, i) => {
    const dot = li.firstElementChild;
    const label = li.lastElementChild;
    const d = dot ? getComputedStyle(dot) : null;
    const l = label ? getComputedStyle(label) : null;
    const pseudo = i < lis.length - 1 ? getComputedStyle(li, "::after") : null;
    return {
      state: li.getAttribute("data-state"),
      ariaCurrent: li.getAttribute("aria-current"),
      label: (label?.textContent ?? "").trim(),
      dotW: d ? parseFloat(d.width) : null,
      dotBg: d ? d.backgroundColor : null,
      labelColor: l ? l.color : null,
      labelSize: l ? parseFloat(l.fontSize) : null,
      labelWeight: l ? Number(l.fontWeight) : null,
      hairline: pseudo ? { content: pseudo.content, width: parseFloat(pseudo.width), height: parseFloat(pseudo.height), bg: pseudo.backgroundColor } : null,
    };
  });
  return { items, text: (root.textContent ?? "").replace(/\s+/g, " ").trim() };
};

const STEP_READ = () => {
  const track = document.querySelector("[data-step-track]");
  const bar = document.querySelector("[data-topbar]") ?? document.querySelector("header");
  const heading = document.querySelector("[data-step-heading]");
  return {
    trackTop: track ? track.getBoundingClientRect().top : null,
    barBottom: bar ? bar.getBoundingClientRect().bottom : null,
    atTop: window.scrollY === 0,
    scrollY: window.scrollY,
    focusedHeading: !!heading && document.activeElement === heading,
    headingTop: heading ? heading.getBoundingClientRect().top : null,
  };
};

const SEAL_READ = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const env = document.querySelector("[data-press-envelope]");
  const col = document.querySelector("[data-press-column]");
  const text = document.querySelector("[data-seal-text]");
  const warn = document.querySelector("[data-warning-text]");
  const seal = document.querySelector("[data-seal-target]");
  const line = document.querySelector("[data-press-line]");
  const es = env ? getComputedStyle(env) : null;
  const ss = seal ? getComputedStyle(seal) : null;
  const ls = line ? getComputedStyle(line) : null;
  const texts = text
    ? [...text.querySelectorAll("h1, h2, h3, p, li, label, button, a, input, textarea, [data-warning-text]")]
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.textContent ?? "").trim().slice(0, 30), ...rect(e) }))
    : [];
  return {
    env: rect(env),
    envAriaDisabled: env ? env.getAttribute("aria-disabled") : null,
    col: rect(col),
    text: rect(text),
    colW: col ? col.getBoundingClientRect().width : null,
    envBg: es ? es.backgroundColor : null,
    envRadius: es ? parseFloat(es.borderTopLeftRadius) : null,
    envShadow: es ? es.boxShadow : null,
    sealW: seal ? seal.getBoundingClientRect().width : null,
    sealOpacity: ss ? ss.opacity : null,
    sealCursor: ss ? ss.cursor : null,
    sealShadow: ss ? ss.boxShadow : null,
    status: line ? (line.textContent ?? "").trim() : null,
    statusColour: ls ? ls.color : null,
    warnTop: warn ? warn.getBoundingClientRect().top : null,
    texts,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
};

const DESK_WRITE_READ = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const borderOf = (cs) =>
    ["Top", "Right", "Bottom", "Left"].map((side) => ({
      colour: cs[`border${side}Color`],
      width: parseFloat(cs[`border${side}Width`]),
      style: cs[`border${side}Style`],
    }));
  const topbar = document.querySelector("[data-topbar]") ?? document.querySelector("header");
  const desk = document.querySelector("[data-write-desk]");
  const sheet = document.querySelector("[data-letter-sheet]");
  const panel = document.querySelector("[data-envelope-panel]");
  const fold = document.querySelector("[data-fold-button]");
  const perf = document.querySelector("[data-perforation]");
  const dcs = desk ? getComputedStyle(desk) : null;
  const scs = sheet ? getComputedStyle(sheet) : null;
  const pcs = panel ? getComputedStyle(panel) : null;
  const fcs = fold ? getComputedStyle(fold) : null;
  const pf = perf ? getComputedStyle(perf) : null;
  const buttons = desk
    ? [...desk.querySelectorAll("button")]
        .filter((b) => !b.hasAttribute("data-fold-button"))
        .map((b) => {
          const cs = getComputedStyle(b);
          return { label: (b.textContent ?? "").trim().slice(0, 40), fill: cs.backgroundColor, borders: borderOf(cs) };
        })
    : [];
  return {
    contentW: desk ? desk.clientWidth - parseFloat(dcs.paddingLeft) - parseFloat(dcs.paddingRight) : null,
    topBarBottom: topbar ? topbar.getBoundingClientRect().bottom : null,
    vh: window.innerHeight,
    sheet: rect(sheet),
    sheetStyle: scs
      ? {
          bg: scs.backgroundColor,
          radius: parseFloat(scs.borderTopLeftRadius),
          pt: parseFloat(scs.paddingTop),
          pr: parseFloat(scs.paddingRight),
          pb: parseFloat(scs.paddingBottom),
          pl: parseFloat(scs.paddingLeft),
        }
      : null,
    panel: rect(panel),
    panelW: panel ? panel.clientWidth : null,
    sticky: pcs ? pcs.position : null,
    stickyTop: pcs ? parseFloat(pcs.top) : null,
    perf: rect(perf),
    perfBorder: pf ? { style: pf.borderTopStyle, width: parseFloat(pf.borderTopWidth), colour: pf.borderTopColor } : null,
    fold: rect(fold),
    foldStyle: fcs
      ? { bg: fcs.backgroundColor, colour: fcs.color, fontSize: parseFloat(fcs.fontSize), weight: fcs.fontWeight }
      : null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    buttons,
  };
};

const FOLD_REACH_READ = () => {
  const fold = document.querySelector("[data-fold-button]");
  if (!fold) return null;
  fold.scrollIntoView({ block: "center" });
  const r = fold.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
};

// --- Spec 16 rows (17.3) ----------------------------------------------------
// Pure verdicts for the four rows of 17.3. Each takes the measurements a browser
// read gives and returns the failure strings; an empty list is a pass. Each row
// runs at 1440x900 and 390x844.

const S16_CENTRE_TOL_PX = 1;
const S16_RECEIPT_RANK = { pair: 0, figure: 1, letter: 2, seal: 3, end: 4 };

/**
 * 10.1: the open letter sits beside the receipts in order.
 * `blocks` are question pairs, figure cards, the letter, the seal line and the end card, each
 * with its top. `disclosurePresent` is true when a fold control is on the page.
 * `letterTextVisible` is false when the letter text has no client rect or fails checkVisibility().
 * @param {{ blocks: { kind: string, top: number }[], disclosurePresent: boolean, letterTextVisible: boolean }} args
 */
export function receiptsOrderFailures({ blocks, disclosurePresent, letterTextVisible }) {
  const out = [];
  const ordered = blocks.filter((b) => b.kind !== "letter").sort((a, b) => a.top - b.top);
  let last = -1;
  for (const b of ordered) {
    const rank = S16_RECEIPT_RANK[b.kind];
    if (rank === undefined) {
      out.push(`10.1 unknown block "${b.kind}"`);
      continue;
    }
    if (rank < last) out.push(`10.1 "${b.kind}" sits after a later block`);
    last = Math.max(last, rank);
  }
  for (const kind of ["letter", "seal", "end"]) {
    if (!blocks.some((b) => b.kind === kind)) out.push(`10.1 no "${kind}" block`);
  }
  const letter = blocks.find((b) => b.kind === "letter");
  const figureTops = blocks.filter((b) => b.kind === "figure").map((b) => b.top);
  if (letter && figureTops.length > 0 && letter.top > Math.min(...figureTops)) {
    out.push("10.1 the letter sits after the figures");
  }
  if (disclosurePresent === true) out.push("10.2 a fold control is on the page");
  if (letterTextVisible !== true) out.push("10.2 the letter text is not visible");
  return out;
}

/**
 * Split reading of 10.6: the record column and the letter column sit side by side, centred on
 * the viewport, and the live width matches the persona receipts column. Each column is at
 * least 280 px wide. `record` and `letter` are boxes with `left`, `right` and `top` in px.
 * @param {{ record: { left: number, right: number, top: number }, letter: { left: number, right: number, top: number }, width: number, centre: number, viewportCentre: number, personaWidth: number | null | undefined }} args
 */
export function splitColumnFailures({ record, letter, width, centre, viewportCentre, personaWidth }) {
  const out = [];
  if (record.right > letter.left && letter.right > record.left) {
    out.push("10.6 the record column overlaps the letter column");
  }
  if (Math.abs(record.top - letter.top) > S16_CENTRE_TOL_PX) {
    out.push(`10.6 column tops ${record.top} px and ${letter.top} px differ by more than ${S16_CENTRE_TOL_PX} px`);
  }
  for (const [name, box] of [["record", record], ["letter", letter]]) {
    const colWidth = box.right - box.left;
    if (colWidth < 280) out.push(`10.6 the ${name} column is ${colWidth} px, want at least 280 px`);
  }
  if (Math.abs(centre - viewportCentre) > S16_CENTRE_TOL_PX) {
    out.push(`10.6 column centre ${centre} px, want ${viewportCentre} px within ${S16_CENTRE_TOL_PX} px`);
  }
  if (personaWidth === null || personaWidth === undefined) {
    out.push("10.6 no persona receipts column to compare its width with");
  } else if (Math.abs(width - personaWidth) > S16_CENTRE_TOL_PX) {
    out.push(`10.6 column width ${width} px, persona ${personaWidth} px within ${S16_CENTRE_TOL_PX} px`);
  }
  return out;
}

// --- Spec 20 Part D readings (design "QA browser steps", c to g) -------------
const S20_TOL_PX = 1;
const S20_STICK_MAX_PX = 32;
const S20_WIDE_PX = 900;
const S20_LONG_SIZE = "1280x800";
const S20_LONG_LENGTH = 5000;
const S20_LONG_TAIL = " The last line of this letter is here.";
const S20_LONG_LETTER = "A letter that is long enough to scroll inside its own column. ".repeat(100).slice(0, S20_LONG_LENGTH - S20_LONG_TAIL.length) + S20_LONG_TAIL;

/**
 * S20.c: at 900 px and wider the letter column starts right of the record column and its top is
 * level with the record column's top. Below 900 px no two blocks sit side by side.
 * @param {{ w: number, record: { left: number, right: number, top: number } | null, letter: { left: number, right: number, top: number } | null, blocks: { kind: string, top: number, bottom: number }[] }} args
 */
export function placementFailures({ w, record, letter, blocks }) {
  const out = [];
  if (w >= S20_WIDE_PX) {
    if (!record || !letter) return ["S20.c no record or letter column to place"];
    if (letter.left < record.right) {
      out.push(`S20.c letter column starts at ${Math.round(letter.left)} px, before the record column ends at ${Math.round(record.right)} px`);
    }
    if (Math.abs(letter.top - record.top) > S20_TOL_PX) {
      out.push(`S20.c column tops ${Math.round(record.top)} px and ${Math.round(letter.top)} px differ by more than ${S20_TOL_PX} px`);
    }
    return out;
  }
  const ordered = [...blocks].sort((a, b) => a.top - b.top);
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (cur.top < prev.bottom - S20_TOL_PX) out.push(`S20.c "${cur.kind}" sits beside "${prev.kind}" in one column`);
  }
  return out;
}

/**
 * S20.d: the letter column top sits 0 to 32 px under the Top_Bar, unless the receipts end has
 * reached the letter's bottom edge (the column then scrolls up with the receipts).
 * @param {{ top: number | null, barBottom: number | null, areaBottom: number | null, letterBottom: number | null }} args
 */
export function stickyFailures({ top, barBottom, areaBottom, letterBottom }) {
  if (top === null || barBottom === null) return ["S20.d no letter column or Top_Bar to measure"];
  if (areaBottom !== null && letterBottom !== null && areaBottom <= letterBottom + S20_TOL_PX) return [];
  if (top < barBottom - S20_TOL_PX || top > barBottom + S20_STICK_MAX_PX + S20_TOL_PX) {
    return [`S20.d letter top ${Math.round(top)} px, want ${Math.round(barBottom)} to ${Math.round(barBottom + S20_STICK_MAX_PX)} px`];
  }
  return [];
}

/**
 * S20.e: the focused Figures_Heading is fully between the Top_Bar and the viewport bottom.
 * @param {{ top: number | null, bottom: number | null, barBottom: number | null, viewportH: number }} args
 */
export function focusHeadingFailures({ top, bottom, barBottom, viewportH }) {
  if (top === null || bottom === null || barBottom === null) return ["S20.e no Figures_Heading or Top_Bar to measure"];
  const out = [];
  if (top < barBottom - S20_TOL_PX) out.push(`S20.e heading top ${Math.round(top)} px is above the Top_Bar bottom ${Math.round(barBottom)} px`);
  if (bottom > viewportH + S20_TOL_PX) out.push(`S20.e heading bottom ${Math.round(bottom)} px is below the ${viewportH} px viewport`);
  return out;
}

/**
 * S20.f and S20.f-reduced: the letter's motion after "See the receipts". `calls` counts animate
 * calls on the letter since the page loaded, `animations` counts animations on its subtree that
 * started after the move, and `nodeKept` says the held letter node is still the shown one.
 * @param {{ reduced: boolean, calls: number | null, nodeKept: boolean, animations: number }} args
 */
export function letterMotionFailures({ reduced, calls, nodeKept, animations }) {
  if (calls === null || calls === undefined) return ["S20.f no animate count was recorded"];
  const out = [];
  if (reduced) {
    if (calls > 0) out.push(`S20.f-reduced ${calls} animate call(s) on the letter, want 0`);
    if (animations > 0) out.push(`S20.f-reduced ${animations} animation(s) on the letter subtree, want 0`);
    return out;
  }
  if (calls > 1) out.push(`S20.f ${calls} animate calls on the letter, want at most 1 (its unfold)`);
  if (nodeKept !== true) out.push("S20.f the letter node held before the move is not the one shown 2,000 ms after it");
  return out;
}

/**
 * S20.g: no figure text has the computed colour of --accent.
 * @param {{ accent: string | null, colours: { label: string, colour: string }[] }} args
 */
export function figureAccentFailures({ accent, colours }) {
  if (!accent) return ["S20.g no --accent token to compare with"];
  return colours.filter((c) => c.colour === accent).map((c) => `S20.g "${c.label}" is drawn in --accent`);
}

/**
 * S20.long: the letter column is focusable, scrolls by End, and shows the last character after it.
 * @param {{ tabindex: string | null, overflowing: boolean, scrolledBy: number, lastCharVisible: boolean }} args
 */
export function longLetterFailures({ tabindex, overflowing, scrolledBy, lastCharVisible }) {
  const out = [];
  if (tabindex !== "0") out.push(`S20.long the letter column has tabindex ${tabindex ?? "none"}, want "0"`);
  if (!overflowing) out.push("S20.long the letter column does not scroll on its own at 1280x800");
  else if (!(scrolledBy > 0)) out.push("S20.long End did not scroll the letter column");
  if (lastCharVisible !== true) out.push("S20.long the last character of the letter is not in view after End");
  return out;
}

const S20_SPLIT_SIZES = ["1280x800", "1440x900", "1920x1080"];
const S20_SPLIT_MIN_PX = 420;
/**
 * S20.w: on the persona receipts at 1280 px and wider, each column is at least 420 px wide, no
 * record element reaches into the letter column, and the end-card heading fits its card.
 * Boxes are { left, right } in px; `intrusions` lists record elements whose right edge passes the
 * letter column's left edge, each { label, right }.
 * @param {{ split: boolean, record: { left: number, right: number } | null, letter: { left: number, right: number } | null, intrusions: { label: string, right: number }[], heading: { scrollWidth: number, clientWidth: number, left: number, right: number } | null, card: { left: number, right: number } | null }} args
 */
export function splitWidthFailures({ split, record, letter, intrusions, heading, card }) {
  if (!split) return ['S20.w no [data-receipts-layout="split"] on the receipts'];
  if (!record || !letter) return ["S20.w no record or letter column to measure"];
  const out = [];
  for (const [name, box] of [["record", record], ["letter", letter]]) {
    const width = Math.round(box.right - box.left);
    if (width < S20_SPLIT_MIN_PX) out.push(`S20.w the ${name} column is ${width} px, want at least ${S20_SPLIT_MIN_PX} px`);
  }
  for (const i of intrusions) {
    out.push(`S20.w ${i.label} ends at ${Math.round(i.right)} px, inside the letter column from ${Math.round(letter.left)} px`);
  }
  if (!heading || !card) {
    out.push("S20.w no end-card heading ([data-close-line]) to measure");
    return out;
  }
  if (heading.scrollWidth > heading.clientWidth) {
    out.push(`S20.w the end-card heading scrollWidth ${heading.scrollWidth} px is more than its clientWidth ${heading.clientWidth} px`);
  }
  if (heading.left < card.left - S20_TOL_PX || heading.right > card.right + S20_TOL_PX) {
    out.push(`S20.w the end-card heading spans ${Math.round(heading.left)}..${Math.round(heading.right)} px, outside its card ${Math.round(card.left)}..${Math.round(card.right)} px`);
  }
  return out;
}
/** 14.3 (6.3): the lost-passkey warning is unfolded, inside the viewport and above the wax. */
export function passkeyWarningFailures({ unfolded, top, bottom, waxTop, viewportH }) {
  const out = [];
  if (!unfolded) out.push("14.3 the lost-passkey warning is folded");
  if (top === null || bottom === null) {
    out.push("14.3 no lost-passkey warning to measure");
    return out;
  }
  if (top < 0 || bottom > viewportH) out.push(`14.3 warning ${top}-${bottom} px is outside the ${viewportH} px viewport`);
  if (waxTop === null || waxTop === undefined) out.push("14.3 no wax to measure against");
  else if (bottom > waxTop) out.push(`14.3 warning bottom ${bottom} px is below the wax top ${waxTop} px`);
  return out;
}

/**
 * 5.4 and 5.5: at 1440x900 the first sentence of the hero headline takes one line box;
 * at 390x844 no headline line holds one word. `lines` is the rendered line texts.
 */
export function heroLineFailures({ w, firstSentenceLines, lines }) {
  const out = [];
  if (w === 1440) {
    if (firstSentenceLines !== 1) out.push(`5.4 "Memory drifts with time." takes ${firstSentenceLines} line boxes, want 1`);
  } else if (w === 390) {
    lines.forEach((text, i) => {
      if (text.trim().split(/\s+/).filter(Boolean).length === 1) out.push(`5.5 line ${i + 1} "${text.trim()}" holds one word`);
    });
  } else {
    out.push(`5.4/5.5 no rule for viewport width ${w}`);
  }
  return out;
}

// --- Row runners ------------------------------------------------------------

function missingRow(id, name, detail) {
  return result(id, name, "missing", `not on this build: ${detail}`);
}

function verdictRow(id, name, problems, detail, threshold) {
  const tail = problems.length ? ` (${problems.join("; ")})` : "";
  return result(id, name, problems.length ? "fail" : "pass", `${detail} threshold=${threshold}${tail}`);
}

async function checkStepTrack(page, ctx, stage) {
  const r = await page.evaluate(S1_READ);
  if (!r) {
    report(ctx, missingRow("S1", "step-track", "no [data-step-track]"));
    return;
  }
  const phone = ctx.w < PHONE_WIDTH_MAX;
  const problems = s1Failures({ items: r.items, phone, phoneText: r.text });
  const states = r.items.map((it) => it.state).join(",");
  report(ctx, verdictRow("S1", "step-track", problems, `stage=${stage} states=${states} viewport=${ctx.size}`, "six steps, one current, the S1.2 dot and label values, phone text at under 600 px"));
}

async function checkStepChange(page, ctx) {
  await (await need(page.getByRole("button", { name: FOLD_LABEL }), `"${FOLD_LABEL}" button`)).click();
  await page.waitForSelector("[data-seal-step]", { timeout: WAIT_MS });
  await sleep(1000);
  const first = await page.evaluate(STEP_READ);
  await sleep(500);
  const second = await page.evaluate(STEP_READ);
  if (first.trackTop === null || first.barBottom === null) {
    report(ctx, missingRow("S2.2", "step-change", "no [data-step-track] or Top_Bar to measure"));
  } else {
    const gap = first.trackTop - first.barBottom;
    report(
      ctx,
      verdictRow(
        "S2.2",
        "step-change",
        s22Failures({ gap, atTop: first.atTop }),
        `gap=${num(gap)}px scrollY=${num(first.scrollY, 0)} viewport=${ctx.size}`,
        "Step_Track 16 to 48 px below the Top_Bar 1,000 ms after the change, unless at the page top",
      ),
    );
  }
  report(
    ctx,
    verdictRow(
      "S2.3",
      "step-focus",
      s23Failures({ focusedHeading: first.focusedHeading, scrollDrift: second.scrollY - first.scrollY, headingTop: first.headingTop, barBottom: first.barBottom }),
      `heading top=${num(first.headingTop, 0)}px drift=${num(second.scrollY - first.scrollY)}px viewport=${ctx.size}`,
      "focus on [data-step-heading], no scroll after 1,000 ms, heading below the Top_Bar",
    ),
  );
}

async function checkSealText(page, ctx, r) {
  if (!r.text || !r.col) {
    report(ctx, missingRow("S3.1", "seal-columns", "no [data-seal-text] or [data-press-column]"));
    return;
  }
  const problems = s31Failures({ w: ctx.w, text: r.text, press: r.col });
  report(ctx, verdictRow("S3.1", "seal-columns", problems, `text=${num(r.text.left, 0)}..${num(r.text.right, 0)} press=${num(r.col.left, 0)}..${num(r.col.right, 0)} viewport=${ctx.size}`, "64 px gap and level centres at 900 px and wider; text column first below 900 px"));
}

async function checkPress(page, ctx, phase, r) {
  if (!r.env) {
    report(ctx, missingRow("S6.1", "press-envelope", "no [data-press-envelope]"));
    return;
  }
  const colW = r.colW ?? 0;
  report(ctx, verdictRow("S6.1", "press-envelope", s61Failures({ envW: r.env.width, colW, envH: r.env.height, bg: r.envBg, radius: r.envRadius, shadow: r.envShadow, sealW: r.sealW }), `envelope=${num(r.env.width, 0)}x${num(r.env.height, 0)} seal=${num(r.sealW, 0)} viewport=${ctx.size}`, "envelope min(440, column) wide, 1.55 aspect, #f1e4c8, 6 px radius, shadow; seal scaled from 112 px at 440"));
  report(ctx, verdictRow("S6.8", "press-vs-text", s68Failures({ env: r.env, texts: r.texts, scrollWidth: r.scrollWidth, clientWidth: r.clientWidth }), `texts=${r.texts.length} viewport=${ctx.size}`, "no intersection with the text column, no horizontal scroll"));
  if (phase === "no-choice") {
    report(ctx, verdictRow("S6.4", "seal-no-choice", s64Failures({ opacity: r.sealOpacity, cursor: r.sealCursor, ariaDisabled: r.envAriaDisabled, status: r.status, statusColour: r.statusColour }), `opacity=${r.sealOpacity} cursor=${r.sealCursor} status="${r.status}" viewport=${ctx.size}`, "40% opacity, not-allowed, aria-disabled true, Choose a backup option first."));
  } else {
    report(ctx, verdictRow("S6.5", "seal-chosen", s65Failures({ opacity: r.sealOpacity, ariaDisabled: r.envAriaDisabled, boxShadow: r.sealShadow, status: r.status, statusColour: r.statusColour, reduced: r.reduced }), `opacity=${r.sealOpacity} status="${r.status}" viewport=${ctx.size}`, "full opacity, double halo, aria-disabled false, press-and-hold line"));
  }
}

async function checkSealRows(page, ctx) {
  ctx.rep.stage("seal");
  const note = (id, name) => report(ctx, result(id, name, "missing", "not reached here: a passkey prompt or the sealing is driven by Live_Walk, not by this check"));
  const before = await page.evaluate(SEAL_READ);
  await checkSealText(page, ctx, before);
  await checkPress(page, ctx, "no-choice", before);
  if (ctx.w === 390) {
    const sealBottom = await page.evaluate(() => {
      const warn = document.querySelector("[data-warning-text]");
      const env = document.querySelector("[data-press-envelope]");
      if (!warn || !env) return null;
      warn.scrollIntoView({ block: "start" });
      return { warningTop: warn.getBoundingClientRect().top, sealBottom: env.getBoundingClientRect().bottom };
    });
    report(ctx, sealBottom
      ? verdictRow("S3.4", "warning-to-seal", s34Failures(sealBottom), `viewport=${ctx.size}`, "seal bottom at most 844 px below the Warning_Text top")
      : missingRow("S3.4", "warning-to-seal", "no [data-warning-text] or [data-press-envelope]"));
  }
  await (await need(page.locator('[data-backup-card="skip"]'), '[data-backup-card="skip"] backup card')).click();
  await sleep(300);
  const after = await page.evaluate(SEAL_READ);
  await checkPress(page, ctx, "chosen", after);
  note("S6.6", "seal-prompt");
  note("S6.7", "seal-sealing");
}

async function checkWriteDesk(page, ctx) {
  const r = await page.evaluate(DESK_WRITE_READ);
  if (!r.sheet || !r.panel) {
    report(ctx, missingRow("W1", "write-layout", "no [data-letter-sheet] or [data-envelope-panel]"));
  } else {
    await page.locator("[data-fold-button]").hover().catch(() => {});
    const hoverBg = await page.evaluate(() => {
      const f = document.querySelector("[data-fold-button]");
      return f ? getComputedStyle(f).backgroundColor : null;
    });
    await page.mouse.move(0, 0);
    const foldReachable = await page.evaluate(FOLD_REACH_READ);
    report(ctx, verdictRow("W1", "write-layout", w1Failures({ contentW: r.contentW, sheet: r.sheet, panel: r.panel, topBarBottom: r.topBarBottom ?? 0, sticky: r.sticky, stickyTop: r.stickyTop, panelH: r.panel.height, vh: r.vh, scrollWidth: r.scrollWidth, clientWidth: r.clientWidth, foldReachable: foldReachable === true }), `content=${num(r.contentW, 0)} sheet=${num(r.sheet.width, 0)} panel=${num(r.panel.width, 0)} sticky=${r.sticky} viewport=${ctx.size}`, "side by side from 992 px of content, sticky panel, no sideways scroll, Fold_Button reachable"));
    report(ctx, verdictRow("W4", "letter-sheet", w4Failures({ phone: ctx.w < PHONE_WIDTH_MAX, sheetStyle: r.sheetStyle }), `viewport=${ctx.size}`, "#f6ead4, 6 px radius, 48/56/40 padding (24/20 on a phone)"));
    report(ctx, verdictRow("W6.1", "perforation", w61Failures({ sheet: r.sheet, perf: r.perf, border: r.perfBorder }), `viewport=${ctx.size}`, "dashed 2 px line, sheet edge to sheet edge, rgba(74,64,54,.28)"));
    report(ctx, verdictRow("W13.1", "fold-button", w13Failures({ fold: r.fold, style: r.foldStyle, panelW: r.panelW, hoverBg }), `viewport=${ctx.size}`, "56 px, #ff7b1c fill, #0b0912 16 px weight 800 text, #ff8f3d on hover"));
    report(ctx, verdictRow("W13.5", "desk-accent", accentFailures(r.buttons), `buttons=${r.buttons.length} viewport=${ctx.size}`, "no Accent fill or border on any desk button except the Fold_Button"));
  }
}

async function checkDeskRows(browser, base, size, rep, required) {
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: null, required, memo: {}, ghostHook: false };
  rep.setContext(ctx);
  rep.log(`\n==== ${size} (Q1.1 desk rows) ====`);
  try {
    const page = await newPage(context);
    try {
      rep.stage("write");
      const res = await page.goto(`${base}${LIVE_PATH}`, { waitUntil: "load" });
      if (!res || res.status() !== 200) {
        rep.add("note", "desk", `${LIVE_PATH} answered HTTP ${res?.status() ?? "none"}; desk rows not measured`);
        return;
      }
      await page.evaluate(() => document.fonts.ready);
      await sleep(500);
      await guard(ctx, "S1", () => checkStepTrack(page, ctx, "write"));
      await guard(ctx, "W", () => checkWriteDesk(page, ctx));
      await guard(ctx, "W2", () => checkWriteRows(page, ctx));
      await guard(ctx, "W5.2", () => checkRuledBaseline(context, ctx));
      if (SEAL_SIZES.includes(size)) {
        await guard(ctx, "S2", async () => {
          await need(page.locator("#live-letter"), "#live-letter on /demo/live");
          await page.fill("#live-letter", DESK_LETTER);
          await checkStepChange(page, ctx);
        });
        await guard(ctx, "S1", () => checkStepTrack(page, ctx, "seal"));
        await guard(ctx, "S", () => checkSealRows(page, ctx));
      }
    } finally {
      await page.close();
    }
  } catch (error) {
    rep.add("note", "desk", `could not run: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}

// W5.2 on /demo/live: the ruled-line baseline gap of the Letter_Field, before and after an internal scroll.
// Runs on a fresh page so the Write-step rows keep their own state. The field is filled with
// W52_LINES short lines, which is more than the field shows, so it scrolls inside itself.
const W52_LINES = 60;

// Browser side. The baselines come from a hidden mirror built here with the field's own font,
// width and line-height: one zero-height inline-block per line, whose bottom edge sits on that
// line's baseline. The rule offset and attachment are read from the field's computed style.
// The field is scrolled to 20 lines down and back; the scroll values are returned as read.
const W52_READ = () => {
  const ta = document.querySelector("#live-letter");
  if (!ta) return { missing: true };
  const cs = getComputedStyle(ta);
  if (ta.scrollHeight <= ta.clientHeight + 1) return { missing: false, scrollable: false };
  const lineHeight = parseFloat(cs.lineHeight) || 32;
  const offset = parseFloat(cs.backgroundPosition.split(" ")[1]);
  const contentW = ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const mirror = document.createElement("div");
  mirror.setAttribute("aria-hidden", "true");
  mirror.style.cssText = [
    "position:fixed", "left:0", "top:0", "visibility:hidden", "pointer-events:none",
    "margin:0", "padding:0", "border:0", "box-sizing:content-box",
    `width:${contentW}px`, "white-space:pre-wrap", "overflow-wrap:break-word",
    `font-family:${cs.fontFamily}`, `font-size:${cs.fontSize}`, `font-weight:${cs.fontWeight}`,
    `font-style:${cs.fontStyle}`, `line-height:${cs.lineHeight}`, `letter-spacing:${cs.letterSpacing}`,
    `word-spacing:${cs.wordSpacing}`,
  ].join(";");
  const lines = ta.value.split("\n");
  lines.forEach((text, i) => {
    const marker = document.createElement("span");
    marker.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    mirror.append(marker, document.createTextNode(i < lines.length - 1 ? `${text}\n` : text));
  });
  document.body.append(mirror);
  const top = mirror.getBoundingClientRect().top;
  const baselines = [...mirror.querySelectorAll("span")].map((m) => m.getBoundingClientRect().bottom - top);
  mirror.remove();
  // One baseline per field line only holds when no line wraps. Consecutive baselines must sit one
  // line-height apart; otherwise a wrapped line would pair the baselines with the wrong rules.
  const oneLinePerText = baselines.every((b, i) => i === 0 || Math.abs(b - baselines[i - 1] - lineHeight) <= 1);
  ta.scrollTop = 0;
  const scrollBefore = ta.scrollTop;
  ta.scrollTop = 20 * lineHeight;
  ta.dispatchEvent(new Event("scroll"));
  const scrollAfter = ta.scrollTop;
  return { missing: false, scrollable: true, attachment: cs.backgroundAttachment, offset, lineHeight, baselines, oneLinePerText, scrollBefore, scrollAfter };
};

// W5.2 row from the W52_READ result. Before the scroll, lines 1 to 3 are measured. After it, the
// three lines at the top of the visible field are measured. Each gap is the signed distance from
// the baseline to the nearest rule (ruleGapPx), checked with baselineGapOk.
export function w52Row({ viewport, raw }) {
  if (raw.missing) return result("W5.2", "ruled-baseline", "missing", "not on this build: no #live-letter on /demo/live");
  if (!raw.scrollable) return result("W5.2", "ruled-baseline", "missing", `not measured at viewport=${viewport}: the Letter_Field did not scroll inside itself with ${W52_LINES} lines`);
  const at = (i) => ({ line: i + 1, gap: ruleGapPx(raw.baselines[i], raw.offset, raw.lineHeight) });
  const first = Math.ceil(raw.scrollAfter / raw.lineHeight);
  const before = [0, 1, 2].filter((i) => i < raw.baselines.length).map(at);
  const after = [first, first + 1, first + 2].filter((i) => i < raw.baselines.length).map(at);
  const r = { attachment: raw.attachment, scrollTop: raw.scrollAfter, oneLinePerText: raw.oneLinePerText, before, after };
  const problems = w52Failures(r);
  const list = (rows) => rows.map((x) => `${x.line}:${num(x.gap)}`).join(" ");
  const detail = `scrollTop=${num(raw.scrollAfter, 0)}px attachment=${raw.attachment} rule-offset=${num(raw.offset, 0)}px before=[${list(before)}] after=[${list(after)}] viewport=${viewport}`;
  const threshold = "each measured baseline within 2 px of its ruled line, before and after the internal scroll, with the rules moving with the text";
  return result("W5.2", "ruled-baseline", problems.length ? "fail" : "pass", `${detail} threshold=${threshold}${problems.length ? ` (${problems.join("; ")})` : ""}`);
}

// Opens a fresh /demo/live page, fills the Letter_Field with W52_LINES lines and reports W5.2.
async function checkRuledBaseline(context, ctx) {
  const page = await newPage(context);
  try {
    const res = await page.goto(`${ctx.base}${LIVE_PATH}`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      report(ctx, result("W5.2", "ruled-baseline", "missing", `${LIVE_PATH} answered HTTP ${res?.status() ?? "none"}; not measured`));
      return;
    }
    await page.evaluate(() => document.fonts.ready);
    if (await present(page.locator("#live-letter"))) await page.fill("#live-letter", Array.from({ length: W52_LINES }, (_, i) => `Line ${i + 1}`).join("\n")).catch(() => {});
    await sleep(300);
    const raw = await page.evaluate(W52_READ);
    report(ctx, w52Row({ viewport: ctx.size, raw }));
  } finally {
    await page.close();
  }
}

// --- Q1.1 rows, part 2: W2 to W12, X2.1, T, R, B and D ----------------------

// W2.2 to W2.4 (the Write step header) and W2.3 (one h1). W2.3's heading size is 36 px on a phone.
export function w2Failures({ h1Count, h1, eyebrow, intro, phone }) {
  const out = [];
  if (h1Count !== 1) out.push(`W2.3 ${h1Count} h1 on the Write step, want 1`);
  if (!h1) out.push("W2.3 no h1 to measure");
  else {
    const want = phone ? 36 : 56;
    if (!sizeWithin(h1.size, want, 0)) out.push(`W2.3 h1 is ${num(h1.size, 0)}px, want ${want}px`);
    if (h1.weight !== "900") out.push(`W2.3 h1 weight ${h1.weight}, want 900`);
    if (h1.text !== "Write to the you who opens this.") out.push(`W2.3 h1 text "${h1.text}"`);
  }
  if (!eyebrow) out.push("W2.2 no eyebrow reading \"Seal your own letter\"");
  else {
    if (!sizeWithin(eyebrow.size, 12, 0)) out.push(`W2.2 eyebrow is ${num(eyebrow.size, 0)}px, want 12px`);
    if (eyebrow.weight !== "600") out.push(`W2.2 eyebrow weight ${eyebrow.weight}, want 600`);
    if (!colourMatch(eyebrow.colour, "#bdb4dc")) out.push(`W2.2 eyebrow colour ${eyebrow.colour}, want #bdb4dc`);
  }
  if (!intro) out.push("W2.4 no intro line");
  else {
    if (!sizeWithin(intro.size, 17, 0)) out.push(`W2.4 intro is ${num(intro.size, 0)}px, want 17px`);
    if (!colourMatch(intro.colour, "#bdb4dc")) out.push(`W2.4 intro colour ${intro.colour}, want #bdb4dc`);
    if (intro.width > 620 + Q11_TOL_PX) out.push(`W2.4 intro is ${num(intro.width, 0)}px wide, want at most 620px`);
  }
  return out;
}

// W3.1 to W3.2: five pills in order, 44 px tall, "A blank page" selected at load.
const W3_PILLS = ["The year ahead", "Work", "Family", "A decision", "A blank page"];
export function w3Failures({ pills }) {
  const out = [];
  const texts = pills.map((p) => p.text);
  if (texts.join("|") !== W3_PILLS.join("|")) out.push(`W3.1 pills are "${texts.join(", ")}", want "${W3_PILLS.join(", ")}"`);
  for (const p of pills) {
    if (!sizeWithin(p.height, 44)) out.push(`W3.2 pill "${p.text}" is ${num(p.height, 0)}px tall, want 44px`);
    const want = p.text === "A blank page" ? "true" : "false";
    if (p.pressed !== want) out.push(`W3.2 pill "${p.text}" aria-pressed ${p.pressed}, want ${want} at load`);
  }
  return out;
}

// W5.1, W5.3 and W5.5 on the Letter_Field. W5.2 is measured by checkRuledBaseline.
export function w5Failures({ field }) {
  if (!field) return ["W5.1 no #live-letter to measure"];
  const out = [];
  if (!sizeWithin(field.size, 21, 0)) out.push(`W5.1 Letter_Field is ${num(field.size, 0)}px, want 21px`);
  if (field.lineHeight !== "32px") out.push(`W5.1 Letter_Field line-height ${field.lineHeight}, want 32px`);
  if (!colourMatch(field.colour, "#1f1b16")) out.push(`W5.1 Letter_Field text ${field.colour}, want #1f1b16`);
  if (field.borderStyle !== "none") out.push(`W5.1 Letter_Field border style ${field.borderStyle}, want none`);
  if (!colourMatch(field.bg, "rgba(0, 0, 0, 0)")) out.push(`W5.1 Letter_Field background ${field.bg}, want transparent`);
  if (field.height < 296 - Q11_TOL_PX) out.push(`W5.3 Letter_Field is ${num(field.height, 0)}px tall, want at least 296px`);
  if (field.label !== "Your letter") out.push(`W5.5 Letter_Field label "${field.label}", want "Your letter"`);
  return out;
}

// W5.2: each ruled line sits under its baseline. The rules are a repeating gradient with a 1 px
// band at 31 px of every 32 px tile, and the tile starts at the field's background-position y
// (--rule-offset). Returns rule top minus baseline for the nearest rule, in px. Negative means
// the rule is above the baseline.
export function ruleGapPx(baseline, offset, lineHeight = 32, bandAt = 31) {
  const k = Math.round((baseline - offset - bandAt) / lineHeight);
  let best = null;
  for (const n of [k - 1, k, k + 1]) {
    const gap = offset + bandAt + n * lineHeight - baseline;
    if (best === null || Math.abs(gap) < Math.abs(best)) best = gap;
  }
  return best;
}

// W5.2 failures. `before` and `after` hold { line, gap } rows measured before and after the
// internal scroll of the Letter_Field. Each gap must pass baselineGapOk (at most 2 px).
export function w52Failures({ attachment, scrollTop, oneLinePerText, before, after }) {
  const out = [];
  if (oneLinePerText === false) out.push("W5.2 a measured line wraps in the Letter_Field, so baselines do not map to its lines (want one line per line of text)");
  if (!(scrollTop > 0)) out.push(`W5.2 the Letter_Field did not scroll inside itself (scrollTop ${num(scrollTop, 0)}px)`);
  if (attachment !== "local") out.push(`W5.2 Letter_Field background-attachment is ${attachment}, want local so the rules move with the text`);
  if (!before?.length || !after?.length) out.push("W5.2 no lines measured before and after the scroll");
  for (const [phase, rows] of [["before", before ?? []], ["after", after ?? []]]) {
    for (const { line, gap } of rows) {
      if (!baselineGapOk(gap)) out.push(`W5.2 line ${line} baseline is ${num(gap)}px from its rule ${phase} the scroll, want at most 2px`);
    }
  }
  return out;
}

// W7.1 to W7.6 on one Question_Row: disc, input, Lock_Line and Remove.
export function w7Failures({ row }) {
  if (!row) return ["W7.1 no [data-question-row] to measure"];
  const out = [];
  const { disc, input, lock, remove } = row;
  if (!disc) out.push("W7.2 no [data-wax-disc]");
  else {
    if (!sizeWithin(disc.width, 30)) out.push(`W7.2 Wax_Disc is ${num(disc.width, 0)}px, want 30px`);
    if (!colourMatch(disc.bg, "#ff7b1c")) out.push(`W7.2 Wax_Disc fill ${disc.bg}, want #ff7b1c`);
    if (!sizeWithin(disc.size, 13, 0)) out.push(`W7.2 Wax_Disc number is ${num(disc.size, 0)}px, want 13px`);
    if (disc.weight !== "800") out.push(`W7.2 Wax_Disc number weight ${disc.weight}, want 800`);
    if (!colourMatch(disc.colour, "#0b0912")) out.push(`W7.2 Wax_Disc number colour ${disc.colour}, want #0b0912`);
  }
  if (!input) out.push("W7.3 no question input");
  else {
    if (!sizeWithin(input.size, 21, 0)) out.push(`W7.3 question is ${num(input.size, 0)}px, want 21px`);
    if (input.italic !== "italic") out.push(`W7.3 question style ${input.italic}, want italic`);
    if (!colourMatch(input.colour, "#1f1b16")) out.push(`W7.3 question colour ${input.colour}, want #1f1b16`);
  }
  if (!lock) out.push("W7.5 no Lock_Line");
  else {
    if (!sizeWithin(lock.size, 13, 0)) out.push(`W7.5 Lock_Line is ${num(lock.size, 0)}px, want 13px`);
    if (!colourMatch(lock.colour, "#4a4036")) out.push(`W7.5 Lock_Line colour ${lock.colour}, want #4a4036`);
  }
  if (!remove) out.push("W7.6 no Remove control");
  else if (remove.w < 44 - Q11_TOL_PX || remove.h < 44 - Q11_TOL_PX) {
    out.push(`W7.6 Remove is ${num(remove.w, 0)}x${num(remove.h, 0)}px, want at least 44x44px`);
  }
  return out;
}

// W8.1, W8.2, W8.5 and W8.7: "Ask another:", suggestion pills and "+ Write my own".
export function askAnotherFailures({ rows, pills, askAnother, writeOwn }) {
  const out = [];
  if (rows < 3) {
    if (!askAnother) out.push("W8.1 no \"Ask another:\" line");
    if (pills.length > 2) out.push(`W8.1 ${pills.length} suggestion pills, want at most 2`);
  }
  for (const p of pills) {
    if (p.height < 40 - Q11_TOL_PX) out.push(`W8.2 pill is ${num(p.height, 0)}px tall, want at least 40px`);
    if (!colourMatch(p.border, "rgba(74,64,54,.35)") || !sizeWithin(p.borderW, 1, 0)) out.push(`W8.2 pill border ${p.border} ${p.borderW}px, want 1px rgba(74,64,54,.35)`);
    if (!sizeWithin(p.size, 17, 0) || p.style !== "italic") out.push(`W8.2 pill text is ${num(p.size, 0)}px ${p.style}, want 17px italic`);
    if (!p.text.startsWith("+ ")) out.push(`W8.2 pill "${p.text}" lacks the "+ " prefix`);
    if (!(p.name ?? "").startsWith("Add the question: ")) out.push(`W8.7 pill name "${p.name}", want "Add the question: {text}"`);
  }
  if (!writeOwn) out.push("W8.4 no \"+ Write my own\" control");
  else {
    if (!sizeWithin(writeOwn.size, 14, 0) || writeOwn.weight !== "600") out.push(`W8.7 "+ Write my own" is ${num(writeOwn.size, 0)}px weight ${writeOwn.weight}, want 14px 600`);
    if (writeOwn.name !== "Write my own") out.push(`W8.7 "+ Write my own" accessible name "${writeOwn.name}", want "Write my own"`);
  }
  return out;
}

// W9.1 and W9.5: the In_The_Envelope_Card style (shared by the W10 card) and its three Checklist_Lines.
export const CARD_STYLE = { bg: "#15111f", border: "#2a2340", radius: 10, padding: 24 };
export function cardStyleFailures(label, card) {
  if (!card) return [`${label} no card to measure`];
  const out = [];
  if (!colourMatch(card.bg, CARD_STYLE.bg)) out.push(`${label} card background ${card.bg}, want #15111f`);
  if (!sizeWithin(card.borderW, 1, 0) || !colourMatch(card.border, CARD_STYLE.border)) out.push(`${label} card border ${card.borderW}px ${card.border}, want 1px #2a2340`);
  if (!sizeWithin(card.radius, CARD_STYLE.radius, 0)) out.push(`${label} card radius ${num(card.radius, 0)}px, want 10px`);
  if (!sizeWithin(card.padding, CARD_STYLE.padding, 0)) out.push(`${label} card padding ${num(card.padding, 0)}px, want 24px`);
  return out;
}

export function w9Failures({ card, checklistCount }) {
  const out = cardStyleFailures("W9.1", card);
  if (checklistCount !== 3) out.push(`W9.5 ${checklistCount} Checklist_Lines, want 3`);
  return out;
}

// W10.3: the Receipt_Toggle, a 40 px pill pair with the active button solid white.
export function w10Failures({ card, toggle }) {
  const out = cardStyleFailures("W10", card);
  if (!toggle) return [...out, "W10.3 no Receipt_Toggle buttons"];
  if (!toggle.publicPressed || toggle.ownPressed) out.push("W10.3 \"A public price\" is not the active view at load");
  for (const b of [toggle.public, toggle.own]) {
    if (!b) continue;
    if (!sizeWithin(b.height, 40)) out.push(`W10.3 "${b.text}" is ${num(b.height, 0)}px tall, want 40px`);
  }
  const active = toggle.publicPressed ? toggle.public : toggle.own;
  if (active && (!colourMatch(active.bg, "#ffffff") || !colourMatch(active.colour, "#0b0912"))) {
    out.push(`W10.3 active view is ${active.bg} on ${active.colour}, want #ffffff with #0b0912 text`);
  }
  return out;
}

// W11.2, W11.3 and W11.4: unselected and selected Figure_Rows. Neither uses the Accent.
export function w11Failures({ rows }) {
  const out = [];
  for (const r of rows) {
    if (r.height < 56 - Q11_TOL_PX) out.push(`W11.2 row "${r.name}" is ${num(r.height, 0)}px tall, want at least 56px`);
    if (!sizeWithin(r.radius, 8, 0)) out.push(`W11.2 row "${r.name}" radius ${num(r.radius, 0)}px, want 8px`);
    if (r.pressed === "true") {
      if (!sizeWithin(r.borderW, 1.5, 0.01) || !colourMatch(r.border, "#ffffff")) out.push(`W11.4 selected row "${r.name}" border ${r.borderW}px ${r.border}, want 1.5px white`);
    } else if (!sizeWithin(r.borderW, 1, 0) || !colourMatch(r.border, "#2a2340") || !colourMatch(r.bg, "#0b0912")) {
      out.push(`W11.3 unselected row "${r.name}" is ${r.bg} with ${r.borderW}px ${r.border}, want #0b0912 and 1px #2a2340`);
    }
    if (isAccentRgb(r.bg) || isAccentRgb(r.border)) out.push(`W11.4 row "${r.name}" uses the Accent`);
  }
  return out;
}

function isAccentRgb(c) {
  const p = parseColour(c);
  return !!p && p[3] > 0 && p[0] === 255 && p[1] === 123 && p[2] === 28;
}

// W12.1 and W12.2: the own-number inputs, 44 px tall, 8 px radius, #0b0912 fill, 1px #3a3350 border.
export function w12Failures({ inputs }) {
  const out = [];
  const want = ["What is it?", "Amount", "Unit", "Where?"];
  const names = inputs.map((i) => i.label);
  if (names.join("|") !== want.join("|")) out.push(`W12.1 inputs are "${names.join(", ")}", want "${want.join(", ")}"`);
  for (const i of inputs) {
    if (!sizeWithin(i.height, 44)) out.push(`W12.1 "${i.label}" is ${num(i.height, 0)}px tall, want 44px`);
    if (!sizeWithin(i.radius, 8, 0)) out.push(`W12.1 "${i.label}" radius ${num(i.radius, 0)}px, want 8px`);
    if (!colourMatch(i.bg, "#0b0912") || !colourMatch(i.border, "#3a3350") || !sizeWithin(i.borderW, 1, 0)) {
      out.push(`W12.1 "${i.label}" fill ${i.bg} border ${i.borderW}px ${i.border}, want #0b0912 and 1px #3a3350`);
    }
  }
  return out;
}

// X2.1: activating a desk control twice leaves its state, the letter and the focus as one activation left them.
// A toggle (Figure_Row, Details) changes its state on the first activation and returns to its starting state on the
// second, so with `toggles` the check compares against `before` instead of the first activation.
export function x21Failures({ control, before = null, once, twice, toggles = false }) {
  const out = [];
  const pressedKey = (s) => JSON.stringify(s.pressed);
  if (toggles) {
    if (before && pressedKey(once) === pressedKey(before)) out.push(`X2.1 "${control}" showed no state change on its first activation`);
    if (before && pressedKey(twice) !== pressedKey(before)) out.push(`X2.1 "${control}" did not return to its starting state on its second activation`);
  } else if (pressedKey(once) !== pressedKey(twice)) {
    out.push(`X2.1 "${control}" changed the pressed states on its second activation`);
  }
  if (once.letter !== twice.letter) out.push(`X2.1 "${control}" changed the letter text on its second activation`);
  if (!twice.focused) out.push(`X2.1 focus left "${control}" after its second activation`);
  return out;
}

// T1.6, T2.1, T2.5 on the recall stage at 390x844: every part inside the First_Viewport.
export function t16Failures({ parts, w, h }) {
  const out = [];
  for (const p of parts) {
    if (!p.rect) out.push(`T1.6 no ${p.name} to measure`);
    else if (p.rect.top < 0 || p.rect.bottom > h || p.rect.left < 0 || p.rect.right > w) {
      out.push(`T1.6 ${p.name} is outside the First_Viewport`);
    }
  }
  return out;
}

// T1.6 at 200 characters: the answer typed into the Answer_Field must be exactly 200 characters, and the
// same parts stay inside the First_Viewport with that answer in place.
export const T16_ANSWER_LENGTH = 200;
export function t16LongAnswerFailures({ length, parts, w, h }) {
  const out = [];
  if (length !== T16_ANSWER_LENGTH) out.push(`T1.6 Answer_Field holds ${length} characters, want ${T16_ANSWER_LENGTH}`);
  return [...out, ...t16Failures({ parts, w, h })];
}

// T2.1: the number question's parts stay in one DOM order: question, sample note, answer field, main button.
export function t21Failures({ order }) {
  const want = ["question", "sample-note", "field", "button"];
  const seen = order.filter((n) => want.includes(n));
  if (seen.length !== want.length) return [`T2.1 parts found ${seen.join(", ") || "none"}, want ${want.join(", ")}`];
  return seen.join("|") === want.join("|") ? [] : [`T2.1 DOM order is ${seen.join(", ")}, want ${want.join(", ")}`];
}

// R1.2: the letter column centre within 8 px of the Scene_Frame centre, at least 600 px wide.
export function r12Failures({ column, frame, w, shiftPx }) {
  if (!column) return ["R1.2 no [data-letter-stage] to measure"];
  const out = [];
  if (!frame) out.push("R1.2 no [data-scene-frame] to centre against");
  else if (Math.abs((column.left + column.right) / 2 - (frame.left + frame.right) / 2) > 8) out.push("R1.2 letter column is more than 8px off the Scene_Frame centre");
  if (column.width < 600) out.push(`R1.2 letter column is ${num(column.width, 0)}px wide, want at least 600px`);
  if (shiftPx !== null && shiftPx > Q11_TOL_PX) out.push(`R1.2 letter column moved ${num(shiftPx)}px when the ghost left`);
  return out;
}

// R2.2: no [data-crease] box meets a letter line box.
export function r22Failures({ creases, lines }) {
  const out = [];
  for (const c of creases) {
    const hit = lines.find((l) => rectsIntersect(c, l));
    if (hit) out.push(`R2.2 crease meets the letter line "${hit.text}"`);
  }
  return out;
}

// R3: the two actions after reading, in the text colour, outlined, border at 3:1 or more against the surface.
export function r3Failures({ controls }) {
  const out = [];
  if (controls.length === 0) return ["R3 no stage2Next or Show everything control to measure"];
  for (const c of controls) {
    if (!colourMatch(c.colour, "#ffffff")) out.push(`R3 "${c.text}" text ${c.colour}, want #ffffff`);
    if (!sizeWithin(c.borderW, 1, 0)) out.push(`R3 "${c.text}" border ${c.borderW}px, want 1px`);
    if (isAccentRgb(c.bg) || isAccentRgb(c.border) || isAccentRgb(c.colour)) out.push(`R3 "${c.text}" uses the Accent`);
    const { ok, ratio, min } = contrastOk(c.border, c.surface, { large: true });
    if (!ok) out.push(`R3 "${c.text}" border contrast ${ratio.toFixed(2)}:1, want at least ${min}:1`);
  }
  return out;
}

// R6.1: no two line labels intersect, and two labels in one row keep LINE_LABEL_GAP_PX apart.
export const LINE_LABEL_GAP_PX_QA = 6; // mirrors LINE_LABEL_GAP_PX in src/components/ceremony/constants.ts
export function r61Failures({ labels }) {
  const out = [];
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i];
      const b = labels[j];
      if (rectsIntersect(a, b)) {
        out.push(`R6.1 line labels "${a.text}" and "${b.text}" intersect`);
        continue;
      }
      const sameRow = a.top < b.bottom && b.top < a.bottom;
      if (sameRow) {
        const gap = a.right <= b.left ? b.left - a.right : a.left - b.right;
        if (gap >= 0 && gap < LINE_LABEL_GAP_PX_QA) out.push(`R6.1 line labels are ${num(gap)}px apart, want at least ${LINE_LABEL_GAP_PX_QA}px`);
      }
    }
  }
  return out;
}

// B1.2: every Top_Bar slot keeps its x and width across the steps, and the bar keeps its height.
// Skip is measured in each of its two states. `skip` ("disabled" or "enabled") picks the
// steps where Skip is in that state, and the first of those steps is the reference.
export function b12Failures({ steps, skip }) {
  const out = [];
  const wantDisabled = skip === "disabled";
  const inState = steps.filter((s) => s.skipDisabled === wantDisabled);
  const tag = `B1.2 Skip ${skip}`;
  const [first, ...rest] = inState;
  if (!first) return [`${tag} no step with Skip ${skip} to measure`];
  for (const s of rest) {
    for (const name of Object.keys(first.slots)) {
      const a = first.slots[name];
      const b = s.slots[name];
      if (!b) out.push(`${tag} slot "${name}" missing at ${s.label}`);
      else if (!slotStable(a, b)) out.push(`${tag} slot "${name}" moved from ${num(a.left, 0)}px to ${num(b.left, 0)}px at ${s.label}`);
    }
    if (!sizeWithin(s.barHeight, first.barHeight)) out.push(`${tag} bar is ${num(s.barHeight, 0)}px at ${s.label}, was ${num(first.barHeight, 0)}px`);
  }
  return out;
}

// B1.4: the persona notice is text in the Top_Bar, once.
export function b14Failures({ count, inBar }) {
  if (count !== 1) return [`B1.4 persona notice appears ${count} times, want once`];
  return inBar ? [] : ["B1.4 persona notice is not inside the Top_Bar"];
}

// B1.5: the persona page's bar at 360x640 and 390x844 stays at most 96 px tall with the notice and Skip.
export function b15Failures({ barHeight }) {
  if (barHeight === null) return ["B1.5 no Top_Bar to measure"];
  return barHeight > 96 ? [`B1.5 bar is ${num(barHeight, 0)}px tall, want at most 96px`] : [];
}

// B2.1: no visible text box meets the soil strip.
export function b21Failures({ strip, texts }) {
  if (!strip) return ["B2.1 no [data-soil-strip] to measure"];
  return texts.filter((t) => rectsIntersect(strip, t)).map((t) => `B2.1 text "${t.text}" meets the soil strip`);
}

// D1.1 to D1.3: the /demo wordmark line-up and the live entry card against a persona card.
export function d1Failures({ wordmarkLeft, card, personaCard, scrollWidth, clientWidth }) {
  const out = [];
  if (!card) return ["D1 no [data-live-entry-card] to measure"];
  if (wordmarkLeft === null || !sizeWithin(card.left, wordmarkLeft)) out.push(`D1.1 card left ${num(card.left, 0)}px, wordmark left ${num(wordmarkLeft, 0)}px`);
  if (!personaCard) out.push("D1.2 no persona card to compare with");
  else {
    if (!sizeWithin(card.width, personaCard.width)) out.push(`D1.2 card is ${num(card.width, 0)}px wide, a persona card ${num(personaCard.width, 0)}px`);
    if (!colourMatch(card.border, personaCard.border)) out.push(`D1.2 card border ${card.border}, a persona card ${personaCard.border}`);
  }
  if (scrollWidth > clientWidth) out.push(`D1.3 horizontal scroll: scrollWidth ${scrollWidth}px > ${clientWidth}px`);
  return out;
}

// --- Browser reads, part 2 --------------------------------------------------

const Q11_TEXT = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

const W2_READ = () => {
  const pick = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { size: parseFloat(s.fontSize), weight: s.fontWeight, colour: s.color, width: el.getBoundingClientRect().width };
  };
  const h1s = [...document.querySelectorAll("h1")];
  const h1 = h1s[0] ?? null;
  const eyebrow = [...document.querySelectorAll("p, span, div")].find((e) => e.children.length === 0 && (e.textContent ?? "").trim() === "Seal your own letter") ?? null;
  const intro = [...document.querySelectorAll("p")].find((e) => (e.textContent ?? "").trim().startsWith("Say where things stand today.")) ?? null;
  return {
    h1Count: h1s.length,
    h1: h1 ? { ...pick(h1), text: (h1.textContent ?? "").trim() } : null,
    eyebrow: pick(eyebrow),
    intro: pick(intro),
  };
};

const W3_READ = () => ({
  pills: [...document.querySelectorAll("[data-occasion-pill]")].map((b) => ({
    text: (b.textContent ?? "").trim(),
    height: b.getBoundingClientRect().height,
    pressed: b.getAttribute("aria-pressed"),
  })),
});

const W5_READ = () => {
  const f = document.querySelector("#live-letter");
  if (!f) return null;
  const s = getComputedStyle(f);
  const label = f.labels && f.labels[0] ? (f.labels[0].textContent ?? "").trim() : f.getAttribute("aria-label");
  return { size: parseFloat(s.fontSize), lineHeight: s.lineHeight, colour: s.color, borderStyle: s.borderTopStyle, bg: s.backgroundColor, height: f.getBoundingClientRect().height, label };
};

const W7_READ = () => {
  const row = document.querySelector("[data-question-row]");
  if (!row) return null;
  const disc = row.querySelector("[data-wax-disc]");
  const input = row.querySelector("input");
  const lock = [...row.querySelectorAll("*")].find((e) => e.children.length === 0 && (e.textContent ?? "").trim().startsWith("Answered on opening day")) ?? null;
  const remove = [...row.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().startsWith("Remove question")) ?? null;
  const d = disc ? getComputedStyle(disc) : null;
  const i = input ? getComputedStyle(input) : null;
  const l = lock ? getComputedStyle(lock) : null;
  const rr = remove ? remove.getBoundingClientRect() : null;
  return {
    disc: disc ? { width: disc.getBoundingClientRect().width, bg: d.backgroundColor, size: parseFloat(d.fontSize), weight: d.fontWeight, colour: d.color } : null,
    input: input ? { size: parseFloat(i.fontSize), italic: i.fontStyle, colour: i.color } : null,
    lock: lock ? { size: parseFloat(l.fontSize), colour: l.color } : null,
    remove: rr ? { w: rr.width, h: rr.height } : null,
  };
};

const ASK_READ = () => {
  const pills = [...document.querySelectorAll("[data-suggestion-pill]")].map((p) => {
    const s = getComputedStyle(p);
    return {
      height: p.getBoundingClientRect().height,
      border: s.borderTopColor,
      borderW: parseFloat(s.borderTopWidth),
      size: parseFloat(s.fontSize),
      style: s.fontStyle,
      text: (p.textContent ?? "").trim(),
      name: p.getAttribute("aria-label"),
    };
  });
  const askAnother = [...document.querySelectorAll("p, span, div")].some((e) => e.children.length === 0 && (e.textContent ?? "").trim() === "Ask another:");
  const wo = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === "+ Write my own") ?? null;
  const woS = wo ? getComputedStyle(wo) : null;
  return {
    rows: document.querySelectorAll("[data-question-row]").length,
    pills,
    askAnother,
    writeOwn: wo ? { size: parseFloat(woS.fontSize), weight: woS.fontWeight, name: wo.getAttribute("aria-label") ?? (wo.textContent ?? "").trim() } : null,
  };
};

const CARD_READ = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return null;
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, border: s.borderTopColor, borderW: parseFloat(s.borderTopWidth), radius: parseFloat(s.borderTopLeftRadius), padding: parseFloat(s.paddingTop) };
};

const W11_READ = () =>
  [...document.querySelectorAll("[data-figure-row]")].map((b) => {
    const s = getComputedStyle(b);
    return {
      name: (b.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
      height: b.getBoundingClientRect().height,
      radius: parseFloat(s.borderTopLeftRadius),
      border: s.borderTopColor,
      borderW: parseFloat(s.borderTopWidth),
      bg: s.backgroundColor,
      pressed: b.getAttribute("aria-pressed"),
    };
  });

const W12_READ = () => {
  const box = document.querySelector("[data-own-number]");
  if (!box) return null;
  return [...box.querySelectorAll("input")].map((i) => {
    const s = getComputedStyle(i);
    const labelEl = i.labels && i.labels[0];
    const label = labelEl ? (labelEl.textContent ?? "").trim() : (i.getAttribute("aria-label") ?? "");
    return { label, height: i.getBoundingClientRect().height, radius: parseFloat(s.borderTopLeftRadius), bg: s.backgroundColor, border: s.borderTopColor, borderW: parseFloat(s.borderTopWidth) };
  });
};

const DESK_STATE_READ = () => {
  const desk = document.querySelector("[data-write-desk]") ?? document.body;
  const pressed = [...desk.querySelectorAll("[aria-pressed], [aria-expanded]")].map(
    (b) => `${(b.textContent ?? "").trim()}=${b.getAttribute("aria-pressed") ?? ""}/${b.getAttribute("aria-expanded") ?? ""}`,
  );
  const letter = document.querySelector("#live-letter")?.value ?? null;
  const el = document.activeElement;
  const focused = el && el !== document.body ? (el.textContent ?? "").trim() || el.getAttribute("aria-label") || el.id || el.tagName.toLowerCase() : null;
  return { pressed, letter, focused };
};

const T_READ = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  };
  const question = document.querySelector("[data-stage-heading], h2");
  const field = document.querySelector("textarea, input[type='text']");
  const button = document.querySelector("[data-primary-control]");
  const counter = document.querySelector("[data-recall-counter]");
  const note = document.querySelector("[data-sample-note]");
  const order = [];
  const seq = [["question", question], ["sample-note", note], ["field", field], ["button", button]];
  for (const [name, el] of seq) if (el) order.push({ name, el });
  order.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return {
    parts: [
      { name: "counter", rect: rect(counter) },
      { name: "question", rect: rect(question) },
      { name: "Answer_Field", rect: rect(field) },
      { name: "main button", rect: rect(button) },
    ],
    order: order.map((o) => o.name),
    hasNote: !!note,
    noteRect: rect(note),
    w: window.innerWidth,
    h: window.innerHeight,
  };
};

const R_READ = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const column = document.querySelector("[data-letter-stage]");
  const frame = document.querySelector("[data-scene-frame]");
  const creases = [...document.querySelectorAll("[data-crease]")].map(rect);
  const textEl = document.querySelector("[data-letter-text]");
  const lines = [];
  if (textEl) {
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        lines.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: (node.textContent ?? "").trim().slice(0, 24) });
      }
      node = walker.nextNode();
    }
  }
  const labels = [...document.querySelectorAll("[data-line-label]")].map((el) => ({ ...rect(el), text: (el.textContent ?? "").trim().slice(0, 24) }));
  const controls = [...document.querySelectorAll("[data-advance], button")]
    .filter((b) => b.getAttribute("data-advance") !== null || /^(Show everything|Skip to the receipts)$/.test((b.textContent ?? "").trim()))
    .map((b) => {
      const s = getComputedStyle(b);
      const surface = (() => {
        let el = b.parentElement;
        while (el) {
          const bg = getComputedStyle(el).backgroundColor;
          if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
          el = el.parentElement;
        }
        return "rgb(11, 9, 18)";
      })();
      return { text: (b.textContent ?? "").trim(), colour: s.color, bg: s.backgroundColor, borderW: parseFloat(s.borderTopWidth), border: s.borderTopColor, surface };
    });
  return { column: rect(column), frame: rect(frame), creases, lines, labels, controls, w: window.innerWidth };
};

const B_READ = () => {
  const bar = document.querySelector("[data-topbar]") ?? document.querySelector("header");
  const slots = {};
  for (const el of document.querySelectorAll("[data-topbar-slot]")) {
    const r = el.getBoundingClientRect();
    slots[el.getAttribute("data-topbar-slot")] = { left: r.left, width: r.width };
  }
  const notice = [...document.querySelectorAll("[data-topbar-slot='notice']")];
  const skip = document.querySelector("[data-topbar-slot='skip']");
  return { barHeight: bar ? bar.getBoundingClientRect().height : null, slots, skipDisabled: skip ? skip.disabled === true : null, noticeCount: notice.length, noticeInBar: notice.every((n) => !!bar && bar.contains(n)) };
};

const B21_READ = () => {
  const strip = document.querySelector("[data-soil-strip]");
  const texts = [...document.querySelectorAll("p, h1, h2, h3, li, a, button")]
    .filter((e) => e.getClientRects().length > 0 && (e.textContent ?? "").trim().length > 0)
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: (e.textContent ?? "").trim().slice(0, 24) };
    });
  const s = strip ? strip.getBoundingClientRect() : null;
  return { strip: s ? { left: s.left, top: s.top, right: s.right, bottom: s.bottom } : null, texts };
};

const D_READ = () => {
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, width: r.width };
  };
  const card = document.querySelector("[data-live-entry-card]");
  const wordmark = document.querySelector("[data-wordmark]");
  const personaLink = document.querySelector("a[href^='/demo/personas/']");
  const personaCard = personaLink ? personaLink.closest("article, li, div") : null;
  const cs = card ? getComputedStyle(card) : null;
  const pcs = personaCard ? getComputedStyle(personaCard) : null;
  return {
    card: card ? { ...rect(card), border: cs.borderTopColor } : null,
    wordmarkLeft: wordmark ? rect(wordmark).left : null,
    personaCard: personaCard ? { ...rect(personaCard), border: pcs.borderTopColor } : null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
};

// --- Row runners, part 2 ----------------------------------------------------

// X2.1 for one desk control: activate it twice and emit one result line named X2.1.
// `leavesDesk` marks Fold_Button: a passing fold moves the desk to Seal, so a missing desk after the first press is a pass.
async function x21Control(page, ctx, { name, locator, toggles = false, leavesDesk = false }) {
  const slug = `desk-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const target = locator.first();
  if ((await target.count()) === 0) {
    report(ctx, missingRow("X2.1", slug, `no ${name} control on the desk`));
    return;
  }
  let before;
  let once;
  let twice;
  try {
    before = await page.evaluate(DESK_STATE_READ);
    await target.click({ timeout: 3000 });
    await sleep(200);
    if (leavesDesk && (await page.locator("[data-write-desk]").count()) === 0) {
      report(ctx, result("X2.1", slug, "pass", `control="${name}" moved the desk to Seal on its first activation (X2.1 table: passes moves to Seal) viewport=${ctx.size}`));
      return;
    }
    once = await page.evaluate(DESK_STATE_READ);
    await target.click({ timeout: 3000 });
    await sleep(200);
    twice = await page.evaluate(DESK_STATE_READ);
  } catch (error) {
    const reason = String(error.message ?? error).split("\n")[0];
    report(ctx, result("X2.1", slug, "fail", `X2.1 "${name}" could not be activated twice: ${reason} viewport=${ctx.size}`));
    return;
  }
  report(ctx, verdictRow("X2.1", slug, x21Failures({ control: name, before, once, twice, toggles }), `control="${name}" viewport=${ctx.size}`, "each desk control activated twice: same state, letter and focus"));
}

// X2.1 over every desk control in the design's X2.1 table, in an order that keeps each control reachable.
// Rows are filled to two before Remove, so its second press still has a row to remove.
async function runX21Controls(page, ctx) {
  const writeOwn = () => page.getByRole("button", { name: "Write my own", exact: true });
  await x21Control(page, ctx, { name: "Occasion pill Work", locator: page.getByRole("button", { name: "Work", exact: true }) });
  await x21Control(page, ctx, { name: "Suggestion pill", locator: page.locator('[data-add-row]:not([aria-label="Write my own"])') });
  // "Ask another:" is a text label on the desk, not a control: its pills are the Suggestion pill row above.
  report(ctx, result("X2.1", "desk-ask-another", "note", `"Ask another:" is a text label, not a control; its pills are checked as desk-suggestion-pill viewport=${ctx.size}`));
  // The Add a letter control named in the Testing Strategy: absent on this build, so the row reports missing.
  await x21Control(page, ctx, { name: "Add a letter", locator: page.getByRole("button", { name: "Add a letter", exact: true }) });
  await x21Control(page, ctx, { name: "+ Write my own", locator: writeOwn() });
  for (let i = 0; i < 2 && (await page.locator("[data-question-row]").count()) < 2; i++) {
    if (await present(writeOwn())) await writeOwn().click().catch(() => {});
    await sleep(200);
  }
  await x21Control(page, ctx, { name: "Remove", locator: page.getByRole("button", { name: /^Remove/ }) });
  const publicPrice = () => page.getByRole("button", { name: "A public price", exact: true });
  // The receipt toggle is the Receipt_Toggle pair: both buttons are pressed twice here.
  await x21Control(page, ctx, { name: "A public price", locator: publicPrice() });
  await x21Control(page, ctx, { name: "A number of my own", locator: page.getByRole("button", { name: "A number of my own", exact: true }) });
  const inputs = page.locator("[data-own-number] input");
  const inputCount = await inputs.count();
  if (inputCount === 0) report(ctx, missingRow("X2.1", "desk-own-number-input", "no [data-own-number] input on the desk"));
  for (let i = 0; i < inputCount; i++) {
    await x21Control(page, ctx, { name: `own-number input ${i + 1}`, locator: inputs.nth(i) });
  }
  if (await present(publicPrice())) await publicPrice().click().catch(() => {});
  await sleep(200);
  await x21Control(page, ctx, { name: "Figure_Row", locator: page.locator("[data-figure-row]"), toggles: true });
  await x21Control(page, ctx, { name: "Details", locator: page.locator("[data-figure-details]"), toggles: true });
  await x21Control(page, ctx, { name: "Fold_Button", locator: page.locator("[data-fold-button]"), leavesDesk: true });
}

// W2, W3, W5, W7 to W12, W13.4 and X2.1 on the Write step. Run after checkWriteDesk.
async function checkWriteRows(page, ctx) {
  const w2 = await page.evaluate(W2_READ);
  const phone = ctx.w < PHONE_WIDTH_MAX;
  report(ctx, verdictRow("W2", "write-header", w2Failures({ ...w2, phone }), `viewport=${ctx.size}`, "eyebrow 12 px, one h1 at 56 px (36 px on a phone), intro 17 px within 620 px"));

  const w3 = await page.evaluate(W3_READ);
  report(ctx, w3.pills.length ? verdictRow("W3", "occasion-pills", w3Failures(w3), `pills=${w3.pills.length} viewport=${ctx.size}`, "five pills in order, 44 px, \"A blank page\" selected at load") : missingRow("W3", "occasion-pills", "no [data-occasion-pill]"));

  const w5 = await page.evaluate(W5_READ);
  report(ctx, w5 ? verdictRow("W5", "letter-field", w5Failures({ field: w5 }), `height=${num(w5.height, 0)} viewport=${ctx.size}`, "21 px text on 32 px lines, no border, transparent, at least 296 px tall, labelled \"Your letter\"") : missingRow("W5", "letter-field", "no #live-letter"));

  await clickIfPresent(page.getByRole("button", { name: "Write my own", exact: true }));
  await sleep(300);
  const w7 = await page.evaluate(W7_READ);
  report(ctx, w7 ? verdictRow("W7", "question-row", w7Failures({ row: w7 }), `viewport=${ctx.size}`, "Wax_Disc 30 px, 21 px question, 13 px Lock_Line, Remove at least 44 px") : missingRow("W7", "question-row", "no [data-question-row] after \"+ Write my own\""));
  const w8 = await page.evaluate(ASK_READ);
  report(ctx, verdictRow("W8", "ask-another", askAnotherFailures({ rows: w8.rows, pills: w8.pills, askAnother: w8.askAnother, writeOwn: w8.writeOwn }), `rows=${w8.rows} pills=${w8.pills.length} viewport=${ctx.size}`, "\"Ask another:\", pills of at least 40 px with the W8.2 border and type, \"+ Write my own\" at 14 px 600"));

  const w9 = await page.evaluate(CARD_READ, "[data-in-envelope]");
  const checklistCount = await page.evaluate(() => document.querySelectorAll("[data-checklist] li, [data-checklist] > *").length);
  report(ctx, w9 ? verdictRow("W9", "in-envelope-card", w9Failures({ card: w9, checklistCount }), `viewport=${ctx.size}`, "card #15111f, 1px #2a2340, 10 px radius, 24 px padding, three Checklist_Lines") : missingRow("W9", "in-envelope-card", "no [data-in-envelope]"));

  const card10 = await page.evaluate(CARD_READ, "[data-receipt-panel]");
  const toggle = await page.evaluate(() => {
    const find = (t) => [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t) ?? null;
    const pub = find("A public price");
    const own = find("A number of my own");
    const read = (b) => (b ? { text: (b.textContent ?? "").trim(), height: b.getBoundingClientRect().height, bg: getComputedStyle(b).backgroundColor, colour: getComputedStyle(b).color } : null);
    return { public: read(pub), own: read(own), publicPressed: pub?.getAttribute("aria-pressed") === "true", ownPressed: own?.getAttribute("aria-pressed") === "true" };
  });
  report(ctx, card10 ? verdictRow("W10", "receipt-card", w10Failures({ card: card10, toggle }), `viewport=${ctx.size}`, "card style, Receipt_Toggle with 40 px buttons, \"A public price\" active") : missingRow("W10", "receipt-card", "no [data-receipt-panel]"));

  const figures = await page.evaluate(W11_READ);
  report(ctx, figures.length ? verdictRow("W11", "public-price-rows", w11Failures({ rows: figures }), `rows=${figures.length} viewport=${ctx.size}`, "rows at least 56 px, 8 px radius, unselected #0b0912 with 1px #2a2340, no Accent") : missingRow("W11", "public-price-rows", "no [data-figure-row] (no series offered on this build)"));

  await clickIfPresent(page.getByRole("button", { name: "A number of my own", exact: true }));
  await sleep(200);
  const w12 = await page.evaluate(W12_READ);
  report(ctx, w12 ? verdictRow("W12", "own-number", w12Failures({ inputs: w12 }), `inputs=${w12.length} viewport=${ctx.size}`, "four 44 px inputs, 8 px radius, #0b0912 fill, 1px #3a3350 border") : missingRow("W12", "own-number", "no [data-own-number]"));
  await clickIfPresent(page.getByRole("button", { name: "A public price", exact: true }));

  const rehearsal = await page.evaluate(() => document.querySelectorAll("[data-live-rehearsal]").length);
  report(ctx, verdictRow("W13.4", "rehearsal-line", rehearsal === 1 ? [] : [`${rehearsal} rehearsal lines, want 1`], `count=${rehearsal} viewport=${ctx.size}`, "the Rehearsal_Line once on the Write step"));

  await runX21Controls(page, ctx);
}

// T1.6, T2.1 and T2.5 on the persona recall stage at 390x844, and R1.2, R2.2, R3 and R6.1 after the reveal.
async function checkPersonaRows(browser, base, p, size, rep, required) {
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: null, required, memo: {}, ghostHook: false, persona: p.key };
  rep.setContext(ctx);
  rep.log(`\n==== ${size} (${p.key} Q1.1 rows) ====`);
  const page = await newPage(context);
  try {
    rep.stage(`${p.key}-recall`);
    const res = await page.goto(`${base}${p.path}`, { waitUntil: "load" });
    if (!res || res.status() !== 200) {
      rep.add("note", "persona", `${p.path} answered HTTP ${res?.status() ?? "none"}; rows not measured`);
      return;
    }
    const first = await reachRecall(page);
    if (first === "pickup") {
      await page.getByRole("button", { name: PICK_UP, exact: true }).click({ timeout: WAIT_MS });
      await waitForStage(page, "recall");
    }
    await sleep(1500);
    await guard(ctx, "GC1", () => checkRecallRows15(page, ctx));
    if (w === 390) {
      const t = await page.evaluate(T_READ);
      report(ctx, verdictRow("T1.6", "recall-viewport", t16Failures({ parts: t.parts, w: t.w, h: t.h }), `persona=${p.key} viewport=${ctx.size}`, "counter, question, Answer_Field and main button inside the First_Viewport"));
      if (t.hasNote) {
        report(ctx, verdictRow("T2.5", "sample-note-viewport", t.noteRect && t.noteRect.bottom <= t.h && t.noteRect.top >= 0 ? [] : ["T2.5 Sample_Note is outside the First_Viewport"], `persona=${p.key} viewport=${ctx.size}`, "a figure question's Sample_Note inside the First_Viewport"));
      } else {
        report(ctx, result("T2.5", "sample-note-viewport", "missing", `${p.key} recall shows a text question first; the figure question is not reached by this check`));
      }
      report(ctx, verdictRow("T2.1", "question-part-order", t21Failures({ order: t.order }), `persona=${p.key} order=${t.order.join(",")}`, "question, Sample_Note, Answer_Field and main button in that DOM order"));
    }
    await guard(ctx, "B1.5", async () => {
      if (w === 390 || w === 360) {
        const b = await page.evaluate(B_READ);
        report(ctx, verdictRow("B1.5", "persona-bar", b.barHeight === null ? ["B1.5 no Top_Bar to measure"] : b15Failures({ barHeight: b.barHeight }), `bar=${num(b.barHeight, 0)}px viewport=${ctx.size}`, "Top_Bar at most 96 px on the persona page"));
        report(ctx, verdictRow("B1.4", "persona-notice", b14Failures({ count: b.noticeCount, inBar: b.noticeInBar }), `notices=${b.noticeCount} viewport=${ctx.size}`, "the persona notice once, inside the Top_Bar"));
      }
    });

    // T1.6 at 200 characters: type exactly 200 characters into the answer field, then check the parts again.
    await guard(ctx, "T1.6-200", async () => {
      if (w !== 390 || h !== 844) return;
      const field = page.locator("textarea, input[type='text']").first();
      if ((await field.count()) === 0) {
        report(ctx, missingRow("T1.6", "recall-viewport-200", `${p.key} recall has no Answer_Field to type into`));
        return;
      }
      await field.fill(T16_ANSWER);
      await sleep(800);
      const t = await page.evaluate(T_READ);
      const length = (await field.inputValue()).length;
      report(ctx, verdictRow("T1.6", "recall-viewport-200", t16LongAnswerFailures({ length, parts: t.parts, w: t.w, h: t.h }), `persona=${p.key} length=${length} viewport=${ctx.size}`, `200-character answer; counter, question, Answer_Field and main button inside the First_Viewport`));
    });

    if (w === 1440) {
      const show = page.getByRole("button", { name: SHOW_ALL_LABEL }).first();
      if ((await show.count()) > 0) await show.click().catch(() => {});
      await sleep(1500);
      const r = await page.evaluate(R_READ);
      report(ctx, r.column && !r.frame ? missingRow("R1.2", "letter-column", "no [data-scene-frame] to centre against") : verdictRow("R1.2", "letter-column", r.column ? r12Failures({ column: r.column, frame: r.frame, w: r.w, shiftPx: null }) : ["R1.2 no [data-letter-stage] to measure"], `column=${r.column ? num(r.column.width, 0) : "n/a"}px viewport=${ctx.size}`, "letter column centred on the Scene_Frame and at least 600 px wide"));
      if (r.lines.length === 0) report(ctx, missingRow("R2.2", "crease-lines", "no [data-letter-text]"));
      else report(ctx, verdictRow("R2.2", "crease-lines", r22Failures({ creases: r.creases, lines: r.lines }), `creases=${r.creases.length} lines=${r.lines.length} viewport=${ctx.size}`, "no [data-crease] meets a letter line"));
      report(ctx, r.controls.length ? verdictRow("R3", "reveal-actions", r3Failures({ controls: r.controls }), `controls=${r.controls.length} viewport=${ctx.size}`, "two outlined white controls, 1px border at 3:1 against their surface") : missingRow("R3", "reveal-actions", "no reveal action buttons"));
      report(ctx, r.labels.length ? verdictRow("R6.1", "line-labels", r61Failures({ labels: r.labels }), `labels=${r.labels.length} persona=${p.key}`, "no line label meets another, 6 px apart in one row") : missingRow("R6.1", "line-labels", `no [data-line-label] on ${p.key}`));
    }
  } catch (error) {
    rep.add("note", "persona", `could not run: ${String(error.message ?? error).split("\n")[0]}`);
  } finally {
    await page.close();
    await context.close();
  }
}

// B1.2 on /demo/live: the Top_Bar slots across the Write and Seal steps at the Phone sizes.
// Pure helpers first, so tests can call them without a browser.

// The text for each [data-answer-input], in page order. The Write step needs every
// question answered before the fold (spec 15, R7.1), as the Live_Walk write step does.
export function fillAnswerTexts(count) {
  const out = [];
  for (let i = 1; i <= count; i += 1) out.push(`Walk answer to question ${i}`);
  return out;
}

// A missing [data-seal-step] after the fold is a note, not a thrown error, so the rows
// after this check (checkDemoRows, checkPersonaRows, checkSoilStrips) still run.
// Returns null when the seal step was found.
export function topBarSealStepNote(found) {
  return found ? null : "B1.2 no [data-seal-step] after Fold it and press the seal; the Top_Bar rows on the seal step are not measured";
}

async function checkTopBarSteps(browser, base, size, rep, required) {
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: "live", required, memo: {}, ghostHook: false };
  rep.setContext(ctx);
  try {
    const page = await newPage(context);
    const res = await page.goto(`${base}${LIVE_PATH}`, { waitUntil: "load" });
    if (!res || res.status() !== 200) return;
    await page.evaluate(() => document.fonts.ready);
    await sleep(500);
    const steps = [{ label: "write", ...(await page.evaluate(B_READ)) }];
    await need(page.locator("#live-letter"), "#live-letter on /demo/live; the B1.2 Top_Bar rows are not measured");
    await page.fill("#live-letter", DESK_LETTER);
    const answers = page.locator("[data-answer-input]");
    const answerTexts = fillAnswerTexts(await answers.count());
    for (let i = 0; i < answerTexts.length; i += 1) {
      await answers.nth(i).fill(answerTexts[i]);
    }
    await page.getByRole("button", { name: FOLD_LABEL }).click();
    const sealFound = await page
      .waitForSelector("[data-seal-step]", { timeout: WAIT_MS })
      .then(() => true, () => false);
    const note = topBarSealStepNote(sealFound);
    if (note) {
      rep.add("note", "B1.2", note);
    } else {
      await sleep(800);
      steps.push({ label: "seal", ...(await page.evaluate(B_READ)) });
      // B1.2 has two results, one per Skip state. A state no step reached is reported missing, not passed.
      for (const skip of ["disabled", "enabled"]) {
        const name = `topbar-skip-${skip}`;
        const reached = steps.filter((s) => s.skipDisabled === (skip === "disabled")).map((s) => s.label);
        if (!reached.length) {
          report(ctx, missingRow("B1.2", name, `no step on /demo/live with Skip ${skip}`));
        } else {
          report(ctx, verdictRow("B1.2", name, b12Failures({ steps, skip }), `skip=${skip} steps=${reached.join(",")} viewport=${ctx.size}`, "each Top_Bar slot keeps its x and width (1 px) and the bar its height"));
        }
      }
    }
    await page.close();
  } finally {
    await context.close();
  }
}

// B2.1 on the listed pages at top, half and end scroll. Desktop size.
export const SOIL_SIZE = "1440x900";
export const SOIL_PAGES = [["/", "landing"], ["/demo", "demo"], [PERSONA_PATH, "persona"], [LIVE_PATH, "live"]];

async function checkSoilStrips(browser, base, rep, required, scope = {}) {
  const size = SOIL_SIZE;
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: "soil", required, memo: {}, ghostHook: false };
  rep.setContext(ctx);
  const pages = SOIL_PAGES.filter(([, group]) => sectionRuns({ group }, scope)).map(([path]) => path);
  try {
    for (const path of pages) {
      const page = await newPage(context);
      try {
        const res = await page.goto(`${base}${path}`, { waitUntil: "load" });
        if (!res || res.status() !== 200) {
          rep.add("note", "B2.1", `${path} answered HTTP ${res?.status() ?? "none"}; not measured`);
          continue;
        }
        await page.evaluate(() => document.fonts.ready);
        await sleep(600);
        const problems = [];
        for (const where of ["top", "half", "end"]) {
          await page.evaluate((mode) => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            window.scrollTo(0, mode === "top" ? 0 : mode === "half" ? max / 2 : max);
          }, where);
          await sleep(300);
          const r = await page.evaluate(B21_READ);
          problems.push(...b21Failures(r).map((m) => `${where}: ${m}`));
          if (!r.strip) break;
        }
        report(ctx, await page.evaluate(() => !!document.querySelector("[data-soil-strip]"))
          ? verdictRow("B2.1", "soil-text", problems, `page=${path} viewport=${ctx.size}`, "no visible text box meets the soil strip at top, half or end scroll")
          : result("B2.1", "soil-text", "missing", `not on this build: ${path} has no [data-soil-strip]`));
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }
}

// D1.1 to D1.3 on /demo. Each row prints SKIP when the live entry card is absent (group D not merged).
async function checkDemoRows(browser, base, size, rep, required) {
  const [w, h] = parseSize(size);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const ctx = { size, w, h, base, rep, stage: "demo", required, memo: {}, ghostHook: false };
  rep.setContext(ctx);
  try {
    const page = await newPage(context);
    const res = await page.goto(`${base}/demo`, { waitUntil: "load" });
    if (!res || res.status() !== 200) return;
    await page.evaluate(() => document.fonts.ready);
    await sleep(500);
    const d = await page.evaluate(D_READ);
    if (!d.card) {
      for (const id of ["D1.1", "D1.2", "D1.3"]) report(ctx, result(id, "demo-page", "missing", "SKIP: no [data-live-entry-card] (group D not merged)"));
    } else {
      const problems = d1Failures(d);
      const names = { "D1.1": "demo-lineup", "D1.2": "demo-card", "D1.3": "demo-scroll" };
      for (const id of Object.keys(names)) {
        const own = problems.filter((m) => m.startsWith(id));
        report(ctx, verdictRow(id, names[id], own, `viewport=${ctx.size}`, id === "D1.1" ? "card left edge on the wordmark" : id === "D1.2" ? "card width and border match a persona card" : "no horizontal scroll on /demo"));
      }
    }
    await page.close();
  } finally {
    await context.close();
  }
}

// --- Spec 16 row runner (17.3) ---------------------------------------------
// The rows of 17.3 at 1440x900 and 390x844. Each fails as a BLOCKER, with no --require.
// 5.4/5.5 and 14.3 run with Calm off and on (reduced motion emulated). 10.1 runs on the
// Maya Receipts step and on live step 6. 10.6 seals a live letter with a virtual passkey
// (CTAP2, PRF), waits out the 30-second lock and opens it, so it needs the database.

const S16_SIZES = ["1440x900", "390x844"];
const TOP_BAR_STEP_SIZES = ["360x640", "390x844"];
const DEMO_ROW_SIZES = ["1440x900", "390x844"];
const PERSONA_ROW_SIZES = ["360x640", "390x844", "1440x900"];
const S16_LOCK_WAIT_MS = 31000;
const S16_STEP_MS = 30000;
const S16_LETTER = "A letter for the spec 16 layout rows.";

const HERO_LINES_READ = () => {
  const h1 = document.querySelector('[data-block="headline"]');
  if (!h1) return null;
  const first = h1.querySelector("[data-hero-first]");
  const words = [];
  const walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    const re = /\S+/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const range = document.createRange();
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rect = range.getClientRects()[0];
      if (rect) words.push({ text: m[0], top: rect.top, first: !!first && first.contains(node) });
    }
  }
  const lines = [];
  for (const word of words) {
    const line = lines.find((l) => Math.abs(l.top - word.top) <= 2);
    if (line) line.words.push(word);
    else lines.push({ top: word.top, words: [word] });
  }
  lines.sort((a, b) => a.top - b.top);
  return {
    firstSentenceLines: lines.filter((l) => l.words.some((wd) => wd.first)).length,
    lines: lines.map((l) => l.words.map((wd) => wd.text).join(" ")),
  };
};

const RECEIPTS_READ = () => {
  const col = document.querySelector("[data-receipts]");
  if (!col) return null;
  const vc = document.documentElement.clientWidth / 2;
  const kinds = [
    ["pair", "[data-question-pair]"],
    ["figure", "[data-figure-entry]"],
    ["letter", "[data-letter-stage]"],
    ["seal", "[data-seal-line]"],
    ["end", "[data-end-card]"],
  ];
  const blocks = [];
  // The record box is the union of the non-letter blocks (question pairs, figures, seal line,
  // end card). Falls back to the column box when the receipts hold none of them.
  let unionLeft = Infinity;
  let unionRight = -Infinity;
  let unionTop = Infinity;
  let recordBlocks = 0;
  for (const [kind, sel] of kinds) {
    for (const el of col.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      blocks.push({ kind, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY, centre: r.left + r.width / 2 });
      if (kind === "letter") continue;
      recordBlocks += 1;
      unionLeft = Math.min(unionLeft, r.left);
      unionRight = Math.max(unionRight, r.right);
      unionTop = Math.min(unionTop, r.top);
    }
  }
  const text = col.querySelector("[data-letter-stage] [data-letter-text]");
  const c = col.getBoundingClientRect();
  const letterStage = col.querySelector("[data-letter-stage]");
  const lr = letterStage ? letterStage.getBoundingClientRect() : null;
  const record = recordBlocks > 0
    ? { left: unionLeft, right: unionRight, top: unionTop + window.scrollY }
    : { left: c.left, right: c.right, top: c.top + window.scrollY };
  return {
    blocks,
    centre: c.left + c.width / 2,
    width: record.right - record.left,
    viewportCentre: vc,
    // Split marker: the open letter sits beside the receipts (spec 20 part D).
    split: col.getAttribute("data-receipts-layout") === "split",
    disclosurePresent: !!col.querySelector("[data-letter-disclosure]"),
    letterTextVisible: !!text && text.getClientRects().length > 0 && text.checkVisibility(),
    record,
    letter: lr ? { left: lr.left, right: lr.right, top: lr.top + window.scrollY } : null,
  };
};

const WARNING_READ = () => {
  const warn = document.querySelector("[data-warning-text]");
  const wax = document.querySelector("[data-wax-relief]")?.parentElement ?? null;
  const w = warn ? warn.getBoundingClientRect() : null;
  return {
    unfolded: !!warn && !warn.closest("details:not([open])") && warn.checkVisibility(),
    top: w ? w.top : null,
    bottom: w ? w.bottom : null,
    waxTop: wax ? wax.getBoundingClientRect().top : null,
    viewportH: document.documentElement.clientHeight,
    scrollY: window.scrollY,
  };
};

function s16Ctx(rep, size, required, calm) {
  const [w, h] = parseSize(size);
  return { size, w, h, rep, stage: null, required, memo: {}, ghostHook: false, calm };
}

async function s16Hero(context, ctx, base) {
  ctx.rep.stage(`hero calm=${ctx.calm ? "on" : "off"}`);
  const page = await newPage(context);
  try {
    await page.goto(`${base}/`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await sleep(800);
    const r = await page.evaluate(HERO_LINES_READ);
    report(ctx, r
      ? verdictRow("R5.4", "hero-lines", heroLineFailures({ w: ctx.w, firstSentenceLines: r.firstSentenceLines, lines: r.lines }), `lines=${JSON.stringify(r.lines)} calm=${ctx.calm ? "on" : "off"} viewport=${ctx.size}`, ctx.w === 1440 ? "the first sentence on one line box (5.4)" : "no headline line holds one word (5.5)")
      : missingRow("R5.4", "hero-lines", 'no [data-block="headline"] on /'));
  } finally {
    await page.close();
  }
}

// Write step to Press the seal on /demo/live: letter, every question answered, optionally one
// public price ticked, then the fold. Returns once the Seal step is shown and its scroll is done.
async function s16LiveToSeal(page, base, { figure, letter = S16_LETTER }) {
  await page.goto(`${base}${LIVE_PATH}`, { waitUntil: "load" });
  // The Write step is in the server HTML. A page without any live step (no RP_ID, or a build
  // before the live demo) has nothing to wait for.
  await need(page.locator("[data-live-step]"), `[data-live-step] on ${LIVE_PATH}`);
  await page.locator('[data-live-step="write"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
  await page.evaluate(() => document.fonts.ready);
  await page.fill("#live-letter", letter);
  const answers = page.locator("[data-answer-input]");
  const texts = fillAnswerTexts(await answers.count());
  for (let i = 0; i < texts.length; i += 1) await answers.nth(i).fill(texts[i]);
  if (figure) {
    const panel = page.locator("[data-receipt-panel]").first();
    if (await panel.evaluate((el) => el.tagName === "DETAILS" && !el.open)) await panel.locator("summary").first().click();
    await page.getByRole("button", { name: "A public price", exact: true }).click();
    await page.locator("[data-figure-row]").first().click();
  }
  await page.locator("[data-fold-button]").first().click();
  await page.locator("[data-seal-step]").first().waitFor({ state: "visible", timeout: S16_STEP_MS });
  await sleep(1200);
}

function s16Warning(ctx, r) {
  report(ctx, verdictRow("R14.3", "passkey-warning", passkeyWarningFailures(r), `warning=${num(r.top ?? NaN, 0)}..${num(r.bottom ?? NaN, 0)} wax top=${num(r.waxTop ?? NaN, 0)} scrollY=${num(r.scrollY, 0)} calm=${ctx.calm ? "on" : "off"} viewport=${ctx.size}`, "unfolded, inside the layout viewport and ending above the wax top, no scroll by the reader"));
}

function s16Order(ctx, where, r) {
  if (!r) {
    report(ctx, missingRow("R10.1", "receipts-order", `no [data-receipts] on ${where}`));
    return;
  }
  const order = [...r.blocks].sort((a, b) => a.top - b.top).map((b) => b.kind).join(",");
  const failures = receiptsOrderFailures({ blocks: r.blocks, disclosurePresent: r.disclosurePresent, letterTextVisible: r.letterTextVisible });
  const want = "question pairs, figures, the open letter beside them, the seal line, the end card; no fold on the letter";
  report(ctx, verdictRow("R10.1", "receipts-order", failures, `on=${where} order=${order} viewport=${ctx.size}`, want));
}

// Maya: Remember, Break the seal with the button, then See the receipts. Returns the
// [data-receipts] read, or throws when a step is not reached.
async function s16PersonaReceipts(page, base) {
  await page.goto(`${base}${PERSONA_PATH}`, { waitUntil: "load" });
  const first = await reachRecall(page);
  if (first === null) throw new Error("neither recall nor a pick-up button");
  if (first === "pickup") {
    await page.getByRole("button", { name: PICK_UP, exact: true }).click({ timeout: WAIT_MS });
    if (!(await waitForStage(page, "recall"))) throw new Error("recall not reached");
  }
  await sleep(800);
  const problem = await answerAll(page, PERSONAS[0].answers(""));
  if (problem) throw new Error(problem);
  if (!(await waitForStage(page, "marks"))) throw new Error("Break the seal not reached");
  await sleep(800);
  return s16BreakAndReceipts(page);
}

async function s16BreakAndReceipts(page) {
  await page.locator("[data-seal-button]").first().click({ timeout: S16_STEP_MS });
  await page.locator('[data-ceremony="letter"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
  const next = await figuresButton(page);
  if (!next) throw new Error("no See the receipts control on the letter step");
  await page.evaluate(S20_HOLD);
  await next.loc.click({ timeout: WAIT_MS });
  await page.locator('[data-ceremony="figures"], [data-ceremony="close"]').first().waitFor({ state: "visible", timeout: S16_STEP_MS });
  await page.locator("[data-receipts] [data-end-card]").first().waitFor({ state: "attached", timeout: S16_STEP_MS });
  // 2,000 ms after the move: the S20.f window and the S20.e focus window (1,000 ms) both fit.
  await sleep(2000);
  const read = await page.evaluate(RECEIPTS_READ);
  if (read) read.s20 = await page.evaluate(S20_READ);
  return read;
}

// Live Remember: every question answered (text, number or a scale control), then on.
async function s16LiveRemember(page) {
  const recall = page.locator('[data-ceremony="recall"]');
  for (let i = 0; i < 12; i += 1) {
    if ((await stageOf(page)) !== "recall") return;
    // A figure question's field is text with a decimal keypad; an author question's is a textarea.
    const numberField = recall.locator('input[inputmode="decimal"], input[type="number"]').first();
    const textField = recall.locator("textarea").first();
    if ((await numberField.count()) > 0) await numberField.fill("12");
    else if ((await textField.count()) > 0) await textField.fill(`Remembered ${i + 1}`);
    else await recall.locator('button[aria-label]:not([aria-label*="motion" i])').first().click();
    const next = recall.getByRole("button", { name: /^(next question|next|continue)$/i }).first();
    if ((await next.count()) > 0) await next.click();
    else await recall.getByRole("button", { name: /break the seal|record|submit|save/i }).first().click();
    await sleep(400);
  }
  throw new Error("more than 12 questions on the live Remember step");
}

async function s16LiveReceipts(context, page, base, read, letter = S16_LETTER) {
  let step = "virtual passkey";
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true },
    });
    step = "write";
    await s16LiveToSeal(page, base, { figure: true, letter });
    read.warning = await page.evaluate(WARNING_READ);
    step = "backup choice";
    await page.locator('[data-backup-card="skip"]').first().click({ timeout: WAIT_MS });
    await sleep(300);
    // Calm is on in this context, so the press is one click, not a hold.
    step = "first press";
    await page.getByRole("button", { name: "Press the seal", exact: true }).click({ timeout: WAIT_MS });
    await page.locator('[data-press-mode="setting"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
    step = "setting press";
    await page.locator('[data-press-mode="setting"]').click({ timeout: WAIT_MS });
    await page.locator('[data-live-step="sealed"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
    step = "wait";
    await sleep(S16_LOCK_WAIT_MS);
    step = "open and unlock";
    await page.getByRole("button", { name: "Open your letter", exact: true }).click({ timeout: S16_STEP_MS });
    await page.getByRole("button", { name: /unlock with your passkey/i }).click({ timeout: S16_STEP_MS });
    await page.locator('[data-ceremony="recall"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
    step = "remember";
    await s16LiveRemember(page);
    await page.locator('[data-ceremony="marks"]').waitFor({ state: "visible", timeout: S16_STEP_MS });
    await sleep(800);
    step = "break the seal and receipts";
    return await s16BreakAndReceipts(page);
  } catch (error) {
    if (error instanceof NotOnBuild) throw new NotOnBuild(`live step "${step}": ${error.message}`);
    throw new Error(`live step "${step}": ${String(error.message ?? error).split("\n")[0]}`);
  }
}

// Spec 20 page-side reads. S20_SPY is an init script: it counts animate calls whose target is on
// the letter. S20_HOLD runs just before "See the receipts" and holds the letter node.
const S20_SPY = () => {
  window.__s20Calls = 0;
  const original = Element.prototype.animate;
  if (typeof original !== "function") return;
  Element.prototype.animate = function animateSpy(...args) {
    if (this.closest && this.closest("[data-letter-stage]")) window.__s20Calls += 1;
    return original.apply(this, args);
  };
};

const S20_HOLD = () => {
  window.__s20Held = document.querySelector("[data-letter-stage]");
  window.__s20Move = document.timeline ? document.timeline.currentTime : performance.now();
  return !!window.__s20Held;
};

const S20_READ = () => {
  const bar = document.querySelector("[data-topbar]") ?? document.querySelector("header");
  const heading = document.querySelector("[data-figures-heading]");
  const stage = document.querySelector("[data-letter-stage]");
  const held = window.__s20Held ?? null;
  const moved = window.__s20Move ?? 0;
  const token = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  const probe = document.createElement("span");
  probe.style.color = "var(--accent)";
  document.body.appendChild(probe);
  const accent = token === "" ? null : getComputedStyle(probe).color;
  probe.remove();
  const colours = [];
  for (const entry of document.querySelectorAll("[data-receipts] [data-figure-entry]")) {
    for (const el of entry.querySelectorAll("*")) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
      if (hasText) colours.push({ label: (el.textContent ?? "").trim().slice(0, 30), colour: getComputedStyle(el).color });
    }
  }
  const animations = document.getAnimations().filter((a) => {
    const target = a.effect ? a.effect.target : null;
    if (!target || !target.closest || !target.closest("[data-letter-stage]")) return false;
    return a.startTime === null || a.startTime >= moved;
  }).length;
  const hr = heading ? heading.getBoundingClientRect() : null;
  return {
    calls: window.__s20Calls ?? null,
    nodeKept: !!held && held.isConnected && held === stage,
    animations,
    accent,
    colours,
    barBottom: bar ? bar.getBoundingClientRect().bottom : null,
    viewportH: document.documentElement.clientHeight,
    headingTop: hr ? hr.top : null,
    headingBottom: hr ? hr.bottom : null,
  };
};

const S20_STICK_READ = () => {
  const bar = document.querySelector("[data-topbar]") ?? document.querySelector("header");
  const area = document.querySelector("[data-receipts]");
  const letter = document.querySelector("[data-letter-stage]");
  return {
    top: letter ? letter.getBoundingClientRect().top : null,
    barBottom: bar ? bar.getBoundingClientRect().bottom : null,
    areaBottom: area ? area.getBoundingClientRect().bottom : null,
    letterBottom: letter ? letter.getBoundingClientRect().bottom : null,
  };
};

const S20_LONG_BEFORE = () => {
  const col = document.querySelector("[data-letter-stage]");
  if (!col) return null;
  return { tabindex: col.getAttribute("tabindex"), overflowing: col.scrollHeight > col.clientHeight + 1, scrollTop: col.scrollTop };
};

const S20_LONG_AFTER = () => {
  const col = document.querySelector("[data-letter-stage]");
  const text = col ? col.querySelector("[data-letter-text]") : null;
  if (!col) return null;
  let last = null;
  if (text) {
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.textContent ?? "").length > 0) last = n;
    }
  }
  let lastCharVisible = false;
  if (last) {
    const len = (last.textContent ?? "").length;
    const range = document.createRange();
    range.setStart(last, len - 1);
    range.setEnd(last, len);
    const r = range.getBoundingClientRect();
    const c = col.getBoundingClientRect();
    lastCharVisible = r.width > 0 && r.top >= c.top - S20_TOL_PX && r.bottom <= c.bottom + S20_TOL_PX && r.top >= 0 && r.bottom <= window.innerHeight + S20_TOL_PX;
  }
  return { scrollTop: col.scrollTop, lastCharVisible };
};

/**
 * The Spec 20 readings on one receipts read. `reduced` says the run used reduced motion. The
 * wide-width S20.d reading scrolls the page to its end, so it runs last.
 */
async function s20Readings(page, ctx, r, { reduced, where }) {
  const motionId = reduced ? "S20.f-reduced" : "S20.f";
  const motionName = reduced ? "letter-motion-reduced" : "letter-motion";
  if (!r || !r.s20) {
    const why = r ? `no Spec 20 read on ${where}` : `no [data-receipts] on ${where}`;
    for (const [id, name] of [["S20.c", "column-placement"], ["S20.d", "letter-sticks"], ["S20.e", "focus-in-view"], [motionId, motionName], ["S20.g", "figure-accent"]]) {
      report(ctx, missingRow(id, name, why));
    }
    return;
  }
  const s = r.s20;
  const at = `${where} viewport=${ctx.size}`;
  report(ctx, verdictRow("S20.c", "column-placement", placementFailures({ w: ctx.w, record: r.record, letter: r.letter, blocks: r.blocks }), `${at} record=${num(r.record?.left, 0)}..${num(r.record?.right, 0)} letter=${num(r.letter?.left, 0)}..${num(r.letter?.right, 0)}`, ctx.w >= S20_WIDE_PX ? "letter column right of the record column, tops level within 1 px" : "no two blocks side by side in one column"));
  report(ctx, verdictRow(motionId, motionName, letterMotionFailures({ reduced, calls: s.calls, nodeKept: s.nodeKept, animations: s.animations }), `${at} animate calls=${s.calls ?? "n/a"} animations after move=${s.animations} node kept=${s.nodeKept}`, reduced ? "no animate call and no animation on the letter" : "at most one animate call on the letter; the same letter node 2,000 ms after the move"));
  report(ctx, verdictRow("S20.e", "focus-in-view", focusHeadingFailures({ top: s.headingTop, bottom: s.headingBottom, barBottom: s.barBottom, viewportH: s.viewportH }), `${at} heading=${num(s.headingTop, 0)}..${num(s.headingBottom, 0)} bar bottom=${num(s.barBottom, 0)}`, "Figures_Heading between the Top_Bar and the viewport bottom, 1 s after the move"));
  report(ctx, verdictRow("S20.g", "figure-accent", figureAccentFailures({ accent: s.accent, colours: s.colours }), `${at} figure text colours=${s.colours.length} accent=${s.accent ?? "none"}`, "no figure value, change line, period or label in --accent"));
  if (ctx.w < S20_WIDE_PX) {
    report(ctx, result("S20.d", "letter-sticks", "missing", `only checked at 900 px and wider; ${at}`));
    return;
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await sleep(400);
  const d = await page.evaluate(S20_STICK_READ);
  report(ctx, verdictRow("S20.d", "letter-sticks", stickyFailures(d), `letter top=${num(d.top, 0)} bar bottom=${num(d.barBottom, 0)} area bottom=${num(d.areaBottom, 0)} letter bottom=${num(d.letterBottom, 0)} ${at}`, "letter top 0 to 32 px under the Top_Bar, unless the receipts end has reached the letter bottom"));
}

/** S20.long: focus the letter column, press End, then read whether the last character shows. */
async function s20LongLetter(page, ctx, r) {
  if (!r) {
    report(ctx, missingRow("S20.long", "long-letter", "no [data-receipts] on live step 6"));
    return;
  }
  if (!r.split) {
    report(ctx, missingRow("S20.long", "long-letter", 'no [data-receipts-layout="split"] on live step 6'));
    return;
  }
  const before = await page.evaluate(S20_LONG_BEFORE);
  if (!before) {
    report(ctx, missingRow("S20.long", "long-letter", "no [data-letter-stage] on live step 6"));
    return;
  }
  await page.locator("[data-letter-stage]").first().focus();
  await page.keyboard.press("End");
  await sleep(400);
  const after = await page.evaluate(S20_LONG_AFTER);
  report(ctx, verdictRow("S20.long", "long-letter", longLetterFailures({
    tabindex: before.tabindex,
    overflowing: before.overflowing,
    scrolledBy: after ? after.scrollTop - before.scrollTop : 0,
    lastCharVisible: after ? after.lastCharVisible : false,
  }), `${LIVE_PATH} ${S20_LONG_SIZE} letter=${S20_LONG_LENGTH} tabindex=${before.tabindex ?? "none"} overflowing=${before.overflowing} viewport=${ctx.size}`, "tabindex 0, the column scrolls by End, the last character in view"));
}

// S20.w read, after a scroll to the end. The record column is every receipts block other than the
// letter (question pairs, figures, the seal line and the end card) and all their descendants.
const S20_SPLIT_READ = () => {
  const col = document.querySelector("[data-receipts]");
  if (!col) return null;
  const letterEl = col.querySelector("[data-letter-stage]");
  const lb = letterEl ? letterEl.getBoundingClientRect() : null;
  const letter = lb ? { left: lb.left, right: lb.right } : null;
  const sels = ["[data-question-pair]", "[data-figure-entry]", "[data-seal-line]", "[data-end-card]"];
  let left = Infinity;
  let right = -Infinity;
  const intrusions = [];
  const label = (el) => {
    const tag = el.tagName.toLowerCase();
    const hook = [...el.attributes].find((a) => a.name.startsWith("data-"))?.name;
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
    return `${tag}${hook ? `[${hook}]` : ""} "${text}"`;
  };
  for (const block of col.querySelectorAll(sels.join(","))) {
    if (letterEl && (letterEl.contains(block) || block.contains(letterEl))) continue;
    const b = block.getBoundingClientRect();
    if (b.width === 0) continue;
    left = Math.min(left, b.left);
    right = Math.max(right, b.right);
    if (!letter) continue;
    for (const el of [block, ...block.querySelectorAll("*")]) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > letter.left + 1 && r.left < letter.right) intrusions.push({ label: label(el), right: r.right });
    }
  }
  const h = col.querySelector("[data-end-card] [data-close-line]");
  const card = h ? h.parentElement : null;
  const hb = h ? h.getBoundingClientRect() : null;
  const cb = card ? card.getBoundingClientRect() : null;
  return {
    split: col.getAttribute("data-receipts-layout") === "split",
    record: Number.isFinite(left) ? { left, right } : null,
    letter,
    intrusions: intrusions.slice(0, 5),
    heading: h ? { scrollWidth: h.scrollWidth, clientWidth: h.clientWidth, left: hb.left, right: hb.right } : null,
    card: cb ? { left: cb.left, right: cb.right } : null,
  };
};
/** S20.w: Maya's receipts at each S20_SPLIT_SIZES size, reduced motion, scrolled to the end. */
async function s20SplitRun(browser, base, rep, required) {
  for (const size of S20_SPLIT_SIZES) {
    const [w, h] = parseSize(size);
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
    await context.addInitScript(S20_SPY);
    const ctx = s16Ctx(rep, size, required, true);
    rep.setContext(ctx);
    rep.log(`\n==== ${size} (spec 20 split width) ====`);
    ctx.rep.stage("us-maya receipts split width");
    try {
      const page = await newPage(context);
      try {
        const r = await s16PersonaReceipts(page, base);
        if (!r) {
          report(ctx, missingRow("S20.w", "split-width", `no [data-receipts] on ${PERSONA_PATH}`));
          continue;
        }
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await sleep(400);
        const d = await page.evaluate(S20_SPLIT_READ);
        const cols = d && d.record && d.letter ? `record=${num(d.record.left, 0)}..${num(d.record.right, 0)} letter=${num(d.letter.left, 0)}..${num(d.letter.right, 0)}` : "no columns";
        const head = d && d.heading ? `heading scroll=${d.heading.scrollWidth} client=${d.heading.clientWidth}` : "no heading";
        report(ctx, verdictRow("S20.w", "split-width", d ? splitWidthFailures(d) : ["S20.w no [data-receipts] to read"], `${PERSONA_PATH} ${cols} ${head} viewport=${size}`, `each column at least ${S20_SPLIT_MIN_PX} px, no record element in the letter column, the end-card heading inside its card`));
      } finally {
        await page.close();
      }
    } finally {
      await context.close();
    }
  }
}
/** The 1280x800 run with the 5,000-character letter: the live receipts, reduced motion. */
async function s20LongRun(browser, base, rep, required) {
  const [w, h] = parseSize(S20_LONG_SIZE);
  const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await context.addInitScript(S20_SPY);
  const ctx = s16Ctx(rep, S20_LONG_SIZE, required, true);
  rep.setContext(ctx);
  rep.log(`\n==== ${S20_LONG_SIZE} (spec 20 Part D, long letter) ====`);
  try {
    const page = await newPage(context);
    try {
      const r = await s16LiveReceipts(context, page, base, { warning: null }, S20_LONG_LETTER);
      await s20LongLetter(page, ctx, r);
      await s20Readings(page, ctx, r, { reduced: true, where: `${LIVE_PATH} long letter` });
    } finally {
      await page.close();
    }
  } finally {
    await context.close();
  }
}

async function checkSpec16Rows(browser, base, size, rep, required, scope = {}) {
  const runs = (group) => sectionRuns({ group }, scope);
  const [w, h] = parseSize(size);
  rep.log(`\n==== ${size} (spec 16 rows of 17.3) ====`);
  let personaWidth = null;
  for (const calm of [false, true]) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: calm ? "reduce" : "no-preference" });
    await context.addInitScript(S20_SPY);
    const ctx = s16Ctx(rep, size, required, calm);
    rep.setContext(ctx);
    try {
      if (runs("landing")) await guard(ctx, "R5.4", () => s16Hero(context, ctx, base));
      if (!calm) {
        // Spec 20 full-motion readings (S20.f) on Maya's receipts.
        if (runs("persona")) await guard(ctx, "S20.f", async () => {
          ctx.rep.stage("us-maya receipts calm=off");
          const page = await newPage(context);
          try {
            const r = await s16PersonaReceipts(page, base);
            await s20Readings(page, ctx, r, { reduced: false, where: PERSONA_PATH });
          } finally {
            await page.close();
          }
        });
        if (runs("live")) await guard(ctx, "R14.3", async () => {
          ctx.rep.stage("seal calm=off");
          const page = await newPage(context);
          try {
            await s16LiveToSeal(page, base, { figure: false });
            s16Warning(ctx, await page.evaluate(WARNING_READ));
          } finally {
            await page.close();
          }
        });
        continue;
      }
      // R10.6 compares the live column with the persona one, so live runs R10.1 too.
      if (runs(["persona", "live"])) await guard(ctx, "R10.1", async () => {
        ctx.rep.stage("us-maya receipts");
        const page = await newPage(context);
        try {
          const r = await s16PersonaReceipts(page, base);
          personaWidth = r ? r.width : null;
          s16Order(ctx, PERSONA_PATH, r);
        } finally {
          await page.close();
        }
      });
      if (runs("live")) await guard(ctx, "R10.6", async () => {
        ctx.rep.stage("live seal to receipts calm=on");
        const page = await newPage(context);
        try {
          // 14.3 with Calm on is read on the way, before the backup choice.
          const read = { warning: null };
          const r = await s16LiveReceipts(context, page, base, read);
          if (read.warning) s16Warning(ctx, read.warning);
          s16Order(ctx, LIVE_PATH, r);
          if (!r) {
            report(ctx, missingRow("R10.6", "live-column", "no [data-receipts] on live step 6"));
            return;
          }
          await s20Readings(page, ctx, r, { reduced: true, where: LIVE_PATH });
          // CW1 reads the live receipts column beside the R10.6 comparison.
          await guard(ctx, "CW1", () => checkCw1(page, ctx));
          const failures = r.letter
            ? splitColumnFailures({ record: r.record, letter: r.letter, width: r.width, centre: r.centre, viewportCentre: r.viewportCentre, personaWidth })
            : ["10.6 no letter column on live step 6"];
          report(ctx, verdictRow("R10.6", "live-column", failures, `split=${r.split} centre=${num(r.centre)} viewport centre=${num(r.viewportCentre)} width=${num(r.width)} persona=${personaWidth === null ? "n/a" : num(personaWidth)} viewport=${ctx.size}`, "record and letter columns side by side, tops level, each centred on the viewport within 1 px and the record column as wide as the persona receipts column within 1 px"));
        } finally {
          await page.close();
        }
      });
      // The long-letter run is 1280x800 whatever the size; it runs once, with the first size.
      if (calm && runs("live") && size === S16_SIZES[0]) {
        await guard(ctx, "S20.long", () => s20LongRun(browser, base, rep, required));
        rep.setContext(ctx);
      }
      // The split-width run has its own sizes; it runs once, with the first size.
      if (calm && runs("persona") && size === S16_SIZES[0]) {
        await guard(ctx, "S20.w", () => s20SplitRun(browser, base, rep, required));
        rep.setContext(ctx);
      }
    } finally {
      await context.close();
    }
  }
}

// The walk at one size. Each part runs only when its stage group is in --stages.
async function runSize(browser, base, size, opts, rep) {
  const [w, h] = size.split("x").map(Number);
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  const scope = { stages: opts.stages };
  const ctx = { size, w, h, base, shotsDir: opts.shots, rep, intactCentre: null, stage: null, hasFiguresHeading: false, required: opts.required, memo: {}, ghostHook: false, scope };
  const runs = (group) => sectionRuns({ group }, scope);
  rep.setContext(ctx);
  rep.log(`\n==== ${size} ====`);
  try {
    if (runs("landing")) await guard(ctx, "walk", () => landing(context, ctx));
    if (runs("demo")) await guard(ctx, "walk", () => index(context, ctx));
    if (runs("persona")) {
      await guard(ctx, "walk", () => persona(context, ctx, PERSONAS[0], "mouse"));
      await guard(ctx, "walk", () => persona(context, ctx, PERSONAS[1], "keyboard"));
      await guard(ctx, "walk", () => showAll(context, ctx));
      await guard(ctx, "FP1", () => checkFastestPath(context, ctx, PERSONAS[0]));
    }
    if (runs("live")) await guard(ctx, "P1", () => checkPressEnvelope(context, ctx));
    if (runs("live")) await guard(ctx, "CT1", () => checkPressContrast(context, ctx));
    if (runs("live")) await guard(ctx, "UQ1", () => checkWaitRules(browser, ctx));
    await guard(ctx, "walk", () => otherPages(context, ctx));
  } finally {
    await context.close();
  }
}

function printUsage() {
  console.log(`Usage: npm run layout-check -- --url <origin> [--sizes WxH,WxH] [--all-sizes] [--only-sizes WxH,WxH] [--stages ${ALL_STAGE_GROUPS.join(",")}] [--require ID,ID] [--baseline <file>|main] [--save-blockers <file>] [--quiet] [--jobs N] [--shots <dir>] [--chromium <path>]`);
}

// The sections of a run, in the order the output prints them. `groups` are the
// stage groups a section belongs to and `size` its viewport; --stages and
// --only-sizes drop the rest. Pure, so tests can check what a scoped run covers.
export function planSections(opts) {
  const scope = { stages: opts.stages ?? null, onlySizes: opts.onlySizes ?? null };
  const all = [];
  for (const size of opts.sizes) all.push({ kind: "walk", name: `walk ${size}`, label: "walk", size, groups: ALL_STAGE_GROUPS });
  for (const size of U9_SIZES) all.push({ kind: "u9", name: `U9 ${size}`, label: "U9", size, groups: ["demo"] });
  for (const size of DESK_SIZES) all.push({ kind: "desk", name: `desk rows ${size}`, label: "desk", size, groups: ["live"] });
  for (const size of TOP_BAR_STEP_SIZES) all.push({ kind: "topbar", name: `Top_Bar steps ${size}`, label: "B1.2", size, groups: ["live"] });
  for (const size of DEMO_ROW_SIZES) all.push({ kind: "demo", name: `demo rows ${size}`, label: "D1", size, groups: ["demo"] });
  for (const size of PERSONA_ROW_SIZES) {
    for (const p of PERSONAS) all.push({ kind: "personaRows", name: `${p.key} rows ${size}`, label: "persona", size, persona: p, groups: ["persona"] });
  }
  all.push({ kind: "soil", name: `Soil strips ${SOIL_SIZE}`, label: "B2.1", size: SOIL_SIZE, groups: SOIL_PAGES.map(([, g]) => g) });
  for (const size of S16_SIZES) all.push({ kind: "s16", name: `spec 16 rows ${size}`, label: "R10", size, groups: ["landing", "persona", "live"] });
  // The walk's size list is already cut to --only-sizes by parseArgs.
  return all.filter((s) => sectionRuns({ group: s.groups, size: s.kind === "walk" ? null : s.size }, scope));
}

function sectionRunner(section, opts) {
  const scope = { stages: opts.stages ?? null, onlySizes: opts.onlySizes ?? null };
  const { size } = section;
  switch (section.kind) {
    case "walk": return (browser, rep) => runSize(browser, opts.url, size, opts, rep);
    case "u9": return (browser, rep) => checkPersonaSealRow(browser, opts.url, size, rep, opts.required);
    case "desk": return (browser, rep) => checkDeskRows(browser, opts.url, size, rep, opts.required);
    case "topbar": return (browser, rep) => checkTopBarSteps(browser, opts.url, size, rep, opts.required);
    case "demo": return (browser, rep) => checkDemoRows(browser, opts.url, size, rep, opts.required);
    case "personaRows": return (browser, rep) => checkPersonaRows(browser, opts.url, section.persona, size, rep, opts.required);
    case "soil": return (browser, rep) => checkSoilStrips(browser, opts.url, rep, opts.required, scope);
    case "s16": return (browser, rep) => checkSpec16Rows(browser, opts.url, size, rep, opts.required, scope);
    default: throw new Error(`unknown section ${section.kind}`);
  }
}

async function loadBaseline(opts, out) {
  if (!opts.baseline) return { rows: null, note: null };
  try {
    let file;
    let label;
    if (opts.baseline === "main") {
      const { resolveBaseline } = await import("./layout-baseline.mjs");
      const got = await resolveBaseline({ log: (text) => out(`baseline: ${text}`) });
      file = got.file;
      label = `main ${got.commit.slice(0, 12)}${got.cached ? " (cached)" : " (built for this run)"}`;
    } else {
      file = resolve(opts.baseline);
      label = opts.baseline;
    }
    const data = readBlockersFile(JSON.parse(readFileSync(file, "utf8")));
    const run = { sizes: opts.sizes, onlySizes: opts.onlySizes, stages: opts.stages };
    const gaps = baselineGaps(data.run, run);
    const gapNote = gaps.length ? `; it did not cover ${gaps.join(", ")}, so blockers there count as new` : "";
    const partial = data.complete ? "" : "; the baseline run did not finish";
    return { rows: data.blockers, note: `${label}${gapNote}${partial}` };
  } catch (error) {
    const note = `${opts.baseline === "main" ? "main" : opts.baseline} could not be used (${String(error.message ?? error).split("\n")[0]}); every BLOCKER counts as new`;
    return { rows: [], note };
  }
}

async function main() {
  const started = Date.now();
  // Loaded here, not at the top, so a missing package gets a plain message and exit 2 instead of a stack trace.
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error("layout-check: playwright-core is not installed in this checkout. Run `npm ci` once, then run the check again.");
    return 2;
  }
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`layout-check: ${error.message}`);
    printUsage();
    return 2;
  }
  if (opts.help) {
    printUsage();
    return 0;
  }

  try {
    const res = await fetch(opts.url, { redirect: "manual" });
    await res.body?.cancel();
  } catch (error) {
    console.error(`layout-check: the app does not answer at ${opts.url} (${error.cause?.code ?? error.message}). Start it first.`);
    return 2;
  }

  // /demo/live renders its "not available on this server" panel when the app runs without
  // RP_ID. Every live row is then a note, so the run says so in its summary.
  let setupWarning = null;
  if (sectionRuns({ group: "live" }, { stages: opts.stages })) {
    try {
      const res = await fetch(`${opts.url}${LIVE_PATH}`);
      if ((await res.text()).includes('id="live-unavailable-heading"')) {
        setupWarning = `${LIVE_PATH} says sealing is not available on this server, so the live rows are not measured. Start the app with RP_ID=localhost APP_ORIGIN=${opts.url}.`;
      }
    } catch {
      // The walk reports a page that does not load.
    }
  }

  const executablePath = opts.chromium ?? process.env.CHROMIUM_PATH ?? (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  if (executablePath && !existsSync(executablePath)) {
    console.error(`layout-check: no Chromium at ${executablePath}. Pass --chromium <path>.`);
    return 2;
  }

  opts.shots = resolve(opts.shots);
  mkdirSync(opts.shots, { recursive: true });
  const logFile = join(opts.shots, "layout-check.log");
  writeFileSync(logFile, "");
  // A closed terminal must not stop the run: the log file still gets every line.
  process.stdout.on("error", () => {});
  const out = (text, toStdout = true) => {
    try {
      appendFileSync(logFile, `${text}\n`);
    } catch {
      // The log is a copy; stdout still has the line.
    }
    if (toStdout) console.log(text);
  };
  const print = (line) => out(line.text, !opts.quiet || quietKeeps(line));

  const baseline = await loadBaseline(opts, out);

  // Playwright's own SIGHUP and SIGTERM handlers close the browser and leave the
  // script running, so every later row failed with "Target page, context or browser
  // has been closed" and the run died before its summary. The run handles them here.
  const launch = async () => pinSampleSeed(await chromium.launch({ executablePath, headless: true, handleSIGHUP: false, handleSIGINT: false, handleSIGTERM: false }));
  const holder = { browser: null, relaunching: null };
  try {
    holder.browser = await launch();
  } catch (error) {
    console.error(`layout-check: could not start Chromium: ${error.message.split("\n")[0]}`);
    return 2;
  }
  const freshBrowser = async (old) => {
    if (holder.browser !== old && holder.browser.isConnected()) return holder.browser;
    if (!holder.relaunching) {
      holder.relaunching = launch().then(
        (b) => {
          holder.browser = b;
          holder.relaunching = null;
          return b;
        },
        (error) => {
          holder.relaunching = null;
          throw error;
        },
      );
    }
    return holder.relaunching;
  };
  let stopped = null;
  process.on("SIGHUP", () => out(`layout-check: SIGHUP ignored (the terminal closed); the run goes on. Full output: ${logFile}`, false));
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      if (stopped) process.exit(3);
      stopped = signal;
      out(`layout-check: ${signal}: stopping; the summary covers what ran`);
      holder.browser?.close().catch(() => {});
    });
  }

  out(`Revenant layout check: ${opts.url}`);
  out(`Sizes: ${opts.sizes.length ? opts.sizes.join(", ") : "none (the walk is skipped)"}. Screenshots: ${opts.shots}`);
  if (opts.onlySizes) out(`Only sizes: ${opts.onlySizes.join(", ")}`);
  out(`Stages: ${opts.stages ? opts.stages.join(", ") : `all (${ALL_STAGE_GROUPS.join(", ")})`}. Jobs: ${opts.jobs}. Full output: ${logFile}`);
  // --require: the spec 09 checks whose failures are BLOCKERs. An unknown ID is a note.
  const argsRep = makeReport(print);
  opts.required = new Set();
  for (const id of opts.require) {
    const known = REQUIRABLE_CHECKS.find((c) => c.toLowerCase() === id.toLowerCase());
    if (known) opts.required.add(known);
    else argsRep.add("note", "args", `--require: unknown check ID "${id}" ignored (known: ${REQUIRABLE_CHECKS.join(",")})`);
  }
  if (setupWarning) out(`Setup: ${setupWarning}`);
  out(`Required: ${opts.required.size ? [...opts.required].join(", ") : "none (spec 09 and spec 10 checks print polish)"}`);

  const sections = planSections(opts).map((s) => ({ ...s, run: sectionRunner(s, opts) }));
  const results = new Array(sections.length).fill(null);

  async function runSection(section) {
    let retried = false;
    for (;;) {
      const lines = [];
      const rep = makeReport((line) => lines.push(line));
      if (retried) lines.push({ kind: "log", couldNotRun: true, text: `  note    ${section.label.padEnd(5)} -              ${section.size} - the browser closed during "${section.name}"; started again and ran the section again` });
      const browser = holder.browser;
      const t0 = Date.now();
      let error = null;
      try {
        await section.run(browser, rep);
      } catch (e) {
        error = e;
      }
      const lost = !browser.isConnected();
      if (lost && !stopped && !retried) {
        retried = true;
        try {
          await freshBrowser(browser);
          continue;
        } catch (e) {
          error = e;
        }
      }
      if (error) {
        if (error instanceof NotOnBuild) rep.add("note", section.label, `not on this build: ${error.message}`);
        else rep.add("note", section.label, `could not run: ${String(error.message ?? error).split("\n")[0]}`);
      }
      const incomplete = lost ? `${section.name} (${stopped ? `stopped by ${stopped}` : "the browser closed again"})` : null;
      return { rep, lines, ms: Date.now() - t0, incomplete };
    }
  }

  let next = 0;
  let printed = 0;
  const flush = () => {
    while (printed < sections.length && results[printed]) {
      for (const line of results[printed].lines) print(line);
      printed += 1;
    }
  };
  const worker = async () => {
    while (!stopped && next < sections.length) {
      const i = next++;
      results[i] = await runSection(sections[i]);
      flush();
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(opts.jobs, sections.length) }, worker));
  } finally {
    await holder.browser?.close().catch(() => {});
  }
  for (let i = printed; i < sections.length; i++) {
    if (results[i]) for (const line of results[i].lines) print(line);
  }

  const counts = { ...argsRep.counts };
  const items = [];
  const rows = [];
  const incomplete = [];
  for (let i = 0; i < sections.length; i++) {
    const r = results[i];
    if (!r) {
      incomplete.push(`${sections[i].name} (not started: stopped by ${stopped ?? "an error"})`);
      continue;
    }
    for (const k of Object.keys(counts)) counts[k] += r.rep.counts[k];
    items.push(...r.rep.items);
    rows.push(...r.rep.rows);
    if (r.incomplete) incomplete.push(r.incomplete);
  }

  out("\nSections (seconds):", false);
  for (let i = 0; i < sections.length; i++) out(`  ${sections[i].name}: ${results[i] ? (results[i].ms / 1000).toFixed(1) : "not run"}`, false);

  if (opts.saveBlockers) {
    const file = resolve(opts.saveBlockers);
    mkdirSync(dirname(file), { recursive: true });
    const run = { url: opts.url, sizes: opts.sizes, onlySizes: opts.onlySizes, stages: opts.stages, required: [...opts.required] };
    writeFileSync(file, `${JSON.stringify(blockersFile({ rows, counts, run, complete: incomplete.length === 0 }), null, 2)}\n`);
  }

  const marked = baseline.rows ? matchBaseline(items, baseline.rows, { required: [...opts.required] }) : null;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  out("\n==== Summary ====");
  if (items.length) {
    out("Blockers:");
    const list = marked ? marked.blockers : items;
    for (const item of list) {
      const tag = marked ? (item.onMain ? "(already on main) " : "(new) ") : "";
      out(`  [${item.size}] ${item.stage ?? "-"}  ${item.check}  ${tag}${item.detail}`);
    }
  }
  for (const line of summaryLines({ counts, marked, incomplete, baselineNote: baseline.note })) out(line);
  if (setupWarning) out(`Setup: ${setupWarning}`);
  out(`Time: ${seconds} s`);
  const result = resultOf({ counts, marked, incomplete });
  out(result.line);
  return result.code;
}

// Runs only as a command, so tools/qa/journey-check.mjs can import runPhoneChecks
// and runFontCheck without starting a check.
const invokedAsScript = (() => {
  try {
    return !!process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`layout-check: ${error.stack ?? error}`);
      process.exitCode = 2;
    },
  );
}
