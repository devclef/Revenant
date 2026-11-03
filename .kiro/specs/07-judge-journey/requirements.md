# Requirements Document

Spec: 07 Judge journey

## Introduction

Spec 05 built the "One Desk" ceremony: a candle, a desk, dust and ink. It works, but it does not grab a Kiroween judge. Most judges watch a 3-minute video and click the link once. This spec redoes the look and the pacing of the judge journey, from `/` to the end of the reveal.

It is a skin over the existing flow. It changes how the journey looks and moves. It does not change what the flow does, the crypto, the API routes or the data. Every spec 05 rule about truth, neutrality, accessibility (Calm_Mode, Skip, keyboard, contrast) and the JavaScript budget still applies, unless "Rules this spec replaces" (under "Decisions already made") names the conflict.

The visual direction is Kiro's world: a near-black background, saturated purple light, a white ghost, very big heavy sans type and one pumpkin-orange accent. The ghost is your past self. It is the concept, not decoration. It waits under the soil on `/`. On the persona page it rises out of the soil holding your letter while the real seal check runs, hands it over, and leaves once the seal is broken.

A prototype is at `docs/design/07-judge-journey.html`. Its flow and timings are the starting point. Its hooded ghost with hands is replaced by the ghost in R5. Its ink effect is dropped (R13). The prototype is committed with this spec by the owner's assistant, because `docs/design/` is not a task path.

This spec builds on spec 03 (Opening_Flow, Persona_List, Reveal), spec 05 (Ceremony, Stages, Calm_Mode, Skip, Recall_Scale, Seal_Break, Number_Line) and spec 06 (`/demo/live`, `/l/[id]`, the Live_Letter reveal).

## Decisions already made

| Topic | Decision |
|---|---|
| Visual direction | Near-black background, purple light (`#8F46FF`), white ghost, Inter at weight 800 to 900 for headlines, one orange accent. No desk, candle, parchment, moon, gravestones or cartoon Halloween props. |
| Text on purple | Any text directly on the purple is pure white `#ffffff` (about 4.7:1). The text token `#f5f3ff` (about 4.2:1) and near-black (about 4.2:1) are not used for text on purple (R3.17). |
| Fonts | The letter text is EB Garamond. Everything else is Inter. Both from `src/app/fonts`. No new font. |
| The ghost | A plain sheet ghost with a round head, big dark oval eyes, no hood, no hands, no arms, and a jagged zigzag hem. Our own drawing. Never Kiro's logo or mascot. It bobs slowly and slightly while it waits (R5). |
| Composition | The Content_Column and the Ghost sit in one Scene_Frame, min(100vw, 1440px) wide and centred in the window. The Ghost is centred at 72% of the Scene_Frame width, and the purple light on the same x. The Ghost does not move sideways on pick up or later. The Top_Bar content lines up with the main content inside the Scene_Frame. The Soil, glow, dust and clods run the full window width (R5.16, R5.17, R6.17, R6.18, R8.14). The earlier rule that moved the Ghost toward the Content_Column, with a 64 px gap, is scrapped. |
| Where the scene lives | `/`, `/demo` and `/demo/personas/[key]`. `/demo/live` and `/l/[id]` get a restyle only (R17). `/l/[id]` renders no Ghost and no Soil (R17.10). |
| Landing | `/` is the opening of the scene: the dark, the light coming up on the Soil, the headline and one orange button into the first persona's letter. The Ghost is still under the Soil on `/` and is not rendered there. It rises only on the persona page (R7, R9). The current explanation and the `/demo` link stay below the scene. |
| Landing ownership | `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css` stay with platform-dev. The landing is a platform-dev task. No file moves between roles. |
| Wax seal | The same orange for every persona, with a small ghost pressed into it (R10). |
| Recall | One question at a time. The typed number is the main input. The Recall_Scale stays under it as a second way to enter the same value (R11). |
| Seal break | Press and hold for `SEAL_HOLD_MS = 1500`, or the "Break the seal" button. Unchanged from spec 05 R6. |
| Letter | Warm paper inside one big rounded purple block. No ink effect. The unfold is the reveal: the letter text is fully visible as soon as the unfold ends (R13). |
| Figures | Beside the letter on wide screens, below it on narrow ones, white on the dark surface. The then value is the big, heavy number. The now value sits on its own line under the Number_Line, bold at body text size. One fade-up for all figures (R14). |
| Orange | Means "you": only "receipts.", the main buttons, the wax, the focus ring outside the Letter_Block and the judge's own answer (R3). |
| Focus ring | White inside the Letter_Block, the Accent everywhere else (R3.15). |
| Move to the figures | The "See the numbers" button stays. No timer moves the judge to the figures (spec 05 R3.4, spec 03 R9.1). |
| Close | The `/demo/live` link reads "Seal your own. It opens 30 seconds after you seal it." It is left out when Demo 2 is off because `RP_ID` is not set. "Start over" goes back to the start of the same persona's letter (R15). |
| Animation | CSS, SVG, the Web Animations API and one 2D canvas. No animation library, no WebGL. |
| Sound and vibration | As spec 05 R14: off by default, behind the toggle. No new cues. The ground shake has no sound and no vibration. |
| Top-bar notice | Pronoun-free: "{name} is fictional. This letter was prepared later as a demo." Kept by the owner. |
| Personas | The scene works with 1 to 6 personas. EU and Sweden personas are a separate spec, later (Out of scope). |

### Rules this spec replaces

Accepted by the owner on 2 November 2026. These spec 03 and spec 05 rules are replaced for this work:

- Spec 05 R1.7 says `src/app/layout.tsx`, `src/app/page.tsx` and `src/app/globals.css` are not edited. Task 7 and task 11 (both platform-dev) now edit `page.tsx` and `globals.css` (R1.11, R7.11).
- Spec 05 R2.1 made "Pick up the letter" the Demo_Index card link text. It is now the Pick_Up_Button, so the card link needs new text (R16.3, proposed "Open the letter"). The spec 05 R2.2 tests change in task 4.
- Spec 05 R3.1 stage names change to those in R2.1 (`desk`, `envelope`, `then`, `passage`, `now` are retired; `scene`, `index`, `emerging`, `sealed`, `figures` are added).
- Spec 05 R4 is kept, but the Recall_Scale is now second, under the number field (R11.6). Spec 05 R4.2 still holds. Spec 05 R4.6 said the field is "visually part of the scale"; now the scale is visually part of the field.
- Spec 03 R8.1 says all recall questions are shown. They are now shown one at a time, in payload order (R11.1). Spec 03 R8.4 shows the message next to each invalid question; the pager now goes to the first invalid one (R11.10).
- Spec 05 R7.2 and R7.3 (an ink effect of up to 8 s, line by line, and its Skip) are retired. There is no ink effect. The unfold is the reveal (R13.4). The ink code and its tests are retired in task 5 (R26.6).
- Spec 05 R8.1, R8.6 and R8.9 (desk, candle, dust on the desk, parallax, tilt, desk only on the demo routes) are replaced by the Scene, which also runs on `/`.
- Spec 05 R8.4 (a seal pattern per persona key) is replaced by one seal for all (R10.10).
- Spec 05 R11.5 (candle flicker limit) is replaced by the light and flashing limits in R6.10.
- Spec 05 R12.5 and R10.6 (stamps, passage, counter roll) are replaced by one fade-up (R14.7).
- Spec 05 R12.9 (close links back to the desk) is replaced by the `/demo/live` link and "Start over" (R15.1).
- Spec 05 R13.1 ("`/` stays within 2 kB of 106.5 kB") no longer holds, because `/` changes. The 130 kB cap stays.
- Spec 05 R18 (task split) is replaced by R28 for this work.
- `tone.md` asked for parchment, a serif for headings, wax-seal reds and a candlelit mood. Its "The feeling" section asked for a "Quiet, unhurried" mood and to "Let each land before the next". The owner's committed update replaces these with the Scene look and "Bold, friendly, a little uncanny" (R25.1, R25.2).

## Out of scope

- Anything under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, `src/lib/recall/`, and any migration.
- The states, events and transitions of `src/components/reveal/opening-machine.ts`.
- The Recall_Record schema, `buildRecallRecord`, the encryption of the Recall_Record and the `POST /api/openings` body.
- The flow, crypto, API calls and copy meaning of `/demo/live` and `/l/[id]` (R17 restyles them only).
- New personas, including the EU and Sweden personas. They are content, data and sealing work for other roles (`content/personas/**`, `scripts/seal-personas*`, figures) and get a separate spec later.
- New figures, new data sources and new sealing.
- New sound or vibration cues.
- The busy case on `/demo/live` (the seal cap). `/demo/live` already explains it, and the close does not change for it (R15.10).
- Owner-only files: `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**`, `tools/**` and `.kiro/**`. This spec drafts text for some of them (R25); the owner commits it.

## Glossary

- **Scene**: The shared stage of this spec: the near-black background, the purple light, the Soil and, on the persona page, the Ghost. Used on `/`, `/demo` and `/demo/personas/[key]`.
- **Ghost**: The original inline SVG figure of the judge's past self (R5).
- **Idle_Bob**: The Ghost's slow, small up-and-down motion while it waits, from the end of the Emergence until the Seal_Break completes (R5.10).
- **Soil**: The strip of lit dirt the Ghost rises out of, drawn by the Soil_Canvas or by the Soil_Fallback (R6).
- **Soil_Canvas**: The one 2D canvas that draws the Soil's clumps, flying clods and drifting dust from a fixed seed.
- **Soil_Fallback**: The static, CSS-drawn lit Soil shown with no JavaScript, in Calm_Mode and in low-power mode.
- **Emergence**: The view-local sequence on the persona page in which the ground shakes and the Ghost rises holding the Envelope.
- **Envelope**: The letter's envelope, torn and dirty along its bottom edge. On the persona page the Ghost holds it in front of its body from the Emergence until the Seal_Break completes, through the `intact`, `recall`, `marks` and `seal` Stages (R5.2, R10.13).
- **Envelope_Front**: The side of the Envelope seen first, carrying the written-as-of date, the opening date and the prepared-later line.
- **Pick_Up_Button**: The orange "Pick up the letter" button. It sends the existing `BEGIN` event.
- **Top_Bar**: The slim bar at the top of each Scene page with the wordmark, the Demo chip, the persona notice, the Calm control and Skip.
- **Letter_Block**: The one big rounded purple block that holds the letter paper.
- **Accent**: The pumpkin-orange colour token.
- **Text_On_Purple**: The pure white `#ffffff` colour token, used for every text and the focus ring directly on the purple surface.
- **Demo_2_On**: The boolean the persona page server component computes from `RP_ID` at request time: true when `RP_ID` is not empty after trimming, false otherwise (R15.8).
- **Recall_Pager**: The view-local control that shows one recall question at a time.
- **Figure_Entry**: The block for one Then_Figure in the figures stage (R14).
- **Content_Column**: The left column of the persona page while the viewport width is at or above the R14.1 breakpoint. It holds the headline, the status line and the Stage content, and sits inside the Scene_Frame (R5.18, R8.14, R10.14).
- **Scene_Frame**: The box that holds the Content_Column and the Ghost as one composition on each Scene page. Its width is min(100vw, 1440px) and it is centred horizontally in the window. On a window less than 1440 CSS px wide it is the full window width. The Top_Bar content and the main content are laid out inside it (R8.14). The Soil, the light's glow, the dust and the clods are not bounded by it (R6.18).
- **Ghost_Box**: The box of the Ghost's SVG element as the browser lays it out. Its centre x is the horizontal midpoint of that box, in CSS px from the window's left edge, as `getBoundingClientRect` reports it.
- **Ghost_Body_Box**: The Ghost_Box inset by 12% of its width on the left and on the right, by 12% of its height at the bottom, and by 15.5% of its height at the top (R5.19).
- **Scoring_Words_Always**: The words "accuracy", "score" and "off by", matched as whole words in any letter case.
- **Scoring_Words_Scene**: The words "close", "right" and "wrong", matched as whole words in any letter case.
- **Scene_Copy_Modules**: The copy modules in `src/components/ceremony/`, `src/components/reveal/`, `src/components/ceremony/scene/` and `src/components/demo/`. `src/components/live/copy.ts` is not one of them.
- **Ceremony**, **Stage**, **Calm_Mode**, **Skip**, **Mark**, **Recall_Scale**, **Number_Line**, **Seal_Break**, **Position_Property**: as defined in spec 05.
- **Opening_Flow**, **Flow state**, **Reveal**, **Recall_Record**, **Then_Figure**, **Now_Figure**, **Comparable**, **Fixture_Figure**, **Persona_List**, **Demo_Index**: as defined in spec 03.
- **Live_Letter**, **Seal_Page**, **Letter_Page**: as defined in spec 06.

## Requirements

### R1. Hard boundaries

**User story:** As the owner, I want this spec to be a skin on the working flow, so that nothing about sealing, opening or recording can change by accident.

