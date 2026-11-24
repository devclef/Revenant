# Requirements Document

Spec: 20 Efterhand rename

## Introduction

The app is renamed from Revenant to Efterhand. The rename is a case-preserving replacement: `Revenant` becomes `Efterhand`, `revenant` becomes `efterhand`, and `REVENANT` becomes `EFTERHAND`. It covers visible copy, the domain (`efterhand.devclef.se`), the GitHub repository (`devclef/Efterhand`), the container image (`ghcr.io/devclef/efterhand`), the Helm chart, environment variables, and internal strings such as key-derivation labels, passkey names, the database trigger function, the figures format string and the fetch lock name.

The owner redeploys from scratch with an empty database. Nothing sealed, stored, cached or installed under the old name has to keep working. The change adds no fallback, alias, migration path or compatibility code for the old name.

The work is split by role, as `.github/agents.json` assigns paths, and runs in six steps (Requirement 10). Each dev task's PR passes `scripts/check.sh` on its own once the tasks it depends on are merged.

Out of scope: everything under `.kiro/specs/` (history), images and other binary files (the owner handles them; this spec does not check or list them), and the visual language: ghost imagery, the icon artwork, and names such as `Ghost_Body_Box` and `CovenStrip`.

## Exception to the steering docs (scoped to this spec)

`deploy.md` says that migrations only add, that sealed tables and their immutability triggers are never rewritten, and that the Postgres PVC must never be templated so that a rename recreates it empty. This spec overrides those three rules once, for this rename only, because the owner redeploys with an empty database:

- The existing migration files `drizzle/0000_sealed_letters.sql` and `drizzle/0002_figures.sql` are edited in place to rename the trigger function. No new migration is added.
- Renaming the chart from `revenant` to `efterhand` changes resource names, including the Postgres StatefulSet and its PVC. The new release starts with a new, empty volume.

The exception ends when this spec's last task closes. After that, the `deploy.md` rules apply unchanged to every later change, and the steering docs keep stating them as before (with the new names).

## Code facts this spec relies on

Read from the checkout at `e3087997` on the day this spec was written, with `git grep -Ii revenant` over tracked files outside `.kiro/specs/`. The first task that touches an area re-reads it and reports any difference in a commit message body.

| Topic | What exists |
|---|---|
| Spread | 222 tracked text files outside `.kiro/specs/` contain "revenant" in some case. 15 tracked paths contain it in their name: the 14 files under `deploy/helm/revenant/` and `tools/dispatcher/revenant_dispatch.py`. |
| Key-derivation labels | `src/lib/crypto/kdf.ts`: `INFO_KEK_BACKUP = "revenant-kek-backup-v1"`, `INFO_OPENING = "revenant-opening-v1"`, `INFO_KEK_PASSKEY = "revenant-kek-passkey-v1"`, also written out in comments. `kdf.test.ts` repeats `revenant-kek-backup-v1` and `revenant-kek-passkey-v1` and uses the plaintext `revenant-kat-plaintext`. The known-answer test derives its reference key with `node:crypto` `hkdfSync` from the label, so it holds no fixed hex output. |
| Passkey names | `src/lib/crypto/passkey.ts`: `PASSKEY_RP_NAME = "Revenant"`, `PASSKEY_USER_NAME` and `PASSKEY_USER_DISPLAY_NAME` both `"Revenant demo"`. The real-letter user name is `REAL_COPY.passkeyUserName = "Revenant letter · opens {date}"` in `src/components/live/copy.ts` (frontend-dev). |
| Sealed fixtures | `src/lib/seal-format/__fixtures__/golden-v2-envelope.json` is a real envelope sealed with the public demo backup key and a fixed server secret (`src/lib/crypto/golden-v2.test.ts`), so its wrapped key depends on `INFO_KEK_BACKUP`. `golden-v1-envelope.json` holds placeholder bytes (`REREREREREREREREREREREREREREREREREREREREREQ` and similar) and is read for hashing and parsing tests. Neither file contains the text "revenant". |
| Trigger function | `drizzle/0000_sealed_letters.sql` defines `revenant_forbid_change()`, whose exception message starts `revenant:`, and attaches it to `letters`, `demo_letters` and `openings`. `drizzle/0002_figures.sql` attaches the same function to `figures` and `figure_fetch_runs`. `drizzle/meta/` contains no "revenant". `src/lib/db/schema/figures.ts` names the function in a comment. |
| Figures format | `src/lib/figures/now.ts` (data-dev): `format: z.literal("revenant-figures-v1")`. `src/components/reveal/figures-stub.ts` (frontend-dev) writes `format: "revenant-figures-v1"` as a literal. The string appears 21 times in total, including `src/app/api/figures/build-response.ts` and tests. |
| Fetch lock | `src/lib/sources/fetch-gate.ts`: `FETCH_LOCK_NAME = "revenant-fetch-figures"`, used as `hashtext('revenant-fetch-figures')`. |
| Helm chart | `deploy/helm/revenant/`: `Chart.yaml`, `values.yaml`, `README.md`, `.helmignore` and ten templates. `_helpers.tpl` defines `revenant.name`, `revenant.fullname`, `revenant.chart`, `revenant.labels`, `revenant.selectorLabels`, `revenant.image`, `revenant.postgres.labels` and `revenant.postgres.selectorLabels`. Tests read the chart by path: `src/test/fetch-figures-chart.test.ts`, `src/test/seed-job.test.ts`, `src/lib/persona-release-frozen.test.ts`, `src/lib/layout-baseline-cache.test.ts`. |
| `scripts/check.sh` | Lines 72 to 75 lint and template the chart only when `deploy/helm/revenant/Chart.yaml` exists and `helm` is on the path. After a folder move the step would skip with no error. |
| Environment variables | `REVENANT_GITHUB_TOKEN`, `REVENANT_CREW_HOME`, `REVENANT_MAX_DEV_RUNS` (dispatcher); `REVENANT_LAYOUT_BASELINE_DIR` (`tools/qa/layout-baseline.mjs` and `src/lib/layout-baseline-cache.test.ts`); `REVENANT_LAYOUT_URL`, `REVENANT_CHROMIUM` (`src/components/ceremony/recall/RecallPager.fit.test.ts`). `.env.example` names none of them and contains no "revenant". |
| Headline line | The visible Tagline is `BRAND_COPY.tagline` "Memory drifts with time. A sealed letter doesn't.", and the nowrap span holds "letter doesn't." (`SceneHeadline.tsx`, `opengraph-image.tsx`). The comments at `scene.module.css` lines 153 and 617 and `landing.module.css` line 306 still say "Revenant doesn't.". `opengraph-image.test.tsx` asserts the source does not contain `Revenant${NBSP}doesn't.`. |
| Wordmark and titles | `src/components/ui/Wordmark.tsx` renders `Revenant`. `src/components/ceremony/scene/copy.ts` has `wordmark: "revenant"`, set in capitals by CSS in the Top_Bar, so "REVENANT" (8 letters) becomes "EFTERHAND" (9 letters). `src/app/layout.tsx` sets the title default `Revenant` and template `%s · Revenant`. `src/lib/page-metadata.ts` (platform-dev) sets `SITE_NAME = "Revenant"`. `brand/copy.ts` uses `revenant` as an object key in its comparison rows. |
| Keepsakes | `src/lib/ics/build-ics.ts`: `PRODID = "-//Revenant//Live demo//EN"`. `src/components/live/keepsake-files.ts` names files `revenant` and `revenant-letter-<id>.ics`. `src/lib/cards/letter-card-svg.ts` holds the name. |
| QR vectors | `src/lib/cards/qr/__fixtures__/vectors.json` records its generator: `qrencode` 4.1.1, command `qrencode -8 -l M -m 0 -t ASCII`. At least one vector text is `https://revenant.devclef.se/l/k7q2m9x4p1`. |
| Layout baseline | `tools/qa/layout-gate-baseline.json` has `"format": "revenant-layout-blockers/1"` (`BLOCKERS_FORMAT` in `tools/qa/layout-scope.mjs`). `tools/qa/layout-gate.mjs` line 33: refresh it with `LAYOUT_GATE_SAVE=<file> npm run layout-gate` on main. The gate needs Chromium and a database with the personas sealed. |
| Dispatcher | `tools/dispatcher/revenant_dispatch.py`: `REPO = "devclef/Revenant"`, the env vars above, `~/kiro/revenant-crew` paths, `MARKER = "revenant-dispatch"`, the notes markers `revenant-agent-notes`, user agent and git identity `revenant-dispatcher`. `bootstrap.py` and `spec_sync.py` import `from revenant_dispatch import GitHub`. `spec_sync.py` has `REPO_URL = "https://github.com/devclef/Revenant/blob/main"` and the default repo `devclef/Revenant`. Spec issues are matched by `<!-- spec-task: <spec>/<n> -->`, which holds no app name. |
| Agent configs and hooks | `.kiro/agents/*.json` are generated by `tools/agents/generate_agents.py` and checked by `check.sh` (`--check`). The generator holds the role descriptions ("Revenant UI engineer: …"), the `$HOME/kiro/revenant-crew/…-shots` paths and the `revenant-prompts` install folder. `tools/hooks/scope-check.py` and `tools/hooks/tone-check.mjs` log to `~/kiro/revenant-crew/hooks.log` and use a `revenant-hooks` temp folder. `.kiro/hooks/copy-tone-check.json` names the app. |
| CI | `.github/workflows/ci.yml`: database `revenant_test`, image tag `revenant:ci`. `build.yml`: `images: ghcr.io/devclef/revenant`. `journey-check.yml`: `--url https://revenant.devclef.se`. |
| Package | `package.json` `"name": "revenant"`; `package-lock.json` repeats it twice. |

