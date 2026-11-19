// Builds README.md from screens.json (metadata), strings.json (captured visible text) and the shots.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const dir = fileURLToPath(new URL(".", import.meta.url));
const repo = join(dir, "../../../");
const screens = JSON.parse(readFileSync(dir + "screens.json", "utf8"));
const strings = JSON.parse(readFileSync(dir + "strings.json", "utf8"));

// Corpus of today's strings, to flag what is new or changed.
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/node_modules|\.next/.test(f)) walk(p); } else if (/\.(ts|tsx|txt|json)$/.test(f) && !/\.test\./.test(f)) files.push(p); } })(join(repo, "src"));
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(p); } })(join(repo, "content"));
const norm = (s) => s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/[’]/g, "'").replace(/\s+/g, " ");
const corpus = norm(files.map((f) => readFileSync(f, "utf8")).join("\n"));
const isNew = (t) => !corpus.includes(norm(t));

const STEPS = ["Write", "Press the seal", "Wait", "Testify", "Break the seal", "Receipts"];
const shell = (t) => ["revenant", "Demo", "Calm", "Sound", "Skip"].includes(t) || /^Step \d of \d · /.test(t) || STEPS.includes(t) || t === "✓" || /^\d$/.test(t);

const PROBLEM = { 1: "Questions have no sealed answer", 2: "The ghost is a background layer", 3: "Three visual systems", 4: "Press the seal", 5: "Wait", 6: "Testify", 7: "Read and receipts", 8: "Envelopes carry a dirt band", 9: "Home and /demo" };
const groups = [["Entry", 0, 4], ["Write", 4, 8], ["Press the seal", 8, 15], ["Wait", 15, 17], ["Opening", 17, 27], ["Personas", 27, 33], ["Keepsakes", 33, 35]];

let md = `# Design 15: the whole flow

A clickable, standalone prototype of every page and state of Revenant. Open [\`index.html\`](index.html) in a browser (no server, no build). Each screen has a yellow prototype bar at its top with previous, next and index links; add \`?bare\` to hide it. On the opening screens the bar has a "toggle /l/{id} track" link (or add \`#real\`) that switches the six-step live track to the three-step track used by a real letter.

Nothing under \`src/\`, \`content/\`, \`.kiro/\`, \`.github/\`, \`tools/\` or \`scripts/\` was changed. Colour tokens are copied from \`src/components/ceremony/scene/tokens.css\`. Fonts load from \`src/app/fonts/\`.

To redo everything after a revision (from the repo root):

\`\`\`
npx tsx docs/design/15-flow/prep.ts   # only if the source drawings change; writes assets.json
node docs/design/15-flow/build.mjs    # writes the HTML
node docs/design/15-flow/capture.mjs  # writes shots/, strings.json and prints the layout and contrast checks
node docs/design/15-flow/readme.mjs   # rewrites this file
\`\`\`

## What changes, in one page

- **One shell.** One top bar (wordmark and DEMO chip; persona notice, Calm, Sound, Skip), one step track, one centred column. No cream cards on dark, no older plain UI on \`/l/{id}\`.
- **Paper means then.** Warm paper and EB Garamond hold only what was sealed: the letter, the author's questions as written and the sealed answers. Everything else is Inter on the dark page.
- **Orange means you, now.** The reader's testimony on the receipts screen carries the orange rule.
- **The ghost is in the column.** Centred, in the flow, from unlock to the break, then it leaves. It is not on Write, Press the seal, Wait, home, \`/demo\` or the receipts.
- **A question has a sealed answer.** The author answers when writing. At opening the reader writes what they think they answered. The receipts put the two side by side with no comment.
- **No dirt band** on any envelope. Soil is a strip under the envelope.

### Shared shell strings (not repeated per screen)

- Top bar: "revenant", "Demo", "Calm" (aria-label "Turn off motion"), "Sound" (aria-label "Turn sound on"), "Skip".
- Live track: Write · Press the seal · Wait · Testify · Break the seal · Receipts. Phone line: "Step {n} of 6 · {label}".
- \`/l/{id}\` and persona track: Testify · Break the seal · Receipts. Phone line: "Step {n} of 3 · {label}".
- Persona notice, on desktop in the bar and on phone in a strip under it, shown once: "{name} is fictional. This letter was prepared later as a demo."

Strings marked **new or changed** are not found verbatim in today's source or content. The check is automatic, so a string built from a template today (for example "Question 1 of 3") can be marked new although only the template filling differs.

---
`;

