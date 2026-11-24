# Implementation Plan: 20 Efterhand rename

## Overview

Spec 20 renames the app from Revenant to Efterhand with one mechanical rule, the Rename_Map (`Revenant` → `Efterhand`, `revenant` → `efterhand`, `REVENANT` → `EFTERHAND`). It covers copy, the domain, the repository, the image, the Helm chart, environment variables and internal strings. The owner redeploys with an empty database, so no task adds a fallback, alias or migration for the old name (Requirement 1.6).

`requirements.md` says what must hold and `design.md` says which files change and how. The work runs in six steps (Requirement 10). Each step's tasks start only when the tasks before them are merged or done.

| Tasks | Step | What | Roles |
|---|---|---|---|
| 1 | 1 | Steering docs renamed | owner |
| 2 | 1 | `scripts/check.sh` chart lint accepts either chart folder and fails if neither exists | owner |
| 3 | 2 | Frontend rename: copy, titles, Wordmark, keepsakes, Figures_Stub, QR_Vectors, seal-page goldens, fit checks | frontend-dev |
| 4 | 2 | Crypto rename: key-derivation labels, passkey names, Golden_V2 reseal | crypto-dev |
| 5 | 3 | Data rename: Format_String, fetch lock | data-dev |
| 6 | 3 | Platform rename: chart move, trigger function, package, `tools/qa`, Gate_Baseline | platform-dev |
| 7 | 4 | Owner rename: dispatcher, agents, hooks, CI, docs, `check.sh` reads only the new chart | owner |
| 8 | 5 | The owner renames the GitHub repository to `devclef/Efterhand` | owner |
| 9 | 6 | Final switch: Kept_Repo_Pointers, remote, spec-sync, build, User_Checklist | owner |

Ownership is taken from `.github/agents.json`. Where two roles' paths overlap, the design's "Where the requirements meet each other" decides: `src/test/integration/**` renames are crypto-dev's and platform-dev only adds the `efterhand:` prefix assertions there; `drizzle/**` is platform-dev's; `src/app/layout.tsx` and `src/app/globals.css` are frontend-dev's.

Each task is one GitHub issue. Tasks 3 to 6 are each one PR for one role, inside that role's paths (plus `shared`) and under `max_changed_lines` (5,000, test files excluded). Tasks 1, 2, 7, 8 and 9 carry Agent: `owner`, so spec-sync opens them with the `agent:owner` label. The dispatcher claims only the four dev roles (`ROLES` in the dispatcher), so it never starts a run for them, and the owner closes each one when it is done. "Depends on" lists only task numbers of this spec, and the agent loop starts an issue only when every issue it depends on is closed. Tasks 3 and 4 run at the same time, and so do tasks 5 and 6 (Requirement 10.4).

## Decisions (fixed)

The design records five places where requirements meet each other. Each is decided as the design's default:

- **`src/test/integration/**`.** Task 4 (crypto-dev) applies the Rename_Map to every Old_Name there, including the comments that name the trigger function. Task 6 (platform-dev) only adds `rejects.toThrow(/^efterhand: /)` expectations and renames nothing else there. Task 6's Residual_Search for Requirement 1.10 excludes `src/test/integration/**`. If task 4 is not merged when task 6 opens its PR, task 6 rebases after it.
- **Requirement 8.7 versus 1.8.** Existing assertion lines stay as they are. Task 6 adds one `/^efterhand: /` expectation beside each (table, operation) the integration tests already cover.
- **`drizzle/**`** is renamed only by task 6. Tasks 4 and 5 leave it byte-for-byte unchanged.
- **`src/app/layout.tsx` and `src/app/globals.css`** are renamed only by task 3. Task 6 does not touch them.
- **The missing-chart failure in `check.sh`** is a deliberate exception to the script's "runs only when its files exist" header. Task 2 adds one sentence to the header naming it.

Also fixed: page titles may show both names between the merges of task 3 (layout title) and task 6 (`SITE_NAME`), and no task adds code to prevent that (Requirement 10.7). Steering docs never mention this spec or its one-time exception (Requirement 3.6).

## Rules for every task