## Glossary

- **Rename_Map**: the three case-preserving replacements `Revenant` → `Efterhand`, `revenant` → `efterhand`, `REVENANT` → `EFTERHAND`, applied wherever the old name appears, including inside longer identifiers (`revenant_forbid_change` → `efterhand_forbid_change`, `revenant.fullname` → `efterhand.fullname`, `REVENANT_GITHUB_TOKEN` → `EFTERHAND_GITHUB_TOKEN`).
- **Old_Name**: the text "revenant" in any letter case.
- **Scope**: every file tracked by git in this repository, except files under `.kiro/specs/` and binary files (a file `git grep -I` treats as binary).
- **Residual_Search**: the command `git grep -Iil revenant -- . ':!.kiro/specs'` together with `git ls-files | grep -i revenant | grep -v '^.kiro/specs/'`, run on a commit.
- **Kept_Repo_Pointers**: the three places that keep naming the old repository until Step 6: the dispatcher's `REPO` setting, `REPO_URL` and the default repo in `tools/dispatcher/spec_sync.py`, and the image push path `ghcr.io/devclef/revenant` in `.github/workflows/build.yml`.
- **Visual_Language_Names**: names of the ghost imagery and its parts that hold no Old_Name, such as `Ghost_Body_Box`, `Ghost`, `CovenStrip`, `Landing_Ghost` and the icon artwork. They stay unchanged.
- **Role_Task**: one task assigned to `frontend-dev`, `crypto-dev`, `data-dev` or `platform-dev`, delivered as one PR.
- **Owner_Task**: a task done directly by Kiro as owner, marked `Agent: owner` in `tasks.md` so the dispatcher skips it.
- **Chart_Lint_Step**: the block of `scripts/check.sh` that runs `helm lint`, `helm template` and the "no Secret" check.
- **Steering_Docs**: the files in `.kiro/steering/`.
- **Golden_V2**: `src/lib/seal-format/__fixtures__/golden-v2-envelope.json`.
- **Golden_V1**: `src/lib/seal-format/__fixtures__/golden-v1-envelope.json`.
- **QR_Vectors**: `src/lib/cards/qr/__fixtures__/vectors.json`.
- **Gate_Baseline**: `tools/qa/layout-gate-baseline.json`.
- **Format_String**: the figures response format, `revenant-figures-v1` before and `efterhand-figures-v1` after.
- **Figures_Schema**: the Zod schema for the GET `/api/figures` body in `src/lib/figures/now.ts`.
- **Figures_Stub**: `src/components/reveal/figures-stub.ts`.
- **Tagline_Line**: the nowrap phrase at the end of the Tagline headline on the landing hero and in the Scene ("letter doesn't." at `e3087997`), named "Revenant doesn't." in the CSS comments.
- **Wordmark**: the product name in the Top_Bar (`SCENE_COPY.wordmark`, shown in capitals) and in `Wordmark.tsx`.
- **Check_Script**: `scripts/check.sh`.
- **Tone_Check**: `toneProblems` from `@/components/copy-tone`, as run by the copy tone tests.
- **User_Checklist**: the list of actions only the owner can take, delivered with the last task (Requirement 11).

## Requirements

### Requirement 1: The rename rule

**User Story:** As the owner, I want one mechanical rule for the rename, so that every agent renames the same way and nothing is left half-done.

#### Acceptance Criteria

