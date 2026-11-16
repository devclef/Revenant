# Requirements Document

Spec: 13 The seal

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category. The technology it resurrects is the wax seal. The platform deadline is 4 December 2026, 2:00 PM PT, and the owner submits on 3 December 2026. This spec was written on 16 November 2026 against `main` at `7546a6f`, after specs 01 to 12 were merged. The owner has confirmed these dates: feature freeze 27 November 2026, document recount by 30 November, video recorded 1 to 2 December, submission on 3 December.

The work runs in this order: P, U, A, L1, T, W, then L2 and F, then D, then the final Live_Walk. Most judges open a persona letter, which needs no passkey. On that path they never see the press, the wait or the Write step. So the tamper control (A) and the landing seal (L1) move ahead of the wait and the Write step, and the Part 1 work that only a judge who seals their own letter sees (T, W) follows.

The product says it is the wax seal resurrected, and the seal is barely there. The owner's review found:

- **The seal is not the hero.** The landing hero is the ghost. The only wax a judge sees is a small seal on the envelope at "Break the seal".
- **Sealing is a form.** "Press the seal" on `/demo/live` is a warning box, two checkboxes and two orange buttons ("Press the seal with your passkey", then "Confirm your passkey"). `tone.md` says the passkey prompt is the wax seal being pressed. The live flow does not do that.
- **The wait is a QR code and a hex string.** `tone.md` says the waiting letter is visible, unreadable, held and unopened. When the 30 seconds end, the ghost rises on top of the letter card.
- **Every seal looks the same.** `WaxSeal` takes no props, by design (spec 07 R10.10 to R10.12). A seal that shows nothing about its letter proves nothing.
- **The Write step reads as a form.** Margins are empty, the Occasion chips look like checkboxes, remove is a letter "x", "Add a receipt" and a "Receipts" link appear twice, a receipt row takes eight lines, and two disclaimer lines sit above the field. After a step change the headings "Press the seal" and "Wait" are half hidden under the sticky top bar.
- **Smaller defects.** The landing sections sit in a left column with the right side empty, and the four ritual cards are cramped. On the persona Testify step at 1440×900 the step labels collide with the "Maya is fictional" line and the answer controls are below the fold. On the live Testify step the ghost is missing and "The seal is intact" is jammed against the header.

This spec has two parts, kept apart:

- **Part 1, the seal (groups P, U, A, L, T, W, F).** Priority order: pressing the seal (P), a seal unique to each letter (U), the tamper control (A), the Landing_Seal on the envelope (L1), the wait (T), the Write step (W), then the ghost holding the envelope (L2) and the smaller fixes (F). Every requirement that can be cut carries a "Cuttable" note, and G3 gives the cut order.
- **Part 2, Submission documents (group D).** A recount of the numbers in `README.md` and `docs/video-script.md` at the final commit, the unticked spec 12 boxes, the stale "build is not complete" paragraph in `README.md`, and the video script. Part 2 is a separate group and is not part of the cut order. The Kiro write-up is not part of this spec (see Out of scope).

Requirements are numbered by group: G (rules for every task), P (press the seal), U (unique seal), T (the wait), W (the Write step), A (try to tamper), L (landing hero), F (smaller fixes), D (submission documents) and Q (verification). Four numbers are unused on purpose and are not reused: U7 (cut, see Out of scope), D2 (the write-up notes, removed from this spec), G3.7 (the owner-look dependency, removed) and U9.3 and U9.6 (the owner look, removed). Every rule of `.kiro/steering/` and of specs 02 to 12 still holds unless "Rules this spec replaces" names it.

## Code facts this spec relies on

Checked on 16 November 2026 in the local checkout at `7546a6f`, by reading the files named. I did not run a browser, so every visual claim in the Introduction is the owner's observation. The design must reproduce each one before fixing it (G2.6). The right-hand column says what is not yet known.

| Topic | What exists | Not yet known |
|---|---|---|
| Two passkey steps | `src/components/live/seal-machine.ts` has `CREATE_PRESS` and `CONFIRM_PRESS`, and states `creating`, `created`, `confirming`. `LIVE_COPY.passkeySteps` says "Your device will ask for the passkey twice. Each time, you press a button first." `createButton` is "Press the seal with your passkey" and `confirmButton` is "Confirm your passkey". `src/lib/crypto/passkey.ts` has `createPasskey`, `confirmPasskey` and `assertPasskey`. | Whether the existing `createPasskey` returns a PRF output at creation on the owner's devices. The plan is two prompts unless it does (P5.1). |
| User gesture on touch | Touch browsers count only the finger-up (release) as a user gesture for a WebAuthn call, not a timer that fires during the hold. | — |
| The Seal step today | `WriteForm.tsx` (about lines 548 to 600) renders `passkeySteps`, a "Opening on another device" disclosure, a warning box with the checkbox `live-warning` ("I understand that a lost or deleted passkey means this letter can never be opened, unless I keep its backup key."), a second checkbox `live-backup-card`, and then the action row with `backupButton`, `pressButton` and `StepStatus`. | — |
| Wax seal | `src/components/ui/WaxSeal.tsx` draws one fixed orange blob, a ring, an inner disc and a pressed sheet-ghost, in two clipped halves with a jagged seam. It takes no props that could change its look (spec 07 R10.11). It is used by `Envelope.tsx`, the Scene and `cracks.ts`. Its seal is about 75 px across at Break the seal, and the three persona envelopes on `/demo` draw it at about 60 px (this spec draws them at 96 px, U9). | — |
| Read step verdict | `src/components/reveal/Fingerprint.tsx` renders, for a persona, `REVEAL_COPY.sealVerdict` ("The seal is intact. This is exactly the text that was sealed.") and a `details` disclosure with the summary `REVEAL_COPY.fingerprintShow` ("Show the fingerprint"), inside `section[data-fingerprint-persona]`. `src/components/ceremony/steps.ts` maps the Stage `letter` to step 2, Read. | — |
| Hold model | `src/components/ceremony/seal/hold.ts` is a pure hold model for Break the seal (`SEAL_HOLD_MS`, `SEAL_SETTLE_MS`): press and hold, release early and the cracks recede, nothing is sent. `HeldSeal.tsx`, `SealBreak.tsx` and `useSealBreak.ts` use it. `SealBreak` also has a `Skip_Link` and a keyboard `Seal_Button`. | — |
| The fingerprint exists only after the envelope is built | `envelopeHash(envelope)` in `src/lib/seal-format/hash.ts` is the SHA-256 of the canonical envelope, 64 lowercase hex characters. `formatFingerprint` in `fingerprint.ts` splits it into 16 groups. `SealedState.envelopeHash` reaches `LiveWaitStep` and `SealedKeepsakes`. `GET /api/letters/[id]` returns `envelopeHash`. | — |
| Opening verifies the hash first | `openLetter` in `src/lib/crypto/open.ts` parses the envelope with the version registry, recomputes the hash and compares it in constant time to the stored hash. On a mismatch it returns `{ ok: false, error: { kind: "verification_failed" } }` before any key derivation. A correct hash with an altered ciphertext fails later at the AES-GCM tag. | — |
| Letter card | `src/lib/cards/letter-card-svg.ts` is browser-only. It draws the QR code, the opening date, the link and the sealing Fingerprint as SVG text. It draws no wax seal. | — |
| Wait step | `src/components/live/stepper/LiveWaitStep.tsx` shows the opening time, a countdown, the rehearsal line, "Go to your letter", the optional backup key card, and `SealedKeepsakes` (letter card, QR, calendar) in one panel. `LiveGhost` sinks while the countdown runs and goes `idle` at zero, so its CSS rise plays. The embedded Opening_Flow is portalled into the Reveal_Host below the card. | Which element the risen ghost covers at 1440×900 and 390×844. The design finds it (T2.1). |
| Landing hero | `src/components/landing/LandingHero.tsx` is a server component: eyebrow, `h1`, sentence, calls to action, then an empty `div[data-block="ghost"]` "drawn by the page". It has no envelope or seal. Sections below it are `RitualSection`, `ResurrectionSection`, `NoSealSection` and `CovenStrip` (spec 12 H1 and H2). | The layout rules in `landing.module.css` that leave the right side of the sections empty. |
| Write step, as spec 12 left it | Spec 12 W2 put a leading "✓" on the pressed Occasion chip. Spec 12 W3 made remove a small "×" icon. Spec 12 W5 put "Add a receipt" beside Next. Spec 12 W4 left a rehearsal sentence, and `LIVE_COPY.intro` is a second sentence, above the field. | The measured sizes. The design measures them first (G2.6). |
| Persona Testify | `TopBar`, `PersonaIntro` and `TestifyContext` render the fictional-persona notice and the step labels (`src/components/ceremony/steps.ts`, `intro/`). | The positions at 1440×900. |
| Budgets | `scripts/check-js-budget.mjs`: `/` 160 kB, `/demo` 160 kB, `/demo/personas/[key]` 260 kB, `/demo/live` 260 kB, `/l/[id]` 260 kB (gzipped, kB = 1,000 bytes). | The headroom on each route at `7546a6f`. The design measures it after `npm run build` before it adds code. |
| Spec 12 boxes | All 18 parent tasks in `.kiro/specs/12-submission-polish/tasks.md` are `[x]`. Twenty sub-task lines are still `[ ]`: 2.1, 2.2, 4.1 to 4.3, 5.1 to 5.3, 8.1, 8.2, 9.1, 9.2, 10.1 to 10.6, 11.1 and 11.2. Every other spec folder has no open box (`grep -cE '^\s*- \[ \]'`). | Which of the twenty have merged work behind them. D3 decides one by one. |
| README | Lines 67 and 68 hold the paragraph "Three spec folders still have open tasks, so the build is not complete as of 14 November 2026: 08-judge-polish, 09-demo-polish and 12-submission-polish." and a status comment. At `7546a6f` only spec 12 has open boxes, so the paragraph is already inaccurate. | — |
| Ownership | `README.md`, `docs/video-script.md`, `tools/qa/**` and `scripts/check-js-budget.mjs` belong to platform-dev. `.kiro/**` belongs to the owner. frontend-dev owns `src/components/**` and `src/app/**/*.tsx`. | — |

