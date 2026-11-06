# Requirements Document

Spec: 09 Demo polish

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category, and goes for the overall and category prizes plus Best Demo and Best Kiro Crew App. Submissions close 4 December 2026, 2:00 PM PT. The owner's feature freeze is 27 November 2026. Judging runs 16 December 2026 to 29 January 2027, and the site must work the whole time.

A typical judge watches the video, then opens the URL for one to three minutes, usually on a laptop and sometimes on a phone. They may be outside the US, their device may not support WebAuthn PRF, and they will not read the README first. The five criteria (Potential Impact, Technological Implementation, Design, Innovation, Presentation) carry no weights.

Every spec 08 task is merged, but the owner's production walk on 6 November 2026 at 2560×1440, 1366×800 and 390×844 found that the judge's path is broken in production and that several spec 08 outcomes don't hold there:

- **Broken now (P0).** No persona reveal shows a now figure: `GET /api/figures` returns `source_mode: "db"` with `figure: null` and `last_success_at: null` for all four series (F1). The live demo can't be completed, because the picker reads the empty Figures_API and says "Choose between 1 and 0" (F2). Each missing now figure says "no longer published by Revenant", which is false for a series still in the Catalogue (F3). `/icon.svg` is 404 because the Dockerfile never copies `public/` (F4). Entries without a now figure drop "Your answer" (F5). No workflow checks production; the spec 08 Freshness_Check was never committed (F6).
- **Visible bugs (P1).** Button labels overflow ("Record my answers", "Next question") (F7). The two read-only Recall_Scales on the marks card overlap and don't say which metric they belong to (F8). The EUR scale drops 2,500 (F9). The Ghost peeks out behind cards after the Seal_Break (F10). Programmatically focused headings show a rectangle for mouse users (F11). The recall field has no accessible name (F12). "3.90" and "3.9" both appear for one answer (F13). Unknown routes show the default Next.js 404 (F14).
- **Demo experience (P1).** The landing page doesn't say what Revenant is above the fold (F15), and on a phone its button is cut off (F16). The Resurrection story is only in the README (F17). The persona page gives no context and no progress (F18). The payoff is spread over three places, and the closing line doesn't name its two subjects (F19). The climax shows five controls (F20). The Ghost is away from the action (F21). The fictional-persona disclosure shows three times, and the Fingerprint is jargon at the peak (F22). Tomás is asked about a litre but types EUR per 1,000 litres (F23). The live demo looks like another product and warns before the judge does anything (F24). The How_Page is a wall of text (F25). Wide screens leave the hero small in a corner (F26).

Judges often open the Devpost, X and Discord links on a phone. The owner's walk at 390×844 found the phone experience is mostly the Ghost and scrolling (360×640 is worse in every case):

- **P1 (first screen of `/`).** The first screen is the headline, about 300 px of empty purple sky, and the Ghost. The primary button sits at about 830 px, cut off at the bottom edge, after an empty dark gap of about 200 px below the Soil. The explanation and the other links start around 1,100 px. The "How a letter is sealed" and GitHub links appear twice, in the body and in the footer.
- **P2 (persona page).** The Hero and Ghost fill the first screen at every Stage. The headline wraps to five lines, almost one word per line. "Pick up the letter" sits at about 800 px; after it, the recall field starts at about 680 px. The judge scrolls before every action.
- **P3 (reveal length).** The persona reveal is 4.5 screens long on the phone (3,778 px), against 3.3 on a laptop. The marks-card overlap is worse: "3.90 USD per gallon" runs across the 2, 4 and 6 ticks of the scale above it.
- **P4 (Top_Bar).** The Top_Bar takes about 130 px (15% of the screen) on persona pages: the "Turn off motion" pill, "Skip" during the ceremony, and a separate line for the fictional-persona note.
- **P5 (receipts).** The then value's period and region wrap onto their own lines ("6 May 2024" / "U.S."), and the dark figures panel's background ends partway down its own content.
- **P6 (live demo).** The live demo is 2.4 screens long, with a 260 px empty textarea and validation errors shown before anything is typed.

On 5 November 2026 the owner reframed the README twice (commits `eba2bc0` and `89d27d7`). Steering and the site copy were never updated, so they still carry the original framing, and every role agent reads steering. `README.md` on `main` is now the source of truth for the framing:

| | Old framing (site and steering) | New framing (README) |
|---|---|---|
| Tagline | "Your past self returns with the receipts." | "The wax seal, resurrected. Memory rewrites itself. Revenant doesn't." |
| What is resurrected | The sealed letter to your future self, the classroom time capsule | The wax seal: the plis cachetés the Académie des sciences has kept since 1735. The classroom time capsule stays in the story as an example. |
| The problem | "People remember the past through rose-tinted glasses" | Memory rewrites itself. Every recall edits it a little, and you can't cross-examine your own past. (README wording; the UI uses calm words, F1.3.) |
| What's new | (not stated) | The one thing no wax seal could do: Revenant makes you testify before you read. The gap between your testimony and the record is the product, and Revenant never says what it means. |
| Ritual | Write, Choose figures, Seal, Wait, Recall first, Reveal | Write, Seal the figures, Press the seal, Testify, See the receipts |
| Seal mapping | (not on the site) | Wax → SHA-256 hash and AES-GCM tag · folded paper → AES-GCM encryption in the browser · signet ring → passkey (WebAuthn PRF) · archivist → server time lock |

Group F (Framing) brings steering, then every user-facing statement, into line with the README. Steering comes first.

The letter surfaces look dated: the demo letter cards, the Envelope on the Ghost, and the letter in the reveal. Part of the cause is a font bug on every page; the rest is styling left over from the original "letter found in an attic" theme, which `tone.md` and spec 07 replaced but never fully removed:

- **T1 (fonts never render).** `next/font/local` downloads EB Garamond and Inter (both requests return 200) and registers them as families named "serif" and "sans", after the consts in `src/app/layout.tsx`, setting `--font-serif` and `--font-sans` through classes on `<html>`. `globals.css` also sets both in `:root`, to `"EB Garamond", Georgia, …` and `"Inter", system-ui, …`. `:root` and a class have equal specificity and `globals.css` comes later, so the `:root` values win. No `@font-face` is named "EB Garamond" or "Inter", so every visitor gets Georgia or Times for headings and the system UI font for the rest; `document.fonts` reports both faces unloaded.
- **T2 (serif headings).** `globals.css` sets every `h1`–`h6` to the serif, and so do the recall question titles, the persona names and the demo page heading, against `tone.md` and spec 07 R3.4 (the serif is for the letter text only).
- **T3 (attic theme in the CSS).** Desk tokens (`--desk-*`), gold leaf (`--gold-leaf`, `--gold-text`), the dark red `--seal`, `--ink-faded` and a `ParchmentSurface` component are still referenced. `tone.md` rules out parchment texture.
- **T4 (index cards).** The `/demo` letter cards are cream rectangles with a thin gold border, a small seal in a corner, label and value pairs in two sizes, and an underlined "Open the letter" link; they stack even on wide screens and are indented from the heading.
- **T5 (a bezel, not light).** The reveal letter sits in a solid purple slab with a radius up to 48 px. The paper carries interface chrome: the heading, "Written as of", a black-bordered disclaimer box and "Sealed for the demo on …". The "creases" are two short vertical stubs at the top of the paper.
- **T6 (three seals).** The wax seal is a small disc on the cards, a postmark circle on the Envelope front, and a large seal on the marks card, and never on the Envelope's flap.

Group L (Letters and type) fixes these. The font fix ships with production health; the rest ships with the landing and persona-journey tasks.

This spec fixes production first, then makes the demo land in the first 30 seconds and pay off at the end. Group P (Phone first) holds the phone rules. It is not a separate phase: each landing, persona-journey and live-demo task meets group P for its own page. It builds on specs 02 to 08. Every rule of those specs and of `.kiro/steering/` still holds unless "Rules this spec replaces" names it. Where a request for this spec conflicts with steering, steering wins and the conflict is listed under "Owner decisions".

Requirements are grouped and numbered by priority: G (rules for every task), F (framing: steering first, then every copy task), A (production health and correctness, P0), L (letters and type: L1 with group A, the rest with groups B and C), P (phone first, met inside the B, C and D tasks), B (landing, P1), C (persona journey and payoff, P1), D (live demo, P1) and E (presentation, P2). Everything in group A ships before anything in group B.

## Decisions already made

