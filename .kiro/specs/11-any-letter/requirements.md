# Requirements Document

Spec: 11 Any letter

## Introduction

Revenant is entered in Kiroween 2026, Resurrection category. Submissions close 4 December 2026, 2:00 PM PT. The owner's feature freeze is 27 November 2026. Judging runs 16 December 2026 to 29 January 2027, and the site must work the whole time, free of charge. Judges score Potential Impact, Technological Implementation (Kiro use), Design, Innovation and Presentation equally. The aim is a demo that wins in five minutes, not a production service. This spec was written on 10 November 2026 against `main` at `ec84037` (production runs `6b05a9c`, the last code commit; `ec84037` only ticks task boxes). It was revised on the same day after the owner's review; the code was read as it stands in the local checkout at `ec84037` and no checkout, pull or fast-forward was done for the revision.

Spec 10 shipped all 17 tasks. Production on 10 November 2026 still has these problems:

- **The figures outage is back and it blocks the live demo.** `GET /api/figures` answers HTTP 500 `{"error":"figures_unavailable"}` while `/api/health` and `/api/health/ready` answer 200. `/demo/live` cannot get past step 2, because the Write flow demands at least one figure and the figure picker can't load. Both persona reveals show "This figure could not be loaded" under "Now:".
- **The `marks` Stage controls are close to invisible at 900 px and wider.** The Seal_Hint and Skip_Link are drawn in the paper ink colour on the dark scene, and the whole Seal_Group sits inside an `aria-hidden` subtree that also bobs.
- **The monitor that should have caught the outage is buried in noise.** The Journey_Check has detected the outage on every bad run, but it also fails ten other checks on every run because it still walks a Stage spec 10 removed. Nobody can tell a real alarm from the usual red.
- **The product reads as a fuel-price tool.** The landing line, the ritual, the live demo and both personas are about petrol. The five landing sections built for the story are not rendered. Figures are required to seal, and the Write step is 1,964 px long.
- **Smaller defects on the reveal:** a sample answer equal to the record, the fictional note three times on the Testify screen, the letter pushed below the first viewport, and receipts that print "3.643" against an answer of "3.64".

This spec does two things. First it makes the outage survivable and the monitor honest (groups S, X and W; W1 runs as task 2, in parallel with group X). Then it turns Revenant into a general "seal what you believe now, open it later" letter: goals for the year, a worry at work, family, a decision. Price figures stay as an optional "receipt", never a requirement (groups L, P and H).

Requirements are grouped and numbered by priority: G (rules for every task); S (steering first); X (production, P0, merged by 14 November 2026); W (the end-to-end walk of the live path, task 2, in parallel with group X and done by 14 November 2026, before any redesign); L (the letter becomes general, P1); P (persona demo, P1); H (landing and presentation, P1). Every rule of `.kiro/steering/` and of specs 02 to 10 still holds unless "Rules this spec replaces" names it.

## Steering conflicts to confirm

Requirement P1 (the Text_Persona shows her own testimony) conflicts with four lines in the steering documents as they stand. The owner should confirm the proposed S1 wording below before the design starts. The other changes in this revision conflict with no steering rule.

| Steering rule today | Conflict | Proposed S1 wording |
|---|---|---|
| `product.md`, Demo 1: "Personas ask only the figure questions. Each question comes with a sample answer… The testimony is the judge's own memory of that month." | The Text_Persona asks her own questions, carries no sample answer, and the testimony on screen is pre-written, not the judge's. | Add to Demo 1: "One persona is the exception. Her letter carries her own questions and no figures. Her answers to them are pre-written content, labelled as fictional on every screen that shows them. The judge reads her answers, breaks the seal and reads her letter. No answer of the judge's is recorded for this persona." |
| `product.md`, "What's new" and Core loop 6: Revenant "makes you testify before you read". | In the Text_Persona walk the judge reads testimony; the judge does not give any. The one new thing is demonstrated by a staged example, not by the judge's own act. | Add to Demo 1: "The fuel personas and the live demo make the judge testify. The text persona shows what a testimony beside a letter looks like, in someone else's words." |
| `tone.md`, Testify: "one question at a time, gentle prompts… the judge never lived the persona's life." and `tone.md`, Moments that matter | The judge steps through questions with answers already shown. There is no prompt to answer. | Add to Testify: "For the text persona the step shows one question and her answer at a time, with a plain control to go on. Her answers are labelled as fictional. The wording never grades them." |
| `neutrality.md`, "Demo persona letters" and the rule on the gap between testimony and letter | A pre-written answer beside a letter that differs from it is a staged gap. It can read as a verdict on memory if the differences are chosen to look like errors, or if the page points at them. | Add to Demo persona letters: "A persona's pre-written answers follow the same rules as her letter: everyday life only, no price, no party, policy or election term. They differ from her letter only in ordinary, neutral ways (a different detail, a different order, a different emphasis). The page does not point at, mark, count or explain any difference, and no wording calls an answer right, wrong, close, off or accurate." |

`data-integrity.md` (persona rules) needs no change: the Text_Persona has no figures, and her answers are labelled as fictional content, not as a record. The `tone.md` and `neutrality.md` wording above is what P1.5 to P1.9 implement.

## Code facts this spec relies on

Checked on 10 November 2026 against `main` at `ec84037`, after fast-forwarding a clean local checkout from `1985bf6`, and against production with `curl` and a headless Chromium (read-only: no letter sealed, no persona opened, no record stored). I did not read production logs or touch the cluster. The right-hand column says where the brief or an earlier spec was wrong.