## Decisions already made

| Topic | Decision |
|---|---|
| Deadlines | Today is 16 November 2026. Groups P, U, A and L1 are merged by 22 November. Groups T and W are merged by 25 November. Groups L2 and F are merged by the 27 November freeze (unchanged from spec 12). Group D's recount runs at the Final_Commit after the freeze, by 30 November. The video is recorded 1 to 2 December. The owner submits on 3 December 2026. All these dates are decided by the owner. 4 December 2026, 2:00 PM PT is only the platform deadline. |
| Order | P, U, A, L1, T, W, then L2 and F, then D, then the final Live_Walk. Reason: most judges open a persona letter, which needs no passkey, and on that path they never see the press, the wait or the Write step, so the tamper control and the landing seal matter more. Group D starts after the last Part 1 PR merges, except D3 and D4, which can start at any time. |
| Cut order | G3.4 gives it. Group P (apart from P3), U1 to U6, U8 to U10, T1 and T2, W1 to W8, A1 and A2, L1, F3, F4 and group D are never cut. |
| Format and crypto | No change under `src/lib/crypto/` or `src/lib/seal-format/` is planned or made in this spec (P5.3). The seal is drawn from `envelopeHash`, which already exists. The tamper control calls the existing `openLetter`. |
| Backup choice | Accepted by the owner: one two-way Backup_Choice replaces the two checkboxes (P7), and the Warning_Text stays in plain view (P6). |
| Who edits the spec 12 boxes | `.kiro/**` is owner-only, and agents cannot edit it. For the spec 12 ticks, an agent produces one patch and an evidence list (D3.3). The owner applies the patch with `git apply` whenever the owner next merges. Nothing in this spec waits for it. |
| Write-up | Removed from this spec by the owner. D2 does not exist and its number is not reused. The write-up is handled later, outside this spec (Out of scope). |
| Seal on the still-sealed page | Cut outright by the owner: U7 does not exist. `GET /api/letters/[id]` returns no hash while a letter is sealed, and the owner wants no API change (Out of scope). |
| Landing Ghost below the hero | Accepted by the owner: at 900 px and wider the landing Ghost may stop being fixed below the hero. F1 and F2 stay Cuttable. |
| README task rule | Accepted by the owner: the README task counts every spec box except the README box and the final Live_Walk box, and the final recount re-checks (D4.1). |
| Two-layer relief | The Seal_Relief has a Coarse_Layer (a few large features from the first bytes of the hash) and a Fine_Layer (32 ticks and 32 dots) (U10). The owner approved rings 1 to 2 as decided. |
| No owner gates | No task waits for an owner's recorded look, approval or answer. A failed automated floor makes the agent change the relief derivation and continue (U9.4). |
| Persona seals at 96 px | The `/demo` persona seals are drawn at 96 CSS px at 1440 and 390, not as a fallback. The threshold is never lowered to fit a measurement. The automated floors (N coarse features, pixel floor P) are the check. One screenshot per width is attached to the PR as non-blocking evidence (U9). |
| Video script | A follow-up task is wanted after the freeze (D5). |
| One seal, two jobs | The wax relief is decoration that follows the fingerprint. The SHA-256 check in `openLetter` is the verification. Copy never presents the relief as the check (U6). |
| The seal is orange | Orange marks "you", the main buttons, the wax and the focus ring (`tone.md`). The wax stays orange. The relief is tone-on-tone on the wax and adds no colour. |
| Props | The envelope, the wax seal, the letter and the sheet ghost. No new Halloween prop (`tone.md`). |
| Widths | 1440×900 and 390×844, as in spec 12. Reduced-motion variants of each. |
| Persona demo key | Persona letters open with the published demo key in the browser. The tamper control uses the same key, so the only difference between the two runs is the changed byte (A2.2). |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **Spec 07 R10.10 to R10.12 and the `WaxSeal.tsx` header ("Every letter gets the same seal", "takes no props that could vary its look")**: replaced by U1 to U4 and U10. The seal takes one prop, the envelope hash, and now also has a size contract (U8 and U9: minimum sizes at Break the seal and on the `/demo` envelopes). The neutrality intent of R10.11 stays as U3.
- **Spec 12 W2.1 to W2.6, where the pressed Occasion chip carries a leading "✓" and a 2 px border**: replaced by W2 (the chip must not look like a checkbox).
- **Spec 12 W3 where the remove control is a small "×" icon**: replaced by W3.
- **Spec 12 W4.3 to W4.5 and `LIVE_COPY.intro`, where the rehearsal sentence and the passkey sentence sit above the Letter_Field**: replaced by W5.
- **Spec 12 W5, where "Add a receipt" sits beside Next and a "Receipts" link also exists**: replaced by W6 (one place).
- **Spec 09 D5 and spec 12 X1, where the Wait card holds the letter card, QR code and calendar button in the same panel as the countdown**: replaced by T1.

## Out of scope

- Any change under `src/lib/crypto/` or `src/lib/seal-format/`, and any change to the key hierarchy, the time lock, the envelope header or `format_version` (P5.3).
- A new Stage, persona, Occasion, figure source or region.
- Sound or vibration for the seal (spec 09 G1.4 stays: none new).
- Real sealing on `/seal` (spec 11 L6 stays no-go).
- Redesigning the persona reveal beyond F3.
- Any scoring, summary or interpretation of testimony against a letter (`neutrality.md`).
- The Kiro write-up (`docs/kiro-writeup.md`, `docs/writeup-gaps.md`, the OWNER notes, the MCP statement) is handled later, outside this spec.
- A seal on the still-sealed `/l/[id]` page (formerly U7). `GET /api/letters/[id]` returns no hash while a letter is sealed, and the owner wants no API change. The still-sealed page keeps the countdown only.
- Recording the video and choosing where it is hosted.

## Known limitations

- **A seal relief is not a proof.** Two different envelopes can in principle draw the same relief. Only the SHA-256 comparison in `openLetter` proves anything (U6).
- **The landing seal is not a real letter's seal.** It uses a fixed, decorative fingerprint and says nothing about any letter (L1.4).
- **The Live_Walk proves the code path, not any phone's passkey provider** (spec 11 Known limitations).

## Open questions for the owner

None. No task waits for an owner's look, approval or answer. The numbers N and the pixel floor of U9.5 are set by the design. The owner-approved rings 1 to 2 (U10.4) stay as decided.

## Glossary