| Topic | Decision |
|---|---|
| Deadlines | Group A merged by 10 November 2026. Real sealing go/no-go on 20 November 2026 (spec 08 R25). Feature freeze 27 November 2026. Submission 4 December 2026, 2:00 PM PT. Site and checks run through 29 January 2027. |
| Priority | Production first (A1 to A6 and L1), then visible bugs (A7 to A14), then the landing (B), the persona journey (C), the live demo (D) and presentation (E). No task in a later group is merged before every task in group A (G3). |
| Cut order if the freeze is at risk | D1 (Scene in the live demo) and D3 (prompt starters) first, then C5 (Ghost carries the seal break) and the B3.4 Coven_Strip. Nothing in group A is ever cut (G3.5). |
| One-off fetch now | The owner runs one Fetch_Job by hand now (`kubectl create job --from=cronjob/<release>-fetch-figures <name>`) and pastes its log into the task 1 issue body while A1 and A2 are built. |
| Production evidence | Several spec 08 tasks passed QA locally and failed in production. Every group A and group C task states a Production_Check, and the owner records its result in the issue after deploy (G2.6). |
| Evidence sizes | Screenshots at the Evidence_Sizes: 1366×800, 1280×800, 360×640, 390×844 and 2560×1440 (G2.4). |
| Privacy and size | Spec 08 R1.5 and R1.6 unchanged: the CSP header byte-identical, no request to another origin, nothing written to storage, cookies or the URL, no new `dependencies` entry. No animation library, WebGL, or new sound or vibration cue. Every route stays inside `scripts/check-js-budget.mjs`. |
| Crypto | No change to crypto primitives, the key hierarchy, envelope header fields or any existing `format_version`. |
| Copy | All copy passes `tone.md`, `neutrality.md` and the copy-tone-check hook. Orange means "you" only. |
| Fallback figures | A series with no stored figure in db mode is served with its newest bundled real figure, marked `fallback: true`, with its real `retrieved_at` (A1). Owner decision OD1 confirms. |
| Two passkey prompts | Stay. `crypto.md` "PRF check at sealing" needs `create()` then `get()`, so the live demo keeps the Create_Press and the Confirm_Press (spec 06 R15.1). The copy explains it (D2.7). |
| Framing source | `README.md` on `main` (commits `eba2bc0`, `89d27d7`). Owner_Patches bring `product.md` and `tone.md` to it before any copy task starts (F1). Every user-facing string follows it (group F). |
| Tagline | "Your past self returns with the receipts." is retired. The tagline is "Memory rewrites itself. Revenant doesn't.", with the eyebrow "The wax seal, resurrected." (OD16, closed by the owner on 6 November 2026). |
| Light on the letter | A shaft of light (OD19, closed by the owner on 6 November 2026): the Scene's purple shaft moves from the Soil to the paper at the unfold and lights the paper's top edge and the dark around it. The text area stays flat `--paper`. On the Phone_Sizes the lit area above the paper is at most 80 px tall. The receipts column stays on plain dark. Static under reduced motion or Calm_Mode. CSS gradients only. |
| Phone first | Group P holds at both Phone_Sizes, and 360×640 must pass too. Each landing, persona-journey and live-demo task meets group P for its own page; there is no phone phase at the end. |
| Real devices | Each on-screen task gets a Real_Device_Check on one real iPhone (Safari) and one real Android phone (Chrome) on `revenant.devclef.se` after deploy (G2.8). P9 (the on-screen keyboard) can only be verified this way. |
| Landing entry to the letters | The one orange button on `/` reads "Open the demo letters" and goes to `/demo`. `/` names no persona, so no region comes first. The Demo_Index lists every persona (B1.3, B2; OD4 closed). |
| Landing story source | The README sections "What we resurrected" and "The ritual" are the source text for B3. `docs/concept.png` is the visual direction only within `tone.md`: no moon, bats, cobweb, gravestone-arched cards, red wax, serif headlines, arrows between then and now, groceries or wages. |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **Spec 08 R20.8** ("the stored figure ... or no figure if none is stored") and the spec 08 design line "it never falls back to the bundled file", for the case where the database read succeeds but holds no figure for a series: replaced by A1. A failed database read still answers 500.
- **Spec 08 R20.10** and the spec 08 design rule that `series_missing` and `no_figure` both show `nowUnavailableMissing`: replaced by A3.
- **Spec 07 R17.1 to R17.3 and spec 08 R11.4** (`/demo/live` restyle only; no rewording of `src/components/live/copy.ts`; spec 06 tests unchanged): replaced by A4 and group D. The crypto calls, request bodies, and the order of PRF_Check steps and Sealing_Flow steps of spec 06 R15.1 stay unchanged. Spec 06 tests change only where a string or a screen layout they assert changes, and each change is named in the PR.
- **Spec 06 R12.4 and R13.2** (messages shown when the judge presses "Create your passkey"): kept, and extended by A4.4 so no validation message shows before the field was touched or a seal was attempted.
- **Spec 06 R13.7** (the picker shows the period of each series but not its value): replaced by D4.
- **Spec 06 R16.4** ("Go to your letter" is the only way on at zero): extended by D5. The link stays; the page also offers the unlock in place. The page still never navigates by itself.
- **Spec 08 R4.2, R4.4 and R5.1** (Figure_Entry order; "Your answer" only as the Number_Line label): replaced by C3. Spec 08 R4.3 ("Your answer" exactly once) stays.
- **Spec 08 R6** for the `figures` and `close` Stages: the marks card collapses there (C3.4). R6 still holds in the `marks` and `seal` Stages.
- **Spec 03 R9.4, spec 05 R6.8 and spec 07 R12.1** (the "Show everything" control): its label and placement change to the Skip_Link (C4). It still sends `SHOW_ALL` and is still visible while any part of the Reveal is hidden.
- **Spec 07 R8.3** (Top_Bar right side: notice, Calm, Skip): the sound toggle joins it, between Calm and Skip (C4.4). Skip still shows only while a sequence runs (spec 07 R8.6).
- **Spec 07 R10.14** (the content column holds only the recall or marks content): the Step_Indicator also sits at the top of the Content_Column (C2).
- **Spec 07 R8.7, desktop part, and its R24.3 row** ("Prepared later as a demo." on the Envelope_Front): dropped, pending OD5 (C6.2). Spec 05 R3.7 is still met, because spec 07 R8.13 counts the Top_Bar notice as part of the envelope view.
- **Spec 05 R7.4 labels** ("Written as of {date}", the demo letter label and "Sealed for the demo on {date}" as three items): replaced by the Letter_Disclosure line and one "Sealed for this demo on {date}" line, both in the Caption_Block (C6.3, L6.2). Spec 03 R10.2, R10.3 and R10.5 still hold.
- **Spec 08 R14.3 and R14.8, for Persona_Letters only**: the Fingerprint sits inside a closed disclosure control after the Seal_Verdict (C6.4). Live_Letters and Real_Letters keep R14.3 unchanged.
- **Spec 07 R15.1 item 1 and its R24.3 row** ("The space between the two is yours to read."): replaced by F5 and C7.
- **Spec 08 R7.8 to R7.10, the `EUR per 1,000 litres` entry and the Unit_Helper_Line**: replaced by C8 if OD3 picks option (b), which this spec recommends.
- **Spec 07 R7.13 and spec 08 R9.14** ("no ... API ... code" on `/`), for one thing only: the Sample_Receipt on `/` makes one browser `GET /api/figures` request after hydration and parses it with `src/lib/figures/now.ts` (B3.3). `/` still imports no Opening_Flow, crypto or database code.
- **Spec 07 R7.3 to R7.5, the `scene` row of R2.1, the "Landing" row of its decisions table, and the R24.3 row "Landing button (proposed)"** (the one Accent button links to the first persona's letter and is labelled "Open {name}'s letter"): replaced by B1.3 and B2. The one Accent button now links to `/demo` and uses the spec 08 R10.3 singular or plural wording. With no persona in the Persona_List, `/` still shows no Accent letter button (spec 07 R7.5 kept in meaning).
- **Spec 08 R30.7** (screenshots at the three Check_Sizes): replaced by G2.4 (the five Evidence_Sizes, and every Stage at both Phone_Sizes).
- **Spec 07 R8.1** (Top_Bar at most 96 px at 360×640): at the Phone_Sizes the limit is 56 px (P5).
- **Spec 07 R8.3 phone layout and R8.4 placement** (the persona notice on its own Top_Bar row below the breakpoint): at the Phone_Sizes the notice moves to the Persona_Intro (P5.3). Its text is unchanged. Spec 07 R8.9 and R8.13 are still met, because the Envelope_Front is shown only in `emerging`, `sealed` and `intact`, where the Persona_Intro is in the First_Viewport. The Demo chip stays in the Top_Bar (spec 03 R6.5).
- **Spec 07 R8.3 and C4.4 control style** (Calm, sound and Skip as text pills): at the Phone_Sizes they become controls in the form OD13 picks, each with an accessible name.
- **Spec 07 R10.15** (the Ghost scales to no less than 0.8 on narrow screens): after the First_Step at the Phone_Sizes the Ghost takes the Compact_Ghost state (P4.2). Spec 07 R10.16 (seal target at least 44×44) stays.
- **Spec 08 R8.1** (a smaller Hero after the First_Step): at the Phone_Sizes the Hero collapses to one line or hides (P4.2).
- **Spec 08 R6, spec 07 R12.12 and C3.4 at the Phone_Sizes**: the read-only Recall_Scales are not drawn. The `marks` Stage shows the Answer_List next to the seal, so memory still comes first (`tone.md` "Reveal", spec 03 R9.1), and the Receipt_Cards carry the answers after that (P6.4). OD15 confirms.
- **Spec 07 R19.6** (24×24 minimum for most targets): at the Phone_Sizes every interactive target is at least 44×44 (P8.4).
- **Spec 08 R3.6** (a value line may break between value and unit): at the Phone_Sizes value and unit stay on one line, and period and region share the next line (P6.1).
- **B1.5 of this spec** (the Landing_Ghost may move below the calls to action): replaced by P1.1 item 5 and OD12.
- **Spec 07 R3.18, the headline row of R24.3, and the "receipts." item of R3.9** (the tagline "Your past self returns with the receipts.", "the receipts." kept together, "receipts." in the Accent): replaced by F3. The headline is "Memory rewrites itself. Revenant doesn't.", "Revenant doesn't." stays together on its last line, and no part of it is in the Accent, because neither part means "you" (`tone.md`).
- **Spec 07 R9.1** ("THE persona page SHALL show the tagline as its headline", from the same position as `/`): replaced by F7 if OD17 keeps its default. The persona page and `/demo/live` show their own heading in the same position and style; spec 07 R21.3 (the heading is the LCP element) still holds.
- **Spec 07 R24.5** ("See the numbers" stays character for character): replaced by F4. The button reads "See the receipts". "Break the seal", "Bringing the letter into the light.", "Checking the seal." and "The seal is intact. Nothing here has changed since it was sealed." stay.
- **Spec 08 R10.1** (the landing copy names the classroom time-capsule letter and says Revenant brings it back): replaced by F3 and F6. The landing copy names the wax seal and the plis cachetés as what Revenant resurrects, and the time capsule only as an example.
- **Spec 08 R12.3** (the Open Graph image shows the landing headline): kept, with the new headline and no Accent text (F2.3).
- **Spec 07 R15.1 item 1 and C7 of this spec**: the closing line follows F5.
- **C2.1 and D2.1 of this spec** (step names): follow F4.
- **Spec 07 R3.1 ("the purple token for its light and the Letter_Block"), R13.1 (the letter inside "the one big rounded purple block") and the Letter_Block term**: replaced by L7. The purple is light only; the Letter_Block becomes the lit area around the paper, with no solid purple slab.
- **Spec 07 R3.15 and R4.9** (a white focus ring on controls inside the Letter_Block): no control sits on the paper or in the lit area any more (L6), so every focus ring is the Accent on the dark (spec 07 R3.14 still holds).
- **Spec 07 R13.2** (fold creases as decoration): replaced by L8.
- **Spec 07 R13.6 and spec 05 R7.4** (the letter labels "visible with the letter"): the labels move outside the paper into the Caption_Block, in the same view (spec 03 R10.2 and R10.5 still hold).
- **Spec 07 R16.3** (the card link "Open the letter"): replaced by L5.3 ("Open {name}'s letter", one target).
- **Spec 07 R4.8** (desk token pairs retired "in task 9" of spec 07): they are retired by L3 in this spec.
- **Spec 07 R8.7 and R10.10** (the Envelope_Front and the wax seal): the Envelope_Front keeps its dates and loses its postmark circle; the seal is the one WaxSeal, on the flap (L4).

## Out of scope

- New official series, groceries, rent, wages or hours of work. New personas beyond Maya and Tomás. Sweden (spec 08 R23).
- Removing the second passkey prompt (see "Decisions already made").
- Any change to crypto primitives, the key hierarchy, envelope header fields, an existing `format_version`, the Recall_Record schema, or the states, events and transitions of `opening-machine.ts`.
- Re-sealing a persona letter, unless OD3 picks option (a).
- The Ghost or the Soil on `/l/[id]` (spec 07 R17.10 stays).
- A numeric difference between the judge's answer and the record, unless OD2 says otherwise (it would need `product.md` and `neutrality.md` changes first).
- Email or other delivery, accounts, rate limiting, database backups, publishing server secrets.
- The How_Page diagram (F25). It is a later polish item, not in this spec.
- WebAuthn `hints` or any other change to the passkey options in `src/lib/crypto`. Phones already offer their own passkey provider because no `authenticatorAttachment` is set (P10.4).
- A preview deployment per PR (see OD14).

## Glossary

- **WaxSeal**: The one component that draws the orange wax seal with the pressed ghost (spec 07 R10.10), used everywhere a seal appears (L4).
- **Envelope_Flap**: The side of the Envelope with the flap closed by the WaxSeal. On `/demo` the Envelope is shown flap side up, with the card text on the body below the flap (L5).
- **Caption_Block**: The short block of sans text outside the paper, on the dark, that holds the Stage heading, the Letter_Disclosure, the line "Sealed for this demo on {date}" (or "Sealed on {date and time}" for a Live_Letter) and the Seal_Verdict (L6).
- **Light_Shaft**: The Scene's purple light as it falls on the paper after the unfold (L7, OD19).
- **Retired_Tokens**: `--desk-*` (every name with that prefix), `--gold-leaf`, `--gold-text`, `--seal` and `--ink-faded`, and the `ParchmentSurface` component (L3).
- **Next_Font_Family**: The font family name `next/font/local` generates for EB Garamond or Inter, as the `--font-serif` or `--font-sans` value set by its class on `<html>`.
- **Brand_Copy**: The one copy module, `src/components/brand/copy.ts`, that holds the Eyebrow, the Tagline, the Hero_Sentence, the five Ritual_Steps and the Seal_Mapping rows (F2).
- **Eyebrow**: "The wax seal, resurrected." shown above the landing headline.
- **Tagline**: "Memory rewrites itself. Revenant doesn't."
- **Ritual_Steps**: The README's five step names, each with a one-line description: Write, Seal the figures, Press the seal, Testify, See the receipts.
- **Seal_Mapping**: The four rows that map each part of the wax seal to its Revenant replacement, as in the README table.
- **Retired_Phrases**: The phrases user-facing copy must not contain: the retired tagline "Your past self returns with the receipts."; "rose-tinted"; and any wording that names the classroom time capsule as the thing Revenant resurrects, revives or brings back (F8).
- **Copy task**: A task whose Scope includes a copy module, a page that renders user-facing text, `src/lib/page-metadata.ts`, `src/app/layout.tsx` metadata or the Open Graph image.
- **Evidence_Sizes**: The viewports 1366×800, 1280×800, 360×640, 390×844 and 2560×1440 CSS px.
- **Phone_Sizes**: 390×844 and 360×640 CSS px. 360×640 is the strictest, and every group P criterion must pass there too.
- **First_Viewport**: what is visible at load, or at the start of a Stage or step, without any manual scroll.
- **Compact_Top_Bar**: The Top_Bar at the Phone_Sizes: at most 56 CSS px tall, wordmark, Demo chip, and the motion, sound and Skip controls in the OD13 form (P5).
- **Compact_Ghost**: The Ghost's state after the First_Step at the Phone_Sizes: at most 120 CSS px tall, next to the Step_Indicator, still holding the Envelope until the Seal_Break (P4.2).
- **Answer_List**: The compact text list of the judge's recorded answers shown in the `marks` Stage at the Phone_Sizes in place of the read-only Recall_Scales (P6.4).
- **Real_Device_Check**: The owner's check of a task on one real iPhone (Safari) and one real Android phone (Chrome) on `revenant.devclef.se` after deploy (G2.8).
- **Wide_Size**: 2560×1440 CSS px.
- **Fallback_Figure**: A figure the Figures_API serves in db mode for a Catalogue series that has no stored figure: the row with the latest period for that series in `src/lib/figures/real/fuel-figures.json`, with every field unchanged and `fallback: true` on its entry (A1).
- **Seed_Job**: The Kubernetes Job the chart renders once per Helm release revision to run the Fetch_Job right after install or upgrade (A2).
- **Production_Check**: The owner's manual check on `revenant.devclef.se` after a task's image is deployed, with the steps the task lists. Its result is recorded in the task's issue.
- **Journey_Check**: The scheduled GitHub Actions workflow and its owner-only script that walk the judge journey on `APP_ORIGIN` in a headless browser (A6).
- **Journey_Issue**: The one GitHub issue the Journey_Check opens, updates and closes.
- **Retired_Series_Message**, **Not_Yet_Message**, **Fallback_Note**: The three now-figure messages of A3: a series that left the Catalogue, a Catalogue series with no figure, and a Fallback_Figure.
- **Sealable_Count**: The number of series the Seal_Page picker offers that can be sealed now: Catalogue series in the Figures_API response whose `figure` is not null.
- **Persona_Intro**: The short card on the persona page about who wrote the letter, when, what will happen and how long it takes (C1).
- **Opening_Event**: The `opening_event` entry of a persona in the Persona_List: event name, date, publisher and `source_url` (C1).
- **Step_Indicator**: The ordered, accessible list of steps that shows the judge where they are (C2, D2).
- **Receipt_Card**: The Figure_Entry of this spec: one card per figure holding the metric name, "Your answer", Then, Now, the Number_Line and the change line in one visual group (C3).
- **Skip_Link**: The quiet text link "Skip to the receipts" that replaces "Show everything". It sends `SHOW_ALL` (C4).
- **Seal_Verdict**: The plain sentence that the seal check passed, shown before any Fingerprint (C6).
- **Letter_Disclosure**: The one line at a Persona_Letter that says the persona is fictional and gives the written-as-of date (C6). The demo seal date is a separate Caption_Block line.
- **Display_Rescale**: The display-only, exact power-of-ten rescale keyed on an exact sealed unit string, for example `EUR per 1,000 litres` shown as `EUR per litre` (C8).
- **Live_Stepper**: The one-step-per-screen layout of `/demo/live`: Write, Seal the figures, Press the seal, Wait, Testify, See the receipts (D2, F4.3).
- **Prompt_Starter**: A neutral sentence opening on the Write step that the judge can click to insert (D3).
- **Hero_Sentence**: The one plain sentence under the landing headline that says what Revenant is (B1).
- **Ritual_Section**, **Resurrection_Section**, **Sample_Receipt**, **Coven_Strip**: The four below-the-fold landing sections of B3.
- **Kiro_Stats**: The four counts the Coven_Strip shows (specs, steering docs, custom agents, hooks), computed at build time from `.kiro/` (B3.4).
- **Branded_Pages**: The site's not-found page and error page (A14).
- **Answer_Text**: The text shown for a recorded answer: the Recall_Record value through one formatter (A9.4).
- **Judge**, **Desktop_Sizes**, **Phone_Size**, **Check_Sizes**, **Check_Size**, **Letter date**, **QA agent**, **Freshness_Check**, **Last_Success_Time**, **Fetch_Failure_Check**, **Period_Age_Warning**, **Freshness_Issue**, **Unit_Helper_Line**, **Recall_Number_Parser**, **Figures_Heading**, **Letter_Text**, **Then_Value**, **Now_Value**, **Answer_Value**, **Unit_Range_Table**, **Fallback_Range**, **Hero**, **First_Step**, **Landing_Ghost**, **Fingerprint**, **PRF_Hint**, **Catalogue**, **Fetch_Job**, **Figures_API**, **Fallback_Refresh**, **Real_Letter**, **Real_Seal_Page**, **How_Page**, **Owner_Patch**: as defined in spec 08.
- **Scene**, **Ghost**, **Idle_Bob**, **Soil**, **Soil_Fallback**, **Emergence**, **Envelope**, **Envelope_Front**, **Pick_Up_Button**, **Top_Bar**, **Letter_Block**, **Accent**, **Text_On_Purple**, **Calm_Mode**, **Figure_Entry**, **Content_Column**, **Scene_Frame**, **Ghost_Box**, **Ghost_Body_Box**, **Demo_2_On**, **Recall_Pager**, **Scoring_Words_Always**, **Scoring_Words_Scene**, **Scene_Copy_Modules**: as defined in spec 07.
- **Ceremony**, **Stage**, **Skip**, **Mark**, **Recall_Scale**, **Number_Line**, **Seal_Break**: as defined in spec 05.
- **Persona_List**, **recall_subject**, **Persona_Letter**, **Recall_Generator**, **Recall_Record**, **Demo_Index**, **Opening_Flow**, **Reveal**, **Then_Figure**, **Now_Figure**, **Comparable**, **Fixture_Figure**, **Demo_Key**: as defined in spec 03.
- **Live_Letter**, **Letter_Page**, **Seal_Page**, **Sealing_Flow**, **PRF_Check**, **Backup_Fallback**, **Create_Press**, **Confirm_Press**: as defined in spec 06.

## Requirements

### G1. Roles and boundaries

**User story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

1. THE task's PR SHALL change only files that are matched by the task role's paths or the `shared` list in `.github/agents.json` and are listed in the task's Scope.
2. THE frontend-dev and platform-dev tasks SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`.
3. WHEN a task needs a change to `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`, THE task SHALL attach the change as an Owner_Patch to its issue or PR description, and its PR diff SHALL contain no change to that file.
4. IF a frontend-dev PR changes `src/app/page.tsx`, `src/app/layout.tsx` or `src/app/globals.css`, THEN THE QA agent SHALL fail the PR and name each such file.
5. THE PRs SHALL keep spec 08 R1.4 to R1.6: the states, events and transitions of `opening-machine.ts` unchanged; the CSP header value byte-identical; no browser request to another origin; nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment; no new entry in the `dependencies` object of `package.json`.
6. THE PRs SHALL add no animation library, no WebGL, no new font, and no sound or vibration cue, and every route SHALL stay at or under its budget in `scripts/check-js-budget.mjs`.
7. THE PRs SHALL change no crypto primitive, key hierarchy step, envelope header field, existing `format_version` or the Recall_Record schema.
8. EVERY user-facing string a PR adds or changes SHALL live in its feature folder's copy module, SHALL pass the `neutrality.md` copy test and the `tone.md` copy rules (second person, at most 25 words per sentence, no exclamation mark, no pun), and SHALL contain none of the Scoring_Words_Always; strings in the Scene_Copy_Modules SHALL also contain none of the Scoring_Words_Scene.
9. THE Accent SHALL mark only the reader's own answer, the main buttons, the wax and the focus ring outside the Letter_Block (spec 07 R3.9 to R3.11). It SHALL NOT mark a figure value, a change, a direction or a step that is not the judge's own action.

### G2. Tests and evidence

**User story:** As the owner, I want proof from the browser and from production, so that a task that passes locally can't fail silently on the live site.

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser (spec 08 R30.1).
2. THE property tests the design lists SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 09-demo-polish, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the commit SHA, the exit status and PASS or FAIL in its PR description.
4. EACH task that changes anything on screen SHALL attach PNG screenshots of every Stage or page it changes at each of the Evidence_Sizes, and of every Stage of every page it touches at both Phone_Sizes, named `<stage-or-page>-<width>x<height>.png`. Phone shots SHALL be First_Viewport captures (no full-page stitching), plus one full-page capture per page.
5. EACH task's PR description SHALL state every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, every earlier-spec test it changed or retired with the reason, every asset it added with its size in bytes, and every Owner_Patch it attaches, writing "none" for an empty list.
6. EACH group A and group C task SHALL state a Production_Check: the exact steps the owner runs on `https://revenant.devclef.se` after the image is deployed, and the result that counts as a pass. THE owner SHALL record the result in the task's issue. A failed Production_Check SHALL be handled as OD14 describes: a fix task, and `Blocked by #<fix issue>` in the next task's issue body.
7. THE QA agent SHALL run the rows of the design's "QA browser steps" table that the task lists, found with the pattern `^\| 09 \|`, and the `npm run layout-check` checks the task's "QA check" lines name, passed with `--require` so that only those can block (design, Owner patch q). A phone check a task doesn't name, for a page a later task rebuilds, is not a finding.
8. EACH task that changes anything on screen SHALL state a Real_Device_Check: the steps the owner runs on one real iPhone (Safari) and one real Android phone (Chrome) on `revenant.devclef.se` after deploy, and the result that counts as a pass. THE owner SHALL record both results in the task's issue after deploy, and a failure SHALL be handled as OD14 describes. Every P9 criterion SHALL be verified this way, because headless checks don't show the on-screen keyboard.

9. EACH copy task SHALL attach a search of the rendered text of `/`, `/demo`, `/demo/personas/us-maya` and `/demo/personas/eu-tomas` through to `close`, `/demo/live` through every step, `/how-it-is-sealed` and the Open Graph image's text (from its source) showing that no Retired_Phrase remains, and the result of `node tools/hooks/tone-check.mjs` for every copy file it changed (the `copy-tone-check` IDE hook doesn't run in the Crew loop).