for (const [gname, a, b] of groups) {
  md += `\n## ${gname}\n`;
  screens.slice(a, b).forEach((s, k) => {
    const n = a + k + 1;
    const list = strings[s.id].filter((t) => !shell(t));
    md += `\n### ${n}. \`${s.id}\`: ${s.title}\n\n- **Route:** ${s.route}\n- **State:** ${s.state}\n- **Fixes:** ${s.fixes.map((f) => `${f} (${PROBLEM[f]})`).join("; ")}\n- **Renders today:** ${s.component}\n\n| Desktop 1440 × 900 | Phone 390 × 844 |\n|---|---|\n| ![${s.id} desktop](shots/${s.id}-desktop.png) | ![${s.id} phone](shots/${s.id}-phone.png) |\n\n<details><summary>Every string on this screen</summary>\n\n${list.map((t) => `- ${isNew(t) ? "**new or changed** " : ""}"${t.replace(/\|/g, "\\|")}"`).join("\n")}\n\n</details>\n`;
  });
}

md += `
---

## Question wording (Occasions)

Rule: the author writes in their own voice and present tense. The opening screens add the date ("On 19 November 2026 you asked yourself:"). One question row by default. The rest are "Ask another" suggestions. This replaces the tables in \`src/components/live/occasions.ts\`.

| Occasion | Default question (one row) | Suggestions |
|---|---|---|
| The year ahead | What do I hope this year holds? | Which goal for the year feels most real to me? · What do I think will be different by the day I open this? |
| Work | What is on my mind about work right now? | What worries me most right now? · What do I want my working week to look like? · What do I think will be different by the day I open this? |
| Family | Who am I thinking about most right now? | What do I most want to say to the people at home? · What do I hope the people closest to me are doing when I open this? |
| A decision | What am I weighing right now? | What do I expect the choice to give me? · What would make this decision feel settled? |
| A blank page | What is on my mind right now? | What did I notice first this morning? · What do I most want to remember about this week? |
| Shared, after the Occasion's own | | What small thing am I looking forward to? · Who would I call first with good news? · What have I promised myself? |

Old wording for comparison: "Before you read it, what do you remember about the day you sealed this?", "When you wrote this, …", "What did you promise yourself the day you sealed this?".

## Priya: copy for the owner to approve

Fictional. Everyday and neutral, no price, party, policy or election term, no wording that grades. Her letter is unchanged (\`content/personas/letters/us-priya.txt\`).

Her questions (rewritten to the new rule):

1. What am I looking forward to most right now?
2. What am I worried about right now?

What she answered on 12 May 2024 (sealed):

1. "The trip to the coast with my sister, even though we haven't agreed how to get there. And a Sunday with nothing on the list."
2. "The extra morning shift. I can't decide, and I'm worried I'll fall behind on my reading either way."

What she remembers at opening (fictional recollection, small natural drift):

1. "The coast trip with my sister, mostly. I think I also wanted one quiet Sunday."
2. "Whether to take the extra morning shift. And I think I was worried about the reading list."

The live-letter text, questions and answers on the live screens are sample copy for the prototype only.

## Decisions

Things this brief did not settle, and what I chose:

- **Persona notice on phone.** The brief puts it in the bar, but the full sentence does not fit beside two icon buttons. On desktop it sits in the bar. On phone it sits in a thin strip directly under the bar. Only one of the two is visible at any width, so it is never shown twice.
- **Skip.** Its space is always reserved. No screen is captured mid-sequence, so no screenshot shows it. During the rise (emergence) and the unfold after the break it becomes visible in the reserved slot.
- **Unlock and still-sealed have no ghost.** Nothing is unlocked yet. The ghost first rises on \`emergence\`. The brief says "from the moment the letter is unlocked".
- **Ghost sizes.** Held, with the envelope in front of its lower body (no hands). Testify: 160 px tall on desktop, 96 px on phone. Emergence: 240 and 168. Break: about 384 and 312, with the wax 120 px across on desktop and 96 px on phone, pressable. Other seals are 28% of their envelope's width.
- **\`testify-number\` and \`testify-last\`.** The live letter has two author questions and one figure question, so the figure question is both the first figure question and the last question. \`testify-number\` is it before an answer is placed. \`testify-last\` is it answered.
- **Phone action bar.** On Testify, the buttons stick to the bottom of the card on phone, so Next question is always in view even when the scale pushes the card past the fold. The primary button is first, "I don't remember" or "No answer" second, "Previous question" last.
- **"Look closer at the mark"** becomes "Zoom in to place it more exactly", and sits on the scale's end row.
- **Unit echo** is now inside the number field's border, to the right of the digits, so it cannot overlap.
- **Two presses.** Under the wax: steps 1 "Make your passkey" and 2 "Set the seal", with the current step in orange. After the first press it reads "Passkey made". Choosing "Skip it" shows the confirmation tick inside that option. The warning box stays below the options at all times.
- **\`seal-no-prf\`.** The wax stays visible at 35% and waits for "I have saved this key". The old "Seal with this key" button is gone, so the wax is the one primary action on every Press-the-seal state.
- **Wait.** The letter card is drawn on paper, because it is a keepsake of what was sealed. It has no seal drawing of its own, so the seal appears once (the envelope). While the countdown runs the button slot shows plain text, so nothing jumps when "Open your letter" appears.
- **Persona recollection** uses a purple rule, not orange, because orange means the reader. Her recollection is labelled "fictional".
- **Receipts for personas.** Maya's "now" figures are the records for the week of her opening date (4 Nov 2024). Her sample answers are marked "sample answer" in the figure.
- **Same-week case** on the live letter: then and now are the same published period, so the change is 0% and the formula line says "Then and now are the same published period." No more explanation is given.
- **Backup key and QR** on the card screens are sample values for the prototype and not real keys. The QR is a real code made with the repo's encoder, and it points at a sample letter link.
- **New art, only where none existed.** The crack across the wax on \`maya-tampered\` (a plain dark line over the existing seal relief), the soil strip (flat, with a lit edge and a few clods, instead of the canvas Soil), and the top-bar icons (simple strokes, not copied from \`scene/icons.tsx\`). The ghost, the seal relief and the envelope are copied from the source, and the envelope has no dirt band. The three seal reliefs come from the maya and priya fingerprints, and a sample fingerprint for the live letter.
- **Ritual copy on the home page** changes for "Write" and "Testify" to match the new model.
- **Track on \`/l/{id}\`.** The same screens, with the three-step track. Use the toggle link in the prototype bar or \`#real\`.

### Checks run before capture

For every screen at both sizes, \`capture.mjs\` checks for horizontal scroll, text clipped by an overflow, overlapping text boxes and text contrast (4.5:1, or 3:1 for large text, against the nearest solid background; text on a gradient or image is reported). It reported nothing on the final run. Screens were also read by eye. The first primary action sits above the fold at 1440 × 900 and 390 × 844 on Press the seal, Wait, Unlock, every Testify question and Break the seal. The Write desk's fold button may sit lower.

## Steering changes needed

Not edited. Proposed wording follows.

1. **\`tone.md\`, Copy:** "A question is written for the reader on the opening day and names the sealing day ("when you wrote this", "the day you sealed this"). It never says "right now", "today" or "currently"."
   → "A question is written by the author, in their own voice and in the present tense ("What worries me most right now?"). The opening screens add the sealing date ("On 19 November 2026 you asked yourself:"), so the question carries no date of its own."
2. **\`tone.md\`, Testify:** "one question at a time, gentle prompts, no hints about what's inside. … For the text persona the step shows one question and her answer at a time, with a plain control to go on. Her answers are labelled as fictional."
   → "…For each author question the reader writes what they think they answered. For the text persona the step shows one question and her recollection of her answer at a time. Her recollections are labelled as fictional."
3. **\`tone.md\`, See the receipts:** "testimony first, then the letter, then the numbers."
   → "each question with the reader's testimony beside the answer sealed with it, then the letter, then the numbers."
4. **\`tone.md\`, Orange:** add "the reader's testimony on the receipts screen" to the list of what orange means.
5. **\`tone.md\`, Visual direction:** add "Warm paper and EB Garamond are only for what was sealed. The ghost is in the column from unlock to the break, never behind a card, and leaves when the seal breaks."
6. **\`product.md\`, Core loop 1:** "Questions are written to be read on the opening day and name the sealing day." → "Each question is answered when writing, in the author's own voice and present tense. A question can't be sealed without an answer."
7. **\`product.md\`, Core loop 6:** "first the questions the user wrote, then the questions about the figures. Their answers are recorded." → "For each question the user wrote, they write what they think they answered. Then come the questions about the figures. Their testimony is recorded before anything sealed is shown."
8. **\`product.md\`, Core loop 7:** "Each of their own questions with the answer they just gave, and their testimony on the figures (just now)." → "Each of their own questions, with what they remembered just now beside what they wrote on the sealing day, with no comment on the difference. Then the letter. Then the figures."
9. **\`product.md\`, Decisions, Testify step (MVP):** "the questions the author wrote for their future self (up to three, sealed as written, each written to be read on the opening day and naming the sealing day)" → "(up to three, sealed as written with the author's answer to each)". The reader's reply is what they think they answered.
10. **\`product.md\`, Demo 1:** "Her answers to them are pre-written content, labelled as fictional on every screen that shows them. The judge reads her answers, breaks the seal and reads her letter." → "Her letter carries her own questions, each with an answer she sealed. At opening the judge reads her fictional recollection of each answer, breaks the seal, and sees each recollection beside her sealed answer, then her letter."
11. **\`product.md\`, Demo 2:** "every Occasion starts with a default question anchored to the sealing day" → "every Occasion starts with one default question in the author's own voice, which they answer, change or remove". "the answers the judge gives 30 seconds later" stays true.
12. **\`neutrality.md\`:** "Score, diff, highlight, summarise or interpret the gap between the testimony and the letter, or between a written answer and any line of the letter." → add ", or between a recollection and the answer sealed with its question". The paragraph "A persona's pre-written answers follow the same rules as her letter" → "A persona's sealed answers and recollections follow the same rules as her letter".
13. **\`tech.md\`, The letter is self-contained:** "The recall questions, written out in full at sealing time." → "The recall questions, written out in full at sealing time, with the answer sealed with each author question."
14. **\`structure.md\`, scene:** "\`src/components/ceremony/scene/\` holds the Scene shared by \`/\`, \`/demo\` and \`/demo/personas/[key]\`" → the Scene's ghost is rendered only in the opening flow. Home and \`/demo\` show the envelope on soil without the ghost.

## Sealed format changes needed

A sealed answer for each author question needs a new \`format_version\` (2). Version 1 letters keep opening exactly as today. The v2 payload gains, for each author question, the question text as written and the author's answer as a plain-text string with a length limit. Everything else in v1 is unchanged. The reveal handles a v1 letter by showing each question and the reader's testimony with no sealed answer beside it, and a plain line saying the letter was sealed before answers were kept. That line is not drawn in this prototype and needs wording. The persona Priya must be sealed again as v2 with her sealed answers, which gives her a new letter id and fingerprint. Her recollections stay outside the sealed letter, as \`content/personas/letters/answers.json\` does now.

## Questions for the owner

1. Approve Priya's questions, sealed answers and recollections above.
2. On phone, is the persona notice in a strip under the bar acceptable, or should it be an icon in the bar that opens the notice?
3. The same-week receipts line says only "Then and now are the same published period." Is that the wording you want?
`;
writeFileSync(dir + "README.md", md);
console.log("README written", md.length);
