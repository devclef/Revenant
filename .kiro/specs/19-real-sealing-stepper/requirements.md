# Requirements Document

Spec: 19 Real sealing stepper

## Introduction

Real sealing is on in production (`REAL_SEALING=on`). The backend, the crypto, the routes and the database for Real_Letters are finished. The gap is the page: `/demo/live` runs inside the Live_Stepper (a Step_Track, one step per screen, the Write desk and the Press the seal step), while `/seal` falls back to `renderState()`, one long form with the Seal_Panel styles. The home page no longer links to `/seal`: the link added in #245 was dropped in #280.

This spec gives `/seal` the same stepper as the first two steps of `/demo/live`, ends it on the existing sealed view as a third step named "Keep", removes the test-letter notice, and adds one quiet text link to `/seal` on the home page while real sealing is on.

Nothing about sealing changes. No route, crypto, sealed format, header, database table, migration, Helm value or environment variable is added, removed or changed. `/demo/live` behaves and renders exactly as it does today.

The owner has decided that real mode no longer shows `REAL_COPY.testNotice`. This replaces spec 11 L6.3's rule that `/seal` shows the notice above the Write step and on the sealed view. The open question in `product.md` ("whether real sealing is switched on for judging, with a visible test-letter notice") is answered: on, with no notice. The `product.md` edit is the owner's, since steering files are owner-only.

## Code facts this spec relies on

Read from the checkout at `3bee3055` on the day this spec was written. The first task that touches an area re-reads it and reports any difference in a commit message body.

| Topic | What exists |
|---|---|
| Step list | `src/components/live/stepper/live-steps.ts`: `LIVE_STEPS = write, seal, wait, testify, break, receipts`. `LIVE_STEP_NAMES` is built from `BRAND_COPY.ritualSteps`, `LIVE_COPY.waitStep`, `CEREMONY_COPY.steps[1]` and `LIVE_COPY.receiptsStep`. `stepIndex`, `stepName`, `canGoBack` (Back only before `wait` and before the seal), `reduceStepper` (`NEXT`, `BACK`, `DRAFT`, `SEALED`, `GOTO` forward only, `STAGE`) all read the one demo list. `initialStepperState(step, mode)` takes a `WriteMode` only to pick the draft. `StepperState` holds `step`, `draft`, `sealed` and `stage`, with no mode. |
| Step_Track | `step-track.ts`: `STEP_TRACK_COUNT = 6`, `stepTrackStates(current, stepCount)`. `StepTrack.tsx` already draws any number of steps from its `steps` prop. `LiveStepper.tsx` passes `LIVE_STEP_NAMES` and `stepIndex(state.step)`, and fills `LIVE_COPY.stepAnnounce` with `LIVE_STEPS.length` as `{total}`. |
| Seal_Page | `src/components/live/SealPage.tsx`: demo mode renders `<LiveStepper renderStep={renderDemoStep}>` inside `StageReportContext`. Real mode renders `renderState()`: `WriteForm` with no `section` (the `all` form), then `SealedView real`, `SealFailure` or `BackupFallback`. `SealedStep` calls `advanceTo("wait")` once the seal is stored. The page always renders `<p className={styles.backToDemo}><Link href="/demo">{LIVE_COPY.backToDemo}</Link></p>`. `sealApiFor(mode)` picks `realLetterSealApi` for real mode. The `realDate` prop (opening date, min date, UTC fallback) is passed to `WriteForm` in real mode only. |
| Write form | `WriteForm.tsx`: `section="write"` returns the `WriteDesk`. `section="seal"` renders `SealStep`. The `RealDatePicker` and `REAL_COPY.testNotice` render only when `section` is `all` (line 769 to 771). `REAL_COPY.intro` renders only under `shows("write")` in the non-desk body, so the desk path never shows it. `mode` is `real` when `realDate` is set; it picks the sealing day (local day for demo, UTC day for real) and the panel class. |
| Seal step | `seal-step/SealStep.tsx` with `BackupChoice` (its skip option carries `LIVE_COPY.backupChoiceSkipHelp`, "Fine for a 30-second rehearsal.") and `SealLinks` (the cross-device line and "← Back to your letter"). |
| Sealed view | `SealedView.tsx` with `real`: one h1 `REAL_COPY.stillSealed`, the opening time, the countdown (`LIVE_COPY.countdown`, in seconds), the keepsakes and the backup key card. It renders `<DemoLabel />` in both modes. |
| Real copy | `REAL_COPY` in `src/components/live/copy.ts`, with `testNotice` at line 324. No test file names `testNotice`. |
| `/seal` page | `src/app/seal/page.tsx`: branded not-found while `realSealingOn()` is false; otherwise `SceneShell variant="plain" demo={false}` (no `backdrop`, no `sound`) around `SealPage mode="real"`, or `Unavailable` when `RP_ID` is empty. `/demo/live` uses `SceneShell variant="plain" demo backdrop sound`. |
| Feature flag | `src/lib/feature-flags.ts` (`server-only`): `realSealingOn()` is true only when `REAL_SEALING` trims to exactly `on`. |
| Landing | `src/app/page.tsx` (server, `force-dynamic`) passes `personaCount` and `demo2On` to `LandingHero`. `LandingHero.tsx` renders at most two `data-cta` links in `data-block="actions"`: primary to `/demo`, secondary to `/demo/live`. `LANDING_COPY` in `landing/copy.ts`; `copy-tone.test.ts` runs `toneProblems` over every string. Spec 11 L6.3: the landing hero stays at two calls to action. |