| Topic | What exists | Corrections to the brief |
|---|---|---|
| Production state | `GET /api/figures` 500 `figures_unavailable`, `Cache-Control: no-store`; `/api/health` 200 `{"version":"6b05a9c…"}`; `/api/health/ready` 200; `/seal` 404; `/`, `/demo/live` 200. | Confirmed. |
| Figures failure line | `figuresFailureLine(step, err)` in `src/app/api/figures/respond.ts` logs `figures_unavailable step=<read\|shape> error=<name> [code=<pg code>]` and nothing else (spec 10 O1, merged). No log line has been supplied to me. | The line exists and is deployed. The owner has to read it from the pod; X1 asks for it. |
| When it fails | Journey_Check J1 passed in the 9 November 07:14 and 10 November 07:46 UTC runs and failed in the 9 November 22:43 and 10 November 20:02 UTC runs. The fetch CronJob runs at 06:17 UTC. Four samples. | The morning-pass, evening-fail pattern is evidence X1 has to explain, not only a lead. Nothing in `respond.ts`, `db-response.ts` or `build-response.ts` reads the clock except `generated_at`, so a time-of-day pattern must come from the data (rows the fetch job or the Fallback_Refresh writes, or rows that appear after the morning) or from something outside the route; I have not found which. |
| Database client | `getSql()` in `src/lib/db/client.ts` caches one `postgres(DATABASE_URL)` with default options. The letter store (`getDb()`) and the Figures_API read store share that client. On 10 November, in the same page load in which `GET /api/figures` answered 500, `GET /api/letters/<id>` answered 200 and `POST /api/openings` answered 201. Readiness uses a separate probe client (`max: 1`, `connect_timeout: 2`, `idle_timeout: 2`). Liveness is `/api/health`, which touches no database. `replicaCount: 1`. | **The shared client is not a suspect.** Working letter requests on the same client at the same moment make a connection-class error the least likely cause. The earlier draft of this spec suspected the client; that claim is removed. |
| Figures read and shape | `readDbFigures` runs two queries in `db-store.ts`: `latestFigures()` (`SELECT DISTINCT ON (source, series_id, unit, region) … ORDER BY …, period DESC, retrieved_at DESC, id DESC` over `figures`) and `lastSuccessTimes()` (`max(run_started_at)` per `metric_id` over `figure_fetch_runs` where `outcome <> 'failed'`). `shapeDbFiguresResponse` calls `toFigure` on every returned row (`row.retrieved_at.toISOString()`), then `buildFiguresResponse`, then `chooseFigure` per series. Either step can throw on stored data: `toISOString()` throws on an invalid or null `retrieved_at`; `periodEnd` does not throw (a malformed period gives a string of `NaN` parts and a wrong ordering). Indexes `figures_series_latest_idx` and `figure_fetch_runs_success_idx` exist (`drizzle/0002_figures.sql`). | New detail. I have not seen the production rows. |
| Figures_API failure and fallback today | `respondFigures` wraps both steps in one `try`. A throw logs the Figures_Failure_Line and answers 500 `{"error":"figures_unavailable"}` with `Cache-Control: no-store`; its header comment says it "never falls back to the bundled file". The fallback exists only per series, inside `shapeDbFiguresResponse`: when a series has no stored row, `bundledLatestFigure(cat)` (the latest non-fixture figure in `fuel-figures.json`, a copy, fields unchanged) goes through `chooseFigure(stored, bundled)`, which returns `{ figure, fallback }`: a stored figure wins with `fallback: false`, a bundled one gives `fallback: true`, neither gives `{ figure: null, fallback: false }`. The response schema has `fallback` as an optional boolean per series. `pickNow` returns `fallback: entry.fallback ?? false`, and `nowMessageFor` returns `REVEAL_COPY.fallbackNote` ("Revenant hasn't fetched a newer figure yet. This one was retrieved {date}.") for a found figure with `fallback: true`. `FigurePicker` shows the same note. File mode always sets `fallback: false`. | Confirmed. This is the machinery X3 reuses. |
| Bundled figures | `src/lib/figures/real/fuel-figures.json` is 332,467 bytes, 712 figures, not a fixture. The latest period of all four series is 2026-10-26, retrieved 2026-11-01. `bundledLatestFigure(series)` is called only by the Figures_API; the browser has no bundled figure and gets none in this spec (X3). Route budgets in `scripts/check-js-budget.mjs`: `/` 160 kB, `/demo` 160 kB, `/demo/personas/[key]` 260 kB, `/demo/live` 260 kB, `/l/[id]` 260 kB (gzipped). | — |
| Reveal "now" messages | `nowMessageFor` in `src/components/reveal/now-message.ts`; `REVEAL_COPY.nowUnavailableFetch` reads "This figure could not be loaded. Check your connection and reload the page." `useFigures`/`loadFigures` in `reveal/figures-api.ts` map every failure to `{status:"failed"}`. | — |
| Live Write flow | `minFiguresFor(mode, questions)` in `src/components/live/form.ts` returns 0 only for `mode === "real"` with a non-empty Author_Question, else `MIN_FIGURES` (1). `WriteForm.tsx` sets `formReady` only when `figuresStatus === "ready"` and `figuresValid` only when ready and no `figures_none`. `SealPage.tsx` (lines 164 to 167) builds the seal flow only when `crypto !== null && figuresReady`. In production I typed a letter, pressed Next to reach "Seal the figures" and pressed Next twice more: the page stayed on step `figures` showing "The figures could not be loaded, so you cannot seal a letter yet. Check your connection and reload the page." | Confirmed. |
| Payload and server accept no figures | `payloadV1Schema` has `metrics` and `figures` arrays with `max(50)` and no minimum; `recall_questions` has `max(20)` and no minimum. No code under `src/app/api/letters/` or `src/lib/letter-store/` reads a figure count. | Confirmed. |
| Live_Stepper | Six steps: `write`, `figures`, `seal`, `wait`, `testify`, `receipts` (`src/components/live/stepper/live-steps.ts`). Names come from `BRAND_COPY.ritualSteps[0..2]`, `LIVE_COPY.waitStep`, `ritualSteps[3..4]`. Back is offered from step 2 to `seal`, never after the seal is stored. | — |
| Write step contents (measured) | At 1366×800 the Next button's top is at y = 1,699 px on a 1,964 px page. At 360×640 it is at 1,316 px on a 1,531 px page. No horizontal scroll at either size. Contents in order: letter field, three Prompt_Starters, a prefilled Author_Question "What's on your mind right now?", five past-tense Question_Starters ("What was on your mind most days?", "Who did you spend your evenings with?", "What were you saving for?", "What did a normal Saturday look like?", "What were you looking forward to?"), then "Your own numbers". The figure picker is the next step. | Confirmed. |
| Question wording | Author_Questions are read on the opening day. "Right now" in the Live_Prefill then means the opening day, not the sealing day, so the prefilled question does not test memory at all. The five Question_Starters ask about an unnamed period. | **Correction to the brief's L2 ("present-tense questions").** A present-tense question is read in the future and asks about the opening day. Questions must be anchored to the sealing day (L2.3). |
| `marks` controls | `SealBreak.module.css`: `.hint` and `.textLink` set `color: var(--ink)` (`#1f1b16`, rgb 31, 27, 22). `.sealGroup { color: var(--on-purple) }` cannot reach them. At 900 px and wider the Seal_Group is portalled into `.heldSlot` inside `.bob` (3 px, 3,600 ms) inside `.ghostLayer` (`aria-hidden="true"`, `SceneBackdrop.tsx` line 94). The pressable seal (`HeldSeal`) is itself `aria-hidden`, by design. | Confirmed. |
| Contrast and aria tests | `src/components/ceremony/contrast.test.ts` checks `--ink` and `--ink-soft` on paper surfaces only; it cannot see text on the dark scene. `r11-accessibility.test.ts` checks heading focus, Calm, 24 px targets and that decorative `svg` is `aria-hidden`. No test fails on a focusable element inside `aria-hidden`. | **Correction to X5.** "Meet the existing contrast test" would pass today, because the test has no dark-surface pair. |
| Journey_Check | `tools/qa/journey-check.mjs` (owner-only) runs every 6 hours (`journey-check.yml`). J1 (figures non-null) and J3 (`/demo/live` has an enabled figure checkbox) already fail on the outage. The Journey_Issue is #318, open since 8 November 22:31 UTC, with a comment on every run. J5 waits for the `intact` Stage and J2 clicks "Pick up the letter"; spec 10 C1 removed both, so J5 prints ten failures per run (`stage=recall threshold=first Stage reached`) and J2 can never walk a persona. J6 PH1 fails on `/` at 360×640 (Landing_Ghost reported at 471 to 670 px) and on `/demo/live` at both phone sizes (Write block 200 to 1,365 px). | **Correction to X4.** Detection already exists. What is missing is a quiet baseline, a live-seal-path check and a working persona walk. My own measurement of the Landing_Ghost box at 360×640 after 3 s was 254 to 454 px, so J6 and I measure different states; reconcile in X4.3. |
| Real sealing | `realSealingOn()` is true only when `REAL_SEALING` is exactly `on`; the chart sets it from `realSealing` (default `false`); production runs off, so `/seal` is 404. `REAL_COPY.testNotice` already reads "This is a test site. A letter sealed here can only be opened here, or with its backup key." The server enforces an opening date at least 3 months after sealing. | — |
| Landing | `src/app/page.tsx` renders only `LandingHero`. `RitualSection`, `ResurrectionSection`, `NoSealSection`, `SampleReceipt` and `CovenStrip` in `src/components/landing/` are imported by nothing but their tests. `SampleReceipt` is a client component that calls `/api/figures`. `CovenStrip` takes four build-time counts from `src/lib/kiro-stats.ts` and an `env` entry in `next.config.ts`; neither exists, although spec 09 task 12 is ticked. It already holds the two links (`COVEN_LINKS.kiro`, the `.kiro` folder; `COVEN_LINKS.loop`, `docs/agent-loop.md`) and a title, "Built by a coven of Kiro agents". `BRAND_COPY.heroSentence` starts "Seal a letter to your future self with fuel prices from the US or the EU." `ritualSteps[1]` is "Seal the figures: Fuel prices from official sources…". | **Correction to the brief.** Spec 09 task 12 is ticked but its code never merged. |
| Persona data | `content/personas/personas.json` has `us-maya` and `eu-tomas`, each with two metrics. The schema (`src/lib/personas/schema.ts`) requires `metrics` with `min(1)` and has no field for questions. `scripts/seal-personas-core.ts` builds only Figure_Questions. `content/personas/letters/samples.json` holds five candidates per question; the first of each (`3.64`, `3.89`, `1.79`, `1.65`) equals the Then_Value at two decimals (3.643, 3.894, …) by spec 10 C5.2. | Confirmed. |
| Testify screen | The fictional note is rendered by `TopBar` (600 px and wider), `PersonaIntro` (on the page) and `TestifyContext`. The written-as-of and opens lines are rendered by `PersonaIntro` and `TestifyContext`. `TestifyContext` also holds the seal-intact statement and the Memory_Line. | Confirmed. |
| Letter Stage | `Reveal.tsx` renders, in order: the "Your testimony" block (heading and Answer_List, or a closed disclosure from `figures` on), then the `letter` column with `AuthorTestimony`, then `LetterBlock` with the Fingerprint caption. A letter with no figures goes from stage 2 to `close` (`stages.ts`, `Reveal.tsx` `closeShown`). | — |
| Receipts | `ReceiptCard` prints the Then and Now values as `formatValue` gives them with no `fractionDigits`, so published precision (3.643). The heading is the sealed `display_name` ("Regular gasoline (all formulations), retail price"). The source control shows source, series ID and a link. | Confirmed. |
| README and write-up | README line 59: "pre-sealed for a real US election window". Line 64: "Specs 01 through 07 are complete; spec 08 (judge polish) is in progress." Line 114: "168 merged pull requests"; `gh pr list --state merged` returns 184 today. `docs/kiro-writeup.md` has 7 `OWNER` notes (lines 5, 15, 40, 64, 78, 82, 88), counts taken at `1b28a81` (16 tasks for spec 10; today 17), and says spec 10 is in progress. | Confirmed. |
| Steering | `.kiro/steering/product.md` still has Core loop step 2 "Seal the figures", Demo 1 "Personas ask only the figure questions" and Demo 2 "starts with one question already filled in". `tone.md` and `neutrality.md` carry the spec 10 sample-answer rules. | — |
| Ownership | `.github/agents.json`: frontend-dev owns `src/app/**/*.tsx`, `src/components/**`, `src/lib/recall/**`, `src/lib/personas/**`, `content/personas/**`; data-dev owns `src/lib/figures/**`, `src/app/api/figures/**`, `scripts/fetch-figures*`; platform-dev owns `src/lib/db/**`, `src/app/api/health/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/lib/*.ts`, `deploy/**`; crypto-dev owns `scripts/seal-personas*`, `src/lib/seal-format/**`, `src/lib/crypto/**`. `.kiro/**`, `tools/**`, `docs/**`, `README.md`, `.github/**` are owner-only. | — |

## Decisions already made

| Topic | Decision |
|---|---|
| Deadlines | Group S and group X merged by 14 November 2026. W1 runs as task 2, in parallel with group X, and is done by 14 November; its "figures forced to fail" variant is re-run once after X2 merges. Real sealing go/no-go on 20 November (unchanged, spec 08 R25). Feature freeze 27 November. Submission 4 December, 2:00 PM PT. |
| Order | S1 steering patch (task 1); then W1 (task 2) in parallel with group X (tasks 3 onward); then L, P and H, which wait for W1 and any fix task it creates (G3). |
| Cut order | If the freeze arrives first, cut in this order: P5, P4, H1's "render" option for the three sections (fall back to deleting them; the Coven_Strip stays), L2's extra Occasions (keep "The year ahead" and "Blank"), P1. Nothing in S, X, W, G, L1, L3, L4, L5, P2, P3, H2, H3 or H4 is cut (G3.6). |
| Format and crypto | No change. A letter with no figures is a v1 payload with `metrics: []`, `figures: []`. Text questions are v1 `"text"` questions. The Occasion is never stored. Short names for receipts come from a lookup keyed by the sealed `metric_id` with the sealed `display_name` as fallback, not from a new payload field. |
| A letter needs something to testify to | A letter needs at least one non-empty Author_Question or at least one official figure. Self-reported numbers get no recall question and don't count. Otherwise the Testify step would be empty and the product's one idea would be missing. Every Occasion, including Blank, starts with one default question that fits any letter, so the rule bites only once the author has removed every question. |
| Figures become "receipts" | The figure picker and "Your own numbers" move into one closed disclosure, "Add a receipt", on the Write step. The separate "Seal the figures" step goes. The Live_Stepper has five steps. The Ritual has four steps. |
| Question wording | Every starter and prefilled Author_Question is written to be read on the opening day and names the sealing day ("when you wrote this", "the day you sealed this"). "Right now", "today" and "currently" are not used. |
| Occasions | A small choice at the top of the Write step sets a letter starter and one to three questions. Every Occasion, including Blank, includes one default question that fits any letter; every Occasion except Blank also includes one prediction question anchored to both days. It is client-side only and changes nothing in the sealed format. |
| Outage is survivable | Sealing, waiting, testifying and reading never wait on `/api/figures` (X2). The fallback lives on the server (X3): when the read or shape step fails, the Figures_API logs the Figures_Failure_Line and answers 200 with the bundled latest figure per series, marked `fallback: true`, using the existing `chooseFigure`, `bundledLatestFigure` and `REVEAL_COPY.fallbackNote`. It answers 500 only when no bundled figure exists. The browser ships no bundled figures and the route budgets don't move. The Journey_Check J1 fails on any `fallback: true` or null figure, so the outage stays visible. |
| Readiness | `/api/health/ready` keeps probing the database through its own probe client and does not probe figures. Reasons: with one replica a failing readiness removes the only pod from the Service, which turns "no now figures" into "no letters at all"; after X2 letters don't depend on figures. The figures monitor is the Journey_Check. X1 changes the main client only if the Figures_Failure_Lines name a connection error. |
| Persona framing | The judge's memory of a month doesn't connect to a stranger's letter about her plans, so the Text_Persona shows her own testimony. Her answers to her own questions are pre-written content, labelled as fictional on every screen that shows them. The judge steps through Testify reading each question and her answer, breaks the seal and reads her letter. The answers and the letter differ in plain, everyday ways, and Revenant says nothing about the difference. The answers live in a content file, not in the sealed payload and not on the server, and no Recall_Record is stored for this walk. The two fuel personas keep the judge's own testimony and their Sample_Answers. |
| Landing sections | Render `RitualSection`, `ResurrectionSection`, `NoSealSection` and the static `CovenStrip`, rewritten for the general letter. Delete `SampleReceipt` (it fetches `/api/figures` on a page that now makes no price claim). Keep `CovenStrip` as a static strip: one line and two links (the `.kiro` folder and `docs/agent-loop.md`), with no counts and no build-time data. Fuller Kiro-use evidence lives in the README and `docs/kiro-writeup.md`. |
| Real sealing | Default is no-go. `/seal` stays 404 and nothing mentions it unless the owner records a go on 20 November (L6). |
| Privacy and size | Spec 09 G1.5 and G1.6 unchanged: CSP header byte-identical, no request to another origin, nothing written to storage, cookies or the URL, no new `dependencies` entry, no animation library, no WebGL, every route inside `scripts/check-js-budget.mjs`. |
| Evidence sizes | 2560×1440, 1366×800, 1280×800, 390×844 and 360×640, with and without reduced motion, for every on-screen task (G2.4). |

