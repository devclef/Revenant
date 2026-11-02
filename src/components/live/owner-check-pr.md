# PR description: owner check and QA run for #135 (spec 06, task 10)

The owner check list is in `owner-check.md` in this folder. The owner ticks it on the live site. This file records the build measurements and the browser run.

## JS budget

`npm run build`, then `node scripts/check-js-budget.mjs`. Gzipped first load, from the build output:

| Route | First load | Budget | Result |
|---|---|---|---|
| `/demo` | 111.4 kB | 130 kB | ok |
| `/demo/live` | 158.9 kB | 190 kB | ok |
| `/l/[id]` | 177.3 kB | 190 kB | ok |

## Browser run

Throwaway Postgres, `npm run db:migrate`, `npm run seal-personas`, then the app on a local port. WebAuthn was stubbed as in `design.md`. Each step was captured at 1280 px and at 360 px.

| Step | Stage | 1280 px | 360 px |
|---|---|---|---|
| 02 | Write | ![Step 02 write at 1280 px](owner-check-shots/02-write.png) | ![Step 02 write at 360 px](owner-check-shots/02-write-360.png) |
| 07 | Sealed | ![Step 07 sealed at 1280 px](owner-check-shots/07-sealed.png) | ![Step 07 sealed at 360 px](owner-check-shots/07-sealed-360.png) |
| 09 | Unlock (seal intact) | ![Step 09 unlock at 1280 px](owner-check-shots/09-unlock.png) | ![Step 09 unlock at 360 px](owner-check-shots/09-unlock-360.png) |
| 10 | Recall | ![Step 10 recall at 1280 px](owner-check-shots/10-recall.png) | ![Step 10 recall at 360 px](owner-check-shots/10-recall-360.png) |
| 11 | Reveal | ![Step 11 reveal at 1280 px](owner-check-shots/11-reveal.png) | ![Step 11 reveal at 360 px](owner-check-shots/11-reveal-360.png) |
| 13 | Cannot lock (no PRF) | ![Step 13 cannot lock at 1280 px](owner-check-shots/13-unsupported.png) | ![Step 13 cannot lock at 360 px](owner-check-shots/13-unsupported-360.png) |

Screenshots are committed in `owner-check-shots/` next to this file.

## Findings

- No unreadable, unstyled or off-contrast text was found, so no code changed in this task.
- Recall: the first "Record my answers" press did not register after a typed guess. A "Look closer at the mark" button appeared instead. Marking "No answer" recorded the answer. Not fixed here; the owner may want to look at it.
- Step 07: no letter text or figure value is in the sealed-page DOM.
