# Requirements Document

Spec: 07 Judge journey

## Introduction

Spec 05 built the "One Desk" ceremony: a candle, a desk, dust and ink. It works, but it does not grab a Kiroween judge. Most judges watch a 3-minute video and click the link once. This spec redoes the look and the pacing of the judge journey, from `/` to the end of the reveal.

It is a skin over the existing flow. It changes how the journey looks and moves. It does not change what the flow does, the crypto, the API routes or the data. Every spec 05 rule about truth, neutrality, accessibility (Calm_Mode, Skip, keyboard, contrast) and the JavaScript budget still applies, unless an item in "Open items for the owner" names the conflict.

The visual direction is Kiro's world: a near-black background, saturated purple light, a white ghost, very big heavy sans type and one pumpkin-orange accent. The ghost is your past self. It is the concept, not decoration. It rises out of the soil holding your letter while the real seal check runs, hands it over, and leaves once the seal is broken.

A prototype is at `docs/design/07-judge-journey.html`. Its flow and timings are the starting point. Its hooded ghost with hands is replaced by the ghost in R5. The prototype is committed with this spec by the owner's assistant, because `docs/design/` is not a task path.

This spec builds on spec 03 (Opening_Flow, Persona_List, Reveal), spec 05 (Ceremony, Stages, Calm_Mode, Skip, Recall_Scale, Seal_Break, Number_Line) and spec 06 (`/demo/live`, `/l/[id]`, the Live_Letter reveal).

## Decisions already made

| Topic | Decision |
|---|---|
| Visual direction | Near-black background, purple light, white ghost, Inter at weight 800 to 900 for headlines, one orange accent. No desk, candle, parchment, moon, gravestones or cartoon Halloween props. |
| Fonts | Inter and EB Garamond from `src/app/fonts`. No new font. |
| The ghost | A plain sheet ghost with a round head, big dark oval eyes, no hood, no hands, no arms, and a jagged zigzag hem. Our own drawing. Never Kiro's logo or mascot (R5). |
| Where the scene lives | `/`, `/demo` and `/demo/personas/[key]`. `/demo/live` and `/l/[id]` get a restyle only (R17). |
| Landing | `/` is the opening of the scene, with one orange button into the first persona's letter. The current explanation and the `/demo` link stay below the scene (R7). |
| Landing ownership | `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css` stay with platform-dev. The landing is a platform-dev task. No file moves between roles. |
| Wax seal | The same orange for every persona, with a small ghost pressed into it (R10). |
| Recall | One question at a time. The typed number is the main input. The Recall_Scale stays under it as a second way to enter the same value (R11). |
| Seal break | Press and hold for `SEAL_HOLD_MS = 1500`, or the "Break the seal" button. Unchanged from spec 05 R6. |
| Letter | Warm paper inside one big rounded purple block. No ink effect longer than 2.5 s (R13). |
| Figures | Beside the letter on wide screens, below it on narrow ones, white on the dark surface. One fade-up for all figures (R14). |
| Orange | Means "you": only "receipts.", the main buttons, the wax, the focus ring and the judge's own answer (R3). |
| Move to the figures | The "See the numbers" button stays. No timer moves the judge to the figures (spec 05 R3.4, spec 03 R9.1). |
| Animation | CSS, SVG, the Web Animations API and one 2D canvas. No animation library, no WebGL. |
| Sound and vibration | As spec 05 R14: off by default, behind the toggle. No new cues. The ground shake has no sound and no vibration. |
| Top-bar notice | Pronoun-free: "{name} is fictional. This letter was prepared later as a demo." (Open item 5). |
| Personas | The scene works with 1 to 6 personas. More personas are a separate spec (Open item 4). |

## Out of scope

- Anything under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, `src/lib/recall/`, and any migration.
- The states, events and transitions of `src/components/reveal/opening-machine.ts`.
- The Recall_Record schema, `buildRecallRecord`, the encryption of the Recall_Record and the `POST /api/openings` body.
- The flow, crypto, API calls and copy meaning of `/demo/live` and `/l/[id]` (R17 restyles them only).
- New personas, new figures, new data sources and new sealing.
- New sound or vibration cues.
- Owner-only files: `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**`, `tools/**` and `.kiro/**`. This spec drafts text for some of them (R25); the owner commits it.

## Glossary

- **Scene**: The shared stage of this spec: the near-black background, the purple light, the Soil and the Ghost. Used on `/`, `/demo` and `/demo/personas/[key]`.
- **Ghost**: The original inline SVG figure of the judge's past self (R5).
- **Soil**: The strip of lit dirt the Ghost rises out of, drawn by the Soil_Canvas or by the Soil_Fallback (R6).
- **Soil_Canvas**: The one 2D canvas that draws the Soil's clumps, flying clods and drifting dust from a fixed seed.
- **Soil_Fallback**: The static, CSS-drawn lit Soil shown with no JavaScript, in Calm_Mode and in low-power mode.
- **Emergence**: The view-local sequence on the persona page in which the ground shakes and the Ghost rises holding the Envelope.
- **Envelope**: The letter's envelope, held by the Ghost, torn and dirty along its bottom edge.
- **Envelope_Front**: The side of the Envelope seen first, carrying the written-as-of date, the opening date and the prepared-later line.
- **Pick_Up_Button**: The orange "Pick up the letter" button. It sends the existing `BEGIN` event.
- **Top_Bar**: The slim bar at the top of each Scene page with the wordmark, the Demo chip, the persona notice, the Calm control and Skip.
- **Letter_Block**: The one big rounded purple block that holds the letter paper.
- **Accent**: The pumpkin-orange colour token.
- **Recall_Pager**: The view-local control that shows one recall question at a time.
- **Figure_Entry**: The block for one Then_Figure in the figures stage (R14).
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
10. NO task SHALL edit `scripts/check.sh`, `scripts/check-js-budget.mjs`, `.github/**`, `tools/**` or `.kiro/**`. Text this spec needs in those files SHALL be drafted in the design for the owner (R25).
11. ONLY the platform-dev task (R28, task 6) SHALL edit `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css`. This replaces spec 05 R1.7 for this spec (Open item 6).
12. WHEN a frontend-dev task is ready to open its PR, THE frontend-dev agent SHALL check its diff for `src/app/page.tsx`, `src/app/layout.tsx` and `src/app/globals.css`, and SHALL remove any change to them before opening the PR.
13. IF a frontend-dev PR changes `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`, THEN the QA agent SHALL fail the PR and name the file it touched.