## Glossary

- **Seal_Page**: the client component `SealPage` in `src/components/live/SealPage.tsx`, used by `/demo/live` and `/seal`.
- **Demo_Mode**: the Seal_Page with `mode="demo"`, as rendered at `/demo/live`.
- **Real_Mode**: the Seal_Page with `mode="real"`, as rendered at `/seal`.
- **Real_Seal_Page**: the route `/seal` while `realSealingOn()` is true and `RP_ID` is not empty.
- **Live_Demo_Page**: the route `/demo/live`.
- **Live_Stepper**: the component `LiveStepper` in `src/components/live/stepper/LiveStepper.tsx`.
- **Stepper_Module**: the pure module `src/components/live/stepper/live-steps.ts`.
- **Demo_Step_List**: the six steps `write`, `seal`, `wait`, `testify`, `break`, `receipts`, in that order, with the visible names shown today.
- **Real_Step_List**: the three steps `write`, `seal`, `sealed`, in that order, with the visible names "Write", "Press the seal" and "Keep".
- **Stage**: the value a `STAGE` action reports and `StepperState.stage` stores (the reveal Ceremony stage on the later demo steps).
- **Step_List**: the Demo_Step_List in Demo_Mode and the Real_Step_List in Real_Mode.
- **Step_Track**: the component `StepTrack`, one dot per step of the Step_List.
- **Write_Step**: the `write` step, drawn by `WriteForm` with `section="write"` (the Write desk).
- **Seal_Step**: the `seal` step, drawn by `WriteForm` with `section="seal"` (the `SealStep` component).
- **Keep_Step**: the `sealed` step of the Real_Step_List, drawn by `SealedView` with `real` set.
- **Wait_Step**: the `wait` step of the Demo_Step_List, drawn by `LiveWaitStep`.
- **Fold_Button**: the `FoldButton` in `src/components/live/desk/FoldButton.tsx`, the Write desk button that folds the letter and moves on to the Seal_Step. On the Live_Demo_Page the `EnvelopePanel` renders `LIVE_COPY.rehearsalLine` under it, only while the Seal_Page's `rehearsal` prop is set.
- **Date_Picker**: the component `RealDatePicker` fed by the Seal_Page's `realDate` prop.
- **Seal_State**: the tag of the seal flow state from `useSealFlow` (`write`, `creating`, `created`, `confirming`, `preparing`, `sealing`, `sealed`, `cannot_lock`, `cancelled`, `failed`, `fallback_key`).
- **Failure_Screen**: the `SealFailure` or `BackupFallback` view shown for the Seal_States `cannot_lock`, `cancelled`, `failed` and `fallback_key`.
- **Back_To_Demo_Link**: the page-level link with the text `LIVE_COPY.backToDemo` to `/demo` at the top of the Seal_Page.
- **Rehearsal_Line**: `LIVE_COPY.rehearsalLine` and any other copy that names the 30-second lock, including `LIVE_COPY.backupChoiceSkipHelp`.
- **Test_Notice**: the string `REAL_COPY.testNotice`.
- **Demo_Text_Source**: a string or element in a component shared by both modes that shows "Demo" or names the live demo, and that commit `3bee3055` renders in Real_Mode. The known ones are listed in Requirement 4.13.
- **Real_Routes**: the routes `realLetterSealApi` posts to, as selected by `sealApiFor("real")`.
- **Demo_Routes**: the routes `realSealApi` posts to, as selected by `sealApiFor("demo")`.
- **Landing_Page**: the server page `src/app/page.tsx` at `/`.
- **Landing_Hero**: the component `LandingHero` in `src/components/landing/LandingHero.tsx`.
- **Demo_2_On**: the `demo2On` prop of the Landing_Hero, true while the live demo is offered from the home page.
- **Accent_Class**: the `accent` class in `src/components/landing/landing.module.css`, the orange fill of the one primary call to action.
- **Real_Seal_Link**: a text link with the text `LANDING_COPY.realSealLink` ("Seal a real letter") to `/seal`.
- **Tone_Check**: `toneProblems` from `@/components/copy-tone`, as run by `landing/copy-tone.test.ts` and the live copy tests.
- **QA_Shots**: screenshots taken by the QA run of this spec, at 1440×900 and 390×844.