1. THE Ceremony SHALL keep every rule of spec 05 R1.1 to R1.6. Concretely, a change made under this spec SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `src/lib/recall/`, and SHALL add no migration file.
2. THE Ceremony SHALL leave the states, events and transitions in `opening-machine.ts` unchanged. `opening-machine.test.ts` and `opening-machine.property.test.ts` SHALL pass with no edit to either file.
3. THE Ceremony SHALL produce a Recall_Record with the same schema and the same content as before this spec, for the same answers. It SHALL add no runtime dependency to `package.json`. It SHALL keep the spec 03 R14 privacy rules. No module SHALL statically import `src/lib/crypto`.
4. WHEN the judge uses any gesture or control this spec adds, THE Ceremony SHALL send only events that already exist to the Opening_Flow: `START`, `BEGIN`, `EDIT_DRAFT`, `TOGGLE_NO_ANSWER`, a submit through the existing handler, `RETRY_POST`, `ADVANCE` or `SHOW_ALL`, plus the events spec 06 added for `/l/[id]`.
5. IF a gesture or control this spec adds would need an event that is not listed in R1.4, THEN the task SHALL not add that event. It SHALL leave the control out and raise it as an open item for the owner.
6. THE Content Security Policy from `src/lib/security-headers.ts` SHALL stay unchanged, and `src/lib/security-headers.ts` SHALL have no diff.
7. WHEN a page this spec touches loads and runs the full journey, THE page SHALL make network requests only to its own origin. It SHALL load no third-party script and no analytics.
8. THE Ceremony SHALL write nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment.
9. THE Ceremony SHALL keep its settings (the Calm control and the sound toggle) in memory only. WHEN the judge reloads the page, THE Ceremony SHALL return each setting to its default: Calm off unless `prefers-reduced-motion` turns it on, and sound off.
10. NO task SHALL edit `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**`, `tools/**` or `.kiro/**`. Text this spec needs in those files SHALL be drafted in the design for the owner (R25), except the `tone.md` and `product.md` text, which the owner commits before the design (R25.1, R25.10).
11. ONLY the platform-dev tasks (R28, tasks 7 and 11) SHALL edit `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css`. This replaces spec 05 R1.7 for this spec (see "Rules this spec replaces").
12. WHEN a frontend-dev task is ready to open its PR, THE frontend-dev agent SHALL check its diff for `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css`, and SHALL remove any change to them before opening the PR.
13. IF a frontend-dev PR changes `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`, THEN the QA agent SHALL fail the PR and name the file it touched.

### R2. Stages and how they map to the Flow

**User story:** As the owner, I want every Stage named and reachable in a known state, so that the QA agent can screenshot each one.

1. THE root element of each Scene page and of the Opening_Flow SHALL carry a `data-ceremony="<stage>"` attribute. Its value SHALL be exactly one of the Stage names in this table, and SHALL be the Stage whose row matches the current route, Flow state and view-local state:

   | Stage | Route | Flow state and view-local state | What the judge sees |
   |---|---|---|---|
   | `scene` | `/` | none | The Scene with the light coming up on the Soil and no Ghost, the headline and the orange button into the first persona's letter (R7). |
   | `index` | `/demo` | none | The Scene with the persona envelopes and the live demo entry (R16). |
   | `emerging` | `/demo/personas/{key}` | `loading`, `openable`, `verifying` | The ground shakes and the Ghost rises holding the Envelope. The status line after the headline (R9.1). |
   | `sealed` | same | `sealed` | The Ghost holding the Envelope, the opening date, the time remaining and "Try again" at zero. Nothing about the contents. |
   | `intact` | same | `verified` | The seal-is-intact statement and the Pick_Up_Button. |
   | `recall` | same | `recall`, `submitting`, `submit_failed` | The Ghost still holding the Envelope, turned over to the wax seal, and one recall question at a time in the content column. |
   | `marks` | same | `reveal` stage 1, no Seal_Break running | The judge's answers, read-only, in the content column, and the unbroken seal on the Envelope the Ghost holds. |
   | `seal` | same | `reveal` stage 1, Seal_Break in progress or its button version playing | The seal cracking on the Envelope the Ghost holds, then the Ghost leaving. |
   | `letter` | same | `reveal` stage 2 | The letter on paper in the Letter_Block, and "See the numbers". |
   | `figures` | same | `reveal` stage 3, before the figures sequence has settled | The Figure_Entries fading up. |
   | `close` | same | `reveal` stage 3, after the figures sequence has settled or been skipped | The close (R15). |
   | `error` | same | `not_placed`, `unreachable`, `verification_failed`, `open_failed` | The existing FlowError message on the Scene. No Pick_Up_Button. |

2. WHEN the Flow state or view-local state changes to a state in a different table row, THE root element SHALL set `data-ceremony` to that row's Stage name in the same render that first shows that Stage's content.
3. WHILE the Flow state and view-local state stay within one table row, THE root element SHALL keep the same `data-ceremony` value.
4. WHILE the Opening_Flow runs on `/l/[id]` in a Flow state listed in criterion 1, THE shared Stage views SHALL set `data-ceremony` to the Stage name that criterion 1 gives for that Flow state.
5. WHILE the Opening_Flow on `/l/[id]` is in a state that spec 06 added for unlocking, THE root element SHALL carry the same `data-ceremony` value that state had before this spec.
6. THE root element SHALL carry `data-ceremony-motion`, set to `calm` while Calm_Mode is on and to `full` while Calm_Mode is off. WHEN Calm_Mode is turned on or off, THE root element SHALL update the value in the same render.
7. THE Opening_Flow SHALL NOT use a timer to move the judge from `intact` to `recall`, from `recall` to `marks`, from `marks` to `letter`, or from `letter` to `figures`. WHEN the judge activates that move's control by pointer, touch or keyboard, THE Opening_Flow SHALL make the move. The controls are the Pick_Up_Button, submitting the last recall answer, Seal_Break or its "Break the seal" button, and "See the numbers".
8. THE Reveal SHALL show its parts in the spec 03 R9.1 order: the judge's answers, then the letter, then the figures. WHILE a Stage is shown, THE document SHALL contain no element that holds text or values from a part of a later Stage, whether visible or hidden.
9. EVERY Stage SHALL be reachable by the QA agent without changing the database or any server code. `scene` SHALL be reachable at `/`, `index` at `/demo`, and every persona Stage at `/demo/personas/us-maya` through the button path. `sealed` SHALL be reachable by stubbing `GET /api/letters/{id}` in the browser. The design SHALL list the exact steps for each Stage.

### R3. Visual language and the orange rule

**User story:** As a judge, I want the journey to look like one strong, dark, Kiro-world scene, so that it holds my attention for the whole video.

1. THE Scene SHALL use the background token as its page background, the purple token for its light and the Letter_Block, white for the Ghost, the text and muted tokens for text on the background, the Text_On_Purple token for text on the purple, and the Accent as its only accent colour.
2. THE Scene SHALL NOT show a desk, candle, parchment texture, moon, gravestone, mound, cross or cartoon Halloween prop.
3. THE Scene SHALL set every headline in Inter at font weight 800 or 900.
4. THE Scene SHALL set every text other than the letter text in Inter. This includes headlines, body text, UI text and all data: figure values, changes, formulas, periods and sources.
5. THE Scene SHALL set the letter text in EB Garamond.
6. THE design SHALL NOT add a font beyond the Inter and EB Garamond files in `src/app/fonts`.
7. THE design SHALL define every colour used on Scene pages as a token in one CSS module under `src/components/ceremony/`, with these starting values: background `#0b0912`, text `#f5f3ff`, muted `#bdb4dc`, purple `#8F46FF`, Text_On_Purple `#ffffff`, Accent `#ff7b1c`, text on Accent `#1a0c00`, paper `#f6ead4`, ink `#1f1b16`.
8. THE Scene components SHALL reference colours only through the tokens in that module, with no colour literal written anywhere else.
9. THE Accent SHALL be used only for: the word "receipts." in the headline, the main buttons, the wax seal, the focus ring outside the Letter_Block and the judge's own answer (the "Your answer" value and the Mark on the Number_Line).
10. THE Accent SHALL NOT be used on a figure value, a change, a formula, a period, a source control, or any element that shows a direction.
11. THE Accent SHALL NOT be used as a text colour or as a focus ring on the purple surface, since the Accent on purple is about 1.8:1 and fails WCAG 2.2 AA.
12. THE Scene SHALL show figure values, changes and formulas in the text or muted token on the background surface.
13. THE Scene SHALL give all body text, data and numbers a contrast ratio of at least 4.5:1 against the surface they sit on (WCAG 2.2 AA).
14. THE focus ring SHALL have a contrast ratio of at least 3:1 against every surface it sits on and against the same element's unfocused state (spec 05 R11.8).
15. THE focus ring SHALL be the Text_On_Purple white on every control inside the Letter_Block, and the Accent on every control outside the Letter_Block. White on purple is about 4.7:1.
16. THE Scene SHALL give an increase and a decrease the same colour, icon, arrow style and font weight, so that nothing implies a number moved in a good or bad direction (`neutrality.md`).
17. THE Scene SHALL set every text that sits directly on the purple surface in the Text_On_Purple token. The text token `#f5f3ff` on purple is about 4.2:1 and near-black on purple is about 4.2:1, so neither SHALL be used for text on purple.
18. WHEREVER the headline "Your past self returns with the receipts." is shown, THE headline SHALL break so that "the receipts." stays together on its last line, at every viewport width.

### R4. Contrast

**User story:** As a judge with low vision, I want every word and number readable on the surface it sits on, so that the dark look costs me nothing.

1. THE contrast test SHALL compute the WCAG 2.2 contrast ratio of every text-and-surface token pair this spec uses. The pairs SHALL include at least: white on near-black, muted on near-black, Text_On_Purple on purple, ink on paper, ink-soft on paper, Accent on near-black, text on Accent, the Envelope_Front text on the Envelope paper, the Top_Bar notice text on the Top_Bar surface, the white focus ring on every surface inside the Letter_Block where a focusable control can sit, and the Accent focus ring on every surface outside the Letter_Block where a focusable control can sit.
2. WHERE a text or surface token is partly transparent, THE contrast test SHALL composite it over the surface directly beneath it before computing the ratio.
3. IF a normal-text pair has a ratio below 4.5:1, THEN THE contrast test SHALL fail and name the pair and its ratio. Normal text is any text below the WCAG large-text size: 24 px at regular weight, or 18.66 px at weight 700 or heavier.
4. IF a large-text pair, a control boundary or a focus ring has a ratio below 3:1 against its adjacent surface, THEN THE contrast test SHALL fail and name the pair and its ratio.
5. IF any text in the Scene, the Top_Bar, the Letter_Block or the Recall_Pager that sits directly on a purple surface uses any colour other than the Text_On_Purple token, including the Accent, the text token and near-black, THEN THE contrast test SHALL fail, whatever the computed ratio is.
6. THE "faded" and dirt effects on the Envelope SHALL apply only to decorative elements. They SHALL NOT change the colour or opacity of any text glyph.
7. WHERE the dirt effect lies behind Envelope text, THE contrast test SHALL check that text against the darkest and the lightest colour the dirt can place behind it. Each of those pairs SHALL meet the thresholds in criteria 3 and 4.
8. THE contrast test from spec 05 R11.6 SHALL keep every pair and threshold it already checks. A pair SHALL change only where this spec changes the value of one of the pair's tokens. THE desk token pairs SHALL be retired from the contrast test in task 9, together with the desk code they check, and in no earlier task.
9. IF a focus ring on a control inside the Letter_Block uses the Accent, THEN THE contrast test SHALL fail and name the control.

### R5. The Ghost

**User story:** As a judge, I want my past self to be a ghost that is clearly Revenant's own, so that the concept is memorable and no one mistakes it for Kiro's logo.