### Rules this spec replaces

Each rule below is replaced only for the work of this spec, by the requirement named.

- **`product.md`, Core loop steps 1, 2, 3 and 7, "Testify step (MVP)", Demo 1 "Personas ask only the figure questions", Demo 2 (starts with one question filled in; picks figures)**: rewritten by S1.
- **Spec 10 C2.4 and C2.6 (Question_Starters as five buttons, past-tense, unanchored), spec 10 C9.5 and the Live_Prefill "What's on your mind right now?"**: replaced by L2 and L4. The five Question_Starters and the Live_Prefill string retire.
- **Spec 09 D3 and the three Prompt_Starters**: replaced by L2. The Occasion choice sets the letter starter.
- **Spec 10 C2.13, spec 06 R13.2 and `minFiguresFor`/`MIN_FIGURES`/`figures_none` in `src/components/live/form.ts`**: replaced by L1 for both `/demo/live` and `/seal`.
- **Spec 09 D2.1, spec 10 C1.9 ("keeps its six steps") and spec 09 F4.3 (step names from Brand_Copy ritualSteps[0..2])**: replaced by L1.6 and H2.2. The Live_Stepper has five steps; the Ritual has four.
- **Spec 09 B3 and F2 `ritualSteps[1]` "Seal the figures", `heroSentence`, and the `BRAND_COPY` mapping that README must match**: replaced by H2.
- **Spec 09 P10.1 and the Journey_Check PH1 threshold for the `/demo/live` Write step**: replaced by L3 (strict at 390×844 and wider, relaxed at 360×640 only).
- **Spec 10 R1.2 placement ("Your own numbers" after the question rows)**: replaced by L1.4 (inside the "Add a receipt" disclosure). R1's sealing and Reveal rules stay.
- **Spec 10 C5.2 (the Record_Candidate is one of the Sample_Candidates and counts as the Near_Candidate) and the spec 10 property "exactly one Record_Candidate"**: replaced by P2.
- **Spec 10 Out of scope "Author_Questions for Persona_Letters" and Decisions "Personas keep Figure_Questions only"**: replaced by P1 for the new persona only. The two fuel personas are unchanged.
- **The P1 framing of the first draft of this spec, the decision "the judge answers from their own memory of that month" for the Text_Persona, `product.md` Demo 1 ("The testimony is the judge's own memory of that month"), and the rules of specs 03, 09 and 10 that the testimony on a persona page is the judge's own (the Answer_List, Author_Testimony and "the answer you just gave" wording, and the recording of a Recall_Record on every persona walk)**: replaced by P1 for the Text_Persona only. The fuel personas keep all of them. The conflicts with steering are listed at the top of this document and the wording is in S1.
- **Spec 10 C4.3 and spec 09 P5.3/C1 where they place the fictional note, the dates and the seal statement in more than one component during `recall`**: replaced by P3.
- **Spec 10 C8.2 "the Text_Answer as recorded in full" as displayed**: replaced by P4 (clamped display with the full text in the document and a control).
- **Spec 09 A3.2 and `REVEAL_COPY.nowUnavailableFetch`**: replaced by X3. The "Check your connection" line retires.
- **Spec 08 design "Error Handling" and the `respond.ts` header rule (a failed read answers 500, never partial, never the bundled file)**: replaced by X3. A failed read or shape step now answers 200 with the bundled latest figure per series marked `fallback: true`, and 500 only when no bundled figure exists. Every figure still comes from the database or from the bundled file, field for field; nothing is invented.
- **Spec 09 A6/J2/J3/J5 and the Journey_Check's `intact` walk**: replaced by X4.
- **Spec 09 D5/D6 text "Wait" step name from `LIVE_COPY.waitStep` as step 4 of 6**: renumbered by L1.6 (step 3 of 5).
- **Spec 10 E1 and spec 09 E1 promise audits**: re-run by H3 and H4 for the claims this spec changes.

## Out of scope

- Any change to `src/lib/seal-format/**`, `src/lib/crypto/**`, the key hierarchy, the time lock, the envelope header or hash, or any `format_version`.
- AI-generated questions, a summary of the letter, a similarity measure, a diff or any other comparison between testimony and letter.
- A sample answer for any text question.
- Occasion text stored on the server, in a cookie, in storage or in the URL.
- New official series, Sweden, new regions, currency conversion.
- Opening a real letter during judging. A real letter opens at least 3 months after sealing, so none sealed on or after 16 December 2026 can open before 29 January 2027.
- Deleting sealed rows (the immutability triggers forbid it).
- Changing the passkey prompts at sealing.
- Build-time statistics or counts on the landing page (`src/lib/kiro-stats.ts`, an `env` entry in `next.config.ts`, any count of specs, agents, hooks or steering files).
- A browser-side module of bundled figures, or any bundled figure shipped to the browser.
- Any record of the judge's answers on the Text_Persona walk, and any sample answer, scoring, highlighting or comparison between her answers and her letter.
- A second readiness probe or a health endpoint for figures.

## Known limitations

- **Judges can't see a real letter open.** Real sealing, if switched on, shows the sealing half only. The 30-second rehearsal and the persona letters show the opening half.
- **Bundled fallback figures can be old.** The latest bundled records are dated 26 October 2026 (retrieved 1 November 2026). They are shown with their own period and retrieved date and the `fallbackNote`, never as current. During a Figures_Outage the Figures_API serves them for every series, so "now" can be weeks old.
- **A second opening asks again.** Unchanged from spec 10.
- **Old persona rows and any judge-sealed real letters stay in the database.** The triggers forbid deleting them.
- **The virtual-authenticator walk (W1) is a local rehearsal.** It proves the code path with a software passkey. It does not prove any particular phone's passkey provider supports PRF.

## Glossary

