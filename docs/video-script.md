# Revenant: demo video shot list

*The wax seal, resurrected. Memory rewrites itself. Revenant doesn't.*

This shot list covers the moments that spec 13, "The seal", changed on `main`. Each section names the tasks and the merged pull requests that ship the moment.

Basis for every section: the pull request is merged. No task in spec 13 was cut under the freeze order, so no section claims a cut requirement. The Live_Walk (issue #444) has not run yet, so no section relies on it. Recording takes place on 1 to 2 December 2026.

Not in this list:

- Tasks 4, 17 and 18 are checks and test tooling. They have no shown moment.
- Task 13 changes the landing page only as part of the hero moment in section 1, so it has no section of its own.
- Parts of the persona reveal that spec 13 did not change, such as the letter text and the figures then and now, have no section here.

## 1. Landing: the seal on the envelope and the ghost holding it

- **Tasks:** 8, 12, 13. PRs #453, #463, #464.
- **Route:** `/`
- **On screen:** The page opens dark. The headline and the one orange call to action sit in the first view. An envelope with its wax seal is in the hero, and the sheet ghost sits behind it with its arms around the envelope. The seal shows no Fingerprint text. Only one ghost is drawn on the page.
- **Spoken:** "Memory rewrites itself. Revenant doesn't. A wax seal keeps what someone knew, and when."
- **Capture:** First view at 1440×900 and 390×844, and the same pair with reduced motion.

## 2. Landing: sections and ritual cards

- **Tasks:** 14. PR #456.
- **Route:** `/`, below the hero.
- **On screen:** The sections use both halves of the page at 1440×900. The four ritual cards sit with room inside each card. At 390×844 the sections stack, with no sideways scroll.
- **Spoken:** "Write the letter. Press the seal. Wait. Testify. Break the seal. See the receipts."
- **Capture:** Each section at both sizes, with and without reduced motion.

## 3. Demo: each persona letter has its own seal

- **Tasks:** 3. PR #446.
- **Route:** `/demo`
- **On screen:** The three persona envelopes. Each seal is drawn at the same 96 px size and differs from the others.
- **Spoken:** "Each seal is drawn from its letter's fingerprint. It shows that fingerprint. It does not verify the letter."
- **Capture:** `/demo` at 1440×900 and 390×844.

## 4. Write step: one column, occasions and question rows

- **Tasks:** 10, 11. PRs #454, #455.
- **Route:** `/demo/live`, Write step.
- **On screen:** One column of warm paper. The letter field sits at the top, with a placeholder line that follows the chosen occasion and disappears once typing starts. The occasions are one row of text options, with the chosen one underlined. Each question is a row with a Remove control. "Add a receipt" appears once, beside Next, and the receipts stay closed until it is pressed.
- **Spoken:** "Choose an occasion, or write without one. This is a rehearsal of a letter that would normally stay sealed for months."
- **Capture:** The Write step at both sizes, with three question rows and with one figure chosen.

## 5. Press the seal

- **Tasks:** 1, 2. PRs #445, #447.
- **Route:** `/demo/live`, Seal step.
- **On screen:** The warning text stays in view above the seal. The backup choice shows two radio buttons, neither selected, with "Skip it" and its explicit confirmation. The press envelope is the only orange control on the step. Hold it: the wax fills in stages, and the seal comes down. Release after a full hold to start the passkey prompt. A short press does nothing. Once the prompt is open, a second press adds nothing.
- **Spoken:** "Press and hold the seal. Releasing it after a full hold starts your passkey. If you skip the backup key, a lost passkey means a lost letter."
- **Capture:** The Seal step at both sizes, held, the Setting state, and the failure state. Each with and without reduced motion.

## 6. Wait: the sealed letter and the countdown

- **Tasks:** 9, 5 (hand-over). PRs #452, #449.
- **Route:** `/demo/live`, after the seal.
- **On screen:** The sealed envelope is the largest element. It carries the same seal it had on the Seal step. The countdown sits beside it. Below it, the Keep section holds the letter card with its QR code, the calendar button and the backup key card offer. The ghost sinks behind the envelope. At zero it rises from behind the envelope and stays clear of the Keep section.
- **Spoken:** "The seal is intact. Nothing here has changed since it was sealed."
- **Capture:** The Wait step before and at zero, at both sizes, with and without reduced motion.

## 7. Live Testify: the ghost and room

- **Tasks:** 16. PR #458.
- **Route:** `/demo/live`, Testify step.
- **On screen:** The question, its answer control and the verdict line "The seal is intact" sit below the Top_Bar. The ghost is drawn inside the first view and covers none of them.
- **Spoken:** "Testify before you read. Say what you remember."
- **Capture:** The Testify step at both sizes, with and without reduced motion.

## 8. Persona Testify fits at 1440×900

- **Tasks:** 15. PR #457.
- **Route:** `/demo/personas/us-maya`, Testify step.
- **On screen:** The step labels and the notice that Maya is fictional do not overlap, and the notice shows once. The first question, its answer control and the control to go on are inside the first view. Each fuel question shows a sample answer, labelled as a sample.
- **Spoken:** "Maya is a fictional persona. Her letter is a demo, written as of its date. Each fuel question has a labelled sample answer. You can keep it or change it."
- **Capture:** Maya and Tomás at both sizes, with and without reduced motion.

## 9. Break the seal at full size

- **Tasks:** 5. PR #449.
- **Route:** `/demo/personas/us-maya`, after Testify.
- **On screen:** The seal is at least 160 CSS px wide at 1440×900 and at least 120 CSS px at 390×844. The hold control and the Skip link sit in the first view, and the seal's relief is fully visible. The seal breaks under the reader's own hold. The ghost leaves, and the letter unfolds.
- **Spoken:** "Breaking the seal is your act. Her letter comes first, in full."
- **Capture:** Break the seal at both sizes, with and without reduced motion.

## 10. Try to tamper with it

- **Tasks:** 6. PR #450.
- **Route:** `/demo/personas/us-maya`, Read step.
- **On screen:** The button "Try to tamper with it" sits in the fingerprint section, beside the verdict and the "Show the fingerprint" disclosure. Pressing it shows a note that the test runs on a local copy in the browser and that the stored letter is not changed. The result shows "The seal is cracked. Revenant refuses to open this copy.", with the byte index and the value before and after. The stored fingerprint and the copy's fingerprint each show their seal. Closing the result returns to the real letter.
- **Spoken:** "Revenant changes one byte of a copy of this letter, in your browser, and tries to open it. The copy is refused. The letter you read is not changed."
- **Capture:** The Read step before the test, the result open, at both sizes, with and without reduced motion.

## 11. Also fix the fingerprint

- **Tasks:** 7. PR #451.
- **Route:** `/demo/personas/us-maya`, Read step, after the cracked result.
- **On screen:** Under the cracked seal, the button "Also fix the fingerprint". Pressing it recomputes the copy's fingerprint and tries again. The result reads "Refused at the authentication tag check. The fingerprint matches, and the encrypted text does not."
- **Spoken:** "Revenant also recomputes the copy's fingerprint. The copy is still refused, at the check on the encrypted text."
- **Capture:** `tamper-fixed` at both sizes, with and without reduced motion.