- **Seal_Step**: The "Press the seal" step of `/demo/live`.
- **Press_Envelope**: The Envelope drawn on the Seal_Step, whose wax area is the control that starts the seal (P1).
- **Press_Hold**: Pressing and holding the Press_Envelope until its progress is full, after `SEAL_PRESS_HOLD_MS` (P2).
- **Wax_Pool**: The wax gathering on the envelope flap while the press is held (P2.2).
- **Signet**: The stamp that comes down on the wax when the Press_Hold completes (P2.3).
- **Setting_State**: The state between the first and second passkey prompt, drawn as the wax setting (P5.4).
- **Warning_Text**: The plain statement that a lost or deleted passkey means a lost letter unless a backup key exists (`LIVE_COPY.warning`).
- **Backup_Choice**: The single two-way choice that replaces the two checkboxes (P7).
- **Seal_Relief**: The relief drawn on the wax from the envelope hash (U1), made of the Coarse_Layer and the Fine_Layer.
- **Coarse_Layer**: The few large features of the Seal_Relief (notches on the rim, rings) drawn from bytes 0 to 3 of the hash (U10).
- **Fine_Layer**: The 32 ticks and 32 dots of the Seal_Relief, drawn from bytes 4 to 31 of the hash (U10.3).
- **Fingerprint_Hex**: The 64 lowercase hex characters of `envelopeHash`.
- **Blank_Signet**: The seal face with the sheet ghost and no relief, drawn while no hash exists (U5).
- **Sealed_Envelope_View**: The Wait step's envelope with its seal, in the light, with the countdown (T1).
- **Keep_Section**: The part of the Wait step holding the letter card, QR code, calendar and backup key card, below the Sealed_Envelope_View (T1.3).
- **Writing_Column**: The single column on warm paper that holds the Write step (W1).
- **Receipt_Row**: One compact row for a chosen figure or an own number (W7).
- **Tamper_Control**: The "Try to tamper with it" control on the Read step of a persona letter, beside the `Fingerprint` component's seal verdict and its "Show the fingerprint" disclosure (A1).
- **Read_Step**: The persona letter-reading Stage `letter`, step 2 "Read" of the Step_Indicator (`src/components/ceremony/steps.ts`).
- **Break_Seal_Min_Size**: The minimum Seal_Relief diameter at Break the seal: 160 CSS px at 1440 wide and 120 CSS px at 390 wide (U8).
- **Demo_Seal_Size**: The diameter at which the three persona envelope seals on `/demo` are drawn: 96 CSS px at the minimum, at both 1440 and 390 wide (U9.1).
- **Pair_Difference**: For two seals rendered at the same size, the number of Coarse_Layer features that differ, and the share of the seal's pixels that differ (U9.5). The floor of the automated check.
- **Tamper_Copy**: The in-memory copy of the stored envelope with one byte changed (A2.1).
- **Landing_Seal**: The large wax seal on the landing envelope (L1).
- **Release_Event**: The pointer release (finger-up or mouse-up) after a completed Press_Hold, or the keyboard activation, from which the first passkey prompt starts (P2.3, P5.2).
- **Hero_Viewport**: The first viewport of `/`, at 1440×900 or 390×844.
- **Top_Bar**: The sticky bar at the top of the Scene pages.
- **Step_Heading**: The heading of the current step on `/demo/live`.
- **Evidence_Sizes**: 1440×900 and 390×844, each with and without `prefers-reduced-motion: reduce`.
- **Cuttable**: A requirement that G3.4 lists and that may be dropped, in that order, if the freeze arrives first.
- **Final_Commit**: The last commit on `main` before the documents' own recount commit (D1.1).
- **Persona_Letter**, **Opening_Flow**, **Reveal_Host**, **Live_Letter**, **Live_Stepper**, **Ghost**, **Scene**, **Envelope**, **Stage**, **Skip_Link**, **Seal_Button**, **Calm_Mode**, **Fingerprint**, **Letter_Field**, **Occasion**, **Receipts_Disclosure**, **Live_Walk**, **Step_Shot**, **Journey_Check**, **Production_Check**, **Scoring_Words_Always**, **Scoring_Words_Scene**, **Retired_Phrase**: as defined in specs 05 to 12.

## Requirements

### G1. Roles and boundaries

**User Story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

#### Acceptance Criteria

1. THE task's PR SHALL change only files matched by the task role's paths or the `shared` list in `.github/agents.json`, and listed in the task's Scope.
2. THE frontend-dev tasks SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`.
3. THE PRs SHALL change nothing under `src/lib/crypto/` or `src/lib/seal-format/`, no crypto primitive, key hierarchy step, envelope header field or `format_version`, (P5.3). No crypto-dev task is planned.
4. THE PRs SHALL keep the privacy and size rules of spec 09 G1.5 and G1.6: the CSP header byte-identical, no browser request to another origin, nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment, no new entry in `dependencies`, no animation library, no WebGL, no new font, no sound and no vibration cue.
5. THE Seal_Relief code SHALL import nothing from `src/lib/crypto/`, `src/lib/letter-store/` or `src/lib/db/`, so that server components and browser-only card code can use the same function.
6. THE Tamper_Control code SHALL live in a browser-only module, and server code SHALL NOT import it.
7. EVERY string of Our_Copy that a PR adds or changes SHALL live in its feature folder's copy module, SHALL pass the `neutrality.md` copy test and the `tone.md` copy rules (second person, at most 25 words per sentence, no exclamation mark, no pun), and SHALL contain none of the Scoring_Words_Always. Strings in the Scene copy modules SHALL also contain none of the Scoring_Words_Scene.
8. THE Accent SHALL mark only the reader's own answer, the main buttons, the wax and the focus ring, and SHALL NOT mark a figure, a change or a direction.
9. EVERY text and number SHALL meet WCAG 2.2 AA contrast (4.5:1 for body text, 3:1 for large text and controls) on the surface it sits on. Text on purple SHALL be pure white.
10. THE task description SHALL name the one role that does the work, and a requirement that needs two roles SHALL be split into one task per role in dependency order.

### G2. Tests and evidence

**User Story:** As the owner, I want proof from the browser and from production, so that a task that passes locally cannot fail silently on the live site.

#### Acceptance Criteria

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser, apart from the Live_Walk.
2. THE property tests SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 13-the-seal, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the SHA, the exit status and PASS or FAIL in its PR description.
4. EACH task that changes a page SHALL attach PNG screenshots of every Stage or page it changes at the Evidence_Sizes, named `<stage-or-page>-<width>x<height>[-reduced].png`.
5. EACH task SHALL state every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, and every earlier-spec test it changed or retired with the reason, writing "none" for an empty list.
6. THE first task of each of groups P, T, W, L and F SHALL reproduce the owner's observation before changing anything: it SHALL attach screenshots from `main` at the Evidence_Sizes and SHALL name the component and the CSS rule behind each symptom.
7. EACH copy task SHALL attach the result of `node tools/hooks/tone-check.mjs` for every copy file it changed, and a search of the rendered Our_Copy of every page it changed showing that no Retired_Phrase remains.
8. THE Live_Walk (`npm run live-walk`) SHALL cover the new steps (Q1), and QA SHALL quote its result lines.

### G3. Task order, cuts and dates

**User Story:** As the owner, I want the most visible work first, so that a late freeze costs the least.

#### Acceptance Criteria

1. THE tasks SHALL be numbered in the order P, U, A, L1, T, W, then L2 and F, then D, then the final Live_Walk, because most judges open a persona letter and never see the press, the wait or the Write step, and each task SHALL be one GitHub issue and one PR for one role at or under `max_changed_lines` in `.github/agents.json`.
2. THE tasks SHALL carry "Depends on" lines that name only spec 13 task numbers.
3. WHEN a PR merges, `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and every persona page SHALL load without error.
4. IF the 27 November 2026 freeze arrives with Part 1 work open, THEN THE team SHALL cut in this order and stop when the work fits:
   1. A3 (the second tamper layer, with the hash recomputed).
   2. L2 (the ghost holding the seal in the hero; the hero keeps the ghost behind the envelope).
   3. F1 and F2 (the landing sections and the ritual cards; the landing Ghost may stop being fixed below the hero at 900 px and wider).
   4. P3 (the wax pooling in stages; the wax shows its finished pool at once and the Signet still comes down).