- **Letter**: A sealed v1 payload with a letter text, 0 to 3 Author_Questions and 0 or more figures. A Letter needs at least one non-empty Author_Question or at least one official figure (L1.2).
- **Receipt**: A figure the author seals with the letter: an official figure from the Catalogue, or a self-reported number. Optional. Sealed as the v1 `figures` entries exist today.
- **Receipts_Disclosure**: The one closed `details` element on the Write step, titled "Add a receipt", holding the figure picker and "Your own numbers" (L1.4).
- **Occasion**: One of the choices at the top of the Write step: "The year ahead", "Work", "Family", "A decision", "Blank". Sets a letter starter and one to three questions (L2).
- **Occasion_Table**: The table of Occasions with their letter starters and questions (L2.8).
- **Sealing_Day_Anchor**: A phrase in a question that points to the sealing day, such as "when you wrote this" or "the day you sealed this" (L2.3).
- **Rehearsal_Line**: The sentence on `/demo/live` that says the demo is a rehearsal of a letter that would normally stay sealed for months (L4.1).
- **Figures_Outage**: Any period in which `GET /api/figures` doesn't answer 200 with a body that `parseFiguresResponse` accepts, or answers 200 with a body in which any series has `fallback: true` or a null figure.
- **Figures_Failure_Line**: The log line `figures_unavailable step=<read|shape> error=<name> [code=<code>]` from `respond.ts`.
- **Fallback_Response**: The 200 body the Figures_API answers when the read step or the shape step fails: one entry per Catalogue series, each holding the bundled latest figure (from `bundledLatestFigure`) with `fallback: true`, or `figure: null` and `fallback: false` where the bundled file holds none (X3.1).
- **Bundled_Note**: The existing `REVEAL_COPY.fallbackNote` shown with a Now_Figure whose `fallback` is true ("Revenant hasn't fetched a newer figure yet. This one was retrieved {date}.").
- **Neutral_Gap_Line**: The one line shown when no Now_Figure exists at all for a sealed figure (X3.4).
- **Journey_Issue**: The single GitHub issue (label `journey:failure`, currently #318) that the Journey_Check keeps in step with the result.
- **Walk**: The end-to-end run of `/demo/live` on a production build (W1).
- **Walk_Findings**: The per-step record the Walk writes into its issue body (W1.4).
- **Text_Persona**: The new persona whose letter is about plans and worries and whose sealed payload holds Author_Questions and no figures (P1).
- **Persona_Answers**: The pre-written, fictional answers of the Text_Persona to her own questions, one per question, kept in a content file under `content/personas/` and never sealed, stored on the server or recorded (P1.5).
- **Fictional_Label**: The plain label shown with every Persona_Answer on every screen that shows one (final wording in the design, for example "Her answer (fictional)").
- **Coven_Strip**: The static landing strip of one line and two links, to the `.kiro` folder and to `docs/agent-loop.md`, with no counts and no build-time data (H1.2).
- **Display_Precision**: The number of decimals the Testify field uses for a unit: two for fuel prices after the Display_Rescale (P5.1).
- **As_Published_Value**: A figure's `value` exactly as sealed or published, at full precision and unrescaled (P5.2).
- **Short_Name**: The short everyday name on a Receipt_Card heading, for example "Regular gasoline" (P5.4).
- **Series_Name**: The sealed `display_name`, the official series name, shown under Source (P5.4).
- **Focusable_Under_Hidden**: A focusable element (`button`, `a[href]`, `input`, `select`, `textarea`, `summary`, or any element with `tabindex` of 0 or more) that has an ancestor with `aria-hidden="true"` (X5.3).
- **Seal_Group**, **Seal_Hint**, **Seal_Button**, **Skip_Link**, **Answer_List**, **Author_Question**, **Author_Testimony**, **Figure_Question**, **Kept_Sample**, **Sample_Answer**, **Sample_Candidates**, **Record_Candidate**, **Spread_Rule**, **Memory_Line**, **Testify_Context**, **Letter_Price_Line**, **Load_Entry**, **Gesture_Entry**, **Recall_Record_V2**: as defined in spec 10.
- **Evidence_Sizes**, **Phone_Sizes**, **First_Viewport**, **Step_Indicator**, **Receipt_Card**, **Journey_Check**, **Production_Check**, **Real_Device_Check**, **Brand_Copy**, **Ritual_Steps**, **Live_Stepper**, **Retired_Phrases**, **Copy task**, **Owner_Patch**, **WaxSeal**, **Display_Rescale**, **Persona_Intro**, **Compact_Top_Bar**: as defined in spec 09 and spec 10.
- **Catalogue**, **Figures_API**, **Real_Letter**, **Real_Seal_Page**, **Self_Reported_Figure**, **Then_Value**, **Now_Value**, **Now_Figure**, **Then_Figure**, **Fallback_Figure**: as defined in spec 08 and spec 09.
- **Persona_List**, **Persona_Letter**, **Recall_Generator**, **Recall_Record**, **Demo_Index**, **Opening_Flow**, **Reveal**, **Sealing_Script**, **Demo_Key**: as defined in spec 03.
- **Live_Letter**, **Letter_Page**, **Seal_Page**, **Sealing_Flow**, **PRF_Check**: as defined in spec 06.
- **Scene**, **Ghost**, **Content_Column**, **Ghost_Box**, **Stage**, **Mark**, **Seal_Break**, **Calm_Mode**: as defined in specs 05 and 07.

## Requirements

### G1. Roles and boundaries

**User story:** As the owner, I want each task inside one role's paths, so that the agent loop and the PR policy keep working.

#### Acceptance Criteria

1. THE task's PR SHALL change only files that are matched by the task role's paths or the `shared` list in `.github/agents.json` and are listed in the task's Scope.
2. THE frontend-dev tasks SHALL add, edit or delete no file under `src/app/api/`, `src/lib/crypto/`, `src/lib/seal-format/`, `src/lib/letter-store/`, `src/lib/db/` or `drizzle/`.
3. WHEN a task needs a change to `tools/**`, `.kiro/**`, `docs/**`, `README.md`, `scripts/check.sh`, `scripts/check-js-budget.mjs` or `.github/**`, THE task SHALL attach the change as an Owner_Patch to its issue or PR description, and its PR diff SHALL contain no change to that file.
4. THE PRs SHALL keep spec 09 G1.5 and G1.6: the CSP header byte-identical; no browser request to another origin; nothing written by new code to `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL path, the query string or the fragment; no new entry in the `dependencies` object of `package.json`; no animation library, no WebGL, no new font, no sound or vibration cue; every route at or under its budget in `scripts/check-js-budget.mjs`.
5. THE PRs SHALL change no crypto primitive, key hierarchy step, envelope header field or `format_version`, and SHALL edit no line of `src/lib/seal-format/v1/payload.ts`.
6. EVERY string of Our_Copy that a PR adds or changes SHALL live in its feature folder's copy module or in the persona content files, SHALL pass the `neutrality.md` copy test and the `tone.md` copy rules (second person, at most 25 words per sentence, no exclamation mark, no pun), and SHALL contain none of the Scoring_Words_Always; strings in the Scene_Copy_Modules SHALL also contain none of the Scoring_Words_Scene.
7. THE Accent SHALL mark only the reader's own answer, the main buttons, the wax and the focus ring (spec 09 G1.9). An Occasion button that is chosen MAY use the Accent as the reader's own choice, with its label in the text colour.
8. THE task description SHALL name the one role that does the work. A requirement that needs two roles (X1, P1) SHALL be split into one task per role, in dependency order.

### G2. Tests and evidence

**User story:** As the owner, I want proof from the browser and from production, so that a task that passes locally can't fail silently on the live site.

#### Acceptance Criteria

1. THE tests SHALL run in `npm test` with no network, with `DATABASE_URL` unset and every `fetch` stubbed, using `renderToStaticMarkup` and no browser, apart from the Walk (W1), which runs locally by hand.
2. THE property tests SHALL use fast-check with `numRuns` of at least 100 and the tag `// Feature: 11-any-letter, Property N: <title>`.
3. EACH task SHALL run `bash scripts/check.sh` on its final commit and report the commit SHA, the exit status and PASS or FAIL in its PR description.
4. EACH task that changes anything on screen SHALL attach PNG screenshots of every Stage or page it changes at each of the Evidence_Sizes, named `<stage-or-page>-<width>x<height>.png`, and the same set with `prefers-reduced-motion: reduce` named `<stage-or-page>-<width>x<height>-reduced.png`. Phone shots SHALL be First_Viewport captures plus one full-page capture per page.
5. EACH task's PR description SHALL state every route budget from `node scripts/check-js-budget.mjs` after `npm run build`, every earlier-spec test it changed or retired with the reason, every asset it added with its size in bytes, and every Owner_Patch it attaches, writing "none" for an empty list.
6. EACH group X, group L, group P and group H task that changes behaviour on production SHALL state a Production_Check, and THE owner SHALL record its result in the task's issue after deploy. A failure SHALL open a fix task, and the next task in the same group SHALL wait for it with a `Blocked by #N` line in its issue body.
7. EACH copy task SHALL attach the result of `node tools/hooks/tone-check.mjs` for every copy file it changed and a search of the rendered Our_Copy of every page it changed showing that no Retired_Phrase remains.
8. THE QA agent SHALL run the rows of the design's "QA browser steps" table that the task lists, found with the pattern `^\| 11 \|`, and the `npm run layout-check` checks the task's "QA check" lines name.

### G3. Task order and cuts

**User story:** As the owner, I want the work in an order that makes the site safe first and better second, so that a late freeze costs the least.

#### Acceptance Criteria

1. THE tasks SHALL be numbered in this order: S1 is task 1; W1 is task 2; the group X tasks follow; then the group L, group P and group H tasks. W1 and the group X tasks run in parallel (W1 changes no product file, so it conflicts with none of them). W1 and every group X task SHALL have a lower number than every group L, P and H task.
2. NO role task SHALL be dispatched before the S1 Owner_Patch is committed on `main`. EVERY task SHALL list "steering updated (S1 Owner_Patch on `main`)" under "Before this task".
3. EACH task SHALL be one GitHub issue and one PR for one role, with a changed-line estimate at or under `max_changed_lines` in `.github/agents.json` (5,000).
4. THE group X tasks SHALL merge by 14 November 2026, and THE W1 Walk SHALL be recorded by 14 November 2026.
5. WHEN a PR merges, `main` SHALL pass `bash scripts/check.sh`, and `/`, `/demo`, `/demo/live`, `/l/[id]` and every persona page SHALL load without error.
6. IF the 27 November 2026 freeze arrives with work open, THEN THE owner SHALL cut in the order given under "Decisions already made", and the final audit (H3) SHALL remove every claim that depends on cut work.
7. THE tasks SHALL carry "Depends on" lines naming only spec 11 task numbers, and every group L, P and H task SHALL depend on W1 and on any fix task W1 creates.

### Group S. Steering first

### S1. Steering describes the general letter (the brief's H5; Owner_Patch, task 1)

**User story:** As the owner, I want steering to describe optional receipts and the general letter before any agent builds them, so that no agent follows the old rule.

#### Acceptance Criteria

1. BEFORE any role task of this spec is dispatched, THE owner SHALL commit the Owner_Patches for `.kiro/steering/product.md`, `.kiro/steering/tone.md`, `.kiro/steering/neutrality.md` and `.kiro/steering/structure.md`. NO role agent SHALL commit them (G1.3).
2. THE `product.md` patch SHALL change only these items and keep everything else:
   1. The tagline paragraph and "What's new": Revenant seals what you believe now, in any part of life, and makes you testify before you read; prices are one example of a receipt.
   2. Core loop step 1: the user writes a letter and may choose an Occasion that offers a starter and up to three questions.
   3. Core loop step 2: "Add a receipt" is optional; a letter needs at least one question or one official figure.
   4. Core loop step 7: the numbers then and now appear only when the letter holds figures; a letter with no figures ends on the testimony and the letter.
   5. "Testify step (MVP)": questions are written to be read on the opening day and refer to the sealing day.
   6. Demo 1: a third persona's letter is about plans and worries and carries her own questions and no figures; her answers are pre-written, fictional content, labelled as such, that the judge reads before breaking the seal; no answer of the judge's is recorded for her. The "The testimony is the judge's own memory of that month" sentence is limited to the fuel personas. The wording is the one proposed under "Steering conflicts to confirm".
   7. Demo 2: the Write step offers Occasions; every Occasion starts with a default question anchored to the sealing day; the demo is described as a rehearsal of a letter that would normally stay sealed for months; figures are optional.
   8. "Open product questions": add the L6 real-sealing decision.
3. THE `tone.md` patch SHALL add to "Copy" that a question is written for the reader on the opening day and names the sealing day, SHALL add a "Rehearsal" line (the 30-second demo says plainly that it is a rehearsal), and SHALL add to "Testify" the text-persona line proposed under "Steering conflicts to confirm".
4. THE `neutrality.md` patch SHALL add that Occasion starters and questions follow the persona-letter rules: everyday life only, no leading wording, no party, policy or election term; and SHALL add the persona-answers rule proposed under "Steering conflicts to confirm" (pre-written answers follow the letter rules, differ from the letter only in ordinary neutral ways, and are never pointed at, marked, counted, explained or graded).
5. THE `structure.md` patch SHALL list `src/components/live/occasions.ts`, the landing sections that remain, the removal of `SampleReceipt`, and the static `CovenStrip` (one line, two links, no counts).
6. THE patches SHALL pass the `neutrality.md` copy test themselves and keep every other rule unchanged.
7. THE owner SHALL confirm the four proposals under "Steering conflicts to confirm" (or replace them) before the `product.md`, `tone.md` and `neutrality.md` patches are committed, and BEFORE the design for P1 is written.

### Group X. Production (P0)

### X1. Find and fix the cause of the figures 500

**User story:** As the owner, I want the cause of the figures 500 found from real data and fixed, so that the outage doesn't return.

#### Acceptance Criteria

1. THE X1 task SHALL treat these as the first candidates, in this order: a query-level error from `latestFigures()` or `lastSuccessTimes()` (a Postgres error that carries a `code`); a throw in `shapeDbFiguresResponse` on stored data (for example `toISOString()` on an invalid or null `retrieved_at`); and stored data that depends on the time of day or on rows the Fetch_Job or the Fallback_Refresh writes. A connection-class error (`CONNECTION_CLOSED`, `CONNECTION_ENDED`, `CONNECT_TIMEOUT`, `ECONNRESET`) SHALL be treated as the least likely candidate, because on 10 November `GET /api/letters/<id>` and `POST /api/openings` answered 200 and 201 on the same client in the page load in which `GET /api/figures` answered 500.
2. WHEN the X1 task is claimed, ITS issue body SHALL ask the owner for three things taken during a Figures_Outage: the Figures_Failure_Lines from the web pod's log (for example `kubectl -n <namespace> logs deploy/<release> | grep figures_unavailable`); the output of the `latestFigures()` query run in `psql` against the production database; and the output of the `lastSuccessTimes()` query run the same way. THE issue body SHALL also ask for the same three things taken during a healthy period, so the two can be compared.
3. THE X1 task SHALL explain the morning-pass, evening-fail pattern (J1 passed at 07:14 UTC on 9 November and 07:46 UTC on 10 November; it failed at 22:43 UTC on 9 November and 20:02 UTC on 10 November; the Fetch_Job runs at 06:17 UTC). THE explanation SHALL name which rows, which fetch or refresh run, or which other time-dependent input differs between a passing and a failing hour, and SHALL be quoted from the owner's data. A fix that leaves the pattern unexplained SHALL NOT close the task.
4. THE X1 task SHALL reproduce the failure in a test built from the owner's data: the stored rows (with identifying values kept, nothing invented) fed to `shapeDbFiguresResponse` through a fake `FigureReadStore`, or the failing query run against a test database. THE test SHALL fail before the fix and pass after. THE test SHALL assert the status, the body, the `Cache-Control` header and the one log line.
5. THE X1 task SHALL fix the cause the data names, at the data (the row writer, the migration or the query) or at the reader (`toFigure`, `shapeDbFiguresResponse`, the queries), whichever the data shows is wrong, and SHALL say in its PR description why it chose that place.
6. WHERE the Figures_Failure_Lines name a connection-class error, THE Figures_API SHALL retry the read once on a fresh connection before it falls back (X3), and THE main database client SHALL be created with finite `connect_timeout`, `idle_timeout` and `max_lifetime` values chosen in the design. The retry belongs to a data-dev task and the client options (`src/lib/db/client.ts`) to a platform-dev task (G1.8). IF the lines name no connection-class error, THEN THE X1 task SHALL change neither the retry nor the client options.
7. WHERE the lines name `step=shape`, THE Figures_API SHALL skip a stored row that fails validation, log its `metric_id` only, and answer for that series with the stored-else-bundled-else-null rule (`chooseFigure`).
8. THE log line SHALL keep the spec 10 O1.3 content rules: step, error name and Postgres code only, never the message, stack, cause or connection string.
9. IF no Figures_Failure_Line and no query output is in the issue body when the owner next asks, THEN THE X1 task SHALL still deliver the test harness of criterion 4 against the shapes the code can fail on (an invalid `retrieved_at`, a null field, a query rejection with a `code`), and SHALL stay open.
10. THE X1 task SHALL NOT close until the owner records, in its issue, that the Journey_Check J1 passed on every production run in the 24 hours after the deploy, including at least one run after 18:00 UTC.
11. THE X1 task's production check SHALL include `curl -s https://revenant.devclef.se/api/figures` showing no series with `fallback: true` and no null figure, at two times at least 8 hours apart, one of them after 18:00 UTC.

### X2. Sealing never depends on /api/figures

**User story:** As a judge, I want to seal a letter even when the figures service is down, so that the demo works whatever the data does.

#### Acceptance Criteria

1. WHEN `GET /api/figures` fails, times out after 30 seconds, answers a body that `parseFiguresResponse` rejects, or is still loading, THE Live_Stepper SHALL still let the visitor write, press the seal, wait, testify and read. THE figures state SHALL NOT disable Next, SHALL NOT disable the passkey press, and SHALL NOT keep the seal flow from being built.
2. WHILE the figures request is loading, THE Receipts_Disclosure SHALL show the line "Loading the receipts you can add." and nothing else about figures.
3. IF the figures request has failed, THEN THE Receipts_Disclosure SHALL show one plain line saying receipts can't be added right now and that the letter doesn't need one (final wording in the design), and SHALL show no picker, no "check your connection" text and no reload instruction.
4. IF the figures request has failed, THEN THE sealed letter SHALL carry 0 official figures, and THE seal flow SHALL make the same requests in the same order as for any other letter with 0 official figures (spec 06 R15.1).
5. WHEN the figures request succeeds after the visitor has started typing, THE picker SHALL become available inside the Receipts_Disclosure without changing the text, the questions, the Occasion or any figure already chosen.
6. IF the visitor has pressed the seal control, THEN THE chosen figures SHALL NOT change when a late figures response arrives.
7. THE same rules SHALL hold on `/seal` (`mode="real"`).
8. A test SHALL drive the Live_Stepper with a `fetch` that rejects, with one that answers 500, with one that answers a malformed body, and with one that never answers before the abort; EACH SHALL reach the "Press the seal" step and a stored seal in the seal-flow tests.
9. FOR ALL figures states, the seal control SHALL be live exactly when the crypto module has loaded, the letter and questions are valid and the seal flow state allows it (property test).

### X3. The Figures_API falls back on the server

**User story:** As a judge opening a letter during a Figures_Outage, I want the "now" side to show an honest, labelled figure or one neutral line, so that the reveal still reads.

#### Acceptance Criteria

1. IF the read step or the shape step of `GET /api/figures` fails in database mode, THEN THE Figures_API SHALL log the Figures_Failure_Line and answer 200 with the Fallback_Response: for each Catalogue series, `figure` from `bundledLatestFigure(series)` and `fallback: true` where a bundled figure exists, and `figure: null` and `fallback: false` where none exists.
2. THE Fallback_Response SHALL be built with the existing `chooseFigure` (stored `null`, bundled the latest real figure), `bundledLatestFigure` and the existing `fallback` field of the response, so the browser needs no new code to read it, and every figure SHALL be copied field for field from `fuel-figures.json`. NO value SHALL be invented, estimated, interpolated or converted, and no Fixture_Figure SHALL be served.
3. IF no series has a bundled figure, THEN THE Figures_API SHALL answer 500 `{"error":"figures_unavailable"}` with `Cache-Control: no-store`.
4. THE Fallback_Response SHALL carry `Cache-Control: no-store`, so a recovered database is read on the next request, and SHALL carry `last_success_at: null` for every series (the fetch history could not be read).
5. WHEN the Reveal receives a figure with `fallback: true`, IT SHALL show the Now_Figure with its own period and retrieved date and the Bundled_Note (`REVEAL_COPY.fallbackNote`), and SHALL compute the change only when the existing comparability checks pass. THE Reveal and the FigurePicker SHALL need no change for this; the only Reveal change is criteria 6 and 7.
6. WHERE a sealed figure's series has `figure: null` in the response, or is missing, THE Reveal SHALL show the sealed figure on its own with the existing `nowNotYet` or `nowRetired` line, as it does today. WHERE the request itself fails (the route answered 500, timed out or sent a body `parseFiguresResponse` rejects), THE Reveal SHALL show the sealed figure on its own with the Neutral_Gap_Line ("No newer figure could be reached for this series.", final wording in the design) and SHALL NOT show "Check your connection and reload the page".
7. THE string `nowUnavailableFetch` SHALL be removed from `REVEAL_COPY` and added to the Retired_Phrases with the text "Check your connection and reload the page".
8. THE Reveal SHALL show the Then_Figure with its period in every case (data-integrity.md).
9. THE X3 task SHALL add no module, no JSON and no figure to the browser bundle, and every route SHALL stay at or under its budget in `scripts/check-js-budget.mjs`.
10. THE `respond.ts` header comment and the spec 08 design rule it quotes SHALL be updated by the same task to describe the new rule (the replacement is named under "Rules this spec replaces").
11. THE Journey_Check J1 SHALL fail WHEN any series in the response has `fallback: true` or a null figure, so the Fallback_Response keeps the outage visible (X4.1).
12. FOR ALL outcomes of the request (database success, read failure, shape failure, no bundled figure for any series, timeout, malformed body) and all sealed figures with or without a bundled figure, THE Reveal SHALL show the sealed figure and exactly one of: a Now_Figure with its note where `fallback` is true, a Now_Figure without a note, or one gap line (property test).
13. THE X3 fallback (criteria 1 to 4, 9, 10 and 11, with their tests) SHALL be one data-dev task, inside `src/app/api/figures/**` and `src/lib/figures/**`. THE Reveal change (criteria 6 and 7, in `src/components/reveal/**`) SHALL be a separate, small frontend-dev task that depends on it (G1.8). The data-dev task SHALL be a complete, mergeable PR on its own.

### X4. The outage is detectable, and the check is quiet when the site is healthy

**User story:** As the owner, I want the Journey_Check to stay silent on a healthy site and to fail on the outage and on a broken live path, so that a red run means something.

#### Acceptance Criteria

1. WHEN `/api/figures` answers anything other than 200, or answers 200 with a body in which any series has a null figure or `fallback: true`, THE Journey_Check SHALL fail J1, so the Fallback_Response (X3) never hides an outage.
2. THE Journey_Check SHALL add J9: it opens `/demo/live`, writes a letter of one sentence and one question, steps to "Press the seal" with 0 figures, and stops there without pressing the seal control and without any request that writes to the database. IF `/demo/live` can't reach that step, THEN J9 SHALL fail.
3. THE first X4 task SHALL list every check that fails on a healthy production today (J5 on every persona and size, J6 PH1 on `/` at 360×640, J6 PH1 on `/demo/live` at both Phone_Sizes), reconcile the Landing_Ghost measurement (471 to 670 px in the check against 254 to 454 px measured after 3 s), and decide for each: fix the page or fix the check, with the measurement.
4. THE Owner_Patch to `tools/qa/journey-check.mjs` SHALL change J5 to wait for the `recall` Stage, J2 to begin at `recall` with no "Pick up the letter" press and to fail when any `[data-figure-entry]` has neither a Now_Figure nor the Neutral_Gap_Line nor the Bundled_Note, and J3 to look inside the Receipts_Disclosure.
5. THE Journey_Check SHALL print no FAIL for a state the product intends. A run on a healthy production build SHALL pass J1 to J9, and THE X4 task SHALL attach the full output of that run to the issue.
6. WHEN a run fails, THE Journey_Issue SHALL list only failed checks, and WHEN a run passes with the Journey_Issue open, THE Journey_Check SHALL comment and close it (already true; kept).
7. THE `/api/health/ready` route SHALL keep probing the database through its own probe client only, and SHALL NOT probe `/api/figures`. THE reasons SHALL be recorded in the task's PR description: one replica, so a failing readiness removes the only pod from the Service; letters no longer depend on figures (X2); the Journey_Check is the figures monitor.
8. J2 SHALL keep running on the 00:47 UTC run and on manual runs only, because each walk stores one encrypted Recall_Record (spec 09 OD8). J9 SHALL run on every run.
9. THE Owner_Patch SHALL add `/seal` reaching "Press the seal" with 0 figures as J10 WHERE the owner records a go on 20 November (L6.3).

### X5. The `marks` Stage controls are visible, reachable and still

**User story:** As a judge at the climax, I want to read the seal instruction and use the buttons, whether I use a mouse, a keyboard or a screen reader.

#### Acceptance Criteria

1. AT 900 px and wider, THE Seal_Hint and the Skip_Link text SHALL clear WCAG 2.2 AA (4.5:1) against the surface under them, using the dark-scene text colour, not `--ink`.
2. THE contrast test SHALL gain a pair for every text colour used inside the Seal_Group on `--bg` and on the lightest stop of the light shaft behind it, read from the real CSS tokens, and SHALL print the ratios.
3. NO Focusable_Under_Hidden SHALL exist in the ceremony. THE Seal_Button and the Skip_Link SHALL render outside the `aria-hidden` Ghost layer, placed in CSS against the held Envelope so that their position at 900 px and wider is unchanged (the design chooses the mechanism).
4. A test SHALL fail on any Focusable_Under_Hidden in the ceremony. It SHALL render every Stage at a 900 px and wider layout and a phone layout and parse the markup, with no new dependency.
5. WHILE the Stage is `marks` or `seal`, THE Ghost SHALL hold still (no Idle_Bob), so the Seal_Button, the Skip_Link and the pressable seal don't move while they can be pressed.
6. THE `marks` Stage SHALL keep the C6 layout rules of spec 10 (the Seal_Group beside the Ghost_Body_Box edge, level with the WaxSeal; no overlap with the Envelope text), and the existing GZ1 and G1 to G3 layout checks SHALL still pass.
7. THE task SHALL attach measured contrast ratios for the hint and the Skip_Link at 2560×1440, 1366×800 and 1280×800.

### Group W. The walk

### W1. Walk the live path on a real build before redesigning it

**User story:** As the owner, I want the whole live path run once on a real build, so that no redesign task is built on a step nobody has seen work.

#### Acceptance Criteria

1. THE W1 task SHALL run as task 2, in parallel with the group X tasks, and BEFORE any group L, P or H task starts SHALL walk `/demo/live` end to end on `npm run build` and `next start`, against a local PostgreSQL with migrations applied, `RP_ID=localhost`, `APP_ORIGIN=http://localhost:3000`, and a headless Chromium with a virtual authenticator that reports PRF support.
2. THE Walk SHALL cover, in order: write a letter with one question; choose one figure; press the seal; create and confirm the passkey; see the sealed view and the letter card; wait 30 seconds; unlock with the passkey; answer the text question and the figure question; break the seal by press-and-hold; read the letter; open the receipts; reach the close.
3. THE Walk SHALL run these variants: figures available; `/api/figures` forced to fail (expected to be blocked at the figures step until X2 merges, and recorded as such); the backup-key path (seal with a backup key, unlock with the key); and a letter with one question and no figure (expected to be blocked today, and recorded as such).
4. THE Walk_Findings SHALL be written into the W1 issue body (not a comment), with, per step: pass or fail; what was observed; the screenshot names at 1366×800 and 390×844; and, for every defect, the step, the expected result, the observed result and the suspected file.
5. THE W1 task SHALL change no product file. It MAY add a test file under `src/test/integration/` that replays the Walk, and SHALL say in its PR description whether the replay can run in CI.
6. IF the Walk finds a defect on the seal, wait, unlock, testify or reveal path, THEN THE owner SHALL add a fix task to `tasks.md` with a number lower than the first group L task, and every group L, P and H task SHALL list that fix task under "Depends on" (G3.7).
7. WHEN the X2 task merges, THE W1 task SHALL re-run only the "`/api/figures` forced to fail" variant against the merged build and record the result in the W1 issue body, without repeating the other variants. THE recorded date of the full Walk SHALL stay the first run's date.
8. THE Walk_Findings SHALL state which of the brief's unverified steps passed: the passkey seal, the Wait step, Testify with Author_Questions, and the live Reveal.

### Group L. The letter becomes general (P1)

### L1. A letter seals with no figures

**User story:** As someone with a worry at work, I want to seal a letter with no numbers in it, so that Revenant is for me too.

#### Acceptance Criteria

1. THE Write step on `/demo/live` and `/seal` SHALL accept a letter with 0 official figures when the letter has at least one non-empty Author_Question.
2. EVERY Occasion, including "Blank", SHALL start the Write step with one default Author_Question that fits any letter, for example "Before you read it, what do you remember writing?" (final wording in the design; the word "writing" is its Sealing_Day_Anchor). THE author MAY edit or remove it. IF the author has removed every question and the letter has 0 official figures, THEN THE Write step SHALL block sealing and say plainly that a question or a receipt is needed, so there is something to answer when the letter opens (final wording in the design). Self-reported numbers SHALL NOT count. A letter never starts in the blocked state.
3. THE rule in acceptance criteria 1 and 2 SHALL be the same in both modes. `minFiguresFor`, `MIN_FIGURES` and `figures_none` SHALL be replaced by one rule named for the letter, and the old names SHALL be removed.
4. THE figure picker and "Your own numbers" SHALL sit in one closed Receipts_Disclosure titled "Add a receipt", after the question rows. THE disclosure SHALL be a native `details`, closed by default, with its content in the document.
5. THE Receipts_Disclosure SHALL explain a receipt in one neutral sentence, for example "A receipt is a number sealed with its source and date, so you can compare it when the letter opens." (final wording in the design).
6. THE Live_Stepper SHALL have five steps, in order: Write, Press the seal, Wait, Testify, See the receipts. THE Step_Indicator SHALL show five items. Back SHALL keep the draft before the seal is stored and SHALL not be offered after (spec 09 D2.2, D2.3).
7. THE sealed payload of a letter with no official figures SHALL be a v1 payload with `format_version: 1`, `metrics` and `figures` empty (or holding only self-reported entries), and the questions as v1 text questions. A test SHALL cover 0 official figures with 1 to 3 questions in both modes, and self-reported-only with at least one question.
8. THE seal requests and their order SHALL stay as in spec 06 R15.1; THE first asynchronous call of the passkey press SHALL stay the WebAuthn call (spec 06 R17.2).
9. THE `/demo/live` page SHALL work with figures available and with them unavailable (X2).

### L2. Occasions

**User story:** As an author, I want to start from what I am writing about, so that I'm not facing a blank page.

#### Acceptance Criteria

1. THE Write step SHALL start with a single-choice Occasion control above the letter field, offering "The year ahead", "Work", "Family", "A decision" and "Blank", each as a button with a visible label and `aria-pressed`.
2. WHEN the visitor chooses an Occasion, THE Write step SHALL put the Occasion's letter starter into the letter field only if the field is empty or still holds a previous unedited starter, and SHALL replace only question rows that are empty or still hold an unedited Occasion question with the Occasion's one to three questions. THE Write step SHALL NOT overwrite text the visitor typed.
3. EACH Occasion question SHALL be 1 to 200 code points, SHALL carry a Sealing_Day_Anchor (for the default question of L1.2 the word "writing" counts as one), SHALL be readable on the opening day, SHALL contain no digit, no party, policy or election term and no word that presumes an answer, and SHALL NOT use "right now", "today", "currently" or "this year".
4. EACH Occasion letter starter SHALL be one or two sentences in the author's voice, SHALL contain no digit and SHALL not lead toward an answer.
5. THE Occasion choice SHALL NOT be stored, sent or recorded: no request before the seal SHALL carry it, the sealed payload SHALL hold no key for it, and nothing SHALL be written to storage, cookies or the URL. A test SHALL assert the seal request bodies and the payload contain no Occasion identifier.
6. THE Occasion strings SHALL be Our_Copy until the visitor edits them, and SHALL be scanned by the copy checks; text the visitor edits or writes SHALL be User_Content and SHALL NOT be checked at runtime (spec 10 S2.4).
7. THE Prompt_Starters and the Question_Starters SHALL be removed from the Write step. THE Occasion control SHALL replace both. THE `answerInLetter` line MAY stay as one line under the question rows.
8. THE Occasion_Table SHALL start from this proposal. Every row starts with the same default question (L1.2). Every row except "Blank" adds one question about its subject and one prediction question anchored to both days, so a row holds at most three questions. The design confirms each string against the copy test and records the reviewer's name.

   | Occasion | Letter starter | Questions (in order) |
   |---|---|---|
   | The year ahead | "This is where my year stands as I write this." | "Before you read it, what do you remember writing?"; "What did you hope the year would hold when you wrote this?"; "When you wrote this, what did you think would have happened by the day you opened it?" |
   | Work | "This is what my work looks like as I write this, and what I am still working out." | "Before you read it, what do you remember writing?"; "What was on your mind about work when you wrote this?"; "When you wrote this, what did you think would have happened by the day you opened it?" |
   | Family | "This is how things are with the people closest to me as I write this." | "Before you read it, what do you remember writing?"; "Who were you thinking about most when you wrote this?"; "When you wrote this, what did you think would have happened by the day you opened it?" |
   | A decision | "This is the decision in front of me, and where I lean as I write this." | "Before you read it, what do you remember writing?"; "What were you weighing when you wrote this?"; "When you wrote this, what did you think would have happened by the day you opened it?" |
   | Blank | (empty) | "Before you read it, what do you remember writing?" |

9. THE Occasion control SHALL be reachable by keyboard, SHALL have targets of at least 44×44 CSS px below 600 px, and SHALL wrap rather than scroll sideways at 360×640.
10. FOR ALL Occasions, including "Blank", the filled Write step SHALL start with at least one non-empty Author_Question and at most three, and SHALL pass the L1 rule (property test). Choosing an Occasion SHALL never leave the Write step in the blocked state of L1.2.
11. THE prediction question SHALL ask what the author expected, SHALL be read as a recall question like any other Author_Question, and SHALL NOT be scored, resolved against a figure or compared with anything (`neutrality.md`, "Predictions" does not apply to it).

### L3. A Write step that fits one screen

**User story:** As a judge, I want to see the Next button without scrolling, so that I know the demo is short.

#### Acceptance Criteria

1. AT 2560×1440, 1366×800 and 1280×800, THE Write step's Next control SHALL be fully inside the First_Viewport, with the Occasion control, the letter field, the question rows and the closed Receipts_Disclosure above it.
2. AT 390×844, THE Write step's Next control SHALL be fully inside the First_Viewport.
3. AT 360×640, THE Write step SHALL cause no horizontal scroll on the document or on any card, and its page height SHALL be at most 1.5 times the viewport height (960 px), so Next is one short scroll away.
4. THE letter field SHALL keep its starting height of three rows and its growth cap of half the visual viewport (spec 09 P9).
5. ABOVE the Next control THE Write step SHALL hold only: the Occasion control, the letter field with its count, up to three question rows with "Add a question", at most one hint line, and the closed Receipts_Disclosure.
6. A field's validation message SHALL show only after the field was touched or a seal was attempted (spec 09 A4.4).
7. THE Owner_Patch to the Journey_Check and `layout-check.mjs` SHALL set the PH1 threshold for the `/demo/live` Write step to acceptance criteria 1 to 3 and SHALL name this requirement in the check's message.
8. THE task SHALL attach the measured top and bottom of the Next control and the page height at the five Evidence_Sizes.

### L4. A 30-second demo that says what it is

**User story:** As a judge who waits 30 seconds, I want the demo to tell me it is a rehearsal, so that I understand what a real letter would be.

#### Acceptance Criteria

1. THE `/demo/live` Write step SHALL show the Rehearsal_Line under the heading: "This is a rehearsal. A real letter stays sealed for months. This one opens in 30 seconds." (final wording in the design).
2. THE `/demo/live` Write step SHALL start with the "Blank" Occasion chosen, so its first Author_Question row holds the default question of L1.2. The visitor MAY edit, clear or remove it. THE old Live_Prefill "What's on your mind right now?" and the first draft's "What was on your mind when you wrote this?" SHALL not appear.
3. THE Wait step SHALL show the Rehearsal_Line next to the countdown.
4. THE live Close note SHALL say that the letter was locked for 30 seconds and that a real letter stays sealed for months. THE sentence "For a longer comparison, open a persona letter." SHALL show only when the letter holds official figures; the link to the persona letters SHALL show for every live letter.
5. THE Rehearsal_Line SHALL NOT appear on `/seal`, on `/l/[id]` for a Real_Letter or on any persona page.
6. WHERE the letter holds figures, THE Reveal SHALL still show them honestly (the Now_Figure matches the Then_Figure after 30 seconds; nothing is made up, spec 06 R18.6).

### L5. A reveal with no figures is a complete ending

**User story:** As someone who sealed a letter with no numbers, I want an ending that feels finished.

#### Acceptance Criteria

1. WHEN a letter has 0 official figures, THE Reveal SHALL go from the letter to the Close for every letter kind (persona, Live_Letter, Real_Letter), with no figures Stage, no control named "See the receipts" or "See the numbers", no empty heading and no empty panel.
2. THE persona Close for a letter with no figures SHALL end on a line that names the testimony and the letter and leaves the meaning to the reader (final wording in the design, neutral). IT SHALL NOT mention numbers, figures or the record of prices.
3. THE persona Step_Indicator for a letter with no figures SHALL show Testify, Break the seal and Read, and no fourth step.
4. THE Skip_Link on `marks` SHALL read "Skip to the letter" for a letter with no figures (spec 10 C6.6 kept).
5. THE rendered markup of the reveal of a letter with no figures SHALL contain none of: a "then and now" heading, a Receipt_Card, a Number_Line, the word "figures" as a heading. A test SHALL assert it for each letter kind.
6. A Real_Letter with no figures SHALL end with no demo links (spec 08 R24.11 kept).

### L6. Real sealing on `/seal` for judging

**User story:** As the owner, I want a recorded decision on real sealing, so that nobody promises it by accident.

#### Acceptance Criteria

1. THE owner SHALL record the go or no-go for `/seal` on 20 November 2026 in a new owner issue (spec 08 R25).
2. IF no decision is recorded by the end of 20 November 2026, THEN THE default SHALL be no-go: `REAL_SEALING` stays `off`, `/seal` answers 404, and no page, README line, video script, write-up or metadata SHALL mention sealing a real letter or link to `/seal`.
3. IF the owner records a go, THEN: the owner sets `realSealing: true` in the GitOps values (the chart default stays `false`); `/seal` shows the existing `REAL_COPY.testNotice` above the Write step and on the sealed view; the notice says the earliest opening is three months from now; the live Close note links to `/seal`; the landing hero stays at two calls to action.
4. IF the owner records a go, THEN the sealed view SHALL tell the author that a judge-sealed letter can't be opened before 29 January 2027.
5. THE Journey_Check SHALL include J10 (X4.9) only WHERE a go is recorded.
6. THE L6 decision SHALL NOT change X1 to X5, L1 to L5 or P1 to P5.

### Group P. Persona demo (P1)

### P1. A persona whose letter is about plans and worries

**User story:** As a judge, I want a demo letter that isn't about prices, and to see her testimony beside her letter, so that I see what Revenant does for any letter without having to remember her life.

#### Acceptance Criteria

1. THE Persona_List SHALL gain one Text_Persona whose letter is about everyday plans and worries (work, family, a decision, a hope), with 0 metrics, 1 to 3 Author_Questions and one Persona_Answer per question, a new letter ID, a written-as-of date inside one of the three fixed windows in `product.md`, and a plain opening date with no event name.
2. THE persona schema SHALL accept `metrics: []` and an `author_questions` array of 0 to 3 strings of 1 to 200 code points, SHALL reject a persona with both empty, and SHALL require, for a persona with `author_questions`, a Persona_Answers entry of the same length with each answer 1 to 500 code points. THE schema SHALL reject a persona whose answers and questions differ in number. The two fuel personas SHALL stay unchanged and their sealed payloads SHALL stay byte-identical (no reseal).
3. THE Sealing_Script SHALL seal the Text_Persona with its Author_Questions as v1 text questions and `metrics` and `figures` empty, and SHALL report the two fuel personas as `skipped`. THE Sealing_Script change SHALL be a crypto-dev task that follows the frontend-dev schema task (G1.8).
4. THE letter text SHALL follow spec 03 R1.6, R1.7, R1.9 and R1.10 and the neutrality persona rules: no price, figure, digit or currency, no election or party term, no stereotype. THE copy-test record `content/personas/letters/<key>-copy-test.md` SHALL carry the reviewer's name before sealing.
5. THE Persona_Answers SHALL be stored in a content file under `content/personas/` (the design names the file), SHALL NOT be written into the sealed payload, SHALL NOT be stored in any database table or sent by any API, and SHALL reach the page only as static content of the persona page. NO Recall_Record SHALL be stored for the Text_Persona walk: THE Opening_Flow SHALL make no `POST /api/openings` request for it, and a test with a `fetch` stub SHALL assert it. The `GET` that releases the server secret SHALL stay as for any persona letter.
6. THE Text_Persona walk SHALL replace the answering of questions with reading: THE `recall` Stage SHALL show one question at a time, each with its Persona_Answer and the Fictional_Label, a plain control to go on, and, after the last, the control that leads to "Break the seal". THE Stage SHALL contain no answer field, no "No answer" control, no Sample_Answer, no "Record my answers" control and no Memory_Line. THE Fastest_Path SHALL be one activation per question plus "Break the seal", and the QA step SHALL record the activation count.
7. THE Fictional_Label SHALL appear next to every Persona_Answer on every screen that shows one: the `recall` Stage, the testimony block on the `letter` Stage, and the close if it repeats them. THE page SHALL keep the fictional-persona note of P3 and SHALL NOT present a Persona_Answer as the judge's own, as a record, or as a memory the judge has.
8. THE Persona_Answers SHALL follow the letter rules of criterion 4 (no price, figure, digit or currency, no election or party term, no stereotype, everyday life) and SHALL be in the persona's voice, in the first person. THE Persona_Answers and the letter SHALL differ in plain, everyday ways (a different detail, a different order, a different emphasis) that do not touch money, health, character, competence or politics. NO Persona_Answer SHALL refer to the letter, to what she wrote, to remembering, forgetting, changing her mind or being mistaken. THE copy-test record `content/personas/letters/<key>-copy-test.md` SHALL cover the Persona_Answers and carry the reviewer's name before sealing.
9. THE page SHALL say nothing about the difference between the Persona_Answers and the letter. THE Reveal SHALL NOT highlight, mark, pair, align, count, score, summarise or explain any difference, SHALL NOT call any answer right, wrong, close, near, off, accurate, changed or mistaken, and SHALL use no similarity measure, keyword match or AI (`neutrality.md`). THE order SHALL stay: her testimony, then her letter (spec 10 C8.7).
10. THE Demo_Index SHALL show three envelopes, side by side at the Desktop_Sizes and stacked at the Phone_Sizes, with every open link inside the First_Viewport at 1366×800 and 1280×800 (spec 09 DX1 kept).
11. THE owner SHALL run the Sealing_Script for the new letter ID against production and confirm the row exists before the image that carries the new ID is deployed (spec 10 P2.2 order), and SHALL record the script output in the task's issue. THE Production_Check SHALL open the Text_Persona through to `close`.
12. THE tests SHALL cover: the schema cases, including a mismatch between answers and questions; the letter and answer checks with zero prices and zero digits; the Persona_List count; the Fictional_Label present next to every Persona_Answer in the markup of `recall` and `letter`; no request to `/api/openings` during the walk; no answer field in the markup of `recall`; and the Opening_Flow reaching `close` for a text-only payload with no figures Stage.
13. THE Journey_Check SHALL walk the first Stage of all three personas, and the Text_Persona through to `close` without any answer typed.

### P2. A prefilled sample answer never equals the record

**User story:** As a judge, I want a sample answer that is only a sample, so that keeping it never looks like remembering correctly.

#### Acceptance Criteria

1. NO Sample_Candidate of any persona Figure_Question SHALL equal the Then_Value at Display_Precision, after the Display_Rescale. THE Record_Candidate SHALL be removed from `content/personas/letters/samples.json`.
2. EACH question SHALL keep 3 to 5 Sample_Candidates, and the Spread_Rule SHALL hold without a Record_Candidate: at least one Near_Candidate (within 5% of the Then_Value and unequal), one Below_Candidate (at most 85%) and one Above_Candidate (at least 115%).
3. A test SHALL compute the display-precision Then_Value from each sealed payload and fail if any candidate equals it. THE spec 10 property "exactly one Record_Candidate" SHALL be inverted to "none".
4. THE Sample_Label, the Sample_Note and the rule that no answer is called right, close, near, wrong, off or accurate SHALL stay unchanged.
5. IF the judge types a value equal to the Then_Value, THEN THE Reveal SHALL treat it as any other typed answer.
6. THE sealed payloads SHALL NOT change.

### P3. The Testify screen says each thing once

**User story:** As a judge, I want a Testify screen with no repeated notes, so that the first question is the first thing I see.

#### Acceptance Criteria

1. WHILE the Stage is `recall` on a persona page, THE document SHALL contain exactly one element carrying the fictional-persona note, exactly one written-as-of line, exactly one opens line and exactly one seal-intact statement, at every Evidence_Size.
2. THE design SHALL name the component that keeps each of the four, and every other component SHALL stop rendering it during `recall`. A component MAY render it in another Stage.
3. THE fictional-persona note SHALL stay visible in some form in every Stage of a persona page (the reader always knows the letter is a demo).
4. THE first question's field SHALL stay inside the First_Viewport at every Evidence_Size and its primary control inside it at every size but 360×640 (spec 10 C4.4 kept).
5. A test SHALL count the four items in the markup of `recall` for each persona and fail when any count is not 1.

### P4. The first lines of the letter are in view

**User story:** As a judge who just broke the seal, I want to see the letter at once, so that the reveal feels like opening something.

#### Acceptance Criteria

1. WHEN the `letter` Stage starts, THE first three lines of the Letter_Text SHALL be fully inside the First_Viewport at every Evidence_Size, for every persona, after the Stage's entry positioning.
2. THE document order SHALL stay: the testimony, then the letter (spec 10 C8.7). THE full text of every Text_Answer SHALL stay in the document. THE displayed answer MAY be clamped to two lines with a control that shows the full text.
3. THE Seal_Verdict and its fingerprint control SHALL be one line above the paper.
4. IF clamping is not enough at 360×640, THEN THE Stage MAY position the paper's top edge just below the Top_Bar on entry, without moving focus away from the heading rule of spec 08 R2.
5. THE Owner_Patch to `layout-check.mjs` SHALL add LT1 `letter-first-lines`: the first three line boxes of `[data-letter-text]` are inside the viewport at the start of `letter`, for each persona.

### P5. Receipts at one precision, with a short name

**User story:** As a judge reading the receipts, I want the numbers in the same shape as my answer, with a name I recognise.

#### Acceptance Criteria

1. THE Receipt_Card SHALL show the Then and Now values at Display_Precision, using `formatValue(value, region, 2)` on the rescaled value, so a Then_Value of 3.643 reads 3.64.
2. THE source control SHALL show the As_Published_Value with its unit ("As published: 3.643 USD per gallon"), so the figure's `value` stays visible exactly as sealed.
3. THE change line's result SHALL be computed from the As_Published_Values, and its formula SHALL show them. THE card SHALL say once, in one line, that the values on the card are rounded for display and the published values are in the source details.
4. THE card heading SHALL be the Short_Name, found by a lookup keyed by the sealed `metric_id`; WHERE the id is not in the lookup, THE heading SHALL be the sealed `display_name`. THE Series_Name SHALL show under Source with the source, the series ID and the link. THE lookup SHALL NOT read the Catalogue.
5. THE Short_Names SHALL be Our_Copy of at most 40 characters, neutral, with no direction word.
6. THE rules SHALL hold on persona, live and real letters.
7. A test SHALL open a payload whose `metric_id` is not in the lookup and assert the Receipt_Card renders with the sealed `display_name`.

### Group H. Landing and presentation (P1)

### H1. No dead landing components

**User story:** As a visitor scrolling past the hero, I want the story of the seal, so that I understand what this is.

#### Acceptance Criteria

1. THE landing page SHALL render `RitualSection`, `ResurrectionSection`, `NoSealSection` and the Coven_Strip below the hero, in that order, as server components with no new client JavaScript, and `/` SHALL stay at or under its 160 kB budget.
2. THE files `SampleReceipt.tsx`, `SampleReceiptView.tsx`, `sample-receipt.ts` and their tests SHALL be deleted, with the `SampleReceipt` copy keys. THE `CovenStrip` SHALL be kept and reduced to the Coven_Strip: one line of text (the existing `covenTitle`, final wording in the design) and two links, to the `.kiro` folder (`COVEN_LINKS.kiro`) and to `docs/agent-loop.md` (`COVEN_LINKS.loop`). THE `KiroStats` type, `countLabel`, the `stats` prop and the `covenCounts` copy keys SHALL be removed. THE Coven_Strip SHALL take no props, show no count and read no build-time data, and the task SHALL add no `src/lib/kiro-stats.ts` and no `env` entry in `next.config.ts`.
3. EVERY component file under `src/components/landing/` SHALL be imported by a rendered route or be deleted. A source-scan test SHALL fail on an unimported landing component.
4. THE sections SHALL be written for the general letter (H2.1) and SHALL name no fuel price as what a letter holds.
5. THE How_Page link and the repository link SHALL appear exactly once on `/`, in the footer (spec 09 P11.1 kept). THE two Coven_Strip links are links to paths inside the repository and SHALL each appear once, only in the Coven_Strip.
6. AT both Phone_Sizes the sections and the Coven_Strip SHALL be one column with no sideways scroll and every link at least 44×44 CSS px.
7. THE hero's First_Viewport rules (spec 09 B1, P1) SHALL still pass.

### H2. The story is about any letter

**User story:** As a judge, I want the first sentence to say what Revenant is for, so that I know in ten seconds.

#### Acceptance Criteria

1. THE `BRAND_COPY.heroSentence` SHALL describe sealing something you believe now and testifying before you read, with prices as one example of a receipt (final wording in the design, for example "Seal what you believe now, a goal, a worry, a decision. When it opens, you testify first, then read what you wrote.").
2. THE `BRAND_COPY.ritualSteps` SHALL have four entries: Write, Press the seal, Testify, See the receipts. THE "Seal the figures" step SHALL retire. THE Write line SHALL mention up to three questions and an optional receipt; THE See the receipts line SHALL say "Your testimony, then what you wrote, then any numbers then and now."
3. THE page metadata, `HOME_DESCRIPTION`, the Open Graph image source, the How_Page lead and the landing sections SHALL take their strings from Brand_Copy where Brand_Copy has them (spec 09 F2.1).
4. THE README opening, "The ritual" and "What we resurrected" sections SHALL match Brand_Copy (Owner_Patch, H3). Spec 09 F2.4's check that README and Brand_Copy agree SHALL still pass.
5. "Seal the figures" as a step name and "fuel prices from the US or the EU" as what a letter holds SHALL join the Retired_Phrases for source files under `src/`, with the copy-test records exempt.
6. THE landing calls to action SHALL stay: the primary "Open the demo letters" to `/demo`, and the secondary live demo link while the live demo is on, reworded as "Seal your own. It opens 30 seconds after you seal it." only if the Rehearsal_Line (L4.1) is consistent with it.

### H3. README status (Owner_Patch)

**User story:** As a judge reading the README, I want it to match the site.

#### Acceptance Criteria

1. THE README status line (now line 64) SHALL say that specs 01 to 10 are complete and spec 11 (any letter) is in progress, with the date of the patch.
2. THE README persona demo line (now line 59, "pre-sealed for a real US election window") SHALL describe the personas by their written-as-of and opening dates and SHALL NOT name an election.
3. THE README "merged pull requests" count (now line 114, 168) SHALL be recomputed with `gh pr list --state merged --limit 1000 --json number -q length` at the final SHA (184 on 10 November 2026) and SHALL match the write-up.
4. THE README opening, "The ritual", "What's actually built" and Judge quick path SHALL describe the general letter, the optional receipt, the rehearsal and the text persona (H2.4).
5. THE patch SHALL be attached to the final audit task and SHALL build on the README as it stands on `main`.

### H4. The write-up's OWNER notes, with evidence for each (Owner_Patch)

**User story:** As the owner, I want each unfinished note in `docs/kiro-writeup.md` to come with the commands and links that fill it, so that I can finish it in one sitting.

#### Acceptance Criteria

1. THE H4 task SHALL deliver an Owner_Patch to `docs/kiro-writeup.md`, not a commit, because `docs/**` is owner-only.
2. THE patch SHALL leave each of the seven OWNER notes in place and SHALL add under each one an "Evidence" list the owner can paste from:
   1. Recount note (line 5): the final SHA (`git rev-parse HEAD`); spec count and task counts (the loop in section 4; spec 10 now has 17 tasks, and spec 11 adds its own); agent-tag commit counts (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`; 10 November: frontend-dev 79, platform-dev 22, data-dev 19, crypto-dev 12, owner 10); merged PRs (184 on 10 November); property test files (`git ls-files '*.property.test.*' | wc -l`; 43 on 10 November); hooks (4) and agents (5).
   2. Kiro surfaces (line 15): `docs/agent-loop.md`; counts of Crew-run PRs (`gh pr list --state merged --search 'head:agent/' --json number -q length`); the IDE hooks in `.kiro/hooks/`.
   3. One real hook block (line 40): a PR or run where the stop hook or scope check stopped an agent. Search: `gh pr list --state all --search 'scope-check OR tone-check in:body'` and the dispatcher run logs. Spec 10's `source-scan` and tone-check hits are candidates.
   4. Spec loop vs vibe coding (line 64): the changes made outside specs, from `git log --format='%h %s' --no-merges | grep -v -E '^[0-9a-f]+ (\[|Tick completed)'` (examples on 10 November: `535b7c7` fix(landing) #284, `43853c8` #290, `5981b0d` and `83f47d9` README images); and the 10 `[owner]` commits.
   5. Property tests that caught a bug (line 78): `git log -i --grep=property --format='%h %s'` and the fix PRs after a property test failed; the owner picks two.
   6. Kiro powers (line 82): whether any is installed (`ls ~/.kiro/powers`, and the Powers panel in the IDE); the note says plainly "used" or "not used".
   7. What went wrong once (line 88): the first Journey_Check run, `https://github.com/devclef/Revenant/actions/runs/42530503661` (8 November 2026, 22:29 UTC), and the Journey_Issue it opened, `https://github.com/devclef/Revenant/issues/318` (22:31 UTC); and this spec's own story: the outage that the check saw on 9 and 10 November while ten stale failures hid it (X4).
3. THE patch SHALL also fix the text that has gone stale: "spec 10 is in progress", "specs 01 to 09", the SHA `1b28a81` and the 168 count.
4. THE patch SHALL keep every number tied to a command in the same sentence (spec 09 E1.4).

## Notes for the design phase

- X1 and X5 are the two items where the cause is already partly known from code (X5) or not known at all (X1). The design should treat X1 as "observability first, then the named cause", and should say which of the three failure classes in X1.3 each candidate fix covers.
- L1, L2 and L3 change the same Write step and the same stepper files. The design should plan them as one chain of tasks in `src/components/live/`.
- The spec 10 sample-answer, Author_Testimony, Close and Step_Indicator code already handles letters with no figures; the design should list the places that still say "numbers" or "figures" for a letter that has none.