### R2. Stages and how they map to the Flow

**User story:** As the owner, I want every Stage named and reachable in a known state, so that the QA agent can screenshot each one.

1. THE root element of each Scene page and of the Opening_Flow SHALL carry a `data-ceremony="<stage>"` attribute. Its value SHALL be exactly one of the Stage names in this table, and SHALL be the Stage whose row matches the current route, Flow state and view-local state:

   | Stage | Route | Flow state and view-local state | What the judge sees |
   |---|---|---|---|
   | `scene` | `/` | none | The Scene, the headline and the orange button into the first persona's letter (R7). |
   | `index` | `/demo` | none | The Scene with the persona envelopes and the live demo entry (R16). |
   | `emerging` | `/demo/personas/{key}` | `loading`, `openable`, `verifying` | The ground shakes and the Ghost rises holding the Envelope. The status line under the headline. |
   | `sealed` | same | `sealed` | The Ghost holding the Envelope, the opening date, the time remaining and "Try again" at zero. Nothing about the contents. |
   | `intact` | same | `verified` | The seal-is-intact statement and the Pick_Up_Button. |
   | `recall` | same | `recall`, `submitting`, `submit_failed` | The Envelope turned over, the wax seal, and one recall question at a time. |
   | `marks` | same | `reveal` stage 1, no Seal_Break running | The judge's answers, read-only, and the unbroken seal. |
   | `seal` | same | `reveal` stage 1, Seal_Break in progress or its button version playing | The seal cracking, then the Ghost leaving. |
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

1. THE Scene SHALL use the background token as its page background, the purple token for its light and the Letter_Block, white for the Ghost, the text and muted tokens for text, and the Accent as its only accent colour.
2. THE Scene SHALL NOT show a desk, candle, parchment texture, moon, gravestone, mound, cross or cartoon Halloween prop.
3. THE Scene SHALL set every headline in Inter at font weight 800 or 900.
4. THE Scene SHALL set body text, UI text and all data, including figure values, changes, formulas, periods and sources, in Inter.
5. THE Scene SHALL set letter text in either Inter or EB Garamond.
6. THE design SHALL NOT add a font beyond the Inter and EB Garamond files in `src/app/fonts`.
7. THE design SHALL define every colour used on Scene pages as a token in one CSS module under `src/components/ceremony/`, with these starting values: background `#0b0912`, text `#f5f3ff`, muted `#bdb4dc`, purple `#5a22d6`, Accent `#ff7b1c`, text on Accent `#1a0c00`, paper `#f6ead4`, ink `#1f1b16`.
8. THE Scene components SHALL reference colours only through the tokens in that module, with no colour literal written anywhere else.
9. THE Accent SHALL be used only for: the word "receipts." in the headline, the main buttons, the wax seal, the focus ring and the judge's own answer (the "Your answer" value and the Mark on the Number_Line).
10. THE Accent SHALL NOT be used on a figure value, a change, a formula, a period, a source control, or any element that shows a direction.
11. THE Accent SHALL NOT be used as a text colour on the purple surface, since the Accent on purple is about 2.9:1 and fails WCAG 2.2 AA.
12. THE Scene SHALL show figure values, changes and formulas in the text or muted token on the background surface.
13. THE Scene SHALL give all body text, data and numbers a contrast ratio of at least 4.5:1 against the surface they sit on (WCAG 2.2 AA).
14. THE focus ring SHALL have a contrast ratio of at least 3:1 against every surface it sits on and against the same element's unfocused state (spec 05 R11.8).
15. IF the Accent has a contrast ratio below 3:1 against a surface (for example the purple Letter_Block), THEN THE design SHALL pair the focus ring on that surface with, or replace it by, a token colour that reaches at least 3:1.
16. THE Scene SHALL give an increase and a decrease the same colour, icon, arrow style and font weight, so that nothing implies a number moved in a good or bad direction (`neutrality.md`).

### R4. Contrast

**User story:** As a judge with low vision, I want every word and number readable on the surface it sits on, so that the dark look costs me nothing.

1. THE contrast test SHALL compute the WCAG 2.2 contrast ratio of every text-and-surface token pair this spec uses. The pairs SHALL include at least: white on near-black, muted on near-black, white on purple, ink on paper, ink-soft on paper, Accent on near-black, text on Accent, the Envelope_Front text on the Envelope paper, the Top_Bar notice text on the Top_Bar surface, and the Accent focus ring on every surface where a focusable control can sit.
2. WHERE a text or surface token is partly transparent, THE contrast test SHALL composite it over the surface directly beneath it before computing the ratio.
3. IF a normal-text pair has a ratio below 4.5:1, THEN THE contrast test SHALL fail and name the pair and its ratio. Normal text is any text below the WCAG large-text size: 24 px at regular weight, or 18.66 px at weight 700 or heavier.
4. IF a large-text pair, a control boundary or a focus ring has a ratio below 3:1 against its adjacent surface, THEN THE contrast test SHALL fail and name the pair and its ratio.
5. IF any text in the Scene, the Top_Bar, the Letter_Block or the Recall_Pager uses the Accent as its colour on a purple surface, THEN THE contrast test SHALL fail, whatever the computed ratio is.
6. THE "faded" and dirt effects on the Envelope SHALL apply only to decorative elements. They SHALL NOT change the colour or opacity of any text glyph.
7. WHERE the dirt effect lies behind Envelope text, THE contrast test SHALL check that text against the darkest and the lightest colour the dirt can place behind it. Each of those pairs SHALL meet the thresholds in criteria 3 and 4.
8. THE contrast test from spec 05 R11.6 SHALL keep every pair and threshold it already checks. A pair SHALL change only where this spec changes the value of one of the pair's tokens.

### R5. The Ghost

**User story:** As a judge, I want my past self to be a ghost that is clearly Revenant's own, so that the concept is memorable and no one mistakes it for Kiro's logo.

