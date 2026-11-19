# Kiro prompt: design the whole flow, screens only

Paste everything below the line into a Kiro chat. It produces screens for the owner to approve and then stops. It writes no spec, no tasks and no product code.

---

## Your job

Design the final look of every page and every state of Revenant as a standalone clickable prototype, capture every screen at desktop and phone size, open one PR, and stop.

Do not write a spec, `requirements.md`, `design.md` or `tasks.md`. Do not change anything under `src/`, `content/`, `.kiro/`, `.github/`, `tools/` or `scripts/`. Everything you create goes under `docs/design/15-flow/`. After the PR is open, stop and wait for the owner's review. If the owner comments, revise in the same PR.

The steering files still apply (tone, neutrality, data integrity, privacy). Where this prompt changes a product rule, follow this prompt in the prototype and list the steering line that needs rewording in the README (section "Steering changes needed"). Do not edit steering yourself.

## Why

The owner walked the live site at 1440 × 900 and 390 × 844, sealing and opening real letters. Only the Write desk has the new design. Everything after it falls back to older looks, and the question model breaks the core promise. These are the problems the prototype must fix:

1. **Questions have no sealed answer.** The author can't answer a question when writing, so at opening the testimony has nothing to be compared with. The answers are then shown twice in a row (above the seal, then again after it breaks) before the letter.
2. **The ghost is a background layer.** `scene.module.css` pins `.ghostPlace` at `--ghost-x` (72% of the frame) behind the content. It floats alone in an empty right half on the persona pages, its skirt peeks out under the cream card on the live Wait step, it is clipped at the right edge on phones, and it is missing on `/l/{id}`.
3. **Three visual systems.** The dark desk (Write), cream cards on dark (Wait, Testify, demo cards, end card), and an older plain UI on `/l/{id}` (boxed "Turn off motion / Turn sound on" buttons, an envelope with no seal, no top-bar controls). The live demo's payoff (Testify, Break the seal, the receipts) happens on `/l/{id}`, the weakest screens.
4. **Press the seal:** the new dark panel sits inside the old cream step card, which runs to the right edge. The wax is a 12 px dot before a backup choice. A second press is needed after the passkey is created and nothing warns about it. On a phone the wax is below the fold after "Fold it and press the seal".
5. **Wait:** the page heading is near-white on cream, so it can't be seen, and it sits under the "Wait" h2. A second "Unlock your letter" panel is rendered under the letter card while "Go to your letter" also leaves the page. DEMO appears three times; the seal appears twice. The step track ends here.
6. **Testify:** "Previous question" is white on cream (invisible). The unit echo under the number field overlaps the field's border. The persona question heading gets a black focus box on load. Questions are bold Inter here but EB Garamond italic on the Write desk. The persona header lines are stacked with no spacing, and on phone the "fictional" notice appears twice. "Look closer at the mark" doesn't say what it does.
7. **Read and receipts:** the live end screen squeezes two columns into about 480 px and cuts answers off with "…". "Show full answer" sits under one-line answers already shown in full. A 16-group fingerprint block sits between the testimony and the letter. A purple gradient runs behind text. On the persona Read step the testimony is left-aligned, the letter centred, and the tamper control runs to the right edge.
8. **Envelopes everywhere** carry a grey band with dots across their bottom 22% (`Dirt` in `Envelope.tsx`). It reads as a rendering glitch.
9. **Home and `/demo`:** the hero envelope sits in a small box with its top cropped and the right half empty at 1440. The `/demo` envelopes float above their cards, the light beam lands on empty space, and the live card sits alone on a second row. Pages with nothing to skip show a disabled Skip.

## Product decisions (final, design to these)

### Questions are answered when sealing

- On the Write desk every question row has the question and the author's answer. A question can't be sealed without an answer.
- One question row by default (from the chosen Occasion), up to three. "Ask another" suggestions stay.
- The author writes questions in their own voice and present tense: "What worries me most right now?". The opening screens add the date, so a question no longer has to name the sealing day. Rewrite every Occasion default question and suggestion in `src/components/live/occasions.ts` to this rule and show the new wording in the prototype and in the README.
- The fold check names the unanswered question and moves focus to it: "Question 2 has no answer yet. Answer it or remove it."

### At opening, the reader writes what they think they answered

- For each author question: "On 19 November 2026 you asked yourself:" then the question exactly as written, then "What did you answer? Write what you remember." The field label is "What you think you answered".
- "I don't remember" replaces "No answer" for author questions.
- Figure questions keep today's model (guess the sealed figure) and today's wording, with the sealing date in the counter.
- The testimony is recorded before anything sealed is shown. It is shown once, on the receipts screen, never as a list above the seal.