1. THE rename SHALL apply the Rename_Map to every occurrence of the Old_Name in Scope. This covers file contents, file names and folder names, and occurrences inside longer identifiers, paths, URLs, comments and test strings.
2. IF the Old_Name occurs in a case form outside the Rename_Map (for example `ReVenant`), THEN the task SHALL replace it with `Efterhand` when the first letter is upper case and the rest are not all upper case. In every other case it SHALL use `efterhand`. The task SHALL also name the file and line number of each such occurrence in the commit body.
3. THE rename SHALL leave every file under `.kiro/specs/` other than those under `.kiro/specs/20-efterhand-rename/` untouched, so that `git diff e3087997 -- .kiro/specs ':!.kiro/specs/20-efterhand-rename'` on every task's merge commit prints nothing. Adding this spec's folder and ticking its tasks is allowed.
4. THE rename SHALL leave every binary file (a file `git grep -I` treats as binary) byte-for-byte unchanged, and SHALL neither list nor check binary files for the Old_Name.
5. THE rename SHALL leave the Visual_Language_Names, the ghost imagery and the icon artwork unchanged, so that a search for each Visual_Language_Name finds the same number of matches before and after the task.
6. THE rename SHALL add no code path that accepts, reads, writes or maps any of the following: the Old_Name, an old key-derivation label, the old Format_String, the old fetch lock name, the old trigger function name, the old chart path (from Step 4 on) or an old environment variable name. "Code path" includes aliases, fallbacks, redirects, dual reads, migrations and compatibility branches.
7. WHEN a file or folder whose name contains the Old_Name is renamed, THE task SHALL move it with `git mv` in a commit that changes the moved file's contents by at most the Rename_Map substitutions. As a result, `git log --follow` on the new path lists at least one commit made before the move.
8. THE rename SHALL change names only: copy strings, labels, paths and identifiers. On each task's PR, the Check_Script SHALL exit with status 0, and no test that exists at `e3087997` SHALL be deleted or skipped. Test assertions SHALL differ from `e3087997` only by Rename_Map substitutions, except for fixture bytes that a renamed label or URL regenerates (Golden_V2, QR_Vectors, Gate_Baseline).
9. WHERE a link names `github.com/devclef/Revenant` outside the Kept_Repo_Pointers, THE task that renames the link's file SHALL change the link to `github.com/devclef/Efterhand`. The link is allowed to answer 404 until Step 5.
10. WHEN a Role_Task's PR is ready for merge, THE Residual_Search on its head commit SHALL list no file within the paths that `.github/agents.json` assigns to that role. The only allowed matches are the Kept_Repo_Pointers and the references that Requirement 10 leaves to a later step, such as the chart path before Step 4.
11. WHEN the last task of Step 6 is merged, THE Residual_Search on the merge commit SHALL print nothing.

### Requirement 2: Tests keep their meaning

**User Story:** As the reviewer, I want the tests to keep checking the same things after the rename, so that the rename cannot hide a regression.

#### Acceptance Criteria

1. THE Role_Task SHALL delete no test file and no test case. A test file moved with `git mv` to a path the Rename_Map gives, with git reporting it as a rename, counts as kept.
2. THE Role_Task SHALL add no `.skip`, `.only`, `.todo`, `xit`, `xdescribe` or `it.fails` marker to any test, and SHALL add no new condition that makes an existing test return before its assertions run.
3. WHEN a test asserts a value that contains the Old_Name, THE Role_Task that changes that value SHALL change the assertion's expected value to the Rename_Map result in the same PR and keep the assertion's kind. An equality check stays an equality check on the full value. A negative check (for example the `opengraph-image.test.tsx` check that the source does not contain `Revenant${NBSP}doesn't.`) stays a negative check on the renamed text. A match against a pattern stays a match against the renamed pattern.
4. WHEN `npm test` runs on the head commit of a Role_Task, THE number of test cases it reports SHALL be at least the number reported on that Role_Task's base commit (the merge base with `main`), and the number of failed test cases SHALL be zero.
5. WHEN a fixed test value depends on a renamed string, THE Role_Task SHALL recompute it with the procedure recorded for that value. This covers Golden_V2 (the public demo backup key and the fixed server secret in `src/lib/crypto/golden-v2.test.ts`), QR_Vectors (`qrencode` 4.1.1, `qrencode -8 -l M -m 0 -t ASCII`) and Gate_Baseline (`LAYOUT_GATE_SAVE=<file> npm run layout-gate` on `main`). Running that procedure with the inputs named in the commit body on the head commit SHALL reproduce the committed value byte for byte.
6. THE Role_Task SHALL NOT produce a fixed test value by copying the output of the code under test or of a failing test run.
7. THE commit body that holds each recomputed fixed test value SHALL name the file, the procedure used and every input given to it. For Gate_Baseline it SHALL also name the `main` commit it was refreshed on.
8. IF a fixed test value that depends on a renamed string has no recorded procedure, THEN THE Role_Task SHALL write the procedure into that value's test file or into a comment beside the value, in the same commit as the recomputed value or an earlier one, and SHALL say in the commit body that the procedure was added.
9. THE Role_Task SHALL leave byte-identical every fixed test value whose inputs contain no Old_Name, including Golden_V1 and the `kdf.test.ts` known-answer reference, which is derived at run time from the label and has no stored hex output.

### Requirement 3: Steering docs first (Owner_Task, Step 1)

**User Story:** As a role agent, I want the steering docs to use the new names before I start, so that the rules I load match the code I write.

#### Acceptance Criteria

1. WHEN the Step 1 Owner_Task changes the Steering_Docs, THE Owner_Task SHALL apply the Rename_Map to every occurrence of Old_Name in all eight files in `.kiro/steering/` (`crypto.md`, `data-integrity.md`, `deploy.md`, `neutrality.md`, `product.md`, `structure.md`, `tech.md`, `tone.md`). This covers the product name in prose and headings, the domain `efterhand.devclef.se`, the `RP_ID` value `efterhand.devclef.se`, the `APP_ORIGIN` value `https://efterhand.devclef.se`, the image `ghcr.io/devclef/efterhand`, the chart path `deploy/helm/efterhand/` and the ingress host.
2. WHEN the Step 1 Owner_Task's steering commit is made, `git grep -Iil revenant -- .kiro/steering` on that commit SHALL return no files.
3. THE Step 1 Owner_Task's steering commit SHALL change only files in `.kiro/steering/`. Every changed line SHALL differ from its version at `e3087997` only by the Rename_Map, and no rule SHALL be added, removed or reworded.
4. WHEN the Step 1 Owner_Task updates `crypto.md`, THE updated `crypto.md` SHALL name the key-derivation labels `efterhand-kek-passkey-v1`, `efterhand-kek-backup-v1` and `efterhand-opening-v1`, the demo passkey name `Efterhand demo`, and the real-letter passkey example `Efterhand letter · opens 5 Nov 2030`.
5. WHEN the Step 1 Owner_Task updates `deploy.md`, THE updated `deploy.md` SHALL still contain, word for word apart from the Rename_Map, the rule "Migrations only add. Never drop or rewrite sealed tables or their immutability triggers." and the PVC rule ending "Never template the PVC in a way that a rename recreates it empty."
6. THE Steering_Docs SHALL NOT describe the one-time exception in this spec or refer to this spec's folder `20-efterhand-rename`. The exception SHALL be stated only in this spec.
7. THE Step 1 Owner_Task's steering commit SHALL be merged to `main` before any Role_Task's issue is dispatched or any Role_Task's branch is created.
8. IF `git grep -Iil revenant -- .kiro/steering` on `main` returns one or more files, THEN no Role_Task SHALL be dispatched, and the Step 1 Owner_Task SHALL stay open until a follow-up commit limited to `.kiro/steering/` clears every hit.

