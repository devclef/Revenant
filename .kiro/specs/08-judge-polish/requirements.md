# Requirements Document

Spec: 08 Judge polish

## Introduction

The owner walked the site as a Kiroween judge after every spec 07 task was merged. The journey works, but several things break the first impression or promise more than the site does:

- "See the numbers" jumps about 3,600 px past the figures, to the close heading, because `CeremonyRoot` focuses the newest heading when the figures settle and the Stage becomes `close`.
- At 1366×800 the letter text column is about 97 px wide while the right half of the screen is empty, and the large then value overflows its column.
- The then value is huge and the now value is small. "Your answer" appears twice per figure. The Number_Line labels collide.
- The read-only Recall_Scales on the marks card still look like sliders, and their 10,000 and 100,000 ticks overlap. Every figure uses one log range from 0.01 to 100,000.
- The hero stays tall after the first step, so the recall field sits at the bottom edge at 1366×800.
- The landing page renders no Ghost, and a hard-edged purple band sits under the Soil.
- `/demo/live` uses the old `PageShell` and has no way back.
- The site has one title ("Revenant"), no favicon, no per-page titles, no Open Graph image and no footer.
- Live-sealed figures are labelled "historical record, retrieved {date}", which is the persona label.
- The envelope SHA-256 hash is checked but never shown.
- The landing copy promises groceries and rent, "the demo letters" (only Maya exists), and the live picker says "up to 6" while only 4 series exist.
- The PRF check runs only at sealing, so a judge on a device without PRF learns late that the backup key is required.
- The README lists shipped features as later.
- `tools/qa/layout-check.mjs` checks only 1280×800 and 360×640, and never checks where the viewport lands after "See the numbers", the letter width or horizontal overflow. That is how the layout bug got past QA.

This spec fixes those findings, then adds the product work the owner wants before judging ends: the daily figure fetch with a freshness alert, an EU persona, thin real sealing, and self-reported numbers if time allows. Sweden is out of scope for this spec (R23).

This spec builds on spec 02 (sealed letters), spec 03 (Opening_Flow, Reveal), spec 04 (real figures), spec 05 (Ceremony), spec 06 (`/demo/live`, `/l/[id]`, Live_Letter) and spec 07 (Scene, Ghost, Soil, Top_Bar, Figure_Entry). Every rule of those specs still holds unless "Rules this spec replaces" names it.

## Decisions already made

| Topic | Decision |
|---|---|
| Deadline | Submissions close Friday 4 December 2026, 2:00 PM PT. Feature freeze is 27 November 2026. The last week is fixes, video and write-up. |
| Running through judging | The site runs, and "now" figures stay current, through the end of judging on 29 January 2027. |
| Build order | 1 reveal fixes and layout checks; 2 landing Ghost; 3 copy, labels, dates and metadata; 4 daily fetch; 5 EU persona; 6 real sealing; 7 self-reported numbers if time allows (R31). |
| Move to the figures | "See the numbers" lands the judge on the figures heading, with focus on it. The settle that turns the Stage into `close` moves neither focus nor scroll (R2). |
| Then and now | The then value and the now value carry equal visual weight (R4). This replaces spec 07's big then value. |
| Recall_Scale range | One fixed range per unit, the same for every letter with that unit. The range is never derived from a sealed, current or any other figure value. Approved values: `USD per gallon` 0 to 10 with ticks every 2; `EUR per 1,000 litres` 0 to 3,000 with ticks every 500 (R7). |
| Range never limits the answer | The typed field accepts any value the Recall_Record validation accepts, inside or outside the range. Outside the range the Mark sits at the nearer edge and the typed value is stored unchanged (R7.6). |
| Unit helper line | Every recall question whose sealed unit is exactly `EUR per 1,000 litres` shows one fixed line, "1,000 here means 1 euro per litre.", from a copy module, keyed only on the unit string (R7.8, R7.9). |
| Recall number input | The recall field accepts a decimal comma. A separator that could be decimal or grouping ("1.585", "1,585") is never guessed: the judge picks one of the two readings. The parsed value shows beside the field before submit. The stored Recall_Record value and schema are unchanged (R32). |
| Landing Ghost | `/` shows the same Ghost component, rising out of the Soil at the light with the existing CSS rise, then the Idle_Bob. No Envelope. The Ghost does not hold the Accent button. Standing still under reduced motion, Calm_Mode or no JavaScript. No eye-follow on `/` (R9). |
| Second rise | Decided: keep both rises. The landing rise has empty hands; the persona rise brings the Envelope and reads as a new moment. The persona page always plays its full Emergence, and no client JavaScript is added to `/` to detect or signal an arrival (R9.12). |
| Figures | No official groceries or rent. The copy matches the four fuel series that exist (US and EU). |
| Sweden | Dropped. No Sweden series, no Sweden persona, and no copy, page, README or steering text that promises a Swedish source. `product.md` and `tech.md` still list Sweden; the owner decides those through an Owner_Patch (R23). |
| Rent and groceries in copy | Allowed only as numbers the user enters, labelled self-reported, and only once self-reported numbers ship (R26). |
| Daily fetch | Per `tech.md`: a Kubernetes CronJob running a script from the app image, writing figures with full provenance to Postgres. The browser downloads the whole catalogue from `/api/figures` and picks series locally (R20). |
| Fetch exit status | A series with no new period is a success. The Fetch_Job exits 1 if any series had a failed request, a non-success HTTP status, a response that fails to parse, or an empty or malformed result. Figures from the other sources are still saved. A re-run creates no duplicate rows; a changed value for a stored period is a new revision row and never replaces the earlier row (R20). |
| Daily fetch fallback | A simpler scheduled refresh with honest retrieval times, if the full job threatens the reveal work. Never a stale "now" presented as current (R21). |
| Freshness alert | Two checks per series. Failure: no successful fetch for more than 48 hours, by the last successful fetch time the Figures_API reports. Warning: the newest period is more than 14 days older than the current UTC date, since sources may skip a week around holidays. A scheduled GitHub Actions workflow (Owner_Patch) calls the public Figures_API at least every 6 hours through 29 January 2027, opens or updates one issue assigned to the owner, and closes it when both checks pass. Failed CronJob runs stay visible in Kubernetes (R21). |
| Real sealing | Thin, after the daily fetch, reusing the live sealing flow with a future date picker. Go/no-go on 20 November 2026. If not solid, the work is dropped and no copy promises it (R24, R25). |
| Dates | Letter dates read "30 October 2026" everywhere. Periods follow the data: weekly "26 Oct 2026", monthly "Oct 2026". Numbers follow the figure's region (R15). |
| PRF hint | An up-front capability check that offers the backup key early when PRF looks missing. A hint only. The PRF check at sealing in `crypto.md` stays the deciding check (R16). |
| Fingerprint | The SHA-256 envelope hash is printed on the letter card and shown again at opening. The hash is not secret (R14). |
| Owner-only changes | `tools/qa/layout-check.mjs`, `.kiro/specs/07-judge-journey/**`, `.kiro/steering/tech.md`, `docs/kiro-writeup.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` and `.github/**` are delivered as patches for the owner to review. No role agent commits them (R1.3). |
| Evidence per task | Each task runs `bash scripts/check.sh`. Each task that changes anything on screen provides screenshots at 1366×800, 1280×800 and 360×640 (R30). |

### Rules this spec replaces

Accepted by the owner. These rules are replaced for this work:

- Spec 07 R7.12, R26.9 (the `/` half), the `scene` row of R2.1 ("no Ghost"), design Property 20 and QA step 07-01 say `/` renders no Ghost. `/` now renders the Ghost (R9). The spec 07 documents change by owner patch (R29.1). The tests change in the task that adds the Ghost (R9.15).
- Spec 07 R14.3 items 2, 3 and 6 (the "Your answer" line, the then value as the largest type, the now value at body size) are replaced by R4 and R5.
- Spec 07 R1.2 (no edit to `opening-machine.ts`) is relaxed for one change only: the `Opened` type MAY gain the verified envelope hash (R14.5). States, events and transitions stay unchanged.
- Spec 07 R1.1 (no change under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, no migration) does not apply to the crypto-dev and data-dev tasks of this spec (R14, R16, R20, R24). It still applies to every frontend-dev and platform-dev task.
- Spec 07 R1.11 (nobody edits `src/app/layout.tsx`) is relaxed: platform-dev MAY edit `layout.tsx` for metadata and the footer (R12).
- Spec 07 R1.8 is kept. The landing Ghost writes nothing to storage, cookies or the URL, and there is no arrival signal (R9.12).
- Spec 05 and spec 07 tick and range rules for the Recall_Scale (one log range from 0.01 to 100,000) are replaced by R7 for units in the Unit_Range_Table.
- Spec 03 R3.7 ("as the judge typed it ... with no rounding, reformatting or unit conversion") is replaced for separators only by R32.9: grouping separators are removed and a decimal comma is stored as a point. Every typed digit is still kept, with no rounding or unit conversion.
- For the recall number field, spec 05 R4.9 (an empty or invalid answer is caught at submit), spec 07 R11.3 (Enter moves on without checking the draft) and spec 07 R11.10 (the invalid question is shown at submit) are replaced by R32.5, R32.7 and R32.13.
- The `tech.md` line "Dates and numbers are formatted for the figure's region" is replaced by R15. The owner commits the `tech.md` patch (R29.2).

## Out of scope

- Groceries, rent or any other official series beyond fuel.
- New personas beyond one EU persona.
- Sweden: any Sweden series, Sweden persona, Sweden unit, `sv-SE` number format or Swedish source (R23).
- Recall_Record schema changes. The recall number input (R32) stores the existing canonical pattern.
- Changes to the states, events and transitions of `src/components/reveal/opening-machine.ts`.
- Changes to the crypto primitives, key hierarchy or envelope header fields in `crypto.md`.
- Changes to an existing `format_version`. Any payload change adds a new version.
- The 30-second Live_Letter lock and its demo table, except the label change in R13.
- Email or any other delivery channel, user accounts, rate limiting, spam protection and database backups.
- Publishing server secrets or a downloadable envelope (the `tech.md` known limitation stays).
- A new sound or vibration cue, an animation library, WebGL or a new runtime dependency.

## Glossary