### The reveal puts each sealed answer beside the testimony

On "See the receipts", in this order, in one scrolling column:

1. Each author question: the question as written; "You remembered, just now"; "You wrote, 19 November 2026" with the sealed answer. No comment on the difference, no highlighting of differences, no score.
2. The letter in full ("What you wrote then").
3. The figures, if any: then, now, the reader's answer, the change and the source, as today.
4. One line: "The seal is intact. Nothing here has changed since it was sealed." with a "Show the fingerprint" disclosure. The persona tamper control lives in this row.
5. The end card.

### Visual rules

- **Paper means then.** Warm paper and EB Garamond are only for what was sealed: the letter, the author's questions as written, the sealed answers. Inter on the dark page is for everything else.
- **Orange means you, now.** The reader's testimony on the receipts screen gets the orange rule. Orange keeps every other use `tone.md` lists and never marks a figure or a change.
- **One shell.** Every page has the same top bar: wordmark and DEMO chip on the left; on the right, in this order, the persona notice (persona pages only), Calm, Sound (only where there is sound) and Skip (only while a sequence runs; its space is reserved so nothing shifts). On phone the same order, with icon buttons on the right. Never show a disabled control.
- **One step track** from Write to the receipts on the live demo: Write · Press the seal · Wait · Testify · Break the seal · Receipts. The live demo continues on the same page after Wait, with one "Open your letter" action. `/l/{id}` (a real letter opened from its QR code) uses the same screens and the same shell, with a track of Testify · Break the seal · Receipts. Persona pages use that same three-step track.
- **One centred column per screen.** Nothing is positioned by viewport percentage independently of the content. The Write desk keeps its two columns (sheet and envelope panel) at 992 px and wider.
- **The ghost is part of the column.** It is centred, in the flow of the column, never beside a card, never behind one, never clipped at 390 px. It appears from the moment the letter is unlocked until the seal breaks:
  - Unlock and seal check: it rises from the soil, centred, holding the sealed envelope. "Checking the seal…", then "The seal is intact."
  - Testify: small, centred above the question card, still holding the envelope (about 160 px tall on desktop, about 96 px on phone).
  - Break the seal: large and centred, the wax in front at a size you can press (at least 120 px across on desktop, 96 px on phone), the instruction and the "Break the seal" button directly under it.
  - When the seal breaks, it hands over the letter and leaves. No ghost on the receipts, on Write, Press the seal or Wait, on home or on `/demo`.
- **No dirt band on envelopes.** Soil belongs to the scene, under the envelope, never painted across it.
- **Text never sits on soil, glow or gradient.** No white text on cream. Every text colour passes WCAG 2.2 AA on its own surface.
- **Nothing is shown twice on one screen:** the testimony, the persona notice, the DEMO label, the seal.
- **Primary action in view without scrolling** at 1440 × 900 and 390 × 844 on Press the seal (the wax), Wait (when ready), Unlock, every Testify question and Break the seal. The Write desk is long; there the fold button may sit below the fold.

### Press the seal

- Sealing needs two passkey prompts (the first makes the passkey, the second reads its key), and each prompt has to start from a press, so sealing takes two presses. Keep that; design them as two visible steps under the wax: "1 Make your passkey" and "2 Set the seal". The paragraph says it plainly: "You'll press the wax twice: once to make your passkey, once to set the seal."
- The wax has the pressed-ghost relief (from `src/components/ui/seal-relief/`) in every state, never a plain dot or a flat disc. Before a backup choice it is shown at 35% opacity with "Choose a backup option first."
- On phone the order is: heading, one short paragraph, the envelope with the wax and the two steps, then the backup options, the warning and the links. The wax must be in view when the step opens.

### Wait

One card: the sealed envelope, the countdown, the letter card (QR code, opening time, link, fingerprint in small type), "Save the card as an image", "Add to your calendar", and the rehearsal line. When the time is up the one action is "Open your letter". No second unlock panel.

## Screens

One HTML file per screen, named by the IDs below, sharing `flow.css` and `flow.js`. Each screen has a small prototype bar (not part of the design, visibly different, removable) with previous and next screen links in flow order and a link back to `index.html`. `index.html` shows every screen as a thumbnail in flow order with its ID and title.

**Entry**
- `home`: landing page `/`
- `demo`: `/demo`, three persona cards and the live card in one consistent grid
- `how`: `/how-it-is-sealed`
- `not-found`: 404 (also what `/seal` shows while real sealing is off)

**Write** (`/demo/live`)
- `write-empty`: first load, "A blank page", one empty question row with an empty answer
- `write-filled`: "Work", letter written, two questions answered, one public price tucked in
- `write-check`: fold pressed with question 2 unanswered
- `write-own-number`: the "A number of my own" receipt view