1. THE Ghost SHALL be a plain sheet ghost: a round head, big dark oval eyes, a body that shades from white at the head to lilac at the hem, a purple glow around its outline, and a jagged zigzag hem along its whole bottom edge. THE Ghost SHALL have no hood, no hands and no arms, and no part of its outline SHALL read as any of these.
2. THE Ghost SHALL hold the Envelope in front of its body. THE Envelope SHALL be drawn above the body, overlap the body, and cover no part of either eye.
3. THE Ghost SHALL be original inline SVG, written in this repository, and recorded in `src/components/ceremony/ASSETS.md` (spec 05 R15.2). THE Ghost SHALL use no external image file, no raster image and no font glyph.
4. THE repository SHALL contain no file, image or SVG path data of Kiro's logo or mascot. THE design SHALL include a side-by-side of the Ghost and Kiro's logo, made for the review only and kept outside the repository, showing that the hem and the shape differ.
5. THE design SHALL state the maximum eye offset as a single number in the Ghost's SVG units. At that offset, each eye SHALL stay fully inside the head outline.
6. WHILE Calm_Mode is off and a mouse or pen pointer is over the page, THE Ghost's eyes SHALL move toward the pointer, and their offset from the idle position SHALL never exceed the stated maximum.
7. WHILE Calm_Mode is on, or input is by touch or keyboard only, THE Ghost's eyes SHALL rest in their idle position and SHALL not move.
8. WHEN the pointer leaves the page, THE Ghost's eyes SHALL return to their idle position.
9. THE Ghost SHALL be hidden from assistive technology. THE Ghost SHALL have no accessible name, no focusable element and no position in the tab order.

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
11. WHEN the judge turns on the Calm control, THE Scene SHALL stop, within 200 ms, all ambient motion that would otherwise run for more than five seconds, including the dust and the purple light (WCAG 2.2.2). THE Soil SHALL then be shown as the Soil_Fallback.
12. RANDOMNESS in the Scene SHALL come only from the fixed seed. NO `Math.random`, `Date.now` or other clock read SHALL affect rendered text or markup, so the server render and the browser render produce identical markup with no hydration mismatch.
13. EACH task that adds or changes the Soil_Canvas SHALL state in its PR the canvas's effect, in kB, on the first-load JavaScript of each route (R21).

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
11. THE landing page SHALL be built by platform-dev (R1.11). Platform-dev MAY set the dark background on `html` and `body` in `src/app/globals.css` earlier, as its own small step, so that iOS overscroll shows no paper-coloured strip.

### R8. The Top_Bar and the demo labels

**User story:** As a judge, I want to know at once that this is a demo with a fictional person, without the label pushing the headline off my screen.

1. EACH Scene page (`/`, `/demo` and `/demo/personas/[key]`) SHALL show the Top_Bar as a bar fixed to the top edge of the page, not as a block above the headline. AT a 360 by 640 CSS pixel viewport, THE Top_Bar SHALL be at most 96 CSS pixels tall.
2. THE Top_Bar SHALL show the "revenant" wordmark and a Demo chip on its left side, on every Scene page.
3. ON the persona page, THE Top_Bar SHALL show the persona notice, the Calm control and Skip on its right side, in that order from left to right.
4. THE persona notice SHALL read exactly "{name} is fictional. This letter was prepared later as a demo.", with `{name}` replaced by the persona's display name from the Persona_List. THE notice SHALL contain no pronoun (Open item 5). THE notice SHALL be shown in full, with no truncation or ellipsis, at every viewport width from 360 CSS pixels up.
5. THE Calm control SHALL sit in the Top_Bar. WHILE any part of a Scene page moves, THE Calm control SHALL be visible on that page (spec 05 R11.3).
6. THE Skip control SHALL sit in the Top_Bar. WHILE any sequence runs, THE Skip control SHALL be visible, SHALL be in the keyboard Tab order, and SHALL activate with Enter and with Space (spec 05 R11.4).
7. THE Envelope_Front SHALL show the text "Written as of {date}", the opening date, and the text "Prepared later as a demo.". THE three items SHALL be set in small muted text that passes the R4.3 contrast threshold for normal text (4.5:1) against the Envelope paper, including over the dirt (R4.7).
8. THE written-as-of date and the opening date on the Envelope_Front SHALL be formatted as day, full month name and four-digit year (for example "5 November 2024"), as spec 03 R6.3 formats them.
9. AT a 360 by 640 CSS pixel viewport with the page scrolled to the top, THE persona page SHALL show the whole Demo chip and the whole persona notice inside the viewport without scrolling (spec 03 R6.5). THE headline SHALL have the largest rendered font size of any text inside that viewport, including the Top_Bar.
10. AT a 360 by 640 CSS pixel viewport with the page scrolled to the top, THE Demo_Index SHALL show its full statement inside the viewport without scrolling. THE statement says that the personas are fictional, that their letters were prepared later as a demo, and that no passkey is needed (spec 03 R6.4).
11. THE Envelope_Front and the Top_Bar SHALL NOT contain any text that says or implies the letter was sealed on the persona's date, including the word "sealed" next to the written-as-of date (spec 03 R10.3, `data-integrity.md`).

### R9. The emergence and the real seal check

**User story:** As a judge, I want the ghost to rise holding my letter while the real check runs, so that the wait is the scene, and the letter is offered only when the check has passed.

1. WHEN the persona page first renders, THE persona page SHALL show the Scene with the Soil and the Ghost at the same position and size as on `/` at the same viewport width, with the tagline as its headline and the status line directly under the tagline.
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

### R10. The Envelope and picking up the letter

**User story:** As a judge, I want to take the letter from the ghost myself, so that opening it feels like my choice.

1. THE Envelope SHALL be drawn with a torn, dirt-stained bottom edge, where it came out of the Soil.
2. THE Envelope SHALL have the same size, the same tear and the same dirt for every letter. THE Envelope SHALL show nothing that varies with the letter's length or the number of figures (spec 05 R3.6).
3. WHEN the Flow state becomes `verified`, THE page SHALL show the statement "The seal is intact. Nothing here has changed since it was sealed." (spec 05 R2.4, `sealIntact` in `src/components/reveal/copy.ts`), placed before the Pick_Up_Button in reading order (spec 05 R5.3).
4. WHILE the Flow state is not `verified`, THE page SHALL NOT show the Pick_Up_Button.
5. THE Pick_Up_Button SHALL be an orange button in the Accent with the visible label "Pick up the letter".
6. WHEN the judge activates the Pick_Up_Button by pointer, Enter or Space, THE page SHALL send `BEGIN` to the Opening_Flow exactly once.
7. WHILE Calm_Mode is off, WHEN the judge activates the Pick_Up_Button, THE Ghost SHALL move upward by no more than one quarter of its own height.
8. WHILE Calm_Mode is off, WHEN the judge activates the Pick_Up_Button, THE Envelope SHALL turn over to show the wax seal, and the turn SHALL finish within 1200 ms of activation.
9. WHILE Calm_Mode is on, WHEN the judge activates the Pick_Up_Button, THE Envelope SHALL show the wax seal side by an instant cut or by a fade of at most 150 ms.
10. THE wax seal SHALL be the Accent colour for every persona and SHALL carry a small ghost pressed into it. This replaces the per-key seal pattern of spec 05 R8.4 (Open item 6).
11. THE wax seal SHALL show no religious, national or political symbol.
12. WHILE the Seal_Break has not happened, THE wax seal SHALL NOT be shown broken, cracked or lifted.