- **Baseline.** "The baseline" is `e3087997`, the commit the requirements were read from. Every mention of `e3087997` in this file, `requirements.md` and `design.md` means that commit. Each task re-runs the Residual_Search for its paths when it starts and reports any difference from the design's file lists in a commit message body.
- **The rule.** Apply the Rename_Map to every Old_Name in your Scope: contents, file names, folder names, identifiers, paths, URLs, comments and test strings (Requirement 1.1). A case form outside the map (for example `ReVenant`) becomes `Efterhand` when the first letter is upper case and the rest are not all upper case, otherwise `efterhand`; name the file and line in a commit message body (Requirement 1.2).
- **No compatibility code (Requirement 1.6, 10.6).** No code path reads, accepts, writes or maps an old label, the old Format_String, the old lock name, the old trigger function, the old chart path (from task 7 on) or an old environment variable. If your PR fails because a dependency is not merged, wait for that merge and rebase onto `main`.
- **Moves.** A file or folder whose name holds the Old_Name is moved with `git mv` in a commit that changes its contents by at most the Rename_Map, so `git log --follow` traces it (Requirement 1.7).
- **Untouched.** Change nothing under `.kiro/specs/` except this spec's folder (Requirement 1.3). Change no binary file, and do not list or check binary files for the Old_Name (Requirement 1.4). Change no Visual_Language_Name (`Ghost_Body_Box`, `Ghost`, `CovenStrip`, `Landing_Ghost`, the icon artwork); a `git grep -c` for each finds the same count before and after (Requirement 1.5).
- **Branch and PR.** For role tasks, the dispatcher creates `agent/<role>/issue-N` and the PR "Closes #N". Do not push to `main` or merge. After a hook failure, make a new commit; do not amend.
- **Scope.** Change only files that match your role's paths in `.github/agents.json` (or `shared`) and are named in your task's Scope, plus test files that assert a value your task changed. Check your diff with `git diff --name-only origin/main` before you finish and put the list in a commit message body.
- **Tests keep their meaning (Requirement 2).** Delete no test file or test case; a `git mv` to the renamed path counts as kept. Add no `.skip`, `.only`, `.todo`, `xit`, `xdescribe` or `it.fails`, and no early return. An assertion on a renamed value keeps its kind: equality stays equality on the full value, a negative check stays negative on the renamed text, a pattern stays a pattern. State the `npm test` case count on the merge base and on your head commit in a commit message body; head is at least base, with zero failures.
- **Fixed test values (Requirement 2.5 to 2.9).** Recompute a fixed value only with its recorded procedure (the design's "Fixtures" table), never by copying the output of the code under test or a failing run. The commit body that holds a recomputed value names the file, the procedure and every input. A fixed value whose inputs hold no Old_Name stays byte-identical.
- **Rename_Map oracle.** Where a task says a file differs "only by the Rename_Map", check it with the design's oracle and paste the result ("no output") into a commit message body:
  `rmap() { sed -e 's/Revenant/Efterhand/g' -e 's/revenant/efterhand/g' -e 's/REVENANT/EFTERHAND/g'; }; diff <(git show e3087997:"$OLD" | rmap) "$NEW"`
- **Residual_Search.** `git grep -Iil revenant -- . ':!.kiro/specs'` and `git ls-files | grep -i revenant | grep -v '^.kiro/specs/'`. A role task's PR lists no hit inside its role's paths, except the Kept_Repo_Pointers and references Requirement 10 leaves to a later step (Requirement 1.10). Paste the output in a commit message body.
- **Copy.** Every changed user-facing string follows `tone.md` and `neutrality.md`. Each copy task states in a commit message body the result of `node tools/hooks/tone-check.mjs <file>` for every copy file it changed.
- **Property tests.** fast-check (already a dev dependency), `numRuns` of at least 100, one `it` block per property, and the tag `// Feature: 20-efterhand-rename, Property N: <title>` with the title from `design.md`.
- **Evidence.** A commit message body states the final commit SHA, the exit status of `bash scripts/check.sh` and PASS or FAIL, the two test counts, and every earlier-spec test changed or retired with its reason ("none" if empty).
- **Reports.** Anything a requirement asks for "in the PR description" goes in a commit message body on the task's branch, kept short (bodies are cut at 12,000 characters).
- **Chart install.** The new chart from `deploy/helm/efterhand` with its default image `ghcr.io/devclef/efterhand` is not installed until task 9 points the image push path at `ghcr.io/devclef/efterhand` and a build has pushed an image there (Requirement 10.8).
- If `design.md` and the code on `main` disagree, re-read the code, keep the design's behaviour, and say what you changed and why in a commit message body under "Decisions". If the disagreement would need compatibility code or a change outside your Scope, stop instead and say so.

## Tasks

- [ ] 1. Step 1 · Steering docs renamed
  - Agent: `owner` · Depends on: none · Estimated size: n/a (owner commit, no role PR)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: the eight files in `.kiro/steering/` (`crypto.md`, `data-integrity.md`, `deploy.md`, `neutrality.md`, `product.md`, `structure.md`, `tech.md`, `tone.md`). Nothing else.
  - Design sections: Components 1 ("Steering docs").
  - Steps:
    1. Apply the Rename_Map to every file in `.kiro/steering/` and nothing else.
    2. Run the oracle diff for each of the eight files against `e3087997`; each prints nothing.
    3. Confirm `crypto.md` names `efterhand-kek-passkey-v1`, `efterhand-kek-backup-v1`, `efterhand-opening-v1`, `Efterhand demo` and `Efterhand letter · opens 5 Nov 2030`.
    4. Confirm `deploy.md` still holds "Migrations only add. Never drop or rewrite sealed tables or their immutability triggers." and the PVC rule ending "Never template the PVC in a way that a rename recreates it empty.", apart from the Rename_Map.
    5. Commit to `main` with only `.kiro/steering/` in the diff. No task 3 to 6 issue is dispatched and no role branch is created before this commit is on `main`.
  - Acceptance:
    - [x] 1.1 Steering docs carry the new names
      - `git grep -Iil revenant -- .kiro/steering` returns no files; the oracle diff prints nothing for all eight files; no rule is added, removed or reworded; no file names this spec or its exception.
      - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
    - [ ] 1.2 Steering commit is on `main` before any role task starts
      - If `git grep -Iil revenant -- .kiro/steering` on `main` returns a file, this issue stays open until a follow-up commit limited to `.kiro/steering/` clears it.
      - _Requirements: 3.7, 3.8_
  - Earlier-spec tests changed or retired: none.
  - Validation: `bash scripts/check.sh` on the owner commit, with SHA and exit status recorded in this issue.

- [x] 2. Step 1 · `check.sh` chart lint accepts either chart folder
  - Agent: `owner` · Depends on: 1 · Estimated size: n/a (owner commit, no role PR)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `scripts/check.sh` (owner-only). Nothing else.
  - Design sections: Components 1 ("`check.sh` chart-lint block, Step 1 version"), Testing Strategy ("`check.sh` matrix").
  - Steps:
    1. Replace the chart-lint block (lines 72 to 80 at `e3087997`) with the design's Step 1 version: collect each of `deploy/helm/revenant` and `deploy/helm/efterhand` whose `Chart.yaml` exists; with none, print both paths and exit 1 whether or not `helm` is on the path; with `helm`, print `step "helm lint and template: <folder>"` and run `helm lint`, `helm template ci` and the "no Secret" check on each, naming the folder on failure.
    2. Add one sentence to the script header naming the missing-chart failure as the exception to "runs only when its files exist".
    3. Run the Step 1 column of the design's `check.sh` matrix in temporary worktrees (only `revenant`, only `efterhand`, neither, `helm` removed from `PATH`) and record each exit status in this issue. Remove the worktrees afterwards.
  - Acceptance:
    - [x] 2.1 Step 1 chart-lint block
      - On `e3087997` with the change it lints `deploy/helm/revenant` and exits 0; with only `deploy/helm/efterhand` it lints that and exits 0; with neither it exits non-zero and prints both paths; a failing lint, template or rendered `kind: Secret` exits non-zero and names the folder.
      - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
    - [x] 2.2 Without `helm` only the missing-chart check runs
      - _Requirements: 4.6_
  - Earlier-spec tests changed or retired: none.
  - Validation: `bash scripts/check.sh` on the owner commit, with SHA and exit status recorded in this issue.

- [ ] 3. Step 2 · Frontend rename
  - Agent: `frontend-dev` · Depends on: 1, 2 · Estimated size: M, ~600 changed lines (plus regenerated golden and fixture files)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: every Old_Name file under the frontend-dev paths (`src/app/**/*.tsx`, `src/app/**/*.css`, `src/app/fonts/**`, `src/components/**`, `src/lib/cards/**`, `src/lib/ics/**`, `src/lib/recall/**`, `src/lib/personas/**`, `content/personas/**`, `public/**`), including `src/app/layout.tsx` and `src/app/globals.css`, `src/components/reveal/figures-stub.property.test.ts` (new), `src/lib/cards/qr/__fixtures__/vectors.json`, the golden files under `src/components/live/__golden__/seal-page-demo/` that hold the Old_Name, and the test files in the shared paths that assert a value this task changes (for example `src/test/landing.test.tsx`, `src/test/footer-layout.test.tsx`, `src/test/layout-metadata.test.ts`, `src/test/retired-phrases.test.ts`, `src/test/user-content.ts`). A test that asserts only platform values (`SITE_NAME`, chart paths) is left to task 6. No file outside these.
  - Design sections: Components 2, Data Models ("Old → new strings", "Fixtures"), Property 1, Testing Strategy.
  - Steps:
    1. Set the values in Requirement 5.3 exactly: `Wordmark.tsx` "Efterhand", `SCENE_COPY.wordmark` "efterhand", layout title default "Efterhand" and template "%s · Efterhand", `REAL_COPY.passkeyUserName` "Efterhand letter · opens {date}", `.ics` `PRODID` `-//Efterhand//Live demo//EN`, keepsake file names `efterhand` and `efterhand-letter-<id>.ics`. Rename "Revenant demo" and "Revenant cannot recover it" in `press/copy.ts` and the name in `cards/letter-card-svg.ts`.
    2. Rename the `revenant` key in `BRAND_COPY`'s comparison rows to `efterhand` and every reader of it (search `\.revenant\b` and `"revenant"` under `src/components/`) in the same commit.
    3. Update the CSS comments at `scene.module.css` (153 and 617 at `e3087997`) and `landing.module.css` (306) to quote the Tagline_Line as rendered ("letter doesn't."). In `opengraph-image.test.tsx` the negative check becomes "does not contain `Efterhand${NBSP}doesn't.`".
    4. Rename `REVENANT_LAYOUT_URL` and `REVENANT_CHROMIUM` in `RecallPager.fit.test.ts` to `EFTERHAND_LAYOUT_URL` and `EFTERHAND_CHROMIUM`.
    5. Change `figures-stub.ts` to a value import of `figuresResponseV1Schema` from `@/lib/figures/now` and `format: figuresResponseV1Schema.shape.format.value`, with no Format_String literal left in the file. Do not change `src/lib/figures/now.ts` (task 5 does).
    6. Regenerate the QR_Vectors entry whose text holds the Old_Name with `qrencode -8 -l M -m 0 -t ASCII "https://efterhand.devclef.se/l/k7q2m9x4p1"` (`qrencode` 4.1.1), mapping `##` to `1` and two spaces to `0` per row, and record the `version` and `size` it outputs (3 and 29 expected). Leave every other entry byte-identical. Name the command, the tool version and the text in the commit body.
    7. After the copy change, regenerate the seal-page goldens with `RECORD_GOLDEN=1 npx vitest run src/components/live/SealPage.demo-golden.test.tsx`, then run the oracle diff for every changed file under `__golden__/seal-page-demo/` and paste the result in the commit body. The `seal-draft` goldens stay unchanged.
    8. Check the page titles, `opengraph-image.tsx`, `apple-icon.tsx` and `public/icon.svg` for Old_Name text and state, for each, the change made or "no Old_Name text".
    9. On a local build, run `npm run layout-check -- --url http://localhost:3000 --only-sizes 360x640,390x844,1440x900,1920x1080,2560x1440`, then take the three measurements in the design's fit table (Tagline_Line one line box; Tagline_Line clear of the Landing_Ghost and the Ghost_Body_Box; Wordmark one line, no two Top_Bar slots intersecting, scroll width within the viewport at 360×640 and 390×844) with a throwaway `playwright-core` snippet run from the shell, not committed. Paste the numbers in a commit message body. If a check fails, change only the CSS values Requirements 5.9 and 5.10 allow, to the nearest passing value, and name old and new values.
    10. Run `toneProblems` over every changed user-facing copy string and list the strings and "no problems".
  - Acceptance:
    - [ ] 3.1 Copy, titles, Wordmark, keepsakes, brand key and comments renamed
      - The Residual_Search limited to the frontend-dev paths lists no file and no path; each value in Requirement 5.3 is set exactly; each comparison row renders the `e3087997` text with only the Rename_Map applied; the PR states the result for the four places in Requirement 5.11; no file outside the frontend-dev and shared test paths changes, and every Visual_Language_Name count is unchanged.
      - _Requirements: 1.1, 1.10, 2.3, 5.1, 5.2, 5.3, 5.4, 5.8, 5.11, 5.12, 5.14_
    - [ ] 3.2 Figures_Stub takes its format from the Figures_Schema
      - `figures-stub.ts` holds no Format_String literal; the six test files that use it still pass.
      - _Requirements: 5.5_
    - [ ] 3.3 Write property test for the figures stub
      - **Property 1: The figures stub always produces a body the schema accepts**
      - In `src/components/reveal/figures-stub.property.test.ts`, generating `LoadedFigures` from figures and metrics that pass `figureV1Schema` and `metricDefinitionV1Schema`. It passes now with the old literal and keeps passing after task 5 with no edit.
      - **Validates: Requirements 5.5, 7.2**
    - [ ] 3.4 QR_Vectors entry regenerated with `qrencode` 4.1.1
      - `encode.test.ts` passes against the regenerated vector; every other entry is byte-identical to `e3087997`.
      - _Requirements: 2.5, 2.7, 5.6_
    - [ ] 3.5 Seal-page goldens regenerated with `RECORD_GOLDEN=1`
      - The oracle diff prints nothing for each regenerated file; both golden tests pass twice without `RECORD_GOLDEN`.
      - _Requirements: 2.5, 2.7, 5.7_
    - [ ] 3.6 Fit checks for the Tagline_Line and the Wordmark
      - _Requirements: 5.9, 5.10_
    - [ ] 3.7 Tone check, test counts and `check.sh`
      - _Requirements: 2.1, 2.2, 2.4, 5.13, 5.15, 10.5_
  - Earlier-spec tests changed or retired: tests whose expected value holds the Old_Name change only by the Rename_Map (for example `opengraph-image.test.tsx`, `RecallPager.fit.test.ts`, the brand, Wordmark, `.ics` and keepsake tests); name each.
  - Copy evidence: tone-check for every copy file changed (`live/copy.ts`, `press/copy.ts`, `scene/copy.ts`, `brand/copy.ts` and any other).
  - Validation: `bash scripts/check.sh` with tasks 1 and 2 merged.

- [ ] 4. Step 2 · Crypto rename and the Golden_V2 reseal
  - Agent: `crypto-dev` · Depends on: 1, 2 · Estimated size: S, ~300 changed lines (plus the resealed fixture)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: every Old_Name file under the crypto-dev paths (`src/lib/crypto/**`, `src/lib/seal-format/**`, `src/app/api/letters/**`, `src/app/api/openings/**`, `src/lib/db/schema/letters*`, `scripts/seal-personas*`, `src/lib/letter-store/**`, `src/test/integration/**`), which at `e3087997` are `src/lib/crypto/kdf.ts`, `passkey.ts`, their tests, `src/lib/seal-format/v1/header.test.ts`, `v1/is-rp-id.test.ts`, `src/lib/letter-store/config.test.ts`, `src/test/integration/live-letters.test.ts` and `sealed-letters.test.ts`; plus `src/lib/crypto/golden-v2.test.ts`, `src/lib/seal-format/__fixtures__/golden-v2-envelope.json` and `src/lib/seal-format/__fixtures__/golden-v2-envelope.pre-rename.json` (new). Test files elsewhere change only where they assert a value this task changes. `REAL_COPY.passkeyUserName` belongs to task 3. `drizzle/**` belongs to task 6.
  - Design sections: Components 3, Data Models ("Fixtures"), Testing Strategy ("Example tests").
  - Steps:
    1. In `kdf.ts`, set `INFO_KEK_BACKUP = "efterhand-kek-backup-v1"`, `INFO_OPENING = "efterhand-opening-v1"`, `INFO_KEK_PASSKEY = "efterhand-kek-passkey-v1"`, and the same strings in every comment that writes a label out.
    2. In `passkey.ts`, set `PASSKEY_RP_NAME = "Efterhand"` and `PASSKEY_USER_NAME = PASSKEY_USER_DISPLAY_NAME = "Efterhand demo"`.
    3. In `kdf.test.ts`, write `efterhand-kek-backup-v1`, `efterhand-kek-passkey-v1` and `efterhand-kat-plaintext` as literals and keep deriving each reference key with `node:crypto` `hkdfSync` from them.
    4. Apply the Rename_Map to the remaining crypto-dev files, including `Revenant.devclef.se` → `Efterhand.devclef.se` in the rejected list of `is-rp-id.test.ts`, the `rpId` examples in `header.test.ts`, and every Old_Name in `src/test/integration/**` (the `revenant_forbid_change` comments and the `https://revenant.test/...` URLs). Add no prefix assertion there; task 6 does.
    5. Copy the `e3087997` Golden_V2 byte for byte to `golden-v2-envelope.pre-rename.json` (`git show e3087997:src/lib/seal-format/__fixtures__/golden-v2-envelope.json > …`).
    6. Add the design's record mode to `golden-v2.test.ts`: the procedure comment, `GOLDEN_HEADER`, `goldenRandom()` (byte `n` is `(11n + 5) mod 256`) and one `it` that, with `RECORD_GOLDEN=1`, stubs `globalThis.crypto.getRandomValues` (restored in `finally`), calls `sealLetter` with the written-out payload (Rename_Map applied), `PUBLIC_DEMO_BACKUP_KEY` and `goldenServerSecret()` (byte `i` is `(7i + 3) mod 256`), and writes `{ envelope, envelopeHash }` as two-space JSON with a trailing newline. Without it the file is only read. State in the commit body that the procedure was added.
    7. Reseal with `RECORD_GOLDEN=1 npx vitest run src/lib/crypto/golden-v2.test.ts`, run it a second time and confirm `git diff --exit-code` on the fixture.
    8. Add a case that opens `golden-v2-envelope.pre-rename.json` with the demo key and the fixed secret and expects `ok: false`, `error.kind === "wrong_key"` and no `payload`.
  - Acceptance:
    - [ ] 4.1 Key-derivation labels, passkey names and the known-answer tests
      - _Requirements: 6.1, 6.2, 6.4_
    - [ ] 4.2 Rename across the crypto-dev paths
      - The Residual_Search limited to the crypto-dev paths lists no file; files outside them change only in an asserted value.
      - _Requirements: 1.1, 1.10, 2.3, 6.3, 6.10_
    - [ ] 4.3 Golden_V2 record mode and reseal
      - The five existing cases pass against the resealed fixture: the opened payload equals the written-out payload field for field, and the stored `envelopeHash` equals the recomputed hash. A second record run leaves the fixture unchanged.
      - _Requirements: 2.5, 2.6, 2.7, 2.8, 6.5, 6.6_
    - [ ] 4.4 The pre-rename Golden_V2 no longer opens
      - _Requirements: 6.7_
    - [ ] 4.5 Golden_V1 and the demo key unchanged, test counts and `check.sh`
      - Golden_V1 and `PUBLIC_DEMO_BACKUP_KEY` are byte-identical to `e3087997`; the commit body states that no test decrypts Golden_V1. `seal-open-v2.property.test.ts` and `seal-open-passkey.property.test.ts` pass unchanged.
      - _Requirements: 2.1, 2.2, 2.4, 2.9, 6.8, 6.9, 6.11, 10.5_
  - Earlier-spec tests changed or retired: `kdf.test.ts`, `passkey.test.ts`, `golden-v2.test.ts` (new cases added, none removed), `is-rp-id.test.ts`, `header.test.ts`, `config.test.ts` and the two integration files change only by the Rename_Map; name each.
  - Validation: `bash scripts/check.sh` with tasks 1 and 2 merged.

- [ ] 5. Step 3 · Data rename: Format_String and fetch lock
  - Agent: `data-dev` · Depends on: 1, 2, 3 · Estimated size: S, ~150 changed lines
  - Follow 'Rules for every task' in tasks.md.
  - Scope: every Old_Name file under the data-dev paths (`src/lib/sources/**`, `src/lib/figures/**`, `src/lib/events/**`, `src/app/api/figures/**`, `scripts/fetch-figures*`, `scripts/prefetch*`): at `e3087997` `src/lib/figures/now.ts`, `at-opening.ts`, `src/lib/sources/fetch-gate.ts`, `src/app/api/figures/build-response.ts` and their tests (`now.test.ts`, `at-opening.test.ts`, `last-success-at.test.ts`, `demo/no-fixture.test.ts`, `fetch-gate.test.ts`, `fetch-figures-freshness.test.ts`, `prefetch-figures-main.test.ts`, `src/app/api/figures/*.test.ts`); `src/lib/figures/now.format.property.test.ts` (new); and any test elsewhere whose assertions name the Format_String or `FETCH_LOCK_NAME`. Not `figures-stub.ts`, `src/lib/db/schema/figures.ts` or `drizzle/`.
  - Design sections: Components 4, the figures-format sequence diagram, Property 2.
  - Chart install: the new chart is not installed in this step. It waits until task 9 has pushed an image to `ghcr.io/devclef/efterhand`.
  - Steps:
    1. Start only after task 3 is merged, on a branch based on a `main` commit that contains that merge.
    2. In `now.ts`, set `format: z.literal("efterhand-figures-v1")` and its doc comment. In `build-response.ts`, rename the literal.
    3. In `fetch-gate.ts`, set `FETCH_LOCK_NAME = "efterhand-fetch-figures"` and the comment to `hashtext('efterhand-fetch-figures')`.
    4. The rejection test in `now.test.ts` uses a string with no Old_Name (for example `"other-figures-v1"`) and does not write the old Format_String.
    5. Apply the Rename_Map to the remaining data-dev files. For each demo figure or fixture file changed, run the oracle diff and state in the commit body that only Old_Name text changed.
  - Acceptance:
    - [ ] 5.1 Format_String and fetch lock renamed
      - `fetch-gate.test.ts` asserts `FETCH_LOCK_NAME === "efterhand-fetch-figures"`.
      - _Requirements: 7.1, 7.3_
    - [ ] 5.2 Rename across the data-dev paths
      - The Residual_Search limited to the data-dev paths lists no file; no file outside `.kiro/specs/` holds `revenant-figures-v1` or `revenant-fetch-figures`; `src/lib/db/schema/figures.ts`, `drizzle/**` and every figure value and provenance field are unchanged.
      - _Requirements: 1.1, 1.10, 2.3, 7.4, 7.5, 7.7, 7.8, 7.9_
    - [ ] 5.3 Write property test for the figures schema format
      - **Property 2: The figures schema accepts only its own format**
      - In `src/lib/figures/now.format.property.test.ts`, with `fc.oneof` of arbitrary strings, case variants of the literal and the literal with characters added or removed, each filtered with `!/revenant/i.test(s) && s !== literal`.
      - **Validates: Requirements 7.1**
    - [ ] 5.4 Figures_Stub unchanged and still valid, test counts and `check.sh`
      - The diff has no change to `figures-stub.ts`; Property 1 from task 3 passes with no edit and the stub now emits `efterhand-figures-v1`.
      - _Requirements: 2.1, 2.2, 2.4, 7.2, 7.6, 7.10, 10.5_
  - Earlier-spec tests changed or retired: the data tests listed in Scope change only by the Rename_Map, except the `now.test.ts` rejection string (step 4); name each.
  - Validation: `bash scripts/check.sh` with tasks 1, 2 and 3 merged.

- [ ] 6. Step 3 · Platform rename: chart, trigger function, package, `tools/qa`, Gate_Baseline
  - Agent: `platform-dev` · Depends on: 1, 2, 3 · Estimated size: M, ~800 changed lines (mostly the chart move and the baseline)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `deploy/helm/revenant/**` moved to `deploy/helm/efterhand/**`; `drizzle/0000_sealed_letters.sql`, `drizzle/0002_figures.sql`; the Old_Name files in `src/lib/db/**` (`schema/figures.ts`, `client.test.ts`), `src/lib/page-metadata.ts` and its test, `src/lib/security-headers.ts`, `src/lib/layout-gate.test.ts`, `src/lib/layout-baseline-cache.test.ts`, `src/lib/persona-release-frozen.test.ts`, `src/middleware.test.ts`, `src/app/api/health/ready/route.test.ts`, `src/test/**` outside `integration/` (including `fetch-figures-chart.test.ts` and `seed-job.test.ts`); the added prefix assertions in `src/test/integration/figures.test.ts`, `letter-drafts.test.ts` and `sealed-letters.test.ts`; `tools/qa/**` including `tools/qa/layout-gate-baseline.json`; `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `Dockerfile`, `.dockerignore`, `package.json`, `package-lock.json` (the two `name` lines only). Not `src/app/layout.tsx`, `src/app/globals.css` or `.env.example`.
  - Design sections: Components 5, Data Models, "Where the requirements meet each other" items 1 to 3.
  - Chart install: the new chart from `deploy/helm/efterhand` with the default image `ghcr.io/devclef/efterhand` is not installed until task 9 points the image push path at `ghcr.io/devclef/efterhand` and a build has pushed an image there. Before then no image exists at that path. Say so in a commit message body.
  - Steps:
    1. Start only after task 3 is merged. If task 4 is not merged when you open the PR, rebase after it lands (the integration files may conflict on nearby lines).
    2. `git mv deploy/helm/revenant deploy/helm/efterhand` in a commit with no content change.
    3. In a second commit, apply the Rename_Map to every file under `deploy/helm/efterhand/` (chart `name`, the eight helper names and every `include` or `template` call, ingress host, default image repository, `NOTES.txt`, README) and bump `Chart.yaml` `version` by one minor version. Run the oracle diff on each moved file and list the files with an allowed extra change (`Chart.yaml` `version`).
    4. Run `helm lint deploy/helm/efterhand` and `helm template ci deploy/helm/efterhand`; both exit 0, and the rendered output has no Old_Name (`| grep -i revenant` prints nothing) and no `kind: Secret`.
    5. Edit `drizzle/0000_sealed_letters.sql` (lines 44 to 54) and `drizzle/0002_figures.sql` (lines 36 to 39) in place: `revenant_forbid_change` → `efterhand_forbid_change` in the definition and every trigger, message `'efterhand: % on % is not allowed; sealed records are immutable'`. Add no file to `drizzle/` and change nothing in `drizzle/meta/`.
    6. Beside each existing rejection assertion in the three integration files, add one `rejects.toThrow(/^efterhand: /)` on the same statement. Keep every existing line as it is and rename nothing else there.
    7. Apply the Rename_Map to the other Scope files, including `SITE_NAME = "Efterhand"` and the chart path `deploy/helm/efterhand` in the four chart-reading tests. In `package.json` and `package-lock.json` change only the `name` lines.
    8. In `tools/qa/**`, rename `REVENANT_LAYOUT_BASELINE_DIR` → `EFTERHAND_LAYOUT_BASELINE_DIR`, the cache default to `~/kiro/efterhand-crew/layout-baseline/`, the temp prefixes to `efterhand-layout-` and `efterhand-layout-gate`, and `BLOCKERS_FORMAT = "efterhand-layout-blockers/1"`. No read of the old variable and no fallback path.
    9. On a checkout of `main` that includes task 3 and this task's `tools/qa/**` change, with a local Postgres migrated and the personas sealed (`node scripts/migrate.mjs`, then `node scripts/seal-personas.mjs`, `DATABASE_URL` set per command and never committed or logged) and Chromium available, run `LAYOUT_GATE_SAVE=tools/qa/layout-gate-baseline.json npm run layout-gate`. Compare with `git show <base>:tools/qa/layout-gate-baseline.json | rmap`, ignoring `createdAt`, and list each added, removed or changed row with its rename-related cause. Name the `main` commit in the commit body.
  - Acceptance:
    - [ ] 6.1 Chart folder moved with `git mv`
      - No file remains under `deploy/helm/revenant/`; `git log --follow` on each moved file reaches a commit before the move.
      - _Requirements: 1.7, 8.1_
    - [ ] 6.2 Chart renamed, version bumped, lint and template pass
      - `git grep -Ii revenant -- deploy/helm/efterhand` returns nothing; `Chart.yaml` changes only `name`, Rename_Map text and a higher `version`.
      - _Requirements: 8.2, 8.3, 8.4_
    - [ ] 6.3 Trigger function renamed in place
      - On an empty Postgres, the migrations create `efterhand_forbid_change`, no function whose name holds the Old_Name, and the same trigger names, timing and events on `letters`, `demo_letters`, `openings`, `figures` and `figure_fetch_runs` as at `e3087997`, each calling `efterhand_forbid_change`.
      - _Requirements: 8.5, 8.6_
    - [ ] 6.4 Integration tests assert the `efterhand:` prefix
      - For each of the five tables and each operation covered at `e3087997`, the statement is rejected with a message starting `efterhand:` and the row is unchanged. Existing assertion lines are unchanged.
      - _Requirements: 1.8, 8.7_
    - [ ] 6.5 Rename across the platform paths and the package name
      - The Residual_Search (excluding `src/test/integration/**`) lists no file or path in `deploy/helm/`, `drizzle/`, `package.json`, `package-lock.json` or any path in Requirement 8.8; the `package-lock.json` diff is the two `name` lines; `.env.example` is unchanged.
      - _Requirements: 1.1, 1.10, 2.3, 8.8, 8.9, 8.10, 8.15_
    - [ ] 6.6 `tools/qa` variable, cache path, temp prefix and format renamed
      - _Requirements: 8.11_
    - [ ] 6.7 Gate_Baseline regenerated on `main` after task 3
      - The new file has `"format": "efterhand-layout-blockers/1"` and the same rows as the base, apart from the listed rename-caused rows. If task 3 is not merged, this PR is not opened.
      - _Requirements: 2.5, 2.6, 2.7, 8.12, 8.13_
    - [ ] 6.8 Test counts, chart-install note and `check.sh`
      - _Requirements: 2.1, 2.2, 2.4, 8.14, 10.5, 10.8_
  - Earlier-spec tests changed or retired: `fetch-figures-chart.test.ts`, `seed-job.test.ts`, `persona-release-frozen.test.ts`, `layout-baseline-cache.test.ts`, the page-metadata, middleware, health and db client tests change only by the Rename_Map; the three integration files only gain assertions; name each.
  - Validation: `bash scripts/check.sh` with tasks 1, 2 and 3 merged.

- [ ] 7. Step 4 · Owner rename: dispatcher, agents, hooks, CI, docs and the final chart lint
  - Agent: `owner` · Depends on: 3, 4, 5, 6 · Estimated size: n/a (owner commits, no role PR)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: `tools/dispatcher/**`, `tools/agents/generate_agents.py`, `.kiro/agents/*.json` (regenerated only), `.kiro/agents/prompts/**`, `.kiro/hooks/**`, `tools/hooks/**`, `docs/agent-loop.md`, `docs/kiro-writeup.md`, `docs/design/**` text files, `.github/ISSUE_TEMPLATE/**`, `.github/pull_request_template.md`, `.github/workflows/ci.yml`, `.github/workflows/journey-check.yml`, `scripts/check.sh`, and every other Scope file that `.github/agents.json` assigns to no role and the Residual_Search lists. The Kept_Repo_Pointers stay unchanged.
  - Design sections: Components 6, Data Models ("Old → new strings"), Testing Strategy ("`check.sh` matrix").
  - Chart install: the new chart is not installed in this step. It waits until task 9 has pushed an image to `ghcr.io/devclef/efterhand`.
  - Steps:
    1. Start only after tasks 3 to 6 are merged and their issues closed. Stop the running dispatcher before the move and restart it only after step 8.
    2. `git mv tools/dispatcher/revenant_dispatch.py tools/dispatcher/efterhand_dispatch.py` in a commit with no content change.
    3. Apply the Rename_Map to `tools/dispatcher/**` except the three Kept_Repo_Pointers lines (`REPO` in `efterhand_dispatch.py`; `REPO_URL` and the `os.environ.get("REPO", "devclef/Revenant")` default in `spec_sync.py`). This covers the imports (`from efterhand_dispatch import GitHub`), `EFTERHAND_GITHUB_TOKEN`, `EFTERHAND_CREW_HOME`, `EFTERHAND_MAX_DEV_RUNS`, the default home `~/kiro/efterhand-crew`, the markers `efterhand-dispatch` and `efterhand-agent-notes`, the user agent and git identity `efterhand-dispatcher`, and notification texts.
    4. Add dispatcher unit tests under `tools/dispatcher/tests/`: with only `REVENANT_CREW_HOME`, `REVENANT_GITHUB_TOKEN` or `REVENANT_MAX_DEV_RUNS` set, the dispatcher behaves as if the matching `EFTERHAND_*` variable were unset (the crew home is `~/kiro/efterhand-crew`).
    5. Apply the Rename_Map to `tools/agents/generate_agents.py`, then run `python3 tools/agents/generate_agents.py` to rewrite `.kiro/agents/*.json`, with no hand edits.
    6. Apply the Rename_Map to `.kiro/agents/prompts/**`, `.kiro/hooks/**`, `tools/hooks/**` (log path `~/kiro/efterhand-crew/hooks.log`, temp folder `efterhand-hooks`), the docs, the GitHub templates, and the other unowned files the Residual_Search lists. In `ci.yml` set `efterhand_test` and `efterhand:ci`; in `journey-check.yml` set `--url https://efterhand.devclef.se`. `build.yml` keeps `ghcr.io/devclef/revenant`.
    7. Replace the `check.sh` chart-lint block with the design's Step 4 version: `chart=deploy/helm/efterhand`; exit 1 and print the path when its `Chart.yaml` is missing; exit 1 and name any other directory under `deploy/helm/` in the working tree, tracked or not; with `helm`, lint, template and run the "no Secret" check on `$chart` only. The file holds no Old_Name. Run the Step 4 column of the design's `check.sh` matrix in temporary worktrees and record each exit status in this issue.
    8. Set `EFTERHAND_GITHUB_TOKEN`, `EFTERHAND_CREW_HOME` and `EFTERHAND_MAX_DEV_RUNS` in the owner's environment and move `~/kiro/revenant-crew` to `~/kiro/efterhand-crew` (or ask the user to, as User_Checklist items), then restart the dispatcher.
  - Acceptance:
    - [ ] 7.1 Dispatcher moved and renamed, Kept_Repo_Pointers unchanged
      - `git log --follow tools/dispatcher/efterhand_dispatch.py` reaches a commit before the move; the Kept_Repo_Pointers lines are identical to `e3087997`.
      - _Requirements: 1.7, 9.1, 9.2, 9.3, 9.4, 9.8_
    - [ ] 7.2 Old dispatcher variables are ignored
      - _Requirements: 1.6, 9.12_
    - [ ] 7.3 Agents regenerated; prompts, hooks, docs and CI renamed
      - _Requirements: 9.5, 9.6, 9.7_
    - [ ] 7.4 `check.sh` reads only `deploy/helm/efterhand`
      - The matrix rows for only `efterhand`, neither, `efterhand` plus another folder, and `helm` removed from `PATH` give the results in the design.
      - _Requirements: 4.6, 4.7, 4.8, 4.9, 9.9_
    - [ ] 7.5 Residual_Search, generator check, dispatcher tests and `check.sh`
      - The Residual_Search lists only `tools/dispatcher/efterhand_dispatch.py`, `tools/dispatcher/spec_sync.py` and `.github/workflows/build.yml`, each hit a Kept_Repo_Pointer, and the path search returns nothing. `python3 tools/agents/generate_agents.py --check`, `python3 -m unittest discover -s tools/dispatcher/tests -q` and `bash scripts/check.sh` exit 0. Every route under `src/app/` shows "Efterhand" and no Old_Name in its title, Wordmark, Top_Bar and visible text. The User_Checklist gains the three `EFTERHAND_*` variables and the crew home move.
      - _Requirements: 9.10, 9.11, 9.13, 10.7_
  - Earlier-spec tests changed or retired: dispatcher tests under `tools/dispatcher/tests/` change only by the Rename_Map (imports and variable names) and gain the cases in step 4; name each.
  - Validation: `bash scripts/check.sh` on the owner commit, with SHA and exit status recorded in this issue.

- [ ] 8. Step 5 · The owner renames the GitHub repository to `devclef/Efterhand`
  - Agent: `owner` · Depends on: 7 · Estimated size: n/a (user action on GitHub, no commit)
  - Scope: none in this repository. The user renames `devclef/Revenant` to `devclef/Efterhand` in the GitHub repository settings and then tells Kiro it is done.
  - Chart install: the new chart is not installed in this step. It waits until task 9 has pushed an image to `ghcr.io/devclef/efterhand`; before then no image exists at that path.
  - Notes: GitHub redirects the old repository URL, so the Kept_Repo_Pointers keep working until task 9 changes them. The user's report that the rename is done is task 9's start condition. The user closes this issue.
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 9. Step 6 · Final switch, spec-sync run and the User_Checklist
  - Agent: `owner` · Depends on: 8 · Estimated size: n/a (one owner commit, no role PR)
  - Follow 'Rules for every task' in tasks.md.
  - Scope: the four Kept_Repo_Pointers lines in `tools/dispatcher/efterhand_dispatch.py`, `tools/dispatcher/spec_sync.py` and `.github/workflows/build.yml`, and the local `origin` remote. Nothing else.
  - Design sections: Components 7.
  - Steps:
    1. Run `gh repo view devclef/Efterhand --json name`. If it fails, stop before changing any file, report that the Step 5 rename is not visible, and leave the Kept_Repo_Pointers as they are.
    2. In one commit, change exactly: `REPO = "devclef/Efterhand"`, `REPO_URL = "https://github.com/devclef/Efterhand/blob/main"`, the `spec_sync.py` default repo `devclef/Efterhand`, and `images: ghcr.io/devclef/efterhand`. `git diff --stat` shows three files and four changed lines.
    3. Set the fetch and push URLs of `origin` to `devclef/Efterhand` with the same protocol as before and record `git remote -v`, which holds no Old_Name.
    4. Push to `main`. Run spec-sync once against `devclef/Efterhand` (`REPO=devclef/Efterhand`, token from `EFTERHAND_GITHUB_TOKEN`) and record its exit code and the number of created issues. If it exits non-zero or creates an issue, report the code and the issue numbers, leave this task open, and close or delete no issue without the owner.
    5. Wait for the `build.yml` run on that commit and record its URL and the image tag pushed to `ghcr.io/devclef/efterhand`. Wait for `ci-gate` on the same commit.
    6. On the head of `main`, run both Residual_Search commands (both print nothing) and `bash scripts/check.sh` (exit 0).
    7. End the report with the User_Checklist.
  - Acceptance:
    - [ ] 9.1 The renamed repository is visible before any change
      - _Requirements: 11.2_
    - [ ] 9.2 One commit changes exactly the Kept_Repo_Pointers
      - _Requirements: 11.1_
    - [ ] 9.3 `origin` points at `devclef/Efterhand`
      - _Requirements: 11.3_
    - [ ] 9.4 Spec-sync run against `devclef/Efterhand`
      - Exit code 0, every task of this spec maps to the existing issue with its `<!-- spec-task: 20-efterhand-rename/<n> -->` marker, and zero created issues.
      - _Requirements: 11.4, 11.5_
    - [ ] 9.5 Build pushes to `ghcr.io/devclef/efterhand` and `ci-gate` passes
      - _Requirements: 10.8, 11.6, 11.8_
    - [ ] 9.6 Residual_Search prints nothing and `check.sh` passes on `main`
      - _Requirements: 1.11, 11.7, 11.8_
    - [ ] 9.7 User_Checklist
      - One action per line: set `EFTERHAND_GITHUB_TOKEN`, `EFTERHAND_CREW_HOME` and `EFTERHAND_MAX_DEV_RUNS`; rename the GitHub secrets and Crew grants that use the Old_Name (for example `REVENANT_GITHUB_TOKEN` and the grant `github_revenant_repo`); move `~/kiro/revenant-crew` to `~/kiro/efterhand-crew`; set up DNS and TLS for `efterhand.devclef.se` and set `RP_ID` to `efterhand.devclef.se` and `APP_ORIGIN` to `https://efterhand.devclef.se` in the GitOps values; remove the old Helm release and its retained PVC, then install the chart from `deploy/helm/efterhand` with the image `ghcr.io/devclef/efterhand`; delete the old "Revenant demo" and "Revenant letter" passkeys; remove `~/.kiro/agents/revenant-prompts/` if it exists.
      - _Requirements: 9.13, 11.9_
  - Earlier-spec tests changed or retired: none.
  - Validation: `bash scripts/check.sh` on the head of `main`, with SHA and exit status recorded in this issue.

## Notes

- Property test sub-tasks are not marked optional, following specs 15 to 19. Property 1 is the evidence that task 5 needs no stub change, and Property 2 is the evidence that the schema rejects every other format.
- Tasks 1 and 2 are owner commits on `main`. Kiro does them right after this file is merged and ticks them; no role task starts before both are done.
- Tasks 3 and 4 touch disjoint files, so they run in parallel. Tasks 5 and 6 also touch disjoint files, except that task 6 adds assertions to integration files task 4 renamed; task 6 rebases after task 4 if needed. Neither task in a pair names the other as a dependency.
- Between task 3's and task 6's merges, page titles may show "Efterhand" in the layout and "Revenant" through `SITE_NAME`. That is expected (Requirement 10.7).
- From task 7 on, `journey-check.yml` checks `https://efterhand.devclef.se`, which answers only after the user's DNS, TLS and install steps in the User_Checklist. A scheduled journey check may fail until then.
- From task 7 on, the dispatcher reads only the `EFTERHAND_*` variables. It does not run again until the owner sets them.
- Every role PR is reviewed by the dispatcher's automatic QA run, so no task asks for a review.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["3.1", "4.1"] },
    { "id": 5, "tasks": ["3.2", "4.2"] },
    { "id": 6, "tasks": ["3.3", "3.4", "4.3"] },
    { "id": 7, "tasks": ["3.5", "4.4"] },
    { "id": 8, "tasks": ["3.6", "4.5"] },
    { "id": 9, "tasks": ["3.7"] },
    { "id": 10, "tasks": ["5.1", "6.1"] },
    { "id": 11, "tasks": ["5.2", "6.2"] },
    { "id": 12, "tasks": ["5.3", "6.3"] },
    { "id": 13, "tasks": ["5.4", "6.4"] },
    { "id": 14, "tasks": ["6.5"] },
    { "id": 15, "tasks": ["6.6"] },
    { "id": 16, "tasks": ["6.7"] },
    { "id": 17, "tasks": ["6.8"] },
    { "id": 18, "tasks": ["7.1"] },
    { "id": 19, "tasks": ["7.2", "7.3"] },
    { "id": 20, "tasks": ["7.4"] },
    { "id": 21, "tasks": ["7.5"] },
    { "id": 22, "tasks": ["8"] },
    { "id": 23, "tasks": ["9.1"] },
    { "id": 24, "tasks": ["9.2"] },
    { "id": 25, "tasks": ["9.3"] },
    { "id": 26, "tasks": ["9.4"] },
    { "id": 27, "tasks": ["9.5"] },
    { "id": 28, "tasks": ["9.6"] },
    { "id": 29, "tasks": ["9.7"] }
  ]
}
```