## Requirements

### Requirement 1: A step list per mode

**User Story:** As the author of a real letter, I want a three-step track that ends when my letter is sealed, so that I am never shown steps that only happen months later.

#### Acceptance Criteria

1. THE Stepper_Module SHALL define the Real_Step_List as exactly three steps, `write`, `seal`, `sealed`, at positions 0, 1 and 2, with the visible names `BRAND_COPY.ritualSteps[0].name` ("Write"), `BRAND_COPY.ritualSteps[1].name` ("Press the seal") and `REAL_COPY.keepStep` ("Keep"), each taken from those constants and not written out as literals.
2. THE Stepper_Module SHALL keep `LIVE_STEPS` equal to the Demo_Step_List `write`, `seal`, `wait`, `testify`, `break`, `receipts`, and `LIVE_STEP_NAMES` equal to its six current names in the same order and from the same constants, and SHALL NOT add `sealed` to either.
3. THE `StepperState` SHALL record the mode (`demo` or `real`) it was created for. `initialStepperState(step, mode)` SHALL set that mode from its `mode` argument, default to `demo` when `mode` is omitted, default to `write` when `step` is omitted, and SHALL NOT change the mode in any later action.
4. WHEN the Stepper_Module computes a step's position, a step's visible name, the step count (3 in Real_Mode, 6 in Demo_Mode), whether Back is offered, or the next step, THE Stepper_Module SHALL read only the Step_List of the state's mode.
5. WHILE the state's mode is `real`, THE Stepper_Module SHALL offer Back only when the step is `seal` and `sealed` is false. A `BACK` action in that case SHALL move the step to `write` and keep the draft unchanged. A `BACK` action in every other Real_Mode case SHALL return the same state object.
6. WHILE the state's mode is `real`, WHEN a `NEXT` action arrives, THE Stepper_Module SHALL move `write` to `seal`, SHALL move `seal` to `sealed` only if `sealed` is true, and SHALL return the same state object on `seal` while `sealed` is false and on `sealed`.
7. IF a `GOTO` action in Real_Mode names a step that is not in the Real_Step_List, or a step at or before the current position, or the `sealed` step while `sealed` is false, THEN THE Stepper_Module SHALL return the same state object.
8. IF a `STAGE` action arrives while the state's mode is `real`, THEN THE Stepper_Module SHALL leave the step unchanged, SHALL store the reported Stage, and SHALL return the same state object when the stored Stage already equals the reported Stage.
9. THE Stepper_Module SHALL produce, for every sequence of `NEXT`, `BACK`, `DRAFT`, `SEALED`, `GOTO` and `STAGE` actions applied to a Demo_Mode state, the same states it produces today. A property test passes this criterion when it runs at least 100 random sequences of 0 to 40 actions, starting from `initialStepperState(step, "demo")` for every step in the Demo_Step_List, alongside the reducer of commit `3bee3055` (kept as a test oracle). After every action the `step`, `draft`, `sealed` and `stage` fields SHALL be deeply equal to the oracle's. Whenever the oracle returns its input state object, the Stepper_Module SHALL also return its input state object.
10. IF `initialStepperState` is called with mode `real` and a step that is not in the Real_Step_List, THEN THE Stepper_Module SHALL create the state on the `write` step.
11. FOR ALL action sequences applied to a Real_Mode state, THE Stepper_Module SHALL keep the step inside the Real_Step_List. The step SHALL be `sealed` only while `sealed` is true, and the step position SHALL never decrease once `sealed` is true (invariant). A property test passes this criterion when it runs at least 100 random sequences of 0 to 40 actions from `initialStepperState(step, "real")` for each Real_Step_List step and finds no violation after any action.

### Requirement 2: The Step_Track and announcement follow the Step_List

**User Story:** As the author of a real letter, I want the progress track to show my three steps, so that I can see where I am and how much is left.

#### Acceptance Criteria

