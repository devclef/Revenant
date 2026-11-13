# Write-up gaps (D3)

Checked on 13 November 2026 (2026-11-13T17:14Z) at `main` commit `a4f1de8901870a3059bd43c3288120d3b032b849` (`git rev-parse origin/main`, equal to local HEAD).

Commands run for this check:

- `git rev-parse HEAD`, `git rev-parse origin/main`
- `grep -n "OWNER" docs/kiro-writeup.md` and `grep -c "OWNER" docs/kiro-writeup.md`
- `grep -n "^#" docs/kiro-writeup.md`
- `grep -n "4b71564\|206\|[Ss]tatus" docs/kiro-writeup.md`
- `gh pr list --state merged --limit 1000 --json number -q length`

`docs/kiro-writeup.md` was not changed.

## OWNER comments in docs/kiro-writeup.md

Seven matches at `a4f1de8`. Each line is an unfilled OWNER note.

| Line | Section | Note |
|---|---|---|
| 5 | Header (before section 1) | Recount at the final main SHA and replace the SHA and every number in the file. |
| 17 | 2. The custom agents | Say how the three agents differed in practice. |
| 47 | 3. Hooks | One real block, with its PR or run. |
| 77 | 4. Spec-driven development compared with vibe coding | What the spec loop gave that vibe coding would not, and where vibe coding was still used. |
| 96 | 7. Property-based testing | Concrete bugs a property caught that example tests missed, with PR or commit. |
| 105 | 8. Kiro powers | Whether Kiro powers were used, and why or why not (E1.3). |
| 115 | 9. What went wrong once | Link the first Journey_Check run and the issue it opened. |

Command to re-check: `grep -n "OWNER" docs/kiro-writeup.md`.

## Stale facts

Each fact below is written in `docs/kiro-writeup.md` and does not match the current state. None of them was changed here.

### 1. Header SHA `4b71564`

- Where: line 3, "Every number below was counted at `main` commit `4b71564e7945efc9380d324bdb9165117bfa10e4`". Line 7 also says "SHA `git rev-parse origin/main`".
- Written value: `4b71564e7945efc9380d324bdb9165117bfa10e4`.
- Current value: `a4f1de8901870a3059bd43c3288120d3b032b849`.
- Command showing the current value: `git rev-parse origin/main`.
- Command showing the written value: `git rev-parse 4b71564`.

### 2. Merged pull request count `206`

- Where: line 7 ("→ 206 on 13 November 2026") and line 75 ("→ 206 on 13 November 2026").
- Written value: 206.
- Current value: 214, read at 2026-11-13T17:14Z.
- Command showing the current value: `gh pr list --state merged --limit 1000 --json number -q length`.

The 206 figure is a live GitHub count. It changes with each merge, so the write-up has to restate it at the final SHA.

### 3. Status line

- No line in `docs/kiro-writeup.md` contains the word "status". `grep -n "[Ss]tatus"` returns no matches.
- The closest lines that state a count or a point-in-time claim are line 3 (the SHA and the date), line 7 and line 75 (the 206 count and its date).
- The ticket does not say which line it means. This needs confirmation from the owner before the status line can be updated.
- Command to re-check: `grep -n "[Ss]tatus" docs/kiro-writeup.md`.

## Per-gap evidence

Every command in this section ran starting at 2026-11-13T17:15Z, in the task worktree at HEAD `2d0e23d`. `origin/main` was `a4f1de8901870a3059bd43c3288120d3b032b849` at that time, and HEAD adds only the OWNER and stale-facts commit on top of it. Every `gh` command in this section succeeded, so no gh failure needs a follow-up command.

### Recount note

Command output:

```
$ for d in .kiro/specs/*/; do echo "$d $(grep -cE '^- \[[ x]\] [0-9]+\.' $d/tasks.md)"; done
.kiro/specs/01-skeleton/ 10
.kiro/specs/02-demo-figures/ 2
.kiro/specs/02-sealed-letters/ 5
.kiro/specs/03-persona-demo/ 8
.kiro/specs/04-real-figures/ 11
.kiro/specs/05-reveal-ceremony/ 11
.kiro/specs/06-lock-and-unlock/ 12
.kiro/specs/07-judge-journey/ 11
.kiro/specs/08-judge-polish/ 22
.kiro/specs/09-demo-polish/ 24
.kiro/specs/10-own-questions/ 17
.kiro/specs/11-any-letter/ 25
.kiro/specs/12-submission-polish/ 18

$ git log --format=%s | grep -oE '^\[[a-z-]+\]' | sort | uniq -c
     13 [crypto-dev]
     22 [data-dev]
      1 [dispatcher]
    100 [frontend-dev]
     11 [owner]
     25 [platform-dev]

$ gh pr list --state merged --limit 1000 --json number -q length
214

$ git ls-files '*.property.test.*' | wc -l
53

$ ls .kiro/hooks/ | wc -l
4

$ ls .kiro/agents/*.json | wc -l
5
```

Compared with the write-up:

- The spec task counts for specs 01 to 11 match the table in section 4 of `docs/kiro-writeup.md`. The write-up does not list `12-submission-polish`, which has 18 tasks.
- The agent-tag counts differ from section 2. The write-up gives frontend-dev 95, platform-dev 24, data-dev 21, crypto-dev 13, owner 10 and dispatcher 1. The current counts are shown above. No `[qa]` tag appears in `git log`.
- The property test file count is 53. Section 7 gives 49.
- The merged pull request count is 214. Sections 4 and the stale-facts list give 206.

### Kiro surfaces note

Command output:

```
$ ls docs/agent-loop.md tools/dispatcher/
docs/agent-loop.md
tools/dispatcher/:
bootstrap.py
issues
...

$ gh pr list --state all --limit 1000 --json headRefName -q '[.[]|select(.headRefName|startswith("agent/"))]|length'
164

$ gh pr list --state all --limit 1000 --json headRefName -q '[.[]|select(.headRefName|startswith("kirocrew/"))]|length'
1

$ gh pr list --state all --limit 1000 --json headRefName -q '[.[].headRefName]|map(split("/")[0:2]|join("/"))|group_by(.)|map([.[0],length])'
[["agent/crypto-dev",13],["agent/data-dev",23],["agent/frontend-dev",103],["agent/platform-dev",25], ...]

$ ls .kiro/hooks/
agents-check-on-save.json
ceremony-truth-check.json
copy-tone-check.json
crypto-tests-on-save.json
```

- `docs/agent-loop.md` and `tools/dispatcher/` both exist.
- Pull requests from agent branches: 164 with a head branch starting `agent/` (crypto-dev 13, data-dev 23, frontend-dev 103, platform-dev 25), all states. One more, from a `kirocrew/` branch.
- The `.kiro/hooks/` directory holds 4 files, listed above.
- No evidence in git or GitHub says how the three surfaces differed in practice. This note makes no claim about that.

### Hook block note

No merged or open pull request is confirmed as a hook block by this step. Two sources were checked.

**1. Pull request text search.** Command:

```
gh pr list --state all --search 'scope-check OR tone-check in:body' --limit 100 --json number,state,url,title
```

It returned 73 pull requests. The search matches the hook names anywhere in the body, so most of them only describe a hook and do not show a block. Two bodies were read: PR #33 describes the hooks as added and says they are untested, and PR #57 says the frontend-dev stop hook "blocks once per session with the findings". Neither body names a stopped word or path. The full list with links is below.

**2. Local hook log.** Command:

```
grep -n "result=block" /home/dopey/kiro/revenant-crew/hooks.log
```

The log is on the build machine and is not in git. It holds 39 block lines: 34 from `scope-check` and 5 from `tone-check`. The first is line 242, at 2026-11-01T16:17:52.632Z, role `data-dev`, `scope-check`, `result=block:9`. The last is line 6108, at 2026-11-11T18:46:08.908Z, role `frontend-dev`, `tone-check`. Log lines carry no pull request or run number, so no block in the log is linked to a PR here. One `tone-check` block is at line 1442, at 2026-11-02T18:45:00Z, role `frontend-dev`, files `src/components/live/owner-check-pr.md` and `src/components/live/owner-check.md`, `result=block:6`. Linking that line to a PR needs the owner to match its timestamp against the PR's run log.

<details>
<summary>Pull requests whose body or title matches scope-check or tone-check (73)</summary>