### R11. Recall, one question at a time

**User story:** As a judge, I want to answer one question at a time by typing a number, so that recall is quick and I am not faced with a form.

1. WHILE the recall Stage is shown, THE Recall_Pager SHALL show exactly one question at a time, in payload order, with the question text and the unit as spec 03 R8.2 requires. It SHALL show no figure value, period, source or hint.
2. WHEN a question is shown, THE page SHALL move keyboard focus to that question's typed number field. This applies on entering the recall Stage, after Next, after Previous, after Enter, and after an invalid submit (criterion 10). The typed number field SHALL be the main input, placed above the Recall_Scale.
3. WHEN the judge presses Enter in the number field of a question that is not the last, THE Recall_Pager SHALL show the next question in payload order. It SHALL not check the draft first and SHALL send no event.
4. WHEN the judge presses Enter in the last question's number field, THE page SHALL call the existing submit handler. This is the same handler as the submit control.
5. THE Recall_Pager SHALL show "Question {n} of {total}" on every question, where {n} counts from 1 and {total} is the number of recall questions in the payload. It SHALL show a "Next question" control on every question but the last and a "Previous question" control on every question but the first. It SHALL show the existing submit control on the last question only. IF the payload has exactly one recall question, THEN THE Recall_Pager SHALL show only the submit control, with no Next or Previous control.
6. THE Recall_Scale SHALL stay directly under the number field of the shown question as a second way to enter the same value. Every spec 05 R4 rule SHALL still apply, including the start-unplaced rule of R4.2 and the 360-pixel drag rule of R4.12. WHEN the judge types a value, THE Mark SHALL move to it. WHEN the judge moves the Mark, THE number field SHALL update to the same value (spec 05 R4.6).
7. WHEN the judge activates the "No answer" control of the shown question, THE page SHALL send `TOGGLE_NO_ANSWER` for that question only (spec 03 R8.3). The control SHALL be available on every question.
8. WHEN the judge activates Next, Previous or Enter to change question, THE Recall_Pager SHALL change only the view-local index of the shown question and SHALL send no event to the Opening_Flow. Drafts SHALL change only through `EDIT_DRAFT` and `TOGGLE_NO_ANSWER`. WHEN the judge returns to a question, THE page SHALL show that question's draft exactly as entered: the same typed text, the same Mark position or unplaced state, and the same "No answer" state.
9. WHEN the page submits, THE Recall_Record SHALL be identical to the one spec 03 and spec 05 produce from the same final drafts. It SHALL use the same `buildRecallRecord`, the same encryption and the same `POST /api/openings` body, whatever order the judge visited the questions in.
10. IF the judge submits while one or more questions are invalid under spec 03 R8.4, THEN THE Recall_Pager SHALL show the first invalid question in payload order with the existing inline message. It SHALL keep every draft exactly as entered and SHALL send nothing to the server.
11. WHILE a submit is in flight, THE submit control, the retry control and Enter-to-submit SHALL be disabled (spec 03 R8.9).
12. IF the post fails, THEN THE page SHALL show the existing submit-failed message and retry control (spec 03 R8.7) and SHALL keep every draft exactly as entered.

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

### R13. The letter

**User story:** As a judge, I want to read what was written on warm paper inside one strong block, so that the letter is the centre of the screen.

1. WHEN reveal stage 2 is shown, THE page SHALL show the letter on warm paper inside the Letter_Block, the one big rounded purple block. THE Letter_Block SHALL be the only Letter_Block on the page.
2. THE paper SHALL keep its fold creases as decoration only. THE fold creases SHALL be hidden from assistive technology, and every letter character SHALL meet the normal-text ratio of R4.3 against the darkest point of any crease it overlaps.
3. WHEN reveal stage 2 first renders, THE letter text SHALL be in the document in full, before any ink effect starts and with no script needed to add it. THE text SHALL be plain text with every line break kept and every markup character shown as written (spec 05 R7.1, spec 03 R10.1).
4. WHERE an ink effect is kept, THE effect SHALL animate only a clip or a mask over text that is already in the document. Its duration SHALL depend only on the number of lines, and it SHALL end within 2,500 ms of its start for any letter up to the 5,000-character limit. This replaces spec 05 R7.2 (Open item 6).
5. IF Calm_Mode is on, or Skip or "Show everything" is used, THEN THE page SHALL show the letter at its end state with no ink effect (R12.10, R19.2).
6. WHEN reveal stage 2 is shown, THE labels from spec 03 R10 SHALL be visible with the letter before any ink effect starts. IF the letter is a Live_Letter, THEN THE labels of spec 06 R18.2 SHALL be shown in their place.
7. THE page SHALL place nothing against a line of the letter. No annotation, highlight, marker, underline or link SHALL be tied to any part of the letter text.
8. WHILE reveal stage 2 is shown, THE "See the numbers" button SHALL be visible and reachable by keyboard. WHEN the judge activates it, THE page SHALL send the existing event that moves to reveal stage 3 (spec 05 R3.4).
9. THE page SHALL NOT send the reveal stage 3 event from a timer, from the end of the ink effect or from scrolling. Only the "See the numbers" button or "Show everything" SHALL move to reveal stage 3. Skip SHALL end the running sequence and SHALL NOT move to reveal stage 3.

### R14. Figures

**User story:** As a judge, I want each figure laid out plainly next to my own answer, so that I see the gap between memory and record and draw my own conclusion.

