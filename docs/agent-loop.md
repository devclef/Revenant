# The Revenant agent loop

Revenant is built by role agents run by [Kiro Crew](https://kiro.dev/docs/crew.md). This page is the runbook.

## Pieces

| Piece | Where | Job |
|---|---|---|
| Specs | `.kiro/specs/NN-name/` | Requirements, design and tasks. One task = one issue. |
| Role agents | `.kiro/agents/*.json`, prompts in `.kiro/agents/prompts/` | `platform-dev`, `frontend-dev`, `data-dev`, `crypto-dev`, `qa`. Generated from `.github/agents.json` by `tools/agents/generate_agents.py`. |
| Ownership | `.github/agents.json` | Which paths each role may change. Used by agents, CI and the dispatcher. |
| Check script | `scripts/check.sh` | One command for "is this OK?". Used by agents, Task Runner and CI. |
| Dispatcher | `tools/dispatcher/revenant_dispatch.py` | Crew script cron. Claims issues, starts Task Runner runs, opens PRs, runs QA, merges. The only holder of the GitHub token. |
| CI | `.github/workflows/` | `ci` (required `ci-gate`), `pr-policy`, `build` (image to GHCR). |

## Flow

```
issue: status:ready + agent:<role>, dependencies closed
  └─ dispatcher claims it: assigns, status:in-progress, starts Task Runner as <role>
       └─ run finishes: dispatcher pushes agent/<role>/issue-N, opens PR "Closes #N", label needs-qa
            └─ ci-gate green → dispatcher starts Task Runner as qa on the PR head
                 ├─ pass → status:qa-passed → dispatcher squash-merges when ci-gate is green
                 └─ fail (or CI failed) → status:changes-requested → fix run as <role> → back to needs-qa
                      (after 2 fix runs: status:blocked, needs a human)
```

One run per role at a time, and `REVENANT_MAX_DEV_RUNS` (default 1) runs in total during the pilot.

## One-time setup

1. **Labels:** create every label in `.github/labels.json` on the repo.
2. **Branch protection on `main`:** require the `ci-gate` and `policy` checks, require linear history, block force pushes. Allow the token owner to merge.
3. **Crew Task Runner test command** (not shown in the dashboard; set it from the CLI, then restart the gateway):
   ```bash
   kirocrew config set taskrunner.test_command '["bash", "scripts/check.sh"]'
   kirocrew restart
   ```
   Leave `taskrunner.workspace_dir` empty; the dispatcher passes a workspace per run.
4. **Install the dispatcher:** `python3 tools/dispatcher/revenant_dispatch.py install` copies it to `~/.kiro/crew/crons/`.
5. **Add the cron job:**
   ```bash
   kirocrew cron add revenant-dispatch "Revenant agent loop" \
     --script ~/.kiro/crew/crons/revenant_dispatch.py:run --every 300
   ```
6. **Grant the secret:** request the grant `REVENANT_GITHUB_TOKEN → github_revenant_repo` for the job, then approve it on the Schedule page. Any change to the installed script needs re-approval.

The dispatcher keeps two clones of its own under `~/kiro/revenant-crew/` (`dev`, `qa`). It never touches your working checkout.

## When something goes wrong

- **status:blocked:** read the issue and PR comments, then the run in the Crew dashboard Tasks page. Fix the ticket or the code, remove `status:blocked`, and set the right status label.
- **Re-run QA:** remove `status:qa-passed` or `status:changes-requested` and add `needs-qa`.
- **Pause everything:** pause the `revenant-dispatch` cron job.