1. THE Ghost SHALL be a plain sheet ghost: a round head, big dark oval eyes, a body that shades from white at the head to lilac at the hem, a purple glow around its outline, and a jagged zigzag hem along its whole bottom edge. THE Ghost SHALL have no hood, no hands and no arms, and no part of its outline SHALL read as any of these.
2. THE Ghost SHALL hold the Envelope in front of its body. THE Envelope SHALL be drawn above the body and overlap the body. In every Stage where the Ghost is shown, at every viewport width, THE Envelope SHALL cover no part of either eye and no part of the zigzag hem, because the hem is part of what makes the Ghost Revenant's own (R5.4).
3. THE Ghost SHALL be original inline SVG, written in this repository, and recorded in `src/components/ceremony/ASSETS.md` (spec 05 R15.2). THE Ghost SHALL use no external image file, no raster image and no font glyph.
4. THE repository SHALL contain no file, image, SVG path data or description of Kiro's logo or mascot. THE design SHALL NOT describe Kiro's logo or mascot. THE design SHALL describe what makes the Ghost Revenant's own: the zigzag hem, the held Envelope, the proportions and the eyes. ANY side-by-side of the Ghost and Kiro's logo is made by the owner, outside the repository, and nothing from it is written into the repository.
5. THE design SHALL state the maximum eye offset as a single number in the Ghost's SVG units. At that offset, each eye SHALL stay fully inside the head outline.
6. WHILE Calm_Mode is off and a mouse or pen pointer is over the page, THE Ghost's eyes SHALL move toward the pointer, and their offset from the idle position SHALL never exceed the stated maximum.
7. WHILE Calm_Mode is on, or input is by touch or keyboard only, THE Ghost's eyes SHALL rest in their idle position and SHALL not move.
8. WHEN the pointer leaves the page, THE Ghost's eyes SHALL return to their idle position.
9. THE Ghost's drawing (body, eyes, hem and glow) SHALL be hidden from assistive technology. THE drawing SHALL have no accessible name, no focusable element and no position in the tab order. THE Envelope the Ghost holds, with its text and its seal, is not part of the drawing and follows its own criteria (R8, R10, R12, R19).
10. WHILE Calm_Mode is off, from the end of the Emergence until the Seal_Break completes, THE Ghost SHALL play the Idle_Bob: a slow, small up-and-down motion that repeats. THE design SHALL state the Idle_Bob's amplitude and period as constants in `src/components/ceremony/constants.ts`.
11. THE Idle_Bob amplitude SHALL be at most 4 CSS pixels, and the Idle_Bob period SHALL be at least 3,000 ms.
12. THE Idle_Bob SHALL animate only the `transform` property.
13. THE Idle_Bob SHALL delay no control and no event. THE Pick_Up_Button, the Seal_Break and every other control SHALL follow their own criteria whatever phase the Idle_Bob is in.
14. WHILE Calm_Mode is on, THE Ghost SHALL show no Idle_Bob. WHEN the judge turns on the Calm control, THE Ghost SHALL stop the Idle_Bob within 200 ms and rest at its holding position, since the Idle_Bob is ambient motion that runs for more than five seconds (WCAG 2.2.2).
15. WHILE the viewport width is at or above the R14.1 breakpoint, THE Ghost_Box SHALL be min(50vh, 560px) wide and 1.2 times its width tall. Measured widths: 384 CSS px at 1024 by 768, 360 at 1280 by 720, 400 at 1280 by 800, 450 at 1440 by 900 and 540 at 1920 by 1080.
16. WHILE the viewport width is at or above the R14.1 breakpoint, in every Stage where the Ghost is shown, THE Ghost_Box centre x SHALL sit at 72% of the Scene_Frame width from the Scene_Frame's left edge, within 1 CSS px. Measured Ghost_Box centre x, from the window's left edge: 922 CSS px at 1280 by 800, 1037 at 1440 by 900, 1277 at 1920 by 1080 and 1597 at 2560 by 1440.
17. THE Ghost SHALL NOT move sideways on pick up or in any later Stage. AT the same viewport, THE Ghost_Box centre x in the `recall`, `marks` and `seal` Stages SHALL equal its centre x in the `intact` Stage, within 1 CSS px, at every viewport width. THE upward lift of R10.7 and, below the R14.1 breakpoint, the move up and the scale of R10.15 SHALL still apply, and SHALL leave the centre x unchanged. Measured sideways move on pick up: 0 CSS px at 1280 by 800, 1440 by 900, 1920 by 1080 and 2560 by 1440.
18. WHILE the viewport width is at or above the R14.1 breakpoint, THE Content_Column SHALL be at most min(34rem, 46vw) wide, and SHALL sit inside the Scene_Frame.
19. AT 360 by 640, 1024 by 768, 1280 by 720, 1280 by 800, 1440 by 900, 1920 by 1080 and 2560 by 1440 CSS pixel viewports, in the `intact`, `recall` and `marks` Stages, no text line box and no control box SHALL intersect the Ghost_Body_Box. In the `intact` Stage, THE check SHALL include every line box of the headline (`h1`). THE check SHALL use the browser's line boxes from `Range.getClientRects` for text, and `getBoundingClientRect` for controls. Measured: 0 intersections at each of these viewports.

### R6. Soil, light and the canvas

**User story:** As a judge, I want the ground the ghost rises from to feel like real dirt lit from above, so that the scene feels physical.

1. THE Soil SHALL span the full width of the Scene and SHALL have an irregular top edge made of clumps. THE upper faces of the clumps SHALL be lit in purple from above, in both the Soil_Canvas and the Soil_Fallback.
2. WHILE the Ghost rises during the Emergence in full motion (not Calm_Mode, not low-power mode, Soil_Canvas loaded), THE Soil_Canvas SHALL throw clods off the Soil's top edge and SHALL draw dust drifting in the purple light.
3. THE Soil SHALL show no mound, headstone, cross or other grave-like shape. NO part of the Soil SHALL rise above the top-edge band, whose maximum height in CSS pixels the design states.
4. THE Soil_Canvas SHALL be exactly one 2D canvas element per page, loaded with dynamic `import()` after the page's first render. Its code SHALL NOT be part of any route's first-load JavaScript.
5. THE Soil_Canvas SHALL draw from a fixed seed that the design states, so that two loads at the same canvas size draw the same clumps. THE Soil_Canvas SHALL draw at most the maximum particle count and at most the maximum frame rate that the design states. The starting values are spec 05 `DUST_MAX_PARTICLES = 36` and `DUST_MAX_FPS = 30`.
6. THE Ceremony SHALL use no WebGL context and no animation library.
7. WHERE scripts are disabled, or Calm_Mode is on, or the device is in low-power mode (spec 05 R13.6), THE page SHALL show the Soil_Fallback and SHALL NOT request the Soil_Canvas code.
8. IF the Soil_Canvas code fails to load, or the browser cannot create a 2D canvas context, THEN THE page SHALL show the Soil_Fallback in its place. THE Emergence, the Pick_Up_Button and the rest of the Opening_Flow SHALL keep working, and THE page SHALL show no error to the judge.
9. THE Soil_Canvas and the Soil_Fallback SHALL be excluded from the accessibility tree and SHALL NOT receive keyboard focus.
10. NOTHING in the Scene SHALL flash more than three times in any one-second period. THE brightness of the purple light SHALL change by no more than a maximum amount per second that the design states as a change in relative luminance.
11. WHEN the judge turns on the Calm control, THE Scene SHALL stop, within 200 ms, all ambient motion that would otherwise run for more than five seconds, including the dust, the purple light and the Idle_Bob (WCAG 2.2.2). THE Soil SHALL then be shown as the Soil_Fallback.
12. RANDOMNESS in the Scene SHALL come only from the fixed seed. NO `Math.random`, `Date.now` or other clock read SHALL affect rendered text or markup, so the server render and the browser render produce identical markup with no hydration mismatch.
13. EACH task that adds or changes the Soil_Canvas SHALL state in its PR the canvas's effect, in kB, on the first-load JavaScript of each route (R21).
14. WHILE the viewport width is at or above the R14.1 breakpoint, THE Soil SHALL be a strip 14vh tall whose top sits at 74vh (112 CSS px tall at 1280 by 800). WHILE the viewport width is below that breakpoint, THE Soil SHALL be a strip 8vh tall whose top sits at 69vh (51.2 CSS px tall at 360 by 640). Below the strip, THE Scene SHALL show the plain background token, with no dirt, glow or texture.
15. ON `/` and the persona page, in every Stage, no text, button or form control SHALL sit on the Soil, the Soil_Canvas or the Soil_Fallback. An element sits on the Soil when its box overlaps the Soil strip's box. Each text, button and form control SHALL sit either above the Soil or below the Soil strip on the plain background. Dirt, glow and texture are decoration only and never sit on text (`tone.md`).
16. IN every Stage, THE Soil_Canvas SHALL draw no dust particle and no clod above the line 8 CSS px below the bottom of the Top_Bar. WHILE the headline is shown, THE Soil_Canvas SHALL also draw no dust particle and no clod above the line 8 CSS px below the bottom of the headline. Both limits SHALL hold after the Scene moves up on narrow viewports (R10.15).
17. WHILE the viewport width is at or above the R14.1 breakpoint, on `/`, `/demo` and the persona page, THE purple light SHALL be centred horizontally at 72% of the Scene_Frame width from the Scene_Frame's left edge, the same x as the Ghost_Box centre x of R5.16, within 1 CSS px. THE light SHALL NOT move sideways on pick up or in any later Stage (R5.17).
18. THE Soil, the purple light's glow, the dust and the clods SHALL run the full width of the window, not only the Scene_Frame. ON a window wider than 1440 CSS px, THE area outside the Scene_Frame SHALL be even dark margins on the left and the right, with the Soil running through them.

### R7. The landing page `/`

**User story:** As a judge who clicks the link once, I want the front page to open the scene and take me into a letter in one click, so that I reach the experience before I lose interest.

1. WHEN the landing page loads in full motion, THE landing page SHALL show the Scene dark first, and SHALL then bring the purple light up onto the strip of Soil over a duration that the design states. WHERE scripts are disabled, or in Calm_Mode, or in low-power mode, THE landing page SHALL show the Scene with the light already up and the Soil_Fallback in place from first paint, with no fade.
2. THE landing page SHALL have exactly one `h1`. Its text SHALL be exactly "Your past self returns with the receipts.". It SHALL be set in Inter at weight 800 or 900 (R3.3), and its font size SHALL be the largest of any text on the page. The word "receipts." (period included) SHALL be in the Accent, and no other word of the headline SHALL be in the Accent.
3. WHEN the Persona_List contains at least one persona, THE landing page SHALL show exactly one Accent button. It SHALL link to `/demo/personas/{key}`, where `{key}` is the key of the first persona in Persona_List order.
4. THE Accent button's text SHALL be a plain call to open the letter. It SHALL name the persona by the display name from the Persona_List, and SHALL NOT contain "break", "broken", "unseal" or any other wording that says the seal is broken. THE proposed text is "Open {name}'s letter".
5. IF the Persona_List contains no personas, THEN THE landing page SHALL show no Accent letter button, SHALL still render the Scene and the headline, and SHALL keep the explanation and the `/demo` link of criterion 6.
6. THE current explanation paragraphs and the link to `/demo` (spec 03 R6.1) SHALL stay on the landing page. They SHALL come after the Scene in document order and SHALL be shown below the Scene at every viewport width.
7. THE landing page SHALL NOT run the Opening_Flow, SHALL make no request to any `/api/letters` or `/api/openings` route, SHALL NOT read the database, and SHALL NOT import `src/lib/crypto`, either statically or with dynamic `import()`.
8. THE headline text SHALL be present in the server-rendered HTML of `/`. In a production build, the browser's largest contentful paint element for `/` SHALL be the headline, at both a narrow (mobile) viewport and a wide (desktop) viewport that the design states.
9. THE landing page SHALL load the Soil_Canvas only through dynamic `import()` (R6.4), so the Soil_Canvas code is not part of the first-load JavaScript of `/`.
10. THE first-load JavaScript of `/` SHALL be at or under 130 kB gzipped in a production build. IF the task measures more than 130 kB, THEN the PR SHALL state the measured number, and the task SHALL wait for the owner to decide on the budget, because `scripts/check-js-budget.mjs` is owner-only.
11. THE landing page SHALL be built by platform-dev (R1.11). Platform-dev MAY set the dark background on `html` and `body` in `src/app/globals.css` earlier, as its own small step (task 11, R28.7), so that iOS overscroll shows no paper-coloured strip.
12. THE landing page SHALL render no Ghost, neither visible nor hidden. THE Ghost is still under the Soil on `/`, and rises only on the persona page after the judge follows the Accent button (R9).
13. THE headline and the Accent button SHALL each sit either above the Soil or below the Soil strip on the plain background (R6.15). THE explanation paragraphs and the `/demo` link of criterion 6 (spec 03 R6.1) SHALL sit on the plain background below the Soil strip, and SHALL NOT overlap the Soil.

### R8. The Top_Bar and the demo labels

**User story:** As a judge, I want to know at once that this is a demo with a fictional person, without the label pushing the headline off my screen.