**Press the seal**
- `seal-choose`: before a backup choice
- `seal-step-1`: backup chosen, ready for the first press
- `seal-step-2`: passkey made, ready for the second press
- `seal-sealing`: sealing in progress
- `seal-backup`: "Download a backup key card" chosen, card ready to save
- `seal-no-prf`: the passkey can't make a key, the backup key is now required
- `seal-failed`: sealing failed, or Demo 2 is busy

**Wait**
- `wait-counting`: countdown running
- `wait-ready`: time is up, "Open your letter"

**Opening** (the live demo after Wait, and `/l/{id}`)
- `still-sealed`: `/l/{id}` before the opening date: still sealed and the time remaining, nothing about the contents
- `unlock`: "Unlock with your passkey" and "Use the backup key"
- `unlock-backup`: entering or scanning the backup key
- `unlock-error`: the passkey isn't on this device, with the existing cross-device help
- `emergence`: the ghost has risen with the envelope, the seal check passed
- `testify-text`: author question 1 of 3
- `testify-number`: a figure question with the scale
- `testify-last`: the last question with "Previous question" and "Record my testimony"
- `break`: the ghost centred, the wax ready to press
- `receipts-live`: the full receipts page for the live letter: two answered questions, the letter, one figure in the same-week case, the seal line, the end card

**Personas** (`/demo/personas/{key}`)
- `maya-testify`: figure question with its sample answer, labelled as a sample
- `maya-break`
- `maya-receipts`: the full receipts page with two figures that changed
- `maya-tampered`: the tamper control has run on the copy and the check fails
- `priya-testify`: her fictional recollection of her answer, one question at a time
- `priya-receipts`: her recollection beside her sealed answer for each question, then her letter

**Keepsakes**
- `letter-card`: the printable letter card
- `backup-card`: the printable backup key card

## Content

- Use real content: Maya's and Priya's letters from `content/personas/letters/`, the real figures in `src/lib/figures/real/fuel-figures.json`, and today's copy from the `copy.ts` files where it still fits.
- Priya now needs sealed answers (what she answered on 12 May 2024) and her fictional recollections at opening. Rewrite her two questions to the new rule. Draft both sets of answers in her voice, consistent with her letter, everyday and neutral, with small natural drift between them and nothing that reads as a verdict. Mark them in the README as copy for the owner to approve.
- Persona letters are "written as of" their date and never claim to have been sealed then: "She wrote, as of 12 May 2024".
- For the live letter use a plausible short letter and answers, dated the day you build the prototype.
- Every new or changed string goes in the README next to its screen.

## Build rules

- Standalone, like `docs/design/07-judge-journey.html`: no network, no build step, no dependencies. Load the fonts from `src/app/fonts/` by relative path. Copy the colour tokens from `src/components/ceremony/scene/tokens.css` and say so in a comment.
- Reuse the existing drawings: copy the SVG of the ghost (`src/components/ceremony/scene/Ghost.tsx`), the seal relief (`src/components/ui/seal-relief/`) and the envelope (`src/components/ceremony/envelope/Envelope.tsx`, without the dirt band). New art only where none exists, and say why in the README.
- Screens show their resting state. Motion is optional; if you add any, honour `prefers-reduced-motion`.
- Before capturing, check every screen at both sizes: no horizontal scroll, no overlapping boxes, no clipped text, no text below AA contrast. Fix what fails.

## Capture

- Capture every screen at 1440 × 900 and 390 × 844, full page, with Playwright (`playwright-core` from the repo, or the Playwright MCP). Save as `docs/design/15-flow/shots/{id}-desktop.png` and `{id}-phone.png`.
- Commit the capture script as `docs/design/15-flow/capture.mjs` so the shots can be redone after a revision.

## README

`docs/design/15-flow/README.md`, in flow order. For each screen:

- its ID, route and state;
- both screenshots, inline;
- every string on it, exactly;
- which problem from "Why" it fixes, by number;
- the component that renders it today, if any.

Then four short sections:

- **Decisions:** anything you chose that this prompt didn't settle.
- **Steering changes needed:** each steering line the design contradicts, quoted, with proposed wording. At least `tone.md` ("A question is written for the reader on the opening day and names the sealing day…") and the Write and Testify steps in `product.md`.
- **Sealed format changes needed:** a sealed answer per author question means a new `format_version`, with v1 letters still opening. Say what the payload gains; don't design the schema.
- **Questions for the owner:** only what blocks approval.

## PR

One PR titled "Design: the whole flow, for approval", containing only `docs/design/15-flow/**`. The description lists the screens in flow order with their desktop shots inline. Then stop.
