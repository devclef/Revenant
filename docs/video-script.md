# Revenant: demo video shot list

<!-- provenance: git rev-parse origin/main -->

*The wax seal, resurrected. Memory rewrites itself. Revenant doesn't.*

This shot list follows the ritual in spec 15, "The flow", and the moments that spec 13, "The seal", changed on `main`. <!-- provenance: ls .kiro/specs --> Each section names the spec requirement or the tasks and merged pull requests that ship the moment.

Basis for every section: spec 15 defines the ritual and each section names its requirement. Sections that come from spec 13 are merged. No task in spec 13 was cut under the freeze order, so no section claims a cut requirement. The Live_Walk (issue #444) has not run yet, so no section relies on it. Recording takes place on 1 to 2 December 2026. <!-- provenance: gh issue view 444 --json state -q .state; grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; grep -n "1 to 2 December" .kiro/specs/13-the-seal/requirements.md -->

The ritual the video shows, in order: write the letter and answer each question as you write it, press the seal, wait, open the letter, testify before you read, break the seal, see the receipts.

Not in this list:

- Tasks 4, 17 and 18 are checks and test tooling. They have no shown moment. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md -->
- Task 13 changes the landing page only as part of the hero moment in section 1, so it has no section of its own. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md -->
- Parts of the persona reveal that neither spec changed, such as the persona letter text, have no section here.

## 1. Landing: the seal on the envelope and the ghost holding it

- **Tasks:** 8, 12, 13 (spec 13). Merged pull requests: #453, #463, #464. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 453 --json state -q .state; gh pr view 463 --json state -q .state; gh pr view 464 --json state -q .state -->
- **Route:** `/`
- **On screen:** The page opens dark. The headline and the orange call to action sit in the first view. An envelope with its wax seal is in the hero, and the sheet ghost sits behind it with its arms around the envelope. The seal shows no Fingerprint text.
- **Spoken:** "Memory rewrites itself. Revenant doesn't. A wax seal keeps what someone knew, and when."
- **Capture:** First view at 1440×900 and 390×844, and the same pair with reduced motion. <!-- provenance: grep -n "1440x900" tools/qa/layout-check.mjs; grep -n "390x844" tools/qa/layout-check.mjs -->

## 2. Landing: sections and ritual cards

- **Tasks:** 14 (spec 13). Merged pull request: #456. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 456 --json state -q .state -->
- **Route:** `/`, below the hero.
- **On screen:** The sections use both halves of the page at 1440×900. The four ritual cards sit with room inside each card. At 390×844 the sections stack, with no sideways scroll. <!-- provenance: grep -n "1440x900" tools/qa/layout-check.mjs; grep -n "390x844" tools/qa/layout-check.mjs; grep -n "ritualSteps" src/components/brand/copy.ts -->
- **Spoken:** "Write the letter. Press the seal. Wait. Testify. Break the seal. See the receipts."
- **Capture:** Each section at both sizes, with and without reduced motion.

## 3. Demo: each persona letter has its own seal

- **Tasks:** 3 (spec 13). Merged pull request: #446. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 446 --json state -q .state -->
- **Route:** `/demo`
- **On screen:** The three persona envelopes. Each seal is drawn at the same 96 px size and differs from the others. <!-- provenance: node -e 'console.log(require("./content/personas/personas.json").personas.length)'; grep -n 'width="96"' src/components/demo/PersonaCard.test.tsx -->
- **Spoken:** "Each seal is drawn from its letter's fingerprint. It shows that fingerprint. It does not verify the letter."
- **Capture:** `/demo` at 1440×900 and 390×844. <!-- provenance: grep -n "1440x900" tools/qa/layout-check.mjs; grep -n "390x844" tools/qa/layout-check.mjs -->

## 4. Write: one column, the occasion and the questions

- **Source:** Spec 15, requirements 7 and 8. <!-- provenance: grep -n "### Requirement 7" .kiro/specs/15-the-flow/requirements.md; grep -n "### Requirement 8" .kiro/specs/15-the-flow/requirements.md -->
- **Route:** `/demo/live`, Write step.
- **On screen:** One column of warm paper. The chosen occasion gives one default question, written in the author's own voice, with a field below it for the answer. The author answers the question while writing it. Up to three questions are allowed. Suggestions for another question sit below the list. Each question row has a Remove control, and removing a question removes its answer with it. "Add a receipt" appears once, beside Next, and the receipts stay closed until it is pressed.
- **Fold check:** When the author presses the seal with an unanswered question, the check names that question ("Question {n} has no answer yet. Answer it or remove it.") and moves focus to its answer field. The seal shows at 35% until the check would pass.
- **Spoken:** "Choose an occasion, or write without one. Answer each question as you write it. This is a rehearsal of a letter that would normally stay sealed for months."
- **Capture:** The Write step at both sizes, with a default question answered and with the fold check showing. <!-- provenance: grep -n "1440x900" tools/qa/layout-check.mjs; grep -n "390x844" tools/qa/layout-check.mjs; grep -n "DEFAULT_QUESTION" src/components/live/occasions.ts -->

## 5. Press the seal

- **Source:** Spec 15, requirement 9, and spec 13, tasks 1 and 2 (merged pull requests #445, #447). <!-- provenance: grep -n "### Requirement 9" .kiro/specs/15-the-flow/requirements.md; grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 445 --json state -q .state; gh pr view 447 --json state -q .state -->
- **Route:** `/demo/live`, Seal step.
- **On screen:** The warning text stays in view above the seal. The backup choice shows two radio buttons, neither selected, with "Skip it" and its explicit confirmation. The step shows two presses under the wax, "Make your passkey" and "Set the seal". The press envelope is the only orange control on the step. Hold it: the wax fills in stages, and the seal comes down. Release after a full hold to start the passkey prompt. A short press does nothing. Once the prompt is open, a second press adds nothing. <!-- provenance: grep -n "toHaveLength(2)" src/components/live/BackupChoice.test.tsx; grep -n "Make your passkey" src/components/live/press/copy.ts -->
- **Spoken:** "Press and hold the seal to make your passkey, then set the seal. If you skip the backup key, a lost passkey means a lost letter."
- **Capture:** The Seal step at both sizes, held, the Setting state, and the failure state. Each with and without reduced motion.

## 6. Wait: the sealed letter and the countdown

- **Source:** Spec 15, requirement 9, and spec 13, tasks 9 and 5 (hand-over) (merged pull requests #452, #449). <!-- provenance: grep -n "### Requirement 9" .kiro/specs/15-the-flow/requirements.md; grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 452 --json state -q .state; gh pr view 449 --json state -q .state -->
- **Route:** `/demo/live`, after the seal.
- **On screen:** The sealed envelope is the largest element. It carries the same seal it had on the Seal step. The countdown sits beside it. Below it, the Keep section holds the letter card with its QR code, the calendar button and the backup key card offer. The seal appears once, and DEMO appears once. The ghost sinks behind the envelope. When the countdown ends, the card offers one action, "Open your letter", and nothing else to unlock.
- **Spoken:** "The seal is intact. Nothing here has changed since it was sealed."
- **Capture:** The Wait step before and after the countdown ends, at both sizes, with and without reduced motion. <!-- provenance: grep -n "openLetter" src/components/live/copy.ts -->

## 7. Open the letter and testify: the ghost and the room

- **Source:** Spec 15, requirements 10 and 11, and spec 13, task 16 (merged pull request #458). <!-- provenance: grep -n "### Requirement 10" .kiro/specs/15-the-flow/requirements.md; grep -n "### Requirement 11" .kiro/specs/15-the-flow/requirements.md; gh pr view 458 --json state -q .state -->
- **Route:** `/demo/live`, after "Open your letter".
- **On screen:** The ghost rises out of the soil holding the envelope. The letter is offered only once the seal check has passed. Then the Testify step: for each author question, "On {date} you asked yourself:", the question exactly as written, and a field labelled "What you think you answered". The answer control and the verdict line "The seal is intact" sit below the Top_Bar. The ghost is drawn inside the first view and covers none of them. Figure questions follow the author questions, with their scale. Nothing sealed is shown on this step.
- **Spoken:** "Testify before you read. Say what you think you answered."
- **Capture:** The Testify step at both sizes, with and without reduced motion. <!-- provenance: grep -rn "What you think you answered" src/components; grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md -->

## 8. Persona Testify fits at 1440×900

- **Tasks:** 15 (spec 13). Merged pull request: #457. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 457 --json state -q .state; grep -n "1440x900" tools/qa/layout-check.mjs -->
- **Route:** `/demo/personas/us-maya`, Testify step.
- **On screen:** The persona page opens straight on the first question, with no intro screen. The step labels and the notice that Maya is fictional do not overlap, and the notice shows once. The first question, its answer control and the control to go on are inside the first view. Each fuel question shows a sample answer, labelled as a sample. Her recollection of each answer is labelled fictional, one question at a time.
- **Spoken:** "Maya is a fictional persona. Her letter is a demo, written as of its date. Each fuel question has a labelled sample answer. You can keep it or change it."
- **Capture:** Maya and Tomás at both sizes, with and without reduced motion.

## 9. Break the seal at full size

- **Source:** Spec 15, requirement 12.1, and spec 13, task 5 (merged pull request #449). <!-- provenance: grep -n "### Requirement 12" .kiro/specs/15-the-flow/requirements.md; gh pr view 449 --json state -q .state; grep -n "160 px" tools/qa/layout-check.mjs; grep -n "clamp(120px" src/components/ceremony/constants-css.test.ts -->
- **Route:** `/demo/personas/us-maya`, after Testify.
- **On screen:** The ghost is centred with the wax in front of it. The instruction and the button sit directly under it. The seal is at least 160 CSS px wide at 1440×900 and at least 120 CSS px at 390×844. The hold control and the Skip link sit in the first view, and the seal's relief is fully visible. The seal breaks under the reader's own press. The ghost hands over the letter and leaves, and the letter unfolds.
- **Spoken:** "Breaking the seal is your act. Her letter comes first, in full."
- **Capture:** Break the seal at both sizes, with and without reduced motion.

## 10. See the receipts

- **Source:** Spec 15, requirement 12.2 to 12.8. <!-- provenance: grep -n "### Requirement 12" .kiro/specs/15-the-flow/requirements.md; grep -n "Show the fingerprint" src/components/reveal/SealLine.tsx -->
- **Route:** `/demo/live` (after the Wait step's letter) and `/demo/personas/us-maya`, after the break.
- **On screen:** One scrolling column, in this order:
  1. Each author question as written, with the reader's testimony beside the sealed answer. Nothing comments on a difference or highlights one.
  2. The letter, in full, on warm paper.
  3. The figures, if the letter holds any: then, now and the reader's answer, each with its period and source. The change line, the formula and the percentage appear only when the two periods differ. When they match, the same-period line shows instead.
  4. The seal line: "The seal is intact. Nothing here has changed since it was sealed.", with a "Show the fingerprint" disclosure.
  5. The end card.
  A live letter with no figures ends on the testimony and the letter, then the seal line and the end card.
- **Spoken:** "Here is what you said you would remember, beside what you wrote. Then the letter, in full. Then the numbers, if your letter has any."
- **Capture:** The receipts at both sizes, for the live letter with figures and for Maya.

## 11. Try to tamper with it

- **Tasks:** 6 (spec 13). Merged pull request: #450. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 450 --json state -q .state; grep -n "one-byte" .kiro/specs/13-the-seal/tasks.md -->
- **Route:** `/demo/personas/us-maya`, receipts, in the seal line.
- **On screen:** The button "Try to tamper with it" sits in the seal line, beside the verdict and the "Show the fingerprint" disclosure. Pressing it shows a note that the test runs on a local copy in the browser and that the stored letter is not changed. The result shows "The seal is cracked. Revenant refuses to open this copy.", with the byte index and the value before and after. The stored fingerprint and the copy's fingerprint each show their seal. Closing the result returns to the real letter.
- **Spoken:** "Revenant changes one byte of a copy of this letter, in your browser, and tries to open it. The copy is refused. The letter you read is not changed."
- **Capture:** The receipts before the test, the result open, at both sizes, with and without reduced motion. <!-- provenance: grep -n "tamper" src/components/reveal/SealLine.tsx -->

## 12. Also fix the fingerprint

- **Tasks:** 7 (spec 13). Merged pull request: #451. <!-- provenance: grep -n "^- \[x\] " .kiro/specs/13-the-seal/tasks.md; gh pr view 451 --json state -q .state -->
- **Route:** `/demo/personas/us-maya`, receipts, after the cracked result.
- **On screen:** Under the cracked seal, the button "Also fix the fingerprint". Pressing it recomputes the copy's fingerprint and tries again. The result reads "Refused at the authentication tag check. The fingerprint matches, and the encrypted text does not."
- **Spoken:** "Revenant also recomputes the copy's fingerprint. The copy is still refused, at the check on the encrypted text."
- **Capture:** `tamper-fixed` at both sizes, with and without reduced motion.

<!-- provenance: grep -ciF over this file for the five Retired_Phrases in the commit c4c2a81 search (the G2.7 copy rules and the O5/L4 patches), case-insensitive -->