1. EACH Scene page (`/`, `/demo` and `/demo/personas/[key]`) SHALL show the Top_Bar as a bar fixed to the top edge of the page, not as a block above the headline. AT a 360 by 640 CSS pixel viewport, THE Top_Bar SHALL measure at most 96 CSS pixels tall in a browser with Inter loaded. THE height SHALL be measured in the browser, not computed, and SHALL meet this limit when the persona notice wraps to two lines and Skip is shown.
2. THE Top_Bar SHALL show the "revenant" wordmark and a Demo chip on its left side, on every Scene page.
3. ON the persona page, WHILE the viewport width is at or above the R14.1 breakpoint, THE Top_Bar SHALL show the persona notice, the Calm control and Skip on its right side, in that order from left to right. WHILE the viewport width is below that breakpoint, THE Top_Bar SHALL show a first row with the wordmark and the Demo chip on the left and the Calm control and Skip on the right, and SHALL show the persona notice on its own full-width second row, so that the notice is never cut off.
4. THE persona notice SHALL read exactly "{name} is fictional. This letter was prepared later as a demo.", with `{name}` replaced by the persona's display name from the Persona_List. THE notice SHALL contain no pronoun. THE notice SHALL be shown in full, with no truncation or ellipsis, at every viewport width from 360 CSS pixels up.
5. THE Calm control SHALL sit in the Top_Bar. WHILE any part of a Scene page moves, THE Calm control SHALL be visible on that page (spec 05 R11.3).
6. THE Skip control SHALL sit in the Top_Bar. WHILE any sequence runs, THE Skip control SHALL be visible, SHALL be in the keyboard Tab order, and SHALL activate with Enter and with Space (spec 05 R11.4).
7. WHILE the viewport width is at or above the R14.1 breakpoint, THE Envelope_Front SHALL show the text "Written as of {date}", the existing opening-date label ("Opens {date}"), and the text "Prepared later as a demo.". WHILE the viewport width is below that breakpoint, THE Envelope_Front SHALL show only the written-as-of item and the opening-date item, with the Envelope at its normal held size and not enlarged to fit the text. Below that breakpoint, each item SHALL put its label and its date on separate lines: "Written as of" on one line and the date (for example "12 May 2024") on the next, and "Opens" on one line and its date on the next. THE items shown SHALL be set in small muted text that passes the R4.3 contrast threshold for normal text (4.5:1) against the Envelope paper.
8. THE written-as-of date and the opening date on the Envelope_Front SHALL be formatted as day, full month name and four-digit year (for example "5 November 2024"), as spec 03 R6.3 formats them. EACH date SHALL sit on one line and SHALL NOT break across lines, at every viewport width.
9. AT a 360 by 640 CSS pixel viewport with the page scrolled to the top, THE persona page SHALL show the whole Demo chip and the whole persona notice inside the viewport without scrolling (spec 03 R6.5). This SHALL hold in every Stage in which the Envelope_Front is shown, and at every viewport width from 360 CSS pixels up. WHILE the headline is shown, THE headline SHALL have the largest rendered font size of any text inside that viewport, including the Top_Bar.
10. AT a 360 by 640 CSS pixel viewport with the page scrolled to the top, THE Demo_Index SHALL show its full statement inside the viewport without scrolling. THE statement says that the personas are fictional, that their letters were prepared later as a demo, and that no passkey is needed (spec 03 R6.4).
11. THE Envelope_Front and the Top_Bar SHALL NOT contain any text that says or implies the letter was sealed on the persona's date, including the word "sealed" next to the written-as-of date (spec 03 R10.3, `data-integrity.md`).
12. EVERY text on the Envelope_Front SHALL have a computed font size of at least 12 CSS pixels, at every viewport width. EVERY text on the Envelope_Front SHALL sit above the dirt band along the Envelope's torn bottom edge.
13. THE envelope view SHALL still meet spec 05 R3.7: it shows the written-as-of date, the opening date, and the line that the letter was prepared later as a demo. For this rule, the envelope view is the Envelope_Front together with the Top_Bar persona notice "{name} is fictional. This letter was prepared later as a demo.", which criterion 9 keeps visible without scrolling in every Stage where the Envelope_Front is shown, at every width from 360 CSS pixels.
14. ON every Scene page, THE Top_Bar content and the main content (the headline, the status line, the Content_Column and the Reveal) SHALL be laid out inside the Scene_Frame with the same inner side padding. THE left edge of the wordmark SHALL line up with the left edge of the headline, within 1 CSS px. THE distance from the window's right edge to the right edge of the Top_Bar's last control SHALL equal the distance from the window's left edge to the left edge of the wordmark, within 1 CSS px. Measured side margin, from the window edge to the wordmark and to the Top_Bar's last control: 38 CSS px at 1280 by 800, 40 at 1440 by 900, 280 at 1920 by 1080 and 600 at 2560 by 1440.

### R9. The emergence and the real seal check

**User story:** As a judge, I want the ghost to rise holding my letter while the real check runs, so that the wait is the scene, and the letter is offered only when the check has passed.

1. WHEN the persona page first renders, THE persona page SHALL start from the same Scene as `/` at the same viewport width: the same Soil, the purple light as `/` shows it once the light is up, and the headline in the same position. THE persona page SHALL show the tagline as its headline. THE status line SHALL be the next element after the headline in reading order. WHILE the viewport width is at or above the R14.1 breakpoint, THE status line SHALL sit in the lower part of the Content_Column, above the Soil. WHILE the viewport width is below that breakpoint, THE status line SHALL sit just under the Soil strip on the plain background. WHILE Calm_Mode is off, THE Ghost SHALL be hidden under the Soil at first paint, and the Emergence SHALL then begin (criteria 5 to 7). WHILE Calm_Mode is on, criterion 14 applies instead.
2. WHILE the Flow state is `loading`, THE status line SHALL read "Bringing the letter into the light."
3. WHILE the Flow state is `openable` or `verifying`, THE status line SHALL read "Checking the seal."
4. THE status line SHALL have `role="status"` in every Flow state in which it is shown.
5. WHILE Calm_Mode is off, WHEN the persona page loads, THE Scene SHALL shake the ground exactly once, by 2 CSS pixels, for 500 ms. The shake SHALL NOT repeat on a Flow state change, a re-render or hydration.
6. WHILE Calm_Mode is off, WHEN the persona page loads, THE Ghost SHALL rise out of the Soil holding the Envelope, and the rise SHALL run at the same time as the real seal check, without delaying it.
7. WHERE the Emergence is driven by CSS from the server-rendered markup, THE Emergence SHALL start before hydration. THE Emergence SHALL NOT play when `prefers-reduced-motion: reduce` is set.
8. THE Pick_Up_Button SHALL be in the document only while the Flow state is `verified`. This SHALL hold for every order and timing of the seal check and the Emergence, and before hydration.
9. WHEN the Flow state becomes `verified` before the Emergence has reached its end state, THE page SHALL keep the Pick_Up_Button out of the document until the Emergence reaches its end state, and SHALL add the Pick_Up_Button then.
10. WHEN the Flow state becomes `verified` after the Emergence has reached its end state, THE page SHALL add the Pick_Up_Button in the same render as the `verified` state. Until then, THE status line SHALL follow criteria 2 and 3.
11. WHEN the judge activates Skip during the Emergence, THE Emergence SHALL jump to its end state, with the Ghost at its end pose holding the Envelope. THE Pick_Up_Button SHALL still follow criteria 8 to 10.
12. IF the Flow reaches an error state, at any point before or during the Emergence, THEN THE page SHALL show no Pick_Up_Button, THE Ghost SHALL NOT hand over the Envelope, and THE page SHALL show the existing FlowError message for that error kind with its existing action.
13. WHILE the Flow state is `sealed`, THE page SHALL show the existing still-sealed content (spec 05 R3.6): the opening date, the time remaining, and "Try again" once the time remaining reaches zero. THE page SHALL show nothing about the contents and no Pick_Up_Button.
14. WHILE Calm_Mode is on, THE page SHALL show no shake and no rise. THE Ghost SHALL be shown at its end pose, holding the Envelope, from the first render. The Pick_Up_Button SHALL appear as soon as the Flow state is `verified`.
15. THE shake SHALL play no sound and SHALL cause no vibration, whether the sound toggle is on or off.
16. THE status line and the Pick_Up_Button SHALL each sit either above the Soil or below the Soil strip on the plain background, at every viewport width (R6.15).

### R10. The Envelope and picking up the letter

**User story:** As a judge, I want to take the letter from the ghost myself, so that opening it feels like my choice.

1. THE Envelope SHALL be drawn with a torn, dirt-stained bottom edge, where it came out of the Soil.
2. THE Envelope SHALL have the same size, the same tear and the same dirt for every letter. THE Envelope SHALL show nothing that varies with the letter's length or the number of figures (spec 05 R3.6).
3. WHEN the Flow state becomes `verified`, THE page SHALL show the statement "The seal is intact. Nothing here has changed since it was sealed." (spec 05 R2.4, `sealIntact` in `src/components/reveal/copy.ts`), placed before the Pick_Up_Button in reading order (spec 05 R5.3).
4. WHILE the Flow state is not `verified`, THE page SHALL NOT show the Pick_Up_Button.
5. THE Pick_Up_Button SHALL be an orange button in the Accent with the visible label "Pick up the letter".
6. WHEN the judge activates the Pick_Up_Button by pointer, Enter or Space, THE page SHALL send `BEGIN` to the Opening_Flow exactly once.
7. WHILE Calm_Mode is off, WHEN the judge activates the Pick_Up_Button, THE Ghost SHALL move upward by no more than one quarter of its own height, with no sideways move (R5.17).
8. WHILE Calm_Mode is off, WHEN the judge activates the Pick_Up_Button, THE Envelope SHALL turn over where the Ghost holds it to show the wax seal, and the turn SHALL finish within 1200 ms of activation.
9. WHILE Calm_Mode is on, WHEN the judge activates the Pick_Up_Button, THE Envelope SHALL show the wax seal side by an instant cut or by a fade of at most 150 ms.
10. THE wax seal SHALL be the Accent colour for every persona and SHALL carry a small ghost pressed into it. This replaces the per-key seal pattern of spec 05 R8.4 (see "Rules this spec replaces").
11. THE wax seal SHALL show no religious, national or political symbol.
12. WHILE the Seal_Break has not happened, THE wax seal SHALL NOT be shown broken, cracked or lifted.
13. WHILE the persona page shows the `recall`, `marks` or `seal` Stage, THE Ghost SHALL keep holding the Envelope (R5.2), wax seal side out, until the Seal_Break completes (R12.6, R12.7).
14. THE Envelope SHALL NOT move to the content column. WHILE the viewport width is at or above the R14.1 breakpoint, THE content column on the left SHALL hold only the recall content (R11) in the `recall` Stage and the marks content (R12.12) in the `marks` Stage.
15. WHILE the viewport width is below the R14.1 breakpoint, during the `recall` and `marks` Stages, THE Scene MAY move up under the Top_Bar, since the headline is no longer shown, and THE Ghost MAY scale down toward the Soil to a scale of no less than 0.8, about its own centre x (R5.17). Both moves SHALL use `transform` only (R21.4), so that the Stage content fits below the Soil strip on the plain background (R6.15). THE Ghost SHALL still hold the Envelope, and the seal SHALL stay pressable.
16. THE seal's pointer target SHALL be at least 44 by 44 CSS pixels at every Ghost scale (R19.6). ITS visible size MAY be smaller than its pointer target.

### R11. Recall, one question at a time

**User story:** As a judge, I want to answer one question at a time by typing a number, so that recall is quick and I am not faced with a form.

