# How Revenant was built with Kiro

Every number below was counted at `main` commit `7065dcd388616a6b05eb22dd29e4112169b27b6c` (24 November 2026), with the command next to it. Run `git checkout 7065dcd` first to recompute a count. Pull request counts come from the GitHub API and include everything merged up to the moment the command runs.

Merged pull requests: `gh pr list --state merged --limit 2000 --json number -q length` → 349 on 24 November 2026. Of those, 271 came from a role agent's `agent/` branch (`gh pr list --state merged --limit 2000 --json headRefName -q '[.[]|select(.headRefName|startswith("agent/"))]|length'`).

## 1. Kiro surfaces

Revenant used three Kiro surfaces:

- **Kiro Crew** ran the build loop. A dispatcher cron job (`tools/dispatcher/revenant_dispatch.py`) claims ready GitHub issues, starts a build run as the issue's role agent, opens the pull request, waits for CI, starts a QA run, and merges or feeds failures back for a fix run.
- **The Kiro IDE** is where the owner wrote steering and specs, and where the IDE hooks in `.kiro/hooks/` run on save.
- **The Kiro CLI** (`kiro-cli`) runs each role agent inside Crew's Task Runner. The agents are defined in `.kiro/agents/*.json` and installed into `~/.kiro/agents/` (see `docs/agent-loop.md`).

In practice the IDE was the owner's desk: requirements, designs, task lists and steering were written and revised there, one spec at a time. The CLI did the typing, with no human in the session. Each run was one role agent on one issue, on `claude-haiku-5.5` for `platform-dev`, `crypto-dev` and `data-dev` and `claude-sonnet-5.5` for `frontend-dev` and `qa` (`grep '"model"' .kiro/agents/*.json`). Crew connected the two: it decided what ran next, retried failures, and handed an issue back to the owner only after three failed fix runs. Ten issues reached `status:blocked` over the whole build (`gh issue list --label status:blocked --state all --json number -q length`).

## 2. The custom agents

`.kiro/agents/` holds five agents (`ls .kiro/agents/*.json | wc -l` → 5). Each build agent's write paths come from `.github/agents.json`, which the PR policy check also enforces.

| Agent | Owns |
|---|---|
| `platform-dev` | Scaffold, config, health routes, DB client and migrations, Dockerfile, Helm chart. |
| `crypto-dev` | Browser crypto, the sealed format, the letter and opening APIs, sealed tables and triggers. |
| `data-dev` | Source adapters, the figure catalogue, the fetch job, the figures API and tables. |
| `frontend-dev` | Pages, components, styling, cards, `.ics`, recall wording, persona text. |
| `qa` | Writes nothing in the product. Reviews each PR against its ticket and the steering docs in a headless browser and writes `.qa/verdict.json`. |