1. WHILE the Seal_Page is in Real_Mode, THE Step_Track SHALL draw exactly three dots, labelled "Write", "Press the seal" and "Keep" in that order, and SHALL draw no dot labelled with any other Demo_Step_List name (including "Wait", "Break the seal" and "Receipts").
2. WHILE the Seal_Page is in Real_Mode, THE Step_Track SHALL mark exactly one dot, the current step, with `data-state="current"` and `aria-current="step"`, SHALL mark every dot before it `data-state="done"` and every dot after it `data-state="todo"`, and SHALL set no `aria-current` attribute on the done and todo dots.
3. WHILE the Seal_Page is in Real_Mode, THE Live_Stepper SHALL fill `LIVE_COPY.stepAnnounce` and `LIVE_COPY.stepTrackPhone` with `{total}` set to 3, `{n}` set to the current step's position counted from 1 (1 for "Write", 2 for "Press the seal", 3 for "Keep"), and `{label}` set to the current step's name from criterion 1.
4. WHEN the current step changes in either Real_Mode or Demo_Mode, THE Live_Stepper SHALL replace the text of its single polite live region with the newly filled `LIVE_COPY.stepAnnounce` line once, and SHALL leave the line unchanged while the current step stays the same.
5. WHILE the Seal_Page is in Demo_Mode, THE Step_Track SHALL draw the six dots of the Demo_Step_List with the same names and in the same order as before this spec, and THE Live_Stepper SHALL fill `{total}` with 6 and `{n}` with the current step's position from 1 to 6.
6. THE `stepTrackStates(current, stepCount)` function SHALL return an array of exactly `stepCount` entries with exactly one `current` entry at position `current`, every earlier entry `done` and every later entry `todo`, for every `stepCount` from 1 to 6 and every `current` from 0 to `stepCount - 1` (invariant).
7. THE Step_Track SHALL compute its dot states with `stepTrackStates(current, stepCount)`, where `stepCount` is the length of the Step_List for the active mode: 3 in Real_Mode and 6 in Demo_Mode.

### Requirement 3: `/seal` runs inside the Live_Stepper

**User Story:** As the author of a real letter, I want `/seal` to look and flow like the first two steps of the live demo, so that sealing a real letter feels as finished as the demo.

#### Acceptance Criteria

1. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render its content through the Live_Stepper, starting from a state created by `initialStepperState("write", "real")` and using the same step renderer as Demo_Mode, and SHALL not render the `renderState()` single form on any step or in any Seal_State.
2. WHILE the Seal_Page is in Real_Mode and the step is `write`, THE Seal_Page SHALL show the Write_Step (the Write desk) with the same parts, in the same order and with the same class names that Demo_Mode shows on its Write_Step. The only differences allowed are the ones listed in Requirement 4.
3. WHILE the Seal_Page is in Real_Mode and the step is `seal` and the Seal_State is one of `write`, `creating`, `created`, `confirming`, `preparing` or `sealing`, THE Seal_Page SHALL show the Seal_Step with `REAL_COPY.intro` exactly once, then the Date_Picker, then the Seal_Step's backup choice, then its press, in that document order.
4. WHILE the Seal_Page is in Real_Mode, THE Date_Picker on the Seal_Step SHALL keep the rules of commit `3bee3055`. The minimum selectable date is the value of `earliestOpeningDate`. The UTC fallback line shows when the browser's time zone cannot be read. The `REAL_COPY.dateMissing` message shows only after the field has been touched or a seal has been attempted with no date. The chosen date stays the same after Back to the Write_Step and forward again, and after Try again on a Failure_Screen.
5. IF the Seal_Page is in Real_Mode and the Date_Picker holds no date, THEN THE Seal_Step SHALL render its press with the `disabled` attribute set, and activating it SHALL send no request to the Real_Routes or the Demo_Routes.
6. WHEN the seal is stored in Real_Mode (the Seal_State becomes `sealed`), THE Seal_Page SHALL move the Live_Stepper from `seal` to `sealed` and show the Keep_Step. The Keep_Step is `SealedView` with `real` set: the opening time, the countdown, the keepsakes and, only when the letter has a backup wrap, the backup key card. They SHALL render as `SealedView real` renders them at commit `3bee3055`, except that the Demo labels are removed (Requirement 4.6).
7. IF the Seal_Page is in Real_Mode and the Seal_State is `cannot_lock`, `cancelled`, `failed` or `fallback_key`, THEN THE Seal_Page SHALL show the Failure_Screen for that Seal_State in place of the step content. The Step_Track SHALL keep "Press the seal" as the current step. Try again SHALL return to the Seal_Step with the letter text, questions, answers, figures, self-reported rows, backup choice and opening date unchanged. The backup-key fallback and the decline path SHALL behave as they do at commit `3bee3055`, apart from the copy changes in Requirement 4.13.
8. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render exactly one `h1` element on each step and on each Failure_Screen. On `write` it is the Write desk's heading. On `seal` it is the Seal_Step heading that Demo_Mode renders on its `seal` step. On `sealed` it is `REAL_COPY.stillSealed`.
9. WHEN the Live_Stepper moves to a new step in Real_Mode, THE Live_Stepper SHALL move keyboard focus to that step's `[data-step-heading]` element, using the same rule and timing as Demo_Mode. If the step has no `[data-step-heading]` element, focus SHALL not move.
10. WHEN the author presses Back on the Seal_Step in Real_Mode while the Seal_State is `write` (no passkey prompt has started), THE Seal_Page SHALL return to the Write_Step with the letter text, questions, answers, figures, self-reported rows, backup choice and opening date unchanged.
11. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL send every seal request through `sealApiFor("real")`, including requests sent after Try again and through the backup-key fallback. Every seal request SHALL go to the Real_Routes, and no request SHALL go to the Demo_Routes.
12. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL keep the real sealing rules of commit `3bee3055`: the self-reported period check uses the UTC sealing day, a question can't be sealed without an answer, and the passkey user name is `REAL_COPY.passkeyUserName`.
13. WHILE the Real_Seal_Page is shown, THE `/seal` page SHALL render the Seal_Page inside a `SceneShell` with `variant="plain"`, `demo={false}` and `backdrop` set, which gives the light and Soil backdrop that the Live_Demo_Page uses. The page SHALL render no Demo chip and no sound control.
14. IF the Seal_Page is in Real_Mode and the Seal_State is `creating`, `created`, `confirming`, `preparing` or `sealing`, THEN THE Seal_Page SHALL handle Back on the Seal_Step exactly as Demo_Mode does in the same Seal_State. The Seal_Page SHALL send no second seal request for the same draft because Back was used.
15. IF `realSealingOn()` is false, or `RP_ID` is empty, THEN THE `/seal` page SHALL render what it renders at commit `3bee3055` (the branded not-found page, or `Unavailable` when `RP_ID` is empty), and SHALL render no Live_Stepper.