1. WHILE the recall Stage is shown, THE Recall_Pager SHALL show exactly one question at a time, in payload order, with the question text and the unit as spec 03 R8.2 requires. It SHALL show no figure value, period, source or hint.
2. WHEN a question is shown, THE page SHALL move keyboard focus to that question's typed number field. This applies on entering the recall Stage, after Next, after Previous, after Enter, and after an invalid submit (criterion 10). The typed number field SHALL be the main input, placed above the Recall_Scale.
3. WHEN the judge presses Enter in the number field of a question that is not the last, THE Recall_Pager SHALL show the next question in payload order. It SHALL not check the draft first and SHALL send no event.
4. WHEN the judge presses Enter in the last question's number field, THE page SHALL call the existing submit handler. This is the same handler as the submit control.
5. ON the persona page, THE Recall_Pager SHALL show the counter line "Question {n} of {total} · as of {date}" on every question, where {n} counts from 1, {total} is the number of recall questions in the payload, and {date} is the persona's written-as-of date in the spec 03 R6.3 format. THE text "as of {date}" SHALL NOT break inside the date. IF the opened letter is a Live_Letter, THEN THE counter line SHALL read "Question {n} of {total}", with no "as of" part (R17.11). It SHALL show a "Next question" control on every question but the last and a "Previous question" control on every question but the first. It SHALL show the existing submit control on the last question only. IF the payload has exactly one recall question, THEN THE Recall_Pager SHALL show only the submit control, with no Next or Previous control.
6. THE Recall_Scale SHALL stay directly under the number field of the shown question as a second way to enter the same value. Every spec 05 R4 rule SHALL still apply, including the start-unplaced rule of R4.2 and the 360-pixel drag rule of R4.12. WHEN the judge types a value, THE Mark SHALL move to it. WHEN the judge moves the Mark, THE number field SHALL update to the same value (spec 05 R4.6).
7. WHEN the judge activates the "No answer" control of the shown question, THE page SHALL send `TOGGLE_NO_ANSWER` for that question only (spec 03 R8.3). The control SHALL be available on every question.
8. WHEN the judge activates Next, Previous or Enter to change question, THE Recall_Pager SHALL change only the view-local index of the shown question and SHALL send no event to the Opening_Flow. Drafts SHALL change only through `EDIT_DRAFT` and `TOGGLE_NO_ANSWER`. WHEN the judge returns to a question, THE page SHALL show that question's draft exactly as entered: the same typed text, the same Mark position or unplaced state, and the same "No answer" state.
9. WHEN the page submits, THE Recall_Record SHALL be identical to the one spec 03 and spec 05 produce from the same final drafts. It SHALL use the same `buildRecallRecord`, the same encryption and the same `POST /api/openings` body, whatever order the judge visited the questions in.
10. IF the judge submits while one or more questions are invalid under spec 03 R8.4, THEN THE Recall_Pager SHALL show the first invalid question in payload order with the existing inline message. It SHALL keep every draft exactly as entered and SHALL send nothing to the server.
11. WHILE a submit is in flight, THE submit control, the retry control and Enter-to-submit SHALL be disabled (spec 03 R8.9).
12. IF the post fails, THEN THE page SHALL show the existing submit-failed message and retry control (spec 03 R8.7) and SHALL keep every draft exactly as entered.
13. AT both a 1280 by 800 and a 360 by 640 CSS pixel viewport, with the page scrolled to the top, THE question text, the number field and the "Next question" control (or the submit control, on the last question) SHALL each be fully inside the viewport. NONE of them SHALL overlap the Soil (R6.15). THE counter line of criterion 5, with its written-as-of date, SHALL also be fully inside the viewport. This SHALL hold for every question, including the first.
14. IF an invalid submit shows the inline message (criterion 10), THEN criterion 13 SHALL still hold. THE message MAY push the Recall_Scale down, and SHALL NOT push the number field or the control out of the viewport.
15. THE Recall_Scale, the "No answer" control and the intro line MAY sit below the fold. On a viewport below the R14.1 breakpoint, the intro line MAY sit below the fold on the first question.
16. THE question text SHALL be set as a heading at the body-heading size that the design states. IT SHALL NOT be a multi-line display heading at weight 900. THE typed number in the number field SHALL be the largest text in the recall Stage.

### R12. Breaking the seal and the Ghost leaving

**User story:** As a judge, I want to break the seal and watch my past self deliver the letter and go, so that the unsealing is the moment I remember.

1. THE Seal_Break SHALL keep every spec 05 R6 rule unchanged. These rules are a press and hold of `SEAL_HOLD_MS = 1500` ms, a "Break the seal" button, fixed crack paths, an early release that settles back and sends nothing, Skip, and "Show everything".
2. WHEN the judge keeps the hold for `SEAL_HOLD_MS` (1500 ms), or activates the "Break the seal" button, THE Ceremony SHALL send exactly one `ADVANCE` event.
3. IF a second hold completes, or the "Break the seal" button is activated again, after `ADVANCE` has been sent for this Seal_Break, THEN THE Ceremony SHALL send no further event.
4. WHILE the Seal_Break has not completed, THE Ghost SHALL stay on screen at its holding position, and no Ghost exit motion, flap lift or letter slide SHALL have started.
5. IF the judge releases the hold before `SEAL_HOLD_MS` has elapsed, THEN THE Ceremony SHALL send no event, THE Ghost SHALL stay at its holding position, and THE seal SHALL settle back to unbroken.
6. WHEN `ADVANCE` is sent and Calm_Mode is off, THE Ghost SHALL move upward and fade to fully transparent, and SHALL then be removed from the page.
7. WHEN `ADVANCE` is sent and Calm_Mode is off, THE Envelope flap SHALL lift, and THE letter SHALL then slide out of the Envelope and unfold to the same end state that Calm_Mode shows.
8. WHEN the judge activates "Show everything" in reveal stage 1, THE page SHALL send exactly one `SHOW_ALL` event and SHALL show the seal broken, the letter at its end state and no Ghost, with no Ghost exit motion, flap lift or letter slide played.
9. WHEN the judge activates Skip during the Seal_Break, THE page SHALL follow the spec 05 R6 Skip rule and SHALL show no Ghost after the skip.
10. WHILE Calm_Mode is on, WHEN `ADVANCE` is sent, THE Ghost SHALL be removed either by an instant cut or by a fade lasting at most 150 ms, and THE letter SHALL be shown at its end state with no flap lift, slide or unfold motion.
11. WHILE the persona page shows the `marks` or `seal` Stage, THE wax seal SHALL be pressable where the Ghost holds the Envelope. THE press and hold of criterion 1 SHALL start on the seal in that place, and THE "Break the seal" button SHALL stay.
12. AT both a 1280 by 800 and a 360 by 640 CSS pixel viewport, with the page scrolled to the top, in the `marks` Stage, THE "What you remembered" heading, the judge's answers and the "Break the seal" button SHALL each be inside the viewport, and none of them SHALL overlap the Soil (R6.15). THE wax seal SHALL be inside the viewport.

### R13. The letter

**User story:** As a judge, I want to read what was written on warm paper inside one strong block, so that the letter is the centre of the screen.

1. WHEN reveal stage 2 is shown, THE page SHALL show the letter on warm paper inside the Letter_Block, the one big rounded purple block. THE Letter_Block SHALL be the only Letter_Block on the page.
2. THE paper SHALL keep its fold creases as decoration only. THE fold creases SHALL be hidden from assistive technology, and every letter character SHALL meet the normal-text ratio of R4.3 against the darkest point of any crease it overlaps.
3. WHEN reveal stage 2 first renders, THE letter text SHALL be in the document in full, with no script needed to add it. THE text SHALL be plain text in EB Garamond (R3.5), with every line break kept and every markup character shown as written (spec 05 R7.1, spec 03 R10.1).
4. THE page SHALL apply no ink effect to the letter text: no clip, mask, line-by-line reveal or fade on the text itself. WHEN the unfold of R12.7 ends, THE letter text SHALL be fully visible at its final contrast. The unfold is the reveal. This retires spec 05 R7.2 and R7.3 (see "Rules this spec replaces").
5. IF Calm_Mode is on, or Skip or "Show everything" is used, THEN THE page SHALL show the letter at its end state, fully visible, with no flap lift, slide or unfold motion (R12.8, R12.10, R19.2).
6. WHEN reveal stage 2 is shown, THE labels from spec 03 R10 SHALL be visible with the letter from the first render of reveal stage 2. IF the letter is a Live_Letter, THEN THE labels of spec 06 R18.2 SHALL be shown in their place.
7. THE page SHALL place nothing against a line of the letter. No annotation, highlight, marker, underline or link SHALL be tied to any part of the letter text.
8. WHILE reveal stage 2 is shown, THE "See the numbers" button SHALL be visible and reachable by keyboard. WHEN the judge activates it, THE page SHALL send the existing event that moves to reveal stage 3 (spec 05 R3.4).
9. THE page SHALL NOT send the reveal stage 3 event from a timer, from the end of the unfold or from scrolling. Only the "See the numbers" button or "Show everything" SHALL move to reveal stage 3. Skip SHALL end the running sequence and SHALL NOT move to reveal stage 3.

### R14. Figures

**User story:** As a judge, I want each figure laid out plainly next to my own answer, so that I see the gap between memory and record and draw my own conclusion.

1. THE design document SHALL state one layout breakpoint as a viewport width in CSS pixels. WHILE the viewport width is at or above that breakpoint, THE Figure_Entries SHALL sit in one column beside the Letter_Block. WHILE the viewport width is below that breakpoint, THE Figure_Entries SHALL sit below the Letter_Block. In both layouts, THE Figure_Entries SHALL sit on the dark surface and never inside the Letter_Block.
2. THE Figure_Entries SHALL appear in the order of the figures in the sealed payload. THE Figure_Entries SHALL NOT be sorted, grouped or hidden by value, by direction of change or by the Mark's distance from any figure (spec 05 R9.3).
3. EACH Comparable Figure_Entry SHALL show these items, in this order from top to bottom:
   1. the metric's display name, small and uppercase;
   2. "Your answer" followed by the judge's value and unit in the Accent, or "No answer" if the judge gave no value;
   3. the then value, in the largest and heaviest type style of the Figure_Entry, because the recall question asked about then;
   4. the then period, the region, and the "historical record, retrieved {date}" label, or the "fixture data" label for a Fixture_Figure (spec 03 R13);
   5. the Number_Line with the then figure, the now figure and the Mark, with the Mark in the Accent;
   6. the now value on its own line under the Number_Line, bold at body text size, with the now period, the region and the retrieved date on the same line;
   7. the change line (spec 03 R11.7, R12.9);
   8. the formula with both input values, present as text in the document;
   9. the source control, which shows the source, the series ID and the `source_url` after one click, one tap, or one Enter or Space key press.
4. THE Number_Line SHALL keep spec 05 R12.2 to R12.4. Its range SHALL come only from the then and now values. Its padding SHALL be the same on both sides. It SHALL use a fixed minimum span when the then and now values are equal. A Mark outside the range SHALL sit at the nearer edge, with the same look at both edges. No displayed number SHALL be computed from a position.
5. IF the Change_Calculator reports a pair as not Comparable, or the Now_Figure is unavailable, THEN THE Figure_Entry SHALL show its existing honest rendering (spec 03 R11.5 and R11.6), SHALL still show the then value with its period, and SHALL show no Number_Line, no Mark and no change line (spec 05 R9.6).
6. WHILE at least one shown figure is a Fixture_Figure, THE page SHALL show exactly one fixture note (spec 03 R13.5). WHILE no shown figure is a Fixture_Figure, THE page SHALL show no fixture note.
7. WHEN the figures stage starts, ALL Figure_Entries SHALL appear with one fade-up. THE fade-up duration and any stagger step SHALL be constants in one module. THE stagger step SHALL be at most 100 ms. THE delay for each entry SHALL depend only on its position in the list, and SHALL be the same for every figure, every value and every direction of change.
8. THE figures sequence SHALL end at the same fixed time after the figures stage starts, whether 1, 2, 3, 4, 5 or 6 figures are shown (`MAX_FIGURES = 6`, spec 06, in `src/components/live/constants.ts`). `MAX_FIGURES` SHALL be repeated in `src/components/ceremony/constants.ts`, and a test SHALL check that the two values are equal. That total time SHALL be a constant in the same module as the fade-up constants, and SHALL NOT depend on any figure, answer, period, span or change.
9. A static render of the figures component, with no animation run, SHALL hold the final state: every value, label, fixture note, change line and formula, at full opacity. THE names `FiguresThenNow`, `FigureLine` and `FixtureNote`, and the props that #49 and #84 use, SHALL stay unchanged (spec 05 R9.7 and R9.8).
10. IF the opened letter is a Live_Letter, THEN THE figures stage SHALL show the zero change and the fixed note exactly as spec 06 R18.5 and R18.6 describe.
11. EVERY figure number shown in a Figure_Entry (the then value, the now value and the change) SHALL show the period of each figure it comes from next to it (`data-integrity.md`). The judge's answer is not a figure and carries no period.
12. THE then value and the now value SHALL each keep their own type style from criterion 3 for a rise, a fall and a zero change. THE type styles SHALL say nothing about direction, and a rise and its mirror-image fall SHALL render the same markup except for the parts R20.2 allows.

### R15. The close

**User story:** As a judge, I want a quiet end with one clear next step, so that I know the record has been shown and can try sealing my own.

1. WHEN the figures stage reaches its final state, THE close SHALL appear below the figures stage. The figures stage reaches its final state in one of three ways: the last Figure_Entry animation ends, the judge activates Skip during the figures stage, or the figures stage is shown in Calm_Mode or through "Show everything". THE close SHALL show these items, in this order in both the document and the visual layout:
   1. the line "The space between the two is yours to read.";
   2. WHILE Demo_2_On is true, one link to `/demo/live` in the Accent colour that reads "Seal your own. It opens 30 seconds after you seal it." (criterion 7);
   3. in text with a smaller font size than item 1, "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.";
   4. a "Start over" link to `/demo/personas/{key}`, where `{key}` is the key of the persona whose letter is open (criteria 11 and 12).