- **Judge**: A person using the site to evaluate it for Kiroween, usually once and briefly.
- **Desktop_Sizes**: The viewports 1366×800 and 1280×800 CSS px.
- **Phone_Size**: The viewport 360×640 CSS px.
- **Desktop_Size**: Either one of the Desktop_Sizes.
- **Check_Sizes**: The Desktop_Sizes and the Phone_Size together.
- **Check_Size**: Any one of the Check_Sizes.
- **Letter date**: A date about the letter itself (sealed, written as of, opens, retrieved), written in the R15.1 format.
- **QA agent**: The independent qa role agent that reviews a PR and writes `.qa/verdict.json`.
- **Freshness_Check**: The scheduled GitHub Actions workflow that requests the public Figures_API and evaluates the Fetch_Failure_Check and the Period_Age_Warning for every Catalogue series (R21.6 to R21.14).
- **Last_Success_Time**: For one Catalogue series, the UTC time of the most recent Fetch_Job or Fallback_Refresh run that fetched that series without any R20.6 failure, as recorded under R20.18 and reported by the Figures_API under R21.5. It is not the `retrieved_at` of the newest stored period.
- **Fetch_Failure_Check**: The Freshness_Check test that fails when a series' Last_Success_Time is more than 48 hours old (R21.7).
- **Period_Age_Warning**: The Freshness_Check test that warns, without failing, when a series' newest period is more than 14 days before the Freshness_Check's run date in UTC (R21.8).
- **Freshness_Issue**: The one GitHub issue the Freshness_Check opens, updates and closes (R21.10 to R21.13).
- **Revision_Row**: A figure row stored for a series and period whose value differs from the newest-`retrieved_at` row already stored for that series and period (R20.17). It is stored alongside the earlier row and never replaces it.
- **Unit_Helper_Line**: The fixed line "1,000 here means 1 euro per litre.", shown with every recall question whose sealed unit is exactly `EUR per 1,000 litres` (R7.8).
- **Recall_Number_Parser**: The one pure module that reads the text typed into the recall number field and returns a value, an ambiguity with two readings, or a rejection (R32).
- **Ambiguous_Input**: Typed text, with leading and trailing whitespace removed, that is 1 to 3 digits not starting with 0, then exactly one `.` or `,`, then exactly 3 digits and nothing else (for example "1.585" or "1,585"). The separator could be a decimal or a grouping separator (R32.4).
- **Unambiguous_Format**: One of the input forms R32.2 lists, for which the Recall_Number_Parser returns exactly one value.
- **Figures_Heading**: The `h2` of the figures stage, "The numbers, then and now".
- **Letter_Text**: The element that holds the letter's serif text inside the Letter_Block.
- **Then_Value**, **Now_Value**: The displayed numbers of the Then_Figure and the Now_Figure in a Figure_Entry.
- **Answer_Value**: The judge's recorded recall answer for a figure, in the Accent.
- **Unit_Range_Table**: The one table, in one module, that maps an exact sealed unit string to a fixed Recall_Scale range and its tick values.
- **Fallback_Range**: The existing log range from 0.01 to 100,000, used for a unit that is not in the Unit_Range_Table.
- **Hero**: The headline block of a Scene page.
- **First_Step**: The `intact` Stage, ended by the Pick_Up_Button. Every Stage after it is "after the First_Step".
- **Landing_Ghost**: The Ghost as rendered on `/`, with no Envelope.
- **Fingerprint**: The envelope's SHA-256 hash as 64 lowercase hexadecimal characters, shown in 16 groups of 4 separated by spaces.
- **PRF_Hint**: The up-front, non-deciding check of whether the browser reports WebAuthn PRF support through `PublicKeyCredential.getClientCapabilities()`, and the message it shows on the Write step when support is reported missing (R16).
- **Catalogue**: The current set of figure series the app fetches and serves, with their metric definitions.
- **Fetch_Job**: The daily script, run by a Kubernetes CronJob from the app image, that fetches every Catalogue series and stores the results.
- **Figures_API**: `GET /api/figures`, which returns the latest figures for the whole Catalogue.
- **Fallback_Refresh**: The simpler scheduled refresh used instead of the Fetch_Job under R21.
- **Real_Letter**: A letter sealed by a user for a date at least 3 months away, stored in the `letters` table.
- **Real_Seal_Page**: The page at `/seal` that seals a Real_Letter.
- **Seal_Page**: As defined in spec 06; the live demo sealing page at `/demo/live`.
- **How_Page**: The plain-language page at `/how-it-is-sealed`.
- **Owner_Patch**: A diff for an owner-only file, attached to the task's issue or PR description and not committed by the role agent.
- **Self_Reported_Figure**: A number the user enters, stored with `source = self-reported`.
- **Scene**, **Ghost**, **Idle_Bob**, **Soil**, **Emergence**, **Envelope**, **Pick_Up_Button**, **Top_Bar**, **Soil_Canvas**, **Letter_Block**, **Accent**, **Calm_Mode**, **Figure_Entry**, **Content_Column**, **Scene_Frame**, **Ghost_Body_Box**, **Demo_2_On**: as defined in spec 07.
- **Ceremony**, **Stage**, **Skip**, **Mark**, **Recall_Scale**, **Number_Line**, **Seal_Break**: as defined in spec 05.
- **Opening_Flow**, **Reveal**, **Recall_Record**, **Then_Figure**, **Now_Figure**, **Comparable**, **Fixture_Figure**, **Persona_List**, **Demo_Index**: as defined in spec 03.
- **Live_Letter**, **Letter_Page**, **Sealing_Flow**, **PRF_Check**: as defined in spec 06.

## Requirements

### R1. Roles and boundaries

**User story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