### Requirement 4: Real mode carries no demo or rehearsal copy

**User Story:** As the author of a real letter, I want no line that calls my letter a demo or a rehearsal, so that I trust it will stay sealed for months.

#### Acceptance Criteria

1. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render zero Back_To_Demo_Link elements on every step of the Real_Step_List and on every Failure_Screen.
2. WHILE the Seal_Page is in Demo_Mode, THE Seal_Page SHALL render exactly one Back_To_Demo_Link, with the text `LIVE_COPY.backToDemo` and the target `/demo`, at the top of the Seal_Page on every step of the Demo_Step_List.
3. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render zero occurrences of `LIVE_COPY.rehearsalLine` on the Write_Step (including under the Fold_Button), the Seal_Step and the Keep_Step, and zero occurrences of `LIVE_COPY.backupChoiceSkipHelp` under the skip option of the backup choice.
4. WHILE the Seal_Page is in Real_Mode, THE backup choice skip option SHALL render its label `LIVE_COPY.backupChoiceSkip` ("Skip it. A lost passkey means a lost letter.") exactly once, with no help line between that label and the next control of the backup choice.
5. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render zero `<DemoLabel />` elements on the Write_Step, the Seal_Step, the Keep_Step and every Failure_Screen.
6. WHILE `SealedView` renders with `real` set, THE `SealedView` SHALL render zero `<DemoLabel />` elements, counting those inside its `LetterCard` and `BackupKeyCard`.
7. WHILE `SealedView` renders without `real`, THE `SealedView` SHALL render the same `<DemoLabel />` elements, in the same positions, as at commit `3bee3055`, including those inside its `LetterCard` and `BackupKeyCard`.
8. THE `REAL_COPY` object in `src/components/live/copy.ts` SHALL have no `testNotice` key.
9. THE source files under `src/`, test files excluded, SHALL contain zero occurrences of the Test_Notice text "This is a test site. A letter sealed here can only be opened here, or with its backup key." A test passes this criterion when it searches those files for that exact text and finds no match.
10. THE `REAL_COPY.keepStep` string SHALL equal "Keep", and the Tone_Check SHALL return an empty list of problems for it.
11. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL render no visible text that contains the word "demo", the word "rehearsal", or the number 30 directly followed by " seconds" or "-second" where the 30 is not preceded by a digit (all case-insensitive), on any step of the Real_Step_List or on any Failure_Screen, for every Seal_State from `write` to `sealed` and for `cannot_lock`, `cancelled`, `failed` and `fallback_key`.
12. WHILE the Seal_Page is in Demo_Mode with `rehearsal` set, as the Live_Demo_Page renders it, THE Seal_Page SHALL render `LIVE_COPY.rehearsalLine` exactly once on the Write_Step (under the Fold_Button) and exactly once on the Wait_Step while its countdown shows, and SHALL render `LIVE_COPY.backupChoiceSkipHelp` exactly once under the skip option of the backup choice on the Seal_Step.
13. WHILE the Seal_Page is in Real_Mode, THE Seal_Page SHALL omit, or replace with a `REAL_COPY` string that passes the Tone_Check, each Demo_Text_Source that commit `3bee3055` reaches in Real_Mode: `LIVE_COPY.figuresNoneLink` in the Write desk's figure rows, the `<DemoLabel />` of `LetterCard` and `BackupKeyCard` on the Keep_Step, the `LIVE_COPY.backToDemo` link in `SealFailure`, `LIVE_COPY.passkeyDeleteNote`, `LIVE_COPY.clockBody`, `LIVE_COPY.busyBody`, and the `<DemoLabel />` of `BackupFallback`.