2. WHILE the figures stage has not reached its final state, THE close SHALL NOT be in the document.
3. THE close SHALL contain only the items in criterion 1. It SHALL contain no summary, score, comment or call to compare. No text, colour or order in the close SHALL depend on any figure, any answer or the difference between them.
4. THE close text and every link in the close SHALL meet WCAG 2.2 AA contrast on the Scene surface. Every link in the close SHALL be reachable and activatable with the keyboard alone, and SHALL show the focus ring when focused.
5. WHEN the close appears, THE Opening_Flow SHALL send no event (spec 05 R12.7), and the Flow state SHALL stay the same as it was before the close appeared.
6. IF the close is shown on `/l/[id]` for a Live_Letter, THEN THE close SHALL keep the spec 06 R18.6 note and link unchanged.
7. IF Demo_2_On is false, THEN THE close SHALL NOT render the `/demo/live` link at all. THE other three items SHALL stay, in the same order.
8. THE persona page server component `src/app/demo/personas/[key]/page.tsx` SHALL compute Demo_2_On the same way `src/app/demo/live/page.tsx` checks Demo 2: it SHALL read `process.env.RP_ID` at request time, trim it, and treat an empty value as Demo 2 off. THE page SHALL pass only Demo_2_On, as a boolean prop, down to the close.
9. THE value of `RP_ID` SHALL NOT be sent to the client. Only the Demo_2_On boolean SHALL reach client code.
10. THE Demo_2_On check SHALL change no file listed in R1.1, SHALL NOT change `src/lib/security-headers.ts`, any middleware, `src/app/layout.tsx`, `src/app/page.tsx` or `src/app/globals.css`, and SHALL NOT check the seal cap. WHILE Demo_2_On is true, THE close SHALL show the `/demo/live` link whether or not the seal cap is reached, since `/demo/live` explains the busy case.
11. WHEN the judge activates "Start over", THE page SHALL navigate to `/demo/personas/{key}` for the same persona and SHALL start a fresh Opening_Flow from the `emerging` Stage, so the Ghost rises again. A full fresh load of the route is acceptable.
12. WHEN the judge starts over, THE Ceremony SHALL NOT change or remove the Recall_Record already stored. THE new opening SHALL append its own Recall_Record through the existing `POST /api/openings` path, as any opening does.

### R16. The Demo_Index in the Scene

**User story:** As a judge who arrives at `/demo`, I want the same scene, so that the demo feels like one place.

1. THE Demo_Index SHALL use the Scene and the Top_Bar. THE Scene SHALL be an enhancement on top of server-rendered markup. With scripts disabled, in Calm_Mode or in low-power mode, THE Demo_Index SHALL show the Soil_Fallback and the same content as criterion 2.
2. THE server-rendered Demo_Index SHALL keep all spec 03 R6 content, in this order: the Demo label, the heading, the intro note, then one card per persona or the empty state. Each card SHALL show the display name, the region, the written-as-of date, the opening date and the open link. Dates SHALL use the spec 03 R6.3 format. The cards SHALL show nothing from inside the sealed payload (spec 03 R6.6). THE spec 03 test "exactly the personas in the Persona_List, in order" SHALL pass unchanged.
3. THE card's open link SHALL get new visible text, because "Pick up the letter" is now the Pick_Up_Button. The proposed text is "Open the letter". THE link text SHALL NOT be "Pick up the letter" and SHALL NOT say that the seal is broken.
4. WHEN a judge activates a card's open link, THE Demo_Index SHALL navigate to `/demo/personas/{key}` for that persona without asking for a passkey or a key (spec 03 R6.7).
5. THE live demo entry (spec 06 R12.1) SHALL stay. It SHALL link to `/demo/live`, sit outside the persona list element, and show whether or not the Persona_List has personas.
6. THE Demo_Index SHALL use the same page structure and the same card layout for any count from 1 to 6 personas. On a viewport 360 CSS pixels wide, every card SHALL be reachable by vertical scrolling with no horizontal scrolling.
7. IF the Persona_List contains exactly one persona, THEN THE Demo_Index SHALL show exactly one card, with no empty slots, placeholder cards or placeholder envelopes (spec 05 R8.5).
8. THE Demo label and the intro note SHALL be visible without scrolling on a 360 by 640 CSS pixel viewport (spec 03 R6.4 and R6.5). They SHALL meet WCAG 2.2 AA contrast against the Scene.
9. IF the Persona_List contains no personas, THEN THE Demo_Index SHALL show the spec 03 R6.8 empty state on the Scene, with no persona cards and no Envelope.

### R17. `/demo/live` and `/l/[id]`: restyle only

**User story:** As a judge trying Demo 2, I want the sealing and unlocking pages to match the scene, without any change to what they do.

1. THE restyle of `/demo/live` and `/l/[id]` SHALL change only colour tokens, type tokens, surfaces and button styles, all taken from this spec's tokens.
2. THE restyle SHALL leave these unchanged on both pages, as spec 06 defines them:
   - the order of the steps;
   - the states, events and transitions;
   - every call to `src/lib/crypto` and its arguments;
   - every request, including its URL, method, body and options;
   - the meaning of every copy string.
3. THE restyle (task 9) SHALL change the wording of no spec 06 copy string on either page, including every string in `src/components/live/copy.ts`.
4. THE spec 06 tests SHALL pass with no test removed, skipped or loosened.
5. WHERE a spec 06 test asserts a token value, THE test SHALL change only by replacing the old value with the new value of the same token. THE test SHALL change only where that token's value changes.
6. THE passkey and backup key warnings (spec 06 R15.6, R15.9 and R15.11) SHALL stay plain. THEY SHALL have no faded-ink, dirt, glow or animation effect on their text, and Calm_Mode SHALL not change how they look.
7. THE passkey and backup key warnings SHALL stay unmissable. EACH warning SHALL be visible in the same view as the control it guards, before that control can be pressed. NO warning SHALL be collapsed, hidden behind a toggle or delayed by an animation. Atmosphere SHALL NOT soften them (`tone.md`, "Locking").
8. EACH passkey and backup key warning SHALL have a contrast of at least 4.5:1 against the surface it sits on. ITS text and surface token pair SHALL be in the R4 contrast test.
9. WHEN `/l/[id]` shows the shared Stage views (Envelope, recall, Seal_Break, letter, figures, close), THE page SHALL use the same Stage components as `/demo/personas/[key]`, in the new look, with no separate copy in the spec 05 style.
10. `/l/[id]` SHALL NOT render the Ghost or the Soil, neither visible nor hidden. THE shared Stage views on `/l/[id]` SHALL still render every element and control this spec's criteria require. Criteria that describe only the Ghost, the Idle_Bob, the Soil or the Emergence SHALL NOT apply to `/l/[id]`.
11. THE spec 06 R18 Live_Letter reveal wording SHALL stay unchanged. This includes the "Sealed on {date and time}" line, the fixed 30-second note with its `/demo` link, and the absence of "Written as of", "Prepared later as a demo" and "Sealed for the demo on".

### R18. Timings

**User story:** As a judge watching once, I want each moment to land quickly, so that the whole journey fits in my attention.

1. THE System SHALL define every duration, delay and easing that this spec adds as a plain constant in `src/components/ceremony/constants.ts`. No constant SHALL take input from any figure, answer, period, span, change or count of figures.
2. WHEN the persona page reaches first paint, THE Emergence SHALL end within 5,000 ms. This bound covers only what the page controls: the sum of the Emergence's delays and durations in `src/components/ceremony/constants.ts` SHALL be at most 5,000 ms. Network time and the time the real seal check takes are not part of the bound.
3. IF the Flow state becomes `verified` within 5,000 ms of first paint, THEN THE Pick_Up_Button SHALL appear within 5,000 ms of first paint. IF the Flow state becomes `verified` later, THEN THE Pick_Up_Button SHALL wait for `verified` and appear at once (R9.8 to R9.10). No timing in this requirement SHALL show the Pick_Up_Button before `verified`.
4. WHEN the press-and-hold reaches `SEAL_HOLD_MS`, or the judge activates the "Break the seal" button, THE letter SHALL be readable within 3,000 ms. "Readable" means the unfold has ended and the full letter text is in the document and shown at its final contrast. The sum of the Seal_Break, Ghost-leaving and letter-entry (flap lift, slide and unfold) delays and durations in `src/components/ceremony/constants.ts` SHALL be at most 3,000 ms.
5. WHEN the judge activates "See the numbers", every Figure_Entry SHALL be settled within 4,000 ms. "Settled" means every Figure_Entry has finished its fade-up and shows its final state (R14.9). This bound SHALL hold for 1 to 6 figures (R14.8).
6. THE System SHALL define no ink-effect duration, delay or easing. THE letter text SHALL be readable as soon as the unfold ends (R13.4).
7. THE System SHALL keep `SEAL_HOLD_MS` at 1,500 ms.
8. THE ground shake SHALL move 2 CSS pixels, last 500 ms, and run once per Emergence.
9. THE System SHALL change the existing tests for constants only where a constant's value changes. THE spec 05 R10.5 property, that durations do not depend on data, SHALL apply to every new constant.
10. THE Idle_Bob amplitude and period SHALL be constants in `src/components/ceremony/constants.ts`, with the amplitude at most 4 CSS pixels and the period at least 3,000 ms (R5.11). THE Idle_Bob SHALL NOT count toward any bound in criteria 2 to 5, and SHALL delay no control or event (R5.13).

### R19. Accessibility, Calm_Mode and Skip

**User story:** As a judge using a keyboard, a screen reader or reduced motion, I want the same journey with nothing lost.

1. THE spec 05 R11 rules SHALL apply to every Stage and control this spec adds or restyles on `/`, `/demo`, `/demo/personas/[key]`, `/demo/live` and `/l/[id]`.
2. WHILE the browser reports `prefers-reduced-motion: reduce`, or the judge has turned on the Calm control, THE Ceremony SHALL run in Calm_Mode. In Calm_Mode it SHALL show no ground shake, no Ghost rise, no Idle_Bob, no eye movement, no Soil_Canvas, no clods, no dust, no Ghost dissolve, no flap lift, slide or unfold motion, and no fade-up longer than 150 ms. The Soil_Fallback SHALL be shown in place of the Soil_Canvas. Each Stage SHALL change by an instant cut or by a fade of at most 150 ms. The Stages SHALL appear in the same order as outside Calm_Mode, and no Stage SHALL be left out.
3. THE Ceremony SHALL offer a control for every gesture. Each control SHALL do the same thing as its gesture, and none SHALL need dragging, holding, pointer precision or timing. The number field SHALL set the same value as the Recall_Scale. The "Break the seal" button SHALL do the same as the hold of `SEAL_HOLD_MS`. A button SHALL do the same as each gesture that moves between Stages. Each control SHALL be reachable with Tab and work with Enter or Space, or with typed digits for the number field.
4. WHEN the Stage changes, THE Ceremony SHALL move keyboard focus to the new Stage's heading and announce the new Stage's name once in a polite live region (spec 05 R11.8). WHEN the Recall_Pager shows a question, THE Recall_Pager SHALL move keyboard focus to that question's number field.
5. THE Ghost's drawing (R5.9), the Soil, the purple light, the clods and the dust SHALL be hidden from assistive technology, so a screen reader reads none of them. WHEN the Mark is placed or moved, THE Ceremony SHALL expose the Mark to assistive technology as the judge's answer, with its value and unit.
6. THE Scene pages SHALL make every pointer target at least 24 by 24 CSS pixels, measured as its clickable area. The Pick_Up_Button, the seal, the "See the numbers" button and every close link SHALL each be at least 44 by 44 CSS pixels.
7. THE Scene pages SHALL work at a viewport width of 320 CSS pixels and at 200% browser text size without loss of content. Without loss of content means: no horizontal scrolling of the page, no text clipped or overlapping other text, and every control and every figure with its period still visible and usable.
8. WHEN the judge turns the Calm control on or off during a Stage, THE Ceremony SHALL switch modes within 150 ms. It SHALL stay on the same Stage and keep every recall answer already entered, without restarting the Stage or the Ceremony.
9. WHEN the judge uses Skip in Calm_Mode or outside it, THE Ceremony SHALL end the running sequence at its final state, as Skip does in spec 05, and SHALL stay on the same Stage. No recall question SHALL be skipped before the Recall_Record has been stored.

### R20. Neutrality and the gap between memory and record

**User story:** As the owner, I want a rise and a fall to look the same and the gap between answer and figure never scored, so that Revenant never tells the judge what to think.