10. EACH group L task SHALL attach its screenshots at 1366×800, 1280×800, 390×844, 360×640 and 2560×1440, taken after `document.fonts.ready` resolves, with the FONT1 font-loaded check result (design, Owner patch q).
11. EACH group L task's Real_Device_Check SHALL include one real Mac with Safari and one Windows PC with Chrome, besides the two phones. Georgia is installed on both, so a font regression shows there first.

### G3. Task order and cuts

**User story:** As the owner, I want the work in priority order with a clear cut line, so that production health never waits for polish.

1. THE tasks SHALL be numbered so that every group A task has a lower number than every group B task, every group B task lower than every group C task, every group C task lower than every group D task, and every group D task lower than every group E task.
2. EACH task SHALL be one GitHub issue and one PR for one role, with a changed-line estimate at or under `max_changed_lines` in `.github/agents.json` (5,000).
3. THE owner SHALL merge no group B, C, D or E PR while a group A task (including the L1 font task) is open, unless the group A task's issue records a blocker that the owner accepts.
4. WHEN a PR merges, `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]`, `/demo/personas/us-maya` and `/demo/personas/eu-tomas` SHALL load without error, with each persona flow reaching the `close` Stage from `/`.
5. IF the 27 November 2026 freeze is at risk, THEN THE owner SHALL cut work in this order: D1 and D3, then C5 and the B3.4 Coven_Strip. THE owner SHALL cut nothing in group A.
6. IF a task is cut or not merged by the end of 27 November 2026, THEN its issue SHALL be closed unmerged, and the group E audit (E1.1) SHALL remove every claim that depends on it.
7. THE group P criteria SHALL be acceptance criteria of the task that owns each page: P1, P2, P3 and P11 in the landing tasks; P3 to P9 in the persona-journey tasks, each for the Stages it changes; P8 to P10 in the live-demo task. WHERE a task becomes too big for one PR, it SHALL be split by page or by Stage, still inside one role's paths. No task SHALL be cut for group P alone, and group P SHALL NOT move to a task at the end.

### Group F. Framing

Every user-facing statement follows `README.md` on `main`. Steering comes first.

### F1. Steering first

**User story:** As the owner, I want steering to carry the new framing before any agent writes copy, so that no agent repeats the old one.

1. BEFORE any copy task is dispatched, THE owner SHALL commit the Owner_Patches for `.kiro/steering/product.md` and `.kiro/steering/tone.md` (design, Owner patches w and x). EVERY copy task SHALL list "steering updated (Owner patches w and x on `main`)" under "Before this task".
2. THE `product.md` patch SHALL change only these items, keeping everything else: the tagline; the "technology being resurrected" sentence (the wax seal and the plis cachetés, with the classroom time capsule as an example); "The problem" (memory rewrites itself); a new line on what's new (testify before you read; the gap between testimony and record is the product; Revenant never says what it means); and the core-loop and demo step names (Write, Seal the figures, Press the seal, Testify, See the receipts).
3. THE `tone.md` patch SHALL open with the wax-seal framing; SHALL add "testify", "testimony", "the record" and "see the receipts" to the product vocabulary; SHALL change its "Good" example to testify wording; and SHALL add the rule that testimony words stay calm and never accuse: no "cross-examine", "caught", "wrong", "you misremembered" or any wording that grades the testimony, anywhere in the UI. THE "Respectful" bullet and the "Never mock them for misremembering" sentence SHALL stay exactly as they are.
4. NO role agent SHALL commit either file (G1.3).