### Requirement 4: Chart lint survives the folder move (Owner_Task, Steps 1 and 4)

**User Story:** As the owner, I want the chart lint to keep running while the chart folder moves, so that a broken chart can't pass CI because the lint quietly stopped.

#### Acceptance Criteria

1. WHILE `helm` is on the path, THE Check_Script with the Step 1 Owner_Task change SHALL run `helm lint`, `helm template` and the "no Secret" check once on each of `deploy/helm/revenant` and `deploy/helm/efterhand` whose `Chart.yaml` exists, and SHALL print the folder name before checking each one.
2. IF neither `deploy/helm/revenant/Chart.yaml` nor `deploy/helm/efterhand/Chart.yaml` exists, THEN THE Check_Script with the Step 1 change SHALL exit with a non-zero code and print both paths it looked for, whether or not `helm` is on the path.
3. WHEN the Check_Script with the Step 1 change runs on `e3087997`, THE Check_Script SHALL lint and template `deploy/helm/revenant` and exit with code 0.
4. WHEN the Check_Script with the Step 1 change runs on a commit where `deploy/helm/efterhand/Chart.yaml` exists and `deploy/helm/revenant` does not, THE Check_Script SHALL lint and template `deploy/helm/efterhand` and exit with code 0.
5. IF `helm lint` or `helm template` fails on a chart folder, or the rendered output of a chart folder contains a line starting `kind: Secret`, THEN THE Check_Script SHALL exit with a non-zero code and name that chart folder.
6. IF `helm` is not on the path, THEN THE Check_Script with the Step 1 change and with the Step 4 change SHALL skip `helm lint`, `helm template` and the "no Secret" check as it does at `e3087997`, and SHALL still apply the missing-chart checks in criteria 2 and 8.
7. THE Check_Script with the Step 4 Owner_Task change SHALL run the Chart_Lint_Step on `deploy/helm/efterhand` only, and SHALL contain no path that holds the Old_Name.
8. IF `deploy/helm/efterhand/Chart.yaml` does not exist after the Step 4 change, THEN THE Check_Script SHALL exit with a non-zero code and print the path it looked for, whether or not `helm` is on the path.
9. IF `deploy/helm/` contains any directory other than `deploy/helm/efterhand` in the working tree after the Step 4 change, whether or not that directory holds tracked files, THEN THE Check_Script SHALL exit with a non-zero code and name that directory.

### Requirement 5: Frontend rename (Role_Task frontend-dev, Step 2)

**User Story:** As a visitor, I want every page, card and calendar file to say Efterhand, so that the product has one name.

#### Acceptance Criteria

1. THE frontend-dev task SHALL apply the Rename_Map to every Old_Name occurrence in Scope files under the frontend-dev paths in `.github/agents.json` (`src/app/**/*.tsx`, `src/app/**/*.css`, `src/app/fonts/**`, `src/components/**`, `src/lib/cards/**`, `src/lib/ics/**`, `src/lib/recall/**`, `src/lib/personas/**`, `content/personas/**`, `public/**`), including `src/app/layout.tsx` and `src/app/globals.css`. It SHALL also apply the Rename_Map to every test file in the shared test paths (`src/**/*.test.ts`, `src/**/*.test.tsx`, `src/test/integration/**`) that asserts a value it changed.
2. WHEN the frontend-dev task's PR head commit is checked, THE Residual_Search limited to the frontend-dev paths SHALL list no file and no path.
3. THE frontend-dev task SHALL set these values exactly: the Wordmark text to "Efterhand" in `Wordmark.tsx` and to "efterhand" in `SCENE_COPY.wordmark`; the layout title default to "Efterhand" and the title template to "%s · Efterhand"; `REAL_COPY.passkeyUserName` to "Efterhand letter · opens {date}"; the `.ics` `PRODID` to `-//Efterhand//Live demo//EN`; and the keepsake file names to `efterhand` and `efterhand-letter-<id>.ics`.
4. THE frontend-dev task SHALL rename the `revenant` key in `BRAND_COPY`'s comparison rows to `efterhand`, and SHALL update every reader of that key so that each comparison row renders the same text as at `e3087997`, with only the Rename_Map applied.
5. THE frontend-dev task SHALL change the Figures_Stub so that it takes its `format` value from the Figures_Schema's literal and holds no Format_String as a literal. WHEN the Figures_Stub's output is parsed with the Figures_Schema, THE parse SHALL succeed.
6. THE frontend-dev task SHALL regenerate every QR_Vectors entry whose text contains the Old_Name, using the Rename_Map text and the generator recorded in the file (`qrencode` 4.1.1, `qrencode -8 -l M -m 0 -t ASCII`). It SHALL record the `version` and `size` that the generator outputs for each regenerated entry, and SHALL leave every entry without the Old_Name byte-for-byte unchanged.
7. THE frontend-dev task SHALL regenerate every golden markup file under `src/components/live/__golden__/` that contains the Old_Name, using the procedure recorded in its test. The commit body SHALL show, for each regenerated file, that every changed line in its diff against `e3087997` differs from the old line only by Rename_Map replacements.
8. THE frontend-dev task SHALL update the comments at `scene.module.css` (lines 153 and 617 at `e3087997`) and `landing.module.css` (line 306 at `e3087997`) so that they quote the Tagline_Line text exactly as the page renders it.
9. WHEN the frontend-dev task is done, THE Tagline_Line SHALL render as one line box at 360×640, 390×844, 1440×900, 1920×1080 and 2560×1440, and its bounding box SHALL NOT intersect the Landing_Ghost or the Ghost_Body_Box at any of those sizes. IF the Tagline_Line wraps or intersects at any of those sizes, THEN THE task SHALL change only the font size or the width cap of the affected CSS rule, in steps of 1 px, to the value closest to the old one that passes at all five sizes, and SHALL name the old and new values in the commit body.
10. WHEN the frontend-dev task is done, THE Wordmark "EFTERHAND" in the Top_Bar SHALL render as one line box beside the Demo chip and every other Top_Bar slot at 360×640 and 390×844, with no two slot bounding boxes intersecting and the document's scroll width no greater than the viewport width. IF it does not fit, THEN THE task SHALL change only the Wordmark's letter spacing (in steps of 0.01 em) or font size (in steps of 1 px), to the value closest to the old one that passes at both sizes, and SHALL name the old and new values in the commit body.
11. THE frontend-dev task SHALL check for the Old_Name in four places: the page titles, the Open Graph image text (`opengraph-image.tsx`), the Apple icon text (`apple-icon.tsx`) and the text in `public/icon.svg`. It SHALL apply the Rename_Map to any Old_Name text found, and the PR description SHALL state, for each of the four, either the change made or that it holds no Old_Name text.
12. THE frontend-dev task SHALL rename the environment variables `REVENANT_LAYOUT_URL` and `REVENANT_CHROMIUM` in `RecallPager.fit.test.ts` to `EFTERHAND_LAYOUT_URL` and `EFTERHAND_CHROMIUM`.
13. WHEN the Tone_Check (`toneProblems`) runs over every user-facing copy string the frontend-dev task changes, THE Tone_Check SHALL return no problems for any of them.
14. THE frontend-dev task SHALL leave unchanged every file outside the frontend-dev paths and the shared test paths, and every Visual_Language_Name.
15. WHEN the Step 1 tasks that this task depends on (Requirement 10) are merged, THE Check_Script SHALL exit with status 0 on the frontend-dev task's PR head commit.

