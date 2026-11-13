# How Revenant was built with Kiro

Every number below was counted at `main` commit `4b71564e7945efc9380d324bdb9165117bfa10e4` (13 November 2026), with the command next to it. Run `git checkout 4b71564` first to recompute a count. Pull request counts come from the GitHub API and include everything merged up to the moment the command runs.

<!-- OWNER: before submission, recount at the final main SHA and replace the SHA and every number in this file. Fill in each OWNER note, using the Evidence list under it; delete a note once its text is written. -->

Evidence: SHA `git rev-parse origin/main`; merged pull requests `gh pr list --state merged --limit 1000 --json number -q length` → 206 on 13 November 2026; commits by agent tag, specs, property files and agents in the sections below.

## 1. Kiro surfaces

Revenant used three Kiro surfaces:

- **Kiro Crew** ran the build loop. A dispatcher cron job (`tools/dispatcher/revenant_dispatch.py`) claims ready GitHub issues, starts a build run as the issue's role agent, opens the pull request, waits for CI, starts a QA run, and merges or feeds failures back for a fix run.
- **The Kiro IDE** is where the owner wrote steering and specs, and where the IDE hooks in `.kiro/hooks/` run on save.
- **The Kiro CLI** (`kiro-cli`) runs each role agent inside Crew's Task Runner. The agents are defined in `.kiro/agents/*.json` and installed into `~/.kiro/agents/` (see `docs/agent-loop.md`).

<!-- OWNER: say in two or three sentences how the three differed in practice in this project. -->