### F2. One source for the framing

**User story:** As the owner, I want the framing in one module, so that it can't drift again.

1. THE Brand_Copy module SHALL hold, as the only definitions in `src/`: the Eyebrow; the Tagline; the Hero_Sentence; the five Ritual_Steps, each with a name and a one-line description; and the four Seal_Mapping rows (part of the wax seal, its Revenant replacement).
2. THE landing page, the site metadata (`src/lib/page-metadata.ts`, `src/app/layout.tsx`), the Open Graph image, the How_Page, the persona Step_Indicator and the Live_Stepper SHALL import these strings from the Brand_Copy module, and SHALL define none of them themselves.
3. THE Open Graph image SHALL draw the Eyebrow and the Tagline with the original ghost. No text in it SHALL use the Accent; the Accent MAY appear only on a wax seal drawing (`tone.md`: orange means "you", and the wax). Its `ASSETS.md` entry SHALL be updated.
4. A test SHALL fail unless the Tagline string appears in exactly one non-test source file under `src/` (the Brand_Copy module).

### F3. The landing hero

**User story:** As a judge, I want the first words to say what was resurrected and why it matters.

1. THE landing hero SHALL show, in order: the Eyebrow; the headline, which is the Tagline; and the Hero_Sentence, which says what you do: seal a letter with real fuel prices for the US or the EU, and when it opens you testify first, then see the receipts. THE final wording is OD18.
2. THE Hero_Sentence SHALL name only figures the Catalogue serves (spec 08 R10.2) and SHALL pass the `neutrality.md` copy test.
3. THE headline SHALL keep "Revenant doesn't." together on its last line, SHALL use no Accent, and SHALL meet P3 (at most 3 lines on `/` at 360×640).
4. THE hero copy of B1.2 is replaced by this requirement. B1.3 and B1.4 (the two calls to action) stay.

### F4. Ritual names everywhere

**User story:** As a judge, I want the same five words for the ritual wherever I meet it.

1. THE Ritual_Steps' names SHALL be the names used in the landing Ritual_Section (B3.2), the persona Step_Indicator (C2), the Live_Stepper (D2), and the Stage headings and buttons.
2. THE persona Step_Indicator SHALL read: Testify, Break the seal, Read, See the receipts.
3. THE Live_Stepper SHALL read: Write, Seal the figures, Press the seal, Wait, Testify, See the receipts. "Press the seal" names the sealing step, and its passkey control MAY read "Press the seal with your passkey".
4. THE Stage copy SHALL use the ritual vocabulary: the marks heading "Your testimony", the button "See the receipts", the Figures_Heading "The receipts", and a recall intro that asks the judge to testify before reading. THE exact strings SHALL follow the committed `tone.md` (design, "Copy").
5. NO user-facing string SHALL use "Recall first", "Reveal" as a step name, "Snapshot", "Rest" or "Return" as ritual names.

### F5. The closing line

**User story:** As a judge, I want the last line to set my testimony beside the record and leave the meaning to me.

1. THE close's first line SHALL name your testimony and the record, and SHALL leave what the gap means to the reader, as the README does ("Revenant never tells you what that gap means").
2. IT SHALL contain no judgement, no direction word (spec 03 R2.4 list) and none of the Scoring_Words_Always or Scoring_Words_Scene. This replaces C7.1's wording; C7.2 stays.

### F6. "What we resurrected" and "What no wax seal could do"

**User story:** As a judge who scrolls, I want the two halves of the idea: what came back, and what's new.

1. THE Resurrection_Section (B3.3) SHALL paraphrase the README's "What we resurrected": the pli cacheté story, with the classroom time capsule as an example, and the Seal_Mapping table from the Brand_Copy module.
2. A NEW section, "What no wax seal could do", SHALL follow it and paraphrase that README section in at most three sentences: a seal proves the letter wasn't changed, not that your memory wasn't; so Revenant asks you to testify before you read; and it never says what the gap means.
3. NEITHER section SHALL use the words F1.3 bans, even where the README does (for example "cross-examine").

### F7. The Tagline in one place

**User story:** As a judge moving through the site, I want each page to say where I am, not repeat the slogan.

1. WHERE OD17 keeps its default, THE Tagline SHALL appear on `/` and in the site metadata and Open Graph image only. THE persona page SHALL use its own heading, "{name}'s letter", `/demo` "The demo letters", and `/demo/live` "Seal your own letter", in the headline position and style.
2. THE page headings SHALL still meet P3, spec 07 R8.9 (the largest text in the viewport) and spec 07 R21.3 (the LCP element).

### F8. Retired-phrase guard

**User story:** As the owner, I want a check that stops the old framing coming back.

1. A unit test SHALL scan every non-test source file under `src/` and `content/personas/`, and fail on a Retired_Phrase, naming the file and line.
2. THE classroom time capsule MAY appear as part of the story. THE test SHALL flag it only where a sentence names it as what Revenant resurrects, revives or brings back.
3. THE `copy-tone-check` hook SHALL flag the same phrases (design, Owner patch y).
4. THE Journey_Check SHALL fail if a Retired_Phrase appears in the rendered HTML of the pages it opens.

### F9. Owner steps for the framing

1. THE owner SHALL change the GitHub About description to the Eyebrow and the Tagline.
2. THE owner SHALL replace `docs/concept.png` at the top of the README with a real screenshot or GIF of the reveal once spec 09 is live. IF it stays, THEN the owner SHALL move it down and caption it as the early concept.
3. THE owner SHALL update the Devpost description to the same framing.

### Group L. Letters and type

### L1. Fonts that load

**User story:** As a judge, I want the site in its own type, so that it looks designed, not defaulted.

1. `src/app/globals.css` SHALL NOT set `--font-serif` or `--font-sans` in `:root` or anywhere else. ONLY the `next/font/local` classes on `<html>` SHALL set them.
2. THE fallback stacks (Georgia and the system serif for EB Garamond; `system-ui` and the system sans for Inter) SHALL be passed through `localFont`'s `fallback` option.
3. THE consts in `src/app/layout.tsx` SHALL be renamed (for example `ebGaramond` and `inter`), so the generated family names don't read as the generic `serif` and `sans`.
4. AFTER load, `document.fonts` SHALL report Inter as loaded on every page, and EB Garamond as loaded on every page that shows the Letter_Text. A browser loads a face only when some rendered text uses it, so EB Garamond stays unloaded where no letter is shown, and that is correct. THE computed `font-family` of `body` SHALL start with the Inter Next_Font_Family, and of the Letter_Text, where shown, with the EB Garamond one.
5. A unit test SHALL check criteria 1 to 3 from the source. THE layout check (FONT1) and the Journey_Check SHALL check criterion 4 in a browser, because `npm test` runs no browser (G2.1).
6. THIS SHALL be a platform-dev task in group A, because it changes every page.

### L2. One type system

**User story:** As a judge, I want one confident sans for the interface and a serif only for the letter.

1. HEADINGS, question titles, persona names, the wordmark and buttons SHALL use the sans at a heavy weight (`tone.md`, spec 07 R3.3, R3.4). THE design SHALL state the scale, weights and letter-spacing.
2. THE serif SHALL appear only in the letter's own text: salutation, body and sign-off (the Letter_Text).
3. A test SHALL fail if any CSS file other than the Letter_Text module sets `font-family` to the serif or references `--font-serif`. THE Open Graph image is not CSS and is not covered by this test.

### L3. Retire the attic theme

**User story:** As the owner, I want the old theme gone from the code, so that no agent reuses it.

1. THE Retired_Tokens SHALL be deleted, and every user SHALL move to the `tone.md` palette: near-black, purple light, white, warm paper for the letter only, and one orange.
2. A test SHALL fail if any CSS, TS or TSX file under `src/` defines or references a Retired_Token or imports `ParchmentSurface`.
3. THE contrast tests SHALL be updated to the remaining token pairs, and SHALL keep every threshold (spec 07 R4).

### L4. One wax seal

**User story:** As a judge, I want the seal to be one object I recognise everywhere.

1. ONE WaxSeal component SHALL draw every seal: on the `/demo` envelopes, on the persona Envelope's flap, at the press-and-hold Stage, during the Seal_Break, and in the Open Graph image if it shows one (from the same drawing data).
2. THE WaxSeal SHALL look the same everywhere (orange, the pressed ghost, the same proportions), and SHALL sit where a seal sits physically: on the flap, closing the envelope.
3. THE Envelope_Front SHALL show no seal, postmark or seal-like circle.

### L5. Demo letters are sealed envelopes

**User story:** As a judge on `/demo`, I want each letter to look like a sealed letter I can open.

1. ON `/demo`, each persona SHALL be a closed Envelope, the same drawing as on the persona page, shown flap side up with the WaxSeal on the flap.
2. THE envelope SHALL show only who and where (display name and region), "Written as of {date}", and "Opens {date}" followed, where the persona's Persona_List entry has an Opening_Event, by the event's plain name (for example "Opens 9 June 2024 · European Parliament election"). It SHALL show no sealed date (OD20). The event's source stays one tap away in the Persona_Intro (C1.1), because the whole envelope is one link (criterion 3) and holds no second link. The text is in the sans, at least 14 px at the Phone_Sizes, with WCAG 2.2 AA contrast on the paper.
3. THE action SHALL be an orange button "Open {name}'s letter", and the whole envelope SHALL be one link target with that accessible name.
4. THE envelopes SHALL sit side by side at the Desktop_Sizes and the Wide_Size, aligned to the heading's left edge, and SHALL stack at the Phone_Sizes.
5. `/demo` SHALL have no gold borders and no underlined text link as the open action.
6. EVERY envelope SHALL have the same size and drawing whatever its letter holds (spec 05 R3.6, spec 07 R10.2).

### L6. The paper holds only the letter

**User story:** As a judge, I want the letter alone on the paper, so that it reads like something someone wrote.

1. IN the reveal, the paper SHALL contain the Letter_Text alone.
2. THE Stage heading (F4), the Letter_Disclosure (C6.3), the line "Sealed for this demo on {date}" with the header's `sealedAt` for a Persona_Letter, or "Sealed on {date and time}" for a Live_Letter (spec 06 R18.2), and the Seal_Verdict with its Fingerprint control (C6.4) SHALL sit outside the paper, on the dark, as the Caption_Block in the sans.
3. THE demo disclaimer SHALL be one caption line, not a bordered box.
4. THE heading SHALL stay a real heading for focus and assistive technology (spec 08 R2), and the Caption_Block SHALL come before the paper in document order.
5. THE Letter_Text SHALL stay one text node with `white-space: pre-wrap` (spec 07 R13.3).

### L7. Light, not a bezel

**User story:** As a judge, I want the letter lit, not framed.

1. THE solid purple slab behind the paper SHALL be replaced by the Light_Shaft (OD19): the Scene's purple shaft moves from the Soil to the paper at the unfold, and lights the paper's top edge and the dark around it.
2. THE paper's text area SHALL stay flat `--paper`, with no gradient or glow over text.
3. AT the Phone_Sizes, the lit area above the paper SHALL be at most 80 CSS px tall.
4. THE receipts column SHALL stay on plain dark.
5. UNDER reduced motion or Calm_Mode, THE light SHALL be static in its end position.
6. THE light SHALL use CSS gradients only, animate only `transform` and `opacity`, and keep every contrast pair at WCAG 2.2 AA.

### L8. Real creases

**User story:** As a judge, I want the folds to look like a letter folded in three.

1. THE creases SHALL be horizontal, at one third and two thirds of the paper's height, run its full width, at low contrast, and SHALL pass the existing contrast composite test for every letter character over them (spec 07 R13.2).
2. THE creases SHALL be hidden from assistive technology. IF the design drops them, THEN it SHALL say so.

### L9. Same language for live letters

1. THE letter card shown after sealing on `/demo/live` (with the QR code and the calendar file) and the Live_Letter reveal SHALL use the same Envelope, WaxSeal and paper rules (L4, L6 to L8).
2. THE card's contents (link, QR code, opening date, Fingerprint, nothing secret) SHALL stay as spec 06 R20 and spec 08 R14 define them.

### L10. Out of scope for this group

1. THE persona letter texts SHALL stay as they are. They are everyday, neutral and tie into the figures.

### A1. Figures never silently empty

**User story:** As a judge opening a persona letter, I want a now figure for every sealed series, so that the reveal never shows a blank where a number should be.