1. THE design document SHALL state one layout breakpoint as a viewport width in CSS pixels. WHILE the viewport width is at or above that breakpoint, THE Figure_Entries SHALL sit in one column beside the Letter_Block. WHILE the viewport width is below that breakpoint, THE Figure_Entries SHALL sit below the Letter_Block. In both layouts, THE Figure_Entries SHALL sit on the dark surface and never inside the Letter_Block.
2. THE Figure_Entries SHALL appear in the order of the figures in the sealed payload. THE Figure_Entries SHALL NOT be sorted, grouped or hidden by value, by direction of change or by the Mark's distance from any figure (spec 05 R9.3).
3. EACH Comparable Figure_Entry SHALL show these items, in this order from top to bottom:
   1. the metric's display name, small and uppercase;
   2. "Your answer" followed by the judge's value and unit in the Accent, or "No answer" if the judge gave no value;
   3. the then value, in the largest and heaviest type style of the Figure_Entry;
   4. the then period, the region, and the "historical record, retrieved {date}" label, or the "fixture data" label for a Fixture_Figure (spec 03 R13);
   5. the Number_Line with the then figure, the now figure and the Mark, with the Mark in the Accent;
   6. the now value, in the same type style as the then value (Open item 7);
   7. the now period, the region and the retrieved date;
   8. the change line (spec 03 R11.7, R12.9);
   9. the formula with both input values, present as text in the document;
   10. the source control, which shows the source, the series ID and the `source_url` after one click, one tap, or one Enter or Space key press.
4. THE Number_Line SHALL keep spec 05 R12.2 to R12.4. Its range SHALL come only from the then and now values. Its padding SHALL be the same on both sides. It SHALL use a fixed minimum span when the then and now values are equal. A Mark outside the range SHALL sit at the nearer edge, with the same look at both edges. No displayed number SHALL be computed from a position.
5. IF the Change_Calculator reports a pair as not Comparable, or the Now_Figure is unavailable, THEN THE Figure_Entry SHALL show its existing honest rendering (spec 03 R11.5 and R11.6), SHALL still show the then value with its period, and SHALL show no Number_Line, no Mark and no change line (spec 05 R9.6).
6. WHILE at least one shown figure is a Fixture_Figure, THE page SHALL show exactly one fixture note (spec 03 R13.5). WHILE no shown figure is a Fixture_Figure, THE page SHALL show no fixture note.
7. WHEN the figures stage starts, ALL Figure_Entries SHALL appear with one fade-up. THE fade-up duration and any stagger step SHALL be constants in one module. THE stagger step SHALL be at most 100 ms. THE delay for each entry SHALL depend only on its position in the list, and SHALL be the same for every figure, every value and every direction of change.
8. THE figures sequence SHALL end at the same fixed time after the figures stage starts, whether 1, 2, 3, 4, 5 or 6 figures are shown (`MAX_FIGURES = 6`, spec 06). That total time SHALL be a constant in the same module as the fade-up constants, and SHALL NOT depend on any figure, answer, period, span or change.
9. A static render of the figures component, with no animation run, SHALL hold the final state: every value, label, fixture note, change line and formula, at full opacity. THE names `FiguresThenNow`, `FigureLine` and `FixtureNote`, and the props that #49 and #84 use, SHALL stay unchanged (spec 05 R9.7 and R9.8).
10. IF the opened letter is a Live_Letter, THEN THE figures stage SHALL show the zero change and the fixed note exactly as spec 06 R18.5 and R18.6 describe.
11. EVERY figure number shown in a Figure_Entry (the then value, the now value and the change) SHALL show the period of each figure it comes from next to it (`data-integrity.md`). The judge's answer is not a figure and carries no period.

### R15. The close

**User story:** As a judge, I want a quiet end with one clear next step, so that I know the record has been shown and can try sealing my own.

1. WHEN the figures stage reaches its final state, THE close SHALL appear below the figures stage. The figures stage reaches its final state in one of three ways: the last Figure_Entry animation ends, the judge activates Skip during the figures stage, or the figures stage is shown in Calm_Mode or through "Show everything". THE close SHALL show these four items, in this order in both the document and the visual layout:
   1. the line "The space between the two is yours to read.";
   2. one link to `/demo/live` in the Accent colour that reads "Seal your own. It opens in 30 seconds." This text is pending the owner's decision in Open item 2;
   3. in text with a smaller font size than item 1, "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.";
   4. a "Start over" link to `/` (Open item 3).
2. WHILE the figures stage has not reached its final state, THE close SHALL NOT be in the document.
3. THE close SHALL contain only the four items in criterion 1. It SHALL contain no summary, score, comment or call to compare. No text, colour or order in the close SHALL depend on any figure, any answer or the difference between them.
4. THE close text and both links SHALL meet WCAG 2.2 AA contrast on the Scene surface. Both links SHALL be reachable and activatable with the keyboard alone, and SHALL show the focus ring when focused.
5. WHEN the close appears, THE Opening_Flow SHALL send no event (spec 05 R12.7), and the Flow state SHALL stay the same as it was before the close appeared.
6. IF the close is shown on `/l/[id]` for a Live_Letter, THEN THE close SHALL keep the spec 06 R18.6 note and link unchanged.

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
3. WHERE a task changes the wording of a spec 06 copy string on either page, THE task's PR SHALL list the old and the new text for review against spec 06.
4. THE spec 06 tests SHALL pass with no test removed, skipped or loosened.
5. WHERE a spec 06 test asserts a token value, THE test SHALL change only by replacing the old value with the new value of the same token. THE test SHALL change only where that token's value changes.
6. THE passkey and backup key warnings (spec 06 R15.6, R15.9 and R15.11) SHALL stay plain. THEY SHALL have no faded-ink, dirt, glow or animation effect on their text, and Calm_Mode SHALL not change how they look.
7. THE passkey and backup key warnings SHALL stay unmissable. EACH warning SHALL be visible in the same view as the control it guards, before that control can be pressed. NO warning SHALL be collapsed, hidden behind a toggle or delayed by an animation. Atmosphere SHALL NOT soften them (`tone.md`, "Locking").
8. EACH passkey and backup key warning SHALL have a contrast of at least 4.5:1 against the surface it sits on. ITS text and surface token pair SHALL be in the R4 contrast test.
9. WHEN `/l/[id]` shows the shared Stage views (Envelope, recall, Seal_Break, letter, figures, close), THE page SHALL use the same Stage components as `/demo/personas/[key]`, in the new look, with no separate copy in the spec 05 style.
10. `/l/[id]` SHALL meet every criterion of this spec without rendering the Ghost or the Soil (Open item 8). WHERE the page omits the Ghost and the Soil, THE shared Stage views SHALL still render every element and control those criteria require.
11. THE spec 06 R18 Live_Letter reveal wording SHALL stay unchanged. This includes the "Sealed on {date and time}" line, the fixed 30-second note with its `/demo` link, and the absence of "Written as of", "Prepared later as a demo" and "Sealed for the demo on".

