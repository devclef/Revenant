# Later tasks: 08 Judge polish

The owner moves task 23 into `tasks.md` only if there is time before 27 November 2026, and task 24 after the 20 November 2026 decision and the freeze.

Spec-sync reads only `tasks.md`, so nothing here opens an issue until it is moved. Every rule of `tasks.md` "Rules for every task" applies to these tasks. When a task moves, copy it whole, keep its number, and add it to the `tasks.md` Overview, Notes and dependency graph. Every number in its "Depends on" field must be a task in `tasks.md`; a condition goes on its own line with no digits, because spec-sync reads every number in that field as a dependency.

### Group 7: self-reported numbers (if time allows) and the final audit

- [ ] 23. Self-reported numbers (ships only if time allows)
  - Group 7. All of the work is the one optional sub-task below. The dispatcher cannot skip a task, so the owner moves task 23 into `tasks.md` only if there is time before 27 November 2026. If 23.1 does not merge by 27 November 2026, its issue is closed unmerged, this task is closed with it, and task 24 confirms nothing mentions self-reported numbers (R26.7).
  - [ ]* 23.1 Self-reported rows, the sealed payload and the Reveal group
    - Agent: `frontend-dev` · Depends on: 22 · Estimated size: ~1,500 changed lines
    - Dependency note: if real sealing is dropped, the Real_Seal_Page issue is closed unmerged, and a closed issue also satisfies this dependency.
    - Before this task: task 22 is on `main`, or closed unmerged after a no-go. Ships only if merged by 27 November 2026; otherwise the issue is closed and task 24 confirms nothing mentions self-reported numbers (R26.7).
    - Scope: `src/components/live/SelfReportedRows.tsx` (new), `live/WriteForm.tsx`, `live/write-draft.ts`, `live/build-payload.ts`, `live/copy.ts`, `live/live.module.css`, `src/components/reveal/FiguresThenNow.tsx`, `reveal/copy.ts` (`selfReportedTitle`), `src/components/ceremony/scene/copy.ts` (landing wording, only as R26.5 allows), and the `*.test.ts(x)` for each file above
    - Design sections: "Self-reported numbers (if time allows)", "Copy" (`selfReportedTitle`, `labelSelfReported`).
    - Acceptance:
      - The Write step offers a "Your own numbers" group of 0 to 10 rows, each with name, value (0 to 999,999,999, at most 4 decimal places), unit and region (1 to 60 characters each) and period (a month or a date no later than the sealing day) (R26.1).
      - An empty or out-of-bounds field gets a message saying what is allowed, every value is kept, and sealing is blocked until it is fixed or the row is removed (R26.2).
      - `build-payload.ts` writes each row into the v1 payload as a metric with `source: "self-reported"` and a `self-reported` figure with the value exactly as typed after trimming; no recall question is written for it; no new `format_version` (R26.3, R26.6).
      - The Reveal lists self-reported figures after the official ones under "Your own numbers", each labelled "self-reported" next to its value, with no now value and no change (R26.4, R13.4).
      - The landing copy may name rent and groceries only as numbers the user enters, labelled self-reported (R26.5).
    - Tests: Property 28 (self-reported numbers are validated and sealed as typed).
    - Earlier-spec tests changed or retired: `live/build-payload.property.test.ts` and `live/write-validation.property.test.ts` only where the new rows change an asserted value; name each in the PR.
    - Owner_Patches attached: m (`README.md`: line 20 gets the self-reported sentence back, text in design.md Owner patch m; applied only if 23.1 merges).
    - QA shots: `write-own-numbers` of `/demo/live` and `close` of `/l/<id>` with self-reported figures, at 1366x800, 1280x800 and 360x640.
    - QA steps: the rows this task adds to its PR, following the format of design.md "QA browser steps".
    - QA check: B1 `figure-boxes` PASS with the self-reported group shown (R3.5).
    - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes.
    - Validation: `bash scripts/check.sh`
    - _Requirements: R13.4, R26.1–R26.6_

- [ ] 24. Audit refresh after the go/no-go and the feature freeze
  - Agent: `frontend-dev` · Depends on: 22 · Estimated size: ~150 changed lines
  - Dependency note: the owner moves this task into tasks.md only after the go or no-go decision and the feature freeze, so the self-reported numbers task is already merged, closed or never moved in, and is not listed as a dependency.
  - Before this task: tasks 22 and 23 are merged or closed unmerged, the 20 November decision is recorded, and the 27 November freeze has passed. It runs whether task 23 ships or not, and is the last task before 4 December 2026, 2:00 PM PT.
  - Scope: the frontend-dev copy modules (`src/components/**/copy.ts`), `src/components/regions-scan.test.ts`, and the `*.test.ts(x)` for each copy module changed
  - Design sections: "Task outline (R31)" (notes on the gates), Owner patches f and g.
  - Acceptance:
    - The PR repeats the R19.1 claim list against `main` and fixes or removes every claim that no merged code makes true (R19.1, R19.2).
    - On a no-go, no copy module, page, card, How_Page or README section states that real letters can be sealed (R19.5, R25.2).
    - If task 23 did not ship, no page, copy module, README or How_Page mentions self-reported numbers (R26.7).
    - Every claim that depends on a group 1 to 5 task closed unmerged at the freeze is removed (R31.6).
  - Tests: none of the numbered properties. Example test: a scan of the copy modules for real-sealing and self-reported wording, matched to the recorded decisions.
  - Earlier-spec tests changed or retired: the copy tests of any module whose wording changes; name each in the PR.
  - Owner_Patches attached: f refreshed (README "Status" for what merged by the freeze, real sealing and self-reported lines per the decisions) (R19.3, R19.5); g refreshed (`docs/kiro-writeup.md` with every count retaken at the final `main` SHA, the SHA stated) (R28.2, R28.3).
  - QA shots: `scene` of `/` and `how-it-is-sealed` at 1366x800, 1280x800 and 360x640, only if this PR changes their copy.
  - QA steps: 08-10, 08-16.
  - QA check: no regression: every check that printed PASS before this task still prints PASS at all three sizes, if this PR changes anything on screen.
  - Validation: `bash scripts/check.sh`
  - _Requirements: R19.1–R19.3, R19.5, R25.2, R26.7, R28.2, R28.3, R31.5–R31.7_