1. WHILE the Figures_API is in db mode and the database read succeeds, THE Figures_API SHALL return, for each Catalogue series, the stored figure with the latest period if one exists, and otherwise that series' Fallback_Figure if the bundled file holds one.
2. THE Fallback_Figure SHALL be copied from `src/lib/figures/real/fuel-figures.json` with value, unit, region, period, source, series ID, `source_url` and `retrieved_at` unchanged. It SHALL NOT be a Fixture_Figure, and SHALL NOT come from `DEMO_FIGURES` fixture data.
3. EACH series entry SHALL carry a boolean `fallback`, `true` only when the entry's figure is a Fallback_Figure, and `false` for a stored figure, for a file-mode figure and when `figure` is null.
4. THE Fallback_Figure SHALL leave `last_success_at` unchanged, so the Freshness_Check's Fetch_Failure_Check still fails for a series that has never been fetched (spec 08 R21.7).
5. IF the database read fails, THEN THE Figures_API SHALL answer HTTP 500 as before, with no partial list and no Fallback_Figure.
6. THE browser parser SHALL accept a series entry with or without `fallback`, and SHALL treat a missing `fallback` as `false`, so a response cached before the deploy still parses.
7. THE Freshness_Check script SHALL accept the `fallback` field and keep its classification unchanged.
8. WHEN the Reveal or the Seal_Page shows a Fallback_Figure, THE page SHALL show its period and its real `retrieved_at` date next to it, and SHALL NOT use "today", "current", "latest" or "live" for it (spec 08 R21.3, R21.4).
9. THE Figures_API SHALL accept no parameter that names or filters a series (spec 08 R20.8).

### A2. Seed on deploy

**User story:** As the owner, I want a fresh deploy to fetch figures straight away, so that a new install doesn't wait until 06:17 UTC the next day.

1. WHEN the chart is installed or upgraded with `fetchFigures.seedOnDeploy` true (the default), THE chart SHALL create one Seed_Job for that Helm release revision that runs the Fetch_Job from the app image.
2. THE Seed_Job SHALL wait for the figures tables to exist, for at most the number of seconds the design states, before its first figure request, and SHALL exit 1 with the reason "schema" if they don't appear in time.
3. THE Seed_Job SHALL NOT block the web Deployment's rollout: it SHALL be a plain Job, not a Helm hook, and nothing in the chart SHALL wait for it.
4. WHEN a Seed_Job run fails, THE failed Job and its pod logs SHALL stay in the cluster until the next release revision replaces the Job (`backoffLimit: 0`, no `ttlSecondsAfterFinished`).
5. IF a Seed_Job and a scheduled Fetch_Job run at the same time, THEN only one SHALL fetch and store; the other SHALL log "another run in progress", store nothing and exit 0.
6. THE chart change SHALL update `values.yaml`, the chart README and `NOTES.txt`, and SHALL bump the chart `version` (`tech.md`, `deploy.md`).

### A3. Honest unavailable states

**User story:** As a judge, I want the reason for a missing now figure to be true, so that I trust everything else the page says.

1. IF a sealed series has no matching entry in the Figures_API response, THEN THE Reveal SHALL show the Retired_Series_Message, which says Revenant no longer publishes this series.
2. IF a sealed series has a matching entry with `figure: null`, THEN THE Reveal SHALL show the Not_Yet_Message, which says Revenant has not fetched a figure for this series yet and that the sealed figure is shown on its own. It SHALL NOT say the series is no longer published.
3. IF the Figures_API request fails or its body doesn't parse, THEN THE Reveal SHALL keep showing `nowUnavailableFetch` (spec 08 R20.10).
4. WHEN a Now_Figure is a Fallback_Figure, THE Reveal SHALL show the Fallback_Note next to it: that Revenant has not fetched a newer figure yet, with the figure's retrieved date. A Fallback_Figure SHALL otherwise render and compare like any Now_Figure.
5. IN every case of criteria 1 to 3, THE Reveal SHALL still show the Then_Figure with its period, and SHALL show no Number_Line and no change line.
6. THE three messages SHALL follow `tone.md` and spec 08 R21.4, and a copy test SHALL assert each one and the absence of "today", "current", "latest" and "live".

### A4. Live picker empty state and validation timing

**User story:** As a judge on the live demo, I want a clear message if no figure can be sealed, and no errors before I've done anything.

1. WHILE the Sealable_Count is 0, THE Seal_Page SHALL show one in-voice message that says no figure can be sealed right now and what the judge can do (try again later, or open a persona letter, with a link to `/demo`), and SHALL show no range or limit text.
2. NO Seal_Page string SHALL contain "between 1 and 0", "no more than 0" or a count of 0 inside a range or a limit, for any Sealable_Count from 0 to 6.
3. THE picker copy SHALL use a singular form when the stated maximum is 1 and a plural form otherwise. The stated maximum SHALL be the smaller of `MAX_FIGURES` and the Sealable_Count (spec 08 R10.7).
4. THE Seal_Page SHALL show a validation message for a field only after the judge has changed or left that field, or after the judge has tried to seal or to leave the step. On first load it SHALL show none.
5. WHILE the Figures_API request is in flight, THE picker SHALL show a loading line and no validation message. IF it fails, THEN THE picker SHALL show the existing failure message and block sealing (spec 08 design, "The Figures_API").

### A5. Favicon in the image

**User story:** As a judge, I want the tab to show Revenant's icon, so that the site looks finished.

1. THE Dockerfile runner stage SHALL copy `public/` into the image, owned by the non-root user, so `/icon.svg` is served by the standalone server.
2. A test in `npm test` SHALL fail if the Dockerfile has no runner-stage copy of `public/`.
3. THE CI smoke job (Owner_Patch) SHALL request `/icon.svg` and `/opengraph-image` from the built image and fail unless each returns 200.
4. WHEN the deployed image serves `https://revenant.devclef.se/icon.svg`, THE response SHALL be HTTP 200 with an SVG content type.

### A6. Production judge-journey check (Owner_Patch)

**User story:** As the owner, I want production checked by a robot every few hours, so that the next F1 is an issue in my inbox, not a judge's first impression.

1. THE Journey_Check SHALL be a GitHub Actions workflow under `.github/workflows/` with a schedule that starts a run at least every 6 hours through 29 January 2027, plus `workflow_dispatch`, delivered as an Owner_Patch.
2. THE Journey_Check SHALL run a headless browser against `APP_ORIGIN` (`https://revenant.devclef.se`) using the pinned `playwright-core` devDependency, and SHALL fail the run if any of these is false:
   1. every series in `/api/figures` has a non-null `figure`;
   2. on `/demo/personas/us-maya` and `/demo/personas/eu-tomas`, every Figure_Entry at the `close` Stage shows a Now_Value with a retrieved date;
   3. the `/demo/live` picker offers at least one figure that can be chosen;
   4. `/icon.svg` and `/opengraph-image` return HTTP 200;
   5. `/`, `/demo`, `/demo/live`, `/how-it-is-sealed` and the `intact` Stage of both persona pages have a document scroll width at most their client width at each Evidence_Size;
   6. once the matching tasks are merged, the phone checks PH1 to PH7 (design, Owner patch q) pass at both Phone_Sizes on `/`, both persona pages and `/demo/live`. A phone check whose element is not on production yet prints a note, not a failure.
3. WHEN a run fails, THE Journey_Check SHALL open one Journey_Issue assigned to `devclef`, or add a comment to the open one, listing each failed check with its measured value. WHEN a run passes and a Journey_Issue is open, it SHALL close it with a comment.
4. THE Journey_Check SHALL use only the workflow's `GITHUB_TOKEN` with `issues: write`, and no app secret, database credential or source key.
5. THE Journey_Check SHALL make network requests only to `APP_ORIGIN` and `api.github.com`.
6. THE persona reveal check (criterion 2.2) appends a Recall_Record to the production openings table on every run it executes. THE design SHALL state how often it runs (OD8).
7. THE same Owner_Patch set SHALL include the spec 08 Freshness_Check, keepalive and labels patches (spec 08 design, Owner patches i and j) if they are not on `main`, and the keepalive SHALL also re-enable the Journey_Check workflow.
8. WHEN the owner first runs the Journey_Check by hand before tasks 1 to 3 are deployed, THE run SHALL fail on criteria 2.1, 2.2, 2.3 and 2.4, which shows it detects F1, F2 and F4.

### A7. "Your answer" on every Figure_Entry

**User story:** As a judge, I want my answer next to every record, whatever happened to the now figure.

1. EVERY Figure_Entry SHALL show the visible text "Your answer" exactly once (spec 08 R4.3), in the Comparable, not-Comparable, Retired_Series_Message, Not_Yet_Message and fetch-failed branches.
2. IN a branch with no Number_Line, THE Figure_Entry SHALL show "Your answer" on its own line followed by the Answer_Text and unit in the Accent, or "No answer" (spec 08 R4.5).
3. A unit test SHALL cover each branch of criterion 1 and assert the count of "Your answer" is exactly 1.

### A8. No overflowing controls

**User story:** As a judge, I want every button label inside its button, so that the site looks built, not broken.

1. AT each Evidence_Size, in every Stage of both persona pages and every step of `/demo/live`, EVERY `button` and every link styled as a button SHALL have `scrollWidth` at most its `clientWidth`, measured after web fonts load.
2. AT each Evidence_Size, EVERY control's bounding box SHALL lie inside the bounding box of its card and of its enclosing `fieldset`, if it has one.
3. THE design SHALL state one breakpoint width. BELOW it, THE recall number field and its next or submit control SHALL stack vertically, each at full card width.
4. A button label SHALL wrap onto a second line rather than overflow, and SHALL NOT be clipped, truncated with an ellipsis or shrunk below the body text size.

### A9. Marks card legibility and one answer format

**User story:** As a judge, I want to see which answer belongs to which figure, written the way I typed it.