### R18. Timings

**User story:** As a judge watching once, I want each moment to land quickly, so that the whole journey fits in my attention.

1. THE System SHALL define every duration, delay and easing that this spec adds as a plain constant in `src/components/ceremony/constants.ts`. No constant SHALL take input from any figure, answer, period, span, change or count of figures.
2. WHEN the persona page reaches first paint, THE Emergence SHALL end within 5,000 ms. This bound covers only what the page controls: the sum of the Emergence's delays and durations in `src/components/ceremony/constants.ts` SHALL be at most 5,000 ms. Network time and the time the real seal check takes are not part of the bound.
3. IF the Flow state becomes `verified` within 5,000 ms of first paint, THEN THE Pick_Up_Button SHALL appear within 5,000 ms of first paint. IF the Flow state becomes `verified` later, THEN THE Pick_Up_Button SHALL wait for `verified` and appear at once (R9.8 to R9.10). No timing in this requirement SHALL show the Pick_Up_Button before `verified`.
4. WHEN the press-and-hold reaches `SEAL_HOLD_MS`, or the judge activates the "Break the seal" button, THE letter SHALL be readable within 3,000 ms. "Readable" means the full letter text is in the document and shown at its final contrast. The sum of the Seal_Break, Ghost-leaving and letter-entry delays and durations in `src/components/ceremony/constants.ts` SHALL be at most 3,000 ms.
5. WHEN the judge activates "See the numbers", every Figure_Entry SHALL be settled within 4,000 ms. "Settled" means every Figure_Entry has finished its fade-up and shows its final state (R14.9). This bound SHALL hold for 1 to 6 figures (R14.8).
6. THE System SHALL limit every ink effect to at most 2,500 ms, measured from the start of its first delay to the end of its last animation.
7. THE System SHALL keep `SEAL_HOLD_MS` at 1,500 ms.
8. THE ground shake SHALL move 2 CSS pixels, last 500 ms, and run once per Emergence.
9. THE System SHALL change the existing tests for constants only where a constant's value changes. THE spec 05 R10.5 property, that durations do not depend on data, SHALL apply to every new constant.

### R19. Accessibility, Calm_Mode and Skip

**User story:** As a judge using a keyboard, a screen reader or reduced motion, I want the same journey with nothing lost.

1. THE spec 05 R11 rules SHALL apply to every Stage and control this spec adds or restyles on `/`, `/demo`, `/demo/personas/[key]`, `/demo/live` and `/l/[id]`.
2. WHILE the browser reports `prefers-reduced-motion: reduce`, or the judge has turned on the Calm control, THE Ceremony SHALL run in Calm_Mode. In Calm_Mode it SHALL show no ground shake, no Ghost rise, no eye movement, no Soil_Canvas, no clods, no dust, no Ghost dissolve, no ink effect and no fade-up longer than 150 ms. The Soil_Fallback SHALL be shown in place of the Soil_Canvas. Each Stage SHALL change by an instant cut or by a fade of at most 150 ms. The Stages SHALL appear in the same order as outside Calm_Mode, and no Stage SHALL be left out.
3. THE Ceremony SHALL offer a control for every gesture. Each control SHALL do the same thing as its gesture, and none SHALL need dragging, holding, pointer precision or timing. The number field SHALL set the same value as the Recall_Scale. The "Break the seal" button SHALL do the same as the hold of `SEAL_HOLD_MS`. A button SHALL do the same as each gesture that moves between Stages. Each control SHALL be reachable with Tab and work with Enter or Space, or with typed digits for the number field.
4. WHEN the Stage changes, THE Ceremony SHALL move keyboard focus to the new Stage's heading and announce the new Stage's name once in a polite live region (spec 05 R11.8). WHEN the Recall_Pager shows a question, THE Recall_Pager SHALL move keyboard focus to that question's number field.
5. THE Ghost, the Soil, the purple light, the clods and the dust SHALL be hidden from assistive technology, so a screen reader reads none of them. WHEN the Mark is placed or moved, THE Ceremony SHALL expose the Mark to assistive technology as the judge's answer, with its value and unit.
6. THE Scene pages SHALL make every pointer target at least 24 by 24 CSS pixels, measured as its clickable area. The Pick_Up_Button, the seal, the "See the numbers" button and the close link SHALL each be at least 44 by 44 CSS pixels.
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
   | Envelope_Front | "Written as of {date}", the existing opening-date label, "Prepared later as a demo." |
   | Pick_Up_Button | "Pick up the letter" |
   | Demo_Index card link (proposed) | "Open the letter" |
   | Recall_Pager (proposed) | "Next question", "Previous question", "Question {n} of {total}" |
   | Figure_Entry | "Your answer", "No answer" |
   | Close line | "The space between the two is yours to read." |
   | Close link (pending Open item 2) | "Seal your own. It opens in 30 seconds." |
   | Close note | "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record." |
   | Close restart | "Start over" |

4. THE copy tests SHALL assert every string in the table in criterion 3. A string marked "(proposed)" or "pending" SHALL be tested in the form shown until the owner changes it in this table.
5. THE following existing strings SHALL stay exactly as they are, character for character: "Bringing the letter into the light.", "Checking the seal.", "The seal is intact. Nothing here has changed since it was sealed." (spec 05 R2.4, `sealIntact` in `src/components/reveal/copy.ts`), "Break the seal" and "See the numbers". THE copy tests SHALL fail if any of them changes.
6. THE new copy SHALL follow spec 03 R15.2 to R15.4 and `tone.md`. It SHALL use the second person and the product vocabulary. Each sentence SHALL have at most 25 words. It SHALL contain no exclamation mark, no pun and no horror cliché. It SHALL contain none of the scoring words "accuracy", "close", "off by", "right", "wrong" or "score", matched as whole words in any letter case.

### R25. Steering, QA prompt and hooks for the owner

**User story:** As the owner, I want every change to an owner-only file drafted for me, so that I can review and commit it before the first task goes out.