### Requirement 6: Crypto rename (Role_Task crypto-dev, Step 2)

**User Story:** As the owner, I want key labels and passkey names to carry the new name, so that nothing a user sees in a passkey manager, and nothing a letter is sealed with, uses the old name.

#### Acceptance Criteria

1. THE crypto-dev task SHALL set the key-derivation constants in `src/lib/crypto/kdf.ts` to exactly `INFO_KEK_BACKUP = "efterhand-kek-backup-v1"`, `INFO_OPENING = "efterhand-opening-v1"` and `INFO_KEK_PASSKEY = "efterhand-kek-passkey-v1"`, and SHALL write the same three strings in every comment in that file that writes a label out.
2. THE crypto-dev task SHALL set, in `src/lib/crypto/passkey.ts`, `PASSKEY_RP_NAME` to exactly "Efterhand", and `PASSKEY_USER_NAME` and `PASSKEY_USER_DISPLAY_NAME` each to exactly "Efterhand demo".
3. THE crypto-dev task SHALL apply the Rename_Map to every file under the crypto-dev paths in `.github/agents.json` (`src/lib/crypto/**`, `src/lib/seal-format/**`, `src/app/api/letters/**`, `src/app/api/openings/**`, `src/lib/db/schema/letters*`, `scripts/seal-personas*`, `src/lib/letter-store/**`, `src/test/integration/**`), including the `rpId` examples in the seal-format header tests, so that the Residual_Search run on the task's merge commit and limited to those paths lists no file.
4. THE known-answer tests in `kdf.test.ts` SHALL write the new labels from criterion 1 and the plaintext `efterhand-kat-plaintext` as string literals in the test file, not imported from `kdf.ts`, and SHALL derive each reference key with `node:crypto` `hkdfSync` from those literals.
5. THE crypto-dev task SHALL reseal Golden_V2 with the new labels from criterion 1, the public demo backup key, the fixed server secret whose byte `i` is `(7i + 3) mod 256` for `i` from 0 to 31, and the payload written out in `golden-v2.test.ts` with the Rename_Map applied, and SHALL set its `envelopeHash` to the SHA-256 of the RFC 8785 canonical JSON of the resealed envelope.
6. WHEN `golden-v2.test.ts` opens the resealed Golden_V2 with the public demo backup key and the fixed server secret, THE opened payload SHALL equal the written-out payload in the test field for field, and the stored `envelopeHash` SHALL equal the hash the test recomputes.
7. IF the Golden_V2 from `e3087997` is opened with the new labels, the public demo backup key and the fixed server secret, THEN THE open SHALL fail with an error and return no payload. A test SHALL assert this failure, with the old fixture kept as an inline value in that test or as a second fixture file whose name says it is the pre-rename envelope.
8. IF any test opens Golden_V1 by decrypting it, THEN THE crypto-dev task SHALL reseal Golden_V1 by the same procedure as criterion 5. IF no test decrypts Golden_V1, THEN THE crypto-dev task SHALL leave Golden_V1 byte-for-byte unchanged and SHALL state in the commit body that no test decrypts it.
9. THE crypto-dev task SHALL leave `PUBLIC_DEMO_BACKUP_KEY` in `src/lib/crypto/demo-key.ts` byte-for-byte unchanged.
10. THE crypto-dev task SHALL change no file outside the crypto-dev paths in criterion 3, except test files elsewhere that assert a value changed by criteria 1 to 3. In those files it SHALL change only the asserted value. `REAL_COPY.passkeyUserName` in `src/components/live/copy.ts` belongs to frontend-dev and is out of this task's scope.
11. WHEN the crypto-dev task's PR is checked with the tasks it depends on merged, THE Check_Script SHALL exit with status 0.

### Requirement 7: Data rename (Role_Task data-dev, Step 3, after the frontend-dev task)

**User Story:** As the owner, I want the figures format and the fetch lock to carry the new name in one place each, so that the browser and the server agree on the format.

#### Acceptance Criteria

1. THE data-dev task SHALL set the literal value of the Format_String in the Figures_Schema to `efterhand-figures-v1`, so that the Figures_Schema accepts a GET `/api/figures` body whose `format` is `efterhand-figures-v1` and rejects a body whose `format` is any other string. A test of that rejection SHALL use a test string that holds no Old_Name, and SHALL NOT write the old Format_String literally.
2. WHEN the data-dev task's PR is merged on top of the merged frontend-dev task, THE Figures_Stub SHALL produce bodies whose `format` equals `efterhand-figures-v1` and that parse with the Figures_Schema, and the data-dev task's diff SHALL contain no change to the Figures_Stub.
3. THE data-dev task SHALL set `FETCH_LOCK_NAME` in `src/lib/sources/fetch-gate.ts` to `efterhand-fetch-figures`, and every comment in that file that quotes the `hashtext` argument SHALL read `hashtext('efterhand-fetch-figures')`.
4. THE data-dev task SHALL apply the Rename_Map to every file under the data-dev paths in `.github/agents.json` (`src/lib/sources/**`, `src/lib/figures/**`, `src/lib/events/**`, `src/app/api/figures/**`, `scripts/fetch-figures*`, `scripts/prefetch*`), including `src/app/api/figures/build-response.ts`, and to every test file outside those paths whose assertions name the Format_String or `FETCH_LOCK_NAME` value.
5. WHEN the data-dev task is done, THE Residual_Search limited to the data-dev paths SHALL list no file, and no file in the repository outside `.kiro/specs/` SHALL contain the text `revenant-figures-v1` or `revenant-fetch-figures`.
6. THE data-dev task SHALL start only after the frontend-dev task's PR is merged, and its PR branch SHALL be based on a main commit that contains that merge.
7. THE data-dev task SHALL leave `src/lib/db/schema/figures.ts` and every file under `drizzle/` byte-for-byte unchanged, for the platform-dev task to rename.
8. THE data-dev task SHALL leave every figure value, unit, region, period, source, series ID, `source_url` and `retrieved_at` in the demo figures and fixtures unchanged, and the commit body SHALL state that the task's diff of each such file changes only Old_Name text.
9. THE data-dev task SHALL leave unchanged every file outside the data-dev paths and outside the test files named in criterion 4.
10. WHEN the data-dev task's PR is checked on its own head commit with the frontend-dev task merged, THE Check_Script SHALL exit with code 0.