- [#367](https://github.com/devclef/Revenant/pull/367) MERGED · [frontend-dev] P3 · The Testify screen says each thing once
- [#364](https://github.com/devclef/Revenant/pull/364) MERGED · [frontend-dev] X3 · The Reveal shows one honest now line, and "Check your connection" retires
- [#154](https://github.com/devclef/Revenant/pull/154) MERGED · [frontend-dev] Seal_Page part 2a: Sealing_Flow with the two presses, failure screens, sealed state and countdown
- [#378](https://github.com/devclef/Revenant/pull/378) MERGED · [frontend-dev] L4 · A 30-second demo that says it is a rehearsal
- [#373](https://github.com/devclef/Revenant/pull/373) MERGED · [frontend-dev] P5 · Receipts at one precision, with a short name
- [#33](https://github.com/devclef/Revenant/pull/33) MERGED · Add Kiro hooks for tone check, crypto tests and agents check
- [#372](https://github.com/devclef/Revenant/pull/372) MERGED · [frontend-dev] L5 · A reveal with no figures is a complete ending
- [#57](https://github.com/devclef/Revenant/pull/57) MERGED · Agent hooks: tone check on stop
- [#377](https://github.com/devclef/Revenant/pull/377) MERGED · [frontend-dev] H1 · Landing sections for the general letter, the static Coven_Strip, and SampleReceipt deleted
- [#370](https://github.com/devclef/Revenant/pull/370) MERGED · [frontend-dev] L2 · Occasions
- [#325](https://github.com/devclef/Revenant/pull/325) MERGED · [frontend-dev] C6 · Break the seal at the Ghost (#306)
- [#381](https://github.com/devclef/Revenant/pull/381) MERGED · [owner] H3, H4 · README and write-up patches
- [#374](https://github.com/devclef/Revenant/pull/374) MERGED · [frontend-dev] P1 · The Text_Persona: schema, content, the reading path and the Demo_Index
- [#408](https://github.com/devclef/Revenant/pull/408) MERGED · [frontend-dev] W1, W2 and W4 · Letter_Field, Occasion chips, one-sentence rehearsal
- [#380](https://github.com/devclef/Revenant/pull/380) MERGED · [platform-dev] H1 · Render the sections on `/`, and fail on an unimported landing component
- [#376](https://github.com/devclef/Revenant/pull/376) MERGED · [frontend-dev] H2 · Brand_Copy describes any letter
- [#242](https://github.com/devclef/Revenant/pull/242) MERGED · Dispatcher: fewer human blocks (Task Runner retries, shared tests, QA re-check, QA seeding)
- [#289](https://github.com/devclef/Revenant/pull/289) MERGED · [frontend-dev] L6 to L9 · The paper holds only the letter, lit by the shaft, with real creases; the attic theme leaves the components
- [#290](https://github.com/devclef/Revenant/pull/290) MERGED · Finish task 18: drop the stray serif from the envelope status text
- [#295](https://github.com/devclef/Revenant/pull/295) MERGED · [frontend-dev] D1 · The Scene and the Ghost in the live demo
- [#407](https://github.com/devclef/Revenant/pull/407) MERGED · [platform-dev] Q1 and Q2 · Live_Walk setup
- [#371](https://github.com/devclef/Revenant/pull/371) MERGED · [frontend-dev] L3 · A Write step that fits one screen
- [#294](https://github.com/devclef/Revenant/pull/294) MERGED · [frontend-dev] D3 · Prompt starters on the Write step
- [#362](https://github.com/devclef/Revenant/pull/362) MERGED · [data-dev] X3 · The server falls back on a failed read or shape step
- [#363](https://github.com/devclef/Revenant/pull/363) MERGED · [frontend-dev] X5 · The `marks` controls are visible, reachable and still
- [#331](https://github.com/devclef/Revenant/pull/331) MERGED · [frontend-dev] E1 · Promise audit, no trace of the retired persona IDs, and the presentation patches
- [#369](https://github.com/devclef/Revenant/pull/369) MERGED · [frontend-dev] P4 · The first lines of the letter are in view
- [#184](https://github.com/devclef/Revenant/pull/184) MERGED · Dispatcher: tell agents and QA the role's paths; quote why a run failed
- [#291](https://github.com/devclef/Revenant/pull/291) MERGED · Delete the retired tokens and add the type/palette guards (task 19)
- [#368](https://github.com/devclef/Revenant/pull/368) MERGED · [frontend-dev] L1 · A letter seals with no figures: the single rule, the Receipts_Disclosure and five steps
- [#69](https://github.com/devclef/Revenant/pull/69) MERGED · [frontend-dev] Persona route, opening flow, recall step and reveal shell
- [#113](https://github.com/devclef/Revenant/pull/113) MERGED · [data-dev] The committed Real_File and its checks
- [#402](https://github.com/devclef/Revenant/pull/402) MERGED · [frontend-dev] X1 and X2 · Reveal_Host, full-width dark reveal and one motion control
- [#231](https://github.com/devclef/Revenant/pull/231) MERGED · [frontend-dev] One letter-date module, labels by letter kind, and the Fingerprint on the card and at opening
- [#276](https://github.com/devclef/Revenant/pull/276) MERGED · [frontend-dev] A8, A12, A13 · Controls that fit, focus rings only for the keyboard, and the recall field's name
- [#287](https://github.com/devclef/Revenant/pull/287) MERGED · [frontend-dev] C3, C8, P6, P7 · The Receipt_Card, the marks card and Answer_List, the EU per-litre display, and the reveal on the phone
- [#187](https://github.com/devclef/Revenant/pull/187) MERGED · [frontend-dev] Whole-journey review
- [#241](https://github.com/devclef/Revenant/pull/241) MERGED · [frontend-dev] The Reveal and the Seal_Page read the Figures_API
- [#145](https://github.com/devclef/Revenant/pull/145) MERGED · [crypto-dev] Integration test of the whole server and crypto path
- [#40](https://github.com/devclef/Revenant/pull/40) MERGED · [crypto-dev] Crypto: backup key, demo key, seal, open and opening records
- [#151](https://github.com/devclef/Revenant/pull/151) MERGED · [frontend-dev] Close, Skip across sequences and the accessibility review
- [#105](https://github.com/devclef/Revenant/pull/105) MERGED · [data-dev] Oil Bulletin adapter and its recorded excerpts
- [#162](https://github.com/devclef/Revenant/pull/162) MERGED · [frontend-dev] Backup key card, #k= fragment and optional backup key beside the passkey (optional)
- [#59](https://github.com/devclef/Revenant/pull/59) MERGED · [data-dev] Change calculator, exact decimals and change display formatting
- [#106](https://github.com/devclef/Revenant/pull/106) MERGED · [data-dev] Append-only refresh logic: merge, backfill refusal, serialisation
- [#122](https://github.com/devclef/Revenant/pull/122) MERGED · [frontend-dev] Letter ink
- [#326](https://github.com/devclef/Revenant/pull/326) MERGED · [frontend-dev] C7 · The other Stages: the Ghost clear of text, controls next to what they act on, no empty cards
- [#375](https://github.com/devclef/Revenant/pull/375) MERGED · [crypto-dev] P1 · Seal a persona with no metrics
- [#56](https://github.com/devclef/Revenant/pull/56) MERGED · [data-dev] US fuel fixture and the then/now helper
- [#358](https://github.com/devclef/Revenant/pull/358) MERGED · [platform-dev] W1 · Walk the live path on a real build and record the findings
- [#107](https://github.com/devclef/Revenant/pull/107) MERGED · [frontend-dev] Scene base on the persona page
- [#22](https://github.com/devclef/Revenant/pull/22) MERGED · [platform-dev] Add the Helm chart: web app, Service, Ingress, ConfigMap
- [#2](https://github.com/devclef/Revenant/pull/2) MERGED · [platform-dev] Scaffold the Next.js app with a placeholder landing page
- [#327](https://github.com/devclef/Revenant/pull/327) MERGED · [frontend-dev] C8 · The Author_Testimony above the letter, and the Reveal for a letter with no figures
- [#152](https://github.com/devclef/Revenant/pull/152) MERGED · [frontend-dev] Sound and vibration (optional)
- [#280](https://github.com/devclef/Revenant/pull/280) MERGED · [platform-dev] B1, B2 · The landing page above the fold
- [#117](https://github.com/devclef/Revenant/pull/117) MERGED · [frontend-dev] Maya moves to the catalogue metrics
- [#296](https://github.com/devclef/Revenant/pull/296) MERGED · [frontend-dev] E1 · Final promise audit, and the README, write-up and video script patches
- [#87](https://github.com/devclef/Revenant/pull/87) MERGED · [frontend-dev] Reveal: letter view, figures then vs now, fixture labels
- [#118](https://github.com/devclef/Revenant/pull/118) MERGED · [frontend-dev] Passage, counter and the then-and-now steps
- [#238](https://github.com/devclef/Revenant/pull/238) MERGED · [frontend-dev] Promise audit, the regions search test, and the README, write-up and steering patches
- [#179](https://github.com/devclef/Revenant/pull/179) MERGED · [frontend-dev] Seal_Break, the Ghost leaving and the letter
- [#277](https://github.com/devclef/Revenant/pull/277) MERGED · [frontend-dev] A9, A10 · Named, spaced recorded scales, one answer format, and even ticks
- [#159](https://github.com/devclef/Revenant/pull/159) MERGED · [frontend-dev] Live_Letter reveal variant
- [#288](https://github.com/devclef/Revenant/pull/288) MERGED · [frontend-dev] C4, C6, C7, P8 · One action at the climax, sound in the Top_Bar, one disclosure at the letter, the seal verdict, the closing line, and the seal by touch
- [#282](https://github.com/devclef/Revenant/pull/282) MERGED · [frontend-dev] L4, L5 · One WaxSeal, and the demo letters as sealed envelopes
- [#237](https://github.com/devclef/Revenant/pull/237) MERGED · [platform-dev] The footer on every page and the landing links
- [#120](https://github.com/devclef/Revenant/pull/120) MERGED · [frontend-dev] Reveal stages readable on the desk
- [#175](https://github.com/devclef/Revenant/pull/175) MERGED · [frontend-dev] Scene_Frame, Ghost and the Emergence on the persona page
- [#121](https://github.com/devclef/Revenant/pull/121) CLOSED · [data-dev] `DEMO_FIGURES` drops the fixture and the no-fixture checks
- [#283](https://github.com/devclef/Revenant/pull/283) MERGED · [frontend-dev] C1, P5 · The persona first screen: Persona_Intro, Maya's opening event, the Compact_Top_Bar and a two-line headline
- [#183](https://github.com/devclef/Revenant/pull/183) MERGED · [platform-dev] The landing page `/` (#169)
- [#228](https://github.com/devclef/Revenant/pull/228) MERGED · [data-dev] The Fetch_Job, its tables, the Figures_API database mode, and the Freshness_Check script

</details>

### Spec loop versus vibe coding note

Command: `git log --no-merges --format='%h %s'`, with commits carrying an agent tag (`[crypto-dev]`, `[data-dev]`, `[frontend-dev]`, `[platform-dev]`, `[owner]`, `[dispatcher]`, `[qa]`) and commits whose subject contains "Tick completed" removed. 104 commits remain. The filter does not remove owner or setup commits such as `init spec 12`, so the list is wider than the work done outside a spec task. Nothing in the list says whether a commit came from a spec. The full list is below.

Pull request link found for a spec task, from the write-up's own pointer: [PR #380](https://github.com/devclef/Revenant/pull/380), which `gh pr view 380 --json url` returns. The link from `.kiro/specs/11-any-letter/tasks.md` task 22 to that PR was not checked in this step.

<details>
<summary>Commits with no agent tag and no "Tick completed" subject (104)</summary>

- `2d0e23d` docs: OWNER comment list and stale-facts section for writeup gaps (D3.1)
- `91dffa9` init spec 12
- `09705da` S1 · Steering for the general letter and optional receipts (spec 11 task 1)
- `9db7ef2` init spec 11
- `1985bf6` Spec 10 task 1: steering, copy checks and layout checks
- `36fbb47` Spec 09 owner patches n, o, t, u, v; spec 10 tasks 3 and 17 updates
- `1b28a81` Spec 10 tasks
- `6bec15f` Delete the retired tokens and add the type/palette guards (task 19) (#291)
- `43853c8` Drop the stray serif from the envelope status text (#290)
- `5981b0d` docs: remove design concept image from README
- `83f47d9` docs: add README hero image
- `535b7c7` fix(landing): code-split figures parser out of / first-load bundle (#284)
- `8e17c90` qa prompt: list only opened screenshots in spec 09 verdicts
- `2f8713e` Spec 09 owner patch q: layout-check spec 09 checks and walk
- `e4c9d2c` Spec 09 owner patches r, w, x and y
- `fd411fb` Spec 09: demo polish spec and tasks
- `bf81069` Dispatcher: fewer human blocks (Task Runner retries, shared tests, QA re-check, QA seeding) (#242)
- `a0842c4` Dispatcher: copy commit-message notes into the PR body, show QA the PR body, pass no-op fix runs (#240)
- `d3793e4` Dispatcher: close the linked issue after merging, instead of relying on GitHub auto-close (#229)
- `c245067` Feature the demo links and add an agent loop diagram to the README
- `89d27d7` Reframe README around resurrecting the wax seal
- `2ebc7b2` Keep fetch-figures script sources in the Docker build context
- `4e1dc80` Let migration-adding roles co-own the integration tests
- `0aa66b8` Keep generated script bundles out of git and the PR size limit
- `eba2bc0` Pitch Revenant as a sealed witness against your own memory
- `3f7d3f2` Fix the FIGURES_SOURCE comment in .env.example (#227)
- `5c6e84f` Dispatcher: retry transient GitHub errors instead of blocking for a human (#226)
- `5bd2b60` Tell agents to restore stray out-of-path files, never delete them (#224)
- `c4eb9e8` Commit the Next 16 next-env.d.ts and fail CI when the build rewrites it (#223)
- `49f23b2` Upgrade next to 16.4.5 and make the JS budget check read Next 16 output (#218)
- `ee0fb61` Derive period expectations in two property tests from formatPeriod (#221)
- `59ec3be` Fix soil ceiling float check and RecallScale tick overlap (#216)
- `033b995` Spec 08: judge polish spec and tasks
- `bbc8e35` Spec 08 owner patch a (layout-check) and README regions
- `7978383` Dispatcher: tell agents and QA the role's paths; quote why a run failed; fix-reset marker (#184)
- `828d04e` Soil_Canvas: narrow intact seal card sits below the Soil strip (#165)
- `12a64b3` QA prompt: an unfinished browser walk is a minor finding, not a blocker
- `c20e3aa` dispatcher: follow Crew's resumed runs and fail a copy that resumed as the wrong agent (#155)
- `a2e41b1` dispatcher: quote failing CI logs, don't count empty fix runs, manual items are QA notes (#146)
- `33025ab` dispatcher: stop the tick on a failed start, count live Task Runner runs (#142)
- `1b5f997` dispatcher: one Task Runner run at a time, across dev, fix and QA (#141)
- `98d14a8` Skip JS budget for routes whose page is not built yet (#138)
- `7b02ec8` Owner follow-ups for spec 06
- `9c20b1a` spec 04: add task 11 so reveal tests stop reading the fixture through DEMO_FIGURES (#123)
- `b5fd3f4` dispatcher: frontend-dev specs carry the browser check in the last step
- `6acc0e3` qa prompt: pre-existing visual problems are minor findings
- `35f33a9` QA: fixed screenshot set, per-shot visual checks, structured screenshots verdict enforced by parse_verdict
- `eaca6a5` All role agents use claude-haiku-5.5
- `088a628` frontend-dev uses claude-haiku-5.5
- `3b5f17a` generate_agents: optional per-role MODELS map; data-dev on claude-haiku-5.5
- `3a00379` dispatcher: strip Validation section from quoted tickets, drop it from new issues, add step wording
- `17eba02` Add scope-check stop hook for dev roles; split check_files out of pr_policy.evaluate
- `7402017` agent prompts: targeted checks while working, QA skips check.sh, frontend look-at-work in last step
- `eb0a81f` dispatcher: add Steps section to dev spec, drop check.sh from QA spec
- `d0b6f61` frontend-dev looks at its work; surface text colour rule; desk fixes in task 3; path errors go back to the agent (#112)
- `ddcb69f` Update agents.json to adjust size limits and exclusions
- `ae125ea` Desk styles ship; one Calm control; QA checks its screenshots (#110)
- `35355d2` Dispatcher: clean shared clones, claim after checkout, per-item errors, policy feedback (#108)
- `8083188` step 1: Use formatUtcDate for the retrieved date in FigureLine.tsx (#94)
- `1ef7cc3` Spec 05 design and tasks; QA prompt: card open link (#93)
- `4811f87` Dispatcher: one QA run at a time, clear stale verdict (#90)
- `9b7b273` Spec 05 requirements; spec 03 seal wording and R9.3; JS budget check (#89)
- `572211f` Update concept image in README, add 2x version (#86)
- `6e2df94` Run Postgres integration test files one at a time (#85)
- `44f218c` Spec 04: real figures (requirements, design, tasks); spec 03 task 8 fixture note (#74)
- `c24099d` Reveal views, styles and flow property test (part 2 of #48) (#73)
- `39154cf` Reveal flow logic: state machine, API client, copy (part 1 of #48) (#72)
- `c26a666` Let seal-personas sources into the Docker build context (#68)
- `9c6de23` QA browser check: Playwright MCP for the qa agent (#61)
- `2923b41` Add README with concept image
- `1039ba3` Agent hooks: tone check on stop for frontend-dev, hook log (#57)
- `51eb06c` Dispatcher: allow 3 dev runs at once (one per role) (#51)
- `b6dabb2` Spec 03 persona demo (#41)
- `8e03d8b` Spec 02 demo figures design and tasks (#37)
- `e9ce186` Export figure and metric schemas from seal-format (spec 02 task 1) (#36)
- `2479c46` Spec 02 demo figures requirements, seal-format schema exports, fixture rule
- `b6f7815` Add Kiro hooks for tone check, crypto tests and agents check (#33)
- `a651602` Spec 02 sealed letters, owner setup and build order
- `8a5ab00` Derive oversize test from configured PR line limit
- `179ab69` Raise PR size limit to 2000 changed lines
- `28e91d8` ci: publish a moving :dev image tag from main
- `cc98169` ci: re-trigger policy check
- `8e5b7a4` dispatch: auto-sync global agents from repo each tick
- `f2bc823` ci(policy): grant platform-dev src/lib helpers + test files
- `2fb9719` step 5: Re-trigger CI with a fresh commit if the tree is already green
- `b8d1e01` step 6: Run the production build and verify no CSP console errors in next start
- `3ced693` step 4: Add a middleware behaviour test for nonce and HSTS
- `a084830` step 3: Add unit test asserting header values from the header helper
- `1874512` step 2: Create src/middleware.ts applying headers with a per-request nonce
- `5e15795` step 1: Add CSP/header constants and nonce helper to next.config.ts
- `f64a1eb` Auto-open issues for every spec task; QA reviews only the current head, in one step, and reads its verdict reliably
- `b5d79ed` Ownership: platform-dev owns src/lib/version.test.ts
- `332f26c` check.sh: don't write .pyc files
- `e0d0c1d` Agent prompt: keep outputFileTracingRoot pinned (resolves conflict with pilot ticket)
- `acc05c7` Pilot ticket: single lockfile, pinned tracing root, one ESLint config
- `2b6c624` Agents: stay inside the worktree, pin Next.js tracing root, report outside conflicts
- `fc88b8b` check.sh: use npm install when no lockfile exists yet; require lockfile in CI
- `8456d8e` Make role agents loadable by Crew's bundled kiro-cli-chat 2.27 (add allowedTools)
- `1cc7206` Install role agents globally for Crew Task Runner planning
- `4839fc0` docs: use full script path for cron add
- `0dd4b71` docs: set Task Runner test command via CLI
- `4d1ca44` Add agent loop: 01-skeleton spec, role agents, CI, PR policy, Crew dispatcher
- `e68d490` Add Revenant steering docs (product, tech, structure, data integrity, neutrality, tone, crypto, deploy)
- `6b16257` Initial commit

</details>

### Property test note

Command: `git log -i --grep=property --format='%h %s'` returns 75 commits. The match is case-insensitive over the whole message, so it includes commits whose body only mentions a property test. The full list is below.

Candidates from the write-up's own pointers, with what their messages say. Nothing here says which commit caught a bug. That is for the author to decide.

- `6b05a9c` (PR [#331](https://github.com/devclef/Revenant/pull/331)). The commit body says: "This broke the 'never above the ceiling' property in soil-canvas.test.ts, which failed intermittently in check.sh (1e-9 tolerance, random fast-check seeds)." The body describes a failing property and a code change to `clodPoint`.
- `914b15b` (PR [#56](https://github.com/devclef/Revenant/pull/56)). The commit body lists "fast-check property tests (Properties 1, 2, 5-9)". The body does not name a failure or a bug.

Property test files on disk: 53 (`git ls-files '*.property.test.*' | wc -l`). Re-run command from the write-up: `npx vitest run src/lib/figures/then-now.property.test.ts`. That file exists in this worktree.

<details>
<summary>Commits whose message mentions "property" (75)</summary>

- `ddc79e9` [frontend-dev] W1, W2 and W4 · Letter_Field, Occasion chips, one-sentence rehearsal (#408)
- `3febd45` [frontend-dev] Z2 · The Single_Figure_View (#406)
- `fa25934` [frontend-dev] X4 · The stepper says "Break the seal" until the seal is broken (#405)
- `f611aab` [data-dev] Z1 · `isSameFigure` (#403)
- `4e616a3` [frontend-dev] L4 · A 30-second demo that says it is a rehearsal (#378)
- `a6473a0` [frontend-dev] L3 · A Write step that fits one screen (#371)
- `75b2239` [frontend-dev] H2 · Brand_Copy describes any letter (#376)
- `82c1efc` [frontend-dev] P1 · The Text_Persona: schema, content, the reading path and the Demo_Index (#374)
- `0250c65` [frontend-dev] P5 · Receipts at one precision, with a short name (#373)
- `b33fc3f` [frontend-dev] L5 · A reveal with no figures is a complete ending (#372)
- `fc1a8fb` [frontend-dev] L2 · Occasions (#370)
- `970a465` [frontend-dev] L1 · A letter seals with no figures: the single rule, the Receipts_Disclosure and five steps (#368)
- `e0adddf` [frontend-dev] P2 · A prefilled sample answer never equals the record (#365)
- `3f9c354` [frontend-dev] X3 · The Reveal shows one honest now line, and "Check your connection" retires (#364)
- `156cdab` [frontend-dev] X5 · The `marks` controls are visible, reachable and still (#363)
- `99441c7` [data-dev] X3 · The server falls back on a failed read or shape step (#362)
- `f891efd` [frontend-dev] X2 · Sealing, waiting, testifying and reading never wait on `/api/figures` (#360)
- `35d584e` [data-dev] X1 · Figures failure: harness, evidence, the fix the data names, and invalid-row skipping (#359)
- `6b05a9c` [frontend-dev] E1 · Promise audit, no trace of the retired persona IDs, and the presentation patches (#331)
- `49b1a40` [frontend-dev] P1, P2 · Persona letters that carry the price, and new letter IDs (#307) (#328)
- `a27d88b` [frontend-dev] R1 · Self-reported numbers on the Write step and in the Reveal (spec 08 later-tasks task 23, moved in) (#330)
- `776f618` [frontend-dev] C6 · Break the seal at the Ghost (#306) (#325)
- `b3c683d` [frontend-dev] C5 · Sample answers for the persona figure questions (#324)
- `918652f` [frontend-dev] C2 · Author_Question rows on the Write step, sealing them, and the `/seal` figure minimum (#323)
- `4554a04` [frontend-dev] C1 · No pick-up Stage: one path to Testify, the focus table, the held Envelope and the Testify_Context (#319)
- `3692586` [frontend-dev] X1, X2, X3 · The Then_Tick on the axis, the phone persona start, and the Step_Indicator row (#315)
- `3ed0845` [platform-dev] S2, S3 · `textOutsideUserContent`, its property, and the copy-test exclusion in the retired-phrases test (#314)
- `db8e29e` [frontend-dev] D2, D4 to D7, P10 · The Live_Stepper, figure values in the picker, unlock in place, the backup key up front, and the live demo on the phone (#293)
- `20f4375` [frontend-dev] C3, C8, P6, P7 · The Receipt_Card, the marks card and Answer_List, the EU per-litre display, and the reveal on the phone (#287)
- `08e6e7f` [data-dev] C8 · Display rescale keyed on the sealed unit (#286)
- `54b3d22` [frontend-dev] L4, L5 · One WaxSeal, and the demo letters as sealed envelopes (#282)
- `a36c6ad` [frontend-dev] A9, A10 · Named, spaced recorded scales, one answer format, and even ticks (#277)
- `486252c` [frontend-dev] A3, A4, A7 · Honest now messages, "Your answer" on every Figure_Entry, and the picker's empty state (#274)
- `c6e1600` [data-dev] A1 · Fallback figures in the Figures_API, a wait for the schema, and one fetch run at a time (#272)
- `832923b` [crypto-dev] The 3-calendar-month rule, real letter drafts and the real seal routes (#246)
- `237632f` [platform-dev] The real sealing flag, its chart values, and the landing link behind it (#245)
- `8f217dd` [crypto-dev] FIXTURE guard in persona sealing, and the Postgres tests for the EU persona and the figures tables (#244)
- `714b71d` [frontend-dev] Top_Bar on every page, a way back from `/demo/live`, the PRF_Hint, the backup key path and the picker maximum (#233)
- `0d5b223` [data-dev] The Fetch_Job, its tables, the Figures_API database mode, and the Freshness_Check script (#228)
- `609382f` [data-dev] The Figures_API in file mode, fetch status, a fallback-ready prefetch, and the local now pick (#225)
- `ee0fb61` Derive period expectations in two property tests from formatPeriod (#221)
- `05de647` [frontend-dev] Figure_Entry at equal weight, one "Your answer", Number_Line labels (#219)
- `6c5adc8` [frontend-dev] Whole-journey review (#187)
- `8b25284` [frontend-dev] `/demo/live` and `/l/[id]` restyle, desk retired (#186)
- `475ae09` [frontend-dev] Scene tokens, contrast test and measured budgets (#174)
- `b22bf29` [frontend-dev] Backup key card, #k= fragment and optional backup key beside the passkey (optional) (#162)
- `2889e7c` [frontend-dev] Letter card with QR encoder, and .ics file (optional) (#161)
- `22fdce7` [frontend-dev] Seal_Page part 1: page, write step, figure picker, recall subjects, payload builder, Demo_Index entry (#153)
- `21a5de6` [frontend-dev] Close, Skip across sequences and the accessibility review (#151)
- `bdc1d98` [frontend-dev] Reveal and ceremony tests load the fixture themselves (#125)
- `3420fbd` [crypto-dev] Authenticator_Port, Passkey_Module, fake, and passkey support in sealLetter and openLetter (#143)
- `c2b2d78` [data-dev] Same-figure change option in computeChange (prerequisite for task 9) (#144)
- `e959335` [crypto-dev] Migration, schema, letter store, Prepare_Route and Seal_Route (#139)
- `acb5529` [frontend-dev] Letter ink (#122)
- `73ac1bb` [frontend-dev] Passage, counter and the then-and-now steps (#118)
- `877b53c` [frontend-dev] Number lines, stamps and the extended neutrality test (#116)
- `68e494f` [data-dev] `DEMO_FIGURES` loads the real figures and the fixture together (#115)
- `9155db2` [frontend-dev] Seal_Break and the marks Stage (#114)
- `305b827` [frontend-dev] Envelope, checking views and the card and loading wording (#111)
- `01f74d9` [frontend-dev] Scene base on the persona page (#107)
- `7d224b6` [data-dev] Append-only refresh logic: merge, backfill refusal, serialisation (#106)
- `9d20542` [data-dev] Oil Bulletin adapter and its recorded excerpts (#105)
- `d9d9462` [data-dev] EIA adapter and its recorded excerpts (#91)
- `2253e50` [frontend-dev] Reveal: letter view, figures then vs now, fixture labels (#87)
- `ff46495` [data-dev] Shared source modules and the `@e965/xlsx` devDependency (#88)
- `d376645` [frontend-dev] Persona route, opening flow, recall step and reveal shell (#69)
- `c24099d` Reveal views, styles and flow property test (part 2 of #48) (#73)
- `341ef27` [frontend-dev] Demo index, persona cards, demo label and landing link (#62)
- `941c272` [data-dev] Change calculator, exact decimals and change display formatting (#59)
- `6c4f891` [frontend-dev] Persona list, Maya's letter and persona validation (#58)
- `914b15b` [data-dev] US fuel fixture and the then/now helper (#56)
- `3f913b7` [crypto-dev] Routes: read a letter, release its server secret, record recall answers (#54)
- `268c5cb` [frontend-dev] Recall question generator and recall record schema (#52)
- `2973223` [crypto-dev] Migration, Drizzle schema and the persona store function (#50)
- `fa6d077` [crypto-dev] Seal format: payload v1, header v1, canonical JSON and envelope hash (#35)

</details>

### Kiro powers note

Commands and output:

```
$ ls ~/.kiro/powers
installed.json  registries  registry.json  registry.json.v1.backup

$ cat ~/.kiro/powers/installed.json
{
  "version": "1.0.0",
  "installedPowers": [],
  "dismissedAutoInstalls": []
}

$ ls -la ~/.kiro/powers/registries
total 8   (only . and .. entries)

$ ls .kiro/
agents  hooks  settings  specs  steering

$ grep -rIn -i "kiro power\|powers/\|power:" .kiro .github
(matches only in spec prose, see below)
```

- `installed.json` lists zero installed powers.
- Nothing in `.kiro/agents`, `.kiro/hooks`, `.kiro/steering` or `.github` names a power. The grep matches are spec sentences that ask whether powers were used: `.kiro/specs/11-any-letter/requirements.md:564`, `.kiro/specs/09-demo-polish/requirements.md:841` and `.kiro/specs/09-demo-polish/design.md:959`.
- Result: none found. This note covers this machine only. The write-up asks the owner to check the IDE on the owner's machine too, which this step cannot reach.

### What went wrong once

Command: `gh run list --workflow journey-check.yml --limit 100 --json databaseId,createdAt,conclusion,url`

It returned 10 runs, all with conclusion `failure`. The earliest is the first Journey_Check run:

- [Run 42530503661](https://github.com/devclef/Revenant/actions/runs/42530503661), 2026-11-08T22:29:44Z, conclusion `failure`. This matches the write-up.
- The most recent is [run 43385089882](https://github.com/devclef/Revenant/actions/runs/43385089882), 2026-11-13T07:20:46Z.

Command: `gh issue list --label journey:failure --state all --json number,title,url,state,createdAt`

It returned one issue:

- [Issue #318](https://github.com/devclef/Revenant/issues/318), "Journey check: failure", state `OPEN`, created 2026-11-08T22:31:46Z. This matches the write-up.

The write-up links only the first run. The nine later failed runs have no issue of their own in this list.