1. THE design SHALL include full replacement text for the "Visual direction" and "Moments that matter" sections of `.kiro/steering/tone.md`. The text SHALL describe the Scene, the Ghost, the Letter_Block and the Accent rule of R3. It SHALL name no desk, candle, parchment, moon, gravestone or cartoon Halloween prop as part of the look.
2. THE drafted `tone.md` text SHALL keep every rule in the current "Copy" and "The feeling" sections in force. It SHALL also keep the current contrast, Skip, `prefers-reduced-motion`, warning and neutral-colour rules. Where it changes any of these rules, the design SHALL list each change by name.
3. THE owner SHALL review and commit the drafted `tone.md` text as part of task 1. THE frontend-dev part of task 1 SHALL deliver the Scene tokens and the contrast test (R4), and SHALL NOT edit `.kiro/steering/tone.md`.
4. THE design SHALL draft the change to the layout tree and rules in `.kiro/steering/structure.md` for every component folder this spec adds under `src/components/`. Each draft SHALL give the folder path, a one-line purpose and whether the folder is browser-only. IF this spec adds no component folder, THEN THE design SHALL say so and draft no change. THE owner SHALL review and commit the change.
5. THE design SHALL draft a new section for `.kiro/agents/prompts/qa.md`. The section SHALL contain the new Stage names, the checks that replace C1 and C5 for the new surfaces (dark surface, Letter_Block, Accent rule), and the shot list of R27. Each replacement check SHALL be a yes/no question with a single pass condition. THE owner SHALL review and paste the section before the issue for the first spec 07 task is created.
6. THE design SHALL list new patterns for `tools/hooks/tone-check.mjs` for the owner to add. The list SHALL cover scoring words (accuracy, close, off by, right, wrong, score) and Accent classes on figure, change or direction elements. Each pattern SHALL be given as a regular expression with one example string it matches and one it does not match. THE task agents SHALL NOT edit `tools/hooks/tone-check.mjs`.
7. THE owner's assistant, not a task agent, SHALL write an IDE hook in `.kiro/hooks/` with trigger `PostFileSave` and a matcher on `src/components/ceremony/**`. THE hook SHALL NOT run when a file outside `src/components/ceremony/**` is saved.
8. WHEN a file under `src/components/ceremony/**` is saved, THE hook SHALL ask the agent to check that file against `tone.md`, `neutrality.md` and `data-integrity.md` for all of the following:
   - scoring or grading language (accuracy, close, off by, right, wrong, score);
   - a number shown without its period;
   - anything placed against a line of the letter;
   - any use of Kiro's logo or mascot;
   - the Accent used on a figure, change or direction.
9. WHEN the hook's check finds one or more issues, THE hook SHALL report each issue as one line in the form `file:line` followed by the rule it breaks. IF the check finds no issues, THEN THE hook SHALL report that the file passed. THE hook SHALL NOT create, edit or delete any file.

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
6. EACH task SHALL list every spec 05 test it retires, by file and test name, with a reason that names the removed code or the changed rule. A task MAY retire tests of the desk, candle, dust, tilt, parallax, ink timing, stamps, passage and counter together with the code they test. THE data, neutrality, accessibility and contrast tests SHALL stay. A task SHALL change one of these tests only where a value it asserts changes in this spec.
7. THE spec 03 tests SHALL pass in `npm test`. IF a spec 03 test fails, THEN a task SHALL name that test with its reason, or the run SHALL count as failed.

### R27. QA screenshots

**User story:** As the owner, I want a screenshot of every Stage at two sizes, so that the video and write-up can show spec to result.

1. THE QA shot list SHALL contain exactly two shots for every Stage in the R2.1 table: one at a 1280 by 800 CSS-pixel viewport and one at a 360 by 640 CSS-pixel viewport. With the 12 Stages in R2.1, that is 24 shots.
2. EACH shot SHALL be named `<stage>-<width>x<height>`, using the Stage name from R2.1, for example `recall-360x640`.
3. EACH shot SHALL be taken while the page root's `data-ceremony` value equals the shot's Stage name.
4. EACH shot SHALL be reached by the steps that R2.9 and the design give for its Stage. Taking a shot SHALL NOT need a database change, a new sealed letter or a server code change.
5. EACH task body SHALL list by name every shot of a Stage that the task builds or changes. A task that changes no Stage SHALL say so.
6. EACH task body SHALL say that a shot showing a Stage from a later task in its old look is expected and is not a QA finding.

### R28. Task split and order

**User story:** As the owner, I want the work cut so the video moments land first and each task leaves the flow working.

1. EACH task SHALL be exactly one GitHub issue and exactly one PR.
2. EACH task SHALL have a changed-line estimate in `tasks.md`. Each estimate SHALL be at or under `max_changed_lines` in `.github/agents.json` (currently 5,000), counted the way the PR policy counts it.
3. IF a task's estimate is over `max_changed_lines`, THEN THE task SHALL be split into smaller tasks in `tasks.md` before its issue is opened, and each part SHALL get its own estimate at or under the limit.
4. IF a task's PR is over `max_changed_lines`, THEN THE PR SHALL NOT be merged, and the task SHALL be split as in criterion 3.
5. THE tasks SHALL run in this order, as a straight chain:

   | # | Task | Role | Depends on |
   |---|---|---|---|
   | 1 | `tone.md` update (owner commits the drafted text), Scene tokens, contrast test | frontend-dev | spec 06 task 9 |
   | 2 | Ghost, Soil and Emergence on `/demo/personas/[key]` | frontend-dev | 1 |
   | 3 | Pick up the letter, Envelope turn, Recall_Pager, new Demo_Index card link text | frontend-dev | 2 |
   | 4 | Seal_Break, Ghost leaving, letter, new timings | frontend-dev | 3 |
   | 5 | Figures and close | frontend-dev | 4 |
   | 6 | `/` landing. The `globals.css` dark background may be split out and run early. | platform-dev | 5 |
   | 7 | `/demo` index in the Scene | frontend-dev | 6 |
   | 8 | `/demo/live` and `/l/[id]` restyle | frontend-dev | 7 |
   | 9 | Whole-journey review: Calm_Mode, Skip, keyboard, contrast, budget, 360 px | frontend-dev | 8 |