Evidence:
- Crew loop: `ls tools/dispatcher/` and `docs/agent-loop.md`; every build PR is tagged by role (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`).
- IDE: `ls .kiro/hooks/ .kiro/steering/ .kiro/specs/`.
- CLI: `ls .kiro/agents/*.json` and the `kiro-cli` step in `docs/agent-loop.md`.

## 2. The custom agents

`.kiro/agents/` holds five agents (`ls .kiro/agents/*.json | wc -l` → 5). Each build agent's write paths come from `.github/agents.json`, which the PR policy check also enforces.

| Agent | Owns |
|---|---|
| `platform-dev` | Scaffold, config, health routes, DB client and migrations, Dockerfile, Helm chart. |
| `crypto-dev` | Browser crypto, the sealed format, the letter and opening APIs, sealed tables and triggers. |
| `data-dev` | Source adapters, the figure catalogue, the fetch job, the figures API and tables. |
| `frontend-dev` | Pages, components, styling, cards, `.ics`, recall wording, persona text. |
| `qa` | Writes nothing in the product. Reviews each PR against its ticket and the steering docs in a headless browser and writes `.qa/verdict.json`. |

Commits by agent tag (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`): frontend-dev 95, platform-dev 24, data-dev 21, crypto-dev 13, owner 10, dispatcher 1.

## 3. Hooks

- **IDE hooks** (`ls .kiro/hooks/` → 4), all on file save:
  - `copy-tone-check`: tone and neutrality check on `src/**/*.tsx` and `content/**/*.md|txt`.
  - `ceremony-truth-check`: ceremony truth, tone and neutrality on `src/components/ceremony/`.
  - `crypto-tests-on-save`: runs the crypto and seal-format tests on `src/lib/crypto/` and `src/lib/seal-format/`.
  - `agents-check-on-save`: checks the generated agents still match `.github/agents.json`.
- **Agent stop hooks** (the `hooks.stop` entry in each `.kiro/agents/*.json`): every build agent runs `tools/hooks/scope-check.py` for its role, and `frontend-dev` also runs `tools/hooks/tone-check.mjs`, before a run can finish.

<!-- OWNER: one real block, with its PR or run: the word or path that was stopped and what the agent changed. -->

Evidence:
- Retired phrases the tone check blocks: `grep -n 'retired phrase' tools/hooks/tone-check.mjs` and the `RETIRED_PHRASES` list in that file.
- Find a PR where a hook fired: `gh pr list --state merged --limit 1000 --search 'tone-check OR scope-check' --json number,title`, then open the PR's run log.
- Hook log on the build machine: `hooks.log` in the agent working directory.

## 4. Spec-driven development compared with vibe coding

The product was built from specs 01 to 10; spec 11 is in progress (`git ls-files .kiro/specs | cut -d/ -f3 | sort -u | wc -l` → 12 folders, two of them numbered 02). Each spec has requirements, a design and a task list. Each task became one GitHub issue and one pull request for one role.

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

Command: `for d in .kiro/specs/*/; do echo "$d $(grep -cE '^- \[[ x]\] [0-9]+\.' $d/tasks.md)"; done`.

Merged pull requests: `gh pr list --state merged --limit 1000 --json number -q length` → 206 on 13 November 2026.

<!-- OWNER: what the spec loop gave that vibe coding would not have, and where you still vibe-coded. -->

Evidence:
- Spec to issue to PR: `.kiro/specs/11-any-letter/tasks.md` task 22 → issue #356 → PR #380 (`gh pr view 380`).
- A spec that was rewritten after production showed a gap: spec 09 (`.kiro/specs/09-demo-polish/requirements.md`, F1) and spec 11 (`.kiro/specs/11-any-letter/requirements.md`, X1).
- Work outside a spec: `git log --format='%h %s' | grep -v -E '\(#[0-9]+\)$'` lists commits that did not come through a ticket PR.

## 5. Steering

`.kiro/steering/` holds eight files. Six load on every request (`inclusion: always`): `product.md`, `tech.md`, `structure.md`, `tone.md`, `neutrality.md` and `data-integrity.md`. Two load only for the files they govern (`inclusion: fileMatch`): `crypto.md` for the crypto, sealed-format, letter and opening code and the persona sealing script, and `deploy.md` for the chart, workflows, Dockerfile, migrations and scripts. Command: `grep -n '^inclusion' .kiro/steering/*.md`.

## 6. MCP

The `qa` and `frontend-dev` agents use the Playwright MCP server (`mcpServers.playwright` in `.kiro/agents/qa.json` and `.kiro/agents/frontend-dev.json`) to open each PR's build in a headless browser and take the screenshots the QA verdict cites.

## 7. Property-based testing

The tests use fast-check. `git ls-files '*.property.test.*' | wc -l` → 49 property test files, covering the source adapters, the then-vs-now change, the sealed payload round trip, the opening state machine, the persona letter checks and the ceremony gates.

<!-- OWNER: list concrete bugs a property caught that example tests missed, each with its PR or commit. Candidates to check: `git log --format='%h %s' -i --grep=property`. -->

Evidence:
- The property files: `git ls-files '*.property.test.*'`; the tag on each is `// Feature: <spec>, Property N: <title>`.
- Candidate commits to read for a caught bug: `git log --format='%h %s' -i -E --grep='counterexample|fast-check|shrunk'`, including `6b05a9c` (E1, #331) and `914b15b` (the then/now helper, #56). Confirm each one caught a bug before citing it.
- Re-run one: `npx vitest run src/lib/figures/then-now.property.test.ts`.

## 8. Kiro powers

<!-- OWNER: say plainly whether Kiro powers were used, and why or why not (E1.3). -->

Evidence:
- The repository has no powers directory and no power is named in the agent files: `ls .kiro/` → `agents hooks settings specs steering`.
- Check the IDE on the owner's machine for installed powers before writing either answer.

## 9. What went wrong once

Spec 09 opened with a production failure (spec 09 requirements, F1): no persona reveal showed a now figure, because `GET /api/figures` returned `figure: null` for all four series in database mode. QA had passed every PR, because QA ran the app locally with the figures API in file mode and nothing checked production. Spec 09 added the Journey_Check (`.github/workflows/journey-check.yml`, `tools/qa/journey-check.mjs`), which opens the judge's pages on production every six hours and opens an issue when a check fails, and committed the spec 08 Freshness_Check.

<!-- OWNER: link the first Journey_Check run and the issue it opened. -->

Evidence:
- First failed run: [run 42530503661](https://github.com/devclef/Revenant/actions/runs/42530503661), 8 November 2026 (`gh run list --workflow journey-check.yml --limit 100 --json databaseId,createdAt,conclusion`).
- The issue it opened: [#318](https://github.com/devclef/Revenant/issues/318) (`gh issue list --label journey:failure --state all`).
- Spec 09's account of the failure: `.kiro/specs/09-demo-polish/requirements.md`, F1.