5. THE requirements P1, P2 (apart from P3), P4 to P7, U1 to U6, U8 to U10, T1, T2, W1 to W8, A1, A2, L1, F3, F4, group D and Q1 SHALL NOT be cut.
6. WHEN a requirement is cut, THE README and the video script SHALL NOT claim it.
7. (Unused number: the former rule that made Seal_Relief tasks wait for an owner look was removed. No task waits for an owner's look, approval or answer.)

### Group P. Pressing the seal (P0)

### P1. The envelope is the control

**User Story:** As a judge sealing my own letter, I want to press the seal on an envelope, so that locking the letter feels like an act and not a form.

#### Acceptance Criteria

1. THE Seal_Step SHALL show the Press_Envelope, the envelope with its wax area unpressed, as the largest element on the step at both Evidence_Sizes.
2. THE Press_Envelope SHALL be one focusable control with an accessible name that says it presses the seal, and its pressable area SHALL be at least 44×44 CSS px.
3. THE Back control on the Seal_Step SHALL stay an outlined button that is not orange, and THE Press_Envelope SHALL be the only orange control on the Seal_Step.
4. THE Seal_Step SHALL show the Warning_Text, the Backup_Choice and the press instruction above or beside the Press_Envelope, inside the First_Viewport at 1440×900 and with the Press_Envelope's top at most 1 scroll of 400 px away at 390×844.
5. WHILE the Backup_Choice is not made, THE Press_Envelope SHALL be marked `aria-disabled="true"`, SHALL start nothing, and SHALL be accompanied by one plain line that says what to choose first.

### P2. Press and hold

**User Story:** As a judge, I want to press and hold the envelope until the wax pools and the signet comes down, so that the passkey prompt is the seal being pressed.

#### Acceptance Criteria

1. WHEN a pointer press starts on the Press_Envelope, THE Seal_Step SHALL start the Press_Hold, and `SEAL_PRESS_HOLD_MS` SHALL be a named constant of at least 600 ms and at most 1,500 ms.
2. WHILE the Press_Hold runs, THE Seal_Step SHALL draw the Wax_Pool growing in proportion to the hold's progress, from 0 to its full size.
3. WHEN the pointer is released after the Press_Hold reached full progress, THE Seal_Step SHALL draw the Signet coming down on the wax and SHALL start the first passkey prompt from that release event, on every device, with no further press needed.
4. IF the pointer is released before full progress, THEN THE Seal_Step SHALL let the Wax_Pool recede and SHALL start no passkey prompt and send nothing.
5. WHEN the author activates the Press_Envelope by keyboard (Space or Enter), THE Seal_Step SHALL run the same sequence from one activation, with no hold needed.
6. WHILE the sequence runs, THE Seal_Step SHALL offer a Skip control that moves the animation to its final pose at once. THE Skip control SHALL NOT skip, answer or pre-empt any passkey prompt.
7. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE Seal_Step SHALL show no motion: the press SHALL complete from one activation and the Wax_Pool and the Signet SHALL appear in their final pose.
8. WHILE a passkey prompt is open, THE Press_Envelope SHALL ignore a further press, so that one press never starts two seals.

### P3. The wax pools in stages (Cuttable)

**User Story:** As a judge, I want to see the wax gather before the stamp, so that the seal feels made, not switched on.

#### Acceptance Criteria

1. WHILE the Press_Hold runs, THE Wax_Pool SHALL pass through at least three drawn stages (a bead, a spread pool, the full pool) before the Signet comes down.
2. IF P3 is cut under G3.4, THEN THE Seal_Step SHALL draw the full Wax_Pool at the moment the Press_Hold completes, and P2 SHALL still hold.

### P4. The first prompt is the press

**User Story:** As a judge, I want the passkey prompt to appear when the signet lands, so that the prompt reads as the seal being pressed.

#### Acceptance Criteria

1. WHEN the pointer is released after a completed Press_Hold, THE Seal_Step SHALL start the passkey creation from that release event (the Release_Event), without waiting for a second press.
2. WHILE the first passkey prompt is open, THE Seal_Step SHALL keep the Signet down on the wax and SHALL show one plain line that says the device is asking for the passkey.
3. IF the author cancels the prompt or the prompt times out, THEN THE Seal_Step SHALL lift the Signet, let the Wax_Pool recede, show the existing failure line for that case, and seal nothing.
4. THE Seal_Step SHALL keep every failure and cannot-lock screen of spec 11 and spec 12 reachable and unchanged in meaning.

### P5. One prompt, or a second prompt that reads as the wax setting

**User Story:** As a judge, I want at most one prompt, or a second that belongs to the same act, so that the seal does not turn into a second form.

#### Acceptance Criteria

1. THE design SHALL NOT investigate a single prompt unless it needs no change under `src/lib/crypto/`. IF the existing `createPasskey` already returns the PRF output on the owner's devices with no crypto change, THEN one prompt MAY be used. Otherwise two prompts with the Setting_State are the plan.
2. THE Seal_Step SHALL start the passkey call only from the Release_Event (the pointer release after a completed hold, or the keyboard activation), never from a timer.
3. NO change under `src/lib/crypto/` or `src/lib/seal-format/` SHALL be planned or made in this spec.
4. IF a second prompt is needed, THEN WHEN the first prompt succeeds, THE Seal_Step SHALL enter the Setting_State: the Signet stays down, the wax is drawn setting, and the Press_Envelope is the only control.
5. WHILE the Seal_Step is in the Setting_State, THE Seal_Step SHALL show one plain line that says the device will ask once more to set the seal, and SHALL NOT show the words "Confirm your passkey" or a second orange button.
6. WHEN the author presses the Press_Envelope in the Setting_State, THE Seal_Step SHALL request the second prompt and, when it succeeds, SHALL seal the letter.
7. THE Seal_Step SHALL show at most two passkey prompts in total, and the existing `seal-machine` rule SHALL hold: each press event is accepted only in its source state, so a second press during a prompt changes nothing.
8. WHEN the sealing has finished and the letter is stored, THE Seal_Step SHALL hand over to the Wait step with the Signet down and the Seal_Relief drawn from the stored hash (U5).

### P6. The warning stays plain and unmissable

**User Story:** As a judge, I want the lost-passkey warning to stay plain, so that atmosphere never costs me my letter.

#### Acceptance Criteria

1. THE Seal_Step SHALL show the Warning_Text as body text at the size of the surrounding paragraphs, in the existing wording of `LIVE_COPY.warning`, outside any disclosure, animation or hover.
2. WHILE the Seal_Step is in any state before the letter is stored, THE Warning_Text SHALL stay in the document and in view of the Press_Envelope: on screen without scrolling at 1440×900, and in the same screen as the Press_Envelope's label at 390×844.
3. WHEN the Press_Hold starts, runs, is cancelled or fails, THE Warning_Text SHALL NOT move, fade or be covered.
4. THE Warning_Text SHALL meet G1.9 on the surface it sits on, and SHALL carry no tone-setting imagery.

### P7. One choice for the backup key

**User Story:** As a judge, I want one clear choice instead of two checkboxes, so that the Seal_Step reads as a decision and not a form.

#### Acceptance Criteria

1. THE Seal_Step SHALL replace the checkboxes `live-warning` and `live-backup-card` with the Backup_Choice, a group of two options in a `fieldset` with a visible legend: "Download a backup key card" and "Skip it. A lost passkey means a lost letter."
2. THE Backup_Choice SHALL start with no option selected, and the press SHALL start only when one option is selected (P1.5).
3. WHEN the author selects "Skip it", THE Seal_Step SHALL treat that as the explicit confirmation required by `product.md` (Unlocking), and SHALL record nothing else about it.
4. WHEN the author selects "Download a backup key card", THE Seal_Step SHALL keep the existing backup key behaviour of spec 06 and spec 11: the backup key is created at sealing, and the card is offered on the Wait step.
5. IF the author's passkey cannot produce a PRF key (the cannot-lock and `BackupFallback` paths), THEN THE Seal_Step SHALL keep the existing required-backup flow unchanged.
6. THE Backup_Choice SHALL be operable by keyboard alone and SHALL name each option for assistive technology.

### Group U. Every seal is unique (P0)

### U1. The relief is drawn from the fingerprint

**User Story:** As a judge, I want each letter's seal to be its own, so that the wax shows something about the letter it closes.

#### Acceptance Criteria

1. THE Seal_Relief function SHALL take the Fingerprint_Hex (64 lowercase hex characters) and return the drawing of the relief as plain data or SVG markup, using no `Math.random`, no `Date`, no browser API and no server API.
2. FOR ALL Fingerprint_Hex values, THE Seal_Relief function SHALL return the same drawing for the same input on every call, on the server and in the browser (determinism, round-trip across renders).
3. IF the input is not exactly 64 lowercase hex characters, THEN THE Seal_Relief function SHALL return the Blank_Signet drawing and SHALL NOT throw.
4. THE relief SHALL be drawn only from abstract marks (rings, radial ticks, dots and arcs) around the existing sheet-ghost Signet centre, in tone-on-tone on the wax, with the Accent as the only wax colour, in the two layers of U10.

### U2. A changed envelope gives a different seal

**User Story:** As a judge, I want a changed envelope to give a visibly different seal, so that I can see the seal follows the letter.

#### Acceptance Criteria

1. FOR ALL Fingerprint_Hex values and for every one of its 64 positions, THE Seal_Relief function SHALL return a different drawing when that position is replaced by any other hex digit.
2. THE difference in U2.1 SHALL include at least one mark that moves, resizes or appears by at least 1 unit in the 100-unit drawing space, so that the change is visible and not only in the markup.
3. THE Seal_Relief function SHALL give a different drawing for each of the persona letters' stored hashes, and the test SHALL compare the persona hashes pairwise.

### U3. The relief says nothing

**User Story:** As a judge of any background, I want the seal to carry no symbol, so that it can never read as a statement.

#### Acceptance Criteria

1. THE relief SHALL contain no letter, numeral, flag, cross, crescent, star, animal, plant or other symbol with a religious, national or political meaning, and SHALL contain no text.
2. THE relief SHALL be the same visual kind for every fingerprint: no fingerprint SHALL draw an element that the others cannot, apart from position, size, count of marks within a fixed range, and rotation.
3. THE copy near the seal SHALL attach no meaning to any pattern, and SHALL NOT describe one seal as better, worse, stronger or more likely valid than another.

### U4. The same seal everywhere

**User Story:** As a judge, I want to see the seal I pressed again later, so that the seal is the letter's identity.

#### Acceptance Criteria

1. THE Wait step, the letter card, the Break the seal Stage and the Envelope at opening SHALL draw the Seal_Relief from the same function and the same Fingerprint_Hex of the same letter.
2. WHEN the same letter is shown on two of those surfaces, THE two drawings SHALL be equal after their per-instance ids are normalised (a test compares them, in the style of `normaliseWaxSealIds`).
3. THE letter card (`lib/cards/letter-card-svg.ts`) SHALL include the seal as vector shapes in the SVG, with no raster image and no request, and SHALL show the Fingerprint text beside it as today.
4. THE Seal_Relief SHALL render in the server HTML of every server-rendered page that shows it, so that the seal is present before JavaScript runs.
5. THE persona letters SHALL show their seals drawn from their stored envelope hashes.

### U5. The seal gains its relief when the hash exists

**User Story:** As a judge, I want the relief to appear when the envelope is stored, so that the seal is honest about when it knows the letter.

#### Acceptance Criteria

1. WHILE no Fingerprint_Hex exists (before the envelope is built and its hash is computed), THE Seal_Step SHALL draw the Blank_Signet and SHALL NOT draw any relief, placeholder relief or random relief.
2. WHEN the envelope is stored and its hash is known, THE Wait step SHALL draw the Seal_Relief from that hash with the Signet already down.
3. THE hash used SHALL be the one computed in the browser and verified by the server at sealing (`tech.md`, Integrity enforcement), and no other value.
4. WHERE the Fingerprint is shown near a seal, THE page SHALL show the same hash the seal was drawn from.

### U6. The relief is not the verification

**User Story:** As a judge, I want the page to say what the seal does and does not prove, so that decoration is not mistaken for a check.

#### Acceptance Criteria

1. THE copy near a seal SHALL say, at most once per page and in one sentence, that the seal is drawn from the letter's fingerprint.
2. THE copy SHALL NOT claim that the relief verifies, certifies or proves the letter, and SHALL NOT use the relief as a pass or fail indicator.
3. WHEN the letter opens, THE verification statement ("The seal is intact") SHALL come from the result of `openLetter`'s hash comparison, as in spec 05, and SHALL NOT come from the relief.

### U8. The seal is big enough at Break the seal

**User Story:** As a judge, I want to see the seal's relief when I break it, so that the seal is the main thing on screen.

#### Acceptance Criteria

1. THE Break the seal Stage SHALL draw the Seal_Relief seal at a diameter of at least 160 CSS px at 1440 wide and at least 120 CSS px at 390 wide (today about 75 px).
2. THE seal SHALL stay inside the First_Viewport with the hold control and the Skip_Link at both Evidence_Sizes, and SHALL clip no part of the relief.
3. THE Live_Walk and a layout check SHALL read the rendered diameter of the seal at both Evidence_Sizes and SHALL fail below the minimums in U8.1.

### U9. The three persona seals are told apart at a glance

**User Story:** As a judge on `/demo`, I want to tell the three persona seals apart at a glance, so that I can see each seal follows its letter.

#### Acceptance Criteria

1. THE `/demo` persona envelopes SHALL draw their seals at a Demo_Seal_Size of at least 96 CSS px at both 1440 and 390 wide (today about 60 px). THE size and every threshold in this spec SHALL NOT be lowered to fit a measurement.
2. THE first U task SHALL attach to its PR, as non-blocking evidence, one PNG screenshot at each width, `demo-seals-1440x900.png` and `demo-seals-390x844.png`, each showing the three persona seals, drawn from the real persona envelope hashes, side by side at their real drawn size on `/demo`.
3. (Unused number: the owner look was removed. The screenshots of U9.2 are plain evidence attached to the PR and block nothing.)
4. IF the automated floor of U9.5 fails, THEN THE agent SHALL change the relief derivation (the Coarse_Layer's mapping or ranges, U10), not the Demo_Seal_Size and not any threshold, and SHALL continue.
5. THE test SHALL render the three persona seals at 96 CSS px and, for each of the three pairs, SHALL require that the pair differs in at least N Coarse_Layer features (notch count, set of notch positions, ring count) and that the Pair_Difference in pixels is at least a floor P. THE design SHALL set N (at least 2) and P and record both in the PR description with the measured values, and SHALL NOT lower them afterwards.
6. (Unused number, formerly the rule that the floor does not replace the owner look.)
7. THE `/demo` layout SHALL fit the three envelopes without a horizontal scroll at 390 wide and at 1440 wide at the Demo_Seal_Size.

### U10. A coarse layer that reads at a glance

**User Story:** As a judge, I want a few large features on the seal, so that two seals can be told apart without looking closely.

#### Acceptance Criteria

1. THE Seal_Relief SHALL have two layers: the Fine_Layer (32 ticks and 32 dots) and the Coarse_Layer, a small number of large features drawn from the first bytes of the Fingerprint_Hex: the number and angular positions of notches on the rim, and the number of rings.
2. THE Coarse_Layer SHALL read bytes 0 to 3 (hex positions 0 to 7) and SHALL use every bit of them, so that replacing any one of those eight hex digits with another changes at least one coarse feature: a count by at least 1, or a position or size by at least 3 units in the 100-unit drawing space.
3. THE Fine_Layer SHALL NOT read bytes 0 to 3. THE Fine_Layer SHALL read bytes 4 to 31 (hex positions 8 to 63): tick k from the high nibble of byte k and dot k from the low nibble of byte k, for k from 4 to 31, or another one-to-one mapping of those 56 hex digits that the design records. Ticks 0 to 3 and dots 0 to 3 SHALL be drawn at one fixed value for every hash. THE reason is that no hex digit then drives both a coarse feature and a fine mark, so the Fine_Layer never makes a coarse byte redundant.
4. THE Coarse_Layer SHALL draw between 3 and 7 notches and between 1 and 2 rings (owner-approved), or other notch ranges that the design records, with a total of at most 12 coarse features.
5. THE Coarse_Layer SHALL follow the rules of the Fine_Layer: abstract marks only (U3), the same visual kind for every hash, deterministic (U1.2), no text and no new colour.
6. THE Coarse_Layer SHALL keep a fixed structure: for every valid hash, the minimum number of notches and rings is drawn, notches have a fixed width and depth, no two notches overlap, and no ring touches another ring, a notch or the rim, so that no hash gives an empty or broken seal.
7. EVERY part of the Coarse_Layer SHALL lie inside the wax outline, within the same inset as the Fine_Layer's marks, and each coarse feature SHALL be at least 4 CSS px across its smaller side when the seal is drawn at 96 CSS px.
8. IF the input is not a valid Fingerprint_Hex, THEN THE Blank_Signet SHALL draw no Coarse_Layer (U1.3, U5.1).

### Group T. The wait (P0)

### T1. The wait shows the letter

**User Story:** As a judge waiting 30 seconds, I want to see my sealed letter held in the light, so that the wait is a moment and not a form with a hex string.

#### Acceptance Criteria

1. WHILE the Wait step shows the countdown, THE Wait step SHALL show the Sealed_Envelope_View: the Envelope with its Seal_Relief seal, in the Scene's light, with the countdown directly beneath or beside it.
2. THE Sealed_Envelope_View SHALL be the largest element on the Wait step and SHALL be inside the First_Viewport at both Evidence_Sizes, together with the countdown.
3. THE Wait step SHALL place the Keep_Section (letter card, QR code, calendar button, backup key card offer) below the Sealed_Envelope_View, with its top edge below the bottom edge of the Sealed_Envelope_View at both Evidence_Sizes.
4. THE Wait step SHALL show the rehearsal line once, SHALL show the opening time once, and SHALL show no letter content, no figure and no question.
5. THE Wait step SHALL keep the letter card, QR code and `.ics` file as they are made at sealing, with the same contents (`tech.md`, Cards and calendar file).
6. THE Wait step SHALL show the Fingerprint (the existing `Fingerprint` component) inside the Keep_Section, and SHALL show it once.

### T2. The ghost does not cover the letter card

**User Story:** As a judge, I want the ghost to rise without covering anything I need, so that the end of the wait is clear.

#### Acceptance Criteria

1. THE first T task SHALL name the element the risen ghost covers at 1440×900 and 390×844 and the CSS rule that places it.
2. WHEN the countdown reaches zero, THE Ghost SHALL rise from behind the Sealed_Envelope_View, and its bounding box SHALL NOT intersect the bounding box of the Keep_Section at either Evidence_Size.
3. WHEN the countdown reaches zero, THE Wait step SHALL keep the Sealed_Envelope_View, the unlock control and the Keep_Section in view and readable, with no element covered by the Ghost.
4. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE Ghost SHALL appear in its settled pose without rising, and T2.2 and T2.3 SHALL still hold.

### T3. The wait is held and unopened

**User Story:** As a judge, I want the wait to feel held and quiet, so that the sealed letter reads as unopened.

#### Acceptance Criteria

1. WHILE the countdown runs, THE Sealed_Envelope_View SHALL show the seal intact with no crack and no motion beyond the Ghost's sink and a still glow.
2. THE countdown SHALL stay a `role="status"` line that names the seconds left, as today.
3. THE Wait step SHALL stay usable with the keyboard alone, and no control SHALL appear above the Sealed_Envelope_View.

### Group W. The Write step reads as a letter (P1)

### W1. One column on warm paper

**User Story:** As a judge, I want the Write step to look like writing a letter, so that it does not feel like a form.

#### Acceptance Criteria

1. THE Write step SHALL render in one Writing_Column on warm paper, centred, with a measure of at most 44 rem at 1440×900.
2. AT 1440×900, THE paper surface SHALL be no wider than the Writing_Column plus 80 CSS px, so that no band of empty cream wider than 40 CSS px sits on either side of the column.
3. THE Letter_Field SHALL be the first interactive element in the Writing_Column and its top edge SHALL be inside the First_Viewport at 390×844 and at most 360 CSS px from the top of the page at 1440×900.
4. THE Letter_Field SHALL use the serif face and keep its label, its count against 5,000, its validation rule and its minimum height from spec 12 W1.

### W2. A short prompt that follows the Occasion

**User Story:** As a judge, I want a short prompt inside the empty field, so that I know how to start.

#### Acceptance Criteria

1. WHILE the Letter_Field is empty, THE Letter_Field SHALL show one placeholder line of at most 12 words that follows the chosen Occasion.
2. WHEN the author chooses another Occasion while the Letter_Field is empty, THE placeholder SHALL change to that Occasion's line.
3. THE placeholder SHALL be neutral in the sense of `neutrality.md` and SHALL NOT be stored, counted or sealed.
4. THE Occasion rules of spec 11 L2 stay: client-side only, never stored, every Occasion starts with a default question anchored to the sealing day.

### W3. Occasion choices look like a choice of words

**User Story:** As a judge, I want the Occasion choice to look like picking a kind of letter, so that it does not look like checkboxes.

#### Acceptance Criteria

1. THE Occasion control SHALL be one row of text options with no box, no tick and no check mark on any option, so that no option can be mistaken for a checkbox.
2. THE chosen Occasion SHALL be shown by an underline and a heavier weight, and SHALL be exposed with `aria-pressed` or as a `radio` group, and not by the Accent alone.
3. EACH option SHALL have a pressable area of at least 44 CSS px high at 390×844 and at least 32 CSS px high at 1440×900.

### W4. Questions are compact rows with a plain remove

**User Story:** As a judge, I want my questions as short rows I can remove in words, so that I do not hunt for a small "x".

#### Acceptance Criteria

1. THE Write step SHALL show each Author_Question as one row under the Letter_Field, with the question text field and a text control "Remove" in the reader's words, not an icon and not a letter "x".
2. THE "Remove" control SHALL have an accessible name that includes the question number ("Remove question {n}") and a pressable area of at least 44×44 CSS px at 390×844.
3. WHEN the author removes a question, THE Write step SHALL move focus to the next question row, or to the add-a-question control when none remains, as spec 12 W3 does.
4. THE question rows SHALL be at most two lines tall each at 1440×900 when the question fits on one line.

### W5. Nothing above the field before typing

**User Story:** As a judge, I want to meet the letter first, so that I am not reading disclaimers before I start.

#### Acceptance Criteria

1. THE Write step SHALL show only the Step_Heading above the Letter_Field and the Occasion control before the author types.
2. THE rehearsal statement SHALL stay on the Write step exactly once, as one sentence below the action row, and `LIVE_COPY.rehearsalLine` SHALL keep its meaning ("a real letter stays sealed for months; this one opens in 30 seconds").
3. THE sentence that the letter is sealed in the browser with the author's own passkey SHALL move from the Write step to the Seal_Step, and SHALL appear there once.
4. THE `DemoLabel` and any other badge on the Write step SHALL NOT sit above the Letter_Field.

### W6. One place to add a receipt

**User Story:** As a judge, I want one clear place to add a receipt, so that I am not shown two.

#### Acceptance Criteria

1. THE Write step SHALL show "Add a receipt" in exactly one place, as a text control beside Next, and SHALL show no separate "Receipts" link, heading or tab.
2. THE Receipts_Disclosure SHALL stay a native `details`, closed by default, opened by "Add a receipt".
3. WHEN the author has chosen no receipt, THE Write step SHALL show nothing about receipts apart from the control in W6.1.

### W7. Receipt rows are compact

**User Story:** As a judge, I want each receipt as one short row, so that the list does not take the whole page.

#### Acceptance Criteria

1. THE Write step SHALL show each chosen figure as one Receipt_Row with the Short_Name, the value and unit, the period and the region.
2. EACH Receipt_Row SHALL be at most two lines tall at 1440×900 and at most three at 390×844, and SHALL carry no repeated note, no repeated label and no card border of its own.
3. EACH Receipt_Row SHALL show its period next to its value (`data-integrity.md`) and SHALL keep the source one tap or click away.
4. THE own-number rows SHALL be Receipt_Rows with the label "self-reported", at most two lines tall at 1440×900, and a blank row SHALL NOT block Next (spec 12 W6).
5. THE one Picker_Note of spec 12 K3 SHALL stay once per list.

### W8. The headings stay in view after a step change

**User Story:** As a judge, I want the step heading in view when the step changes, so that I know where I am.

#### Acceptance Criteria

1. THE first W task SHALL reproduce the half-hidden "Press the seal" and "Wait" headings and SHALL name the Top_Bar height and the scroll offset behind them.
2. WHEN the Live_Stepper moves to another step, THE Step_Heading SHALL receive focus and its whole box SHALL lie below the Top_Bar's bottom edge, with at least 16 CSS px of space, at both Evidence_Sizes.
3. THE Step_Heading SHALL keep a `scroll-margin-top` at least as large as the Top_Bar's height plus 16 CSS px.
4. WHERE `prefers-reduced-motion: reduce` is set, THE scroll to the Step_Heading SHALL be instant.

### Group A. Try to tamper with it (P1)

### A1. The control

**User Story:** As a judge, I want to try to break a sealed letter myself, so that I can see the seal hold.

#### Acceptance Criteria

1. THE persona page SHALL offer the Tamper_Control as a button labelled "Try to tamper with it", on the Read_Step, in the `Fingerprint` component's persona section (`src/components/reveal/Fingerprint.tsx`, `data-fingerprint-persona`), next to the line `REVEAL_COPY.sealVerdict` ("The seal is intact. ...") and the "Show the fingerprint" disclosure (`REVEAL_COPY.fingerprintShow`), on every Persona_Letter, and SHALL NOT place it on the Testify step.
2. THE Tamper_Control SHALL NOT appear on `/l/[id]`, on `/demo/live` or on any real letter.
3. THE Tamper_Control SHALL be reachable by keyboard and SHALL leave the Opening_Flow's position and answer controls unchanged.
4. THE page SHALL say plainly, next to the control and again with the result, that the test runs on a local copy in the browser and that the stored letter is not changed.

### A2. The test is the real check

**User Story:** As a judge, I want the refusal to come from the real verification code, so that I can trust what I see.

#### Acceptance Criteria

1. WHEN the judge presses the Tamper_Control, THE Tamper_Control SHALL make the Tamper_Copy: a deep copy of the stored envelope held in memory, with exactly one byte of the payload ciphertext changed, and SHALL leave the stored envelope object deep-equal to what it was before.
2. THE Tamper_Control SHALL first run `openLetter` on the untouched copy with the published demo key and the stored hash, and SHALL then run the same `openLetter` call on the Tamper_Copy with the same inputs, so that the changed byte is the only difference.
3. THE Tamper_Control SHALL call the same exported `openLetter` function that the Opening_Flow calls, and SHALL contain no second implementation of the hash or decryption check, no hard-coded result and no timer that stands in for the check.
4. WHEN `openLetter` returns `{ ok: false, error: { kind: "verification_failed" } }` for the Tamper_Copy, THE Tamper_Control SHALL show the seal cracked and the text "The seal is cracked. Revenant refuses to open this copy.", and SHALL show the byte index and the value before and after.
5. WHEN `openLetter` returns `ok: true` for the Tamper_Copy, THE Tamper_Control SHALL show a plain failure message that the test did not run as expected, and SHALL NOT show the seal as cracked.
6. THE Tamper_Control SHALL show the stored Fingerprint and the Fingerprint of the Tamper_Copy (from `envelopeHash`), each with the Seal_Relief drawn from it.
7. THE Tamper_Control SHALL make no request to the server, SHALL NOT call `POST /api/openings`, and SHALL write nothing to storage, cookies or the URL.
8. WHEN the judge closes the result, THE Opening_Flow SHALL continue from the same state with the real, untouched letter.

### A3. The second layer (Cuttable)

**User Story:** As a judge, I want to see that even a recomputed hash does not help, so that the second layer is visible.

#### Acceptance Criteria

1. WHERE the judge presses "Also fix the fingerprint", THE Tamper_Control SHALL recompute the hash of the Tamper_Copy with `envelopeHash`, run `openLetter` with that hash, and show the refusal that results from the failed AES-GCM tag check.
2. THE text SHALL say which layer refused each copy, in plain words, and SHALL NOT call either attempt an attack or a win.

### A4. Wording and neutrality

**User Story:** As a judge, I want calm wording, so that the control is a test and not a game.

#### Acceptance Criteria

1. THE Tamper_Control copy SHALL use the vocabulary of `tone.md` (seal, sealed, cracked, copy, record), no exclamation mark and no score.
2. THE Tamper_Control SHALL NOT say "caught", "wrong", "hacked", "attack" or "failed to break", and SHALL NOT congratulate or grade the judge.
3. THE Tamper_Control SHALL NOT touch the testimony, the sample answers or the letter text, and SHALL NOT compare any of them to anything.

### Group L. The landing hero (P1)

### L1. The seal is the first thing seen

**User Story:** As a visitor, I want the first thing I see to be a wax seal on an envelope, so that I understand what Revenant is before I read.

#### Acceptance Criteria

1. THE landing hero SHALL show the Landing_Seal, a large wax seal on a closed envelope, as the largest element in the Hero_Viewport at 1440×900 and 390×844.
2. THE Landing_Seal SHALL be at least 160 CSS px across at 1440×900 and at least 120 CSS px across at 390×844.
3. THE Hero_Viewport SHALL also show the `h1` and the primary call to action at both Evidence_Sizes.
4. THE Landing_Seal SHALL be drawn from one fixed decorative Fingerprint_Hex constant, SHALL show no Fingerprint text, and SHALL make no claim that it belongs to a real letter.
5. THE Landing_Seal, the envelope and the ghost SHALL be in the server HTML as SVG or CSS, with no canvas, no image request and no script needed for the first render.
6. THE Landing_Seal SHALL stay inside the route budget of `/` (160 kB).

### L2. The ghost behind it, holding it (Cuttable)

**User Story:** As a visitor, I want the ghost holding the envelope from behind, so that I see the idea: the past self holds the letter.

#### Acceptance Criteria

1. THE landing hero SHALL draw the plain sheet Ghost behind the envelope, with its arms or hem reaching around the envelope, and the Landing_Seal in front of the Ghost.
2. THE Ghost SHALL NOT cover the Landing_Seal, the `h1` or any control.
3. IF L2 is cut under G3.4, THEN THE landing hero SHALL draw the Ghost behind the envelope without the holding pose, and L1 SHALL still hold.
4. THE Ghost SHALL be the existing sheet ghost, not Kiro's logo or mascot, and the hero SHALL add no other Halloween prop.

### L3. Motion and fallback

**User Story:** As a visitor who prefers less motion, I want a still hero, so that the page is calm.

#### Acceptance Criteria

1. WHERE motion is allowed, THE landing hero SHALL animate at most the wax glow and the Ghost's settle, using only `transform` and `opacity`, and every motion SHALL be skippable or off under Calm_Mode.
2. WHERE `prefers-reduced-motion: reduce` is set or JavaScript is off, THE landing hero SHALL show the same composition at rest.
3. THE `h1` SHALL keep the tagline of `BRAND_COPY.tagline`, and the hero SHALL keep the existing calls to action.

### Group F. Smaller fixes (P1)

### F1. Landing sections use both halves (Cuttable)

**User Story:** As a visitor, I want the sections under the hero to use the page, so that the right side is not empty.

#### Acceptance Criteria

1. THE first F task SHALL name the container and grid rules in `landing.module.css` that leave the right side empty.
2. AT 1440×900, EACH landing section SHALL have rendered content in both halves of its container, where content is text, a figure or a drawing, and no section SHALL leave the right 40% of its container empty.
3. AT 390×844, THE landing sections SHALL stack in one column with no horizontal scroll.
4. THE layout check SHALL read the bounding boxes of each section's content and SHALL fail on an empty right half at 1440 px.

### F2. The four ritual cards have room (Cuttable)

**User Story:** As a visitor, I want the ritual cards to be readable, so that the four steps are clear.

#### Acceptance Criteria

1. AT 1440×900, EACH of the four ritual cards SHALL have at least 24 CSS px of padding, at least 200 CSS px of text width, at least 24 CSS px between cards, and body text of at least 16 CSS px with a line height of at least 1.5.
2. AT 390×844, THE four ritual cards SHALL stack in one column, each with at least 20 CSS px of padding.
3. THE cards SHALL clip no text at either width.

### F3. The persona Testify step fits at 1440×900

**User Story:** As a judge, I want the Testify step to fit the screen, so that I can answer without hunting.

#### Acceptance Criteria

1. AT 1440×900, THE step labels of the Step_Indicator and the "Maya is fictional" notice SHALL have bounding boxes that do not intersect, for Maya and for Tomás.
2. AT 1440×900, THE question, its answer control and the control to go on SHALL lie inside the First_Viewport on the persona Testify step, for each persona that carries answer controls.
3. AT 390×844, THE Testify step SHALL keep spec 10 P5 and spec 12 phone rules unchanged.
4. THE persona Testify step SHALL keep the order of its content and its wording, and SHALL say the fictional-persona notice once per spec 11 P3.

### F4. The live Testify step has its ghost and room

**User Story:** As a judge testifying on my own letter, I want the ghost present and the verdict line given room, so that the step looks like the persona's.

#### Acceptance Criteria

1. THE live Testify step SHALL show the Ghost in the Scene as the persona Testify step does, inside the First_Viewport at both Evidence_Sizes.
2. THE line "The seal is intact" SHALL have at least 16 CSS px of space between its top edge and the bottom edge of the Top_Bar at both Evidence_Sizes.
3. THE Ghost SHALL NOT cover the question, the answer control or the verdict line.
4. WHERE `prefers-reduced-motion: reduce` is set or Calm_Mode is on, THE Ghost SHALL show its settled pose, and F4.1 to F4.3 SHALL still hold.

### Group D. Submission documents (separate from Part 1)

This group changes documents only. It adds no feature and is never cut. D2 (the write-up notes) was removed from this spec; its number is not reused.

### D1. The recount at the Final_Commit

**User Story:** As the owner, I want every number in the submission recounted at one commit, so that no number is stale.

#### Acceptance Criteria

1. THE Final_Commit SHALL be the last commit on `main` after the last Part 1 PR has merged and before the commit that holds the recount, and every document SHALL name it by full SHA.
2. THE recount SHALL re-run, at the Final_Commit and on the day of the recount, each command named in the provenance comments of `README.md` and, where it carries numbers, `docs/video-script.md`, including the task counts per spec folder, the merged pull request count, the property test file count, the hook count, the agent file count and the route budgets.
3. EVERY number in `README.md` and `docs/video-script.md` SHALL carry a provenance comment of the form already used in the README: the command, the date and the commit.
4. IF a number cannot be recounted because a command fails, THEN THE document SHALL say that the number was not recounted and why, and SHALL NOT keep the old number.
5. IF a Part 1 PR merges after the recount, THEN THE recount SHALL be repeated at the new Final_Commit before submission.

### D3. Spec 12 boxes

**User Story:** As the owner, I want spec 12's boxes to match what is merged, so that the task record is true.

#### Acceptance Criteria

1. FOR EACH of the twenty open sub-task lines in `.kiro/specs/12-submission-polish/tasks.md`, THE check SHALL tick it only when the artefact it names exists on `main`: the implementation file named in its task, or the test file that carries the tag `// Feature: 12-submission-polish, Property N: <title>` and passes `npx vitest run <file>`.
2. IF the artefact does not exist or its test fails, THEN THE line SHALL stay open, and THE report SHALL name the line and the missing artefact.
3. THE agent SHALL produce ONE patch for `.kiro/specs/12-submission-polish/tasks.md`, applied by the owner with `git apply` whenever the owner next merges (`.kiro/**` is owner-only, and agents cannot edit it; the patch blocks no task), at `tools/qa/patches/spec-12-tasks.patch` (owned by platform-dev), plus an evidence list at `tools/qa/patches/spec-12-tasks.evidence.md` (owned by platform-dev) giving, per ticked line, the file path and the merged PR number. THE PR description SHALL carry the same text.
4. WHEN Part 1 of this spec is done, THE same check SHALL run on `.kiro/specs/13-the-seal/tasks.md`.

### D4. The README paragraph

**User Story:** As a reader of the repository, I want the README's status to be true, so that I can trust the rest of it.

#### Acceptance Criteria

1. WHEN no spec folder under `.kiro/specs/` has an open task box, apart from the README task's own box and the final Live_Walk box (the README task counts every other spec box, and the final recount re-checks), (`grep -cE '^\s*- \[ \]' .kiro/specs/*/tasks.md` is 0 for every other box), THE README SHALL NOT contain the paragraph "Three spec folders still have open tasks, so the build is not complete" or its status comment (lines 67 and 68 at `7546a6f`).
2. IF any spec folder still has an open task box at the recount, THEN THE README SHALL replace that paragraph with one true sentence that names each folder with open boxes and the date and commit of the count.
3. THE README SHALL not contain a sentence that says or implies the build is incomplete once D4.1 holds.
4. WHERE Part 1 requirements merge, THE README SHALL describe each of them in one clause at most (the seal drawn from the fingerprint, the press on the envelope, the tamper control), and only after the PR has merged and the Live_Walk shows it.
5. THE README task SHALL be a platform-dev task on `README.md`, which G4 of spec 12 already grants.

### D5. The video script matches what merged

**User Story:** As the owner, I want the video script to describe the product as it is, so that the video claims nothing that was cut.

#### Acceptance Criteria

1. AFTER the 27 November freeze, THE platform-dev task SHALL bring `docs/video-script.md` in line with what actually merged in Part 1, and SHALL describe each shown moment only if its PR has merged and the Live_Walk or a test shows it.
2. THE script SHALL contain no claim of a requirement that was cut under G3.4 (G3.6), and SHALL name no date for the video other than 1 to 2 December 2026.
3. THE script task SHALL be one platform-dev task on `docs/video-script.md`, which platform-dev already owns.

### Group Q. Verification

### Q1. The Live_Walk covers the new seal

**User Story:** As the owner, I want a browser walk of the new seal, so that I know it works before the judges do.

#### Acceptance Criteria

1. THE Live_Walk SHALL cover, at both Evidence_Sizes with and without reduced motion: the press-and-hold on the Press_Envelope, a release before full progress (nothing sent), a release after full progress (the first prompt starts from that release), the keyboard activation, the Skip control, the Setting_State where it occurs, the Wait step with the Sealed_Envelope_View, the zero of the countdown, the unlock, the Testify step, the seal at Break the seal at its minimum size (U8), the `/demo` persona seals at 96 CSS px (U9), and the persona Tamper_Control on the Read_Step.
2. THE Live_Walk SHALL fail on: a Step_Heading whose box lies under the Top_Bar after a step change; an intersection between the risen Ghost and the Keep_Section; more than two passkey prompts; an orange button other than the Press_Envelope on the Seal_Step; a horizontal scroll; clipped text; a second Motion_Control; a console error.
3. THE Live_Walk SHALL check that the seal drawn on the Wait step equals the seal drawn at Break the seal for the same letter.
4. THE Live_Walk SHALL load `/`, `/demo`, a persona page and `/l/[id]` with JavaScript disabled and SHALL check that the Landing_Seal and, where it exists, the seal are in the first render.
5. THE final Live_Walk on the merged `main` SHALL attach a Step_Shot of each step named in this requirement.

### Q2. Property tests

**User Story:** As the owner, I want the seal's rules pinned by properties, so that a later change cannot break them silently.

#### Acceptance Criteria

1. THE tests SHALL include a property that the Seal_Relief function is deterministic for every Fingerprint_Hex and returns the Blank_Signet, without throwing, for every other input (U1.2, U1.3).
2. THE tests SHALL include a property that changing any one of the 64 positions of any Fingerprint_Hex changes the drawing by at least 1 unit (U2.1, U2.2).
3. THE tests SHALL include a property that, for every Tamper_Copy made by changing any one byte of any ciphertext, `openLetter` returns `verification_failed`, and that the stored envelope is deep-equal before and after (A2.1, A2.4).
4. THE tests SHALL include a property that the Seal_Step state machine accepts each press event only in its source state, for any sequence of events, with at most two prompts (P5.7).
5. THE tests SHALL include a source scan that the Tamper_Control module imports `openLetter` from `src/lib/crypto` and contains no `verification_failed` literal used as a result, no `setTimeout` standing in for the check and no `fetch` (A2.3, A2.7).
6. THE tests SHALL include a test, using the real persona envelope hashes, that the three `/demo` persona seals meet U9.5 (N Coarse_Layer features and the pixel floor P) at 96 CSS px, and a layout check that the Break the seal seal meets U8.1 and that `/demo` draws its seals at 96 CSS px at both Evidence_Sizes.
7. THE tests SHALL include a source scan that the Press_Envelope code starts the passkey call only from the Release_Event handler and contains no `setTimeout` or timer callback that calls `createPasskey` (P5.2).
8. THE tests SHALL include a property that, for every Fingerprint_Hex, the Coarse_Layer has a notch count and ring count inside the recorded ranges, no overlapping notches, every part inside the wax outline, that changing any of hex positions 0 to 7 changes a coarse feature as U10.2 states, and that changing any of hex positions 0 to 7 leaves the Fine_Layer unchanged (U10.2, U10.3, U10.6, U10.7).