### Requirement 5: `/demo/live` is unchanged

**User Story:** As a judge, I want the live demo to work exactly as before, so that this change costs the demo nothing.

#### Acceptance Criteria

1. WHILE the Seal_Page is in Demo_Mode, THE Seal_Page SHALL render the same markup it renders at commit `3bee3055` for every step of the Demo_Step_List, and on the `seal` step for every Seal_State it can reach at that commit. A test passes this criterion when it meets all of the following: it renders each step and each Seal_State pair with `renderToStaticMarkup`; it uses one fixed draft (the same letter text, questions, answers and figures) and one fixed clock for both renders; it compares the output byte for byte with markup recorded from commit `3bee3055` using the same draft and clock; and it finds zero differences.
2. WHILE the Seal_Page is in Demo_Mode, THE Seal_Page SHALL show the Back_To_Demo_Link, the Rehearsal_Line and the 30-second lock exactly as at commit `3bee3055`, and SHALL render no Test_Notice and no Date_Picker on any step or in any Seal_State.
3. WHEN the author presses the seal in Demo_Mode, THE Seal_Page SHALL send every request of the seal flow through `sealApiFor("demo")` to the Demo_Routes, in the same order and with the same request bodies as at commit `3bee3055`, and SHALL send no request to the Real_Routes.
4. IF the seal fails in Demo_Mode (the Seal_States `cannot_lock`, `cancelled`, `failed` or `fallback_key`), THEN THE Seal_Page SHALL show the same Failure_Screen as at commit `3bee3055`, with Try again, the backup-key fallback and the decline path sending their requests only to the Demo_Routes.
5. WHEN the Live_Stepper moves between steps in Demo_Mode, through Next, Back or a stored seal, THE Live_Stepper SHALL reach the same next step, show the same Back control, and move focus to the same `[data-step-heading]` element as at commit `3bee3055`.
6. THE Live_Demo_Page SHALL pass `SceneShell` the same props it passes at commit `3bee3055` (`variant="plain"`, `demo`, `backdrop`, `sound`) with the same values, SHALL pass its `rehearsal` prop with the same value, and SHALL pass the Seal_Page no prop that is absent at that commit.
7. WHEN `npx vitest run src/components/live` runs on the change, THE existing tests under `src/components/live` and `src/components/live/stepper` that cover Demo_Mode SHALL pass with their Demo_Mode assertions unchanged. A test may be changed only where it asserted the Real_Mode single form, the Test_Notice in Real_Mode, or the Back_To_Demo_Link in Real_Mode, and the commit body SHALL name each changed test by file and test title.

### Requirement 6: The home page links to `/seal`

**User Story:** As a visitor, I want a quiet way to seal a real letter from the home page, so that I can find real sealing without it competing with the demo.

#### Acceptance Criteria

1. WHEN the Landing_Page handles a request, THE Landing_Page SHALL call `realSealingOn()` from `@/lib/feature-flags` during that request, not at build time, and pass the returned boolean to the Landing_Hero as `realSealing`. A change to `REAL_SEALING` therefore shows up on the next request without a rebuild.
2. WHILE `realSealing` is true, THE Landing_Hero SHALL render exactly one Real_Seal_Link. The link is an anchor with `href="/seal"` and the text `LANDING_COPY.realSealLink`, and it sits in document order after the calls to action block (`data-block="actions"`) and before the hero envelope (`data-block="seal"`). This holds for every combination of persona count (0, 1 or 2 or more) and the Demo_2_On setting.
3. WHILE `realSealing` is false, THE Landing_Hero SHALL render no element with `href="/seal"` and no `LANDING_COPY.realSealLink` text, and the rest of its markup SHALL be the same as the markup it renders without the `realSealing` prop.
4. THE Landing_Hero SHALL render no more than two elements with a `data-cta` attribute, and no more than one element with the Accent_Class, for every value of `realSealing`, persona count and Demo_2_On (spec 11 L6.3).
5. THE Real_Seal_Link SHALL carry no `data-cta` attribute and none of the `cta`, `accent` or `outlined` button classes.
6. THE Real_Seal_Link SHALL appear as a text link on the dark hero, with no fill, border or orange (accent) text colour. Its text SHALL have a contrast ratio of at least 4.5:1 against the hero background, and its tap target SHALL be at least 44 × 44 CSS px.
7. WHEN the Real_Seal_Link receives keyboard focus, THE Real_Seal_Link SHALL show a focus outline at least 3 CSS px wide in the shared focus ring colour, offset from the text, matching the existing `.cta:focus-visible` treatment.
8. THE `LANDING_COPY` object SHALL hold `realSealLink` with the exact value "Seal a real letter". That string SHALL pass the Tone_Check run by `landing/copy-tone.test.ts`, which means no exclamation mark and none of the words that check forbids.
9. THE Landing_Page SHALL stay a server component. Rendering the Real_Seal_Link SHALL add no `"use client"` module, no client-side script and no extra network request, and no client bundle module SHALL import `@/lib/feature-flags`.