### Requirement 8: Platform rename (Role_Task platform-dev, Step 3, after the frontend-dev task)

**User Story:** As the owner, I want the chart, database, package and QA tools renamed, so that a fresh install creates nothing under the old name.

#### Acceptance Criteria

1. THE platform-dev task SHALL move every file in `deploy/helm/revenant/` to the same relative path under `deploy/helm/efterhand/` with `git mv`, so that `git log --follow` traces each moved file to its old path, and SHALL leave no file under `deploy/helm/revenant/`.
2. THE platform-dev task SHALL apply the Rename_Map to every file under `deploy/helm/efterhand/`: the chart `name`, the eight helper template names (`efterhand.name`, `efterhand.fullname`, `efterhand.chart`, `efterhand.labels`, `efterhand.selectorLabels`, `efterhand.image`, `efterhand.postgres.labels`, `efterhand.postgres.selectorLabels`) and every `include` or `template` call to them, the ingress host `efterhand.devclef.se`, the default image repository `ghcr.io/devclef/efterhand`, `NOTES.txt` and the chart README, so that `git grep -Ii revenant -- deploy/helm/efterhand` returns no match.
3. THE platform-dev task SHALL set the chart `version` in `Chart.yaml` to a semantic version greater than the `version` at the task's base commit, and SHALL change no other field in `Chart.yaml` except `name` and text changed by the Rename_Map.
4. WHEN `helm lint deploy/helm/efterhand` and `helm template ci deploy/helm/efterhand` run on the platform-dev head commit with default values, THE commands SHALL each exit with code 0, and the rendered output SHALL contain no Old_Name in any letter case and no `kind: Secret`.
5. THE platform-dev task SHALL edit `drizzle/0000_sealed_letters.sql` and `drizzle/0002_figures.sql` in place, renaming the function to `efterhand_forbid_change()` in its definition and in every trigger that calls it, and changing its exception message prefix to `efterhand:`. THE task SHALL add no file to `drizzle/` and SHALL change no file in `drizzle/meta/` (the exception in this spec).
6. WHEN the migrations run against an empty Postgres database on the platform-dev head commit, THE resulting database SHALL contain a function named `efterhand_forbid_change`, SHALL contain no function whose name holds the Old_Name, and SHALL have, on `letters`, `demo_letters`, `openings`, `figures` and `figure_fetch_runs`, the same trigger names, timing and events as the migrations at `e3087997` produce, each trigger calling `efterhand_forbid_change`.
7. IF application code updates, deletes or truncates a row in `letters`, `demo_letters`, `openings`, `figures` or `figure_fetch_runs` after migration, THEN THE database SHALL reject the statement with an exception whose message starts with `efterhand:` and SHALL leave the row unchanged. THE integration tests SHALL assert this for each of the five tables and for each operation they cover at `e3087997`.
8. THE platform-dev task SHALL apply the Rename_Map to `src/lib/db/**` (including the comment in `src/lib/db/schema/figures.ts`), `src/lib/*.ts` (including `SITE_NAME = "Efterhand"` in `page-metadata.ts`, and `security-headers.ts`), `src/middleware.test.ts`, `src/test/**`, `tools/qa/**`, `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `Dockerfile` and `.dockerignore`, and to the tests that assert those values. This includes changing the chart path to `deploy/helm/efterhand` in `src/test/fetch-figures-chart.test.ts`, `src/test/seed-job.test.ts`, `src/lib/persona-release-frozen.test.ts` and `src/lib/layout-baseline-cache.test.ts`.
9. WHEN the Residual_Search runs on the platform-dev head commit, THE search SHALL return no file or path in `deploy/helm/`, `drizzle/`, `package.json`, `package-lock.json` or any path listed in criterion 8. Binary files are excluded under the Scope definition.
10. THE platform-dev task SHALL set `"name": "efterhand"` in `package.json` and in the two `name` entries of `package-lock.json` that repeat it, and the diff of `package-lock.json` SHALL contain no change other than those two lines.
11. THE platform-dev task SHALL rename `REVENANT_LAYOUT_BASELINE_DIR` to `EFTERHAND_LAYOUT_BASELINE_DIR`, the cache default to `~/kiro/efterhand-crew/layout-baseline/`, the temp folder prefix `revenant-layout-` to `efterhand-layout-`, and `BLOCKERS_FORMAT` to `efterhand-layout-blockers/1`. The changed code SHALL NOT read `REVENANT_LAYOUT_BASELINE_DIR` or fall back to any path or format that holds the Old_Name.
12. WHEN the frontend-dev task's PR has been merged to main, THE platform-dev task SHALL regenerate the Gate_Baseline with `LAYOUT_GATE_SAVE=tools/qa/layout-gate-baseline.json npm run layout-gate`, run on a checkout of main that includes the frontend-dev change and this task's `tools/qa/**` change. IF the frontend-dev PR is not yet merged, THEN THE platform-dev task SHALL not open its PR.
13. THE regenerated Gate_Baseline SHALL have `"format": "efterhand-layout-blockers/1"` and SHALL list the same blocker rows as the Gate_Baseline at its base commit, except rows whose text or position changed because of the rename (for example the 9-letter Wordmark). THE PR description SHALL list each added, removed or changed row, with the rename-related cause of each.
14. WHEN the Check_Script runs on the platform-dev head commit after the tasks it depends on are merged, THE Check_Script SHALL exit with code 0.
15. THE platform-dev task SHALL leave `.env.example` unchanged, since it names no variable with the Old_Name, and SHALL leave every file outside the platform-dev paths and the shared paths in `.github/agents.json` unchanged.

### Requirement 9: Owner rename before the repository rename (Owner_Task, Step 4)

**User Story:** As the owner, I want the dispatcher, hooks, agent configs and CI renamed before the repository moves, so that the loop keeps working through the move.

#### Acceptance Criteria

1. THE Step 4 Owner_Task SHALL start only after the PR of every Role_Task of this spec is merged to `main` and its issue is closed.
2. THE Step 4 Owner_Task SHALL move `tools/dispatcher/revenant_dispatch.py` to `tools/dispatcher/efterhand_dispatch.py` with `git mv`, and SHALL change every `revenant_dispatch` import in `tools/dispatcher/bootstrap.py`, `tools/dispatcher/spec_sync.py` and `tools/dispatcher/tests/**` to `efterhand_dispatch`.
3. THE Step 4 Owner_Task SHALL rename `REVENANT_GITHUB_TOKEN`, `REVENANT_CREW_HOME` and `REVENANT_MAX_DEV_RUNS` to `EFTERHAND_GITHUB_TOKEN`, `EFTERHAND_CREW_HOME` and `EFTERHAND_MAX_DEV_RUNS` everywhere in `tools/dispatcher/**`, and SHALL change the default crew home from `~/kiro/revenant-crew` to `~/kiro/efterhand-crew`.
4. THE Step 4 Owner_Task SHALL apply the Rename_Map to the dispatcher's markers (`revenant-dispatch` → `efterhand-dispatch`, `revenant-agent-notes` → `efterhand-agent-notes`), its user agent and git identity (`revenant-dispatcher` → `efterhand-dispatcher`), and every notification text in `tools/dispatcher/**` that names the Old_Name.
5. THE Step 4 Owner_Task SHALL apply the Rename_Map to `tools/agents/generate_agents.py` (role descriptions, the `$HOME/kiro/efterhand-crew/…-shots` paths, the `efterhand-prompts` install folder) and SHALL regenerate `.kiro/agents/*.json` by running the generator, with no hand edits to the generated files.
6. THE Step 4 Owner_Task SHALL apply the Rename_Map to `.kiro/agents/prompts/**`, `.kiro/hooks/**`, `tools/hooks/**` (including the log path `~/kiro/efterhand-crew/hooks.log` and the `efterhand-hooks` temp folder), `docs/agent-loop.md`, `docs/kiro-writeup.md`, `docs/design/**`, and every other file in Scope that `.github/agents.json` assigns to no role.
7. THE Step 4 Owner_Task SHALL set the CI database name to `efterhand_test` and the CI image tag to `efterhand:ci` in `.github/workflows/ci.yml`, and the journey check URL to `https://efterhand.devclef.se` in `.github/workflows/journey-check.yml`.
8. WHILE Step 6 has not run, THE Kept_Repo_Pointers SHALL keep naming `devclef/Revenant` (dispatcher `REPO`, `REPO_URL` and the default repo in `spec_sync.py`) and `ghcr.io/devclef/revenant` (image push path in `build.yml`), unchanged from `e3087997`.
9. THE Step 4 Owner_Task SHALL make the Chart_Lint_Step read only `deploy/helm/efterhand`, as stated in Requirement 4.7 to 4.9.
10. WHEN the Step 4 Owner_Task is done, THE Residual_Search SHALL list only the files `tools/dispatcher/efterhand_dispatch.py`, `tools/dispatcher/spec_sync.py` and `.github/workflows/build.yml`. Each Old_Name line in those files SHALL be one of the Kept_Repo_Pointers, and the path search SHALL return no path.
11. WHEN the Step 4 Owner_Task is done, `python3 tools/agents/generate_agents.py --check` SHALL exit with code 0, `python3 -m unittest discover -s tools/dispatcher/tests -q` SHALL exit with code 0, and the Check_Script SHALL exit with code 0 on the task's head commit.
12. IF only an old variable (`REVENANT_GITHUB_TOKEN`, `REVENANT_CREW_HOME` or `REVENANT_MAX_DEV_RUNS`) is set after the Step 4 change, THEN THE dispatcher SHALL ignore it and behave as it did at `e3087997` when the matching variable was unset. The dispatcher SHALL NOT read the old variable or the old `~/kiro/revenant-crew` home as a fallback.
13. WHEN the Step 4 Owner_Task is done, THE User_Checklist SHALL include setting the three `EFTERHAND_*` variables in the owner's environment and moving or recreating the crew home at `~/kiro/efterhand-crew`, because the task adds no migration for the old ones.

### Requirement 10: Order of work

**User Story:** As the owner, I want the steps in a fixed order, so that no PR depends on a change that hasn't landed.

#### Acceptance Criteria

1. THE `tasks.md` of this spec SHALL list the work as six numbered steps in this order, with no task outside them: Step 1, the Owner_Task work of Requirement 3 for the Steering_Docs and Requirement 4.1 to 4.6 for the Chart_Lint_Step fallback, listed either as one Owner_Task (Steering_Docs first, then the fallback) or as two Owner_Tasks (one for the Steering_Docs, one for the fallback); Step 2, the frontend-dev task (Requirement 5) and the crypto-dev task (Requirement 6); Step 3, the data-dev task (Requirement 7) and the platform-dev task (Requirement 8); Step 4, the owner rename of Requirement 9; Step 5, the owner's rename of the GitHub repository to `devclef/Efterhand`; Step 6, the final Owner_Task of Requirement 11.
2. THE `tasks.md` SHALL mark every Owner_Task and the Step 5 user action with `Agent: owner`, and SHALL mark each Role_Task with its role (`frontend-dev`, `crypto-dev`, `data-dev` or `platform-dev`) and no `Agent: owner` line.
3. THE `tasks.md` SHALL name, for each task, the tasks that must be merged or done before it starts: every Step 1 Owner_Task for both Step 2 tasks; every Step 1 Owner_Task and the frontend-dev task for both Step 3 tasks; every Role_Task for Step 4; the Step 4 Owner_Task for Step 5; and the owner's report that Step 5 is done for Step 6.
4. THE `tasks.md` SHALL let the two Step 2 tasks run at the same time, and SHALL let the two Step 3 tasks run at the same time, with neither task in a pair naming the other as a dependency.
5. WHEN a Role_Task's PR is checked on its own head commit, with every task named as its dependency in `tasks.md` merged into `main` and no other task of this spec required, THE Check_Script SHALL exit with code 0.
6. IF a Role_Task's PR fails the Check_Script because a task it depends on is not merged yet, THEN THE Role_Task SHALL wait for that merge and rebase onto `main`, and SHALL NOT add a fallback, alias or compatibility code for the Old_Name to make the check pass.
7. WHEN the Step 4 Owner_Task is done, THE app SHALL show "Efterhand" as the product name, and no Old_Name, in the page title, the Wordmark, the Top_Bar and the visible text of every route under `src/app/`. Between the merge of the first Step 2 task and the end of Step 4, a page MAY show both names (for example a page title built from `SITE_NAME` before the platform-dev task merges), and no task SHALL add code to prevent that.
8. THE `tasks.md` SHALL state, in the platform-dev task and in each step from Step 3 to Step 5, that the new chart from `deploy/helm/efterhand` with the default image `ghcr.io/devclef/efterhand` is not installed until Step 6 points the image push path at `ghcr.io/devclef/efterhand` and a build has pushed an image there, because before then no image exists at that path.

### Requirement 11: Final switch and done (Owner_Task, Step 6)

**User Story:** As the owner, I want the last step to point everything at the renamed repository and confirm the loop still works, so that I know the rename is finished.

#### Acceptance Criteria

1. WHEN the owner reports that the GitHub repository is renamed to `devclef/Efterhand`, and the Step 4 Owner_Task is done, THE Step 6 Owner_Task SHALL change exactly the Kept_Repo_Pointers: the dispatcher's `REPO` to `devclef/Efterhand`, `REPO_URL` in `tools/dispatcher/spec_sync.py` to `https://github.com/devclef/Efterhand/blob/main`, the default repo in `spec_sync.py` to `devclef/Efterhand`, and the image push path in `.github/workflows/build.yml` to `ghcr.io/devclef/efterhand`. The change SHALL be a single commit that touches no other line.
2. IF the repository `devclef/Efterhand` cannot be found on GitHub when the Step 6 Owner_Task starts, THEN THE Step 6 Owner_Task SHALL stop before changing any file, report that the Step 5 repository rename is not visible, and leave the Kept_Repo_Pointers naming `devclef/Revenant` and `ghcr.io/devclef/revenant`.
3. THE Step 6 Owner_Task SHALL set the fetch and push URLs of the local `origin` remote to `devclef/Efterhand`, using the same protocol (HTTPS or SSH) as before, and SHALL include the output of `git remote -v` in its report. That output SHALL contain no Old_Name.
4. WHEN the Step 6 commit is pushed to `main`, THE Step 6 Owner_Task SHALL run spec-sync once against `devclef/Efterhand` and report its exit code and the number of issues it created. The run passes when the exit code is 0, every task of this spec maps to the existing issue that carries its `<!-- spec-task: 20-efterhand-rename/<n> -->` marker, and the number of created issues is 0.
5. IF the spec-sync run exits with a non-zero code or creates any issue, THEN THE Step 6 Owner_Task SHALL report the exit code and the numbers of any created issues, SHALL NOT be marked done, and SHALL NOT close or delete any issue without the owner's confirmation.
6. WHEN the Step 6 commit is pushed to `main`, THE `build.yml` workflow run for that commit SHALL succeed and push an image to `ghcr.io/devclef/efterhand`, and THE Step 6 Owner_Task SHALL report the run's URL and the pushed image tag.
7. WHEN the Step 6 Owner_Task is done, both commands of the Residual_Search, run on the head commit of `main`, SHALL print nothing.
8. WHEN the Step 6 Owner_Task is done, THE Check_Script SHALL exit with code 0 on the head commit of `main`, and the `ci-gate` job SHALL pass for that same commit.
9. THE Step 6 Owner_Task SHALL end its report with the User_Checklist, which SHALL contain at least these items, each written as one action the owner takes:
   - Rename the GitHub secrets and Crew grants that use the Old_Name (for example `REVENANT_GITHUB_TOKEN` to `EFTERHAND_GITHUB_TOKEN`, and the grant `github_revenant_repo`).
   - Move `~/kiro/revenant-crew` to `~/kiro/efterhand-crew`.
   - Set up DNS and TLS for `efterhand.devclef.se`, and set `RP_ID` to `efterhand.devclef.se` and `APP_ORIGIN` to `https://efterhand.devclef.se` in the GitOps values.
   - Remove the old Helm release and its storage (the retained PVC), then install the new chart from `deploy/helm/efterhand` with the image `ghcr.io/devclef/efterhand`.
   - Delete the old "Revenant demo" and "Revenant letter" passkeys from passkey managers.
   - Remove the old generated prompts folder `~/.kiro/agents/revenant-prompts/`, if it exists.

## Decisions this spec makes beyond the request

The owner may strike any of these before design starts.

- **Page title ownership.** `SITE_NAME` lives in `src/lib/page-metadata.ts`, a platform-dev path, while the layout title is in `layout.tsx`. The frontend-dev task changes the layout title and the platform-dev task changes `SITE_NAME`, so page titles show both names between the two merges (Requirement 10.7).
- **Trigger message prefix.** The exception text `revenant: % on % is not allowed` becomes `efterhand: …`, since the rename covers internal strings.
- **A test that the old Golden_V2 no longer opens.** It proves the labels really changed (Requirement 6.7).
- **Chart lint fails when the chart is missing.** At `e3087997` the step skips silently when the file is missing. From Step 1 it fails when no chart folder exists, and after Step 4 it fails when `deploy/helm/efterhand/Chart.yaml` is missing, whether or not `helm` is on the path (Requirement 4.2 and 4.8), so a future move cannot repeat the problem.
- **No helm on the path still skips the lint.** When `helm` is not on the path, the Check_Script skips `helm lint`, `helm template` and the "no Secret" check as it does at `e3087997` (Requirement 4.6). Only the missing-chart checks run without `helm`. CI is not required to have `helm`.
- **The old chart folder is caught without naming it.** After Step 4, the Check_Script fails if `deploy/helm/` holds any directory other than `efterhand` (Requirement 4.9), instead of testing for the old folder by name. This keeps the old path out of `scripts/check.sh`, so the Residual_Search after Step 4 lists only the Kept_Repo_Pointers (Requirement 9.10) and prints nothing after Step 6 (Requirement 11.7), and the Step 6 commit can stay limited to the Kept_Repo_Pointers (Requirement 11.1).
- **Old dispatcher variables are ignored.** After Step 4 the dispatcher reads only `EFTERHAND_GITHUB_TOKEN`, `EFTERHAND_CREW_HOME` and `EFTERHAND_MAX_DEV_RUNS`. An old `REVENANT_*` variable or the old `~/kiro/revenant-crew` home is ignored, not read as a fallback (Requirement 9.12). The User_Checklist therefore tells the owner to set the three `EFTERHAND_*` variables and move or recreate the crew home (Requirement 9.13).
- **Step 6 proves the new image path.** The Step 6 `build.yml` run must succeed and push an image to `ghcr.io/devclef/efterhand`, with its run URL and image tag reported (Requirement 11.6). Until then no image exists at the chart's default path, so the new chart is not installed (Requirement 10.8).
- **Old prompts folder in the User_Checklist.** `generate_agents.py` installs prompts to `~/.kiro/agents/revenant-prompts/`, outside the repository.

## Open questions for the owner

- **Tagline_Line has no product name.** At `e3087997` the nowrap phrase is "letter doesn't."; only the CSS comments say "Revenant doesn't.". The fit check in Requirement 5.9 is still run, but no layout change is expected from the Tagline. The Wordmark, one letter longer, is the likelier fit risk (Requirement 5.10).
- **Persona letters in the database.** Persona letters are sealed by `scripts/seal-personas` at deploy, so the fresh install seals them with the new labels. No persona content holds the Old_Name.