1. THE task's PR SHALL change only files that are both (a) matched by the task role's paths or by the `shared` list in `.github/agents.json`, and (b) listed in the task's Scope.
2. THE frontend-dev and platform-dev tasks SHALL add, edit, rename or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/` or `src/lib/db/`, and SHALL add, edit or delete no file under `drizzle/`.
3. WHEN a task needs a change to `tools/**`, `.kiro/**`, `docs/**`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`, THE task SHALL attach the change as an Owner_Patch to its issue or PR description, and its PR diff SHALL contain no change to that file.
4. THE PRs of this spec SHALL leave the states, events and transitions of `opening-machine.ts` unchanged, and `opening-machine.test.ts` and `opening-machine.property.test.ts` SHALL pass with edits limited to test fixtures that add the verified envelope hash field of R14.5.
5. THE site SHALL keep the spec 07 R1.6 to R1.9 privacy rules: the Content Security Policy header value SHALL be byte-identical to the value before this spec, the browser SHALL make no network request to any origin other than the site's own origin, and code this spec adds SHALL write nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment.
6. THE tasks SHALL add no entry to the `dependencies` object of `package.json`.
7. IF a frontend-dev PR changes `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`, THEN THE QA agent SHALL fail the PR and name each such file in its report.
8. IF a PR changes a file that criterion 1, 2 or 3 does not allow for the task's role, THEN THE QA agent SHALL fail the PR and name each such file and the criterion it breaks.

### R2. "See the numbers" lands on the figures

**User story:** As a judge, I want "See the numbers" to show me the numbers, so that I don't lose my place 3,600 px down the page.

1. WHEN the judge activates "See the numbers" by pointer, touch or keyboard, THE Ceremony SHALL make the Figures_Heading the document's active element no later than 1,000 ms after activation.
2. WHEN the judge activates "See the numbers", THE Ceremony SHALL, no later than 1,000 ms after activation, have scrolled so the top edge of the Figures_Heading's box is at or below the bottom edge of the Top_Bar and above the bottom edge of the viewport, at every Check_Size, under full motion, under `prefers-reduced-motion` and under Calm_Mode.
3. WHEN the judge activates "Show everything", THE Ceremony SHALL move focus to the Figures_Heading and scroll it into view with the same timing and position as in criteria 1 and 2.
4. WHEN the Stage changes from `figures` to `close` because the figures fade-up settled or Skip ended it, THE Ceremony SHALL leave the document's active element unchanged, and the top edge of the Figures_Heading's box SHALL move by at most 1 CSS px relative to the viewport compared with its position immediately before the change.
5. WHILE the Stage is `close`, THE close heading's focusable controls SHALL follow the Figures_Heading in document order and SHALL be reachable from it with the Tab key alone, with no element having a positive `tabindex`.
6. WHEN the judge activates a control that starts a new Stage by the judge's own action, THE Ceremony SHALL keep the spec 07 rule of moving focus to that Stage's heading or its named focus target.

### R3. Reveal layout: the letter and the figures

**User story:** As a judge, I want to read the letter at a comfortable width with the figures beside or below it, so that the reveal looks finished on my laptop.

1. THE design SHALL state one breakpoint width in CSS px. WHILE the figures stage is shown and the viewport width is at or above the breakpoint, THE Reveal SHALL place the Figure_Entries beside the Letter_Block, meaning the Figure_Entries' column starts at or right of the Letter_Block's right edge and its top edge sits above the Letter_Block's bottom edge. WHILE the figures stage is shown and the viewport width is below the breakpoint, THE Reveal SHALL place the first Figure_Entry's top edge at or below the Letter_Block's bottom edge.
2. WHILE the viewport is one of the Desktop_Sizes, THE Letter_Text content box SHALL be at least 28em and at most 40em wide, measured in the Letter_Text's own computed font size.
3. WHILE the viewport is the Phone_Size, THE Letter_Text content box SHALL be at least 280 CSS px wide.
4. WHILE the viewport is one of the Check_Sizes, in every Stage of the persona page, `/demo/live` and `/l/[id]`, THE document's scroll width SHALL be at most its client width.
5. WHILE the viewport is one of the Check_Sizes, EVERY Then_Value, Now_Value, Answer_Value, change line and formula SHALL have its bounding box inside its Figure_Entry's bounding box, with no part hidden by overflow clipping, ellipsis or reduced type size.
6. IF a figure value with its unit and period does not fit on one line of its Figure_Entry at the value's type size, THEN THE Figure_Entry SHALL break the line only between the value and its unit or between the unit and the period, and SHALL keep the whole value (sign, currency symbol, digits and separators) on one line at the same type size.
7. THE Reveal SHALL keep the order of the stages in document order and from top to bottom on screen: what the judge remembered, then the letter, then the figures.

### R4. Then and now carry equal weight

**User story:** As a judge, I want then and now shown with the same weight, so that the layout doesn't tell me which number matters.

1. THE Then_Value and the Now_Value SHALL have identical computed font family, font size, font weight and colour in every Figure_Entry, and neither SHALL use the Accent colour.
2. EACH Comparable Figure_Entry SHALL show these items in this order, both in document order and from top to bottom on screen:
   1. the metric's display name;
   2. the Then_Value with its unit, and on the same line or the line below, its period, region and provenance label (R13);
   3. the Now_Value with its unit, and its period, region and retrieved date, laid out the same way as item 2;
   4. the Number_Line (R5);
   5. the change line;
   6. the formula with both input values, as text in the document;
   7. the source control, as in spec 07 R14.3 item 9.
3. EACH Figure_Entry, Comparable or not, SHALL show the visible text "Your answer" exactly once, not counting text that exists only in accessible names or hidden elements.
4. WHILE a Figure_Entry shows its Number_Line, THE Figure_Entry SHALL show "Your answer" only as the Number_Line's answer label (R5.2).
5. WHILE a Figure_Entry shows no Number_Line, THE Figure_Entry SHALL show "Your answer" on its own line after the Now_Value, followed by the Answer_Value or, if the Recall_Record holds no answer for that figure, by "No answer".
6. THE Figure_Entry SHALL keep spec 07 R14.2, R14.5, R14.6 and R14.10 to R14.12: payload order, the honest rendering of an unavailable or not-Comparable pair, one fixture note, the Live_Letter zero change, a period next to every figure number, and identical markup for a rise and its mirror-image fall.

### R5. Number_Line labels

**User story:** As a judge, I want the chart to say plainly which mark is mine, which is then and which is now, so that I read it without a legend.

1. THE Number_Line SHALL label each of its three points with a visible text label: "Then", "Now" and "Your answer". Each label SHALL be visible text in the DOM, not text drawn only into a canvas or only into an image.
2. THE "Your answer" label SHALL show the Answer_Value and its sealed unit in the Accent. THE "Then" and "Now" labels SHALL both use one non-Accent colour token, the same one for both. That token SHALL be the same whichever way the value changed and by however much.
3. WHILE the viewport is a Check_Size and the Stage is `close`, once web fonts have loaded, THE bounding box of each Number_Line label SHALL have zero intersection area with every other label's bounding box. Each label's bounding box SHALL also lie fully inside the bounding box of its Figure_Entry.
4. THE Number_Line SHALL compute label placement with one pure function. The inputs SHALL be the three point positions, the three label widths and the line width. The output SHALL be one box per label. The function SHALL read no DOM, clock, random value or figure value.
5. FOR ALL point positions from 0 to 1 inclusive, FOR ALL label widths from 0 up to the maximum label width stated in the design, and FOR ALL line widths at or above the minimum line width stated in the design, THE label placement function SHALL return label boxes with zero intersection area between any two. Every returned box SHALL lie inside the range 0 to the line width.
6. WHEN two or three points share a position, THE Number_Line SHALL stack their labels in the fixed order stated in the design. The order SHALL be the same for every value, every unit and every direction of change (up, down or none).
7. THE Number_Line SHALL keep spec 07 R14.4. Its range SHALL be computed from the then and now values only, with equal padding on both sides and the fixed minimum span for equal values. An out-of-range Mark SHALL sit at the nearer edge. No displayed number SHALL be computed from a position.
8. THE Number_Line SHALL expose a text alternative. It SHALL name the Then_Value with its unit and period, the Now_Value with its unit and period, and the Answer_Value with its unit, or "No answer" when no answer was recorded.
9. IF no recall answer is recorded for the figure, THEN THE Number_Line SHALL render no answer Mark. Its "Your answer" label SHALL read "No answer", and the "Then" and "Now" labels SHALL still render as stated in criteria 1 to 6.

### R6. The marks card

**User story:** As a judge, I want my remembered answers shown as a record, so that I don't try to drag a slider that does nothing.

1. THE read-only Recall_Scale on the marks card SHALL render no slider thumb and no drag handle. Its computed `cursor` SHALL be `default` or `auto` over every part of the scale, never `grab`, `grabbing` or `pointer`.
2. THE read-only Recall_Scale and every element inside it SHALL be outside the tab order: none SHALL be focusable by Tab or Shift+Tab. No element of the read-only Recall_Scale SHALL carry the `slider` role.
3. THE read-only Recall_Scale SHALL show the Mark at the recorded value, with a text label giving the Answer_Value and its sealed unit. IF no answer is recorded, THEN THE read-only Recall_Scale SHALL show no Mark and a text label reading "No answer".
4. WHEN the judge clicks, taps, drags or presses any key on the read-only Recall_Scale, THE Mark position, the shown Answer_Value and the stored Recall_Record SHALL stay unchanged.
5. WHILE the viewport is a Check_Size, once web fonts have loaded, THE bounding box of each tick label of each Recall_Scale (read-only and editable) SHALL have zero intersection area with every other tick label's bounding box.

### R7. A fixed Recall_Scale range per unit

**User story:** As a judge, I want the recall scale to cover sensible values for the unit, so that it is usable and gives no hint about the answer.

1. THE Unit_Range_Table SHALL hold one entry for every unit string that appears in the Catalogue or in a figure of any persona letter sealed by `scripts/seal-personas*`, and SHALL hold no Sweden unit (R23). Each entry SHALL give a minimum, a maximum greater than the minimum, and at least 2 tick values in strictly ascending order, each between the minimum and the maximum inclusive. A test SHALL fail if any such unit string has no entry.
2. THE Unit_Range_Table SHALL consist only of constant numeric literals. THE range and ticks it supplies SHALL NOT be computed from any sealed value, Now_Figure, Catalogue value or recall answer.
3. WHEN a recall question's sealed unit string is exactly equal to a Unit_Range_Table key, THE Recall_Scale SHALL use that entry's minimum, maximum and ticks. Equality SHALL be case-sensitive and whitespace-sensitive, with no normalisation.
4. IF a recall question's sealed unit string is not exactly equal to any Unit_Range_Table key, THEN THE Recall_Scale SHALL use the Fallback_Range and its existing ticks.
5. FOR ANY two recall questions with the same sealed unit string, THE Recall_Scale SHALL render the same minimum, maximum and tick values, whatever the sealed values, Now_Figures or recall answers of those letters.
6. THE recall number field SHALL accept every value that the Recall_Number_Parser returns (R32) and the Recall_Record validation accepts, whether that value is inside or outside the range in use, and THE range SHALL change only where the Mark is drawn. IF the value is below the minimum or above the maximum, THEN THE Recall_Scale SHALL place the Mark at the minimum edge or the maximum edge respectively, SHALL draw it with the same shape, size and colour at both edges, SHALL leave the field text unchanged, and THE Recall_Record SHALL store the typed value, not the edge value.
7. FOR ANY track position, THE value the Recall_Scale produces SHALL lie between the minimum and the maximum of the range in use inclusive, and SHALL match the Recall_Record number pattern (a non-negative decimal string of 1 to 40 characters: one or more digits, optionally a dot and one or more digits). THE Recall_Record schema SHALL stay unchanged.
8. WHEN a recall question is shown whose sealed unit string is exactly `EUR per 1,000 litres` (case-sensitive and whitespace-sensitive, as in criterion 3), THE Recall_Scale SHALL show the Unit_Helper_Line "1,000 here means 1 euro per litre." inside that question's block, taken from one constant in one copy module, with the same text on every letter and at every Check_Size.
9. THE choice to show the Unit_Helper_Line SHALL depend only on the sealed unit string. THE Recall_Scale SHALL read no sealed value, Now_Figure, Catalogue value or recall answer to choose or word the Unit_Helper_Line, and SHALL show no Unit_Helper_Line for any other unit string.
10. THE approved Unit_Range_Table values SHALL be: `USD per gallon` with minimum 0, maximum 10 and ticks 0, 2, 4, 6, 8 and 10; `EUR per 1,000 litres` with minimum 0, maximum 3,000 and ticks 0, 500, 1,000, 1,500, 2,000, 2,500 and 3,000.

### R8. The Hero after the First_Step

**User story:** As a judge, I want the question I am answering on screen, so that I don't scroll to find the field.

1. WHILE the Stage is after the First_Step, THE Hero headline SHALL use the smaller font size stated in the design. That size SHALL be strictly less than the headline's font size in the `emerging`, `sealed` and `intact` Stages at the same viewport size.
2. WHILE the viewport is a Check_Size, the Stage is `recall` and the page is scrolled to the top, THE bounding boxes of the current question's text, its number field and its next control SHALL each lie fully inside the viewport.
3. WHEN the Hero changes size, THE change SHALL animate only `transform` and `opacity`, and SHALL finish within the duration stated in the design, at most 400 ms.
4. WHILE `prefers-reduced-motion` is set or Calm_Mode is on, THE Hero SHALL change size with no animation, and SHALL show its final size in the first frame after the Stage changes.

### R9. The Ghost on the landing page

**User story:** As a judge opening the link, I want to see my past self climb out of the dirt, so that the idea lands before I click.

1. THE landing page SHALL include the Landing_Ghost in the HTML returned by the server, before any client JavaScript runs. The Landing_Ghost SHALL be rendered with the Ghost component from `src/components/ceremony/scene/Ghost.tsx`.
2. THE Landing_Ghost SHALL hold no Envelope. THE Accent button SHALL NOT be a descendant of the Ghost's DOM subtree.
3. WHILE the viewport is a Check_Size, THE horizontal centre of the Landing_Ghost's bounding box SHALL be within 1 CSS px of the horizontal centre of the purple light, measured the same way as on the persona page.
4. WHEN `/` loads with `prefers-reduced-motion` not set and Calm_Mode off, THE Landing_Ghost SHALL rise out of the Soil using the persona page's existing CSS rise, unchanged in duration and easing. When the rise ends, THE Landing_Ghost SHALL start the Idle_Bob.
5. WHILE `prefers-reduced-motion` is set or Calm_Mode is on, THE Landing_Ghost SHALL stand still in its risen position, with no rise and no Idle_Bob.
6. IF Calm_Mode is turned on or `prefers-reduced-motion` becomes set while the rise or the Idle_Bob is running, THEN THE Landing_Ghost SHALL stop all motion and show its risen position in the next frame.
7. WHERE scripts are disabled, THE landing page SHALL show the Landing_Ghost standing still in its risen position through a `<noscript>` style rule, as `LANDING_NOSCRIPT_STYLE` does for the light.
8. THE Landing_Ghost's eyes SHALL keep a fixed position under any pointer movement, touch or scroll. The JavaScript loaded by `/` SHALL contain no eye-follow code.
9. THE first-load JavaScript of `/` in a production build SHALL be at or under 130 kB gzipped, as measured by the project's existing JS budget check.
10. THE Landing_Ghost SHALL cause a cumulative layout shift of exactly 0 on `/` in a production build, measured from navigation start until the Idle_Bob begins, or until the risen position shows when motion is off. The server HTML SHALL reserve the Landing_Ghost's box. Its motion SHALL animate only `transform` and `opacity`.
11. WHILE the viewport is a Check_Size, throughout the rise and the Idle_Bob, THE Ghost_Body_Box SHALL have zero intersection area with each line box of the headline and with the Accent button's bounding box.
12. THE persona page SHALL play its full Emergence, with the Ghost rising and bringing the Envelope, on every load: after a same-tab client navigation from `/`, after a reload and on a direct visit. THE landing page SHALL add no client JavaScript that detects, records or signals an arrival for the persona page.
13. THE landing page SHALL show no hard-edged purple band below the Soil. Below the Soil strip, in a screenshot at each Check_Size, the colour of the light layer SHALL change from each pixel row to the next by no more than 2 in any 8-bit RGB channel, ending at the `--bg` colour.
14. THE landing page SHALL keep spec 07 R7.1 to R7.10 and R7.13. That means the light coming up, exactly one `h1`, exactly one Accent button, the headline as the largest contentful paint element, the Soil_Canvas loaded only by dynamic `import()`, and no Opening_Flow, crypto, API or database code.
15. THE task that adds the Landing_Ghost SHALL remove every test that asserts "no Ghost on `/`". It SHALL add tests asserting three things: the Landing_Ghost is present in the server HTML, it holds no Envelope, and `/` loads no eye-follow code.

### R10. Landing copy and links

**User story:** As a judge, I want the landing page to say what the project is and what it resurrects, so that I can judge it against the category.

1. THE landing copy SHALL state the Resurrection idea in one or two sentences. Those sentences SHALL name the classroom time-capsule letter to your future self and say that Revenant brings it back.
2. THE landing copy SHALL name no figure type (for example groceries or rent) that the Catalogue does not serve. WHILE every Catalogue series has a fuel metric, THE landing copy SHALL describe the figures as fuel prices and SHALL name each region that has at least one Catalogue series, and no other region.
3. WHILE the Persona_List holds exactly one persona, THE landing link to `/demo` SHALL use singular wording ("letter", not "letters"). WHILE the Persona_List holds two or more personas, THE landing link to `/demo` SHALL use plural wording.
4. THE landing page SHALL show a link whose target is exactly `https://github.com/devclef/Revenant`.
5. WHILE real sealing is on (R25), THE landing page SHALL link to the Real_Seal_Page. WHILE real sealing is off, THE landing page SHALL show no link to the Real_Seal_Page, SHALL link to the Seal_Page, and SHALL state next to that link that the letter opens 30 seconds after sealing.
6. THE landing page SHALL show a link to the How_Page.
7. THE Seal_Page figure picker copy SHALL state a maximum N, where N is the smaller of `MAX_FIGURES` and the number of Catalogue series the picker offers. IF the user tries to select more than N figures, THEN THE Seal_Page SHALL keep the selection at N figures and SHALL show the "too many" message stating the same N.

### R11. `/demo/live` header and a way back

**User story:** As a judge on the live demo, I want the same header as the rest of the site and a way back, so that I don't feel lost.

1. THE `/demo/live` page SHALL render the Top_Bar with the wordmark and the Demo chip, and SHALL render no `PageShell` header.
2. WHEN the user activates the Top_Bar wordmark on `/demo/live`, `/l/[id]`, the How_Page or the Real_Seal_Page, THE site SHALL navigate to `/`.
3. THE `/demo/live` page SHALL show a link to `/demo` in every state of the Sealing_Flow, before and after sealing.
4. THE `/demo/live` restyle SHALL leave the Sealing_Flow steps and their order, the crypto calls, the API requests and their bodies, and the meaning of every user-facing string from spec 06 unchanged. The existing spec 06 tests SHALL pass without edits to their assertions.

### R12. Metadata, favicon, Open Graph and footer

**User story:** As a judge who shares or bookmarks the link, I want a proper title and preview, so that the project looks finished.

1. THE site SHALL serve a favicon and an Apple touch icon that show the original sheet ghost. Each SHALL have an `ASSETS.md` entry with its path, how it was made, licence "original" and date added.
2. EACH route SHALL set its document title to "{page} · Revenant", where {page} is a page name that no other route uses. The title on `/` SHALL be exactly "Revenant".
3. THE site SHALL serve one Open Graph image of exactly 1200×630 px that shows the landing headline and the original ghost, with an `ASSETS.md` entry. EVERY page SHALL set `og:title`, `og:description`, `og:image` and `og:url`, and `og:image` and `og:url` SHALL be absolute URLs that start with `APP_ORIGIN`.
4. EVERY page SHALL show a footer with a link to the How_Page and a link to `https://github.com/devclef/Revenant`.
5. THE favicon, the touch icon and the Open Graph image SHALL be original work, SHALL not contain Kiro's logo or mascot, and SHALL not be AI-generated. Each `ASSETS.md` entry SHALL state how the asset was made.
6. THE footer SHALL come after all other page content in document order. At each Check_Size, the footer's bounding box SHALL not intersect the Soil's bounding box or any Stage content.

### R13. Live figures are not a historical record

**User story:** As a judge, I want each label to say what the figure is, so that I trust the labels.

1. WHILE the opened letter is a persona letter, THE Then_Figure label SHALL read "historical record, retrieved {date}", where {date} is the figure's sealed `retrieved_at` written as a letter date (R15.1).
2. WHILE the opened letter is a Live_Letter or a Real_Letter, THE Then_Figure label SHALL read "sealed with the letter, retrieved {date}", where {date} is the figure's sealed `retrieved_at` written as a letter date (R15.1). The label SHALL not contain "historical record".
3. THE Fixture_Figure label SHALL read "fixture data" in persona letters, Live_Letters and Real_Letters.
4. THE Self_Reported_Figure label SHALL read "self-reported" in Live_Letters and Real_Letters (R26). The label SHALL not contain "historical record" or "retrieved".

### R14. The envelope Fingerprint

**User story:** As a letter writer, I want a fingerprint of my sealed letter on my card and again at opening, so that I hold my own receipt that it has not changed.

1. WHEN the server confirms that a Live_Letter or Real_Letter is sealed, THE letter card SHALL show the Fingerprint of the envelope hash the server stored and returned.
2. THE Fingerprint SHALL appear in full, all 16 groups, on the printable letter card and on the letter card image, as text in a monospace face.
3. WHEN a letter opens and the envelope hash verification passes, THE Reveal SHALL show the Fingerprint of the hash computed in the browser, labelled "Fingerprint at sealing", together with a statement that the seal check passed.
4. FOR ALL envelopes, THE Fingerprint shown at opening SHALL be character-for-character equal to the Fingerprint printed at sealing for the same envelope.
5. THE browser opening code SHALL pass the verified envelope hash to the Reveal. WHERE this needs the `Opened` type to gain a field, THE `Opened` type MAY gain exactly one field, and the states, events and transitions of `opening-machine.ts` SHALL stay unchanged (R1.4).
6. IF the envelope hash verification fails, THEN THE Reveal SHALL show no Fingerprint, no letter text and no figures, and SHALL show the existing failure rendering unchanged.
7. THE Fingerprint SHALL be formatted and parsed by one module. FOR ALL 64-character lowercase hexadecimal hashes, parsing the formatted Fingerprint SHALL return the original hash. IF the formatter receives input that is not exactly 64 lowercase hexadecimal characters, THEN THE module SHALL reject it and return no Fingerprint.
8. WHEN a persona letter opens and the envelope hash verification passes, THE Reveal SHALL show the Fingerprint of the persona envelope with the label "demo letter" next to it, and SHALL not state or imply that it was printed on a card.

### R15. Dates and numbers

**User story:** As a reader anywhere, I want dates written one clear way, so that "11/09" never means two things.

1. THE site SHALL write every letter date (sealed, written as of, opens, retrieved) as the day number without a leading zero, the full English month name and the four-digit year, for example "30 October 2026" or "3 November 2026". This applies in every view, on every card and in the `.ics` description. Sealed and opens dates use the timezone stored at sealing; a persona "written as of" date is written as its calendar date.
2. THE site SHALL write a weekly period as the day number without a leading zero, the three-letter English month abbreviation and the four-digit year, for example "26 Oct 2026".
3. THE site SHALL write a monthly period as the three-letter English month abbreviation and the four-digit year, for example "Oct 2026".
4. THE site SHALL display each number with the decimal and grouping separators of its figure's region: the `en-US` format for US figures and the approved `en-IE` format for EU figures, both with a decimal point and comma grouping (for example 1,585.76). No figure SHALL use an `sv-SE` format (R23). Stored values SHALL keep full published precision, and rounding SHALL happen only in the display formatter.
5. Date formatting SHALL live in one module and period formatting in one module. No view, card or `.ics` code SHALL format a letter date or period by any other means.
6. THE Owner_Patch for `tech.md` SHALL replace the line "Dates and numbers are formatted for the figure's region" with the rules of criteria 1 to 4.

### R16. PRF hint before sealing

**User story:** As a judge on a device without PRF, I want to know before I start that I'll need the backup key, so that sealing doesn't surprise me at the end.

1. WHEN the Seal_Page or the Real_Seal_Page loads in a browser that provides `PublicKeyCredential.getClientCapabilities()`, THE page SHALL call it once, before the Write step is shown as complete.
2. IF the call resolves and reports `extension:prf` as `false`, THEN THE page SHALL show a PRF_Hint message on the Write step, before the user can leave the Write step, stating that this device may not be able to lock the letter with a passkey and that a backup key card will be needed.
3. IF `PublicKeyCredential.getClientCapabilities` is undefined, rejects, has not resolved within 2 seconds, or resolves without an `extension:prf` entry, THEN THE page SHALL show no PRF_Hint message, SHALL block no step, and SHALL leave the decision to the PRF_Check.
4. IF the call resolves and reports `extension:prf` as `true`, THEN THE page SHALL show no PRF_Hint message.
5. THE PRF_Hint SHALL change no rule of the PRF_Check in `crypto.md`, and THE PRF_Check at sealing SHALL alone decide whether the backup key is required.
6. WHEN the PRF_Hint has reported `false` and the PRF_Check at sealing then passes, THE Sealing_Flow SHALL treat the backup key as optional, as `crypto.md` requires.
7. THE PRF_Hint SHALL send no request to the server and SHALL write nothing to `localStorage`, `sessionStorage`, IndexedDB, cookies or the URL.

### R17. Backup key path end to end

**User story:** As a judge who seals with a backup key, I want "Go to your letter" to take me to it, so that the backup path works as well as the passkey path.

1. WHEN sealing ends on the backup-key path, THE sealed view SHALL show the "Go to your letter" control, disabled, under the same rule as the passkey path.
2. WHEN the countdown to `opens_at` reaches zero on the backup-key path, THE "Go to your letter" control SHALL become an enabled link whose `href` is exactly the relative path `/l/{letterId}`, never built from `APP_ORIGIN`.
3. WHEN the user activates the enabled "Go to your letter" control, THE browser SHALL navigate to `/l/{letterId}` for the letter just sealed.
4. WHEN the Letter_Page is opened with the correct backup key after `opens_at`, THE Opening_Flow SHALL unlock the letter, store the Recall_Record before any letter text or figure is shown, and then reveal the letter.
5. IF a backup key that is mistyped or belongs to another letter is entered on the Letter_Page, THEN THE Opening_Flow SHALL show an error message saying the key does not open this letter, SHALL keep the key field and its value, and SHALL show no letter content.
6. THE tests SHALL cover the backup-key path from sealing to reveal with a stubbed `fetch` and no real passkey, asserting in order: sealing with the backup key only, the "Go to your letter" link enabled with `href` `/l/{letterId}` after the countdown ends, opening with the same backup key, the Recall_Record request sent before the reveal, and the reveal showing the sealed letter text.

### R18. The "How it is sealed" page

**User story:** As a judge, I want a short honest page about how a letter is sealed, so that I can check the claims myself.

1. THE How_Page SHALL state that the browser encrypts the letter before it is sent, that the server stores only the encrypted envelope, its unencrypted header and the time-lock secret, and that the server releases the time-lock secret only when its own clock is at or after the opening date.
2. THE How_Page SHALL state that the passkey and the backup key can each open the letter after the opening date, that neither opens it before, and that a lost passkey with no backup key means the letter is lost.
3. THE How_Page SHALL state that opening a letter needs the Revenant server, and that if the service or its database is gone, sealed letters cannot be opened.
4. THE How_Page SHALL state what the Fingerprint is, that it is printed on the letter card and shown again at opening, and that matching all 16 groups means the envelope has not changed since sealing.
5. THE How_Page SHALL state that letters sealed on `revenant.devclef.se` count as test letters.
6. THE How_Page copy SHALL follow `tone.md` and `neutrality.md`, with no exclamation marks and no claim that R19's audit cannot tie to code or data.
7. THE How_Page SHALL be a server component, SHALL import nothing from `src/lib/crypto`, `src/lib/cards` or `src/lib/ics`, and SHALL load no more first-load JavaScript than the budget the design states, as measured by `scripts/check-js-budget.mjs`.
8. WHEN the How_Page is requested, THE app SHALL serve it at `/how-it-is-sealed` with a working link to it from at least the landing page.

### R19. Promise audit and README

**User story:** As the owner, I want every promise on the site to be true, so that no judge catches the site saying something it doesn't do.

1. THE audit SHALL list, in the task's PR description, every user-facing claim about what Revenant does in the copy modules, the landing page, the How_Page, the README and the letter and backup key cards, each paired with the file and symbol (code) or data file that makes it true.
2. IF a listed claim has no code or data merged to `main` that makes it true, THEN THE task SHALL change the copy so the claim is true or remove the claim, in the same PR.
3. THE README "Status" section SHALL list as done every feature merged to `main` at the time of the PR, including the backup key card, the `.ics` file and the passkey demo, and SHALL list as later only work not merged to `main`.
4. THE README SHALL state that opening a letter depends on the Revenant server, and that sealed letters cannot be opened if the service or its database is gone.
5. IF the real sealing work is dropped under R25, THEN THE audit SHALL confirm that no copy module, page, card or README section promises real sealing.

### R20. The daily figure fetch

**User story:** As a judge opening a letter in January, I want "now" to mean recent, so that the gap between then and now is real.

1. WHEN the Fetch_Job runs, THE Fetch_Job SHALL request every Catalogue series once, through the `src/lib/sources` adapter for that series' publisher, using the source and series ID the Catalogue names for that series.
2. THE Fetch_Job SHALL run on a schedule read from the chart's `values.yaml`, and THE default schedule in `values.yaml` SHALL start exactly one run per UTC calendar day.
3. WHEN the Fetch_Job stores a figure, THE Fetch_Job SHALL store it with value, unit, region, period, source, series ID, `source_url` and `retrieved_at` (UTC, the time the source response for that series was received), with the value stored as `numeric` with every published digit and no rounding.
4. WHEN a fetch returns a figure whose series, period and value are equal to the newest-`retrieved_at` row already stored for that series and period, THE Fetch_Job SHALL add no row for that figure. This SHALL hold for a second run on the same UTC day and for a run after a failed run, so that re-running the Fetch_Job against unchanged source data adds zero rows.
5. THE Fetch_Job SHALL only insert figure rows, and IF any code path issues an update or delete on a stored figure row, THEN THE database SHALL reject the statement with an error and leave the row unchanged.
6. IF, for a series, the source request fails (including no complete response within 30 seconds), the response has a non-success HTTP status, the response fails to parse, the result contains zero figures, or any figure in the result is malformed (a provenance field of criterion 3 is missing, the value is not a finite number, or the period does not match the period format the Catalogue defines for that series), THEN THE Fetch_Job SHALL store no figure from that series' result, SHALL leave every stored figure row unchanged, SHALL continue with the remaining series and sources, SHALL log the series ID and the failure reason with no secret or API key in the log, and SHALL exit with status 1 after every Catalogue series has been attempted.
7. THE Fetch_Job SHALL run as a Kubernetes CronJob from the app image with `concurrencyPolicy: Forbid`, and THE app SHALL expose no HTTP endpoint that starts a Fetch_Job or Fallback_Refresh run.
8. WHEN the Figures_API is requested, THE Figures_API SHALL return, in one response, one entry for every Catalogue series. Each entry SHALL hold the series' metric definition, its Last_Success_Time (R21.5), and the stored figure with the latest period for that series with full provenance, or no figure if none is stored. THE Figures_API SHALL accept no parameter that names or filters a series.
9. WHEN a letter reveals, THE browser SHALL make exactly one Figures_API request for that reveal and SHALL pick the Now_Figure for each sealed series locally by matching source, series ID, unit and region exactly.
10. IF a sealed series has no matching entry or no figure in the Figures_API response, or the Figures_API request fails or returns a body that fails to parse, THEN THE Reveal SHALL show that the now figure is unavailable with the reason ("no longer published by Revenant" for a missing series or figure, "could not be loaded" for a failed request), SHALL still show the Then_Figure with its period, and SHALL show no change value.
11. THE change that adds the Fetch_Job SHALL update the Helm chart (a CronJob template, the schedule in `values.yaml`, and the Secret keys for source API keys), `.env.example` and the chart README, and SHALL bump the chart `version`. These updates SHALL be merged in the same task or in a platform-dev task merged to `main` before the Fetch_Job is first deployed.
12. WHEN the Fetch_Job runs against a database with zero stored figure rows, THE Fetch_Job SHALL first insert every figure in `src/lib/figures/real/fuel-figures.json` with every value, period and provenance field (including `retrieved_at`) unchanged, so history from 2023-06-05 onward is available, and THE seeding SHALL set no Last_Success_Time.
13. THE adapters SHALL fill no gap, convert no currency, and substitute no series or region for the one the Catalogue names.
14. WHEN a source returns a well-formed result for a series that holds no period newer than the newest period stored for that series, THE Fetch_Job SHALL count that series as a success, SHALL store no new-period row for it, and SHALL log the series ID with the reason "no new period".
15. WHEN a run ends with no series failed under criterion 6 or criterion 19, THE Fetch_Job SHALL exit with status 0, whether each series stored new rows, stored no row under criterion 4, or had no new period under criterion 14.
16. IF one source fails under criterion 6, THEN THE Fetch_Job SHALL still store, in the same run, the well-formed figures of every series from every other source before it exits with status 1.
17. WHEN a fetch returns a figure for a stored series and period whose value differs from the value of the newest-`retrieved_at` row for that series and period, THE Fetch_Job SHALL insert the figure as a Revision_Row with its own `retrieved_at`, SHALL leave every earlier row for that period unchanged, and no sealed figure SHALL change (`data-integrity.md`). THE Figures_API SHALL return, for that period, the row with the newest `retrieved_at`.
18. WHEN a series ends a run as a success (new rows stored, no row added under criterion 4, or no new period under criterion 14), THE Fetch_Job SHALL record the run's UTC start time as that series' Last_Success_Time. IF a series fails under criterion 6 or criterion 19, THEN THE Fetch_Job SHALL leave that series' Last_Success_Time unchanged.
19. IF the database cannot be reached or a write for a series fails, THEN THE Fetch_Job SHALL keep every previously stored figure row unchanged, SHALL count each series without a completed write as failed, SHALL log the failure with no credential in the log, and SHALL exit with status 1.

### R21. Fetch early warning and fallback

**User story:** As the owner, I want to know early if the fetch is at risk, so that judges never see a stale "now" passed off as current.

1. IF, by 23:59:59 UTC on 16 November 2026, the Fetch_Job is not merged to `main` or no Fetch_Job run on `revenant.devclef.se` has exited with status 0, THEN THE owner SHALL switch to the Fallback_Refresh, and no reveal task in the build order SHALL be moved later to make room for fetch work.
2. THE Fallback_Refresh SHALL fetch through the same `src/lib/sources` adapters, SHALL start at least one run per UTC calendar day, SHALL meet R20.3 to R20.6, R20.13, R20.14, R20.17 and R20.18, and SHALL store each figure with the real `retrieved_at` of that fetch.
3. THE Reveal SHALL show each Now_Figure's period and its `retrieved_at` date (in the R15.1 format) inside the same Figure_Entry, on the same line as the Now_Value or the line directly below it, whether the Fetch_Job or the Fallback_Refresh supplied it.
4. THE Reveal SHALL label a Now_Figure "now" only with its period and retrieved date shown as in criterion 3, and SHALL not use the words "today", "current", "latest" or "live" (in any letter case) in any text that labels or describes a Now_Figure.
5. THE Figures_API SHALL include, for each Catalogue series, its Last_Success_Time in UTC, and SHALL report no Last_Success_Time for a series that has never ended a Fetch_Job or Fallback_Refresh run as a success under R20.18.
6. WHEN the Freshness_Check runs, THE Freshness_Check SHALL request `https://revenant.devclef.se/api/figures` once and evaluate the Fetch_Failure_Check and the Period_Age_Warning for every Catalogue series in the response.
7. IF the Figures_API request fails, gets no complete response within 30 seconds, returns a non-success HTTP status, returns a body that fails to parse, or returns zero series, THEN THE Fetch_Failure_Check SHALL report one failure stating the request problem. IF any series in the response has no Last_Success_Time or a Last_Success_Time more than 48 hours before the Freshness_Check's run time (UTC), THEN THE Fetch_Failure_Check SHALL report a failure naming each such series. THE Fetch_Failure_Check SHALL use the Last_Success_Time and SHALL not use the `retrieved_at` of the newest period.
8. IF the date of a series' newest period is more than 14 days before the Freshness_Check's run date (UTC), THEN THE Period_Age_Warning SHALL report a warning naming that series and its newest period, and SHALL not report a failure for it. The date of a weekly or daily period is the date the period names; the date of a monthly period is the last day of that month.
9. THE Freshness_Check SHALL be a scheduled GitHub Actions workflow under `.github/workflows/`, delivered as an Owner_Patch (R1.3), whose schedule starts a run at least once every 6 hours, that calls only the public Figures_API, and that uses no app secret, database credential or source API key (only the workflow's own GitHub token to manage the Freshness_Issue).
10. WHEN the Freshness_Check reports a failure or a warning and no Freshness_Issue is open, THE Freshness_Check SHALL open one Freshness_Issue assigned to the owner's GitHub account `devclef`, listing each affected series with its result, so that GitHub notifies the owner by email and mobile.
11. WHEN the Freshness_Check reports a failure or a warning and a Freshness_Issue is already open, THE Freshness_Check SHALL add one comment to that issue with the run time in UTC and each affected series with its result, and SHALL open no second issue.
12. WHILE a Freshness_Issue is open, THE Freshness_Check SHALL keep its title and label stating "failure" whenever the latest run reports at least one Fetch_Failure_Check failure, and "warning" whenever the latest run reports only Period_Age_Warning warnings, and SHALL update both in the run where the result changes from one to the other.
13. WHEN both the Fetch_Failure_Check and the Period_Age_Warning pass for every Catalogue series and a Freshness_Issue is open, THE Freshness_Check SHALL close the Freshness_Issue with a comment stating that both checks passed and the run time in UTC.
14. THE Freshness_Check SHALL keep starting runs on its schedule until at least 23:59:59 PT on 29 January 2027. Because GitHub disables scheduled workflows in a public repository after 60 days with no repository activity, THE Owner_Patch SHALL include a weekly keepalive workflow that keeps the schedule enabled through that date, and the owner's calendar reminder on 15 January 2027 SHALL prompt a check that the schedule is still enabled.
15. THE Fetch_Job CronJob SHALL keep failed runs visible in Kubernetes: a run that exits with status 1 SHALL show as a failed Job, and the chart SHALL set `failedJobsHistoryLimit` to at least 1 in `values.yaml` so the failed Job and its pod logs stay in the cluster after the run.
16. THE site SHALL keep serving the Figures_API and the Reveal at `revenant.devclef.se` until at least 23:59:59 PT on 29 January 2027.

### R22. EU persona

**User story:** As a judge, I want a second persona from another region, so that the demo shows more than one country.

1. THE Persona_List SHALL gain exactly one EU persona. Its as-of date SHALL be on or after the earliest EU27 period in `src/lib/figures/real/fuel-figures.json` (2023-06-05 in the current file) and strictly before the calendar date of its `opens_at` (criterion 8).
2. THE EU persona letter SHALL track exactly two series, EU27 Euro-95 and EU27 diesel from the Oil Bulletin figures file, and SHALL hold no Self_Reported_Figure and no Fixture_Figure. For each series, THE sealed figure SHALL be the row with the latest period on or before the persona's as-of date, and its value, unit, region, period, source, series ID, `source_url` and `retrieved_at` SHALL be identical to that row in the figures file.
3. THE EU persona letter text SHALL be plain text of 1 to 5,000 characters, SHALL mention no party, candidate, official, movement, policy, election outcome, opinion on the election or voting intention, and SHALL describe no group by region, class, age or background as better or worse off.
4. WHEN the EU persona PR is opened, THE PR description SHALL record the `neutrality.md` copy test review of the full letter text, with the reviewer's name and a result of pass or fail. THE EU persona SHALL be sealed only in a PR whose recorded result is pass.
5. WHEN `scripts/seal-personas*` runs, THE script SHALL seal the EU persona into the demo letters table with the published demo key, and the `letters` table SHALL gain no row. WHEN the script runs a second time with unchanged inputs, THE demo letters table SHALL gain no second EU persona row and the stored EU persona letter SHALL stay unchanged.
6. WHEN the EU persona page renders, THE page SHALL label each official figure "historical record, retrieved {date}" with the `retrieved_at` date in the R15.1 format, SHALL state that the letter was written as of its as-of date (in the R15.1 format) and prepared later as a demo, and SHALL NOT state that the letter was sealed on its as-of date.
7. IF `scripts/seal-personas*` finds an EU persona figure whose `source` or `series_id` starts with `FIXTURE`, THEN THE script SHALL exit with an error naming the persona and the series, and SHALL add or change no row in any table.
8. THE EU persona's `opens_at` SHALL be 00:00 UTC on one of 6, 7, 8 or 9 June 2024 (the European Parliament election dates in `product.md`), and THE persona entry SHALL record that date with the name of the official publisher and an `https` URL of the official page that gives it.

### R23. Sweden is out of scope

**User story:** As the owner, I want Sweden dropped cleanly, so that no page promises a Swedish figure the site does not serve.

1. THE Catalogue, the figures file `src/lib/figures/real/fuel-figures.json`, the Figures_API response and the Unit_Range_Table SHALL hold only US and EU series and units. None of them SHALL hold a series whose region names Sweden or a unit string that contains `SEK`.
2. THE Persona_List SHALL hold exactly two personas: the existing US persona and the EU persona of R22.
3. THE README, the landing copy, the How_Page, every copy module, and every code comment in the Catalogue and figure-formatting modules SHALL name only regions that have at least one Catalogue series (US and EU). A case-insensitive search of those files for "Swed", "SCB", "sv-SE" and the whole word "SEK" SHALL return no match.
4. THE README SHALL carry no mention of Sweden and no "groceries, rent" claim. This precondition is met on `main` before any spec 08 task starts, and the README states only what `main` does: line 20 reads "2. **Seal the figures.** Pick fuel prices from official sources for the US or the EU. Every figure keeps its source, period, unit and region." and line 46 reads "- **Persona letters.** A pre-sealed letter from a fictional person, written for a recent US election window. Break the seal, answer the recall questions, see the figures then and now. No passkey needed.", and no criterion 3 term and no "groceries, rent" claim remains in `README.md`. README line 46 SHALL gain the EU election window only through an Owner_Patch attached to the EU persona task (R22). README line 20 SHALL gain the self-reported sentence back only through an Owner_Patch attached to the self-reported numbers task (R26), and only if that task merges to `main`. The README "Status" section and the sentence on depending on the Revenant server stay with the R19 audit task (R19.3, R19.4).
5. THE R19 audit task SHALL deliver an Owner_Patch for `.kiro/steering/product.md`, `.kiro/steering/tech.md` and `.kiro/steering/structure.md` that lists, by file and line, every mention of Sweden data (the regions decision, the regions and currencies decision, the Sweden demo window, the Sweden row of the data sources table, the `scb` adapter and the "Sweden in SEK" line) for the owner to keep, mark as post-MVP or remove. THE role agent SHALL commit no change to those files (R1.3).
6. THE R23 work SHALL leave unchanged the test files that use a Sweden region or a SEK unit only as test input, the recorded source excerpts, and any guard list that rejects such terms, and THE criterion 3 search SHALL exclude them. IF any such test value reaches the Catalogue, the figures file or the Persona_List, THEN the criterion 1 or criterion 2 check SHALL fail.

### R24. Real sealing

**User story:** As a visitor, I want to seal a real letter to my future self, so that Revenant is more than a demo.

1. THE Real_Seal_Page SHALL run the same Sealing_Flow steps as the Seal_Page, in the same order: Write, figures, PRF_Check, passkey, backup key card, letter card and `.ics` file.
2. WHEN the user picks a date in the Real_Seal_Page date picker, THE browser SHALL set `opens_at` to 00:00 on that date in the browser's timezone at the moment of sealing, converted to UTC.
3. THE Real_Seal_Page date picker SHALL disable every date before the earliest date whose 00:00 in the browser's timezone is at or after the moment of sealing plus 3 calendar months, where 3 calendar months means the same day of the month three months later, or the last day of that month if that day does not exist (for example 30 November 2026 plus 3 calendar months is 28 February 2027).
4. WHEN a Real_Letter seal request arrives, THE server SHALL accept it only if `opens_at` is at or after the server's UTC time plus 3 calendar months, and SHALL store an accepted Real_Letter in the `letters` table only.
5. IF a Real_Letter seal request has an `opens_at` earlier than the server's UTC time plus 3 calendar months, or a body that fails validation, THEN THE server SHALL store no row and return an error indicating the reason, and THE Real_Seal_Page SHALL show that the opening date is too early or the request was invalid, keep the written letter text and chosen figures in the page, and let the user pick another date.
6. IF a Real_Letter seal request fails or the server cannot be reached, THEN THE Real_Seal_Page SHALL show that the letter was not sealed and SHALL generate no letter card, backup key card or `.ics` file for it.
7. THE Live_Letter 30-second lock, its seal route and its demo table SHALL behave as before this spec, and existing Live_Letter tests SHALL pass unchanged.
8. THE Real_Seal_Page SHALL state, before the passkey step, that letters sealed on this deployment count as test letters and that opening a letter needs the Revenant server.
9. WHILE real sealing is on (R25.3), THE landing page SHALL show a link to the Real_Seal_Page (R10.5).
10. WHEN a Real_Letter's link loads before `opens_at` by the server's UTC clock, THE Letter_Page SHALL show only the "still sealed" state, the opening date and the time remaining, and SHALL show no letter text, figure, metric name or recall question.
11. WHEN a Real_Letter's link loads at or after `opens_at` by the server's UTC clock, THE Letter_Page SHALL unlock, store the encrypted recall answers in the openings table before showing the letter, and then reveal, in the same order as for a Live_Letter.
12. WHEN application code issues an UPDATE or DELETE on a Real_Letter row, THE database triggers SHALL raise an exception and the row SHALL stay unchanged.
13. THE passkey user name for a Real_Letter SHALL name Revenant and the opening date in the R15 format, for example `Revenant letter · opens 5 November 2030`, as `crypto.md` describes.
14. THE Real_Seal_Page SHALL send `opens_at` as the only time value in the seal request, and THE server SHALL release the server secret only when its own UTC clock is at or after `opens_at`.

### R25. Real sealing go/no-go

**User story:** As the owner, I want a clear decision date, so that real sealing doesn't put the submission at risk.

1. WHEN 20 November 2026 arrives, THE owner SHALL record go or no-go for real sealing in the real sealing task issue, with go allowed only if every R24 test passes in `bash scripts/check.sh` and the owner has sealed and checked the countdown of one Real_Letter on `revenant.devclef.se`.
2. IF the decision is no-go, THEN THE Real_Seal_Page and its seal route SHALL be off, and THE landing page, How_Page, README and every copy module SHALL contain no statement that real letters can be sealed.
3. THE on or off state of real sealing SHALL come from one server-side configuration setting, set through the Helm chart values and listed in `.env.example` per `tech.md`, so that switching it needs no code change or new image.
4. IF the real sealing setting is unset or holds any value other than the on value, THEN THE server SHALL treat real sealing as off.
5. WHILE real sealing is off, THE server SHALL reject every Real_Letter seal request, store no row and return an error indicating real sealing is unavailable, and THE Real_Seal_Page SHALL show the not found page and no landing link to it.
6. WHILE real sealing is off, THE Letter_Page SHALL keep showing the countdown, unlock, recall and reveal for every Real_Letter already in the `letters` table.

### R26. Self-reported numbers (if time allows)

**User story:** As a letter writer, I want to seal my own rent or grocery bill, so that the letter holds numbers only I know.

1. WHERE self-reported numbers ship, THE Sealing_Flow SHALL let the user add from 0 to 10 Self_Reported_Figures, each with a value (a decimal number from 0 to 999,999,999 with at most 4 decimal places), a unit (1 to 60 characters), a region (1 to 60 characters) and a period (a month or a calendar date no later than the day of sealing).
2. IF a Self_Reported_Figure field is empty or outside the bounds in R26.1, THEN THE Sealing_Flow SHALL mark that field with a message indicating the allowed input, keep every entered value, and block sealing until the field is fixed or the figure is removed.
3. WHERE self-reported numbers ship, THE Sealing_Flow SHALL store each Self_Reported_Figure in the encrypted payload with `source = self-reported`, the value exactly as entered, and the unit, region and period the user entered.
4. WHERE self-reported numbers ship, THE Reveal SHALL label each Self_Reported_Figure "self-reported" next to its value, SHALL list Self_Reported_Figures in a group separate from official figures, and SHALL show no now value and no change for a Self_Reported_Figure.
5. WHERE self-reported numbers ship, THE landing copy MAY name rent and groceries only as numbers the user enters, and only with the label self-reported.
6. IF self-reported numbers need a payload change, THEN THE change SHALL add a new `format_version`, and THE opening code SHALL open every earlier `format_version` with its existing tests passing.
7. IF self-reported numbers do not ship by the feature freeze on 27 November 2026, THEN no page, copy module, README or How_Page SHALL mention self-reported numbers.

### R27. Layout checks (Owner_Patch)

**User story:** As the owner, I want the layout script to catch this kind of bug, so that QA can't pass it again.

1. THE Owner_Patch for `tools/qa/layout-check.mjs` SHALL set the script's default sizes to exactly the Check_Sizes (1366×800, 1280×800 and 360×640 CSS px), and THE script SHALL run every check in criteria 2 to 7 at each of those sizes.
2. WHEN the script activates "See the numbers" on `/demo/personas/us-maya`, THE script SHALL report a BLOCKER IF the Figures_Heading is not `document.activeElement`, or IF the top of the Figures_Heading's box is less than 0 or at or above the viewport height, measured after the scroll has settled.
3. WHEN the script reaches the Stage that shows the Letter_Block, THE script SHALL report a BLOCKER IF, at a Desktop_Size, the Letter_Text content box is narrower than 28em or wider than 40em in the Letter_Text's computed font size (R3.2), or IF, at the Phone_Size, it is narrower than 280 CSS px (R3.3).
4. WHEN the script reaches any Stage of the persona page, `/demo/live` or `/l/[id]`, THE script SHALL report a BLOCKER IF the document's scroll width is greater than the viewport width (R3.4).
5. WHEN the script reaches the `figures` or `close` Stage, THE script SHALL report a BLOCKER IF any Then_Value, Now_Value, Answer_Value, change line or formula has a box that extends outside its Figure_Entry's box (R3.5), or IF any two Number_Line label boxes in the same Figure_Entry overlap by more than 0 CSS px (R5.3).
6. WHEN the script reaches the `recall` Stage with the page scrolled to the top, THE script SHALL report a BLOCKER IF the current question's text, its number field or its next control has any part of its box outside the viewport (R8.2).
7. WHEN the Landing_Ghost's rise on `/` has finished, or immediately under `prefers-reduced-motion`, THE script SHALL report a BLOCKER IF the Landing_Ghost has zero width, zero height, zero opacity or a box fully outside the viewport, or IF the Ghost_Body_Box overlaps any of the headline's line boxes or the Accent button's box (R9.11).
8. THE script SHALL print, for every check at every size, the check name, the size, the measured values (for example the box top in CSS px, the width in em or px, the scroll width and the viewport width), the threshold, and PASS or BLOCKER, so the PR description can quote them.
9. IF the script reports one or more BLOCKERs, THEN THE script SHALL exit with a non-zero status after printing every result; IF it reports none, THEN THE script SHALL exit with status 0.

### R28. The Kiro write-up (Owner_Patch)

**User story:** As the owner, I want a write-up drawn from what happened, so that judges see how Kiro was used.

1. THE draft of `docs/kiro-writeup.md` SHALL be delivered as an Owner_Patch and SHALL be built only from the git history, the specs in `.kiro/specs/`, and `docs/agent-loop.md`.
2. THE draft SHALL state the commit SHA of `main` at which every count was taken.
3. FOR EACH number the draft states (for example commits, specs, tasks, PRs and QA verdicts), THE draft SHALL name the command or file it comes from, such that running that command or reading that file at the stated commit returns the same number.
4. THE draft SHALL state no number that cannot be recomputed under criterion 3.
5. THE draft SHALL describe how the reveal layout bug passed QA by naming the viewport sizes the earlier QA runs did not cover (including 1366×800) and the assertions the layout script lacked: the Figures_Heading focus and in-viewport check, the Letter_Text width check, and the document scroll width check.

### R29. Owner patches for spec 07 and steering

**User story:** As the owner, I want the older docs to match the new rules, so that no agent follows a retired rule.

1. THE Owner_Patch for `.kiro/specs/07-judge-journey/` SHALL edit R7.12, the `scene` row of R2.1, R26.9, design Property 20 and QA step 07-01 so that none of them states that `/` renders no Ghost, each states that `/` renders the Landing_Ghost, and each carries a reference to spec 08 R9.
2. THE Owner_Patch for `.kiro/steering/tech.md` SHALL replace the line "Dates and numbers are formatted for the figure's region" with the rules of R15.1 to R15.4, word for word in meaning.
3. THE Owner_Patch for `.kiro/steering/structure.md` SHALL list the How_Page route folder under `src/app/`.
4. WHERE the R25 decision is go, THE Owner_Patch for `.kiro/steering/structure.md` SHALL list `src/app/seal/` with the Real_Seal_Page.
5. WHEN a task adds a route that the design gives a JavaScript budget (at least the How_Page under R18.7, and the Real_Seal_Page if the R25 decision is go), THE task SHALL deliver an Owner_Patch for `scripts/check-js-budget.mjs` that adds that route with the budget in kB gzipped that the design states.
6. EACH Owner_Patch in this requirement SHALL be attached to the issue or PR of the task that makes the rule change, and not to a later task.

### R30. Tests and evidence

**User story:** As the owner, I want every rule checked in CI and every screen change shown, so that I can review fast.

1. THE tests SHALL run in `npm test` with no network access and `DATABASE_URL` unset, with every `fetch` stubbed, using `renderToStaticMarkup` and no browser. IF any test makes an unstubbed network request, THEN that test SHALL fail.
2. THE tests SHALL include these fast-check properties, each with `numRuns` of at least 100 and the tag `// Feature: 08-judge-polish, Property N: <title>`:
   1. Number_Line label placement: no overlap and inside the line width (R5.5).
   2. Recall_Scale range: the same range and ticks for any two letters with the same unit, whatever their values (R7.5).
   3. Recall_Scale values: every value from a track position matches the Recall_Record number pattern (R7.7).
   4. Fingerprint round trip: parse of format returns the original hash (R14.7).
   5. Opening date: for any timezone and any picked date, `opens_at` is 00:00 of that date in that timezone, and the earliest offered date is at least 3 calendar months after sealing (R24.2, R24.3).
   6. Then and now weight: a rise and its mirror-image fall render the same markup except where spec 07 R20.2 allows, with the Then_Value and the Now_Value in the same type style (R4.1, R4.6).
   7. Recall number round trip: for any value v the Recall_Record pattern accepts and each Unambiguous_Format of v, parsing the formatted text returns v (R32.3).
   8. Recall number ambiguity: for any Ambiguous_Input, the Recall_Number_Parser returns the decimal reading and the grouping reading and never a single value (R32.4).
   9. Unit_Helper_Line: for any two recall questions with the same sealed unit string, whatever their values, the Unit_Helper_Line is shown for both or for neither, with identical text (R7.8, R7.9).
3. THE tests SHALL check, through one pure focus-rule function, that the focus target is the Figures_Heading after "See the numbers" and after "Show everything", and that the focus target is unchanged after the settle from `figures` to `close` (R2.1, R2.3, R2.4).
4. THE data-dev tests SHALL check, with stubbed sources and a stubbed database, that the Fetch_Job meets R20.4 to R20.6 and R20.14 to R20.19, and in particular that it:
   1. stores all eight provenance fields of R20.3 (value, unit, region, period, source, series ID, `source_url` and `retrieved_at`);
   2. adds zero rows when run twice with the same source data, including a second run after a failed run (R20.4);
   3. issues no update or delete on a stored figure row (R20.5);
   4. exits with status 1 for each failure kind of R20.6: a failed request, no complete response within 30 seconds, a non-success HTTP status, a response that fails to parse, a result with zero figures, and a malformed result (missing provenance field, a value that is not a finite number, bad period);
   5. exits with status 0 when a series returns no new period and every other series succeeds (R20.14, R20.15);
   6. stores the figures of the other sources when one source fails, then exits with status 1 (R20.16);
   7. stores a changed value for a stored period as a Revision_Row and leaves the earlier row unchanged (R20.17);
   8. records the run's UTC start time as the Last_Success_Time of each successful series, and leaves the Last_Success_Time of each failed series unchanged (R20.18);
   9. keeps every stored row unchanged, counts the affected series as failed and exits with status 1 when the database cannot be reached or a write fails (R20.19).
5. THE crypto-dev tests SHALL check that the server rejects a Real_Letter `opens_at` that is earlier than 3 calendar months after the server's UTC time, accepts one that is exactly 3 calendar months after it, treats an unset or unrecognised real sealing setting as off, and rejects every Real_Letter seal request while real sealing is off (R24.4, R24.5, R25.4, R25.5).
6. EACH task SHALL run `bash scripts/check.sh` on its final commit and SHALL report in its PR description the commit SHA, the exit status and PASS or FAIL.
7. EACH task that changes anything on screen SHALL attach PNG screenshots at each Check_Size of every Stage or page it changes, named `<stage-or-page>-<width>x<height>`.
8. EACH task's PR description SHALL state the five route budgets from `node scripts/check-js-budget.mjs` with their measured sizes, every earlier-spec test it changed or retired with the reason, and every asset it added with its size in bytes, writing "none" for any empty list.

### R31. Task order

**User story:** As the owner, I want the work in priority order, so that the judge-facing fixes land first.

1. THE tasks SHALL be grouped and numbered in the build order of "Decisions already made", so that every task in a lower group has a lower number than every task in a higher group: group 1 reveal fixes and layout checks (R2 to R8, R27, R32); group 2 landing Ghost (R9); group 3 copy, labels, dates and metadata (R10 to R19, R23, R28, R29); group 4 daily fetch and freshness alert (R20, R21, including R21.9 to R21.15: the Freshness_Check Owner_Patch and the CronJob failed-run history); group 5 EU persona only (R22); group 6 real sealing (R24, R25); group 7 self-reported numbers (R26).
2. EACH task SHALL be one GitHub issue and one PR for one role, with a changed-line estimate at or under `max_changed_lines` in `.github/agents.json` (currently 5,000).
3. WHERE a requirement spans roles (for example R9 across the Scene components and `page.tsx`, R14 across `src/lib/crypto` and the Reveal, R20 across the Fetch_Job and the Helm chart, R21 across the Figures_API and the owner's workflow patch, R24 across `api/letters` and `/seal`), THE tasks SHALL split it so each task's changed files stay inside one role's paths plus `shared` (R1.1).
4. WHEN a PR merges to `main`, THE merged `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and `/demo/personas/us-maya` SHALL load without error, with the persona flow reaching the `close` Stage from `/`.
5. EVERY task in groups 1 to 5 SHALL be merged by the end of the feature freeze day, 27 November 2026.
6. IF a task in groups 1 to 5 is not merged by the end of 27 November 2026, THEN its issue SHALL be closed unmerged, and every user-facing claim that depends on it SHALL be removed under R19.2.
7. THE go or no-go of group 6 SHALL follow R25, and the drop of group 7 SHALL follow R26.7.

### R32. Recall number input with a decimal comma

**User story:** As a judge used to a decimal comma, I want the recall field to read my number the way I meant it, so that my recorded answer is the one I gave.

1. WHEN the judge changes the text of a recall number field, THE field SHALL pass the whole typed text, and no other input, to the Recall_Number_Parser, and SHALL act on the one result it returns: a single value, an Ambiguous_Input with its two readings, or a rejection.
2. WHEN the typed text, with leading and trailing whitespace removed, is not an Ambiguous_Input and matches one of these Unambiguous_Formats, THE Recall_Number_Parser SHALL return the single value it denotes:
   1. digits only, for example "1585";
   2. digits, a decimal point and one or more digits, with no grouping, for example "1585.76";
   3. digits, a decimal comma and one or more digits, with no grouping, for example "1585,76" (read as 1585.76) or "0,585" (read as 0.585);
   4. comma grouping, optionally followed by a decimal point and one or more digits, for example "1,585.76" or "1,585,760";
   5. dot grouping, optionally followed by a decimal comma and one or more digits, for example "1.585,76" or "1.585.760";
   6. space grouping, optionally followed by a decimal comma and one or more digits, for example "1 585,76" or "1 585".
   In the grouped forms, the first group SHALL have 1 to 3 digits and not start with 0, every later group SHALL have exactly 3 digits, only one kind of grouping separator SHALL appear, and each space separator SHALL be exactly one U+0020, U+00A0 or U+202F character.
3. FOR ALL values v that the Recall_Record number pattern accepts, and FOR EACH Unambiguous_Format in which v can be written without forming an Ambiguous_Input, parsing the text of v in that format SHALL return exactly v (round-trip property, property test, at least 100 runs). THE Recall_Number_Parser module SHALL provide the formatter that writes v in each such format.
4. WHEN the typed text is an Ambiguous_Input, meaning 1 to 3 digits not starting with 0, then exactly one `.` or `,`, then exactly 3 digits and nothing else, THE Recall_Number_Parser SHALL return the decimal reading and the grouping reading and no single value. THE field SHALL show both readings in words as two choices beside the typed text, the decimal reading first, with neither chosen in advance, for example for "1.585" or "1,585": "1 point 585" and "1 thousand 585".
5. WHILE an Ambiguous_Input has no reading chosen, THE recall step SHALL keep the next control disabled, SHALL leave the Mark where it was before the ambiguous text was typed, and SHALL store no Recall_Record value for that question.
6. WHEN the judge picks one reading of an Ambiguous_Input, THE field SHALL use that reading as the value, SHALL show it as the parsed value (criterion 8), SHALL move the Mark to it under R7, and SHALL enable the next control.
7. IF the typed text is neither an Unambiguous_Format nor an Ambiguous_Input (for example it holds a sign, a letter, a currency symbol, mixed decimal separators or a malformed group), or its canonical value (criterion 9) fails the Recall_Record validation (for example it is longer than 40 characters), THEN THE field SHALL show a message from the recall copy module saying the number could not be read, with one fixed accepted example that does not depend on the typed text or any figure, SHALL show no parsed value, SHALL keep the typed text and the Mark unchanged, and SHALL keep the next control disabled.
8. WHILE the field holds a single value or a chosen reading, THE field SHALL show that parsed value beside the field, linked to the field for assistive technology, before any submit. It SHALL use the R15.4 separators of the figure's region (decimal point and comma grouping, for example "1,585.76"), SHALL show every digit the judge typed, including leading and trailing zeros, with no rounding, and SHALL update on every change to the typed text.
9. WHEN the judge submits a recall answer, THE Recall_Record SHALL store the parsed value in the existing canonical number pattern: grouping separators removed, the decimal separator written as a point, and every digit the judge typed kept, with no rounding (for example "1.585,70" is stored as "1585.70", the grouping reading of "1.585" as "1585", and the decimal reading as "1.585"). This rule replaces the "no reformatting" part of spec 03 R3.7 for separators only. THE Recall_Record schema SHALL stay unchanged (R7.7).
10. THE Recall_Number_Parser SHALL be one pure module that reads no DOM, clock, browser locale, figure region, sealed value, Now_Figure or Catalogue value, and that returns the same result for the same text every time. No other code SHALL parse recall number text.
11. THE recall messages and the reading labels of this requirement SHALL follow `tone.md` (short, calm, no exclamation marks) and SHALL not comment on the value the judge typed.
12. WHEN the judge changes the typed text after picking a reading, THE field SHALL discard the pick and parse the new text again under criteria 1 to 7.
13. IF the typed text is empty after leading and trailing whitespace is removed, THEN THE field SHALL show no parsed value and no rejection message, and SHALL keep the next control disabled unless the judge selects the question's "no answer" control (spec 03 R8.3).

## Open items for the owner

1. Confirm the 16 November 2026 fetch decision date in R21.1, four days before the real sealing go/no-go.
2. Confirm the Live_Letter and Real_Letter label "sealed with the letter, retrieved {date}" (R13.2).
3. Decide the maximum sealing period for Real_Letters (an open question in `product.md`). R24 sets only the 3-month minimum.
4. Decide where the sealing timezone comes from. R15.1 writes sealed and opens dates in the timezone stored at sealing, and `data-integrity.md` asks for the timezone to be stored for display, but the v1 payload has no timezone field. The design must say where the timezone comes from without changing v1: for example, derive the UTC offset from `opens_at` being local midnight, or add a new `format_version` for Real_Letters that carries the IANA timezone.
5. Confirm the 2-second timeout for `getClientCapabilities()` in R16.3.
6. Confirm the R9.13 threshold of at most 2 per 8-bit RGB channel between adjacent pixel rows for the light gradient below the Soil.
7. Confirm the Self_Reported_Figure bounds in R26.1: 0 to 10 figures, values from 0 to 999,999,999 with at most 4 decimal places, and units and regions of 1 to 60 characters.
8. Confirm the "demo letter" label next to the persona Fingerprint (R14.8).
9. Decide what `product.md`, `tech.md` and `structure.md` say about Sweden once the R23.5 Owner_Patch arrives: keep as a post-MVP region, or remove.
10. Review and commit the Owner_Patches of R21.9, R23.5, R27, R28 and R29.
11. Confirm the 30-second timeouts: per series source request in the Fetch_Job (R20.6) and the Figures_API request in the Freshness_Check (R21.7).
12. Confirm the two unavailable reason phrases in R20.10: "no longer published by Revenant" for a missing series or figure, and "could not be loaded" for a failed Figures_API request.
13. Confirm the assumption in R20.19 that a database outage or failed write counts each affected series as failed and makes the Fetch_Job exit with status 1.
14. Confirm the assumption in R22.2 that each sealed EU persona figure is the row with the latest period on or before the persona's as-of date.

Closed by owner decision:

- The 48-hour threshold (formerly item 2) is confirmed as the Fetch_Failure_Check, measured from the Last_Success_Time. Weekly periods are covered by the separate 14-day Period_Age_Warning (R21.7, R21.8).
- The Unit_Range_Table values (formerly item 6) are approved (R7.10).
- The `en-IE` number display for EU figures is approved (R15.4).
- The second rise is decided: both rises stay (R9.12).
- Sweden is dropped (R23).
- The Freshness_Issue assignee and the schedule keepalive (formerly item 9) are confirmed: the Freshness_Issue is assigned to `devclef` (R21.10), and a weekly keepalive workflow keeps the Freshness_Check schedule enabled through 29 January 2027, with the owner's calendar reminder on 15 January 2027 (R21.14).
- R32.13 replacing the spec 05 rule that let the judge advance past an empty question is confirmed: for the recall number field, spec 05 R4.9, spec 07 R11.3 and spec 07 R11.10 are replaced by R32.5, R32.7 and R32.13 ("Rules this spec replaces").