1. EACH read-only Recall_Scale SHALL show its metric's display name above the scale, as visible text.
2. AT each Evidence_Size, no label, tick label or Mark of one read-only Recall_Scale SHALL intersect any label, tick label or Mark of another Recall_Scale on the same card.
3. THE design SHALL state the minimum vertical gap between two read-only Recall_Scales, at least 24 CSS px between one scale's lowest box and the next scale's name.
4. EVERY place that shows a recorded answer (the recall field's parsed value, the live scale label, the marks card, the Figure_Entry and the Number_Line label) SHALL show the Answer_Text from one formatter, which keeps every digit of the Recall_Record value, including trailing zeros ("3.90", never "3.9"), with the R15.4 separators of spec 08 for the figure's region.

### A10. Even ticks

**User story:** As a judge, I want the scale's numbers evenly spaced, so that no tick looks missing.

1. THE Recall_Scale SHALL draw the tick labels at every k-th entry of the range's tick list, starting at the first, where k is the smallest divisor of (number of ticks − 1) for which no two drawn labels come within the tick gap of each other. The first and last ticks SHALL always be drawn.
2. FOR ANY Unit_Range_Table entry, track width at or above the minimum track width, and label widths up to the design's maximum, THE drawn ticks SHALL be evenly spaced in value, SHALL include both ends, and SHALL not overlap (property test).
3. FOR the EUR per 1,000 litres range at a track too narrow for seven labels, THE Recall_Scale SHALL draw 0, 1,000, 2,000 and 3,000, never 0, 500, 1,000, 1,500, 2,000 and 3,000.

### A11. The Ghost leaves cleanly

**User story:** As a judge, I want the Ghost to deliver the letter and go, not hide behind the cards.

1. THE design SHALL choose that the Ghost leaves with a defined exit after the Seal_Break (spec 07 R12.6), and SHALL state the exit's duration and motion.
2. WHILE the exit runs, THE Ghost SHALL be drawn above every Stage card and SHALL move only by `transform` and `opacity`.
3. WHEN the exit ends, or at once under Calm_Mode, Skip or the Skip_Link, THE Ghost element SHALL be removed from the document.
4. WHILE the Stage is `letter`, `figures` or `close`, at every Evidence_Size, THE document SHALL contain no Ghost element.

### A12. Focus styling

**User story:** As a mouse or touch user, I want no stray focus box on headings, while keyboard users keep theirs.

1. A heading that receives programmatic focus (`tabIndex={-1}`) SHALL show no outline when focus came from a pointer or touch action or from script, and SHALL show the spec 07 focus ring when `:focus-visible` matches.
2. EVERY interactive control SHALL keep a visible focus ring under `:focus-visible` with the spec 07 R3.14 contrast.
3. THE change SHALL keep the spec 08 R2 focus moves: the active element after the button that moves to the figures ("See the numbers", renamed "See the receipts" by F4.4) and after the Skip_Link SHALL still be the Figures_Heading.

### A13. Accessible recall field

**User story:** As a screen reader user, I want the recall field named by its question.

1. EACH recall number field SHALL have an accessible name equal to its question text, through a `<label>` or `aria-labelledby` pointing at the question heading.
2. THE field SHALL keep its existing `aria-describedby` for the unit, the parsed value and any message.
3. A test SHALL assert, for every question of both persona letters, that the field's `aria-labelledby` or `<label for>` resolves to the question text.

### A14. Branded not-found and error pages

**User story:** As a judge who types a wrong URL, I want to stay in Revenant, with a way back.

1. WHEN a route doesn't exist, THE site SHALL return HTTP 404 with a page that uses the Top_Bar, the Scene (Soil_Fallback, no Ghost), one heading, one in-voice line, a link to `/demo` and the footer.
2. WHEN a page throws during render, THE site SHALL show an error page with the same parts, a "Try again" control and a link to `/demo`. It SHALL show no stack trace, error message or digest.
3. THE Branded_Pages SHALL be server components except where Next.js requires a client component (the error boundary), and SHALL load no Soil_Canvas, crypto or Opening_Flow code.
4. THE existing `/l/[id]` and persona not-found pages SHALL keep their own text.

### Group P. Phone first

Every criterion in this group holds at both Phone_Sizes. The landing task meets P1, P2, P3 and P11; the persona-journey tasks meet P3 to P9; the live-demo task meets P8 to P10 (G3.7). Every rule of steering, of specs 03 to 08 and of the rest of this spec still holds, except where "Rules this spec replaces" names it.

### P1. The first screen of `/`

**User story:** As a judge who opened the link on a phone, I want to see what Revenant is and both ways in, without scrolling.

1. THE First_Viewport of `/` SHALL show, each fully inside it:
   1. the headline;
   2. the Hero_Sentence;
   3. the primary call to action with its time cost (B1.3);
   4. WHILE Demo_2_On is true, the secondary call to action (B1.4);
   5. the Landing_Ghost, at a height of at most 30% of the viewport height, placed as OD12 decides.
2. THE Landing_Ghost SHALL NOT sit behind any text, and its Ghost_Body_Box SHALL NOT intersect any text or control (spec 08 R9.11, `tone.md` contrast rule), unless OD12 picks "behind" and its conditions are met.
3. THE purple light SHALL stay centred on the Landing_Ghost within 1 CSS px (spec 08 R9.3).

### P2. No dead space

**User story:** As a judge on a phone, I want every pixel of the first screen to carry something.

1. ON `/`, and on the persona page before the First_Step, no vertical gap between two consecutive content blocks inside the First_Viewport SHALL be taller than 64 CSS px. A content block is a text block, a control, a card or the Ghost_Body_Box. The Soil band does not count as a gap.

### P3. Headline wrapping

**User story:** As a judge on a phone, I want the headline to read as a sentence, not a word list.

1. THE headline SHALL wrap to at most 3 lines on `/` and at most 2 lines on the persona page and on `/demo/live`.
2. NO line of the headline SHALL hold a single word, unless that word ends the headline. "Revenant doesn't." SHALL stay together on the last line of the Tagline (F3.3).
3. THE design SHALL state the headline's `font-size` clamp for each page, and the headline SHALL use balanced wrapping (`text-wrap: balance`).
4. WHILE the headline is shown, it SHALL still be the largest text in the viewport (spec 07 R8.9).

### P4. One control per screen on the persona page

**User story:** As a judge on a phone, I want each Stage's next action on screen when the Stage begins.

1. WHEN each Stage below begins, with the page scrolled to the top of the Stage content, its primary control SHALL be fully inside the First_Viewport:
   1. `intact`: the Pick_Up_Button;
   2. `recall`: the current question's number field and its Next or submit control;
   3. `marks`: the pressable seal and the "Break the seal" button;
   4. `letter`: "See the receipts", or, if the letter is longer than the viewport, the start of the Letter_Text, with "See the receipts" directly after the letter;
   5. `figures`: the first Receipt_Card.
2. AFTER the First_Step, THE Hero SHALL collapse to one line or hide, and THE Ghost SHALL take the Compact_Ghost state: at most 120 CSS px tall, next to the Step_Indicator, still holding the Envelope with the wax seal side out until the Seal_Break (spec 07 R10.13). THE seal's pointer target SHALL stay at least 44×44 CSS px (spec 07 R10.16).
3. THE Compact_Ghost and the Hero change SHALL use `transform` and `opacity` only, and SHALL show their final state in the first frame under Calm_Mode or reduced motion.

### P5. Compact_Top_Bar

**User story:** As a judge on a phone, I want the bar at the top to take a sliver of the screen, not a sixth.

1. THE Top_Bar SHALL be at most 56 CSS px tall on every page, measured in the browser with Inter loaded.
2. THE motion, sound and Skip controls SHALL take the form OD13 decides. Each SHALL have an accessible name equal to its current text label in the copy module (for example "Turn off motion"), SHALL be at least 44×44 CSS px, and SHALL keep its spec 05 and spec 07 behaviour: Calm visible wherever anything moves (spec 05 R11.3), Skip visible and keyboard reachable while a sequence runs (spec 07 R8.6), sound off by default (spec 05 R14).
3. ON the persona page THE fictional-persona notice SHALL move out of the Top_Bar into the Persona_Intro, with its spec 07 R8.4 text unchanged. THE Demo chip SHALL stay in the Top_Bar.
4. ANY icon added for these controls SHALL be original inline SVG with an `ASSETS.md` entry (spec 07 R23).

### P6. Receipt_Cards on the phone

**User story:** As a judge on a phone, I want each receipt to read in two clean lines per figure.

1. EACH Then and Now row SHALL keep its value and unit on one line, and its period and region together on the next line.
2. THEN and Now SHALL stack, Then above Now, with equal weight (spec 08 R4.1).
3. THE painted background box of each Receipt_Card and of the figures panel SHALL contain the bounding box of every element inside it.
4. THE reveal SHALL show no separate marks card. IN the `marks` Stage the answers SHALL show as the Answer_List (each answer's metric name, Answer_Text and unit, or "No answer"), next to the seal, before the letter (spec 03 R9.1, `tone.md`). FROM `figures` on, the answers SHALL appear only inside the Receipt_Cards.

### P7. Reveal length

**User story:** As a judge on a phone, I want the payoff to fit a few thumb-scrolls.

1. AT 390×844, in the `close` Stage, the distance from the top of the letter Stage content to the bottom of the closing line SHALL be at most 3 × 844 CSS px plus the height of the Letter_Text.

### P8. Touch

**User story:** As a judge on a phone, I want to press and hold the seal with my thumb like a real seal.

1. WHILE the judge holds the seal by touch, THE page SHALL show no long-press callout, select no text and not scroll.
2. WHILE the hold runs, THE seal SHALL show visible hold progress in proportion to the hold time, in a non-Accent token, in addition to the cracks (spec 05 R6.2).
3. WHEN the judge releases before `SEAL_HOLD_MS`, THE hold SHALL cancel, the progress and cracks SHALL return to nothing, and no event SHALL be sent (spec 05 R6.4).
4. EVERY interactive target on the pages a task touches SHALL be at least 44×44 CSS px, measured as its clickable area.

### P9. The on-screen keyboard

**User story:** As a judge typing on a phone, I want the field and its button above the keyboard.

1. WHILE a recall number field or the live letter textarea has focus, THE field and its Next or submit control SHALL be fully inside the visual viewport (`window.visualViewport`), not only the layout viewport.
2. WHEN the visual viewport resizes or scrolls while such a field has focus, THE page SHALL bring the field and its control back into the visual viewport, with no animation under Calm_Mode or reduced motion.
3. THE viewport configuration SHALL ask the browser to resize content for the on-screen keyboard where it supports that (`interactive-widget=resizes-content`), and the page SHALL still meet criterion 1 where it doesn't (iOS Safari).
4. P9 SHALL be verified in the Real_Device_Check (G2.8).

### P10. The live demo on the phone

**User story:** As a judge sealing on my phone, I want a short step on each screen and my own phone's passkey.

1. THE Live_Stepper SHALL show one step per screen (D2.1), with the step's heading, its fields and its Next control inside the First_Viewport when the step begins.
2. VALIDATION messages SHALL appear only after the field was touched or a seal was attempted (A4.4).
3. THE letter textarea SHALL start at most 5 lines tall and grow with its content up to the height the design states.
4. THE passkey create and get calls SHALL set no `authenticatorAttachment` and no hint that prefers a security key, so the phone offers its own platform passkey provider, and a computer still offers "use a phone or tablet" (`crypto.md`). A test SHALL assert the options. No change to `src/lib/crypto` is needed for this.
5. THE 30-second countdown SHALL stay inside the First_Viewport of the Wait step, without scrolling, from the seal until the unlock control appears.

### P11. No duplicate links on `/`

1. THE How_Page link and the GitHub link SHALL each appear exactly once on `/`, in the footer.

### B1. Above the fold on the landing page

**User story:** As a judge with one minute, I want to know what Revenant is and how to try it before I scroll.

1. AT each Evidence_Size, with the page scrolled to the top and fonts loaded, `/` SHALL show inside the viewport: the Eyebrow; the headline (the Tagline, F3); the Hero_Sentence; the primary call to action; and, WHILE Demo_2_On is true, the secondary call to action.
2. THE Hero_Sentence SHALL follow F3.1 and come from the Brand_Copy module.
3. THE primary call to action SHALL be the one Accent button on `/`. It SHALL link to the Demo_Index at `/demo`, SHALL read "Open the demo letter" while the Persona_List holds one persona and "Open the demo letters" while it holds two or more (spec 08 R10.3), and SHALL state what it costs the judge: about two minutes, no sign-up and no passkey. It SHALL name no persona.
4. THE secondary call to action SHALL link to the Seal_Page and state that the letter opens 30 seconds after sealing. It SHALL NOT use the Accent.
5. AT the Phone_Sizes, P1, P2, P3 and P11 SHALL hold.
6. THE headline SHALL stay the largest contentful paint element, in the server HTML (spec 07 R21.3).
7. THE "about two minutes" claim SHALL come from one constant. THE owner SHALL time the persona flow once on a laptop and once on a phone and write both times into the landing hero task's issue body before the task is claimed, because the agent reads only the issue body and the dispatcher merges on a QA pass. THE PR SHALL quote them.

### B2. Every region gets the same front door

**User story:** As a judge outside the US, I want the front page to lead me to every letter equally, so that I can pick the one from my region.

1. `/` SHALL favour no persona: no persona's name, region or letter link SHALL appear above the fold, and the one path into a persona letter from the hero SHALL be the primary call to action to `/demo`.
2. THE Demo_Index SHALL keep showing one card per persona in Persona_List order, each with its display name, region, written-as-of date, opening date and open link (spec 07 R16.2), so the judge picks the letter there.
3. THE landing page SHALL read no geolocation, write nothing to storage and make no third-party request to choose or order letters (spec 08 R1.5).
4. THE Demo_Index SHALL show every card's open link inside the first viewport at the Desktop_Sizes and the Wide_Size, so the second click needs no scroll there.

### B3. Below the fold

**User story:** As a judge who scrolls, I want the story of what was resurrected and how it was built.

1. BELOW the fold, `/` SHALL show, in this order: the Ritual_Section, the Resurrection_Section, the "What no wax seal could do" section (F6.2), the Sample_Receipt and the Coven_Strip.
2. THE Ritual_Section SHALL show the five Ritual_Steps from the Brand_Copy module as five plain cards, each with a step number, its name and its one-line description. THE cards SHALL be rectangles with rounded corners, with no arch, gravestone, moon or other prop `tone.md` forbids.
3. THE Resurrection_Section SHALL tell the pli cacheté story, with the classroom time capsule as an example (F6.1), in at most four sentences, and show the Seal_Mapping rows from the Brand_Copy module. EVERY historical number or date in it SHALL link to an official source page, or SHALL be left out.
4. THE Sample_Receipt SHALL show one real figure from the Figures_API with its value, unit, region, period, source, series ID, retrieved date and a source link, from the first Catalogue series in the response. IF the request fails or that series has no figure, THEN it SHALL say no figure is available and show no number. IF the figure is a Fallback_Figure, THEN it SHALL show the Fallback_Note. It SHALL show no change and no arrow.
5. THE Coven_Strip SHALL show the Kiro_Stats (the number of spec folders in `.kiro/specs`, steering files in `.kiro/steering`, agent files in `.kiro/agents` and hook files in `.kiro/hooks`), computed at build time, and link to `https://github.com/devclef/Revenant/tree/main/.kiro` and `https://github.com/devclef/Revenant/blob/main/docs/agent-loop.md`.
6. IF a Kiro_Stats count can't be computed at build time, THEN THE Coven_Strip SHALL show no number for it, and a CI test SHALL fail.
7. THE Sample_Receipt SHALL be the only part of `/` that runs client code beyond spec 08, and SHALL load after the headline renders.

### B4. Wide screens

**User story:** As a judge on a large monitor, I want the hero to fill the screen like a poster.

1. AT the Wide_Size, THE headline's computed font size SHALL be at least 1.5 times its size at 1366×800.
2. AT the Wide_Size, THE Hero block's vertical centre SHALL lie within the middle 40% of the first viewport's height, and its left edge SHALL line up with the Top_Bar wordmark within 1 CSS px (spec 07 R8.14).
3. AT every Check_Size, THE headline size SHALL stay as spec 08 states it.

### C1. Persona intro

**User story:** As a judge, I want to know whose letter this is and what's about to happen, before I pick it up.

1. ON the persona page, from the first render until the Pick_Up_Button is activated, THE page SHALL show a Persona_Intro with:
   1. one everyday line about who wrote the letter, from a new Persona_List field;
   2. "Written as of {date}" and "Opens {date}", and, WHERE the persona has an Opening_Event, the event named as a date in plain terms (for example "U.S. election day, 5 November 2024") with a link to its `source_url`;
   3. a line saying that before reading it the judge answers {n} questions from memory, where {n} is the number of metrics in the persona's Persona_List entry;
   4. how long it takes, from the same constant as B1.7.
2. THE Persona_Intro SHALL take every value from the Persona_List and constants, and SHALL show nothing from the sealed payload.
3. THE Persona_List entry for `us-maya` SHALL gain an Opening_Event with the date `2024-11-05`, an official publisher and an `https` official `source_url` that states the date, in the same shape as `eu-tomas`. THE task SHALL quote the page text that states the date in its PR.
4. THE intro line SHALL follow the persona rules of `neutrality.md` and spec 03 R1.7 to R1.10 (no politics terms, no digits, no stereotypes). THE PR SHALL record the copy test review with the reviewer's name and pass or fail.
5. THE Opening_Event SHALL name no party, candidate or outcome (`neutrality.md`, "Election dates").

### C2. Step indicator

**User story:** As a judge, I want to see how far along I am, so that the ritual feels short.

1. FROM the `intact` Stage to the `close` Stage, THE persona page SHALL show a Step_Indicator with four steps in this order: Testify, Break the seal, Read, See the receipts (F4.2).
2. THE current step SHALL be Testify in `recall`, Break the seal in `marks` and `seal`, Read in `letter`, and See the receipts in `figures` and `close`. In `intact` no step SHALL be current.
3. THE Step_Indicator SHALL stay at one place at the top of the Content_Column (or above the Reveal once the Ghost leaves) through every Stage, SHALL be an ordered list with `aria-current="step"` on the current step, and SHALL be announced once per step change through the existing polite live region.
4. THE current step SHALL be marked by weight and a non-Accent marker, not by the Accent (G1.9).
5. THE Step_Indicator SHALL fit on one line at the Desktop_Sizes and the Wide_Size, and at the Phone_Sizes SHALL take at most two lines.

### C3. The Receipt_Card

**User story:** As a judge, I want my answer, the record then and the record now together, so that I see the gap without scrolling or remembering.

1. EACH Figure_Entry SHALL be a Receipt_Card that shows, in one visual group and in this order in the document and on screen: the metric's display name; "Your answer" with the Answer_Text and unit in the Accent, or "No answer"; "Then" with the Then_Value, unit, period, region and provenance label; "Now" with the Now_Value, unit, period, region and retrieved date, or the A3 message; the Number_Line; the change line and formula; the source control.
2. THE Then_Value and the Now_Value SHALL keep identical type style (spec 08 R4.1), and a rise and its mirror-image fall SHALL render the same markup except for spec 07 R20.2's allowed parts.
3. THE Number_Line's answer label SHALL show the Answer_Text and unit without the words "Your answer", so the card shows "Your answer" exactly once (spec 08 R4.3).
4. WHILE the Stage is `figures` or `close`, THE marks card SHALL be collapsed to its heading in a closed disclosure control, with its content still in the document (spec 05 R13.7).
5. AT each Evidence_Size, after "See the receipts", every Receipt_Card SHALL be readable by scrolling down from the Figures_Heading only. At the Desktop_Sizes and the Wide_Size the first Receipt_Card SHALL be fully inside the viewport.
6. THE Receipt_Card SHALL show no difference, distance, closeness or grade between the answer and any figure (spec 03 R9.3, spec 07 R20.7), unless OD2 changes this.

### C4. One clear action at the climax

**User story:** As a judge at the seal, I want one obvious thing to do.

1. WHILE the Stage is `marks` and no sequence runs, THE page SHALL show exactly these controls besides the Top_Bar: the pressable wax seal with one instruction line, the "Break the seal" button, and the Skip_Link.
2. THE Skip_Link SHALL read "Skip to the receipts", SHALL be styled as quiet text (not a button, not the Accent), and SHALL send `SHOW_ALL` exactly once.
3. THE Skip_Link SHALL be visible while any part of the Reveal is not yet shown (spec 03 R9.4), and its activation SHALL move focus to the Figures_Heading as "Show everything" does (spec 08 R2.3).
4. THE sound toggle SHALL move to the Top_Bar, between the Calm control and Skip, with the same size, weight and style as the Calm control, and SHALL keep spec 05 R14 (off by default, memory only).
5. THE Top_Bar Skip SHALL show only while a sequence runs (spec 07 R8.6).

### C5. The Ghost carries the moment

**User story:** As a judge, I want to break the seal on the letter the Ghost is holding.

1. AT the Desktop_Sizes and the Wide_Size, in `marks` and `seal`, THE pressable wax seal SHALL be the one on the Envelope the Ghost holds, and the instruction line SHALL sit next to the Envelope, within 48 CSS px of its bounding box.
2. THE page SHALL show no second wax seal in the Content_Column at those sizes. THE "Break the seal" button and the Skip_Link stay in the Content_Column.
3. THE crack animation SHALL play on the held Envelope (spec 07 R12.11).
4. UNDER Calm_Mode or reduced motion, THE page SHALL show the settled scene with the Ghost holding the Envelope and no motion (spec 07 R19.2).
5. AT the Phone_Sizes, the Compact_Ghost of P4.2 and the touch rules of P8 apply.

### C6. Disclosure and the Fingerprint

**User story:** As a judge, I want to be told once, plainly, that this is a demo, and to see the seal's verdict before its hex.

1. THE persona page SHALL show the fictional-persona disclosure once before the letter and once at the letter, as the Letter_Disclosure. Before the letter it sits in the Top_Bar at the Desktop_Sizes and the Wide_Size (spec 07 R8.4), and in the Persona_Intro at the Phone_Sizes (P5.3).
2. WHERE OD5 confirms, THE Envelope_Front SHALL drop the "Prepared later as a demo." line at every width.
3. THE Letter_Disclosure SHALL be one line: the persona is fictional, and the letter was written as of {written_as_of}. A separate Caption_Block line SHALL read "Sealed for this demo on {date}", with {date} from the header's `sealedAt` in the R15.1 format of spec 08. Together they SHALL replace the separate demo note and the "Sealed for the demo on" line, and nothing SHALL say the letter was sealed on the written-as-of date (spec 03 R10.3). Both lines sit outside the paper (L6.2).
4. WHEN a Persona_Letter's hash check passes, THE Reveal SHALL show the Seal_Verdict "The seal is intact. This is exactly the text that was sealed." first, then a closed disclosure control that holds the Fingerprint with the "demo letter" label, and a link to the How_Page.
5. LIVE_Letters and Real_Letters SHALL keep the spec 08 R14.3 Fingerprint block open, unchanged.

### C7. The closing line

**User story:** As a judge, I want the last line to name what I'm comparing.

1. THE close's first line SHALL follow F5: it names your testimony and the record, in `tone.md` voice, with no comment on either.
2. THE close SHALL keep spec 07 R15.1 items 2 to 4 and R15.3.

### C8. The EU unit

**User story:** As a judge in the EU, I want to answer about a litre in euros per litre.

1. IF OD3 picks option (b), THEN for a sealed unit exactly `EUR per 1,000 litres`, THE recall field, the Recall_Scale, the marks card and the Receipt_Card SHALL show values in `EUR per litre`, with each figure value's decimal point moved exactly three places by the existing `rescaleForDisplay`, and SHALL show next to each displayed figure that it is published per 1,000 litres and shown per litre.
2. THE Display_Rescale SHALL be chosen from the exact sealed unit string only, not from the Catalogue, so a letter still shows it if its series leaves the Catalogue.
3. THE stored figure values, the sealed payload and the Recall_Record schema SHALL stay unchanged. THE Recall_Record SHALL store the judge's typed per-litre value, with no conversion.
4. THE change line SHALL show the same percentage and its formula with both rescaled inputs and the rescale note.
5. THE Unit_Range_Table SHALL gain `EUR per litre` with minimum 0, maximum 3 and ticks every 0.5, and the Unit_Helper_Line SHALL no longer show.
6. IF OD3 picks option (a), THEN THE Persona_List `recall_subject` for both EU metrics SHALL name 1,000 litres, `eu-tomas` SHALL get a new letter ID with the old one moved to `retired_letter_ids` (spec 03 R5.2), and criteria 1 to 5 SHALL NOT apply.

### C9. Phone fit

**User story:** As a judge on a phone, I want the persona journey to meet the phone rules.

1. AT the Phone_Sizes, the persona page SHALL meet P3 to P9.
2. AT the Phone_Sizes, the Persona_Intro (with the fictional-persona notice, P5.3) and the Pick_Up_Button SHALL both be inside the First_Viewport in the `intact` Stage.

### D1. Scene and Ghost in the live demo

**User story:** As a judge sealing my own letter, I want the same world as the persona letter.

1. `/demo/live` SHALL render the Scene (light, Soil, Top_Bar) and the Ghost, reusing the existing scene components, with no new runtime dependency.
2. WHEN the seal is stored, THE Ghost SHALL take the letter down into the Soil, and THE 30-second countdown SHALL run in the Scene.
3. WHEN the judge unlocks the letter in place (D5), THE Ghost SHALL rise with it, as the persona Emergence does.
4. UNDER Calm_Mode or reduced motion, THE scene SHALL be settled with no motion, and the countdown text SHALL still update (spec 06 R16.6).
5. THE passkey and backup key warnings SHALL stay plain and unmissable (spec 07 R17.6 to R17.8).
6. `/l/[id]` SHALL keep rendering no Ghost and no Soil (spec 07 R17.10).

### D2. The Live_Stepper

**User story:** As a judge, I want sealing as short steps, not one long form.

1. `/demo/live` SHALL show one step per screen, in this order: Write, Seal the figures, Press the seal, Wait, Testify, See the receipts (F4.3), with the Step_Indicator showing the six steps.
2. BEFORE the seal is stored, Back SHALL return to the previous step and keep the letter text, the chosen figures and any backup key decision exactly as entered.
3. AFTER the seal is stored, THE stepper SHALL offer no way back to Write or Seal the figures, and SHALL NOT show the letter text again (spec 06 R16.3).
4. THE Seal step SHALL hold the passkey explanation (spec 06 R15.2, R15.12), the warning per OD6, the Create_Press and the Confirm_Press, in that order.
5. THE stepper SHALL keep every spec 06 R15.1 step in order, every request and its body, and the rule that the passkey call is the first asynchronous operation of its click handler.
6. EACH step change SHALL move focus to the new step's heading.
7. THE Seal step SHALL keep the plain line that the device asks for the passkey twice, with a button each time.

### D3. Prompt starters

**User story:** As a judge facing a blank page, I want a nudge, not a script.

1. THE Write step SHALL offer exactly three Prompt_Starters as buttons. WHEN the judge activates one, THE text SHALL be inserted at the cursor in the letter field.
2. THE letter field SHALL start empty. Nothing SHALL be prefilled.
3. EACH Prompt_Starter SHALL be about everyday life, name no party, policy or election, and contain no digit and no figure.

### D4. Figure choices show the figure

**User story:** As a judge, I want to see what I'm sealing.

1. EACH series in the picker SHALL show its value, unit, period, region and source name from the Figures_API, with the source details one click away.
2. A Fallback_Figure SHALL show its retrieved date and the Fallback_Note (A1.8).
3. THE picker SHALL list series in Catalogue order and SHALL NOT order, filter or style them by value or direction (spec 06 R13.1).

### D5. Countdown, then straight into Testify

**User story:** As a judge, I want the letter to open where I am when the 30 seconds are up.

1. AFTER the seal is stored, THE Wait step SHALL show a visible countdown to `opens_at` (spec 06 R16.2).
2. WHEN the countdown reaches zero, THE Wait step SHALL check the letter route once and, once the server says `openable`, SHALL show the unlock control for the letter just sealed ("Unlock with your passkey", or the backup key field) in place, plus the "Go to your letter" link (spec 08 R17).
3. THE passkey assertion SHALL be requested only when the judge presses the unlock control, as its first asynchronous operation (spec 06 R17.2).
4. WHEN the letter unlocks, THE page SHALL go straight to the Testify step (the recall questions), then the reveal, with the same Opening_Flow, Recall_Record and order as `/l/[id]`.
5. THE page SHALL NOT navigate by itself, and the server clock SHALL decide openability (spec 06 R17.4).

### D6. Backup key up front

**User story:** As a judge whose device may lack PRF, I want the backup key offered first, not as a failure.

1. WHEN the PRF_Hint reports `extension:prf` as `false`, THE Seal step SHALL offer "Seal with a backup key" as the first option, beside the passkey option, with the spec 06 R15.9 rules.
2. THE PRF_Check at sealing SHALL still decide whether the backup key is required (spec 08 R16.5).
3. THE backup path SHALL work end to end in the stepper: Press the seal, Wait, unlock with the key in place, Testify, See the receipts (spec 08 R17).

### D7. Lost-passkey warning weight (owner decision)

**User story:** As the owner, I want the warning to fit a 30-second letter without breaking `crypto.md`.

1. THE Seal step SHALL show the warning in the form OD6 chooses.
2. WHATEVER OD6 chooses, skipping the backup key SHALL need an explicit confirmation that a lost passkey means the letter can never be opened (`crypto.md`, "PRF check at sealing"), and the warning SHALL be plain, unmissable and in the same view as the control it guards (spec 07 R17.6, R17.7).

### E1. Presentation (Owner_Patches and owner steps)

**User story:** As the owner, I want the README, write-up and video script ready before the freeze, drawn from what is true on `main`.

1. THE final audit task SHALL list every user-facing claim in the copy modules, the landing page, the How_Page and the README against the code or data that makes it true, and fix or remove each claim that isn't true on `main` (spec 08 R19).
2. THE README Owner_Patch SHALL add, at the top, a "Judge quick path" box with three links (open a letter, seal your own, how it is sealed), the time each takes, a note on which browsers and devices support PRF (from `tech.md`), and placeholders for the demo video embed and a reveal GIF.
3. THE `docs/kiro-writeup.md` Owner_Patch SHALL answer every Devpost write-up prompt the design lists, with every count recomputable at a stated commit (spec 08 R28.2 to R28.4), and SHALL say plainly if Kiro powers were not used and why.
4. THE `docs/video-script.md` Owner_Patch SHALL use the Ritual_Steps and the Tagline, and SHALL be a beat sheet under 3 minutes with these beats: 0:00 the pli cacheté hook; 0:20 Maya: testify, break the seal, receipts; 1:30 seal your own with a passkey and the 30-second open; 2:10 the Kiro Crew loop (an agent PR, the QA verdict with screenshots, a hook blocking a judgemental word); 2:45 close.
5. THE owner SHALL add the GitHub About topics `kiro`, `kiro-crew`, `passkeys`, `webauthn`, `time-capsule` and `nextjs` next to `kiroween`, and SHALL carry out F9. These are owner steps, not tasks.
6. THE Owner_Patches of this requirement SHALL be attached to the last task before the 27 November 2026 freeze.

## Owner decisions

Each decision has a recommended default. The agent and QA read only the issue body, so a decision takes effect only when the owner writes it into the named task's issue body before the task is claimed; otherwise the task uses the default.

1. **OD1. Per-series fallback figures in db mode (A1).** Default: yes. Each Fallback_Figure is the real bundled record, keeps its real `retrieved_at`, is marked `fallback: true` and is shown with the Fallback_Note. It never hides a broken fetch, because `last_success_at` stays null and the Freshness_Check still fails. This is honest under `data-integrity.md` (sourced, dated, labelled) and spec 08 R21 (never a stale figure presented as current).
2. **OD2. A plain numeric difference between the answer and the record (C3).** Default: no. Spec 03 R9.3 and spec 07 R20.7 forbid computing or showing any difference between an answer and a figure, `neutrality.md` forbids grading what the user remembered, and `product.md` says Revenant does not interpret the gap. The Receipt_Card puts the answer next to the record, which shows the gap without a number. A "yes" needs `product.md` and `neutrality.md` changed first.
3. **OD3. EU unit (C8).** Default: option (b). `data-integrity.md` names this exact case as allowed ("a source's 'per 1,000 litres' shown as 'per litre'") if it is done only at display time, shown to the user, and the stored value stays as published. Option (b) also keeps the sealed question ("a litre") true and needs no re-seal. Option (a) needs a new `eu-tomas` letter ID and asks the judge to remember the price of 1,000 litres, which few people know. Under (b), Recall_Records stored for `eu-tomas` before the change hold per-1,000-litre answers; they are never shown again, so nothing changes for them.
4. **OD4. Landing order of Maya and Tomás (B2).** Closed by owner decision on 6 November 2026: `/` names no persona. Its one orange button, "Open the demo letters", goes to `/demo`, which lists every persona the same way in Persona_List order. No ordering by `navigator.language`.
5. **OD5. Drop the Envelope's third disclosure line (C6.2).** Default: yes. Spec 03 does not require it on the Envelope. Spec 05 R3.7 is met by the Envelope_Front dates plus the Top_Bar notice, which spec 07 R8.13 counts as part of the envelope view; narrow screens already drop the line (spec 07 R8.7).
6. **OD6. Lost-passkey warning for 30-second demo letters (D7).** `crypto.md` requires an explicit confirmation to skip the backup key, for every letter, and `tone.md` says atmosphere never softens a warning. Options:
   - (a) Default. Keep the checkbox, move it to the Seal step next to "Create your passkey", and shorten the warning to one plain sentence: a lost or deleted passkey means this letter can never be opened. Meets `crypto.md` as written.
   - (b) Treat sealing a Live_Letter with the passkey only as the confirmation, with a one-line notice and no checkbox. This drops the explicit confirmation, so it needs the owner to amend `crypto.md` for Live_Letters first.
7. **OD7. Does the 20 November real-sealing go depend on groups A to C?** Default: it depends on group A only. Go needs every group A task merged and its Production_Check passed, and the Journey_Check green for the 48 hours before the decision, on a `v*` image tag (`deploy.md`). Real letters can't be deleted, so the production path must be sound before anyone seals one. Groups B and C change presentation, which can still change after a real letter is sealed; a Real_Letter opens 3 months later.

Found while writing this spec:

8. **OD8. How often the Journey_Check opens the persona reveals (A6.6).** Each reveal stores a Recall_Record in the production openings table, which is append-only. Default: the reveal check runs on one scheduled run a day (00:17 UTC) and on every manual run; the other checks run every 6 hours. That is about 170 extra rows by 29 January 2027.
9. **OD9. Seed mechanism (A2).** You suggested a Helm `post-install,post-upgrade` hook. `deploy.md` says Helm hooks fit poorly with Fleet, and a failed post-upgrade hook marks the Helm release failed, which Fleet shows as a bundle error. Default: a plain Job named per release revision, which Helm replaces on each upgrade and nothing waits on. If Fleet then shows the bundle as Modified, the fix is a `diff.comparePatches` entry in the GitOps `fleet.yaml` that matches the seed Jobs by a name pattern, not a fixed Job name: a fixed name would make the next upgrade that changes the pod template fail, because Kubernetes doesn't allow that change to an existing Job, and it wouldn't clear the Modified flag, which comes from fields Kubernetes adds to the Job.
10. **OD10. Not_Yet_Message wording (A3.2).** You proposed "Today's figure isn't available yet…". Spec 08 R21.4 bans "today", "current", "latest" and "live" in any text about a Now_Figure. Default: "Revenant hasn't fetched a figure for this series yet. The sealed figure is shown on its own."
11. **OD11. Showing values before sealing (D4).** Spec 06 R13.7 hid the value so the picker didn't prime the recall step. In a 30-second demo, then equals now anyway, so the gap story belongs to the persona letters. Default: show the value, as you asked. Real sealing at `/seal` shows it too.

Added with the phone feedback:

12. **OD12. The Landing_Ghost's size and position on the phone (P1.1 item 5).** Options:
   - (a) Beside the headline. At 360 px the content column is about 328 px; a Ghost beside the headline leaves the headline about 200 px, and "Memory rewrites itself. Revenant doesn't." then needs 4 or 5 lines at a size that is still the largest text, which breaks P3.1.
   - (b) Behind the headline at reduced opacity. White text over a white-and-lilac Ghost fails the WCAG AA contrast that `tone.md` requires for text on its surface, and breaks spec 08 R9.11 (no overlap with headline lines). It needs a dark scrim behind the text and a contrast test of the darkest and lightest point under each glyph, and a change to spec 08 R9.11.
   - (c) Default. Below the calls to action, sitting on the Soil, at most 30% of the viewport height (about 190 px at 360×640, 250 px at 390×844), centred on the light. Design arithmetic: at 360×640 the Top_Bar (56), the Eyebrow (one line), headline (3 lines), Hero_Sentence (4 lines), both calls to action and the gaps take about 460 px, which leaves room for a Ghost of about 160 px and the Soil. No dead space, because the Ghost directly follows the calls to action.
13. **OD13. Compact_Top_Bar controls (P5.2).** Options: (a) Default: three separate icon buttons (motion, sound, Skip when a sequence runs), each 44×44 with an accessible name and a `title`. Spec 05 R11.3 requires a visible Calm control wherever anything moves, and spec 07 R8.6 a visible Skip while a sequence runs; a menu hides both behind a tap. (b) One menu button holding all three. Smaller, but it needs spec 05 R11.3 and spec 07 R8.6 relaxed for the Phone_Sizes.
14. **OD14. When the Real_Device_Check happens.** You asked for it before a task is ticked. Spec-sync ticks a task when its issue closes, which happens when its PR merges, and the image reaches `revenant.devclef.se` only after the merge. Spec-sync never unticks. Default: the owner runs the Real_Device_Check right after each deploy and records both results in the issue; a failure opens a new fix task in this file with the failing criterion and screenshots from both phones, and the owner adds `Blocked by #<fix issue>` to the next task's issue body, which the dispatcher honours. Adding a task to `tasks.md` changes no existing issue's dependencies, so this line is needed. The alternative is a preview deployment per PR, which the chart and GitOps repo don't have today.
15. **OD15. The answers in the `marks` Stage on the phone (P6.4).** You asked for no separate marks card on a phone. `tone.md` ("memory first, then the letter, then the numbers") and spec 03 R9.1 still need the answers shown before the letter. Default: the read-only Recall_Scales are not drawn on the phone; the `marks` Stage shows the Answer_List next to the seal, and from `figures` on the answers live only in the Receipt_Cards.

Added with the framing update:

16. **OD16. Retire "Your past self returns with the receipts."** Closed by owner decision on 6 November 2026: retired. The tagline is "Memory rewrites itself. Revenant doesn't." from the README, with the eyebrow "The wax seal, resurrected.". The retired tagline is a Retired_Phrase (F8).
17. **OD17. The Tagline in one place (F7).** Spec 07 shares one Scene headline across `/`, `/demo` and the persona page. Default: the Tagline appears on `/` and in metadata only; the persona page uses "{name}'s letter", `/demo` "The demo letters" and `/demo/live` "Seal your own letter", in the same position and style. The alternative keeps the Tagline as the headline on every Scene page, which repeats it on each Stage.
18. **OD18. The Hero_Sentence's final wording (F3.1).** Your brief suggested "seal a letter and the prices that matter to you". Spec 08 R10.2 allows only figures the Catalogue serves, and that is fuel prices for the US and the EU; "the prices that matter to you" would promise rent or groceries. Default: "Seal a letter to your future self with real fuel prices from the US or the EU. When it opens, you testify first, then see the receipts." It passes the `neutrality.md` copy test and fits P3 below the headline.

Added with the letters and type update:

19. **OD19. Light treatment (L7).** Closed by the owner on 6 November 2026: a shaft of light, as "Decisions already made" states.
20. **OD20. Dates on the `/demo` envelopes (L5.2).** Closed by the owner on 6 November 2026: the envelope fronts show "Written as of {date}" and "Opens {date}", with the Opening_Event's plain name after the opening date where `personas.json` has one. No sealed date on `/demo`. The real demo seal date stays with the letter, in the Caption_Block outside the paper, worded "Sealed for this demo on {date}" (C6.3).
