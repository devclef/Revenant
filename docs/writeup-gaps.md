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

Added by the next step of this ticket.