### Requirement 7: Boundaries

**User Story:** As the owner, I want this change confined to the page layer, so that sealed letters, routes and the deployment stay exactly as they are.

#### Acceptance Criteria

1. THE change SHALL add, remove, rename or modify no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/`, `drizzle/` or `deploy/helm/`. A check passes this criterion when a diff of those paths against commit `3bee3055` lists zero changed, added, deleted or renamed files.
2. THE change SHALL add, remove or rename no environment variable read by application code, and SHALL leave `.env.example` byte-for-byte identical to its content at commit `3bee3055`.
3. THE change SHALL leave the sealed payload, the envelope header and the envelope hash produced for a given draft identical to those produced at commit `3bee3055`. A test passes this criterion when it seals the same draft with the same fixed clock, injected authenticator port and fixed random source through the Real_Mode stepper and through the `renderState()` path of `3bee3055`, and finds the decrypted payload, the header and the hash equal in both runs.
4. WHEN the Seal_Page in Real_Mode seals a draft, THE Seal_Page SHALL send, through `realLetterSealApi`, the same number of requests, in the same order, to the same paths with the same methods and byte-for-byte equal request bodies as the `renderState()` path of `3bee3055` sends for the same draft, fixed clock, injected authenticator port and fixed random source. The same holds for `realSealApi` in Demo_Mode.
5. THE change SHALL add, remove or change the version of no entry in `dependencies` or `devDependencies` in `package.json`, and SHALL leave `package-lock.json` byte-for-byte identical to its content at commit `3bee3055`.
6. THE Seal_Page module SHALL contain no static value import of `@/lib/crypto`, `@/lib/letter-store` or `@/lib/feature-flags`. This covers any subpath of those modules, any relative path that resolves into them, and any `export … from` re-export of them. A dynamic `import()` expression does not count as a static import, and neither does an `import type` declaration, because the compiler erases it.

### Requirement 8: Tests and evidence

**User Story:** As the reviewer, I want tests and screenshots for each new behaviour, so that I can check real sealing against the demo without sealing a letter myself.

#### Acceptance Criteria

1. THE `live-steps` tests SHALL assert that the Real_Step_List is `write`, `seal`, `sealed` in that order with the names "Write", "Press the seal" and "Keep". They SHALL assert that `stepIndex` returns 0, 1 and 2 for those steps in Real_Mode, and that `stepName` returns the matching name in Real_Mode. They SHALL assert that `canGoBack` in Real_Mode is true only for the `seal` step while `sealed` is false. They SHALL also give at least one passing example for each of Requirements 1.5, 1.6, 1.7, 1.8 and 1.10.
2. THE `live-steps` tests SHALL check Requirement 1.11 with a property test that runs at least 100 random sequences of 0 to 40 `NEXT`, `BACK`, `DRAFT`, `SEALED`, `GOTO` and `STAGE` actions from `initialStepperState(step, "real")` for each Real_Step_List step. The test SHALL fail if any state's step falls outside the Real_Step_List, if the step is `sealed` while `sealed` is false, or if the step position decreases after `sealed` becomes true.
3. THE `LiveStepper` and `StepTrack` tests SHALL show that in Real_Mode the Step_Track has exactly three dots labelled "Write", "Press the seal" and "Keep", in that order. On each of the three steps, the tests SHALL show exactly one dot with `data-state="current"` and `aria-current="step"`, and that `LIVE_COPY.stepAnnounce` and `LIVE_COPY.stepTrackPhone` read "Step {n} of 3", with `{n}` set to 1, 2 and 3 in turn.
4. THE `SealPage` tests SHALL show the following in Real_Mode: the Live_Stepper renders. No Back_To_Demo_Link, Rehearsal_Line (including `LIVE_COPY.backupChoiceSkipHelp`), Test_Notice text or Demo label appears on the Write_Step, the Seal_Step or the Keep_Step. The Date_Picker appears on the Seal_Step and not on the Write_Step. The press stays disabled while the Date_Picker holds no date. Back from the Seal_Step returns to the Write_Step with the draft and the opening date unchanged. After a stored seal, the page ends on the Keep_Step with `REAL_COPY.stillSealed` as its only `h1`.
5. THE `SealPage` tests SHALL record every request the seal flow sends in Real_Mode, from page load to the Keep_Step, using a stubbed network layer. The tests SHALL show that at least one request reached the Real_Routes and none reached the Demo_Routes. For each of the Seal_States `cannot_lock`, `cancelled`, `failed` and `fallback_key`, the tests SHALL show that the matching Failure_Screen replaces the step content and carries none of the text that Requirement 4.11 forbids.
6. THE `LandingHero` and `src/app/page.test.tsx` tests SHALL show two cases. With `realSealing` true, exactly one Real_Seal_Link to `/seal` renders between `data-block="actions"` and `data-block="seal"`, and it has no `data-cta` attribute. With `realSealing` false, no link to `/seal` and no `LANDING_COPY.realSealLink` text render. In both cases the hero SHALL have at most two `data-cta` links.
7. WHEN `npx vitest run src/components/live src/components/landing src/app` runs on the head commit of the change, THE test run SHALL exit with code 0, with no test marked `.skip`, `.only` or `.todo` added by the change.
8. WHEN `scripts/check.sh` runs on the head commit of the change, THE check SHALL exit with code 0.
9. THE QA run SHALL take 12 QA_Shots from the head commit of the change, at 1440×900 and 390×844 for each state. Eight come from `/seal`, served locally with `REAL_SEALING=on` and a non-empty `RP_ID`: the Write_Step, the Seal_Step with no date chosen, the Seal_Step with a date chosen, and the Keep_Step after a seal stored locally. Four come from `/demo/live`: the Write_Step and the Seal_Step.
10. THE PR description SHALL show each `/seal` Write_Step and Seal_Step shot next to the `/demo/live` shot of the same step and size, and the Keep_Step shots on their own. Under each pair it SHALL list every visible difference other than those allowed by Requirement 4, or say that there is none.

## Decisions this spec makes beyond the request

The owner may strike any of these before design starts.

- **Third step name "Keep".** The request names the step `sealed` but gives no visible name. "Keep" is step 4 of the core loop in `product.md` and is plain product vocabulary. It is a new string, `REAL_COPY.keepStep`.
- **`REAL_COPY.intro` moves to the Seal_Step.** Today it shows only in the single form. On the stepper path the Write desk never shows it, so it is placed above the Date_Picker, where it explains the opening date (Requirement 3.3).
- **No 30-second help line in Real_Mode.** `LIVE_COPY.backupChoiceSkipHelp` ("Fine for a 30-second rehearsal.") would otherwise appear on the real Seal_Step. Real_Mode shows the skip label with no help line (Requirement 4.3, 4.4).
- **No Demo label on the real sealed view.** `SealedView` renders `<DemoLabel />` in both modes today. A Real_Letter must not be labelled a demo (`data-integrity.md`, "Demo mode"), so it is hidden when `real` is set (Requirement 4.6).
- **`/seal` gets the plain backdrop.** Without `backdrop` the page has no light or Soil, and the request asks that `/seal` look like `/demo/live`. Sound stays off: it belongs to the reveal (Requirement 3.13).

## Open questions for the owner

These are observed in today's real-mode code and are not changed by this spec.

- **Countdown in seconds.** `SealedView real` fills `LIVE_COPY.countdown` ("Time remaining: {seconds} seconds."). For a letter that opens in three months this reads as about 7,900,000 seconds. A days-based line would need a new string and a change to `SealedView`.
- **Failure screens in Real_Mode.** `SealFailure` links to `/demo` with `LIVE_COPY.backToDemo`, and `BackupFallback` renders `<DemoLabel />`, in both modes. Requirements 4.5, 4.11 and 4.13 now remove these, and the other Demo_Text_Sources, in Real_Mode only. The owner may narrow 4.13 to the steps and keep the failure screens as they are; replacement wording, where a line is replaced rather than omitted, is new `REAL_COPY` text for the owner to review.
- **Letter link hidden until opening.** `SealedView real` shows the letter link only after the countdown ends (spec 08 R24.10). The author keeps the letter card and `.ics` file, which carry the link.
- **`product.md` open question.** The line about a visible test-letter notice is now answered; the owner updates `product.md` and, if wanted, spec 11 L6.3.