1. THE spec 03 Property 20 test and its spec 05 R10.2 to R10.4 extension SHALL be extended, not duplicated, to cover every component this spec adds or restyles: the Figure_Entry, the "Your answer" line, the Number_Line in its new style, the fade-up, the Recall_Pager and the close.
2. WHEN the extended test renders a rise (Then_Figure at `t`, Now_Figure at `t + d`, Mark at `m`) and its mirror-image fall (Then_Figure at `t`, Now_Figure at `t − d`, Mark at `2t − m`), THE test SHALL assert that the two rendered markups are identical except for the numeric text, the sign or direction word, and the values of the Position_Properties in `style` attributes.
3. WHEN the extended test compares the rise and its mirror-image fall, THE test SHALL assert that every Position_Property value `p` in the rise equals `1 − p` in the fall, within a tolerance of 1e-9, and that every other `style` property, every class name and every attribute matches between the two renders.
4. THE extended test SHALL run as a property test with at least 100 generated cases, covering rises, falls, a zero change, and Marks inside, on the edge of and outside the Number_Line range.
5. NO text, number, duration, delay, easing, colour, class, motion, order, sound or vibration SHALL depend on the distance between a judge's answer and any figure. THE only parts of the rendered output that may vary with the answer SHALL be the answer's own numeric text and the Mark's Position_Property values.
6. WHEN a property test (at least 100 runs) holds the figures fixed and generates answers at arbitrary distances from them, THE test SHALL assert that the rendered markup and animation settings of the Figure_Entry, the "Your answer" line, the Number_Line, the fade-up and the close are identical except for the parts allowed by criterion 5.
7. THE Ceremony SHALL NOT compute, display, store, colour or score any difference, accuracy, closeness or grade between an answer and a figure (spec 03 R9.3). No rendered text, accessible name or attribute SHALL contain such a value.
8. EVERY user-facing string that this spec adds or changes, including accessible names, alt text and the Top_Bar notice, SHALL pass the `neutrality.md` copy test. No such string SHALL name a party, candidate, official, movement or policy.

### R21. Performance

**User story:** As a judge on a mid-range phone, I want the scene to start fast and stay smooth.

1. WHEN `scripts/check-js-budget.mjs` runs after `npm run build`, THE gzipped first-load JavaScript it reports for each route SHALL be at or under these limits, where 1 kB = 1,000 bytes: `/` 130 kB, `/demo` 130 kB, `/demo/personas/[key]` 190 kB, `/demo/live` 190 kB, `/l/[id]` 190 kB.
2. WHEN a task's PR is opened or updated, ITS description SHALL state the value from criterion 1 for each of the five routes, in kB as `scripts/check-js-budget.mjs` reports it after `npm run build` on the PR's head commit.
3. WHEN `/`, `/demo` or `/demo/personas/[key]` loads, THE largest contentful paint element SHALL be the page's headline text. That headline SHALL be in the server-rendered HTML. It SHALL NOT be an image, a canvas or an SVG, and it SHALL NOT wait for client JavaScript or texture files before it renders.
4. THE CSS animations, CSS transitions and Web Animations API animations on every page in this spec SHALL change only the `transform` and `opacity` properties. The only exception SHALL be the pixels the Soil_Canvas draws inside its own canvas.
5. THE image and texture files a Scene route loads, counted from the first request until the reveal ends, SHALL total at most 150 kB, as spec 05 R13.5 requires.
6. THE image and texture files a Scene route requests before its first paint SHALL total at most 40 kB, as spec 05 R13.5 requires.
7. THE pages in this spec SHALL NOT load any image or texture through a `data:` or `blob:` URL. THE production build SHALL be checked to confirm that Next did not inline any CSS asset as a `data:` URI (spec 05 R13.5).
8. THE Soil_Canvas code and the sound code SHALL each be loaded only through a dynamic `import()`, as separate chunks. Neither chunk SHALL count toward the first-load JavaScript in criterion 1.
9. IF Calm_Mode is on, or low-power mode as spec 05 R13.6 defines it (fewer than four logical cores, or frame time above 24 ms measured over one second) is active, THEN THE page SHALL NOT request the Soil_Canvas chunk or the sound chunk.

### R22. Sound and vibration

**User story:** As a judge, I want sound and vibration to stay optional, so that nothing startles me.

1. THE Scene SHALL keep sound and vibration exactly as spec 05 R14 defines them. Both SHALL be off when a page loads, and SHALL start only after the judge turns on the visible, labelled sound toggle.
2. THE Scene SHALL synthesise any sound in the browser. It SHALL add no audio file and SHALL make no network request for sound.
3. THE Scene SHALL keep the sound toggle state in memory for the visit only. THE Scene SHALL NOT write the toggle state to `localStorage`, `sessionStorage`, IndexedDB, cookies or the URL.
4. THE Scene SHALL add no sound or vibration cue beyond those spec 05 R14 already defines. A test SHALL confirm that no code added by this spec calls the sound code or the browser's vibration API.
5. WHEN the ground shake in the Emergence plays, THE Scene SHALL play no sound and trigger no vibration, whether the sound toggle is on or off.
6. WHILE Calm_Mode is on, THE Scene SHALL play no sound and trigger no vibration that spec 05 R14 does not already allow in Calm_Mode.

### R23. Assets and licences

**User story:** As the owner, I want every new drawing to be our own, with its record kept, so that nothing needs a licence check at the end.

1. EVERY asset this spec adds SHALL be original work created in this repository. An asset is any image, texture, icon, SVG drawing, font file or sound. Assets that are not original work SHALL NOT be added.
2. EVERY asset this spec adds SHALL have an entry in `src/components/ceremony/ASSETS.md` (spec 05 R15.2). Each entry SHALL give the asset's path or component name, how it was made, its licence ("original") and the date it was added.
3. THE ASSETS test SHALL cover every folder this spec adds assets to. IF an asset file in those folders has no entry in `ASSETS.md`, THEN the test SHALL fail and name the missing file.
4. THE Ghost, the wax seal with its pressed ghost, the Soil_Fallback and the Envelope tear SHALL be inline SVG or CSS. IF one of them cannot be drawn as inline SVG or CSS, THEN its `ASSETS.md` entry SHALL state why, and the file SHALL stay inside the spec 05 R13.5 image and texture budget.
5. THE Scene SHALL reuse the existing Inter and EB Garamond font files in `src/app/fonts`. It SHALL add no font file.
6. NO asset SHALL be generated by an AI image tool unless the owner has approved that asset and its licence terms are recorded in its `ASSETS.md` entry (spec 05 R15.5).

### R24. Copy

**User story:** As the owner, I want every new word in one reviewable place, in Revenant's voice.

1. EVERY user-facing string that this spec adds SHALL be defined in a copy module in its feature folder. THE components SHALL hold no user-facing string literal, including `aria-label`s, live-region messages and the labels of buttons that stand in for gestures (spec 05 R16.1, spec 03 R15.1).
2. THE existing scan tests for JSX text literals and banned words SHALL cover every folder that this spec adds or changes. IF a component in one of those folders contains a JSX text literal or a banned word, THEN THE scan tests SHALL fail.
3. THE new strings SHALL match the table below character for character, including capitals, punctuation and the curly placeholders. THE placeholders `{name}`, `{date}`, `{n}` and `{total}` SHALL be the only parts filled in at render time.

   | Where | String |
   |---|---|
   | Headline on `/` and the persona page | "Your past self returns with the receipts." with "receipts." in the Accent |
   | Landing button (proposed) | "Open {name}'s letter" |
   | Top_Bar persona notice | "{name} is fictional. This letter was prepared later as a demo." |
   | Envelope_Front, wide viewports | "Written as of {date}", the existing opening-date label, "Prepared later as a demo." (R8.7) |
   | Envelope_Front, narrow viewports | "Written as of" and "{date}" on separate lines, "Opens" and "{date}" on separate lines (R8.7) |
   | Pick_Up_Button | "Pick up the letter" |
   | Demo_Index card link (proposed) | "Open the letter" |
   | Recall_Pager (proposed) | "Next question", "Previous question" |
   | Recall_Pager counter line, persona letter (proposed) | "Question {n} of {total} · as of {date}" (R11.5) |
   | Recall_Pager counter line, Live_Letter (proposed) | "Question {n} of {total}" (R11.5) |
   | Figure_Entry | "Your answer", "No answer" |
   | Close line | "The space between the two is yours to read." |
   | Close link (shown only while Demo_2_On is true) | "Seal your own. It opens 30 seconds after you seal it." |
   | Close note | "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record." |
   | Close restart | "Start over" |
   | Ceremony error line (changed existing string, criterion 8) | "The letter could not be opened. You can try again." |

4. THE copy tests SHALL assert every string in the table in criterion 3. A string marked "(proposed)" SHALL be tested in the form shown until the owner changes it in this table.
5. THE following existing strings SHALL stay exactly as they are, character for character: "Bringing the letter into the light.", "Checking the seal.", "The seal is intact. Nothing here has changed since it was sealed." (spec 05 R2.4, `sealIntact` in `src/components/reveal/copy.ts`), "Break the seal" and "See the numbers". THE copy tests SHALL fail if any of them changes.
6. THE new copy SHALL follow spec 03 R15.2 to R15.4 and `tone.md`. It SHALL use the second person and the product vocabulary. Each sentence SHALL have at most 25 words. It SHALL contain no exclamation mark, no pun and no horror cliché. It SHALL contain none of the Scoring_Words_Always ("accuracy", "score", "off by"). A string in one of the Scene_Copy_Modules SHALL also contain none of the Scoring_Words_Scene ("close", "right", "wrong").
7. THE copy tests SHALL check the Scoring_Words_Always against every string in every copy module. THE copy tests SHALL check the Scoring_Words_Scene only against the strings in the Scene_Copy_Modules. THE copy tests SHALL NOT check `src/components/live/copy.ts` for the Scoring_Words_Scene, and this spec SHALL NOT reword that file (R17.3). THE copy tests SHALL check only strings, so the `close` Stage name, identifiers and other code SHALL NOT trigger them.
8. THE existing ceremony error line "Something went wrong. You can try again." (`error` in `src/components/ceremony/copy.ts`) SHALL be changed to "The letter could not be opened. You can try again.". THE copy tests SHALL assert the new string.

### R25. Steering, QA prompt and hooks for the owner

**User story:** As the owner, I want every change to an owner-only file drafted for me, so that I can review and commit it before the first task goes out.

1. THE replacement text for the "The feeling", "Visual direction" and "Moments that matter" sections of `.kiro/steering/tone.md` was drafted with this spec and reviewed by the owner. THE owner SHALL commit it before the design is written. THE design SHALL reference the committed text and SHALL NOT draft it again. The text describes the Scene, the Ghost, the Letter_Block and the Accent rule of R3, states that the Ghost is the one Halloween figure allowed, and names no desk, candle, parchment, moon, gravestone or cartoon Halloween prop as part of the look.
2. THE committed `tone.md` text SHALL keep every rule in the current "Copy" section in force, with its example changed to match the real string "The seal is intact. Nothing here has changed since it was sealed.". It SHALL also keep the current contrast, Skip, `prefers-reduced-motion`, warning and neutral-colour rules. "The feeling" changes: its first bullet becomes "Bold, friendly, a little uncanny", in the Kiro family, and the old "Quiet, unhurried" feeling and "Let each land before the next" are replaced (see "Rules this spec replaces"). Where the committed text changes any other of these rules, the design SHALL list each change by name.
3. THE frontend-dev part of task 1 SHALL deliver the Scene tokens, the contrast test (R4) and the measured budgets (R21.2), and SHALL NOT edit `.kiro/steering/tone.md` or `.kiro/steering/product.md`.
4. THE design SHALL draft the change to the layout tree and rules in `.kiro/steering/structure.md` for every component folder this spec adds under `src/components/`. Each draft SHALL give the folder path, a one-line purpose and whether the folder is browser-only. IF this spec adds no component folder, THEN THE design SHALL say so and draft no change. THE owner SHALL review and commit the change.
5. THE design SHALL draft a new section for `.kiro/agents/prompts/qa.md`. The section SHALL contain the new Stage names, the checks that replace C1 and C5 for the new surfaces (dark surface, Letter_Block, Accent rule, Text_On_Purple rule, focus ring colours), and the shot list of R27. Each replacement check SHALL be a yes/no question with a single pass condition. THE section SHALL tell the QA agent to find this spec's rows in the design's "QA browser steps" table with the grep pattern `^\| 07 \|`, and to read only those lines. THE owner SHALL review and paste the section before the issue for the first spec 07 task is created.
6. THE design SHALL list new patterns for `tools/hooks/tone-check.mjs` for the owner to add. The list SHALL cover the Scoring_Words_Always, the Scoring_Words_Scene and Accent classes on figure, change or direction elements. THE patterns for the Scoring_Words_Always SHALL match in every file the hook checks. THE patterns for the Scoring_Words_Scene SHALL match only in the Scene_Copy_Modules, because those words also appear in the `close` Stage name and in ordinary code, and SHALL NOT match in `src/components/live/copy.ts`. Each pattern SHALL be given as a regular expression with the files it applies to, one example string it matches and one it does not match. THE task agents SHALL NOT edit `tools/hooks/tone-check.mjs`.
7. THE owner's assistant, not a task agent, SHALL write an IDE hook in `.kiro/hooks/` with trigger `PostFileSave` and a matcher on `src/components/ceremony/**`. THE hook SHALL NOT run when a file outside `src/components/ceremony/**` is saved.
8. WHEN a file under `src/components/ceremony/**` is saved, THE hook SHALL ask the agent to check that file against `tone.md`, `neutrality.md` and `data-integrity.md` for all of the following:
   - scoring or grading language, judged only in user-facing strings and not in identifiers, class names, Stage names or comments: the Scoring_Words_Always in any saved file, and the Scoring_Words_Scene only when the saved file is a copy module (`copy.ts`);
   - a number shown without its period;
   - anything placed against a line of the letter;
   - any use of Kiro's logo or mascot;
   - the Accent used on a figure, change or direction.
