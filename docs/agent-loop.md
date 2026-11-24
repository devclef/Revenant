# The Revenant agent loop

Revenant is built by role agents run by [Kiro Crew](https://kiro.dev/docs/crew.md). This page is the runbook.

## Pieces

| Piece | Where | Job |
|---|---|---|
| Specs | `.kiro/specs/NN-name/` | Requirements, design and tasks. One task = one issue. |
| Role agents | `.kiro/agents/*.json`, prompts in `.kiro/agents/prompts/` | `platform-dev`, `frontend-dev`, `data-dev`, `crypto-dev`, `qa`. Generated from `.github/agents.json` by `tools/agents/generate_agents.py`. |
| Ownership | `.github/agents.json` | Which paths each role may change. Used by agents, CI and the dispatcher. Spec 12 gave platform-dev `README.md`, `docs/video-script.md`, `docs/writeup-gaps.md`, `tools/qa/**` and `scripts/check-js-budget.mjs`. `docs/kiro-writeup.md` stays out of every role (a test checks it). |
| Check script | `scripts/check.sh` | One command for "is this OK?". Used by agents, Task Runner and CI. |
| Dispatcher | `tools/dispatcher/revenant_dispatch.py` | Crew script cron. Claims issues, starts Task Runner runs, opens PRs, runs QA, merges. The only holder of the GitHub token. |
| CI | `.github/workflows/` | `ci` (required `ci-gate`), `pr-policy`, `build` (image to GHCR). |

## Flow

```
issue: status:ready + agent:<role>, dependencies closed
  └─ dispatcher claims it: assigns, status:in-progress, starts Task Runner as <role>
       └─ run finishes: dispatcher pushes agent/<role>/issue-N, opens PR "Closes #N", label needs-qa
            └─ ci-gate green → dispatcher starts Task Runner as qa on the PR head
                 ├─ pass → status:qa-passed → dispatcher squash-merges when ci-gate is green,
                 │         then closes issue #N as completed and drops its status label
                 └─ fail (or CI failed) → status:changes-requested → fix run as <role> → back to needs-qa
                      (after 3 fix runs that committed: status:blocked, needs a human)
```

One Task Runner run at a time, across dev, fix and QA. A dev or fix run holds its issue in `status:in-progress`, and a QA run holds its PR in `status:qa-running`. The dispatcher also counts the runs Task Runner reports as still going, and uses the larger count. While any run is in flight, it starts nothing else, and a start that fails stops the tick. `REVENANT_MAX_DEV_RUNS` (default 1) is the cap on that total. Keep it at 1: runs share one Crew gateway process, and when several ran at once, commands from one run executed in another run's workspace.

## Feedback and attempts

- **CI feedback** quotes the failing job logs: each failing job's failing steps and the last lines of its log, with every `##[error]` or `FAIL` line kept. It no longer relies on the gate's "exit code 1".
- **Same commit, same failure:** if CI fails again on a commit the dispatcher already sent back, it re-runs the failed CI jobs once. If that commit still fails 10 minutes after the re-run, the PR is blocked for a human. Nothing is posted twice.
- **Closing the issue after a merge:** the dispatcher closes the issue the PR names in `Closes #N` itself, as completed, and removes `status:in-review`. GitHub's own auto-close is not relied on: it silently skipped #190 and #203, which left them open in review and held back the tickets that depend on them. If closing fails, the merge stands and a notification asks a human to close the issue.
- **GitHub hiccups:** a 5xx, 429, timeout or dropped connection never blocks an item. Reads, label changes and deletes are retried twice within the call. Anything still failing (or a comment, PR or merge, which are never sent twice) is logged, and the next tick tries again. Labels are added before old ones are removed, so a half-finished update never leaves an item without a status.
- **Fix runs that commit nothing** do not count toward the two attempts. A run that ends at the PR head gets a `dev-result` marker with `commits: false`. After CI feedback, the PR goes back to CI (and so to the re-run rule above). After QA feedback, the PR is blocked, because the same review would come back.
- **Manual ticket items** (a manual Lighthouse run, for example) are QA notes. They are minor findings and never fail a verdict.
- **Resumed runs:** after a gateway restart, Crew can resume a run under a new ID (`<id>~2`). The dispatcher follows the newest copy and reads its status. That copy must report the role's agent (for example `frontend-dev`). If it reports another agent, or none, the run is treated as failed and no PR is opened from it. Git refs always use the original ID, because the resumed copy keeps the original branch.

## One-time setup

1. **Labels:** create every label in `.github/labels.json` on the repo.
2. **Branch protection on `main`:** require the `ci-gate` and `policy` checks, require linear history, block force pushes. Allow the token owner to merge.
3. **Crew Task Runner test command** (not shown in the dashboard; set it from the CLI, then restart the gateway):
   ```bash
   kirocrew config set taskrunner.test_command '["bash", "scripts/check.sh"]'
   kirocrew restart
   ```
   Leave `taskrunner.workspace_dir` empty; the dispatcher passes a workspace per run.
4. **Install the role agents globally.** Crew's Task Runner plans each run outside the repo, where `kiro-cli` only sees `~/.kiro/agents/`. Re-run this after any change to `.github/agents.json` or the prompts:
   ```bash
   python3 tools/agents/generate_agents.py --install-global
   ```
5. **Install the dispatcher:** `python3 tools/dispatcher/revenant_dispatch.py install` copies it to `~/.kiro/crew/crons/`.
6. **Add the cron job:**
   ```bash
   kirocrew cron add revenant-dispatch "Revenant agent loop" \
     --script ~/.kiro/crew/crons/revenant_dispatch.py:run --every 300
   ```
7. **Grant the secret:** request the grant `REVENANT_GITHUB_TOKEN → github_revenant_repo` for the job, then approve it on the Schedule page. Any change to the installed script needs re-approval.

The dispatcher keeps two clones of its own under `~/kiro/revenant-crew/` (`dev`, `qa`). It never touches your working checkout.

## Hooks
Two kinds, for two places.

| Kind | Defined in | Runs when | Runs for |
|---|---|---|---|
| IDE hooks | `.kiro/hooks/*.json` | A file is saved in the Kiro IDE | You, editing by hand |
| Agent hooks | `hooks` in `.kiro/agents/<role>.json`, generated by `tools/agents/generate_agents.py` | The role agent's turn ends (`stop`) | Crew role agents, where almost all code is written |

Agent hooks (scripts in `tools/hooks/`, owner-only like `tools/agents/` and `tools/dispatcher/`):

| Role | Hook |
|---|---|
| `frontend-dev` | `stop`: `tone-check.mjs`, `scope-check.py` |
| `crypto-dev`, `data-dev`, `platform-dev` | `stop`: `scope-check.py` |
| `qa` | none |

Per-write test hooks were dropped: the Task Runner runs `scripts/check.sh` at the end of a run and CI runs everything.

**`tone-check.mjs`** checks the files changed in the run: `git diff --name-only` against the merge-base with `origin/main`, plus untracked files, limited to `src/app/**/*.tsx`, `src/components/**` and `content/personas/**`. It flags exclamation marks, judgemental change words (soared, plunged, skyrocketed, finally, cheaper, dearer, better, worse) and red/green or arrow classes on change values, from `tone.md` and `neutrality.md`.

- On hits it prints `{"decision":"block","reason":"..."}` with the `file:line` findings. kiro-cli passes the reason to the agent, which takes another turn.
- It blocks at most once per `session_id`. The marker is a file under the OS temp dir (`revenant-hooks/`), outside the repo. A second stop in the same session prints the findings and does not block.
- Errors, a missing `session_id` and garbage input never block. The script always exits 0 and writes nothing inside the repo.

**`scope-check.py --role <role>`** applies the `policy` CI rules to the files changed in the run (diff against the merge-base with `origin/main`, plus untracked files): every file must be owned by the role per `.github/agents.json`, no owner-only paths, and changed lines under `max_changed_lines`. It reuses `check_files()` from `tools/dispatcher/pr_policy.py`. Findings are per file, and it blocks at most once per `session_id`, like `tone-check.mjs`.

**Log:** every run appends one line to `~/kiro/revenant-crew/hooks.log` (UTC time, role, hook, files checked, result: `clean`, `block:N`, `report:N` or `skipped:...`). The folder is created if missing.

Not every hook output reaches the agent. In kiro-cli 2.35 the output of a `postToolUse` hook is not shown to the agent, which is why the check runs on `stop`. To change a role's hooks, edit `HOOKS` in the generator and run it again.

## Layout check

Spec 07 layout checks run as one script, not by hand. It is `tools/qa/layout-check.mjs`, started with `npm run layout-check -- --url http://localhost:<port>` against a running app with the demo personas sealed (`npm run seal-personas`), the figures fetched (`npm run fetch-figures`) and `RP_ID=localhost APP_ORIGIN=http://localhost:<port>` set, so `/demo/live` works. Without `RP_ID` every live row is a note and the summary prints a `Setup:` line saying so.
Spec 17 adds `tools/qa/layout-gate.mjs`, which runs the layout-check blockers against a built app. `scripts/check.sh` runs it as the step "layout-check (blockers)" when `CI` or `LAYOUT_CHECK=1` is set, so `ci-gate` fails on a blocker. It is skipped without those, and until the gate script exists.

- **What it walks:** the landing page, `/demo`, the Maya and Tomás personas from recall to the close, `/demo/live` (Write, Press the seal and, with a virtual passkey, the live receipts), `/l/<id>`, and the fixed-size row sets of specs 13 to 16. Stages the build doesn't have yet are notes, not failures.
- **Sizes:** the walk runs at 1366×800, 1280×800, 360×640, 390×844 and 2560×1440 by default. `--all-sizes` runs the nine sizes in `ALL_SIZES`; `--sizes` picks others. The row sets have their own fixed sizes (1440×900, 390×844, 360×640, 1055×900 and 1056×900). `--only-sizes a,b` limits every section, the walk included, to those sizes.
- **Stage groups:** `--stages landing,demo,persona,live,letter-page` limits the run to those parts of the site (see `STAGE_GROUPS` in `tools/qa/layout-scope.mjs`). Without it every group runs.
- **Dev run:** frontend-dev runs one desktop and one phone, with the groups its ticket changes: `--baseline main --quiet --only-sizes 1280x800,1440x900,390x844 --stages <groups>`. That is a few minutes. QA and the CI gate run the full matrix.
- **Baseline:** `--baseline main` marks each BLOCKER `(new)` or `(already on main)`, and the exit code and the `Result:` line count new blockers only. A blocker's identity is its check ID, row name, size, persona and stage. Main's result comes from `tools/qa/layout-baseline.mjs` (`npm run layout-baseline`), which keeps one file per distinct main content in `~/kiro/revenant-crew/layout-baseline/<key>.json`. The key is a hash of the commit's tree without the paths that cannot reach the built app (`isExcluded` in the script: `.kiro/`, `.github/`, `deploy/`, `docs/` except `.ts`/`.tsx`, `tools/agents|dispatcher|hooks`, `scripts/check.sh`), not the commit id, so spec-sync's "Tick completed spec tasks" commits reuse the file. The JSON and the log name the commit the rows were built from, and `--status` prints the key and the commit. On a miss the caller starts the build as its own detached process and waits for the file, printing a progress line with the build stage every 30 s; the build extracts the merge-base of `HEAD` and `origin/main` with `git archive`, runs `npm ci` (only when the lockfile changed) and `npm run build`, starts a throwaway Postgres and the app with `RP_ID=localhost`, runs the full check with this checkout's script, and caches the result. A first run after main changes takes several minutes. If the caller is killed or the shell tool cuts it off, the build carries on; call the same command again and it resumes the wait. One build at a time, and a second caller waits for it instead of starting another. The builder records the app's process group and the container name in `.lock/`; whoever takes over a stale lock stops that group, removes the container and deletes `*.json.tmp-<pid>` files of dead pids first. When the check script itself differs from main's (a branch that edits `tools/qa`), the file is `<key>-script-<hash>.json`. `--save-blockers <file>` and `--baseline <file>` do the same by hand. `npm run layout-baseline -- --status` says whether the current base is cached.
- **Speed:** sections run four at a time in one browser (`--jobs`, `--jobs 1` for one at a time); the output keeps the section order. A row looks for an element for 2 s before it reports "not on this build", instead of waiting out Playwright's 30 s action timeout. The 30-second live lock (`S16_LOCK_WAIT_MS`) is unchanged.
- **Output:** every line goes to `<shots>/layout-check.log`. `--quiet` prints only BLOCKER lines, "could not run" notes and the summary. The log also ends with each section's run time.
- **Blockers (fail the run, exit 1):** text or a control on the Ghost body or the Soil strip, unless it sits on an opaque paper card, which is drawn over the Ghost and reads fine; the main button of intact or the landing not fully in view at 1280×800; a main button that can't be reached, because another element covers its centre; a flow that stops, meaning a control is there and does nothing; a judgement word, an exclamation mark or red or green text in UI copy outside the persona letter; and every row a ticket's `--require` names.
- **Polish (does not fail):** everything else: 1 px drift, margins, the Top_Bar height, dust height, date wrapping, a sideways Ghost move, a main button below the fold (it must still be reachable), and paper cards over the Soil.
- **Exit codes:** 0 when there is no (new) blocker, 1 when there is at least one, 2 when the check can't start (bad arguments, the app does not answer, or no Chromium), 3 when the run did not finish (stopped by a signal, or the browser closed twice in one section).
- **Browser:** `playwright-core` (pinned to `1.64.0-alpha-1790635538000`, the Playwright MCP version) drives the Chromium at `$CHROMIUM_PATH` or `/usr/bin/chromium`. Screenshots go to `layout-check-shots/` (gitignored). Playwright's own SIGHUP and SIGTERM handlers closed the browser and left the script running, so a closed terminal or a timed-out shell call ended in "Target page, context or browser has been closed" and no summary. The script now ignores SIGHUP, stops cleanly on SIGTERM and SIGINT with a summary, and starts the browser again (and re-runs the section once) if it closes part-way.
- **Who runs it:** frontend-dev runs it on its own work before finishing, and QA runs it on every spec 07 PR. `npm test` never starts a browser.

## QA browser check

The `qa` agent (and only `qa`) has a headless Chromium through the Playwright MCP server, so it can click through UI changes instead of only reading code. It runs when a PR changes `src/app/**` or `src/components/**`. The steps are in `.kiro/agents/prompts/qa.md`.

- **Server:** `@playwright/mcp@0.0.83`, pinned exactly in `tools/agents/generate_agents.py`, started with `--headless --browser chromium --isolated`. Other roles have no MCP servers. Two tools are denied for qa: `browser_run_code_unsafe` and `browser_file_upload`.
- **Browser binary (once per machine):** `npx -y playwright-core@1.64.0-alpha-1790635538000 install chromium`. That is the Playwright version `@playwright/mcp@0.0.83` depends on; it installs to `~/.cache/ms-playwright`. Bump both together when you bump the MCP version.
- **Screenshots:** `~/kiro/revenant-crew/qa-shots/pr-<number>/`, outside the repo. That folder is the only place the browser tools may write. Auto-named snapshots and console logs land in its root.
- **App for the check:** QA builds and starts the app on a free `PORT`. If the ticket needs letters it starts a throwaway Postgres with `docker run`, runs `npm run db:migrate` and, if the branch has it, `npm run seal-personas`. It stops the app and removes the container afterwards, even on failure.
- **Findings:** browser findings go into `.qa/verdict.json`. If setup fails, that is one minor finding, never a blocker.
- **Shell rules added for qa:** `docker run*`, `docker rm*`, `docker stop*`, `kill *`, and the `npm` commands above, with `PORT=` and `DATABASE_URL=` prefixed forms. `kill *` cannot be limited to QA's own processes (rules match command text only); the prompt tells QA to kill only the PIDs it started.
- **Quirks:** kiro-cli does not expand `$HOME` in MCP `env` values, so the server is started through `sh -c`. MCP tools connect a moment after a session starts and load on demand, so the prompt tells QA to build first and retry before calling the browser unavailable.
- After changing any of this, run `python3 tools/agents/generate_agents.py --install-global` so Crew sessions pick it up.

## When something goes wrong

- **status:blocked:** read the issue and PR comments, then the run in the Crew dashboard Tasks page. Fix the ticket or the code, remove `status:blocked`, and set the right status label.- **A stuck `status:in-progress` or `status:qa-running` label, or a run Task Runner still reports:** it holds the whole queue, because only one Task Runner run is allowed at a time. Check the run in the Crew dashboard. Then set the item to `status:blocked` or fix its label, or cancel the run.
- **Re-run QA:** remove `status:qa-passed` or `status:changes-requested` and add `needs-qa`.
- **Pause everything:** pause the `revenant-dispatch` cron job.