Commits by agent tag (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`): frontend-dev 171, platform-dev 55, data-dev 30, crypto-dev 16, owner 16, dispatcher 1.

## 3. Hooks

- **IDE hooks** (`ls .kiro/hooks/` → 4), all on file save:
  - `copy-tone-check`: tone and neutrality check on `src/**/*.tsx` and `content/**/*.md|txt`.
  - `ceremony-truth-check`: ceremony truth, tone and neutrality on `src/components/ceremony/`.
  - `crypto-tests-on-save`: runs the crypto and seal-format tests on `src/lib/crypto/` and `src/lib/seal-format/`.
  - `agents-check-on-save`: checks the generated agents still match `.github/agents.json`.
- **Agent stop hooks** (the `hooks.stop` entry in each `.kiro/agents/*.json`): every build agent runs `tools/hooks/scope-check.py` for its role, and `frontend-dev` also runs `tools/hooks/tone-check.mjs`, before a run can finish.

The hook log on the build machine (`~/kiro/revenant-crew/hooks.log`, not in git) covers 31 October to 24 November 2026. Leaving out the hooks' own test runs, it records 7,227 scope-check runs with 35 blocks and 2,998 tone-check runs with 5 blocks (`grep -v role=test hooks.log | grep -c 'hook=scope-check.*result=block'`, and the same for `tone-check`).

Two blocks, with what the agent did next:

- **A path the agent did not own.** On 1 November 2026, between 21:40 and 21:52 UTC, the scope check stopped `frontend-dev` six times. The run had written `drizzle/0001_live_letters.sql`, `src/lib/letter-store/*` and `src/lib/seal-format/live-constants.ts`, the migration, store and sealed-format code for live demo letters, which belong to `crypto-dev` and `platform-dev`. The run could not finish while those files were in its tree. The migration and the letter store landed through `crypto-dev` in [PR #139](https://github.com/devclef/Revenant/pull/139), and the change-calculator option the same run had tried to add to `src/lib/figures/change.ts` landed through `data-dev` in [PR #144](https://github.com/devclef/Revenant/pull/144).
- **A banned word in code.** In [PR #534](https://github.com/devclef/Revenant/pull/534) the tone check flagged `src/components/copy-tone.ts`, the module that checks copy for banned words. It held those words and an exclamation mark as quoted strings, and the hook reads quoted strings as visible copy. The agent rewrote the word lists as regex literals, built the exclamation fixture in `copy-tone.test.ts` at runtime with `String.fromCharCode(33)`, and kept the checker's behaviour unchanged. The PR body records the fix.

## 4. Spec-driven development compared with vibe coding

The repository has 19 spec folders (`git ls-files .kiro/specs | cut -d/ -f3 | sort -u | wc -l` → 19; two are numbered 02). Each spec has requirements, a design and a task list. Each task became one GitHub issue and one pull request for one role. Every task is done except three: the final walk of spec 15, and the fix-up and final walk of spec 16.

| Spec | Tasks |
|---|---|
| 01 Skeleton | 10 |
| 02 Demo figures | 2 |
| 02 Sealed letters | 5 |
| 03 Persona demo | 8 |
| 04 Real figures | 11 |
| 05 Reveal ceremony | 11 |
| 06 Lock and unlock | 12 |
| 07 Judge journey | 11 |
| 08 Judge polish | 22 |
| 09 Demo polish | 24 |
| 10 Own questions | 17 |
| 11 Any letter | 25 |
| 12 Submission polish | 18 |
| 13 The seal | 23 |
| 14 Write desk | 20 |
| 15 The flow | 16 |
| 16 Remember first | 17 |
| 17 Screen layout fixes | 16 |
| 18 Persona dates | 17 |

Command: `for d in .kiro/specs/*/; do echo "$d $(grep -cE '^- \[[ x]\] [0-9]+\.' $d/tasks.md)"; done`.

What the spec loop gave that vibe coding would not:

- **Traceability.** Every change to the product can be followed from a requirement to a task, an issue and a pull request. For example `.kiro/specs/11-any-letter/tasks.md` task 22 → issue [#356](https://github.com/devclef/Revenant/issues/356) → [PR #380](https://github.com/devclef/Revenant/pull/380).
- **Work an unattended agent could do.** A task carries its scope, its out-of-scope list and its acceptance criteria, so a CLI run with no human in it could finish it and QA could check it against the same text. Issue [#212](https://github.com/devclef/Revenant/issues/212) is a typical ticket: one file in scope, the drawing code out of scope, three checkable criteria.
- **A place to correct course.** When production showed a gap, the fix went into a spec first, then into tickets. Spec 09 opens with the figures failure in section 9 below (`.kiro/specs/09-demo-polish/requirements.md`, F1), and spec 11 rewrote the product from fuel-price letters to letters about any part of life (`.kiro/specs/11-any-letter/requirements.md`, X1).

Where it was still vibe coding: the loop itself. Of 661 non-merge commits, 85 did not come through a ticket pull request (`git log --no-merges --format='%h %s' | grep -v -E '\(#[0-9]+\)$' | grep -vc 'Tick completed'`). They are mostly the owner's direct work on the dispatcher, the QA prompt, CI, agent prompts and steering, changed as problems showed up, for example `1b5f997` (one Task Runner run at a time) and `12a64b3` (an unfinished browser walk is a minor finding). The dispatcher and the build loop had no spec.

## 5. Steering

`.kiro/steering/` holds eight files. Six load on every request (`inclusion: always`): `product.md`, `tech.md`, `structure.md`, `tone.md`, `neutrality.md` and `data-integrity.md`. Two load only for the files they govern (`inclusion: fileMatch`): `crypto.md` for the crypto, sealed-format, letter and opening code and the persona sealing script, and `deploy.md` for the chart, workflows, Dockerfile, migrations and scripts. Command: `grep -n '^inclusion' .kiro/steering/*.md`.

## 6. MCP

The `qa` and `frontend-dev` agents use the Playwright MCP server (`mcpServers.playwright` in `.kiro/agents/qa.json` and `.kiro/agents/frontend-dev.json`) to open each PR's build in a headless browser and take the screenshots the QA verdict cites.

## 7. Property-based testing

The tests use fast-check. `git ls-files '*.property.test.*' | wc -l` → 92 property test files, covering the source adapters, the then-vs-now change, the sealed payload round trip, the opening state machine, the persona letter checks and the ceremony gates. Each is tagged `// Feature: <spec>, Property N: <title>`.

A bug a property caught that the example tests missed:

- **A clod drawn above the dust ceiling** (`6b05a9c`, [PR #331](https://github.com/devclef/Revenant/pull/331)). The property "never draws dust or clods above the ceiling, for any Top_Bar, headline and translateY" in `soil-canvas.test.ts` failed on some random seeds. `clodPoint` returned the launch point unchanged at `tauS = 0`, because its step loop does not run. When the headline sits below the soil top, the launch point is above the ceiling, so the clod was drawn above it for that frame. The fix starts the clod at `max(launch y, ceiling)`.

The same property flaked once before for a reason that was not a bug: issue [#212](https://github.com/devclef/Revenant/issues/212) found a dust point at y 331.2 against a ceiling of 331.20000000000005, and `59ec3be` ([PR #216](https://github.com/devclef/Revenant/pull/216)) loosened the assertion by 1e-9. Telling the two apart took reading the counterexample, and the second failure was real.

Re-run one: `npx vitest run src/components/ceremony/scene/soil-canvas.test.ts`.

## 8. Kiro powers

Kiro powers were not used. No power is installed on the build machine (`~/.kiro/powers/installed.json` lists `"installedPowers": []`), the repository has no powers directory (`ls .kiro/` → `agents hooks settings specs steering`), and no agent file names one. What powers would package, rules plus tools for one domain, the project already had in steering with `fileMatch` inclusion (`crypto.md`, `deploy.md`) and in the Playwright MCP server named in the agent files.

## 9. What went wrong once

Spec 09 opened with a production failure (spec 09 requirements, F1): no persona reveal showed a now figure, because `GET /api/figures` returned `figure: null` for all four series in database mode. QA had passed every PR, because QA ran the app locally with the figures API in file mode and nothing checked production. Spec 09 added the Journey_Check (`.github/workflows/journey-check.yml`, `tools/qa/journey-check.mjs`), which opens the judge's pages on production every six hours and opens an issue when a check fails, and committed the spec 08 Freshness_Check.

The first Journey_Check run failed: [run 42530503661](https://github.com/devclef/Revenant/actions/runs/42530503661), 8 November 2026 at 22:29 UTC. It opened issue [#318](https://github.com/devclef/Revenant/issues/318), "Journey check: failure", now closed. Commands: `gh run list --workflow journey-check.yml --limit 100 --json databaseId,createdAt,conclusion` and `gh issue list --label journey:failure --state all`.
