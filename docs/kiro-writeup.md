# How Revenant was built with Kiro

Every number below was counted at `main` commit `1b28a81b4ebb5937b72dbaa165a61551b0aa23f4` (8 November 2026), with the command next to it. Run `git checkout 1b28a81` first to recompute a count. Pull request counts come from the GitHub API and include everything merged up to the moment the command runs.

<!-- OWNER: before submission, recount at the final main SHA and replace the SHA and every number in this file. Fill in each OWNER note; delete a note once its text is written. -->

## 1. Kiro surfaces

Revenant used three Kiro surfaces:

- **Kiro Crew** ran the build loop. A dispatcher cron job (`tools/dispatcher/revenant_dispatch.py`) claims ready GitHub issues, starts a build run as the issue's role agent, opens the pull request, waits for CI, starts a QA run, and merges or feeds failures back for a fix run.
- **The Kiro IDE** is where the owner wrote steering and specs, and where the IDE hooks in `.kiro/hooks/` run on save.
- **The Kiro CLI** (`kiro-cli`) runs each role agent inside Crew's Task Runner. The agents are defined in `.kiro/agents/*.json` and installed into `~/.kiro/agents/` (see `docs/agent-loop.md`).

<!-- OWNER: say in two or three sentences how the three differed in practice in this project. -->

## 2. The custom agents

`.kiro/agents/` holds five agents (`ls .kiro/agents/*.json | wc -l` → 5). Each build agent's write paths come from `.github/agents.json`, which the PR policy check also enforces.

| Agent | Owns |
|---|---|
| `platform-dev` | Scaffold, config, health routes, DB client and migrations, Dockerfile, Helm chart. |
| `crypto-dev` | Browser crypto, the sealed format, the letter and opening APIs, sealed tables and triggers. |
| `data-dev` | Source adapters, the figure catalogue, the fetch job, the figures API and tables. |
| `frontend-dev` | Pages, components, styling, cards, `.ics`, recall wording, persona text. |
| `qa` | Writes nothing in the product. Reviews each PR against its ticket and the steering docs in a headless browser and writes `.qa/verdict.json`. |

Commits by agent tag (`git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c`): frontend-dev 65, platform-dev 21, data-dev 18, crypto-dev 12, owner 10.

## 3. Hooks

- **IDE hooks** (`ls .kiro/hooks/` → 4), all on file save:
  - `copy-tone-check`: tone and neutrality check on `src/**/*.tsx` and `content/**/*.md|txt`.
  - `ceremony-truth-check`: ceremony truth, tone and neutrality on `src/components/ceremony/`.
  - `crypto-tests-on-save`: runs the crypto and seal-format tests on `src/lib/crypto/` and `src/lib/seal-format/`.
  - `agents-check-on-save`: checks the generated agents still match `.github/agents.json`.
- **Agent stop hooks** (the `hooks.stop` entry in each `.kiro/agents/*.json`): every build agent runs `tools/hooks/scope-check.py` for its role, and `frontend-dev` also runs `tools/hooks/tone-check.mjs`, before a run can finish.

<!-- OWNER: one real block, with its PR or run: the word or path that was stopped and what the agent changed. -->

## 4. Spec-driven development compared with vibe coding

The product was built from specs 01 to 09; spec 10 is in progress (`ls .kiro/specs | wc -l` → 11 folders, two of them numbered 02). Each spec has requirements, a design and a task list. Each task became one GitHub issue and one pull request for one role.

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
| 10 Own questions | 16 |

Command: `for d in .kiro/specs/*/; do echo "$d $(grep -cE '^- \[[ x]\] [0-9]+\.' $d/tasks.md)"; done`.

Merged pull requests: `gh pr list --state merged --limit 1000 --json number -q length` → 168 on 8 November 2026.

<!-- OWNER: what the spec loop gave that vibe coding would not have, and where you still vibe-coded. -->

## 5. Steering

`.kiro/steering/` holds eight files. Six load on every request (`inclusion: always`): `product.md`, `tech.md`, `structure.md`, `tone.md`, `neutrality.md` and `data-integrity.md`. Two load only for the files they govern (`inclusion: fileMatch`): `crypto.md` for the crypto, sealed-format, letter and opening code and the persona sealing script, and `deploy.md` for the chart, workflows, Dockerfile, migrations and scripts. Command: `grep -n '^inclusion' .kiro/steering/*.md`.

## 6. MCP

The `qa` and `frontend-dev` agents use the Playwright MCP server (`mcpServers.playwright` in `.kiro/agents/qa.json` and `.kiro/agents/frontend-dev.json`) to open each PR's build in a headless browser and take the screenshots the QA verdict cites.

## 7. Property-based testing

The tests use fast-check. `git ls-files '*.property.test.*' | wc -l` → 35 property test files, covering the source adapters, the then-vs-now change, the sealed payload round trip, the opening state machine, the persona letter checks and the ceremony gates.

<!-- OWNER: list concrete bugs a property caught that example tests missed, each with its PR or commit. Candidates to check: `git log --format='%h %s' -i --grep=property`. -->

## 8. Kiro powers

<!-- OWNER: say plainly whether Kiro powers were used, and why or why not (E1.3). -->

## 9. What went wrong once

Spec 09 opened with a production failure (spec 09 requirements, F1): no persona reveal showed a now figure, because `GET /api/figures` returned `figure: null` for all four series in database mode. QA had passed every PR, because QA ran the app locally with the figures API in file mode and nothing checked production. Spec 09 added the Journey_Check (`.github/workflows/journey-check.yml`, `tools/qa/journey-check.mjs`), which opens the judge's pages on production every six hours and opens an issue when a check fails, and committed the spec 08 Freshness_Check.

<!-- OWNER: link the first Journey_Check run and the issue it opened. -->