6. A task's issue SHALL NOT be assigned until the PR of every task in its "Depends on" column is merged.
7. WHERE the `globals.css` dark background is split out of task 6, THE split-out part SHALL be its own platform-dev issue and PR, SHALL depend only on task 1, and SHALL meet criteria 1 to 4 and 8 to 11.
8. IF a task edits `src/components/reveal/Reveal.tsx`, THEN ITS issue SHALL be marked as blocked by the issue of spec 06 task 9 (Live_Letter reveal variant), and SHALL NOT be assigned until that issue's PR is merged.
9. AFTER every merge to the main branch, THE flow SHALL work end to end: `/` to `/demo/personas/us-maya` through to the `close` Stage, `/demo`, `/demo/live` and `/l/[id]`, with `bash scripts/check.sh` passing.
10. AFTER every merge, A Stage that no merged task has rebuilt yet SHALL keep its current look.
11. EVERY file a task's PR changes SHALL sit inside the paths of the task's role in `.github/agents.json` or inside `shared`. IF a task needs a file outside those paths, THEN THE task SHALL be split so each part stays inside one role's paths plus `shared`.
12. EACH task body SHALL carry the Validation line `bash scripts/check.sh`.
13. EACH task's PR description SHALL state the measured budgets for every route in R21.1 (R21.2), every spec 03, 05 and 06 test it changed or retired with the reason for each, and every asset it added with its size in bytes. Where a list is empty, the PR description SHALL say "none".

## Open items for the owner

1. **Owner-only files this spec needs.** `.kiro/steering/tone.md` (the owner commits the drafted text, R25.1); `.kiro/steering/structure.md` (component folders change, R25.4); possibly `.kiro/steering/product.md`, if it is read as describing the landing or the desk; `.kiro/agents/prompts/qa.md` (the owner pastes the drafted section, R25.5); `tools/hooks/tone-check.mjs` (new patterns listed in the design, R25.6); the IDE hook in `.kiro/hooks/` (R25.7); `scripts/check-js-budget.mjs`, only if `/` measures over 130 kB (R7.10) and to add `/demo/live` and `/l/[id]` if it does not measure them yet; and `docs/design/07-judge-journey.html`, committed with the spec.
2. **The 30-second claim (R15.1).** On every successful seal path on `/demo/live` (passkey and backup-key fallback), `opensAt = sealedAt + 30 s` (`LOCK_DURATION_MS = 30_000`). The server accepts only exactly 30 s, an `opensAt` after server now, and at most 60 s ahead. So the letter opens 30 s after sealing, not 30 s after the click: writing, picking figures and the passkey presses come first, and the countdown starts a little under 30 because of the request time. The claim does not hold when `RP_ID` is unset (the page shows that Demo 2 is unavailable) or when the 500-per-24-hours cap returns busy. Suggested accurate text: "Seal your own. It opens 30 seconds after you seal it." The owner's string stays in R15.1 and R24.2, pending this decision.
3. **"Start over" target (R15.1).** Proposed `/`, the start of the scene. `/demo` is the alternative.
4. **EU and Sweden personas.** Recommended as a separate spec. It is content, data and sealing work for other roles (`content/personas/**`, `scripts/seal-personas*`, figures), not a skin. Spec 07 must still look right with 1 to 6 personas (R16.6, R16.7).
5. **Pronoun in the persona notice (R8.4).** The owner's text was "{name} is fictional. Her letter was prepared later as a demo." A fixed "Her" would be wrong for a future persona, and the Persona_List has no pronoun field. This spec uses the pronoun-free "This letter was prepared later as a demo." Confirm, or add a pronoun field to the Persona_List in a later spec.
6. **Spec 05 and spec 03 rules this spec cannot keep.**
   - Spec 05 R1.7 says `src/app/layout.tsx`, `src/app/page.tsx` and `src/app/globals.css` are not edited. Task 6 (platform-dev) now edits `page.tsx` and `globals.css` (R1.11, R7.11).
   - Spec 05 R2.1 made "Pick up the letter" the Demo_Index card link text. It is now the Pick_Up_Button, so the card link needs new text (R16.3, proposed "Open the letter"). The spec 05 R2.2 tests change in task 3.
   - Spec 05 R3.1 stage names change to those in R2.1 (`desk`, `envelope`, `then`, `passage`, `now` are retired; `scene`, `index`, `emerging`, `sealed`, `figures` are added).
   - Spec 05 R4 is kept, but the Recall_Scale is now second, under the number field (R11.6). Spec 05 R4.2 still holds. Spec 05 R4.6 said the field is "visually part of the scale"; now the scale is visually part of the field.
   - Spec 03 R8.1 says all recall questions are shown. They are now shown one at a time, in payload order (R11.1). Spec 03 R8.4 shows the message next to each invalid question; the pager now goes to the first invalid one (R11.10).
   - Spec 05 R7.2 allowed an ink effect of up to 8 s, line by line. Now at most 2.5 s, or none (R13.4).
   - Spec 05 R8.1, R8.6 and R8.9 (desk, candle, dust on the desk, parallax, tilt, desk only on the demo routes) are replaced by the Scene, which also runs on `/`.
   - Spec 05 R8.4 (a seal pattern per persona key) is replaced by one seal for all (R10.10).
   - Spec 05 R11.5 (candle flicker limit) is replaced by the light and flashing limits in R6.10.
   - Spec 05 R12.5 and R10.6 (stamps, passage, counter roll) are replaced by one fade-up (R14.7).
   - Spec 05 R12.9 (close links back to the desk) is replaced by the `/demo/live` link and "Start over" (R15.1).
   - Spec 05 R13.1 ("`/` stays within 2 kB of 106.5 kB") no longer holds, because `/` changes. The 130 kB cap stays.
   - Spec 05 R18 (task split) is replaced by R28 for this work.
   - `tone.md` today asks for parchment, a serif for headings, wax-seal reds and a candlelit mood. It conflicts with this spec until the owner commits the drafted update (R25.1).
7. **Same type style for then and now (R14.3).** This spec gives the now value the same type style as the then value, neutral, so neither looks like the answer. Confirm.
8. **Ghost and Soil on `/l/[id]` (R17.10).** Recommended not: the Letter_Page has unlock controls and passkey warnings that must stay plain, and the scene adds JavaScript to a 190 kB route. Confirm.
9. **Focus ring on the purple block (R3.15).** The Accent on purple is about 2.9:1, below the 3:1 a focus ring needs. The design will pair it with white (white on purple is about 7.9:1) or swap it to white inside the Letter_Block. Confirm the choice in the design review.