9. WHEN the hook's check finds one or more issues, THE hook SHALL report each issue as one line in the form `file:line` followed by the rule it breaks. IF the check finds no issues, THEN THE hook SHALL report that the file passed. THE hook SHALL NOT create, edit or delete any file.
10. THE replacement text for the tone line in `.kiro/steering/product.md`, previously "A ghost of your past self: wax seals, faded ink.", was drafted with this spec to match the look of R3 and reviewed by the owner. THE owner SHALL commit it before the design is written, and THE design SHALL reference the committed line. THE change SHALL leave the "Resurrection category" line of `product.md` unchanged.

### R26. Tests

**User story:** As the owner, I want this spec's rules checked in CI, with properties that show judges how Kiro specs drive tests.

1. THE tests SHALL run in `npm test` and SHALL pass with no network access and with `DATABASE_URL` unset. THE tests SHALL stub every `fetch` call. IF a test makes an unstubbed network request or opens a database connection, THEN that test SHALL fail.
2. THE tests SHALL render components with `renderToStaticMarkup`, as the spec 05 tests do. No browser test framework SHALL be added to `package.json`.
3. THE tests SHALL include these fast-check properties. EACH property SHALL set `numRuns` to at least 100:
   1. FOR ANY order of check completion and Emergence end, and FOR ANY delay between them, the Pick_Up_Button SHALL be absent from the rendered markup in every Flow state other than `verified`.
   2. FOR ALL new components, FOR ANY answer and figure pair, with Marks mirrored as in R20.2, the rendered text, timing, colour, class, motion, order and sound SHALL be the same whatever the distance between the answer and the figure, except for the parts R20.5 allows.
   3. FOR ANY paging sequence through the recall questions, including forward moves, back moves and revisits, the Recall_Record built from the final drafts SHALL be deep-equal to the Recall_Record built from the same drafts entered in order with no paging.
   4. FOR ANY figure count from 1 to 6, the total duration of the figures sequence SHALL equal the total duration for 1 figure under the same motion setting (`full` or `calm`).
   5. THE existing rise and fall mirror property SHALL be extended to cover every new component that R20.1 lists, with the identical-markup rule of R20.2 and R20.3.
4. THE tests SHALL check, for each Flow state and view-local state in the R2.1 table, that the root carries the `data-ceremony` value the table gives for that state.
5. THE tests SHALL check that no element named in R3.10 carries the Accent class or Accent token: a figure value, a change, a formula, a period, a source control, or any element that shows a direction.
6. EACH task SHALL list every spec 05 test it retires, by file and test name, with a reason that names the removed code or the changed rule. A task MAY retire tests of the desk, candle, dust, tilt, parallax, stamps, passage and counter together with the code they test. Task 5 SHALL retire the ink code together with its tests `InkLetter.test.tsx`, `InkLetter.skip.test.ts`, `inkMask.test.ts`, `inkPlan.test.ts` and `inkSession.test.ts`, with spec 05 R7.2 and R7.3 as the retired rules. THE data, neutrality, accessibility and contrast tests SHALL stay. A task SHALL change one of these tests only where a value it asserts changes in this spec.
7. THE spec 03 tests SHALL pass in `npm test`. IF a spec 03 test fails, THEN a task SHALL name that test with its reason, or the run SHALL count as failed.
8. THE tests SHALL check that the close renders the `/demo/live` link when Demo_2_On is true and renders no `/demo/live` link when Demo_2_On is false, with the other close items unchanged in both cases. THE tests SHALL check that the persona page treats an unset, empty or whitespace-only `RP_ID` as Demo_2_On false, and that the rendered markup does not contain the `RP_ID` value.
9. THE tests SHALL check that `/` and `/l/[id]` render no Ghost and no Soil markup, and that the persona page renders the Ghost (R7.12, R17.10).
10. THE tests SHALL check, with a static render of the persona page Stage views, that the Envelope element is inside the Ghost's subtree in the `recall`, `marks` and `seal` Stages (R10.13).
11. THE tests SHALL check that the Envelope_Front, rendered in the narrow layout the design defines, renders only the written-as-of item and the opening-date item, each with its label and its date on separate lines, and no "Prepared later as a demo." (R8.7).
12. THE tests SHALL check, with a static render of the persona page Stage views, that the Ghost's horizontal placement (its classes, and every `style` value that sets a horizontal position or a horizontal translate) is the same in the `intact`, `recall`, `marks` and `seal` Stages, in both the wide and the narrow layout (R5.17). THE measured centre x checks of R5.16, R5.17 and R8.14 are browser checks for QA (R27.9, R27.10).

### R27. QA screenshots

**User story:** As the owner, I want a screenshot of every Stage at two sizes, so that the video and write-up can show spec to result.

1. THE QA shot list SHALL contain exactly two shots for every Stage in the R2.1 table: one at a 1280 by 800 CSS-pixel viewport and one at a 360 by 640 CSS-pixel viewport. With the 12 Stages in R2.1, that is 24 shots.
2. EACH shot SHALL be named `<stage>-<width>x<height>`, using the Stage name from R2.1, for example `recall-360x640`.
3. EACH shot SHALL be taken while the page root's `data-ceremony` value equals the shot's Stage name.
4. EACH shot SHALL be reached by the steps that R2.9 and the design give for its Stage. Taking a shot SHALL NOT need a database change, a new sealed letter or a server code change.
5. EACH task body SHALL list by name every shot of a Stage that the task builds or changes. A task that changes no Stage SHALL say so.
6. EACH task body SHALL say that a shot showing a Stage from a later task in its old look is expected and is not a QA finding.
7. THE QA steps SHALL check, at both viewport sizes, the R11 fit rule (R11.13, R11.14) and the no-text-on-soil rule (R6.15) from element boxes (for example `getBoundingClientRect`), and SHALL record the result of each check for each shot.
8. THE QA steps SHALL check the Ghost_Body_Box rule of R5.19 at each viewport size R5.19 names, including 2560 by 1440 and the headline line boxes in `intact`, with `Range.getClientRects` for text line boxes, and SHALL record the result for each viewport and Stage.
9. THE QA steps SHALL check that the Ghost does not move sideways on pick up (R5.17). AT 1280 by 800, 1440 by 900, 1920 by 1080 and 2560 by 1440, THE QA steps SHALL record the Ghost_Box centre x from `getBoundingClientRect` in `intact` and again in `recall`, `marks` and `seal`, and SHALL record the difference, which SHALL be at most 1 CSS px. THE QA steps SHALL also record that each `intact` centre x matches R5.16 within 1 CSS px.
10. AT 1920 by 1080, THE QA steps SHALL check the Scene_Frame alignment and the even side margins of R8.14: the wordmark's left edge and the headline's left edge line up within 1 CSS px, and the window's left edge to the wordmark and the Top_Bar's last control to the window's right edge both measure 280 CSS px within 1 CSS px. THE QA steps SHALL also check that the Soil runs the full window width (R6.18), and SHALL record each result.

### R28. Task split and order

**User story:** As the owner, I want the work cut so the video moments land first and each task leaves the flow working.

1. EACH task SHALL be exactly one GitHub issue and exactly one PR.
2. EACH task SHALL have a changed-line estimate in `tasks.md`. Each estimate SHALL be at or under `max_changed_lines` in `.github/agents.json` (currently 5,000), counted the way the PR policy counts it.
3. IF a task's estimate is over `max_changed_lines`, THEN THE task SHALL be split into smaller tasks in `tasks.md` before its issue is opened, and each part SHALL get its own estimate at or under the limit.
4. IF a task's PR is over `max_changed_lines`, THEN THE PR SHALL NOT be merged, and the task SHALL be split as in criterion 3.
5. THE tasks SHALL run in this order, as a straight chain, with task 11 free to run any time after task 1. The "Depends on" column SHALL list only spec 07 task numbers. Tasks 5, 6 and 10 SHALL carry "Blocked by #134" (the issue for spec 06 task 9, Live_Letter reveal variant) in their "Before this task" line, so that none of them can be picked up early. `tone.md` and `product.md` are already committed by the owner (R25.1, R25.10) before task 1.

   | # | Task | Role | Depends on |
   |---|---|---|---|
   | 1 | Scene tokens, contrast test, budgets measured | frontend-dev | none |
   | 2 | Ghost (with Idle_Bob), Soil_Fallback, Scene_Frame and Top_Bar alignment (R5.16, R6.17, R6.18, R8.14) and Emergence on `/demo/personas/[key]` | frontend-dev | 1 |
   | 3 | Soil_Canvas: seeded canvas, clods, dust, the dust ceiling (R6.16), the loader, the fallback to the Soil_Fallback, budget measurement | frontend-dev | 2 |
   | 4 | Pick up the letter with no sideways Ghost move (R5.17), Envelope turn in the Ghost's hands, Recall_Pager, new Demo_Index card link text | frontend-dev | 3 |
   | 5 | Seal_Break, Ghost leaving, letter with no ink effect (ink code and tests retired), new timings | frontend-dev | 4 (and Blocked by #134) |
   | 6 | Figures and close, including Demo_2_On on the persona page and "Start over" | frontend-dev | 5 (and Blocked by #134) |
   | 7 | `/` landing | platform-dev | 6 |
   | 8 | `/demo` index in the Scene | frontend-dev | 7 |
   | 9 | `/demo/live` and `/l/[id]` restyle, with no Ghost and no Soil on `/l/[id]`, and the desk code and its contrast pairs retired (R4.8) | frontend-dev | 8 |
   | 10 | Whole-journey review: Calm_Mode, Skip, keyboard, contrast, budget, 360 px | frontend-dev | 9 (and Blocked by #134) |
   | 11 | `globals.css` dark background on `html` and `body` (criterion 7) | platform-dev | 1 |

6. A task's issue SHALL NOT be assigned until the PR of every task in its "Depends on" column is merged and every issue named in its "Blocked by" line is closed.
7. THE `globals.css` dark background SHALL be task 11, its own platform-dev issue and PR. Task 11 SHALL depend only on task 1, and SHALL meet criteria 1 to 4 and 8 to 11.
8. IF a task edits `src/components/reveal/Reveal.tsx`, THEN ITS "Before this task" line SHALL carry "Blocked by #134" (spec 06 task 9, Live_Letter reveal variant), and the issue SHALL NOT be assigned until #134 is closed.
9. AFTER every merge to the main branch, THE flow SHALL work end to end: `/` to `/demo/personas/us-maya` through to the `close` Stage, `/demo`, `/demo/live` and `/l/[id]`, with `bash scripts/check.sh` passing.
10. AFTER every merge, A Stage that no merged task has rebuilt yet SHALL keep its current look.
11. EVERY file a task's PR changes SHALL sit inside the paths of the task's role in `.github/agents.json` or inside `shared`. IF a task needs a file outside those paths, THEN THE task SHALL be split so each part stays inside one role's paths plus `shared`.
12. EACH task body SHALL carry the Validation line `bash scripts/check.sh`.
13. EACH task's PR description SHALL state the measured budgets for every route in R21.1 (R21.2), every spec 03, 05 and 06 test it changed or retired with the reason for each, and every asset it added with its size in bytes. Where a list is empty, the PR description SHALL say "none".

## Open items for the owner

The owner resolved the open items on 2 November 2026. Their decisions are folded into the requirements above and into "Decisions already made". The owner will do every owner-only file. What remains are these owner actions:

1. Commit the reviewed replacement for "The feeling", "Visual direction" and "Moments that matter" in `.kiro/steering/tone.md` (R25.1, R25.2), before the design is written.
2. Commit the reviewed tone line in `.kiro/steering/product.md` (R25.10), before the design is written. The "Resurrection category" line stays as it is.
3. Commit the drafted change to `.kiro/steering/structure.md` for the component folders this spec adds (R25.4).
4. Paste the drafted section into `.kiro/agents/prompts/qa.md` before the issue for the first spec 07 task is created (R25.5).
5. Add the drafted patterns to `tools/hooks/tone-check.mjs` (R25.6).
6. Have the owner's assistant write the IDE hook in `.kiro/hooks/` (R25.7 to R25.9).
7. Change `scripts/check-js-budget.mjs` only if `/` measures over 130 kB (R7.10). It already measures `/demo/live` and `/l/[id]` at 190 kB since commit 43de346.
8. Commit `docs/design/07-judge-journey.html` with this spec.
9. Update `design.md` to the Scene_Frame composition (R5.16, R5.17, R6.17, R6.18, R8.14). Its section "The Ghost moves toward the column", the `COLUMN_GAP_PX` 64 gap, the light shift by `dx`, and the seal note that "the Ghost sits 64 px to its right" still describe the scrapped rule.
